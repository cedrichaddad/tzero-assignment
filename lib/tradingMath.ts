import Decimal from 'decimal.js'

export const PRICE_SCALE = 5
export const AMOUNT_SCALE = 5
export const ROUNDING_MODE = Decimal.ROUND_HALF_UP

Decimal.set({
  precision: 28,
  rounding: ROUNDING_MODE,
})

export const ZERO = new Decimal(0)
export const PRICE_TICK = new Decimal(1).div(new Decimal(10).pow(PRICE_SCALE))

export function toDecimal(value: Decimal.Value | null | undefined): Decimal {
  if (value === null || value === undefined || value === '') {
    return ZERO
  }

  return new Decimal(value)
}

export function normalizePrice(value: Decimal.Value): Decimal {
  return toDecimal(value).toDecimalPlaces(PRICE_SCALE, ROUNDING_MODE)
}

export function normalizeAmount(value: Decimal.Value): Decimal {
  return toDecimal(value).toDecimalPlaces(AMOUNT_SCALE, ROUNDING_MODE)
}

export function decimalToNumber(value: Decimal, scale: number = AMOUNT_SCALE): number {
  return value.toDecimalPlaces(scale, ROUNDING_MODE).toNumber()
}

export function multiplyPriceQuantity(price: Decimal.Value, quantity: number): Decimal {
  return normalizeAmount(normalizePrice(price).mul(quantity))
}

export function maxDecimal(left: Decimal, right: Decimal): Decimal {
  return Decimal.max(left, right)
}

export function minDecimal(left: Decimal, right: Decimal): Decimal {
  return Decimal.min(left, right)
}
