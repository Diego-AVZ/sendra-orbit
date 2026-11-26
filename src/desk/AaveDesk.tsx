import { useEffect, useState } from 'react';
import { readReserve } from '@/engine/chain';
import { LINK, USDC, WBTC, WETH, AAVE, type Asset } from '@/engine/assets';
import { Positions } from './Positions';
import { RangeForm } from './RangeForm';
import { useBook } from './book';
import { usd, usdcRaw } from './format';
import {
  ETH_USDC,
  coinOf,
  priceBand,
  rangeTicks,
  reservesFor,
  type RangeMode,
  type Risk,
  type Strategy,
} from './markets';
import { usePoolQuote } from './quotes';
import { Token } from './Token';

const KINDS = [
  { id: 5, label: 'Supply' },
  { id: 6, label: 'Leveraged long' },
  { id: 7, label: 'Short' },
  { id: 8, label: 'Borrow to LP' },
  { id: 9, label: 'Leveraged basket' },
] as const;

type Kind = (typeof KINDS)[number]['id'];

const COPY: Record<Kind, string> = {
  5: 'Deposit the asset and earn the Aave supply rate. No debt, so there is no health factor.',
  6: 'Borrow USDC against the asset and buy more of it. Each loop adds a turn of leverage, capped by the LTV.',
  7: 'Post USDC, borrow the asset and sell it. You profit if that asset falls.',
  8: 'Post BTC or ETH, borrow USDC, and deposit it in the ETH/USDC 0.05% range.',
  9: 'Hold one asset as collateral and buy up to three more with borrowed USDC.',
};

function choicesFor(kind: Kind): Asset[] {
  if (kind === 5) return [USDC, WBTC, WETH];
  if (kind === 7 || kind === 8 || kind === 9) return [WBTC, WETH];
  return [WBTC, WETH, LINK, AAVE];
}

