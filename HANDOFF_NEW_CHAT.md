# COOKIE AI — MASTER HANDOFF / NEW CHAT CONTINUATION

Updated: 2026-10-05
Repository: premiummaster156-cmd/cookie
Branch: main
Latest main HEAD verified before this handoff: 375dbc0c55038b6e6889bfa31891693bb6e06225
Production: https://cookie-8bi.pages.dev

## READ THIS FIRST

This is the ONLY handoff file. There are no other handoff files currently in the repository.

User wants direct implementation, not long explanations. Always fetch the latest file and SHA before editing. Never claim a build/deployment succeeded without checking CI/deployment evidence.

Technical work is normally in English.

FREE-ONLY RULE:
- Do not add paid OpenAI/Anthropic/etc APIs or paid dependencies unless the user explicitly asks.
- Do not expose secrets.
- Do not invent functionality or fake terminal output.
- Do not silently introduce D1 where the core application is Neon-backed.

## PERMANENT “UPGRADING TIME” RULE

Whenever the user says “upgrading time”, interpret it as a new Cookie AI product release.

Every upgrade must:
1. Add at least 2 meaningful new features or substantial improvements.
2. Do deep current research into the newest AI/product/UI capabilities before choosing upgrades when research is relevant.
3. Include backend/system improvements AND UI/UX/interaction improvements when appropriate.
4. Study current leading AI products and catch up to useful modern capabilities.
5. Keep every subsystem isolated so new work does not break existing work.
6. Keep one coherent Cookie design system.
7. Support desktop, laptop/tablet, Android, iPhone/iPad, and major browsers. Do not optimize only for iPhone.
8. Explore genuinely useful 3D/spatial UI opportunities. Do not add fake decorative 3D.
9. Test/build affected systems before calling the upgrade complete.
10. Never fake an AI capability, tool execution, terminal result, review result, or deployment.
11. Preserve exact Cookie branding/artwork.
12. Prefer real reusable infrastructure over duplicate one-off systems.

The user recently asked for deep research for 20 minutes and actions/upgrades in 15 minutes. Time estimates should never be fabricated; perform as much research/action as tools allow and report what was actually verified.

## PRODUCT DIRECTION

Cookie is a React + Vite + TypeScript AI assistant with:
- Chat
- Work
- Search
- Library
- Projects
- GPTs
- Voice
- Code Studio
- Settings
- Auth
- Sharing
- AI web research/tools
- Spatial UI (“Cookie Space”)

Design goals:
- premium, modern, coherent
- not generic “AI-generated dashboard” design
- avoid excessive cards
- avoid random glowing blobs/orbs
- avoid fake blur pretending to be Liquid Glass
- functional controls can have glass/material treatment; content should remain readable and comparatively clean
- hierarchy, spacing, typography and interaction must remain consistent
- responsive/adaptive, not separate ugly platform versions

## CURRENT ARCHITECTURE

Core application:
React/Vite/TypeScript.

Core application database:
Neon PostgreSQL through @neondatabase/serverless in functions/api/_db.js.

Important Neon files:
- functions/api/_db.js
- functions/api/auth/_auth.js

IMPORTANT CURRENT STATE:
Code Studio’s functions/api/codebase.js still directly uses env.DB/D1-style prepared statements and its own codebase schema. Do NOT assume Code Studio has been migrated to Neon just because the core auth/chat database is Neon. Inspect before changing this boundary.

Workers AI:
- wrangler.toml has an AI binding.
- Used for image generation/AI capabilities where the current implementation requires it.
- Do not add paid APIs merely to replace free infrastructure.

## AUTH

Auth is email/password + verification/reset flows.
No Google OAuth requirement.

Users include:
- id
- email
- email_verified
- name
- username
- avatar_url
- password_hash/password_salt
- plan
- plan_expires_at
- role
- credits_remaining
- account_status
- suspended_until
- moderation_note
- login_failures
- locked_until
- created_at/updated_at

Do not casually change production auth schema.

Owner email:
cookie.ai.noreply@gmail.com

Developer email:
illu.dev.official@gmail.com

## ROLES / PERMISSIONS

Roles:
- user
- vip
- staff
- admin
- owner
- developer/member roles in Code Studio

User’s explicit rule:
STAFF MUST NOT GET CODE STUDIO.
Staff should only have moderation actions such as:
- warn
- suspend
- ban
- unsuspend/unban where allowed
- moderation notes/audit

Staff must NOT:
- change another account’s plan
- change credits
- change AI limits
- change account roles
- use Code Studio
- edit project/codebase

