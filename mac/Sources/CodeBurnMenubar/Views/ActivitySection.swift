import SwiftUI

struct ActivitySection: View {
    @Environment(AppStore.self) private var store
    @State private var isExpanded: Bool = true

    var body: some View {
        CollapsibleSection(
            caption: L("Activity"),
            isExpanded: $isExpanded,
            trailing: {
                HStack(spacing: 8) {
                    Text(L("Turns")).frame(minWidth: 54, alignment: .trailing)
                    Text(L("1-shot")).frame(minWidth: 44, alignment: .trailing)
                }
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(.tertiary)
                .tracking(-0.05)
            }
        ) {
            VStack(alignment: .leading, spacing: 7) {
                let maxTurns = max(store.payload.current.topActivities.map(\.turns).max() ?? 1, 1)
                ForEach(store.payload.current.topActivities.sorted { $0.turns > $1.turns }, id: \.name) { activity in
                    ActivityRow(activity: activity, maxTurns: maxTurns)
                }
            }
        }
    }
}

struct ActivityRow: View {
    let activity: ActivityEntry
    let maxTurns: Int

    var body: some View {
        HStack(spacing: 8) {
            FixedBar(fraction: Double(activity.turns) / Double(maxTurns))
                .frame(width: 56, height: 6)

            Text(activity.name)
                .font(.system(size: 12.5, weight: .medium))
                .frame(maxWidth: .infinity, alignment: .leading)

            Text("\(activity.turns)")
                .font(.system(size: 11))
                .monospacedDigit()
                .foregroundStyle(.secondary)
                .frame(minWidth: 54, alignment: .trailing)

            Text(oneShotText)
                .font(.system(size: 10.5))
                .monospacedDigit()
                .foregroundStyle(.secondary)
                .frame(minWidth: 44, alignment: .trailing)
        }
        .padding(.horizontal, 2)
        .padding(.vertical, 1)
    }

    private var oneShotText: String {
        guard let rate = activity.oneShotRate else { return "—" }
        return "\(Int(rate * 100))%"
    }
}

/// Fixed-width horizontal bar that shows a fill fraction.
struct FixedBar: View {
    let fraction: Double

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(.secondary.opacity(0.15))
                RoundedRectangle(cornerRadius: 2)
                    .fill(Theme.brandAccent)
                    .frame(width: max(0, min(geo.size.width, geo.size.width * CGFloat(fraction))))
            }
        }
    }
}
