import SwiftUI

struct ExecApprovalSheet: View {
    @Environment(NodeAppModel.self) private var appModel
    @Environment(\.dismiss) private var dismiss

    let request: ExecApprovalRequest
    let onDecision: (ExecApprovalDecision) -> Void

    @State private var showAdvanced: Bool = false
    @State private var isSubmitting: Bool = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    headerSection
                    commandSection
                    metadataSection
                    actionButtons
                    if showAdvanced {
                        advancedSection
                    }
                }
                .padding()
            }
            .navigationTitle("Approval Required")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Dismiss") {
                        dismiss()
                    }
                }
            }
        }
        .interactiveDismissDisabled(isSubmitting)
    }

    private var headerSection: some View {
        HStack(spacing: 12) {
            Image(systemName: "shield.fill")
                .font(.title)
                .foregroundStyle(.orange)
            VStack(alignment: .leading, spacing: 4) {
                Text("Execution Approval")
                    .font(.headline)
                Text("An agent is requesting permission to run a command")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.orange.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var commandSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Command")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(request.command)
                .font(.system(.body, design: .monospaced))
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }

    private var metadataSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Details")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)

            VStack(spacing: 0) {
                if let host = request.host {
                    MetadataRow(label: "Host", value: host)
                }
                if let agentId = request.agentId {
                    MetadataRow(label: "Agent", value: agentId)
                }
                if let sessionKey = request.sessionKey {
                    MetadataRow(label: "Session", value: sessionKey)
                }
                if let cwd = request.cwd {
                    MetadataRow(label: "Directory", value: cwd)
                }
                if let security = request.security {
                    MetadataRow(label: "Security", value: security)
                }
            }
            .background(Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }

    private var actionButtons: some View {
        VStack(spacing: 12) {
            Button(action: { submitDecision(.allowOnce) }) {
                HStack {
                    Image(systemName: "checkmark.circle")
                    Text("Allow Once")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
            .disabled(isSubmitting)

            Button(action: { submitDecision(.allowSession) }) {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                    Text("Allow for Session")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .tint(.blue)
            .disabled(isSubmitting)

            Button(action: { submitDecision(.allowAlways) }) {
                HStack {
                    Image(systemName: "shield.checkered")
                    Text("Always Allow")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .disabled(isSubmitting)

            Button(action: { submitDecision(.deny) }) {
                HStack {
                    Image(systemName: "xmark.circle")
                    Text("Deny")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .tint(.red)
            .disabled(isSubmitting)

            Button(action: { withAnimation { showAdvanced.toggle() } }) {
                HStack {
                    Text(showAdvanced ? "Hide Advanced" : "Show Advanced")
                    Image(systemName: showAdvanced ? "chevron.up" : "chevron.down")
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
        }
    }

    private var advancedSection: some View {
        VStack(spacing: 12) {
            Button(action: { submitDecision(.denyAlways) }) {
                HStack {
                    Image(systemName: "shield.slash")
                    Text("Always Deny This Pattern")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .tint(.red)
            .disabled(isSubmitting)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func submitDecision(_ decision: ExecApprovalDecision) {
        isSubmitting = true
        onDecision(decision)
        dismiss()
    }
}

private struct MetadataRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(width: 80, alignment: .leading)
            Text(value)
                .font(.caption)
                .lineLimit(1)
            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }
}

// Data models
struct ExecApprovalRequest: Identifiable {
    let id: String
    let command: String
    let host: String?
    let agentId: String?
    let sessionKey: String?
    let cwd: String?
    let security: String?
    let expiresAt: Date
}

enum ExecApprovalDecision: String {
    case allowOnce = "allow-once"
    case allowSession = "allow-session"
    case allowAlways = "allow-always"
    case deny = "deny"
    case denyAlways = "deny-always"
}

// Overlay for showing approval requests as a banner
struct ExecApprovalBanner: View {
    let request: ExecApprovalRequest
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                Image(systemName: "shield.fill")
                    .font(.title3)
                    .foregroundStyle(.orange)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Approval Required")
                        .font(.subheadline.weight(.semibold))
                    Text(request.command.prefix(40) + (request.command.count > 40 ? "..." : ""))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding()
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .shadow(color: .black.opacity(0.1), radius: 8, y: 4)
        }
        .buttonStyle(.plain)
    }
}
