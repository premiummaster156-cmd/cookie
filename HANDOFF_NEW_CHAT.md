# COOKIE AI — MASTER HANDOFF / NEW CHAT CONTINUATION

Updated: 2026-10-05
Repository: premiummaster156-cmd/cookie
Branch: main
Current main HEAD: 6234d3cf7fadda907d51c64472b8656026ee6737
Production: https://cookie-8bi.pages.dev

## READ FIRST

This is the ONLY handoff file. Do not create additional handoff files unless the user explicitly asks.

User wants direct implementation, short progress updates, and concrete results. Do not repeat project history unless needed.

Always refetch the current file + SHA before editing. Never claim a build/deployment succeeded without checking actual CI/deployment evidence.

FREE-ONLY:
- Do not introduce paid APIs/services unless explicitly requested.
- Never expose secrets.
- Never fake tools, terminal output, AI review, execution, or deployment.
- Core database is Neon PostgreSQL. Do not silently introduce D1.

---

# PERMANENT “UPGRADING TIME” RULE

When the user says “upgrading time”, treat it as a new Cookie AI release.

Every upgrade must:
1. Add at least 2 meaningful features/substantial improvements.
2. Do deep current research into leading AI products, newest releases, agent UX, UI/3D/spatial patterns, and developer tooling when relevant.
3. Include UI/UX + interaction logic, not only backend.
4. Catch Cookie up to useful modern capabilities.
5. Keep systems isolated and avoid regressions.
6. Preserve one coherent Cookie design system.
7. Support desktop, laptop/tablet, Android, iPhone/iPad, and major browsers.
8. Explore useful real 3D/spatial UI; never add decorative fake 3D just for appearance.
9. Test/build affected systems before calling the release complete.
10. Never fake an AI capability or execution result.
11. Preserve the exact Cookie branding artwork.
12. Prefer reusable infrastructure over duplicate one-off implementations.

User previously asked for “deep search for 20 minutes and actions/upgrades in 15 minutes.” Do not fabricate time spent. Research/action as deeply as available tools permit and report what was actually verified.

---

# PRODUCT

Cookie AI is a React + Vite + TypeScript AI assistant with:
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
- Web research/tools
- Cookie Space / spatial UI

Design direction:
- premium and coherent
- not generic AI-generated dashboard
- avoid excessive rectangular cards
- avoid random glowing blobs/orbs
- avoid fake blur marketed as Liquid Glass
- useful spatial/3D UI
- functional controls can use material/glass treatment
- clean typography/hierarchy
- responsive/adaptive across platforms

---

# CURRENT ARCHITECTURE

Frontend:
React + Vite + TypeScript.

Backend:
Cloudflare Pages Functions.

Database:
Neon PostgreSQL through @neondatabase/serverless.
Important:
- functions/api/_db.js
- functions/api/auth/_auth.js

Workers AI:
- wrangler.toml contains AI binding.
- Used for supported image/AI capabilities.
- Do not replace free infrastructure with paid providers.

IMPORTANT:
Code Studio backend has its own legacy D1-style/env.DB boundary in functions/api/codebase.js. Do not assume Code Studio is Neon-backed just because auth/core database is Neon. Inspect before changing this.

---

# AUTH / ACCOUNT MODEL

Auth includes email/password, verification and reset/session flows.

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
- timestamps

Owner:
cookie.ai.noreply@gmail.com

Developer:
illu.dev.official@gmail.com

Do not casually alter production auth schema.

---

# ROLES / PERMISSIONS

Roles:
- user
- vip
- staff
- admin
- owner
- separate Code Studio developer/member permissions

USER'S EXPLICIT RULE:
STAFF MUST NOT GET CODE STUDIO.

Staff may only perform moderation actions such as:
- warn
- suspend
- ban
- unsuspend/unban where allowed
- moderation notes/audit

Staff must NOT:
- change another account's plan
- change credits
- change AI limits
- change roles
- edit codebase/projects
- use Code Studio

