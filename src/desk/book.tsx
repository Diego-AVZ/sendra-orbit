import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Asset } from '@/engine/assets';
import {
  closeLive,
  listPositions,
  openAaveLive,
  openLeveragedLive,
  openLpLive,
  openSpotLive,
  refreshLive,
  supabaseConfig,
  type PaperPosition,
} from '@/engine';
import { reviewAccount, type EvalAccount } from '@/engine/accounts';
import { fromRow, toRow, type PositionRow } from '@/engine/position';
import type { AaveOpenInput } from '@/engine/aave';
import { note } from './format';
import { useSession } from './session';

const KEY = 'sendra-orbit.book';

type LiveInput = { principalUsdc?: bigint };

type BookApi = {
  ready: boolean;
  pending: boolean;
  remote: boolean;
  warning: string | null;
  clearWarning: () => void;
  account: EvalAccount | null;
  capitalUsd: number;
  positions: PaperPosition[];
  cashUsd: number;
  deployedUsd: number;
  openPnlUsd: number;
  equityUsd: number;
  realizedUsd: number;
  openSpot: (asset: Asset, amount: number, priceUsd: number) => Promise<void>;
  openAave: (input: AaveOpenInput) => Promise<void>;
  openLeveraged: (input: Parameters<typeof openLeveragedLive>[0]) => Promise<void>;
  openLp: (input: Parameters<typeof openLpLive>[0], spendUsd: number) => Promise<void>;
  close: (id: string) => Promise<void>;
};

const BookContext = createContext<BookApi | null>(null);

function storageKey(accountId: string) {
  return `${KEY}.${accountId}`;
}

function readLocal(accountId: string): PaperPosition[] {
  try {
    const raw = localStorage.getItem(storageKey(accountId));
    if (!raw) return [];
    const rows = JSON.parse(raw) as PositionRow[];
    return rows.map(fromRow).filter((position) => position.evaluationId === accountId);
  } catch {
    return [];
  }
}

function writeLocal(accountId: string, positions: PaperPosition[]) {
  localStorage.setItem(storageKey(accountId), JSON.stringify(positions.map(toRow)));
}

export function principalOf(position: PaperPosition): number {
  const snapshot = position.snapshot as { principalUsd?: number; aave?: { principalUsd?: number } };
  return snapshot.principalUsd ?? snapshot.aave?.principalUsd ?? 0;
}

export function cashOf(positions: PaperPosition[], start: number): number {
  let cash = start;
  for (const position of positions) {
    cash -= principalOf(position);
    if (position.status === 'closed') cash += position.close?.equityUsd ?? principalOf(position);
  }
  return cash;
}

export function equityOf(positions: PaperPosition[], start: number): number {
  const open = positions
    .filter((position) => position.status === 'open')
    .reduce((sum, position) => sum + (position.mark?.equityUsd ?? principalOf(position)), 0);
  return cashOf(positions, start) + open;
}

function tradable(account: EvalAccount | null, positions: PaperPosition[], amount: number): EvalAccount {
  if (!account) throw new Error('Buy an evaluation before opening a position');
  if (account.status !== 'active') throw new Error('This evaluation is closed');
  if (!(amount > 0) || !Number.isFinite(amount)) throw new Error('Enter an amount');
  if (amount > cashOf(positions, account.capitalUsd) + 0.000_001) throw new Error('Not enough paper USDC');
  return account;
}

