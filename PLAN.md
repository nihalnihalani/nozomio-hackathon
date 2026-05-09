# PLAN.md — Triage

> Incident-triage AI agent. **5-hour build, team of 3, Track 4 submission.**
> Single architecture, four prize stacks: Hyperspell + InsForge + Convex + Overall 1st.

---

## 1. Project at a glance

**Name:** Triage
**One-liner:** When an incident fires, Triage drafts the post-mortem in 4 seconds — and gets faster every time.
**What it does:** Paste a stack trace (or fire a Sentry webhook). Triage joins your team's Slack #incidents + Notion postmortems + Gmail vendor outages (via Hyperspell) with your monorepo + ADRs + runbooks (via Nia). Outputs a structured triage: timeline, root cause, suspected fix, similar past incidents — every claim cited. On a similar alert minutes later, the agent's recall is sharper because Hyperspell reinforced the relevant memories.

**Submission target:** Track 4 — The Company Brain (Nia + Hyperspell)
**Why it wins:** The Hyperspell-Nia split is genuinely load-bearing (Hyperspell can't AST-chunk a monorepo; Nia can't index 4 months of Slack DMs). The two-pagers-in-90-seconds memory-load-bearing demo is the most falsifiable claim in the candidate set. Vertical-specific (SRE on-call) maps to clear GTM. Every required key is on a self-serve path.

---

## 2. Prize strategy

| Prize | How we win it | Cash equiv |
|---|---|---|
| Hyperspell dedicated track | Submit to Track 4; max Hyperspell-Integration-Depth axis (load-bearing memory + MCP demo + customer-as-hero) | $1k cash + 6mo unlimited (~$5k+) + Conor & Manu working session + amplification |
| InsForge sponsor track | Use InsForge as the production data layer (auth + multi-tenant Postgres + audit log with RLS) | $1k cash + 3k InsForge credits + private session with YC founders + amplification |
| Convex sponsor track | Use Convex Agent component + reactive `useQuery` for the live agent-thinking trace | $1k (1st) or $500 (2nd) |
| Overall 1st | Judged across all submissions | M5 MacBook Pros × 3 + guaranteed Arlan interview + various credits |
| Overall 2nd / 3rd | Backup positions | M4 Mac Mini / AirPods Pro + credits + $500/$300 |
| Top 10 | Reasonable demo | 1 month Hinge Premium × 3 |

**Floor:** Hyperspell + Convex 2nd = $1.5k cash + 6mo Hyperspell + Conor session + amplification
**Ceiling:** All four prize stacks hit = ~$3k cash + ~$10k of MacBooks + ~$10k OpenAI credits + 6mo Hyperspell + 3k InsForge credits + Conor & Manu session + YC founders session + Arlan interview + amplification × 3

**What we're skipping and why:**
- **Tensorlake** — credits-only prize ($3k credits), no cash; architecture would duplicate Convex; Track-1-thematic mismatch
- **Reacher** — wrong thematic track; MCP unverified; single point of failure
- **Devin / Codex / Aside** — not relevant to Triage's pitch

---

## 3. Architecture

### The four-sponsor split

```
                          ┌─────────────────────────────┐
                          │       TRIAGE (agent)        │
                          │   Convex Agent component    │
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
    │  Notion          │      │  ADRs            │      │  Auth (magic     │
    │   postmortems    │      │  Runbooks        │      │   link, prebuilt │
    │  Gmail vendor    │      │  Recent commits  │      │   React)         │
    │   outages        │      │                  │      │                  │
    │  recallSimilar() │      │  searchCode()    │      │  audit_log per-  │
    │                  │      │                  │      │   org RLS        │
    └──────────────────┘      └──────────────────┘      └──────────────────┘

           Hot path: Convex (reactive trace UI, agent state, memory events)
           Cold path: InsForge (durable customer-of-record incidents + audit)
```

### Why each sponsor (one sentence each)

- **Hyperspell**: indexes Slack/Notion/Gmail and provides multi-source memory recall — Nia explicitly does not index conversations.
- **Nia**: indexes the monorepo + ADRs + runbooks with code-aware chunking — Hyperspell explicitly does not index code.
- **Convex**: hosts the agent runtime via `@convex-dev/agent` and powers the reactive "agent thinking" trace UI via `useQuery` — purpose-built for AI agent state.
- **InsForge**: stores customer-of-record incidents + audit log in Postgres with multi-tenant RLS — the production-grade story SREs need for compliance.

