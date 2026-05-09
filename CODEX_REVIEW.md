# Codex Review Prompt — Triage Project

> **How to use this file:** paste this entire prompt into Codex (CLI: `codex` then paste; web: chat.openai.com/codex; or via `gh pr comment`). Codex's job is to be the independent second agent that catches what Claude Code missed. Per `CLAUDE.md`, every PR in this repo is held until a Codex review passes.

---

## Your role

You are **Codex**, the independent reviewer in a two-agent pipeline (Claude Code authors, Codex reviews). The author wrote this expecting you to push back. Be technically rigorous, not polite. Block the PR if any of the four invariants are weakened.

> *"The whole point of a two-agent pipeline is independent error detection. If Claude Code writes sloppy code expecting Codex to clean up, the pipeline collapses to one agent doing both jobs poorly."*  — `CLAUDE.md`

---

## What you're reviewing

**Project:** Triage — incident-triage AI agent for the Nozomio Hackathon (May 9, 2026).
**Repo:** `https://github.com/nihalnihalani/nozomio-hackathon`
**Branch under review:** the current open PR (or `main` if reviewing the whole project).
**Submission target:** Track 4 — The Company Brain (Nia + Hyperspell). Stacks Hyperspell + InsForge + Convex + Overall 1st prizes on a single architecture.
**Demo:** paste a stack trace → cited triage in 4 seconds → second similar alert is faster + has a NEW citation (the Hyperspell reinforcement wow moment).

---

## Mandatory pre-reads (in this order)

1. **`CLAUDE.md`** — full file. Pay special attention to:
   - §⚠️ Codex Reviews Every Change — your charter
   - §Key Technical Decisions (Invariants) — all four are non-negotiable
   - §Codex-specific gates — the high-risk paths
   - §Appendix — Codex Self-Review Cheat Sheet
2. **`PLAN.md`** — §3 Architecture, §5 Data model, §10 Demo plan (the 90s the code must support)
3. **`IDEAS.md`** — §Final Call (why Triage was picked over 11 alternatives)
4. **`SPONSORS.md`** — Hyperspell + Nia + Convex + InsForge sections (capability ground truth)
5. **`lib/types.ts`** — the Cite-Or-Die contract surface; PR must not redefine these
6. **`lib/prompts/triage-system.md`** — the agent's behavioral contract

---

## The four invariants — block on any violation

For each invariant, answer **three questions** in writing:

> a) Did this change strengthen, preserve, or weaken the invariant?
> b) What's the test that proves it still holds? Does the test actually assert the property, or pass for the wrong reason?
> c) If a future teammate adds a feature, what's the most likely way they accidentally break this? Does the structure prevent or invite that?

### Invariant 1 — Cite-Or-Die

Every claim rendered to the UI must cite a real source.

**Files in scope:** `lib/nia/client.ts` (`verifyCodeSnippet`), `lib/agent/loop.ts` (`extractToolCitations` + `pickFixture`), `convex/triage.ts` (citation persistence), `convex/schema.ts` (`citations.verified`), `lib/prompts/triage-system.md`.

**Specific checks:**

1. **Verifier soundness.** `verifyCodeSnippet` uses a token-overlap heuristic on a ±N-line window. Construct two adversarial cases:
   - *False negative:* Nia returns the correct file:line but content was reformatted (whitespace/comment changes). Does the heuristic still verify? If not, real citations are dropped.
   - *False positive:* Nia returns a fabricated `file:line` whose content shares 60% of common keywords with the actual line at that index. Does the heuristic accept the fake?
