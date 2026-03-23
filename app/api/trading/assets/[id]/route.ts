import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth'
import { getTradingAssetDetail } from '@/lib/tradingService'
import { handleTradingApiError } from '@/lib/tradingApi'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getAuthUserId(request)
    return NextResponse.json(getTradingAssetDetail(params.id, userId))
  } catch (error) {
    return handleTradingApiError(error, 'Failed to fetch trading asset detail.')
  }
}
