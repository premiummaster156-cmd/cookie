# Cookie Code Studio — Upgrade Plan

## Purpose

Upgrade the current lightweight virtual Code Studio into a serious VS Code-inspired browser IDE for Cookie.

Do not treat this document as the implementation itself. It is the handoff specification for a future coding session.

## Current problems

The current Code Studio looks like a generic/AI-generated prototype on mobile:

- oversized empty panels
- weak visual hierarchy
- crude explorer
- too much empty space
- limited editor experience
- error banner is visually intrusive
- current editor is only a textarea
- no real IDE workspace model
- no integrated terminal
- no source-control/diff workflow
- no AI review workflow
- no safe automatic GitHub commit/deployment pipeline
- current Sync/Members controls need a more professional IDE layout
- the UI should be redesigned rather than merely adding more rounded cards

The uploaded mobile screenshot is the baseline problem to solve.

## Design target

Build a polished, professional browser IDE inspired by VS Code's information architecture and interaction patterns, without copying VS Code branding/assets.

Target structure:

- activity/sidebar rail
- Explorer
- Search
- Source Control
- Run/Build
- Extensions/tools area if useful
- compact top command/title bar
- file tabs
- breadcrumb/path bar
- real editor area
- minimap or lightweight alternative where practical
- bottom panel
- Problems
- Output
- Terminal
- status bar
- command palette
- keyboard shortcuts
- responsive mobile layout

Do not make every element a floating rounded card. Use a real IDE layout with panels, dividers, tabs, and dense information hierarchy.

## Editor

Replace the current basic textarea with a real code-editor experience.

Preferred:

- Monaco Editor if bundle/performance is acceptable
- otherwise a high-quality syntax-highlighted editor implementation

Support:

- syntax highlighting
- line numbers
- indentation
- bracket matching
- autocomplete where practical
- find/replace
- keyboard shortcuts
- Ctrl/Cmd+S
- Ctrl/Cmd+P quick open
- Ctrl/Cmd+Shift+P command palette
- Ctrl/Cmd+F find
- Ctrl/Cmd+H replace
- multiple tabs
- unsaved-change indicators
- read-only mode for unsupported/binary files

Languages should cover at minimum:

- TypeScript
- JavaScript
- TSX/JSX
- JSON
- CSS
- HTML
- SQL
- Markdown
- YAML
- shell/config files

## Virtual workspace

Every tracked repository file must exist in the virtual Code Studio.

Features:

- full recursive file tree
- folders
- create file
- create folder
- rename
- delete
- duplicate
- move
- search
- quick open
- recently opened files
- open tabs
- dirty/unsaved indicators
- revision history
- restore revision

Keep the D1-backed virtual workspace as the source for the browser editing session.

## Autosave

Add autosave with a short debounce.

Rules:

- save editor changes to the virtual workspace automatically
- never automatically commit to GitHub merely because autosave occurred
- show clear status: Saved, Saving, Unsaved, Review pending, Approved, Commit queued, Deployed, Deployment failed
- preserve changes if the network temporarily fails

## Source control

Add a proper Source Control view.

Show:

- changed files
- additions/deletions
- modified/deleted/created state
- diff viewer
- staged/unstaged conceptual workflow if useful
- review status
- commit history
- current branch
- latest commit
- GitHub sync state

The user must be able to inspect the exact diff before AI review/commit.

## AI Review + Safety Gate

Implement the previously discussed workflow:

1. User edits files.
2. Autosave stores changes in the virtual workspace.
3. Code Studio calculates the diff against the current approved GitHub baseline.
4. AI reviews the exact diff.
5. Deterministic safety checks run.
6. Build/type checks run where possible.
7. Only a clean review can become eligible for automatic commit.

AI review must inspect:

- accidental large deletions
- unexpected file additions
- secrets/API keys/passwords/tokens
- suspicious credential handling
- authentication changes
- authorization changes
- database schema changes
- destructive migrations
- package/dependency changes
- dangerous shell/build scripts
- Cloudflare configuration
- broken imports
- likely runtime regressions
- obvious security issues
- unrelated modifications
- attempts to remove important functionality

AI must produce structured results:

- Approved
- Needs changes
- Blocked

with:

- summary
- changed files
- risk level
- findings
- required fixes
- tests/checks performed

## Deterministic safety checks

AI approval alone is not enough.

Run deterministic checks where available:

- TypeScript compilation
- Vite production build
- lint if configured
- package-lock consistency
- secret scanning
- suspicious file/path detection
- oversized diff detection
- required-file protection
- migration sanity checks

Fail closed.

If a required check fails, do not commit.

## Automatic GitHub commit

Only after:

- user/authorized developer has changes
- autosave completed
- diff exists
- AI review approves
- deterministic checks pass

Then the server can create the GitHub commit.

Never expose GitHub credentials/tokens to browser JavaScript.

Server-side GitHub integration only.

Commit message should be generated from the actual change, for example:

fix(auth): repair email verification flow

The commit should contain exactly the approved diff.

## Automatic Cloudflare deployment

After a successful GitHub commit:

1. push commit to the configured branch
2. GitHub becomes the source of truth
3. Cloudflare Pages detects the push
4. Cloudflare builds the project
5. deployment status is tracked
6. Code Studio shows Deploying, Deployed, or Deployment failed

