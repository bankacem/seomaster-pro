-- =====================================================================
-- SEOMaster Pro — Complete Schema Fix (idempotent)
-- Run this in Supabase SQL Editor to ensure ALL required tables & columns exist.
-- This is safe to run multiple times.
-- =====================================================================

-- Required extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================
-- 1. PROFILES — Add missing columns if they don't exist
-- =====================================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free'
  CHECK (plan IN ('free','pro','enterprise'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 5
  CHECK (credits >= 0);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Fix any NULL plans
UPDATE profiles SET plan = 'free' WHERE plan IS NULL;
UPDATE profiles SET credits = 5 WHERE credits IS NULL;

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own profile" ON profiles;
CREATE POLICY "Users view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- =====================================================================
-- 2. ANALYSES
-- =====================================================================
CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  url TEXT,
  score INTEGER CHECK (score >= 0 AND score <= 100),
  results JSONB NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_analyses_user ON analyses(user_id, created_at DESC);
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own analyses" ON analyses;
CREATE POLICY "Users manage own analyses" ON analyses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- 3. SITE_AUDITS
-- =====================================================================
CREATE TABLE IF NOT EXISTS site_audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  pages_crawled INTEGER NOT NULL DEFAULT 0,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_site_audits_user_date ON site_audits(user_id, created_at DESC);
ALTER TABLE site_audits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own site audits" ON site_audits;
CREATE POLICY "Users view own site audits" ON site_audits FOR SELECT USING (auth.uid() = user_id);

-- =====================================================================
-- 4. SUBSCRIPTIONS
-- =====================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_price_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own subscriptions" ON subscriptions;
CREATE POLICY "Users view own subscriptions" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- =====================================================================
-- 5. USAGE_LOGS
-- =====================================================================
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_usage_user_date ON usage_logs(user_id, created_at DESC);
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own usage" ON usage_logs;
CREATE POLICY "Users view own usage" ON usage_logs FOR SELECT USING (auth.uid() = user_id);

-- =====================================================================
-- 6. KEYWORD_RESEARCH
-- =====================================================================
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

-- =====================================================================
-- 7. BACKLINK_REPORTS
-- =====================================================================
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

-- =====================================================================
-- 8. COMPETITOR_ANALYSES
-- =====================================================================
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

-- =====================================================================
-- 9. POSITION_TRACKING
-- =====================================================================
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

-- =====================================================================
-- 10. ONPAGE_REPORTS
-- =====================================================================
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

-- =====================================================================
-- 11. DOMAIN_REPORTS
-- =====================================================================
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

-- =====================================================================
-- 12. CONTENT_WRITES (AI Content Writer)
-- =====================================================================
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

-- =====================================================================
-- 13. KEYWORD_DIFFICULTY_REPORTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS keyword_difficulty_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_keyword_difficulty_user_date ON keyword_difficulty_reports(user_id, created_at DESC);
ALTER TABLE keyword_difficulty_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own keyword_difficulty_reports" ON keyword_difficulty_reports;
CREATE POLICY "Users view own keyword_difficulty_reports" ON keyword_difficulty_reports FOR SELECT USING (auth.uid() = user_id);

-- =====================================================================
-- 14. SERP_ANALYSES
-- =====================================================================
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

-- =====================================================================
-- 15. CONTENT_OPTIMIZATIONS
-- =====================================================================
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

-- =====================================================================
-- TRIGGERS — auto-update updated_at
-- =====================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================================
-- CREDIT FUNCTIONS (atomic)
-- =====================================================================
CREATE OR REPLACE FUNCTION decrement_profile_credits(p_user_id UUID, p_amount INTEGER)
RETURNS INTEGER AS $$
DECLARE remaining INTEGER;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Credit amount must be positive'; END IF;
  UPDATE profiles SET credits = credits - p_amount
  WHERE id = p_user_id AND credits >= p_amount
  RETURNING credits INTO remaining;
  RETURN COALESCE(remaining, -1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION add_profile_credits(p_user_id UUID, p_amount INTEGER)
RETURNS INTEGER AS $$
DECLARE remaining INTEGER;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Credit amount must be positive'; END IF;
  UPDATE profiles SET credits = credits + p_amount
  WHERE id = p_user_id
  RETURNING credits INTO remaining;
  RETURN COALESCE(remaining, -1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, plan, credits)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    'free',
    5
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- DONE
-- =====================================================================
-- All 15 tables + triggers + functions are now in place.
-- Safe to re-run; uses IF NOT EXISTS everywhere.
