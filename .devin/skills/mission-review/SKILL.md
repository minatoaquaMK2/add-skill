---
name: mission-review
description: End-of-mission review — automated integrity checks + first-principles gap analysis
triggers:
  - model
---

# Mission Review

You perform the final quality gate before a mission is declared complete. This review catches problems that milestone-level validators miss because they only see one milestone at a time.

Do **NOT** spawn subagents from within this reviewer. In Devin, only the root agent can spawn subagents, so this review must execute all three tiers directly inside the same reviewer session.

Use the `todo_write` tool to track your progress through the three tiers.

## Overview

The review has three tiers, executed in order. Tier 1 must fully pass before proceeding.

```
Tier 1: HARD GATE (automated scripts, must all pass)
  → State integrity, validation completeness, test suite
Tier 2: ANALYSIS (direct review inside this session, findings reported by severity)
  → Code quality, security, usability
Tier 3: DEEP REVIEW (optional, direct review inside this session)
  → Performance, architecture, multi-agent integrity
```

---

## Tier 1: Hard Gate (MANDATORY — all must pass)

Run these checks as executable scripts. If ANY check fails, report it as a `critical` finding and stop — the mission cannot proceed until fixed.

### 1A. State File Consistency

Use the `mission` CLI to verify state consistency:

```bash
mission state show --verbose
```

Check the output for:
- **Features:** All should be `completed` or `cancelled` — if any are `pending` or `in-progress`, report as `critical`
- **Assertions:** All should be `passed` or `deferred` — if any are `pending` or `failed`, report as `critical`
- **Milestones:** All milestones should appear in `milestonesSealed` — if any are missing, report as `critical`

Then verify handoff coverage and fulfills coverage **directly inside this reviewer session**:
1. List all completed features from `.mission/features.json`
2. Check each completed feature has a `.mission/handoffs/{id}.json` file
3. Extract all assertion IDs from `validation-contract.md`
4. Cross-reference them against every `fulfills` entry in `.mission/features.json`
5. Report:
   - missing handoffs
   - uncovered assertions
   - orphaned `fulfills` references
   - duplicate assertion claims

If any check fails, STOP. Report every error as a `critical` finding.

### 1B. Full Test Suite

Run ALL test/typecheck/lint commands from `services.yaml`:
```bash
# Read commands from services.yaml and run each
# e.g., cargo test && cargo clippy -- -D warnings
# e.g., pytest tests/ -v && mypy src/
```

If any command fails, report as `critical`.

### 1C. Validation Pipeline Completeness

Verify that scrutiny and user-testing reports exist for every milestone. Use the milestone list from `mission state show --verbose` (the `milestoneDetails` field), then check:

```bash
# For each milestone in the milestoneDetails list:
ls .mission/validation/{milestone}/scrutiny/synthesis.json
ls .mission/validation/{milestone}/user-testing/synthesis.json
ls .mission/evidence/
```

- If a scrutiny or user-testing synthesis report is missing for any milestone → `critical` finding (validation was skipped)
- If `.mission/evidence/` is empty or missing → `critical` finding (flow validators never collected evidence)

**NOTE:** If validation reports are missing, this is a `critical` finding — it means milestone validation was skipped. The Orchestrator must go back and run the validators before the mission can complete.

---

## Tier 2: Analysis (direct, self-contained)

Run these analyses directly inside this reviewer session. Process them sequentially and use `todo_write` to track each area.

### 2A. Code Quality

Check directly:
```
Search the codebase for code quality issues:

1. TODO/FIXME/HACK comments: grep -rn "TODO\|FIXME\|HACK" src/ --include="*.rs" --include="*.py" --include="*.ts"
2. Error handling gaps: look for unwrap(), panic!(), .expect() in non-test code (Rust); bare except: (Python); unhandled promise rejections (JS/TS)
3. Dead code: functions/structs defined but never referenced
4. Code duplication: similar logic repeated across files
5. Test coverage: are there source files with zero corresponding tests?

Report each finding with file:line reference and severity.
```

### 2B. Security

Check directly:
```
Search for security issues:

1. Credential leaks: grep -rn "password\|secret\|api_key\|token" src/ --include="*.rs" --include="*.py" --include="*.ts" | grep -v "test\|mock\|fixture\|example"
2. Hardcoded secrets: grep -rn "calvin\|admin123\|changeme" . --include="*.rs" --include="*.py" --include="*.ts" --include="*.yaml" --include="*.json" | grep -v ".mission/" | grep -v "test"
3. .env in git: check if .env or other secret files are tracked (git ls-files | grep -i "\.env$\|secret\|credential")
4. .gitignore coverage: verify .env, target/, node_modules/, __pycache__/ are in .gitignore
5. Sensitive data in git history: git log --all --diff-filter=A -- "*.env" "*.pem" "*.key"

Report each finding with evidence.
```

