# Sponsor Integration Checklist

Everything you need to grab, install, or configure to integrate each Nozomio Hackathon sponsor into a project. Each section includes **step-by-step API-key creation** so you don't waste time hunting in dashboards.

> **All keys go in [`.env`](./.env)** at the repo root. `.env` is gitignored — never commit it.

---

## 0. Before you write any code (15 min)

- [ ] Confirm `.env` and `.gitignore` exist at repo root (they do — created already)
- [ ] Decide on a project name (you'll need it for Vercel + Convex + InsForge dashboards)
- [ ] `git init` if you haven't already; create the GitHub repo
- [ ] Pick a primary model strategy: **OpenAI + Gemini direct keys** (recommended) **vs Vercel AI Gateway** (one key for all providers, but $5 free credit burns fast)

---

## 1. Foundational LLM access (you need at least one)

### 🔑 OpenAI API key

1. Go to **[platform.openai.com](https://platform.openai.com/)** → sign in (or sign up)
2. Click your profile avatar (top-right) → **"View API keys"** — or go directly to **[platform.openai.com/api-keys](https://platform.openai.com/api-keys)**
3. Click **"+ Create new secret key"**
4. Name it (e.g., `nozomio-hackathon`), leave default permissions, click **Create**
5. **Copy the key immediately** — OpenAI hides it after this view
6. Add to `.env`:
   ```
   OPENAI_API_KEY=sk-proj-...
   ```
7. (Optional) Add billing in **Settings → Billing** if you don't already have credits — required for API access (even with the $10K hackathon credit, base account has to be billable)

### 🔑 Gemini API key (Google AI Studio)

1. Go to **[aistudio.google.com](https://aistudio.google.com/)** → sign in with a Google account
2. Click **"Get API key"** in the left sidebar — or go directly to **[aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)**
3. Click **"+ Create API key"**
4. Choose a Google Cloud project (or "Create API key in new project" if none)
5. Copy the key
6. Add to `.env`:
   ```
   GEMINI_API_KEY=AIza...
   ```
7. **Free tier is generous** — Gemini 2.5 Flash + 2.5 Pro have free quotas large enough for a full hackathon build; no billing setup required

### Install SDKs (do this once at project start)

```bash
npm i ai zod @ai-sdk/openai @ai-sdk/google @ai-sdk/react
```

---

## 2. Nia (host sponsor) — `https://apigcp.trynia.ai/v2`

### 🔑 How to get the API key

1. Easiest path: run **`npx nia-wizard@latest`** in your terminal — it auto-creates the account, generates the key, and writes it into your IDE config
2. Manual path:
   - Go to **[app.trynia.ai](https://app.trynia.ai/)**
   - Sign up / log in (Google or email)
   - Open **Settings → API Keys**
   - Click **"Create API Key"**, name it, copy the value
3. Add to `.env`:
   ```
   NIA_API_KEY=...
   ```

### Setup checklist

- [ ] Key generated and added to `.env`
- [ ] **Ask the Nozomio booth** for hackathon credits beyond the free tier (3 lifetime indexes is tight)
- [ ] Decide: pre-indexed package docs (instant) vs custom repo index (10 credits + indexing time)
- [ ] (Optional) Install MCP server for Claude Desktop / Cursor — see [docs.trynia.ai/llms.txt](https://docs.trynia.ai/llms.txt)
- [ ] Smoke test:
      ```bash
      curl -X POST https://apigcp.trynia.ai/v2/search \
        -H "Authorization: Bearer $NIA_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"mode":"query","messages":[{"role":"user","content":"hello"}]}'
      ```

---

## 3. Vercel — Next.js + AI SDK + AI Gateway

### 🔑 How to get the AI Gateway key (optional but useful)

1. Go to **[vercel.com](https://vercel.com/)** → sign in with GitHub
2. Top nav → click **"AI"** tab (or go to **[vercel.com/dashboard/ai](https://vercel.com/dashboard/ai)**)
3. Click **"Create Gateway"** if you don't have one
4. In the gateway dashboard → **API Keys → Create**
5. Copy and add to `.env`:
   ```
   AI_GATEWAY_API_KEY=...
   ```

### Setup checklist

- [ ] Install Vercel CLI: `npm i -g vercel` then `vercel login`
- [ ] Scaffold app: `npx create-next-app@latest`
- [ ] Install AI SDK: `npm i ai zod @ai-sdk/openai @ai-sdk/google @ai-sdk/react`
- [ ] (Optional, durable workflows) `npm i workflow` — see [workflow-sdk.dev](https://workflow-sdk.dev/)
- [ ] (Optional, code execution) `npm i @vercel/sandbox`
- [ ] `vercel link` to attach repo to a Vercel project
- [ ] Confirm preview URLs deploy on `git push`
- [ ] **Ask Vercel booth** for sponsor credit code

---

## 4. Hyperspell (DEDICATED TRACK — high priority)

### 🔑 How to get the API key

1. Go to **[hyperspell.com](https://www.hyperspell.com/)** → click **"Get Started"** / **"Sign up"**
2. If signup is gated, **find Conor or Manu at the Hyperspell booth** and ask for an account
3. Once logged in, navigate to **Settings → API Keys** (path may vary; check left sidebar)
4. Click **"Create API Key"**, name it, copy the value
5. Add to `.env`:
   ```
   HYPERSPELL_API_KEY=...
   HYPERSPELL_TOKEN=...        # same value — used by the MCP server
   ```

### Setup checklist

- [ ] Key generated and added to `.env`
- [ ] **Ask Conor / Manu** for elevated quota for the hackathon
- [ ] Install SDK — pick one:
  - `pip install hyperspell` (Python)
  - `npm i @hyperspell/hyperspell` (TS)
- [ ] (Recommended for the demo) Install MCP server for Claude Desktop:
      ```json
      // ~/Library/Application Support/Claude/claude_desktop_config.json
      "hyperspell": {
        "command": "npx",
        "args": ["-y", "hyperspell-mcp"],
        "env": { "HYPERSPELL_TOKEN": "..." }
      }
      ```
- [ ] Decide which connector to demo: Slack export, Gmail, Google Drive, Notion, Box
- [ ] **Pre-ingest your demo data the night before** — first-ingest latency is unbounded
- [ ] Smoke test: ingest 1 string, query it, confirm result returns

---

## 5. Devin (Cognition)

### 🔑 How to get the API key + Org ID

1. Go to **[devin.ai](https://devin.ai/)** → click **"Try Devin"** / sign up (Pro $20/mo or higher tier required for API access)
2. Once logged in, find your **Org ID** in the URL or in **Settings → Organization** — looks like `org_...`
3. Navigate to **Settings → API Keys** (or **Service Users** on Teams plan)
4. Click **"Create Service User Token"** / **"Create API Key"**
5. Copy the token (starts with `cog_`) — you can't view it again
6. Add to `.env`:
   ```
   DEVIN_API_KEY=cog_...
   DEVIN_ORG_ID=org_...
   ```

### Setup checklist

- [ ] Key + Org ID in `.env`
- [ ] **Ask Cognition booth** for hackathon ACU credits (~$2 per 15-min slice; this adds up fast)
- [ ] Set a hard ACU cap in your code — never let parallel Devins run unbounded
- [ ] Smoke test (warning: this consumes ACUs — keep prompt cheap):
      ```bash
      curl -X POST "https://api.devin.ai/v3/organizations/$DEVIN_ORG_ID/sessions" \
        -H "Authorization: Bearer $DEVIN_API_KEY" \
        -d '{"prompt":"echo hello and exit","create_as_user_id":"..."}'
      ```

---

## 6. OpenAI Codex

Codex shares auth with OpenAI — you have two paths:

### 🔑 Path A: ChatGPT login (recommended for ChatGPT Plus/Pro users)

1. Install CLI: `npm i -g @openai/codex` **or** `brew install --cask codex`
2. Run `codex` once
3. It opens a browser window — sign in with your ChatGPT account
4. Done — no key needed; usage counts against your plan limits

### 🔑 Path B: API key (recommended for the hackathon — uses API credits, not plan quota)

1. Reuse the same `OPENAI_API_KEY` from §1
2. Set it in your shell before running `codex`:
   ```bash
   export OPENAI_API_KEY=sk-proj-...
   codex
   ```

### Setup checklist

- [ ] CLI installed
- [ ] (Optional) Install Chrome extension (launched May 7, 2026)
- [ ] (Optional) Add `AGENTS.md` to repo root for persistent agent instructions
- [ ] **Ask the SF Codex Ambassador on-site**: best path for $10K credit redemption + any Codex-track judging signal
- [ ] Set explicit iteration cap in CLI loops (`/goal` will run forever otherwise)

---

## 7. InsForge

### 🔑 How to get the credentials

1. Go to **[insforge.dev](https://insforge.dev/)** → click **"Sign Up"**
2. Authenticate with GitHub or email
3. From the dashboard, click **"+ New Project"** → name it → choose region
4. After provisioning, the project page shows:
   - **Project URL / Base URL** (looks like `https://<project>.insforge.app` or similar)
   - **Anon Key** (publishable, safe for client)
   - **Service Role Key** (secret — server-only, optional)
5. Add to `.env`:
   ```
   INSFORGE_BASE_URL=https://...
   INSFORGE_ANON_KEY=...
   INSFORGE_SERVICE_ROLE_KEY=...    # optional
   ```

### Setup checklist

- [ ] Project created, URL + anon key in `.env`
- [ ] CLI: `npx @insforge/cli create` (scaffolds project + agent rules)
- [ ] SDK: `npm i @insforge/sdk`
- [ ] **Ask InsForge booth** for: (a) sponsor key that disables 1-week idle pause, (b) bumped AI gateway credits
- [ ] (Optional) Configure MCP server so coding agents can provision schema autonomously
- [ ] Decide: keep RLS-on-by-default (safer) or disable for demo (faster agent flows)

---

## 8. Tensorlake

### 🔑 How to get the API key

1. Go to **[tensorlake.ai](https://www.tensorlake.ai/)** → click **"Get Started"** / **"Sign Up"**
2. Authenticate (Google / GitHub / email)
3. From the dashboard, navigate to **Settings → API Keys**
4. Click **"Create API Key"**, name it, copy the value
5. Add to `.env`:
   ```
   TENSORLAKE_API_KEY=...
   ```

### Setup checklist

- [ ] Key in `.env`
- [ ] Pick SDK: `pip install tensorlake` (Python) **or** `npm i tensorlake` (TS)
- [ ] CLI (optional): `pip install tensorlake[cli]` then `tl --help`
- [ ] **Ask Diptanu / Tensorlake booth** for hackathon credits beyond 2 concurrent
- [ ] Choose image: `tensorlake/ubuntu-minimal` (200ms boot) vs `tensorlake/ubuntu-systemd` (~1s) vs `tensorlake/ubuntu-vnc` (computer-use)
- [ ] Smoke test:
      ```python
      from tensorlake.sandbox import SandboxClient
      with SandboxClient.for_cloud(api_key="...").create_and_connect("tensorlake/ubuntu-minimal") as sb:
          print(sb.run("sh", ["-lc", "echo hi"]).stdout)
      ```

---

## 9. Convex

### 🔑 How to get the credentials (auto-provisioned)

Convex is special — you don't manually create keys. The CLI provisions them.

1. Run `npx convex dev` in your project root
2. It opens a browser window → sign in with GitHub or Google
3. Choose **"Create a new project"** → name it
4. The CLI **automatically writes** `CONVEX_URL` and `CONVEX_DEPLOYMENT` to `.env.local` (or `.env`)

If you need to manually copy values:
- Go to **[dashboard.convex.dev](https://dashboard.convex.dev/)** → select project
- **Settings → URL & Deploy Key** shows both values

### Setup checklist

- [ ] `npx create convex@latest` (or add to existing: `npm i convex`)
- [ ] `npx convex dev` to provision dev deployment
- [ ] (For agent component) `npm i @convex-dev/agent`
- [ ] Register the agent component in `convex/convex.config.ts`
- [ ] Confirm `useQuery` reactivity works in your Next.js app (Convex Provider in `app/providers.tsx`)
- [ ] **Ask Convex booth** for sponsor credit code (bumped action-compute hours)
- [ ] (Optional) Install Convex MCP server for IDE assistance

---

## 10. Reacher (no public dev API)

**No API key path exists.** Integration options:

- [ ] Sign up for 10-day free trial at **[reacherapp.com/pricing](https://reacherapp.com/pricing)**
- [ ] Ask Reacher booth for sandbox/partnership access
- [ ] Plan for browser automation (Playwright / BrowserBase) as the integration layer
- [ ] **Do not** scrape TikTok directly — TOS risk that judges may flag

---

## 11. Aside (waitlist only)

**No public API key. No SDK.** Integration is gated by founder access.

- [ ] Join waitlist at **[aside.computer](https://aside.computer/)** — *do this immediately, regardless of project*
- [ ] **Find Jun Kim / Chanhee Lee / Sanghun Lee at the EF venue in person**
- [ ] Ask explicitly for: beta build, any internal extension/agent-action API, security model docs
- [ ] **Decision rule:** if you don't have a working Aside build by Hour 2, drop it from the project — fall back to OSS (Browser Use / Stagehand / Browserbase)

---

## 12. Cross-cutting infra (only if your stack uses it)

### 🔑 GitHub Personal Access Token (if Devin/Codex will open PRs against a private repo)

1. Go to **[github.com/settings/tokens](https://github.com/settings/tokens)** → **"Generate new token (classic)"** or fine-grained
2. Scopes needed: `repo` (full), optionally `workflow`
3. Copy → add to `.env`:
   ```
   GITHUB_TOKEN=ghp_...
   ```

### 🔑 ElevenLabs (voice projects)

1. Go to **[elevenlabs.io](https://elevenlabs.io/)** → sign up
2. Profile icon → **API Key** → copy
3. Add to `.env`:
   ```
   ELEVENLABS_API_KEY=...
   ```

### 🔑 Browserbase (browser automation fallback if Aside denied)

1. Go to **[browserbase.com](https://www.browserbase.com/)** → sign up
2. Dashboard → **Settings → API Keys** → create
3. Add to `.env`:
   ```
   BROWSERBASE_API_KEY=...
   BROWSERBASE_PROJECT_ID=...
   ```

Alternatively for local browser automation: `npm i playwright && npx playwright install chromium`

---

## 13. Booth lap (do in first 30 min on-site)

A single 20-minute walk hits every booth. Bring a notepad. Ask each:

- [ ] Sponsor credits / elevated key → who to email if you hit a wall later
- [ ] Track-specific judging criteria (especially Hyperspell + Nia)
- [ ] Recent gotchas they'd flag for hackathon use
- [ ] Founder availability for live debugging

---

## 14. Pre-demo readiness (Hour 10–12)

- [ ] All env vars committed to a *shared* `.env.example` (no secrets) so teammates can clone & run
- [ ] Production Vercel URL deployed and tested on phone
- [ ] 90-second Loom of the happy path recorded as backup
- [ ] Phone hotspot pre-tested (wifi at hackathons always fails)
- [ ] Architecture diagram slide ready as fallback if a tool dies on stage
- [ ] All sponsor logos in README + GitHub repo public
- [ ] Submission form filled out (don't leave this for the last 5 minutes)

---

## Master env-var reference

The full list — also see [`.env`](./.env) at repo root:

```bash
# LLMs
OPENAI_API_KEY=
GEMINI_API_KEY=
AI_GATEWAY_API_KEY=          # Vercel — optional

# Sponsors
NIA_API_KEY=
HYPERSPELL_API_KEY=
HYPERSPELL_TOKEN=            # for the MCP server (same value as HYPERSPELL_API_KEY)
DEVIN_API_KEY=               # cog_...
DEVIN_ORG_ID=                # org_...
INSFORGE_BASE_URL=
INSFORGE_ANON_KEY=
INSFORGE_SERVICE_ROLE_KEY=   # optional, server-only
TENSORLAKE_API_KEY=
CONVEX_URL=                  # auto-written by `npx convex dev`
CONVEX_DEPLOYMENT=           # auto-written by `npx convex dev`

# Optional cross-cutting
GITHUB_TOKEN=                # ghp_...
ELEVENLABS_API_KEY=
BROWSERBASE_API_KEY=
BROWSERBASE_PROJECT_ID=
```
