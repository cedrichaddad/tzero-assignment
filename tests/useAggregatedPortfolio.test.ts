import { buildAggregatedPortfolioSnapshot } from '@/hooks/useAggregatedPortfolio'
import type { TradingPortfolioResponse } from '@/lib/tradingTypes'

describe('useAggregatedPortfolio snapshot builder', () => {
  it('combines banking and trading balances with decimal-safe totals', () => {
    const tradingPortfolio: TradingPortfolioResponse = {
      balance: {
        cashBalance: 500.2,
        lockedCash: 125.05,
        availableCash: 375.15,
      },
      holdings: [],
      openOrders: [],
      recentTrades: [],
      summary: {
        holdingsValue: 1500,
        totalEquity: 2000.2,
        openOrderCount: 0,
      },
    }

    const snapshot = buildAggregatedPortfolioSnapshot({
      bankingBalance: 1000.1,
      tradingPortfolio,
    })

    expect(snapshot.globalNetWorth).toBe(3000.3)
    expect(snapshot.totalCash).toBe(1500.3)
    expect(snapshot.secondaryEquity).toBe(2000.2)
    expect(snapshot.wallets.lockedTrading).toBe(125.05)
    expect(snapshot.wallets.availableTrading).toBe(375.15)
    expect(snapshot.isError).toBe(false)
    expect(snapshot.hasUsableData).toBe(true)
  })

  it('surfaces source errors and falls back to zero without NaN propagation', () => {
    const snapshot = buildAggregatedPortfolioSnapshot({
      bankingError: new Error('Banking offline'),
      tradingError: { response: { data: { error: 'Trading unavailable' } } },
    })

    expect(snapshot.globalNetWorth).toBe(0)
    expect(snapshot.totalCash).toBe(0)
    expect(snapshot.secondaryEquity).toBe(0)
    expect(snapshot.wallets.banking).toBe(0)
    expect(snapshot.wallets.tradingCash).toBe(0)
    expect(snapshot.isError).toBe(true)
    expect(snapshot.errors.banking).toBe('Banking offline')
    expect(snapshot.errors.trading).toBe('Trading unavailable')
    expect(snapshot.hasUsableData).toBe(false)
  })
})
