import { t } from '../i18n'
import { formatCompact, formatCount, formatResetTime, setActiveCurrency, type ActiveCurrency } from '../lib/format'
import { PROVIDER_NAMES } from '../lib/providers'
import type { MenubarPayload, ProviderName, QuotaProvider } from '../lib/types'

export type Figure = { sessions?: number; calls?: number; inputTokens?: number; outputTokens?: number }
export type Ranked = Figure & { name: string }
export type QuotaLine = { provider: string; plan: string | null; label: string; percent: number; resetsAt: string | null }

/** The status bar, tooltip, sidebar and copy command use the same usage snapshot. */
export type Summary = {
  at: number
  currency: ActiveCurrency
  today: Figure
  week: Figure | null
  month: Figure | null
  topModels: Ranked[]
  topProjects: Ranked[]
  workspace: { label: string; today: Figure; week: Figure | null } | null
  quota: QuotaLine[]
}

const USD: ActiveCurrency = { code: 'USD', symbol: '$', rate: 1 }

export function figureOf(payload: MenubarPayload): Figure {
  return {
    sessions: payload.current.sessions,
    calls: payload.current.calls,
    inputTokens: payload.current.inputTokens,
    outputTokens: payload.current.outputTokens,
  }
}

export function buildSummary(input: {
  today: MenubarPayload
  week: MenubarPayload | null
  month: MenubarPayload | null
  workspace: { label: string; today: MenubarPayload; week: MenubarPayload | null } | null
  quota: QuotaProvider[] | null
  optimize: { findingCount: number; savingsUSD: number } | null
  now?: number
}): Summary {
  const currency = input.today.currency ?? USD
  setActiveCurrency(currency)
  const ranked = input.week ?? input.today
  return {
    at: input.now ?? Date.now(),
    currency,
    today: figureOf(input.today),
    week: input.week ? figureOf(input.week) : null,
    month: input.month ? figureOf(input.month) : null,
    topModels: (ranked.current.topModels ?? []).slice(0, 5).map(row => ({
      name: row.name,
      calls: row.calls,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
    })),
    topProjects: (ranked.current.topProjects ?? []).slice(0, 5).map(row => ({
      name: row.name,
      sessions: row.sessions,
      calls: row.sessionDetails.reduce((sum, session) => sum + session.calls, 0),
      inputTokens: row.sessionDetails.reduce((sum, session) => sum + session.inputTokens, 0),
      outputTokens: row.sessionDetails.reduce((sum, session) => sum + session.outputTokens, 0),
    })),
    workspace: input.workspace
      ? { label: input.workspace.label, today: figureOf(input.workspace.today), week: input.workspace.week ? figureOf(input.workspace.week) : null }
      : null,
    quota: quotaLines(input.quota ?? []),
  }
}

/** One line per connected provider, using the window with the highest usage. */
export function quotaLines(quota: QuotaProvider[]): QuotaLine[] {
  const lines: QuotaLine[] = []
  for (const provider of quota) {
    if (provider.connection !== 'connected' && provider.connection !== 'stale') continue
    const windows = [provider.primary, ...provider.details].filter((window): window is NonNullable<typeof window> => window !== null)
    const top = windows.reduce<typeof windows[number] | null>((best, window) => best === null || window.percent > best.percent ? window : best, null)
    if (!top) continue
    lines.push({ provider: provider.provider, plan: provider.planLabel, label: top.label, percent: top.percent, resetsAt: top.resetsAt })
  }
  return lines
}

function count(value: number | undefined, unit: 'call' | 'session'): string {
  return typeof value === 'number' ? formatCount(value, unit) : '—'
}

export function usageText(figure: Figure): string {
  const parts = [
    count(figure.sessions, 'session'),
    count(figure.calls, 'call'),
    typeof figure.inputTokens === 'number' && typeof figure.outputTokens === 'number'
      ? `${formatCompact(figure.inputTokens + figure.outputTokens)} tokens`
      : null,
  ].filter((part): part is string => part !== null && part !== '—')
  return parts.length > 0 ? parts.join(' · ') : '—'
}

