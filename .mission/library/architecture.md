# Architecture: Skills CLI Agent System

## Overview
The skills CLI manages skill installation across 45+ AI agent platforms. Each agent has a config defining its directory paths and detection logic. This document describes the architecture relevant to adding a new agent.

## Key Files

### `src/types.ts` — Type Definitions
- `AgentType`: Union of all agent name string literals (e.g., `'cursor' | 'claude-code' | ...`)
- `AgentConfig`: Interface with `name`, `displayName`, `skillsDir`, `globalSkillsDir`, `detectInstalled`, `showInUniversalList?`

### `src/agents.ts` — Agent Registry
- `agents`: Record mapping `AgentType` → `AgentConfig`
- `configHome`: XDG config path (`$XDG_CONFIG_HOME` or `~/.config`)
- Helper functions: `getAgentConfig()`, `detectInstalledAgents()`, `getUniversalAgents()`, `getNonUniversalAgents()`, `isUniversalAgent()`
- **Universal agents** share `.agents/skills/`; **non-universal agents** use agent-specific directories (e.g., `.devin/skills/`)

### `src/installer.ts` — Skill Installation
- `installSkillForAgent()`: Core install function. For non-universal agents: copies to canonical `.agents/skills/<name>`, then symlinks from agent directory
- `getAgentBaseDir()`: Returns the agent's skill directory path (project or global)
- `getCanonicalSkillsDir()`: Returns `.agents/skills` (project) or `~/.agents/skills` (global)
- `listInstalledSkills()`: Scans all agent directories for installed skills

### `src/skills.ts` — Skill Discovery
- `discoverSkills()`: Searches `prioritySearchDirs` (hardcoded list of ~30 directories) for SKILL.md files
- `prioritySearchDirs` must include each non-universal agent's `skillsDir` for first-class discovery

### `scripts/validate-agents.ts` — Validation
- Checks for duplicate displayNames across all agents
- Must pass after any agent changes

### `scripts/sync-agents.ts` — Documentation Sync
- Reads `agents` record and generates: README agent table, agent count, discovery paths, package.json keywords
- Must be run after any agent changes

## Agent Classification

### Universal Agents
Share `.agents/skills/` directory. No symlink needed during installation.
Examples: amp, cursor, codex, opencode

### Non-Universal Agents
Have agent-specific directories. Installation creates symlink: `<agent-dir>/<skill>` → `.agents/skills/<skill>`
Examples: claude-code (`.claude/skills`), windsurf (`.windsurf/skills`), goose (`.goose/skills`)

### XDG-Style Global Paths
Some agents use `configHome` (XDG) for global paths instead of hardcoded `home`.
Pattern: `globalSkillsDir: join(configHome, '<agent>/skills')`
Examples: goose, amp, opencode. **Note**: amp and opencode are universal agents (`.agents/skills`). For Devin (non-universal + XDG), **goose is the closest analog** — copy goose's structure but substitute devin paths.

## Adding a New Agent: Checklist
1. Add type literal to `AgentType` union in `src/types.ts`
2. Add config entry to `agents` record in `src/agents.ts`
3. Add `skillsDir` to `prioritySearchDirs` in `src/skills.ts`
4. Write tests
5. Run `bun scripts/validate-agents.ts`
6. Run `bun scripts/sync-agents.ts`
7. Run `pnpm format`