Owner/admin retain account-management capabilities.
Developer/member access is separate and must only grant explicitly permitted workspace/code capabilities.

Backend permissions must be stricter than frontend visibility.

---

# CODE STUDIO

Frontend:
src/CodeStudioPage.tsx
Current SHA:
c337f7672e4591dc54f7acfce3ee848696add119

Backend:
functions/api/codebase.js
Current SHA:
531da917b878434bdf9d214f5f5e317475e5b5ce

Existing capabilities:
- standalone Code Studio
- workspace sync
- file explorer
- file CRUD/rename/duplicate/delete
- revisions/diffs
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
- .md files hidden in explorer

Recent fixes:
- folder open state is local per folder; opening one folder must NOT open nested folders automatically.
- selecting a file on mobile should close Explorer/sidebar so editor gets available space.
- fake terminal execution was removed. Never fabricate terminal output.
- staff account-control access was removed; only owner/admin should have account-management controls.
- Code Studio should be hidden from non-privileged users.

## CODE STUDIO AI REVIEW — HIGH PRIORITY

User deliberately broke a correct file and the system previously said “Approved.” This is unacceptable.

Review must:
- run real deterministic checks
- run actual AI review when configured
- fail closed when review cannot reliably validate the change
- never display Approved when AI review did not actually happen
- preserve review evidence
- catch obvious TS/JS/JSX syntax/semantic problems
- never bypass protected paths

## DEV AI

Required product direction:
Developers should be able to chat with a Cookie Dev AI inside Code Studio.

Dev AI should:
- inspect workspace files
- understand relevant code
- explain changes
- make requested workspace edits
- respect protected files/permissions
- create revisions/audit entries
- send edits through review/safety checks
- never bypass protected internals
- never grant staff Code Studio access

If current main does not fully implement this, it remains unfinished.

---

# COOKIE SPACE / SPATIAL UI

Cookie Space was introduced and repeatedly redesigned based on user feedback.

Rejected first design:
- giant box
- generic AI dashboard
- cards below the map
- looked AI-generated
- not actually navigable

Current direction:
- full-page spatial surface
- no cards underneath
- spatial markers
- CSS 3D perspective/depth
- translateZ
- orbit layers
- spatial floor/grid
- camera layer
- pointer/touch drag
- mouse drag
- wheel/trackpad
- Center control
- only show workspaces the current account can access

Current implementation uses camera state:
- x
- y
- rx
- ry

Current source:
src/App.tsx SHA 17f2433962bf6210f4be67c4d0c01b09f220a32e
src/styles.css SHA e154afc2e15c58088014ab63fa583a090df55584

## LATEST USER FEEDBACK

User wants to move the SCREEN/view sideways/up/down so objects off-screen can be reached.

We added a camera/pan layer, but it is still bounded and should be improved.

Next Space upgrade:
- true world coordinates
- effectively infinite/free camera
- smooth/inertial panning
- pinch/scroll zoom
- mouse wheel/trackpad zoom
- object selection/focus
- double tap/click or Enter to focus
- preserve spatial object positions
- optional keyboard navigation
- desktop + Android + iPhone/iPad touch
- no forced “fit everything”
- no return to generic card dashboard

---

# ADAPTIVE AI EFFORT

Added:
- Light
- Standard
- High
- Ultra

Frontend persists effort and sends it with chat preferences.
Backend maps effort to reasoning behavior.

Do not make this cosmetic.

---

# CHAT / AI

functions/api/chat.js current SHA:
bcd46de497a8b4c6a2346bf3694c8d84fdbbd380

Current tools include:
- file_create
- file_read
- file_update
- file_delete
- web_search
- web_fetch
- memory functionality where already present

GPT profiles:
- Study Coach
- Code Expert
- Writing Partner
- Research Analyst
- Data Analyst
- Creative Studio

GPTs use Cookie's existing model pipeline.
Do not reintroduce external GPT-5.1/OpenAI API branding.

Free-only remains strict.

---

# CRITICAL UNRESOLVED CHAT BUG — CONTINUE HERE FIRST

