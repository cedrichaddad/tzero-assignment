export type TradingOrderSide = 'buy' | 'sell'
export type TradingOrderStatus = 'New' | 'Pending' | 'PartiallyFilled' | 'Filled' | 'Cancelled'
export type TradingTimeInForce = 'day' | 'gtd' | 'gtc'

export interface TradingAsset {
  id: string
  title: string
  symbol?: string
  category: string
  basePrice: number
  previousValue: number
  currentValue: number
  openPrice?: number | null
  performancePercent: number
  isPositive: boolean
  volume?: string
  lastPrice?: number | null
  bid?: number | null
  ask?: number | null
  high?: number | null
  low?: number | null
  companyDescription: string
  marketCap?: string
  avgVolume?: string
  priceRange?: string
  yearHigh?: number | null
  yearLow?: number | null
  peRatio?: number | null
  dividendYield?: number | null
  revenue?: string
  revenueGrowth?: number | null
  netIncome?: string
  employees?: number | null
  founded?: number | null
  dailyHistory: Array<{
    date: string
    open: number
    high: number
    low: number
    close: number
    volume: number
  }>
}

export interface OrderBookLevel {
  side: TradingOrderSide
  price: number
  size: number
}

export interface TradingBalanceSnapshot {
  cashBalance: number
  lockedCash: number
  availableCash: number
}

export interface TradingHoldingView {
  symbol: string
  assetId: string | null
  title: string
  category: string | null
  shares: number
  lockedShares: number
  availableShares: number
  avgCost: number
  markPrice: number
  marketValue: number
  unrealizedPnL: number
}

export interface TradingOrderView {
  id: string
  clientOrderId: string | null
  symbol: string
  assetId: string | null
  title: string
  side: TradingOrderSide
  quantity: number
  remainingQuantity: number
  price: number
  status: TradingOrderStatus
  timeInForce: TradingTimeInForce
  goodTilDate: string | null
  createdAt: string
  updatedAt: string
  isMarketMaker: boolean
}

export interface TradingTradeView {
  id: string
  symbol: string
  assetId: string | null
  title: string
  quantity: number
  price: number
  side: TradingOrderSide
  createdAt: string
}

export interface TradingPortfolioResponse {
  balance: TradingBalanceSnapshot
  holdings: TradingHoldingView[]
  openOrders: TradingOrderView[]
  recentTrades: TradingTradeView[]
  summary: {
    holdingsValue: number
    totalEquity: number
    openOrderCount: number
  }
}

export interface TradingAssetQuote {
  bestBid: number | null
  bestAsk: number | null
  lastTradePrice: number | null
  spread: number | null
}

export interface TradingAssetSummary extends TradingAsset, TradingAssetQuote {
  symbol: string
}

export interface TradingAssetDetailResponse {
  asset: TradingAssetSummary
  orderBook: {
    bids: OrderBookLevel[]
    asks: OrderBookLevel[]
  }
  recentTrades: TradingTradeView[]
  user: {
    balance: TradingBalanceSnapshot
    position: TradingHoldingView | null
    openOrders: TradingOrderView[]
    recentTrades: TradingTradeView[]
  } | null
}
