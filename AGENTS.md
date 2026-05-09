# Project Rules for Codex

## ⚠️ Codex Reviews Every Change

> **Critical:** every commit Codex authors in this repo is reviewed by **OpenAI Codex** before merge. Codex is the second pair of eyes — it catches what Codex misses. Treat each PR as a piece of work that has to survive an independent agent's audit, not just `npm test`.
>
> Concretely:
> - **No PR auto-merges.** Every PR is held until a Codex review passes.
> - **Hooks enforce invariant compliance** before the PR even opens (see `.Codex/settings.json`). Failing hooks ⇒ NEW commit, never `--amend`.
> - **The PR body must list every invariant the change touches** so Codex can spot-check (see §Git Workflow).
> - If you find yourself thinking *"I'll just push this and Codex will catch it,"* stop and self-review first. The bar is **work Codex won't have notes on** — that's the standard, not "work that compiles."
> - When Codex pushes back, take it seriously. Don't argue from authority; either fix or escalate to the human Lead with reasoning.
>
> The whole point of a two-agent pipeline is independent error detection. If Codex writes sloppy code expecting Codex to clean up, the pipeline collapses to one agent doing both jobs poorly.

---

## Project Overview

**Triage** — An incident-triage AI agent. When something breaks in production, paste a stack trace (or fire a Sentry/PagerDuty webhook); Triage joins your team's Slack #incidents + Notion postmortems + Gmail vendor outages (via **Hyperspell**) with your monorepo + ADRs + runbooks (via **Nia**). It outputs a structured triage — timeline, root cause, suspected fix with diff, similar past incidents — every claim cited. On a similar alert minutes later, the agent's recall is sharper because Hyperspell reinforced the relevant memories. Treat this repo as hackathon-grade software with production-shaped pieces (multi-tenant RLS, audit log, cite-or-die verifier, reactive trace UI), not a finished SRE platform.

**Hackathon:** Nozomio Hackathon · 2026-05-09 · 8 AM–8 PM PDT · EF Office, San Francisco
**Track (submission target):** Track 4 — The Company Brain (Nia + Hyperspell). Fallback: Track 2 — Ship It (Nia + InsForge).
**Build window:** 5 hours, team of 3.
**Tagline:** *"On-call engineers spend 45 minutes triaging an alert. Triage does it in 4 seconds — and gets faster every time."*

### Judging weights (Track 4 rubric, authoritative)

| Dimension | Weight | Winning Standard | Red Flag |
| --- | ---: | --- | --- |
| Cross-Source Synthesis | **30%** | Joins ≥3 sources fluidly; produces context no single source could | Single source; surface-level | 
| Real Work, Not Just Answers | **25%** | Ships output that replaces hours of human work | Q&A bot or chatbot wrapper |
| Hyperspell Integration Depth | **25%** | Synthesis through Hyperspell is core; removing it breaks the demo entirely | Hyperspell as thin wrapper or not at all |
| Demo & Presentation | 10% | Live demo lands; judges want to try it themselves | Hard to follow; misses the case |
| Judge's Personal Rating | 10% | "I want to see this succeed" | Forgettable |

**What this rubric implies for scope priorities:** **Cross-Source Synthesis (30%) + Hyperspell Integration Depth (25%) = 55%** of the score and are largely *demo-resident*. That means the **two-pagers-in-90-seconds memory-reinforcement moment** is the rubric play (Invariant 2), and **Cite-Or-Die provenance** (Invariant 1) is what Hyperspell judges look for. Demo+Personal is only 20%, so over-polishing the UI past "clearly working + clearly synthesizing across sources" has diminishing returns.

### Prize stack (4 simultaneous prize pools targeted)

| Prize | How we win it | Cash equiv |
| --- | --- | --- |
| **Hyperspell track** | Submit to Track 4; max Hyperspell-Integration-Depth axis | $1k cash + 6mo unlimited (~$5k+) + Conor & Manu working session + amplification |
| **InsForge track** | Use InsForge as production data layer (multi-tenant Postgres + RLS + audit) | $1k cash + 3k InsForge credits + private session with YC founders + amplification |
| **Convex track** | Use `@convex-dev/agent` + reactive `useQuery` for the live trace | $1k (1st) or $500 (2nd) |
| **Overall 1st** | Judged across all submissions | M5 MacBook Pros × 3 + guaranteed Arlan interview + various credits |

### Primary references — read all of these before any non-trivial change

- [`PLAN.md`](./PLAN.md) — execution plan: hour-by-hour build, demo script, kill switches, definition of done
- [`IDEAS.md`](./IDEAS.md) — 9-agent ideation squad output: 12 candidates, scoring matrix, why Triage won
- [`SPONSORS.md`](./SPONSORS.md) — sponsor capability briefs: Hyperspell / Nia / Convex / InsForge sections especially
- [`SETUP_CHECKLIST.md`](./SETUP_CHECKLIST.md) — step-by-step API key creation per sponsor; env-var reference
- [`research/`](./research/) — raw `/last30days` outputs per sponsor (community signals, gotchas)
- [`.env.example`](./.env.example) — documented env shape; never commit secrets

### Architecture

A **3-person team** drives a **5-stage agent loop** that maps an incident input (stack trace / Sentry webhook) onto a cited triage with reinforcement-learned memory.

- **Convex Agent runtime** (`@convex-dev/agent`) — agent loop, threads, tool calling, persistent state
- **Hyperspell** — multi-source memory across Slack #incidents + Notion postmortems + Gmail vendor outages; `recallSimilarIncidents` tool with weighted source scoring; reinforcement step after each triage
- **Nia** — code-aware monorepo + ADR + runbook indexing; `searchCode` tool; cite-or-die verifier checks `file:line` actually contains claimed code
- **InsForge** — multi-tenant Postgres + auth (prebuilt magic-link React component) + RLS by `org_id`; mirrors every triage to `incidents` + `audit_log` tables
- **Frontend** — Next.js 15 App Router + AI SDK 6 + shadcn/ui + reactive `useQuery` over `triageRuns` + `toolCalls` for the live "agent thinking" trace
- **LLM** — Anthropic Codex direct API (NOT via Vercel AI Gateway — $5 burns too fast on Opus)
- **Deploy** — Vercel (frontend) + Convex Cloud (backend); env vars sourced from `.env`

