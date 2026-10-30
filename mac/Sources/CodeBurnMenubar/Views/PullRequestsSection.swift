import SwiftUI

/// Compact top-pull-requests strip: the menubar's slice of the PR attribution
/// the desktop app shows in full. Renders the top three PRs by attributed
/// session count for the selected period; hides entirely when the payload carries no
/// PR block (older CLI, provider-scoped payload, or nothing attributed).
struct PullRequestsSection: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        let rows = Array((store.payload.current.pullRequests?.rows ?? []).sorted { $0.sessions > $1.sessions }.prefix(3))
        if !rows.isEmpty {
            VStack(spacing: 0) {
                Divider().opacity(0.5)
                VStack(alignment: .leading, spacing: 6) {
                    SectionCaption(text: L("Pull requests"))
                    ForEach(rows, id: \.url) { row in
                        HStack(spacing: 8) {
                            Text(row.label)
                                .font(.system(size: 11.5, design: .monospaced))
                                .lineLimit(1)
                                .truncationMode(.middle)
                            Spacer(minLength: 8)
                            Text(SessionCountLabel.text(sessions: row.sessions, basis: nil))
                                .font(.system(size: 11.5, weight: .medium))
                                .monospacedDigit()
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 11)
            }
        }
    }
}
