-- Migration: Rename matching_weights_config and matching_weights_history columns
-- from the legacy adaptive-weight vocabulary to the active pool-matching vocabulary.
--
-- Old vocabulary → New vocabulary (active poolMatchingService.ts pair-score dimensions):
--   personality / interests / intent / background / culture / conversationSignature
--   → chemistry / interest / socialAffinity / backgroundDiversity / preference / language
--
-- New default weights match the active 6D scoring model:
--   chemistry 28% / interest 28% / socialAffinity 20% / backgroundDiversity 15%
--   preference 5% / language 4%
--
-- IDEMPOTENT: Safe to run multiple times.

-- ──────────────────────────────────────────────────────────────────────────────
-- matching_weights_config — weight columns
-- ──────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matching_weights_config' AND column_name = 'personality_weight') THEN
    ALTER TABLE matching_weights_config RENAME COLUMN personality_weight TO chemistry_weight;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matching_weights_config' AND column_name = 'interests_weight') THEN
    ALTER TABLE matching_weights_config RENAME COLUMN interests_weight TO interest_weight;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matching_weights_config' AND column_name = 'intent_weight') THEN
    ALTER TABLE matching_weights_config RENAME COLUMN intent_weight TO social_affinity_weight;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matching_weights_config' AND column_name = 'background_weight') THEN
    ALTER TABLE matching_weights_config RENAME COLUMN background_weight TO background_diversity_weight;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matching_weights_config' AND column_name = 'culture_weight') THEN
    ALTER TABLE matching_weights_config RENAME COLUMN culture_weight TO preference_weight;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matching_weights_config' AND column_name = 'conversation_signature_weight') THEN
    ALTER TABLE matching_weights_config RENAME COLUMN conversation_signature_weight TO language_weight;
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- matching_weights_config — Thompson Sampling alpha/beta columns
-- ──────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matching_weights_config' AND column_name = 'personality_alpha') THEN
    ALTER TABLE matching_weights_config RENAME COLUMN personality_alpha TO chemistry_alpha;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matching_weights_config' AND column_name = 'personality_beta') THEN
    ALTER TABLE matching_weights_config RENAME COLUMN personality_beta TO chemistry_beta;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matching_weights_config' AND column_name = 'interests_alpha') THEN
    ALTER TABLE matching_weights_config RENAME COLUMN interests_alpha TO interest_alpha;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matching_weights_config' AND column_name = 'interests_beta') THEN
    ALTER TABLE matching_weights_config RENAME COLUMN interests_beta TO interest_beta;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matching_weights_config' AND column_name = 'intent_alpha') THEN
    ALTER TABLE matching_weights_config RENAME COLUMN intent_alpha TO social_affinity_alpha;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matching_weights_config' AND column_name = 'intent_beta') THEN
    ALTER TABLE matching_weights_config RENAME COLUMN intent_beta TO social_affinity_beta;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matching_weights_config' AND column_name = 'background_alpha') THEN
    ALTER TABLE matching_weights_config RENAME COLUMN background_alpha TO background_diversity_alpha;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matching_weights_config' AND column_name = 'background_beta') THEN
    ALTER TABLE matching_weights_config RENAME COLUMN background_beta TO background_diversity_beta;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matching_weights_config' AND column_name = 'culture_alpha') THEN
    ALTER TABLE matching_weights_config RENAME COLUMN culture_alpha TO preference_alpha;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matching_weights_config' AND column_name = 'culture_beta') THEN
    ALTER TABLE matching_weights_config RENAME COLUMN culture_beta TO preference_beta;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matching_weights_config' AND column_name = 'conversation_signature_alpha') THEN
    ALTER TABLE matching_weights_config RENAME COLUMN conversation_signature_alpha TO language_alpha;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matching_weights_config' AND column_name = 'conversation_signature_beta') THEN
    ALTER TABLE matching_weights_config RENAME COLUMN conversation_signature_beta TO language_beta;
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- matching_weights_config — update column defaults to match active-flow weights
-- ──────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matching_weights_config' AND column_name = 'chemistry_weight') THEN
    ALTER TABLE matching_weights_config ALTER COLUMN chemistry_weight SET DEFAULT '0.28';
    ALTER TABLE matching_weights_config ALTER COLUMN interest_weight SET DEFAULT '0.28';
    ALTER TABLE matching_weights_config ALTER COLUMN social_affinity_weight SET DEFAULT '0.20';
    ALTER TABLE matching_weights_config ALTER COLUMN background_diversity_weight SET DEFAULT '0.15';
    ALTER TABLE matching_weights_config ALTER COLUMN preference_weight SET DEFAULT '0.05';
    ALTER TABLE matching_weights_config ALTER COLUMN language_weight SET DEFAULT '0.04';
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- matching_weights_history — weight snapshot columns
-- ──────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matching_weights_history' AND column_name = 'personality_weight') THEN
    ALTER TABLE matching_weights_history RENAME COLUMN personality_weight TO chemistry_weight;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matching_weights_history' AND column_name = 'interests_weight') THEN
    ALTER TABLE matching_weights_history RENAME COLUMN interests_weight TO interest_weight;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matching_weights_history' AND column_name = 'intent_weight') THEN
    ALTER TABLE matching_weights_history RENAME COLUMN intent_weight TO social_affinity_weight;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matching_weights_history' AND column_name = 'background_weight') THEN
    ALTER TABLE matching_weights_history RENAME COLUMN background_weight TO background_diversity_weight;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matching_weights_history' AND column_name = 'culture_weight') THEN
    ALTER TABLE matching_weights_history RENAME COLUMN culture_weight TO preference_weight;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matching_weights_history' AND column_name = 'conversation_signature_weight') THEN
    ALTER TABLE matching_weights_history RENAME COLUMN conversation_signature_weight TO language_weight;
  END IF;
END $$;
