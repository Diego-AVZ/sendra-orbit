import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ACCOUNT_KEY,
  cacheAccounts,
  connectWallet,
  loadAccounts,
  readCache,
  readConnectedWallet,
  saveAccount,
  watchWallet,
  type EvalAccount,
} from '@/engine/accounts';

type SessionApi = {
  ready: boolean;
  wallet: string | null;
  accounts: EvalAccount[];
  account: EvalAccount | null;
  warning: string | null;
  connect: () => Promise<void>;
  reload: () => Promise<void>;
  select: (id: string) => void;
  patchAccount: (next: EvalAccount) => Promise<void>;
};

const SessionContext = createContext<SessionApi | null>(null);

function note(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not load accounts';
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [wallet, setWallet] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<EvalAccount[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const apply = useCallback((address: string, rows: EvalAccount[]) => {
    setAccounts(rows);
    const saved = localStorage.getItem(ACCOUNT_KEY);
    setSelectedId((prev) => {
      const keep = prev && rows.some((item) => item.id === prev) ? prev : null;
      return keep ?? rows.find((item) => item.id === saved)?.id ?? rows[0]?.id ?? null;
    });
    cacheAccounts(address, rows);
  }, []);

  const refresh = useCallback(async (address: string | null) => {
    if (!address) {
      setAccounts([]);
      setSelectedId(null);
      return;
    }
    try {
      apply(address, await loadAccounts(address));
      setWarning(null);
    } catch (error) {
      const cached = readCache(address);
      apply(address, cached);
      setWarning(note(error));
    }
  }, [apply]);

  useEffect(() => {
    let cancel = false;
    readConnectedWallet()
      .then((address) => {
        if (cancel) return;
        setWallet(address);
        return refresh(address);
      })
      .catch((error: unknown) => {
        if (!cancel) setWarning(note(error));
      })
      .finally(() => {
        if (!cancel) setReady(true);
      });
    return () => {
      cancel = true;
    };
  }, [refresh]);

  useEffect(() => watchWallet((address) => {
    setWallet(address);
    void refresh(address);
  }), [refresh]);

  const api = useMemo<SessionApi>(() => ({
    ready,
    wallet,
    accounts,
    account: accounts.find((item) => item.id === selectedId) ?? null,
    warning,
    connect: async () => {
      try {
        const address = await connectWallet();
        setWallet(address);
        await refresh(address);
        setReady(true);
      } catch (error) {
        setWarning(note(error));
        throw error;
      }
    },
    reload: () => refresh(wallet),
    select: (id: string) => {
      setSelectedId(id);
      localStorage.setItem(ACCOUNT_KEY, id);
    },
    patchAccount: async (next: EvalAccount) => {
      setAccounts((prev) => prev.map((item) => (item.id === next.id ? next : item)));
      if (wallet) {
        const list = accounts.map((item) => (item.id === next.id ? next : item));
        cacheAccounts(wallet, list);
      }
      await saveAccount(next);
    },
  }), [accounts, ready, refresh, selectedId, wallet, warning]);

  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionApi {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession outside the desk');
  return session;
}
