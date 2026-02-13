-- Guilloché Studio Pro - Database Optimizations
-- Production-ready indexes, constraints, and functions

-- ============================================
-- COMPOSITE INDEXES FOR COMMON QUERIES
-- ============================================

-- Patterns: Common marketplace queries (public + listed + sorted by date)
CREATE INDEX IF NOT EXISTS idx_patterns_marketplace
  ON patterns(is_public, is_listed, created_at DESC)
  WHERE is_public = true AND is_listed = true;

-- Patterns: User's patterns sorted by update time
CREATE INDEX IF NOT EXISTS idx_patterns_user_updated
  ON patterns(user_id, updated_at DESC);

-- Patterns: Popular patterns (view/download counts)
CREATE INDEX IF NOT EXISTS idx_patterns_popular
  ON patterns(view_count DESC, download_count DESC)
  WHERE is_public = true AND is_listed = true;

-- Patterns: Price filtering for marketplace
CREATE INDEX IF NOT EXISTS idx_patterns_price
  ON patterns(price_cents, created_at DESC)
  WHERE is_listed = true;

-- Purchases: User's purchase history with dates
CREATE INDEX IF NOT EXISTS idx_purchases_user_date
  ON purchases(user_id, created_at DESC);

-- Purchases: Check if user already purchased a pattern
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_user_pattern_unique
  ON purchases(user_id, pattern_id);

-- Subscriptions: Active subscriptions lookup
CREATE INDEX IF NOT EXISTS idx_subscriptions_active
  ON subscriptions(user_id, status)
  WHERE status = 'active';

-- Pattern versions: Latest versions per pattern
CREATE INDEX IF NOT EXISTS idx_versions_pattern_latest
  ON pattern_versions(pattern_id, created_at DESC);

-- Collaboration sessions: Find active sessions for a pattern
CREATE INDEX IF NOT EXISTS idx_collab_active_pattern
  ON collaboration_sessions(pattern_id, created_at DESC)
  WHERE is_active = true;

-- Comments: Unresolved comments per pattern
CREATE INDEX IF NOT EXISTS idx_comments_unresolved
  ON pattern_comments(pattern_id, created_at DESC)
  WHERE resolved = false;

-- ============================================
-- ADDITIONAL CONSTRAINTS
-- ============================================

-- Ensure parameter_hash is consistent length (SHA-256 = 64 chars)
ALTER TABLE patterns
  ADD CONSTRAINT chk_parameter_hash_length
  CHECK (length(parameter_hash) = 64);

-- Ensure short_code is consistent length (8 chars base62)
ALTER TABLE pattern_dna
  ADD CONSTRAINT chk_short_code_length
  CHECK (length(short_code) = 8);

-- Ensure stripe IDs have proper format
ALTER TABLE profiles
  ADD CONSTRAINT chk_stripe_customer_format
  CHECK (stripe_customer_id IS NULL OR stripe_customer_id ~ '^cus_[a-zA-Z0-9]+$');

ALTER TABLE purchases
  ADD CONSTRAINT chk_stripe_payment_format
  CHECK (stripe_payment_id IS NULL OR stripe_payment_id ~ '^(pi_|ch_)[a-zA-Z0-9]+$');

ALTER TABLE subscriptions
  ADD CONSTRAINT chk_stripe_subscription_format
  CHECK (stripe_subscription_id ~ '^sub_[a-zA-Z0-9]+$');

-- Username format validation (alphanumeric, underscores, 3-30 chars)
ALTER TABLE profiles
  ADD CONSTRAINT chk_username_format
  CHECK (username IS NULL OR username ~ '^[a-zA-Z0-9_]{3,30}$');

-- ============================================
-- USEFUL DATABASE FUNCTIONS
-- ============================================

