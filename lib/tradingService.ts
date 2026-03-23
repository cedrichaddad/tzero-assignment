import crypto from 'crypto'
import db from '@/lib/db'
import { findTradingAssetByIdentifier, findTradingAssetBySymbol, getTradingAssetsCatalog, buildSyntheticTemplateOrderBook } from '@/lib/tradingAssets'
import { decimalToNumber, multiplyPriceQuantity, normalizeAmount, normalizePrice, toDecimal } from '@/lib/tradingMath'
import type {
  OrderBookLevel,
  TradingAsset,
  TradingAssetDetailResponse,
  TradingAssetQuote,
  TradingAssetSummary,
  TradingBalanceSnapshot,
  TradingHoldingView,
  TradingOrderSide,
  TradingOrderStatus,
  TradingOrderView,
  TradingPortfolioResponse,
  TradingTimeInForce,
  TradingTradeView,
} from '@/lib/tradingTypes'
import { matchOrder } from '@/lib/matchingEngine'

export const SYSTEM_MARKET_MAKER_USER_ID = 'system_market_maker'
const SYSTEM_MARKET_MAKER_EMAIL = 'system-market-maker@internal.local'
const ACTIVE_ORDER_STATUSES = ['New', 'Pending', 'PartiallyFilled'] as const
const FULLY_FILLED_STATUSES = new Set(['Filled', 'Completed'])
const SYSTEM_CASH_BALANCE = 1000000000

type DatabaseClient = typeof db

type TradingOrderRow = {
  id: string
  client_order_id: string | null
  user_id: string
  symbol: string
  side: TradingOrderSide
  quantity: number
  remaining_quantity: number
  price: number
  status: string
  time_in_force: TradingTimeInForce
  good_til_date: string | null
  created_at: string
  updated_at: string
}

type TradingTradeRow = {
  id: string
  buy_order_id: string
  sell_order_id: string
  symbol: string
  quantity: number
  price: number
  created_at: string
}

type TradingHoldingRow = {
  symbol: string
  shares: number
  avg_cost: number
}

type TradingBalanceRow = {
  cash_balance: number
}

type TradingErrorCode =
  | 'BAD_REQUEST'
  | 'INSUFFICIENT_FUNDS'
  | 'INSUFFICIENT_SHARES'
  | 'SELF_TRADE_PREVENTION'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'ORDER_NOT_ACTIVE'
  | 'CONFLICT'

export class TradingError extends Error {
  code: TradingErrorCode
  status: number

