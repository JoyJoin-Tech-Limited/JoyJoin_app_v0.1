---
name: backend-models-standards
description: >
  Define database models with clear naming, appropriate data types, constraints, relationships, and
  validation at multiple layers. Use this skill when creating or modifying database model files,
  schema definitions, or data model relationships. Trigger phrases: "add a new table", "define a
  model", "add a foreign key", "configure cascade behavior", "what data type should I use", "add an
  index", "enforce a unique constraint".
---

# Backend Models Standards

**Core rule:** Models define data structure and integrity. Keep them focused on data
representation, not business logic.

## When to use this skill

- Creating or modifying database model files, ORM classes, or schema definitions
- Establishing table relationships and configuring cascade behaviors
- Implementing model-level validation rules or database constraints
- Choosing appropriate data types and balancing normalization with performance

## Naming conventions

- **Models:** Singular PascalCase (`User`, `OrderItem`)
- **Tables:** Plural snake_case (`users`, `order_items`)
- **Relationships:** Descriptive (`user.orders`, `order.items`)
- Avoid generic names: `data`, `info`, `record`, `entity`

## Required fields

- **Timestamps on every model:** `created_at` and `updated_at`
- **Primary keys:** Always explicit; prefer UUIDs for distributed systems
- **Why:** Auditing, debugging, data lineage, soft deletes

## Constraint overview

Enforce rules at the database level, not just application validation:

- `NOT NULL` on required fields
- `UNIQUE` where appropriate
- `CHECK` for range validation
- Foreign keys with explicit `ondelete` behaviour

**Why:** Database enforces rules even if application code is bypassed.

## What belongs in models

**YES:** Field definitions, relationships, simple property methods, data validation,
database constraints.

**NO:** Business logic, external API calls, complex calculations, email sending,
file uploads.

**Models represent data structure, not behavior.**

For the full data-type selection guide, cascade behaviour examples, index strategy,
validation layer examples, and testing patterns, see
[`references/model-patterns.md`](./references/model-patterns.md). For relationship
configuration and soft-delete patterns, see
[`references/relationships-validation-patterns-testing.md`](./references/relationships-validation-patterns-testing.md).

## Quick examples

**"Add a `pool_registrations` table with a foreign key to `users`."**
→ Use `snake_case` table name, explicit `NOT NULL`, `CASCADE` delete on the FK,
  index on `user_id`, and `created_at`/`updated_at` timestamps.

**"What type for the event fee field?"**
→ Money values use `DECIMAL(10,2)`, never `FLOAT`.

## Troubleshooting

**Constraint failure on insert**
→ Check whether `NOT NULL` or `UNIQUE` is violated. Verify the application layer
   is supplying the value correctly.

**Duplicate key error on retry**
→ Operation is not idempotent. Add an existence check or use
   `INSERT … ON CONFLICT DO NOTHING`.

**Unexpected cascade delete wiped rows**
→ Review the `ondelete` setting. If rows should survive parent deletion, switch
   to `SET NULL` or `RESTRICT`.

**Query is slow after adding a `WHERE` column**
→ The column probably lacks an index. Add one and verify with `EXPLAIN`.

## Review checklist

- [ ] Table name is `plural_snake_case`; model name is `SingularPascalCase`
- [ ] All required fields have `NOT NULL` constraints at the database level
- [ ] Every FK has an explicit `ondelete` behavior
- [ ] Foreign key columns are indexed
- [ ] Money/currency fields use `DECIMAL`, not `FLOAT`
- [ ] Both `created_at` and `updated_at` are present
- [ ] Relationships are defined on both sides
- [ ] Constraint and cascade behavior is covered by a test
