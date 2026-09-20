-- SEOMaster Pro schema update #3.
-- Adds 5 new AI-powered feature tables used by the /api/seo-report,
-- /api/content-gap, /api/backlink-opportunities, /api/seo-forecast, and
-- /api/local-seo routes. Run this file in the Supabase SQL Editor after
-- schema.sql, schema-update.sql, and schema-update-2.sql.

-- 1. seo_reports -------------------------------------------------------
-- Stores comprehensive AI-generated SEO audit reports (overall score,
-- score breakdown across technical/content/onpage/ux/authority, SWOT,
-- prioritised action plan, competitor comparison).
CREATE TABLE IF NOT EXISTS seo_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_seo_reports_user_date ON seo_reports(user_id, created_at DESC);
ALTER TABLE seo_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own seo_reports" ON seo_reports;
CREATE POLICY "Users view own seo_reports" ON seo_reports FOR SELECT USING (auth.uid() = user_id);

-- 2. content_gaps -------------------------------------------------------
-- Stores AI content-gap analyses: keywords competitors rank for that
-- the user's domain doesn't, with volume/difficulty/intent and a
-- recommended action per gap.
CREATE TABLE IF NOT EXISTS content_gaps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_content_gaps_user_date ON content_gaps(user_id, created_at DESC);
ALTER TABLE content_gaps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own content_gaps" ON content_gaps;
CREATE POLICY "Users view own content_gaps" ON content_gaps FOR SELECT USING (auth.uid() = user_id);

-- 3. backlink_opportunities -------------------------------------------
-- Stores AI backlink opportunity finder results: prospective linking
-- sites with DA, type, relevance, outreach template and anchor text.
CREATE TABLE IF NOT EXISTS backlink_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_backlink_opportunities_user_date ON backlink_opportunities(user_id, created_at DESC);
ALTER TABLE backlink_opportunities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own backlink_opportunities" ON backlink_opportunities;
CREATE POLICY "Users view own backlink_opportunities" ON backlink_opportunities FOR SELECT USING (auth.uid() = user_id);

-- 4. seo_forecasts -----------------------------------------------------
-- Stores AI SEO forecasting results: 12-month position/traffic/revenue
-- projection given a target keyword and monthly budget, plus ROI and risks.
CREATE TABLE IF NOT EXISTS seo_forecasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_seo_forecasts_user_date ON seo_forecasts(user_id, created_at DESC);
ALTER TABLE seo_forecasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own seo_forecasts" ON seo_forecasts;
CREATE POLICY "Users view own seo_forecasts" ON seo_forecasts FOR SELECT USING (auth.uid() = user_id);

-- 5. local_seo_reports -------------------------------------------------
-- Stores AI local SEO checker results: GBP citation checklist, local
-- keyword suggestions, competitor list, citation opportunities, score.
CREATE TABLE IF NOT EXISTS local_seo_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_local_seo_reports_user_date ON local_seo_reports(user_id, created_at DESC);
ALTER TABLE local_seo_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own local_seo_reports" ON local_seo_reports;
CREATE POLICY "Users view own local_seo_reports" ON local_seo_reports FOR SELECT USING (auth.uid() = user_id);
