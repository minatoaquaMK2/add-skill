---
name: mission-planner
description: Interactive planning and artifact generation — 6 phases from requirements to approved mission, worker system design, and execution-ready artifacts
triggers:
  - user
  - model
---

# Mission Planner

This skill is the planning and mission-initialization entrypoint.

In its normal mode, it works directly with the user to understand the mission, design the worker system, generate all execution-ready artifacts, optionally run a plan review if the user requests it, and then stop.

Mid-execution repair replanning is handled by `/mission-repair-replanner`, not this skill.

Follow these phases in order. Each interactive phase requires user confirmation before proceeding.

## Delegation Model

Your context window is finite. Preserve it for orchestration, synthesis, and user interaction by delegating hands-on work to subagents.

**Delegate to subagents:**
- codebase investigation, architecture tracing, and exhaustive inventories
- validation dry runs and environment probing
- contract-work area exploration and assertion drafting
- contract review passes and coverage audits
- cold-read review of library docs and worker skills

**Keep in the root planner session:**
- asking questions and obtaining user approval gates
- deciding milestone structure, worker types, and final `fulfills` ownership
- synthesizing subagent outputs into canonical artifacts
- running the `mission` CLI to mutate managed mission state
- presenting the final planning summary and finish gate

**CRITICAL: One subagent = one focused planning task.** If a step requires broad codebase reading, exhaustive comparison, or area-by-area enumeration, do not do it manually in the main session. Spawn a focused subagent with a single job, explicit context, and a clear output path.

## Phase 1: Understand & Plan (DYNAMIC, ITERATIVE)

This is the most important phase. Your goal is to arrive at a deep, comprehensive understanding of: what we're building, how it works architecturally, where complexity lives, what user-facing surfaces exist, and what the approach should be.

**Start by asking the user** enough questions to build shared understanding:
- What are we building? What problem does it solve?
- Who uses it? What are the key user flows?
- What constraints exist (tech stack, infrastructure, timeline)?

Use `ask_user_question` to present focused questions. **Do NOT start investigating until the user has answered.** Their answers set the direction for all subsequent investigation.

**Then interleave these activities as needed** — the problem dictates the path:
- **Investigate** the codebase via subagents (explore profile). Delegate code reading, flow tracing, module analysis. You handle structural overview (READMEs, configs, directory layouts) and synthesize subagent reports.
- **Research** unfamiliar technologies via subagents. See Online Research below.
- **Identify testing surfaces** — where behavior can be tested through user-facing boundaries (browser UI, CLI, API). Delegate architectural analysis to subagents when assessing this.
- **Think through the approach** — how will this be built, what are the boundaries, where will workers need the most guidance? For any deep thinking or thorough analysis, delegate to subagents.
- **Ask again** if investigation reveals new ambiguities.

**Always delegate deep investigation and deep thinking to subagents.** Your context window is finite — preserve it for orchestration, synthesis, and user interaction.

### Iterative Exploration Loop
After each round of investigation, enumerate what you still don't know. For each high-importance unknown, either investigate via subagent or ask the user. Continue until nothing important is unexplored.

### Online Research

If the mission involves building with specific technologies, SDKs, or integrations, assess whether your training knowledge is sufficient.

**Research is NOT needed for:** Foundational, slowly-evolving technologies with massive training coverage (React, PostgreSQL, Express, Python stdlib, etc.). Your training knowledge is reliable.

**Research IS needed for:** Technologies where your knowledge may be outdated or superficially correct. Indicators: smaller/newer ecosystems (Convex, Drizzle, Hono), SDK-heavy integrations where the specific API surface matters (Vercel AI SDK, Stripe Elements, Supabase Auth helpers).

**How to research:** Delegate to subagents. For each technology, spawn a subagent to look up current documentation (using webfetch). Raw research reports go in `.mission/research/`. Distilled, worker-facing knowledge goes in `.mission/library/`.

### Exit Criteria
For every part of the system, you can answer:
- What does it do?
- What are its boundaries?
- Where does complexity concentrate?
- How would an independent party verify it works?

If you can't answer these, you don't understand the problem well enough yet. Keep investigating.

**Keep in mind:** Your understanding here directly informs the validation contract — the behavioral assertions that define "done." The contract will need assertions for every surface you identify. Shallow understanding produces shallow contracts, which produce shallow validation.

**GATE: Present your understanding summary to the user.**

Then use `ask_user_question` to confirm:

```
Question: "Is my understanding correct?"
Options:
  - "Yes, proceed to next phase"
  - "There are gaps or corrections needed"
  - "Let's re-discuss from the beginning"
```

**Do NOT proceed to Phase 2 until the user selects "Yes". If the user selects gaps or re-discuss, iterate — investigate further, ask follow-up questions, and re-present your summary until confirmed.**