The architecture is split deliberately into **hot path** (Convex) and **cold path** (InsForge) — see Invariant 3.

---

## Project Structure

```text
triage/
├── AGENTS.md                          # this file — rules layer
├── PLAN.md                            # execution plan
├── IDEAS.md                           # ideation + scoring
├── SPONSORS.md                        # sponsor briefs
├── SETUP_CHECKLIST.md                 # API key creation per sponsor
├── README.md                          # public pitch + repo entry
├── CHANGELOG.md                       # daily-shipping log (one section per day)
├── .env.example                       # documented env shape; never commit secrets
├── .gitignore
├── .Codex/
│   └── settings.json                  # invariant-enforcement hooks
├── package.json                       # name: "triage"; Next.js 15
├── next.config.ts
├── tsconfig.json
├── app/                               # Next.js App Router — patient-facing UI
│   ├── layout.tsx
│   ├── page.tsx                       # Single-page paste-trace UI; pre-warmed magic-link demo session
│   ├── login/page.tsx                 # InsForge magic-link auth (prebuilt React component)
│   └── api/
│       └── insforge-mirror/route.ts   # Convex → InsForge audit-log mirror
├── components/
│   ├── PasteTraceInput.tsx            # textarea + "Triage" submit
│   ├── TraceUI.tsx                    # streaming agent-thinking cards
│   ├── CitationPill.tsx               # clickable citation pill
│   ├── CitationDrawer.tsx             # shadcn Sheet showing raw memory excerpt
│   ├── ResultCards/
│   │   ├── TimelineCard.tsx
│   │   ├── RootCauseCard.tsx
│   │   ├── SuspectedFixCard.tsx       # uses react-diff-viewer-continued
│   │   └── SimilarIncidentsCard.tsx
│   └── ArchitectureSlide.tsx          # 4-box diagram for the demo
├── convex/
│   ├── schema.ts                      # triageRuns, toolCalls, citations, memoryEvents
│   ├── triage.ts                      # the agent action (entry point)
│   ├── tools.ts                       # recallSimilarIncidents + searchCode
│   ├── reinforce.ts                   # memory reinforcement mutation
│   └── _generated/                    # convex codegen (gitignored)
├── lib/
│   ├── hyperspell/
│   │   └── client.ts                  # Hyperspell SDK wrapper + source-weight defaults
│   ├── nia/
│   │   └── client.ts                  # Nia REST client + cite-or-die verifier
│   ├── insforge/
│   │   └── client.ts                  # InsForge SDK wrapper
│   └── prompts/
│       ├── triage-system.md           # the agent's system prompt (cite-or-die enforced)
│       └── reinforcement.md           # what gets written back as a memory_event
├── seed/                              # synthetic demo data (the narrative arc)
│   ├── slack.json                     # 30 messages across 4 months; planted retry-budget DM
│   ├── postmortems/
│   │   ├── 2024-01-14-stripe-webhook-regression.md
│   │   ├── 2023-11-02-payment-double-charge.md
│   │   └── 2024-03-07-billing-service-latency.md
│   ├── gmail/
│   │   └── stripe-status-page-emails.json
│   └── billing-service/               # the demo Git repo with planted bug
│       ├── app.ts
│       ├── webhooks/stripe.ts         # ★ contains bug at line 84 (missing idempotency on retry)
│       ├── webhooks/paypal.ts
│       ├── lib/idempotency.ts
│       ├── docs/ADR-007-idempotency-keys.md
│       └── runbooks/INCIDENT-RESPONSE.md
├── scripts/
│   ├── ingest.ts                      # ingests seed/ into Hyperspell (idempotent)
│   ├── prewarm_demo.ts                # caches one happy-path triage into localStorage seed
│   └── verify_invariants.ts           # invariant grep + assertion runner (CI gate)
├── tests/
│   ├── tools/
│   │   ├── recallSimilarIncidents.test.ts
│   │   └── searchCode.test.ts         # cite-or-die: returned file:line must contain claimed code
│   ├── invariants/
│   │   ├── cite_or_die.test.ts        # Invariant 1
│   │   ├── reinforcement.test.ts      # Invariant 2: Trace B surfaces new citation
│   │   ├── hot_cold_split.test.ts     # Invariant 3: audit data not in Convex; agent state not in InsForge
│   │   └── replay_mode.test.ts        # Invariant 4: every outbound call has a replay branch
│   └── e2e/
│       └── two_alerts_smoke.test.ts   # paste Trace A → reinforcement → Trace B sharper
├── slides/                            # demo deck (8 slides per Gary Chan format)
│   └── architecture.svg
├── docs/
│   ├── demo-runbook.md                # 90-second demo script + recovery
│   ├── demo-backup.mp4                # ★ Loom backup; MUST exist by H4:30
│   └── sponsor-feedback.md            # candidate issues to file back to sponsors
└── public/
    └── qr-code.png                    # production URL QR for the demo
```

Don't pre-create empty folders. Scaffold each phase as needed.

---

## Key Technical Decisions (Invariants)

**These four are non-negotiable. A PR that violates any of them must not merge. Hooks in `.Codex/settings.json` enforce them at edit-time where possible. Codex re-checks them on review.**

### Invariant 1 — Cite-Or-Die ★ (the 30% Synthesis play)

**Every claim rendered to the UI must cite a real source.** The Track 4 rubric weights *Cross-Source Synthesis* at **30%** and explicitly rewards "produces context no single source could; the brain is the product." Triage earns those points by enforcing provenance at the agent loop level — it's not a UI feature, it's a runtime invariant.

**Rules:**
- The agent's system prompt (`lib/prompts/triage-system.md`) ends with: *"Refuse to claim a root cause without a code citation. Refuse to assert a similar incident without a Hyperspell `memory_id`. If you cannot cite, say so explicitly."*
- The `searchCode` tool runs a **cite-or-die verifier** on every Nia response: claimed `file:line` must actually contain the claimed code. If verification fails, the citation is dropped (not the claim suppressed silently — surfaced as `[verification failed]`).
- Frontend `CitationPill.tsx` renders nothing if `citation.source_id === null` — uncited claims appear unstyled, which is intentional UX signaling.
- **Tests:** `tests/invariants/cite_or_die.test.ts` runs 10 known-bad inputs (stack traces with no matching code in the demo repo) and asserts the agent says *"no matching code found"* rather than fabricating a `file:line`.
- **Codex check:** any new tool added to `convex/tools.ts` must return `citations[]` of shape `{ source: 'slack' | 'notion' | 'gmail' | 'code'; source_id: string; excerpt: string }` — Codex spot-checks the type signature and the test that proves uncited responses are rejected.