export function BookProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const account = session.account;
  const remote = supabaseConfig() != null;
  const [positions, setPositions] = useState<PaperPosition[]>([]);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const positionsRef = useRef(positions);
  const accountRef = useRef(account);
  const reviewed = useRef('');
  const chain = useRef(Promise.resolve());
  const queued = useRef(0);
  positionsRef.current = positions;
  accountRef.current = account;

  const commit = (next: PaperPosition) => {
    const accountId = next.evaluationId ?? accountRef.current?.id;
    setPositions((prev) => {
      const exists = prev.some((item) => item.id === next.id);
      const list = exists ? prev.map((item) => (item.id === next.id ? next : item)) : [next, ...prev];
      if (accountId) writeLocal(accountId, list);
      return list;
    });
  };

  useEffect(() => {
    if (!session.ready) return;
    let cancel = false;
    const current = accountRef.current;
    if (!current) {
      setPositions([]);
      setReady(true);
      return;
    }
    const accountId = current.id;
    const local = readLocal(accountId);
    setPositions(local);
    setReady(false);
    if (!remote) {
      setReady(true);
      return;
    }
    listPositions(undefined, accountId)
      .then((rows) => {
        if (cancel || accountRef.current?.id !== accountId) return;
        if (rows.length > 0 || local.length === 0) {
          setPositions(rows);
          writeLocal(accountId, rows);
        }
      })
      .catch((error: unknown) => {
        if (cancel) return;
        const text = note(error);
        if (/supabase|shared book|saved in this browser/i.test(text)) return;
        setWarning(text);
      })
      .finally(() => {
        if (!cancel) setReady(true);
      });
    return () => {
      cancel = true;
    };
  }, [remote, session.ready, account?.id]);

  const enqueue = (task: () => Promise<void>, quiet: boolean) => {
    if (!quiet) {
      setPending(true);
      setWarning(null);
    }
    queued.current += 1;
    const job = chain.current.then(async () => {
      try {
        await task();
      } catch (error) {
        const text = note(error);
        setWarning((prev) => (quiet ? prev ?? text : text));
      } finally {
        queued.current -= 1;
        if (!quiet) setPending(false);
      }
    });
    chain.current = job.then(
      () => undefined,
      () => undefined,
    );
    return job;
  };

  useEffect(() => {
    if (!ready) return;
    const tick = () => {
      if (queued.current > 0) return;
      const open = positionsRef.current.filter((position) => position.status === 'open');
      if (!open.length) return;
      void enqueue(async () => {
        for (const position of open) {
          const current = positionsRef.current.find((item) => item.id === position.id);
          if (!current || current.status !== 'open') continue;
          const result = await refreshLive(current, { persist: remote });
          commit(result.position);
          const text = result.warnings.filter((item) => !/supabase|shared book|saved in this browser|execution reverted/i.test(item)).join(' ');
          if (text) setWarning((prev) => prev ?? text);
          else setWarning((prev) => (prev && /execution reverted/i.test(prev) ? null : prev));
        }
      }, true);
    };
    const first = window.setTimeout(tick, 4_000);
    const id = window.setInterval(tick, 45_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [ready, remote]);

  const capitalUsd = account?.capitalUsd ?? 0;
  const equityUsd = equityOf(positions, capitalUsd);

  useEffect(() => {
    const current = accountRef.current;
    if (!ready || !current) return;
    if (positions.some((position) => position.evaluationId !== current.id)) return;
    const next = reviewAccount(current, equityOf(positions, current.capitalUsd));
    if (!next) return;
    const key = `${next.id}:${next.status}:${next.dayUtc}:${next.dayEquityUsd}`;
    if (reviewed.current === key) return;
    reviewed.current = key;
    void session.patchAccount(next).catch((error: unknown) => setWarning(note(error)));
  }, [ready, positions, account?.id, account?.status, account?.dayUtc, session]);

  const api = useMemo<BookApi>(() => {
    const spend = (input: LiveInput) => Number(input.principalUsdc ?? 0n) / 1e6;
    return {
      ready,
      pending,
      remote,
      warning,
      clearWarning: () => setWarning(null),
      account,
      capitalUsd,
      positions,
      cashUsd: cashOf(positions, capitalUsd),
      deployedUsd: positions.filter((position) => position.status === 'open').reduce((sum, position) => sum + principalOf(position), 0),
      openPnlUsd: positions.filter((position) => position.status === 'open').reduce((sum, position) => sum + (position.mark?.pnlUsd ?? 0), 0),
      equityUsd,
      realizedUsd: positions.filter((position) => position.status === 'closed').reduce((sum, position) => sum + (position.close?.pnlUsd ?? 0), 0),
      openSpot: (asset, amount, priceUsd) => enqueue(async () => {
        const current = tradable(accountRef.current, positionsRef.current, amount);
        const result = await openSpotLive({
          asset,
          principalUsdc: BigInt(Math.round(amount * 1_000_000)),
          priceUsd,
          persist: remote,
          evaluationId: current.id,
        });
        commit(result.position);
        if (result.warnings.length) setWarning(result.warnings.join(' '));
      }, false),
      openAave: (input) => enqueue(async () => {
        const current = tradable(accountRef.current, positionsRef.current, spend(input));
        const result = await openAaveLive({ ...input, persist: remote, evaluationId: current.id });
        commit(result.position);
        if (result.warnings.length) setWarning(result.warnings.join(' '));
      }, false),
      openLeveraged: (input) => enqueue(async () => {
        const current = tradable(accountRef.current, positionsRef.current, spend(input));
        const result = await openLeveragedLive({ ...input, persist: remote, evaluationId: current.id });
        commit(result.position);
        if (result.warnings.length) setWarning(result.warnings.join(' '));
      }, false),
      openLp: (input, amount) => enqueue(async () => {
        const current = tradable(accountRef.current, positionsRef.current, amount);
        const result = await openLpLive({ ...input, persist: remote, evaluationId: current.id });
        commit(result.position);
        if (result.warnings.length) setWarning(result.warnings.join(' '));
      }, false),
      close: (id) => enqueue(async () => {
        const position = positionsRef.current.find((item) => item.id === id);
        if (!position || position.status === 'closed') return;
        const result = await closeLive(position, { persist: remote });
        commit(result.position);
        if (result.warnings.length) setWarning(result.warnings.join(' '));
      }, false),
    };
  }, [account, capitalUsd, equityUsd, pending, positions, ready, remote, warning]);

  return <BookContext.Provider value={api}>{children}</BookContext.Provider>;
}

export function useBook(): BookApi {
  const book = useContext(BookContext);
  if (!book) throw new Error('useBook outside the desk');
  return book;
}
