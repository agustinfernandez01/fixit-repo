const CART_TOKEN_KEY = 'fixit_cart_token'

export const CART_CHANGED_EVENT = 'fixit-cart-changed'

export type CartChangedDetail = {
  totalUnidades?: number
  summary?: unknown
}

function createToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `cart_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export function getCartToken(): string {
  if (typeof localStorage === 'undefined') return createToken()
  const existing = localStorage.getItem(CART_TOKEN_KEY)
  if (existing) return existing
  const token = createToken()
  localStorage.setItem(CART_TOKEN_KEY, token)
  return token
}

export function setCartToken(token: string): void {
  localStorage.setItem(CART_TOKEN_KEY, token)
}

export function clearCartToken(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(CART_TOKEN_KEY)
}

export function regenerateCartToken(): string {
  const token = createToken()
  setCartToken(token)
  return token
}

export function emitCartChanged(detail?: CartChangedDetail): void {
  window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT, { detail }))
}