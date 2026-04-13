# Validation Contract: Integration & Documentation

**Area:** Integration & Documentation
**Scope:** Skill installation for Devin, skill discovery from `.devin/skills/`, CLI integration, documentation sync
**Baseline:** 46 agents currently defined; `'devin'` not yet present in any source file

---

## Source Files Under Investigation

| File | Role | Key Lines |
|------|------|-----------|
| `src/installer.ts` | Skill installation (symlink/copy), `listInstalledSkills`, `getAgentBaseDir` | L80-97, L212-323, L828-1054 |
| `src/skills.ts` | `discoverSkills()`, `prioritySearchDirs` array | L108-224, L153-183 |
| `src/add.ts` | `runAdd()` — agent selection, validation, install flow | L536-548, L1217-1289 |
| `src/list.ts` | `runList()` — list installed skills | L67-192 |
| `scripts/validate-agents.ts` | Validates no duplicate displayNames | L23-38, L55-84 |
| `scripts/sync-agents.ts` | Syncs agent data to README.md and package.json keywords | L12-116 |
| `README.md` | Agent table, skill discovery paths | L227-273, L336-374 |
| `package.json` | `keywords` array (lines 34-84) |
| `tests/installer-symlink.test.ts` | Symlink regression tests | L1-190 |
| `tests/list-installed.test.ts` | List installed skills tests | L1-190 |
| `tests/xdg-config-paths.test.ts` | XDG path verification tests | L1-93 |

---

## VAL-INT-001: `installSkillForAgent` works for 'devin' in symlink mode

**Title:** Symlink-mode installation creates canonical copy + symlink to `.devin/skills/`

**Behavioral description:**
`installSkillForAgent()` (src/installer.ts L212-323) operates as follows for a non-universal agent like Devin (where `skillsDir: '.devin/skills'` !== `'.agents/skills'`):

1. Computes `canonicalBase` = `<cwd>/.agents/skills` (via `getCanonicalSkillsDir`)
2. Computes `canonicalDir` = `<cwd>/.agents/skills/<skill-name>`
3. Computes `agentBase` = `<cwd>/.devin/skills` (via `getAgentBaseDir`, L80-97, since `isUniversalAgent('devin')` is `false`)
4. Computes `agentDir` = `<cwd>/.devin/skills/<skill-name>`
5. Validates both paths with `isPathSafe`
6. In symlink mode (default): copies skill files to `canonicalDir`, then creates a symlink from `canonicalDir` to `agentDir`
7. If symlink fails: falls back to copy, sets `symlinkFailed: true`

The key code path is L277-313:
```
await cleanAndCreateDirectory(canonicalDir);
await copyDirectory(skill.path, canonicalDir);
const symlinkCreated = await createSymlink(canonicalDir, agentDir);
```

Since Devin is non-universal and not global, it will NOT hit the early return at L284-291 (which is for universal+global only).

**Evidence requirements:**
1. Create a temp project dir with a test skill
2. Call `installSkillForAgent(skill, 'devin', { cwd: tmpDir, mode: 'symlink' })`
3. Assert `result.success === true`
4. Assert `result.canonicalPath` ends with `.agents/skills/<skill-name>`
5. Assert `result.path` ends with `.devin/skills/<skill-name>`
6. Assert `.devin/skills/<skill-name>` is a symlink pointing to `.agents/skills/<skill-name>`
7. Assert `.agents/skills/<skill-name>/SKILL.md` exists and contains correct content
8. Assert `result.mode === 'symlink'`
9. Assert `result.symlinkFailed` is `undefined`

**Tool specification:**
```bash
pnpm test -- --run tests/installer-symlink.test.ts
# New test should follow the pattern in L29-58 but use 'devin' instead of 'amp'
# and verify the symlink goes to .devin/skills/ instead of .agents/skills/
```

**Boundary cases:**
- Unlike universal agents (amp, codex, cursor), Devin's `agentDir` differs from `canonicalDir`, so a real symlink MUST be created
- The `createSymlink` function (L145-209) computes a relative path and handles the case where parent dirs are symlinked
- If `.devin/skills/` doesn't exist yet, `mkdir(linkDir, { recursive: true })` at L197 creates it
- Path safety validation must pass for both canonical and agent paths

---

## VAL-INT-002: `installSkillForAgent` works for 'devin' in copy mode

**Title:** Copy-mode installation writes directly to `.devin/skills/`

**Behavioral description:**
When `installMode === 'copy'` (L266-275), the installer skips the canonical directory entirely:
```
await cleanAndCreateDirectory(agentDir);
await copyDirectory(skill.path, agentDir);
```
The `agentDir` for Devin would be `<cwd>/.devin/skills/<skill-name>`. No symlink or canonical directory is involved.