## Phase 2: Infrastructure & Boundaries

Check what's already running:
```bash
# Check listening ports
ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null
# Check Docker
docker ps 2>/dev/null
# Check running processes
ps aux | grep -E 'node|python|java' | head -20
```

Determine:
- What services are needed (databases, APIs, etc.)?
- What ports will they use?
- What's off-limits (existing services, directories)?
- What commands will workers need? (test, typecheck, lint, build, install)

**Plan for `services.yaml`:** This will be the operational knowledge backbone for all workers. Identify every command and service now — workers read this file, they don't guess. Also plan `init.sh` for idempotent environment setup.

Present needed infrastructure and how it fits with the user's setup:
```
This mission will need:
- [Service] on port [X] (new / existing)
- [etc.]

Off-limits: [ports, directories, services that must not be touched]

Does this setup work for you?
```

**GATE:** After presenting, use `ask_user_question` to confirm:

```
Question: "Does this infrastructure plan work for you?"
Options:
  - "Yes, proceed"
  - "Needs changes" (describe in Other)
```

**Do NOT move to Phase 3 until the user approves.** If the user requests changes, adjust the plan and re-present.

## Phase 3: Set Up Credentials & Accounts (INTERACTIVE)

**Default: real integration, not mocks.** This is not optional.

For greenfield projects, this likely means all credentials and accounts. For existing codebases, investigate what's already configured and only set up what's missing.

If external dependencies exist:
1. Initialize any needed configuration files first (e.g., `.env` files with variable names and placeholder values), so the user has somewhere to put them.
2. Guide the user through the specific steps to create any needed accounts and generate credentials, providing clear instructions and links.

**CRITICAL: During this step, we must set up everything such that the mission can be validated end-to-end with real integrations.** Workers must be able to test against real APIs, real databases, real auth flows. If a feature streams from an LLM API, the real API key must be configured. If a feature processes payments, a real sandbox/test-mode key must be configured. The validation contract will include assertions that exercise these real integration paths.

The user may explicitly choose to defer specific credentials (e.g., "use mocks for now", "I'll add Stripe keys later"). Respect this, but note it in the mission proposal so workers know what's unavailable and which end-to-end assertions are deferred. This is an explicit user opt-out — **never silently default to mocks.**

Ensure that you don't commit any secrets or sensitive information. Add credential files to `.gitignore`.

**Skip this phase only if the mission genuinely has no external credential dependencies.**

**GATE:** After all credentials are configured (or deferred), use `ask_user_question` to confirm:

```
Question: "Credential setup status?"
Options:
  - "All configured, proceed"
  - "Some deferred (noted in proposal)"
  - "Still configuring, please wait"
```

**Do NOT proceed until the user confirms.** If credentials are deferred, ensure the mission proposal explicitly documents which integrations are unavailable and which assertions are affected.

## Phase 4: Plan Testing & Validation Strategy

### Testing Infrastructure
- What test framework? What commands to run tests/lint/typecheck?
- Are there existing tests to maintain?

### User Testing Strategy
- What surfaces will be tested (browser, CLI, API, etc.)?
- What tools for each surface (curl, browser, etc.)?
- Are there any gaps — surfaces that exist but can't be reliably tested?

#### Dry Run (REQUIRED)

You must run a validation readiness dry run before proceeding to the mission proposal. This is a critical quality gate to confirm that your validation approach is executable in the environment and that any blockers are identified and addressed before implementation begins.

Delegate this dry run to a subagent (general profile). It should:

**For greenfield codebases** (no running application yet):
- Verify the toolchain — confirm that testing tools (curl, browser automation, etc.) are installed and functional
- Confirm planned ports are available
- Verify the environment can support the validation approach

**For existing codebases:**
- Verify the full validation path — dev server starts, pages load, testing tools can interact with the application surface
- Confirm auth/bootstrap paths work, existing fixtures/seed data are available
- Verify the application is in a testable state

**For both:**
- Measure resource consumption: check memory usage, CPU load, and process count before and after exercising flows. Report the numbers.
- Note whether flows triggered substantial background work, process spawning, or unexpected resource growth — these observations feed into the resource cost classification below.
- Identify blockers early (auth/access issues, missing fixtures/seed data, env/config gaps, broken local setup).

Present blockers and concrete options to the user, then iterate until either:
1. Validation is runnable, or
2. The user explicitly approves an alternative validation approach (with known limitations).

**Do NOT proceed until the dry run is complete and the validation path is confirmed executable (or the user has explicitly approved an alternative).**

#### Resource Cost Classification

Check the machine's total memory, CPU cores, and current utilization. Determine the **max concurrent validators** for each validation surface — up to 5.

Consider: how much memory/CPU does each validator instance consume on this surface? How much headroom does the machine have?

