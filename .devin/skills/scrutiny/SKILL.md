---
name: scrutiny
description: Validate a milestone by running validators, reviewing completed features directly, and triaging shared-state observations
triggers:
  - model
---

# Scrutiny Validator

You validate a milestone by running validators, reviewing features directly inside this validator session, and synthesizing results including knowledge-propagation updates.

Use the `todo_write` tool to track your progress through these steps, especially for complex synthesis and triage work.

## Where Things Live

- **`.mission/`**: `mission.md`, `validation-contract.md`, `validation-state.json`, `features.json`, `handoffs/`
- **repo root** (cwd): `AGENTS.md`, `services.yaml`, `.mission/library/`, `.mission/validation/`

## 0) Identify Milestone & Check for Prior Runs

Your feature ID follows the pattern `scrutiny-validator-<milestone>`. Extract the milestone name.

```bash
MILESTONE="..."
SYNTHESIS_FILE=".mission/validation/$MILESTONE/scrutiny/synthesis.json"
if [ -f "$SYNTHESIS_FILE" ]; then
  cat "$SYNTHESIS_FILE"
fi
```

If it exists → this is a **re-run after fixes**. You'll use it to determine what needs re-review.

## 1) Run Validators

**CRITICAL: Do NOT pipe output through `| tail`, `| head`, or similar.** Pipes mask exit codes.

Run the full test suite, typecheck, and lint. Use the project's configured commands.

If any validator fails, attempt simple fixes before giving up:
- **Lint errors**: Run the project's auto-fix command (e.g., `npm run fix`) and re-check.
- **Type errors**: If straightforward (missing imports, simple type mismatches), fix directly and re-check.
- **Test failures**: If the fix is obvious and localized (e.g., a snapshot update, a trivial assertion update), fix and re-check.

If validators still fail after your fix attempt (or the failures are non-trivial):
- Return HANDOFF with `successState: "failure"` and `returnToOrchestrator: true`
- Include failing commands and output in `verification.commandsRun`
- Include failures in `discoveredIssues`
- **Do not proceed to feature review**

## 2) Determine What Needs Review

### First run (no prior synthesis)

Review ALL completed implementation features in this milestone:

```bash
# Filter: same milestone, completed, excluding validator features
jq --arg m "$MILESTONE" '
  .features
  | map(select(.milestone == $m and .status == "completed"))
  | map(select(.skillName // "" | test("^scrutiny-|^user-testing-") | not))
  | map({id, description})
' .mission/features.json
```

### Re-run (prior synthesis exists)

Read the prior synthesis to find what failed:
- Extract `failedFeatures` from the synthesis
- Find which NEW features in this milestone address those failures (features added after the prior synthesis)
- Only review those fix features

**The scrutiny validator must examine BOTH the original failed feature AND the fix feature together.**

## 3) Review Features Directly

Do **NOT** spawn subagents from within this validator. In Devin, only the root agent can spawn subagents, so scrutiny must perform its per-feature reviews itself and write the same review artifacts directly.

This section is the **authoritative feature-review procedure**. It is intentionally fully self-contained so the validator does not need to consult any second skill while reviewing completed features.

Create the review directory first:

```bash
mkdir -p .mission/validation/${MILESTONE}/scrutiny/reviews
```

For each feature selected in Step 2, review it **sequentially** and write one report to:

```text
.mission/validation/{milestone}/scrutiny/reviews/{feature-id}.json
```

For each feature review:

1. Find the feature in `.mission/features.json`
2. Read `.mission/handoffs/{feature-id}.json`
3. Review the feature's diff:
   ```bash
   git show <commitId> --stat
   git show <commitId>
   ```
4. Read the worker skill used by the feature (`.devin/skills/{skillName}/SKILL.md`)
5. Read `.mission/library/architecture.md`, `AGENTS.md`, `services.yaml`, and `.mission/library/` entries needed to identify shared-state gaps
6. On re-runs, also read the prior review and the original failed feature's diff, then determine whether the fix feature adequately addresses the original failure

