-- Migration: Remove "其他行业" and add AI classification infrastructure
-- Date: 2026-01-13
-- Purpose: Eliminate data black hole caused by "other" industry option

-- ============ Step 1: Create AI classification log table ============

CREATE TABLE IF NOT EXISTS industry_ai_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id),
  raw_input TEXT NOT NULL,
  ai_classified VARCHAR(100) NOT NULL,
  confidence DECIMAL(3,2),
  reasoning TEXT,
  source VARCHAR NOT NULL DEFAULT 'ai',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_industry_ai_logs_user ON industry_ai_logs(user_id);
CREATE INDEX idx_industry_ai_logs_created ON industry_ai_logs(created_at);

-- ============ Step 2: Migrate existing "other" industry users ============

-- Strategy: Use occupation_description and company_name to intelligently reclassify
-- Fallback: Map to "emerging" (新兴产业) for unclear cases

UPDATE users
SET industry = CASE
  -- Tech & Internet
  WHEN occupation_description ILIKE '%互联网%' OR occupation_description ILIKE '%科技%' 
    OR occupation_description ILIKE '%软件%' OR occupation_description ILIKE '%程序%' 
    OR occupation_description ILIKE '%开发%' OR occupation_description ILIKE '%产品经理%'
    OR company_name ILIKE '%科技%' OR company_name ILIKE '%互联网%'
    OR company_name ILIKE '%字节%' OR company_name ILIKE '%腾讯%' OR company_name ILIKE '%阿里%'
    OR company_name ILIKE '%百度%' OR company_name ILIKE '%美团%' OR company_name ILIKE '%京东%'
    THEN 'tech'
  
  -- AI & Big Data
  WHEN occupation_description ILIKE '%AI%' OR occupation_description ILIKE '%算法%' 
    OR occupation_description ILIKE '%数据%' OR occupation_description ILIKE '%机器学习%'
    OR occupation_description ILIKE '%深度学习%' OR occupation_description ILIKE '%大模型%'
    THEN 'ai'
  
  -- Hardware & Chips
  WHEN occupation_description ILIKE '%芯片%' OR occupation_description ILIKE '%半导体%' 
    OR occupation_description ILIKE '%硬件%' OR occupation_description ILIKE '%嵌入式%'
    OR occupation_description ILIKE '%IC%' OR occupation_description ILIKE '%FPGA%'
    OR company_name ILIKE '%芯片%' OR company_name ILIKE '%半导体%'
    THEN 'hardware'
  
  -- New Energy Vehicles
  WHEN occupation_description ILIKE '%新能源%' OR occupation_description ILIKE '%电动车%' 
    OR occupation_description ILIKE '%汽车%' OR occupation_description ILIKE '%自动驾驶%'
    OR occupation_description ILIKE '%电池%'
    OR company_name ILIKE '%比亚迪%' OR company_name ILIKE '%特斯拉%' OR company_name ILIKE '%蔚来%'
    OR company_name ILIKE '%理想%' OR company_name ILIKE '%小鹏%'
    THEN 'new_energy'
  
  -- E-commerce
  WHEN occupation_description ILIKE '%电商%' OR occupation_description ILIKE '%跨境%' 
    OR occupation_description ILIKE '%选品%' OR occupation_description ILIKE '%运营%'
    OR occupation_description ILIKE '%独立站%'
    THEN 'ecommerce'
  
  -- Finance
  WHEN occupation_description ILIKE '%金融%' OR occupation_description ILIKE '%投资%' 
    OR occupation_description ILIKE '%银行%' OR occupation_description ILIKE '%证券%'
    OR occupation_description ILIKE '%基金%' OR occupation_description ILIKE '%PE%'
    OR occupation_description ILIKE '%VC%' OR occupation_description ILIKE '%投行%'
    OR occupation_description ILIKE '%并购%' OR occupation_description ILIKE '%M&A%'
    OR company_name ILIKE '%投资%' OR company_name ILIKE '%资本%' OR company_name ILIKE '%基金%'
    THEN 'finance'
  
  -- Consulting
  WHEN occupation_description ILIKE '%咨询%' OR occupation_description ILIKE '%顾问%' 
    OR occupation_description ILIKE '%麦肯锡%' OR occupation_description ILIKE '%BCG%'
    OR occupation_description ILIKE '%贝恩%' OR occupation_description ILIKE '%埃森哲%'
    OR company_name ILIKE '%咨询%'
    THEN 'consulting'
  
  -- Marketing
  WHEN occupation_description ILIKE '%市场%' OR occupation_description ILIKE '%营销%' 
    OR occupation_description ILIKE '%品牌%' OR occupation_description ILIKE '%广告%'
    OR occupation_description ILIKE '%公关%' OR occupation_description ILIKE '%PR%'
    THEN 'marketing'
  
  -- Creative & Design
  WHEN occupation_description ILIKE '%设计%' OR occupation_description ILIKE '%创意%' 
    OR occupation_description ILIKE '%美工%' OR occupation_description ILIKE '%UI%'
    OR occupation_description ILIKE '%UX%' OR occupation_description ILIKE '%插画%'
    OR occupation_description ILIKE '%3D%'
    THEN 'creative'
  
  -- Media & Content
  WHEN occupation_description ILIKE '%传媒%' OR occupation_description ILIKE '%媒体%' 
    OR occupation_description ILIKE '%内容%' OR occupation_description ILIKE '%编辑%'
    OR occupation_description ILIKE '%记者%' OR occupation_description ILIKE '%主播%'
    OR occupation_description ILIKE '%直播%' OR occupation_description ILIKE '%博主%'
    THEN 'media'
  
  -- Medical & Healthcare
  WHEN occupation_description ILIKE '%医疗%' OR occupation_description ILIKE '%医生%' 
    OR occupation_description ILIKE '%护士%' OR occupation_description ILIKE '%健康%'
    OR occupation_description ILIKE '%药%' OR occupation_description ILIKE '%生物%'
    OR company_name ILIKE '%医院%' OR company_name ILIKE '%医疗%'
    THEN 'medical'
  
  -- Education
  WHEN occupation_description ILIKE '%教育%' OR occupation_description ILIKE '%培训%' 
    OR occupation_description ILIKE '%老师%' OR occupation_description ILIKE '%教师%'
    OR occupation_description ILIKE '%讲师%' OR occupation_description ILIKE '%教授%'
    OR company_name ILIKE '%教育%' OR company_name ILIKE '%培训%' OR company_name ILIKE '%学校%'
    THEN 'education'
  
  -- Legal
  WHEN occupation_description ILIKE '%法律%' OR occupation_description ILIKE '%律师%' 
    OR occupation_description ILIKE '%法务%' OR occupation_description ILIKE '%合规%'
    OR company_name ILIKE '%律所%' OR company_name ILIKE '%律师%'
    THEN 'legal'
  
  -- Real Estate
  WHEN occupation_description ILIKE '%地产%' OR occupation_description ILIKE '%房地产%' 
    OR occupation_description ILIKE '%建筑%' OR occupation_description ILIKE '%物业%'
    OR company_name ILIKE '%地产%' OR company_name ILIKE '%置业%'
    THEN 'realestate'
  
  -- Hospitality
  WHEN occupation_description ILIKE '%酒店%' OR occupation_description ILIKE '%旅游%' 
    OR occupation_description ILIKE '%航空%' OR occupation_description ILIKE '%空乘%'
    OR occupation_description ILIKE '%导游%'
    OR company_name ILIKE '%酒店%' OR company_name ILIKE '%航空%'
    THEN 'hospitality'
  
  -- Lifestyle Services
  WHEN occupation_description ILIKE '%健身%' OR occupation_description ILIKE '%瑜伽%' 
    OR occupation_description ILIKE '%咖啡%' OR occupation_description ILIKE '%餐饮%'
    OR occupation_description ILIKE '%美容%' OR occupation_description ILIKE '%宠物%'
    OR occupation_description ILIKE '%厨师%' OR occupation_description ILIKE '%调酒%'
    THEN 'lifestyle'
  
  -- Government
  WHEN occupation_description ILIKE '%政府%' OR occupation_description ILIKE '%公务员%' 
    OR occupation_description ILIKE '%事业单位%' OR occupation_description ILIKE '%国企%'
    OR occupation_description ILIKE '%央企%' OR occupation_description ILIKE '%体制内%'
    THEN 'government'
  
  -- Default: Emerging Industries
  ELSE 'emerging'
END
WHERE industry = 'other' OR industry = '其他行业';

-- ============ Step 3: Log migration statistics ============

-- Record migration summary (for audit trail)
INSERT INTO industry_ai_logs (user_id, raw_input, ai_classified, confidence, reasoning, source, created_at)
SELECT 
  id,
  COALESCE(occupation_description, 'No description'),
  industry,
  0.70,
  'Migrated from "other" industry using rule-based classification',
  'migration',
  NOW()
FROM users
WHERE industry IN ('tech', 'ai', 'hardware', 'new_energy', 'ecommerce', 'finance', 
                   'consulting', 'marketing', 'creative', 'media', 'medical', 'education', 
                   'legal', 'realestate', 'hospitality', 'lifestyle', 'government', 'emerging')
  AND (occupation_description IS NOT NULL OR company_name IS NOT NULL)
  AND updated_at > NOW() - INTERVAL '1 minute'; -- Only recent updates from migration

-- ============ Step 4: Update userMatchingService industry mapping ============
-- Note: This is a comment for manual verification after deployment
-- Verify that userMatchingService.ts no longer treats all "other" as same industry
