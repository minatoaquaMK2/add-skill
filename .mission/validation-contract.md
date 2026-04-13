# Validation Contract: Add "Devin for Terminal" Agent Support

## Area: Agent Registration

### VAL-REG-001: 'devin' exists in AgentType union
The `AgentType` union type in `src/types.ts` includes `'devin'` as a string literal member, exactly once. TypeScript compilation accepts `'devin'` as a valid `AgentType` value.
Tool: grep, pnpm type-check
Evidence: `grep -c "'devin'" src/types.ts` returns 1; no new type errors beyond baseline 6

### VAL-REG-002: Agent config object completeness
The `agents` record in `src/agents.ts` contains a `devin` key with: `name: 'devin'`, `displayName: 'Devin for Terminal'`, `skillsDir: '.devin/skills'`, `globalSkillsDir: join(configHome, 'devin/skills')` (resolving to `~/.config/devin/skills`), and an async `detectInstalled` function. Follows the XDG pattern used by Goose/Amp/OpenCode.
Tool: grep, pnpm test
Evidence: grep shows correct config values; unit tests assert all field values

### VAL-REG-003: Detection function correctness
`detectInstalled` uses `existsSync(join(configHome, 'devin'))` where `configHome` respects `$XDG_CONFIG_HOME`. Returns true when `~/.config/devin` exists, false otherwise.
Tool: pnpm test
Evidence: Unit tests mock filesystem and verify both branches

### VAL-REG-004: Non-universal classification
`isUniversalAgent('devin')` returns `false` because `skillsDir` is `.devin/skills` (not `.agents/skills`). `'devin'` appears in `getNonUniversalAgents()` but not in `getUniversalAgents()`.
Tool: pnpm test
Evidence: Unit tests assert classification

### VAL-REG-005: No duplicate names or conflicting directories
`'devin'` appears exactly once in the AgentType union, once as a key in the agents record. `'Devin for Terminal'` does not collide with any existing displayName (validated by `validate-agents.ts` which checks displayName uniqueness). `.devin/skills` is unique among all agent skillsDirs and `~/.config/devin/skills` is unique among all agent globalSkillsDirs (verified via grep — note: `validate-agents.ts` only checks displayName, not directory uniqueness).
Tool: grep, bun scripts/validate-agents.ts
Evidence: `grep -c "'devin'" src/types.ts` returns 1; `grep "skillsDir.*'\\.devin/skills'" src/agents.ts` returns 1; validate-agents.ts passes for displayName uniqueness

### VAL-REG-006: validate-agents.ts passes
Running `bun scripts/validate-agents.ts` exits with code 0 and outputs "All agents valid." after Devin is registered.
Tool: bun scripts/validate-agents.ts
Evidence: Exit code 0, output contains "All agents valid."

## Area: Integration & Discovery

### VAL-INT-001: `.devin/skills` in skill discovery priority paths
`src/skills.ts` `prioritySearchDirs` array includes `join(searchPath, '.devin/skills')`. Skills placed in `.devin/skills/<name>/SKILL.md` are found by `discoverSkills()`.
Tool: grep, pnpm test
Evidence: grep confirms entry in prioritySearchDirs; test creates skill in .devin/skills/ and verifies discovery

### VAL-INT-002: Symlink installation for Devin
`installSkillForAgent(skill, 'devin', { mode: 'symlink' })` copies skill to `.agents/skills/<name>` (canonical) and creates a symlink at `.devin/skills/<name>` pointing to the canonical directory. `result.success === true`, `result.mode === 'symlink'`.
Tool: pnpm test
Evidence: Test creates temp dir, installs skill, verifies symlink exists and points to canonical

### VAL-INT-003: Copy installation for Devin
`installSkillForAgent(skill, 'devin', { mode: 'copy' })` writes directly to `.devin/skills/<name>`. No canonical directory or symlink involved. `result.success === true`, `result.mode === 'copy'`.
Tool: pnpm test
Evidence: Test verifies .devin/skills/<name>/SKILL.md exists, no .agents/skills/ entry

### VAL-INT-004: Global installation paths
For global install, `getAgentBaseDir('devin', true)` returns `~/.config/devin/skills`. `agents.devin.globalSkillsDir` is defined (not undefined), so the "does not support global skill installation" error does not trigger.
Tool: pnpm test
Evidence: Unit test asserts global path resolution

### VAL-INT-005: CLI accepts `-a devin`
Running `skills add <source> -a devin` does not produce "Invalid agents: devin" error. The agent name is recognized by all commands (add, list, remove) because `Object.keys(agents)` dynamically includes `'devin'`.
Tool: pnpm test
Evidence: CLI integration tests do not error on `-a devin`

### VAL-INT-006: README updated with Devin
After running `bun scripts/sync-agents.ts`, README.md contains "Devin for Terminal" in the agent table, `.devin/skills/` in the skill discovery paths section, and the agent count increments.
Tool: bun scripts/sync-agents.ts, grep
Evidence: grep confirms "Devin for Terminal" and ".devin/skills" in README

### VAL-INT-007: package.json keywords updated
After running `bun scripts/sync-agents.ts`, `package.json` keywords array contains `"devin"`.
Tool: bun scripts/sync-agents.ts, grep
Evidence: `grep '"devin"' package.json` matches within keywords array

### VAL-INT-008: skills list shows Devin-attributed skills
`listInstalledSkills()` scans `.devin/skills/` and attributes found skills to `'devin'`. JSON list mode shows "Devin for Terminal" as the agent display name.
Tool: pnpm test
Evidence: Test creates skill in .devin/skills/, calls listInstalledSkills, verifies agent attribution

## Cross-Area Flows

### VAL-CROSS-001: End-to-end config + installer + discovery consistency
`agents.devin.skillsDir` matches the prioritySearchDirs entry, matches the path computed by `getAgentBaseDir('devin', false, cwd)`, and matches the path scanned by `listInstalledSkills()`. After installing a skill for Devin, both `discoverSkills()` and `listInstalledSkills()` find it.
Tool: pnpm test
Evidence: Integration test installs skill, then verifies discovery and listing find it