**Use 70% of available headroom** when calculating max concurrency. Dry run profiles are estimates, and real usage may be unpredictable.

Example — lightweight app: each test instance uses ~300 MB RAM. On a machine with 16 GB total, ~6 GB used at baseline, usable headroom = 10 GB × 0.7 = **7 GB**. 5 instances = 1.5 GB → well within budget. Max concurrent: **5**.

Example — heavy app: each instance uses ~2.3 GB RAM. Same machine, 7 GB headroom. 3 instances = 6.9 GB (fits). 4 instances = 9.2 GB (exceeds). Max concurrent: **3**.

**Reason beyond dry runs, especially in existing codebases.** A dry run captures one moment — it won't reflect real usage patterns. Worker threads, background jobs, and specific user flows can spike resource usage well beyond what a dry run shows. Use this understanding to adjust concurrency limits.

If the mission has multiple surfaces, classify each independently.

### Encode Findings
Capture everything validators need in `.mission/library/user-testing.md` so they can act without re-deriving it:
- Surface discovery findings under a `## Validation Surface` section
- Resource cost classification per surface under a `## Validation Concurrency` section (max concurrent validators, with numbers and rationale)

**GATE:** Present the complete testing strategy, then use `ask_user_question` to confirm:

```
Question: "Do you approve the testing and validation strategy?"
Options:
  - "Approved, proceed"
  - "Needs changes" (describe in Other)
  - "Unresolved blockers remain"
```

**Do NOT proceed to Phase 5 until the user confirms.** If there are unresolved blockers, iterate with the user until either the validation path is executable or the user explicitly approves an alternative.

## Phase 5: Identify & Confirm Milestones

Now that you have a deep understanding of requirements, architecture, surfaces, and validation strategy, identify milestones.

Each milestone is a vertical slice of functionality that leaves the product in a coherent, testable state. Milestones control when validation runs — when all features in a milestone complete, the system runs scrutiny + user testing validators.

Present milestones to user. Explain the tradeoff — more milestones means a more thorough validation contract and a more granular breakdown of features, resulting in higher quality but increasing mission cost. Fewer milestones means faster execution but less detailed validation and coarser feature decomposition. Let the user decide where they want that balance.

**Milestone Lifecycle:** Once a milestone's validators pass, it is **sealed**. Any subsequent work goes into a new milestone.

**GATE:** After presenting milestones, use `ask_user_question` to confirm:

```
Question: "Do you approve this milestone breakdown?"
Options:
  - "Approved"
  - "Want more milestones (higher quality, higher cost)"
  - "Want fewer milestones (faster, less validation)"
  - "Need to restructure" (describe in Other)
```

**Iterate until the user selects "Approved".** Do NOT proceed to the proposal with milestones the user hasn't agreed to.

## Phase 6: Create Mission Proposal

Present a detailed markdown proposal to the user including:
1. Plan overview
2. Expected functionality (milestones and features, structured for readability)
3. Environment setup
4. Infrastructure (services, processes, ports) and boundaries
5. Testing strategy: what test types apply (unit, integration, e2e), what framework/commands
6. User testing strategy: what surfaces, what tools, any setup needed
7. Validation readiness: results of the dry run — confirm the validation path is executable, or note any accepted limitations/alternatives
8. Non-functional requirements

The infrastructure section tells workers what's needed and what to avoid. Example:

```markdown
## Infrastructure

**Services:**
- Postgres on localhost:5432 (existing)
- API server on port 3100
- Web frontend on port 3101

**Off-limits:**
- Redis on 6379 (other project)
- Ports 3000-3010 (user's dev servers)
- /data directory
```

NOTE: `features.json` will be much more detailed than the proposal. The proposal is a summary for user approval; the mission artifacts are the precise execution breakdown.

