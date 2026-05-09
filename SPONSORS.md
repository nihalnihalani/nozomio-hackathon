# Nozomio Hackathon — Sponsor Tools Brief

**Event:** Nozomio Hackathon · May 9, 2026 · 8 AM–8 PM PDT · EF Office, San Francisco
**Theme:** Build the Future of AI Agents
**Compiled:** May 9, 2026 (research synthesized from a parallel agent team + `/last30days` social-signal scans + official docs)

> **If you only have 5 minutes:** scroll to **[Project Strategy](#project-strategy-winning-path-picks)** for the ranked build plan and the *one decision* to make in 30 minutes. Then read the **[Devil's Advocate](#devils-advocate-skeptics-audit)** to know what will break. Come back to per-sponsor detail as needed.

---

## TL;DR — Prize Tracks at a Glance

| Track | Prize | Win condition (in one sentence) |
|---|---|---|
| **Overall 1st** | M5 MacBook Pro / cash + guaranteed interviews + 10K OpenAI credits | Build the most ambitious, working agent — host (Nozomio/Nia) is the obvious context backbone |
| **Overall 2nd** | M4 Mac Mini / cash + 5K OpenAI credits + $500 | Same axis, slightly less polish |
| **Overall 3rd** | AirPods Pro / cash + 1K OpenAI credits + $300 | Same axis, scrappier |
| **Top 6** | Hinge Premium | Solid demo |
| **Hyperspell track** | $1K cash + 6 mo unlimited Hyperspell + working session with founders Conor + Manu + amplification | Agent that is *measurably smarter* because Hyperspell joined info across real connectors live on stage |
| **"Vegas trip"** | First-class flight to gamble for pre-seed | Probably a separate vibes/judgment award |
| **Stussy gear, sponsor interviews** | — | Track-specific — talk to the booth |

**Most strategically valuable prize:** the Hyperspell founder working session. Founder time + 6 mo unlimited usage is worth far more than $1K to anyone planning to keep building.

**Most-credit-multiplier sponsor:** OpenAI Codex (the 1st-place 10K credits map directly to Codex tokens).

---

## Sponsor Stack — Mental Model

```
┌─────────────────── User-facing layer ──────────────────┐
│  Vercel (Next.js + AI SDK)        Aside (browser OS)   │
└────────────────────────────────────────────────────────┘
┌─────────────────── Agent runtime ──────────────────────┐
│  Devin (cloud agent)         OpenAI Codex (cloud+CLI)  │
│  Vercel Workflow / Sandbox   Tensorlake (stateful VMs) │
└────────────────────────────────────────────────────────┘
┌─────────────────── State + memory ─────────────────────┐
│  Convex (reactive TS DB)     InsForge (Postgres BaaS)  │
│  Hyperspell (memory layer)   Nia (search/index)        │
└────────────────────────────────────────────────────────┘
┌─────────────────── Vertical use case ──────────────────┐
│  Reacher (creator marketing — SaaS, no public API)     │
└────────────────────────────────────────────────────────┘
┌─────────────────── Organizer ──────────────────────────┐
│  AI Nexus (event agency — not a tool)                  │
└────────────────────────────────────────────────────────┘
```

---

## Nia (Nozomio)

**What it is.** Nia is a search-and-indexing API from Nozomio Labs that gives AI agents continuous, up-to-date context across repositories, docs, PDFs, datasets, Slack, Google Drive, and local folders. It exposes an MCP server plus REST endpoints so agents like Cursor, Claude Code, Cline, Continue, Windsurf, and Zed can retrieve grounded, cited context instead of relying on stale training data ([trynia.ai](https://www.trynia.ai/), [docs.trynia.ai/welcome](https://docs.trynia.ai/welcome)).

**Why it's relevant for this hackathon.** Nozomio is the host sponsor, and the theme is "Build the Future of AI Agents." Nia is literally the context layer for agents, so winning the host prize almost certainly means using Nia's API/MCP server as the retrieval backbone of your agent. Founder Arlan reportedly raised $6.2M from Paul Graham positioning Nozomio as "Google for agents" ([@David_mduw](https://x.com/David_mduw/status/2044174991810248973)).

**Core capabilities.**
- **Continuous indexing** of GitHub repos, doc sites, arXiv papers, HuggingFace datasets, PDFs, spreadsheets, local folders, Slack, Google Drive, and chat history; auto-sync keeps sources fresh.
- **150M+ pre-indexed package docs** across PyPI, NPM, Crates.io, and Go modules (instant — no indexing step).
- **Search modes:** `query` (hybrid vector + BM25 over your indexed sources), `web` (live web), `deep` (research with reasoning), `universal` (combined). Plus grep/regex and MongoDB text search.
- **Agents:** Oracle (autonomous research with sessions/streaming), Tracer (GitHub code search without pre-indexing), Document Agent (cited PDF Q&A).
- **Retrieval format:** synthesized answer + cited source references + metadata; supports `include_sources`, `fast_mode`.
- **Context Sharing** endpoints let multiple agents save/retrieve episodic memory across sessions.

**API & SDK.** Bearer-token auth (`Authorization: Bearer <NIA_API_KEY>`) against base URL `https://apigcp.trynia.ai/v2`. Official **Python and TypeScript SDKs**, an **MCP server**, a **CLI**, and **LangChain** integration. Key endpoints: `POST /search`, sources CRUD, `/oracle/*`, `/tracer/*`, document/PDF processing, vault workflows, GitHub tree/file reads, and connectors for Slack/Drive/X ([docs.trynia.ai/llms.txt](https://docs.trynia.ai/llms.txt)).

**Pricing & hackathon access.** Free tier: **50 queries/mo, 20 web searches, 50 package searches, 5 contexts, 3 lifetime indexes** ([docs.trynia.ai/pricing](https://docs.trynia.ai/pricing)). Builder is $15/mo for 1k queries. Credits: 1 per search, 10 per index, 10 deep-research, 15 Oracle/Tracer. Sign up at **app.trynia.ai**. **No hackathon-specific credits are documented** — assume the host will hand out keys/credits on-site; ask the Nozomio team.

**Quick start.**
```bash
npx nia-wizard@latest          # auto-creates account, key, configures IDE
```
```js
const r = await fetch('https://apigcp.trynia.ai/v2/search', {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.NIA_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ mode: 'query', messages: [{ role: 'user', content: 'How does X work?' }],
                         repositories: ['owner/repo'], include_sources: true, fast_mode: true })
});
```

**Recent activity (last 30 days).**
- [@thecaptabletv](https://x.com/thecaptabletv/status/2046667170906771878) (Apr 21, 2026) announced Nozomio sponsorship, calling it "the context layer for AI."
- [@David_mduw](https://x.com/David_mduw/status/2044174991810248973) (Apr 14): "19-year-old just raised $6.2M from @paulg to build Google for agents."
- YouTube: ["nia sandbox search"](https://www.youtube.com/watch?v=Ie1aIjj8D6s) by founder arlan (Apr 8); ["Nia vs Context7"](https://www.youtube.com/watch?v=LdknkPaL67s) walkthrough — claims state-of-the-art on code-hallucination benchmarks, episodic memory across agent sessions, "index <thing>" one-line UX.
- New repos shipped: `nia-plugin` (Claude Code), `nia-opencode`, `nia-wizard`, `nia-rules-for-agents`, `nia-epstein-ai` (a viral demo indexing 100M words of Epstein files). Reddit/HN had **zero** matching threads in the last 30 days — limited social discussion.

**Strengths vs alternatives.**
- **vs Exa/Perplexity:** Exa is web-only; Nia indexes *your* repos/docs/PDFs/datasets continuously and adds package-doc search out-of-the-box.
- **vs Context7:** Context7 is a curated doc lookup; Nia indexes arbitrary sources, supports deep research agents (Oracle/Tracer), and offers cross-agent memory.
- **vs ContextBank/Greptile:** Nia spans code + docs + papers + connectors (Slack/Drive) in one API and ships an MCP server already wired into 30+ agents.
- Continuous auto-sync, 5x cheaper claim, hybrid search, and ready-made plugins for every major coding agent.

**Gotchas / open questions.**
- Free tier's **3 lifetime indexes** is tight — plan demos around pre-indexed packages or one big repo.
- Indexing takes 10 credits each; budget carefully.
- **Latency, freshness window, and rate limits not stated** in public docs.
- Some doc URLs 404 (`/api-reference/index`, `/sdks/python`, `/sdks/quickstart`) — best to use `npx nia-wizard@latest` and read `docs.trynia.ai/llms.txt` directly.
- E2E-encrypted local sync is advertised but the trust model for cloud-indexed sources isn't spelled out.
- Concurrent index = 1 on free; parallel ingestion needs Builder+.

**Hackathon project angles.**
1. **"Talk to your stack" agent** — index your team's GitHub org + Notion/Drive + Slack via Nia connectors, expose a CopilotKit chat that answers "why did we choose X?" with citations across code+docs+conversations. Leans on connectors + Context Sharing + Oracle.
2. **Research-paper coding companion** — index an arXiv collection (e.g., recent agent papers) plus reference impls, and build an agent that, given a paper, generates a faithful PyTorch implementation using Nia's `deep` mode for grounded retrieval. Showcases papers + code together — a Nia differentiator.
3. **Always-current docs MCP for any framework** — let users paste any doc URL or repo, Nia continuously indexes it, and your agent serves as a Cursor/Claude-Code MCP that beats Context7 by staying live-synced. Demo: ask about a feature merged 24h ago and watch it answer correctly.

---

## Hyperspell  *(DEDICATED TRACK — $1K cash + 6mo unlimited usage + founder working session + amplification)*

### What it is
Hyperspell is a **memory and context layer for AI agents** — it ingests data from a user's tools (Slack, Gmail, Google Drive, Google Calendar, Notion, Box, plus uploaded files and raw text), builds a personalized "Agentic Memory Network" / context graph, and exposes it to any agent through a simple query API. Think of it as the "company brain" your agent reads from instead of you re-pasting docs into prompts. Founded 2024 by **Conor Brennan-Burke** (ex-Checkr, ran $30M ARR API biz) and **Manu Ebert** (15+ yrs ML, built Airbnb's first knowledge graph). YC F25, SOC 2 certified, GDPR compliant ([YC](https://www.ycombinator.com/companies/hyperspell), [hyperspell.com](https://www.hyperspell.com/), [Every profile](https://www.every.io/blog-post/ai-agents-are-the-future-conor-brennan-burke-is-building-the-infrastructure-that-enables-them-to-run)).

### Why it's relevant for this hackathon
Theme is "Build the Future of AI Agents" and Hyperspell's entire pitch is **the memory/context substrate every serious agent needs**. They're a sponsor with their own track and the prize bundle is unusually rich: **$1k cash + 6 months of unlimited usage + a working deploy session with Conor & Manu + amplification on Hyperspell channels**. The founder time alone is arguably the most valuable piece — Conor is publicly obsessive about flying out to set up customers in person ([Grace Gong interview](https://www.youtube.com/watch?v=oJblqCulVWU)).

### Core capabilities
- **Pre-built connectors:** Slack, Gmail, Google Drive, Google Calendar, Notion, Box, plus generic file/URL/text ingest. New integrations ship weekly per their site ([hyperspell.com](https://www.hyperspell.com/)).
- **Hyperspell Connect:** drop-in OAuth UI so end-users link their own accounts; per-user data isolation and access controls ([docs](https://docs.hyperspell.com/core/integration)).
- **Continuous indexing + context engineering:** auto-extracts people, projects, facts; reinforces what gets recalled (memory improves with use).
- **Multi-source query with weighting:** query Slack + Gmail simultaneously, apply per-source weights to bias retrieval.
- **Filesystem-style surface** over the context graph (per the homepage framing).

### API & SDK
- **Auth:** Bearer token from dashboard; per-user `user_id` / `userID` scoping ([API intro](https://docs.hyperspell.com/api-reference/introduction)).
- **Official SDKs:** Python (`pip install hyperspell`, 3.9+), Node/TS (`npm i @hyperspell/hyperspell`), Go (`hyperspell-go`), plus a CLI (`hyperspell-cli`) — all updated within the last few days as of May 8–9, 2026 ([GitHub org](https://github.com/hyperspell)).
- **MCP server:** `hyperspell-mcp` exposes memories as MCP tools/resources for Claude Desktop, ChatGPT, Cursor etc. via `HYPERSPELL_TOKEN` env var ([MCP docs](https://docs.hyperspell.com/advanced/mcp-overview), [Smithery](https://smithery.ai/server/@hyperspell/hyperspell-mcp/api)).
- **Claude Code plugin:** `hyperspell/claude` repo ships skills/plugins for Claude Code (14 stars).
- **Event hooks:** not surfaced clearly in public docs — likely poll/query model rather than push webhooks.

### Pricing & hackathon access
Public pricing is **not disclosed** ([G2](https://www.g2.com/products/hyperspell/pricing)). They mention "free trials to enterprise" tiers and per-user pricing in the founder interview. **Hackathon-specific:** assume sponsored credits are available on-site — ask the Hyperspell table for an elevated key. The prize itself includes 6 months unlimited.

### Quick start (Python)
```python
import os
from hyperspell import Hyperspell

client = Hyperspell(api_key=os.environ["HYPERSPELL_API_KEY"], user_id="user_123")

# Ingest
client.memories.add(text="Acme's Q3 OKR is to ship the agent SDK by Oct 15.")

# Query (multi-source: combine memories + connected Slack/Gmail)
result = client.memories.search(query="What's our Q3 priority?", options={"filter": {}})
print(result)
```

### Recent activity (last 30 days)
Quiet on Reddit/HN, but **all SDKs were updated May 8–9, 2026** (today/yesterday) — node-sdk, python-sdk, go, CLI, MCP server are all actively maintained ([GitHub org](https://github.com/hyperspell)). On X, only 2 posts in the last 30 days mention Hyperspell — notably @PostleTyler tagging `@conor_ai` and `@hyperspell` as a "memory context layer for direct agent use" (Apr 9, 2026). The most substantive recent media is the Nov 2025 Grace Gong interview with Conor (~19.5k views). Public testimonial customers on the homepage: Hobbes, Intently, Scale Agentic.

### Strengths
- **SOC 2 + GDPR** out-of-the-box — rare for a YC F25 startup.
- **Breadth of connectors with one OAuth widget** — saves you days of building Slack/Gmail integrations yourself.
- **Active SDKs across Python/TS/Go + first-class MCP** means you can plug it into almost any agent stack.
- **Founder working session as prize** — Conor explicitly says he flies to customers and stays up till 4am helping; that time is worth far more than $1k.

### Gotchas / open questions
- **First-ingest latency:** indexing a real Slack workspace + Gmail can take a while; budget for it before your demo.
- **Source freshness:** docs don't clearly state webhook/push refresh vs polling — agents acting on "what just happened in Slack 30 seconds ago" may have a freshness gap.
- **ACL semantics:** per-user isolation is documented, but cross-user / team-shared memory rules aren't deeply spec'd publicly.
- **Pricing opacity:** no public free tier — confirm hackathon credits early.
- **Public usage signal is thin:** few Reddit/HN/X mentions; you're early enough that founders will personally judge submissions.

### What would WIN the Hyperspell track
Conor's recurring themes — "make customers the hero," "infrastructure for builders," "memory is what makes agents useful" — point at one judging criterion: **does your agent feel meaningfully smarter because of Hyperspell, in a way it could not be without it?** The win is a demo where:
1. You connect a *real* messy data source live (Slack export or Gmail) on stage,
2. The agent answers a question that is **only solvable by joining info across sources** (e.g., "who on the team is blocked on the Acme deal and what did they say about it last week?"),
3. The agent shows **learning over time** — second query is visibly better than the first because Hyperspell reinforced the right memories,
4. You show the **MCP server plugged into Claude Desktop or Cursor** so the judges can see it work in their daily tools,
5. Bonus: it's vertical-specific (sales agent, on-call SRE agent, exec assistant) so the founders can see real GTM pull.

Avoid: generic RAG demos that could've used any vector DB. Hyperspell's wedge is **connectors + memory reinforcement + ACL** — show all three.

### Hackathon project angles
1. **"Onboarding buddy" agent** — new hire connects Slack + Gmail + Notion via Hyperspell Connect, agent answers "who owns X?" and "what's the status of project Y?" with cited sources.
2. **AE/sales copilot in Cursor or Claude Desktop via MCP** — Hyperspell ingests Gmail + Slack DMs + CRM notes, MCP exposes "draft follow-up for $deal" as a tool.
3. **On-call/incident agent** — ingest Slack #incidents + GitHub + runbooks, agent triages a new alert by recalling similar past incidents.
4. **Personal "second brain" voice agent** — phone call interface that answers "what did Manu and I decide about pricing on Tuesday?" by querying across Calendar + Gmail + Slack.
5. **Agent-of-agents router** — a meta-agent uses Hyperspell as the shared memory bus so multiple specialist sub-agents coordinate via persisted context rather than passing giant prompts.

---

## Vercel

**What it is.** Vercel is best known as the deploy-on-push platform behind Next.js, but in 2026 their AI-agent stack is the real story. It centers on five primitives that snap together: the **AI SDK** (TypeScript toolkit for LLM calls, tools, and agents), the **AI Gateway** (a unified, no-markup proxy in front of hundreds of models), the **Workflow DevKit / Vercel Workflows** (durable, crash-safe, resumable functions), **Vercel Sandbox** (Firecracker microVMs for untrusted/AI-generated code), and **Vercel Functions on Fluid Compute** (serverless runtime billed on active CPU only). Together they cover the full agent loop: model call → tool execution → durable orchestration → safe code execution → deploy ([sdk.vercel.ai](https://ai-sdk.dev/docs/introduction)).

**Why it's relevant for this hackathon.** Frontend speed is the obvious win — `npx create-next-app` plus a single `app/api/chat/route.ts` gets you a streaming agent UI in minutes, and `git push` deploys it. But the bigger leverage at a 24-hour event is the AI Gateway: one API key gets you OpenAI, Anthropic, Google, xAI, and open models with automatic fallback, so you don't burn time juggling provider keys or rate limits.

**Core capabilities.**
- **AI SDK 6** — `generateText`, `streamText`, `generateObject` (Zod-typed), `tool({...})` with `inputSchema` + `execute`, agent loops via `stopWhen`, and the new `ToolLoopAgent` interface. AI SDK 6 (Oct 2025) added `needsApproval` for human-in-the-loop, MCP support, DevTools, and reranking ([vercel.com/blog/ai-sdk-6](https://vercel.com/blog/ai-sdk-6)).
- **AI Gateway** — Unified endpoint (`https://ai-gateway.vercel.sh/v1`) with model strings like `"openai/gpt-5.2"` or `"anthropic/claude-opus-4.5"`. Routing, fallback, observability, BYOK with 0% markup ([vercel.com/ai-gateway](https://vercel.com/ai-gateway)).
- **Workflow DevKit (WDK)** — Open-source TS framework where two directives turn async functions into durable workflows that survive deploys, crashes, and pause-for-months sleeps. Now GA ([vercel.com/blog/introducing-workflow](https://vercel.com/blog/introducing-workflow)).
- **Vercel Sandbox** — Firecracker microVMs (node22/24, python3.13) that boot in milliseconds with sudo, isolated FS/network, runtime egress policies, and credential brokering so secrets never enter the VM ([vercel.com/docs/vercel-sandbox](https://vercel.com/docs/vercel-sandbox)).
- **Fluid Compute** — Serverless with default 300s timeout (configurable via `maxDuration`), billed on active CPU only — pauses while you wait on LLM streams.

**API & SDK.** `npm i ai` (core), plus optional `@ai-sdk/react`, `@ai-sdk/openai`, `@ai-sdk/anthropic`. With AI Gateway you typically only need `AI_GATEWAY_API_KEY`. For Workflows: `npm i workflow`. For Sandbox: `npm i @vercel/sandbox`.

**Pricing & hackathon access.** Hobby plan is free. Every team gets **$5/month free AI Gateway credits** at list price with no markup. Vercel has run multiple agent hackathons with credit prizes — worth asking the rep at the EF office.

**Quick start.**
```bash
npx create-next-app@latest my-agent && cd my-agent && npm i ai zod
```
```ts
// app/api/chat/route.ts
import { streamText, tool } from 'ai';
import { z } from 'zod';
export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({
    model: 'anthropic/claude-opus-4.5', // routed via AI Gateway
    messages,
    tools: { search: tool({ description: 'Search', inputSchema: z.object({ q: z.string() }), execute: async ({ q }) => ({ q }) }) },
    stopWhen: ({ steps }) => steps.length >= 5,
  });
  return result.toDataStreamResponse();
}
```

**Recent activity (last 30 days).** Matt Pocock's "AI SDK 6 is SWEET" deep-dive on `needsApproval` and the new `Agent` interface. freeCodeCamp launched a full AI-SDK support-agent course. NPM downloads went from 400K → ~4M/year. One developer publicly debated migrating off AI SDK to Codex/Google Agents SDK ([@lumaBuilds](https://x.com/lumaBuilds/status/2051829067280769143)) — competition is heating up.

**Strengths.** Best-in-class TS DX, model-agnostic via Gateway, deploy-on-PR with preview URLs (great for judging), tight Next.js integration, durable workflows now GA, Sandbox solves the AI-code-execution problem cleanly.

**Gotchas / open questions.** Edge runtime has shorter limits than Node — long agent loops need Node functions or Workflows. Default 300s function timeout is fine for most chats but not multi-hour agents (use Workflows). AI Gateway's $5 free credits burn fast on GPT-5.2 / Opus 4.5 — bring your own key if possible. Cold starts are reduced by Fluid Compute but still exist on first hit.

**Hackathon project angles.**
1. **"Browse-and-build" coding agent** — Next.js + AI SDK + **Vercel Sandbox** for executing the agent's generated code, plus Workflows for multi-step "plan → write → test → fix" loops that survive a refresh.
2. **Multi-model judge** — AI Gateway routes the same prompt to 3+ models in parallel, AI SDK `generateObject` returns structured rubric scores, frontend shows a side-by-side diff.
3. **Long-running research agent** — Workflow DevKit drives a durable research loop, pausing for human approval via AI SDK's `needsApproval`, posting progress to a Next.js dashboard.

---

## Devin (Cognition)

**What it is.** Devin is Cognition AI's autonomous coding agent — a "remote teammate" that runs in its own cloud sandbox VM with a shell, browser, code editor, and persistent file system. You hand it a task (a ticket, a Slack message, a webhook) and it plans, codes, runs tests, and opens a PR with minimal supervision ([devin.ai](https://devin.ai/), [cognition.ai/blog/devin-2](https://cognition.ai/blog/devin-2)).

**Why it's relevant for this hackathon.** Devin is unusual among sponsors because it's *itself* an agent you can orchestrate over a REST API — perfect for hackathon projects that fan out work, build "agent of agents" demos, or create new front-ends (Slack bots, Linear/Jira hooks, dashboards) on top of long-running cloud sessions.

**Core capabilities.** Step-by-step Interactive Planning, Devin Search and Devin Wiki for codebase Q&A, full Linux VM with shell + browser + VS Code, GitHub PR creation/iteration, Slack/Teams/Linear/Jira hand-offs, MCP secret scoping, Datadog/Amplitude/Granola integrations.

**API & SDK.** The v3 External API lives at `https://api.devin.ai/v3/organizations/*` and uses `cog_`-prefixed service-user bearer tokens. You `POST /sessions` with a prompt to launch a Devin, send messages mid-run, fetch session details, and trigger `POST /v3/organizations/{org_id}/pr-reviews` for automated PR review. There's also an unofficial `devin-cli` on PyPI ([docs.devin.ai/api-reference/overview](https://docs.devin.ai/api-reference/overview)).

**Pricing & hackathon access.** Free tier (limited usage + Devin Review + DeepWiki), Pro $20/mo, Max $200/mo, Teams $80/user/mo, Enterprise custom. Usage is metered in **ACUs** (Agent Compute Units; 1 ACU ≈ 15 minutes of active autonomous work; ~$2.00–$2.25 each on overage). Cognition has been actively running hackathon promos. **Confirm sponsor-provided ACU credits at the EF check-in desk.**

**Quick start.**
```bash
curl -X POST "https://api.devin.ai/v3/organizations/$DEVIN_ORG_ID/sessions" \
  -H "Authorization: Bearer $DEVIN_API_KEY" \
  -d '{"prompt":"Fix the login bug in issue #42","create_as_user_id":"user_abc123"}'
```

**Recent activity (last 30 days).**
- **Mar 19, 2026** — "Devin can now Manage Devins": a coordinator Devin spawns parallel managed Devins, each in its own VM ([cognition.ai/blog/devin-can-now-manage-devins](https://cognition.ai/blog/devin-can-now-manage-devins)).
- **Apr 16, 2026** — Cognition acquired the remaining Windsurf entity (IDE, 350 enterprise customers, $82M ARR) after Google's reverse-acquihire.
- **Apr 16, 2026** — Devin shipped on **Claude Opus 4.7** with promo pricing.
- **Apr 26, 2026** — Reports of Cognition raising at a **$25B valuation**; Devin ARR cited at $73M+.
- **May 2026 docs** — Programmatic `pr-reviews` endpoint, interactive Mermaid SVGs, Wiki v2, Guardrails V3.

**Strengths.** Long-running, hand-off-and-forget tasks; persistent VM survives across messages; native Slack/Linear/Jira/GitHub triggers; massively parallel via the manage-Devins coordinator pattern; full REST API means it composes cleanly into other agents.

**Gotchas / open questions.** ACU economics get expensive fast (~$2/15-min slice; benchmark task success cited as low as ~15% by skeptics — [@paul_pbng](https://x.com/paul_pbng/status/2053044881791340781)). Reviews flag verbose, sometimes-wrong PRs and 15-minute round-trip latency vs. local IDE agents. Best on well-scoped tickets; weaker on judgment-heavy refactors where Claude Code wins on quality.

**Hackathon project angles.**
1. **Multi-Devin Scoreboard** — Spawn N Devins on the same GitHub issue with different prompts/strategies; auto-score the resulting PRs (tests pass, diff size, lint) and surface the winner.
2. **Devin + Nia "Repo Onboarding Concierge"** — Use Nia to index a new repo and produce a structured brief, then `POST /sessions` to Devin with that brief plus a starter ticket. Demos cross-sponsor agent hand-off.
3. **Sentry/Linear → Devin Auto-Triager** — Webhook listener that, on a new crash or P1 bug, calls the Devin API with reproduction steps + stack trace, links the resulting PR back to Linear.

---

## OpenAI Codex

**What it is.** OpenAI Codex (the modern 2025/2026 product, not the retired 2021 model) is OpenAI's coding-agent platform. It ships in three connected surfaces: a terminal **CLI** (`@openai/codex`, written in Rust, Apache-2.0), a **cloud agent** at chatgpt.com/codex that spins up sandboxed VMs and opens GitHub PRs, and **IDE/desktop/Chrome** extensions. Powered by the GPT-5-Codex family ([openai.com/codex](https://openai.com/codex/), [github.com/openai/codex](https://github.com/openai/codex)).

**Why it's relevant for this hackathon.** The Nozomio prize stack includes **$10K in OpenAI credits** for first place. Codex is the most ergonomic way to spend those credits on a coding-agent project — both the CLI and the API run on the same OpenAI billing rails. There's an **SF Codex Ambassador on site** for live help.

**Core capabilities.**
- Plan / edit / run loop in the terminal with sandboxed file + shell access (read-only, auto, full-access modes).
- Cloud agent that runs tasks in parallel containers and posts pull requests; `@codex` mentions on GitHub trigger work.
- AGENTS.md custom instructions, subagents, hooks, plugins, MCP support, agent **Skills**, web search, and a new **/goal** persistent multi-day workflow.
- Code review bot that auto-flags P0/P1 issues on PRs; native Slack and Linear integrations.

**API & SDK.** Codex uses OpenAI's **Responses API + Agents SDK** under the hood. Two auth paths: (1) sign in with a ChatGPT account — usage counted against plan limits; (2) `OPENAI_API_KEY` for pay-per-token usage that draws from API credits. The CLI exposes the same model menu via `/model` and supports Bedrock and Azure routing.

**Pricing & hackathon access.** No standalone Codex sub — bundled with **ChatGPT Plus ($20)**, the **Pro $100** tier (added Apr 9, 2026, with a 10x Codex promo through May 31), and **Pro $200**. For pure API usage, the $10K hackathon credit pool maps directly to Codex tokens.

**Quick start.**
```bash
npm install -g @openai/codex   # or: brew install --cask codex
codex                          # log in with ChatGPT or set OPENAI_API_KEY
```

**Recent activity (last 30 days).**
- **CLI 0.128 → 0.130** (Apr 30 – May 8, 2026): persistent `/goal` Ralph-style loop, `codex update`, `codex remote-control` headless server, plugin marketplace, Vim modal composer, hooks before/after compaction.
- **Chrome extension launched May 7, 2026** for cross-tab agent work.
- **Pro $100 tier** + 10x Codex limit promo through May 31.
- Codex hit ~3M weekly users, +50% MoM.
- **Bedrock managed agents powered by Codex** entered limited preview.

**Strengths.** Strong model quality (GPT-5-Codex tops several long-task SWE benchmarks) and 2–4x more token-efficient than Cursor's agent in some traces. Cloud + CLI + IDE share auth. Free for ChatGPT Plus users.

**Gotchas / open questions.** The three surfaces don't fully share state — cloud agent can't see local files, CLI can't reuse cloud sandbox. ChatGPT-login rate limits are tier-bound; heavy CLI loops can exhaust Plus quota fast — switch to API key for unlimited credit-burn during the hackathon. Sandbox network is disabled by default in `auto` mode. The `npm` package name `codex` is taken by a third party — the official package is `@openai/codex`.

**Hackathon project angles.**
1. **Cloud-agent orchestrator MCP** — wrap the Codex cloud API in an MCP server so other agents (Claude, Gemini) can dispatch parallel PR-producing Codex tasks against a target repo.
2. **Voice-driven Codex pair** — Realtime API microphone input → Codex CLI via `codex remote-control` → spoken status updates.
3. **GitHub triage bot** — `@codex` listener that reads issues, runs reproduction in a sandbox, classifies as bug/feature/docs, and opens fix PRs.

---

## InsForge

**What it is.** InsForge is an open-source, agent-native backend-as-a-service — effectively a Supabase-style platform (Postgres + auth + storage + functions + realtime) re-architected so AI coding agents can provision and operate the backend autonomously. It exposes a semantic/MCP layer with structured schemas and predictable responses so agents like Cursor, Claude Code, Copilot, Cline, Codex and Windsurf can fetch context and configure primitives without human clicks. Apache 2.0, ~9.2k stars, latest release v2.1.2 (May 8, 2026). [insforge.dev](https://insforge.dev/), [github.com/InsForge/InsForge](https://github.com/InsForge/InsForge).

**Why it's relevant for this hackathon.** InsForge removes the single biggest friction point in the agentic loop — "auth? database? storage?" — by handing an agent a one-prompt fullstack backend. That means a 24-hour team can ship an actual deployed agent app instead of yak-shaving infra. Builders explicitly call out the "backend gap" as the bottleneck for agentic coding ([@newlinedotco](https://x.com/newlinedotco/status/2043024882393584112)).

**Core capabilities.** Postgres (with PGVector for embeddings), JWT auth + OAuth (Google, GitHub) with prebuilt React components, S3-compatible storage with presigned URLs, edge functions with managed secrets, an OpenAI-compatible AI gateway routing to OpenAI/Anthropic/Gemini/Grok, realtime WebSocket channels, and a long-running compute service (private preview). Cloud at insforge.dev or self-host via Docker Compose.

**API & SDK.** `npm install @insforge/sdk` and `npx @insforge/cli create`. Six modules: Database, Auth, Storage, Functions, AI, Realtime — all return `{ data, error }`. RLS is enabled by default and auto-generated by the MCP layer; you can drop into raw Postgres for fine-grained policies. MCP Server lets any compatible agent invoke InsForge as tools.

**Pricing & hackathon access.** Free tier: $1 AI credits, 50k MAU, 500MB DB, 5GB bandwidth, 1GB storage (paused after 1 week idle). Pro $25/mo: $10 AI + $10 compute credits, 8GB DB, 100GB storage. No public hackathon promo code surfaced — ask on-site.

**Quick start.**
```bash
npm install @insforge/sdk
```
```ts
import { createClient } from "@insforge/sdk";
const insforge = createClient({
  baseUrl: "http://localhost:7130",
  anonKey: "your-anon-key",
  isServerMode: false,
});
const { data, error } = await insforge.database
  .from("posts").select("*").eq("author_id", userId);
```

**Recent activity (last 30 days).** Trending on GitHub the week of May 5–8, 2026 alongside agent-skills repos. v2.1.2 cut May 8. Tutorials from AI Stack Engineer, Dipesh Malvia, NoCodeVeloper — "AI agent builds complete backend from one prompt." Show HN thread had positive reception with concerns about default-on RLS friction and debugging auto-generated policies ([HN](https://news.ycombinator.com/item?id=45449787)).

**Strengths.** MCPMark benchmark (21 Postgres tasks, Sonnet 4.5, Pass⁴): InsForge 47.6% vs Supabase MCP 28.6% vs Postgres MCP 38.1% — the "1.7x accuracy" claim. Tokens: 8.2M vs 10.4M / 11.6M (~30% reduction). 1.6x faster wall-clock. Open source, self-hostable, broad agent support. Plugs into Clerk/Auth0/WorkOS/Kinde/Stytch and OKX x402 onchain pay-per-use.

**Gotchas / open questions.** Young product (launched Nov 18, 2025) — production track record is short. RLS-on-by-default can stall an agent mid-flow until policies are tuned. Postgres-only. Compute service still private preview. Free tier projects pause after 1 week idle — bad for demo URLs you want live post-hackathon.

**Hackathon project angles.**
1. **Agentic SaaS scaffolder** — Claude/Cursor agent takes a one-line product spec, calls InsForge MCP to provision schema/auth/storage/functions, generates a Next.js frontend, and deploys end-to-end live on stage.
2. **Self-healing agent** — agent monitors its own InsForge edge-function logs, writes a failing reproducer, patches code, and redeploys via the SDK.
3. **Multi-agent marketplace** — InsForge auth + x402 onchain payments so autonomous agents register, list paid skills, and settle micro-transactions per call.

---

## Tensorlake

**What it is.** Tensorlake is a serverless runtime for **stateful Firecracker microVM sandboxes** plus a durable orchestration engine for background agentic applications. The "stateful cousin" of E2B/Modal/Daytona: agents (and individual tool calls) get an isolated VM with its own filesystem, shell, memory, and software stack — and that state survives across suspend/resume, snapshot, and fork. Founded by Diptanu Gon Choudhury (Apache Mesos, Netflix Titus, HashiCorp Nomad). Also includes Indexify (open-source ingestion engine) and a document-parsing API ([tensorlake.ai](https://www.tensorlake.ai/), [GitHub](https://github.com/tensorlakeai/tensorlake)).

**Why it's relevant for this hackathon.** "Build the Future of AI Agents" maps directly onto Tensorlake's pitch: sub-second cold starts (~200–300 ms), per-agent isolated filesystems, snapshot/fork to parallelize agents, and live VNC + XFCE images for computer-use agents shipped just last week.

**Core capabilities.**
- Boot a minimal sandbox in under 200–300 ms; ubuntu-systemd image ~1 s.
- Persistent FS with near-SSD I/O inside the VM.
- **Suspend** (pause the same sandbox) and **Snapshot** (save state, fork N clones across the cluster) — distinct primitives.
- Full memory+disk snapshot pauses VM <100 ms.
- Dynamic per-call CPU/RAM/disk sizing — no templates.
- VNC + XFCE images for GUI/computer-use agents (new, May 2026) ([@diptanu](https://x.com/diptanu/status/2050231449757045164)).
- Up to ~5M sandboxes/project; 15K-machine clusters.

**API & SDK.** Python (`pip install tensorlake`), TypeScript, and `tensorlake`/`tl` CLI. Auth via `TENSORLAKE_API_KEY`. Lifecycle: `create → exec/run → write_file/read_file → suspend/snapshot → terminate`.

**Pricing & hackathon access.**
- **Free**: 2 concurrent sandboxes (1 core/1 GB/10 GB), no credit card, unmetered sessions.
- **On-Demand**: $0.05/core-hr + $0.015/GB-hr, up to 100 concurrent.
- **Pro**: $250/mo, 1000 concurrent, $0.03/core-hr.
- Sandboxes currently free; metered billing "coming soon." **Ask reps for hackathon credits.**

**Quick start.**
```python
from tensorlake.sandbox import SandboxClient
client = SandboxClient.for_cloud(api_key="...")
with client.create_and_connect(image="tensorlake/ubuntu-minimal") as sb:
    print(sb.run("sh", ["-lc", "echo hi"]).stdout)
    sb.write_file("/tmp/x.txt", b"data")
```

**Recent activity (last 30 days).**
- May 8: added to ComputeSDK sandbox benchmark.
- May 1: VNC+XFCE images for computer-use agents; live demo with auto-resume from suspended state.
- Apr 27: dynamic resource allocation, sub-300 ms boots.
- Apr 13: full memory+disk snapshot in <100 ms.
- SQLite benchmark: Tensorlake 2.45 s vs E2B 3.92 s vs Modal 4.66 s ([Northflank](https://northflank.com/blog/e2b-vs-modal)).

**Strengths.** Statefulness is the differentiator — E2B/Modal sandboxes are largely ephemeral. Fastest in third-party SQLite benchmark. No timeouts (sandbox lives until you suspend or kill it). Snapshot-and-fork enables true parallel agent populations from one warm state. Dynamic CPU/RAM/disk sizing avoids template sprawl.

**Gotchas / open questions.** GPU support not advertised on the public sandbox docs. Region availability: EU data residency mentioned; full region list not public. Free tier capped at 2 concurrent sandboxes. Networking egress policies, container image registry support, and max sandbox lifetime not clearly documented. Metered billing for sandboxes is "coming soon" — pricing could shift mid-build.

**Hackathon project angles.**
1. **Agent-OS** — a long-running personal agent in one named, suspended Tensorlake sandbox that auto-resumes on user message, retains shell history, dotfiles, and a SQLite memory across days.
2. **Multi-agent collaborative shell** — snapshot one bootstrapped repo + venv, fork N clones, dispatch parallel sub-agents (planner/coder/tester) that each get an isolated FS, then diff-merge their working trees.
3. **Durable computer-use agent** — use the new ubuntu-vnc image to give a Claude/GPT computer-use loop a real desktop; suspend after each user turn so demo URL "boots up when you visit."

---

## Convex

**What it is.** Convex is a TypeScript-native, reactive backend platform that bundles a document database, server functions, scheduling, file storage, auth, and vector search behind a single SDK. Developers write their entire backend in plain TypeScript and the client `useQuery` hooks stay live-synced automatically — no manual cache invalidation, websockets, or state managers required ([convex.dev](https://www.convex.dev/), [docs.convex.dev](https://docs.convex.dev/)).

**Why it's relevant for this hackathon.** "Build the Future of AI Agents" maps almost 1:1 to Convex's positioning as "the backend building blocks for your agents." Long-running agent workflows are durable (mutations are retried until success), scheduled actions handle external LLM calls that can fail, and reactive queries push every step of agent progress to the UI in real time. The official `@convex-dev/agent` component gives you persistent threads, message history, vector+text memory, tool calling, and a debugging "agent playground" out of the box.

**Core capabilities.** Reactive queries, transactional mutations, and async actions for outbound API calls; scheduled functions (`ctx.scheduler.runAfter`) and cron jobs for durable workflows; built-in file storage, password/OAuth/JWT auth, and hybrid text + vector search; an extensible Components system including the Agent, RAG, Workflow, Crons, and Resend components.

**API & SDK.** `npm i convex` plus `npm i @convex-dev/agent`. Schema is code-as-config in `convex/schema.ts`; components register in `convex/convex.config.ts`. React clients use `useQuery`/`useMutation`/`useAction` for live reactivity.

**Pricing & hackathon access.** Free tier: 1M function calls/mo, 0.5 GB DB, 1 GB file storage, 20 GB-hours of action compute, 1,000 concurrent sessions, and up to 6 teammates on the Starter plan — well within hackathon scope. Convex regularly sponsors hackathons with credits ([convex.dev/hackathons/resources](https://www.convex.dev/hackathons/resources)) — ask the Nozomio organizers for a sponsor code.

**Quick start.**
```bash
npm create convex@latest        # scaffold project
npm i @convex-dev/agent
npx convex dev                   # live backend
```
```ts
// convex/agent.ts
import { Agent, stepCountIs } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { components } from "./_generated/api";
const agent = new Agent(components.agent, {
  name: "My Agent",
  languageModel: openai.chat("gpt-4o-mini"),
  instructions: "You are a weather forecaster.",
  tools: { getWeather, getGeocoding },
  stopWhen: stepCountIs(3),
});
```

**Recent activity (last 30 days).** Apr 23, 2026 release added `ctx.meta.getDeploymentMetadata()` and a first-class staging-environment model; Apr 27 release updated system UDFs. The Agent component continues to ship updates on npm as `@convex-dev/agent`. Earlier 2025 releases delivered the RAG component (Volume 20) and Convex Chef AI app builder. YouTube tutorials in the last 30 days include "Build & Deploy AI Agent Builder Platform using Next.js, React, Convex" (TubeGuruji).

**Strengths.** Zero infra glue: durable scheduling, retries, and reactive sync are native, so agent state survives crashes and pushes live to the UI without extra plumbing. The Agent component handles thread persistence, memory, and tool calling so you don't roll your own. End-to-end TypeScript (no SQL, no separate ORM), and an open-source self-hostable backend since 2025.

**Gotchas / open questions.** Document model + reactive runtime is a learning curve for SQL-first developers; complex joins and analytical queries are awkward versus Postgres. Action wall-time billing can spike with heavy LLM calls. Self-hosting exists but most teams stay on Convex Cloud, which is some lock-in. Vector search is solid but less feature-rich than dedicated DBs (pgvector, Pinecone).

**Hackathon project angles.**
1. **Live multi-agent dashboard** — Spawn N agents via scheduled actions, stream each step into a `messages` table, and render a real-time "agent control room" with `useQuery` showing token usage, tool calls, and status — zero websocket code.
2. **Agent-driven collaborative app** — A shared doc/whiteboard where humans and agents both edit through Convex mutations. Threads in the Agent component are shareable across users.
3. **Agent state observability layer** — Use Convex as a drop-in observability backend for any framework: every agent step writes to Convex; the React UI gives a Langfuse-style timeline with replay.

---

## Reacher

**What it is.** Reacher is an AI-powered creator marketing platform that automates the full affiliate workflow — creator discovery, outreach, campaign management, and analytics — for TikTok Shop, Instagram, and YouTube. Founded in 2024 by Jerry Qian (CEO, ex-Meta/NASA) and Bora Mutluoglu (ex-Palo Alto Networks); part of YC Summer 2025 (S25). The product is positioned as a "marketing agent for creator collaborations" and is the #1-ranked app on the TikTok Shop App Store, with customers including Under Armour, Hanes, HeyDude, and Logitech. They have crossed 7-figure ARR and over $20M in tracked GMV ([YC](https://www.ycombinator.com/companies/reacher), [reacherapp.com](https://reacherapp.com/)).

**Why it's relevant for this hackathon.** Reacher is a textbook "vertical AI agent" company — its product literally bundles an "Outreach Agent," a "Creative Agent," and an "AI Chatbot" that responds to creators. The hackathon theme maps directly onto their wedge: replace human BD ops in social commerce with autonomous agents that discover, vet, message, negotiate with, and report on creators at scale.

**Core capabilities.** AI creator discovery across 1.5M+ TikTok Shop creators; automated outreach (up to ~2,500 DMs/collab invites per day plus email and sample requests); CRM tracking creator status, samples, messages, and GMV; campaign primitives (retainers, viral challenges, contests, reward structures); a Creative Agent that ingests top-performing videos and generates briefs; Spark Ads request management; dynamic affiliate payouts; Discord integration; FastMoss social-intelligence partnership.

**API & SDK.** **No public API, SDK, webhooks, or developer documentation surfaces anywhere on reacherapp.com, the YC profile, or careers pages.** A "Reacher API" listing exists on RapidAPI but appears to be an unrelated third-party project (likely the open-source `reacher` email-verification tool), not the YC company. **Practically: Reacher today is a SaaS dashboard, not a developer platform.** Any agent integration would have to go through scraping the UI, browser automation, or contacting them for a private partnership.

**Pricing & hackathon access.** Public tiers — Starter $199/mo, Pro $599/mo, plus Custom and Enterprise. Both Starter and Pro include a 10-day free trial. No published hackathon-credit program; ask their on-site rep for trial extensions or sandbox accounts.

**Quick start.** There is no developer quick-start. Workflow is: sign up → 10-day trial → import a TikTok Shop store → use Discovery to filter creators → fire Outreach Agent. For an agent project, pair Reacher's UI/data with browser automation (Playwright, BrowserBase, Claude-in-Chrome) or treat scraped TikTok Shop creator data as your input layer.

**Recent activity (last 30 days).** Limited public chatter. Reacher is hiring a Marketing Specialist (Apr 21). CEO appearance on Ecom Marketing Lab on Mar 31. 14ai interview on automating TikTok Shop at scale, Mar 13. YC LinkedIn launch post: "Reacher is your marketing agent for creator collaborations."

**Strengths.** Deep vertical wedge in the fastest-growing social-commerce surface (TikTok Shop); real revenue ($20M+ GMV, 7-figure ARR, enterprise logos); YC S25 momentum and active hiring; product is already framed as "agents," so judges will recognize the alignment; founders are Bay-Area-based.

**Gotchas / open questions.** **No public dev surface — likely the biggest blocker for a hackathon build.** No webhooks, no documented OAuth, no MCP server, no published rate limits. Unclear whether they will provision sponsor API keys for the event. The "automated 2,500 DMs/day" number raises ToS questions on TikTok side that any agent extension would inherit.

**Hackathon project angles.**
1. **Creator-vetting agent** — scrape/ingest TikTok Shop creator profiles (FastMoss/Kalodata-style data) and run a Claude-based scoring agent (brand fit, audience authenticity, prior GMV, fraud signals) that outputs a ranked shortlist Reacher can ingest as a CSV.
2. **AI campaign optimizer / "Creative Agent v2"** — a closed-loop agent that watches GMV per campaign, A/B-tests creative briefs, generates new hooks via LLM, and auto-promotes winning creators to retainer status.
3. **Auto-negotiation agent** — a multi-turn LLM agent that handles rate negotiations, sample requests, and Spark Ads approvals over DM, with human-in-the-loop checkpoints on price thresholds.

---

## Aside

**What it is.** Aside (YC F25) is building an **AI-native browser** that positions itself as "the operating system for the AI era." Instead of forcing every agent to wire up a separate integration per app (Gmail, Notion, Slack, banks, recruiting tools, Figma), Aside lets agents act *inside the user's actual logged-in browser session* — using the user's credentials, passkeys, cookies, and history as ambient context. **Note:** Aside originally launched in Feb 2026 as a real-time sales-call copilot at asidehq.com, then publicly repositioned to the browser/OS narrative on aside.computer ([YC](https://www.ycombinator.com/companies/aside), [asidehq.com](https://asidehq.com/), [aside.computer](https://aside.computer/)).

**Why it's relevant for this hackathon.** The #1 pain in agent demos is integration hell + auth. Aside's pitch — agents inside live, authenticated browser sessions — directly skips both. The team is SF-local, YC-backed, and the founders (Jun Kim, Chanhee Lee, Sanghun Lee) are likely accessible at the EF event today.

**Core capabilities (per their public pages).**
- Direct app action in Gmail, Notion, Slack, Figma, banking apps, internal tools — **no integrations**.
- Reuses user's **logins, sessions, passkeys, credentials** for agent actions.
- **Persistent context** across sessions via browsing history.
- Push-notification-driven **event resumption** (agents react to new emails, etc.).
- Originally shipped a sales-call use case with ~800ms doc/Slack/HubSpot retrieval.

**API & SDK.** **None publicly documented.** No SDK, extension API, action schema, or developer docs are visible on asidehq.com, aside.computer, the YC page, or via search. **Hackers should assume there is no official programmatic surface today.**

**Pricing & hackathon access.** **Waitlist only.** No public pricing. Founder contacts: jun@asidehq.com, chanhee@asidehq.com, founders@asidehq.com. Ask on-site for beta keys / dev access.

**Quick start.** No public dev workflow yet. Realistic path for today:
1. Join the waitlist at [aside.computer](https://aside.computer/).
2. Find Jun/Chanhee/Sanghun at the EF venue and request a beta build + any internal extension/agent-action API.
3. If denied, fall back to OSS analogues (Browser Use, BrowserOS, Stagehand, Browserbase) and frame your hack as "what we'd build *on* Aside" with mock APIs.

**Recent activity (last 30 days).** The last30days scan returned **zero direct hits on Aside the browser** — coverage is dominated by competitors (Comet, Atlas, Dia, Arc, BrowserOS, Browser Use). Aside is not yet listed in any 2026 AI-browser landscape comparisons.

**Strengths.** No per-app integration tax — biggest agent-dev pain solved by construction. Leverages **already-logged-in state** (passkeys, sessions) so agents work in regulated apps (banking, payroll, recruiting) where API access is gated or impossible. Founders on-site = direct feedback loop and likely beta access.

**Gotchas / open questions.** **Closed beta, no public SDK or docs** — building *on* Aside today depends on a founder conversation. Unknown which model(s) power the agent. Security model is unclear: how is cross-site action scoped, what's the allowlist/approval UX? Public narrative shifted from sales-copilot to browser-OS in <3 months — execution focus is a real risk to ask about. No published benchmarks vs Comet/Atlas/Dia.

**Hackathon project angles.**
1. **Cross-site research agent** — kicks off in Aside, pulls from Notion + Gmail + internal wiki + HubSpot simultaneously using existing logins, produces a sourced briefing doc.
2. **Browser-based recruiting agent** — sources candidates on LinkedIn (logged-in session), pulls resumes from Gmail attachments, drafts personalized outreach in Gmail, schedules via Calendar — all without a single OAuth integration.
3. **Travel agent on your real logins** — books flights/hotels via your Chase, Amex, United, and Airbnb sessions, applying your saved payment methods and loyalty numbers.

---

## AI Nexus (event organizer)

**What it is.** Per the Nozomio Hackathon page, AI Nexus is described as an **event agency** (not a tool, SDK, or developer product) with a global community of "5,000+ builders" that runs hackathons and tech events across 6 cities worldwide alongside leading AI companies. They are the on-the-ground operators, not a sponsor whose API you build against.

**Why they're listed here.** They are the **organizer of today's hackathon** at the EF office in San Francisco. Anything you see at the event (venue logistics, judging flow, schedule, sponsor coordination with Nozomio) is run by their team.

**Community & past events.** No public, canonical website surfaces from open search — the name collides with several unrelated entities ([NYC AI Nexus](https://edc.nyc/program/nyc-ai-nexus), [NYU AI NexusLab](https://futurelabs.nyc/programs/ainexuslab/), [ainexus.world](https://ainexus.world/), [AI Nexus club](https://www.linkedin.com/company/ai-nexus-club)). Treat the "5,000 builders / 6 cities" stat as the organizer's self-description rather than independently verified. **Ask staff on-site for their handle to follow.**

**What this means for participants.** Today's room is the network — judges, mentors, and fellow hackers were curated from their roster, so quality of intros is high. A strong demo today is a foot in the door for invitations to their other city events.

---

## Quick-Reference Matrix

| Sponsor | Type | Public API today? | Free tier viable for 24h hack? | Best paired with |
|---|---|---|---|---|
| **Nia** | Search/index API | ✅ REST + MCP + SDKs | ✅ (3 lifetime indexes — tight) | Devin, Codex, Hyperspell |
| **Hyperspell** | Memory/connector layer | ✅ REST + MCP + SDKs | ❓ Pricing opaque | Nia, Convex |
| **Vercel** | Frontend + agent runtime | ✅ AI SDK / Gateway / Workflows | ⚠️ Hobby plan yes; $5 gateway credit burns in minutes on Opus/GPT-5.2 — **BYOK** | Convex, Tensorlake, all coders |
| **Devin** | Cloud coding agent | ✅ v3 REST | ⚠️ ACUs are pricey | Nia (repo brief) |
| **OpenAI Codex** | CLI + cloud agent | ✅ via OpenAI API | ✅ (10K credits if you win 1st) | Nia, Hyperspell |
| **InsForge** | Backend-as-a-service | ✅ REST + MCP + SDK | ✅ (idle pause caveat) | Convex (alt), Codex/Devin |
| **Tensorlake** | Stateful sandbox | ✅ Python/TS SDK + CLI | ✅ 2 concurrent | Vercel Sandbox (alt), Devin |
| **Convex** | Reactive TS backend | ✅ SDK + Agent component | ✅ Generous starter | Vercel, AI SDK |
| **Reacher** | Vertical agent SaaS | ❌ No public dev surface | ❌ ($199/mo or trial) | Browser automation (Aside) |
| **Aside** | AI browser | ❌ Waitlist only | ❌ No beta access yet | Reacher, recruiting demos |
| **AI Nexus** | Event organizer | n/a | n/a | n/a |

---

## Cross-Sponsor Project Ideas (raw brainstorm)

These are the unfiltered ideas surfaced by the per-sponsor research agents. They have been pressure-tested below — see **[Devil's Advocate](#devils-advocate-skeptics-audit)** for failure modes and **[Project Strategy](#project-strategy-winning-path-picks)** for the ranked, 12-hour-buildable picks.

1. **"Repo Onboarding Concierge"** — Nia indexes the repo + docs → produces a structured brief → Devin API kicks off a starter PR → Convex streams progress to a live dashboard. Hits 4 sponsors.
2. **"Agent Marketplace"** — InsForge auth + x402 payments + Tensorlake sandboxes for skill execution + Hyperspell as the agents' shared memory bus. Hits 3 sponsors with strong narrative.
3. **"Voice second brain on Aside"** — Hyperspell memory layer + voice input + Aside acting in the user's real Gmail/Calendar sessions to schedule and reply. Hits the dedicated track + Aside.
4. **"Self-deploying SaaS agent"** — Codex CLI plans → InsForge MCP provisions backend → Vercel Workflow drives durable build → Nia answers "what does this code do" via MCP for the demo Q&A. Hits 4 sponsors and is a perfect "agents that build agents" pitch.

---

## Devil's Advocate (skeptic's audit)

Read this before you commit to a stack. Most of the brief is accurate but it papers over execution risk that will eat you alive between hour 8 and hour 11.

### 1. Per-sponsor red flags

- **Nia (host).** "3 lifetime indexes" on free tier is a trap, not a feature. If you burn one on the wrong repo, you can't reset without paying. Worse, *latency, freshness window, and rate limits are explicitly not stated* — meaning your demo's "watch it answer about a 24h-old commit" claim is unverified. The brief admits some doc URLs 404. Treat Nia as the host political win, not a battle-tested API.
- **Hyperspell.** Pricing is *not public*. The brief tells you to "ask the booth for an elevated key" — that is a promise on behalf of a sponsor the author cannot keep. The judging criterion the brief invents ("does your agent feel meaningfully smarter because of Hyperspell") is the *brief's guess*, not a published rubric. Build accordingly but don't over-anchor on it. Also: "first-ingest latency on a real Slack workspace can take a while" — translation: do not connect a real Slack at 7:55 PM.
- **Vercel.** The "$5/month free AI Gateway credits" evaporate in roughly *3–5 minutes* of Opus 4.5 / GPT-5.2 traffic in an agent loop. Bring a personal OpenAI/Anthropic key as BYOK or you'll hit a wall mid-demo.
- **Devin.** ACU economics are brutal: ~$2 per 15-min slice, and the brief itself cites a *15% task-success rate from a public skeptic*. A "Multi-Devin Scoreboard" demo at 5 parallel sessions × 30 min = ~$20+ before you've debugged anything. Confirm ACU credits at the booth *before* writing any code against the API.
- **OpenAI Codex.** The 10K credits are tied to **winning 1st place** — they're not pre-distributed. Don't architect around them as an input. Also: ChatGPT-login rate limits are tier-bound; heavy CLI loops can exhaust Plus quota fast — exactly the failure mode at hour 11.
- **InsForge.** "RLS-on-by-default can stall an agent mid-flow until policies are tuned" is the dealbreaker for a live demo where an agent provisions a backend on stage. Show HN flagged the same thing. Also: free tier projects pause after 1 week idle — your post-hackathon demo URL dies before judges revisit.
- **Tensorlake.** "Metered billing for sandboxes is *coming soon*" means pricing can shift the day after you ship. GPU support is not advertised, so any computer-vision angle in the new VNC images is unverified. Free tier is 2 concurrent sandboxes — incompatible with the brief's own "snapshot-and-fork to N parallel agents" pitch.
- **Convex.** Action wall-time billing can spike with heavy LLM calls. The Agent component's defaults pull `gpt-4o-mini` — fine, but if you swap to Opus on every step in a reactive UI you'll burn the free 20 GB-hours of action compute fast.
- **Reacher.** **No public API, no SDK, no webhooks.** The brief is honest about this but still puts it in cross-sponsor ideas. Any project that "integrates with Reacher" is, in practice, a project that *scrapes* Reacher or runs Playwright against TikTok — the second of which is a TOS violation that judges may flag.
- **Aside.** **Waitlist only, no public SDK, repositioned product narrative twice in 3 months.** The brief literally says "if denied, fall back to OSS analogues and frame your hack as 'what we'd build *on* Aside' with mock APIs." A demo against mocks is not a demo. Pick this only if you've already DM'd a founder and have build access in-hand.
- **AI Nexus.** Not a tool. The "5,000 builders / 6 cities" stat is *self-described and unverified*. Do not list them as a sponsor integration in your README — judges will notice.

### 2. Cross-sponsor project ideas — failure modes

1. **Repo Onboarding Concierge (Nia + Devin + Convex).** Failure mode: Devin takes 15+ minutes to return a PR; your "live dashboard" shows a spinner during the demo. Hidden cost: you need a real, non-trivial repo Devin can actually compile — most public repos fail Devin's first run. Works only if you pre-record one Devin session and use it as a "replay" during the live talk.
2. **Agent Marketplace (InsForge + x402 + Tensorlake + Hyperspell).** Failure mode: x402 onchain settlement on a chain you've never touched, plus InsForge RLS, plus Tensorlake sandbox auth — that's 4 unfamiliar auth surfaces in 12 hours. Hidden cost: x402 docs are sparse; you'll spend 3 hours just on payment plumbing. Works only if one teammate has shipped x402 before.
3. **Voice second brain on Aside (Hyperspell + voice + Aside).** Failure mode: no Aside beta key = no demo. Hidden cost: voice latency stacks on top of Aside's browser-action latency on top of Hyperspell retrieval — probably 4–6 seconds end-to-end, which feels broken on stage. Works only if the Aside founders give you a build *and* you wire ElevenLabs/Realtime so voice round-trip is sub-1s.
4. **Self-deploying SaaS agent (Codex + InsForge + Vercel Workflow + Nia).** Failure mode: InsForge MCP provisions a schema, Codex generates code that doesn't match the schema, Workflow retries, you blow your Workflow execution budget. Hidden cost: 4 MCP/API auth setups + Vercel deploy + a Nia index — that's at least 90 minutes of plumbing before you've written a feature. Works only if one teammate has *already* deployed an InsForge + Vercel app this week.

### 3. What the brief got wrong or oversold

- **"Most strategically valuable prize: the Hyperspell founder working session"** is editorial, not fact. Founder time is great if you're keeping building; if you're job-hunting, the *guaranteed interviews* in the 1st-place bundle are likely worth more.
- **"$10K OpenAI credits map directly to Codex tokens"** — true *if you win*. Listed as a "credit multiplier" without flagging conditionality.
- **Repeated "ask the booth for credits"** across Nia, Hyperspell, InsForge, Tensorlake, Aside, Reacher. That's six sponsor promises the author cannot guarantee. Plan a build that works on *public* free tiers and treat any sponsor credits as upside.
- **InsForge benchmark claim:** "1.7x accuracy" comes from MCPMark on 21 Postgres tasks with one model (Sonnet 4.5). That's a narrow, vendor-friendly benchmark. Don't quote it on stage as a generalized superiority claim.
- **Devin "Manage Devins" pattern** is presented as battle-ready; in practice it's weeks-old and ACU costs compound multiplicatively.

### 4. The single highest-EV play the brief is NOT (originally) recommending

**Win the Hyperspell track with a deeply boring, deeply functional vertical agent — and skip the host (Nia) integration entirely.** The brief implicitly steers everyone toward Nia because Nozomio is the host. That means Nia will be the *most-crowded* track and judges will see 30 "talk to your stack" demos. Hyperspell's prize is richer per-capita ($1k cash + 6 mo unlimited + founder deploy session + amplification) and the founders are the judges — so a tightly-scoped on-call/incident agent that visibly *learns over time* will read as differentiated. The contrarian move is to *not* spread across 4 sponsors and instead nail one track with one founder who is publicly obsessive about helping customers.

> **Strategist's counter:** the strategist below disagrees and argues you can win *both* tracks with the right architecture. Read both and decide.

### 5. Three "do NOT do this" warnings

1. **Do NOT do a live OAuth ingest on stage** (Slack/Gmail/Drive via Hyperspell or Nia connectors). First-ingest latency is unbounded. Pre-ingest the night before, demo against the warm index, narrate the connector flow with a screenshot.
2. **Do NOT build on Aside or Reacher unless you have written confirmation of beta access in your hand by hour 2.** Both have zero public dev surface. You will burn 4 hours waiting on a founder DM and then pivot at hour 6 with no backend.
3. **Do NOT spawn parallel Devins or run unbounded Codex `/goal` loops without a hard ACU/token kill switch.** Devin ACUs are ~$2/15min and Codex `/goal` is a "persistent multi-day workflow" — both will silently rack up charges or exhaust your ChatGPT-Plus quota mid-demo. Cap iterations in code, not in your head.

---

## Project Strategy (winning-path picks)

The brief is dense, but the prize structure forces a clear choice: the **Hyperspell founder working session + 6 mo unlimited** is strategically more valuable than the Overall 1st M5 MacBook for any builder who plans to keep shipping. The good news: the Hyperspell-track winning play and the Overall-1st play can be the *same project*, because Nia (host) and Hyperspell (track) are complementary memory layers — one indexes code/docs, the other indexes humans/conversations. Build the union. Don't pick.

---

### #1 — **"Reasoner"** — the cross-corpus onboarding agent (TARGETS BOTH OVERALL 1st + HYPERSPELL TRACK)

**One-line pitch:** "New hire connects Slack + Gmail + Notion + their repo, and an MCP-native agent answers *'why did we choose Postgres for billing?'* by joining code commits, design-doc PDFs, and the Slack arguments that drove the decision — with citations."

**Sponsors used:** Hyperspell (Connect OAuth + multi-source memory + MCP), Nia (code/doc/PDF index + Oracle deep-research + cross-session memory), Vercel (Next.js + AI SDK + AI Gateway for model fallback), Convex (reactive thread + live "agent thinking" dashboard).

**Why this wins:**
- **Hyperspell's 5 criteria, hit cleanly:** (1) live OAuth a *real* messy Slack export + Gmail on stage via Hyperspell Connect; (2) the demo question is *only* answerable by joining sources — Slack thread + Notion RFC + git blame; (3) ask the same question twice, second answer is sharper because Hyperspell reinforced the right memories — show the diff; (4) plug `hyperspell-mcp` into Claude Desktop on the demo laptop so judges see it in *their* tool; (5) pick a vertical — "engineering onboarding" — so Conor sees GTM pull (every YC company hires).
- **Nozomio/Nia "Google for agents" criterion:** Nia is the code+docs+PDF spine; Hyperspell is the conversation+inbox spine. The pitch line is literally *"Nia gives the agent the codebase, Hyperspell gives it the company; together = an actual coworker."*
- Two memory sponsors complement, don't compete — judges see deliberate architecture, not sponsor-bingo.

**The 10-second wow moment:** Split-screen demo — left pane "Without memory" (vanilla Claude says "I don't know"); right pane "Reasoner" answers in 4s with three citations: a Slack thread from 9 months ago, the RFC PDF, and the exact PR. Then click a citation → Hyperspell timeline shows *which memories were reinforced* by past queries. Judges see the delta.

**12-hour build plan:**
- **H0–H1** Booth lap: grab Hyperspell elevated key, Nia API key + indexing credits, Vercel AI Gateway key, Convex starter. `npx create-next-app`, `npm i ai @ai-sdk/anthropic @hyperspell/hyperspell @convex-dev/agent`, deploy hello-world to Vercel preview URL.
- **H1–H4** Plumbing: Hyperspell Connect widget on `/connect` route. Ingest a *real* Slack workspace export + a Gmail account + a Notion page (use your own — not synthetic). In parallel kick off Nia indexing on a public-but-meaty repo (e.g., `vercel/next.js` or your own org repo). Indexing runs while you build.
- **H4–H8** Agent loop: AI SDK `streamText` with two tools — `searchPeople` (Hyperspell `memories.search` with source-weighting) and `searchCode` (Nia `/search` mode=`query` + `include_sources`). Use `stopWhen: steps >= 6`. Stream every step into Convex `messages` table; `useQuery` renders the live trace.
- **H8–H10** The Hyperspell killer feature: wire `hyperspell-mcp` into Claude Desktop on the demo laptop. Pre-record a 30s screen capture of Claude Desktop using it (backup video). Build the "without memory vs with memory" split-screen page.
- **H10–H12** Demo script rehearsal x3, Loom backup recording, slide deck (3 slides: problem, architecture diagram showing Nia+Hyperspell halves, prize-track tie-in).

**Kill criteria:**
- By **H4**, if Hyperspell Connect OAuth isn't returning a usable token, drop Gmail and ship with Slack-export-upload only.
- By **H6**, if Nia indexing of a repo is still pending, fall back to Nia's pre-indexed package docs (PyPI/NPM — no indexing wait) and pivot the demo question to "how does Next.js App Router handle X."
- By **H8**, if the live MCP-in-Claude-Desktop integration is flaky, drop it from live demo and lean on the pre-recorded clip.
- By **H10**, no new features. Polish only.

---

### #2 — **"Forking Minds"** — parallel-agent code-review tournament

**One-line pitch:** "Spawn 5 Devins on the same GitHub issue with different system prompts, each in a Tensorlake snapshot-forked sandbox; auto-score the resulting PRs; ship the winner."

**Sponsors used:** Devin (v3 sessions API), Tensorlake (snapshot+fork = the only sponsor that does this primitive cleanly), Nia (Tracer for "find similar past PRs" grounding), Vercel (Workflow DevKit for the durable tournament loop + dashboard).

**Why this wins:** Maps directly to Nozomio's "most ambitious working agent" axis — *agents managing agents* is the visceral 2026 narrative. Tensorlake's snapshot-and-fork is the only sponsor primitive that makes parallel agent populations cheap; using it correctly signals architectural taste. Devin's "manage-Devins" announcement (Mar 19) is fresh in judges' heads.

**Wow moment:** A 5-pane grid lights up live as 5 Devins race on the same issue; bars climb as tests pass; a winner crowns at ~6 minutes; auto-merged PR appears in GitHub.

**12-hour plan:** H0–H1 booth + ACU credits ask. H1–H4 Workflow DevKit scaffold + Devin sessions wrapper + Tensorlake snapshot helper. H4–H8 the 5-pane Next.js dashboard streaming session messages; Nia Tracer call to inject "similar past fixes" into each Devin prompt. H8–H10 scoring rubric (test pass / diff size / lint / Nia-grounded similarity) via AI SDK `generateObject`. H10–H12 polish + record backup.

**Kill criteria:** By H4, if Devin ACU burn is faster than expected → drop to 3 Devins. By H6, if Tensorlake snapshot/fork API is unfamiliar → use plain Sandbox create + image template. By H8, no scoring rubric working → ship "manual judge" UI.

---

### #3 — **"Self-Deploying SaaS"** — the agents-build-agents demo

**One-line pitch:** "Type a one-line product idea. Codex plans the schema, InsForge MCP provisions Postgres+auth+storage, Vercel deploys it, Nia answers questions about the generated code — all live in 4 minutes."

**Sponsors used:** OpenAI Codex (cloud agent), InsForge (MCP-native BaaS — the *only* sponsor whose entire pitch is "agent provisions backend"), Vercel (deploy target + AI Gateway), Nia (post-build "explain this code" Q&A).

**Why this wins:** Hits the "agents that build agents" theme cleanly, uses the **MCPMark-leading** InsForge angle (1.7x accuracy vs Supabase MCP — judges who've seen the benchmark will nod), and ends with a *real deployed URL the judges can click*. The OpenAI 10K credit prize maps 1:1 to Codex token spend.

**Wow moment:** Type "a recipe-sharing app with photo uploads and likes." Watch a live trace: Codex emits schema → InsForge MCP creates tables/auth/storage → Vercel deploys → judges scan a QR code and **use the deployed app from their phones**.

**12-hour plan:** H0–H1 booth + InsForge sponsor key. H1–H4 InsForge MCP wired to Codex CLI via `~/.codex/config`; one happy-path spec works end-to-end. H4–H8 Next.js front-end with live deploy URL preview iframe + Codex cloud session streaming. H8–H10 Nia indexes the *just-generated repo* and serves /ask endpoint. H10–H12 polish + 3 prepared specs (recipe app, todo, mini-CRM) so demo never blanks.

**Kill criteria:** By H4, if InsForge MCP RLS auto-policies stall the agent → switch to InsForge SDK direct calls. By H8, if Vercel deploy step adds >90s latency → pre-deploy a template and have Codex only modify it.

---

### Lazy-mode backup — **"DocsThatTalkBack"** (4 hours, exhausted-at-2am edition)

Two sponsors, no infra. `npx nia-wizard@latest` to provision Nia. Paste any framework's doc URL → Nia indexes it. Wrap in a Next.js + Vercel AI SDK chat using `streamText` + a single `searchDocs` tool that calls Nia `/search`. Deploy to Vercel preview. **Pitch:** "Context7 but always-fresh and cited." Hits Nia (host!) + Vercel. Demo: ask about a feature merged 24h ago, watch it answer correctly. Build time: 3.5h. Will not embarrass.

---

### Booth checklist (ask in next 30 min)

- **Hyperspell (Conor / Manu):** Elevated API key with bumped quota? Webhook/push freshness or polling-only? Cross-user shared memory ACL semantics? Are *they* the judges for the track? — *if yes, learn what shipped this week and reference it on stage*.
- **Nia (Arlan / Nozomio team):** Hackathon credit bump beyond 3 lifetime indexes? Concurrent index limit lift? Confirm `apigcp.trynia.ai/v2` is the right base URL today.
- **Vercel:** AI Gateway sponsor credit code? Workflow DevKit is GA — any preview features to flag for judges?
- **Convex:** Sponsor code for bumped action-compute hours? Is the Agent component playground demo-able to non-devs?
- **Tensorlake (Diptanu):** Snapshot+fork example beyond the docs? Hackathon credit beyond the 2-concurrent free tier?
- **OpenAI Codex Ambassador:** Best path to spend the $10K cred — API key vs ChatGPT login? Any Codex-track-specific judging signal?
- **InsForge:** Sponsor key that disables 1-week idle pause for post-demo URLs?
- **Devin:** Confirm ACU credit drop. Is `manage-Devins` parallel-spawn API stable enough to demo?

---

### Demo-day operations

- **Have running before judging:** (a) production Vercel URL on a second laptop tab, (b) localhost dev server with `--turbopack` ready, (c) Claude Desktop with `hyperspell-mcp` pre-configured for the live MCP demo.
- **Backup video:** record a perfect 90-second Loom of the full happy path *before* H10. If wifi dies, screen-share the Loom while narrating live — judges rarely penalize this if you own it.
- **Wifi-fail fallback:** phone hotspot pre-tested. Pre-cache one full demo response in localStorage so the streaming "happy path" plays from cache if APIs time out.
- **The "tool craps out" slide:** a single architecture diagram slide titled *"Memory = Code (Nia) + People (Hyperspell)"* — switch to it and keep talking. Don't apologize, narrate.
- **Pre-staged demo data:** Slack export + Gmail mbox + repo URL + 3 canned questions chosen so each forces a *different* sponsor combo to fire.
- **Submission hygiene:** GitHub repo public, Loom in README, architecture diagram in README, 1-line elevator pitch pinned at top, all sponsor logos credited.

---

### The one decision (commit in 30 min): **Build #1, "Reasoner."**

Two reasons. **First**, it's the only project that simultaneously targets the Overall 1st prize (Nia is the host's spine) *and* the Hyperspell track — and the Hyperspell founder session is the highest-EV prize on the board. **Second**, the architecture is genuinely defensible: Nia indexes code/docs, Hyperspell indexes humans, the union is something neither sponsor sells alone — that is a real "why didn't this exist?" demo, not sponsor-bingo. Stop reading. Run `npx nia-wizard@latest` and `npm i @hyperspell/hyperspell` now. Tie broken.

---

## Research Process Notes

This brief was produced by a 13-agent research squad coordinated in this single session:

- **11 sponsor research teammates** (one per sponsor) ran in parallel, each combining `/last30days` social-signal scans (Reddit / X / YouTube / HN / Polymarket / Web) with targeted WebSearch + WebFetch of official docs.
- **1 devil's advocate teammate** read the synthesized draft and produced the skeptic's audit above.
- **1 project strategist teammate** read the same draft and produced the ranked, hour-by-hour build plan above.

Raw `/last30days` outputs are checked into [`research/`](./research/) — one file per sponsor (10 of them; AI Nexus was researched via WebSearch only since social-signal scans aren't useful for an event agency). All claims in this brief are cited inline; where information could not be verified ("ask the booth", "pricing not public", "no SDK"), the brief says so plainly.
