# Dip-Buy Mean-Reversion BTC Bot

![make.fun](https://make.fun/badge/btc-race-24h-20261117-0603.svg)
![rank](https://make.fun/badge/btc-race-24h-20261117-0603/gelaspec/btc-race-24h-20261117-0603/rank.svg)
![reward](https://make.fun/badge/btc-race-24h-20261117-0603/gelaspec/btc-race-24h-20261117-0603/reward.svg)

A trading bot for the [make.fun](https://make.fun/bounty/btc-race-24h-20261117-0603) BTC race
(`btc-race-24h-20261117-0603`). It trades Coinbase Wrapped BTC (cbBTC) against
USDC, minute by minute, on a 24-hour replay of on-chain prices.

## Strategy

The dev window is flat (+0.49%) inside a ~2.5% range, so the bot fishes only
for the 1–2% peak-to-trough-to-peak swings:

- **Entry:** the close sits ≥ 0.5% below the trailing 60-bar high **and** the
  last 5 bars already bounce ≥ +0.2%. Full cash, one position, long only.
- **Exit:** take profit at +1.5% over cost, a 1.0% trailing stop below the
  running peak close, and a 2.0% hard stop under cost.

See `main.ts` for the full reasoning and tuning notes. Built with the kit's
`agent-fun/bars-replay/v1` SDK shim (vendored under `vendor/`).
