import { fromRow, toRow, type PaperPosition, type PositionRow } from './position';

type Config = { url: string; key: string };

export function supabaseConfig(): Config | null {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
  const url = env?.VITE_SUPABASE_URL;
  const key = env?.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ''), key };
}

export async function savePosition(position: PaperPosition, accessToken?: string): Promise<PaperPosition> {
  const row = await request<PositionRow[]>('positions', {
    method: 'POST',
    token: accessToken,
    body: toRow(position),
  });
  if (position.mark) await insertMark(position, accessToken);
  return fromRow(row[0]);
}

export async function saveMark(position: PaperPosition, accessToken?: string): Promise<PaperPosition> {
  const saved = toRow(position);
  const row = await request<PositionRow[]>(`positions?id=eq.${position.id}`, {
    method: 'PATCH',
    token: accessToken,
    body: {
      status: saved.status,
      closed_at: saved.closed_at,
      mark: saved.mark,
      close: saved.close,
      pnl_usd: saved.pnl_usd,
    },
  });
  if (position.mark) await insertMark(position, accessToken);
  return fromRow(row[0]);
}

async function insertMark(position: PaperPosition, accessToken?: string) {
  if (!position.mark) return;
  await request('position_marks', {
    method: 'POST',
    token: accessToken,
    body: {
      position_id: position.id,
      at: position.mark.at,
      equity_usd: position.mark.equityUsd,
      pnl_usd: position.mark.pnlUsd,
      fees_usd: position.mark.feesUsd,
      in_range: position.mark.inRange,
      health_factor: position.mark.healthFactor,
    },
  });
}

export async function loadPosition(id: string, accessToken?: string): Promise<PaperPosition> {
  const rows = await request<PositionRow[]>(`positions?id=eq.${id}&select=*`, { token: accessToken });
  if (!rows[0]) throw new Error('position not found');
  return fromRow(rows[0]);
}

async function request<T>(path: string, init: { method?: string; token?: string; body?: unknown } = {}): Promise<T> {
  const config = supabaseConfig();
  if (!config) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    method: init.method ?? 'GET',
    headers: {
      apikey: config.key,
      authorization: `Bearer ${init.token ?? config.key}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  return (await response.json()) as T;
}
