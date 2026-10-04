# COOKIE — NEW CHAT HANDOFF / CONTINUATION STATE

Updated: 2026-10-04
Repository: premiummaster156-cmd/cookie
Production: https://cookie-8bi.pages.dev
GitHub branch: main
Current main HEAD observed before this handoff: c934f4eaf96947af0b8592518dd0b0fa3c6521e6
Cloudflare Pages D1 binding: DB -> cookie-db

IMPORTANT:
- This file is a continuation handoff for a NEW ChatGPT conversation.
- Read this entire file before changing anything.
- Do not assume old hashes are current. Fetch the latest file + SHA from main immediately before editing.
- Never claim a deployment/build succeeded without checking GitHub Actions/Cloudflare evidence.
- User wants actual implementation/commits, not long explanations.
- User prefers English for technical work and direct/action-oriented responses.
- User is on a phone/iPhone frequently, so mobile behavior matters.
- User wants FREE services only. Do not add OpenAI/Anthropic/other paid APIs or paid dependencies unless explicitly requested.
- Do not add scripted prompt cards that merely paste canned text into chat. For simple, medium, or normal tasks, use the normal chat composer. Work must be input-first.
- User strongly dislikes generic "AI-generated" UI, excessive cards, fake blur, random decorative animations, and bad mobile layout.
- User wants a modern iOS 26 / Apple Liquid Glass-inspired experience, but not a literal proprietary pixel clone.
- User expects the assistant to inspect the repo and fix things directly.

======================================================================
1. PRODUCT / APP OVERVIEW
======================================================================

Cookie is a React/Vite/TypeScript AI assistant.

Important user-facing areas:
- Normal Cookie AI chat
- Sidebar/navigation
- GPTs
- Tools
- Work
- Voice
- Code Studio
- Settings
- Auth / email verification / password reset
- Share links
- File analysis / web tools / research where already supported

The user wants the app to feel polished, professional, mobile-first, and close in interaction quality to modern ChatGPT/iOS UI.

Do NOT turn every UI element into a glass card.
Apple's Liquid Glass guidance says it belongs primarily to the navigation/control functional layer, not the content layer, and glass-on-glass should be avoided.

Official Apple reference:
https://developer.apple.com/videos/play/wwdc2025/219/
Apple's WWDC25 Liquid Glass principles:
- Liquid Glass is dynamic, not just blur.
- It uses lensing/refraction/light response and responsive motion.
- Controls/navigation form a functional layer above content.
- Avoid glass in the content layer and avoid glass-on-glass.
- Use tint selectively for primary actions.
- Menus/sheets should feel connected to their source.
- Sidebars/navigation float above content.
- Legibility and adaptive contrast matter.
- Reduced motion/transparency/accessibility must be respected.

======================================================================
2. CURRENT USER REQUIREMENTS / UI RULES
======================================================================

These are high priority:

A. LIQUID GLASS
- User explicitly wants real Liquid Glass-like behavior, not just CSS blur.
- We investigated the open-source package Meapri/liquid-glass-web.
- We started vendoring its engine source into Cookie.
- Integration was NOT finished when this handoff was created.
- Continue that work rather than replacing it with another fake blur implementation.
- The user said the previous UI did not look like Liquid Glass and wanted the actual engine integrated.
- Keep glass primarily on:
  - top navigation
  - sidebar
  - menus/popovers
  - composer/control layer
  - GPT navigation/control layer
  - Work input/control layer
- Do NOT glass message bubbles/content unnecessarily.
- Avoid stacking multiple translucent cards over each other.

B. MOBILE
- User's primary testing device is iPhone Safari.
- Previous mobile screenshots showed:
  1. composer squeezed into a narrow vertical strip
  2. missing/hidden topbar
  3. huge composer height after pressing Enter and clearing text
  4. overlapping chat-row menus
  5. sidebar too flat/opaque
  6. menus too transparent and conversation text bleeding through
- Mobile layout must be tested carefully.
- Composer must return to normal 52px-ish height after sending/clearing text.
- Only one contextual chat-row menu can be open at a time.
- Outside tap should close a row menu.
- Sidebar should be a floating/inset functional layer, not a huge flat rectangle.
- Top-left mobile navigation button must remain accessible.
- Do not let Safari bottom browser chrome cause the composer/disclaimer to overlap badly.

C. WORK PAGE
- User explicitly rejected cards that paste scripted prompts into the chat input.
- Work page was changed from two canned buttons to one real input.
- The Work page should ask what the user is working on and submit the user's own text.
- No template cards.
- No canned prompt buttons for simple/mid tasks.
- If the task is normal/simple, do not force an extra Work button at all.
- The current WorkPage is input-first, but it still routes submitted text into normal chat. Preserve that unless a real Work execution system is intentionally built.

