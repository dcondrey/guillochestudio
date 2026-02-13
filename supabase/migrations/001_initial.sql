-- Guilloché Studio Pro - Initial Database Schema
-- This migration creates the core tables for the SaaS platform

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector"; -- For AI embeddings

-- Create custom types
CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'enterprise');
CREATE TYPE license_type AS ENUM ('personal', 'commercial', 'remix');

-- Users profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  subscription_tier subscription_tier DEFAULT 'free',
  stripe_customer_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index on username for fast lookups
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_stripe_customer ON profiles(stripe_customer_id);

-- Patterns
CREATE TABLE patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  parameters JSONB NOT NULL,
  parameter_hash TEXT NOT NULL, -- For duplicate detection
  thumbnail_url TEXT,
  is_public BOOLEAN DEFAULT false,
  is_listed BOOLEAN DEFAULT false, -- In marketplace
  license_type license_type DEFAULT 'personal',
  price_cents INTEGER DEFAULT 0 CHECK (price_cents >= 0),
  remix_of UUID REFERENCES patterns(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  view_count INTEGER DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for common queries
CREATE INDEX idx_patterns_user ON patterns(user_id);
CREATE INDEX idx_patterns_public ON patterns(is_public) WHERE is_public = true;
CREATE INDEX idx_patterns_listed ON patterns(is_listed) WHERE is_listed = true;
CREATE INDEX idx_patterns_hash ON patterns(parameter_hash);
CREATE INDEX idx_patterns_remix ON patterns(remix_of);
CREATE INDEX idx_patterns_created ON patterns(created_at DESC);
CREATE INDEX idx_patterns_tags ON patterns USING GIN(tags);

-- Full text search index
CREATE INDEX idx_patterns_search ON patterns
  USING GIN (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '')));

-- Pattern DNA (compressed shareable links)
CREATE TABLE pattern_dna (
  short_code TEXT PRIMARY KEY, -- 8-char base62 code
  pattern_id UUID REFERENCES patterns(id) ON DELETE SET NULL,
  parameters_compressed TEXT NOT NULL, -- Base64 encoded compressed params
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_pattern_dna_pattern ON pattern_dna(pattern_id);

-- Purchases/Licenses
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  pattern_id UUID REFERENCES patterns(id) ON DELETE SET NULL NOT NULL,
  license_type license_type NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  stripe_payment_id TEXT,
  royalty_paid_cents INTEGER DEFAULT 0 CHECK (royalty_paid_cents >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_purchases_user ON purchases(user_id);
CREATE INDEX idx_purchases_pattern ON purchases(pattern_id);
CREATE INDEX idx_purchases_stripe ON purchases(stripe_payment_id);

-- Remixes tracking
CREATE TABLE remixes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_pattern_id UUID REFERENCES patterns(id) ON DELETE CASCADE NOT NULL,
  remix_pattern_id UUID REFERENCES patterns(id) ON DELETE CASCADE NOT NULL,
  similarity_score FLOAT CHECK (similarity_score >= 0 AND similarity_score <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(original_pattern_id, remix_pattern_id)
);

CREATE INDEX idx_remixes_original ON remixes(original_pattern_id);
CREATE INDEX idx_remixes_remix ON remixes(remix_pattern_id);

-- AI Style Presets
CREATE TABLE ai_style_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keywords TEXT[] NOT NULL,
  parameters JSONB NOT NULL,
  embedding VECTOR(384), -- For semantic search with BGE embeddings
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_ai_presets_keywords ON ai_style_presets USING GIN(keywords);
CREATE INDEX idx_ai_presets_embedding ON ai_style_presets USING ivfflat (embedding vector_cosine_ops);

-- Subscriptions tracking (for webhook events)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_price_id TEXT NOT NULL,
  status TEXT NOT NULL, -- 'active', 'canceled', 'past_due', etc.
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_dna ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE remixes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can view any profile, but only update their own
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Patterns: Public patterns viewable by all, private by owner only
CREATE POLICY "Public patterns are viewable by everyone"
  ON patterns FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Users can insert their own patterns"
  ON patterns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own patterns"
  ON patterns FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own patterns"
  ON patterns FOR DELETE
  USING (auth.uid() = user_id);

-- Pattern DNA: Anyone can view (for sharing), authenticated users can create
CREATE POLICY "Pattern DNA is viewable by everyone"
  ON pattern_dna FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create DNA codes"
  ON pattern_dna FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Purchases: Users can only see their own purchases
CREATE POLICY "Users can view their own purchases"
  ON purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create purchases"
  ON purchases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Remixes: Anyone can view remix relationships
CREATE POLICY "Remixes are viewable by everyone"
  ON remixes FOR SELECT
  USING (true);

-- Subscriptions: Users can only see their own
CREATE POLICY "Users can view their own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- Functions
-- ============================================

-- Function to match style presets by embedding similarity
CREATE OR REPLACE FUNCTION match_style_presets(
  query_embedding VECTOR(384),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  keywords TEXT[],
  parameters JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ai_style_presets.id,
    ai_style_presets.keywords,
    ai_style_presets.parameters,
    1 - (ai_style_presets.embedding <=> query_embedding) AS similarity
  FROM ai_style_presets
  WHERE 1 - (ai_style_presets.embedding <=> query_embedding) > match_threshold
  ORDER BY ai_style_presets.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patterns_updated_at
  BEFORE UPDATE ON patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_pattern_view(pattern_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE patterns
  SET view_count = view_count + 1
  WHERE id = pattern_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment download count
CREATE OR REPLACE FUNCTION increment_pattern_download(pattern_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE patterns
  SET download_count = download_count + 1
  WHERE id = pattern_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle new user signup (creates profile)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- Seed Data: AI Style Presets
-- ============================================

INSERT INTO ai_style_presets (keywords, parameters) VALUES
  (ARRAY['classic', 'traditional', 'security', 'banknote'],
   '{"family": "hypo", "R": 240, "r": 79, "d": 140, "k": 13, "m": 0.22, "mf": 7, "symmetry": 1}'),
  (ARRAY['elegant', 'art deco', 'geometric'],
   '{"family": "rose", "R": 200, "r": 60, "d": 0, "k": 8, "m": 0.15, "mf": 4, "symmetry": 8}'),
  (ARRAY['organic', 'flowing', 'nature', 'botanical'],
   '{"family": "epi", "R": 180, "r": 45, "d": 90, "k": 5, "m": 0.3, "mf": 3, "symmetry": 5}'),
  (ARRAY['modern', 'minimalist', 'clean'],
   '{"family": "liss", "R": 200, "r": 200, "d": 0, "k": 3, "m": 0, "mf": 2, "symmetry": 1}'),
  (ARRAY['complex', 'intricate', 'detailed', 'ornate'],
   '{"family": "hypo", "R": 300, "r": 97, "d": 180, "k": 23, "m": 0.35, "mf": 11, "symmetry": 6}'),
  (ARRAY['spiral', 'cosmic', 'galaxy'],
   '{"family": "fermat", "R": 200, "r": 50, "d": 0, "k": 8, "m": 0.2, "mf": 6, "symmetry": 1}');