-- Function to check if user has access to a pattern
CREATE OR REPLACE FUNCTION user_has_pattern_access(
  pattern_uuid UUID,
  user_uuid UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM patterns
    WHERE id = pattern_uuid
    AND (is_public = true OR user_id = user_uuid)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user has purchased a pattern
CREATE OR REPLACE FUNCTION user_has_purchased(
  pattern_uuid UUID,
  user_uuid UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM purchases
    WHERE pattern_id = pattern_uuid
    AND user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get user's subscription tier
CREATE OR REPLACE FUNCTION get_user_tier(user_uuid UUID)
RETURNS subscription_tier AS $$
DECLARE
  tier subscription_tier;
BEGIN
  SELECT subscription_tier INTO tier
  FROM profiles
  WHERE id = user_uuid;

  RETURN COALESCE(tier, 'free'::subscription_tier);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get marketplace patterns with pagination
CREATE OR REPLACE FUNCTION get_marketplace_patterns(
  page_limit INT DEFAULT 20,
  page_offset INT DEFAULT 0,
  sort_by TEXT DEFAULT 'created_at',
  filter_tags TEXT[] DEFAULT NULL,
  min_price INT DEFAULT NULL,
  max_price INT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  thumbnail_url TEXT,
  price_cents INT,
  view_count INT,
  download_count INT,
  created_at TIMESTAMPTZ,
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  tags TEXT[]
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.description,
    p.thumbnail_url,
    p.price_cents,
    p.view_count,
    p.download_count,
    p.created_at,
    p.user_id,
    pr.username,
    pr.avatar_url,
    p.tags
  FROM patterns p
  JOIN profiles pr ON pr.id = p.user_id
  WHERE p.is_public = true
    AND p.is_listed = true
    AND (filter_tags IS NULL OR p.tags && filter_tags)
    AND (min_price IS NULL OR p.price_cents >= min_price)
    AND (max_price IS NULL OR p.price_cents <= max_price)
  ORDER BY
    CASE sort_by
      WHEN 'popular' THEN p.view_count
      WHEN 'downloads' THEN p.download_count
      WHEN 'price_asc' THEN -p.price_cents
      WHEN 'price_desc' THEN p.price_cents
      ELSE 0
    END DESC,
    p.created_at DESC
  LIMIT page_limit
  OFFSET page_offset;
END;
$$;

-- Function to get user's pattern statistics
CREATE OR REPLACE FUNCTION get_user_pattern_stats(user_uuid UUID)
RETURNS TABLE (
  total_patterns BIGINT,
  public_patterns BIGINT,
  listed_patterns BIGINT,
  total_views BIGINT,
  total_downloads BIGINT,
  total_earnings_cents BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_patterns,
    COUNT(*) FILTER (WHERE is_public = true)::BIGINT AS public_patterns,
    COUNT(*) FILTER (WHERE is_listed = true)::BIGINT AS listed_patterns,
    COALESCE(SUM(view_count), 0)::BIGINT AS total_views,
    COALESCE(SUM(download_count), 0)::BIGINT AS total_downloads,
    COALESCE((
      SELECT SUM(price_cents - royalty_paid_cents)
      FROM purchases pu
      WHERE pu.pattern_id IN (SELECT patterns.id FROM patterns WHERE patterns.user_id = user_uuid)
    ), 0)::BIGINT AS total_earnings_cents
  FROM patterns
  WHERE user_id = user_uuid;
END;
$$;

-- Function to search patterns by text
CREATE OR REPLACE FUNCTION search_patterns(
  search_query TEXT,
  page_limit INT DEFAULT 20,
  page_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  thumbnail_url TEXT,
  price_cents INT,
  tags TEXT[],
  rank REAL
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.description,
    p.thumbnail_url,
    p.price_cents,
    p.tags,
    ts_rank(
      to_tsvector('english', coalesce(p.name, '') || ' ' || coalesce(p.description, '')),
      plainto_tsquery('english', search_query)
    ) AS rank
  FROM patterns p
  WHERE p.is_public = true
    AND p.is_listed = true
    AND (
      to_tsvector('english', coalesce(p.name, '') || ' ' || coalesce(p.description, ''))
      @@ plainto_tsquery('english', search_query)
      OR p.tags && string_to_array(lower(search_query), ' ')
    )
  ORDER BY rank DESC, p.created_at DESC
  LIMIT page_limit
  OFFSET page_offset;
END;
$$;

-- Function to record a pattern remix
CREATE OR REPLACE FUNCTION record_remix(
  original_uuid UUID,
  remix_uuid UUID,
  similarity FLOAT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  remix_id UUID;
BEGIN
  INSERT INTO remixes (original_pattern_id, remix_pattern_id, similarity_score)
  VALUES (original_uuid, remix_uuid, similarity)
  ON CONFLICT (original_pattern_id, remix_pattern_id)
  DO UPDATE SET similarity_score = EXCLUDED.similarity_score
  RETURNING id INTO remix_id;

  -- Also update the pattern's remix_of field
  UPDATE patterns
  SET remix_of = original_uuid
  WHERE id = remix_uuid;

  RETURN remix_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate unique short code for pattern DNA
CREATE OR REPLACE FUNCTION generate_short_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * 62)::int + 1, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to create pattern DNA with auto-generated code
CREATE OR REPLACE FUNCTION create_pattern_dna(
  p_pattern_id UUID,
  p_parameters_compressed TEXT
)
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  attempts INT := 0;
BEGIN
  LOOP
    new_code := generate_short_code();
    BEGIN
      INSERT INTO pattern_dna (short_code, pattern_id, parameters_compressed)
      VALUES (new_code, p_pattern_id, p_parameters_compressed);
      RETURN new_code;
    EXCEPTION WHEN unique_violation THEN
      attempts := attempts + 1;
      IF attempts > 10 THEN
        RAISE EXCEPTION 'Could not generate unique short code after 10 attempts';
      END IF;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ADDITIONAL RLS POLICIES
-- ============================================

-- Allow service role to manage all data (for webhooks, admin operations)
-- Note: Service role bypasses RLS by default, but these are for edge cases

-- Subscriptions: Allow insert from webhooks (service role)
CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Purchases: Pattern owners can view purchases of their patterns
CREATE POLICY "Pattern owners can view their pattern's purchases"
  ON purchases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM patterns
      WHERE patterns.id = purchases.pattern_id
      AND patterns.user_id = auth.uid()
    )
  );

-- AI Style Presets: Anyone can read, only service role can modify
ALTER TABLE ai_style_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read AI presets"
  ON ai_style_presets FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage AI presets"
  ON ai_style_presets FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Remixes: Allow creating remixes for authenticated users
CREATE POLICY "Authenticated users can create remixes"
  ON remixes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- PERFORMANCE OPTIMIZATIONS
-- ============================================

-- Analyze tables for query planner
ANALYZE profiles;
ANALYZE patterns;
ANALYZE pattern_dna;
ANALYZE purchases;
ANALYZE remixes;
ANALYZE subscriptions;
ANALYZE collaboration_sessions;
ANALYZE pattern_comments;
ANALYZE pattern_versions;

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- Marketplace view with denormalized user data
CREATE OR REPLACE VIEW marketplace_patterns AS
SELECT
  p.id,
  p.name,
  p.description,
  p.thumbnail_url,
  p.price_cents,
  p.license_type,
  p.tags,
  p.view_count,
  p.download_count,
  p.created_at,
  p.user_id,
  pr.username AS creator_username,
  pr.display_name AS creator_display_name,
  pr.avatar_url AS creator_avatar_url
FROM patterns p
JOIN profiles pr ON pr.id = p.user_id
WHERE p.is_public = true AND p.is_listed = true;

-- User dashboard view
CREATE OR REPLACE VIEW user_pattern_summary AS
SELECT
  user_id,
  COUNT(*) AS total_patterns,
  COUNT(*) FILTER (WHERE is_public) AS public_count,
  COUNT(*) FILTER (WHERE is_listed) AS listed_count,
  SUM(view_count) AS total_views,
  SUM(download_count) AS total_downloads,
  MAX(updated_at) AS last_activity
FROM patterns
GROUP BY user_id;

-- Grant access to views
GRANT SELECT ON marketplace_patterns TO authenticated;
GRANT SELECT ON marketplace_patterns TO anon;
GRANT SELECT ON user_pattern_summary TO authenticated;

-- ============================================
-- STORAGE BUCKETS (if not exists)
-- ============================================

-- Note: Storage bucket creation should be done through Supabase dashboard
-- or via the storage API, not SQL. This is documented here for reference.
--
-- Buckets needed:
-- - pattern-thumbnails (public read, authenticated write)
-- - exports (private, authenticated only)
-- - avatars (public read, authenticated write)
