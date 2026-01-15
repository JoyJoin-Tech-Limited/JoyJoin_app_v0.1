# Database Migration for Interest Selection Carousel

## Changes Made

### 1. New Table: `user_interests`

```sql
CREATE TABLE user_interests (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  total_heat INT NOT NULL DEFAULT 0,
  total_selections INT NOT NULL DEFAULT 0,
  
  category_heat JSONB NOT NULL DEFAULT '{}',
  -- { "career": 35, "philosophy": 28, "lifestyle": 32, "culture": 18, "city": 14 }
  
  selections JSONB NOT NULL DEFAULT '[]',
  -- [{ topicId, emoji, label, fullName, category, categoryId, level, heat }]
  
  top_priorities JSONB,
  -- [{ topicId, label, heat }] (level 3 items only)
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_interests_user_id ON user_interests(user_id);
```

### 2. New Column in `users` Table

```sql
ALTER TABLE users 
ADD COLUMN has_completed_interests_carousel BOOLEAN DEFAULT FALSE;
```

## Migration Steps

1. Run database schema push:
   ```bash
   npm run db:push
   ```

2. If that fails, run with force:
   ```bash
   npm run db:push --force
   ```

3. Verify tables were created:
   ```sql
   SELECT * FROM user_interests LIMIT 1;
   SELECT has_completed_interests_carousel FROM users LIMIT 1;
   ```

## API Endpoints Added

- `POST /api/user/interests` - Save user interest selections
- `GET /api/user/interests` - Get full interest data
- `GET /api/user/interests/summary` - Get lightweight summary

## Notes

- The new carousel-based interest selection is implemented in `InterestCarousel` component
- Old `InterestsTopicsPage` has been preserved as `InterestsTopicsPage.legacy.tsx`
- `ExtendedDataPage` now uses the new 2-step wizard with InterestCarousel as Step 1
- All selections are persisted to localStorage for recovery on page refresh
- Minimum 3 selections required before user can proceed
