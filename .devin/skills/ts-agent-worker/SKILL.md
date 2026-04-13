---
name: ts-agent-worker
description: TypeScript source changes for adding or modifying agent support in the skills CLI
triggers:
  - model
---

# TypeScript Agent Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill
Features that involve modifying TypeScript source files in the skills CLI project, specifically:
- Adding new agent types to `src/types.ts`
- Adding agent configurations to `src/agents.ts`
- Modifying skill discovery paths in `src/skills.ts`
- Writing unit/integration tests for agent-related functionality
- Running agent validation and documentation sync scripts

## Required Skills
None

## Work Procedure

1. **Read the feature description** and identify which files need changes. Reference `.mission/library/architecture.md` for the codebase structure.

2. **Write failing tests first (TDD red phase)**:
   - For agent config changes: add tests in a new or existing test file verifying the agent exists in the type union, config has correct fields (name, displayName, skillsDir, globalSkillsDir), and detection logic works.
   - Run `pnpm test -- --run` to confirm the new tests fail.

3. **Implement the changes (TDD green phase)**:
   - `src/types.ts`: Add the new agent to the `AgentType` union. Insert alphabetically where possible (e.g., between `'deepagents'` and `'droid'`), but note the union is not strictly sorted — some entries like `'openclaw'`, `'pochi'`, `'adal'` are out of order. Match the same position in `src/agents.ts`.
   - `src/agents.ts`: Add the agent config object following the goose pattern (non-universal + XDG). See `.mission/library/architecture.md` for details.
   - `src/skills.ts`: Verify the agent's skill directory is in the discovery priority list (add if missing).
   - Run `pnpm test -- --run` to confirm all tests pass (402+ tests).

4. **Run type-check**:
   - `pnpm type-check` — verify no NEW type errors introduced (6 pre-existing errors are baseline).

5. **Run agent validation scripts**:
   - `bun scripts/validate-agents.ts` — must output "All agents valid."
   - `bun scripts/sync-agents.ts` — updates README.md and package.json keywords.

6. **Format code**:
   - `pnpm format` — format all changed files.
   - `pnpm format:check` — verify formatting passes.

7. **Manual verification**:
   - Run `pnpm dev add vercel-labs/agent-skills -a devin --list` to verify the agent is recognized.
   - Check that `src/agents.ts` has the correct entry by reading the file.
   - Each manual check = one `commandsRun` entry with the full command and observed output.

## Example Handoff

```json
{
  "salientSummary": "Added 'devin' agent type to AgentType union in src/types.ts and agent config in src/agents.ts with displayName 'Devin for Terminal', skillsDir '.devin/skills', globalSkillsDir '~/.config/devin/skills', detection via ~/.config/devin. Wrote 3 unit tests in tests/devin-agent.test.ts; ran pnpm test (405 passing). Verified via pnpm dev add vercel-labs/agent-skills -a devin --list showing Devin in agent list.",
  "whatWasImplemented": "Added 'devin' as a non-universal agent type in src/types.ts and src/agents.ts with correct directory paths (.devin/skills/ project, ~/.config/devin/skills/ global) and detection logic (checks ~/.config/devin existence). Agent validation passes.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      {
        "command": "pnpm test -- --run",
        "exitCode": 0,
        "observation": "405 tests passed across 27 test files in 16s"
      },
      {
        "command": "pnpm type-check",
        "exitCode": 2,
        "observation": "6 pre-existing type errors only, no new errors introduced"
      },
      {
        "command": "bun scripts/validate-agents.ts",
        "exitCode": 0,
        "observation": "All agents valid."
      },
      {
        "command": "pnpm format:check",
        "exitCode": 0,
        "observation": "All matched files use Prettier code style!"
      }
    ],
    "interactiveChecks": [
      {
        "action": "Ran pnpm dev add vercel-labs/agent-skills -a devin --list",
        "observed": "Devin for Terminal appears in agent selection with correct display name"
      }
    ]
  },
  "testsAdded": [
    {
      "file": "tests/devin-agent.test.ts",
      "count": 3
    }
  ],
  "discoveredIssues": [],
  "skillFeedback": "Followed TDD procedure. Tests written before implementation. All verification steps completed."
}
```

## When to Return to Orchestrator
- Agent type conflicts with an existing entry
- Discovery paths require changes to the glob pattern logic (not just adding a directory)
- Test infrastructure needs modification beyond adding test files
- Scripts (validate-agents.ts, sync-agents.ts) fail in unexpected ways