User reported:
“you finished ur msg but it’s still loading to me i don’t see ur message”

Screenshot shows a Cookie/ChatGPT-like state where a blue loading dot remains even though the assistant response appears to have completed/been generated.

Treat this as a real state-machine bug, NOT a spinner styling problem.

Inspect:
- chat streaming lifecycle
- loading state
- AbortController
- SSE completion event
- final message insertion
- streamText clearing
- streamStatus clearing
- activity completion
- render conditions
- stale React state closures
- race between final SSE event and setLoading(false)
- provider fallback completion
- error completion
- abort completion
- cleanup on chat switch/unmount

ChatView currently renders:
- ActivityTimeline
- Rich assistant content
- generated images/files/sources
- user content
- composer

Required tests:
1. short response
2. long response
3. provider fallback
4. web tool response
5. file tool response
6. abort
7. error
8. iPhone Safari
9. Android Chrome
10. desktop Chromium
11. reopen chat after response

Do not declare fixed until the actual state transition is verified.

---

# UI / UX RULES

User specifically dislikes:
- generic AI-generated dashboard
- giant cards
- too many rounded cards
- fake blur
- random glowing blobs
- generic blue AI orb
- overlapping controls
- content bleeding through menus
- cramped mobile composer
- layouts that only work on iPhone
- decorative 3D without real interaction

Preferred:
- premium
- restrained
- spatial when useful
- strong typography/hierarchy
- responsive/adaptive
- real material/glass where appropriate
- useful 3D
- consistent Cookie identity
- real interaction logic

3D should communicate:
- navigation
- workspace relationships
- depth
- focus
- object position
not merely “floating cards.”

---

# LIQUID GLASS

User wants actual Liquid Glass-like behavior, not generic backdrop-filter blur.

Researched third-party project:
Meapri/liquid-glass-web
commit:
1613f8311dbc31bc2331afcfe51a143c56dd6308
version 0.1.0

It is NOT Apple's official web engine.

Vendor work was started under:
src/vendor/liquid-glass/

Existing source blobs include some of:
- types.ts
- AutoProfile.ts
- DeviceProfile.ts
- BuildQueue.ts
- CanvasEncode.ts
- SurfaceField.ts
- MapRaster.ts
- MapWorker.ts
- MapWorkerClient.ts

Check before adding duplicates:
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

Next:
1. Finish dependency graph.
2. Verify WebGL/Safari detection.
3. Verify iOS fallback.
4. Integrate React lifecycle correctly.
5. Avoid repeated autoEnhance calls.
6. Destroy/unregister instances.
7. Apply material mainly to nav/sidebar/popovers/composer/control surfaces.
8. Do NOT glass message content.
9. Remove conflicting fake glass CSS.
10. Keep reduced-motion/accessibility fallbacks.

---

# EXACT COOKIE BRANDING

User-approved artwork:
Glossy Chocolate Chip Cookie Icon_2.png

Root asset:
cookie-ai-icon.png

Never replace with:
- emoji
- generated cookie
- SVG substitute
- hand-drawn icon
- generic icon

Vite bundles the exact artwork.

---

# SHARE

Share links use server-side snapshot IDs.

Backend:
functions/api/chats.js
- POST /api/chats?share=1
- GET /api/chats?share=<id>

Frontend:
PublicShareView + native share/clipboard fallback.

Never regress to base64 full-chat URLs.

---

# ACTIVITY UI

Activity should show actual tool/action status, not hidden chain-of-thought.

Initial:
- Thinking…

Then actual actions:
- Searching for “query”
- Reading hostname
- Created/Updated/Opened path
- Created the image

Provider retry noise should stay server-side.
Do not show fake terminal commands/output.

---

# MOBILE COMPOSER

Previously fixed:
- composer width
- textarea starting height
- submit height reset
- Enter-to-send
- outside row-menu click
- one row menu at a time

Relevant commits:
- f423f1ad043d0c87ee2bd0cb4af29da602145b4a
- 9dfe41d5e4dcc18b8351caefa339608d67e016e1

