import SwiftUI

struct ToolingSection: View {
    @Environment(AppStore.self) private var store
    @State private var isExpanded: Bool = false

    private var skillsAndAgents: [UsageRowData] {
        let current = store.payload.current
        var merged: [String: Int] = [:]
        for s in current.skills {
            merged[s.name, default: 0] += s.turns
        }
        for a in current.subagents {
            merged[a.name, default: 0] += a.calls
        }
        return merged
            .map { UsageRowData(name: $0.key, uses: $0.value) }
            .sorted { $0.uses > $1.uses }
    }

    var body: some View {
        let current = store.payload.current
        let combined = skillsAndAgents
        let hasAny = !current.tools.isEmpty || !combined.isEmpty || !current.mcpServers.isEmpty
        if hasAny {
            CollapsibleSection(caption: L("Tooling"), isExpanded: $isExpanded) {
                VStack(alignment: .leading, spacing: 12) {
                    if !current.tools.isEmpty {
                        ToolingSubsection(title: L("Tools")) {
                            let maxCalls = current.tools.map(\.calls).max() ?? 1
                            ForEach(current.tools.sorted { $0.calls > $1.calls }, id: \.name) { t in
                                CallsRow(name: t.name, calls: t.calls, maxCalls: maxCalls)
                            }
                        }
                    }
                    if !combined.isEmpty {
                        ToolingSubsection(title: L("Skills & Agents")) {
                            let maxUses = max(combined.map(\.uses).max() ?? 1, 1)
                            ForEach(combined, id: \.name) { d in
                                UsageRow(name: d.name, uses: d.uses, maxUses: maxUses)
                            }
                        }
                    }
                    if !current.mcpServers.isEmpty {
                        ToolingSubsection(title: L("MCP Servers")) {
                            let maxCalls = current.mcpServers.map(\.calls).max() ?? 1
                            ForEach(current.mcpServers.sorted { $0.calls > $1.calls }, id: \.name) { m in
                                CallsRow(name: m.name, calls: m.calls, maxCalls: maxCalls)
                            }
                        }
                    }
                }
            }
        }
    }
}

private struct UsageRowData {
    let name: String
    let uses: Int
}

private struct ToolingSubsection<Content: View>: View {
    let title: String
    let content: Content

    init(title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title)
                .font(.system(size: 10.5, weight: .semibold))
                .foregroundStyle(.tertiary)
                .textCase(.uppercase)
                .tracking(0.5)
            content
        }
    }
}

private struct CallsRow: View {
    let name: String
    let calls: Int
    let maxCalls: Int

    var body: some View {
        HStack(spacing: 8) {
            FixedBar(fraction: Double(calls) / Double(max(maxCalls, 1)))
                .frame(width: 40, height: 5)
            Text(name)
                .font(.system(size: 12, weight: .medium))
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text("\(calls)")
                .font(.system(size: 11))
                .monospacedDigit()
                .foregroundStyle(.secondary)
                .frame(minWidth: 36, alignment: .trailing)
        }
        .padding(.vertical, 1)
    }
}

private struct UsageRow: View {
    let name: String
    let uses: Int
    let maxUses: Int

    var body: some View {
        HStack(spacing: 8) {
            FixedBar(fraction: Double(uses) / Double(max(maxUses, 1)))
                .frame(width: 40, height: 5)
            Text(name)
                .font(.system(size: 12, weight: .medium))
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text("\(uses)")
                .font(.system(size: 11))
                .monospacedDigit()
                .foregroundStyle(.secondary)
                .frame(minWidth: 30, alignment: .trailing)
        }
        .padding(.vertical, 1)
    }
}
