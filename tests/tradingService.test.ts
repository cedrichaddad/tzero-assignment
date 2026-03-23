import db from '@/lib/db'
import { decimalToNumber, multiplyPriceQuantity, normalizeAmount, normalizePrice } from '@/lib/tradingMath'
import { cancelTradingOrder, getTradingOrders, getTradingPortfolio, placeTradingOrder } from '@/lib/tradingService'

function resetDatabase() {
  db.exec(`
    DELETE FROM trading_trades;
    DELETE FROM trading_orders;
    DELETE FROM trading_holdings;
    DELETE FROM trading_balances;
    DELETE FROM investments;
    DELETE FROM payments;
    DELETE FROM payment_methods;
    DELETE FROM onboarding_data;
    DELETE FROM pending_signups;
    DELETE FROM users;
  `)
}

function seedUser(userId: string, email: string, cashBalance: number = 1000) {
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO users (id, email, password, email_verified, onboarding_completed, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(userId, email, '!test!', 1, 1, now, now)

  db.prepare(
    `INSERT INTO trading_balances (id, user_id, cash_balance, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(`bal_${userId}`, userId, cashBalance, now, now)
}

function seedHolding(userId: string, symbol: string, shares: number, avgCost: number) {
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO trading_holdings (id, user_id, symbol, shares, avg_cost, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(`hold_${userId}_${symbol}`, userId, symbol, shares, avgCost, now, now)
}

describe('trading service', () => {
  beforeEach(() => {
    resetDatabase()
  })

  it('normalizes price and notional calculations with fixed-point precision', () => {
    expect(decimalToNumber(normalizePrice('1.234567'))).toBe(1.23457)
    expect(decimalToNumber(normalizeAmount('0.1').plus('0.2'))).toBe(0.3)
    expect(decimalToNumber(multiplyPriceQuantity('3.105449', 7))).toBe(21.73815)
  })

  it('rejects a buy order when available cash is insufficient after considering locks', () => {
    seedUser('buyer', 'buyer@example.com', 100)
    placeTradingOrder('buyer', {
      symbol: 'NVMT',
      side: 'buy',
      quantity: 10,
      price: 1,
      timeInForce: 'day',
      clientOrderId: 'lock-1',
    })

    expect(() =>
      placeTradingOrder('buyer', {
        symbol: 'NVMT',
        side: 'buy',
        quantity: 95,
        price: 1.1,
        timeInForce: 'day',
        clientOrderId: 'lock-2',
      })
    ).toThrow(/Insufficient available trading cash/i)
  })

  it('rejects a self-crossing order', () => {
    seedUser('self', 'self@example.com', 1000)
    seedHolding('self', 'NVMT', 20, 2.5)

    placeTradingOrder('self', {
      symbol: 'NVMT',
      side: 'sell',
      quantity: 5,
      price: 10,
      timeInForce: 'gtc',
      clientOrderId: 'self-sell',
    })

    expect(() =>
      placeTradingOrder('self', {
        symbol: 'NVMT',
        side: 'buy',
        quantity: 5,
        price: 10,
        timeInForce: 'gtc',
        clientOrderId: 'self-buy',
      })
    ).toThrow(/cross your own resting order/i)
  })

  it('is idempotent when the same client order id is retried', () => {
    seedUser('retry', 'retry@example.com', 1000)

    const first = placeTradingOrder('retry', {
      symbol: 'NVMT',
      side: 'buy',
      quantity: 5,
      price: 10,
      timeInForce: 'day',
      clientOrderId: 'same-client-order',
    })

    const second = placeTradingOrder('retry', {
      symbol: 'NVMT',
      side: 'buy',
      quantity: 5,
      price: 10,
      timeInForce: 'day',
      clientOrderId: 'same-client-order',
    })

    expect(first.order.id).toBe(second.order.id)
    expect(second.replayed).toBe(true)
  })

  it('preserves remaining avg cost on sells while reducing shares', () => {
    seedUser('seller', 'seller@example.com', 1000)
    seedHolding('seller', 'NVMT', 20, 2.5)

    placeTradingOrder('seller', {
      symbol: 'NVMT',
      side: 'sell',
      quantity: 5,
      price: 0.5,
      timeInForce: 'day',
      clientOrderId: 'sell-fill',
    })

    const row = db
      .prepare('SELECT shares, avg_cost FROM trading_holdings WHERE user_id = ? AND symbol = ?')
      .get('seller', 'NVMT') as { shares: number; avg_cost: number }

    expect(row.shares).toBe(15)
    expect(row.avg_cost).toBe(2.5)
  })

  it('expires stale day orders lazily and prevents them from matching', () => {
    seedUser('staleBuyer', 'stale-buyer@example.com', 1000)
    seedUser('seller', 'fresh-seller@example.com', 1000)
    seedHolding('seller', 'NVMT', 5, 2)

    const createdAt = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    db.prepare(
      `INSERT INTO trading_orders
       (id, client_order_id, user_id, symbol, side, quantity, remaining_quantity, price, status, time_in_force, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run('stale-order', 'stale-order', 'staleBuyer', 'NVMT', 'buy', 5, 5, 10, 'Pending', 'day', createdAt, createdAt)

    const result = placeTradingOrder('seller', {
      symbol: 'NVMT',
      side: 'sell',
      quantity: 5,
      price: 10,
      timeInForce: 'day',
      clientOrderId: 'fresh-sell',
    })

    const staleRow = db.prepare('SELECT status FROM trading_orders WHERE id = ?').get('stale-order') as { status: string }
    expect(staleRow.status).toBe('Cancelled')
    expect(result.order.status).toBe('Pending')
  })

  it('releases locked cash when an open order is cancelled', () => {
    seedUser('cancel-user', 'cancel-user@example.com', 1000)

    const placed = placeTradingOrder('cancel-user', {
      symbol: 'NVMT',
      side: 'buy',
      quantity: 10,
      price: 1,
      timeInForce: 'gtc',
      clientOrderId: 'cancel-me',
    })

    const beforeCancel = getTradingPortfolio('cancel-user')
    expect(beforeCancel.balance.lockedCash).toBeGreaterThan(0)

    cancelTradingOrder('cancel-user', placed.order.id)

    const afterCancel = getTradingPortfolio('cancel-user')
    expect(afterCancel.balance.lockedCash).toBe(0)
    expect(afterCancel.openOrders).toHaveLength(0)
  })

  it('returns open and history views from the order query surface', () => {
    seedUser('orders-user', 'orders-user@example.com', 1000)
    const openOrder = placeTradingOrder('orders-user', {
      symbol: 'NVMT',
      side: 'buy',
      quantity: 10,
      price: 1,
      timeInForce: 'gtc',
      clientOrderId: 'open-order',
    })

    cancelTradingOrder('orders-user', openOrder.order.id)

    const response = getTradingOrders('orders-user')
    expect(response.openOrders).toHaveLength(0)
    expect(response.historyOrders.length).toBeGreaterThan(0)
  })
})