D. GPTs
- GPTs should be a real separate experience/page, not prompt cards.
- User asked for a ChatGPT-like GPT experience and fresh GPT chat page.
- Do not use OpenAI API just to simulate GPTs.
- GPT features should use Cookie's existing model pipeline unless a specific external model is explicitly requested.
- No GPT-5.1 branding if it implies an external paid API.
- Current GPT definitions include:
  - Study Coach (free)
  - Code Expert (pro)
  - Writing Partner (free)
  - Research Analyst (pro)
  - Data Analyst (pro)
  - Creative Studio (max)
- Current GPT UI was rebuilt after user complained about messy layout.
- Do not reintroduce giant cards, scripted prompts, or fake decorative animations.

E. TOOLS
Current intended tools:
- Calculator (free)
- File analysis (free)
- Data analysis (pro)
- Read a URL (pro)
- Code analysis (pro)
- Deep research (max)
- Existing web search should not be duplicated as another redundant tool.
- Image generation was explicitly removed because it required an OpenAI API / paid API.
- Do not add paid model APIs.

F. VOICE
- User disliked the generic blue "AI orb" voice UI.
- Voice should not look like a random AI-generated glowing ball.
- Latest work started changing it toward waveform/rings and Apple-like responsive interaction.
- Continue improving only if needed; do not prioritize over broken core layout.

G. STANDALONE CODE STUDIO
- Code Studio should be a standalone surface with no Cookie AI sidebar/UI around it.
- It has a "Back to Cookie AI" button.
- App renders CodeStudioPage separately when view === "code".
- Code Studio title becomes "Cookie Code Studio".
- Keep protected internals hidden from normal users.

======================================================================
3. AUTH SYSTEM
======================================================================

Desired auth:
1. Sign up with name + email + password
2. Nodemailer sends a 6-digit verification code
3. Enter code and become verified
4. Log in with email/password
5. Forgot password via secure email reset link

No Google OAuth requirement.

Production users schema is already correct. DO NOT modify it casually:
- id
- name
- email
- password_hash
- password_salt
- email_verified
- plan
- created_at
- updated_at
- username
- avatar_url
- credits_remaining
- login_failures
- locked_until

Important auth commits:
- 59d63831324963eba8acb6b8627a404fb7c6fe4c — simplified auth to email verification
- 37e1b30515c93bdd8b6d0e96b5baa3de3137e6bd — Code Studio TS build fix / removed old Google OAuth redirect
- 3512e7863b91abbc870ef8b6830a37067570715a — PBKDF2 iterations lowered to 100000
- e540c9edb5c93286da6431bf558721e689e18e54 — cookie bug fix
- 55840d1906bcf53d3fd0956a73192220d595ade1 and 72da9afc44a27f05af3278160799d460b2edf1a2 — auth import fixes
- 1584f05c9ab829be5e8bb6eaaf320ebd0fa836d1 — legacy email_tokens type handling
- 833db8d... / e8f8c2e9... — replaced Worker-incompatible Gmail SMTP path with cloudflare:sockets SMTP client
- 81ea0b31ff73d137e2c2cfb238bf5a7f697d18fc — create sessions table
- 4937a063a84aa997c057cbcec1ff738e9fc8bbf2 — repair legacy sessions schemas
- a5af2fa47480ec85787c2aa006807064ffca6e56 — forgot-password secure reset link syntax

Email delivery was verified as working.
A prior issue showed verification email succeeded but session creation failed; sessions were then hardened.

Migrations:
- migrations/0001_auth_workspace.sql
- migrations/0006_email_tokens_schema.sql
Do NOT run migrations/0005_users_email.sql because production already has users.email.

======================================================================
4. CODE STUDIO
======================================================================

Backend:
functions/api/codebase.js

Frontend:
src/CodeStudioPage.tsx
src/styles.css

Code Studio functionality:
- Auth/access control
- Owner: cookie.ai.noreply@gmail.com
- Developer: illu.dev.official@gmail.com
- Repository: premiummaster156-cmd/cookie
- Branch: main
- Workspace sync
- File CRUD / rename / duplicate / delete
- Revisions
- Diff
- Deterministic safety checks
- AI review with OLLAMA fallback models
- Fail-closed AI review
- Review persistence
- GitHub tree -> commit -> branch update
- GITHUB_TOKEN required for commits
- Auto-review
- Auto-review-and-commit
- Owner settings: auto_review, auto_commit
- Member management
- Deployment status
- Audit log
- Undo developer changes
- Auto-undo when AI review blocks a change

Cloudflare free-tier subrequest problem was fixed by lazy-loading GitHub file content:
- Initial seed gets GitHub tree metadata in one request.
- D1 batch inserts metadata.
- File contents load only when opened.
- Dirty/new/deleted files are candidates for review/diff/commit.
- Avoid one GitHub request per file during initial seed.

