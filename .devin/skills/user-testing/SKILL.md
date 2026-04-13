---
name: user-testing
description: Validate a milestone by testing through the real user surface, writing per-group flow reports directly, and synthesizing results
triggers:
  - model
---

# User Testing Validator

You validate a milestone by testing the application through its **real user surface** — the same interface an actual user would interact with. You handle setup, determine what needs testing, execute grouped flows directly inside this validator session, and synthesize results.

Use the `todo_write` tool to track your progress through these steps, especially during setup and synthesis.

## Where Things Live

**`.mission/`**:
| File | Purpose | Precedence |
|------|---------|------------|
| `validation-contract.md` | Assertion definitions (what to test) | |
| `validation-state.json` | Assertion pass/fail status | |
| `features.json` | Feature list with `fulfills` mapping | |

**repo root** (cwd):
| File | Purpose | Precedence |
|------|---------|------------|
| `AGENTS.md` (§ Testing & Validation Guidance) | User-provided testing instructions | **Highest — overrides all other sources** |
| `services.yaml` | Service definitions (start/stop/healthcheck) | |
| `.mission/library/user-testing.md` | Discovered testing knowledge (tools, URLs, setup steps, quirks). Read and update as you learn. May not exist yet — create it if needed. | |
| `.mission/validation/<milestone>/user-testing/` | Synthesis and flow reports (output) | |

## 0) Identify Milestone & Check for Prior Runs

Your feature ID follows the pattern `user-testing-validator-<milestone>`. Extract the milestone name.

```bash
MILESTONE="..."
SYNTHESIS_FILE=".mission/validation/$MILESTONE/user-testing/synthesis.json"
if [ -f "$SYNTHESIS_FILE" ]; then
  cat "$SYNTHESIS_FILE"
fi
```

If it exists → this is a **re-run after fixes**. You'll only test failed/blocked assertions.

## 1) Determine Testable Assertions

### First run (no prior synthesis)

Collect assertions from features' `fulfills` field:

```bash
jq --arg m "$MILESTONE" '
  .features
  | map(select(.milestone == $m and .status == "completed"))
  | map(select(.skillName // "" | test("^scrutiny-|^user-testing-") | not))
  | map(.fulfills // [])
  | flatten
  | unique
' .mission/features.json
```

Cross-reference with `.mission/validation-state.json`: only include assertions that are currently `"pending"`.

### Re-run (prior synthesis exists)

Collect assertions to test from TWO sources:

1. **Failed/blocked from prior synthesis:**
   - Extract `failedAssertions` and `blockedAssertions` from the prior synthesis

2. **New assertions from fix features:**
   - Check features completed AFTER the prior synthesis
   - Collect their `fulfills` for any NEW assertion IDs not yet `"passed"` in `validation-state.json`