Still verify:
- iPhone Safari
- Android Chrome
- desktop
- keyboard open/close
- long text
- send/clear
- orientation
- safe area

---

# DATABASE / PERFORMANCE

Cloudflare free-tier subrequest limits have caused real failures.

Optimize:
- Neon batching/transactions
- lazy file hydration
- GitHub tree metadata
- no repeated schema initialization
- no request-per-file architecture
- no redundant provider calls

Core auth/database is Neon.
Do not introduce D1 casually.

---

# CI / DEPLOYMENT

Workflows:
- .github/workflows/code-studio-checks.yml
- .github/workflows/build-dist.yml

Current source SHAs:
- src/App.tsx: 17f2433962bf6210f4be67c4d0c01b09f220a32e
- src/styles.css: e154afc2e15c58088014ab63fa583a090df55584
- functions/api/chat.js: bcd46de497a8b4c6a2346bf3694c8d84fdbbd380
- functions/api/codebase.js: 531da917b878434bdf9d214f5f5e317475e5b5ce
- src/CodeStudioPage.tsx: c337f7672e4591dc54f7acfce3ee848696add119

Current main HEAD:
6234d3cf7fadda907d51c64472b8656026ee6737

Always refetch before editing.

---

# PACKAGE

Current package includes:
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

Monaco is a dependency but not necessarily fully integrated. Do not claim integration without checking.

---

# COMPLETED WORK SUMMARY

## Auth
- email/password auth
- verification
- sessions
- password reset
- Cloudflare-compatible mail
- schema repair

## Neon migration
- core auth/database moved to Neon
- Neon SQL compatibility fixes
- transactional batch
- production register syntax issue fixed

## Code Studio
- standalone workspace
- GitHub tree/file operations
- lazy file hydration
- editing/revisions/diff
- review system
- protected paths
- audit
- undo
- deployment status
- account controls
- role separation
- staff restriction
- mobile explorer behavior
- local folder expand/collapse
- fake terminal removed

## AI
- model tiers
- adaptive model fallback
- cloud model routing
- effort modes
- web research
- file tools
- image generation
- activity timeline
- GPT specialist pages
- memory functionality where already implemented

## Chat UI
- composer fixes
- row-menu behavior
- activity system
- generated files/images/sources
- responsive shell
- exact Cookie icon bundling
- sidebar/navigation improvements

## Spatial UI
- initial Space
- rejected generic card version
- full-page redesign
- actual CSS 3D depth
- camera layer
- pointer/touch panning
- center control
- access-aware workspaces

## Sharing
- server snapshot share links
- public share view
- native share/clipboard fallback

---

# CURRENT USER PRIORITY

Latest request:
“upgrading time — UI improvements + its logics”

The latest concrete UI bug reported during that work:
Cookie can visually remain loading even after the assistant response has finished/arrived.

The user also supplied screenshots showing the desired level of polish in other AI/chat interfaces. Use them as visual inspiration for interaction density and hierarchy, NOT as something to copy literally.

---

# NEXT CHAT — EXACT STARTING PLAN

1. Fetch current main HEAD.
2. Fetch current App.tsx and trace chat send/stream completion state.
3. Fix the “finished response but still loading / final message not visible” bug at the state-machine level.
4. Add robust cleanup/finalization for every SSE path.
5. Test normal/fallback/tool/error/abort/reopen flows.
6. Then continue the latest UI/logic upgrade:
   - better navigation state
   - cleaner composer
   - smarter activity lifecycle
   - menu/popover behavior
   - responsive desktop/mobile consistency
   - real spatial camera improvements
7. Finish real Liquid Glass integration only where technically supported.
8. Keep staff restricted to moderation.
9. Keep Code Studio permissions strict.
10. Run affected builds/checks and verify actual CI/deployment status.
11. Report only what was actually implemented and verified.

# FINAL RULE

Do not merely describe future work.

Inspect the repository, implement the requested work, test it, commit it, verify CI/deployment evidence, then report the actual result.
