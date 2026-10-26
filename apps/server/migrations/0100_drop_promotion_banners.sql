-- Remove the promotion_banners table: nothing ever read it.
-- Created in 0000_hesitant_molly_hayes.sql; the discover-page hero is a
-- client-side component (HeroPromoBanner) built from CDN art and variant
-- logic, never a row in this table. The admin surface and the public
-- GET /api/banners endpoint were removed in the same PR.
-- Apply only AFTER the host migration completes, and only when the
-- production row count is still 0 (a CSV export is the fallback).
DROP TABLE IF EXISTS promotion_banners;
