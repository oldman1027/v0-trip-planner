const DESTINATION_CURRENCY: Record<string, string> = {
  // North America
  "united states": "USD", usa: "USD",
  canada: "CAD",
  mexico: "MXN",
  // Europe
  france: "EUR", germany: "EUR", spain: "EUR", italy: "EUR",
  netherlands: "EUR", portugal: "EUR", greece: "EUR",
  austria: "EUR", belgium: "EUR", finland: "EUR",
  ireland: "EUR", luxembourg: "EUR", "czech republic": "CZK", czechia: "CZK",
  hungary: "HUF", croatia: "EUR",
  "united kingdom": "GBP", uk: "GBP", england: "GBP", scotland: "GBP", wales: "GBP",
  switzerland: "CHF",
  sweden: "SEK", norway: "NOK", denmark: "DKK",
  poland: "PLN", turkey: "TRY",
  // Asia
  japan: "JPY",
  china: "CNY",
  "south korea": "KRW", korea: "KRW",
  thailand: "THB",
  indonesia: "IDR",
  vietnam: "VND",
  philippines: "PHP",
  singapore: "SGD",
  malaysia: "MYR",
  india: "INR",
  "hong kong": "HKD",
  taiwan: "TWD",
  cambodia: "USD",
  myanmar: "MMK",
  laos: "LAK",
  // Oceania
  australia: "AUD",
  "new zealand": "NZD",
  // Middle East
  "united arab emirates": "AED", uae: "AED", dubai: "AED",
  israel: "ILS",
  jordan: "JOD",
  egypt: "EGP",
  morocco: "MAD",
  "saudi arabia": "SAR",
  // Latin America
  brazil: "BRL",
  argentina: "ARS",
  colombia: "COP",
  chile: "CLP",
  peru: "PEN",
  // Africa
  "south africa": "ZAR",
  kenya: "KES",
}

export function detectCurrencyFromDestination(destination: string | null | undefined): string {
  if (!destination) return "USD"
  const parts = destination.split(",").map((s) => s.trim().toLowerCase())
  for (let i = parts.length - 1; i >= 0; i--) {
    const currency = DESTINATION_CURRENCY[parts[i]]
    if (currency) return currency
  }
  return "USD"
}

export const COMMON_CURRENCIES = [
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "JPY", label: "JPY — Japanese Yen" },
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "CHF", label: "CHF — Swiss Franc" },
  { code: "CNY", label: "CNY — Chinese Yuan" },
  { code: "KRW", label: "KRW — South Korean Won" },
  { code: "SGD", label: "SGD — Singapore Dollar" },
  { code: "HKD", label: "HKD — Hong Kong Dollar" },
  { code: "THB", label: "THB — Thai Baht" },
  { code: "MXN", label: "MXN — Mexican Peso" },
  { code: "BRL", label: "BRL — Brazilian Real" },
  { code: "INR", label: "INR — Indian Rupee" },
  { code: "SEK", label: "SEK — Swedish Krona" },
  { code: "NOK", label: "NOK — Norwegian Krone" },
  { code: "DKK", label: "DKK — Danish Krone" },
  { code: "NZD", label: "NZD — New Zealand Dollar" },
  { code: "AED", label: "AED — UAE Dirham" },
  { code: "TRY", label: "TRY — Turkish Lira" },
  { code: "IDR", label: "IDR — Indonesian Rupiah" },
  { code: "MYR", label: "MYR — Malaysian Ringgit" },
  { code: "VND", label: "VND — Vietnamese Dong" },
  { code: "PHP", label: "PHP — Philippine Peso" },
  { code: "ZAR", label: "ZAR — South African Rand" },
]
