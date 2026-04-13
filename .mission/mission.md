# Mission: Add "Devin for Terminal" Agent Support to Skills CLI

## Overview
Register "Devin for Terminal" as a supported non-universal agent in the `skills` CLI, enabling `skills add <repo> -a devin` and all related commands. This follows the established pattern used by 45+ existing agents.

## Requirements
1. Add `'devin'` to `AgentType` union type in `src/types.ts`
2. Add Devin agent config in `src/agents.ts`:
   - `name: 'devin'`
   - `displayName: 'Devin for Terminal'`
   - `skillsDir: '.devin/skills'` (project-level)
   - `globalSkillsDir: ~/.config/devin/skills` (global, XDG-style)
   - Detection: check if `~/.config/devin` exists
   - Non-universal agent (own directories, symlinked from canonical `.agents/skills/`)
3. Ensure `.devin/skills/` is in skill discovery priority paths in `src/skills.ts`
4. Add unit tests verifying agent registration and config
5. Add integration tests for skill installation targeting Devin
6. Run `validate-agents.ts` and `sync-agents.ts` to update README and package keywords
7. Format code with Prettier

## Milestones

### Milestone 1: Core Agent Registration
- Add `'devin'` to `AgentType` union
- Add Devin agent config entry
- Unit tests for config correctness and detection
- All tests pass, no new type errors

### Milestone 2: Integration & Documentation
- Verify `.devin/skills/` in discovery paths
- Integration tests for installation and discovery
- Run validate/sync scripts
- Update README and package.json
- Format and full validation

## Environment
- Node.js v24.14.1 (`/opt/homebrew/opt/node@24/bin`)
- Bun 1.3.12 (`~/.bun/bin`)
- pnpm 10.17.1
- PATH: `/opt/homebrew/opt/node@24/bin:$HOME/.bun/bin:$PATH`

## Infrastructure
- No services needed — build-time-only change
- Off-limits: Existing `.devin/skills/` content (9 mission-planning skills)
- Commands: `pnpm install`, `pnpm build`, `pnpm test -- --run`, `pnpm type-check`, `pnpm format`, `bun scripts/validate-agents.ts`, `bun scripts/sync-agents.ts`

## Testing Strategy
- Framework: Vitest (402 tests currently passing)
- Type-check: `tsc --noEmit` (6 pre-existing errors as baseline)
- Formatting: Prettier via `pnpm format:check`
- Agent validation: `bun scripts/validate-agents.ts`
- Bar: no new test failures, no new type errors