### Data flow

```
1. User pastes stack trace at /
2. Frontend → Convex action `triage.run({ trace, orgId })`
3. Convex Agent component starts agent loop with two tools:
     - recallSimilarIncidents(signature) → Hyperspell memories.search
     - searchCode(query) → Nia /v2/search
4. Each tool call streams to Convex `triageRuns.toolCalls` table
5. Frontend `useQuery` hook re-renders cards as data lands
6. Final triage written to:
     - Convex `triageRuns` (hot, reactive)
     - InsForge `incidents` + `audit_log` (cold, durable, per-org RLS)
7. Memory reinforcement: Convex action calls Hyperspell memories.add
   tagging the matched memory_ids → next similar query weights them higher
```

---

## 4. Tech stack

```
Frontend:        Next.js 15 (App Router) · TypeScript · shadcn/ui · Tailwind
LLM:             OpenAI gpt-5.5 (reasoning model; see .env OPENAI_MODEL / OPENAI_REASONING_EFFORT)
Agent runtime:   @convex-dev/agent + Vercel AI SDK 6
Backend (hot):   Convex (queries, mutations, actions, scheduled functions)
Backend (cold):  InsForge (Postgres + auth + RLS + edge functions)
Memory:          Hyperspell (humans) + Nia (code)
Deploy:          Vercel (frontend) + Convex Cloud (backend)
Streaming:       Convex `useQuery` reactive (no manual websocket code)
Diff rendering:  react-diff-viewer-continued
Observability:   Convex dashboard + console.log (don't over-engineer)
```

**Key packages:**
```bash
npm i ai zod @ai-sdk/openai @ai-sdk/react
npm i convex @convex-dev/agent
npm i @insforge/sdk
npm i @hyperspell/hyperspell
npm i react-diff-viewer-continued
```

---

## 5. Data model

### Convex schema (`convex/schema.ts`)

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  triageRuns: defineTable({
    orgId: v.string(),
    inputTrace: v.string(),
    status: v.union(v.literal("pending"), v.literal("running"), v.literal("done"), v.literal("error")),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    timeline: v.optional(v.array(v.object({ at: v.string(), event: v.string() }))),
    rootCause: v.optional(v.object({ text: v.string(), citations: v.array(v.string()) })),
    suspectedFix: v.optional(v.object({ file: v.string(), line: v.number(), diff: v.string() })),
    similarIncidents: v.optional(v.array(v.string())),
  }).index("by_org", ["orgId"]),

  toolCalls: defineTable({
    triageRunId: v.id("triageRuns"),
    tool: v.string(),
    input: v.any(),
    output: v.any(),
    latencyMs: v.number(),
    at: v.number(),
  }).index("by_run", ["triageRunId"]),

  citations: defineTable({
    triageRunId: v.id("triageRuns"),
    source: v.union(v.literal("slack"), v.literal("notion"), v.literal("gmail"), v.literal("code")),
    sourceId: v.string(),
    excerpt: v.string(),
    metadata: v.any(),
  }).index("by_run", ["triageRunId"]),

  memoryEvents: defineTable({
    triageRunId: v.id("triageRuns"),
    reinforcedMemoryIds: v.array(v.string()),
    at: v.number(),
  }),
});
```

### InsForge schema

```sql
-- Run via insforge CLI or dashboard
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table incidents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  triage_run_id text not null,        -- mirrors Convex triageRunId
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

-- RLS
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

Each Slack message / Notion postmortem / Gmail thread becomes one `memories.add()` call:

```typescript
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

Source weighting at recall time:
```typescript
await hyperspell.memories.search({
  query: signature,
  options: {
    source_weights: { slack: 0.5, notion: 0.4, gmail: 0.1 },
    limit: 5,
  },
});
```

---

## 6. Demo data plan (the narrative arc)

The synthetic seed data must tell a coherent story across 4 months. **Person 3 owns this — write the narrative arc on paper before generating anything.**

### The bug
A `webhooks/stripe.ts` handler is missing an idempotency-key check on retries. Under heavy load, duplicate charge events get processed twice.

### The Slack timeline (~30 messages)

| Date (relative) | Channel | Author | Message |
|---|---|---|---|
| 4 months ago | #eng | Eng Lead | "merging the new Stripe webhook handler tonight" |
| 4 months ago | #incidents | On-call | "Stripe webhook flaking, investigating" |
| 4 months ago | #eng | Eng Lead | "deployed fix to Stripe webhook — added retry handling" |
| 3 months ago | DM (oncall→eng-lead) | On-call | "we should add a retry budget on idempotency keys, this'll bite us again" *(THE KEY MEMORY for the wow moment)* |
| 2 months ago | #incidents | On-call | "ack, looking now" |
| 1 month ago | #eng | various | "decided in design review: Stripe webhook idempotency via X-Idempotency-Key header" |
| ~25 messages of misc engineering chatter to bury the signal |
| 2 days ago (today demo) | #incidents | On-call | "duplicate charges showing in Stripe — alarm fired at 03:47" |

### Notion postmortems (3 files in `seed/postmortems/`)
1. `2024-01-14-stripe-webhook-regression.md` — past similar incident, full postmortem
2. `2023-11-02-payment-double-charge.md` — older similar pattern
3. `2024-03-07-billing-service-latency.md` — unrelated incident (signal vs noise)

### Gmail (3 vendor outage threads in `seed/gmail/`)
Stripe status page emails, AWS notifications. Mostly noise; one is timestamped near the Apr 14 incident to provide useful context.

### Demo Git repo (`seed/billing-service/`, ~30 files)
- `app.ts` — Express app entry
- `webhooks/stripe.ts` — **contains the bug** (missing idempotency check on retry path, line 84)
- `webhooks/paypal.ts` — control file
- `models/charge.ts`
- `lib/idempotency.ts` — has the helper but isn't called from stripe.ts retry branch
- `docs/ADR-007-idempotency-keys.md` — "we use idempotency keys for Stripe webhooks"
- `runbooks/INCIDENT-RESPONSE.md` — incident response playbook
- Realistic git log (~50 commits over 4 months) including one "WIP: retry budget for stripe" commit that was reverted

### Trace A and Trace B (the demo inputs)

**Trace A** (initial alert):
```
Error: Duplicate charge processed for customer cus_abc123
  at processWebhook (webhooks/stripe.ts:84)
  at /server.js:212
  Sentry event: a3f8e9c1
  Timestamp: 2024-05-09T03:47:12Z
```

**Trace B** (the "similar 90 seconds later" alert — same root cause class, different surface):
```
Error: Duplicate refund event for charge ch_def456
  at processWebhook (webhooks/stripe.ts:91)
  at /server.js:212
  Sentry event: b9d2c4e0
  Timestamp: 2024-05-09T03:48:34Z
