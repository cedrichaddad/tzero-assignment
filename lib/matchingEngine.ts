import crypto from 'crypto'
import db from '@/lib/db'
import type { TradingOrderSide, TradingTimeInForce } from '@/lib/tradingTypes'

/**
 * Order Matching Engine
 *
 * Matches a new order against existing opposing orders in the book.
 * - Buy orders match against sell orders with price <= buy price (lowest first)
 * - Sell orders match against buy orders with price >= sell price (highest first)
 *
 * When a match is found:
 * - A trade record is created in trading_trades
 * - Both orders' remaining_quantity and status are updated
 * - Holdings are updated for both buyer and seller via upsertHolding()
 *
 * Returns: { orderId, status, remaining }
 *
 * NOTE: This engine handles order matching and position updates.
 * You still need to build the API route that calls this, including:
 * - Input validation
 * - Authentication
 * - Balance/share checks before placing an order
 * - Any other business logic you see fit
 *
 * Usage:
 *   import crypto from 'crypto'
 *   import { matchOrder } from '@/lib/matchingEngine'
 *
 *   const result = matchOrder(crypto.randomUUID(), userId, 'NVMT', 'buy', 10, 3.09, 'day')
 *   // result = { orderId: '...', status: 'Pending' | 'Filled' | 'PartiallyFilled', remaining: 7, fills: [...] }
 */

type DatabaseClient = typeof db

export interface MatchOrderFill {
  tradeId: string
  buyOrderId: string
  sellOrderId: string
  buyerId: string
  sellerId: string
  quantity: number
  price: number
}

function getActiveOrderPredicate() {
  return `
    status IN ('New', 'Pending', 'PartiallyFilled')
    AND (
      time_in_force = 'gtc'
      OR (time_in_force = 'day' AND datetime(created_at) >= datetime(?, 'start of day'))
      OR (time_in_force = 'gtd' AND good_til_date IS NOT NULL AND datetime(good_til_date) >= datetime(?))
    )
  `
}

export function upsertHolding(
  userId: string,
  symbol: string,
  deltaShares: number,
  price: number,
  database: DatabaseClient = db,
  nowIso: string = new Date().toISOString()
) {
  const holding = database.prepare('SELECT shares, avg_cost FROM trading_holdings WHERE user_id = ? AND symbol = ?').get(userId, symbol) as
    | { shares: number; avg_cost: number }
    | undefined

  if (!holding) {
    if (deltaShares < 0) {
      throw new Error(`Cannot create a negative holding for ${userId}:${symbol}`)
    }

    database.prepare(
      `INSERT INTO trading_holdings (id, user_id, symbol, shares, avg_cost, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(crypto.randomUUID(), userId, symbol, deltaShares, price, nowIso, nowIso)
    return
  }

  const newShares = holding.shares + deltaShares
  if (newShares < 0) {
    throw new Error(`Holding for ${userId}:${symbol} would go negative`)
  }

  if (newShares === 0) {
    database.prepare('DELETE FROM trading_holdings WHERE user_id = ? AND symbol = ?').run(userId, symbol)
    return
  }

  const avgCost =
    deltaShares > 0
      ? (holding.avg_cost * holding.shares + deltaShares * price) / newShares
      : holding.avg_cost

  database.prepare(
    `UPDATE trading_holdings
     SET shares = ?, avg_cost = ?, updated_at = ?
     WHERE user_id = ? AND symbol = ?`
  ).run(newShares, avgCost, nowIso, userId, symbol)
}

export function matchOrder(
  orderId: string,
  userId: string,
  symbol: string,
  side: TradingOrderSide,
  quantity: number,
  price: number,
  timeInForce: TradingTimeInForce,
  goodTilDate: string | null = null,
  database: DatabaseClient = db,
  nowIso: string = new Date().toISOString(),
  clientOrderId: string | null = null
) {
  const insertOrder = database.prepare(
    `INSERT INTO trading_orders
     (id, client_order_id, user_id, symbol, side, quantity, remaining_quantity, price, status, time_in_force, good_til_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const updateOrder = database.prepare(
    `UPDATE trading_orders
     SET remaining_quantity = ?, status = ?, updated_at = ?
     WHERE id = ?`
  )
  const insertTrade = database.prepare(
    `INSERT INTO trading_trades (id, buy_order_id, sell_order_id, symbol, quantity, price, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
  const activePredicate = getActiveOrderPredicate()

  const matchQuery =
    side === 'buy'
      ? `SELECT * FROM trading_orders
         WHERE symbol = ? AND side = 'sell' AND user_id != ? AND price <= ? AND ${activePredicate}
         ORDER BY price ASC, created_at ASC`
      : `SELECT * FROM trading_orders
         WHERE symbol = ? AND side = 'buy' AND user_id != ? AND price >= ? AND ${activePredicate}
         ORDER BY price DESC, created_at ASC`

  const matchOrders = database.prepare(matchQuery)

  insertOrder.run(orderId, clientOrderId, userId, symbol, side, quantity, quantity, price, 'New', timeInForce, goodTilDate, nowIso, nowIso)

  let remaining = quantity
  const matches = matchOrders.all(symbol, userId, price, nowIso, nowIso) as Array<any>
  const fills: MatchOrderFill[] = []

  for (const match of matches) {
    if (remaining <= 0) break
    const matchRemaining = Number(match.remaining_quantity)
    if (matchRemaining <= 0) continue

    const fillQty = Math.min(remaining, matchRemaining)
    const tradePrice = Number(match.price)

    const buyOrderId = side === 'buy' ? orderId : match.id
    const sellOrderId = side === 'sell' ? orderId : match.id
    const tradeId = crypto.randomUUID()

    insertTrade.run(tradeId, buyOrderId, sellOrderId, symbol, fillQty, tradePrice, nowIso)

    const newMatchRemaining = matchRemaining - fillQty
    const matchStatus = newMatchRemaining === 0 ? 'Filled' : 'PartiallyFilled'
    updateOrder.run(newMatchRemaining, matchStatus, nowIso, match.id)

    const buyerId = side === 'buy' ? userId : match.user_id
    const sellerId = side === 'sell' ? userId : match.user_id

    upsertHolding(buyerId, symbol, fillQty, tradePrice, database, nowIso)
    upsertHolding(sellerId, symbol, -fillQty, tradePrice, database, nowIso)

    fills.push({
      tradeId,
      buyOrderId,
      sellOrderId,
      buyerId,
      sellerId,
      quantity: fillQty,
      price: tradePrice,
    })

    remaining -= fillQty
  }

  let status = 'Pending'
  if (remaining === 0) {
    status = 'Filled'
  } else if (remaining < quantity) {
    status = 'PartiallyFilled'
  }

  updateOrder.run(remaining, status, nowIso, orderId)

  return { orderId, status, remaining, fills }
}