2. **Permissive escape hatch.** `lib/nia/client.ts` returns `verified: true` when the seed file is missing unless `STRICT_CITE_OR_DIE=1` is set. Is this an honest dev-ergonomics tradeoff or an Invariant 1 hole that bites in production?
3. **Citation laundering.** Every Hyperspell memory gets `verified: true` automatically. Is "we trust Hyperspell" load-bearing or hand-waving? What if Hyperspell returns a memory with empty/garbage `text` or a synthetic `id`?
4. **Bogus-input rejection.** What does the agent do when given a stack trace that doesn't match any fixture? Walk through `lib/agent/loop.ts:pickFixture` line-by-line. If it returns the first fixture as a fallback, that's a Cite-Or-Die failure: judges paste random text and see Trace A's confidently-cited triage. **The DA report flagged this — verify it was fixed and the test exists.**
5. **System prompt parity.** Does the change touch `lib/prompts/triage-system.md`? If yes, that's a §Plan-Approval-required path — block until justified.
6. **Test coverage.** Does `tests/invariants/cite_or_die.test.ts` actually assert (a) shape compliance, (b) every code citation's claimed file:line content matches the seed file, and (c) bogus traces are rejected? If any of these are missing, the invariant is paper-only.

### Invariant 2 — Memory Reinforcement Is The Demo

The two-pagers-90s-apart moment is the rubric-winning beat.

**Files in scope:** `convex/reinforce.ts`, `convex/triage.ts` (auto-fire site), `lib/hyperspell/client.ts`, `data/replay/trace-{a,b}.json`.

**Specific checks:**