Important commits:
- e48d0eac13aaf0ef5172c1e68959041377627d32 — eliminate free-tier subrequest overflow
- faa79ea73c0f6d366cdf8e13f9b6dcd8357bc657 — dirty-file migration
- bc9355ac12cd50181d59ffb5f9c47b735df20d76 — diff only dirty workspace files
- 5b25c2128050c31d70ca37fb5d6903029cb9da70 — reconcile full repo tree and review limits
- a35f1b1101ce7d7a53737d689ffba3302bd042da — AI review JSON parsing hardening
- f1472c03ee5e9e9af2ed90e551a72dd829fce03e9 — syntax tokenization
- 4b0cf0ed061d4a88c5a5d97759bc4f641a20f187 — syntax-highlighted editor
- d5f0a1923501178b71af8638294635b50a0dcba0 — preserve CSS selectors
- 2d0eb87ae5eeaeaaa287d92ea3c6a0511cbc1cff — build-dist assets
- 1eecea40e5a6284dcd4f4bffc11d23bdb75710c1 — D1 binding count fix
- 3e913599b549e91cf076bbcc6d14b9030ec05a6f — lazy content hydration
- c9ecee98d8d986cf1448fc663484a82c58b7901d — prefer GitHub Contents API with raw fallback
- 27f2b41076dfdb8ab8987485688727bdb9918246 — editor stacking/highlight fix
- 282bf6bd68b4d131d1571993db9fd8571733b4e4 — standalone Code Studio / Back to Cookie AI
- 0656fec16e45546aa40d72ab393a5fef86dba149 — standalone Code Studio render in App
- bd0e924490c2c1b56ad266f19992e69505518e15 — Code Studio back-button styling

Protected/hide behavior:
- Hidden: .env, .env.*, .dev.vars*, all .md files, protected internals
- Protected:
  - functions/api/codebase.js
  - src/CodeStudioPage.tsx
  - src/App.tsx
  - src/main.tsx
  - src/styles.css
  - migrations/0007_code_studio_reviews.sql
  - .github/workflows/code-studio-checks.yml
  - .github/workflows/build-dist.yml
- codebase_audit tracks edits/deletes/renames.
- Owner can undo developer changes.
- Developer can undo own changes.
- Code Studio UI includes "Undo last change".
- AI review can auto-undo blocked changes.

Important current behavior:
- Code Studio intentionally hides all .md files.
- Handoff files are therefore not visible in Code Studio explorer, but they exist in GitHub.

======================================================================
5. SHARE LINKS
======================================================================

Old share system put the whole chat JSON into a base64 URL, making huge Discord-unfriendly links.

New design:
- Save share snapshot in D1
- Generate random 32-character hex ID
- URL contains only ID
- Recipient fetches snapshot from D1

Backend:
functions/api/chats.js
- POST /api/chats?share=1
- GET /api/chats?share=<id>

D1:
shared_chats:
- id
- user_id
- title
- payload
- created_at

Limits:
- MAX_SHARE_MESSAGES = 200
- MAX_SHARE_PAYLOAD = 3,000,000

Commit:
16a0757ead5108293c6989f5b28f7dbe43328a66

Frontend:
- PublicShareView
- share() posts snapshot and uses native share if available, otherwise clipboard/prompt
- public share fetch before auth
- URL is /#share=<id>

Frontend commit:
6defbd844f82a991a33c84d19c54e16bbcbb72dc
CSS:
4907272e68962e3827ab5518b19d7465eda2e67f

Discord message limits were the motivation; do not regress to embedding the full chat in URL.

======================================================================
6. GPTs / TOOLS HISTORY
======================================================================

Original user request:
- Remove cards that simply paste scripted text into input.
- GPTs should be a new page and GPT chat should feel like a modern ChatGPT-like experience.
- Tools should contain professional utilities and plan-gated tools.
- Liquid Glass should be applied throughout the functional UI.

Initial GPT implementation incorrectly attempted external GPT-5.1 API.
This was explicitly rejected because user wants free-only / no paid OpenAI API.

Fixed:
- 370227dfe748bec987031ee4cef60079b9116168 — removed OpenAI API call from GPT branch; GPT profile only modifies Cookie model pipeline
- f758333a85aa99507f7374108547cfa75fe26c88 — removed GPT-5.1 branding
- ba1fcf0c0c0a0b93a9829d69a0b14d7be40e2750 — removed image generation frontend/dependency
- 10a1d57665bef3eb8c8fd67f29766e17642ffb8f — removed image generation backend branch

GPT UI rebuild:
- 6e7539034559ea7dca3d0fed766d13f45222a7ad — rebuilt GPTsPage/GPTChatPage
- 41bf50f9862587fa6257229f8fe309c78b867dcb — GPT/Liquid Glass CSS pass
- 210839cf9499bc7859ce27aec3686ed10c311287 — fixed TS error from undefined tool entry

Do not reintroduce image generation unless the user explicitly requests an external paid API.

======================================================================
7. RECENT CHAT / MOBILE UI FIXES
======================================================================

Problem: Mobile composer was squeezed into a vertical strip.
A hotfix was made:
- 8f5e3f43eb51a381da76c51d5459a585101992a0

It forced:
- html/body/#root width 100vw
- cookie-app width 100vw
- main-shell width 100%
- chat-layer/chat-view/chat-scroll width 100%
- composer left/right positioning
- composer flex nowrap