For each feature, apply this review checklist:

- **Implementation coverage**
  - Does the implementation fully cover the feature's `description` and `expectedBehavior`?
  - Does it satisfy the assertions the feature claims in `fulfills`?
- **Code quality**
  - Are there missed bugs, edge cases, or error states?
  - Are tests adequate, or do they only cover happy paths?
  - Flag issues with concrete `file` + `line` references.
- **Shared state observations**
  - **Convention gaps**: project patterns violated but not documented clearly in `AGENTS.md`
  - **Skill gaps**: worker deviations suggest the skill no longer matches reality
  - **Services/commands gaps**: commands or services used in practice but missing from `services.yaml`
  - **Knowledge gaps**: factual codebase knowledge discovered during implementation that should be captured in `.mission/library/`
- **Fix review expectations**
  - On a re-run, compare the original failed feature, the prior review, and the fix feature together
  - Decide whether the fix actually addresses the original failure, not merely whether the new diff looks reasonable in isolation

Scrutiny is not a place for optional nits. Only record a `codeReview.issue` when the orchestrator must create follow-up repair work for it.

- Use `severity: "blocking"` for a localized defect that should be fixed by a normal top-of-queue `fix-*` feature.
- Use `severity: "important"` when the issue means the task list, validation contract, milestone shape, or worker guidance is wrong enough that the orchestrator must bring in the external planner to rewrite the repair plan before fixing.
- Do **not** emit `non_blocking` code defects. If something is merely informational, capture it as a `sharedStateObservation` or leave it out.

Write each review report using the schema below:

```json
{
  "featureId": "{feature-id}",
  "reviewedAt": "{ISO timestamp}",
  "commitId": "{commit from handoff}",
  "diffReviewed": true,
  "status": "pass|fail",
  "codeReview": {
    "summary": "Human-readable summary of the review",
    "issues": [
      {
        "file": "src/routes/products.ts",
        "line": 42,
        "severity": "blocking|important",
        "description": "Missing input validation on query parameter..."
      }
    ]
  },
  "sharedStateObservations": [
    {
      "area": "conventions|skills|services|knowledge",
      "observation": "Description of the gap observed",
      "evidence": "Specific file:line references or handoff details"
    }
  ],
  "addressesFailureFrom": null,
  "summary": "Human-readable summary of the review"
}
```

Use the `todo_write` tool to track progress feature-by-feature while you review.

## 4) Synthesize and Triage Shared State Observations

Read all review reports from `.mission/validation/{milestone}/scrutiny/reviews/`.

### 4a) Determine pass/fail

- Collect all code review issues, deduplicate, assign severity
- Split them into `blockingIssues` and `importantIssues`
- Set `repairPlanningRequired: true` if ANY important issue means the task list or guidance must be rewritten before fixing
- **All scrutiny code-review issues are fix-required.** If ANY review reported a real issue (blocking OR important): `status: "fail"`
- `status: "pass"` only when every reviewed feature has zero unresolved `codeReview.issues`

### 4b) Triage shared state observations

Collect all `sharedStateObservations` from reviewer reports. Deduplicate across reviews.

For each observation, apply your judgment using these first principles about what belongs where:

- **`library/`**: Factual knowledge about the codebase discovered during work — patterns, quirks, env vars, API conventions. Reference material, not instructions.
- **`AGENTS.md`**: Normative guidance from orchestrator to workers — conventions, boundaries, rules. The orchestrator's voice.
- **Skills** (`.devin/skills/`): Procedural instructions for worker types. Should reflect what actually works, not idealized procedure.

Triage each observation into one of three buckets:

**Apply now** (library updates you're confident about):
- These are factual, low-risk, and within your domain.
- Check if the knowledge is already documented before adding.
- Only additive changes — never overwrite existing entries.

**Recommend to orchestrator** (AGENTS.md and skill changes):
- These are normative decisions that belong to the orchestrator. For each recommendation, include:
  - What should change and why
  - The evidence from reviews (which features, what pattern)
  - Whether it's a systemic issue (same problem across multiple features/workers)
- If the missing guidance is part of an important issue's root cause, say that explicitly so the planner can bundle it into the repair replan.
- The orchestrator will decide whether to act.

**Reject** (ambiguous, duplicate, or wrong):
- Record what you rejected and why. If a candidate is ambiguous or you're unsure, reject it — it's better to skip than to apply something wrong.

**CHECKPOINT: Before writing the synthesis report, verify that you have triaged every `sharedStateObservation` into one of the three buckets (apply / recommend / reject). Do not proceed with an empty triage if observations exist.**

## 5) Write Synthesis Report

```bash
mkdir -p .mission/validation/${MILESTONE}/scrutiny
```

Write to `.mission/validation/${MILESTONE}/scrutiny/synthesis.json`:
```json
{
  "milestone": "{milestone}",
  "round": 1,
  "status": "pass|fail",
  "validatorsRun": {
    "test": { "passed": true, "command": "...", "exitCode": 0 },
    "typecheck": { "passed": true, "command": "...", "exitCode": 0 },
    "lint": { "passed": true, "command": "...", "exitCode": 0 }
  },
  "reviewsSummary": {
    "total": 5,
    "passed": 4,
    "failed": 1,
    "failedFeatures": ["checkout-reserve-inventory"]
  },
  "blockingIssues": [
    { "featureId": "...", "severity": "blocking", "description": "...", "suggestedFix": "..." }
  ],
  "importantIssues": [
    {
      "featureId": "...",
      "severity": "important",
      "description": "...",
      "whyPlanner": "Fix spans multiple features and requires task-list/guidance changes"
    }
  ],
  "repairPlanningRequired": true,
  "appliedUpdates": [
    { "target": "library", "description": "...", "sourceFeature": "..." }
  ],
  "suggestedGuidanceUpdates": [
    {
      "target": "AGENTS.md|skill",
      "suggestion": "...",
      "evidence": "...",
      "isSystemic": true
    }
  ],
  "rejectedObservations": [
    { "observation": "...", "reason": "duplicate|ambiguous|already-documented" }
  ],
  "previousRound": null
}
```

**Commit the synthesis report together with any `.mission/library/` changes (single atomic commit).**

## 6) Return HANDOFF

Always include HANDOFF_START/HANDOFF_END markers. **Scrutiny always returns to orchestrator** — set `returnToOrchestrator: true` regardless of pass/fail.

Include the synthesis file path in `salientSummary`.

```json
HANDOFF_START
{
  "featureId": "{scrutiny feature ID}",
  "successState": "success | failure",
  "returnToOrchestrator": true,
  "commitId": "{git commit hash}",
  "validatorsPassed": true,
  "salientSummary": "Scrutiny round N for {milestone}: M features reviewed, X blocking issues, Y important issues. Synthesis: .mission/validation/{milestone}/scrutiny/synthesis.json",
  "whatWasImplemented": "Ran validators, reviewed features, triaged observations, wrote synthesis report",
  "whatWasLeftUndone": "",
  "discoveredIssues": [
    { "severity": "blocking|important", "description": "...", "suggestedFix": "..." }
  ],
  "verification": {
    "commandsRun": [
      { "command": "pytest tests/ -v", "exitCode": 0, "observation": "All tests pass" }
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

- If blocking OR important issues exist: `successState: "failure"`, list each in `discoveredIssues`
- If all passed: `successState: "success"`

**After outputting the HANDOFF, end your turn immediately. Do not continue with additional work.**

The orchestrator will:
- Read `synthesis.json` for the full report
- Create fix features for every scrutiny code-review issue
- Invoke the external repair replanner before fixing any issue marked `important` or when `repairPlanningRequired: true`
- Review `suggestedGuidanceUpdates` and update AGENTS.md / skills as appropriate
- Start the user-testing-validator only after scrutiny re-runs cleanly