**Evidence requirements:**
1. Call `installSkillForAgent(skill, 'devin', { cwd: tmpDir, mode: 'copy' })`
2. Assert `result.success === true`
3. Assert `result.mode === 'copy'`
4. Assert `result.canonicalPath` is `undefined`
5. Assert `result.path` ends with `.devin/skills/<skill-name>`
6. Assert `.devin/skills/<skill-name>/SKILL.md` exists
7. Assert `.agents/skills/<skill-name>` does NOT exist (no canonical copy in copy mode)

**Tool specification:**
```bash
pnpm test -- --run  # New test following installer-symlink.test.ts patterns
```

---

## VAL-INT-003: `installSkillForAgent` handles global installation for Devin

**Title:** Global install writes to `~/.config/devin/skills/` with symlink from canonical

**Behavioral description:**
For global installation (`global: true`), `getAgentBaseDir` (L80-97):
- Checks `isUniversalAgent('devin')` -> `false` (since `skillsDir !== '.agents/skills'`)
- Checks `global` -> `true`
- Returns `agent.globalSkillsDir` which should be `join(configHome, 'devin/skills')` = `~/.config/devin/skills`

The canonical base for global is `join(homedir(), '.agents', 'skills')`.

Since Devin supports global (mission specifies `globalSkillsDir: ~/.config/devin/skills`), the `agent.globalSkillsDir === undefined` check at L222-229 must NOT trigger.

**Evidence requirements:**
1. `agents.devin.globalSkillsDir` is defined (not undefined)
2. For global install, `getAgentBaseDir('devin', true)` returns `~/.config/devin/skills`
3. `getCanonicalSkillsDir(true)` returns `~/.agents/skills`
4. Installation does not produce "does not support global skill installation" error
5. Note: actual global install test requires mocking to avoid writing to real home dir

**Tool specification:**
```bash
pnpm test -- --run  # Unit tests should verify global path resolution
# Cannot safely test actual global writes in CI
```

**Boundary cases:**
- If `$XDG_CONFIG_HOME` is set, `configHome` changes, and globalSkillsDir changes accordingly
- The installer's early return for universal+global agents (L284-291) must NOT trigger for Devin

---

## VAL-INT-004: `discoverSkills()` finds skills in `.devin/skills/`

**Title:** Skills placed in `.devin/skills/<name>/SKILL.md` are discovered

**Behavioral description:**
`discoverSkills()` in `src/skills.ts` (L108-224) scans the `prioritySearchDirs` array (L153-183) for subdirectories containing `SKILL.md`. Currently, the array includes paths like:
```typescript
join(searchPath, '.claude/skills'),
join(searchPath, '.windsurf/skills'),
// ... etc
```

For Devin skills to be discoverable when running `skills add <local-path>` or browsing a repo, the path `join(searchPath, '.devin/skills')` must be present in `prioritySearchDirs`.

**Current state:** `.devin/skills` is NOT in the `prioritySearchDirs` array (confirmed by grep). The array at L153-183 lists 30+ agent skill directories but does not include `.devin/skills`.

**Evidence requirements:**
1. After modification, `grep "'\\.devin/skills'" src/skills.ts` matches within the `prioritySearchDirs` block
2. Create a test project with `.devin/skills/my-skill/SKILL.md`
3. Call `discoverSkills(projectPath)` and assert `my-skill` is in the results
4. Skills with valid frontmatter (name + description) in `.devin/skills/` are returned
5. Skills without valid frontmatter are excluded

**Tool specification:**
```bash
grep ".devin/skills" src/skills.ts    # Must match in prioritySearchDirs
pnpm test -- --run                    # Discovery tests
```

**Boundary cases:**
- The `prioritySearchDirs` are searched in order; `.devin/skills` should be in alphabetical position for consistency
- If a skill with the same `name` appears in both `.agents/skills/` and `.devin/skills/`, the `seenNames` deduplication (L114, L197) ensures only the first is kept
- The fallback recursive search (L211-222) would eventually find `.devin/skills/` skills even without priority listing, but priority listing ensures consistent ordering and faster discovery

---

## VAL-INT-005: `.devin/skills` is in the `prioritySearchDirs` array

**Title:** Priority discovery array explicitly includes `.devin/skills`

