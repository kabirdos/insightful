# Mac Mini QA Runner Setup

Self-hosted GitHub Actions runner on the Mac Mini that automatically runs Claude-powered QA tests (via Playwright) when code is pushed to feature branches or PRs targeting main.

## How It Works

1. Push code from dev machine to GitHub
2. GitHub Actions triggers the `qa.yml` workflow
3. The workflow routes to the Mac Mini (the self-hosted runner)
4. Mac Mini clones the repo, boots the dev server, and runs Claude Code with Playwright MCP
5. Claude navigates the app in a real browser, tests all pages/flows, and reports pass/fail
6. Results appear in the GitHub Actions log (and as a PR comment if triggered by a PR)

## What Was Set Up

### On the Mac Mini

1. **GitHub Actions runner** installed at `~/actions-runner`
   - Registered with `craigdossantos/insightful` repo
   - Running as a background service (starts on boot)

2. **Claude Code** installed globally via `npm install -g @anthropic-ai/claude-code`

3. **Playwright MCP** added to Claude Code:
   ```bash
   claude mcp add playwright -- npx @anthropic-ai/mcp-playwright
   ```

### On GitHub

- **Workflow file:** `.github/workflows/qa.yml`
- **Repository secrets** added (Settings > Secrets and variables > Actions):
  - `ANTHROPIC_API_KEY`
  - `DATABASE_URL`
  - `DIRECT_URL`
  - `AUTH_SECRET`
  - `AUTH_GITHUB_ID`
  - `AUTH_GITHUB_SECRET`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Triggering a Run

- **Automatic:** Push to any `feat/*` branch or open a PR to `main`
- **Manual:** GitHub repo > Actions tab > "QA Testing on Mac Mini" > "Run workflow"

## Stopping the Runner

Temporarily stop (can restart later):

```bash
cd ~/actions-runner
./svc.sh stop
```

Restart after stopping:

```bash
cd ~/actions-runner
./svc.sh start
```

## Full Removal

### 1. Stop and uninstall the service

```bash
cd ~/actions-runner
./svc.sh stop
./svc.sh uninstall
```

### 2. Remove the runner from GitHub

Option A — from the command line:

```bash
cd ~/actions-runner
./config.sh remove --token PASTE_REMOVAL_TOKEN
```

Get the removal token from: GitHub repo > Settings > Actions > Runners > click the runner > Remove.

Option B — from the browser: go to the same page and click Remove directly.

### 3. Delete the runner files

```bash
rm -rf ~/actions-runner
```

### 4. Remove the workflow file

Delete `.github/workflows/qa.yml` from the repo so pushes no longer trigger the (now-missing) runner.

### 5. Optionally remove GitHub secrets

GitHub repo > Settings > Secrets and variables > Actions > delete the secrets listed above.
