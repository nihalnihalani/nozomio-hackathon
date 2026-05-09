# HUMAN_TODO — Triage Hackathon Final Push

**State:** Deployed at https://nozomio-hackathon-dun.vercel.app · 35/35 tests · ≥10 Convex runs · replay mode hardened · Convex + Hyperspell MCPs live. MVP is in the bag — only human-physical work remains.

**Deadline:** Submission **6:00 PM today (2026-05-09)** · in-person judging starts **6:10 PM**.

---

## 1. CRITICAL — do these first (≤30 min)

- [ ] **Fill submission form:** https://forms.gle/fkoFXRo3L2MVkkz87 — needs deployed URL (`https://nozomio-hackathon-dun.vercel.app`), GitHub URL, team names + emails. Submit before 6:00 PM, screenshot the timestamped confirmation.
- [ ] **Verify live URL from a phone over hotspot:** open `https://nozomio-hackathon-dun.vercel.app` on a phone tethered to the demo hotspot — paste a stack trace, confirm cited triage in <30s. This is signal #1 of production-readiness per PLAN.md §10.
- [ ] **Make repo public if it isn't:** `gh repo edit --visibility public` then visit the repo URL in a logged-out browser to confirm.

## 2. Demo prep (≤60 min)

- [ ] **3× full 90-second rehearsals out loud** — script at `/Users/alhinai/nozomio-hackathon/PLAN.md` lines 488–518. Time each run with a stopwatch; cut to 1:30 flat.
- [ ] **Record Loom backup** — one clean 90-second perfect run. Export as `/Users/alhinai/nozomio-hackathon/LOOM.mov` and embed link in `/Users/alhinai/nozomio-hackathon/README.md`.
- [ ] **Print 1 QR code PNG** pointing at `https://nozomio-hackathon-dun.vercel.app` — make it large (≥4in square), place at booth, scan-test with two phones before judging.
- [ ] **Print `/Users/alhinai/nozomio-hackathon/docs/architecture.png`** as a fallback slide — A4 colour, bring to booth.

## 3. On-site sponsor walks — Person 3 lane (≤30 min, OPTIONAL but high-EV)

- [ ] **2–3 SRE / founder on-site interviews** — get a photo + quote ("would you pay $X/mo for this?"). Slot best quote into closing line of script (replaces the Sarah line in PLAN.md §10 line 515).
- [ ] **8-second on-camera "I'd use this" clip from Conor or Manu at the Hyperspell booth** — vertical phone video, save as `/Users/alhinai/nozomio-hackathon/docs/hyperspell-endorsement.mov`.
- [ ] **Booth conversations to confirm prize-track eligibility** — walk the four sponsor booths (Hyperspell, Nia, Convex, InsForge) per the PLAN.md §9 ask list; confirm we're entered for each track.

## 4. Stage prep — last 10 min before slot (verbatim from PLAN.md §10)

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

## 5. Recovery playbook if demo dies on stage (verbatim from PLAN.md §10)

Per Gary Chan's playbook — composure beats apology:

> Person 3: "Live agents on free-tier APIs at hour 5 — exactly the bug we built this for. Let me show you the last 6 successful runs."
> Person 2 switches to Loom backup (Tab 3); plays at 1.25× while Person 3 narrates over it.
> Person 1 silently reboots in the background.
> Land the close on architecture slide + Sarah quote.
> If 20s left: try live again. *Recovery in front of judges scores higher than a clean first run.*

---

## What's already in the bag — don't worry about these

- **Code:** 35/35 tests passing, build clean, deployed to `https://nozomio-hackathon-dun.vercel.app`, both MCPs (Convex + Hyperspell) connected, Convex shows ≥10 `triageRuns`.
- **Docs:** `/Users/alhinai/nozomio-hackathon/README.md` and `/Users/alhinai/nozomio-hackathon/AGENTS.md` are current.
- **Skills:** 8 installed (6 Convex + hyperspell + setup-hyperspell).
- **Wow moment verified end-to-end on production:** Trace A 2.5s → Trace B 1.4s, `mem_slk_dm_feb18_retry_budget` surfaces with `fromTriageHistory:true`.
