# Environment

## System
- macOS Darwin 24.6.0
- 24 GB RAM, 8 CPU cores

## Tools
- Node.js v24.14.1 (`/opt/homebrew/opt/node@24/bin`)
- Bun 1.3.12 (`~/.bun/bin`)
- pnpm 10.17.1

## PATH
Workers must set: `export PATH="/opt/homebrew/opt/node@24/bin:$HOME/.bun/bin:$PATH"`

## Known Issues
- 6 pre-existing TypeScript type errors (baseline, not in scope):
  - `src/git.ts:24` — `simpleGit()` env option
  - `src/providers/wellknown.ts:312-313,317` — type narrowing
  - `src/skills.ts:48,58` — metadata type narrowing

## Constraints
- Off-limits: Existing `.devin/skills/` content (mission-planning skills)
- Code must be formatted with Prettier before committing