export function AaveDesk() {
  const book = useBook();
  const [kind, setKind] = useState<Kind>(5);
  const [assetId, setAssetId] = useState(USDC.address);
  const [amount, setAmount] = useState('500');
  const [loops, setLoops] = useState(2);
  const [borrowPct, setBorrowPct] = useState(50);
  const [legs, setLegs] = useState([{ address: WETH.address, borrowPct: 40 }]);
  const [mode, setMode] = useState<RangeMode>('preset');
  const [strategy, setStrategy] = useState<Strategy>('neutral');
  const [risk, setRisk] = useState<Risk>('medium');
  const [lowPct, setLowPct] = useState('10');
  const [highPct, setHighPct] = useState('10');
  const [inside, setInside] = useState(true);
  const [apr, setApr] = useState<number | null>(null);
  const [usdcLtv, setUsdcLtv] = useState<number | null>(null);
  const choices = choicesFor(kind);
  const asset = choices.find((item) => item.address === assetId) ?? choices[0];
  const pool = usePoolQuote(kind === 8 ? ETH_USDC : null);
  const band = priceBand(pool.quote?.price ?? 0, mode, strategy, risk, lowPct, highPct, inside);
  const ticks = pool.quote && band.min > 0 && band.max > band.min
    ? rangeTicks(band.min, band.max, ETH_USDC.token0.decimals, ETH_USDC.token1.decimals, ETH_USDC.feePips)
    : null;
  const basketAssets = [WBTC, WETH, LINK, AAVE].filter((item) => item.address !== asset.address);
  const basket = legs.reduce<Array<{ asset: Asset; borrowPct: number }>>((list, leg) => {
    const pick = basketAssets.find((item) => item.address === leg.address);
    if (!pick || list.some((item) => item.asset.address === pick.address)) return list;
    list.push({ asset: pick, borrowPct: leg.borrowPct });
    return list;
  }, []);
  const numeric = Number(amount);
  const needsBorrow = kind === 6 || kind === 7 || kind === 8;
  const borrowBps = Math.round(borrowPct * 100);
  const blocker = !book.ready
    ? 'Loading…'
    : !(numeric > 0) ? 'Enter an amount'
      : numeric > book.cashUsd ? 'Not enough paper USDC'
            : needsBorrow && (borrowBps < 1 || borrowBps > 7500) ? 'Borrow must be 1% to 75%'
              : kind === 7 && usdcLtv === 0 ? 'USDC cannot collateralize a borrow right now'
          : kind === 8 && !ticks ? (pool.error ?? 'Loading the pool price…')
            : kind === 9 && basket.length === 0 ? 'Add a basket asset'
              : kind === 9 && basket.some((leg) => {
                const bps = Math.round(leg.borrowPct * 100);
                return bps < 1 || bps > 7500;
              }) ? 'Each leg borrows 1% to 75%'
                : null;

  useEffect(() => {
    let cancel = false;
    readReserve(USDC)
      .then((reserve) => {
        if (!cancel) setUsdcLtv(reserve.ltvBps);
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    readReserve(asset)
      .then((reserve) => {
        if (cancel) return;
        const rate = kind === 7 ? reserve.variableBorrowRate : reserve.liquidityRate;
        setApr(Number(rate / 10n ** 23n) / 100);
      })
      .catch(() => {
        if (!cancel) setApr(null);
      });
    return () => {
      cancel = true;
    };
  }, [asset, kind]);

  const submit = () => {
    if (blocker || book.pending) return;
    const principalUsdc = usdcRaw(numeric);
    const reserves = reservesFor([asset, ETH_USDC.token0, ETH_USDC.token1]);
    if (kind === 8 && ticks) {
      void book.openLeveraged({
        kind: 8,
        principalUsdc,
        asset,
        reserves,
        borrowBps,
        collateralIsAsset: true,
        pool: ETH_USDC.pool,
        token0: ETH_USDC.token0.address,
        token1: ETH_USDC.token1.address,
        decimals0: ETH_USDC.token0.decimals,
        decimals1: ETH_USDC.token1.decimals,
        feePips: ETH_USDC.feePips,
        tickLower: ticks.tickLower,
        tickUpper: ticks.tickUpper,
      });
      return;
    }
    if (kind === 8) return;
    void book.openAave({
      kind,
      principalUsdc,
      asset,
      reserves: reservesFor(kind === 9 ? [asset, ...basket.map((leg) => leg.asset)] : [asset]),
      loops: kind === 6 || kind === 7 ? loops : undefined,
      borrowBps: kind === 6 || kind === 7 ? borrowBps : undefined,
      basket: kind === 9 ? basket.map((leg) => ({ asset: leg.asset, borrowBps: Math.round(leg.borrowPct * 100) })) : undefined,
    });
  };

  return (
    <div className="ob-desk">
      <div className="ob-grid">
        <section className="ob-panel">
          <div className="ob-form">
            <div className="ob-seg wrap" role="radiogroup" aria-label="Strategy">
              {KINDS.map((item) => (
                <button key={item.id} type="button" className={kind === item.id ? 'is-on' : ''} onClick={() => setKind(item.id)}>
                  {item.label}
                </button>
              ))}
            </div>
            <p className="ob-copy">{COPY[kind]}</p>
            <div className="ob-coins" role="radiogroup" aria-label={kind === 8 ? 'Collateral' : 'Asset'}>
              {choices.map((item) => {
                const coin = coinOf(item.symbol);
                return (
                  <button key={item.address} type="button" className={`ob-asset${asset.address === item.address ? ' is-on' : ''}`} onClick={() => setAssetId(item.address)}>
                    <Token symbol={coin} size={16} />
                    {coin}
                  </button>
                );
              })}
            </div>
            <div>
              <div className="ob-field" style={{ marginBottom: 8 }}>
                <span>
                  Amount USDC
                  <button type="button" className="ob-text" onClick={() => setAmount((Math.floor(book.cashUsd * 100) / 100).toString())}>
                    {usd(book.cashUsd)} available
                  </button>
                </span>
              </div>
              <div className="ob-amount">
                <span>$</span>
                <input value={amount} inputMode="decimal" placeholder="0" onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))} />
              </div>
            </div>
            <div className="ob-chips">
              {[25, 50, 75, 100].map((pct) => (
                <button key={pct} type="button" className="ob-chip" onClick={() => setAmount((Math.floor(book.cashUsd * pct) / 100).toString())}>{pct}%</button>
              ))}
            </div>
            {(kind === 6 || kind === 7) && (
              <div className="ob-field">
                <span>Loops</span>
                <div className="ob-seg cols-2" role="radiogroup" aria-label="Loops">
                  {[1, 2].map((value) => (
                    <button key={value} type="button" className={loops === value ? 'is-on' : ''} onClick={() => setLoops(value)}>{value}</button>
                  ))}
                </div>
              </div>
            )}
            {needsBorrow && (
              <label className="ob-field">
                <span>Borrow {borrowPct}% of capacity</span>
                <input type="number" min={1} max={75} value={borrowPct} onChange={(event) => setBorrowPct(Number(event.target.value))} />
              </label>
            )}
            {kind === 9 && (
              <div className="ob-field">
                <span>
                  Basket
                  <button
                    type="button"
                    className="ob-text"
                    onClick={() => {
                      const next = basketAssets.find((item) => !legs.some((leg) => leg.address === item.address));
                      if (next && legs.length < 3) setLegs([...legs, { address: next.address, borrowPct: 30 }]);
                    }}
                  >
                    Add
                  </button>
                </span>
                {legs.map((leg, index) => (
                  <div key={`${leg.address}-${index}`} className="ob-leg">
                    <select
                      value={basketAssets.some((item) => item.address === leg.address) ? leg.address : basketAssets[0]?.address}
                      onChange={(event) => setLegs(legs.map((item, i) => i === index ? { ...item, address: event.target.value } : item))}
                    >
                      {basketAssets.map((item) => <option key={item.address} value={item.address}>{coinOf(item.symbol)}</option>)}
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={75}
                      value={leg.borrowPct}
                      aria-label="Borrow percent"
                      onChange={(event) => setLegs(legs.map((item, i) => i === index ? { ...item, borrowPct: Number(event.target.value) } : item))}
                    />
                    <button type="button" className="ob-mini" onClick={() => setLegs(legs.filter((_, i) => i !== index))}>Remove</button>
                  </div>
                ))}
              </div>
            )}
            {kind === 8 && (
              <RangeForm
                current={pool.quote?.price ?? 0}
                unit="USDC per ETH"
                mode={mode}
                strategy={strategy}
                risk={risk}
                lowPct={lowPct}
                highPct={highPct}
                startInside={inside}
                onMode={setMode}
                onStrategy={setStrategy}
                onRisk={setRisk}
                onLow={setLowPct}
                onHigh={setHighPct}
                onInside={setInside}
              />
            )}
            <p className="ob-copy">
              {apr == null ? 'Reading the reserve…' : `${kind === 7 ? 'Borrow' : 'Supply'} APR ${apr.toFixed(2)}% on ${coinOf(asset.symbol)}.`}
              {' '}Cash available {usd(book.cashUsd)}.
            </p>
            {blocker && <p className="ob-status">{blocker}</p>}
            <button type="button" className="ob-btn" disabled={!!blocker || book.pending} onClick={submit}>
              {book.pending ? 'Working…' : KINDS.find((item) => item.id === kind)?.label}
            </button>
          </div>
        </section>
        <section className="ob-panel">
          <Positions kinds={[5, 6, 7, 8, 9]} empty="No Aave positions yet." />
        </section>
      </div>
    </div>
  );
}