1. **Sole-writer claim.** Grep the entire diff for `source: "triage_history"`. The only hit must be in `convex/reinforce.ts`. Any other location = hard reject.
2. **The wow-moment property.** `data/replay/trace-b.json` must include at least one `memory_id` not present in `trace-a.json`'s `result.root_cause.citations` ∪ `result.suspected_fix.citations` ∪ `result.similar_incidents`. The DA report flagged the specific id: `mem_slk_dm_feb18_retry_budget`. Verify the test asserts this hard.
3. **Reinforcement metadata shape.** `convex/reinforce.ts` writes a `triage_history` Hyperspell memory with `metadata.reinforces: string[]`. Confirm this list is populated only with Hyperspell-source memory IDs (not code citations — Hyperspell doesn't index code).
4. **Auto-fire correctness.** `runInternal` in `convex/triage.ts` calls `api.reinforce.reinforce` after `mirrorIncident`. Trace through:
   - Trace A → `start` → scheduler → `runInternal` → mirror → reinforce
   - User submits Trace B
   - Trace B's `recallSimilarIncidents` weights the reinforced memory higher
   What if the reinforce step silently fails (try/catch swallows)? Does the demo still claim memory was reinforced when it wasn't?
5. **Replay-mode honesty.** In replay mode, `hyperspell.memories.add` writes to a log file but doesn't mutate any data the next `memories.search` would see. So replay-mode reinforcement depends on `trace-b.json` being hand-crafted with the new citation. Per `CLAUDE.md`, this fallback is permitted ("if integration testing at H3 shows the real path doesn't visibly differentiate Trace B") **but it must be labeled clearly.** Is it labeled in the README? In the trace-b.json fixture? In a comment in `lib/agent/loop.ts`?
6. **`fromTriageHistory` UI tag.** Per the Devil's Advocate report, the UI consumes a `fromTriageHistory: true` field on similar incidents to render a 🧠 badge. Is this field actually populated by the agent loop? Grep for `fromTriageHistory` and verify both producer + consumer exist.

### Invariant 3 — Hot/Cold Path Split

Convex = ephemeral agent state. InsForge = audit-grade durable data. They are not interchangeable.

**Files in scope:** `convex/schema.ts`, `convex/triage.ts` (mirror call site), `lib/insforge/client.ts`, `app/api/insforge-mirror/route.ts` (if present).

**Specific checks:**

1. **Schema audit.** Read every table in `convex/schema.ts`. Hot-path only: `triageRuns`, `toolCalls`, `citations`, `memoryEvents`. No `incidents`, no `audit_log`. Verify.
2. **One-way mirror.** Search the diff for any code that *reads* from InsForge into Convex. There should be none. Cross-org leak risk if reverse mirror ever lands.
3. **Mirror payload completeness.** `lib/insforge/client.ts` POSTs `{ org_id, triage_run_id, trace, root_cause }`. Is the audit-grade story complete without citations + tool_calls? Should there be a follow-up POST?
4. **`orgId` semantics.** `triageRuns.orgId` exists in Convex schema — is it tenant isolation or a tag? Convex doesn't enforce RLS like Postgres; multi-tenancy claims belong in InsForge. Flag if Convex code treats `orgId` as a security boundary.

### Invariant 4 — Hermetic Demo Mode

Live OAuth on stage = death. Every outbound call has a replay branch.

**Files in scope:** all four sponsor clients (`lib/{hyperspell,nia,insforge}/client.ts`), `lib/agent/loop.ts` (live↔replay fallback), `app/api/triage/route.ts`.

**Specific checks:**

1. **Outbound-call inventory.** List every `fetch(...)`, every dynamic `import("ai")`, every `import("@ai-sdk/anthropic")`. For each, prove there's a replay branch by tracing the code path. Format as:

   | Outbound call | File:line | Replay branch | Force-replay condition |
   |---|---|---|---|

   Missing row = hard reject.

2. **Default-replay verification.** `lib/types.ts:getDemoMode()` defaults to `replay`. Confirm nothing overrides this with a `live` default. Grep for `DEMO_MODE` literals.

3. **Silent-degrade vs. silent-fail.** When InsForge keys are missing, `mirrorIncident` returns `{ ok: true, skipped: 'missing_config' }`. The Convex action ignores the return value. Should `skipped: 'missing_config'` in non-replay mode be logged so production failures get noticed?

4. **AI SDK version tolerance.** `lib/agent/loop.ts` `runLive` uses dynamic imports to handle AI SDK 4/5/6 differences. The `package.json` pins `ai@^4.0.0` but the code prefers `stepCountIs` (5+). Probe:
   - If the import succeeds but the call signature is incompatible at runtime, does the code throw inside the try block (good — falls back) or hang silently (bad)?
   - Are the type casts (`as Record<string, unknown>`) burying real runtime mismatches?

5. **Production deploy.** `verifyCodeSnippet` reads from `seed/billing-service/` at runtime. Does the Vercel deploy include this directory in the bundle? Is `tsconfig.json`'s exclusion of `seed/billing-service` a runtime issue, or just compile-time?

6. **Healthz endpoint.** `GET /api/triage` returns `{ demoMode, hasAnthropic, hasHyperspell, hasNia, hasInsForge }`. Is `DemoModeBadge` actually wired to this so the UI badge reflects truth? The DA report flagged that `NEXT_PUBLIC_DEMO_MODE` and `DEMO_MODE` are decoupled — verify this is fixed.

---

## Cross-cutting concerns

### A. Frontend ↔ Backend wire protocol

`app/api/triage/route.ts` translates internal `AgentEvent` → SSE event types `lib/hooks/useTriage.ts` consumes. Read both files side-by-side. Verify every event the hook handles has a matching emit in the route:
- `status` (pending/running/done/error)
- `tool_call_start` + `tool_call_done`
- `citation`
- `timeline`, `root_cause`, `suspected_fix`, `similar_incidents`
- `error`, `end`

Construct a case where two `recallSimilarIncidents` calls fire in the same millisecond — do their `id`s collide? Does `useTriage.applySseEvent` handle the `end` frame or silently swallow it?

### B. Convex codegen on fresh clone

`convex/_generated/` is gitignored. Anyone running `npm run typecheck` on a fresh clone sees errors until they run `npx convex dev`. Is there a docs note? Check `README.md` and `SETUP_CHECKLIST.md`. If not, recommend adding before merge.

### C. Internal vs. public Convex functions

- `api.reinforce.reinforce` — public action, called from another action. Convention: Convex docs recommend `internalAction` for action-to-action calls. Flag.
- `api.triage.run` / `start` — public. Anyone with the deployment URL can fire arbitrary runs. Hackathon-acceptable, but flag as production-blocking.

### D. Citation deduping

`convex/triage.ts` dedupes citations by `source_id`. What if two different sources have the same `source_id`? (Edge case: a Slack memory ID happens to look like `file:line`.) Construct the case.

### E. Type-safety holes

List every `as unknown`, `as Record<string, unknown>`, `v.any()` in the diff. For each, is this hiding a real type mismatch?

### F. Comment-vs-code drift

Several files claim invariants in comments. Spot-check: does the code actually do what the comment claims? Specifically `lib/hyperspell/client.ts` line ~70 ("Invariant 2: this method is only invoked from convex/reinforce.ts") — is that *enforced* or *aspirational*?

### G. Dead code & contract drift

The Devil's Advocate report (Phase 4) flagged:
- `clientRunId` parsed in `app/api/triage/route.ts` but never used
- `PasteTraceInput.initialValue` prop declared but never passed
- `inFlightRef` in `useTriage.ts` accumulates ids forever (memory leak)
- `event: end` SSE frame has no consumer in the hook
- `ArchitectureSlide` claim "Removing any one breaks something specific" is provably false on the replay demo path (Convex/InsForge unused)

Verify these are addressed or explicitly deferred.

---

## The judge-on-stage test

Per `PLAN.md` §10, walk through the 90-second demo:
- 0:00–0:30: Trace A pasted, agent thinking streams
- 0:30–0:45: citation drill-down
- 0:45–1:05: Trace B with the NEW citation
- 1:05–1:20: architecture beat
- 1:20–1:30: validation+close

**Identify the single most likely failure point on this PR's code path.** Where does the demo break first? Pick one, name the file:line, recommend a mitigation.

---

## Operational checks (run these)

```bash
# from repo root
npm install
npm run typecheck   # should be clean (excludes convex/, seed/billing-service/)
npm test            # should be 28+/28+ pass
npm run check:invariants  # 23+ tests + 6 gates green
npm run build       # Next 15 production build passes

# end-to-end smoke
DEMO_MODE=replay npm run dev &
sleep 8
curl -s http://localhost:3000/api/triage | head -3   # healthz
curl -s -X POST http://localhost:3000/api/triage \
  -H "Content-Type: application/json" \
  -d '{"trace":"Error: Duplicate charge processed for customer cus_abc123\n  at processWebhook (webhooks/stripe.ts:84)"}' \
  | grep "event:" | head -20
# verify Trace B's wow moment:
curl -s -X POST http://localhost:3000/api/triage \
  -H "Content-Type: application/json" \
  -d '{"trace":"Error: Duplicate refund event for charge ch_def456\n  at processWebhook (webhooks/stripe.ts:91)"}' \
  | grep -E "mem_slk_dm_feb18|mem_reinforce_traceA"
# bogus-input rejection (Cite-Or-Die check):
curl -s -X POST http://localhost:3000/api/triage \
  -H "Content-Type: application/json" \
  -d '{"trace":"hello world this is not a stack trace"}' \
  | grep "event: error"
pkill -f "next dev"
```

If the bogus-input check returns Trace A's full triage instead of an error event, **Cite-Or-Die is broken** — hard reject.

---

## Output format

Structure your review:

```markdown
# Codex Review — Triage

## Verdict
[BLOCK | APPROVE WITH NOTES | APPROVE]

## Invariant 1 — Cite-Or-Die
[a/b/c assessment + specific findings + recommended actions]

## Invariant 2 — Memory Reinforcement
[same shape]

## Invariant 3 — Hot/Cold Split
[same shape]

## Invariant 4 — Hermetic Demo Mode
[same shape with the outbound-call inventory table]

## Cross-cutting findings
[A through G as relevant; skip sections with nothing to say]

## Operational check results
[paste the curl + npm output; flag anomalies]

## Judge-on-stage failure point
[the one most-likely break, with fix]

## Required before merge
[bulleted list — empty if APPROVE]

## Suggested follow-ups (non-blocking)
[bulleted list]
```

---

## Hard rules for your review

- **Don't be polite about flaws.** Polite reviewers ship broken demos.
- **Don't argue from authority.** "Non-idiomatic" is not a finding. "Breaks Invariant N because [specific failure case]" is.
- **Cite line numbers.** Every finding gets a `file:line` Claude Code can navigate to.
- **Distinguish "broken now" from "will break later."** Layer-1 demo correctness blocks merge. Layer-2 tech debt does not.
- **If you would block, say so plainly in the Verdict line.**
- **If the project is genuinely solid, say so.** Cynicism for sport is also dishonest.

---

Begin your review.