### 2C. Usability & Developer Experience

Check directly:
```
Verify developer onboarding works:

1. README accuracy: read README.md. For each command listed, verify it actually works. Check ports, paths, and tool names are correct.
2. services.yaml validity: for each command in services.yaml, run it and check exit code.
3. init.sh idempotency: if init.sh exists, run it twice. Second run should succeed with no errors.
4. AGENTS.md consistency: check that Mission Boundaries (ports, off-limits) match what the code actually uses.
5. .gitignore: check that build artifacts (target/, dist/, node_modules/) are not committed.

Report each broken command or inconsistency.
```

---

## Tier 3: Deep Review (for complex missions, 3+ milestones)

Only run if the mission has 3+ milestones or 10+ features. Otherwise skip.

### 3A. Cross-Milestone Regression

Run directly:
```
Check if later milestones broke earlier functionality:

1. Read features.json — identify features from the FIRST milestone
2. For each first-milestone feature, read its handoff and verification commands
3. Re-run those verification commands now and check they still pass
4. If any fail, it means a later milestone introduced a regression

Report any regressions with: which feature broke, which milestone likely caused it, the failing command and output.
```

### 3B. Performance & Resources

Run directly:
```
Check for performance and resource issues:

1. Build size: ls -lh target/release/* or dist/ — flag if unusually large
2. Dependency count: count direct dependencies in Cargo.toml/package.json — flag if > 30
3. Orphaned processes: ps aux | grep -E 'node|python|cargo' — flag any left over from workers
4. Large files in git: git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | sort -k3 -rn | head -10

Report anything unusual.
```

### 3C. Architectural Integrity

Run directly:
```
Check architecture against documentation:

1. Read .mission/library/architecture.md
2. Compare against actual file structure and module dependencies
3. Check for: circular dependencies, god files (>500 lines with mixed concerns), inconsistent error handling patterns across modules
4. Check if the data flow described in architecture.md matches the actual imports/calls

Report divergences between documentation and reality.
```

### 3D. Multi-Agent Audit Trail

Run directly:
```
Verify the mission's audit trail is complete:

1. Read .mission/progress-log.jsonl — verify every completed feature has a worker_completed entry
2. Read each handoff in .mission/handoffs/ — verify every handoff has verification.commandsRun with actual commands (not empty)
3. Check if any handoff has discoveredIssues that were never addressed (not in a fix feature and not dismissed in progress-log)
4. Check if .mission/library/ was updated with knowledge discovered during the mission (not just initial state)

Report gaps in the audit trail.
```

---

## Report Format

Write to `.mission/review/mission-review.json`:

```json
{
  "reviewedAt": "{ISO timestamp}",
  "overallAssessment": "ready | needs-fixes",
  "tier1": {
    "stateConsistency": { "passed": true, "errors": [] },
    "testSuite": { "passed": true, "command": "...", "summary": "..." },
    "validationPipeline": { "passed": true, "errors": [] }
  },
  "tier2": {
    "codeQuality": { "findings": [] },
    "security": { "findings": [] },
    "usability": { "findings": [] }
  },
  "tier3": {
    "crossMilestone": { "ran": false, "findings": [] },
    "performance": { "ran": false, "findings": [] },
    "architecture": { "ran": false, "findings": [] },
    "auditTrail": { "ran": false, "findings": [] }
  },
  "findings": [
    {
      "id": "MR-001",
      "severity": "critical | significant | minor",
      "area": "state | validation | tests | code-quality | security | usability | regression | performance | architecture | audit-trail",
      "title": "Short description",
      "description": "Detailed explanation",
      "evidence": "File:line, command output, or specific observation",
      "suggestedFix": "What should be done"
    }
  ],
  "summary": "Human-readable summary"
}
```

## Severity Guide

- **critical**: Blocks shipping. State corruption, test failures, missing validation, credential leaks. Orchestrator MUST create fix features.
- **significant**: Degrades quality. Poor error handling, missing tests, broken README commands. Orchestrator should attempt one autonomous fix; if it still cannot be resolved safely, document it as a known issue and continue.
- **minor**: Polish. TODOs, style issues, minor doc inconsistencies. Log and ship.

## Output to Orchestrator

```
REVIEW COMPLETE: {ready | needs-fixes}

Tier 1 (Hard Gate): {PASSED | FAILED}
  State consistency: {pass | N errors}
  Test suite: {pass | fail}
  Validation pipeline: {pass | N missing}

Tier 2 (Analysis):
  Code quality: {N findings}
  Security: {N findings}
  Usability: {N findings}

Tier 3 (Deep): {ran | skipped}
  {findings if ran}

Totals: {N} critical, {N} significant, {N} minor
Report: .mission/review/mission-review.json
```
