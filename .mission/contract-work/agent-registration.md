# Validation Contract: Agent Registration & Type System

**Area:** Agent Registration & Type System
**Scope:** Registering `'devin'` as a new non-universal agent in the skills CLI
**Baseline:** 46 agents currently defined (45 named + `universal`)

---

## Source Files Under Modification

| File | Role |
|------|------|
| `src/types.ts` | `AgentType` union type definition (lines 1-46) |
| `src/agents.ts` | Agent config objects, helper functions (lines 1-483) |
| `src/skills.ts` | Skill discovery priority paths (lines 153-183) |
| `scripts/validate-agents.ts` | Validates no duplicate displayNames |
| `scripts/sync-agents.ts` | Syncs agent list to README.md and package.json keywords |

---

## VAL-REG-001: `'devin'` exists in AgentType union

**Title:** Type system includes 'devin' literal

**Behavioral description:**
The `AgentType` union type in `src/types.ts` must include `'devin'` as a string literal member. The union is defined as a series of `| 'name'` entries (lines 1-46). After modification, `'devin'` must be present exactly once. TypeScript compilation (`tsc --noEmit`) must pass without new errors when `'devin'` is used as an `AgentType` value.

**Evidence requirements:**
1. `grep -c "'devin'" src/types.ts` returns exactly `1`
2. `pnpm type-check` produces no new errors (baseline: 6 pre-existing errors)
3. The literal `'devin'` appears within the `AgentType` union block (lines 1-46 of `src/types.ts`)

**Tool specification:**
```bash
grep "'devin'" src/types.ts          # Must match exactly one line
pnpm type-check 2>&1 | tail -5      # No new errors beyond baseline 6
```

**Boundary cases:**
- Must be `'devin'` not `'devin-terminal'` or `'devin-for-terminal'` (per mission.md requirement)
- Must not duplicate any existing member
- Alphabetical insertion is preferred (between `'deepagents'` and `'droid'`) for consistency, though not strictly required by the type system

---

## VAL-REG-002: Agent config object completeness

**Title:** Devin config has all required fields with correct values

**Behavioral description:**
The `agents` record in `src/agents.ts` must contain a `devin` key with an `AgentConfig` object. Per the interface in `src/types.ts` (lines 59-68), the required fields are:
- `name: string` - Must be `'devin'`
- `displayName: string` - Must be `'Devin for Terminal'`
- `skillsDir: string` - Must be `'.devin/skills'`
- `globalSkillsDir: string | undefined` - Must resolve to `~/.config/devin/skills` (XDG-style, using `configHome`)
- `detectInstalled: () => Promise<boolean>` - Must be an async function

**Evidence requirements:**
1. `agents.devin` exists and compiles without type errors
2. `agents.devin.name === 'devin'`
3. `agents.devin.displayName === 'Devin for Terminal'`
4. `agents.devin.skillsDir === '.devin/skills'`
5. `agents.devin.globalSkillsDir` equals `join(configHome, 'devin/skills')` which resolves to `~/.config/devin/skills`
6. `agents.devin.detectInstalled` is a function returning a Promise<boolean>
7. No `showInUniversalList` property set (defaults to `true`, which is correct for non-universal agents displayed in universal list)

**Tool specification:**
```bash
grep -A 10 "devin:" src/agents.ts    # Inspect config block
pnpm type-check                       # No new type errors
pnpm test -- --run                    # Tests validating config
```

**Pattern reference (Windsurf - lines 386-394):**
```typescript
windsurf: {
  name: 'windsurf',
  displayName: 'Windsurf',
  skillsDir: '.windsurf/skills',
  globalSkillsDir: join(home, '.codeium/windsurf/skills'),
  detectInstalled: async () => {
    return existsSync(join(home, '.codeium/windsurf'));
  },
},
```

