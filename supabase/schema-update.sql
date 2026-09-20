-- SEOMaster Pro schema update.
-- Adds the AI-powered feature tables used by the /api/keywords, /api/backlinks,
-- /api/competitors, /api/positions, /api/onpage, and /api/domain routes.
-- Run this file in the Supabase SQL Editor after the base schema.sql.

-- 1. keyword_research ---------------------------------------------------
CREATE TABLE IF NOT EXISTS keyword_research (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_keyword_research_user_date ON keyword_research(user_id, created_at DESC);
ALTER TABLE keyword_research ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own keyword research" ON keyword_research;
CREATE POLICY "Users view own keyword research" ON keyword_research FOR SELECT USING (auth.uid() = user_id);

-- 2. backlink_reports --------------------------------------------------
CREATE TABLE IF NOT EXISTS backlink_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_backlink_reports_user_date ON backlink_reports(user_id, created_at DESC);
ALTER TABLE backlink_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own backlink reports" ON backlink_reports;
CREATE POLICY "Users view own backlink reports" ON backlink_reports FOR SELECT USING (auth.uid() = user_id);

-- 3. competitor_analyses -----------------------------------------------
CREATE TABLE IF NOT EXISTS competitor_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_competitor_analyses_user_date ON competitor_analyses(user_id, created_at DESC);
ALTER TABLE competitor_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own competitor analyses" ON competitor_analyses;
CREATE POLICY "Users view own competitor analyses" ON competitor_analyses FOR SELECT USING (auth.uid() = user_id);

-- 4. position_tracking -------------------------------------------------
CREATE TABLE IF NOT EXISTS position_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_position_tracking_user_date ON position_tracking(user_id, created_at DESC);
ALTER TABLE position_tracking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own position tracking" ON position_tracking;
CREATE POLICY "Users view own position tracking" ON position_tracking FOR SELECT USING (auth.uid() = user_id);

-- 5. onpage_reports ----------------------------------------------------
CREATE TABLE IF NOT EXISTS onpage_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_onpage_reports_user_date ON onpage_reports(user_id, created_at DESC);
ALTER TABLE onpage_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own onpage reports" ON onpage_reports;
CREATE POLICY "Users view own onpage reports" ON onpage_reports FOR SELECT USING (auth.uid() = user_id);

-- 6. domain_reports ----------------------------------------------------
CREATE TABLE IF NOT EXISTS domain_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_domain_reports_user_date ON domain_reports(user_id, created_at DESC);
ALTER TABLE domain_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own domain reports" ON domain_reports;
CREATE POLICY "Users view own domain reports" ON domain_reports FOR SELECT USING (auth.uid() = user_id);
