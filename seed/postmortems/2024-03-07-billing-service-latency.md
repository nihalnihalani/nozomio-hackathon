# Postmortem: Billing-Service p95 Latency Spike

> **SYNTHETIC DATA — fictional company "Acme Billing." No real PII.**

- **Date:** 2024-03-07
- **Authors:** Ben Park (on-call), Sara Chen (eng-lead delegate)
- **Status:** Resolved
- **Severity:** SEV-3
- **Customer impact:** Slow API responses for ~2h 34min; no failed transactions

## Summary

On 2024-03-07 from 09:14 to 11:48 UTC, the billing-service p95 latency exceeded our 800ms SLO, peaking at 2.3s. Investigation found that the analytics workload sharing our RDS instance had been promoted to a heavier query mix earlier that morning by the data team, saturating the connection pool. We failed over reads to the replica, restored latency to baseline, and filed a long-term ticket to split the analytics database off shared infrastructure entirely.

This incident is **unrelated to webhook handling, charges, or Stripe**. Documented here for completeness.

## Timeline (UTC)

| Time | Event |
| --- | --- |
| 09:14 | Datadog alarm: billing-service p95 > 800ms for 5 min |
| 09:15 | Ben acks |
| 09:23 | RDS connection pool sitting at 98/100 — saturation confirmed |
| 09:31 | Sara joins; identifies analytics workload spike from a one-off backfill job |
| 09:42 | Reads failed over to replica via connection-string flip |
| 10:08 | Latency drops to baseline (~140ms p95) |
| 11:48 | Holds for 90 min; incident marked resolved |

## Root cause

The analytics team kicked off a multi-table backfill at 09:02 UTC against the shared RDS box. The job's parallelism setting was 32, vs the 8 we'd informally agreed on. With 32 long-running analytical queries each holding a connection, our application pool was starved.

This is a known-class problem ("noisy neighbor on shared DB"). We have an open ticket from Q4 2023 to split the analytics workload off entirely; it has not been prioritized.

## Impact

- **API consumers affected:** All
- **Failed transactions:** 0
- **Slow responses:** ~12% of requests during the window saw >2s latency
- **No customer escalations** (slow but not broken)

## Action items

| # | Item | Owner | Status |
| --- | --- | --- | --- |
| AI-1 | Move analytics workload to its own RDS instance | Sara | OPEN — escalated to Q2 priorities |
| AI-2 | Add per-app connection-pool quota at the proxy layer | Ben | OPEN |
| AI-3 | Coordinate analytics backfill schedule via #data-eng before kicking off | (data team) | DONE — runbook updated |

## Lessons

1. Shared infrastructure between OLTP and OLAP workloads is a latent SLO risk. The right fix is to stop sharing.
2. Failover to read replicas is a useful immediate mitigation but does not help workloads that need primary writes.
