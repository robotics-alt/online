// Money helpers — ALL monetary values are integer cents to guarantee exact arithmetic.

export const CURRENCIES: Record<string, { symbol: string; name: string }> = {
  USD: { symbol: '$', name: 'US Dollar' },
  EUR: { symbol: '€', name: 'Euro' },
  GBP: { symbol: '£', name: 'British Pound' },
  GHS: { symbol: '₵', name: 'Ghanaian Cedi' },
  IQD: { symbol: 'ع.د', name: 'Iraqi Dinar' },
  TRY: { symbol: '₺', name: 'Turkish Lira' },
}

export function formatCents(cents: number, currency = 'USD'): string {
  const meta = CURRENCIES[currency] ?? CURRENCIES.USD
  const amount = cents / 100
  // Zero-decimal-style currencies (IQD) display without decimals
  const decimals = currency === 'IQD' ? 0 : 2
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return currency === 'IQD' ? `${formatted} ${meta.symbol}` : `${meta.symbol}${formatted}`
}

export function convertCents(cents: number, rate: number): number {
  return Math.round(cents * rate)
}

export function parseAmountToCents(input: string | number): number {
  const n = typeof input === 'number' ? input : parseFloat(String(input).replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}
