import { NextResponse } from 'next/server'
import { getTradingAssetSummaries } from '@/lib/tradingService'
import { handleTradingApiError } from '@/lib/tradingApi'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')

    return NextResponse.json(
      getTradingAssetSummaries({
        category: category || null,
        search: search || null,
      })
    )
  } catch (error) {
    return handleTradingApiError(error, 'Failed to fetch trading assets.')
  }
}
