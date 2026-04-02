# CLAUDE.md (Root Template)

<!-- TODO: Paste your project playbook here (from our canvas). -->
<!-- You can edit this file anytime; /init will copy it into new repos as CLAUDE.md. -->

## Mission
Ship maintainable features quickly with tests and a11y baked in. Prefer small PRs.

## Stack Snapshot
- Next.js (App Router), TypeScript strict, Tailwind, shadcn/ui, Prisma/Postgres.

## Commands
- npm i | dev | build | start
- npm run typecheck | lint | test
- npx playwright test | npx playwright test --ui | npx playwright show-report

## Git Workflow
**ALWAYS work on feature branches:**
```bash
git checkout -b feature/your-feature-name
# work on changes
git add . && git commit -m "feat: your changes"
git push -u origin feature/your-feature-name
# create PR to merge back to main
```

## Rules of Engagement
- **Branch first:** Never work directly on main
- Explore → Plan → Implement → Verify → PR
- Don't touch .env or secrets without explicit approval
- Validate inputs with Zod; return typed responses

## Definition of Done
- Builds, lints, tests pass; a11y ≥ 90
- Playwright visual tests pass with screenshots
- PR shows before/after screenshots for UI changes
- Feature branch merged via PR (never direct push to main)

## Directory Map
- app/, components/, lib/, app/api/, prisma/, e2e/

## Security
- No PII in logs; mask tokens; least privilege.

## Visual Testing with Playwright
**For UI changes, ALWAYS:**
```bash
npx playwright test --headed    # Visual verification
npx playwright test --ui        # Interactive debugging
npx playwright show-report      # Review test results
```

**Screenshot workflow:**
1. Run tests to capture current state
2. Make UI changes
3. Run tests again to compare
4. Include before/after in PR

## Checklists
- [ ] Created feature branch (not working on main)
- [ ] Added/updated tests (unit + Playwright)
- [ ] Playwright visual tests pass
- [ ] Screenshots for UI changes
- [ ] Updated docs/CHANGELOG
- [ ] PR created from feature branch
- [ ] Rollback plan noted
