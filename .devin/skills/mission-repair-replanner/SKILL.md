---
name: mission-repair-replanner
description: Mid-execution repair replanning for important scrutiny findings — rewrite shared state and top-priority fix features without restarting initial planning
triggers:
  - model
---

# Mission Repair Replanner

This skill is the dedicated entrypoint for **mid-execution repair replanning**.

Use it only when scrutiny synthesis reports `importantIssues` or `repairPlanningRequired: true`.

This is **not** a fresh interactive planning phase. Do not restart the six-phase approval flow unless the repair changes approved scope or user-visible behavior. Your job here is to repair the task list itself so the fix becomes explicit, auditable, and highest priority.

## Required Inputs

Read all of these before making changes:

1. `.mission/validation/{milestone}/scrutiny/synthesis.json`
2. the failing review reports in `.mission/validation/{milestone}/scrutiny/reviews/`
3. the affected feature definitions in `.mission/features.json`
4. any implicated shared state (`validation-contract.md`, `AGENTS.md`, `.mission/library/`, worker skills)

## Repair Replan Procedure

1. Decide what is actually wrong:
   - Is the bug just code?
   - Or did the mission decompose the work incorrectly, omit a contract assertion, miss guidance, or sequence the work badly?
2. Fix the shared-state root cause first when needed:
   - Update the validation contract if the issue exposes a missing or underspecified expectation
   - Update `AGENTS.md` / worker skills if missing guidance caused the defect
   - Update library documents for factual knowledge that should prevent repeat mistakes
3. Rewrite the task list through the mission CLI:
   - Use `mission feature create --position top` to add one or more `fix-...` features
   - Use `mission feature edit` to adjust descriptions, `fulfills`, milestones, or preconditions when the current task list is wrong
   - Split large repairs into multiple `fix-...` features when different root causes or worker types are involved
4. Enforce highest priority:
   - Every replanner-authored `fix-...` feature must sit at the TOP of `features.json`
   - No unrelated pending feature may remain ahead of these repairs
   - If multiple repair features are needed, order them explicitly and connect them with preconditions
5. Keep important scrutiny repairs visible:
   - Do **not** hide them in `misc-*`
   - Keep them in the failing milestone unless the repair genuinely requires a dedicated follow-up milestone
   - The milestone stays open until these fix features complete and scrutiny re-runs cleanly
6. Commit the repair-plan update as its own planning change, then hand control back to the orchestrator

## Outputs of a Good Repair Replan

- A clear set of top-priority `fix-...` features tied to specific scrutiny findings
- Any shared-state updates needed to prevent the same class of defect from recurring
- A task list whose ordering now reflects the real urgency of the issue