**Why:** the rubric. Hyperspell judges (Conor + Manu) compare us against winning archetypes that all show their work. A planner + executor that fabricates citations looks like a 2024 demo *and* loses the cross-source-synthesis points it claims to earn.

### Invariant 2 — Memory Reinforcement Is The Demo ★ (the 25% Hyperspell-depth play)

**The two-pagers-90-seconds-apart moment is the single rubric-winning beat.** Trace A's triage cites 3 sources. After it completes, Convex action writes a `memoryEvents` row + calls `hyperspell.memories.add({ text: "User triaged idempotency-key incident in /api/charge", source: "triage_history", metadata: { reinforces: matched_memory_ids } })`. Trace B (similar root cause, different surface) is then issued; **the recall surfaces a new citation** — specifically the planted Slack DM from 3 weeks ago about adding a retry budget — that the first triage *reinforced* via the metadata flag.

**Rules:**
- The reinforcement mutation lives in `convex/reinforce.ts` and is the **only** place that writes `triage_history` memories to Hyperspell. PRs that add `triage_history` writes elsewhere don't merge.
- `tests/invariants/reinforcement.test.ts` runs Trace A → reinforce → Trace B end-to-end and asserts Trace B's citations include at least one `memory_id` not present in Trace A's response.
- If Hyperspell's reinforcement-propagation timing is undocumented or flaky in practice, the deterministic fallback is **hardcoding Trace B's signature to bias source weights toward the retry-budget memory**. This is documented in `lib/hyperspell/client.ts` and clearly labeled as a fallback. Demo UX is identical to judges; we surface no fakery.
- The fallback is never the *first* approach — try the real reinforcement step first; switch to fallback only if integration testing at H3 shows the real path doesn't visibly differentiate Trace B.
- **Codex check:** if the reinforcement code path is changed, Codex must verify the test still asserts the new-citation property. A passing test that no longer enforces the property is a red flag.

**Why:** the demo's wow moment. Without this, Triage is "another retrieval agent." With it, the agent visibly learns. Conor's published thesis is exactly this — *"memory is what makes agents useful."* Removing the second-trace beat is removing the rubric play.

### Invariant 3 — Hot/Cold Path Split (the sponsor-bingo defense)

**Convex is the hot path. InsForge is the cold path. They are not interchangeable.**

| Path | Owner | Stores | Why |
| --- | --- | --- | --- |
| **Hot** | Convex | `triageRuns`, `toolCalls`, `citations`, `memoryEvents` | Reactive `useQuery` for live trace UI; ephemeral; per-session |
| **Cold** | InsForge (Postgres) | `organizations`, `incidents`, `audit_log` | Multi-tenant RLS; durable; queryable by SREs across years |

**Rules:**
- Convex tables: agent state, in-flight tool calls, citations bound to a `triageRun`. **Never the audit log.**
- InsForge tables: customer-of-record incidents, immutable audit events scoped by `org_id`. **Never live agent state.**
- Mirroring runs one-way: when a `triageRun` reaches `status: "done"`, a Convex action POSTs to `app/api/insforge-mirror/route.ts` which writes the incident + audit event with the org's JWT. PRs that add a reverse mirror (InsForge → Convex) don't merge — that's how multi-tenant data leaks across orgs.
- RLS policies in InsForge are scoped to `auth.jwt() ->> 'org_id'`. Tests in `tests/invariants/hot_cold_split.test.ts` assert (a) Convex queries don't accept `org_id` filters (they're per-session), (b) InsForge queries refuse cross-org reads.
- **Codex check:** any new schema in `convex/schema.ts` is reviewed for "is this hot data?" Any new InsForge table is reviewed for "is this multi-tenant audit-grade data?" If the answer is "no" or "I'm not sure," the change is rejected.

**Why:** this is the anti-sponsor-bingo armor. When Convex judges and InsForge judges read the README, each sees their tool doing a *distinct, defensible* job. Without the split, one of them concludes "this is the other tool's job" and both prizes evaporate.

### Invariant 4 — Hermetic Demo Mode

**Live OAuth on stage = death.** All Hyperspell data is pre-ingested via `scripts/ingest.ts` before stage call. All Nia indexing on the `seed/billing-service/` repo is pre-warmed. The "agent thinking" stream renders from real Convex tool calls — not mocks — but every external dependency must have a hermetic fallback.

**Rules:**
- `DEMO_MODE` env: `live` (real Hyperspell + Nia calls), `replay` (cached responses from `data/replay/{traceRunId}/`), `hybrid` (live with per-stage timeout, falls back to replay).
- Every outbound call (Hyperspell, Nia, Anthropic) must have a `DEMO_MODE=replay` branch and a test in `tests/invariants/replay_mode.test.ts` proving it.
- `scripts/prewarm_demo.ts` seeds the replay cache the night before for Trace A + Trace B + 1 backup.
- **Hard rule:** never run `DEMO_MODE=live` for the first time on stage. Pre-warm + dry-run the night before.
- **Backup video by H4:30** (1 hour before the deadline): record `docs/demo-backup.mp4` showing the same 90-second beats. **Always.** This is the wifi-died hedge. PR with it must merge before stage call.
- **Codex check:** new outbound calls without a replay branch get a hard reject. The pattern is well-established in `lib/hyperspell/client.ts` and `lib/nia/client.ts` — copy it.

**Why:** hackathon Wi-Fi fails. Sponsor APIs rate-limit at exactly the wrong moment. Demo Hyperspell ingest takes 18+ minutes if not pre-warmed. The team that survives stage glitches scores higher than the team with a flashier idea but a broken demo.

---

## Other Technical Decisions (Strong Defaults — Change With Care)

