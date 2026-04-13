---
name: worker-base
description: Standard startup and cleanup procedures for all mission workers
triggers:
  - model
---

# Worker Base Procedures

This skill defines the startup and cleanup procedures that ALL mission workers must follow. After completing startup, invoke your assigned worker skill for the actual work procedure.

## CRITICAL: `.mission/` must remain intact
NEVER rename, delete, or modify the `.mission/` directory structure. This directory contains mission state that the system depends on. Corrupting it will break the mission.

**You MAY read and update:**
- `.mission/library/` — Add knowledge for future workers
- `services.yaml` — Add new services/commands if discovered during work

**You MUST NOT modify these files — only the Orchestrator updates them:**
- `.mission/state.json` — Mission state machine
- `.mission/features.json` — Feature statuses (do NOT set your own feature to "done" or "completed" — the Orchestrator does this after reviewing your HANDOFF)
- `.mission/progress-log.jsonl` — Event log
- `.mission/validation-state.json` — Assertion statuses

## Phase 1: Startup

### 1.1 Read Context (PARALLELIZE)
Read these files to understand the mission state:
- `.mission/mission.md` — The mission plan
- `AGENTS.md` — **Includes Mission Boundaries that you must NEVER violate**
- `.mission/features.json` — Feature list (check your feature and its milestone context)
- Your feature's `fulfills` assertions from `.mission/validation-contract.md`
- `services.yaml` — Commands and services (test, typecheck, lint, service start/stop)
- `git log --oneline -20` — Recent commit history

Also check:
- `.mission/library/architecture.md` — System architecture
- `.mission/library/` — Other knowledge base files from previous workers

### 1.2 Understand Your Feature's Context
View all features in your milestone to understand the broader context:
```bash
jq --arg m "YOUR_MILESTONE" '.features | map(select(.milestone == $m)) | map({id, description, status})' .mission/features.json
```

### 1.3 Initialize Environment
Run `init.sh` if it exists (one-time setup, idempotent):
```bash
if [ -f init.sh ]; then bash init.sh; fi
```

### 1.4 Baseline Validation
Run the test suite from `services.yaml` to verify the codebase is healthy before you start:
```bash
# Use the commands from services.yaml
# e.g., pytest tests/ -v
```

**CRITICAL: Do NOT pipe test output through `| tail` or `| head`.** Pipes mask exit codes.

If baseline fails → output a HANDOFF with `successState: "failure"` and explain the broken baseline.

### 1.5 Online Research (Conditional)
If your feature involves a technology, SDK, or integration where you're not confident about the correct idiomatic patterns — and `.mission/library/` doesn't already cover it — do a quick online lookup to verify the correct usage before implementing.

### 1.6 Start Services
If your work requires running services, start them using `services.yaml` commands. Check `depends_on` and start dependencies first. Verify health checks pass before proceeding.

### 1.7 Service Management via `services.yaml`
`services.yaml` is the **single source of truth** for all commands and services. If you discover a new service or command that future workers will need, ADD it to `services.yaml`:
- **Services** require: `start`, `stop`, `healthcheck` (port hardcoded in all three), `port`, `depends_on`
- **Commands** require: the command string
- Check that no existing service/command uses the same name or port
- Only additive changes — never overwrite existing entries

## Phase 2: Work

Invoke the skill specified in your feature's `skillName` field.

If the skill does not exist → output a HANDOFF with `successState: "failure"`, `returnToOrchestrator: true`, and explain.

### Code Quality Principles
- **Create reusable components** — Don't duplicate code; extract and reuse
- **Keep changes focused** — Don't sprawl across unrelated areas
- **Stay in scope** — Clearly unrelated issues (e.g., flaky tests for other features, non-trivial bugs in unrelated code) should be noted in `discoveredIssues` with severity `non_blocking` and a description prefixed with "Pre-existing:" but don't go off-track to fix them. Check `AGENTS.md` for "Known Pre-Existing Issues" to avoid re-reporting.

## Phase 3: Cleanup & Handoff

### 3.1 Final Validation
Run the full test suite. All tests must pass. Fix any failures your work introduced.

### 3.2 Environment Cleanup
- Stop all services you started using their `stop` commands from `services.yaml`
- Stop any other processes YOU started (by PID, not by name)
- Ensure clean git status: commit or stash changes

### 3.3 Commit
```bash
git add -A && git commit -m "feat: {brief description of what was implemented}"
```

### 3.4 Skill Feedback (help improve future workers)

Before outputting the HANDOFF, reflect on whether you followed your skill's procedure:
- **Did you follow the procedure as written?** If yes, set `followedProcedure: true` and leave `deviations` empty.
- **Did you deviate?** If you did something differently than the skill instructed, record it:
  - `step`: Which step (e.g., "1.3 Baseline Validation", "Run tests before commit")
  - `whatIDidInstead`: What you actually did
  - `why`: Why you deviated (skill was unclear, found a better approach, blocked by environment, etc.)