A dedicated src/mobile-shell.css was created:
- fff1a1b5e43baba2e873f037c19aae8584c35d6a
BUT IT WAS NOT IMPORTED.
Do not assume it is active.

Temporary mobile launcher:
- bb275667f3049305b8d118167e892c384ad716c2
- 4b65994a98ed079cc6b6df848a4a0f3a8904131f
- 983a20c0ca4b38a706c4a40074691380d2304700
Latest CSS optimization hides the temporary .mobile-nav-launcher.

Latest composer/menu/work fixes:
Frontend:
- f423f1ad043d0c87ee2bd0cb4af29da602145b4a
  - ChatRow closes other row menus when one opens
  - outside click closes row menu
  - composer resizeInput reset-to-52px before measuring
  - submit resets input height
  - Work page now input-first
CSS:
- 9dfe41d5e4dcc18b8351caefa339608d67e016e1
  - composer textarea fixed min/initial height
  - no transform on composer focus
  - Work input-first styling
  - row menu styling

IMPORTANT BUILD STATUS AT TIME OF WRITING:
- Build for f423f1... was observed as in_progress.
- Build for 9dfe41... was observed as queued.
- Do NOT claim they succeeded unless checked now.
- A previous commit 18e6595420d7467421ee1f692f80309218df0bfd had a successful frontend build.

Current main HEAD later moved to a GitHub Actions generated asset commit:
c934f4eaf96947af0b8592518dd0b0fa3c6521e6
Its parent was 1351230f45396cb3cfa54db7d5d57427a21a8ee8.
Always inspect current main before editing.

======================================================================
8. CLOUDFLARE DEPLOYMENT BUG THAT WAS FIXED
======================================================================

A Cloudflare Pages deployment failed even though Vite build succeeded.

Exact error:
Uncaught SyntaxError: Invalid regular expression:
/^[0-9+\\-*/%().\\s*]+$/:
Range out of order in character class

Cause: calculator regex in functions/api/chat.js.

Fixed:
if(!/^[0-9+*/%().\\s-]+$/.test(normalized)) ...

Commit:
2e9dbc63999c2b7e4e61293c08f39cf36d401a80
New chat.js SHA:
13e673b4fc43ea180e97622f1d56ab5b338bec78

IMPORTANT:
At that time the fetched chat.js still appeared to contain obsolete image-generation imports/branches despite earlier image-generation removal claims:
- import { generateImage } from "./_images.js";
- imageTools
- env.OPENAI_API_KEY ? imageTools : []
- image_generate handling
If this is still present in current main, inspect and remove it because user wants free-only and image generation was explicitly removed.
Do NOT assume old state is current.

======================================================================
9. PACKAGE / BUILD STATE
======================================================================

Current package.json observed before this handoff:
{
  "name": "cookie",
  "private": true,
  "version": "3.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@monaco-editor/react": "^4.7.0",
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "framer-motion": "latest",
    "lucide-react": "latest",
    "react": "latest",
    "react-dom": "latest",
    "perfect-scrollbar": "latest",
    "three": "latest",
    "animate.css": "^4.1.1",
    "nodemailer": "^10.0.13"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "latest",
    "typescript": "latest",
    "vite": "latest",
    "@types/three": "latest"
  }
}

Monaco dependency was added:
8046045e02c0185e5e27b58402e6948fdbaefcbf

Monaco migration was NOT completed.
Only the dependency was added.
Do not tell the user Monaco is fully integrated.

A prior TypeScript error caused by view narrowing:
- b4cce46000af28a6d64ea15ffd88fe953f6d2d99
- fixed checks by using String(view) === "code"

======================================================================
10. LIQUID GLASS ENGINE INTEGRATION — CURRENT INCOMPLETE WORK
======================================================================

This is the NEXT MAJOR TASK.

User said "Ok go" to integrating a real Liquid Glass engine.

We inspected open-source repository:
Meapri/liquid-glass-web
Latest library commit observed:
1613f8311dbc31bc2331afcfe51a143c56dd6308
Package:
liquid-glass-web
Version:
0.1.0

Exports:
- LiquidGlass
- LiquidInteractive
- autoEnhance
- LiquidMenu
- LiquidSheet
- LiquidSelection
- clearMapCache
- resolveLiquidGlassAutoProfile

Library description:
"Apple iOS 26 Liquid Glass engine for the web. GPU + Chromium native."

Important: do NOT simply say "Apple's official web engine." It is an open-source third-party implementation inspired by Liquid Glass.

Library core files:
- src/core/LiquidGlass.ts
- src/core/Interactive.ts
- src/core/enhance.ts
- src/core/AutoProfile.ts
- src/core/DeviceProfile.ts
- src/core/BuildQueue.ts
- src/core/CanvasEncode.ts
- src/core/SurfaceField.ts
- src/core/MapRaster.ts
- src/core/MapWorker.ts
- src/core/MapWorkerClient.ts
- src/core/FilterChain.ts
- src/core/DisplacementMap.ts
- src/core/SpecularMap.ts
- src/core/MapCache.ts
- src/core/ObserverRegistry.ts
- src/core/PointerField.ts
- src/core/WebGLRefractor.ts
- src/core/types.ts

