import SwiftUI

@main
struct CookieNativeApp: App {
    var body: some Scene {
        WindowGroup {
            CookieShellView()
                .preferredColorScheme(nil)
        }
    }
}