This feedback helps the orchestrator improve skills for future milestones. Be honest — deviations aren't failures, they're data.

### 3.5 When to Return to Orchestrator

Set `returnToOrchestrator: true` when ANY of these apply:
- **Cannot complete work within mission boundaries** — if the feature requires violating boundaries (port range, off-limits resources), return immediately. NEVER violate boundaries.
- **Service won't start or healthcheck fails** — manifest may be broken or external dependency missing
- **Dependency or service that SHOULD exist is inaccessible** — if something that was working before (database, API, external service, file, etc.) is no longer accessible and you cannot figure out how to restore it after investigation, return immediately. Do not spin endlessly trying to fix infrastructure issues you can't resolve.
- **Blocked by missing dependency, unsatisfied preconditions, or unclear requirements**
- **Previous worker left broken state you can't fix**
- **Decision or input needed from human/orchestrator**
- **Your skill type requires it** (e.g., scrutiny skill always returns to orchestrator)

**IMPORTANT:** Do NOT declare `successState: "success"` if you worked around a problem rather than solving it. If you had to skip, stub, or disable something to make tests pass, that is `returnToOrchestrator: true` with `successState: "failure"` and a clear explanation.

### 3.6 Pre-HANDOFF Self-Check (MANDATORY)

Before writing HANDOFF_START, answer each question honestly. If any answer is "yes", update the relevant HANDOFF field.

1. **Did you verify every assertion in your feature's `fulfills` list?**
   → If any assertion was NOT verified: `successState: "failure"`, `returnToOrchestrator: true`

2. **Did you modify files outside your feature's described scope?**
   → If yes: record in `discoveredIssues` what you changed and why

3. **Did you encounter bugs or issues unrelated to your feature?**
   → If yes: `discoveredIssues` with `severity: "non_blocking"`, description prefixed "Pre-existing:"

4. **Did you skip any verification steps?** (port unavailable, missing dependency, etc.)
   → If yes: `whatWasLeftUndone` must be non-empty with details; `validatorsPassed: false`

5. **Did you modify shared infrastructure** (ports, configs, services, networks)?
   → If yes: `discoveredIssues` describing impact scope

6. **Is `discoveredIssues` non-empty?**
   → If yes: set `returnToOrchestrator: true` so orchestrator can triage

**"Fixing something quietly and not reporting it" = broken audit trail. This is worse than not fixing it.**

### 3.7 Output HANDOFF

**You MUST output this JSON block as the last thing in your response:**

```json
HANDOFF_START
{
  "featureId": "{your feature ID}",
  "successState": "success | failure",
  "returnToOrchestrator": false,
  "commitId": "{git commit hash}",
  "validatorsPassed": true,
  "salientSummary": "1-4 sentences describing what you did and verified",
  "whatWasImplemented": "Detailed description of implementation",
  "whatWasLeftUndone": "",
  "discoveredIssues": [
    { "severity": "blocking | non_blocking", "description": "...", "suggestedFix": "..." }
  ],
  "verification": {
    "commandsRun": [
      { "command": "cargo test", "exitCode": 0, "observation": "All 42 tests pass" }
    ],
    "interactiveChecks": [
      { "action": "curl -sk https://localhost:8443/api/v1", "observed": "200 OK, JSON response with expected fields" }
    ]
  },
  "testsAdded": [
    { "file": "tests/test_feature.py", "count": 5 }
  ],
  "skillFeedback": {
    "followedProcedure": true,
    "deviations": [],
    "suggestedChanges": []
  }
}
HANDOFF_END
```

### Rules for HANDOFF:
- `salientSummary` must be 1-4 sentences, concrete and specific
- `successState` must be `"success"` or `"failure"`
- `returnToOrchestrator` — set `true` if you need orchestrator help (see 3.5 above); `false` if work is definitively done or definitively failed with no recourse
- `commitId` is required if successState is success
- `validatorsPassed` — must be `true` if successState is success; if tests fail, this must be `false`
- `discoveredIssues` — report anything you found that needs attention; prefix out-of-scope issues with "Pre-existing:"
- `skillFeedback` — honest self-reflection on procedure adherence (see 3.4)
- `interactiveChecks` — manual/interactive verifications (curl requests, UI checks); complements `commandsRun`
- The HANDOFF_START and HANDOFF_END markers are required for parsing

#### Verification Hygiene
When running validators or tests during your work:
- **Do NOT pipe output through `| tail`, `| head`, or similar** — pipes mask the real exit code. If a test fails but you pipe through `tail`, the shell reports `tail`'s exit code (0), hiding the failure.
- **Prefer narrower test selection over output truncation.** If output is too noisy, run a more targeted test pattern (e.g., `cargo test -- specific_test`) instead of piping through `head`/`tail`.

**CRITICAL: After outputting the HANDOFF, you MUST end your turn immediately. Do not continue with additional work, do not start another feature, do not make any further tool calls. Your session is complete once you output the HANDOFF.**
