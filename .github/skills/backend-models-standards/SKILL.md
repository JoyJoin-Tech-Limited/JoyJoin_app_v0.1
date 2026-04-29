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

**Core Rule:** Models define data structure and integrity. Keep them focused on data representation, not business logic.

## When to use this skill

- Creating or modifying database model files, ORM classes, or schema definitions
- Establishing table relationships (one-to-many, many-to-many)
- Configuring foreign keys, indexes, and cascade behaviors
- Implementing model-level validation rules
- Adding timestamp fields for auditing
- Setting database constraints (NOT NULL, UNIQUE, CHECK)
- Choosing appropriate data types for model fields
- Balancing normalization with query performance

## Naming Conventions

**Models:** Singular, PascalCase (`User`, `OrderItem`, `PaymentMethod`)

**Tables:** Plural, snake_case (`users`, `order_items`, `payment_methods`)

**Relationships:** Descriptive and clear
- `user.orders` (one-to-many)
- `order.items` (one-to-many)
- `product.categories` (many-to-many)

**Avoid generic names:** `data`, `info`, `record`, `entity`

## Required Fields

**Timestamps on every model:**
```pseudo
created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
```

**Primary keys:** Always explicit, prefer UUIDs for distributed systems or auto-incrementing integers for simplicity.

**Why:** Auditing, debugging, data lineage tracking, soft deletes.

## Data Integrity — Database Level

**Use constraints, not just application validation:**

```python
email = Column(String(255), nullable=False)  # NOT NULL
email = Column(String(255), unique=True, nullable=False)  # UNIQUE
age = Column(Integer, CheckConstraint('age >= 18'))  # CHECK
user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'))  # FK with cascade
```

**Why:** Database enforces rules even if application code bypassed. Defense in depth.

## Data Types

| Data | Type | Avoid |
| --- | --- | --- |
| Email, URL | VARCHAR(255) | TEXT |
| Short text | VARCHAR(n) | TEXT |
| Long text | TEXT | VARCHAR |
| Money | DECIMAL(10,2) | FLOAT |
| Boolean | BOOLEAN | TINYINT |
| Timestamps | TIMESTAMP/DATETIME | VARCHAR |
| JSON data | JSON/JSONB | TEXT |
| UUIDs | UUID | VARCHAR(36) |

## Indexes

**Always index:** primary keys (automatic), foreign keys, WHERE columns, JOIN columns, ORDER BY columns.

**Don't over-index:** Each index slows writes. Index only queried columns.

## Relationships, Validation, Patterns, and Testing

See [`references/relationships-validation-patterns-testing.md`](./references/relationships-validation-patterns-testing.md) for:
- Explicit relationship configuration and cascade behaviors
- Two-layer validation (model + database)
- Common patterns (soft deletes, enums)
- Model testing examples

## What Belongs in Models

**YES:** Field definitions, relationships, simple property methods, data validation, database constraints.

**NO:** Business logic, external API calls, complex calculations, email sending, file uploads.

**Models represent data structure, not behavior.**

## Normalization vs Performance

**Normalize when:** data has clear entity boundaries, updates need to propagate, avoiding duplication is critical.

**Denormalize when:** read performance critical, data rarely changes, joins become too expensive.

**Default to normalized. Denormalize only with evidence of performance issues.**

## Checklist for New Models

- [ ] Singular model name, plural table name
- [ ] Primary key defined
- [ ] `created_at` and `updated_at` timestamps
- [ ] NOT NULL on required fields
- [ ] UNIQUE constraints where appropriate
- [ ] Foreign keys with explicit cascade behavior
- [ ] Indexes on foreign keys and queried columns
- [ ] Appropriate data types (not all VARCHAR)
- [ ] Validation at model and database levels
- [ ] Relationships defined on both sides
- [ ] Tests for constraints and validation

## Quick examples

**User says:** "Add a `pool_registrations` table with a foreign key to `users`."
**Apply this skill by:** Using `snake_case` table name, explicit `NOT NULL`, a `CASCADE` delete on the FK, an index on `user_id`, and `created_at`/`updated_at` timestamps.
**Result:** Table is correctly normalised, constraints are enforced at the database level, and cascade behaviour is intentional.

---

**User says:** "What type should I use for the event fee field?"
**Apply this skill by:** Checking the data-type table — money values use `DECIMAL(10,2)`, never `FLOAT`.
**Result:** Accurate monetary storage with no floating-point rounding errors.

## Troubleshooting

- **Constraint failure on insert** — check whether a `NOT NULL` or `UNIQUE` constraint is being violated. Look at the error message for the column name, then verify the application layer is supplying the value correctly.
- **Duplicate key error on retry** — the operation is not idempotent. Add an existence check before inserting, or use an `INSERT … ON CONFLICT DO NOTHING` clause.
- **Unexpected cascade delete wiped rows** — review the `ondelete` setting on the FK. If the rows should survive parent deletion, switch to `SET NULL` or `RESTRICT` and handle nulls in application code.
- **Query is slow after adding a column to a `WHERE` clause** — the column probably lacks an index. Add one and verify with `EXPLAIN`.

## Review checklist

- [ ] Table name is `plural_snake_case`; model name is `SingularPascalCase`
- [ ] All required fields have `NOT NULL` constraints at the database level
- [ ] Every FK has an explicit `ondelete` behavior (not the ORM default)
- [ ] Foreign key columns are indexed
- [ ] Money/currency fields use `DECIMAL`, not `FLOAT`
- [ ] Both `created_at` and `updated_at` are present
- [ ] Relationships are defined on both sides (back-populate / inverse)
- [ ] Constraint and cascade behavior is covered by a test