Test the **union** of both sets. If the union is empty (e.g., prior round didn't test anything because setup consumed the session), treat this as a first run.

## 2) Setup (Start Services, Seed Data)

Read **all** files listed in "Where Things Live" above.

Start all services needed for testing:
- Check `depends_on` and start dependencies first
- Run each service's `start` command
- Wait for `healthcheck` to pass

Seed any test data needed per `user-testing.md` and `AGENTS.md`.

**Testing tools:** Each assertion in the validation contract specifies its tool explicitly (e.g., `curl`, browser automation, CLI). Use the tool specified.

## 3) Execute Flow Groups Directly

Do **NOT** spawn subagents from within this validator. In Devin, only the root agent can spawn subagents, so user-testing must execute each grouped flow itself and write the same flow reports directly.

This section is the **authoritative flow-execution procedure**. It is intentionally fully self-contained so the validator does not need to consult any second skill while executing grouped flows.

Create the flow report directory first:

```bash
mkdir -p .mission/validation/${MILESTONE}/user-testing/flows
```

Group assertions by testing surface/tool and assign isolation contexts. For each group:

1. Read each assigned assertion from `.mission/validation-contract.md`
2. Read `AGENTS.md` again and follow `## Testing & Validation Guidance` if present — it has highest precedence
3. Read `.mission/library/user-testing.md` again if it contains flow-specific isolation rules, setup notes, or concurrency limits for the current surface
4. Stay within the group's isolation context. Use only the resources assigned to the group; do not create extra accounts, touch other data partitions, or use resources outside the boundary
5. Handle setup issues conservatively:
   - You may try **non-disruptive fixes only** (retry a request, reload a page, re-run a command, verify credentials, wait briefly for a service to come up)
   - If non-disruptive fixes do not work, mark affected assertions `blocked` with details and continue
   - Do **NOT** restart shared services or modify shared infrastructure as part of validation
6. For each assigned assertion, understand:
   - the behavioral description
   - the pass/fail criteria
   - the required evidence
7. Test each assertion through the **real user surface** using the tool specified by the assertion:
   - **API / curl**: make real requests and record method, URL, status code, and response body
   - **CLI / shell**: run the real command, capture full output, and verify exit code and expected output
   - **Web UI / browser automation**: take screenshots at key points, check for visible errors, and note relevant network requests or console errors
   - If the assertion specifies a different tool, use that tool instead
8. After each assertion, record any unexpected delays, undocumented workarounds, or setup surprises as **frictions**
9. Use these status meanings consistently:
   - **pass**: behavior confirmed working as specified
   - **fail**: behavior does not match the specification
   - **blocked**: cannot be tested because a prerequisite is broken or unavailable
   - **skipped**: only if `AGENTS.md` or Testing & Validation Guidance explicitly says to skip it
10. Create the flow report path:
   ```text
   .mission/validation/{milestone}/user-testing/flows/{group-id}.json
   ```
11. Create the evidence directory:
   ```text
   .mission/evidence/{milestone}/{group-id}/
   ```
12. Evidence requirements:
   - save all evidence files under `.mission/evidence/{milestone}/{group-id}/`
   - use descriptive filenames such as `VAL-XXX-001-response.txt`
   - for API/CLI assertions, include command output
   - for UI assertions, include screenshots when browser tooling is available
   - capture unexpected errors or logs when relevant
13. Resource management:
   - reuse sessions across assertions where practical
   - close sessions before writing the report
   - process groups sequentially in this validator session to avoid nested fan-out
14. Stay in scope:
   - test only the assigned assertions for the current group
   - do not fix code
   - if you discover unrelated issues, note them in `frictions` or `blockers` without deeper investigation

Write one flow report per group using the schema below:

```json
{
  "groupId": "{group-id}",
  "testedAt": "{ISO timestamp}",
  "isolation": {
    "credentials": "...",
    "url": "...",
    "port": 8443
  },
  "toolsUsed": ["curl", "shell"],
  "assertions": [
    {
      "id": "VAL-XXX-001",
      "title": "Assertion title from contract",
      "status": "pass",
      "steps": [
        { "action": "curl -sk https://localhost:8443/api/v1/resource", "expected": "200 OK with JSON array", "observed": "200 OK, returned 5 items" }
      ],
      "evidence": {
        "commands": "curl -sk -u root:calvin https://localhost:8443/api/v1/resource -> 200",
        "output": "path/to/evidence/file or inline"
      },
      "issues": null
    },
    {
      "id": "VAL-XXX-002",
      "title": "...",
      "status": "fail",
      "steps": [
        { "action": "POST /api/v1/action", "expected": "200 OK with action result", "observed": "405 Method Not Allowed" }
      ],
      "evidence": {
        "commands": "curl -sk -X POST ... -> 405",
        "output": "path/to/evidence/file"
      },
      "issues": "Expected 200 OK but got 405 — endpoint does not support POST"
    },
    {
      "id": "VAL-XXX-003",
      "title": "...",
      "status": "blocked",
      "steps": [],
      "evidence": {},
      "issues": "Service on port 8443 not responding after 3 retries"
    }
  ],
  "frictions": [
    {
      "description": "init.sh doesn't create .venv — had to run manually before tests worked",
      "resolved": true,
      "resolution": "Ran python3 -m venv .venv && source .venv/bin/activate",
      "affectedAssertions": ["VAL-XXX-001", "VAL-XXX-002"]
    }
  ],
  "blockers": [
    {
      "description": "API server returned 502 on all routes — backend appears crashed",
      "affectedAssertions": ["VAL-XXX-003"],
      "quickFixAttempted": "Retried requests 3 times over 30s, still 502"
    }
  ],
  "summary": "Tested 3 assertions: 1 passed, 1 failed (VAL-XXX-002: 405 error), 1 blocked (service down)"
}
```

Process groups **sequentially** inside this validator. If the mission later needs validation fan-out, the root orchestrator must own that fan-out directly rather than relying on nested validator subagents.

Use the `todo_write` tool to track progress group-by-group while you test and write reports.

## 4) Synthesize Results

Read all flow reports from `.mission/validation/{milestone}/user-testing/flows/` that you wrote in Step 3.

For each assertion, update `.mission/validation-state.json` using the `mission` CLI:
- `pass` → set status to `"passed"` with evidence and milestone
- `fail` → set status to `"failed"` with issue source and reason
- `blocked` → set status to `"failed"` with blocking reason (blocked = failed)

**Concrete update procedure — one CLI call per assertion:**

For each **passed** assertion:
```bash
mission validation update \
  --assertion VAL-XXX-001 \
  --status passed \
  --evidence "Description of what was verified and how" \
  --milestone MILESTONE_NAME
```

For each **failed** assertion:
```bash
mission validation update \
  --assertion VAL-XXX-002 \
  --status failed \
  --milestone MILESTONE_NAME \
  --issue-source feature-id \
  --issue-reason "Expected 200 OK but got 404 — endpoint not implemented"
```

For each **blocked** assertion (treated as failed):
```bash
mission validation update \
  --assertion VAL-XXX-003 \
  --status failed \
  --milestone MILESTONE_NAME \
  --issue-source blocked \
  --issue-reason "Service on port 8443 not responding after 3 retries"
```

The CLI automatically:
- **Merges** evidence (concatenates new evidence with existing, never replaces)
- **Accumulates** issues (appends to existing issues array, never replaces)
- **Rejects** `passed→pending` transitions (evidence cannot be revoked)
- **Appends** `assertion_updated` events to progress-log.jsonl

**IMPORTANT: The CLI handles merge semantics for you. Each call preserves existing evidence and issues from previous validation rounds.**

**Rule: blocked = failed.** A blocked assertion is NOT acceptable. Record the blocking reason so the orchestrator can create fix features to resolve the root cause.

## 5) Teardown

Stop all services you started. Update `.mission/library/user-testing.md` with any runtime findings (new constraints, gotchas, setup issues resolved).

## 6) Write Synthesis Report

```bash
mkdir -p .mission/validation/${MILESTONE}/user-testing
```

Write to `.mission/validation/${MILESTONE}/user-testing/synthesis.json`:
```json
{
  "milestone": "{milestone}",
  "round": 1,
  "status": "pass|fail",
  "assertionsSummary": {
    "total": 10,
    "passed": 9,
    "failed": 1,
    "blocked": 0
  },
  "failedAssertions": ["VAL-XXX-005"],
  "blockedAssertions": [],
  "appliedUpdates": [
    { "target": "library/user-testing.md", "description": "..." }
  ],
  "previousRound": null
}
```

**Commit the synthesis report together with any library updates (single atomic commit).**

## 7) Return HANDOFF

Always include HANDOFF_START/HANDOFF_END markers. **User testing always returns to orchestrator** — set `returnToOrchestrator: true` regardless of pass/fail.

Include the synthesis file path in `salientSummary`.

```json
HANDOFF_START
{
  "featureId": "{user-testing feature ID}",
  "successState": "success | failure",
  "returnToOrchestrator": true,
  "commitId": "{git commit hash}",
  "validatorsPassed": true,
  "salientSummary": "User testing round N for {milestone}: X/Y assertions passed, Z failed, W blocked. Synthesis: .mission/validation/{milestone}/user-testing/synthesis.json",
  "whatWasImplemented": "Tested assertions through real user surface, wrote synthesis report",
  "whatWasLeftUndone": "",
  "discoveredIssues": [
    { "severity": "blocking", "description": "VAL-XXX-005 failed: ...", "suggestedFix": "..." }
  ],
  "verification": {
    "commandsRun": [
      { "command": "curl ...", "exitCode": 0, "observation": "..." }
    ]
  },
  "testsAdded": [],
  "skillFeedback": {
    "followedProcedure": true,
    "deviations": [],
    "suggestedChanges": []
  }
}
HANDOFF_END
```

- If any assertions failed/blocked: `successState: "failure"`, list each in `discoveredIssues` with assertion ID
- If all passed: `successState: "success"`

**After outputting the HANDOFF, end your turn immediately. Do not continue with additional work.**
