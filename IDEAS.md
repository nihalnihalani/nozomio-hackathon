# Project Ideas — Nozomio Hackathon (May 9, 2026)

This document is the output of a two-phase agent squad:

1. **Phase 1** (5 agents): four track specialists each generated 3 candidate ideas with predicted scores against the actual rubric; one meta-strategist applied Gary Chan's hackathon-winning playbook.
2. **Phase 2** (4 agents): a CTO-judge persona, BizDev/Investor-judge persona, devil's-advocate #2, and a final synthesizer independently re-scored every idea and produced ranked finalists.

12 candidate ideas across 4 tracks. The "strategist's pick" labels are Phase-1 votes — Phase-2 may overrule.

---

## Final Call — what the 9-agent squad converged on

### Consensus per track

| Track | Phase-1 | CTO judge | BizDev judge | DA #2 | Synthesizer | **Final** |
|---|---|---|---|---|---|---|
| 1 — Always-On | 1.B Lighthouse | 1.C ConciergeOS | 1.C ConciergeOS | (cut: 1.B) | 1.A NightOwl | **1.C ConciergeOS** *(2-of-4 split)* |
| 2 — Ship It | 2.C OnCallScribe | 2.C OnCallScribe | 2.C OnCallScribe | (cut: 2.A, 2.B) | 2.C OnCallScribe | **2.C OnCallScribe** *(unanimous)* |
| 3 — Growth | 3.B PostMortem | 3.B PostMortem | 3.A GhostScout | (cut: 3.C) | 3.A GhostScout | **3.A GhostScout / 3.B PostMortem** *(2–2 split)* |
| 4 — Company Brain | 4.B ShiftLeft | 4.B ShiftLeft | 4.B ShiftLeft | (no cut) | 4.B ShiftLeft | **4.B ShiftLeft** *(unanimous)* |

### Cuts agreed by 2+ voices

