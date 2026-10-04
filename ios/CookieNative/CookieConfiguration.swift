import Foundation

enum CookieConfiguration {
    static var webURL: URL {
        if let raw = Bundle.main.object(forInfoDictionaryKey: "CookieWebURL") as? String,
           let url = URL(string: raw),
           let scheme = url.scheme,
           scheme == "https" || scheme == "http" {
            return url
        }

        return URL(string: "https://YOUR-COOKIE-DOMAIN.example/")!
    }
}
