# Packages Workspace

This directory holds reusable packages shared across JoyJoin workspaces.

## Current package inventory

- `packages/shared` — canonical shared contracts, schema, vocabularies, domain engines, and shared UI primitives

## Start here

- [`shared/src/README.md`](./shared/src/README.md) — what belongs in the shared package and what does not
- [`../apps/server/src/README.md`](../apps/server/src/README.md) — server boundary reference when deciding whether code is truly shared or server-only

## Rule of thumb

Put code in `packages/` only when more than one app or layer should depend on the same definition. If one runtime owns the behavior, keep it in that runtime and import shared contracts from here instead.