Library CSS:
src/styles/liquid-glass.css

Engine defaults seen in LiquidGlass.ts:
- radius 22
- thickness 44
- refraction 46
- chromaticAberration 0.03
- blur 7
- saturation 150
- variant "regular"
- profile "auto"

Engine claims:
- GPU accelerated Chromium refraction
- one backdrop-filter per element
- one SVG filter per element
- no WebGL contexts by default
- lazy initialization
- suspend/resume
- CSS fallback
- mobile/Android profile support

VERY IMPORTANT:
User is on iPhone Safari.
Before promising the engine works there, inspect WebGLRefractor / feature detection / fallback behavior.
The library name/description emphasizes Chromium, so Safari support must be verified from source.
If it gracefully falls back to CSS, preserve that fallback.

Vendoring started:
Created orphan Git blobs for these source files:
- types.ts -> 7e542fdd712e198a041613745fd43c31c96fb762
- AutoProfile.ts -> 34a976261078737cfeb97aca2ccccfb140df8c7f
- DeviceProfile.ts -> 02f512fc47d8a97952aadea7cc64f1a2d71d224d
- BuildQueue.ts -> f81876b9e916fbee1fd0c424e6c700b4904a1d6e
- CanvasEncode.ts -> ccd190d241044ea5bc6e88252f80d31ec455a8e1
- SurfaceField.ts -> 0a216f9c41e0924194a912ebe64b03137d67bc51
- MapRaster.ts -> 91da1c368993ae130d12dca2fac5ec8bc2fcf024
- MapWorker.ts -> 9d77cbdf5b0931e119526055b39fbd648f3abf96
- MapWorkerClient.ts -> 11c39995bd52b46ee125cbbbad7c2f55fd78546b

A tool call also attempted to create blobs for:
- FilterChain.ts
- DisplacementMap.ts
- SpecularMap.ts
- MapCache.ts
- ObserverRegistry.ts
- PointerField.ts
- WebGLRefractor.ts
- LiquidGlass.ts
- Interactive.ts
- enhance.ts
The output was cut off. CHECK whether these blobs exist before creating duplicates.

NO vendored Liquid Glass files have been committed to main yet.
This is critical.

Recommended target directory:
src/vendor/liquid-glass/
  core/
    types.ts
    AutoProfile.ts
    DeviceProfile.ts
    BuildQueue.ts
    CanvasEncode.ts
    SurfaceField.ts
    MapRaster.ts
    MapWorker.ts
    MapWorkerClient.ts
    FilterChain.ts
    DisplacementMap.ts
    SpecularMap.ts
    MapCache.ts
    ObserverRegistry.ts
    PointerField.ts
    WebGLRefractor.ts
    LiquidGlass.ts
    Interactive.ts
    enhance.ts
  styles/
    liquid-glass.css
  index.ts

Preserve relative imports from the original library so Vite can resolve them.

Need inspect worker implementation:
- MapWorkerClient.ts may use new Worker(new URL("./MapWorker.ts", import.meta.url)).
- Ensure Vite supports this path.
- Ensure Safari does not break on unsupported APIs.
- Inspect all imports and asset assumptions before committing.

Potential React integration:
Do NOT blindly call autoEnhance() on every render.
autoEnhance() creates its own registry/instances and repeated calls may duplicate work.

Better:
- Create a persistent React hook/provider or helper that:
  - tracks LiquidGlass instances in a Map<HTMLElement, LiquidGlass>
  - tracks LiquidInteractive instances similarly
  - observes DOM changes if needed
  - destroys instances on unmount
- Or use explicit React ref wrappers for dynamic surfaces.
- Fixed/dynamic elements needing the material:
  - topbar
  - sidebar
  - menus/popovers
  - composer
  - GPT navigation/control layer
  - Work input
- Keep messages/content un-glassed.

Could create:
src/vendor/liquid-glass/react.ts
with a helper hook such as useLiquidGlassRoot or useLiquidGlassElement.
But avoid unnecessary complexity if a robust direct hook is enough.

Need include the library CSS:
- Prefer a dedicated import from a new source file if possible.
- If updating main.tsx is blocked by safety, update the CSS entry in a safe way after fetching latest SHA.
- main.tsx currently:
  import React from "react";
  import ReactDOM from "react-dom/client";
  import App from "./App";
  import "animate.css";
  import "./styles.css";
  ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);

If adding a dedicated CSS import, update main.tsx only after fetching its current SHA.
Alternative: import CSS from App.tsx, but keep imports clean.

Need mark elements with data-liquid-glass / .lg-interactive.
Existing App already has some data-liquid-glass usage, e.g. composer:
<div className="composer" data-liquid-glass="composer">
This may be enough to hook if autoEnhance is configured, but verify actual library selectors and profile behavior.