- **3-person parallel build, not 1-2.** Roles are Agent Engineer (Convex + tools), Product Engineer (Next.js + InsForge auth + UI), Storyteller (seed data + booth + demo). See PLAN.md §7.
- **5 hours wall-clock, not 12.** Cuts from the 12h plan that come back if time allows: real GitHub PR creation, real Slack `chat.postMessage`, real Sentry webhook ingest, Vercel Workflow DevKit. Stage them as Layer-2 only after the core demo works end-to-end.
- **No mocks on the demo path.** Real Convex actions, real Hyperspell calls (or replay), real Nia citations, real InsForge mirror. Mocks are only for offline dev.
- **Convex Agent component over raw API routes.** `@convex-dev/agent` provides threads + tool calling + reactive UI for free. PRs that bypass the Agent component for "just one route" don't merge — they kill the Convex prize candidacy.
- **Magic-link auth, not OAuth flows on stage.** InsForge's prebuilt React component is 1-click. Saves 30 minutes vs DIY auth.
- **Bounded narration in the agent.** The system prompt restricts the agent to citing data it actually retrieved. PRs that loosen the bound (e.g., "let the agent fall back to general knowledge") don't merge — Cite-Or-Die is non-negotiable.
- **No `gh pr create` in the demo path.** Render the proposed fix as a diff in the UI. Real GitHub PR creation is Layer 2.
- **Synthetic demo data labeled as such.** Slack messages mention fake company names ("Acme Billing"), the demo repo is named `billing-service` (no real company), no real customer PII. Honesty > theater.

---

## Triage Core Loop (5 stages)

```
STACK TRACE INPUT (or Sentry webhook)
                │
                ▼
   Stage 1 — Ingest                    Convex action receives { trace, orgId }
                                        Validates trace shape; writes triageRuns row (status: "pending")
                ▼
   Stage 2 — Recall (Hyperspell)       recallSimilarIncidents tool
                                        memories.search with source_weights:
                                          { slack: 0.5, notion: 0.4, gmail: 0.1 }
                                        Returns Top-5 memories with metadata
                                        ★ INVARIANT 1: every returned memory has source_id
                ▼
   Stage 3 — Code Search (Nia)         searchCode tool
                                        /v2/search mode='query' on demo repo
                                        Cite-or-die verifier: claimed file:line must
                                        contain claimed code; else drop citation
                ▼
   Stage 4 — Compose (Convex Agent)    @convex-dev/agent runs Codex Sonnet
                                        with stopWhen: stepCountIs(5)
                                        Streams toolCalls + citations to Convex tables
                                        Frontend useQuery re-renders live
                                        Output: { timeline, root_cause, suspected_fix, similar_incidents }
                                        ★ INVARIANT 1: every claim has citation_id
                ▼
   Stage 5 — Persist + Reinforce       Convex action:
                                          - writes finished triageRun (status: "done")
                                          - mirrors to InsForge incidents + audit_log via /api/insforge-mirror
                                          - writes memoryEvents row
                                          - calls hyperspell.memories.add for reinforcement
                                        ★ INVARIANT 2: reinforcement step is mandatory
                                        ★ INVARIANT 3: hot data → Convex, cold data → InsForge
                ▼
   STRUCTURED TRIAGE + AUDIT TRAIL + REINFORCEMENT WRITTEN
   (rendered in UI; cited; durable)
```

Every stage emits Convex mutations keyed by `triageRunId` to a stream consumed by the trace UI via `useQuery`. Stages 2, 3, and 4 are first-class citizens of that UI — judges literally see the agent calling tools and getting cited results back.

---

## Schemas

### Convex schema (`convex/schema.ts`)

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  triageRuns: defineTable({
    orgId: v.string(),
    inputTrace: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("done"),
      v.literal("error")
    ),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    timeline: v.optional(v.array(v.object({ at: v.string(), event: v.string() }))),
    rootCause: v.optional(v.object({
      text: v.string(),
      citations: v.array(v.string()),  // citation_ids; cite-or-die
    })),
    suspectedFix: v.optional(v.object({
      file: v.string(),
      line: v.number(),
      diff: v.string(),
      citations: v.array(v.string()),
    })),
    similarIncidents: v.optional(v.array(v.string())),  // memoryEvent ids
  }).index("by_org", ["orgId"]),

  toolCalls: defineTable({
    triageRunId: v.id("triageRuns"),
    tool: v.union(v.literal("recallSimilarIncidents"), v.literal("searchCode")),
    input: v.any(),
    output: v.any(),
    latencyMs: v.number(),
    at: v.number(),
  }).index("by_run", ["triageRunId"]),

  citations: defineTable({
    triageRunId: v.id("triageRuns"),
    source: v.union(
      v.literal("slack"),
      v.literal("notion"),
      v.literal("gmail"),
      v.literal("code")
    ),
    sourceId: v.string(),  // Hyperspell memory_id OR file:line
    excerpt: v.string(),
    metadata: v.any(),
    verified: v.boolean(),  // cite-or-die: did Nia's claimed file:line actually contain the code?
  }).index("by_run", ["triageRunId"]),

  memoryEvents: defineTable({
    triageRunId: v.id("triageRuns"),
    reinforcedMemoryIds: v.array(v.string()),
    hyperspellWriteback: v.boolean(),  // did we successfully memories.add the triage_history event?
    at: v.number(),
  }),
});
```

### InsForge SQL schema

```sql
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table incidents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  triage_run_id text not null,         -- mirrors Convex triageRunId
  trace text not null,
  root_cause text,
  resolved_at timestamptz,
  created_at timestamptz default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  incident_id uuid references incidents(id),
  action text not null,
  payload jsonb,
  actor text,
  created_at timestamptz default now()
);

alter table incidents enable row level security;
alter table audit_log enable row level security;

create policy "tenant isolation incidents"
  on incidents for all
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);

create policy "tenant isolation audit"
  on audit_log for all
  using (org_id = (auth.jwt() ->> 'org_id')::uuid);
