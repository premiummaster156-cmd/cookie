import SwiftUI

struct CookieShellView: View {
    @StateObject private var webController = CookieWebController()
    @State private var draft = ""
    @State private var isLoading = true
    @State private var canGoBack = false
    @State private var showNavigation = false
    @State private var showAttachmentNotice = false
    @State private var isSending = false

    var body: some View {
        ZStack {
            CookieWebView(
                url: CookieConfiguration.webURL,
                controller: webController,
                isLoading: $isLoading,
                canGoBack: $canGoBack
            )
            .ignoresSafeArea()

            if isLoading {
                ProgressView()
                    .controlSize(.small)
                    .tint(.primary)
                    .frame(width: 36, height: 36)
                    .glassEffect(.clear, in: Circle())
                    .transition(.opacity)
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            CookieNativeTopBar(
                canGoBack: canGoBack,
                onBack: { webController.goBack() },
                onMenu: { showNavigation = true },
                onNewChat: { webController.command("new-chat") }
            )
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            CookieNativeComposer(
                text: $draft,
                isSending: isSending,
                onSend: sendDraft,
                onPlus: { showAttachmentNotice = true }
            )
        }
        .sheet(isPresented: $showNavigation) {
            CookieNavigationSheet { command in
                if command == "dismiss" {
                    showNavigation = false
                    return
                }
                showNavigation = false
                webController.command(command)
            }
        }
        .alert("Attachments", isPresented: $showAttachmentNotice) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Native photo and file upload will be connected in the next bridge pass. The existing Cookie web composer remains available on the web app.")
        }
        .onChange(of: isLoading) { _, loading in
            if !loading {
                isSending = false
            }
        }
    }

    private func sendDraft() {
        let message = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty, !isSending else { return }

        isSending = true
        draft = ""
        webController.send(text: message)

        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(260))
            isSending = false
        }
    }
}
