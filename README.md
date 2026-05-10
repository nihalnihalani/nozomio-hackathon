# Triage — incident-triage AI agent

> When an incident fires, Triage drafts the post-mortem in 4 seconds — and gets faster every time.

Paste a stack trace. In ~2s: a cited triage joining your team's Slack +
Notion + Gmail (via Hyperspell) with your monorepo + ADRs + runbooks
(via Nia), persisted in Convex with audit-grade RLS in InsForge for the
production story. On a similar alert minutes later, recall is sharper
because the matched memories were reinforced.

Submitted to **Track 4 — The Company Brain** (Nia + Hyperspell), targeting
the Hyperspell, Convex, InsForge, and overall prizes from a single codebase.

---

## Live Deployment

**https://nozomio-hackathon-dun.vercel.app**

Production mode is `DEMO_MODE=live` by default. Replay fixtures are still
checked in for local smoke tests and backup demos, but they only run when
`DEMO_MODE=replay` is explicitly set.

| Inspector | Link |
|---|---|
| GitHub | https://github.com/nihalnihalani/nozomio-hackathon |
| Vercel | https://vercel.com/alhinais-projects/nozomio-hackathon |
| Convex dashboard | https://dashboard.convex.dev/d/superb-wildcat-347 |

---

## Architecture

[![Triage architecture](docs/architecture.png)](docs/architecture.png)

*Live mode (`DEMO_MODE=live`) routes through the @convex-dev/agent component; replay mode is explicit fixture playback for local validation and backup demos.*

```
                          ┌─────────────────────────────┐
                          │       TRIAGE (agent)        │
                          │   lib/agent/loop.ts         │
                          └──────────────┬──────────────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              │                          │                          │
              ▼                          ▼                          ▼
    ┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
    │   HYPERSPELL     │      │       NIA        │      │     INSFORGE     │
    │  human-side      │      │  code-side       │      │  cold/persistent │
    │                  │      │                  │      │                  │
    │  Slack #incidents│      │  Monorepo        │      │  Postgres + RLS  │
    │  Notion          │      │  ADRs            │      │  audit_log       │
    │   postmortems    │      │  Runbooks        │      │   per-org        │
    │  Gmail vendor    │      │  Recent commits  │      │                  │
    │   outages        │      │                  │      │                  │
    │  recallSimilar() │      │  searchCode()    │      │  mirror sink     │
    └──────────────────┘      └──────────────────┘      └──────────────────┘

           Hot path: Convex (reactive trace UI, agent state, memory events)
           Cold path: InsForge (durable customer-of-record incidents + audit)
```

