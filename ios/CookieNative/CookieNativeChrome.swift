import SwiftUI

struct CookieNativeTopBar: View {
    let canGoBack: Bool
    let onBack: () -> Void
    let onMenu: () -> Void
    let onNewChat: () -> Void
    let modelName: String
    let onModel: (String) -> Void

    private let models: [(String, String)] = [
        ("standard", "CPT-1"),
        ("max", "CPT-2 MAX"),
        ("ultra", "CPT-3 ULTRA")
    ]

    var body: some View {
        HStack(spacing: 10) {
            Button(action: onMenu) {
                Image(systemName: "sidebar.left")
                    .font(.system(size: 16, weight: .semibold))
                    .frame(width: 38, height: 38)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Open Cookie navigation")

            if canGoBack {
                Button(action: onBack) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 16, weight: .semibold))
                        .frame(width: 38, height: 38)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Back")
            }

            Spacer(minLength: 0)

            Menu {
                ForEach(models, id: \.0) { model in
                    Button {
                        onModel(model.0)
                    } label: {
                        HStack {
                            Text(model.1)
                            if model.0 == modelName {
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                }
            } label: {
                VStack(spacing: 1) {
                    Text("Cookie")
                        .font(.system(size: 17, weight: .semibold))
                    Text(models.first(where: { $0.0 == modelName })?.1 ?? "CPT-1")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(.secondary)
                }
                .frame(minWidth: 96)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Cookie model")

            Spacer(minLength: 0)

            Button(action: onNewChat) {
                Image(systemName: "square.and.pencil")
                    .font(.system(size: 16, weight: .semibold))
                    .frame(width: 38, height: 38)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("New chat")
        }
        .padding(7)
        .glassEffect(.regular, in: Capsule())
        .padding(.horizontal, 12)
        .padding(.top, 4)
        .padding(.bottom, 5)
    }
}

struct CookieNativeComposer: View {
    @Binding var text: String
    let isSending: Bool
    let onSend: () -> Void
    let onPlus: () -> Void

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            Button(action: onPlus) {
                Image(systemName: "plus")
                    .font(.system(size: 16, weight: .bold))
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
            .foregroundStyle(.secondary)
            .accessibilityLabel("Add attachment")

            TextField("Message Cookie", text: $text, axis: .vertical)
                .textFieldStyle(.plain)
                .font(.system(size: 17))
                .lineLimit(1...6)
                .submitLabel(.send)
                .onSubmit(onSend)
                .frame(minHeight: 36)

            Button(action: onSend) {
                Group {
                    if isSending {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Image(systemName: "arrow.up")
                            .font(.system(size: 16, weight: .bold))
                    }
                }
                .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
            .foregroundStyle(.tint)
            .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending)
            .accessibilityLabel("Send message")
        }
        .padding(7)
        .glassEffect(.regular.interactive(), in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .padding(.horizontal, 12)
        .padding(.top, 4)
        .padding(.bottom, 5)
    }
}
