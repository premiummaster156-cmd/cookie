import Foundation
import WebKit

@MainActor
final class CookieWebController: ObservableObject {
    weak var webView: WKWebView?

    func send(text: String) {
        let data = (try? JSONSerialization.data(withJSONObject: [text])) ?? Data("[""]".utf8)
        let jsonArray = String(data: data, encoding: .utf8) ?? "[\"\"]"
        let value = String(jsonArray.dropFirst().dropLast())

        let script = """
        (() => {
          const ta = document.querySelector('.composer textarea');
          if (!ta) return false;
          const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
          if (!setter) return false;
          setter.call(ta, (value));
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          requestAnimationFrame(() => {
            const send = document.querySelector('.composer .send-button:not([disabled])');
            if (send) send.click();
            else ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
          });
          return true;
        })()
        """

        webView?.evaluateJavaScript(script)
    }

    func command(_ command: String) {
        let data = (try? JSONSerialization.data(withJSONObject: command)) ?? Data("""".utf8)
        let json = String(data: data, encoding: .utf8) ?? """"

        let script = """
        window.dispatchEvent(new CustomEvent('cookie:native-command', { detail: (json) }));
        true;
        """

        webView?.evaluateJavaScript(script)
    }

    func reload() {
        webView?.reload()
    }

    func goBack() {
        webView?.goBack()
    }
}
