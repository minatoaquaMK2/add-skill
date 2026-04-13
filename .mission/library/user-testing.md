# User Testing

## Validation Surface
- **CLI**: The skills CLI is the primary surface. All validation is through CLI commands and unit/integration tests.
- **No browser or API surface** — this is a build-time-only change.

## Validation Tools
- `pnpm test -- --run` — Vitest test suite (402+ tests)
- `pnpm type-check` — TypeScript compiler
- `pnpm format:check` — Prettier formatting
- `bun scripts/validate-agents.ts` — Agent metadata validation
- `bun scripts/sync-agents.ts` — Documentation sync

## Validation Concurrency
- **Max concurrent validators: 5**
- Rationale: Each test run uses ~300 MB RAM. On 24 GB machine with ~6 GB baseline usage, usable headroom = 18 GB × 0.7 = 12.6 GB. 5 instances = 1.5 GB — well within budget.