```

### Hyperspell ingestion shape

```ts
await hyperspell.memories.add({
  text: msg.text,
  source: "slack",
  metadata: {
    channel: msg.channel,
    author: msg.user,
    ts: msg.ts,
    thread_id: msg.thread_id,
  },
});
```

Recall:
```ts
await hyperspell.memories.search({
  query: signature,
  options: {
    source_weights: { slack: 0.5, notion: 0.4, gmail: 0.1 },
    limit: 5,
  },
});
```

---

## Demo Theater (the locked 90 seconds)

| Time | Beat | Visual |
| --- | --- | --- |
| 0:00–0:10 | Hook: *"Show of hands — who's been paged at 3am in the last month? On-call engineers spend 45 minutes triaging that alert. Triage does it in 4 seconds."* | Empty Triage UI on screen |
| 0:10–0:30 | **Trace A pasted**; agent loop streams tool calls in real-time via `useQuery` | Live trace UI; cards fill in |
| 0:30–0:45 | Citation drill-down: click pill → drawer shows raw Slack message + ADR + file:line | Drawer slide-out |
| 0:45–1:05 | **The wow moment**: similar alert fires 90s later. "Run on similar alert" → Trace B in 4s with a NEW citation (the retry-budget DM). ★ Invariant 2 | Side-by-side or chronological; new citation pulses |
| 1:05–1:20 | Architecture beat: 4 boxes (Hyperspell humans / Nia code / Convex hot / InsForge cold + Triage in middle) | Architecture slide |
| 1:20–1:30 | Validation receipt + close: Sarah's quote ("I'd pay $50/mo for this") + URL + QR + ask | Final card with QR |

**Demo case** uses a synthetic phantom company called "Acme Billing" labeled as such on screen. Synthetic demo data, real architecture. Honesty > theater.

---

## Sponsor Integration Map

Every sponsor in the prize stack earns its place. Nothing checkbox-integrated.

| Sponsor | Role | Integration depth |
| --- | --- | --- |
| **Hyperspell** | Multi-source memory across Slack/Notion/Gmail; reinforcement step after each triage | DEEP — `recallSimilarIncidents` is one of two tools; reinforcement is Invariant 2 |
| **Nia** | Code-aware monorepo + ADR + runbook search; cite-or-die verifier | DEEP — `searchCode` is the other tool; host sponsor |
| **Convex** | `@convex-dev/agent` runtime + reactive `useQuery` for the trace UI + agent state | DEEP — agent component is the runtime spine, not a database |
| **InsForge** | Multi-tenant Postgres + auth (prebuilt React) + RLS by `org_id` + audit_log | DEEP — cold-path data layer; production-readiness signal |
| **Anthropic Codex** | LLM (direct API; not via gateway) | DEEP — Sonnet is the agent's brain |
| **Vercel** | Frontend hosting + preview URLs | OPS |

**Skipped sponsors** (decision recorded in `IDEAS.md`):
- **Tensorlake** — credits-only prize; architecture would duplicate Convex; Track 1 thematic mismatch
- **Reacher / Aside / Devin / OpenAI Codex / OmniHuman** — irrelevant to the Triage pitch

---

## Data Models (Convex + Redis-style keyspace shorthand)

Convex doesn't use Redis, but for analogous mental models:
- `triageRuns` — hash: status, stage, durations, citations
- `toolCalls` — stream: every Hyperspell + Nia call with latency
- `citations` — set: every cited source per triage run; `verified` boolean for cite-or-die
- `memoryEvents` — list: reinforcement events per triage

For replay-mode demos:
- `data/replay/{triageRunId}/` — JSON files keyed by call hash; powers `DEMO_MODE=replay`

---

## API Surface

```
POST   /api/triage                     Convex action wrapper (paste-trace entry)
GET    /api/triage/{id}                 Current triageRun + citations + tool calls
POST   /api/insforge-mirror             Convex → InsForge audit-log mirror (internal; JWT-gated)
GET    /api/healthz                     Liveness + DEMO_MODE + Hyperspell + Nia probes
```

The frontend doesn't talk to `/api/triage` directly — it uses Convex's `useMutation(api.triage.run)` + `useQuery(api.triage.byId)` reactive hooks. The REST routes exist for webhook integration (Sentry, PagerDuty) and for external tooling.

---

## Git Workflow — Codex-Reviewed PR Required

**MANDATORY:** All changes go through a PR. Codex reviews every PR before merge. Never commit directly to `main`. Never force-push.

### Lifecycle

1. Branch from `main`: `git checkout -b <type>/<short-description>`
2. Stage and commit with Conventional Commits messages
3. Push: `git push -u origin <branch>`
4. Open PR: `gh pr create` with body following the template below
5. **Self-review before requesting Codex review** — `gh pr diff` + the invariant checklist (don't waste Codex's tokens on sloppy work)
6. Trigger Codex review (the team's pre-agreed mechanism; check with Lead)
7. **Address Codex notes seriously** — if Codex says "this skips Invariant 3," it almost certainly does. If you disagree, document the reasoning in the PR thread and ping Lead
8. Fix issues with NEW commits — never `--amend` after a hook failure
9. Once Codex approves AND Lead approves: `gh pr merge --squash --delete-branch`

### PR body template (mandatory)

```markdown
## Summary
[1-3 sentence what + why]

## Test Plan
[How you verified this works]
- [ ] `npm test` green
- [ ] `npm run typecheck` green
- [ ] `npm run check:invariants` green
- [ ] (if demo-path) `DEMO_MODE=replay` smoke test passes

## Invariant Compliance
- [ ] Invariant 1 (Cite-Or-Die): [N/A or how this change preserves it]
- [ ] Invariant 2 (Reinforcement): [N/A or how this preserves the Trace-B-new-citation property]
- [ ] Invariant 3 (Hot/Cold Split): [N/A or which path this touches]
- [ ] Invariant 4 (Replay Mode): [N/A or "added replay branch + test"]