Owner/admin retain account-management capabilities.
Developer access is separate and should be limited to Code Studio/workspace capabilities actually granted.

Current admin.js has:
- roleOf()
- canManage()
- canChangeRoles()
- canManageAccounts()
- canModerateTarget()
The backend must remain stricter than the UI.

## CODE STUDIO

Frontend:
- src/CodeStudioPage.tsx
Backend:
- functions/api/codebase.js

Current verified source SHAs:
- src/CodeStudioPage.tsx: c337f7672e4591dc54f7acfce3ee848696add119
- functions/api/codebase.js: 531da917b878434bdf9d214f5f5e317475e5b5ce

Current Code Studio capabilities:
- standalone surface
- Back to Cookie AI
- workspace sync
- file tree
- file CRUD/rename/duplicate/delete
- revisions
- diff
- deterministic checks
- AI review
- review persistence
- GitHub commit/update
- deployment status
- audit log
- undo
- auto-review / auto-review-and-commit
- protected paths
- member management
- privileged account controls
- protected internals hidden
- .env/.dev.vars hidden
- .md files hidden in Code Studio explorer

IMPORTANT RECENT FIX:
Folder tree now has local open state per folder. Opening one folder must NOT recursively open every other folder.

MOBILE FILE SELECTION RULE:
Selecting a file on mobile should close the Explorer/sidebar so the editor gets the available screen.

CODE STUDIO AI REVIEW:
User intentionally changed a correct file into a broken file and the system previously said “approved.” This is unacceptable.
Review must fail closed when uncertain and combine deterministic checks with actual AI review. Never show “Approved” if the review could not actually validate the change.

FAKE TERMINAL:
Removed fake terminal execution. Do not display fabricated command output.
A real terminal requires an actual execution backend; do not pretend.

## CODE STUDIO DEV AI

Required direction:
Developers should be able to chat with a Cookie Dev AI inside Code Studio.

The Dev AI should:
- understand workspace files
- inspect relevant files
- explain changes
- make requested workspace edits
- respect protected files/permissions
- create revisions/audit records
- send changes through review/safety checks
- never bypass protected internals
- never give staff Code Studio access

If this is not fully implemented in current main, it is an unfinished task.

## SPATIAL UI / COOKIE SPACE

A new “Space” view was added.

Current verified implementation in src/App.tsx includes:
- Chat
- Work
- Projects
- Search
- Library
- GPTs
- Code Studio only when allowed
- Moderation only when allowed

Current Space behavior:
- full available page, no cards underneath
- no giant boxed dashboard
- spatial markers rather than rectangular cards
- CSS 3D perspective
- translateZ depth
- orbit layers
- spatial floor/grid
- movable camera layer
- pointer/touch drag
- desktop mouse drag
- wheel/trackpad movement
- Center button
- access-aware nodes

Current SpatialHub implementation uses:
- camera {x,y,rx,ry}
- drag state
- pointer capture
- bounded camera pan
- wheel updates
- nodes positioned in a 3D scene

USER FEEDBACK:
The user wants to drag the SCREEN/view sideways/up/down so off-screen workspace objects can be reached. The current camera is better than rotating the objects, but it is still bounded. Next improvement should be a genuinely camera/world-space implementation:
- smooth/inertial panning
- zoom
- focus/select object
- optional double-tap/enter-to-focus
- world coordinates rather than arbitrary screen bounds
- preserve object positions
- no forced “fit everything” layout
- desktop + Android + iPhone/iPad touch
- keyboard/mouse/trackpad support

Do not return to the previous generic card layout.

## ADAPTIVE AI EFFORT

Added:
- Light
- Standard
- High
- Ultra

Frontend persists effort locally and sends it with chat preferences.
Backend chat routing maps effort to reasoning behavior.

Do not make effort cosmetic. It should affect actual routing/reasoning where the provider supports it.

## CHAT / AI SYSTEM

Current functions/api/chat.js SHA:
bcd46de497a8b4c6a2346bf3694c8d84fdbbd380

Current chat tools include:
- file_create
- file_read
- file_update
- file_delete
- web_search
- web_fetch
- memory-related functionality where already present

Current GPT profiles:
- Study Coach
- Code Expert
- Writing Partner
- Research Analyst
- Data Analyst
- Creative Studio

GPTs must use Cookie’s existing model pipeline. Do not reintroduce external GPT-5.1/OpenAI API branding.

User’s free-only requirement remains strict.

## IMPORTANT CURRENT UI BUG — CONTINUE HERE

The user reported:
“you finished ur msg but it’s still loading to me i don’t see ur message”

