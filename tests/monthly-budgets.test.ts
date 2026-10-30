import { describe, expect, it } from 'vitest'

import { monthlyBudgetPercentages } from '../src/monthly-budgets.js'

describe('monthly budget percentages', () => {
  it('uses the 7,800 credit cap and the fixed Claude and Cursor caps', () => {
    const items = monthlyBudgetPercentages({
      current: {
        codexCredits: 7_091,
        codexCreditsIncomplete: true,
        providerDetails: [
          { id: 'codex', label: 'Codex', cost: 0, hasUsage: true },
          { id: 'claude', label: 'Claude', cost: 50, hasUsage: true },
          { id: 'cursor', label: 'Cursor', cost: 100, hasUsage: true },
        ],
      },
    })

    expect(items.map(({ id, percentage }) => [id, percentage])).toEqual([
      ['codex', '~91%'],
      ['claude', '~50%'],
      ['cursor', '100%'],
    ])
  })

  it('combines Cursor and Cursor Agent usage and labels estimates', () => {
    const items = monthlyBudgetPercentages({
      current: {
        codexCredits: 0,
        providerDetails: [
          { id: 'codex', label: 'Codex', cost: 0, hasUsage: false },
          { id: 'claude', label: 'Claude', cost: 0, hasUsage: false },
          { id: 'cursor', label: 'Cursor', cost: 60, hasUsage: true, estimatedCostUSD: 1 },
          { id: 'cursor-agent', label: 'Cursor Agent', cost: 40, hasUsage: true },
        ],
      },
    })

    expect(items.find(item => item.id === 'cursor')?.percentage).toBe('~100%')
  })

  it('uses a visible fallback for missing data and marks partial data as estimated', () => {
    expect(monthlyBudgetPercentages(null).every(item => item.percentage === 'Unavailable')).toBe(true)
    const partial = monthlyBudgetPercentages({
      current: {
        codexCredits: 7_091,
        providerDetails: [
          { id: 'codex', label: 'Codex', cost: 0, hasUsage: true },
          { id: 'claude', label: 'Claude', cost: 50, hasUsage: true },
          { id: 'cursor', label: 'Cursor', cost: 50, hasUsage: true },
        ],
      },
      hydration: { complete: false },
    })
    expect(partial.map(item => item.percentage)).toEqual(['~91%', '~50%', '~50%'])
  })
})
