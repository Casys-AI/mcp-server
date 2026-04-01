# composer

Compose collected resources into a composite UI descriptor with resolved sync rules.

## API

- `buildCompositeUi(resources, orchestration?)` — build a `CompositeUiDescriptor`

## Pipeline position

Second stage: collected resources + orchestration in, composite descriptor out.

## Design

The composer delegates sync resolution to `sync/resolver`. It extracts sharedContext
from resource contexts when orchestration specifies shared keys. Default layout is
`"stack"` when no orchestration is provided. The composer is tolerant: invalid sync
rules are dropped silently (the validator is the strict gate).