**Behavioral description:**
The `prioritySearchDirs` array (src/skills.ts L153-183) is a hardcoded list of directories. This is the primary scan path for `discoverSkills()`. Every non-universal agent's `skillsDir` should appear here for first-class discovery. Currently the array contains entries like:
```typescript
join(searchPath, '.cline/skills'),    // not present because cline uses .agents/skills
join(searchPath, '.codebuddy/skills'),
join(searchPath, '.continue/skills'),
```

Note the array also hardcodes `.agents/skills` (L159) but does NOT include all universal agents' paths (since universal agents share `.agents/skills`). The array includes some universal agents under their own name (e.g., `.github/skills` is listed even though GitHub Copilot now uses `.agents/skills`).

For consistency and per mission requirements, `join(searchPath, '.devin/skills')` must be added.

**Current state:** NOT present. Line-by-line inspection of L153-183 confirms no `.devin/` entry.

**Evidence requirements:**
1. `grep "'\\.devin/skills'" src/skills.ts` returns at least one line within the `prioritySearchDirs` definition (approximately L153-183)
2. The entry follows the pattern `join(searchPath, '.devin/skills')` exactly
3. The entry is positioned alphabetically (between `.continue/skills` at ~L166 and `.github/skills` at ~L167, or after `.codebuddy/skills`)
4. No other entries are removed or modified

**Tool specification:**
```bash
grep -n ".devin/skills" src/skills.ts
# Line number should be between 153 and 183 (or nearby, accounting for insertion shifts)
```

---

## VAL-INT-006: CLI agent validation accepts 'devin'

**Title:** `skills add <repo> -a devin` recognizes the agent

**Behavioral description:**
In `src/add.ts`, agent validation occurs at two code paths:

1. **Well-known handler** (L536-549):
```typescript
const validAgents = Object.keys(agents);
if (options.agent?.includes('*')) {
  targetAgents = validAgents as AgentType[];
} else if (options.agent && options.agent.length > 0) {
  const invalidAgents = options.agent.filter((a) => !validAgents.includes(a));
  if (invalidAgents.length > 0) {
    p.log.error(`Invalid agents: ${invalidAgents.join(', ')}`);
    process.exit(1);
  }
  targetAgents = options.agent as AgentType[];
}
```

2. **Standard handler** (L1217-1234):
Same pattern: `Object.keys(agents)` is checked against `options.agent`.

Since `Object.keys(agents)` dynamically reads the `agents` record, adding a `devin` key to `agents` in `src/agents.ts` automatically makes `'-a devin'` valid. No separate CLI registration is needed.

3. **List command** (src/list.ts L73-86):
Same pattern: validates `options.agent` against `Object.keys(agents)`.

**Evidence requirements:**
1. `Object.keys(agents).includes('devin')` returns `true`
2. Running with `-a devin` does NOT produce "Invalid agents: devin" error
3. `skills list -a devin` does not error
4. `skills add <source> -a devin --list` shows "devin" as valid

**Tool specification:**
```bash
pnpm test -- --run  # Tests covering agent validation
# Manual check: node bin/cli.mjs list -a devin (should not error on validation)
```

**Boundary cases:**
- `-a devin` should NOT match `-a devin-terminal` or any variant
- `--agent '*'` wildcard must include 'devin' (it's in `Object.keys(agents)`)
- When no `-a` flag is provided, `detectInstalledAgents()` must be able to detect devin (see VAL-REG-011)

---

## VAL-INT-007: README agent table includes "Devin for Terminal"

**Title:** README.md supported-agents table has a Devin row

**Behavioral description:**
`scripts/sync-agents.ts` generates the agent table via `generateAvailableAgentsTable()` (L22-61). This function:
1. Groups agents by path combo (`${skillsDir}|${globalSkillsDir}`)
2. For each group, generates a table row with: display names, `--agent` keys, project path, global path

After running `bun scripts/sync-agents.ts`, the `<!-- supported-agents:start -->` section (README.md L227-273) must contain a row for Devin.

Since Devin has unique paths (`.devin/skills` + `~/.config/devin/skills`), it will be its own row, not grouped with any existing agent.

**Current state:** No mention of "Devin", "devin", or ".devin" in README.md agent table (confirmed by grep).

**Expected row (approximate):**
```
| Devin for Terminal | `devin` | `.devin/skills/` | `~/.config/devin/skills/` |
```

**Evidence requirements:**
1. After running `bun scripts/sync-agents.ts`, `grep "Devin for Terminal" README.md` matches exactly one line
2. The row contains `\`devin\`` as the `--agent` value
3. The row contains `\`.devin/skills/\`` as the project path
4. The row contains `\`~/.config/devin/skills/\`` as the global path
5. The agent count in `<!-- agent-list:start -->` increments (currently says "[N-4] more", N will be total agent count)
6. No existing agent rows are removed or corrupted

**Tool specification:**
```bash
bun scripts/sync-agents.ts
grep "Devin for Terminal" README.md
grep "devin" README.md | head -5
```

---

## VAL-INT-008: README skill-discovery section includes `.devin/skills/`

**Title:** Skill discovery paths in README list `.devin/skills/`

**Behavioral description:**
`scripts/sync-agents.ts` function `generateSkillDiscoveryPaths()` (L64-78) generates the discovery paths list:
```typescript
const agentPaths = [...new Set(Object.values(agents).map((a) => a.skillsDir))].map(
  (p) => `- \`.${p.startsWith('.') ? p.slice(1) : '/' + p}/\``
);
```

This creates a deduplicated set of all unique `skillsDir` values. Since Devin's `skillsDir` is `.devin/skills`, the output will include:
```
- `.devin/skills/`
```

The `<!-- skill-discovery:start -->` section (README.md L336-374) will be updated.

**Evidence requirements:**
1. After running `bun scripts/sync-agents.ts`, `grep ".devin/skills" README.md` matches at least one line in the skill-discovery section
2. The entry format is `- \`.devin/skills/\``
3. No existing discovery paths are removed