export function rankedText(row: Ranked): string {
  const calls = count(row.calls, 'call')
  const sessions = count(row.sessions, 'session')
  const parts = [calls !== '—' ? calls : null, sessions !== '—' ? sessions : null]
  return parts.filter((part): part is string => part !== null).join(' · ') || usageText(row)
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export type StatusBarFormat = 'cost' | 'costAndQuota' | 'workspace' | 'hidden'

export function statusText(summary: Summary | null, format: StatusBarFormat): string {
  if (!summary) return '$(flame)'
  setActiveCurrency(summary.currency)
  if (format === 'costAndQuota' && summary.quota.length > 0) {
    const top = Math.max(...summary.quota.map(line => line.percent))
    return `$(flame) ${percent(top)} · ${count(summary.today.calls, 'call')}`
  }
  if (format === 'workspace' && summary.workspace) return `$(flame) ${count(summary.workspace.today.calls, 'call')}`
  return `$(flame) ${count(summary.today.calls, 'call')}`
}

function providerName(line: QuotaLine): string {
  const name = PROVIDER_NAMES[line.provider as ProviderName] ?? line.provider
  return line.plan ? `${name} ${line.plan}` : name
}

export function quotaText(line: QuotaLine): string {
  const reset = formatResetTime(line.resetsAt)
  const used = reset
    ? t('plans.quota.usedWithReset', { percent: Math.round(line.percent * 100), reset })
    : t('plans.quota.used', { percent: Math.round(line.percent * 100) })
  return `${providerName(line)} · ${line.label} · ${used}`
}

/** Names reach the tooltip from repositories and logs: keep them literal text. */
function cell(text: string): string {
  return text.replace(/[\\`*_[\]()|<>!$#~]/g, '\\$&')
}

function usageRows(summary: Summary): Array<[string, string]> {
  const rows: Array<[string, string]> = [[t('common.period.today'), usageText(summary.today)]]
  if (summary.week) rows.push([t('common.period.week'), usageText(summary.week)])
  if (summary.month) rows.push([t('common.period.month'), usageText(summary.month)])
  if (summary.workspace) rows.push([t('ide.status.workspaceToday', { name: summary.workspace.label }), usageText(summary.workspace.today)])
  return rows
}

/** The status bar tooltip: plain markdown, one command link, no HTML. */
export function tooltipMarkdown(summary: Summary): string {
  setActiveCurrency(summary.currency)
  const out = ['**CodeBurn**', '', '| | |', '|:--|--:|', ...usageRows(summary).map(([label, value]) => `| ${cell(label)} | ${value} |`), '']
  const top = summary.topModels[0]
  if (top) out.push(`${t('ide.status.topModel')}: ${cell(top.name)} · ${rankedText(top)}`, '')
  if (summary.quota.length > 0) {
    out.push(`**${t('shell.nav.plans')}**`, '')
    for (const line of summary.quota) out.push(`- ${quotaText(line)}`)
    out.push('')
  }
  out.push(`[${t('ide.status.open')}](command:codeburn.openDashboard)`)
  return out.join('\n')
}

/** Copy a compact usage summary as plain text. */
export function summaryText(summary: Summary): string {
  setActiveCurrency(summary.currency)
  const lines = [`CodeBurn · ${new Date(summary.at).toLocaleDateString()}`]
  for (const [label, value] of usageRows(summary)) lines.push(`${label}: ${value}`)
  if (summary.topModels.length > 0) {
    lines.push(`${t('ide.sidebar.topModels')}: ${summary.topModels.slice(0, 3).map(row => `${row.name} ${rankedText(row)}`).join(', ')}`)
  }
  for (const line of summary.quota) lines.push(quotaText(line))
  return lines.join('\n')
}

/** What the activity bar view renders. */
export type SidebarState = {
  status: 'loading' | 'ok' | 'error'
  error: { kind: string; message: string } | null
  summary: Summary | null
  /** The workspace's name, or null with no folder open. */
  workspaceLabel: string | null
  /** Set when the CLI runs on the editor's own, too-old Node. */
  runtimeNote: string | null
  /** The star line at the bottom, once the extension has seen real use. */
  star?: boolean
}