## Codex Notes (after review)
[Paste Codex's review notes here verbatim; respond inline]
```

### Rules

- Never commit to `main`, never force-push
- Never skip hooks (`--no-verify`) — they enforce invariants
- One logical change per PR
- PR title follows Conventional Commits
- PR body is non-optional — Codex needs the context
- Pre-commit failure ⇒ NEW commit (never `--amend`)
- Squash-merge so `main` stays linear
- **No PR merges without a Codex pass.** Lead approval alone is insufficient.

### Codex-specific gates (PRs that require extra scrutiny)

These paths are high-risk for invariant regressions. PRs touching them get tagged `codex-deep-review` and Codex is expected to apply extra scrutiny:

- `convex/tools.ts` — Cite-Or-Die enforcement (Invariant 1)
- `convex/reinforce.ts` — Reinforcement step (Invariant 2)
- `app/api/insforge-mirror/route.ts` — Hot/Cold split (Invariant 3)
- `lib/hyperspell/client.ts`, `lib/nia/client.ts` — replay-mode branches (Invariant 4)
- `lib/prompts/triage-system.md` — agent's behavioral contract
- `convex/schema.ts` — schema changes affecting RLS or audit shape

---

## Branching & Commit Conventions

- **Main branch:** `main`
- **Commit format:** [Conventional Commits](https://www.conventionalcommits.org/)
- **Scopes:** `agent`, `tools`, `convex`, `hyperspell`, `nia`, `insforge`, `frontend`, `seed`, `replay`, `tests`, `docs`, `demo`, `infra`
- **Branch naming:** `<type>/<kebab-description>` (e.g., `feat/citation-pill-drawer`, `fix/hyperspell-source-weights`, `docs/demo-runbook-recovery`)

---

## Build & Test Commands

```bash
# ─── Install ─────────────────────────────────────────
npm install                            # package-lock.json is the source of truth

# ─── Dev ─────────────────────────────────────────────
npm run dev                            # Next dev on :3000
npx convex dev                         # Convex backend in watch mode
npm run build                          # Next production build
npm run lint                           # ESLint
npm run typecheck                      # TypeScript strict

# ─── Seed data ───────────────────────────────────────
npm run ingest                         # ingests seed/ into Hyperspell (idempotent)
npm run prewarm                        # caches Trace A + Trace B replay responses

# ─── Tests ───────────────────────────────────────────
npm test                               # all jest tests
npm test -- tools/                     # tool-level (recall, searchCode)
npm test -- invariants/                # the 4-invariant suite
npm test -- e2e/                       # end-to-end synthesis (replay mode)

# ─── Invariant checks (run in CI; can run locally) ──
npm run check:invariants               # the 4 grep + assertion checks below

# Invariant 1 — Cite-Or-Die: every tool returns citations of correct shape
npm test -- invariants/cite_or_die.test.ts

# Invariant 2 — Reinforcement: Trace B surfaces a new citation Trace A didn't
npm test -- invariants/reinforcement.test.ts

# Invariant 3 — Hot/Cold split: no audit data in Convex; no agent state in InsForge
npm test -- invariants/hot_cold_split.test.ts

# Invariant 4 — every outbound call has a replay branch
npm test -- invariants/replay_mode.test.ts

# ─── Demo prep ───────────────────────────────────────
npm run prewarm                        # seeds replay cache + warms ingest + checks Hyperspell + Nia
npm run record-backup                  # ★ run by H4:30 (see §Demo Day) — produces docs/demo-backup.mp4
```

---

## Environment Variables

Documented in `.env.example`; never commit secrets. See `SETUP_CHECKLIST.md` for step-by-step key creation per sponsor.

```bash
# ─── REQUIRED ────────────────────────────────────────
ANTHROPIC_API_KEY=                     # Codex direct API (NOT via Vercel AI Gateway — $5 burns fast)
NIA_API_KEY=                           # https://app.trynia.ai → Settings → API Keys
HYPERSPELL_API_KEY=                    # Hyperspell dashboard or booth (Conor/Manu)
HYPERSPELL_TOKEN=                      # same value as HYPERSPELL_API_KEY; used by MCP if added
INSFORGE_BASE_URL=                     # InsForge dashboard project URL
INSFORGE_ANON_KEY=                     # InsForge anon key (publishable)
CONVEX_URL=                            # auto-written by `npx convex dev`
CONVEX_DEPLOYMENT=                     # auto-written by `npx convex dev`

# ─── REQUIRED (defaults work locally) ────────────────
DEMO_MODE=live                         # live | replay | hybrid
HYBRID_LIVE_BUDGET_MS=8000             # hybrid mode: live budget before falling back to replay

# ─── OPTIONAL ────────────────────────────────────────
GEMINI_API_KEY=                        # for cross-checking Nia results in dev only; never on demo path
INSFORGE_SERVICE_ROLE_KEY=             # server-only; only used by /api/insforge-mirror route
```

---

## Agent Team Strategy (3 humans + Codex review)

The 3-person team split is **enforced by file ownership**:

### Person 1 — Agent Engineer
- Owns: `convex/`, `lib/hyperspell/`, `lib/nia/`, `lib/prompts/`
- Stays at the keyboard the entire 5 hours
- Skill: strong TypeScript, comfortable with streaming + async
- Does NOT touch frontend or seed data unless paired with Person 2 / Person 3

### Person 2 — Product Engineer
- Owns: `app/`, `components/`, `lib/insforge/`, deploy pipeline (Vercel)
- Skill: strong frontend, design-tasteful
- The `CitationDrawer` is the Invariant-1 demo surface — it is non-negotiable polish

### Person 3 — Storyteller / Validator
- Owns: `seed/`, `scripts/ingest.ts`, `scripts/prewarm_demo.ts`, `slides/`, `docs/demo-runbook.md`, `docs/demo-backup.mp4`
- Does the booth lap in H0 (gets Hyperspell + Nia + InsForge keys)
- Does on-site user interviews in H2-H4 (3+ photo+quote testimonials)
- Owns the 90-second demo script and rehearsal
- **Crucially:** does NOT touch production code. Their job IS the 30% of the rubric that's NOT pure tech.

### Codex — Reviewer
- Reads every PR before merge
- Verifies invariant compliance (the PR body's checklist + spot-checks)
- Spot-checks tests actually assert what the PR body claims
- Has hard authority to block — Lead can override only with documented reasoning

### Plan Approval (Risky Work)

Require plan approval before implementation for:
- Edits to `convex/tools.ts` (Invariant 1)
- Edits to `convex/reinforce.ts` (Invariant 2)
- Edits to `app/api/insforge-mirror/route.ts` (Invariant 3)
- New outbound calls without a replay branch (Invariant 4)
- Edits to `lib/prompts/triage-system.md` (agent's behavioral contract)
- Anything that invalidates pre-warmed replay fixtures

The teammate working on it submits a plan, Lead approves, only then implements. **Codex enforces this on the PR side** — PRs without a linked plan-approval issue get a hard reject for the high-risk paths.

### Sequential Dependencies (Build Order)

1. `convex/schema.ts` — blocks everything
2. `lib/hyperspell/client.ts` + `lib/nia/client.ts` (with replay branches) — blocks `convex/tools.ts`
3. `convex/tools.ts` — blocks the agent action
4. `convex/triage.ts` (agent action) — blocks E2E flow
5. `convex/reinforce.ts` — blocks Invariant 2 demo
6. Frontend `app/page.tsx` + `components/TraceUI.tsx` (`useQuery` reactive) — blocks demo recording
7. `app/api/insforge-mirror/route.ts` + `lib/insforge/client.ts` — blocks Invariant 3 + InsForge prize
8. `seed/` data + `scripts/ingest.ts` — blocks E2E with real Hyperspell recall
9. `scripts/prewarm_demo.ts` + replay fixtures — blocks hermetic demo
10. `docs/demo-backup.mp4` — must exist by H4:30 (Demo Day rule)

---

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for any non-trivial task (3+ steps or invariant-touching)
- If something goes sideways, **STOP and re-plan** — don't keep pushing
- Write detailed specs upfront for invariant-touching changes

### 2. Subagent Strategy
- For codebase research: **Explore** subagent
- For PR review on a teammate's branch: open the PR and tag for Codex
- One focused task per subagent

### 3. Verification Before "Done"
Never mark a task complete without proving it works:

- `npm test` passes
- `npm run typecheck` passes
- `npm run lint` passes
- `npm run check:invariants` passes
- Demo-path change: paste Trace A → cited triage in <30s on the live URL
- Tool change: replay 5 known-good + 5 known-bad inputs through `tests/tools/*.test.ts`
- UI change: open `npm run dev` in a real browser, walk through 0:00–1:30 demo beats
- Invariant-2 change: run `tests/invariants/reinforcement.test.ts` AND watch the demo for the new-citation moment
- Ask: *"Would Conor + Manu nod at this on stage?"*

### 4. Demo-Driven Development
- Every Layer-1 feature must be visible in the 90-second demo
- Polish > breadth — a flawless 5-stage pipeline with a visible reinforcement loop beats six half-baked features
- The **Trace B new-citation moment** is the Invariant-2 wow moment — it MUST work
- The **citation drawers** are the Invariant-1 wow moment — visible at 0:30–0:45
- The **synthetic phantom labeling** is the trust signal — never hide it
- If judges can't tell the architecture's hot/cold split apart, we lost the InsForge + Convex cross-prize argument — surface each in the architecture slide

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask *"is there a more elegant way?"*
- If a fix feels hacky: *"Knowing everything I know now, implement the elegant solution."*
- Skip for simple, obvious fixes
- Ugly code that works beats clean code that doesn't (hackathon rule)
- **Exception:** never trade elegance for an invariant. A hacky `DEMO_MODE=replay` branch is better than no replay branch.

### 6. Autonomous Bug Fixing
- When given a bug report: fix it. Don't hand-hold.
- Read logs, errors, failing tests — resolve root cause
- Zero context switching from the user

### 7. Self-Review Before Codex
- After completing a change, do a `gh pr diff` walk yourself
- For each invariant, ask: "did this change strengthen or weaken it?"
- If the answer is "weaken," redesign before requesting review
- Codex's time is finite — don't burn it on work that didn't pass your own review

---

## Task Management

1. **Plan First** — write the plan with checkable items before starting
2. **Verify Plan** — check in with the user on non-trivial work
3. **Track Progress** — mark items complete via `TaskUpdate`
4. **Explain Changes** — high-level summary at each step
5. **Document Results** — review what was built and what changed

---

## Scope Control — Hackathon Rules

### MUST SHIP (Layer 1 — The Demo)

| Feature | Why critical |
| --- | --- |
| **5-stage pipeline running end-to-end** (ingest → recall → search → compose → reinforce) | The architecture play |
| **Cite-Or-Die enforcement on every claim** ★ | Invariant 1 — the 30% Synthesis play |
| **Memory reinforcement step after each triage** ★ | Invariant 2 — the Hyperspell wow moment |
| **Hot/Cold split: Convex agent state + InsForge audit log** | Invariant 3 — the sponsor-bingo defense |
| **Hermetic `DEMO_MODE=replay` for stage** | Invariant 4 — wifi-dies hedge |
| **Reactive trace UI via Convex `useQuery`** | The Convex prize signal |
| **Citation pills + drawer showing raw source** | The cross-source synthesis legibility signal |
| **Architecture slide with 4 boxes** | Sponsor-prize defensibility on stage |
| **Magic-link auth on stage** | InsForge production-readiness signal |
| **Backup `docs/demo-backup.mp4` by H4:30** ★ | Hard rule (see §Demo Day) |
| **README with Loom embed + sponsor logos** | Submission requirement |

### SHOULD SHIP (Layer 2 — If Time Permits)

| Feature | Impact |
| --- | --- |
| Real `gh pr create` for the proposed fix | Demo wow amplifier (was cut for 5h budget) |
| Real Slack `chat.postMessage` to a demo workspace | Same |
| Sentry webhook integration | Production-realism signal |
| Vercel Workflow DevKit for durable agent runs | Production-realism signal |
| Convex Agent playground at `/playground` | Convex prize amplifier |
| Sponsor-rep on-camera quote ("I'd use this") | Validation receipt amplifier |

### MUST NOT DO

- Generic "AI for incidents" framing (the SRE vertical IS the moat)
- Mocks on the demo path (judges notice mocks)
- Real PII or real customer Slack data (synthetic phantom only)
- Single-step LLM call wrapped in a UI (Cross-Source Synthesis goes to 0)
- Sponsor-bingo: 5+ tools listed, none load-bearing
- Live OAuth ingest of Slack/Gmail on stage (Invariant 4 violation)
- Auto-PRs against external repos (GitHub abuse-flag risk; was DA #2's red card)
- Auth, billing, multi-tenancy admin features beyond Invariant 3's audit log
- Pixel-perfect mobile responsive UI (the production URL is the product)
- LangChain / LangGraph / agent frameworks — Convex Agent component is enough

### Time Sinks That Feel Productive But Aren't

- Making the upload page pixel-perfect before the pipeline runs end-to-end in replay mode
- Designing the "perfect" Convex schema instead of shipping the schema as documented in §Schemas
- Comprehensive test coverage for code that won't exist in 5 hours
- Refactoring the agent loop before the pipeline is demonstrably working
- "Cleaning up" the system prompt without a Codex review

---

## Operational Moves (Steal Winning Patterns)

These are infrastructure choices that signal *"this team will ship after May 9."* They're cheap to add and they show.

### Multi-API-Key Rotation
- Rotation triggers on HTTP 429 / 5xx / 401 / 403
- State lives in Convex (`apiKeyRotation` table)
- Wrappers in `lib/hyperspell/client.ts` + `lib/nia/client.ts` import the rotated key from there
- This is the pattern that survives the demo with judges live-running the flow

### "No Signup, Click to Use" Magic-Link
- `app/page.tsx` is the public landing
- A `?demo=judge` query param drops user directly into a pre-warmed session with seed data already linked
- PRs that add a signup gate to the demo path don't merge

### CHANGELOG.md, Daily
- One section per day from project start
- Format: `## 2026-05-09 — Day 1`
- Update at end of each day
- Judges who skim the repo see consistent shipping cadence

### File Issues Back to Sponsors
- Track candidate issues in `docs/sponsor-feedback.md` as we hit them
- File at least 2 GitHub issues against Hyperspell or Nia SDKs / docs by demo week
- Real friction we hit, real fixes we'd want — operational signal to sponsor judges

---

## Demo Day (2026-05-09)

### Hard rules

- **By H4:30 (1 hour before submission deadline)** — record `docs/demo-backup.mp4` via `npm run record-backup` and push to repo. **Always.** Wifi-died hedge.
- **Pre-warm replay cache by H4:00** — `npm run prewarm` seeds responses for Trace A + Trace B + 1 backup
- **Dry-run twice in `DEMO_MODE=replay`** + once in `hybrid` before stage call
- **Never run `DEMO_MODE=live` for the first time on stage**
- **Stage flag** — flip to `replay` by default; switch to `hybrid` only if venue Wi-Fi is verified < 100ms RTT
- **Backup video must show the same exact 90-second beats as the locked demo**

### Stage checklist (T-30 minutes)

- [ ] `DEMO_MODE=replay` confirmed in deployed env
- [ ] `npm run check:invariants` — all 4 green
- [ ] `npm run prewarm --verify` — dry-render passes in <30s for Trace A + Trace B
- [ ] `git push origin main` — CI green; backup video committed
- [ ] Browser tab open on production URL with demo session pre-staged
- [ ] Trace A pasted into textarea history (Cmd+Z to recall)
- [ ] Trace B in clipboard
- [ ] Loom backup loaded in Tab 3
- [ ] Architecture slide queued in Tab 2
- [ ] QR code card visible to audience
- [ ] Phone hotspot ON, password handy
- [ ] Person 1's Convex dashboard open on second laptop (the "receipts" angle)
- [ ] Big-screen mirroring tested
- [ ] Browser zoom 125%

### Recovery script if demo dies on stage

> *"Live agents on free-tier APIs at hour 5 — exactly the bug we built this for. Let me show you the last 6 successful runs."*
>
> Switch to Loom (Tab 3). Person 3 narrates over the playback at 1.25× speed. Person 1 silently reboots backend. Land the close on architecture + validation slide. **Recovery in front of judges scores higher than a clean first run.**

---

## Core Principles

- **Invariants are invariants** — Cite-Or-Die, Memory Reinforcement, Hot/Cold Split, Hermetic Demo. No PR merges without all four green. **No PR merges without Codex review.**
- **Verticalize, don't generalize** — SRE on-call incident triage, period. Don't generalize the agent for "any problem" — that loses Track-4 thematic fit.
- **Cross-source synthesis is the rubric play** — joining Slack + Notion + Gmail + Code with cited claims is the 30% axis. (Item 1 of why Triage was picked over 11 alternatives.)
- **Memory reinforcement is the demo** — the new-citation-on-Trace-B beat is what Conor + Manu remember. Anything that breaks it blocks merge.
- **Demo-driven** — if it doesn't show in 90 seconds, cut it. The Trace B new-citation moment and the architecture slide are everything.
- **No mocks on the demo path** — real Convex actions, real Hyperspell calls (or replay), real Nia citations.
- **Sponsor integrations are architectural, not checkbox** — Hyperspell + Nia + Convex + InsForge each earn their place via a *different load-bearing job*.
- **Honesty > theater** — synthetic phantom labeled on screen; cite-or-die surfaces verification failures, not hides them.
- **Pre-warm — replay fixtures the night before. Backup video by H4:30. Always.**
- **Quality over speed within the deadline** — a late but undeniable demo beats an on-time but mediocre one. **A broken invariant is worse than a missed deadline.**
- **Codex is a feature, not a tax** — independent review catches what self-review misses. Treat it as a force multiplier, not as a gate to argue around.

---

## References

- [`PLAN.md`](./PLAN.md) — execution plan (5h, 3-person, kill switches)
- [`IDEAS.md`](./IDEAS.md) — ideation + 9-agent scoring (why Triage)
- [`SPONSORS.md`](./SPONSORS.md) — sponsor capability briefs + devil's advocate audit
- [`SETUP_CHECKLIST.md`](./SETUP_CHECKLIST.md) — API key creation per sponsor
- [`research/`](./research/) — raw `/last30days` outputs per sponsor
- [`.env.example`](./.env.example) — env-var reference
- Nozomio Hackathon: https://luma.com/rshibq6i
- Hyperspell docs: https://docs.hyperspell.com/
- Nia docs: https://docs.trynia.ai/welcome
- Convex Agent component: https://docs.convex.dev/agents
- InsForge docs: https://docs.insforge.dev/introduction
- Anthropic Codex API: https://docs.anthropic.com/

---

## Appendix — Codex Self-Review Cheat Sheet

When Codex is about to push a commit, run this 30-second checklist *before* opening the PR. Codex shouldn't be the first to catch these:

- [ ] Did I touch any of the 4 invariants? If yes, did I update tests + the PR body checklist?
- [ ] Are all my tool returns of shape `{ ..., citations: Array<{ source, source_id, excerpt, verified }> }`?
- [ ] If I added an outbound call, does it have a `DEMO_MODE=replay` branch?
- [ ] If I added a Convex table, is it hot-path data (per-session, ephemeral)? If audit-grade, it should be in InsForge.
- [ ] If I added an InsForge table, does it have RLS by `org_id`?
- [ ] Does the system prompt still enforce "refuse to claim without a citation"?
- [ ] Did I run the demo locally and watch the trace UI render the citation drawers?
- [ ] Did I run `tests/invariants/reinforcement.test.ts` to confirm Trace B still surfaces a new citation?
- [ ] Is the change visible (or invisible) in the 90-second demo as expected?
- [ ] Would Codex have notes on this? If yes, fix before pushing.

> **The standard is "work Codex won't have notes on."** If you're not sure, you're not done.
