// Dip-buy mean-reversion bot for btc-race-24h-20261117-0603.
//
// Dev window (2026-11-16 06:03 -> 2026-11-17 06:03 UTC): BTC essentially flat
// (+0.49% start to finish) inside a ~2.5% range, chopping between $63.9k and
// $65.5k with no trend to ride. Buy-and-hold makes ~$5; the house momentum and
// EMA baselines bleed on the whipsaws. The money in this window is in the
// handful of 1-2% peak-to-trough-to-peak swings: the live top 10 (all dip-buy
// / mean-reversion, +$44.60 to +$51.50 on 6-14 trades) each catch 3-7 of them
// with full-size entries.
//
// This bot fishes for exactly those swings, and nothing else:
//   - ENTRY: the close sits at least 0.4% below the trailing 45-bar high AND
//     the last 5 bars already bounce (+0.2% or more). The dip alone is not
//     enough -- in a flat window most dips are dead cats that grind lower --
//     and the bounce alone is not enough either, because buying a 5-bar
//     bounce at the highs just pays the round-trip cost. Both together mark
//     a trough that has turned. Full cash, one position.
//   - EXIT: take profit at +1.5% over the entry cost (the typical trough to
//     next-peak leg is 0.8-2.3%, so 1.5% banks most of it), a 1.0% trailing
//     stop below the running peak close (wide enough to survive the 0.5-0.7%
//     wiggles inside a rebound, tight enough to keep the gain when the leg
//     rolls over), and a 2.0% hard stop under cost as a backstop.
//   - Nothing else trades. No entries in the first 45 bars (no trailing high
//     yet), no shorts, no leverage, at most one order per batch.
//
// Tuned on the dev window with an exact replica of the harness fill model
// (4 bps fee, 2 bps modelled slippage, constant-product impact against each
// bar's open depth, fills at the next bar's open). A ~7,000-variant sweep over
// dip/mean-reversion/ladder/scale-in families picked this shape: it takes 2
// full round trips on the dev window (buy bar 392 @ ~$64.1k, sell bar 513 @
// ~$65.2k; buy bar 568 @ ~$64.4k, sell bar 961 @ ~$65.4k) plus a small late
// third entry, for about +$30 net PnL at ~0.8% max drawdown -- comfortably
// above the $0 dev gate, below the +$44.60 live top-10 cutoff, so it races
// but does not promise a prize. The dev window never decides the prize; the
// race window does. (The sweep plateaued at ~+$30: the +$44-51 leaders time
// this window's exact troughs, e.g. buying the bar-486 trough right before
// the +2.32% rally -- a timing no general rule reproduces, and chasing it
// would be overfitting to the dev window, which cannot help the race.)

import { runBars } from './vendor/makefun-bars.ts';
import type { BarsState, Batch, OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// How far the close must sit below the trailing high to count as a dip.
const DIP_WINDOW_BARS = 45;
const DIP_FRACTION = 0.004;
// Bounce confirmation: 5-bar return must already be at least this positive.
const BOUNCE_BARS = 5;
const BOUNCE_MIN = 0.002;
// Exits, all measured against the position's cost / running peak close.
const TAKE_PROFIT = 0.015;
const TRAILING_STOP = 0.01;
const HARD_STOP = 0.02;
// Max slippage covers the largest 1-minute move seen on the dev window
// (+0.45% / -0.34%) with room to spare.
const MAX_SLIPPAGE_BPS = 200;

const closes: number[] = [];
let peakClose = 0;

function trailingHigh(window: number): number {
  let high = 0;
  const start = Math.max(0, closes.length - window);
  for (let i = start; i < closes.length; i++) {
    if (closes[i] > high) high = closes[i];
  }
  return high;
}

function onBatch(state: BarsState, batch: Batch): OrderInput[] {
  const bars = batch.bars.filter((b) => b.symbol === SYMBOL);
  if (bars.length === 0) return [];
  const close = Number(bars[0].c);
  closes.push(close);

  const held = state.positions.get(SYMBOL);
  if (held !== undefined) {
    if (close > peakClose) peakClose = close;
    const value = Number(state.value(SYMBOL, held.qty));
    const cost = Number(held.cost);
    const gain = value / cost - 1;
    if (
      gain >= TAKE_PROFIT ||
      close <= peakClose * (1 - TRAILING_STOP) ||
      gain <= -HARD_STOP
    ) {
      return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  }

  const n = closes.length;
  if (n <= DIP_WINDOW_BARS) return [];
  const high = trailingHigh(DIP_WINDOW_BARS);
  const dipped = close < high * (1 - DIP_FRACTION);
  const bouncing = closes[n - 1] / closes[n - 1 - BOUNCE_BARS] - 1 >= BOUNCE_MIN;
  if (dipped && bouncing) {
    peakClose = close;
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
  }
  return [];
}

await runBars({ onBatch });