| Sponsor | Job |
|---|---|
| **Hyperspell** | Multi-source memory recall across Slack/Notion/Gmail (Nia doesn't index conversations) |
| **Nia** | Code-aware repo + ADR + runbook search (Hyperspell doesn't index code) |
| **Convex** | Reactive agent state + live trace UI via `useQuery` (`triageRuns`, `toolCalls`, `citations`, `memoryEvents`) |
| **InsForge** | Cold-path Postgres mirror with multi-tenant RLS per org |

---

## Quick start

```bash
npm install
cp .env.example .env       # see SETUP_CHECKLIST.md for getting keys
npm run dev                # open http://localhost:3000
```

Fill the live service keys in `.env` before using the production path.
For fixture-only local smoke tests, run `DEMO_MODE=replay npm run dev`
and paste one of the traces from `data/replay/trace-a.json` or
`data/replay/trace-b.json`.

### Local fixture smoke test

1. Run `DEMO_MODE=replay npm run dev`
2. Paste the Trace A fixture input → cited triage with timeline, root cause, suspected fix
3. Paste the Trace B fixture input → triage surfaces a 🧠 NEW citation reinforced by Trace A
4. Click any citation pill → side drawer shows the raw Slack/Notion/code excerpt
5. Paste random text → graceful error, no fabrication

### npm scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run dev:all` | Next + `npx convex dev` together |
| `npm test` | Vitest suite (67 tests) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check:invariants` | The 6 invariant gates |
| `npm run build` | Next 15 production build |
| `npm run prewarm` | Pre-cache Hyperspell/Nia replay fixtures |
| `npm run ingest` | Ingest seed data into a real Hyperspell workspace |

---

## Invariants (enforced by tests + Codex review)

The 4 rules every change must preserve. See `CLAUDE.md` for the rationale,
`tests/invariants/` for the gate scripts.

1. **Cite-or-die** — every non-trivial claim has a `verified: true` citation
   pointing to a real Slack/Notion/Gmail memory or `file:line`. Bogus input
   emits `event: error`, never fabricates.
2. **Reinforcement is the demo** — only `convex/reinforceNode.ts` writes
   `triage_history` memories. Trace B must surface at least one citation
   that Trace A didn't.
3. **Hot/cold split** — Convex hosts ephemeral agent state; InsForge holds
   durable per-org records. Mirror is one-way (Convex → InsForge).
4. **Hermetic replay mode** — every outbound call has a `DEMO_MODE=replay`
   branch. Default is `live`; missing live keys fail visibly unless
   `DEMO_MODE=hybrid` is deliberately enabled.

---

## Tech stack

```
Frontend:        Next.js 15.1.12 (App Router) · TypeScript · shadcn/ui · Tailwind
LLM:             OpenAI gpt-4o or Anthropic Claude Sonnet via AI SDK — replay uses no LLM
Agent runtime:   lib/agent/loop.ts — runs in Next.js (replay/live)
Backend (hot):   Convex (queries, mutations, actions, scheduler)
Backend (cold):  InsForge (Postgres + auth + RLS)
Memory:          Hyperspell (humans) + Nia (code)
Deploy:          Vercel (frontend) + Convex Cloud (backend)
Streaming:       Convex `useQuery` reactive (with SSE fallback)
```

### Project layout

```
app/                 Next.js App Router (page.tsx, /api/triage SSE+mirror)
components/          UI (TraceUI, ResultCards, CitationDrawer, ConvexLiveActivity)
convex/              schema.ts + V8 mutations/queries + *Node.ts agent actions
lib/                 agent loop + sponsor clients with explicit replay-mode logic
data/replay/         explicit fixture-mode data (Trace A, Trace B, hyperspell, nia)
seed/                local source corpus for cite-or-die verification
tests/               vitest + invariant gates
.agents/skills/      project skills (Convex × 6, Hyperspell × 2)
```

### Convex split

Files using Node APIs (`fs`, `path` — for seed-corpus reads) live in
`*Node.ts` files with `"use node"` directive. V8-runtime mutations and
queries live alongside in non-Node files.

| File | Runtime | Purpose |
|---|---|---|
| `convex/schema.ts` | — | 4 hot-path tables |
| `convex/triage.ts` | V8 | mutations + queries (`start`, `byId`, `recentRuns`, internal helpers) |
| `convex/triageNode.ts` | Node | `run` + `runInternal` agent actions |
| `convex/reinforce.ts` | V8 | internal query + mutation |
| `convex/reinforceNode.ts` | Node | `reinforce` action — sole `triage_history` writer |
| `convex/tools.ts` | V8 | `logToolCall` mutation |
| `convex/toolsNode.ts` | Node | `recallSimilarIncidents` + `searchCode` actions |

---

## Production deploy

```bash
npx vercel --prod          # already linked to alhinais-projects/nozomio-hackathon
```

Required env vars (set on Vercel):

- `NEXT_PUBLIC_CONVEX_URL` — points at your Convex deployment
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` — required for the live agent
- `HYPERSPELL_API_KEY`, `HYPERSPELL_CONNECT_USER_ID` — required for live memory recall/writeback and workspace connect tokens
- `NIA_API_KEY` — required for live code search
- `NIA_SOURCE_ROOT` — source checkout used by cite-or-die verification
- `INSFORGE_BASE_URL`, `INSFORGE_SERVICE_ROLE_KEY`, `INSFORGE_MIRROR_SECRET` — required for durable cold-path mirroring
- `NEXT_PUBLIC_TRIAGE_ORG_ID`, `TRIAGE_DEFAULT_ORG_ID` — org scope used by the UI/API fallback
- `DEMO_MODE=live` — production default; use `replay` only for fixture playback

Note: Vercel rejects deploys of Next.js < 15.1.7 (CVE-2025-66478).
Pinned to `15.1.12`.

---

## MCP servers + skills (Claude Code)

This repo registers two MCP servers and 8 agent skills for Claude Code:

| MCP | Status |
|---|---|
| `convex` | `npx convex mcp start` — schema + deployment introspection |
| `hyperspell` | `@hyperspell/hyperspell-mcp@0.38.0` — read access to memories |

Skills under `.agents/skills/` (symlinked into `.claude/skills/`):

- **Convex** (6, auto-installed via `npx convex ai-files install`):
  `convex`, `convex-quickstart`, `convex-setup-auth`, `convex-create-component`,
  `convex-migration-helper`, `convex-performance-audit`
- **Hyperspell** (2):
  `hyperspell` (project-specific quickstart) +
  `setup-hyperspell` (official setup guide via skills.sh)

---

## Roadmap (post-hackathon)

The `@convex-dev/agent` migration is **already done** — PR #8 wired the
component, PR #10 finished the live path (`useTriage` now calls
`api.triage.start`, `lib/agent/loop.ts` is on AI SDK v6, and a new
`produceTriage` Zod tool enforces Cite-Or-Die at the AI SDK boundary),
and PR #11 corrected the Hyperspell live calls to the real
`/memories/query` + `/memories/add` endpoints. Live mode is verified
end-to-end against the real APIs. Replay remains available as an explicit
fixture mode for local checks and backup demos, but it is no longer the
application default.

PostHog LLM Analytics is integrated via `@posthog/convex` —
`convex/observability.ts` exports AI SDK `gen_ai` spans with per-call
cost/latency/model traces (no-op without `POSTHOG_API_KEY`).

The original migration scoping doc lives in
[`convexplan.md`](./convexplan.md) for historical reference.

## Hackathon meta

- **Event:** Nozomio Hackathon, May 9 2026, EF SF
- **Track:** 4 — The Company Brain (Nia + Hyperspell)
- **Team:** see commits in `git log`
- **Submission:** https://forms.gle/fkoFXRo3L2MVkkz87

See `IDEAS.md` for the 9-agent ideation squad output that produced
Triage as the chosen build, `PLAN.md` for the 5-hour build plan,
`CLAUDE.md` for the project rules every PR must follow,
`HUMAN_TODO.md` for the human-only items left before the 6pm
submission, and `docs/architecture.png` as a printable fallback
slide.
