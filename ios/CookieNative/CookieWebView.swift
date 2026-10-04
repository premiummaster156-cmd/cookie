import SwiftUI
import WebKit

struct CookieWebView: UIViewRepresentable {
    let url: URL
    @ObservedObject var controller: CookieWebController
    @Binding var isLoading: Bool
    @Binding var canGoBack: Bool
    @Binding var isAuthenticated: Bool

    func makeCoordinator() -> Coordinator {
        Coordinator(controller: controller, isLoading: $isLoading, canGoBack: $canGoBack, isAuthenticated: $isAuthenticated)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.userContentController.add(context.coordinator, name: "cookieAuth")

        let controllerScript = """
        (() => {
          window.__COOKIE_NATIVE_APP__ = true;
          const css = [
            'html.cookie-native-app, body.cookie-native-app { background: transparent !important; }',
            'body.cookie-native-app .sidebar, body.cookie-native-app .sidebar-overlay, body.cookie-native-app .mobile-nav-launcher, body.cookie-native-app .topbar, body.cookie-native-app .composer-wrap { display: none !important; }',
            'body.cookie-native-app .cookie-app, body.cookie-native-app .main-shell, body.cookie-native-app .chat-layer { width: 100% !important; max-width: none !important; margin: 0 !important; border: 0 !important; }',
            'body.cookie-native-app .main-shell { height: 100dvh !important; }',
            'body.cookie-native-app .chat-layer { height: 100% !important; }',
            'body.cookie-native-app .chat-scroll { padding-top: max(20px, env(safe-area-inset-top)) !important; padding-bottom: 124px !important; scroll-padding-bottom: 124px !important; }'
          ].join('\n');
          const style = document.createElement('style');
          style.id = 'cookie-native-app-style';
          style.textContent = css;
          (document.head || document.documentElement).appendChild(style);
          document.documentElement.classList.add('cookie-native-app');
          if (document.body) document.body.classList.add('cookie-native-app');
          else new MutationObserver(() => {
            if (document.body) document.body.classList.add('cookie-native-app');
          }).observe(document.documentElement, { childList: true, subtree: true });
        })();
        """

        configuration.userContentController.addUserScript(
            WKUserScript(
                source: controllerScript,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.backgroundColor = .clear
        webView.isOpaque = false
        webView.scrollView.backgroundColor = .clear
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        context.coordinator.webView = webView
        controller.webView = webView

        webView.load(URLRequest(url: url, cachePolicy: .useProtocolCachePolicy))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.isLoading = $isLoading
        context.coordinator.canGoBack = $canGoBack
        controller.webView = webView
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        weak var webView: WKWebView?
        weak var controller: CookieWebController?
        var isLoading: Binding<Bool>
        var canGoBack: Binding<Bool>
        var isAuthenticated: Binding<Bool>

        init(
            controller: CookieWebController,
            isLoading: Binding<Bool>,
            canGoBack: Binding<Bool>,
            isAuthenticated: Binding<Bool>
        ) {
            self.controller = controller
            self.isLoading = isLoading
            self.canGoBack = canGoBack
            self.isAuthenticated = isAuthenticated
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "cookieAuth" else { return }
            isAuthenticated.wrappedValue = (message.body as? Bool) ?? false
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            isLoading.wrappedValue = true
            canGoBack.wrappedValue = webView.canGoBack
        }

        func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
            isLoading.wrappedValue = true
            canGoBack.wrappedValue = webView.canGoBack
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            isLoading.wrappedValue = false
            canGoBack.wrappedValue = webView.canGoBack
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            isLoading.wrappedValue = false
            canGoBack.wrappedValue = webView.canGoBack
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            isLoading.wrappedValue = false
            canGoBack.wrappedValue = webView.canGoBack
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if navigationAction.targetFrame == nil {
                webView.load(navigationAction.request)
            }
            return nil
        }
    }
}
