# Model Patterns

## Data Type Selection Guide

| Data | Preferred Type | Avoid | Why |
|------|---------------|-------|-----|
| Email, URL | `VARCHAR(255)` | `TEXT` | Indexable, bounded |
| Short text | `VARCHAR(n)` | `TEXT` | Enforce length at DB level |
| Long text | `TEXT` | `VARCHAR` | No arbitrary length cap |
| Money | `DECIMAL(10,2)` | `FLOAT` | No floating-point rounding |
| Boolean | `BOOLEAN` | `TINYINT` | Native semantic |
| Timestamps | `TIMESTAMP` / `DATETIME` | `VARCHAR` | Sortable, timezone-safe |
| JSON data | `JSON` / `JSONB` | `TEXT` | Queryable, validated |
| UUIDs | `UUID` | `VARCHAR(36)` | Native type, index-efficient |

## Cascade Behavior Examples

```sql
-- CASCADE: delete related records
user_id INTEGER REFERENCES users(id) ON DELETE CASCADE

-- SET NULL: nullify foreign key
category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL

-- RESTRICT: prevent deletion if related records exist
organization_id INTEGER REFERENCES organizations(id) ON DELETE RESTRICT

-- NO ACTION: database default, usually same as RESTRICT
```

**Choose based on business logic, not convenience.**

- Use `CASCADE` when child records have no meaning without the parent
- Use `SET NULL` when the child should survive but lose the relationship
- Use `RESTRICT` when deletion of the parent must be explicitly handled

## Index Strategy

**Always index:**
- Primary keys (automatic)
- Foreign key columns
- Columns used in `WHERE` clauses
- Columns used in `JOIN` conditions
- Columns used in `ORDER BY` clauses

**Don't over-index:**
- Each index slows writes
- Index only columns that are actually queried
- Remove unused indexes after profiling

**Composite indexes:**
- Order columns by selectivity (most selective first)
- Match the leading column to query predicates

## Validation Layer Examples

### Two-layer validation

**Model / application layer (clear error messages):**
```ts
import { z } from "zod";

const UserSchema = z.object({
  email: z.string().email(),
  age: z.number().min(18),
});
```

**Database layer (defense in depth):**
```sql
email VARCHAR(255) NOT NULL UNIQUE,
age INTEGER CHECK (age >= 18)
```

### Soft delete pattern
```sql
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL;
CREATE INDEX idx_users_deleted_at ON users(deleted_at);
```

Query only active records:
```ts
.where(isNull(users.deleted_at))
```

### Enum pattern
```ts
import { pgEnum } from "drizzle-orm/pg-core";

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "paid",
  "shipped",
  "delivered",
]);

status: orderStatusEnum("order_status").notNull().default("pending"),
```

## Normalization vs Performance

**Normalize when:**
- Data has clear entity boundaries
- Updates need to propagate consistently
- Avoiding duplication is critical

**Denormalize when:**
- Read performance is critical
- Data rarely changes
- Joins become too expensive

**Default to normalized. Denormalize only with evidence of performance issues.**

## What Belongs in Models

**YES:** Field definitions, relationships, simple property methods, data validation, database constraints

**NO:** Business logic, external API calls, complex calculations, email sending, file uploads

**Models represent data structure, not behavior.**
