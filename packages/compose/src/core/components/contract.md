# Contract

- A catalog contains serializable component descriptors and a valid default surface.
- A requested surface contains stable instance IDs, known component keys, JSON-only props, and a
  bounded layout vocabulary.
- Unknown component keys produce an explicit unresolved result.
- Resolution never depends on pixel dimensions, DOM inspection, or prebuilt size modes.
