import SwiftUI

struct ModelsSection: View {
    @Environment(AppStore.self) private var store
    @State private var isExpanded: Bool = true

    private var modelsByUsage: [ModelEntry] {
        store.payload.current.topModels.sorted { modelUsage($0) > modelUsage($1) }
    }

    private var maxUsage: Int {
        max(modelsByUsage.map(modelUsage).max() ?? 1, 1)
    }

    var body: some View {
        CollapsibleSection(
            caption: L("Models"),
            isExpanded: $isExpanded,
            trailing: {
                HStack(spacing: 8) {
                    Text(L("Calls")).frame(minWidth: 52, alignment: .trailing)
                }
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(.tertiary)
                .tracking(-0.05)
            }
        ) {
            VStack(alignment: .leading, spacing: 7) {
                ForEach(modelsByUsage, id: \.name) { model in
                    ModelRow(model: model, maxUsage: maxUsage)
                }

                TokensLine()
                    .padding(.top, 5)

                if !store.payload.current.unpricedModels.isEmpty {
                    AdditionalModelsLine(models: store.payload.current.unpricedModels)
                        .padding(.top, 3)
                }
            }
        }
    }
}

private struct AdditionalModelsLine: View {
    let models: [UnpricedModelEntry]

    var body: some View {
        let calls = models.reduce(0) { $0 + $1.calls }
        let tokens = models.reduce(0) { $0 + $1.tokens }
        HStack(spacing: 4) {
            Text(L(
                "Other models · %1$@ calls · %2$@ tokens",
                compactTokenCount(calls),
                compactTokenCount(tokens)
            ))
            .foregroundStyle(.secondary)
            .lineLimit(1)
            .truncationMode(.tail)
            Spacer()
        }
        .font(.system(size: 10.5))
        .monospacedDigit()
        .accessibilityLabel(models.map { "\($0.model): \($0.calls) calls, \($0.tokens) tokens" }.joined(separator: ", "))
    }
}

private func modelUsage(_ model: ModelEntry) -> Int {
    if model.hasTokenCounts || model.cacheWriteTokens != nil {
        return (model.inputTokens ?? 0)
            + (model.outputTokens ?? 0)
            + (model.cacheReadTokens ?? 0)
            + (model.cacheWriteTokens ?? 0)
    }
    return model.calls
}

/// Compact token count for the narrow popover: `1.2K` / `3.4M` / `5.6B`,
/// plain digits below a thousand. The exact values ride along in the row's
/// accessibility label, so compact rounding never hides the real number.
/// Internal so tests can pin the billions rung (#1318): period cache-read
/// totals on heavy machines cross a billion and rendered as `12345.7M`.
func compactTokenCount(_ n: Int) -> String {
    if n >= 1_000_000_000 {
        return String(format: "%.1fB", Double(n) / 1_000_000_000)
    } else if n >= 1_000_000 {
        return String(format: "%.1fM", Double(n) / 1_000_000)
    } else if n >= 1_000 {
        return String(format: "%.1fK", Double(n) / 1_000)
    }
    return "\(n)"
}

private struct ModelRow: View {
    let model: ModelEntry
    let maxUsage: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 8) {
                FixedBar(fraction: Double(modelUsage(model)) / Double(max(maxUsage, 1)))
                    .frame(width: 56, height: 6)

                Text(model.name)
                    .font(.system(size: 12.5, weight: .medium))
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Text("\(model.calls)")
                    .font(.system(size: 11))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                    .frame(minWidth: 52, alignment: .trailing)
            }

            if model.hasTokenCounts || model.cacheWriteTokens != nil {
                Text(L("%1$@ in · %2$@ out · %3$@ cache read", count(model.inputTokens), count(model.outputTokens), count(model.cacheReadTokens)))
                    .font(.system(size: 10.5))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .padding(.leading, 64)
                    .accessibilityLabel(model.tokenAccessibilityText)
            }
        }
        .padding(.horizontal, 2)
        .padding(.vertical, 1)
    }

    // Unknown (absent count) renders as a dash; a known zero renders as "0".
    private func count(_ value: Int?) -> String {
        value.map(compactTokenCount) ?? "—"
    }
}

extension ModelEntry {
    /// Exact token counts for assistive tech, since the visible line rounds
    /// compactly. Cache read is labelled as reused input, and cache write is
    /// named separately so the two are never read as one bucket. Locale-pinned
    /// comma grouping so the text is deterministic.
    var tokenAccessibilityText: String {
        func exact(_ value: Int) -> String {
            // Group the MAGNITUDE, then re-apply the sign. Grouping the signed
            // string treats "-" as a leading digit, so the sign is emitted
            // twice ("--1,234,567"). `magnitude` is unsigned, so Int.min is
            // handled too rather than trapping on negation.
            var digits = String(value.magnitude)
            var grouped = ""
            while digits.count > 3 {
                let cut = digits.index(digits.endIndex, offsetBy: -3)
                grouped = "," + digits[cut...] + grouped
                digits = String(digits[..<cut])
            }
            return (value < 0 ? "-" : "") + digits + grouped
        }

        var parts: [String] = []
        if let inputTokens { parts.append("\(exact(inputTokens)) input") }
        if let outputTokens { parts.append("\(exact(outputTokens)) output") }
        if let cacheReadTokens { parts.append("\(exact(cacheReadTokens)) cache read (reused input)") }
        if let cacheWriteTokens, cacheWriteTokens > 0 { parts.append("\(exact(cacheWriteTokens)) cache write") }
        return parts.joined(separator: ", ")
    }
}

private struct TokensLine: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        let t = store.payload.current
        let cacheHit = String(format: "%.0f", t.cacheHitPercent)

        HStack(spacing: 4) {
            Text(L("Tokens"))
                .foregroundStyle(.tertiary)
            Text(L("%@ in", formatTokens(t.inputTokens)))
                .foregroundStyle(.secondary)
            Text(verbatim: "·")
                .foregroundStyle(.tertiary)
            Text(L("%@ out", formatTokens(t.outputTokens)))
                .foregroundStyle(.secondary)
            Text(verbatim: "·")
                .foregroundStyle(.tertiary)
            Text(L("%@%% cache hit", cacheHit))
                .foregroundStyle(.secondary)
            Spacer()
        }
        .font(.system(size: 10.5))
        .monospacedDigit()
    }

    private func formatTokens(_ n: Int) -> String {
        compactTokenCount(n)
    }
}
