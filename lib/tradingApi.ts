import { NextResponse } from 'next/server'
import { TradingError } from '@/lib/tradingService'

export function handleTradingApiError(error: unknown, fallbackMessage: string) {
  if (error instanceof TradingError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
      },
      { status: error.status }
    )
  }

  console.error(fallbackMessage, error)
  return NextResponse.json(
    {
      error: fallbackMessage,
    },
    { status: 500 }
  )
}
