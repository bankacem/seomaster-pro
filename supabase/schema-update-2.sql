-- SEOMaster Pro schema update #2.
-- Adds 4 new AI-powered feature tables used by the /api/content-writer,
-- /api/keyword-difficulty, /api/serp-analysis, and /api/content-optimizer routes.
-- Run this file in the Supabase SQL Editor after schema.sql and schema-update.sql.

-- 1. content_writes ---------------------------------------------------
-- Stores AI-generated articles produced by the Content Writer feature.
CREATE TABLE IF NOT EXISTS content_writes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_content_writes_user_date ON content_writes(user_id, created_at DESC);
ALTER TABLE content_writes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own content_writes" ON content_writes;
CREATE POLICY "Users view own content_writes" ON content_writes FOR SELECT USING (auth.uid() = user_id);

-- 2. keyword_difficulty_reports ---------------------------------------
-- Stores AI-estimated difficulty scores for individual keywords.
CREATE TABLE IF NOT EXISTS keyword_difficulty_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_keyword_difficulty_reports_user_date ON keyword_difficulty_reports(user_id, created_at DESC);
ALTER TABLE keyword_difficulty_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own keyword_difficulty_reports" ON keyword_difficulty_reports;
CREATE POLICY "Users view own keyword_difficulty_reports" ON keyword_difficulty_reports FOR SELECT USING (auth.uid() = user_id);

-- 3. serp_analyses -----------------------------------------------------
-- Stores simulated SERP analyses (top results + content gaps).
CREATE TABLE IF NOT EXISTS serp_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_serp_analyses_user_date ON serp_analyses(user_id, created_at DESC);
ALTER TABLE serp_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own serp_analyses" ON serp_analyses;
CREATE POLICY "Users view own serp_analyses" ON serp_analyses FOR SELECT USING (auth.uid() = user_id);

-- 4. content_optimizations --------------------------------------------
-- Stores before/after content rewrites produced by the Content Optimizer.
CREATE TABLE IF NOT EXISTS content_optimizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_keyword TEXT NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_content_optimizations_user_date ON content_optimizations(user_id, created_at DESC);
ALTER TABLE content_optimizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own content_optimizations" ON content_optimizations;
CREATE POLICY "Users view own content_optimizations" ON content_optimizations FOR SELECT USING (auth.uid() = user_id);
