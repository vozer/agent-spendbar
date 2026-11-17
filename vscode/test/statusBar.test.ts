import { describe, expect, it } from 'vitest'

import type { MenubarPayload, QuotaProvider } from '../../app/renderer/lib/types'
import { buildSummary, figureOf, quotaLines, statusText, summaryText, tooltipMarkdown } from '../../app/renderer/vscode/summary'

function payload(calls: number, opts: { currency?: MenubarPayload['currency']; models?: Array<{ name: string; cost: number; estimatedCostUSD?: number }> } = {}): MenubarPayload {
  return {
    currency: opts.currency,
    current: {
      cost: 99, calls, sessions: 2, inputTokens: 1200, outputTokens: 300,
      topModels: (opts.models ?? []).map(model => ({ ...model, savingsUSD: 0, savingsBaselineModel: '', calls: 1 })),
      topProjects: [{ name: 'codeburn', cost: 99, savingsUSD: 0, sessions: 1, sessionDetails: [] }],
    },
  } as unknown as MenubarPayload
}

const quota: QuotaProvider[] = [
  { provider: 'claude', connection: 'connected', planLabel: 'Max', footerLines: [], primary: { label: 'Session', percent: 0.42, resetsAt: null }, details: [{ label: 'Weekly', percent: 0.61, resetsAt: null }] },
  { provider: 'codex', connection: 'disconnected', planLabel: null, footerLines: [], primary: null, details: [] },
]

describe('figureOf', () => {
  it('returns usage counts without currency amounts', () => {
    expect(figureOf(payload(10))).toEqual({ sessions: 2, calls: 10, inputTokens: 1200, outputTokens: 300 })
    expect(figureOf(payload(0))).toEqual({ sessions: 2, calls: 0, inputTokens: 1200, outputTokens: 300 })
  })
})

describe('statusText', () => {
  const summary = buildSummary({
    today: payload(12),
    week: payload(80),
    month: payload(300),
    workspace: { label: 'codeburn', today: payload(3), week: payload(20) },
    quota,
    optimize: { findingCount: 3, savingsUSD: 12 },
    now: Date.UTC(2026, 9, 6, 12),
  })

  it('shows today’s call count', () => {
    expect(statusText(summary, 'cost')).toBe('$(flame) 12 calls')
  })

  it('adds the most-used quota window', () => {
    expect(statusText(summary, 'costAndQuota')).toBe('$(flame) 61% · 12 calls')
  })

  it('shows this workspace’s call count', () => {
    expect(statusText(summary, 'workspace')).toBe('$(flame) 3 calls')
  })

  it('shows only the mark before the first read', () => {
    expect(statusText(null, 'cost')).toBe('$(flame)')
  })

  it('does not show currency amounts', () => {
    const euro = buildSummary({ today: payload(10, { currency: { code: 'EUR', symbol: '€', rate: 0.5 } }), week: null, month: null, workspace: null, quota: null, optimize: null })
    expect(statusText(euro, 'cost')).toBe('$(flame) 10 calls')
  })

  it('writes a tooltip with every window, the workspace, quota and the open link', () => {
    const md = tooltipMarkdown(summary)
    expect(md).toContain('| Today | 2 sessions · 12 calls · 1.5K tokens |')
    expect(md).toContain('| Last 7 days | 2 sessions · 80 calls · 1.5K tokens |')
    expect(md).toContain('| This month | 2 sessions · 300 calls · 1.5K tokens |')
    expect(md).toContain('| codeburn today | 2 sessions · 3 calls · 1.5K tokens |')
    expect(md).toContain('Claude Max · Weekly · 61% used')
    expect(md).not.toContain('Codex')
    expect(md).not.toContain('$')
    expect(md).toContain('(command:codeburn.openDashboard)')
  })

  it('keeps workspace and model names literal in the tooltip', () => {
    const hostile = buildSummary({
      today: payload(1, { models: [{ name: '[x](command:evil) *m*', cost: 1 }] }), week: null, month: null,
      workspace: { label: 'repo|[a](https://e.x)`$(zap)`', today: payload(1), week: null }, quota: null, optimize: null,
    })
    const md = tooltipMarkdown(hostile)
    expect(md).toContain('repo\\|\\[a\\]\\(https://e.x\\)\\`\\$\\(zap\\)\\` today')
    expect(md).toContain('\\[x\\]\\(command:evil\\) \\*m\\*')
    expect(md.match(/\]\(command:/g)).toHaveLength(1)
  })

  it('copies a plain summary', () => {
    const text = summaryText(summary)
    expect(text).toContain('Today: 2 sessions · 12 calls · 1.5K tokens')
    expect(text).toContain('codeburn today: 2 sessions · 3 calls · 1.5K tokens')
    expect(text).not.toContain('$')
  })
})

describe('quotaLines', () => {
  it('keeps connected providers and their fullest window', () => {
    expect(quotaLines(quota)).toEqual([{ provider: 'claude', plan: 'Max', label: 'Weekly', percent: 0.61, resetsAt: null }])
  })
})
