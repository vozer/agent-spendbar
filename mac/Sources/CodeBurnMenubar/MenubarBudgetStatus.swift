import Foundation

struct MenubarBudgetItem: Equatable, Sendable {
    let id: String
    let label: String
    let percentage: String
    let estimated: Bool

    var accessibilityLabel: String {
        guard percentage != "—" else { return "\(label): monthly usage unavailable" }
        let value = estimated ? String(percentage.dropFirst()) : percentage
        return "\(label): \(estimated ? "estimated " : "")\(value) of monthly budget used"
    }
}

enum MenubarBudgetStatus {
    static let codexBudgetSuite = "com.local.codex-spend"
    static let codexBudgetKey = "monthlyCreditBudgetCredits"
    static let defaultCodexBudget = 7000.0

    static func codexBudget(defaults: UserDefaults? = UserDefaults(suiteName: codexBudgetSuite)) -> Double? {
        guard let defaults else { return nil }
        guard let saved = defaults.object(forKey: codexBudgetKey) else { return defaultCodexBudget }
        guard let budget = (saved as? NSNumber)?.doubleValue, budget.isFinite, budget >= 0 else { return nil }
        return budget
    }

    static func percentage(
        used: Double?,
        budget: Double?,
        estimated: Bool,
        incomplete: Bool = false
    ) -> String {
        guard !incomplete,
              let used, let budget,
              used.isFinite, budget.isFinite,
              used >= 0, budget > 0 else { return "—" }
        let rawPercent = used / budget * 100
        guard rawPercent.isFinite, rawPercent < Double(Int.max) else { return "—" }
        let percent = Int(rawPercent.rounded())
        return "\(estimated ? "~" : "")\(percent)%"
    }

    static func items(current: CurrentBlock?, codexBudget: Double?, unavailable: Bool) -> [MenubarBudgetItem] {
        let providers = current?.providerDetails ?? []
        let codex = providers.first { $0.id == "codex" }
        let claude = providers.first { $0.id == "claude" }
        let cursor = providers.filter { $0.id == "cursor" || $0.id == "cursor-agent" }
        return [
            item("codex", "Codex", used: codex == nil ? nil : current?.codexCredits,
                 budget: codexBudget, estimated: current?.codexCreditsEstimated == true,
                 incomplete: unavailable || current?.codexCreditsIncomplete == true),
            item("claude", "Claude", used: claude?.cost, budget: 100,
                 estimated: true, incomplete: unavailable),
            item("cursor", "Cursor", used: cursor.isEmpty ? nil : cursor.reduce(0) { $0 + $1.cost }, budget: 100,
                 estimated: cursor.contains { ($0.estimatedCostUSD ?? 0) > 0 }, incomplete: unavailable),
        ]
    }

    private static func item(
        _ id: String,
        _ label: String,
        used: Double?,
        budget: Double?,
        estimated: Bool,
        incomplete: Bool
    ) -> MenubarBudgetItem {
        MenubarBudgetItem(
            id: id,
            label: label,
            percentage: percentage(used: used, budget: budget, estimated: estimated, incomplete: incomplete),
            estimated: estimated
        )
    }
}