**Pattern reference (Goose - XDG-style, lines 205-213):**
```typescript
goose: {
  name: 'goose',
  displayName: 'Goose',
  skillsDir: '.goose/skills',
  globalSkillsDir: join(configHome, 'goose/skills'),
  detectInstalled: async () => {
    return existsSync(join(configHome, 'goose'));
  },
},
```

**Expected Devin config (XDG-style, matching Goose/Amp/OpenCode pattern):**
```typescript
devin: {
  name: 'devin',
  displayName: 'Devin for Terminal',
  skillsDir: '.devin/skills',
  globalSkillsDir: join(configHome, 'devin/skills'),
  detectInstalled: async () => {
    return existsSync(join(configHome, 'devin'));
  },
},
```

---

## VAL-REG-003: Detection function correctness

**Title:** `detectInstalled` returns true/false based on `~/.config/devin` existence

**Behavioral description:**
Per mission.md: "Detection: check if `~/.config/devin` exists." The `detectInstalled` function must use `existsSync(join(configHome, 'devin'))` where `configHome` is `xdgConfig ?? join(home, '.config')` (defined at line 9 of agents.ts). This follows the same XDG pattern as Goose (`existsSync(join(configHome, 'goose'))`), Amp (`existsSync(join(configHome, 'amp'))`), and OpenCode (`existsSync(join(configHome, 'opencode'))`).

**Evidence requirements:**
1. The function body references `configHome` and `'devin'`
2. Returns `true` when `~/.config/devin` exists
3. Returns `false` when `~/.config/devin` does not exist
4. Uses `existsSync` (consistent with all other agents)
5. Function is async (returns `Promise<boolean>`)

**Tool specification:**
```bash
grep -A 3 "detectInstalled" src/agents.ts | grep -A 3 "devin"
# Unit test should mock existsSync or fs to verify both branches
pnpm test -- --run
```