Do not claim deployment success until the deployment status is actually known.

If Cloudflare build fails:

- keep the commit
- mark deployment failed
- show the build error
- allow AI/user to create a follow-up fix
- never silently overwrite the user's work

## Review/commit controls

Provide a clear workflow button:

Review Changes

Then after successful review:

Approve & Commit

For trusted owner-controlled automation, support:

Auto Review + Auto Commit: ON

But even automatic mode must retain the same safety gates.

The browser should never be able to bypass the server-side review/safety checks.

## Roles

Current owner:

cookie.ai.noreply@gmail.com

Current developer:

illu.dev.official@gmail.com

Roles:

- Founder/Owner
- Frontend Developer
- future Reviewer
- future Read-only

Owner permissions:

- full workspace
- member management
- GitHub integration
- auto-commit configuration
- deployment controls
- review policy controls

Developer permissions:

- edit files
- create/delete files
- run review
- submit approved changes
- view source control
- view build/deployment output

Do not hard-code future developers beyond the currently configured accounts. Member management should remain database-driven.

## Terminal

Add an integrated terminal-like panel.

For the first implementation, it may be a controlled server-side command runner rather than a full unrestricted shell.

It should support project-safe commands such as:

- npm install
- npm run build
- npm test
- npm run lint
- git status
- git diff

Do not expose arbitrary host-level shell access without explicit sandboxing.

## Problems / Output

Bottom panel tabs:

- Problems
- Output
- Terminal
- AI Review
- Deployment

Errors should be compact and IDE-like, not giant red notification cards covering the workspace.

## Command palette

Implement a command palette with actions such as:

- Open File
- Save
- Save All
- Find
- Replace
- Create File
- Create Folder
- Rename
- Delete
- Search Workspace
- Source Control
- Review Changes
- Approve & Commit
- Sync from GitHub
- Run Build
- Open Terminal
- Open Settings

## Mobile UX

The screenshot shows this is especially important.

On mobile:

- do not render desktop explorer and editor side-by-side permanently
- use a drawer/sheet for Explorer
- editor gets full width
- tabs scroll horizontally
- bottom panel can become a bottom sheet
- command palette must be touch friendly
- toolbar must remain compact
- avoid giant empty cards
- preserve keyboard behavior when an external keyboard is connected

## Visual direction

Use a professional developer-tool aesthetic:

- dense but readable
- subtle borders
- restrained shadows
- clear active states
- compact controls
- consistent iconography
- neutral dark/light themes
- excellent typography
- minimal decorative effects
- no excessive glassmorphism
- no generic AI landing-page styling

The result should feel like a real development environment, not an AI-generated dashboard.

## Backend/data model additions

Extend the existing Code Studio schema as needed for:

- workspace sessions
- file revisions
- review records
- review findings
- review status
- diffs
- build results
- deployment records
- commit records
- audit events
- member permissions
- automation settings

Do not destroy existing data.

Use additive migrations.

## GitHub integration

The future implementation should support:

- fetch current branch/tree
- compare virtual workspace with GitHub baseline
- create exact commit
- retrieve commit status
- retrieve changed files
- preserve GitHub SHA information
- handle conflicts safely

Never blindly overwrite a newer GitHub version.

If GitHub changed since the virtual workspace was based on it:

- detect divergence
- stop automatic commit
- show conflict state
- offer sync/rebase-style resolution

## Deployment integration

Track:

- commit SHA
- Cloudflare deployment ID if available
- build status
- deployment status
- timestamps
- failure logs where available

The UI should connect:

Change → Review → Checks → Commit → Deployment

into one traceable history.

## AI architecture

The AI reviewer should not be the same unconstrained generation path used for normal chat.

Use a dedicated review prompt/schema.

Input:

- repository context
- current baseline
- exact diff
- relevant files
- package manifest
- configuration
- previous review findings

Output should be structured JSON validated server-side.

Never allow model text alone to authorize a commit.

## Important security rule

The server is authoritative.

Client UI state must never determine:

- whether a user is owner
- whether review passed
- whether a commit is allowed
- whether deployment is allowed

Every sensitive action must be rechecked server-side.

## Implementation order

Recommended sequence:

1. Redesign Code Studio UI/UX.
2. Build proper file tree/tabs/editor.
3. Add autosave + revisions.
4. Add source-control diff view.
5. Add build/check runner.
6. Add dedicated AI review API.
7. Add review database records.
8. Add server-side GitHub commit integration.
9. Add Cloudflare deployment tracking.
10. Add automatic approval/commit/deploy mode.
11. Add terminal.
12. Add advanced collaboration/history features.

## Success criteria

The finished Code Studio should feel like a real browser IDE.

A typical safe change should work like:

Edit → Autosave → Review Changes → AI + checks → Approved → Commit → Cloudflare build → Deployed

A risky/broken change should work like:

Edit → Autosave → Review → Blocked → Nothing committed

No work should disappear when a review or deployment fails.

## Do not regress

Preserve:

- Cookie authentication
- email verification flow
- D1 workspace data
- current owner account
- current Illu developer account
- existing GitHub repository
- existing Cloudflare deployment
- existing chat/projects/memory features
- current responsive app navigation

This file is the implementation handoff for the next Code Studio upgrade session.
