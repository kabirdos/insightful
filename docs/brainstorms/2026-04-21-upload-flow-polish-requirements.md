---
date: 2026-04-21
topic: upload-flow-polish
---

# Upload Flow Polish

## Problem Frame

The current path from "I want to share my harness" to "I'm viewing my published report" is a 5-step scavenger hunt. Users must:

1. Copy-paste two separate install commands
2. Run `/insight-harness` and wait
3. Hunt in a hidden folder (`~/.claude/insight-harness/`) for a dated HTML file — the path is only visible in a backgrounded log
4. Drag that file into the upload UI
5. Sign in with GitHub at the end of the wizard (after they've already invested effort)

Nothing in this flow is individually broken, but the cumulative friction is real, and steps 3–5 are the worst offenders. We want to sand the rough edges of the existing flow before investing in a deeper architectural rewrite (tokenized direct-POST). This is the "polish" pass; a future brainstorm will tackle the direct-POST approach once usage justifies the build.

## User Flow (target)

```
Upload page ──► Sign in with GitHub ──► Copy combined install block
                                              │
                                              ▼
                          Paste into Claude Code ──► /insight-harness
                                              │
                                              ▼
              Skill prints clickable file:// link + copies path to clipboard
                                              │
                                              ▼
          User clicks link (or returns to upload page) ──► drops file
                                              │
                                              ▼
                         Review wizard ──► Publish ──► /r/<slug>
```

## Requirements

**Auth-First Gating**

- R1. The upload page must require GitHub sign-in _before_ showing install commands or the drop zone. Unauthenticated visitors see a single "Sign in with GitHub to upload" call-to-action.
- R2. Once signed in, the publish step at the end of the wizard must not redirect to GitHub again. Users should experience one sign-in per upload session.

**Install Command Consolidation**

- R3. The two plugin install commands must be presented as a single combined copy block with one Copy button. The block is still two lines of text (users can't chain slash commands), but the friction of "copy, paste, wait, copy, paste" collapses to one copy action.
- R4. The curl-based fallback must remain available via a toggle/disclosure, unchanged in behavior.

**Skill Output Polish**

- R5. When `/insight-harness` finishes, the skill's final stdout must include:
  - A `file://` link to the dated HTML report (for local viewing / archival)
  - An `https://insightharness.com/upload` link
  - A line stating the stable report path (`~/.claude/insight-harness/report.html`) — the path the upload page expects
  - A clipboard status line that is **conditional on actual success**: if the copy succeeded, say so; if it failed or the tool was unavailable, say that instead. Never print "copied" if the copy did not occur.
  - **Constraint:** `SKILL.md` currently documents that the final line of stdout is the absolute path to the dated HTML report, and `extract.py` ends with `print(str(dated_path))`. The new lines above must either be printed **before** that final line, or `SKILL.md` must be updated in the same change to reflect the new contract. Planning must choose and apply one of these.
- R6. On macOS, the report path must be copied to the clipboard via `pbcopy`. On Linux, attempt `wl-copy` first, then `xclip`; if neither is available, skip silently (the conditional status line in R5 communicates this). Windows is out of scope for this iteration.
- R7. The skill must never fail the extraction if clipboard copying fails — it's a convenience, not a requirement.

**Upload Page Affordances**

- R8. The drop zone must be visually prominent and auto-focused when a signed-in user lands on the page.
- R9. The page must surface the stable report path (`~/.claude/insight-harness/report.html`) near the drop zone so users know where their file is. **Note:** the current upload page already renders this helper text (see `src/app/upload/page.tsx` — the `HARNESS_PATH` constant and `MiniDropZone` usage). Treat R9 as "verify still correct after R8's layout changes" rather than net-new work.

## Success Criteria

- A first-time user can go from "I heard about this" to "I have a published report URL" in under 3 minutes with no confusion about where the file is. _(Aspirational — acknowledged as unmeasurable without new instrumentation; see Outstanding Questions.)_
- The number of support questions / Slack pings about "where's the report" or "why does it want me to sign in again" drops to near zero (we have no formal metric today; use qualitative feedback).
- No regressions **for users who are already signed in** when they land on `/upload`. R1 explicitly changes the experience for signed-out returning users (they now see a sign-in gate instead of the wizard) — that is an accepted tradeoff, not a regression.

## Scope Boundaries

- **Out of scope:** Tokenized direct-POST from the skill to `/api/upload`. Reserved for a future brainstorm (Approach A).
- **Out of scope:** Publish-first, edit-after flow. Review wizard before publish stays as-is.
- **Out of scope:** Windows clipboard support.
- **Out of scope:** Any changes to the review wizard steps themselves (project picker, redaction toggles, title editing).
- **Out of scope:** API route changes, database/schema changes, and auth-provider changes (no switching from NextAuth/GitHub, no new providers). Page-route-level auth gating needed for R1 (middleware or server-component check) is **in scope** — it's the minimum necessary to implement R1 and doesn't touch API, schema, or provider config.

## Key Decisions

- **Polish over rebuild**: We're deferring the deeper fix (direct-POST with tokens) until we have more users and the investment is justified. Rationale: validated user intuition that the upload step _could_ disappear, but the lift isn't warranted yet.
- **Auth-first, not auth-last**: Moving sign-in to the top of the funnel trades a small bounce risk (users who won't sign in) for a large UX win (no mid-flow redirect). Acceptable because publishing requires GitHub anyway — we're just front-loading the inevitable.
- **Use the stable `report.html`, not the dated filename, in on-page copy**: Dated filenames are useful for archiving multiple runs, but the upload page should point at the predictable path.
- **Clipboard is best-effort**: On Linux we try xclip/wl-copy but don't fail. Keeps the skill portable.

## Dependencies / Assumptions

- The skill repo (`kabirdos/insight-harness`) is independently releasable. Changes to `extract.py` / `SKILL.md` ship via the plugin update path.
- `pbcopy` is available on all macOS users' machines (it ships with macOS; safe assumption).
- The upload page's current drag-drop and file picker already work once the file is found — verified in the existing codebase (`src/app/upload/page.tsx`).
- **Verified against the codebase during document review:**
  - `/api/upload` (parse endpoint) already rejects unauthenticated requests with 401 (`src/app/api/upload/route.ts:55`). R1's auth-first gating replaces the current behavior where a signed-out user hits a silent 401 surfaced as "Failed to parse file." This means R1 is also a latent bug fix, and the existing client-side 401 handling becomes dead code after R1 ships.
  - The skill already writes both the dated HTML and the stable `report.html` (`extract.py:3078`), so R5/R9 don't require new file-writing logic — only output-line and helper-text changes.

## Outstanding Questions

### Resolve Before Planning

_(none — ready for planning)_

### Deferred to Planning

- [Affects R1][Technical] What's the cleanest way to gate the upload page on auth in Next.js App Router — middleware redirect, server component check, or a client-side guard? Plan step should pick one consistent with how the rest of the app handles auth gating.
- [Affects R5][Technical] Do Claude Code terminals render `file://` links as clickable in all common setups (Terminal.app, iTerm2, VS Code integrated terminal)? If not universally, we still print the path as a fallback, but planning should verify.
- [Affects R6][Needs research] Confirm the clipboard command precedence on Linux. Default assumption: try `wl-copy` first (Wayland is increasingly common), fall back to `xclip`, then skip.

## Next Steps

→ `/ce:plan` for structured implementation planning