**Tool specification:**
```bash
bun scripts/sync-agents.ts
grep ".devin/skills" README.md
```

---

## VAL-INT-009: package.json keywords include "devin"

**Title:** package.json keywords array contains "devin"

**Behavioral description:**
`scripts/sync-agents.ts` function `generateKeywords()` (L80-84):
```typescript
function generateKeywords(): string[] {
  const baseKeywords = ['cli', 'agent-skills', 'skills', 'ai-agents'];
  const agentKeywords = Object.keys(agents);
  return [...baseKeywords, ...agentKeywords];
}
```

This concatenates base keywords with all agent keys from the `agents` record. Since `'devin'` will be a key in `agents`, it will automatically appear in the keywords array.

The keywords are written to `package.json` at L110-112:
```typescript
pkg.keywords = generateKeywords();
writeFileSync(PACKAGE_PATH, JSON.stringify(pkg, null, 2) + '\n');
```

**Current state:** `package.json` keywords (L34-84) currently list 46 agent names. `"devin"` is NOT present.

**Evidence requirements:**
1. After running `bun scripts/sync-agents.ts`, `grep '"devin"' package.json` matches exactly one line
2. The keyword appears within the `"keywords"` array
3. All existing keywords are preserved (no removals)
4. Total keyword count increases by 1

**Tool specification:**
```bash
bun scripts/sync-agents.ts
grep '"devin"' package.json
# Count keywords: jq '.keywords | length' package.json
```

---

## VAL-INT-010: `skills list` shows skills installed to `.devin/skills/`

**Title:** `listInstalledSkills` scans `.devin/skills/` and attributes skills to Devin

**Behavioral description:**
`listInstalledSkills()` in `src/installer.ts` (L828-1054) scans multiple directories:

1. **Canonical dir** (L876): `.agents/skills/` and `~/.agents/skills/`
2. **Agent-specific dirs** (L879-889): For each detected agent, scans its `skillsDir`
3. **All agent dirs** (L895-905): Scans ALL agents' directories (even undetected ones) if they exist on disk

For Devin, when `detectInstalledAgents()` includes `'devin'` (because `~/.config/devin` exists):
- L879-889 adds `join(cwd, '.devin/skills')` to the scan scopes
- Skills found there are attributed to `'devin'`

Even when Devin is NOT detected (no `~/.config/devin`), L895-905 still checks if `.devin/skills/` exists on disk:
```typescript
const allAgentTypes = Object.keys(agents) as AgentType[];
for (const agentType of allAgentTypes) {
  if (agentsToCheck.includes(agentType)) continue;
  // ...
  if (existsSync(agentDir)) {
    scopes.push({ global: isGlobal, path: agentDir, agentType });
  }
}
```

So if `.devin/skills/` exists in a project (like THIS repo), skills there will be found regardless of whether Devin is detected.

**Evidence requirements:**
1. Create test dir with `.devin/skills/test-skill/SKILL.md`
2. Mock `detectInstalledAgents()` to return `['devin']`
3. Call `listInstalledSkills({ global: false, cwd: testDir })`
4. Assert result includes the test skill
5. Assert `skill.agents` contains `'devin'`
6. Also test with Devin NOT detected but `.devin/skills/` existing on disk - skill should still be found (L895-905)