**GATE (CRITICAL — equivalent to droid's `propose_mission` tool):**

Before calling `ask_user_question`, echo back **every requirement** the user has mentioned — even casual ones — to confirm nothing was dropped.

Then use `ask_user_question`:

```
Question: "Do you approve this mission proposal?"
Options:
  - "Approved — generate mission artifacts"
  - "Needs changes before approval"
  - "Reject — re-plan from scratch"
```

**This is the single most important gate in the entire planning process.** The `.mission/` directory and all artifacts are created only after the user selects "Approved". If the user selects "Needs changes", iterate on the proposal and re-present. If the user selects "Reject", return to Phase 1.

**Do NOT create any mission artifacts until this gate passes.**

After the user selects **"Approved — generate mission artifacts"**, continue into worker system design and artifact generation. **Do NOT start execution from this skill.**

---

## Mission CLI Usage Model

Use the `mission` CLI whenever the operation mutates managed mission state. Do **NOT** hand-edit CLI-owned files when a supported command exists.

Use the CLI for:
- `mission init` to create the `.mission/` skeleton
- `mission validation add|remove|reset|update` for `.mission/validation-state.json`
- `mission feature create|edit` for supported `features.json` mutations
- `mission artifacts check` for the planning-to-execution consistency gate
- `mission state show` to inspect computed mission summary instead of hand-maintaining derived state

Direct file editing is still required for canonical content the CLI does not own, including:
- `.mission/mission.md`
- `.mission/validation-contract.md`
- `AGENTS.md`
- `services.yaml`
- `init.sh`
- `.mission/library/`
- `.devin/skills/`

# Designing Your Worker System

After the user approves the mission proposal, design the system of workers that will build it.

## Step 1: Analyze Effective Work Boundaries

Ask yourself:
- What distinct layers or domains does this mission touch?
- Do different areas benefit from different procedures or tools?

Each distinct boundary typically maps to a worker type.

## Step 2: Design Worker Types

For each boundary, determine:
- What skills/tools are essential for doing thorough work in this area?
- What does this worker implement?
- How does it verify its work? (TDD + manual verification)
- What does a thorough handoff look like?

## Automatic Validation (Builtin)

The system runs two validation features when a milestone completes:

1. **scrutiny-validator** — Runs validators (test, typecheck, lint), reviews completed features directly inside the validator session, and writes a synthesis report. If it fails, goes back to pending for re-run after fixes. If it reports an important issue, the orchestrator invokes `/mission-repair-replanner` before fixing.
2. **user-testing-validator** — Determines testable assertions from `fulfills`, executes grouped flows directly inside the validator session, and writes a synthesis report. If it fails, goes back to pending for re-run after fixes.

You do NOT create these yourself — the orchestrator spawns them automatically when a milestone completes.

## Guiding Principles

These apply to every worker type. Encode them into your skill procedures:

1. **Test-Driven Development** — Tests are written BEFORE implementation, always:
   - Workers write failing tests first (red), then implement to make them pass (green).
   - Even when tests and implementation are in the same file, the tests are added first and must fail before implementation begins.

2. **Manual Verification** — Automated tests are necessary but not sufficient. Workers must manually verify their work catches issues tests miss. Quick sanity checks on adjacent features help catch integration issues early.

3. **No orphaned processes** — Workers must not leave any test runners or other processes running:
   - Avoid watch/interactive modes for tests unless explicitly required.
   - If a test command starts a long-running process, the worker must stop it and ensure any child processes are also terminated (by PID, not by name).

4. **Domain gates belong in worker procedures** — If the mission touches baremetal provisioning, BMC, Redfish, IPMI, power control, boot control, PXE, DHCP, discovery, or host-state transitions, the affected worker procedures must explicitly require:
   - required project tests
   - required real-hardware validation commands from `AGENTS.md` and `services.yaml`
   - raw evidence capture under `.mission/evidence/real-hardware/`
   - blocked/incomplete return to orchestrator if physical validation cannot be performed

---

## Designing Handoffs for Accountability

The handoff is your primary detection mechanism. When a worker cuts corners, the handoff should make it visible.

### Think Adversarially

For each worker type, ask:
- "What steps might a worker skip when rushed?"
- "What would the handoff look like if they skipped it?"
- "What specific details would be missing?"

Then design handoff requirements that demand those details.

### Make Vagueness Impossible

Structure handoff fields so that vague answers are obviously incomplete. If a worker can write "tested it, works" and satisfy the requirements, the handoff is poorly designed. When fields demand specific commands, outputs, and observations, shortcuts become visible.

### Write Procedures, Not Aspirations

Your skill's Work Procedure is the strongest lever you have over worker behavior. Do NOT write vague, high-level aspirations. Write specific, step-by-step instructions that name tools and specify what thorough work looks like.

**Weak procedure (workers will cut corners):**
> 1. Build the feature
> 2. Test it works
> 3. Run validators

**Strong procedure (workers will do thorough work):**
> 1. Write tests first (red), then implement to make them pass (green). Cover core logic, edge cases, error handling.
> 2. Run `pytest tests/ -v` — all tests pass.
> 3. Manual verification: `curl -sk https://localhost:8443/endpoint` and verify response structure.
> 4. Each manual check = one `commandsRun` entry with the full command and observed output.

The difference: the strong procedure names tools, specifies the verification pattern, and tells the worker exactly what thorough looks like. The weak one lets the worker decide, which invites shortcuts.

---

## Creating Worker Skills

For each worker type, create a skill file at:

```text
.devin/skills/{worker-type}/SKILL.md
```

### Worker Skill Structure

Every worker skill MUST include:

```markdown
---
name: {worker-type}
description: {One-line description}
triggers:
  - model
---

# {Worker Type}

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill
{What kinds of features should use this worker type}

## Required Skills
{Skills that workers of this type MUST invoke during their work.
Include skills the user specified during planning. For each, note what it's
used for and when to invoke it. "None" if not applicable.}

## Work Procedure
{Step-by-step procedure — testing, implementation, verification. Be specific
about tools, commands, and what thorough work looks like at each step.}

## Example Handoff
{A complete JSON example showing what a thorough handoff looks like for this
worker type}

## When to Return to Orchestrator
{Skill-specific conditions beyond standard cases}
```

**The Example Handoff is required.** It sets the bar for quality. Workers will pattern-match against it, so make it thorough.

### Handoff Fields Reference

| Field | Purpose |
|-------|---------|
| `salientSummary` | 1-4 sentence summary of what happened in the session |
| `whatWasImplemented` | Concrete description of what was built (min 50 chars) |
| `whatWasLeftUndone` | What's incomplete — empty string if truly done |
| `verification.commandsRun` | Shell commands with `{command, exitCode, observation}` |
| `verification.interactiveChecks` | Manual/interactive checks with `{action, observed}` |
| `testsAdded` | Test files with `{file, count}` |
| `discoveredIssues` | Issues found: `{severity, description, suggestedFix?}` |
| `skillFeedback` | Self-reflection on procedure adherence |

Examples of good `salientSummary` (be concrete, 1-4 sentences):
- Success: "Implemented GET /api/products/search with cursor pagination + min-length validation; ran `pytest tests/test_search.py` (4 passing) and verified 400 on `q=a` plus 200 on a real curl request."
- Failure: "Tried to wire logout to SessionStore, but typecheck failed (missing import) and `pytest tests/test_auth.py` had 2 failing tests; returning to orchestrator to decide whether to add session persistence or change logout semantics."

### When to Return to Orchestrator (Skill-Specific)

Beyond the standard conditions in `worker-base`, each skill should define:
- Feature depends on an API endpoint or data model that doesn't exist yet
- Requirements are ambiguous or contradictory
- Existing bugs affect this feature

## Worker System Design Checklist

Before proceeding to create mission artifacts:

- [ ] Each worker skill exists at `.devin/skills/{worker-type}/SKILL.md`
- [ ] Each skill has YAML frontmatter (name, description)
- [ ] Each skill has a Required Skills section
- [ ] Each skill has an Example Handoff section with a complete, realistic JSON example
- [ ] Example handoffs are thorough and explicit — they set the quality bar workers will follow
- [ ] Each skill's Work Procedure is specific (names tools, specifies commands, defines "thorough")
- [ ] Any provisioning-related worker skill mirrors the real-hardware gate in its procedure

---

## Create Mission Artifacts

After the user approves the proposal and you finish worker system design, create ALL execution-ready artifacts before handing control to `/mission-orchestrator`.

### Bootstrap `.mission/` (if needed)

If `.mission/` does not exist yet, initialize the skeleton first:

```bash
mission init
```

This creates the bare `.mission/` skeleton only. It does **NOT** create `mission.md`, `validation-contract.md`, or `.mission/library/architecture.md`. You must fill in the rest before handing off to the orchestrator.

Create ALL of these files before handing control to `/mission-orchestrator`. **Ordering matters** — `.mission/validation-contract.md` MUST be created before `.mission/features.json`. This is mission-level TDD.

### 1. `mission.md`

Copy the approved plan from the proposal into `.mission/mission.md`.

### 2. `validation-contract.md`

This is the definition of "done." Every testable behavioral expectation lives here.

#### How to create `validation-contract.md`

**Step 1: Split the contract into areas and dispatch subagents.** Before writing assertions, identify all user-facing areas (e.g., "login flow", "message composer", "checkout cart") plus any needed cross-area flows. Spawn a subagent for each **single area** to investigate and enumerate all user interactions: What can a user DO with this area? What do they see, click, type? What do they expect to happen?

Spawn a **foreground subagent** (general profile) for each **single contract-work area** using a prompt shaped like this:

```text
You are a validation-contract exploration worker.

IMPORTANT: Investigate only your assigned area. Do NOT edit
`.mission/validation-contract.md`, `.mission/features.json`, or any other
canonical artifact. Write your findings only to the assigned contract-work
file. If the area is ambiguous or under-specified, call that out explicitly
instead of guessing.

Follow these procedures in order:

1. Read the mission proposal, AGENTS.md, and relevant planning/library context
2. Investigate the codebase and user-facing behavior for your assigned area
3. Enumerate concrete assertions, boundary cases, and evidence requirements
4. Write the result to `.mission/contract-work/{area-name}.md`

Assigned area:
{area-name / scope description}

Mission directory: .mission/
Read `.mission/mission.md` and `AGENTS.md` for context.
```

**Each subagent's output quality is bounded by the context you give it.** Pass along the mission proposal, user-provided context, and relevant findings from planning.

**Subagents must write their output to `.mission/contract-work/{area-name}.md`.** Each file contains the assertions for that area. This enables parallel subagent work without conflicts and gives you a clear synthesis point.

**Step 2: Synthesize in the root session only after the subagents finish.** Do **NOT** sit in the main session drafting multiple areas by hand. Wait until the area subagents have written their `contract-work` files, then read all files from `.mission/contract-work/` and merge them into `.mission/validation-contract.md`. During synthesis:
- Deduplicate assertions that overlap across areas
- Ensure consistent ID format (VAL-AREA-NNN)
- Verify cross-area flows reference the correct area assertions
- If synthesis reveals a missing area or unclear behavior, spawn another focused subagent instead of filling an entire missing section manually in the root session

**Step 3: Write per-feature assertions.** For each user-facing feature, cover the interactions users will have with it. For example, if building a Slack clone, the message composer feature includes: typing a message, sending it, seeing it appear in the channel, editing it, deleting it, adding reactions, replying in a thread, mentioning users, etc. Beyond the obvious interactions, watch for subtle requirements — e.g., thread messages must be interactable just like top-level messages; changing a line item price must recalculate totals AND update percentage-based discounts. **Enumerating "important" functionality is surprisingly hard — be diligent.**

**Step 4: Add boundary conditions.** Don't only test the happy path with minimal data. For every interactive feature, ask: "what would a real user's experience be after sustained use?" Most bugs hide at the extremes, not the happy path.

**Step 5: Add cross-feature assertions.** Flows spanning multiple features (e.g., user adds item to cart, logs out, logs back in, cart is preserved), entry points, navigability. Include first-visit flow, reachability via actual navigation (not just direct URL), and any flows that span multiple features.

**Step 6: Each assertion must include:** stable ID (VAL-AREA-NNN), title, behavioral description, tool specification, and evidence requirements.

Organized by area + cross-area flows. Example format:

```markdown
## Area: Authentication

### VAL-AUTH-001: Successful login
A user with valid credentials submits the login form and is redirected to the dashboard.
Tool: curl
Evidence: HTTP response status 200, response body contains user object

### VAL-AUTH-002: Login form validation
Submitting with empty fields returns 400 with per-field validation errors.
Tool: cargo test
Evidence: Unit test asserts 400 response and error field names

## Cross-Area Flows

### VAL-CROSS-001: Auth gates pricing
A guest user sees "Sign in for pricing". After logging in, real prices are shown.
Tool: curl
Evidence: GET /catalog as guest → no prices; GET /catalog with auth → prices present
```

**Evidence requirements** tell the user-testing flow execution what to collect. Common types:
- **Command output**: for API/CLI assertions (curl response, command stdout)
- **Screenshots**: for UI assertions (if browser automation available)
- **Test output**: for unit/integration test assertions (cargo test output)
- **Console errors**: for UI assertions (browser console)

Evidence files are saved to `.mission/evidence/{milestone}/{group-id}/` during user-testing flow execution.

**Special rule for physical missions:** If the mission affects baremetal provisioning, BMC, Redfish, IPMI, power, boot, PXE, DHCP, discovery, or host-state transitions, the contract must encode concrete `VAL-REAL-*` assertions with explicit commands, pass criteria, and evidence paths. Do **not** leave real-hardware completion rules only in the proposal text.

#### Review passes (OPTIONAL)

If you or the user want additional scrutiny before finishing planning, run one or more review passes. Each review pass can spawn parallel subagents by section — one reviewer per area plus one for cross-area. Each reviewer should:
- Read the full contract and the mission proposal
- Investigate the codebase to verify coverage
- Think through what's missing — it is very likely that important assertions are missing even if the contract looks good on the surface

After each review pass, synthesize findings and update `.mission/validation-contract.md` with missing assertions before starting the next pass. Run passes sequentially so each builds on the previous pass's additions.

**Do your own final pass after reviewers complete.**

### 3. `validation-state.json`

Initialize after the contract via the `mission` CLI. Do **NOT** hand-author `.mission/validation-state.json`.

1. Extract the final assertion ID list from `.mission/validation-contract.md`
2. For each assertion ID, run:

```bash
mission validation add --assertion <ID>
```

Example pattern:

```bash
sed -n 's/^### \\(VAL-[^:]*\\):.*/\\1/p' .mission/validation-contract.md | while read -r id; do
  mission validation add --assertion "$id"
done
```

If you later change the contract before finishing planning:
- Added assertion → `mission validation add --assertion <ID>`
- Removed assertion → `mission validation remove --assertion <ID>`

All assertions remain `pending` during planning. Do **NOT** mark them `passed` from this skill.

### 4. `.mission/library/architecture.md`

Write after the validation contract is finalized. System architecture, components, data flows. Have a subagent review it as if they were a worker seeing it cold, and iterate until it's solid.

### 5. `features.json` — Create AFTER contract

Decompose features using both the contract and the architecture document. You must own the decomposition decisions yourself — do **NOT** outsource milestone structure or `fulfills` ownership to a subagent. But materialize and refine `.mission/features.json` through the `mission` CLI wherever it supports the change.

At minimum:
- use `mission feature create` to add each planned feature shell
- use `mission feature edit` to set or refine `preconditions`, `fulfills`, `expectedBehavior`, `verificationSteps`, `skillName`, and `milestone`
- if you need a one-time bulk rewrite that the CLI cannot express, do it carefully, then return to the CLI for subsequent mutations

#### Required fields per feature

| Field | Description |
|-------|-------------|
| `id` | Unique identifier |
| `description` | What to build (clear, specific) |
| `skillName` | Which worker skill handles this feature |
| `milestone` | Vertical slice this feature belongs to |
| `preconditions` | What must be true before starting (array of feature IDs) |
| `expectedBehavior` | What success looks like (array of strings) |
| `verificationSteps` | How to verify (array of strings, prefix manual checks with "Manual:") |
| `fulfills` | Validation contract assertion IDs this feature COMPLETES |
| `status` | Start as `"pending"` |

#### `fulfills` semantics — "completes", not "contributes to"

- Only the **leaf feature** that makes an assertion fully testable claims it. Infrastructure/foundational features have empty `fulfills`.
- Each assertion ID should appear in **exactly one** feature's `fulfills` across the entire `.mission/features.json`.
- Unclaimed assertions = planning gap. Fix before proceeding.

#### Coverage check (REQUIRED before asking the user to finish planning)

Every assertion ID in `.mission/validation-contract.md` must be claimed by exactly one feature. For large contracts, **delegate the coverage check to a subagent** to systematically extract all assertion IDs from the contract, cross-reference against all `fulfills` arrays in `.mission/features.json`, and report gaps.

If the coverage check reveals gaps, resolve them through `mission feature create` / `mission feature edit` wherever the CLI supports the required change.

#### Feature ordering

Feature order in the array = execution order. When a feature completes, it moves to the bottom of the array. Fix features inserted at the top execute next.

**NEVER create scrutiny or user-testing features in `features.json` during planning.** These are auto-injected by the orchestrator at milestone completion.

**Special rule for physical missions:** Each `VAL-REAL-*` assertion must be claimed by the single leaf feature that makes that physical validation passable. Milestones must be ordered so those assertions become meaningfully testable at the correct stage.

### 6. `services.yaml` — Operational knowledge backbone

The **single source of truth** for all commands and services. Workers read this — they don't guess.

```yaml
commands:
  test: pytest tests/ -v
  typecheck: mypy src/
  lint: ruff check src/
  install: pip install -e '.[dev]'

services:
  api:
    start: .venv/bin/python -m uvicorn app:app --host 0.0.0.0 --port 8443
    stop: lsof -ti :8443 | xargs kill
    healthcheck: curl -sf https://localhost:8443/health
    port: 8443
    depends_on: []
```

**Rules:**
- If a service runs on a port, the port must be **hardcoded in ALL commands** (start, stop, healthcheck) AND in the `port` field.
- Services require: `start`, `stop`, `healthcheck`, `port`, `depends_on`.
- Commands require: the command string.
- Only additive changes — never overwrite existing entries.

**Special rule for physical missions:** Add explicit commands for targeted tests, broader validation, real Redfish check, real IPMI check, end-to-end provision trigger, and target state verification. Workers and validators must read these commands instead of guessing.

### 7. `init.sh`

Create `init.sh` as the idempotent environment setup script. It runs at the start of each worker session.

Typical contents: install dependencies, set up environment files, any one-time setup. Do NOT put service start commands here — those belong in `services.yaml`.

### 8. Other artifacts

- `.mission/library/environment.md` — Environment details, installed tools, constraints
- `.mission/library/user-testing.md` — Testing surface findings, tools, resource cost classification per surface
- `AGENTS.md` — Add Mission Boundaries, coding conventions, user-provided instructions, and a `## Testing & Validation Guidance` section if applicable
- `.mission/state.json` — Initialized by `mission init`; inspect with `mission state show`, do **NOT** hand-maintain derived counters
- `.mission/progress-log.jsonl` — Initialized by `mission init`; should remain empty at planning completion

### 9. Artifact Checklist (ALL must pass before asking the user to finish planning)

- [ ] Each `skillName` in `.mission/features.json` has a corresponding `.devin/skills/{type}/SKILL.md`
- [ ] Each skill has YAML frontmatter + Example Handoff
- [ ] Every assertion ID in `.mission/validation-contract.md` is claimed by exactly one feature's `fulfills`
- [ ] `.mission/validation-state.json` contains all assertion IDs, status `"pending"`
- [ ] `.mission/state.json` exists and is initialized to `ready`
- [ ] `.mission/progress-log.jsonl` exists
- [ ] `AGENTS.md` includes Mission Boundaries
- [ ] `AGENTS.md` includes Testing & Validation Guidance
- [ ] `services.yaml` includes test/typecheck/lint commands
- [ ] `init.sh` is idempotent

**Physical gate:** run the CLI artifact check before asking the user to finish planning:

```bash
mission artifacts check
```

If exit code 1, the artifact set is inconsistent. Fix the reported blockers first.

## Final Planning Check with the User

Once the mission artifacts are written and the artifact checklist passes, present the completed plan to the user.

At minimum, show:

1. every requirement the user mentioned
2. what artifacts were created
3. the exact `AGENTS.md` Mission Boundaries text
4. the exact `AGENTS.md` Testing & Validation Guidance text
5. the assertions and fulfills mapping that define "done"
6. the relevant `services.yaml` commands workers and validators will run
7. the proposed milestone list, what becomes passable at each milestone, and what evidence seals it

**For baremetal and other physical missions, you must explicitly show all of the following:**

1. the exact `AGENTS.md` text for `Mission Boundaries`
2. the exact `AGENTS.md` text for `Testing & Validation Guidance`
3. the list of `VAL-REAL-*` assertions in `validation-contract.md`
4. the evidence file list under `.mission/evidence/real-hardware/`
5. the real-hardware commands in `services.yaml`
6. which features fulfill which `VAL-REAL-*` assertions
7. the proposed milestone list and, for each milestone, which assertions are expected to pass and what evidence will seal it

Then use `ask_user_question`:

```text
Question: "How would you like to finish planning?"
Options:
  - "No issues — finish planning"
  - "Run subagent review plan"
  - "Continue supplementing the plan"
```

If the user selects **"Continue supplementing the plan"**, return to the relevant planning or artifact sections, update the canonical artifacts, re-run affected checks, and then re-present this final planning summary.

When supplementing the plan:
- If assertion IDs changed, update `.mission/validation-state.json` via `mission validation add` / `mission validation remove`
- If feature metadata changed, use `mission feature create` / `mission feature edit` wherever the CLI supports it
- Re-run `mission artifacts check` before re-presenting the plan

If the user selects **"Run subagent review plan"**:

1. Spawn a **foreground subagent** (general profile) for this **single plan review round**:

```text
You are a planning reviewer.

IMPORTANT: You are read-only with respect to the planning artifacts. Do NOT edit
the plan, do NOT rewrite artifacts, and do NOT spawn subagents. If the artifact
set is incomplete, inconsistent, or unclear, report that in your review output.

Follow these procedures in order:

1. FIRST, invoke the /planning-review-base skill
2. THEN, if the mission domain requires it, invoke the relevant domain reviewer
   skill(s) such as /baremetal-provision-reviewer

Review the current canonical planning artifacts:
- .mission/mission.md
- .mission/validation-contract.md
- .mission/validation-state.json
- .mission/features.json
- AGENTS.md
- services.yaml
- init.sh
- .mission/library/
- .devin/skills/{worker-type}/SKILL.md

Mission directory: .mission/
Read .mission/mission.md and AGENTS.md for context.

Return a structured report with at least:
- overallAssessment: ready | needs-changes
- summary
- findings[]: {severity, title, description, affectedArtifacts, suggestedChange}

Additional checks[] and changeSets[] are encouraged when you can group concrete
follow-up decisions for the user.

Write the final report to:
.mission/reports/plan-review-round-{n}.json
```

2. Save the report to `.mission/reports/plan-review-round-{n}.json`.
3. Present the review findings to the user, apply any changes they request, and then ask the same **"How would you like to finish planning?"** question again.

If the review reports blocking findings, do **not** finish planning until they are resolved or the user has explicitly changed the plan/scope so those blockers no longer apply.

### Commit all artifacts

After the user selects **"No issues — finish planning"**, commit the planning artifacts:

```bash
git add -A && git commit -m "Initialize mission artifacts"
```

## Hand Off to the Orchestrator

Once the user selects **"No issues — finish planning"** and the final artifact checks are complete:

1. Summarize what was created and any explicit deferred integrations or accepted non-blocking review findings
2. Tell the user to run `/mission-orchestrator` to execute the mission
3. Stop

**Do NOT dispatch workers, inject validators, or begin execution from this skill.**

---