Meaning the Cookie UI can apparently finish/receive the assistant response but still visually remain in a loading state or fail to reveal the final assistant message.

This is a HIGH PRIORITY unresolved bug.

Next chat must inspect:
- chat streaming lifecycle
- loading state transitions
- abort controller
- SSE completion event
- final message insertion
- streamText clearing
- streamStatus clearing
- assistant message activity completion
- render conditions in ChatView
- any race between final SSE event and setLoading(false)
- stale state closures
- error/fallback completion paths

Do not merely change the spinner CSS. Trace the state machine and fix the actual lifecycle.

ChatView currently renders:
- ActivityTimeline for assistant activity
- Rich assistant content
- generated images/files/sources
- user content
- composer

Test:
1. short response
2. long response
3. provider fallback
4. web tool response
5. file tool response
6. aborted response
7. error response
8. mobile Safari
9. desktop Chromium
10. reopening the chat after response

## MOBILE COMPOSER

Known fixes:
- composer width fixed
- textarea starts around 52px
- submit resets height
- Enter send behavior
- outside row-menu click closes menus
- only one row menu open at a time

Relevant commits:
- f423f1ad043d0c87ee2bd0cb4af29da602145b4a
- 9dfe41d5e4dcc18b8351caefa339608d67e016e1

Still verify real behavior on:
- iPhone Safari
- Android Chrome
- desktop
- keyboard open/close
- long text
- send/clear
- rotation
- safe-area bottom

## LIQUID GLASS

The user wants actual Liquid Glass-like behavior, not generic backdrop-filter blur.

Third-party library researched:
Meapri/liquid-glass-web
commit:
1613f8311dbc31bc2331afcfe51a143c56dd6308
version 0.1.0

This is NOT Apple’s official web engine. Do not describe it as official.

Important library concepts:
- GPU/Chromium refraction
- backdrop/filter processing
- interactive material
- auto enhancement
- device profiles
- CSS fallback
- suspend/resume

Vendoring was started, but full integration was not completed.

Already-created source blobs included:
- types.ts
- AutoProfile.ts
- DeviceProfile.ts
- BuildQueue.ts
- CanvasEncode.ts
- SurfaceField.ts
- MapRaster.ts
- MapWorker.ts
- MapWorkerClient.ts

Other engine blobs may or may not exist. Check before creating duplicates:
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

Target:
src/vendor/liquid-glass/
  core/
  styles/
  index.ts

Next Liquid Glass tasks:
1. Finish dependency graph.
2. Inspect WebGL/Safari feature detection.
3. Verify iOS Safari fallback.
4. Integrate into React without repeatedly calling autoEnhance().
5. Track/destroy instances correctly.
6. Apply material mainly to:
   - top navigation
   - sidebar
   - menus/popovers
   - composer/control layer
   - GPT navigation/control layer
   - Work controls
7. Do NOT glass message content.
8. Remove conflicting fake glass CSS once real engine works.
9. Keep accessibility/reduced motion/transparency fallbacks.

## UI DESIGN RULES

User specifically dislikes:
- generic AI-generated dashboard layouts
- giant cards
- excessive rounded cards
- fake blur
- random glowing blobs
- generic blue AI orb
- content bleeding through menus
- cramped mobile composer
- UI elements overlapping
- platform-specific layouts that look unrelated

Preferred:
- premium
- restrained
- spatial when useful
- clean typography
- strong hierarchy
- responsive
- functional-layer glass/material
- useful 3D
- coherent Cookie identity
- actual interaction logic, not decoration

3D must be meaningful:
- spatial workspace
- object depth
- navigation
- focus
- workspace relationships
Not just floating cards with a perspective transform.

## EXACT COOKIE BRANDING

The exact user-approved glossy Cookie artwork is:
Glossy Chocolate Chip Cookie Icon_2.png

Root repo asset:
cookie-ai-icon.png

Do NOT replace it with:
- emoji
- generated cookie
- SVG substitute
- hand-drawn icon
- generic icon

Vite currently bundles the exact artwork.

## SHARE SYSTEM

Share links use a server-side snapshot ID, not full chat JSON in the URL.

Backend:
functions/api/chats.js
- POST /api/chats?share=1
- GET /api/chats?share=<id>

Frontend:
PublicShareView and native share/clipboard fallback.

Do not regress to base64 full-chat URLs.

## AUTH / EMAIL

Email verification and password reset use secure tokens/codes.
Email delivery was previously verified.

Do not casually change production schema or rerun obsolete migrations.

## FREE-TIER / PERFORMANCE RULES