Need remove/override old fake Liquid Glass CSS after real engine works.
Existing styles.css contains large previous glass passes:
- CSS vars --lg-surface etc.
- pseudo-element optical rim/specular
- backdrop-filter rules
- many !important rules
- mobile glass overrides
- menu glass backgrounds
- voice overlay effects
These can conflict with the engine.
Do NOT leave CSS fighting inline engine styles.
Audit styles.css for:
- .topbar
- .sidebar
- .composer
- .attach-menu
- .tools-menu
- .model-menu
- .row-menu
- .gpts-nav
- .gpt-chat-shell
- [data-liquid-glass]
- .liquid-glass
- .lg-interactive
and remove/neutralize only the conflicting fake material properties while preserving layout.

The user's complaint was that the previous UI looked like fake blur and not Liquid Glass.
Real engine should be responsible for material optical properties; normal CSS should handle layout only.

======================================================================
11. CURRENT APP CODE DETAILS
======================================================================

src/App.tsx currently contains:

ChatRow:
- local open state
- ref
- document pointerdown outside-click close
- window event "cookie:close-chat-menus"
- only one row menu should remain open

Composer:
- textRef
- resizeInput callback:
  t.style.height = "52px"
  next = min(220, max(52, scrollHeight))
  t.style.height = next + "px"
- resize runs when value changes
- onChange schedules resizeInput
- submit resets textarea height to 52px before onSend()
- textarea is rows=1
- Enter sends when sendOnEnter and Shift is not held
- send button uses submit
This was specifically added because the user complained the composer stayed huge after sending.

Potential follow-up issue:
If the browser or CSS forces a min-height or flex stretch elsewhere, verify the actual computed style. Do not keep increasing CSS hacks. Use browser verification if available.

WorkPage:
- one textarea
- one send arrow
- no canned buttons
- placeholder "Describe the work…"
- hint "No templates. No scripted prompts. Just describe what you need."
- on submit it calls onStart(userText)
- parent currently sets view chat and puts the text into the normal chat composer
This is acceptable for now.

======================================================================
12. CURRENT STYLES / RECENT UI PASSES
======================================================================

Large Liquid Glass CSS pass:
460e9978f52739e43585459d841258f7844af3d5

It introduced:
- --lg-surface
- --lg-border
- --lg-highlight
- unified translucent material
- optical rim
- desktop floating sidebar
- navigation controls
- selected nav depth
- composer material
- menu material
- mobile trigger
- scroll-edge effect
- reduced-motion/transparency fallbacks

Final interaction correction:
9dfe41d5e4dcc18b8351caefa339608d67e016e1
- composer input reset/height
- Work input-first styling
- row-menu styling

A newer interaction-first Liquid Glass pass was also made around commit 18e6595420d7467421ee1f692f80309218df0bfd:
- controls mostly transparent at rest
- touch/radial light responses
- sidebar ambient motion
- popover scale/blur/opacity
- composer sheen
- voice waveform/rings instead of blue orb
- selective send-button tint
- reduced motion
This build was reported successful.
BUT user still said the UI did not feel like real Liquid Glass.
Therefore the next step is the actual engine integration, not another giant CSS pass.

======================================================================
13. IMAGE / SCREENSHOT FEEDBACK
======================================================================

Latest user screenshots:
IMG_2305.png:
- old Cookie voice UI with large blue generic orb
IMG_2306.png:
- light UI reference with hamburger, top controls, large blue orb, bottom composer
IMG_2307.png:
- ChatGPT-style mobile sidebar reference
IMG_2308.png:
- light ChatGPT-like composer reference
IMG_2309.png:
- Cookie dark baseline chat
IMG_2310.png:
- Cookie tools menu; too transparent, text behind it
IMG_2311.png:
- Cookie attach menu; same issue
IMG_2312.png:
- Cookie chat; composer/disclaimer overlap near Safari bottom
IMG_2313.png:
- Cookie sidebar; too flat/dark and too wide

More recent screenshots:
- huge composer after Enter/clear
- overlapping row menus
- Work page still looked like bad card UI
Those were addressed in commits f423f1... and 9dfe41...

The user expects:
- clean hierarchy
- no overlapping popovers
- no giant stuck composer
- no content bleed through menus
- actual optical depth/lensing rather than simple blur
- proper floating sidebar
- input-first Work
- no canned prompt buttons

======================================================================
14. DEPLOYMENT / CI
======================================================================

Workflows:
- .github/workflows/code-studio-checks.yml
- .github/workflows/build-dist.yml

Important fixes:
- 09f548197523b690445495c00946e68a77056946 — cache lockfile issue
- 1adc78dacd49204519eaaeafa26bf043f79a4bde — build-dist push race
- 1d3bb709d5fcccf1781ebb4e1dfc0b1dc1ef1f9f — codebase.js literal \\n syntax error
- a6c64a5937012672d84f7b1829facecaf211a9a8 — safe auto-commit response parsing

Cloudflare Pages build:
- npm install
- npm run build = tsc && vite build
- Functions then compile/publish

Wrangler warning:
Current wrangler.toml lacks pages_build_output_dir and Cloudflare has warned about it.
Do not modify blindly; inspect current config and deployment behavior first.

