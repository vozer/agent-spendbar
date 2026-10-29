// Codex credit pricing. ChatGPT/Codex subscription users consume *credits*, a
// separate unit from API dollars: usage is billed as "credits per million
// tokens" at per-model rates that differ from the API USD pricing CodeBurn uses
// for cost. This module computes credit consumption from token counts so the
// app can show usage in credits (issues #408 and #495).
//
// Standard rates are credits per 1,000,000 tokens, from
// https://learn.chatgpt.com/docs/pricing (cached input is the cache-read rate).

import { pricingModelAt } from './models.js'

export type CodexCreditRate = {
  input: number
  cachedInput: number
  output: number
}

const CREDITS_PER_MILLION: Record<string, CodexCreditRate> = {
  // Historical rates remain for sessions recorded before each model retired.
  'gpt-5.5': { input: 125, cachedInput: 12.5, output: 750 },
  'gpt-5.4': { input: 62.5, cachedInput: 6.25, output: 375 },
  'gpt-5.4-mini': { input: 18.75, cachedInput: 1.875, output: 113 },
  'gpt-5.6-sol': { input: 100, cachedInput: 10, output: 500 },
  'gpt-5.6-terra': { input: 50, cachedInput: 5, output: 300 },
  'gpt-5.6-luna': { input: 5, cachedInput: 0.5, output: 30 },
  'gpt-6-astra': { input: 250, cachedInput: 25, output: 1250 },
  'gpt-6-sol': { input: 50, cachedInput: 5, output: 250 },
  'gpt-6-luna': { input: 2.5, cachedInput: 0.25, output: 12.5 },
  'gpt-6.1-sol': { input: 50, cachedInput: 2.5, output: 250 },
  'gpt-6.1-terra': { input: 25, cachedInput: 1.25, output: 125 },
}
const CREDIT_MODEL_IDS = Object.keys(CREDITS_PER_MILLION).sort((a, b) => b.length - a.length)

/// Resolve the credit rate for a Codex model name, tolerating suffix variants
/// (e.g. "gpt-5.5-codex"). Returns null when the model has no known credit rate.
/// `codex-auto-review` follows the date-specific model alias in `pricingModelAt`.
export function codexCreditRate(model: string, timestamp?: string): CodexCreditRate | null {
  const pricedModel = pricingModelAt(model, timestamp).toLowerCase()
  // The alias keeps its name after the default switch because its USD price
  // resolves through the model table; its current credit rate is GPT-5.6 Luna.
  const m = pricedModel === 'codex-auto-review' ? 'gpt-5.6-luna' : pricedModel
  for (const id of CREDIT_MODEL_IDS) {
    const start = m.lastIndexOf(id)
    if (start < 0) continue
    const before = m[start - 1]
    const suffix = m.slice(start + id.length)
    if ((before && !/[\s/-]/.test(before)) || (suffix && !suffix.startsWith('-'))) continue
    const suffixTokens = suffix.split('-').filter(Boolean)
    if (suffixTokens.includes('pro') || suffixTokens.includes('nano')) return null
    if (suffixTokens.includes('mini')) {
      return id === 'gpt-5.4' ? CREDITS_PER_MILLION['gpt-5.4-mini']! : null
    }
    return CREDITS_PER_MILLION[id]!
  }
  return null
}

export type CodexCreditTokens = {
  /// Non-cached input tokens (CodeBurn normalizes Codex to Anthropic semantics,
  /// so this excludes cache-read tokens).
  inputTokens: number
  /// Cache-read (cached input) tokens, billed at the cheaper cached rate.
  cachedReadTokens: number
  /// Billable output tokens: reasoning is already included (billableOutputTokens
  /// in models.ts), so callers must not add it on top here.
  outputTokens: number
}

/// Credits consumed for one Codex usage record. Returns null when the model has
/// no known credit rate (caller decides how to surface "unknown").
export function codexCredits(model: string, tokens: CodexCreditTokens, timestamp?: string): number | null {
  const rate = codexCreditRate(model, timestamp)
  if (!rate) return null
  const safe = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0)
  const PER_MILLION = 1_000_000
  return (
    (safe(tokens.inputTokens) / PER_MILLION) * rate.input +
    (safe(tokens.cachedReadTokens) / PER_MILLION) * rate.cachedInput +
    (safe(tokens.outputTokens) / PER_MILLION) * rate.output
  )
}
