import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth'
import { getTradingOrders, placeTradingOrder, TradingError } from '@/lib/tradingService'
import { handleTradingApiError } from '@/lib/tradingApi'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request)
    if (!userId) {
      throw new TradingError('UNAUTHORIZED', 'Unauthorized. Please log in to continue.', 401)
    }

    const symbol = request.nextUrl.searchParams.get('symbol')
    const status = request.nextUrl.searchParams.get('status')
    return NextResponse.json(
      getTradingOrders(userId, {
        symbol,
        status,
      })
    )
  } catch (error) {
    return handleTradingApiError(error, 'Failed to fetch trading orders.')
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request)
    if (!userId) {
      throw new TradingError('UNAUTHORIZED', 'Unauthorized. Please log in to continue.', 401)
    }

    const body = await request.json()
    const quantity = Number(body?.quantity)
    const price = Number(body?.price)

    return NextResponse.json(
      placeTradingOrder(userId, {
        symbol: String(body?.symbol ?? '').toUpperCase(),
        side: body?.side,
        quantity,
        price,
        timeInForce: body?.timeInForce,
        goodTilDate: body?.goodTilDate ?? null,
        clientOrderId: body?.clientOrderId ?? null,
      })
    )
  } catch (error) {
    return handleTradingApiError(error, 'Failed to place trading order.')
  }
}
