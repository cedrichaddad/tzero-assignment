import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth'
import { cancelTradingOrder, TradingError } from '@/lib/tradingService'
import { handleTradingApiError } from '@/lib/tradingApi'

export const dynamic = 'force-dynamic'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getAuthUserId(request)
    if (!userId) {
      throw new TradingError('UNAUTHORIZED', 'Unauthorized. Please log in to continue.', 401)
    }

    return NextResponse.json(cancelTradingOrder(userId, params.id))
  } catch (error) {
    return handleTradingApiError(error, 'Failed to cancel trading order.')
  }
}