**Boundary cases:**
- Must use `configHome` (not hardcoded `join(home, '.config')`) to respect `$XDG_CONFIG_HOME` env var
- Must not check `process.cwd()` for detection (unlike `codebuddy` and `continue` which check cwd)
- Must not accidentally match `.devin/skills/` in the project (that's the skillsDir, not detection)

---

## VAL-REG-004: Non-universal classification

**Title:** `isUniversalAgent('devin')` returns `false`

**Behavioral description:**
Since `skillsDir` is `'.devin/skills'` (not `'.agents/skills'`), the function `isUniversalAgent('devin')` (line 481-483) must return `false`. The function checks `agents[type].skillsDir === '.agents/skills'`; since `'.devin/skills' !== '.agents/skills'`, this returns `false`.

**Evidence requirements:**
1. `agents.devin.skillsDir === '.devin/skills'` (not `.agents/skills`)
2. `isUniversalAgent('devin')` returns `false`
3. Unit test explicitly asserts `isUniversalAgent('devin') === false`

**Tool specification:**
```bash
# Verify skillsDir value
grep "skillsDir.*devin" src/agents.ts
# Run test that checks classification
pnpm test -- --run
```

---

## VAL-REG-005: Appears in getNonUniversalAgents()

**Title:** `'devin'` included in non-universal agents list

**Behavioral description:**
`getNonUniversalAgents()` (lines 472-476) filters agents where `config.skillsDir !== '.agents/skills'`. Since Devin's `skillsDir` is `'.devin/skills'`, `'devin'` must appear in the returned array.

**Evidence requirements:**
1. `getNonUniversalAgents()` array includes `'devin'`
2. `getUniversalAgents()` array does NOT include `'devin'`
3. Unit tests assert both conditions

**Tool specification:**
```bash
pnpm test -- --run  # Tests should cover getNonUniversalAgents() inclusion
```

**Boundary cases:**
- `'devin'` must NOT appear in `getUniversalAgents()` (would cause incorrect install behavior)
- When `options.agent` is `['*']`, `'devin'` should be included (since it's in `Object.keys(agents)`)

---

## VAL-REG-006: validate-agents.ts passes

**Title:** Validation script accepts Devin without errors

**Behavioral description:**
`scripts/validate-agents.ts` currently runs `checkDuplicateDisplayNames()` (lines 23-38). It iterates all entries in the `agents` record and checks that no two agents share the same `displayName` (case-insensitive). The `checkDuplicateSkillsDirs()` function exists but is commented out (line 91). Devin must have a unique `displayName` ('Devin for Terminal') that doesn't conflict with any existing agent.

**Evidence requirements:**
1. `bun scripts/validate-agents.ts` exits with code 0
2. Output contains "All agents valid."
3. No "Duplicate displayName" errors mentioning "devin for terminal"

**Tool specification:**
```bash
bun scripts/validate-agents.ts
echo $?   # Must be 0
```

**Boundary cases:**
- Display name `'Devin for Terminal'` must not collide with any existing name (none currently match)
- If `checkDuplicateSkillsDirs` were re-enabled, `.devin/skills` must be unique as a skillsDir (currently no other agent uses it)
- The `globalSkillsDir` `~/.config/devin/skills` must be unique (no other agent currently uses it)

---

## VAL-REG-007: sync-agents.ts includes Devin

**Title:** Sync script propagates Devin to README and package.json

**Behavioral description:**
`scripts/sync-agents.ts` performs four operations:
1. **Agent list** (line 102): Updates `<!-- agent-list:start -->` section with agent count
2. **Agent table** (line 104): Generates `<!-- supported-agents:start -->` table with all agents grouped by path
3. **Skill discovery paths** (line 105): Lists unique `skillsDir` values in `<!-- skill-discovery:start -->` section
4. **Package keywords** (lines 110-112): Sets `package.json` `keywords` to `['cli', 'agent-skills', 'skills', 'ai-agents', ...Object.keys(agents)]`

After running sync-agents.ts with Devin registered:

**Evidence requirements:**
1. `bun scripts/sync-agents.ts` completes without error
2. `README.md` agent count in `<!-- agent-list:start -->` section increments by 1 (from current count)
3. `README.md` `<!-- supported-agents:start -->` table contains a row with "Devin for Terminal" and `devin`
4. `README.md` `<!-- skill-discovery:start -->` section includes `.devin/skills/`
5. `package.json` `keywords` array contains `"devin"`
6. No existing agent entries are removed or corrupted

**Tool specification:**
```bash
bun scripts/sync-agents.ts
grep "devin" README.md                    # Must appear in agent table
grep "Devin for Terminal" README.md       # Display name in table
grep '"devin"' package.json               # In keywords array
grep ".devin/skills" README.md            # In skill discovery paths
```

---

## VAL-REG-008: No duplicate agent names or conflicting directories

**Title:** No name collisions, directory conflicts, or duplicate entries

**Behavioral description:**
The new `'devin'` agent must not create any collisions:
1. **AgentType uniqueness:** `'devin'` must appear exactly once in the `AgentType` union
2. **Agent key uniqueness:** `'devin'` must appear exactly once as a key in the `agents` record
3. **displayName uniqueness:** `'Devin for Terminal'` must not match any existing displayName (case-insensitive)
4. **skillsDir note:** `'.devin/skills'` is unique (no other agent uses it). While `checkDuplicateSkillsDirs` is commented out, uniqueness is preferred.
5. **globalSkillsDir note:** `~/.config/devin/skills` is unique. No other agent uses this path.
6. **No `.devin/skills` conflict with existing content:** The project already contains `.devin/skills/` with 10 mission-planning skills. The `skillsDir: '.devin/skills'` config means Devin will use `<project>/.devin/skills/` for project-level skills. This is correct and intentional - it's the same directory pattern. The existing `.devin/skills/` content in THIS repo are actual Devin skills.

**Evidence requirements:**
1. `grep -c "'devin'" src/types.ts` returns exactly `1`
2. `grep -c "devin:" src/agents.ts` returns exactly `1` (the key in the record)
3. No other agent has displayName `'Devin for Terminal'` (case-insensitive check)
4. `bun scripts/validate-agents.ts` passes (confirms no duplicate displayNames)
5. No other agent has `skillsDir: '.devin/skills'`
6. No other agent has `globalSkillsDir` resolving to `~/.config/devin/skills`

**Tool specification:**
```bash
grep "'devin'" src/types.ts | wc -l                          # Must be 1
grep "devin:" src/agents.ts | wc -l                          # Must be 1
grep -i "devin for terminal" src/agents.ts | wc -l           # Must be 1
grep "skillsDir.*'\\.devin/skills'" src/agents.ts | wc -l    # Must be 1
bun scripts/validate-agents.ts                                # Must pass
```

---

## VAL-REG-009: Skills discovery includes `.devin/skills`

**Title:** `.devin/skills/` is in skill discovery priority paths

**Behavioral description:**
`src/skills.ts` lines 153-183 define `prioritySearchDirs` - a hardcoded list of directories searched during `skills list` and skill discovery. Currently this list includes paths like `.windsurf/skills`, `.claude/skills`, etc. The path `join(searchPath, '.devin/skills')` must be added to this array for Devin skills to be discoverable.

**Evidence requirements:**
1. `grep "'\\.devin/skills'" src/skills.ts` matches at least one line within the `prioritySearchDirs` array
2. The path follows the `join(searchPath, '.devin/skills')` pattern consistent with other entries
3. Skills placed in `.devin/skills/<skill-name>/SKILL.md` are discoverable by `skills list`

**Tool specification:**
```bash
grep ".devin/skills" src/skills.ts   # Must appear in prioritySearchDirs
pnpm test -- --run                   # Integration tests verify discovery
```

**Boundary cases:**
- Path must be `.devin/skills` not `.devin` (the `/skills` suffix is essential)
- Must not conflict with or remove any existing priority path entries
- Alphabetical insertion preferred (after `.continue/skills`, before `.factory/skills` or `.github/skills`)

---

## VAL-REG-010: getAgentConfig('devin') returns correct config

**Title:** Agent config accessor works for Devin

**Behavioral description:**
`getAgentConfig(type: AgentType): AgentConfig` (line 451-453) simply returns `agents[type]`. Since TypeScript enforces that `type` must be a valid `AgentType`, calling `getAgentConfig('devin')` must:
1. Compile without type errors (proves `'devin'` is in `AgentType`)
2. Return the correct `AgentConfig` object with all specified field values

**Evidence requirements:**
1. `getAgentConfig('devin').name === 'devin'`
2. `getAgentConfig('devin').displayName === 'Devin for Terminal'`
3. `getAgentConfig('devin').skillsDir === '.devin/skills'`
4. `getAgentConfig('devin').globalSkillsDir` equals `join(configHome, 'devin/skills')`
5. TypeScript compiles `getAgentConfig('devin')` without error

**Tool specification:**
```bash
pnpm type-check   # Proves 'devin' is valid AgentType
pnpm test -- --run # Unit tests verify returned values
```

---

## VAL-REG-011: detectInstalledAgents includes/excludes Devin correctly

**Title:** Devin appears in detected agents only when ~/.config/devin exists

**Behavioral description:**
`detectInstalledAgents()` (lines 441-449) runs `detectInstalled()` for every agent in parallel and returns the list of agents where `detectInstalled()` returned `true`. When `~/.config/devin` exists on the machine, `'devin'` must be included in the result. When it doesn't exist, `'devin'` must not be included.

**Evidence requirements:**
1. When detection returns `true`, `detectInstalledAgents()` includes `'devin'`
2. When detection returns `false`, `detectInstalledAgents()` does not include `'devin'`
3. Adding Devin doesn't break detection of other agents

**Tool specification:**
```bash
pnpm test -- --run   # Tests should mock detection and verify behavior
```

---

## VAL-REG-012: CLI accepts `-a devin` without error

**Title:** The `--agent devin` / `-a devin` flag is accepted by all commands

**Behavioral description:**
The `add`, `list`, `remove`, and `experimental_sync` commands all validate agent names against `Object.keys(agents)` (see `src/add.ts` lines 536, 543-548). Since `'devin'` will be a key in the `agents` record, `-a devin` must be accepted as valid. The CLI must not produce "Invalid agents: devin" error.

**Evidence requirements:**
1. `skills add <source> -a devin -y` does not produce "Invalid agents" error
2. `skills list -a devin` does not produce "Invalid agents" error  
3. `skills remove <skill> -a devin -y` does not produce "Invalid agents" error

**Tool specification:**
```bash
pnpm test -- --run   # CLI integration tests
# Manual verification:
# pnpm dev add some-repo -a devin --list
```

---

## VAL-REG-013: Installer creates correct paths for Devin

**Title:** `getAgentBaseDir('devin', ...)` returns correct directories

**Behavioral description:**
`getAgentBaseDir(agentType, global, cwd)` in `src/installer.ts` (lines 80-97):
- For non-universal agents (like Devin), when `global=false`: returns `join(cwd, agent.skillsDir)` = `<cwd>/.devin/skills`
- When `global=true`: returns `agent.globalSkillsDir` = `~/.config/devin/skills`
- Since `isUniversalAgent('devin')` is `false`, it does NOT return the canonical `.agents/skills` directory

**Evidence requirements:**
1. `getAgentBaseDir('devin', false, '/tmp/project')` returns `/tmp/project/.devin/skills`
2. `getAgentBaseDir('devin', true)` returns `~/.config/devin/skills`
3. Non-universal agents get symlinks from canonical `.agents/skills/<skill>` to `.devin/skills/<skill>`

**Tool specification:**
```bash
pnpm test -- --run   # Installer tests should cover path resolution
```

---

## Summary: Assertion Checklist

| ID | Title | Category |
|----|-------|----------|
| VAL-REG-001 | `'devin'` in AgentType | Type System |
| VAL-REG-002 | Config completeness | Config |
| VAL-REG-003 | Detection correctness | Detection |
| VAL-REG-004 | Non-universal classification | Classification |
| VAL-REG-005 | In getNonUniversalAgents() | Classification |
| VAL-REG-006 | validate-agents.ts passes | Scripts |
| VAL-REG-007 | sync-agents.ts includes Devin | Scripts |
| VAL-REG-008 | No duplicates/conflicts | Boundary |
| VAL-REG-009 | Skills discovery paths | Discovery |
| VAL-REG-010 | getAgentConfig accessor | Config |
| VAL-REG-011 | detectInstalledAgents | Detection |
| VAL-REG-012 | CLI accepts -a devin | CLI |
| VAL-REG-013 | Installer path correctness | Installer |

---

## Key Design Decisions to Verify

1. **XDG vs home-based paths:** Mission specifies `~/.config/devin/skills` for globalSkillsDir. This means using `configHome` (XDG-style), matching Goose/Amp/OpenCode pattern - NOT `join(home, '.devin/skills')`.

2. **Detection path:** Mission says "check if `~/.config/devin` exists". This means `existsSync(join(configHome, 'devin'))`, using the `configHome` variable (line 9 of agents.ts).

3. **skillsDir is `.devin/skills`** (project-level, non-universal). This makes Devin a non-universal agent that gets symlinks from `.agents/skills/` canonical location.

4. **Existing `.devin/skills/` content:** The project repo already has `.devin/skills/` with 10 skills. These are NOT test fixtures - they are real Devin skills used by this project. The `skillsDir: '.devin/skills'` config is correct and means any project using Devin will store skills there.

5. **No `showInUniversalList` override needed:** The field defaults to `true` when unset. Non-universal agents with `showInUniversalList: true` (the default) appear in the universal agent selection prompt. Only `replit` and `universal` set this to `false`.