  constructor(code: TradingErrorCode, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

function isActiveOrderStatus(status: string): boolean {
  return ACTIVE_ORDER_STATUSES.includes(status as (typeof ACTIVE_ORDER_STATUSES)[number])
}

function normalizeOrderStatus(status: string): TradingOrderStatus {
  if (FULLY_FILLED_STATUSES.has(status)) {
    return 'Filled'
  }

  if (status === 'Cancelled') {
    return 'Cancelled'
  }

  if (status === 'PartiallyFilled') {
    return 'PartiallyFilled'
  }

  if (status === 'Pending') {
    return 'Pending'
  }

  return 'New'
}

function getActiveOrderPredicate(): string {
  return `
    status IN ('New', 'Pending', 'PartiallyFilled')
    AND (
      time_in_force = 'gtc'
      OR (time_in_force = 'day' AND datetime(created_at) >= datetime(?, 'start of day'))
      OR (time_in_force = 'gtd' AND good_til_date IS NOT NULL AND datetime(good_til_date) >= datetime(?))
    )
  `
}

function ensureTradingBalanceRecord(userId: string, amount: number, database: DatabaseClient, nowIso: string) {
  const existing = database.prepare('SELECT 1 FROM trading_balances WHERE user_id = ?').get(userId)
  if (!existing) {
    database.prepare(
      `INSERT INTO trading_balances (id, user_id, cash_balance, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(`bal_${userId}`, userId, amount, nowIso, nowIso)
  }
}

function ensureSystemMarketMaker(database: DatabaseClient, nowIso: string) {
  const existingUser = database.prepare('SELECT 1 FROM users WHERE id = ?').get(SYSTEM_MARKET_MAKER_USER_ID)
  if (!existingUser) {
    database.prepare(
      `INSERT INTO users (id, email, password, first_name, last_name, email_verified, onboarding_completed, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      SYSTEM_MARKET_MAKER_USER_ID,
      SYSTEM_MARKET_MAKER_EMAIL,
      '!system-only!',
      'System',
      'Market Maker',
      1,
      1,
      nowIso,
      nowIso
    )
  }

  ensureTradingBalanceRecord(SYSTEM_MARKET_MAKER_USER_ID, SYSTEM_CASH_BALANCE, database, nowIso)
}

function ensureMarketMakerLiquidityForAsset(asset: TradingAsset, database: DatabaseClient, nowIso: string) {
  ensureSystemMarketMaker(database, nowIso)

  const existingOrders = database
    .prepare('SELECT COUNT(*) AS count FROM trading_orders WHERE user_id = ? AND symbol = ?')
    .get(SYSTEM_MARKET_MAKER_USER_ID, asset.symbol) as { count: number }

  if (existingOrders.count > 0) {
    return
  }

  const templateBook = buildSyntheticTemplateOrderBook(asset)
  const totalAskShares = templateBook.asks.reduce((sum, level) => sum + level.size, 0)
  const existingHolding = database
    .prepare('SELECT 1 FROM trading_holdings WHERE user_id = ? AND symbol = ?')
    .get(SYSTEM_MARKET_MAKER_USER_ID, asset.symbol)

  if (!existingHolding) {
    database.prepare(
      `INSERT INTO trading_holdings (id, user_id, symbol, shares, avg_cost, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      `hold_${SYSTEM_MARKET_MAKER_USER_ID}_${asset.symbol}`,
      SYSTEM_MARKET_MAKER_USER_ID,
      asset.symbol,
      totalAskShares,
      decimalToNumber(normalizeAmount(asset.basePrice)),
      nowIso,
      nowIso
    )
  }

  const insertOrder = database.prepare(
    `INSERT INTO trading_orders
     (id, client_order_id, user_id, symbol, side, quantity, remaining_quantity, price, status, time_in_force, good_til_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )

  const createSyntheticId = (side: TradingOrderSide, index: number, price: number) =>
    `mm_${asset.symbol}_${side}_${index}_${price.toFixed(5).replace('.', '_')}`

  templateBook.bids.forEach((level, index) => {
    insertOrder.run(
      createSyntheticId('buy', index, level.price),
      `mm-${asset.symbol}-buy-${index}`,
      SYSTEM_MARKET_MAKER_USER_ID,
      asset.symbol,
      'buy',
      level.size,
      level.size,
      level.price,
      'New',
      'gtc',
      null,
      nowIso,
      nowIso
    )
  })

  templateBook.asks.forEach((level, index) => {
    insertOrder.run(
      createSyntheticId('sell', index, level.price),
      `mm-${asset.symbol}-sell-${index}`,
      SYSTEM_MARKET_MAKER_USER_ID,
      asset.symbol,
      'sell',
      level.size,
      level.size,
      level.price,
      'New',
      'gtc',
      null,
      nowIso,
      nowIso
    )
  })
}

function expireStaleOrdersInternal(database: DatabaseClient, nowIso: string) {
  database.prepare(
    `UPDATE trading_orders
     SET status = 'Cancelled', updated_at = ?
     WHERE status IN ('New', 'Pending', 'PartiallyFilled')
       AND (
         (time_in_force = 'day' AND datetime(created_at) < datetime(?, 'start of day'))
         OR (time_in_force = 'gtd' AND good_til_date IS NOT NULL AND datetime(good_til_date) < datetime(?))
       )`
  ).run(nowIso, nowIso, nowIso)
}

function withTradingState<T>(work: (nowIso: string) => T): T {
  return db.transaction(() => {
    const nowIso = new Date().toISOString()
    expireStaleOrdersInternal(db, nowIso)
    return work(nowIso)
  })()
}

function prepareTradingState(symbol?: string) {
  withTradingState((nowIso) => {
    if (symbol) {
      const asset = findTradingAssetBySymbol(symbol)
      if (asset) {
        ensureMarketMakerLiquidityForAsset(asset, db, nowIso)
      }
      return
    }

    getTradingAssetsCatalog().forEach((asset) => {
      ensureMarketMakerLiquidityForAsset(asset, db, nowIso)
    })
  })
}

function getTradingQuoteForSymbol(symbol: string, database: DatabaseClient, nowIso: string): TradingAssetQuote {
  const predicate = getActiveOrderPredicate()
  const bestBidRow = database
    .prepare(
      `SELECT MAX(price) AS price
       FROM trading_orders
       WHERE symbol = ? AND side = 'buy' AND ${predicate}`
    )
    .get(symbol, nowIso, nowIso) as { price: number | null }

  const bestAskRow = database
    .prepare(
      `SELECT MIN(price) AS price
       FROM trading_orders
       WHERE symbol = ? AND side = 'sell' AND ${predicate}`
    )
    .get(symbol, nowIso, nowIso) as { price: number | null }

  const lastTradeRow = database
    .prepare(
      `SELECT price
       FROM trading_trades
       WHERE symbol = ?
       ORDER BY datetime(created_at) DESC, id DESC
       LIMIT 1`
    )
    .get(symbol) as { price: number } | undefined

  const bestBid = bestBidRow?.price ?? null
  const bestAsk = bestAskRow?.price ?? null
  const spread = bestBid !== null && bestAsk !== null ? decimalToNumber(normalizeAmount(toDecimal(bestAsk).minus(bestBid))) : null

  return {
    bestBid,
    bestAsk,
    lastTradePrice: lastTradeRow?.price ?? null,
    spread,
  }
}

function mapOrderRow(row: TradingOrderRow): TradingOrderView {
  const asset = findTradingAssetBySymbol(row.symbol)
  return {
    id: row.id,
    clientOrderId: row.client_order_id,
    symbol: row.symbol,
    assetId: asset?.id ?? null,
    title: asset?.title ?? row.symbol,
    side: row.side,
    quantity: Number(row.quantity),
    remainingQuantity: Number(row.remaining_quantity),
    price: Number(row.price),
    status: normalizeOrderStatus(row.status),
    timeInForce: row.time_in_force,
    goodTilDate: row.good_til_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isMarketMaker: row.user_id === SYSTEM_MARKET_MAKER_USER_ID,
  }
}

function getOpenOrderLevels(symbol: string, side: TradingOrderSide, database: DatabaseClient, nowIso: string): OrderBookLevel[] {
  const predicate = getActiveOrderPredicate()
  const rows = database
    .prepare(
      `SELECT price, SUM(remaining_quantity) AS size
       FROM trading_orders
       WHERE symbol = ? AND side = ? AND ${predicate}
       GROUP BY price
       ORDER BY price ${side === 'buy' ? 'DESC' : 'ASC'}`
    )
    .all(symbol, side, nowIso, nowIso) as Array<{ price: number; size: number }>

  return rows.map((row) => ({
    side,
    price: Number(row.price),
    size: Number(row.size),
  }))
}

function getRecentTradesForSymbol(symbol: string, userId?: string | null): TradingTradeView[] {
  const baseQuery =
    userId
      ? `SELECT t.*, o.user_id AS buyer_user_id, s.user_id AS seller_user_id
         FROM trading_trades t
         JOIN trading_orders o ON o.id = t.buy_order_id
         JOIN trading_orders s ON s.id = t.sell_order_id
         WHERE t.symbol = ? AND (o.user_id = ? OR s.user_id = ?)
         ORDER BY datetime(t.created_at) DESC, t.id DESC
         LIMIT 10`
      : `SELECT t.*
         FROM trading_trades t
         WHERE t.symbol = ?
         ORDER BY datetime(t.created_at) DESC, t.id DESC
         LIMIT 10`

  const rows = (
    userId ? db.prepare(baseQuery).all(symbol, userId, userId) : db.prepare(baseQuery).all(symbol)
  ) as Array<TradingTradeRow & { buyer_user_id?: string; seller_user_id?: string }>
  const asset = findTradingAssetBySymbol(symbol)

  return rows.map((row) => ({
    id: row.id,
    symbol,
    assetId: asset?.id ?? null,
    title: asset?.title ?? symbol,
    quantity: Number(row.quantity),
    price: Number(row.price),
    side: userId ? (row.buyer_user_id === userId ? 'buy' : 'sell') : 'buy',
    createdAt: row.created_at,
  }))
}

function listUserOrders(userId: string, options?: { symbol?: string | null }): TradingOrderView[] {
  const params: Array<string> = [userId]
  let query = `SELECT *
    FROM trading_orders
    WHERE user_id = ? AND user_id != '${SYSTEM_MARKET_MAKER_USER_ID}'`

  if (options?.symbol) {
    query += ' AND symbol = ?'
    params.push(options.symbol)
  }

  query += ` ORDER BY datetime(created_at) DESC, id DESC`
  const rows = db.prepare(query).all(...params) as TradingOrderRow[]
  return rows.map(mapOrderRow)
}

function listUserTrades(userId: string, options?: { symbol?: string | null }): TradingTradeView[] {
  const params: Array<string> = [userId, userId]
  let query = `
    SELECT trade.*, buy_order.user_id AS buyer_user_id, sell_order.user_id AS seller_user_id
    FROM trading_trades trade
    JOIN trading_orders buy_order ON buy_order.id = trade.buy_order_id
    JOIN trading_orders sell_order ON sell_order.id = trade.sell_order_id
    WHERE (buy_order.user_id = ? OR sell_order.user_id = ?)
  `

  if (options?.symbol) {
    query += ' AND trade.symbol = ?'
    params.push(options.symbol)
  }

  query += ' ORDER BY datetime(trade.created_at) DESC, trade.id DESC LIMIT 25'

  const rows = db.prepare(query).all(...params) as Array<TradingTradeRow & { buyer_user_id: string; seller_user_id: string }>
  return rows.map((row) => {
    const asset = findTradingAssetBySymbol(row.symbol)
    return {
      id: row.id,
      symbol: row.symbol,
      assetId: asset?.id ?? null,
      title: asset?.title ?? row.symbol,
      quantity: Number(row.quantity),
      price: Number(row.price),
      side: row.buyer_user_id === userId ? 'buy' : 'sell',
      createdAt: row.created_at,
    }
  })
}

function getLockedCash(userId: string, database: DatabaseClient, nowIso: string): number {
  const predicate = getActiveOrderPredicate()
  const rows = database
    .prepare(
      `SELECT price, remaining_quantity
       FROM trading_orders
       WHERE user_id = ? AND side = 'buy' AND ${predicate}`
    )
    .all(userId, nowIso, nowIso) as Array<{ price: number; remaining_quantity: number }>

  const locked = rows.reduce((sum, row) => sum.plus(multiplyPriceQuantity(row.price, Number(row.remaining_quantity))), toDecimal(0))
  return decimalToNumber(locked)
}

function getLockedShares(userId: string, symbol: string, database: DatabaseClient, nowIso: string): number {
  const predicate = getActiveOrderPredicate()
  const row = database
    .prepare(
      `SELECT COALESCE(SUM(remaining_quantity), 0) AS shares
       FROM trading_orders
       WHERE user_id = ? AND symbol = ? AND side = 'sell' AND ${predicate}`
    )
    .get(userId, symbol, nowIso, nowIso) as { shares: number }

  return Number(row?.shares ?? 0)
}

function getTradingBalanceSnapshotInternal(userId: string, database: DatabaseClient, nowIso: string): TradingBalanceSnapshot {
  ensureTradingBalanceRecord(userId, 0, database, nowIso)
  const row = database.prepare('SELECT cash_balance FROM trading_balances WHERE user_id = ?').get(userId) as TradingBalanceRow
  const cashBalance = Number(row?.cash_balance ?? 0)
  const lockedCash = getLockedCash(userId, database, nowIso)

  return {
    cashBalance,
    lockedCash,
    availableCash: decimalToNumber(toDecimal(cashBalance).minus(lockedCash)),
  }
}

function getHoldingRow(userId: string, symbol: string, database: DatabaseClient): TradingHoldingRow | null {
  return (
    (database.prepare('SELECT symbol, shares, avg_cost FROM trading_holdings WHERE user_id = ? AND symbol = ?').get(userId, symbol) as
      | TradingHoldingRow
      | undefined) ?? null
  )
}

function getHoldingView(userId: string, symbol: string, database: DatabaseClient, nowIso: string): TradingHoldingView | null {
  const holding = getHoldingRow(userId, symbol, database)
  if (!holding) {
    return null
  }

  const asset = findTradingAssetBySymbol(symbol)
  const lockedShares = getLockedShares(userId, symbol, database, nowIso)
  const quote = getTradingQuoteForSymbol(symbol, database, nowIso)
  const markPrice = quote.lastTradePrice ?? asset?.currentValue ?? Number(holding.avg_cost)
  const marketValue = decimalToNumber(normalizeAmount(toDecimal(markPrice).mul(holding.shares)))
  const unrealizedPnL = decimalToNumber(
    normalizeAmount(toDecimal(markPrice).minus(holding.avg_cost).mul(holding.shares))
  )

  return {
    symbol,
    assetId: asset?.id ?? null,
    title: asset?.title ?? symbol,
    category: asset?.category ?? null,
    shares: Number(holding.shares),
    lockedShares,
    availableShares: Number(holding.shares) - lockedShares,
    avgCost: Number(holding.avg_cost),
    markPrice,
    marketValue,
    unrealizedPnL,
  }
}

function getTradingHoldings(userId: string, database: DatabaseClient, nowIso: string): TradingHoldingView[] {
  const rows = database
    .prepare(
      `SELECT symbol, shares, avg_cost
       FROM trading_holdings
       WHERE user_id = ? AND shares > 0`
    )
    .all(userId) as TradingHoldingRow[]

  return rows
    .map((row) => getHoldingView(userId, row.symbol, database, nowIso))
    .filter((holding): holding is TradingHoldingView => Boolean(holding))
    .sort((left, right) => right.marketValue - left.marketValue)
}

function adjustTradingBalance(userId: string, delta: number, database: DatabaseClient, nowIso: string) {
  ensureTradingBalanceRecord(userId, 0, database, nowIso)
  const current = database.prepare('SELECT cash_balance FROM trading_balances WHERE user_id = ?').get(userId) as TradingBalanceRow
  const nextBalance = decimalToNumber(normalizeAmount(toDecimal(current.cash_balance).plus(delta)))
  database
    .prepare(
      `UPDATE trading_balances
       SET cash_balance = ?, updated_at = ?
       WHERE user_id = ?`
    )
    .run(nextBalance, nowIso, userId)
}

function wouldSelfMatch(userId: string, symbol: string, side: TradingOrderSide, price: number, database: DatabaseClient, nowIso: string): boolean {
  const predicate = getActiveOrderPredicate()
  const row =
    side === 'buy'
      ? (database
          .prepare(
            `SELECT 1
             FROM trading_orders
             WHERE user_id = ? AND symbol = ? AND side = 'sell' AND price <= ? AND ${predicate}
             LIMIT 1`
          )
          .get(userId, symbol, price, nowIso, nowIso) as { 1: number } | undefined)
      : (database
          .prepare(
            `SELECT 1
             FROM trading_orders
             WHERE user_id = ? AND symbol = ? AND side = 'buy' AND price >= ? AND ${predicate}
             LIMIT 1`
          )
          .get(userId, symbol, price, nowIso, nowIso) as { 1: number } | undefined)

  return Boolean(row)
}

function validateOrderInput(input: {
  symbol: string
  side: TradingOrderSide
  quantity: number
  price: number
  timeInForce: TradingTimeInForce
  goodTilDate?: string | null
}) {
  if (!findTradingAssetBySymbol(input.symbol)) {
    throw new TradingError('BAD_REQUEST', 'Unknown trading symbol.', 400)
  }

  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new TradingError('BAD_REQUEST', 'Quantity must be a positive whole number.', 400)
  }

  if (!normalizePrice(input.price).gt(0)) {
    throw new TradingError('BAD_REQUEST', 'Price must be greater than zero.', 400)
  }

  if (!['buy', 'sell'].includes(input.side)) {
    throw new TradingError('BAD_REQUEST', 'Invalid order side.', 400)
  }

  if (!['day', 'gtd', 'gtc'].includes(input.timeInForce)) {
    throw new TradingError('BAD_REQUEST', 'Invalid time in force.', 400)
  }

  if (input.timeInForce === 'gtd') {
    if (!input.goodTilDate) {
      throw new TradingError('BAD_REQUEST', 'Good-til-date is required for GTD orders.', 400)
    }

    const parsedDate = new Date(input.goodTilDate)
    if (Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString() <= new Date().toISOString()) {
      throw new TradingError('BAD_REQUEST', 'Good-til-date must be in the future.', 400)
    }
  }
}

export function getTradingAssetSummaries(filters?: { category?: string | null; search?: string | null }): {
  assets: TradingAssetSummary[]
  total: number
} {
  prepareTradingState()

  return withTradingState((nowIso) => {
    const assets: TradingAssetSummary[] = getTradingAssetsCatalog()
      .filter((asset) => !filters?.category || asset.category === filters.category)
      .filter((asset) => {
        if (!filters?.search) {
          return true
        }

        const search = filters.search.toLowerCase()
        return (
          asset.title.toLowerCase().includes(search) ||
          asset.symbol?.toLowerCase().includes(search) ||
          asset.companyDescription.toLowerCase().includes(search)
        )
      })
      .map((asset) => ({
        ...asset,
        symbol: asset.symbol ?? asset.id.toUpperCase(),
        ...getTradingQuoteForSymbol(asset.symbol!, db, nowIso),
      }))

    return {
      assets,
      total: assets.length,
    }
  })
}

export function getTradingAssetDetail(identifier: string, userId?: string | null): TradingAssetDetailResponse {
  const asset = findTradingAssetByIdentifier(identifier)
  if (!asset?.symbol) {
    throw new TradingError('NOT_FOUND', 'Trading asset not found.', 404)
  }

  prepareTradingState(asset.symbol)

  return withTradingState((nowIso) => {
    const quote = getTradingQuoteForSymbol(asset.symbol!, db, nowIso)
    const openOrders = userId ? listUserOrders(userId, { symbol: asset.symbol }) : []
    const recentUserTrades = userId ? listUserTrades(userId, { symbol: asset.symbol }) : []
    const userPosition = userId ? getHoldingView(userId, asset.symbol!, db, nowIso) : null

    return {
      asset: {
        ...asset,
        symbol: asset.symbol!,
        ...quote,
      },
      orderBook: {
        bids: getOpenOrderLevels(asset.symbol!, 'buy', db, nowIso),
        asks: getOpenOrderLevels(asset.symbol!, 'sell', db, nowIso),
      },
      recentTrades: getRecentTradesForSymbol(asset.symbol!),
      user: userId
        ? {
            balance: getTradingBalanceSnapshotInternal(userId, db, nowIso),
            position: userPosition,
            openOrders: openOrders.filter((order) => isActiveOrderStatus(order.status)),
            recentTrades: recentUserTrades,
          }
        : null,
    }
  })
}

export function getTradingPortfolio(userId: string): TradingPortfolioResponse {
  prepareTradingState()

  return withTradingState((nowIso) => {
    const balance = getTradingBalanceSnapshotInternal(userId, db, nowIso)
    const holdings = getTradingHoldings(userId, db, nowIso)
    const openOrders = listUserOrders(userId).filter((order) => isActiveOrderStatus(order.status))
    const recentTrades = listUserTrades(userId)
    const holdingsValue = decimalToNumber(holdings.reduce((sum, holding) => sum.plus(holding.marketValue), toDecimal(0)))

    return {
      balance,
      holdings,
      openOrders,
      recentTrades,
      summary: {
        holdingsValue,
        totalEquity: decimalToNumber(toDecimal(balance.cashBalance).plus(holdingsValue)),
        openOrderCount: openOrders.length,
      },
    }
  })
}

export function getTradingOrders(userId: string, filters?: { symbol?: string | null; status?: string | null }) {
  prepareTradingState(filters?.symbol ?? undefined)

  return withTradingState(() => {
    const orders = listUserOrders(userId, { symbol: filters?.symbol })
    const normalizedStatus = filters?.status?.toLowerCase() ?? null
    const filteredOrders = normalizedStatus
      ? orders.filter((order) => {
          if (normalizedStatus === 'open') {
            return isActiveOrderStatus(order.status)
          }

          if (normalizedStatus === 'history') {
            return !isActiveOrderStatus(order.status)
          }

          return order.status.toLowerCase() === normalizedStatus
        })
      : orders

    return {
      openOrders: filteredOrders.filter((order) => isActiveOrderStatus(order.status)),
      historyOrders: filteredOrders.filter((order) => !isActiveOrderStatus(order.status)),
      trades: listUserTrades(userId, { symbol: filters?.symbol }),
    }
  })
}

export function placeTradingOrder(userId: string, input: {
  symbol: string
  side: TradingOrderSide
  quantity: number
  price: number
  timeInForce: TradingTimeInForce
  goodTilDate?: string | null
  clientOrderId?: string | null
}) {
  const asset = findTradingAssetBySymbol(input.symbol)
  if (!asset?.symbol) {
    throw new TradingError('BAD_REQUEST', 'Unknown trading symbol.', 400)
  }

  const normalizedPrice = decimalToNumber(normalizePrice(input.price))
  validateOrderInput({
    ...input,
    symbol: asset.symbol,
    price: normalizedPrice,
  })

  return db.transaction(() => {
    const nowIso = new Date().toISOString()
    expireStaleOrdersInternal(db, nowIso)
    ensureTradingBalanceRecord(userId, 0, db, nowIso)
    ensureMarketMakerLiquidityForAsset(asset, db, nowIso)

    if (input.clientOrderId) {
      const existing = db
        .prepare('SELECT * FROM trading_orders WHERE user_id = ? AND client_order_id = ?')
        .get(userId, input.clientOrderId) as TradingOrderRow | undefined

      if (existing) {
        return {
          replayed: true,
          order: mapOrderRow(existing),
          balance: getTradingBalanceSnapshotInternal(userId, db, nowIso),
        }
      }
    }

    if (wouldSelfMatch(userId, asset.symbol!, input.side, normalizedPrice, db, nowIso)) {
      throw new TradingError(
        'SELF_TRADE_PREVENTION',
        'This order would cross your own resting order. Real venues support configurable STP modes; this assessment rejects the incoming order.',
        409
      )
    }

    if (input.side === 'buy') {
      const balance = getTradingBalanceSnapshotInternal(userId, db, nowIso)
      const requiredCash = decimalToNumber(multiplyPriceQuantity(normalizedPrice, input.quantity))
      if (balance.availableCash < requiredCash) {
        throw new TradingError('INSUFFICIENT_FUNDS', 'Insufficient available trading cash for this order.', 409)
      }
    } else {
      const holding = getHoldingView(userId, asset.symbol!, db, nowIso)
      const availableShares = holding?.availableShares ?? 0
      if (availableShares < input.quantity) {
        throw new TradingError('INSUFFICIENT_SHARES', 'Insufficient available shares for this order.', 409)
      }
    }

    const result = matchOrder(
      crypto.randomUUID(),
      userId,
      asset.symbol!,
      input.side,
      input.quantity,
      normalizedPrice,
      input.timeInForce,
      input.goodTilDate ?? null,
      db,
      nowIso,
      input.clientOrderId ?? null
    )

    result.fills.forEach((fill) => {
      const tradeValue = decimalToNumber(multiplyPriceQuantity(fill.price, fill.quantity))
      adjustTradingBalance(fill.buyerId, -tradeValue, db, nowIso)
      adjustTradingBalance(fill.sellerId, tradeValue, db, nowIso)
    })

    const orderRow = db.prepare('SELECT * FROM trading_orders WHERE id = ?').get(result.orderId) as TradingOrderRow

    return {
      replayed: false,
      order: mapOrderRow(orderRow),
      fills: result.fills,
      balance: getTradingBalanceSnapshotInternal(userId, db, nowIso),
    }
  })()
}

export function cancelTradingOrder(userId: string, orderId: string) {
  return db.transaction(() => {
    const nowIso = new Date().toISOString()
    expireStaleOrdersInternal(db, nowIso)

    const order = db
      .prepare('SELECT * FROM trading_orders WHERE id = ? AND user_id = ?')
      .get(orderId, userId) as TradingOrderRow | undefined

    if (!order || order.user_id === SYSTEM_MARKET_MAKER_USER_ID) {
      throw new TradingError('NOT_FOUND', 'Trading order not found.', 404)
    }

    if (!isActiveOrderStatus(normalizeOrderStatus(order.status))) {
      throw new TradingError('ORDER_NOT_ACTIVE', 'Only active orders can be cancelled.', 409)
    }

    db.prepare(
      `UPDATE trading_orders
       SET status = 'Cancelled', updated_at = ?
       WHERE id = ?`
    ).run(nowIso, orderId)

    const updatedOrder = db.prepare('SELECT * FROM trading_orders WHERE id = ?').get(orderId) as TradingOrderRow
    return {
      order: mapOrderRow(updatedOrder),
      balance: getTradingBalanceSnapshotInternal(userId, db, nowIso),
    }
  })()
}
