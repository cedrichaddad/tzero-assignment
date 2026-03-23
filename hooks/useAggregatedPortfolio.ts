'use client'

import { useState } from 'react'
import useSWR from 'swr'
import api from '@/lib/api'
import { decimalToNumber, toDecimal } from '@/lib/tradingMath'
import type {
  TradingHoldingView,
  TradingOrderView,
  TradingPortfolioResponse,
  TradingTradeView,
} from '@/lib/tradingTypes'

type BankingBalanceResponse = {
  balance: number
}

export type AggregatedPortfolioErrors = {
  banking: string | null
  trading: string | null
}

export type AggregatedPortfolioSnapshot = {
  globalNetWorth: number
  totalCash: number
  totalInvested: number
  wallets: {
    banking: number
    tradingCash: number
    lockedTrading: number
    availableTrading: number
  }
  holdings: TradingHoldingView[]
  openOrders: TradingOrderView[]
  recentTrades: TradingTradeView[]
  isError: boolean
  errors: AggregatedPortfolioErrors
  hasUsableData: boolean
}

export type AggregatedPortfolioViewModel = AggregatedPortfolioSnapshot & {
  isLoading: boolean
  isCancellingOrderId: string | null
  cancelOrder: (orderId: string) => Promise<void>
  mutateTrading: () => Promise<TradingPortfolioResponse | undefined>
}

type AggregatedPortfolioInput = {
  bankingBalance?: number | null
  tradingPortfolio?: TradingPortfolioResponse | null
  bankingError?: unknown
  tradingError?: unknown
}

function getErrorMessage(error: unknown, fallback: string): string | null {
  if (!error) {
    return null
  }

  if (typeof error === 'object' && error && 'response' in error) {
    const message = (error as { response?: { data?: { error?: string } } }).response?.data?.error
    if (message) {
      return message
    }
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

export function buildAggregatedPortfolioSnapshot({
  bankingBalance,
  tradingPortfolio,
  bankingError,
  tradingError,
}: AggregatedPortfolioInput): AggregatedPortfolioSnapshot {
  const hasBankingData = bankingBalance !== undefined && bankingBalance !== null
  const normalizedBanking = decimalToNumber(toDecimal(bankingBalance ?? 0))
  const tradingCash = decimalToNumber(toDecimal(tradingPortfolio?.balance.cashBalance ?? 0))
  const lockedTrading = decimalToNumber(toDecimal(tradingPortfolio?.balance.lockedCash ?? 0))
  const availableTrading = decimalToNumber(toDecimal(tradingPortfolio?.balance.availableCash ?? 0))
  const totalInvested = decimalToNumber(toDecimal(tradingPortfolio?.summary.holdingsValue ?? 0))
  const totalCash = decimalToNumber(toDecimal(normalizedBanking).plus(tradingCash))
  const globalNetWorth = decimalToNumber(toDecimal(totalCash).plus(totalInvested))

  const errors = {
    banking: getErrorMessage(bankingError, 'Failed to load the banking wallet.'),
    trading: getErrorMessage(tradingError, 'Failed to load the trading wallet.'),
  }

  return {
    globalNetWorth,
    totalCash,
    totalInvested,
    wallets: {
      banking: normalizedBanking,
      tradingCash,
      lockedTrading,
      availableTrading,
    },
    holdings: tradingPortfolio?.holdings ?? [],
    openOrders: tradingPortfolio?.openOrders ?? [],
    recentTrades: tradingPortfolio?.recentTrades ?? [],
    isError: Boolean(errors.banking || errors.trading),
    errors,
    hasUsableData: hasBankingData || Boolean(tradingPortfolio),
  }
}

const bankingFetcher = async (url: string) => {
  const response = await api.get<BankingBalanceResponse>(url)
  return response.data
}

const tradingFetcher = async (url: string) => {
  const response = await api.get<TradingPortfolioResponse>(url)
  return response.data
}

export function useAggregatedPortfolio(): AggregatedPortfolioViewModel {
  const [isCancellingOrderId, setIsCancellingOrderId] = useState<string | null>(null)

  const bankingQuery = useSWR<BankingBalanceResponse>('/banking/balance', bankingFetcher)
  const tradingQuery = useSWR<TradingPortfolioResponse>('/trading/portfolio', tradingFetcher, {
    refreshInterval: 4000,
    dedupingInterval: 2000,
    focusThrottleInterval: 3000,
    keepPreviousData: true,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
  })

  const snapshot = buildAggregatedPortfolioSnapshot({
    bankingBalance: bankingQuery.data?.balance,
    tradingPortfolio: tradingQuery.data,
    bankingError: bankingQuery.error,
    tradingError: tradingQuery.error,
  })

  const isLoading =
    (!bankingQuery.data && !bankingQuery.error) ||
    (!tradingQuery.data && !tradingQuery.error)

  return {
    ...snapshot,
    isLoading,
    isCancellingOrderId,
    async cancelOrder(orderId: string) {
      setIsCancellingOrderId(orderId)
      try {
        await api.delete(`/trading/orders/${orderId}`)
        await tradingQuery.mutate()
      } finally {
        setIsCancellingOrderId(null)
      }
    },
    async mutateTrading() {
      return tradingQuery.mutate()
    },
  }
}
