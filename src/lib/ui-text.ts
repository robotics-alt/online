'use client'
import { useApp } from './store'
import { DICT } from './i18n'

const keysByText = new Map<string, string[]>()
for (const [key, text] of Object.entries(DICT.en)) {
  if (typeof text !== 'string') continue
  keysByText.set(text, [...(keysByText.get(text) || []), key])
}

/** Unknown strings and non-text children pass through without changing user data. */
export function uiText<T>(value: T, variables?: Record<string, unknown>): T {
  if (typeof value !== 'string' || value.trim().length < 2) return value
  const { language, publicData } = useApp.getState()
  const keys = keysByText.get(value) || []
  const overrides = publicData?.settings.translations?.[language]
  let translated = keys.map(key => overrides?.[key]).find(text => typeof text === 'string' && text.length > 0)
  translated ||= keys.map(key => DICT[language]?.[key]).find(text => typeof text === 'string' && text.length > 0)
  translated ||= value
  if (variables) translated = translated.replace(/\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(variables, key) ? String(variables[key]) : match)
  return translated as T
}
