<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

# Triage — agent guidance

This file is the entry point for any AI agent (Claude Code, Codex, Cursor,
Copilot, Cline) working in this repo. Read it first; then `CLAUDE.md` for
the deeper rules.

## Project state (as of 2026-05-09)

- **MVP:** complete and merged on `main` (PR #1)
- **Convex integration:** complete (Phases A + C + B all shipped)
- **Production:** live at https://nozomio-hackathon-dun.vercel.app
- **Tests:** 35 vitest pass, 6 invariant gates green, build clean
- **Demo mode:** `DEMO_MODE=replay` is the default — no API keys needed
  to run the canonical Trace A / Trace B flow

## The 4 invariants (hard reject in review if violated)

1. **Cite-or-die** — every claim cites a real Slack/Notion/Gmail memory
   or `file:line`. No fabrication, ever.
2. **Reinforcement** — only `convex/reinforceNode.ts` writes
   `triage_history` memories. Anywhere else is a hard reject.
3. **Hot/cold split** — Convex tables are ephemeral hot path; InsForge
   is durable cold path. Mirror is one-way (Convex → InsForge).
4. **Hermetic replay mode** — every outbound call has a
   `DEMO_MODE=replay` branch. Missing keys must force replay, never throw.

Test files in `tests/invariants/` enforce all 4. Run
`npm run check:invariants` before claiming work is done.

## Where the code lives

- `app/api/triage/route.ts` — POST endpoint, runs `lib/agent/loop`,
  streams SSE, mirror-writes to Convex
- `lib/agent/loop.ts` — the agent runtime (replay + live branches)
- `lib/hyperspell/client.ts`, `lib/nia/client.ts` — sponsor clients
  with replay logic
- `convex/{schema,triage,reinforce,tools}.ts` — V8-runtime parts
- `convex/{triageNode,reinforceNode,toolsNode}.ts` — Node-runtime
  agent actions (separate files because `"use node"` files can only
  contain actions, not mutations/queries)
- `convex/observability.ts` — module-scope OTel provider that exports
  AI SDK `gen_ai` spans to PostHog LLM Analytics; no-op without
  `POSTHOG_API_KEY`. Imported for side effects from `convex/triageNode.ts`.
- `lib/hooks/useTriage.ts` — frontend hook; uses `useQuery` against
  Convex when `NEXT_PUBLIC_CONVEX_URL` is set, falls back to SSE otherwise

## MCP servers available

- **convex** — schema introspection, deployment data, function metadata
- **hyperspell** — read-only access to memories (search, get_memory, user_info)

Both registered in `~/.claude.json` (local scope). See
`.claude/settings.local.example.json` for the canonical config to copy.

## Skills available (under `.agents/skills/`)

- **convex** (6 skills): `convex`, `convex-quickstart`,
  `convex-setup-auth`, `convex-create-component`,
  `convex-migration-helper`, `convex-performance-audit`
- **hyperspell** (2 skills): `hyperspell` (project-specific quickstart),
  `setup-hyperspell` (official skills.sh setup guide)

`/convex-quickstart`, `/convex-setup-auth`, etc. are invocable as
slash commands in Claude Code.

## Things to NOT do

- **Don't run `/setup-hyperspell` against this repo** — it's intended for
  fresh codebases and may clobber the existing `lib/hyperspell/client.ts`
  with its replay logic.
- **Don't write `triage_history` memories outside `convex/reinforceNode.ts`** —
  Invariant 2 hard reject.
- **Don't bypass the cite-or-die verifier** — `verifyCodeSnippet` in
  `lib/nia/client.ts` re-reads `seed/billing-service/{file}` to confirm
  the line exists. Don't disable.
- **Don't move the agent runtime into Convex** without solving the
  `seed/` and `data/replay/` bundling problem — Convex's sandbox
  doesn't have those files. The current architecture (agent in Next.js,
  UI subscribes to Convex) sidesteps this.

## See also

- `README.md` — what this project is, how to run it, demo URL
- `CLAUDE.md` — full project rules, code style, what triggers Codex
- `PLAN.md` — the 5-hour build plan and demo script
- `IDEAS.md` — the 9-agent squad output that produced Triage
- `.agents/skills/hyperspell/SKILL.md` — Hyperspell quickstart with
  the MCP gotchas (the `--tools` arg bug, the `-p` flag for npx)
