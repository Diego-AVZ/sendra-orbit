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
  return store(position, accessToken);
}

export async function saveMark(position: PaperPosition, accessToken?: string): Promise<PaperPosition> {
  return store(position, accessToken);
}

/** Update the row. If this browser still has a position Supabase never received, insert it before the mark. */
async function store(position: PaperPosition, accessToken?: string): Promise<PaperPosition> {
  const saved = toRow(position);
  const patched = await request<PositionRow[]>(`positions?id=eq.${position.id}`, {
    method: 'PATCH',
    token: accessToken,
    body: {
      status: saved.status,
      closed_at: saved.closed_at,
      mark: saved.mark,
      close: saved.close,
      pnl_usd: saved.pnl_usd,
      principal_raw: saved.principal_raw,
      capital_out_raw: saved.capital_out_raw,
      pnl_raw: saved.pnl_raw,
    },
  });
  const row = patched[0] ?? await insertPosition(saved, accessToken);
  if (position.mark) await insertMark(position, accessToken);
  return fromRow(row);
}

async function insertPosition(row: PositionRow, accessToken?: string): Promise<PositionRow> {
  const created = await request<PositionRow[]>('positions?on_conflict=id', {
    method: 'POST',
    token: accessToken,
    prefer: 'resolution=merge-duplicates,return=representation',
    body: row,
  });
  if (!created[0]) throw new Error('Supabase did not store this position');
  return created[0];
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

export async function listPositions(accessToken?: string, evaluationId?: string | null): Promise<PaperPosition[]> {
  const filter = evaluationId ? `&evaluation_id=eq.${evaluationId}` : '';
  const rows = await request<PositionRow[]>(`positions?select=*&order=opened_at.desc${filter}`, { token: accessToken });
  return rows.map(fromRow).filter((position) => !evaluationId || position.evaluationId === evaluationId);
}

export async function loadPosition(id: string, accessToken?: string): Promise<PaperPosition> {
  const rows = await request<PositionRow[]>(`positions?id=eq.${id}&select=*`, { token: accessToken });
  if (!rows[0]) throw new Error('position not found');
  return fromRow(rows[0]);
}

async function request<T>(path: string, init: { method?: string; token?: string; body?: unknown; prefer?: string } = {}): Promise<T> {
  const config = supabaseConfig();
  if (!config) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    method: init.method ?? 'GET',
    headers: {
      apikey: config.key,
      authorization: `Bearer ${init.token ?? config.key}`,
      'content-type': 'application/json',
      prefer: init.prefer ?? 'return=representation',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401 || response.status === 403 || response.status === 409 || text.includes('row-level security')) {
      throw new Error('Saved in this browser. The shared book refused the write.');
    }
    throw new Error(`Supabase ${response.status}`);
  }
  return (await response.json()) as T;
}
