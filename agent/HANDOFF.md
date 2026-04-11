# Session Handoff

## Date

2026-04-11

## Branch

main

## Git Status

```
 M .gitignore
 M agent/HANDOFF.md
 M agent/MEMORY.md
 M docs/superpowers/plans/2026-04-08-mermaid-workflow-diagrams.md
```

## Summary

Fixed a structural git/infra mistake: `feat/insightful-mvp` had become the de-facto trunk (GitHub default + Vercel production branch). Renamed it to `main`, added branch protection, flipped Vercel, created a new `.worktrees/fix/pre-launch-bugs` worktree for upcoming bug work, and added PR & branch hygiene rules to the global `~/.claude/CLAUDE.md`.

## What Was Done

- Pushed 3 unpushed local docs commits (persistent-projects design + plan); rebased onto Kabir's PR #19 which had landed in the meantime
- Pulled Kabir's PR #20 (`feat/persistent-projects`) into primary clone via `git pull --rebase --autostash`
- Created `main` branch on GitHub via `gh api -X POST .../git/refs` as a copy of `feat/insightful-mvp` HEAD (`013ebca`)
- Craig manually flipped Vercel production branch in the dashboard (Settings → Environments → Production → Branch Tracking) — public API cannot do this
- Changed GitHub default branch to `main` via `gh api -X PATCH repos/kabirdos/insightful -f default_branch=main`
- Deleted `feat/insightful-mvp` on GitHub via `gh api -X DELETE`
- Locally renamed: `git fetch --prune origin && git branch -m feat/insightful-mvp main && git branch -u origin/main main`. Verified site live (insightharness.com → HTTP 200)
- Added branch protection to `main` (blocks force-push and deletion; admins NOT bypassed; PR reviews NOT required to preserve solo iteration speed)
- Saved reference memory `~/.claude/projects/-Users-craigdossantos-Coding-insightful/memory/reference_vercel_production_branch.md` documenting the dashboard path and the fact that the Vercel public API rejects every productionBranch field variant
- Added "PR & Branch Hygiene" section to `~/.claude/CLAUDE.md` (6 bullets: one atomic change per PR, bundling exceptions, short-lived branches, squash-merge, no "release PR" anti-pattern, bug-sprint workflow)
- Cleaned up stale worktree `.worktrees/fix/bugfix-worktree` (was holding a commit already shipped via PR #19); deleted local branch and origin ref
- Created new worktree `.worktrees/fix/pre-launch-bugs` on new branch `fix/pre-launch-bugs` (branched from `main@013ebca`, no upstream yet)
- Opened UX mockups and identified where the "lines of code" vanity metric lived before the homepage redesign lost it

## What Remains

- Relay the migration command to Kabir so his local clone can move from `feat/insightful-mvp` to `main`: `git fetch --prune origin && git branch -m feat/insightful-mvp main && git branch -u origin/main main`
- Triage the 9 open issues (#21–#29) filed from user feedback and start picking off per-bug branches cut from main (`fix/<slug>`) under the new hygiene rules — includes the "lines of code" metric restoration and API cost calculation off-by-~1000x among others
- (Optional) Clean up stale `.worktrees/feat/persistent-projects` worktree now that PR #20 is merged

## Known Issues

- Kabir's local clone still on `feat/insightful-mvp` — needs migration commands relayed (won't fetch or pull until renamed locally)
- Git history has two versions of the persistent-projects docs commits (`5d5d302/405c205/1c8fc94` on top of PR #19, plus duplicates `96392f1/7a62a34/8a234a6` preserved via PR #20's merge). Artifact of cross-worktree branching before the rebase — harmless but messy
- Pre-existing uncommitted files in primary clone (`.gitignore`, `agent/MEMORY.md`, `docs/superpowers/plans/2026-04-08-mermaid-workflow-diagrams.md`) are Craig's prior in-progress work — unrelated to this session, preserve as-is

## Key Decisions

- **Branch-rename sequence**: used "create parallel branch first, then flip Vercel, then change GitHub default, then delete old branch" instead of GitHub's native rename API — because Vercel validates the target branch exists before accepting a production-branch change, so the new branch must exist first
- **Branch protection**: minimal config (block force-push + deletion, no PR review requirement) — keeps solo iteration fast for the pre-launch sprint. Can tighten after launch
- **New worktree name**: `fix/pre-launch-bugs` accepted despite the plural-scope anti-pattern warning. Craig was advised to treat it as a triage workspace and cut per-bug branches (`fix/<slug>`) from it rather than accumulating unrelated fixes on one branch
- **Global CLAUDE.md edit**: codified the PR/branch hygiene discussion as durable rules rather than leaving it as one-off session advice

## Relevant Files

- `~/.claude/CLAUDE.md` — added "PR & Branch Hygiene" section
- `~/.claude/projects/-Users-craigdossantos-Coding-insightful/memory/reference_vercel_production_branch.md` — new reference memory
- `~/.claude/projects/-Users-craigdossantos-Coding-insightful/memory/MEMORY.md` — index entry added for the Vercel reference
- `.worktrees/fix/pre-launch-bugs/` — new worktree on branch `fix/pre-launch-bugs` (empty, no upstream)
- `docs/mockups/review-screen-redesign.html` — has the "lines of code" stat card to restore (+18.4k / -6.2k)
- `docs/mockups/homepage-redesign.html` — has the `+/-k` pattern
- No committed code changes to the repo this session — all changes were git/infra (branch rename, branch protection, worktree cleanup, global instructions)

## Context for Next Session

The big structural mistake of using `feat/insightful-mvp` as the de-facto trunk is now fixed. `main` is the real trunk, with branch protection, and Vercel deploys from it. The site is verified live at insightharness.com.

Kabir (on another Claude instance on this same machine) still has `feat/insightful-mvp` locally and needs to run the 3-command migration above — relay this before he next tries to fetch or pull.

Next work session should pick up pre-launch bugs. There are 9 open issues (#21–#29) filed from user feedback covering: sensitive-items button redesign, activity card heatmap fixes (no scroll, keep squares, big vanity numbers above), restore lines-of-code metric in 3 places, mermaid workflow diagram redesign, fix API cost calculation (off by ~1000x), project tiles clickable/smaller/repositioned, per-item eye toggle granularity, and OG sharing card fixes. Under the new hygiene rules each becomes its own `fix/<slug>` branch cut from main. The `.worktrees/fix/pre-launch-bugs` worktree is available as a triage/command-center workspace but individual fixes should land on per-bug branches.
