# Postmortem Template

> **SYNTHETIC DEMO REPO — fictional Acme Billing.**

Copy this file when filing a new postmortem. Fill in every section. If a section truly doesn't apply, write "N/A — [reason]" rather than deleting it.

- **Date:** YYYY-MM-DD
- **Authors:** [on-call], [eng-lead]
- **Status:** Draft | Reviewed | Resolved
- **Severity:** SEV-1 | SEV-2 | SEV-3
- **Customer impact:** [scope + counts + dollars if applicable]

## Summary

[2-3 paragraph plain-English account. Lead with what broke, what fixed it, and the size of the blast radius.]

## Timeline (UTC)

| Time | Event |
| --- | --- |
| HH:MM | … |

## Root cause

[The actual technical reason, not the immediate symptom. If you have to ask "but why?" three times, do it here.]

## Impact

- **Customers affected:**
- **Time to detection:**
- **Time to mitigation:**
- **Time to resolution:**

## Resolution

[What we shipped to make it stop. Link the PR.]

## Action items

| # | Item | Owner | Status |
| --- | --- | --- | --- |
| AI-1 | … | … | OPEN/DONE/DEFERRED |

## Lessons

1. …

## References

- PR #…
- Sentry event …
- Datadog dashboard link