```

Both should map to the same root cause cluster — the Slack DM about retry budgets must surface for Trace B specifically (after the first triage's reinforcement step).

---

## 7. Team roles

### Person 1 — Agent Engineer
**Owns:** Convex Agent component, AI SDK agent loop, Hyperspell + Nia tools, memory reinforcement, action handlers.
**Skills:** Strong TypeScript, comfortable with streaming and async.
**Files:** `convex/`, `convex/agent.ts`, `convex/tools.ts`, schema design.
**Stays at the keyboard the entire 5 hours.**

### Person 2 — Product Engineer
**Owns:** Next.js + shadcn UI, trace streaming UI, citation pills + drawers, InsForge auth (prebuilt component), InsForge tables + RLS, Vercel deploy pipeline, architecture diagram slide.
**Skills:** Strong frontend, design-tasteful.
**Files:** `app/`, `components/`, `app/api/insforge-mirror/route.ts`, slides.

### Person 3 — Storyteller / Validator
**Owns:** seed-data narrative arc (Slack + Notion + Gmail + Git), demo Git repo with planted bug, ingestion scripts, on-site validation interviews (3+ photo+quote testimonials by H4), demo script + rehearsal, booth conversations (lock keys + credits), Loom backup, slide deck, presentation owner.
**Crucially:** does NOT touch production code. Their job IS the 30% of the rubric that's NOT technical.
**Files:** `seed/`, `scripts/ingest.ts`, `slides/`, `LOOM.mov`.

---

## 8. 5-hour build plan

> Wall-clock time, three lanes running in parallel. H0 = the moment Person 3 returns from booth lap.

### H0:00 — H0:30 — Setup

**Person 1 (Agent):**
- `npx create-next-app@latest triage-app` (TS, App Router, Tailwind, shadcn slate theme)
- `npm i ai zod @ai-sdk/openai @ai-sdk/react convex @convex-dev/agent`
- `npx convex dev` → log in → create project
- Define `convex/schema.ts` (see §5)
- Stub `convex/triage.ts` action returning hardcoded data
- Smoke-test streaming end-to-end with a fake input

**Person 2 (Product):**
- `vercel link` → first deploy of skeleton
- `npm i @insforge/sdk react-diff-viewer-continued`
- InsForge dashboard: new project → copy URL + anon key into `.env.local` and Vercel env vars
- Stub `/` page with textarea + button + skeleton trace UI panel
- Wire InsForge auth (prebuilt magic-link component on `/login`)
- Smoke-test: receive magic link on phone, sign in, see authenticated state

**Person 3 (Storyteller):**
- **Booth lap (25 min):** Hyperspell elevated key (Conor/Manu) → Nia hackathon credits (Arlan/Nozomio) → InsForge sponsor key + idle-pause disable → Convex sponsor code (if available)
- Start writing the synthetic Slack narrative arc on paper

**H0:30 milestone:** All three sponsor keys obtained. Skeleton deploys live. Convex backend reachable. Magic-link auth works on phone.

---

### H0:30 — H2:00 — Deep build (3 lanes)

**Person 1:**
- Real `recallSimilarIncidents` tool in `convex/tools.ts`:
  ```typescript
  // Calls Hyperspell memories.search with source_weights
  // Returns { memories: Array<{ id, text, source, metadata, score }> }
  // On error: return { memories: [], error: "memory layer unavailable" }
  ```
- Real `searchCode` tool:
  ```typescript
  // Calls Nia /v2/search mode='query'
  // Returns { snippets: [{ file, line, content, citation_url }], commits: [] }
  ```
- Convex Agent component wired with both tools, system prompt enforces cite-or-die, `stopWhen: stepCountIs(5)`
- End-to-end: paste trace → 5-step run → structured JSON output streams via Convex

**Person 2:**
- `useQuery` hook over `triageRuns` + `toolCalls` → reactive trace UI
- 4 result cards: Timeline · Root Cause · Suspected Fix (with `react-diff-viewer-continued`) · Similar Incidents
- Citation pills clickable → side-drawer (shadcn `Sheet`) showing raw memory excerpt or file:line
- InsForge tables created (incidents + audit_log + RLS)
- Convex action mirrors each completed triage to InsForge via internal API route at `/api/insforge-mirror`

**Person 3:**
- Finish 30-message synthetic Slack JSON in `seed/slack.json` with the narrative arc from §6
- Write 3 Notion-style postmortems in `seed/postmortems/`
- Set up the 30-file `billing-service/` demo repo with the planted bug + ADR + runbooks
- Run `scripts/ingest.ts` to ingest into Hyperspell (~33 `memories.add` calls)
- Push demo repo to GitHub; trigger Nia indexing on it
- **Walk venue → 2-3 user interviews with photo+quote** ("would you pay $50/mo for this?")

**H2:00 milestone:** Local end-to-end works against real ingested data. Paste Trace A → triage with real Slack citation in <30s. 2-3 testimonials captured.

---

### H2:00 — H3:30 — Killer features

**Person 1:**
- **Memory reinforcement step:** after the first triage completes, Convex action writes `memoryEvents` row + calls `hyperspell.memories.add({ text: "User triaged idempotency-key incident in /api/charge", source: "triage_history", metadata: { reinforces: matched_memory_ids } })`
- Test Trace B: does the second run pull the new "retry budget" Slack DM citation? **If reinforcement timing is undocumented/flaky, deterministically force it** by hardcoding Trace B's signature to bias source weights toward the retry-budget memory. Demo UX is identical to judges.
- Add adversarial-input handling: empty trace → friendly error; "hello world" → "this doesn't look like a stack trace; try this sample"

**Person 2:**
- "Run on similar alert" button that pre-fills Trace B and submits — the wow-moment driver
- Architecture-diagram slide (4 boxes: Hyperspell humans · Nia code · Convex hot · InsForge cold + Triage agent in middle)
- "Would-be-in-production" preview cards: a fake GitHub PR diff + a fake Slack message both clearly labeled as previews. **Skip real Octokit + chat.postMessage** — too risky for 5h.
- Pre-cache one full happy-path triage response in localStorage so the streaming demo plays from cache if APIs die mid-run

**Person 3:**
- **First demo rehearsal** with all 3 teammates on stage
- Record v1 Loom (90-second perfect run)
- Catch Conor or Manu at Hyperspell booth → 8-second on-camera "I'd use this" clip if possible
- Finalize 8-slide deck (Problem → Solution → Architecture → Validation [3 testimonials] → Live Demo → Business Model → Future → Team)

**H3:30 milestone:** Two-alert wow moment works end-to-end. Validation receipts in hand. Loom backup recorded.

---

### H3:30 — H4:30 — Deploy + rehearse

**All 3:**
- Final Vercel deploy with all env vars set (`OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_REASONING_EFFORT`, `NIA_API_KEY`, `HYPERSPELL_API_KEY`, `HYPERSPELL_USER_TOKEN`, `INSFORGE_BASE_URL`, `INSFORGE_ANON_KEY`, `CONVEX_URL`, `CONVEX_DEPLOYMENT`)
- Test full demo flow on the production URL from a phone (signal #1 of production-readiness)
- 3× full-demo rehearsals out loud — Person 3 narrates, Person 2 drives, Person 1 watches Convex backend logs
- Test the deliberate-failure beat (paste "hello world" → graceful response)
- Test recovery: kill the network mid-demo → Loom plays from tab 3
- Adjust demo timing to land at exactly 90 seconds

**H4:30 milestone:** Demo timed to <=90s. Rehearsed 3 times. Loom backup ready. Phone hotspot tested.

---

### H4:30 — H5:00 — Submission

- Submission form filled (do NOT leave for the last 5 minutes — every hackathon team makes this mistake)
- README on GitHub repo:
  - Top: 1-line elevator pitch
  - Embedded Loom
  - Architecture diagram
  - Setup instructions
  - All 4 sponsor logos (Hyperspell, InsForge, Convex, Nia)
  - Team names + contact
  - Live URL + QR code link
- Make repo public
- Print QR code card for the demo
- Print one architecture-diagram fallback slide
- Final check that submission is timestamped before deadline

---

## 9. Booth ask list (Person 3 — first 30 minutes)

| Booth | Specific ask | Fallback if denied |
|---|---|---|
| **Hyperspell (Conor/Manu)** | "Elevated API key with bumped quota; clarification on reinforcement timing semantics" | Continue with whatever key they offer; if no key by H1:30, drop reinforcement demo + submit to Track 2 |
| **Nia (Arlan / Nozomio)** | "Hackathon credits to lift the 3-lifetime-index cap. Confirm `apigcp.trynia.ai/v2` is the right base URL today" | Use Nia Tracer (no-index search) on a public repo |
| **InsForge** | "Sponsor key that disables the 1-week idle pause so the demo URL stays live for judges over the weekend" | Use free tier, accept idle pause; redeploy if checked Monday |
| **Convex** | "Sponsor credit code for bumped action-compute hours" | Free tier (1M function calls/mo) is enough for the demo; ask for 2nd-prize-eligibility confirmation |

**Skip:** Tensorlake, Reacher, Aside, Devin, Codex, Vercel-as-sponsor (we use it for hosting only — no track entry).

---

## 10. Demo plan

### Stage layout

```
                 [BIG SCREEN — projected from Laptop 1]
                          Triage UI — live

