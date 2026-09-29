# Cookie — UI/UX Pro Max Master Design System

This is the visual source of truth for Cookie's Next.js AI workspace.

## Product category
AI / Chatbot Platform + Developer Tool / IDE.

## Design direction
Calm, premium, professional dark workspace. Use restrained editorial minimalism with AI-native workspace patterns. Avoid generic AI landing-page aesthetics, neon gradients, excessive glassmorphism, decorative blobs, and emoji icons.

## Visual system
- Background: near-black neutral #0B0B0A
- Surface: #11110F
- Raised surface: #171714
- Strong raised surface: #1D1D19
- Border: #292923
- Strong border: #38382F
- Primary text: #F2F0EA
- Secondary text: #A09F96
- Muted text: #6E6E65
- Accent: #C9A06A
- Accent strong: #DFB477
- Accent ink: #17120B
- Use the accent sparingly for actions, status, focus, and model identity.

## Typography
- UI/body: DM Sans
- Display/brand/headings: Space Grotesk
- Keep headings compact, balanced, and responsive.
- Never rely on fixed-width text assumptions.
- Long identifiers and filenames must wrap safely.

## Layout
- Desktop: persistent navigation rail/sidebar, centered conversation column, fixed composer.
- Workspace: right-side inspector/drawer.
- Tablet: collapse sidebar and preserve conversation hierarchy.
- Mobile: single-column conversation, full-width composer, full-screen workspace panel.
- Validate at 375px, 768px, 1024px, and 1440px.

## Interaction
- Use short, purposeful transitions.
- Hover states should communicate clickability without visual noise.
- Preserve semantic state even when animation is interrupted.
- Respect prefers-reduced-motion.
- Keep focus states visible.
- Do not make interactions depend only on hover.
- Buttons must have cursor-pointer and accessible labels.

## Components
- Sidebar navigation
- New chat action
- Recent conversations
- Model selector
- Starter action cards
- Message stream
- Message utility actions
- Attachment previews
- Composer
- Workspace inspector
- File search
- Settings modal
- Help/shortcut modal
- Preview/status indicator

## Iconography
Use Lucide SVG icons. Never use emoji as interface icons.

## Accessibility
- Visible keyboard focus.
- Icon-only buttons require aria-label.
- Color is not the only status signal.
- Text must maintain readable contrast.
- Controls must remain operable at narrow widths.
- Respect reduced motion.
- Dialogs should have clear close controls.

## Motion
- Sidebar/panel: 180–260ms.
- Popovers: 140–180ms.
- Message entrance: 180–240ms.
- Hover: 120–180ms.
- Avoid continuous decorative animation; only functional status indicators may pulse.

## UX anti-patterns explicitly excluded
- Emoji UI icons
- AI purple/pink gradient clichés
- Huge decorative hero artwork
- Excessive rounded cards
- Unnecessary glassmorphism
- Instant state changes where feedback is expected
- Hidden focus states
- Hover-only information
- Clipped chips, badges, filenames, or headings
- Fixed layouts that fail at 375px
- Motion that ignores reduced-motion preferences

## Next.js implementation notes
Build as componentized React UI with semantic HTML, Lucide icons, responsive CSS, and client-side state only where interaction requires it. Keep AI/workspace behavior independent from visual presentation.

## Pre-delivery checklist
- [x] No emoji interface icons
- [x] Lucide icon system
- [x] Visible focus states
- [x] Reduced-motion support
- [x] Responsive 375/768/1024/1440 layouts
- [x] Resilient filename/text wrapping
- [x] Purposeful transitions
- [x] Accessible icon labels
- [x] Dark/light appearance
- [x] AI/chatbot + developer-tool patterns
