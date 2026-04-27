# Cowork PM — Scheduling & Routing Brief

This is the operational layer above the 5 build agents. Source: PRD §2.1.

The Cowork PM (Kirk acting as orchestrator, plus the Cowork scheduled-tasks system) configures these recurring jobs and routing rules. None of the 5 build agents own this — it's project-management glue.

---

## Recurring scheduled jobs

| Cadence | Job | Why |
|---|---|---|
| Every 2 min | Health check — MRMS ingestion Lambda | Pipeline is the heart; alarm if it stalls |
| Every 15 min | Alert if no new swath data for any active storm | Catch silent ingestion failure during real weather |
| Daily 8am CT | Status digest email — what each agent shipped, what's blocked | Kirk's morning scan |
| Daily 11pm CT | Pre-generate Hail Impact Reports for monitored addresses hit in last 24h | Ready by morning canvass |
| Weekly Mon 7am | Generate sprint plan; assign tickets across 5 agents | Set the week before agents start |
| Weekly Fri 5pm | Retrospective + metrics dashboard refresh | Catch drift from the PRD |

These are best implemented via Cowork's scheduled-tasks system once accounts are wired. For now they're documented intent.

---

## Slack / email routing

| Channel | Purpose |
|---|---|
| `#agent-alerts` | Failed jobs, agent blockers — ops-level |
| `#deploys` | All agent PRs merged, all production deploys |
| Kirk's email | Daily digest only, weekly retro — no per-event spam |

---

## Activating these jobs

Until Cowork's scheduled-tasks system is connected to the project, run these manually:

- **Daily digest:** ask Cowork "what did each agent ship and what's blocked?" each morning.
- **Health check:** wire CloudWatch alarms (already in `hailscout-data-pipeline/infra/cloudwatch-alarm.yaml` and `hailscout-tiles/infra/`) to PagerDuty or email.
- **Sprint planning:** pull from this repo's GitHub Issues/Projects board on Monday.
- **Retrospective:** Friday evening, ask Cowork "compare what shipped this week against the PRD §2 acceptance criteria."

Once Slack and the calendar tools are connected to Cowork, replace the manual cadence with `mcp__scheduled-tasks__create_scheduled_task` calls.
