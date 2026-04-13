# User Testing

## Validation Surface
- **CLI**: The skills CLI is the primary surface. All validation is through CLI commands and unit/integration tests.
- **No browser or API surface** — this is a build-time-only change.

## Validation Tools
- `pnpm test -- --run` — Vitest test suite (419 tests as of milestone 1-core-registration)
- `pnpm type-check` — TypeScript compiler
- `pnpm format:check` — Prettier formatting
- `bun scripts/validate-agents.ts` — Agent metadata validation
- `bun scripts/sync-agents.ts` — Documentation sync

## Validation Concurrency
- **Max concurrent validators: 5**
- Rationale: Each test run uses ~300 MB RAM. On 24 GB machine with ~6 GB baseline usage, usable headroom = 18 GB × 0.7 = 12.6 GB. 5 instances = 1.5 GB — well within budget.

## Runtime Findings (milestone 1-core-registration)
- **Environment setup required:** `export PATH="/opt/homebrew/opt/node@24/bin:$HOME/.bun/bin:$PATH"` — needed for both node and bun commands
- **pnpm install** completes cleanly with `--frozen-lockfile`
- **Test count:** 419 tests across 27 files (up from 402 baseline — 17 new tests in `tests/devin-agent.test.ts`)
- **Test duration:** ~17s total
- **Type-check baseline:** 6 pre-existing errors in git.ts, wellknown.ts, skills.ts — do not count these as regressions
- **No services needed:** All validation is command-based (grep, test runner, script runner)
- **No frictions encountered** during milestone 1 validation
