import { NextRequest } from 'next/server'
import db from '@/lib/db'
import { GET as getAssets } from '@/app/api/trading/assets/route'
import { GET as getAssetDetail } from '@/app/api/trading/assets/[id]/route'
import { GET as getPortfolio } from '@/app/api/trading/portfolio/route'
import { POST as postOrder, GET as getOrders } from '@/app/api/trading/orders/route'

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

function authHeader(userId: string) {
  return {
    Authorization: `Bearer ${Buffer.from(`${userId}:token`).toString('base64')}`,
  }
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

describe('trading routes', () => {
  beforeEach(() => {
    resetDatabase()
  })

  it('filters asset listings by category and search term', async () => {
    const request = new NextRequest('http://localhost/api/trading/assets?category=tech&search=nova')
    const response = await getAssets(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.total).toBe(1)
    expect(payload.assets[0].symbol).toBe('NVMT')
  })

  it('enforces auth on trading portfolio route', async () => {
    const request = new NextRequest('http://localhost/api/trading/portfolio')
    const response = await getPortfolio(request)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error).toMatch(/Unauthorized/i)
  })

  it('returns detail shape without auth and includes auth-gated data with auth', async () => {
    seedUser('detail-user', 'detail-user@example.com', 1000)

    const publicResponse = await getAssetDetail(new NextRequest('http://localhost/api/trading/assets/nova-materials'), {
      params: { id: 'nova-materials' },
    })
    const publicPayload = await publicResponse.json()

    expect(publicResponse.status).toBe(200)
    expect(publicPayload.user).toBeNull()
    expect(publicPayload.orderBook.bids.length).toBeGreaterThan(0)

    const authedResponse = await getAssetDetail(
      new NextRequest('http://localhost/api/trading/assets/nova-materials', {
        headers: authHeader('detail-user'),
      }),
      { params: { id: 'nova-materials' } }
    )
    const authedPayload = await authedResponse.json()

    expect(authedResponse.status).toBe(200)
    expect(authedPayload.user.balance.availableCash).toBe(1000)
  })

  it('creates an order through the route and exposes it via the detail order book and orders route', async () => {
    seedUser('route-user', 'route-user@example.com', 1000)

    const postResponse = await postOrder(
      new NextRequest('http://localhost/api/trading/orders', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...authHeader('route-user'),
        },
        body: JSON.stringify({
          symbol: 'NVMT',
          side: 'buy',
          quantity: 12,
          price: 1,
          timeInForce: 'gtc',
          clientOrderId: 'route-order',
        }),
      })
    )
    const postPayload = await postResponse.json()

    expect(postResponse.status).toBe(200)
    expect(postPayload.order.remainingQuantity).toBe(12)

    const detailResponse = await getAssetDetail(new NextRequest('http://localhost/api/trading/assets/nova-materials'), {
      params: { id: 'nova-materials' },
    })
    const detailPayload = await detailResponse.json()
    expect(detailPayload.orderBook.bids.some((level: { size: number }) => level.size >= 12)).toBe(true)

    const ordersResponse = await getOrders(
      new NextRequest('http://localhost/api/trading/orders?status=open', {
        headers: authHeader('route-user'),
      })
    )
    const ordersPayload = await ordersResponse.json()
    expect(ordersResponse.status).toBe(200)
    expect(ordersPayload.openOrders).toHaveLength(1)
  })
})