Cloudflare free-tier subrequest limits have caused real failures before.

Do not solve inefficient architecture by asking user to pay.

Optimize:
- batching
- lazy loading
- GitHub tree metadata
- file content hydration only when needed
- avoiding one request per file
- avoiding repeated schema initialization
- avoiding redundant provider calls

## DEPLOYMENT / CI

Workflows include:
- .github/workflows/code-studio-checks.yml
- .github/workflows/build-dist.yml

Current verified source SHAs:
- src/App.tsx: 17f2433962bf6210f4be67c4d0c01b09f220a32e
- src/styles.css: e154afc2e15c58088014ab63fa583a090df55584
- functions/api/chat.js: bcd46de497a8b4c6a2346bf3694c8d84fdbbd380
- functions/api/codebase.js: 531da917b878434bdf9d214f5f5e317475e5b5ce
- src/CodeStudioPage.tsx: c337f7672e4591dc54f7acfce3ee848696add119
- package.json: fd878bfa5c43d8678d49fd83b9514591ad3f111e
- wrangler.toml: 2d4f7e725485c8f350354d596c6380cf4cce029c

Current main HEAD:
375dbc0c55038b6e6889bfa31891693bb6e06225

Never trust this handoff SHA for editing later; refetch current files first.

## PACKAGE

Current package has:
- react
- react-dom
- vite
- typescript
- lucide-react
- framer-motion
- three
- @monaco-editor/react
- perfect-scrollbar
- animate.css
- nodemailer
- relevant type packages

Monaco was added as a dependency but is NOT fully integrated. Do not claim it is integrated.

## KNOWN HISTORY / MAJOR COMPLETED WORK

### Auth
- email verification auth
- sessions
- password reset
- Cloudflare-compatible mail path
- legacy schema repair

### Code Studio
- standalone Code Studio
- GitHub-backed workspace
- lazy file hydration
- file editing
- revisions/diffs
- review
- protected files
- audit
- undo
- deployment status
- role controls
- staff restriction
- mobile explorer improvements
- folder local expand/collapse

### GPTs
- rebuilt GPT pages
- removed external GPT-5.1 API approach
- removed GPT-5.1 branding
- GPTs use Cookie pipeline
- no scripted prompt-card workflow

### Work
- changed to input-first
- user describes their actual task
- no canned prompt buttons

### Chat UI
- composer resizing/send reset
- one row menu at a time
- outside-click closing
- responsive mobile shell fixes
- activity timeline
- actual tool action labels
- provider retry noise hidden from user

### Activity UI
First visible state:
- Thinking…

Then:
- actual tool action, e.g. Searching for “query”
- Reading hostname
- Created/Updated/Opened path
- Created the image

Do not expose private chain-of-thought.
Activity UI represents real tool/action status, not hidden reasoning.

### AI provider fallback
Current Cookie architecture has multiple cloud provider candidates/fallbacks. Provider-specific failures should not become a giant list of visible fake activity steps.

## RECENT SPATIAL UPGRADE HISTORY

The first Cookie Space version was intentionally rejected because it looked like generic AI-generated cards inside a box.

It was then rebuilt:
- removed outer box
- removed cards below map
- full-page spatial surface
- spatial markers
- CSS 3D depth
- pointer drag
- camera layer
- Center control

Current implementation is better but still has bounded camera movement. Next step is free/inertial camera/world navigation.

## IMPORTANT USER COMMUNICATION STYLE

User prefers:
- short progress updates
- direct action
- no repeated history
- no generic “I can help” filler
- show concrete work/results

When an implementation is incomplete, say exactly what remains.

## NEXT CHAT — START HERE

1. Fetch current main HEAD and latest source files.
2. Do NOT assume old SHAs.
3. Fix the HIGH PRIORITY chat bug where the final response is received/finished but UI still appears loading or fails to show the final message.
4. Verify the full streaming state lifecycle on desktop + iPhone + Android.
5. Continue the UI/logic upgrade from the user’s latest request if they say “upgrading time”.
6. For “upgrading time”, research current AI/UI trends first, then implement at least 2 meaningful upgrades.
7. Finish real Liquid Glass integration rather than another fake blur pass.
8. Continue Cookie Space toward a true world/camera model with:
   - free pan
   - inertial movement
   - zoom
   - focus/select
   - responsive input across desktop/mobile
9. Keep role boundaries strict.
10. Build and verify before reporting completion.

## FINAL RULE

Do not simply describe what should be done.

Inspect the current repository, implement the requested work, test it, commit it, verify CI/deployment, and then report the actual result.