Free-tier Cloudflare constraints that motivated architecture:
- Workers Free external subrequest limit ~50 per invocation
- D1 Free query/statement limits are much lower than paid
Do not solve problems by telling user to upgrade. Optimize requests/batches.

======================================================================
15. IMPORTANT CURRENT GITHUB STATE
======================================================================

Current main HEAD observed:
c934f4eaf96947af0b8592518dd0b0fa3c6521e6

This was a GitHub Actions "Build frontend assets" commit.
Do not assume it contains exactly the same source state as the source commit before it; fetch files.

Current package.json SHA:
300f6d7ec2ce4604ab6c2232027fffe751ace2d3

Known recent source SHAs before generated asset commit:
- src/App.tsx:
  9e5599d7db0854b5640197aa165a8275cf5ccc7f
- src/styles.css:
  6bff7481ddf4e3d4ff0b5b3cc868415e47bc749d
- src/main.tsx:
  b9ced7f68c08ed9fea5b8ce22e45c81f0d8eaa69
These MUST be refetched from current main before edits.

======================================================================
16. EXACT NEXT STEPS FOR NEW CHAT
======================================================================

STEP 1 — READ CURRENT STATE
- Fetch current main HEAD.
- Fetch current:
  - package.json
  - src/App.tsx
  - src/styles.css
  - src/main.tsx
  - tsconfig.json
  - functions/api/chat.js
  - index.html
- Check current GitHub Actions for latest source/build/deploy.
- Do not rely solely on this handoff for exact current content.

STEP 2 — FINISH LIQUID GLASS ENGINE VENDORING
- Check whether the remaining 10 Git blobs already exist.
- Fetch missing blobs from Meapri/liquid-glass-web commit:
  1613f8311dbc31bc2331afcfe51a143c56dd6308
- Vendor all required engine files under src/vendor/liquid-glass/.
- Preserve relative imports.
- Include styles/liquid-glass.css.
- Add index.ts exports.
- Do not commit until the full dependency graph is present.

STEP 3 — INSPECT SAFARI SUPPORT
- Read WebGLRefractor.ts, DeviceProfile.ts, LiquidGlass.ts, Interactive.ts.
- Verify what happens on iOS Safari.
- Verify fallback behavior.
- Do not claim Safari works unless source supports it.
- If WebGL/refraction is unavailable, make the CSS fallback elegant and still responsive.

STEP 4 — INTEGRATE INTO REACT
- Add a persistent integration layer.
- Do not call autoEnhance repeatedly without preserving instances.
- Use a React hook/helper or explicit refs.
- Ensure dynamic menus/sidebar/GPT routes are initialized and destroyed correctly.
- Add Liquid Glass attributes to functional-layer elements only.

STEP 5 — REMOVE CONFLICTING FAKE GLASS
- Audit styles.css.
- Keep layout, spacing, responsive, typography.
- Remove/neutralize fake material CSS that fights the engine.
- Especially avoid CSS !important background/backdrop-filter rules overriding engine styles.
- Do not make message/content areas glass.

STEP 6 — FIX MENU HIERARCHY
- Tools/attach/model/row menus should have readable separation.
- No content text should bleed through so strongly that labels become unreadable.
- Popovers should visually originate from their control.
- Only one row menu open at a time.
- Use engine's material and interaction behavior rather than arbitrary giant cards.

STEP 7 — FIX MOBILE COMPOSER
- Verify after:
  - typing long text
  - pressing Enter
  - sending
  - clearing text
  - focus/blur
  - keyboard opening/closing
  - rotation / narrow width
- Composer should return to compact height after send.
- Respect safe-area bottom.
- Keep disclaimer readable and out of Safari browser chrome.
- Do not solve by arbitrary fixed huge heights.

STEP 8 — VERIFY WORK
- Work page must stay input-first.
- No scripted prompt cards.
- User's own text goes into chat.
- No extra buttons for ordinary tasks.

STEP 9 — VERIFY GPTs
- No external paid model.
- No GPT-5.1 branding.
- No canned prompt insertion.
- GPT pages should be clean and responsive.
- Use Liquid Glass only in navigation/control layer.

STEP 10 — VERIFY FREE-ONLY
Search current code for:
- api.openai.com
- OPENAI_API_KEY
- image_generate
- generateImage
- GPT-5.1
If found, inspect whether it is obsolete. Remove if it violates the user's free-only requirements.
Do not remove legitimate unrelated code without checking context.

STEP 11 — BUILD
- Run/check GitHub Actions after source commit.
- If TypeScript fails, fix actual source issue.
- If Cloudflare Function syntax/publish fails, inspect exact error.
- Never say "done" until build/deploy evidence is available.

STEP 12 — BROWSER VERIFY
If Vercel/agent-browser or another browser tool is available:
- Open production
- Test desktop
- Test mobile viewport
- Test:
  - sidebar open/close
  - row menu one-at-a-time
  - tools menu
  - attach menu
  - composer send/resize
  - Work
  - GPTs
  - Code Studio
  - voice
