# Cookie Native iOS

This directory contains the native iOS 26 shell for Cookie.

## Goal

The web product remains intact. The iPhone/iPad shell moves the high-visibility system chrome to SwiftUI so Apple's public Liquid Glass material is responsible for the native bars, controls, sheet, and interactions.

Apple APIs used:

- Glass and glassEffect
- GlassEffectContainer
- glass button styles
- glassProminent button style

The app loads the existing Cookie web product inside WKWebView, preserving the current authentication, chat state, settings, AI endpoints, and server synchronization.

## Setup

1. Open CookieNative.xcodeproj in Xcode on a Mac with an iOS 26 SDK.
2. Replace the CookieWebURL value in CookieNative/Info.plist with the real HTTPS deployment URL.
3. Select the CookieNative scheme.
4. Set your Apple Development Team for signing.
5. Run on an iPhone or iPad running iOS 26.

No third-party iOS dependencies are required.

## Architecture

SwiftUI / iOS 26
    |
    +-- native Liquid Glass top bar
    +-- native Liquid Glass composer
    +-- native navigation sheet
    |
    +-- WKWebView
          |
          +-- existing Cookie React UI
          +-- existing Cookie authentication
          +-- existing Cookie API routes

The bridge hides only the duplicated web chrome and forwards native composer sends into the existing React composer.

## Safety

This does not replace or delete the web application. The native project is an additive iOS target. It uses Apple's public Liquid Glass APIs rather than copying private compositor code.

## Current native commands

new-chat, search, library, projects, code, gpts, work, settings
