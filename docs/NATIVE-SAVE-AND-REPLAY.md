# Native save and replay format

Define a versioned, bounded, recreation-native format before save files become public.
Record magic, format version, maximum decoded size, state schema, migration policy,
atomic-write behavior, backup/recovery, unknown-field policy, and validation errors.

Replays should store an initial snapshot, deterministic random state and consumption
count, accepted/rejected commands, validation results, and a canonical state hash after
each step or phase boundary. Loading must replay and reject divergence. Keep support for
older versions explicit and tested; never deserialize arbitrary runtime types.
