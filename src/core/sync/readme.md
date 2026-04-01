# sync

Resolve and validate sync rules between collected UI resources.

## API

- `resolveSyncRules(rules, resources)` — resolve tool names to slot indices, report orphans
- `validateSyncRules(rules, knownSources)` — detect orphans, circular routes, structural issues

## Pipeline position

Second stage (alongside composer): orchestration rules in, resolved rules + validation out.

## Design

Resolution is best-effort: orphan rules are skipped with structured diagnostics.
Validation is strict: it reports all issues without side effects.
The broadcast marker `"*"` is preserved as-is (not resolved to a slot).
