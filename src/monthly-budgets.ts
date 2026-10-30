export const DEFAULT_CODEX_MONTHLY_BUDGET_CREDITS = 7_800

type ProviderDetail = {
  id: string
  label: string
  cost: number
  hasUsage?: boolean
  estimatedCostUSD?: number
}

export type MonthlyBudgetPayload = {
  stale?: boolean
  hydration?: { complete: boolean }
  current?: {
    codexCredits?: number
    codexCreditsIncomplete?: boolean
    codexCreditsEstimated?: boolean
    providerDetails?: ProviderDetail[]
  }
}

export type MonthlyBudgetPercentage = {
  id: 'codex' | 'claude' | 'cursor'
  label: string
  percentage: string
  value: number | null
  estimated: boolean
}

function percent(used: number | null, budget: number, estimated: boolean): MonthlyBudgetPercentage['percentage'] {
  if (used === null || !Number.isFinite(used) || used < 0 || !Number.isFinite(budget) || budget <= 0) {
    return 'Unavailable'
  }
  return `${estimated ? '~' : ''}${Math.round(used / budget * 100)}%`
}

export function monthlyBudgetPercentages(
  payload: MonthlyBudgetPayload | null,
  codexBudget = DEFAULT_CODEX_MONTHLY_BUDGET_CREDITS,
): MonthlyBudgetPercentage[] {
  const current = payload?.current
  const details = current?.providerDetails ?? []
  const claude = details.find(provider => provider.id === 'claude')
  const cursor = details.filter(provider => provider.id === 'cursor' || provider.id === 'cursor-agent')
  const partial = payload?.stale === true || payload?.hydration?.complete === false
  const codexUsed = typeof current?.codexCredits === 'number' ? current.codexCredits : null
  const claudeUsed = claude ? (claude.hasUsage === false ? 0 : claude.cost) : null
  const cursorUsed = cursor.length > 0
    ? cursor.reduce((sum, provider) => sum + (provider.hasUsage === false ? 0 : provider.cost), 0)
    : null
  const entries = [
    {
      id: 'codex' as const,
      label: 'Codex',
      used: codexUsed,
      budget: codexBudget,
      estimated: partial || current?.codexCreditsEstimated === true || current?.codexCreditsIncomplete === true,
    },
    { id: 'claude' as const, label: 'Claude', used: claudeUsed, budget: 100, estimated: true },
    {
      id: 'cursor' as const,
      label: 'Cursor',
      used: cursorUsed,
      budget: 100,
      estimated: partial || cursor.some(provider => (provider.estimatedCostUSD ?? 0) > 0),
    },
  ]
  return entries.map(({ id, label, used, budget, estimated }) => ({
    id,
    label,
    value: used === null ? null : budget > 0 ? used / budget * 100 : null,
    percentage: percent(used, budget, estimated),
    estimated,
  }))
}
