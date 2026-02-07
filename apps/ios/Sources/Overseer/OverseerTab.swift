import SwiftUI

struct OverseerTab: View {
    @Environment(NodeAppModel.self) private var appModel

    var body: some View {
        NavigationStack {
            OverseerView()
                .navigationTitle("Overseer")
                .navigationBarTitleDisplayMode(.inline)
        }
    }
}

struct OverseerView: View {
    @Environment(NodeAppModel.self) private var appModel
    @State private var isRefreshing: Bool = false
    @State private var selectedGoalId: String?
    @State private var showCreateGoal: Bool = false

    private var isConnected: Bool {
        appModel.gatewayServerName != nil
    }

    var body: some View {
        Group {
            if isConnected {
                connectedContent
            } else {
                disconnectedContent
            }
        }
        .refreshable {
            await refreshData()
        }
    }

    private var disconnectedContent: some View {
        VStack(spacing: 16) {
            Image(systemName: "network.slash")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("Not Connected")
                .font(.headline)
            Text("Connect to a gateway to view workflow status")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }

    private var connectedContent: some View {
        ScrollView {
            VStack(spacing: 16) {
                summaryCards
                stalledSection
                goalsSection
            }
            .padding()
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(action: { showCreateGoal = true }) {
                    Image(systemName: "plus")
                }
                .disabled(!isConnected)
            }
            ToolbarItem(placement: .primaryAction) {
                Button(action: { Task { await refreshData() } }) {
                    Image(systemName: "arrow.clockwise")
                }
                .disabled(isRefreshing)
            }
        }
        .sheet(isPresented: $showCreateGoal) {
            CreateGoalSheet(onDismiss: { showCreateGoal = false })
        }
    }

    private var summaryCards: some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible()),
        ], spacing: 12) {
            SummaryCard(
                title: "Goals",
                value: "\(appModel.overseerGoalsCount)",
                icon: "target",
                color: .blue
            )
            SummaryCard(
                title: "Stalled",
                value: "\(appModel.overseerStalledCount)",
                icon: "exclamationmark.triangle",
                color: appModel.overseerStalledCount > 0 ? .orange : .green
            )
            SummaryCard(
                title: "Tasks",
                value: "\(appModel.overseerTasksCompleted)/\(appModel.overseerTasksTotal)",
                icon: "checkmark.circle",
                color: .green
            )
            SummaryCard(
                title: "In Progress",
                value: "\(appModel.overseerTasksInProgress)",
                icon: "clock",
                color: .purple
            )
        }
    }

    private var stalledSection: some View {
        Group {
            if appModel.overseerStalledCount > 0 {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(.orange)
                        Text("Stalled Assignments")
                            .font(.headline)
                        Spacer()
                        Text("\(appModel.overseerStalledCount)")
                            .font(.caption)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(.orange.opacity(0.2))
                            .clipShape(Capsule())
                    }

                    ForEach(appModel.overseerStalledAssignments, id: \.workNodeId) { assignment in
                        StalledAssignmentRow(assignment: assignment)
                    }
                }
                .padding()
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
    }

    private var goalsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "flag.fill")
                    .foregroundStyle(.blue)
                Text("Goals")
                    .font(.headline)
                Spacer()
            }

            if appModel.overseerGoals.isEmpty {
                EmptyGoalsView()
            } else {
                ForEach(appModel.overseerGoals, id: \.goalId) { goal in
                    GoalRow(goal: goal, isSelected: selectedGoalId == goal.goalId)
                        .onTapGesture {
                            withAnimation {
                                selectedGoalId = selectedGoalId == goal.goalId ? nil : goal.goalId
                            }
                        }
                }
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func refreshData() async {
        isRefreshing = true
        await appModel.refreshOverseerStatus()
        isRefreshing = false
    }
}

private struct SummaryCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundStyle(color)
                Spacer()
            }
            Text(value)
                .font(.title2.bold())
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

private struct StalledAssignmentRow: View {
    let assignment: OverseerAssignment

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(assignment.workNodeId)
                    .font(.subheadline.weight(.medium))
                if let agentId = assignment.agentId {
                    Text("Agent: \(agentId)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            Button(action: {}) {
                Image(systemName: "arrow.clockwise")
                    .font(.caption)
            }
            .buttonStyle(.bordered)
            .tint(.orange)
        }
        .padding(12)
        .background(Color(.tertiarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

private struct GoalRow: View {
    let goal: OverseerGoal
    let isSelected: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(goal.title)
                    .font(.subheadline.weight(.medium))
                Spacer()
                StatusBadge(status: goal.status)
            }

            if isSelected {
                VStack(alignment: .leading, spacing: 4) {
                    if !goal.problemStatement.isEmpty {
                        Text(goal.problemStatement)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    HStack {
                        PriorityBadge(priority: goal.priority)
                        Spacer()
                        HStack(spacing: 8) {
                            if goal.status == "active" {
                                Button("Pause") {}
                                    .buttonStyle(.bordered)
                                    .controlSize(.small)
                            } else if goal.status == "paused" {
                                Button("Resume") {}
                                    .buttonStyle(.borderedProminent)
                                    .controlSize(.small)
                            }
                        }
                    }
                }
                .padding(.top, 4)
            }
        }
        .padding(12)
        .background(Color(.tertiarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .strokeBorder(isSelected ? Color.blue.opacity(0.5) : Color.clear, lineWidth: 2)
        )
    }
}

private struct StatusBadge: View {
    let status: String

    private var color: Color {
        switch status {
        case "active": return .green
        case "paused": return .orange
        case "completed", "done": return .blue
        case "blocked": return .red
        default: return .gray
        }
    }

    var body: some View {
        Text(status.capitalized)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.2))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }
}

private struct PriorityBadge: View {
    let priority: String

    private var color: Color {
        switch priority {
        case "urgent": return .red
        case "high": return .orange
        case "normal": return .blue
        case "low": return .gray
        default: return .gray
        }
    }

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "flag.fill")
                .font(.caption2)
            Text(priority.capitalized)
                .font(.caption2.weight(.medium))
        }
        .foregroundStyle(color)
    }
}

private struct EmptyGoalsView: View {
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "flag.slash")
                .font(.title2)
                .foregroundStyle(.secondary)
            Text("No goals yet")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text("Create a goal to start tracking work")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
    }
}

private struct CreateGoalSheet: View {
    let onDismiss: () -> Void
    @State private var title: String = ""
    @State private var problemStatement: String = ""
    @State private var priority: String = "normal"

    var body: some View {
        NavigationStack {
            Form {
                Section("Goal Details") {
                    TextField("Title", text: $title)
                    TextField("Problem Statement", text: $problemStatement, axis: .vertical)
                        .lineLimit(3...6)
                }
                Section("Options") {
                    Picker("Priority", selection: $priority) {
                        Text("Low").tag("low")
                        Text("Normal").tag("normal")
                        Text("High").tag("high")
                        Text("Urgent").tag("urgent")
                    }
                }
            }
            .navigationTitle("New Goal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { onDismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        // TODO: Create goal via gateway
                        onDismiss()
                    }
                    .disabled(title.isEmpty || problemStatement.isEmpty)
                }
            }
        }
    }
}

// Data models for Overseer
struct OverseerGoal: Identifiable {
    var id: String { goalId }
    let goalId: String
    let title: String
    let status: String
    let priority: String
    let problemStatement: String
}

struct OverseerAssignment: Identifiable {
    var id: String { assignmentId }
    let assignmentId: String
    let goalId: String
    let workNodeId: String
    let status: String
    let agentId: String?
}
