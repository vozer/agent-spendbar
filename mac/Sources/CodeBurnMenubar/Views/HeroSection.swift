import SwiftUI

struct HeroSection: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionCaption(text: caption)

            HStack(alignment: .firstTextBaseline) {
                Text(heroText)
                    .font(.system(size: 32, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .tracking(-1)
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Theme.brandAccent, Theme.brandAccentDeep],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text(totals.calls == 1 ? L("%@ call", totals.calls.asThousandsSeparated()) : L("%@ calls", totals.calls.asThousandsSeparated()))
                        .font(.system(size: 11))
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                    Text(combinedUsage != nil
                         ? SessionCountLabel.combinedText
                         : SessionCountLabel.text(sessions: totals.sessions, basis: totals.sessionCountBasis))
                        .font(.system(size: 10.5))
                        .monospacedDigit()
                        .foregroundStyle(.tertiary)
                        .help(SessionCountLabel.helpText(combined: combinedUsage != nil, basis: totals.sessionCountBasis))
                }
            }

            if let usage = combinedUsage {
                CombinedDeviceBreakdown(usage: usage, formatTokens: formatTokens)
            } else if store.activeScope == .combined, store.lastError != nil {
                HStack(spacing: 4) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 10))
                    Text(L("Combined unavailable · showing local"))
                        .font(.system(size: 11, weight: .medium))
                }
                .foregroundStyle(.secondary)
            }

        }
        .padding(.horizontal, 14)
        .padding(.top, 10)
        .padding(.bottom, 12)
    }

    private var heroText: String {
        if totals.totalTokens > 0 {
            return L("%@ tokens", formatTokens(Double(totals.totalTokens)))
        }
        return totals.calls == 1
            ? L("%@ call", totals.calls.asThousandsSeparated())
            : L("%@ calls", totals.calls.asThousandsSeparated())
    }

    private var combinedUsage: CombinedUsage? {
        guard store.activeScope == .combined else { return nil }
        return store.payload.combined
    }

    private var totals: HeroTotals {
        HeroTotals(payload: store.payload, activeScope: store.activeScope)
    }

    private func formatTokens(_ n: Double) -> String {
        if n >= 1_000_000_000 { return String(format: "%.1fB", n / 1_000_000_000) }
        if n >= 1_000_000 { return String(format: "%.1fM", n / 1_000_000) }
        if n >= 1_000 { return String(format: "%.0fK", n / 1_000) }
        return String(format: "%.0f", n)
    }

    private var caption: String {
        let label = store.payload.current.label.isEmpty ? store.selectedPeriod.rawValue : store.payload.current.label
        if combinedUsage != nil {
            return L("Combined · %@", label)
        }
        if !store.isDayMode && store.selectedPeriod == .today {
            return "\(label) · \(todayDate)"
        }
        return label
    }

    private var todayDate: String {
        let formatter = DateFormatter()
        // Localized template, not a fixed pattern: zh-Hans wants "9月11日周五",
        // not "Fri Sep 11".
        formatter.setLocalizedDateFormatFromTemplate("EEE MMM d")
        return formatter.string(from: Date())
    }
}

struct HeroTotals: Equatable {
    let cost: Double
    let calls: Int
    let sessions: Int
    let sessionCountBasis: String?
    let inputTokens: Int
    let outputTokens: Int
    let totalTokens: Int

    init(cost: Double, calls: Int, sessions: Int, inputTokens: Int, outputTokens: Int, totalTokens: Int, sessionCountBasis: String? = nil) {
        self.cost = cost
        self.calls = calls
        self.sessions = sessions
        self.sessionCountBasis = sessionCountBasis
        self.inputTokens = inputTokens
        self.outputTokens = outputTokens
        self.totalTokens = totalTokens
    }

    init(payload: MenubarPayload, activeScope: MenubarScope) {
        if activeScope == .combined, let combined = payload.combined?.combined {
            // Keep the numeric wire sum for compatibility. Combined-scope UI
            // must not present it as a unique or lower-bound count.
            self.init(
                cost: combined.cost,
                calls: combined.calls,
                sessions: combined.sessions,
                inputTokens: combined.inputTokens,
                outputTokens: combined.outputTokens,
                totalTokens: combined.inputTokens + combined.outputTokens
            )
            return
        }

        let current = payload.current
        self.init(
            cost: current.cost,
            calls: current.calls,
            sessions: current.sessions,
            inputTokens: current.inputTokens,
            outputTokens: current.outputTokens,
            totalTokens: current.inputTokens + current.outputTokens,
            sessionCountBasis: current.sessionCountBasis
        )
    }
}

private struct CombinedDeviceBreakdown: View {
    let usage: CombinedUsage
    let formatTokens: (Double) -> String

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 4) {
                Image(systemName: "desktopcomputer")
                    .font(.system(size: 10))
                Text(L("%1$lld of %2$lld devices", usage.combined.reachableCount, usage.combined.deviceCount))
                    .font(.system(size: 11, weight: .medium))
            }
            .foregroundStyle(.secondary)

            VStack(spacing: 3) {
                ForEach(usage.perDevice, id: \.id) { device in
                    HStack(spacing: 6) {
                        Image(systemName: device.error == nil ? "circle.fill" : "exclamationmark.triangle.fill")
                            .font(.system(size: device.error == nil ? 5 : 9, weight: .semibold))
                            .foregroundStyle(device.error == nil ? Color.secondary.opacity(0.75) : Theme.semanticWarning)
                            .frame(width: 10)
                        Text(device.local ? L("%@ · local", device.name) : device.name)
                            .font(.system(size: 10.5, weight: .medium))
                            .lineLimit(1)
                            .truncationMode(.tail)
                        Spacer(minLength: 6)
                        if device.error == nil {
                            Text(L("%@ calls", device.calls.asThousandsSeparated()))
                                .font(.system(size: 10.5))
                                .monospacedDigit()
                                .foregroundStyle(.secondary)
                            Text(L("%@ tokens", formatTokens(Double(device.totalTokens))))
                                .font(.system(size: 10))
                                .monospacedDigit()
                                .foregroundStyle(.tertiary)
                        } else {
                            Text(L("Unavailable"))
                                .font(.system(size: 10.5))
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }
}
