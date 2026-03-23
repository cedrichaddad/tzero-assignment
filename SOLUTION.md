# tZERO Secondary Marketplace Assessment

Video Demo Link: https://www.loom.com/share/d8a46e084ea34c24b9fb832a935ca81a

## Overview
This implementation delivers a transaction-safe secondary marketplace on top of the provided Next.js 14, MUI, and SQLite starter. The finished system supports asset discovery, live executable order books, limit order placement and cancellation, trading portfolio tracking, and real-time UI refresh through polling.

## Technical Decisions
1. **Precision policy**
   All trading arithmetic in the Node layer uses `decimal.js` with explicit fixed-point normalization. Prices and cash notionals are normalized to 5 decimal places, and all rounding uses `ROUND_HALF_UP`. This avoids floating-point drift during balance checks, cash settlement, and weighted average cost updates.

2. **Executable liquidity, not a fake hybrid book**
   The JSON template order book is materialized as synthetic market-maker resting orders under a reserved `system_market_maker` user. The UI reads aggregated depth directly from `trading_orders`, so displayed liquidity is the same liquidity the matcher executes against. Depth naturally depletes as trades consume it.

3. **Atomic validation, matching, and settlement**
   `POST /api/trading/orders` performs stale-order expiry, idempotency checks, lock calculations, self-trade prevention, matching, holdings updates, and cash settlement inside one synchronous SQLite transaction. This avoids split-brain logic between “pre-check” and “commit” phases.

4. **Dynamic available balance and share locking**
   The schema does not have locked balance/share columns, so the API calculates availability from active open orders on every trading mutation and portfolio read. Open buy orders lock cash; open sell orders lock shares. Cancelling an order releases only the remaining locked portion.

5. **Lazy expiry and practical STP**
   `day` and `gtd` orders are lazily expired on each trading read/mutation, which prevents stale orders from matching without introducing a scheduler. Self-crossing orders are rejected with a clear error. Real trading venues typically implement configurable self-trade prevention modes such as cancel-newest or cancel-resting; for this assessment, reject-incoming is the safest and clearest policy.

6. **Unified portfolio with frontend aggregation**
   The banking ledger and the secondary trading ledger remain isolated on the backend, but the portfolio page now aggregates both on the client into one global net-worth view. This removes the earlier UX mismatch where the top-level portfolio summary could show zero while the trading account held real equity.

7. **Read-first polling optimization**
   Trading portfolio polling no longer issues a stale-order cancellation write on every request. The expiry path now performs a fast `SELECT 1 ... LIMIT 1` check and only mutates `trading_orders` when stale rows actually exist, which materially reduces SQLite write pressure under SWR polling.

## What Was Built
- API routes for asset listing, asset detail, order placement, order cancellation, portfolio, and order/trade history.
- Trading domain layer for catalog lookup, fixed-point math, market-maker seeding, expiry, order-book aggregation, settlement, and portfolio projections.
- Refactored matcher that returns exact fills, avoids same-user matches, preserves sell-side average cost, and normalizes terminal fills to `Filled`.
- Marketplace listing page with search, category filtering, live best bid/ask/spread metadata, and loading/error/empty states.
- Asset detail page with charting, live order book, order ticket with review modal, polling, trading snapshot, and per-asset activity tables.
- Portfolio integration via a unified net-worth view with explicit Banking Wallet and Trading Wallet cards, live trading activity, safe order cancellation feedback, and preserved ledger segregation.
- Vitest coverage for the core trading math, locking, expiry, idempotency, self-trade prevention, and route behavior.

## Ledger Segregation & The Missing Bridge
During the integration of the Secondary Trading environment, I kept strict ledger isolation between Primary Banking and Secondary Trading.

Why? In production fintech ecosystems, moving cash from a banking entity to a broker-dealer entity requires compliance checks and typically operates on a T+1 settlement cycle. Rather than building a fake instant-transfer flow, the UI explicitly separates the Banking Wallet from the Trading Wallet and exposes a disabled `Transfer from Banking (T+1)` control to acknowledge the intended workflow.

For the scope of this assessment, trading accounts rely on the seeded signup cash for buying power, while the Banking deposit experience remains wired strictly to the primary cash ledger. The frontend aggregates both ledgers to present a mathematically correct global net-worth view without violating that boundary.

## What I Would Improve Next
- Replace polling with websockets or server-sent events for lower latency and less server churn.
- Store prices/cash in integer micro-units or decimal-backed schema columns instead of SQLite `REAL`.
- Add explicit `Expired` status support to the schema rather than mapping expiry into `Cancelled`.
- Introduce configurable self-trade prevention modes and richer audit/event logging.
- Add stronger persistence isolation for tests by using a dedicated in-memory or temp SQLite database per test process.
