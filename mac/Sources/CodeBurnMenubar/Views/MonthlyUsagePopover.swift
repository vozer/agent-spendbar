import SwiftUI

struct MonthlyUsagePopover: View {
    let items: [MenubarBudgetItem]
    let monthLabel: String

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 3) {
                Text(L("Monthly usage"))
                    .font(.headline)
                Text(monthLabel)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            ForEach(items, id: \.id) { item in
                VStack(alignment: .leading, spacing: 7) {
                    HStack(spacing: 9) {
                        if let icon = ProviderIconCache.image(named: item.id) {
                            Image(nsImage: icon)
                                .resizable()
                                .scaledToFit()
                                .frame(width: 18, height: 18)
                        }
                        Text(item.label)
                        Spacer()
                        Text(item.percentage)
                            .font(.system(.title3, design: .monospaced))
                            .fontWeight(.semibold)
                            .accessibilityLabel(item.accessibilityLabel)
                    }

                    ProgressView(value: min(100, max(0, percentageValue(item.percentage))), total: 100)
                        .tint(.accentColor)
                }
            }

            Text(L("Percent of monthly budget used. A tilde marks estimated or partial data."))
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(18)
        .frame(width: 320, alignment: .leading)
    }

    private func percentageValue(_ percentage: String) -> Double {
        Double(percentage.filter(\.isNumber)) ?? 0
    }
}
