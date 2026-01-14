# Industry Classification API

## Overview
The industry classification system uses a 3-tier architecture to map user input to a hierarchical taxonomy (L1 → L2 → L3) with AI-powered text normalization.

## Data Flow

```
User Input: "我做医疗ai的"
    ↓
1. AI Normalization: "医疗AI研发"
    ↓
2. Classification (L1-L2-L3):
   - Category (L1): 科技互联网
   - Segment (L2): AI/机器学习
   - Niche (L3): 医疗AI
    ↓
3. Storage: Structured fields in database
```

## API Endpoints

### POST /api/inference/classify-industry

**Request**:
```json
{
  "description": "我做医疗ai的"
}
```

**Response**:
```json
{
  "category": { "id": "tech", "label": "科技互联网" },
  "segment": { "id": "ai_ml", "label": "AI/机器学习" },
  "niche": { "id": "healthcare_ai", "label": "医疗AI" },
  "confidence": 92,
  "reasoning": "检测到医疗和AI关键词",
  "source": "ai",
  "processingTimeMs": 1250,
  "rawInput": "我做医疗ai的",
  "normalizedInput": "医疗AI研发"
}
```

### POST /api/profile/update-industry

**Request**:
```json
{
  "category": "tech",
  "categoryLabel": "科技互联网",
  "segment": "ai_ml",
  "segmentLabel": "AI/机器学习",
  "niche": "healthcare_ai",
  "nicheLabel": "医疗AI",
  "rawInput": "我做医疗ai的",
  "normalizedInput": "医疗AI研发",
  "source": "ai",
  "confidence": 92
}
```

**Response**:
```json
{
  "success": true,
  "industry": "科技互联网 > AI/机器学习 > 医疗AI"
}
```

## Database Schema

```sql
-- Industry classification fields
industry_category VARCHAR(50),           -- L1: "tech"
industry_category_label VARCHAR(100),    -- "科技互联网"
industry_segment_new VARCHAR(100),       -- L2: "ai_ml"
industry_segment_label VARCHAR(150),     -- "AI/机器学习"
industry_niche VARCHAR(150),             -- L3: "medical_ai"
industry_niche_label VARCHAR(200),       -- "医疗AI"

-- Metadata
industry_raw_input TEXT,                 -- Original user input
industry_normalized TEXT,                -- AI-cleaned version
industry_source VARCHAR(20),             -- "seed" | "ontology" | "ai" | "fallback"
industry_confidence NUMERIC(3,2),        -- 0.00-1.00
industry_classified_at TIMESTAMP,        -- Classification timestamp
industry_last_verified_at TIMESTAMP      -- Last verification timestamp
```

## Error Handling

| Error Code | Scenario | Response |
|------------|----------|----------|
| 400 | Missing description | `{ "error": "Description is required" }` |
| 400 | Invalid structure | `{ "error": "Invalid industry data", "field": "category.id" }` |
| 500 | AI timeout | Falls back to raw input |
| 500 | Database error | `{ "error": "Failed to update profile" }` |

## Performance

- AI Normalization: ~500-1000ms
- Classification: ~1000-2000ms
- Database Update: ~50ms

## Classification Tiers

1. **Seed Match** (0-10ms): Exact match against pre-defined seed data
   - Highest accuracy, fastest response
   - Confidence ≥ 0.9

2. **Ontology Match** (10-100ms): Fuzzy matching with synonyms and rules
   - Good accuracy, fast response
   - Confidence ≥ 0.8

3. **AI Deep Analysis** (200-1000ms): DeepSeek AI reasoning
   - Handles complex/ambiguous inputs
   - Variable confidence based on input clarity

4. **Fallback** (0ms): Default classification when all tiers fail
   - Confidence ≤ 0.3
   - Returns default: 科技互联网 > 软件开发

## Text Normalization

The AI normalization service:
- Corrects typos and informal language
- Standardizes terminology (e.g., "ai" → "AI")
- Keeps output concise (max 20 characters)
- Returns only cleaned text, no JSON

### Normalization Examples

| Raw Input | Normalized Output |
|-----------|------------------|
| 我做医疗ai的 | 医疗AI研发 |
| 银行柜员 | 银行柜员 |
| 快递小哥 | 快递配送 |

## Security

- Input sanitization removes XSS characters: `<>{}[]\`
- Max input length: 200 characters
- Rate limiting on AI endpoints
- Authentication required for all endpoints
