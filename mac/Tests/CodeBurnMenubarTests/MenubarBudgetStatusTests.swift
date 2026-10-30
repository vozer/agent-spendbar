import Foundation
import Testing
@testable import CodeBurnMenubar

@Suite("Monthly budget status")
struct MenubarBudgetStatusTests {
    @Test("rounds percentages, marks estimates, and keeps values above 100 percent")
    func percentageFormatting() {
        #expect(MenubarBudgetStatus.percentage(used: 24.6, budget: 100, estimated: false) == "25%")
        #expect(MenubarBudgetStatus.percentage(used: 24.6, budget: 100, estimated: true) == "~25%")
        #expect(MenubarBudgetStatus.percentage(used: 145, budget: 100, estimated: false) == "145%")
    }

    @Test("shows a dash when the amount or denominator is missing or incomplete")
    func missingAndIncompleteUsage() {
        #expect(MenubarBudgetStatus.percentage(used: nil, budget: 100, estimated: false) == "—")
        #expect(MenubarBudgetStatus.percentage(used: 20, budget: 0, estimated: false) == "—")
        #expect(MenubarBudgetStatus.percentage(used: 20, budget: 100, estimated: false, incomplete: true) == "—")
    }

    @Test("uses the saved Codex budget and defaults only when the key is absent")
    func codexBudgetPreference() {
        let (defaults, suiteName) = TestDefaults.make("AgentSpendbarBudget.\(#function)")
        defer { TestDefaults.forget(suiteName) }

        #expect(MenubarBudgetStatus.codexBudget(defaults: defaults) == 7800)
        defaults.set(2400, forKey: MenubarBudgetStatus.codexBudgetKey)
        #expect(MenubarBudgetStatus.codexBudget(defaults: defaults) == 2400)
        defaults.set(0, forKey: MenubarBudgetStatus.codexBudgetKey)
        #expect(MenubarBudgetStatus.codexBudget(defaults: defaults) == 0)
        defaults.set("invalid", forKey: MenubarBudgetStatus.codexBudgetKey)
        #expect(MenubarBudgetStatus.codexBudget(defaults: defaults) == nil)
    }

    @Test("uses month totals for all three providers and blanks stale data")
    func providerItems() throws {
        let json = #"{"label":"Month","cost":185,"calls":4,"sessions":2,"inputTokens":0,"outputTokens":0,"codexCredits":3500,"codexCreditsEstimated":true,"providerDetails":[{"id":"codex","label":"Codex","cost":0,"calls":1,"hasUsage":true},{"id":"claude","label":"Claude","cost":25,"calls":1,"hasUsage":true},{"id":"cursor","label":"Cursor","cost":150,"calls":1,"hasUsage":true,"estimatedCostUSD":10},{"id":"cursor-agent","label":"Cursor Agent","cost":10,"calls":1,"hasUsage":true,"estimatedCostUSD":10}]}"#
        let current = try JSONDecoder().decode(CurrentBlock.self, from: Data(json.utf8))
        let items = MenubarBudgetStatus.items(current: current, codexBudget: 7000, unavailable: false)

        #expect(items.map(\.id) == ["codex", "claude", "cursor"])
        #expect(items.map(\.percentage) == ["~50%", "~25%", "~160%"])
        #expect(MenubarBudgetStatus.items(current: current, codexBudget: 7000, unavailable: true).allSatisfy { $0.percentage == "—" })
    }

    @Test("matches the reported 91 percent monthly Codex usage")
    func reportedCodexPercentage() {
        #expect(MenubarBudgetStatus.percentage(used: 7091, budget: 7800, estimated: true) == "~91%")
    }
}