**Tool specification:**
```bash
pnpm test -- --run tests/list-installed.test.ts
# New test should follow pattern from L145-162 (mocking detectInstalledAgents)
```

**Boundary cases:**
- Skills found via agent-specific dir scan (L938-955) are attributed directly to `scope.agentType`
- Skills found via canonical dir scan (L958-1027) check ALL agents for the skill
- Deduplication by `skillKey` = `${scopeKey}:${skill.name}` prevents double-listing
- When filtering with `-a devin`, only `'devin'` is in `agentFilter`, so only Devin's paths are scanned

---

## VAL-INT-011: `listInstalledSkills` JSON output includes Devin agent name

**Title:** JSON list mode shows "Devin for Terminal" in agent names

**Behavioral description:**
`src/list.ts` `runList()` (L94-102) in JSON mode maps agent types to display names:
```typescript
const jsonOutput = installedSkills.map((skill) => ({
  // ...
  agents: skill.agents.map((a) => agents[a].displayName),
}));
```

When a skill has `agents: ['devin']`, the JSON output will show `"Devin for Terminal"`.

**Evidence requirements:**
1. A skill attributed to `'devin'` shows `"Devin for Terminal"` in JSON output
2. No error when `agents[a].displayName` is accessed for `a = 'devin'`

**Tool specification:**
```bash
pnpm test -- --run
```

---

## VAL-INT-012: selectAgentsInteractive includes Devin in non-universal list

**Title:** Devin appears in the interactive agent selection prompt

**Behavioral description:**
`selectAgentsInteractive()` in `src/add.ts` (L356-412):
1. Calls `getUniversalAgents()` and `getNonUniversalAgents()`
2. Universal agents are shown as a locked section
3. Non-universal agents are shown as selectable choices

Since Devin is non-universal (`skillsDir !== '.agents/skills'`), it appears in `getNonUniversalAgents()` and thus in the selectable choices. The hint shows `agents[a].skillsDir` = `.devin/skills` for project installs, or `agents[a].globalSkillsDir` for global.

**Evidence requirements:**
1. `getNonUniversalAgents()` includes `'devin'`
2. `getUniversalAgents()` does NOT include `'devin'`
3. In interactive mode, Devin appears as a selectable option (not locked)
4. The hint shows `.devin/skills` (project) or `~/.config/devin/skills` (global)

**Tool specification:**
```bash
pnpm test -- --run  # Unit tests for agent classification
```

---

## VAL-INT-013: End-to-end: agent config + installer + discovery work together

**Title:** Cross-area integration: Devin agent config, installer, and discovery are consistent

**Behavioral description:**
This is a cross-cutting validation that ensures all three subsystems agree:

1. **Agent config** (`src/agents.ts`): `agents.devin.skillsDir === '.devin/skills'`
2. **Installer** (`src/installer.ts`): `getAgentBaseDir('devin', false, cwd)` returns `join(cwd, '.devin/skills')`
3. **Discovery** (`src/skills.ts`): `prioritySearchDirs` includes `join(searchPath, '.devin/skills')`
4. **List** (`src/installer.ts`): `listInstalledSkills` scans `join(cwd, '.devin/skills')`

