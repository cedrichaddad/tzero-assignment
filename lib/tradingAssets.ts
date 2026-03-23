import secondaryTradingAssets from '@/data/secondaryTradingAssets.json'
import { getSecondaryTradingSymbol, slugify } from '@/lib/investmentUtils'
import { PRICE_TICK, decimalToNumber, maxDecimal, minDecimal, normalizePrice, toDecimal } from '@/lib/tradingMath'
import type { OrderBookLevel, TradingAsset } from '@/lib/tradingTypes'

type AssetDataset = {
  investments: TradingAsset[]
  templates: {
    orderBook: {
      bids: Array<{ priceMultiplier: number; size: number }>
      asks: Array<{ priceMultiplier: number; size: number }>
    }
  }
}

const tradingAssetData = secondaryTradingAssets as AssetDataset

export function getTradingAssetsCatalog(): TradingAsset[] {
  return tradingAssetData.investments.map((asset) => ({
    ...asset,
    symbol: getSecondaryTradingSymbol(asset.title, asset.symbol),
  }))
}

export function findTradingAssetByIdentifier(identifier: string): TradingAsset | null {
  const normalized = decodeURIComponent(identifier)
  return (
    getTradingAssetsCatalog().find(
      (asset) => asset.id === normalized || slugify(asset.title) === normalized || asset.symbol === normalized.toUpperCase()
    ) ?? null
  )
}

export function findTradingAssetBySymbol(symbol: string): TradingAsset | null {
  const normalizedSymbol = symbol.toUpperCase()
  return getTradingAssetsCatalog().find((asset) => asset.symbol === normalizedSymbol) ?? null
}

export function buildSyntheticTemplateOrderBook(asset: TradingAsset): {
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
} {
  const basePrice = normalizePrice(asset.basePrice)
  const rawBids = tradingAssetData.templates.orderBook.bids
    .map((entry) => ({
      rawPrice: normalizePrice(toDecimal(asset.basePrice).mul(entry.priceMultiplier)),
      size: entry.size,
    }))
    .sort((left, right) => right.rawPrice.comparedTo(left.rawPrice))

  let previousBid = basePrice
  const bids = rawBids.map(({ rawPrice, size }) => {
    let price = minDecimal(rawPrice, basePrice.minus(PRICE_TICK))
    if (price.lte(0)) {
      price = PRICE_TICK
    }
    if (previousBid && price.gte(previousBid)) {
      price = previousBid.minus(PRICE_TICK)
    }
    if (price.lte(0)) {
      price = PRICE_TICK
    }
    previousBid = price

    return {
      side: 'buy' as const,
      price: decimalToNumber(price, 5),
      size,
    }
  })

  const bestBid = bids[0]?.price
  const minimumAsk = bestBid !== undefined ? normalizePrice(bestBid).plus(PRICE_TICK) : basePrice
  const rawAsks = tradingAssetData.templates.orderBook.asks
    .map((entry) => ({
      rawPrice: normalizePrice(toDecimal(asset.basePrice).mul(entry.priceMultiplier)),
      size: entry.size,
    }))
    .sort((left, right) => left.rawPrice.comparedTo(right.rawPrice))

  let previousAsk = maxDecimal(basePrice, minimumAsk).minus(PRICE_TICK)
  const asks = rawAsks.map(({ rawPrice, size }) => {
    let price = maxDecimal(rawPrice, basePrice)
    if (price.lte(previousAsk)) {
      price = previousAsk.plus(PRICE_TICK)
    }
    previousAsk = price

    return {
      side: 'sell' as const,
      price: decimalToNumber(price, 5),
      size,
    }
  })

  return { bids, asks }
}