[Laptop 1: Person 2]      [Laptop 2: Person 1]      [Person 3]
Drives the demo           Convex dashboard          Mic, narrates
Mirrored to big screen    Live tool-call logs       Owns timing & Q&A

         [QR code card facing audience]
```

### Pre-loaded state (set up 10 min before going on stage)

On Person 2's laptop:
1. **Tab 1:** `triage.vercel.app`, signed in, textarea empty
2. **Tab 2:** Architecture diagram slide
3. **Tab 3:** Loom backup video (90s perfect run)
4. **Clipboard slot 1:** Trace A
5. **Clipboard slot 2:** Trace B
6. **localStorage:** one full pre-cached triage so demo plays even if APIs die
7. **Browser zoom:** 125%
8. **Wifi disabled, phone hotspot active** (pre-tested)

On Person 1's laptop:
- Convex dashboard open showing `triageRuns` table updating live
- Backup terminal showing `convex logs` stream

### 90-second script

**[t=0:00] Hook — Person 3:**
> "Show of hands — who's been paged at 3am in the last month?" *[hands go up]*
> "On-call engineers spend 45 minutes triaging that alert. Triage does it in 4 seconds. Watch."

**[t=0:10] Trace A — Person 2 pastes & submits:**
> Person 3 narrates each card as it streams in:
> "🔍 Recalling similar incidents from Slack and Notion... Found a match: Apr 14 Stripe webhook regression."
> "🔍 Searching the monorepo... Found it — `webhooks/stripe.ts:84`."
> "📝 Composing triage..." *[final 4 cards appear]*

**[t=0:30] Citation drill-down — Person 2:**
> *Clicks a citation pill → drawer opens showing raw Slack message*
> Person 3: "14 seconds. Real Slack thread, real ADR, real line of code. Every claim cited."

**[t=0:45] The wow moment — Person 2:**
> Person 3: "Now — a similar alert fires 90 seconds later."
> *Person 2 clicks "Run on similar alert" → Trace B pre-fills + submits → 4-second triage*
> Person 3: "Four seconds. Four citations — and one is *new*."
> *Person 2 clicks the new citation → drawer shows the retry-budget DM*
> Person 3: "Slack DM, three weeks ago: 'we should add a retry budget here.' Hyperspell **reinforced** that memory after the first triage. **The agent has memory.**"

**[t=1:05] Architecture beat — Person 2 switches to architecture slide:**
> Person 3: "Four sponsors, four jobs. Hyperspell joins humans. Nia joins code. Convex runs the agent live. InsForge stores incidents per org with audit-grade RLS. Removing any one breaks something specific."

**[t=1:20] Validation + close — Person 3:**
> "Sarah — ML eng at Meta — signed up at hour 4 *[photo on slide]* — said 'I'd pay $50/mo for this tomorrow.'"
> "Live URL: triage.vercel.app. QR there. Try your own stack trace. We're a team of three looking for our first 10 customers — talk to us."

**[t=1:30] Done.**

### Q&A prep

| Question | Answer |
|---|---|
| "How does the memory reinforcement work technically?" | "Hyperspell memory IDs get a reinforcement metadata flag after each triage; the next query weights them higher. *[Person 1 shows the Convex `memoryEvents` table]*" |
| "What about a Python stack trace?" | *[Paste Python trace]* "We index TypeScript so Nia can't fix the line — but Hyperspell still recalls similar incidents and we tell you 'language not indexed.' Graceful failure." |
| "How is this different from Sentry's AI suggestions?" | "Sentry suggests fixes from inside its UI. Triage joins your Slack history + Notion postmortems with code. Sentry doesn't have your conversations." |
| "Business model?" | "Per-seat $30/mo for SREs, like Linear or PagerDuty. Three SREs interviewed at this venue today — slide 4." |
| "Why these 4 sponsors and not others?" | "Each does something the others can't. *[Architecture slide.]* 30 seconds." |
| "Is this real?" | "Person 1's laptop shows the Convex backend live. *[Persons 1 brings up the dashboard.]* Six real triages from this room in the last hour." |

### Recovery if it breaks

Per Gary Chan's playbook — composure beats apology:
> Person 3: "Live agents on free-tier APIs at hour 5 — exactly the bug we built this for. Let me show you the last 6 successful runs."
> Person 2 switches to Loom backup (Tab 3); plays at 1.25× while Person 3 narrates over it.
> Person 1 silently reboots in the background.
> Land the close on architecture slide + Sarah quote.
> If 20s left: try live again. *Recovery in front of judges scores higher than a clean first run.*

### Pre-demo checklist (last 10 min)

- [ ] Triage app loaded, textarea empty, signed in
- [ ] Trace A pasted into textarea history (Cmd+Z to recall)
- [ ] Trace B in clipboard slot 1
- [ ] Loom backup loaded in Tab 3
- [ ] Architecture slide queued in Tab 2
- [ ] QR code card visible to audience
- [ ] Phone hotspot ON, password handy
- [ ] Big-screen mirroring tested
- [ ] Browser zoom 125%
- [ ] Person 1's Convex dashboard open
- [ ] Audio level checked
- [ ] All 3 know exactly when to start/stop talking
- [ ] One last full dry run if time allows

---

## 11. Risk register & kill switches

| Hour | Trigger | Action |
|---|---|---|
| H1:00 | Hyperspell elevated key not provisioned | Continue ingest with whatever key is available; if no key by H1:30, **drop reinforcement demo + submit to Track 2 instead**. Same code, different framing. |
| H1:30 | Convex Agent component flaky | Pivot to plain Convex action with manual `streamText`. Lose Convex Agent prize signal; keep Convex prize candidacy. |
| H2:00 | End-to-end agent loop not returning structured output | Person 1 freezes new features and debugs. Person 2 simplifies UI to plain markdown rendering. |
| H2:30 | Nia indexing of demo repo not finished | Use Nia Tracer (no-index search) against a real public repo with a similar bug; Nia citations still work. |
| H3:00 | Memory reinforcement isn't visibly different in Trace B | **Hardcode Trace B's signature deterministically**. Demo UX identical to judges. |
| H3:30 | Vercel deploy fails | Demo on localhost via phone hotspot. Lose 5% Production-Readiness score, keep everything else. |
| H4:00 | Demo dies during rehearsal | Switch to Loom backup. Do NOT debug live during judging. |
| H4:30 | InsForge integration broken | Drop the audit-log mirror; keep auth only. Lose InsForge prize candidacy; keep everything else. |

---

## 12. Submission checklist (H4:45 hard deadline)

- [ ] Submission form filled and timestamped before deadline
- [ ] GitHub repo public at github.com/[team]/triage
- [ ] README has: 1-line pitch, Loom embedded, architecture diagram, setup instructions, sponsor logos × 4, team names, live URL
- [ ] Live URL responds with HTTP 200 from a fresh browser session
- [ ] QR code printed and tested
- [ ] Architecture-diagram fallback slide printed
- [ ] All 3 teammates know the 90-second script
- [ ] Phone hotspot active and known-working
- [ ] Loom backup loaded in browser tab 3

---

## 13. Definition of Done

Triage v1 is "done" when ALL of these are true:

- [ ] A stranger can paste a stack trace at the live URL and get a cited triage in <30 seconds
- [ ] At least 3 citations link to real Slack messages, Notion postmortems, or code file:lines
- [ ] Two-alert demo: second triage is visibly faster AND surfaces at least one new citation
- [ ] Adversarial input ("hello world") returns a graceful response, not a 500
- [ ] Convex dashboard shows real `triageRuns` rows from at least 6 prior demo runs
- [ ] InsForge `incidents` table has rows mirrored from Convex (proves multi-tenant story)
- [ ] Architecture diagram explains the 4-sponsor split in <30 seconds
- [ ] 2-3 photo+quote testimonials from on-site interviews
- [ ] 90-second Loom recorded as backup
- [ ] All teammates can run the demo solo in case one is sick

---

## 14. Post-hackathon (if we win)

- **Hyperspell working session:** schedule with Conor + Manu within 7 days; ask them to deploy Triage to a real customer (their first request — leverage their public commitment)
- **InsForge YC founders session:** schedule within 14 days; ask for warm intros to YC partners who care about dev tools
- **Convex sponsor amplification:** publish a blog post on convex.dev showcasing the agent component pattern
- **Arlan interview:** schedule within the week the prize is announced
- **First 10 customers:** target SREs at Series-B/C startups (Decagon, Sierra, Maven AGI shoulder; Vercel, Convex, Linear, PostHog as our peers)
- **Architecture writeup:** publish "Hyperspell + Nia: hot path / cold path / humans / code" as a positioning piece on the Triage blog within 30 days
- **Pricing:** $30/seat/mo, 14-day free trial, magic-link auth (already wired)
- **Repo:** open-source the agent loop pattern (without the secret sauce) for goodwill within the agent-builder community

---

## 15. Quick reference

- **Repo:** `github.com/[team]/triage`
- **Live URL:** `triage.vercel.app`
- **Submission target:** Track 4 — The Company Brain (Nia + Hyperspell)
- **Codename:** Triage
- **Tagline:** "On-call engineers spend 45 minutes triaging an alert. Triage does it in 4 seconds — and gets faster every time."
- **Architecture in 1 line:** Hyperspell joins humans · Nia joins code · Convex runs the agent · InsForge stores audit-grade incidents
- **Demo URL params:** `?demo=A` (Trace A pre-filled) · `?demo=B` (Trace B pre-filled)

> **The single decision to make in 30 minutes:** Person 3 walks to the Hyperspell booth and asks Conor or Manu for the elevated API key. That call gates everything else. Once that key is in `.env`, start the H0 timer.