- Look for console errors.
- Take screenshots if possible.

STEP 13 — REPORT TO USER
Keep it short:
- what was actually completed
- commit(s)
- build/deploy result
- remaining issue, if any
Do not dump huge explanations.

======================================================================
17. DO NOT DO THESE THINGS
======================================================================

- Do not create fake "AI context" files just to make code look AI-generated unless user explicitly asks again.
- Do not add meaningless .md clutter. This handoff is intentional.
- Do not expose .env or secrets.
- Do not weaken Code Studio protection.
- Do not make Code Studio able to casually modify protected internals.
- Do not add paid APIs.
- Do not add canned prompt cards for Work.
- Do not make every UI surface a glass card.
- Do not add random glowing blobs/orbs.
- Do not claim Liquid Glass is implemented when it is only CSS blur.
- Do not claim production deployment success without evidence.
- Do not use old file SHAs in GitHub update_file calls.
- Do not overwrite a file without fetching the latest version first.
- Do not modify production users schema casually.
- Do not run migration 0005_users_email.sql.
- Do not reintroduce full-chat base64 share URLs.
- Do not make the user upgrade to paid Cloudflare just to solve free-tier request inefficiency.

======================================================================
18. QUICK COMMIT INDEX
======================================================================

Auth:
59d63831324963eba8acb6b8627a404fb7c6fe4c
37e1b30515c93bdd8b6d0e96b5baa3de3137e6bd
3512e7863b91abbc870ef8b6830a37067570715a
e540c9edb5c93286da6431bf558721e689e18e54
1584f05c9ab829be5e8bb6eaaf320ebd0fa836d1
81ea0b31ff73d137e2c2cfb238bf5a7f697d18fc
4937a063a84aa997c057cbcec1ff738e9fc8bbf2

Code Studio:
e48d0eac13aaf0ef5172c1e68959041377627d32
faa79ea73c0f6d366cdf8e13f9b6dcd8357bc657
bc9355ac12cd50181d59ffb5f9c47b735df20d76
5b25c2128050c31d70ca37fb5d6903029cb9da70
a35f1b1101ce7d7a53737d689ffba3302bd042da
f1472c03ee5e9e9af2ed90e551a72dd829fce03e9
4b0cf0ed061d4a88c5a5d97759bc4f641a20f187
d5f0a1923501178b71af8638294635b50a0dcba0
1eecea40e5a6284dcd4f4bffc11d23bdb75710c1
3e913599b549e91cf076bbcc6d14b9030ec05a6f
c9ecee98d8d986cf1448fc663484a82c58b7901d
27f2b41076dfdb8ab8987485688727bdb9918246
282bf6bd68b4d131d1571993db9fd8571733b4e4
0656fec16e45546aa40d72ab393a5fef86dba149
bd0e924490c2c1b56ad266f19992e69505518e15

Share:
16a0757ead5108293c6989f5b28f7dbe43328a66
6defbd844f82a991a33c84d19c54e16bbcbb72dc
4907272e68962e3827ab5518b19d7465eda2e67f

GPTs/tools:
370227dfe748bec987031ee4cef60079b9116168
f758333a85aa99507f7374108547cfa75fe26c88
ba1fcf0c0c0a0b93a9829d69a0b14d7be40e2750
10a1d57665bef3eb8c8fd67f29766e17642ffb8f
6e7539034559ea7dca3d0fed766d13f45222a7ad
41bf50f9862587fa6257229f8fe309c78b867dcb
210839cf9499bc7859ce27aec3686ed10c311287

Mobile/UI:
8f5e3f43eb51a381da76c51d5459a585101992a0
fff1a1b5e43baba2e873f037c19aae8584c35d6a
bb275667f3049305b8d118167e892c384ad716c2
4b65994a98ed079cc6b6df848a4a0f3a8904131f
983a20c0ca4b38a706c4a40074691380d2304700
f423f1ad043d0c87ee2bd0cb4af29da602145b4a
9dfe41d5e4dcc18b8351caefa339608d67e016e1
18e6595420d7467421ee1f692f80309218df0bfd

Deployment:
2e9dbc63999c2b7e4e61293c08f39cf36d401a80

Monaco:
8046045e02c0185e5e27b58402e6948fdbaefcbf
b4cce46000af28a6d64ea15ffd88fe953f6d2d99

======================================================================
19. HANDOFF MESSAGE FOR THE NEXT CHAT
======================================================================

Start the new conversation by reading this file and then say:

"I've loaded the Cookie handoff. I will first inspect the current main HEAD and the latest source/build state, then continue the unfinished Liquid Glass engine integration. I will not assume old SHAs are current, and I will not claim deployment success without verification."

Then immediately continue with the NEXT STEPS section.

The most important unfinished task is:
FINISH REAL LIQUID GLASS ENGINE INTEGRATION + VERIFY SAFARI + REMOVE CONFLICTING FAKE GLASS CSS + BUILD + BROWSER TEST.

Do not stop at an explanation.