If any of these are inconsistent (e.g., installer writes to `.devin/skills/` but discovery doesn't search there), skills will be installed but invisible.

**Evidence requirements:**
1. `agents.devin.skillsDir` === the path used in `prioritySearchDirs`
2. `getAgentBaseDir('devin', false, cwd)` returns `join(cwd, agents.devin.skillsDir)`
3. `discoverSkills()` on a repo with `.devin/skills/<name>/SKILL.md` finds the skill
4. `listInstalledSkills()` on a project with `.devin/skills/<name>/SKILL.md` finds the skill
5. `installSkillForAgent(skill, 'devin', { mode: 'symlink' })` creates a symlink at `.devin/skills/<name>` -> `.agents/skills/<name>`
6. After installation, both `discoverSkills()` and `listInstalledSkills()` find the skill

**Tool specification:**
```bash
# Comprehensive integration test:
# 1. Create temp project
# 2. Install a skill for 'devin' via installSkillForAgent
# 3. Run discoverSkills on the project - verify skill found
# 4. Run listInstalledSkills on the project - verify skill found with 'devin' attribution
pnpm test -- --run
```

**Boundary cases:**
- If `skillsDir` in config doesn't match the discovery path, skills are "invisible"
- If installer writes to wrong path, skills can't be found
- Symlink resolution: when `.devin/skills/<name>` is a symlink to `.agents/skills/<name>`, both `discoverSkills()` and `listInstalledSkills()` must resolve through it correctly

---

## VAL-INT-014: `installRemoteSkillForAgent` and `installWellKnownSkillForAgent` work for 'devin'

**Title:** All installer variants support Devin agent

**Behavioral description:**
There are four install functions in `src/installer.ts`:
1. `installSkillForAgent` (L212) — local skill directories
2. `installRemoteSkillForAgent` (L453) — remote skills (single SKILL.md)
3. `installWellKnownSkillForAgent` (L572) — well-known skills (multi-file)
4. `installBlobSkillForAgent` (L707) — blob-downloaded skills

All four follow the same pattern:
```typescript
const agent = agents[agentType];  // Must compile for 'devin'
const agentBase = getAgentBaseDir(agentType, isGlobal, cwd);
const agentDir = join(agentBase, skillName);
```

Since they all use `agents[agentType]` and `getAgentBaseDir()`, they will all correctly resolve Devin's paths as long as the agent config is registered. No function-specific modifications are needed.

**Evidence requirements:**
1. TypeScript compiles all four functions with `agentType = 'devin'`
2. Each function respects `isGlobal` and returns correct paths for Devin
3. Symlink and copy modes both work for all four variants

**Tool specification:**
```bash
pnpm type-check   # Proves all functions accept 'devin' as AgentType
pnpm test -- --run # Tests verify path correctness
```

---

## VAL-INT-015: `isSkillInstalled` checks correct Devin path

**Title:** Skill existence check uses `.devin/skills/<name>` for Devin

**Behavioral description:**
`isSkillInstalled()` (src/installer.ts L379-408) checks:
```typescript
const targetBase = options.global
  ? agent.globalSkillsDir!
  : join(options.cwd || process.cwd(), agent.skillsDir);
const skillDir = join(targetBase, sanitized);
```

For Devin with `global: false`, this resolves to `<cwd>/.devin/skills/<skill-name>`.
For Devin with `global: true`, this resolves to `~/.config/devin/skills/<skill-name>`.

**Evidence requirements:**
1. `isSkillInstalled('my-skill', 'devin', { cwd: tmpDir })` checks `tmpDir/.devin/skills/my-skill`
2. Returns `true` when the directory exists
3. Returns `false` when it doesn't exist
4. Global mode checks `~/.config/devin/skills/my-skill`

**Tool specification:**
```bash
pnpm test -- --run
```

---

## VAL-INT-016: validate-agents.ts passes with Devin added

**Title:** Validation script accepts Devin without duplicate name errors

**Behavioral description:**
`scripts/validate-agents.ts` runs `checkDuplicateDisplayNames()` (L23-38) which collects all `displayName` values (case-insensitive) and checks for duplicates. "Devin for Terminal" must be unique.

The function `checkDuplicateSkillsDirs()` (L55-84) is defined but commented out at L91. If re-enabled, `.devin/skills` must also be unique (it is — no other agent uses it).

**Evidence requirements:**
1. `bun scripts/validate-agents.ts` exits with code 0
2. Output contains "All agents valid."
3. No "Duplicate displayName" errors
4. No existing agent is broken by the addition

**Tool specification:**
```bash
bun scripts/validate-agents.ts
echo $?  # Must be 0
```

---

## VAL-INT-017: sync-agents.ts updates all four README sections

**Title:** Sync script correctly updates agent list, table, discovery paths, and keywords

**Behavioral description:**
`scripts/sync-agents.ts` `main()` (L99-115) performs four replacements:

1. **`agent-list`** (L102): `generateAgentList()` counts agents and produces a summary sentence. The count increases by 1.
2. **`agent-names`** (L103): Static text, no change needed.
3. **`supported-agents`** (L104): `generateAvailableAgentsTable()` generates the full agent table. Devin gets its own row.
4. **`skill-discovery`** (L105): `generateSkillDiscoveryPaths()` lists unique `skillsDir` values. `.devin/skills` is added.

Then updates `package.json` keywords (L110-112).

**Evidence requirements:**
1. `bun scripts/sync-agents.ts` completes without error
2. All four README sections are correctly updated
3. `package.json` keywords are updated
4. Running the script is idempotent (running twice produces same output)
5. No data loss (all existing agents remain)

**Tool specification:**
```bash
bun scripts/sync-agents.ts
# Verify all sections:
grep -c "Devin for Terminal" README.md   # Must be >= 1
grep -c ".devin/skills" README.md        # Must be >= 1
grep -c '"devin"' package.json           # Must be 1
```

---

## VAL-INT-018: Test patterns for new installer tests

**Title:** New tests follow established patterns from existing test files

**Behavioral description:**
The existing test patterns provide templates for new Devin-specific tests:

### Pattern from `tests/installer-symlink.test.ts`:
```typescript
// Setup:
const root = await mkdtemp(join(tmpdir(), 'add-skill-'));
const projectDir = join(root, 'project');
await mkdir(projectDir, { recursive: true });
const skillDir = await makeSkillSource(root, skillName);

// Test:
const result = await installSkillForAgent(
  { name: skillName, description: 'test', path: skillDir },
  'agent-name',  // Replace with 'devin'
  { cwd: projectDir, mode: 'symlink', global: false }
);

// Assert:
expect(result.success).toBe(true);

// Cleanup:
await rm(root, { recursive: true, force: true });
```

Key test patterns:
- L29-58: Universal agent (same canonical/agent path) — no symlink created
- L60-89: Pre-existing self-loop cleanup
- L92-148: Agent skills dir is symlink to canonical dir
- L150-189: Universal-only global install

### Pattern from `tests/list-installed.test.ts`:
```typescript
// Setup:
const testDir = join(tmpdir(), `add-skill-test-${Date.now()}-...`);
await mkdir(testDir, { recursive: true });

// Create skill:
const skillDir = join(basePath, '.agents', 'skills', skillName);
// For Devin, use: join(basePath, '.devin', 'skills', skillName)

// Mock detection:
vi.spyOn(agentsModule, 'detectInstalledAgents').mockResolvedValue(['devin']);

// Test:
const skills = await listInstalledSkills({ global: false, cwd: testDir });

// Assert:
expect(skills[0]!.agents).toContain('devin');
```

### Pattern from `tests/xdg-config-paths.test.ts`:
```typescript
describe('Devin', () => {
  it('uses ~/.config/devin/skills for global skills', () => {
    const expected = join(home, '.config', 'devin', 'skills');
    expect(agents.devin.globalSkillsDir).toBe(expected);
  });
});
```

**Evidence requirements:**
1. New Devin installer tests follow the `makeSkillSource` + `installSkillForAgent` + cleanup pattern
2. New list tests follow the `createSkillDir` + mock + `listInstalledSkills` pattern
3. New XDG tests follow the `agents.<name>.globalSkillsDir` assertion pattern
4. All new tests use `try/finally` for cleanup (critical for temp directories)
5. No tests modify real home directory or existing `.devin/skills/` content

**Tool specification:**
```bash
pnpm test -- --run  # All tests pass including new ones
```

---

## VAL-INT-019: Devin-specific symlink test (non-universal agent pattern)

**Title:** Symlink from `.agents/skills/<name>` to `.devin/skills/<name>` is created correctly

**Behavioral description:**
This is the critical test for Devin as a non-universal agent. Unlike universal agents (amp, cursor, codex) where `agentDir === canonicalDir` (both `.agents/skills`), Devin has:
- `canonicalDir` = `<cwd>/.agents/skills/<skill>`
- `agentDir` = `<cwd>/.devin/skills/<skill>`

The installer must create a real symlink at `agentDir` pointing to `canonicalDir`. This is the same pattern as Claude Code (`.claude/skills`), Windsurf (`.windsurf/skills`), etc.

**Evidence requirements:**
1. After installation, `lstat(agentDir)` shows `isSymbolicLink() === true`
2. `readlink(agentDir)` resolves to `canonicalDir` (either absolute or relative)
3. Reading `join(agentDir, 'SKILL.md')` succeeds (symlink works)
4. Reading `join(canonicalDir, 'SKILL.md')` succeeds (source exists)
5. Both paths contain identical SKILL.md content

**Tool specification:**
```bash
pnpm test -- --run tests/installer-symlink.test.ts
# New test case modeled after L92-148 (claude-code test) but for 'devin'
```

**Pattern reference (L92-148 adapted for Devin):**
```typescript
it('creates symlink from .agents/skills to .devin/skills for devin agent', async () => {
  const root = await mkdtemp(join(tmpdir(), 'add-skill-'));
  const projectDir = join(root, 'project');
  await mkdir(projectDir, { recursive: true });
  const skillDir = await makeSkillSource(root, 'devin-test-skill');

  try {
    const result = await installSkillForAgent(
      { name: 'devin-test-skill', description: 'test', path: skillDir },
      'devin',
      { cwd: projectDir, mode: 'symlink', global: false }
    );

    expect(result.success).toBe(true);
    expect(result.symlinkFailed).toBeUndefined();

    // Canonical should be a real directory
    const canonicalDir = join(projectDir, '.agents/skills', 'devin-test-skill');
    const canonStats = await lstat(canonicalDir);
    expect(canonStats.isDirectory()).toBe(true);

    // Agent dir should be a symlink
    const agentDir = join(projectDir, '.devin/skills', 'devin-test-skill');
    const agentStats = await lstat(agentDir);
    expect(agentStats.isSymbolicLink()).toBe(true);

    // Content should be accessible via both paths
    const canonContent = await readFile(join(canonicalDir, 'SKILL.md'), 'utf-8');
    const agentContent = await readFile(join(agentDir, 'SKILL.md'), 'utf-8');
    expect(canonContent).toContain('devin-test-skill');
    expect(agentContent).toBe(canonContent);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
```

---

## Summary: Assertion Checklist

| ID | Title | Category | Depends On |
|----|-------|----------|------------|
| VAL-INT-001 | Symlink install for 'devin' | Installer | VAL-REG-002, VAL-REG-004 |
| VAL-INT-002 | Copy install for 'devin' | Installer | VAL-REG-002 |
| VAL-INT-003 | Global install for 'devin' | Installer | VAL-REG-002, VAL-REG-003 |
| VAL-INT-004 | `discoverSkills()` finds `.devin/skills/` | Discovery | VAL-INT-005 |
| VAL-INT-005 | `.devin/skills` in `prioritySearchDirs` | Discovery | VAL-REG-009 |
| VAL-INT-006 | CLI `-a devin` accepted | CLI | VAL-REG-001, VAL-REG-002 |
| VAL-INT-007 | README agent table has Devin | Documentation | VAL-REG-002, VAL-REG-007 |
| VAL-INT-008 | README discovery paths has `.devin/skills/` | Documentation | VAL-REG-007 |
| VAL-INT-009 | package.json keywords has "devin" | Documentation | VAL-REG-007 |
| VAL-INT-010 | `skills list` shows `.devin/skills/` skills | List | VAL-REG-002 |
| VAL-INT-011 | JSON list includes Devin display name | List | VAL-INT-010 |
| VAL-INT-012 | Interactive selection includes Devin | CLI | VAL-REG-004, VAL-REG-005 |
| VAL-INT-013 | End-to-end cross-area consistency | Integration | VAL-INT-001, VAL-INT-004, VAL-INT-010 |
| VAL-INT-014 | All installer variants support Devin | Installer | VAL-REG-001, VAL-REG-002 |
| VAL-INT-015 | `isSkillInstalled` checks Devin path | Installer | VAL-REG-002 |
| VAL-INT-016 | validate-agents.ts passes | Scripts | VAL-REG-006 |
| VAL-INT-017 | sync-agents.ts updates all sections | Scripts | VAL-REG-007 |
| VAL-INT-018 | Test patterns documented | Testing | — |
| VAL-INT-019 | Devin-specific symlink test | Installer | VAL-INT-001 |

---

## Key Code Paths Requiring Modification

1. **`src/skills.ts` L153-183:** Add `join(searchPath, '.devin/skills')` to `prioritySearchDirs` array. Insert alphabetically (after `.continue/skills` or `.codebuddy/skills`, before `.github/skills`).

2. **`scripts/sync-agents.ts`:** No code changes needed — it reads from `agents` record dynamically. Just needs to be **run** after agent registration.

3. **`scripts/validate-agents.ts`:** No code changes needed — just needs to be **run** after agent registration.

4. **`README.md`:** No manual edits — updated automatically by `sync-agents.ts`.

5. **`package.json`:** No manual edits to keywords — updated automatically by `sync-agents.ts`.

---

## Key Design Decisions to Verify

1. **Symlink direction:** Canonical `.agents/skills/<skill>` is the SOURCE. Agent-specific `.devin/skills/<skill>` is the SYMLINK. This is the correct direction for non-universal agents.

2. **Path consistency:** `agents.devin.skillsDir` (`.devin/skills`) must match:
   - The `prioritySearchDirs` entry in `src/skills.ts`
   - The path computed by `getAgentBaseDir('devin', false, cwd)`
   - The path scanned by `listInstalledSkills()`
   - The path shown in the README agent table

3. **No circular symlinks:** When canonical and agent paths are the same (universal agents), the installer detects this via `realpath` comparison (L153-158) and skips symlink creation. This does NOT apply to Devin since its paths differ.

4. **Existing `.devin/skills/` content:** This repo already has `.devin/skills/` with 10 mission-planning skills. These are REAL Devin skills used by the project. The `skillsDir: '.devin/skills'` config is correct. Tests must NOT modify this content (mission.md: "Off-limits: Existing `.devin/skills/` content").
