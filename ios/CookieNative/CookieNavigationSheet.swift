import SwiftUI

struct CookieNavigationSheet: View {
    let onCommand: (String) -> Void

    private let rows: [(String, String, String)] = [
        ("square.and.pencil", "New chat", "new-chat"),
        ("magnifyingglass", "Search", "search"),
        ("books.vertical", "Library", "library"),
        ("folder", "Projects", "projects"),
        ("chevron.left.forwardslash.chevron.right", "Code Studio", "code"),
        ("sparkles", "GPTs", "gpts"),
        ("briefcase", "Work", "work"),
        ("gearshape", "Settings", "settings")
    ]

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(rows, id: \.2) { row in
                        Button {
                            onCommand(row.2)
                        } label: {
                            Label(row.1, systemImage: row.0)
                        }
                    }
                } header: {
                    Text("Cookie")
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Navigation")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        onCommand("dismiss")
                    }
                    .buttonStyle(.glass)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}