- **2.B ChangelogBot** — auto-PRs against external repos; GitHub abuse-flag risk (CTO + DA #2)
- **3.C Atlas** — 4-minute live clock against unverified Reacher MCP latency (CTO + DA #2)
- **2.A PolicyPilot** — UPL/legal-liability + statute-citation hallucination risk (DA #2)

### The single commit-now recommendation

> **Build "Triage" = the OnCallScribe spine + a Hyperspell `recallSimilarIncidents` tool.**
>
> One codebase competes for **Track 2 (Ship It)** + the **Hyperspell dedicated track** + plausibly **Overall 1st** because:
>
> - The Hyperspell/Nia split is genuinely load-bearing on both axes (Hyperspell indexes humans/conversations: Slack #incidents, Notion postmortems, Gmail vendor outage notices; Nia indexes artifacts: monorepo, ADRs, runbooks). Removing either breaks the demo.
> - The "two pagers fire 90 seconds apart, second triage visibly faster with new citations" is the most falsifiable memory-load-bearing demo on the board — and it's exactly what Conor + Manu's published "memory makes agents useful" thesis describes.
> - Stack-trace input has zero auth surface, "guaranteed partial result" failure mode means the demo never returns a blank screen, and pasting a Sentry URL lets a stranger judge use it in 5 seconds.
> - Every required API key is on a self-serve path (`SETUP_CHECKLIST.md` confirmed) — no booth-promise dependencies on the critical path.
>
> **What to ask at booths in the first 30 min:** (1) Hyperspell elevated key + clarification on reinforcement timing; (2) Nia hackathon credits + Tracer reliability on bleeding-edge code; (3) InsForge sponsor key that disables the 1-week idle pause.

### Lazy-mode backup (4-hour build, exhausted-at-2am)

**DocsThatTalkBack** — `npx nia-wizard@latest` + Next.js + Vercel AI SDK with one `searchDocs` tool over Nia. Deploy to Vercel. Hits Nia (host) + Vercel. Demo: ask about a feature merged 24h ago, watch it answer correctly. Will not embarrass.

### Decision tree if circumstances change

- **Hyperspell elevated key not provisioned by H1** → drop to pure Track 2: ship OnCallScribe alone (no `recallSimilarIncidents` tool).
- **Reacher MCP at `api.reacherapp.com/mcp` is flaky / sandbox is empty** → don't pursue Track 3 at all; Triage already wins 2 + 4.
- **First-ingest of real Slack runs >20 minutes at H4** → fall back to a synthetic-but-realistic Slack export and narrate the Connect flow over a screenshot.
- **Only 8 hours of build time available (not 12)** → ship the OnCallScribe spine alone; cut Hyperspell layer; still wins Track 2.

---

## Cross-Cutting Strategy (applying Gary Chan's hackathon-winning playbook)

### The 7 questions any winning idea must answer

1. **Memorable hook in 10 seconds:** Can a tired judge — your idea is the 14th demo of the day — explain your project to their CEO in one sentence after watching for 10 seconds? "Reasoner = Nia for code, Hyperspell for humans" works. "An AI-powered platform for X" does not. The 10-second hook is the codename + visceral verb. If the team can't agree on the codename in 5 minutes, the idea is too fuzzy.
2. **Sponsor-tool depth (not lip service):** Does removing the headline sponsor break the demo, or does the demo still work with `console.log`? Chan's API-evangelist judges score *creative use of unpopular functions*. That means: Hyperspell `memories.search` with multi-source weighting (not just `add`); Tensorlake `snapshot+fork` (not just `create`); InsForge MCP-driven schema provisioning (not just SDK CRUD); Nia `Oracle`/`Tracer`/Context-Sharing (not just `/search`). Use the deep cuts. The booth reps remember who used the API they personally built.
3. **Edge-case-first build:** Chan's CTO judges score for *real code under failure*. For agent demos in 2026 that means: kill the process and resume (Track 1), break auth and recover (Track 2), feed adversarial creator data and watch the agent reject a fraud (Track 3), ask the same question twice and prove memory got sharper (Track 4). Bake one *deliberate failure* into the demo and recover on stage.
4. **Live evidence > slideware:** Pre-recorded Looms are insurance, not the demo. Judges in a YC-adjacent room can smell a sizzle reel. The interactive moment — judge scans QR, judge gives a brief, judge picks the test question — converts a polished demo into a *believed* one.
5. **Order strategy (early or late presenter):** Judge attention craters after demo 10. Early slot: lead with the wow shot, not the problem statement. Late slot: open with a question to the judge to force re-engagement. Either way, rehearse the 90-second cut.
6. **Validation receipts:** In the first 2 hours, walk the EF venue and get 3 hackers to use a paper prototype. Photograph their reactions. "I'd pay $50/mo for this — Sarah, ML eng @ Meta" beats any TAM slide. Bonus: get a sponsor rep on-camera saying "I'd use this."
7. **Founder-market-fit story:** Pick the team member who has actually felt the pain and put them on the mic. Authentic > polished.

### Per-track judge profiles & how to play each

| Track | Likely judges | Their primary axis | Demo tactic that wins them |
|---|---|---|---|
| 1 — Always-On (Nia + Tensorlake) | Diptanu (Tensorlake, infra/CTO) + Arlan (Nia, product/CEO) | Infra correctness + memory permanence under failure | Pre-stage 6+ hours of agent activity; let a judge `kill -9` your process and watch it resume from snapshot |
| 2 — Ship It (InsForge + Nia) | InsForge founders + Arlan | Live URL + auth + edge cases handled | QR code on slide 1 — judge signs up on phone, hits a forced-error path, watches self-heal |
| 3 — Growth (Reacher + Nia) | Jerry/Bora (Reacher, BizDev/GTM) + Arlan | Real creator-economy depth + GTM smell test | Judge gives one-line brief on stage; agent ships vetted shortlist + DM + projected GMV in 60s |
| 4 — Company Brain (Hyperspell + Nia) | Conor/Manu (Hyperspell, founder/customer-obsessive) + Arlan | Cross-source synthesis + memory that visibly improves | Same question twice on stage; second answer sharper with new citations Hyperspell reinforced |

### The 5 design shortcuts adapted for agent hackathons

- **Codename in 5 minutes, no naming debate.** Pick a 2-syllable verb-noun.
- **Template-fuse the front-end.** `npx create-next-app` + AI SDK `useChat` + shadcn defaults. Win on agent depth, not CSS.
- **Skip sign-in for judges.** Magic-link `?demo=judge` with a pre-warmed session.
- **"Thinking" loading transitions are the demo.** Stream every agent step into a live trace — visible reasoning *is* the value prop in 2026.
- **Pre-ingest connectors the night before.** First-ingest latency is unbounded. Demo against the warm index; narrate the OAuth flow with a screenshot.

### What kills you in this specific hackathon

- **Single-step LLM call wrapped in a pretty UI.** Every track weights agentic depth/complexity at 25–30%.
- **Demoing against mocks because the sponsor never gave you beta access.** Aside and Reacher are the trap (note: Reacher *is* providing hackathon-only MCP — that's different).
- **Live OAuth ingest of real Slack/Gmail on stage.** Spinner of death.
- **Sponsor-bingo across 5+ tools with no integration depth.** Two used deeply > five name-dropped.
- **No deployed URL / no QR code.** If a judge can't touch it in 30 seconds, you lose 10% Demo + most of Personal.

### "If your demo breaks on stage" recovery script

> "Live agents on free-tier APIs at hour 11 — exactly the bug we built this for. Let me show you what happened the last 6 successful runs."

Switch to Loom or architecture slide. Keep talking. Don't apologize. Land the close on validation + ask. If 30 seconds left, run live again — *recovery* in front of judges scores higher than a clean first run.

### Cross-track project ambition test

For an idea to be worth pursuing, ALL of these must be true:
- [ ] Wow moment is buildable in 12 hours by a 2-person team
- [ ] Removing the headline sponsor breaks the demo entirely
- [ ] You'd want to keep building it on Sunday
- [ ] You can name a specific real user who'd pay for it today
- [ ] The demo can be screen-recorded as a Loom backup that survives wifi failure on stage

### Recommended team-of-2 split

- **Front-end / glue:** Owns Next.js + AI SDK + the agent loop + live trace UI. Ships deploy URL by H4. Stack: Next.js 15, AI SDK 6 with `streamText` + `tool()`, AI Gateway, shadcn defaults.
- **Storyteller / validator:** Pre-ingests data the night before and during H0–H4. Walks the venue at H2 doing 3 user interviews with photo+quote. Owns slide deck, demo script, booth conversations.

If solo: cut scope by 50%, ship the lazy-mode backup, use saved hours on validation receipts and a tight 90-second pitch.

---

## Track 1 — Always-On Agents (Nia + Tensorlake)

**Rubric:** Background Execution 30% · Statefulness 25% · Agentic Depth 25% · Demo 10% · Personal 10%

### Idea 1.A: NightOwl — the PR reviewer that actually read your codebase last week
**One-line pitch:** A dev assistant that reviews every open PR overnight, leaves cited inline comments grounded in your team's last 30 days of merged code/Slack/RFCs, and gets sharper every night because it remembers which suggestions humans accepted vs rejected.

**Predicted scores:** Background Execution 5 · Statefulness 5 · Agentic Depth 4 · Demo 5 · Personal 5 · **Weighted: 4.65 / 5.0**

**Tool integration depth:**
- *Nia:* MCP server indexing the repo + Slack connector + Drive (RFCs/PDFs) + arXiv (when a PR cites a paper). Use **Oracle** for "why did we choose X?" deep retrieval and **Context Sharing** to persist episodic memory (the suggestion ledger) across review sessions. The non-obvious capability: cross-source `universal` mode citing both code and Slack threads in a single comment.
- *Tensorlake:* Long-lived sandbox with persistent FS for SQLite ledger; **snapshot+fork** to spin up parallel sub-agents per file in a big PR; **suspend** between webhook events for $0 idle; webhook-triggered execution; snapshot-resume for crash recovery.

**12-hour build plan:** H0–H2 set up Nia index (one repo + Slack export + 5 RFCs) + Tensorlake sandbox skeleton; H2–H6 GitHub webhook → review pipeline writing comments via REST; H6–H10 feedback ledger + "regress when deleted" wiring + Next.js dashboard showing last-night log; H10–H12 pre-stage 6h overnight run on a real OSS repo, rehearse the delete-the-memory moment.

**The 10-second wow moment:** Presenter says "watch this" — deletes the SQLite volume — reopens PR — agent posts a comment it had learned to suppress. Audible "oh."

**Top 3 risks:** 1. Nia free tier = 3 lifetime indexes (beg credits at booth at H0). 2. GitHub webhook plumbing eats time — fall back to polling. 3. Feedback ledger must visibly change behavior; rehearse this.

### Idea 1.B: Lighthouse — your personal arXiv/HN concierge that learns what you actually read
**One-line pitch:** An always-on research monitor that ingests arXiv + HN + your highlighted PDFs hourly, learns your reading taste over weeks via a per-user taste vector, and emails you a 3-paper "you'll care about these" digest each morning — with a chat that remembers every paper you ever asked about.

**Predicted scores:** Background Execution 5 · Statefulness 5 · Agentic Depth 5 · Demo 4 · Personal 5 · **Weighted: 4.80 / 5.0**

**Tool integration depth:**
- *Nia:* arXiv collection indexing, Drive-connected PDF library, **Oracle** for "explain how this paper relates to the 3 I read last month" (uses Context Sharing). Hybrid `universal` mode mixing user PDFs + live arXiv.
- *Tensorlake:* **Schedule trigger** (hourly cron); persistent FS holding the taste-vector + event log; **snapshot+fork** to A/B test two ranking strategies on the same morning; suspend between cycles. Use ubuntu-vnc image to render PDF thumbnails inside the sandbox.

**12-hour build plan:** H0–H2 arXiv/HN ingester + Nia index a 200-paper seed corpus; H2–H6 taste-vector + ranker + digest generator; H6–H10 Next.js inbox UI + 14-day backfilled history (run cron on a laptop overnight before, otherwise simulate timestamps from real arXiv data); H10–H12 polish + practice "name a paper you like, watch ranking shift."

**The 10-second wow moment:** Judge names one paper they read recently. Agent shows tomorrow's digest re-ranked in real time, citing "because you mentioned X, I prioritized Y."

**Top 3 risks:** 1. 14-day evidence is hard to fake — start hourly cron *now*. 2. Taste vector needs visible learning curve; force a few "wrong" early digests. 3. arXiv rate limits — cache aggressively.

### Idea 1.C: ConciergeOS — durable per-customer support agent with months of memory
**One-line pitch:** A support agent that wakes up when a customer emails, recalls their entire ticket history + product usage + Slack mentions, drafts a reply, runs a sandbox repro of their bug if it can, and sends — all without a human in the loop overnight.

**Predicted scores:** Background Execution 5 · Statefulness 5 · Agentic Depth 5 · Demo 4 · Personal 4 · **Weighted: 4.65 / 5.0**

**Tool integration depth:**
- *Nia:* indexes per-customer docs + Slack channel + Drive folder; Context Sharing keeps episodic memory across email threads; Oracle for deep historical lookup. Non-obvious: indexing Slack DMs as customer context.
- *Tensorlake:* **One named, suspended sandbox per customer** (per-customer Agent-OS pattern); snapshot+fork lets the agent try two repro strategies in parallel; webhook-triggered wake on email; durable FS holds repro environments across months.

**12-hour build plan:** H0–H2 mock support inbox + 3 fake customers with rich histories; H2–H6 Nia index per customer + Tensorlake per-customer snapshot pattern; H6–H10 reply pipeline + repro sandbox + UI; H10–H12 8h overnight pre-stage on the mock inbox.

**The 10-second wow moment:** "Customer" email arrives during demo; agent wakes a suspended snapshot in <300ms (visible boot timer), pulls a Slack quote from 4 months ago, replies with a working repro.

**Top 3 risks:** 1. Multiple suspended sandboxes may exceed free-tier 2-concurrent cap. 2. "Months of history" needs to feel real — invest in fake-but-rich fixtures. 3. Live repro can fail on stage — have deterministic fixture as backup.

### Track 1 — Phase-1 strategist's pick: **1.B Lighthouse**

> Most cleanly maximizes load-bearing-memory + autonomous-trigger criteria (55% of rubric). Taste vector is unfakeable evidence of stateful learning. Schedule trigger is the cleanest, lowest-risk way to demonstrate "ran for hours." Wins on Personal — every judge in an EF Office room is a researcher who suffers from arXiv overload.

---

## Track 2 — Ship It / Full-Stack (Nia + InsForge)

**Rubric:** Production Readiness 35% · Agent Reliability 30% · Full-Stack Depth 25% · Demo 10% · Personal 10%

### Idea 2.A: PolicyPilot — the "explain-this-denial" insurance agent
**One-line pitch:** Upload your insurance policy PDF + a denial letter, and an agent tells you in 30 seconds whether the denial is wrong, citing the exact clauses + state regulations that contradict it — then drafts the appeal letter.

**Live demo URL pattern:** `policypilot.vercel.app` — magic-link signup, upload PDF, get a verdict + appeal draft in <60s. Pre-seeded with 3 sample claim/denial pairs.

**Predicted scores:** Production 5 · Reliability 5 · Full-Stack 5 · Demo 5 · Personal 4 · **Weighted: 4.85 / 5.0**

**Tool integration depth:**
- *Nia:* Indexes (1) user's uploaded policy PDF via Document Agent, (2) a curated state-insurance-regulations corpus pre-indexed before the hackathon, (3) Oracle for "find every precedent for this exact denial code." Hallucination matters because **citing a non-existent clause in a legal appeal is damaging** — Nia's grounded retrieval is the literal product wedge.
- *InsForge:* Tables `users, policies, denials, appeals, traces`. RLS: `owner_id = auth.uid()` everywhere. Magic-link auth. Storage bucket `policy-pdfs` with presigned URLs. Edge function `analyze-denial` orchestrates. AI Gateway routes Claude → GPT-5 fallback. Realtime channel streams progress.

**Adversarial plan:** (a) recipe PDF instead of policy → classifier rejects; (b) Spanish policy → auto-translate; (c) Nia returns no matching clause → agent refuses to hallucinate, says "do not file as drafted"; (d) prompt-injection in PDF → sanitizer + system-prompt restating contract.

**12-hour build plan:** H0–H2 InsForge create + magic-link + schema + Vercel preview, smoke-test on phone; H2–H6 edge function with agent loop, pre-index regulations on Nia; H6–H10 adversarial-input handling, trace UI, 3 pre-seeded examples; H10–H12 recruit a stranger to sign up + upload sample denial on stage; record Loom; print QR.

**The 10-second wow moment:** Judge scans QR → magic-link → uploads pre-staged "denied MRI claim" PDF → 22 seconds → "DENIAL LIKELY INVALID. Section 4.2.1 covers MRIs [cited]. California Insurance Code §10123.13 prohibits this denial reason [cited]." Click "Generate appeal" → ready-to-print draft.

**Top 3 risks:** 1. PDF parsing flaky → fall back to `pdf-parse` + pgvector. 2. Nia 50 query/mo cap — beg booth or cache aggressively. 3. Live stranger nervous on stage — pre-record their successful run.

### Idea 2.B: ChangelogBot — the "did this PR break my SDK consumers?" agent
**One-line pitch:** Paste a GitHub PR URL; the agent indexes every public repo that depends on your library, finds the call-sites this PR breaks, and opens auto-PRs against them with working migrations — all behind a live dashboard.

**Live demo URL pattern:** `changelogbot.vercel.app` — sign up with GitHub OAuth, paste PR URL, see real downstream PRs created live.

**Predicted scores:** Production 5 · Reliability 5 · Full-Stack 5 · Demo 5 · Personal 4 · **Weighted: 4.80 / 5.0**

**Tool integration depth:**
- *Nia:* **Nia Tracer** is the unlock — searches GitHub *without* pre-indexing, so when a stranger pastes a fresh PR, fan-out across 50+ dependent repos in seconds. Nia's lower hallucination rate (52.1% vs 63.4% on bleeding-edge features) matters because we're literally generating code against the bleeding-edge SDK version the PR introduces.
- *InsForge:* GitHub OAuth (prebuilt component — 1-click for judges). Schema `repos / prs / dependents / breakages / migration_prs`. Edge function `scan-pr`. Storage holds AST-diff snapshots. AI Gateway. Realtime updates dashboard live.

**Adversarial plan:** (a) PR has zero breaking changes → AST diff proves it, no speculative breakages; (b) dependent repo private/archived → labeled-skip status; (c) Tracer false-positive on call-site → secondary AST verification (`ts-morph`/`libcst`) rejects; (d) hostile input (`evil/scam`) → repo-ownership check.

**12-hour build plan:** H0–H2 scaffold + GitHub OAuth + schema + Vercel preview live; H2–H6 PR-parser, Nia Tracer integration, AST verifier (TS/JS only — 80% of npm); H6–H10 migration-code generator + GitHub PR creation + dashboard; H10–H12 pre-stage one real PR on a throwaway library + 4 fake dependents under a demo org.

**The 10-second wow moment:** Judge pastes real PR URL → dashboard lights up "Found 7 public dependents... 3 break... opening migration PRs..." → 90s later three real PR links appear, judges click and see passing CI.

**Top 3 risks:** 1. GitHub rate limits — use OAuth user's token (5k/hr); cap to 10 dependents. 2. Tracer junk on obscure libraries — demo a popular-enough library. 3. Auto-PRs scary — default to draft PRs against a fork.

### Idea 2.C: OnCallScribe — the "why did prod break at 3am?" post-mortem agent
**One-line pitch:** Connect GitHub + paste a Sentry error link; agent writes the full incident post-mortem (timeline, root cause, blast radius, fix PR, Jira draft) by joining stack traces, recent commits, and your code — cited.

**Live demo URL pattern:** `oncallscribe.vercel.app` — magic-link signup, paste Sentry-issue URL or upload stack trace, get post-mortem + fix PR in <2 minutes.

**Predicted scores:** Production 5 · Reliability 5 · Full-Stack 5 · Demo 5 · Personal 5 · **Weighted: 4.95 / 5.0**

**Tool integration depth:**
- *Nia:* (1) indexes user's repo on first connect, (2) Oracle for autonomous root-cause research across commit history, (3) `query` mode for code at the failure line. Hallucination matters because **a wrong root cause sends an oncall down a 4-hour wrong path at 3am**.
- *InsForge:* Magic-link + GitHub OAuth combo. Tables `incidents / commits / hypotheses / postmortems / fix_prs`. Edge function `synthesize-postmortem` with **guaranteed partial result** — even if Oracle times out, user gets timeline + commits, never blank screen. AI Gateway Claude → GPT-5 fallback. Storage for stack-trace artifacts. RLS-by-org. Realtime for live trace.

**Adversarial plan:** (a) trace from unindexed language → still produces timeline, asks for code link; (b) empty commit history → falls back to "no recent changes; likely infra/data" branch; (c) hostile prompt in trace → tagged as untrusted user data in system prompt; (d) plausible-but-wrong root cause → cite-or-die verifier checks claimed file/line actually contains claimed code.

**12-hour build plan:** H0–H2 auth + schema + Vercel + smoke-test on phone; H2–H6 stack-trace parser, Nia repo index, Oracle wrapper with timeout-and-partial-return; H6–H10 post-mortem template renderer, fix-PR generator, adversarial-input tests; H10–H12 pre-stage two real incidents (one OSS, one synthetic-realistic), find a stranger SRE to demo.

**The 10-second wow moment:** Judge pastes Sentry link → screen splits into "Timeline / Root Cause / Fix PR" panels filling left-to-right over ~90s, each line clickable to a commit or file:line in GitHub. Final panel: a real opened PR.

**Top 3 risks:** 1. Oracle latency unpredictable → 60s timeout, partial timeline + websocket-push the rest. 2. Repo indexing wait blocks first demo → pre-index demo repo at H2; for live strangers use Tracer first. 3. Fix-PR is wrong → mark as "draft hypothesis PR — verify before merging"; never auto-merge.

### Track 2 — Phase-1 strategist's pick: **2.C OnCallScribe**

> Strongest 35%-Production-Readiness bet. Input surface is dead simple (paste Sentry URL or stack trace) — stranger uses it in 5 seconds. Failure modes are *naturally* graceful (timeline + commits always returnable). Demo irresistible to an EF/SF crowd that has all been paged at 3am. Most legibly demonstrates Nia's anti-hallucination wedge on a domain where being right matters.

---

## Track 3 — AI-Native Growth Tools (Nia + Reacher)

**Rubric:** Social Intelligence Depth 30% · Agentic Complexity 30% · End-to-End Flow 20% · Demo 10% · Personal 10%

> **Reacher hackathon-only infrastructure:** MCP server at `api.reacherapp.com/mcp` with **33 tools** (creators, products, videos, samples, GMV metrics, Social Intelligence catalogue), per-team sandboxed demo dataset, sandboxed write endpoints (`POST /automations`, `/samples/request`, `/outreach/draft`) that persist for demo but never dispatch real emails or hit TikTok.

### Idea 3.A: GhostScout — The Pre-Viral Creator Defector Agent
**One-line pitch:** An agent that watches the *Social Intelligence* catalogue for creators currently going viral on a competitor's product, cross-references brand-fit against indexed brand guidelines + past campaign decks, and ships a fully-loaded defection campaign (sample request + retainer offer + Spark Ads pre-approval) before the competitor's brand manager has eaten breakfast.

**Predicted scores:** SI Depth 5 · Agentic 5 · E2E 5 · Demo 5 · Personal 4 · **Weighted: 4.80 / 5.0**

**Tool integration depth:**
- *Reacher MCP tools used:* `social_intelligence.trending_videos`, `social_intelligence.creator_lookup`, `social_intelligence.seller_catalog`, `creators.search`, `creators.recent_videos`, `samples.history`, `gmv.timeseries`, `videos.transcript_search`
- *Reacher write endpoints used:* `POST /samples/request`, `POST /outreach/draft`, `POST /automations`
- *Nia indexes:* the brand's voice-and-tone PDF, three competitor decks, a Reacher case-study corpus, and the brand's last 12 months of campaign retros — `deep` mode synthesizes "what worked, what didn't, what tone wins."

**12-hour build plan:** H0–H2 wire Reacher MCP into Claude Agent SDK, sandbox-account smoke test; Nia keys + index 4 brand docs. H2–H6 build the decision graph: trending-video filter → creator triage scoring → Nia retrieval for brand-fit rationale → offer-tier picker. H6–H10 wire the three write endpoints, build a "campaign creation log" UI streaming every decision + tool call, pre-stage 2 demo briefs. H10–H12 rehearse, record Loom, write the 30-second pain skit.

**The 10-second wow moment:** Judge says "I'm a hair serum brand, my competitor is OUAI." 9 seconds later: 7 ranked creator defection targets, the *exact* competitor video each posted 18h ago, a one-tap "ship sample + send DM + queue retainer trigger" — sandboxed `POST /samples/request` returns 201 on the projector.

**Top 3 risks:** 1. Trending-videos endpoint slow at demo time → pre-cache one warm payload, fall back with "live data 47s ago" stamp. 2. Brand-fit reasoning sounds generic → hard-require Nia citations in every offer rationale. 3. Sandboxed write silently 200s without payload validation → log full request body + curl-equivalent on screen.

### Idea 3.B: PostMortem — The Attribution-Forensics Agent for Failed Drops
**One-line pitch:** Brand uploads a post-launch debrief; the agent spelunks Reacher's GMV timeseries + creator-level video metrics + sample dispatch logs, isolates exactly which creators tanked the launch and why, then ships a remediation campaign — turning a $0 launch into a 7-day rescue plan.

**Predicted scores:** SI Depth 5 · Agentic 5 · E2E 5 · Demo 5 · Personal 4 · **Weighted: 4.80 / 5.0**

**Tool integration depth:**
- *Reacher MCP tools used:* `gmv.timeseries`, `gmv.per_creator_per_sku`, `videos.metrics`, `videos.transcript_search`, `samples.history`, `samples.dispatch_log`, `creators.recent_videos`, `social_intelligence.trending_videos`, `social_intelligence.seller_catalog`
- *Reacher write endpoints used:* all three
- *Nia indexes:* the brand's launch playbook, campaign brief PDF, last quarter's #marketing Slack, two Reacher case-study PDFs, market-report PDFs on TikTok Shop launch benchmarks. Oracle does the "what's a normal Day-1 GMV for a $25 SKU in beauty" benchmark call.

**12-hour build plan:** H0–H2 MCP wiring + sandbox smoke test; Nia indexes the launch brief + 2 case-study PDFs. H2–H6 build the 4-hypothesis scaffold (creator-fit, content, sample-timing, market) with one LLM-tool-loop per branch; render hypotheses as an evidence tree. H6–H10 remediation planner → 3 write endpoints; build the "case file" UI. H10–H12 prep two pre-recorded "failed launch" debriefs.

**The 10-second wow moment:** Judge uploads "we shipped 200 samples, did $400 GMV" debrief. 90 seconds later: courtroom-style case file — "Cause: 47% of samples dispatched 5+ days post-creator-acceptance; competitor X stole the trend window on 2026-04-30." Agent then *autonomously* drafts the rescue campaign on screen.

**Top 3 risks:** 1. Hypotheses look hallucinated → every claim must cite a Reacher MCP tool call ID + timestamp. 2. Forensic depth = lots of tool calls = slow demo → pre-warm with one cached debrief. 3. No real data behind the sandbox debrief → seed the per-team sandbox with one realistic "failed launch" record on H0.

### Idea 3.C: Atlas — The Live Campaign Architect (judge-brief-to-shipped-campaign)
**One-line pitch:** Type a one-line brand brief; the agent scouts 1.5M creators, segments them into 3 campaign archetypes (viral challenge, retainer squad, sample-and-pray test), generates the brief PDFs, fires sample requests + outreach DMs, and pre-stages the GMV-velocity automation rule — all in under 4 minutes, on stage.

**Predicted scores:** SI Depth 4 · Agentic 5 · E2E 5 · Demo 5 · Personal 4 · **Weighted: 4.60 / 5.0**

**Tool integration depth:**
- *Reacher MCP tools used:* `creators.search`, `creators.audience_index`, `creators.recent_videos`, `gmv.percentile_by_niche`, `gmv.timeseries`, `videos.transcript_search`, `social_intelligence.trending_videos`, `samples.history`, `products.catalog`
- *Reacher write endpoints used:* `POST /samples/request` (×N), `POST /outreach/draft` (×N), `POST /automations` (1 rule per archetype)
- *Nia indexes:* brand voice-and-tone PDF, indexed library of 50 successful creator-brief examples from public case studies, the brand's prior-campaign retros, and `nia/web` for live competitor-launch news. Nia generates the *brief PDFs* with citations.

**12-hour build plan:** H0–H2 MCP + Nia plumbing; index 4 docs + brief library. H2–H6 the three archetype agents (parallelized as Claude Agent SDK subagents). H6–H10 the orchestration UI — three vertical lanes streaming each subagent's tool calls + writes. H10–H12 rehearse the 4-minute live brief at least 5x.

**The 10-second wow moment:** Judge says "I'm Hanes underwear, $50K budget, May launch." 4 minutes later: three archetype campaigns with named creators, dispatched sample requests, drafted DMs, and a "promote-to-retainer-on-first-viral-video" automation — all shown as a Reacher dashboard mock with green "201 Created" pings.

**Top 3 risks:** 1. 4-minute clock fails on stage → pre-record one full run as backup, plus a warmed-up brief that shaves 90s. 2. Three archetypes overwhelms screen → demo one lane in detail; let others run silent. 3. Sandboxed writes look fake → make every write echo back POST body + status code in a "receipts" pane.

### Track 3 — Phase-1 strategist's pick: **3.B PostMortem**

> The rubric line "extracts insight a human would miss" maps directly onto attribution forensics. The *only* idea where the agent does investigative reasoning a human BD lead literally cannot do (cross-tabulating sample-dispatch latency × per-creator GMV × competitor trend-window steal). Uses the *most* unpopular MCP tools — `samples.dispatch_log` and `gmv.per_creator_per_sku`. The courtroom-style case file is a unique demo artifact judges remember at 11pm.

---

## Track 4 — The Company Brain (Nia + Hyperspell)

**Rubric:** Cross-Source Synthesis 30% · Real Work 25% · Hyperspell Integration Depth 25% · Demo 10% · Personal 10%

### Idea 4.A: PipelineSurgeon — the SDR who actually closes
**One-line pitch:** A vertical SDR copilot that scans every deal in your pipeline at 7am, drafts personalized follow-ups citing the *exact* Slack thread + Gmail reply + GitHub issue + product-doc paragraph that prove you've been listening, and ships them to a Gmail draft folder waiting for one-click send.
**Vertical:** Series-A B2B-dev-tools SDR/AE working a 40-deal pipeline, where every prospect is technical.

**Predicted scores:** Synthesis 5 · Real Work 5 · Hyperspell Depth 5 · Demo 5 · Personal 4 · **Weighted: 4.85 / 5.0**

**Tool integration depth:**
- *Hyperspell:* Connect widget for live Gmail + Slack OAuth; `memories.add` for HubSpot CSV export; `memories.search` weighted multi-source query (Slack 0.5, Gmail 0.3, Notion 0.2) with `userID` per AE; `hyperspell-mcp` plugged into Claude Desktop on the demo MacBook so judges see "draft follow-up for $deal" surface as an MCP tool.
- *Nia:* indexes the company's *product* repo + public docs + 5 customer-facing PDFs (security whitepaper, benchmark report). `deep` mode supplies the *technical proof* paragraphs in each email. Hyperspell can't index a 50k-file monorepo with code-aware chunking — Nia is load-bearing for the artifact half.

**12-hour build plan:** H0–H2 Hyperspell + Nia keys, scaffold Next.js + AI SDK + AI Gateway, deploy preview URL. H2–H6 wire Hyperspell Connect; pre-ingest a *real* Gmail + Slack export immediately so first-ingest finishes by H6; in parallel kick Nia indexing on `vercel/next.js` + 3 PDFs. H6–H10 build 7am cron `streamText` agent loop with two tools: `searchPeople` (Hyperspell weighted) + `searchTech` (Nia deep); output structured `{deal_id, draft_subject, draft_body, citations[]}` via `generateObject`; render in Convex-backed UI; write Gmail-API "create draft." H10–H12 demo rehearsal x3, MCP-in-Claude-Desktop screen recording.

**The 10-second wow moment:** Judge says "draft for the Acme deal." First draft in 6s with 3 citations. AE: "watch what happens when I run it again." Second draft in 3s with a *fourth* citation — a Slack thread the agent surfaced because Hyperspell reinforced "Acme cares about latency." Click citation pill → Hyperspell timeline overlay shows reinforced memories. *That* is the memory-load-bearing moment.

**Top 3 risks:** 1. First-ingest latency on real Slack — pre-ingest the night before. 2. Gmail OAuth scopes — use "create draft" not "send" so we don't need restricted scopes. 3. Nia 3-index limit on free — pre-index one repo + bundle PDFs into a single index.

**Hyperspell-track 5 criteria check:** ✅ live OAuth real source · ✅ cross-source-only fact (latency claim needs Slack + Gmail + Notion + Nia code) · ✅ learning over time (same-deal-twice diff) · ✅ MCP in Claude Desktop · ✅ vertical (B2B SaaS SDR)

### Idea 4.B: ShiftLeft — the on-call SRE who has read every postmortem you've ever written
**One-line pitch:** When PagerDuty fires at 3am, an agent recalls the 4 most-similar past incidents from Slack #incidents + Notion postmortems, pulls the offending service's recent commits + ADRs + runbooks via Nia, and ships a `gh pr` with the proposed fix plus a Slack message to #incidents with a draft postmortem section already filled in.
**Vertical:** Series-B/C infra-heavy startup SRE on-call at 3am.

**Predicted scores:** Synthesis 5 · Real Work 5 · Hyperspell Depth 5 · Demo 5 · Personal 5 · **Weighted: 5.00 / 5.0**

**Tool integration depth:**
- *Hyperspell:* Slack (#incidents + on-call's DMs) + Notion (postmortem db) + Gmail (vendor status notices). Multi-source `memories.search` weighted toward incidents within 90 days; reinforcement is *visible* — second similar alert retrieves faster + tighter citations because first query tagged the cluster. `hyperspell-mcp` in Claude Desktop so the on-call can also chat in their daily tool.
- *Nia:* indexes the production monorepo + 30 ADR markdown files + 5 runbook PDFs. `deep` mode produces code-level fix proposals + precise file/line citations. Hyperspell explicitly is *not* a code indexer; this slice is Nia's job. The agent asks Hyperspell "what *kind* of incident is this?" and Nia "*where* in the code is the bug?" — boundary is clean.

**12-hour build plan:** H0–H2 keys + scaffold + demo GitHub repo with 30 fake-but-realistic past commits + 8 ADRs + 5 runbooks. H2–H6 Hyperspell ingest of synthetic-but-realistic Slack export (4 months of #incidents) + Notion postmortems + Gmail; in parallel Nia indexing of demo repo + PDFs. H6–H10 PagerDuty webhook handler → Workflow DevKit durable workflow → two-tool agent loop (`recallSimilarIncidents` Hyperspell, `proposeCodeFix` Nia) → `gh pr create` + Slack `chat.postMessage` + Notion postmortem template prefill. H10–H12 stage demo: trigger fake P1, watch PR materialize, then trigger second similar alert and show speed-up.

**The 10-second wow moment:** Two alerts fire 90 seconds apart. First triage: 14s, 3 citations. Second triage (similar root cause): 4s, 5 citations including a *new* one — the Slack DM where someone said "we should add a retry budget" three weeks ago. Hyperspell reinforced the right memory after alert #1.

**Top 3 risks:** 1. First-ingest latency — pre-ingest realistic Slack/Notion/Gmail night before. 2. GitHub PR-creation auth complexity — use a personal access token to a sandbox repo. 3. Nia code citations could be wrong — restrict scope to a small demo repo we control + curated ADRs.

**Hyperspell-track 5 criteria check:** ✅ all five.

### Idea 4.C: GreenLight — the hiring manager who has actually read every résumé and every interview note
**One-line pitch:** A hiring-manager copilot that, when a candidate hits "stage 3" in Ashby/Greenhouse, drafts the panel-debrief synthesis email by joining (Slack DM debriefs + Gmail recruiter threads + Notion scorecards) with (Nia-indexed candidate code samples + their open-source PRs + research papers), and produces a 1-page hire/no-hire memo with a calibrated recommendation by EOD.
**Vertical:** Eng/AI hiring manager at a 30–150-person startup running ~8 active loops a week.

**Predicted scores:** Synthesis 5 · Real Work 5 · Hyperspell Depth 5 · Demo 4 · Personal 5 · **Weighted: 4.80 / 5.0**

**Tool integration depth:**
- *Hyperspell:* Slack (interviewer DMs + #hiring channel) + Gmail (recruiter ↔ candidate threads + reference checks) + Notion (scorecards + leveling rubric) + Google Calendar (who interviewed when). Multi-source weighted query; `userID = hiring_manager_id` ACL so interviewers' private DMs only leak through the manager's view. Reinforcement: by candidate #4, the agent has internalized this manager's bar (e.g., "Priya weights system-design 30% higher than rubric"). MCP into Claude Desktop.
- *Nia:* indexes the candidate's *artifacts* — public GitHub repos, take-home submissions in a sandboxed repo, published papers as PDFs. Code-aware chunking + `deep` mode produces "code-style match to our ADR-007" claim. Hyperspell can't read 4k-file repos with semantic code awareness; Nia is load-bearing.

**12-hour build plan:** H0–H2 keys + scaffold. H2–H6 Hyperspell ingest a *real* Gmail account + Slack workspace + Notion (teammate-volunteers' own data, anonymized for stage); kick Nia indexing on 3 fictional candidates' GitHub repos + take-home repos + 2 arXiv PDFs. H6–H10 build the agent: Ashby-webhook → `streamText` with `recallInterviews` (Hyperspell) + `analyzeArtifacts` (Nia) tools → `generateObject` 1-pager schema → render in Next.js + email-to-Gmail-draft. H10–H12 build the "after candidate #4" demo where reinforcement shows.

**The 10-second wow moment:** Four candidate memos generated live. The fourth memo: "Per your bar (you typically weight system-design heavier than the rubric — see your debriefs on Mar 12, Apr 3, Apr 18), this candidate's system-design score is actually a strong hire." Click citation: three Slack DMs reinforce. The agent has *learned this manager's calibration* across 3 sources.

**Top 3 risks:** 1. PII / privacy optics — use teammate-volunteer data + anonymized stage names; per-user ACL via Hyperspell `user_id` is the talking point. 2. First-ingest latency — pre-ingest night before. 3. Nia indexing of candidate repos must finish — use 3 small repos (≤500 files each).

**Hyperspell-track 5 criteria check:** ✅ all five.

### Track 4 — Phase-1 strategist's pick: **4.B ShiftLeft**

> Memory-load-bearing demo is the most visceral: two pagers fire 90 seconds apart, second triage *visibly* faster citing a memory the first reinforced — that's a 10-second moment Conor and Manu will quote. The **only one of the three where Nia's code half is genuinely irreplaceable**, so Nia+Hyperspell complement is *load-bearing* rather than decorative — credibly competes for both Hyperspell dedicated track AND Nozomio Overall 1st in the same submission.

---

## Phase-1 Summary Table

| Track | Idea A | Idea B | Idea C | Phase-1 Pick |
|---|---|---|---|---|
| 1 — Always-On | NightOwl (4.65) | **Lighthouse (4.80)** | ConciergeOS (4.65) | 1.B |
| 2 — Ship It | PolicyPilot (4.85) | ChangelogBot (4.80) | **OnCallScribe (4.95)** | 2.C |
| 3 — Growth | GhostScout (4.80) | **PostMortem (4.80)** | Atlas (4.60) | 3.B |
| 4 — Company Brain | PipelineSurgeon (4.85) | **ShiftLeft (5.00)** | GreenLight (4.80) | 4.B |

*Phase 2 (debate + scoring) follows below.*

---

## Phase 2.A — CTO Judge Scoring

### Methodology

I re-scored every idea against the actual rubric weights, applying a discount stack a CTO judge would use: (a) sponsor-bingo penalty when an integration is enumerated but not load-bearing; (b) failure-mode penalty when adversarial cases are listed but not credibly handled in a 12h build; (c) free-tier reality penalty (Nia 3-index lifetime cap, InsForge RLS-on-by-default + 1-week idle pause, Tensorlake 2-concurrent free, Reacher having no real production data behind the sandbox); (d) demo-fakery penalty when "ran for 6h" or "memory reinforced" relies on staged data rather than verifiable evidence. I trusted architectural narratives only when there was a concrete sponsor primitive I could point to as irreplaceable — `snapshot+fork`, `Tracer`, `memories.search` weighting, MCPMark-leading InsForge MCP. "Statefulness" gets discounted to "Postgres" unless the team uses Tensorlake suspend/snapshot or Hyperspell reinforcement; "agentic" gets discounted to "single LLM call" unless the trace has 4+ tool calls with branching.

### Track 1 — Always-On

**Idea 1.A NightOwl:** BG Exec 4 · Statefulness 5 · Agentic 4 · Demo 4 · Personal 5 · **Weighted: 4.30 / 5.0**. SQLite ledger + "delete the volume → suppressed comment reappears" is a load-bearing memory demo; webhook-triggered Tensorlake suspend/resume is clean. CTO concern: 6h overnight pre-stage means the actual "background" is performed *the night before*, not on stage; if the team can't show the snapshot timestamp from H-12, the 30% Background Execution score collapses. Webhook plumbing is the silent killer in hour 8.

**Idea 1.B Lighthouse:** BG Exec 5 · Statefulness 4 · Agentic 3 · Demo 4 · Personal 4 · **Weighted: 4.05 / 5.0**. Tensorlake schedule trigger is the cleanest possible "ran for hours" evidence — that's real. But the "taste vector" is just user-feedback weights stored in the persistent FS — `dot-product(user_history, paper_embedding)`, not a novel agent primitive. Agentic Depth is genuinely thin: this is a ranker, not a multi-step agent. The 14-day backfilled history is fakeable unless the cron has been running since H-14 — judges will ask. Personal discounted because EF crowd reads arXiv but rarely *needs* a daily digest.

**Idea 1.C ConciergeOS:** BG Exec 5 · Statefulness 5 · Agentic 5 · Demo 3 · Personal 3 · **Weighted: 4.40 / 5.0**. Per-customer named suspended sandbox is the *single* most architecturally interesting use of Tensorlake in the entire idea set — `suspend` + per-tenant FS is exactly what `snapshot+fork` was built for, and the <300ms boot timer is a visible, falsifiable claim. Agentic depth is real: email-trigger → wake → recall → repro → reply is 5+ tool calls. CTO red flag: free-tier 2-concurrent sandbox cap directly contradicts "multiple suspended sandboxes" — the demo *cannot run* without an elevated key, full stop. Live repro inside the sandbox is the second failure point.

**CTO's Track 1 winner: 1.C ConciergeOS** — only idea where the sponsor primitive (Tensorlake suspend per-customer) is genuinely irreplaceable; if they secure the credit, this is a 4.6+.

### Track 2 — Ship It

**Idea 2.A PolicyPilot:** Production 4 · Reliability 5 · Full-Stack 4 · Demo 5 · Personal 3 · **Weighted: 4.30 / 5.0**. Adversarial plan (recipe-PDF rejection, no-clause refusal, Spanish auto-translate) is the most concretely thought-through in the track. CTO concern: pre-indexing a "curated state-insurance-regulations corpus" is a 3-day data-engineering project, not a 12h hack; if the corpus is thin, the agent will confidently cite the wrong CA Insurance Code section — exactly the failure mode they're claiming to avoid. Magic-link signup on stage is solid Production Readiness evidence.

**Idea 2.B ChangelogBot:** Production 3 · Reliability 3 · Full-Stack 4 · Demo 5 · Personal 4 · **Weighted: 3.55 / 5.0**. Live demo is electric *if it works* — but the failure surface is enormous. GitHub auto-PRs against strangers' repos requires the OAuth user's token; rate limit at 5k/hr is real but the deeper issue is hostile-input detection ("evil/scam" repo check) is hand-waved. AST verification via `ts-morph` is non-trivial to wire in 4h. The "4 fake dependents under a demo org" admission is the giveaway: this is a sandboxed demo, not a production-ready agent. Reliability score gutted because creating real PRs against external repos with no human review is a CTO's nightmare.

**Idea 2.C OnCallScribe:** Production 5 · Reliability 5 · Full-Stack 5 · Demo 5 · Personal 5 · **Weighted: 4.95 / 5.0**. The "guaranteed partial result" pattern (timeline + commits return even if Oracle times out) is exactly the kind of graceful degradation a CTO grades on. Cite-or-die verifier (file/line actually contains claimed code) is a real anti-hallucination check, not a vibe. Stack-trace input has zero auth surface for the demo. Only deduction: Nia repo-indexing wait *will* break first-time stranger demos — Tracer fallback is correct but not yet proven on bleeding-edge code. **This is the strongest idea in the entire set.**

**CTO's Track 2 winner: 2.C OnCallScribe** — handily.

### Track 3 — Growth

**Idea 3.A GhostScout:** SI Depth 4 · Agentic 4 · E2E 4 · Demo 5 · Personal 3 · **Weighted: 4.00 / 5.0**. 8 Reacher MCP tools listed; the actual decision graph (trending → triage → brand-fit → offer-tier) only *needs* 4–5 of them in sequence. The other 3 are sponsor-bingo. The "9 seconds later" claim for 7 ranked targets across multiple MCP tools is implausible — that's at least 4 sequential roundtrips on a live API. Pre-cached "warm payload" is the honest admission that live latency breaks the demo.

**Idea 3.B PostMortem:** SI Depth 5 · Agentic 5 · E2E 4 · Demo 4 · Personal 3 · **Weighted: 4.30 / 5.0**. The 4-hypothesis evidence-tree forensic pattern is genuinely agentic — branching reasoning with citation requirements. Use of unpopular tools (`samples.dispatch_log`, `gmv.per_creator_per_sku`) is the kind of "deep cuts" a sponsor judge rewards. CTO red flag the team named themselves: "no real data behind the sandbox debrief" — Reacher's hackathon dataset is sandboxed/synthetic, so the "competitor X stole the trend window" claim is *fiction the team writes into the seed data*. Forensic depth is theatrical, not investigative. Demo dropped because 90s of tool-calling will visibly stall.

**Idea 3.C Atlas:** SI Depth 3 · Agentic 5 · E2E 4 · Demo 4 · Personal 3 · **Weighted: 3.80 / 5.0**. Three parallel Claude Agent SDK subagents *is* the most agentic architecture in Track 3, but the 4-minute live clock with three lanes streaming in parallel is the most demo-fragile idea here. SI Depth gutted: "scout 1.5M creators" via `creators.search` is a single API call, not creator-economy depth. Triple lanes overwhelm the 10-second hook test — judges can't summarize this to their CEO.

**CTO's Track 3 winner: 3.B PostMortem** — by margin; all three rest on a sandboxed Reacher dataset whose realism the team can't verify until H-3.

### Track 4 — Company Brain

**Idea 4.A PipelineSurgeon:** Synthesis 4 · Real Work 5 · Hyperspell Depth 5 · Demo 4 · Personal 3 · **Weighted: 4.20 / 5.0**. Source-weighting (Slack 0.5 / Gmail 0.3 / Notion 0.2) is exactly the unpopular-API-function judges reward. The Nia/Hyperspell boundary (code vs people) is clean and load-bearing. CTO concern: "second-draft adds a 4th citation because Hyperspell reinforced" — *reinforcement after a single query* is not how vector-memory systems work in 12 hours of build time; this will likely be hand-rolled with a `query_count++` heuristic, not a real Hyperspell-native feature. Personal lower because SDR copilots are demo #14-of-the-day fatigue.

**Idea 4.B ShiftLeft:** Synthesis 5 · Real Work 5 · Hyperspell Depth 5 · Demo 5 · Personal 5 · **Weighted: 5.00 / 5.0**. The Hyperspell/Nia split (`recallSimilarIncidents` vs `proposeCodeFix`) is the cleanest architectural boundary in the entire idea set — Hyperspell genuinely cannot index a code monorepo with AST awareness, Nia genuinely cannot index 4 months of Slack DMs. Two-pager-90s-apart with visibly faster + extra-citation second triage is a falsifiable claim a CTO can verify on stage. Workflow DevKit durable workflow as the runtime spine survives crash-resume — addresses the "what happens when the API rate-limits" question explicitly.

**Idea 4.C GreenLight:** Synthesis 5 · Real Work 4 · Hyperspell Depth 5 · Demo 4 · Personal 4 · **Weighted: 4.45 / 5.0**. Per-user `userID` ACL for interviewer DMs is the most architecturally serious privacy stance in the idea set — judges who have implemented per-tenant RLS will recognize this. Reinforcement-learns-the-manager's-bar is a beautiful pitch *and* the most plausibly hallucinated demo claim in Track 4: showing "Priya weights system-design 30% higher" requires the agent to have ingested ≥3 calibrated debriefs from the same manager, which the team can prep but cannot honestly verify in 12h with Hyperspell's actual reinforcement primitives.

**CTO's Track 4 winner: 4.B ShiftLeft** — by a clear margin; the only Track-4 idea where both sponsors are genuinely load-bearing.

### CTO's overall ranking (across all 12)

| # | Idea | Weighted | Rationale |
|---|---|---|---|
| 1 | 4.B ShiftLeft | 5.00 | Cleanest sponsor split, falsifiable wow moment, durable runtime |
| 2 | 2.C OnCallScribe | 4.95 | Best graceful-degradation + cite-or-die verifier |
| 3 | 4.C GreenLight | 4.45 | Strongest privacy/ACL story, demo claim slightly oversold |
| 4 | 1.C ConciergeOS | 4.40 | Only idea using Tensorlake suspend correctly |
| 5 | 2.A PolicyPilot | 4.30 | Strong adversarial plan, regulations corpus is the risk |
| 6 | 3.B PostMortem | 4.30 | Real agentic depth, sandboxed-data realism risk |
| 7 | 1.A NightOwl | 4.30 | Memory-deletion wow moment, webhook plumbing risk |
| 8 | 4.A PipelineSurgeon | 4.20 | Multi-source weighting genuine; reinforcement claim soft |
| 9 | 1.B Lighthouse | 4.05 | Cleanest cron, weakest agentic depth |
| 10 | 3.A GhostScout | 4.00 | Tool-name-dropping; latency claim implausible |
| 11 | 3.C Atlas | 3.80 | Most demo-fragile; 4-minute clock will fail live |
| 12 | 2.B ChangelogBot | 3.55 | Auto-PRs against external repos = production hostage |

### CTO's red-card calls

- **2.B ChangelogBot — cut.** Live demo where an agent opens auto-PRs against external repositories is one hostile input away from spamming real maintainers. "Default to draft PRs against a fork" is itself a tell that the team knows the unmitigated path is unsafe. Ship 2.C instead.
- **3.C Atlas — cut.** Three parallel subagents on a 4-minute clock with sandbox writes that "echo back POST body + status code" is theater, not agentic complexity. The sandboxed `POST /samples/request` returns 201 regardless of payload validity. A 4-minute trace stalling on stage in an 11pm judging slot is the textbook way to lose Demo + Personal at once.
- **1.B Lighthouse — narrow risk, not a cut.** If they cannot show a Tensorlake schedule-trigger log dating back to H-14 (they almost certainly cannot, because the hackathon started today), the 30% Background Execution score is unsupported.
- **3.B PostMortem — caveat, not a cut.** If Reacher's per-team sandbox dataset doesn't include a believable "failed launch" record, the entire forensic narrative is the team writing the answer the agent then discovers. Ask Reacher's booth at H0 *what's actually in the sandbox* before committing.

The technical bet I'd make: **4.B ShiftLeft is the safest 5.0**, with **2.C OnCallScribe** as the cross-track cousin that wins Track 2 on production-readiness alone. They share the on-call/postmortem domain — a team that builds 4.B essentially gets 2.C's MVP for free, and a single architecture targets both Hyperspell-track and Overall 1st without sponsor-bingo.

---

## Phase 2.B — BizDev / Investor Judge Scoring

### Methodology

I scored each idea through an investor lens: TAM in the next 24 months, named first-10-paying-customers, competitive moat vs incumbents (Glean, Gong, Rootly, Cruva, incident.io, Stormy AI, Modash, GRIN, Lever), and demo legibility to a non-technical room. I held the rubric weights, but I let *Personal Rating* (10%) and *Demo* (10%) reflect GTM credibility; I also dock technical scores when the proposed demo is corporate or invisible to a non-technical judge, because rubric scores are ultimately *what the judge perceived was shown*. Where Phase-1 had the team holding the mic, I asked: would Conor/Jerry/Bora/Arlan want to fly out and deploy this?

### Track 1 — Always-On

**Idea 1.A NightOwl (PR reviewer):** BG 5 · State 5 · Depth 4 · Demo 4 · Personal 3 · **Weighted 4.45.** TAM is real ($2B+ — every dev team — Graphite, CodeRabbit, Greptile, Codium are already there) but *crowded*; CodeRabbit just crossed $30M ARR and has the wedge. First-10 customers are easy (any YC eng team) but so is everyone else's pitch. Wedge of "memory of accepted/rejected suggestions" is genuinely differentiated and the SQLite-delete demo lands, but a non-technical investor sees "another AI PR bot" — the moat is invisible in 60 seconds.

**Idea 1.B Lighthouse (arXiv concierge):** BG 5 · State 5 · Depth 4 · Demo 3 · Personal 3 · **Weighted 4.35.** This is the *classic TAM whiff*. Personal arXiv concierges have been built 200 times (Elicit, Scite, Undermind, Emergent Mind) and none crossed $5M ARR — researchers don't pay. First-10 customers? Grad students at zero CAC who churn at 90%. Demo is intellectually clever but emotionally flat to a non-technical room — "ranking shifted because you mentioned X" is corporate. Phase-1 picked this for *rubric* fit but it's the worst Track 1 choice for an investor judge.

**Idea 1.C ConciergeOS (per-customer support agent):** BG 5 · State 5 · Depth 5 · Demo 4 · Personal 5 · **Weighted 4.75.** Largest TAM of the three — support agents is a $20B+ category, Decagon ($1.5B valuation in 2025), Sierra ($4.5B), Crescendo, Maven AGI all funded heavily. Wedge: per-customer suspended VM with months of memory + live repro is *technically* a real differentiator vs prompt-stuffing incumbents. First-10: any Series-B SaaS company drowning in tickets. Demo of a 4-month-old Slack quote landing in a reply is visceral. Crowded space but the *infra* angle (Tensorlake snapshot per customer) is a story Diptanu specifically would champion.

**BizDev's Track 1 winner: 1.C ConciergeOS.** Real TAM, real GTM (sell to Series B SaaS heads of CX), and the snapshot-per-customer pattern is a credible *technical* moat that maps to a *commercial* moat (lock-in via accumulated repro fixtures). Lighthouse is academically pretty; ConciergeOS gets funded.

### Track 2 — Ship It

**Idea 2.A PolicyPilot (insurance-denial appeal):** Production 5 · Reliability 5 · Stack 5 · Demo 5 · Personal 5 · **Weighted 5.00.** Massive TAM — health-insurance denials are a $260B/yr problem; Claimable, Counterforce Health, Fight Health Insurance are all funded ($14M Series A for Counterforce in 2025). First-10: anyone who Googles "denied MRI claim" — direct-to-consumer SEO motion is obvious. Founder-market-fit is the only weak point (the team isn't Brian Reid from Counterforce), but the demo of a stranger uploading a denial and getting a cited appeal is the most emotionally resonant wow moment in Track 2. Investor read: real revenue, defensible regulation moat, sympathetic user.

**Idea 2.B ChangelogBot (downstream-PR autofix):** Production 5 · Reliability 5 · Stack 5 · Demo 4 · Personal 3 · **Weighted 4.50.** Cool engineering but TAM is tight — only library maintainers care, and the top 1000 OSS maintainers don't pay. Closest competitors: Renovate, Dependabot, Greptile's PR-aware bot, Augment Code. This is a *feature*, not a company. First-10 paying customers: hard to name. Demo is impressive technically (real downstream PRs) but a non-technical judge sees "GitHub bot opens GitHub PRs" and shrugs. I docked Personal hard.

**Idea 2.C OnCallScribe (post-mortem agent):** Production 5 · Reliability 5 · Stack 5 · Demo 5 · Personal 5 · **Weighted 5.00.** $5B+ TAM (incident response — Rootly $30M Series B, incident.io $62M Series B, FireHydrant, Cruva, Resolve.ai). The wedge "cite-or-die verifier checks claimed file/line" directly attacks the trust failure of Rootly's AI which famously hallucinates. First-10: any infra Series B that just got paged at 3am — Conor and Jerry both know exactly which startups these are. Demo of stack-trace → timeline → fix-PR in 90s lands with every founder in the room because *they have all been paged*. Strongest founder-market-fit signal of any idea.

**BizDev's Track 2 winner: 2.C OnCallScribe**, narrowly over 2.A PolicyPilot. Both are 5.00 weighted, but OnCallScribe matches the EF/SF crowd's lived pain and has the cleaner B2B GTM (sell to Heads of Platform — known-named buyers); PolicyPilot has a bigger TAM but a harder D2C SEO motion the team won't pull off in 12 hours.

### Track 3 — Growth

> Reminder: Jerry Qian + Bora Mutluoglu (ex-Meta, ex-Palo Alto Networks, $20M+ tracked GMV, customers: Under Armour / Hanes / HeyDude / Logitech) are the likely judges. They will smell *fake creator-economy GTM* in 5 seconds.

**Idea 3.A GhostScout (creator-defection agent):** SI 5 · Agentic 5 · E2E 5 · Demo 5 · Personal 5 · **Weighted 5.00.** This is exactly the agent Jerry would build himself if he had time. TAM = the entire $200B+ creator marketing category. Closest competitors: Modash, GRIN, CreatorIQ, Whalar — none do *competitor-defection-while-the-window-is-open*. Wedge is timing arbitrage, which is a real moat. First-10: literally Reacher's existing customer list (Under Armour, Hanes, HeyDude). The "judge says hair serum, OUAI is the competitor" demo is a Jerry-bait moment — he'll instantly imagine selling it to his existing book.

**Idea 3.B PostMortem (failed-launch attribution forensics):** SI 5 · Agentic 5 · E2E 5 · Demo 4 · Personal 4 · **Weighted 4.70.** Phase-1 loved this. I'm more skeptical from a BizDev seat: brands hate looking at failed launches and "remediation campaigns" sound like a consulting deliverable, not a product. TAM is real (post-launch attribution is a $1B subcategory — Northbeam, Triple Whale, Particl) but brand managers buying *autopsies* is a cold sell. Demo is intellectually elegant ("courtroom-style case file") but emotionally lower-energy than a creator-defection wow shot. Wedge of "extract insight a human would miss" is the rubric-best frame though, which is why Phase-1 picked it.

**Idea 3.C Atlas (judge-brief-to-shipped-campaign):** SI 4 · Agentic 5 · E2E 5 · Demo 5 · Personal 4 · **Weighted 4.60.** Demo is the most *emotionally* impressive ("Hanes underwear, $50K budget" → 3 archetype campaigns in 4 minutes), but rubric punishes "breadth over depth" — three lanes streaming at once dilutes the SI-Depth axis. TAM is the same as 3.A but with a thinner moat (any agent framework can fan out). Jerry will recognize it as "Reacher's actual Outreach Agent + a planner" and ask what's left for him to build.

**BizDev's Track 3 winner: 3.A GhostScout.** Maps onto a wedge Reacher *itself* hasn't shipped yet (defection-window timing), uses the full Reacher MCP including write endpoints, and has named customers Jerry already sells to. PostMortem is the rubric pick; GhostScout is the *Jerry-would-fund-this* pick.

### Track 4 — Company Brain

> Conor publicly said "I fly to customers and stay up till 4am helping them." His judging axis is which agent he'd most want to deploy *for a real customer next week*.

**Idea 4.A PipelineSurgeon (vertical SDR copilot):** Synthesis 5 · Real Work 5 · HS Depth 5 · Demo 4 · Personal 4 · **Weighted 4.80.** Massive TAM — sales tooling is $50B+; Gong ($7B), Outreach, Apollo, Clay ($1.25B in 2025), Regie.ai, 11x.ai are all there. The wedge "cite the exact Slack thread + GitHub issue" is real for *technical* B2B sales but Clay and 11x.ai are eating this lane. Demo is Conor-friendly (he sold APIs) but the second-draft-with-a-fourth-citation moment is subtle for a non-SDR audience. First-10 paying customers: Series-A dev-tools companies — known-named, gettable, but Conor will know the GTM is hard ("AEs hate new tools").

**Idea 4.B ShiftLeft (3am SRE copilot):** Synthesis 5 · Real Work 5 · HS Depth 5 · Demo 5 · Personal 5 · **Weighted 5.00.** Same TAM as OnCallScribe ($5B+ incident category). Wedge over OnCallScribe: ShiftLeft *acts* (opens PRs, posts to Slack, pre-fills Notion) where OnCallScribe *reports*. The two-pagers-90-seconds-apart-second-is-faster demo is the most viscerally memory-load-bearing moment in any of the 12 ideas — Conor will literally narrate this back to a customer in week 1. First-10: Series-B/C infra-heavy startups (Modal, Railway, Render, Tigris, etc. — Conor has the rolodex from Checkr days). This is the bet.

**Idea 4.C GreenLight (hiring-manager copilot):** Synthesis 5 · Real Work 5 · HS Depth 5 · Demo 4 · Personal 4 · **Weighted 4.80.** TAM is real ($30B HR tech — Lever, Greenhouse, Ashby, Metaview, Hireguide.ai are there). Wedge "agent learns *this manager's* calibration across 3 sources" is genuinely novel and Hyperspell-load-bearing. But: hiring is *seasonal and hates AI* (legal optics around bias are radioactive — Workday is being sued). PII is a demo footgun. Conor's customer-deploy lens: he *cannot* fly out to deploy a hiring agent without legal review. Drops Personal for that reason.

**BizDev's Track 4 winner: 4.B ShiftLeft.** Cleanest GTM (named buyers: VP Eng / Head of Platform at infra Series B), cleanest moat (memory of *this team's* incident patterns is a flywheel that gets harder to leave), and the demo is a 10-second moment Conor will literally re-tell at his next customer dinner.

### BizDev's overall ranking (across all 12)

| Rank | Idea | Track | Weighted | One-line BizDev take |
|---|---|---|---|---|
| 1 | 2.C OnCallScribe | 2 | 5.00 | Real TAM, named buyers, viscerally felt pain, anti-hallucination wedge legible to non-technical judges |
| 2 | 4.B ShiftLeft | 4 | 5.00 | Same incident TAM but with *action* not just *report*; Conor's dream deploy-this-with-the-customer demo |
| 3 | 3.A GhostScout | 3 | 5.00 | Jerry-bait — competitor-defection timing arbitrage is the wedge Reacher hasn't shipped |
| 4 | 2.A PolicyPilot | 2 | 5.00 | $260B insurance-denial TAM, sympathetic user, regulation moat — only loses to OnCallScribe on founder-market-fit |
| 5 | 1.C ConciergeOS | 1 | 4.75 | Decagon/Sierra category; per-customer suspended VM is a credible technical-into-commercial moat |
| 6 | 3.B PostMortem | 3 | 4.70 | Rubric-clean, but selling autopsies is a cold motion; courtroom UI is clever but lower-emotion |
| 7 | 3.C Atlas | 3 | 4.60 | Demo-viscerally impressive but reads to Jerry as "Reacher Outreach Agent + a planner" |
| 8 | 2.B ChangelogBot | 2 | 4.50 | Cool but a feature, not a company; OSS maintainers don't pay |
| 9 | 1.A NightOwl | 1 | 4.45 | CodeRabbit territory; memory-of-accepted-suggestions wedge is real but invisible in 60s |
| 10 | 4.A PipelineSurgeon | 4 | 4.80→ docked to ~4.40 in my ranking | Strong rubric, but Clay/11x.ai/Regie are eating this lane and AEs hate new tools |
| 11 | 4.C GreenLight | 4 | 4.80→ docked to ~4.30 | HR-tech AI is legally radioactive; Conor cannot fly out to deploy this in week 1 |
| 12 | 1.B Lighthouse | 1 | 4.35 | Personal arXiv concierge is the canonical TAM whiff — built 200 times, never crossed $5M ARR |

(Note: 4.A and 4.C kept their rubric-weighted scores in earlier sections for honesty against the rubric, but in *my* investor-rank ordering they fall behind ConciergeOS and PostMortem on commercial defensibility.)

### "Founder time worth $1k cash" — Hyperspell track-prize specific bet

**Pick: 4.B ShiftLeft.** Conor's public theology — "make customers the hero," "fly out and stay up till 4am," "memory is what makes agents useful" — fuses on this idea. ShiftLeft turns the on-call SRE into the hero (their own past postmortems are cited as the answer), it's a vertical Conor can imagine personally deploying at a Hyperspell-customer infra startup the Monday after the hackathon, and the second-pager-faster moment is the *only* demo of the 12 where memory reinforcement is the literal product (not a side effect). PipelineSurgeon is the runner-up but Clay/11x.ai is too crowded for Conor to want to flight-deploy a 13th sales copilot; GreenLight is non-startable due to AI-hiring legal optics. ShiftLeft is the bet.

### TAM and competitive analysis flagged

| Idea | TAM ballpark | Closest competitor | One-sentence wedge |
|---|---|---|---|
| 1.A NightOwl | $2B (PR review) | CodeRabbit ($30M ARR), Greptile, Graphite | Memory of accepted/rejected suggestions creates per-team behavior drift |
| 1.B Lighthouse | <$100M (researcher tools) | Elicit, Scite, Undermind | Per-user taste vector, but researchers don't pay — TAM whiff |
| 1.C ConciergeOS | $20B+ (AI support) | Decagon, Sierra, Crescendo, Maven AGI | Per-customer suspended VM with live bug repro across months |
| 2.A PolicyPilot | $260B (claim denials) | Counterforce Health ($14M Series A), Claimable | Cited statutory grounding — refuses to file unsupported appeals |
| 2.B ChangelogBot | <$200M (lib maintainers) | Renovate, Dependabot, Greptile | Tracer-grounded autofix without pre-indexing — feature, not company |
| 2.C OnCallScribe | $5B+ (incident response) | Rootly ($30M B), incident.io ($62M B), Cruva, Resolve.ai | Cite-or-die verifier on claimed file/line — attacks Rootly's hallucination problem |
| 3.A GhostScout | $200B+ (creator marketing) | Modash, GRIN, CreatorIQ, Whalar | Timing-arbitrage on *competitor's* viral creators inside the 18h defection window |
| 3.B PostMortem | $1B (post-launch attribution) | Northbeam, Triple Whale, Particl | Cross-tabs sample-dispatch latency × per-creator GMV × competitor trend-window steal |
| 3.C Atlas | $200B+ (creator marketing) | Reacher itself, Stormy AI, Influential | 3 archetype campaigns from one brief — thin moat vs Reacher's own roadmap |
| 4.A PipelineSurgeon | $50B (sales tech) | Gong, Clay ($1.25B), 11x.ai, Regie.ai | Cited Slack+Gmail+code proof for technical B2B prospects — crowded lane |
| 4.B ShiftLeft | $5B+ (incident + acts not reports) | Rootly, incident.io, Resolve.ai | Reinforced cross-source memory of *this team's* past incidents = flywheel |
| 4.C GreenLight | $30B (HR tech) | Metaview, Hireguide.ai, Ashby/Greenhouse-native | Learns *this manager's* calibration — but AI-hiring is legally radioactive |

---

## Phase 2.C — Devil's Advocate (kill-shots)

### Ground rules of the audit

I'm not looking for risks the team can paper over with "we'll mitigate it." I'm looking for the exact 30-second window in the live demo where a judge with a laptop and a question vaporizes the project — the kind of failure that turns a 4.8 predicted score into a polite nod and a 3.1. Every kill-shot below is the *single* moment the idea visibly stops being agentic and starts being a prompt with extra steps. I'm assuming a hostile judge (Diptanu, Conor, or someone from YC) who has seen 13 demos before yours and will probe the seam.

### Track 1 — Always-On

**1.A NightOwl — kill-shot:** The "delete the SQLite ledger and watch the regression" wow moment is a magic trick that requires the *exact same PR* to produce a deterministically *different* comment in two consecutive runs. LLM nondeterminism (temperature, model drift, cache miss) means that on stage the "regressed" comment will look ~85% identical to the "learned" comment — the diff is not visceral, the audible "oh" never lands, and the demo collapses into "trust us, the memory matters." You cannot rehearse around stochasticity in a 12h timebox.
**Patches if you must build it:** Hard-pin temperature 0 + cache the exact prompt fingerprint; show the *retrieval payload* difference (memory rows present/absent) as the proof artifact, not the comment text.

**1.B Lighthouse — kill-shot:** The "14-day backfilled history" is the entire credibility of the taste vector — and a sharp judge will ask "show me the timestamps in your DB." Faked-but-realistic timestamps on rows you inserted at H4 will read as faked the moment they query at second granularity (every row clustered in a 2-hour window? humans don't read at 3am with 40ms gaps). The agentic-depth axis is also a lie here: hourly cron + ranker is one LLM call dressed up as a workflow. Judges who score "agentic complexity" will mark this 3/5.
**Patches:** Start the cron literally now (real wall-clock evidence > simulated timestamps); add at least one branching tool-call per digest (e.g., follow-up arXiv lookup when a paper cites another) so the trace shows multi-step reasoning, not a single classify-and-rank shot.

**1.C ConciergeOS — kill-shot:** "One named, suspended sandbox per customer" on Tensorlake's free tier (2 concurrent) is mathematically incompatible with the demo's premise of *months* of customers. The first time a judge says "wake customer #3" while customers #1 and #2 are still warm, you get a queue error or a forced-eviction that shows up as a 12-second cold start instead of the promised <300ms. The "rich fixtures" claim also breaks under "show me the Slack thread from 4 months ago" — judge clicks the citation, sees a fixture authored by the team yesterday.
**Patches:** Demo with exactly 2 customers and pre-wake them; keep all "history" in a single shared snapshot keyed by customer_id so concurrency stays at 1.

### Track 2 — Ship It

**2.A PolicyPilot — kill-shot:** State-insurance-code citations are the entire wedge ("Section 4.2.1... §10123.13"), and an LLM grounded on a Nia index of regulations will hallucinate plausible-but-wrong section numbers ~10–20% of the time. A judge who is a lawyer-adjacent EF founder (there will be one) will copy the cited code into a new tab and find it doesn't say what you claim — at which point the "anti-hallucination wedge" *becomes* the failure narrative. Worse: any output that says "DENIAL LIKELY INVALID" on a real document is unauthorized practice of law in California, and a judge who flags this kills the prize.
**Patches:** Reframe output as "questions to ask your insurer" not legal verdict; cite-or-die verifier that re-fetches the cited statute text and string-matches before rendering.

**2.B ChangelogBot — kill-shot:** "Open auto-PRs against public dependent repos" *during a live demo* will get the demo GitHub account flagged or rate-limited inside 5 minutes — GitHub's anti-spam heuristics fire on bursty cross-org PR creation from a fresh OAuth app, and the abuse heuristics are not negotiable for an app-token created at H1. The demo flow ("3 real PR links appear") then 403s on stage. Even if you survive that, the four "fake dependents under a demo org" undermines the wow moment — a judge who looks at the dependents' star count (0) sees the trick.
**Patches:** Default to draft PRs on a single sandbox org you control with 4–8 pre-forked real repos; pre-warm the first PR creation 60 minutes before demo so GitHub's heuristics stay calm.

**2.C OnCallScribe — kill-shot:** The "paste a Sentry URL" input requires either a real Sentry org integration (OAuth, won't ship in 12h) or scraping a public Sentry issue page — and Sentry issue URLs are auth-gated by default, so a judge pasting *their own* Sentry link returns 401 and the demo silently collapses to "paste a stack trace." The fallback path (raw stack trace) erases the input-surface elegance the strategist sold. Separately, the "fix PR" against a repo you didn't author is a code-review trap: when the judge opens the PR, they'll find generic try/catch wrapping that any senior engineer can identify as LLM-pattern in 3 seconds.
**Patches:** Restrict the live demo to a sample-Sentry-event JSON paste (your own stage data) + drop "fix PR" from headline messaging — make the post-mortem the artifact, not the code.

### Track 3 — Growth

> Track 3 sits on a Reacher hackathon MCP at `api.reacherapp.com/mcp` that has *not* been independently verified — no public schema, no documented latency, no error-rate baseline, no confirmation Reacher is actually serving 33 tools today vs the marketing claim. Every Track 3 idea inherits "the MCP server returns 502 at H11" as a base failure mode. Build attacks accordingly.

**3.A GhostScout — kill-shot:** The MCP `social_intelligence.trending_videos` endpoint is the load-bearing tool, and judges asking "show me a competitor going viral *right now*" will get either (a) cached payload with a stamp 4+ hours old, killing the "before breakfast" claim, or (b) a live call that fan-outs to TikTok scraping infra and times out on stage. The "9 seconds" promise from judge brief to ranked targets requires deterministic latency on tools you don't control. Worse: the brand-fit rationale will read as horoscope text ("this creator's tone aligns with your voice-and-tone PDF") unless Nia citations are *exact paragraph quotes* — which won't happen on free-tier deep-mode budgets.
**Patches:** Pre-warm one judge brief; gate the demo to one cached competitor case and run "live" with cache-with-receipts UI showing the 47s-stale stamp honestly.

**3.B PostMortem — kill-shot:** The whole pitch hinges on "extracts insight a human would miss" — but the insight in the demo ("47% of samples dispatched 5+ days post-acceptance") is a *statistic*, not an insight. A BD judge (Jerry/Bora) will say "a SQL query does that" and the agentic-complexity argument evaporates. The four-hypothesis scaffold is also a strawman: each hypothesis is one prompt template with retrieved evidence stuffed in — there is no actual branching reasoning, and any judge who reads the trace will see four parallel one-shot LLM calls labeled "investigation." The "courtroom case file" UI is a beautiful coat of paint on a single SQL aggregate plus four templated paragraphs.
**Patches:** Force at least one hypothesis to *contradict* the data and have the agent abandon it on stage with cited reasoning — that's the only move that makes the agentic depth visible.

**3.C Atlas — kill-shot:** The 4-minute live clock is the demo's coffin. Three parallel archetype subagents on free-tier Claude with deep Nia retrievals + 9+ MCP tool calls each + write-endpoint fan-out is a 7–9 minute realistic envelope, and judges *will* notice when you started the timer at 1:47 and you're still at "lane 2 dispatching samples" at 5:30. You can't pre-warm the brief because the judge gives the brief on stage. The fallback "demo one lane in detail" is a confession that the headline (three archetypes in 4min) was always a lie.
**Patches:** Drop the 4-minute claim entirely; restructure as "one archetype in 90s + two pre-rendered" with honest "we'd parallelize in production" framing.

### Track 4 — Company Brain

> First-ingest latency on real Slack/Gmail is the #1 killer here, and the build plans paper over it with "pre-ingest the night before" — but a Slack export on a real workspace can run 18+ minutes at the API tier Hyperspell sits on, and a Gmail mailbox of meaningful size (5k+ messages) is 30+ minutes of OAuth-scoped batch fetch before Hyperspell's chunker even starts. If the team waits until 9pm Friday to start ingest, "warm index by demo" is not on the table.

**4.A PipelineSurgeon — kill-shot:** The "create a Gmail draft" action requires the `gmail.compose` scope which Google flags as restricted-and-sensitive — meaning a brand-new OAuth client created at H0 will hit Google's unverified-app warning screen ("This app isn't verified") *every* time on demo. Judges scanning a QR see a red interstitial Google screen and the trust collapse is immediate. The team's mitigation ("use create draft not send") doesn't help — the scope sensitivity is the same. Separately: "weighted multi-source query (Slack 0.5, Gmail 0.3, Notion 0.2)" is a static config dressed up as learning — the agent doesn't *learn* the weights, it just uses the weights you set. The Hyperspell criterion "memory got sharper" fails the test.
**Patches:** Pre-author drafts into a personal Gmail you logged into at H-12 (no OAuth flow at demo time); render the "second-query reinforcement" via a memory-trace overlay that *shows* which rows Hyperspell upweighted, not just a different output.

**4.B ShiftLeft — kill-shot:** The two-pagers-90-seconds-apart wow moment requires Hyperspell's reinforcement signal to *actually* propagate fast enough to change the second retrieval. Hyperspell's reinforcement is async and the documented latency for memory-strength updates is unspecified — meaning the second triage may pull *exactly the same* citations as the first because reinforcement hasn't landed yet. The "5 citations including a *new* one" is a story the team tells themselves; in practice the demo will show 2 identical retrievals 90s apart and the entire memory-load-bearing pitch collapses on stage. Also: "synthetic-but-realistic Slack export" of 4 months of #incidents will read as fixture-y under any judge who clicks a citation and sees three messages from the same author at 4:02am.
**Patches:** Manually pre-warm the reinforcement by issuing the first query 5 minutes before demo (not on stage); seed the synthetic Slack with 6+ author personas with realistic temporal spread.

**4.C GreenLight — kill-shot:** Live PII on stage. Even with "teammate-volunteer data anonymized for stage," the moment a judge sees real Slack DMs containing real interview opinions about real-named candidates, the optics are awful — and an EF/YC-adjacent judge knows enough employment law to flag it. The "per-user ACL via Hyperspell user_id" is a talking point, not a defense. Beyond the optics: "agent has internalized this manager's bar (e.g., 'Priya weights system-design 30% higher than rubric')" requires 4+ candidates of historical signal to even compute a calibration — and the live demo only generates 4 memos in real time, so the "internalized bar" is necessarily simulated from the team's hand-tuned weights, not observed.
**Patches:** Use entirely fictional candidate personas + fictional interviewers; pre-bake a 12-candidate history *as fixture data* and have the live demo only generate the 13th memo on top of that warm context.

### The 3 ideas I'd cut from consideration entirely

1. **2.A PolicyPilot.** Outputting "DENIAL LIKELY INVALID" with cited regulations is unauthorized legal advice in California, the cited section numbers will be ~15% wrong, and the failure mode is *legal liability*, not just a bad demo. No mitigation makes this safe in a public demo where one judge could be a lawyer.
2. **2.B ChangelogBot.** Auto-creating PRs across multiple GitHub orgs from a fresh OAuth app is a near-guaranteed abuse-flag during a live demo, and the "fake dependents under a demo org" salvage erases the entire wow moment. The plumbing-to-payoff ratio is upside-down.
3. **3.C Atlas.** The 4-minute live clock against three parallel agents on free-tier APIs with sponsor MCP tools you haven't load-tested is hubris. Every minute that ticks past 4:00 with a judge watching is a minute you're losing the room — and you cannot pre-cache because the judge supplies the brief.

### Hidden risks the brief didn't surface

- **Reacher MCP server is a single point of failure across 25% of the candidate ideas, and we have no SLA.** The brief states `api.reacherapp.com/mcp` exists with "33 tools" but provides zero verification of latency, error rate, rate limits, or even uptime during the hackathon window. If it 502s at H11, three of the 12 ideas die simultaneously. There is no published status page.
- **Every Track-4 wow moment is "two queries, second is sharper" — and Hyperspell's reinforcement timing is undocumented.** If reinforcement is eventual-consistency with a multi-minute window, *every* Track 4 demo silently fails to show the headline learning behavior, regardless of which idea you pick.
- **Judges will try adversarial inputs and the streaming "trace UI" makes failures more visible, not less.** Every idea here streams the agent's reasoning to the screen. When the agent goes off the rails on a hostile input, the audience watches it happen in real time. A non-streaming fallback that hides errors behind a spinner is actually safer for live demos — but counter to the 2026 "thinking is the value prop" thesis the brief endorses.

### The "demo dies on stage" recovery question

For each of the four Phase-1 strategist picks, the single recovery move when the live demo dies (not the generic Loom-backup):

- **1.B Lighthouse — recovery:** Pivot to the *taste-vector inspector* page (must be built as a standalone route). When the cron-driven digest fails, open the inspector and walk the judge through "here are the 12 papers I read last week, here is the per-dimension weight shift on each, here is tomorrow's queued ranking." This sells the statefulness without needing live agent execution. Pre-build this route as a *first-class artifact*, not a debug tool.
- **2.C OnCallScribe — recovery:** Have one fully-pre-rendered post-mortem page open in a second browser tab — keyed off a real OSS incident (not synthetic) — with the GitHub PR already merged. When live paste fails, navigate to that URL and walk through the artifact citation-by-citation as if reviewing a teammate's work. This converts the failure into a "see what this produced last night" frame, which is stronger than apologizing and switching to Loom.
- **3.B PostMortem — recovery:** Open the "evidence tree" view directly with a pre-loaded case ID in the URL (`?case=demo-failed-launch-1`). The forensic case file *already rendered* is a stronger artifact than a live run because it lets the judge click hypotheses and read citations at their own pace. Make sure every Reacher MCP tool call is captured as a saved-receipt JSON the judge can expand — receipts > re-running.
- **4.B ShiftLeft — recovery:** Pre-merge the second-incident PR into the demo repo *yesterday* and have a screen recording of the GitHub PR-creation event captured at H-2. When live triage fails, open the merged PR in GitHub on stage, click through the file diff, and narrate "here is what the agent shipped at 11:47pm last night when alert #2 fired" — past-tense receipts beat present-tense spinners every time. The Hyperspell timeline overlay must work standalone, decoupled from the alert webhook, so reinforcement evidence still renders.

---

## Phase 2.D — Final Synthesizer (the tie-breaker)

### Scoring rubric used
- Rubric fit (per-track weighted score from Phase 1): **60%**
- Demo realism in a 12-hour build: **20%**
- Founder-judge alignment + GTM credibility: **10%**
- Backup-plan robustness: **10%**

### Final scores (out of 5.0)

Demo realism scored against the actual constraints in `SETUP_CHECKLIST.md`: Nia's 3-lifetime-index free tier, Hyperspell first-ingest latency, InsForge RLS-auto-stall, Tensorlake's 2-concurrent free cap, the fact that Reacher's MCP at `api.reacherapp.com/mcp` is hackathon-only infrastructure (not battle-tested), and a 12-hour solo-or-pair budget. Backup robustness scores how cleanly the demo degrades when one tool dies on stage.

| ID | Idea | Track | Rubric fit | Demo realism | Judge fit | Backup | **Final** |
|---|---|---|---|---|---|---|---|
| 1.A | NightOwl | 1 | 4.65 | 3.8 | 4.5 | 4.0 | **4.30** |
| 1.B | Lighthouse | 1 | 4.80 | 3.6 | 4.2 | 4.5 | **4.30** |
| 1.C | ConciergeOS | 1 | 4.65 | 3.4 | 4.0 | 3.8 | **4.16** |
| 2.A | PolicyPilot | 2 | 4.85 | 4.2 | 3.8 | 4.5 | **4.55** |
| 2.B | ChangelogBot | 2 | 4.80 | 3.5 | 4.5 | 3.5 | **4.28** |
| 2.C | OnCallScribe | 2 | 4.95 | 4.4 | 5.0 | 4.6 | **4.79** |
| 3.A | GhostScout | 3 | 4.80 | 4.0 | 4.8 | 4.0 | **4.56** |
| 3.B | PostMortem | 3 | 4.80 | 3.8 | 4.7 | 3.8 | **4.46** |
| 3.C | Atlas | 3 | 4.60 | 3.4 | 4.5 | 3.5 | **4.24** |
| 4.A | PipelineSurgeon | 4 | 4.85 | 4.0 | 4.6 | 4.2 | **4.59** |
| 4.B | ShiftLeft | 4 | 5.00 | 4.0 | 5.0 | 4.4 | **4.74** |
| 4.C | GreenLight | 4 | 4.80 | 3.5 | 4.2 | 3.8 | **4.36** |

### Per-track winners (final)

- **Track 1 winner — 1.A NightOwl (4.30, tied with 1.B but won on backup robustness and judge-fit-via-Diptanu).** I am overruling Phase-1's Lighthouse pick. Lighthouse's "14 days of taste-vector evidence" is genuinely unfakeable — but it's also genuinely *unfakeable in 12 hours*, and the demo collapses to "trust me, this would be cool with two weeks of data." NightOwl's evidence — last-night's PR comments — is producible from a single overnight run on a real OSS repo (the participant has `GITHUB_TOKEN` ready per `SETUP_CHECKLIST.md` §12) and the Tensorlake snapshot+fork-per-file story is exactly the "creative use of unpopular functions" Diptanu rewards. Same final score, but NightOwl's failure modes are recoverable and Lighthouse's aren't.

- **Track 2 winner — 2.C OnCallScribe (4.79).** Phase-1 was right and the math confirms it: highest rubric fit (4.95), highest judge fit (every EF/SF judge has been paged at 3am), and the input surface is so simple — paste a Sentry URL — that a stranger uses it in 5 seconds. The failure modes degrade *gracefully by design* (timeline + commits return even if Oracle times out). Adversarial defense is built in (cite-or-die verifier rejects hallucinated file:line claims). This is the safest 4.95 on the board.

- **Track 3 winner — 3.A GhostScout (4.56), overruling Phase-1's PostMortem pick.** PostMortem is the more intellectually impressive idea (forensic reasoning a human BD lead literally cannot do) — but its demo is *retrospective* on a fake "failed launch" debrief, which means judges watch the agent reason about pre-canned data. GhostScout is *prospective*: judge says "I'm a hair serum brand, competitor is OUAI" and 9 seconds later sees ranked defection targets with the exact competitor video each posted 18h ago, sandboxed `POST /samples/request` returning 201 live on the projector. Jerry/Bora are GTM founders; they will viscerally recognize "agent stole a creator from a competitor before breakfast" as the dream loop. Phase-1 weighted depth-of-tool-use too heavily; the rubric's 30% Demo+Personal weighting punishes PostMortem's slower payoff. (Phase 2.B BizDev concurs.)

- **Track 4 winner — 4.B ShiftLeft (4.74).** Phase-1 was right. The "two pagers fire 90 seconds apart, second triage visibly faster citing a memory the first reinforced" is the single most rubric-shaped 10-second moment across all 12 ideas — it directly executes Hyperspell's 5 winning criteria the brief lays out (`SPONSORS.md` line 168–175). It is also the only Track-4 idea where Nia's code-indexing half is genuinely irreplaceable: Hyperspell is explicitly *not* a code indexer, so ADRs + monorepo are Nia's load-bearing job, and the Nia+Hyperspell pairing is *complementary, not redundant*.

### Cross-track winner (the *commit-now* recommendation)

**Build:** **2.C OnCallScribe** with a Hyperspell layer bolted on (see "Combined-track play" below). Codename it **Triage**.

**Targets prizes:** Overall 1st (host/Nia spine), **Hyperspell dedicated track** ($1K + 6mo + founder working session — the highest-EV prize per `SPONSORS.md` line 23), Track 2 (Ship It).

**Why this idea over the other 3 track winners:** First, demo realism: the input surface ("paste this Sentry URL") is the simplest of the four winners, which means it survives stranger-on-stage usage and judge-on-phone usage where ShiftLeft's PagerDuty webhook does not. Second, GTM/judge fit: every judge in the EF Office room — Conor, Manu, Arlan, Diptanu, the InsForge founders, the OpenAI ambassador, the EF partners — has been paged at 3am, where ShiftLeft's audience is narrower (SREs at infra-heavy startups). Third, sponsor-key reality: per `SETUP_CHECKLIST.md` the participant has `GITHUB_TOKEN`, `OPENAI_API_KEY`, `GEMINI_API_KEY` ready, needs only Nia + InsForge keys (both publicly self-serve via `npx nia-wizard@latest` and the InsForge dashboard) — zero booth-promise dependencies on the critical path. Fourth, anti-hallucination is the *literal product wedge* in this domain ("a wrong root cause sends an oncall down a 4-hour wrong path") — Nia's grounded retrieval becomes the value prop, not a sponsor obligation. Fifth, OnCallScribe degrades gracefully (timeline always returnable) where ShiftLeft and GhostScout require their full pipelines to fire to be impressive.

**The 30-second commit-now talking points:**
1. *"3am-paged engineer pastes a Sentry URL — Triage writes the post-mortem timeline, root cause, and a draft fix PR in 90 seconds, every claim cited to a commit or file:line."*
2. *"Built on Nia (host) for grounded code retrieval — anti-hallucination is the wedge — InsForge for the magic-link + RLS-by-org full-stack so judges sign up on their phone in 5 seconds — and Hyperspell for the cross-source incident memory that gets sharper every page."*
3. *"Tested adversarially: empty commit history → falls back to infra-likely branch; cite-or-die verifier rejects hallucinated file:line claims; partial result returns even if Oracle times out; never auto-merges, always opens a draft PR."*

### Lazy-mode backup (4-hour build, exhausted-at-2am)

**Build:** **DocsThatTalkBack** as already specified in `SPONSORS.md` line 664 (Nia + Vercel) — paste any framework doc URL, Nia indexes it, Vercel AI SDK chat with one `searchDocs` tool calling Nia `/search`, deploy to Vercel preview.

**Why this is the safe play:** Two sponsors, both with self-serve key paths the participant already has scripted (`npx nia-wizard@latest` for Nia, `vercel link` for deploy). Zero booth-promise dependencies. Demo is bulletproof because the only question is "does Nia return cited results for a doc URL?" which is the documented happy path of the host's flagship product.

**The H8–H12 build path:** H8 `npx nia-wizard@latest` + `npx create-next-app@latest`. H9 paste a real doc URL (e.g., AI SDK 6 docs merged 24h ago) into Nia, wait ~10 min for index. H10 `app/api/chat/route.ts` with `streamText` + one `tool({ inputSchema: z.object({ q: z.string() }), execute: callNiaSearch })`. H11 `vercel deploy --prod`, smoke-test on phone. H12 record 60s Loom showing the demo answering a question about a feature merged that day. Pitch: *"Context7 but always-fresh and cited."*

### Combined-track play (does one idea compete for two tracks?)

**Yes — Triage (OnCallScribe + Hyperspell layer).** Bolt one Hyperspell tool onto OnCallScribe and it credibly competes for **Track 2 (Ship It) AND Hyperspell dedicated track** simultaneously. Architecturally: keep the OnCallScribe spine (Nia for repo/commit retrieval, InsForge for the full-stack), and add a `recallSimilarIncidents` tool that queries Hyperspell over a (pre-ingested the night before) Slack `#incidents` channel + Notion postmortems + Gmail vendor-status. The "two-pager-reinforcement" demo from ShiftLeft becomes optional Hyperspell-bonus content if time permits — paste two similar Sentry URLs, second triage cites a memory the first reinforced. Threading the rubric needles: Track 2's 35% Production Readiness weight is satisfied by InsForge (live URL + magic-link + adversarial defense), Track 2's 30% Reliability is satisfied by Nia's anti-hallucination, *and* Hyperspell's 5 winning criteria all get checked (live OAuth via Hyperspell Connect for #incidents Slack, cross-source-only fact, learning-over-time on second-similar-alert, MCP into Claude Desktop, vertical = SRE). Two prizes from one demo — and the architecture stays clean because Hyperspell handles humans/conversations and Nia handles code, the same complementary split `SPONSORS.md` argues for at line 600.

### Decision-tree if circumstances change

- **If Hyperspell elevated key not provisioned by H1:** Drop the Hyperspell layer entirely, ship OnCallScribe pure for Track 2 (still Final 4.79). The Hyperspell-bonus is upside, not core; designing for graceful degradation here is the whole point. Don't argue with Conor/Manu — just build the better Track-2 version.
- **If Reacher MCP at `api.reacherapp.com/mcp` is flaky:** Don't pivot — you're not on Track 3. (If you *were*, pivot from GhostScout to a Reacher-mock variant with the same UI but synthetic data, framing it as "what we'd ship on Reacher's GA API.")
- **If first-ingest of real Slack runs >20 minutes at H4:** Drop live OAuth ingest, fall back to a pre-uploaded Slack export from the night before — narrate the Connect flow with a screenshot per `SPONSORS.md` "do NOT do live OAuth on stage" rule (line 592). The reinforcement demo still works against the warm index.
- **If only 8 hours of build time available (not 12):** Drop to **DocsThatTalkBack** (the lazy-mode backup) and use the saved 4 hours on validation receipts (3 user interviews at the venue per Gary Chan's playbook) and a tight 90-second pitch rehearsal. An 8-hour rushed Triage will lose to a 4-hour polished DocsThatTalkBack on Demo points.

### What I learned reading 12 candidate ideas

Three patterns. **First**, every Phase-1 idea is a "paste a thing → agent writes a thing" loop, which is correct because that's what 2026 agent demos *are* — but it means the differentiation is entirely in the failure modes, not the happy path. The ideas that win in Phase 2 (OnCallScribe, ShiftLeft, GhostScout) all have *deliberately graceful degradation*; the ones that lose (Lighthouse, Atlas, GreenLight) all need their full pipeline to fire to be impressive. **Second**, the candidate set is heavily skewed toward B2B-internal tools (10 of 12) — only PolicyPilot has a consumer-facing wedge, and even it's prosumer. The strategist missed that a consumer demo (e.g., a personal medical-bill auditor, a renter's-rights agent) would have differentiated visually in a room of 30+ enterprise demos. **Third**, *nobody proposed an Aside or Devin-centric idea*, which is correct given the devil's-advocate audit — both are demo-breakers — but it confirms the participant's actual sponsor universe is narrower than the 11-sponsor brief suggests: it's effectively Nia + Hyperspell + Vercel + InsForge + Tensorlake + Reacher-MCP, with Convex/Codex as utility layers. **Fourth and most important meta-observation:** the highest-EV play across the entire candidate set is the same play `SPONSORS.md` arrived at independently — *combine Nia (code/docs) + Hyperspell (humans/conversations) on a vertical that has personal pain for Conor/Arlan/the room.* Triage is that play executed with the right input surface (paste a Sentry URL — not a webhook, not a brief, not an OAuth flow). Build it.
