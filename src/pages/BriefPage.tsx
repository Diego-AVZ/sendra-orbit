import { useEffect } from 'react';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';

const PRICES = [
  { name: 'Starter', fee: '$25', book: '$3.000' },
  { name: 'Advanced', fee: '$49', book: '$5.000' },
  { name: 'Pro', fee: '$99', book: '$10.000' },
] as const;

const NOW = [
  ['P1', 'Landing, compra y activación de la cuenta.'],
  ['P2', 'Paper de Uniswap LP, Aave y spot. LP primero: ticks, fees e IL, no solo el precio.'],
  ['P3', 'Reglas, drawdown y pass/fail. Los decide el backend.'],
  ['P4', 'Pilotos: si pagan, si terminan y si la simulación cuadra.'],
] as const;

const LATER = [
  ['P5', 'Enclaves, SRPE, tesorería y revisión legal.'],
  ['P6', 'Primera cohorte funded, pequeña y seguida de cerca.'],
  ['P7', 'Creator Studio, cuando Orbit ya esté validado.'],
] as const;

const FLOW = [
  { label: 'Descubre', now: true },
  { label: 'Paga', now: true },
  { label: 'Paper', now: true },
  { label: 'Evaluación', now: true },
  { label: 'Revisión', now: false },
  { label: 'Funded', now: false },
  { label: 'Payout', now: false },
] as const;

export function BriefPage() {
  useEffect(() => {
    const title = document.title;
    const lang = document.documentElement.lang;
    document.title = 'Sendra Orbit — Brief interno';
    document.documentElement.lang = 'es';
    return () => {
      document.title = title;
      document.documentElement.lang = lang;
    };
  }, []);

  return (
    <div className="land brief">
      <a className="sr-only" href="#contenido">
        Saltar al contenido
      </a>
      <SiteHeader />
      <main id="contenido">
        <section className="brief-hero">
          <div className="land-wrap">
            <p className="land-eyebrow">Sendra Labs · documento interno · noviembre 2026</p>
            <h1>
              Cobramos la evaluación
              <em>mientras se audita el core.</em>
            </h1>
            <p className="land-lede">
              Orbit es el primer producto comercial de Sendra. Blackhole sigue siendo la infraestructura.
              Vendemos una prueba con <strong>mercado real y capital ficticio</strong>. El capital de verdad
              espera a la auditoría, a la tesorería y a unas reglas publicadas.
            </p>
          </div>
        </section>

        <section className="land-sec" id="problemas" style={{ paddingTop: '2.2rem' }}>
          <div className="land-wrap">
            <div className="brief-duo">
              <article className="brief-card">
                <p className="land-kicker">Ahora · auditoría</p>
                <h2>El paper no espera al enclave.</h2>
                <p>
                  Orbit no sustituye Blackhole ni copia su accounting, su ejecución ni SRPE. El simulador
                  es un motor propio, con los mismos conceptos contables. El core se cierra y se audita en
                  paralelo. La fase funded no se promete hasta que esa revisión exista.
                </p>
                <p className="brief-note">
                  Que el primer capital sea de la empresa no evita la auditoría. El riesgo de los contratos
                  sigue ahí.
                </p>
              </article>
              <article className="brief-card">
                <p className="land-kicker">Ahora · ingresos</p>
                <h2>La primera caja es la tarifa.</h2>
                <p>
                  El usuario paga el acceso al programa, no un saldo retirable. El P&amp;L del paper no se
                  cobra. El reparto —ejemplo 80/20— solo aplica al beneficio neto de una cuenta funded.
                </p>
                <ul className="brief-prices">
                  {PRICES.map((tier) => (
                    <li key={tier.name}>
                      <span>{tier.name}</span>
                      <strong>{tier.fee}</strong>
                      <em>{tier.book} virtuales</em>
                    </li>
                  ))}
                </ul>
                <p className="brief-note">
                  Precios, tamaños y límites son hipótesis. Se prueban con conversión, coste y fraude.
                  Esas tarifas no financian solas las cuentas funded.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="land-sec" id="producto">
          <div className="land-wrap">
            <div className="land-sec-head">
              <p className="land-kicker">El producto</p>
              <h2>Una vía de la infra al operador.</h2>
              <p>Descubrir operadores, medirlos con mercado real y asignar capital solo cuando toque.</p>
            </div>
            <ul className="stack">
              <li>
                <h3>Blackhole</h3>
                <p>Ejecución, accounting, permisos SRPE y Pulse. Orbit lo consume. No lo reescribe.</p>
              </li>
              <li>
                <h3>Orbit</h3>
                <p>Evaluación y, más adelante, asignación. Lo operamos nosotros. Marca y landing propias.</p>
              </li>
              <li>
                <h3>Creator Studio</h3>
                <p>Que un tercero monte su programa. Después de demostrar que el nuestro funciona.</p>
              </li>
            </ul>
            <ol className="brief-flow" aria-label="Del descubrimiento al payout">
              {FLOW.map((step) => (
                <li key={step.label} className={step.now ? 'is-now' : undefined}>
                  {step.label}
                </li>
              ))}
            </ol>
            <p className="brief-legend">
              <b>Este lanzamiento</b> llega hasta la evaluación. Revisión, funded y payout quedan cerrados
              hasta que haya capital y controles.
            </p>
          </div>
        </section>

        <section className="land-sec" id="plan">
          <div className="land-wrap">
            <div className="land-sec-head">
              <p className="land-kicker">Qué hacemos</p>
              <h2>Paper primero. Capital después.</h2>
            </div>
            <div className="brief-plan">
              <article className="brief-card">
                <p className="land-kicker">En curso</p>
                <h2>Salimos sin custodiar fondos.</h2>
                <ol className="brief-list">
                  {NOW.map(([id, line]) => (
                    <li key={id}>
                      <b>{id}</b>
                      <span>{line}</span>
                    </li>
                  ))}
                </ol>
              </article>
              <article className="brief-card is-later">
                <p className="land-kicker">Cuando el core esté listo</p>
                <h2>Funded es otra fase.</h2>
                <ol className="brief-list">
                  {LATER.map(([id, line]) => (
                    <li key={id}>
                      <b>{id}</b>
                      <span>{line}</span>
                    </li>
                  ))}
                </ol>
              </article>
            </div>
            <p className="brief-rule">
              El backend es la fuente de verdad. El frontend no fija el balance, el P&amp;L ni si la cuenta
              pasó.
            </p>
          </div>
        </section>

        <section className="land-sec" id="decision">
          <div className="land-wrap">
            <div className="brief-decision">
              <p className="land-kicker">Decisión</p>
              <p>
                Lanzar un paper fiel y cobrar la evaluación. No presentar el capital funded como disponible
                hasta que la simulación esté validada, las reglas publicadas, los controles operativos y el
                capital aprobado.
              </p>
              <p className="brief-sign">Blackhole construye. Orbit descubre operadores. El capital se asigna después.</p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
