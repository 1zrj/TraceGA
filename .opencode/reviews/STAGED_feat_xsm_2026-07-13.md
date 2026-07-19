# Staged changes: feat/xsm

**REQUEST CHANGES** - Raw URLs and detached exposure targets leak.

| Staged | `feat/xsm` | 28 files | +2686/-66 |
|---|---|---:|---:|

## Issues

| Sev | File | Issue | Fix |
|---|---|---|---|
| WARNING | `packages/trace-sdk/src/core/env.ts:47` | Raw URL bypasses behavior query/hash redaction | Sanitize dynamic URL before every report |
| WARNING | `packages/trace-sdk/src/plugins/behavior/handlers/ExposureTracker.ts:296` | Detached targets may stop matching and leak | Unobserve removed subtree by stored membership |
| SUGGESTION | `.pnpm-store/v11/index.db` | Local pnpm database is staged | Unstage it and ignore `.pnpm-store/` |

## Notes

- TypeScript typecheck passed.
- Tests/build/lint unavailable: dependency relink requires unauthorized network checks.
