-- =============================================================================
-- VERSIONED DOCUMENT MODEL MIGRATION
-- =============================================================================
-- Transforms flat pattern storage into a proper document model with:
-- - Version history
-- - Autosave with conflict detection (base_version_id pattern)
-- - DNA codes derived from version snapshots
-- - Export queue with status tracking
-- - Short links for generic sharing
-- - View analytics
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. ALTER patterns TABLE (add current_version_id, complexity_score)
-- -----------------------------------------------------------------------------

-- Add current_version_id to patterns (will be set after migration)
ALTER TABLE public.patterns
  ADD COLUMN IF NOT EXISTS current_version_id UUID REFERENCES public.pattern_versions(id),
  ADD COLUMN IF NOT EXISTS complexity_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private'
    CHECK (visibility IN ('private', 'unlisted', 'public', 'listed'));

-- Migrate is_public/is_listed to visibility enum
UPDATE public.patterns SET visibility = CASE
  WHEN is_listed = true THEN 'listed'
  WHEN is_public = true THEN 'public'
  ELSE 'private'
END;

-- Index for quick owner lookup
CREATE INDEX IF NOT EXISTS idx_patterns_owner_updated
  ON public.patterns(user_id, updated_at DESC);

-- -----------------------------------------------------------------------------
-- 2. ALTER pattern_versions TABLE (add snapshot_hash, dna_code, compression)
-- -----------------------------------------------------------------------------

ALTER TABLE public.pattern_versions
  ADD COLUMN IF NOT EXISTS snapshot_hash TEXT,
  ADD COLUMN IF NOT EXISTS dna_code CHAR(8),
  ADD COLUMN IF NOT EXISTS compressed_snapshot BYTEA,
  ADD COLUMN IF NOT EXISTS is_autosave BOOLEAN DEFAULT false;

-- Unique constraint on dna_code (one DNA per version)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pattern_versions_dna
  ON public.pattern_versions(dna_code)
  WHERE dna_code IS NOT NULL;

-- Index for finding latest version
CREATE INDEX IF NOT EXISTS idx_pattern_versions_latest
  ON public.pattern_versions(pattern_id, created_at DESC);

-- Index for branching history
CREATE INDEX IF NOT EXISTS idx_pattern_versions_parent
  ON public.pattern_versions(parent_version_id);

-- Hash index for conflict detection
CREATE INDEX IF NOT EXISTS idx_pattern_versions_hash
  ON public.pattern_versions(snapshot_hash);

-- -----------------------------------------------------------------------------
-- 3. CREATE short_links TABLE (generic shareable links)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.short_links (
  code CHAR(8) PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('pattern', 'version', 'collection', 'profile')),
  target_id UUID NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for target lookup
CREATE INDEX IF NOT EXISTS idx_short_links_target
  ON public.short_links(target_type, target_id);

-- Index for cleanup of expired links
CREATE INDEX IF NOT EXISTS idx_short_links_expires
  ON public.short_links(expires_at)
  WHERE expires_at IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. CREATE pattern_views TABLE (analytics)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pattern_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id UUID NOT NULL REFERENCES public.patterns(id) ON DELETE CASCADE,
  version_id UUID REFERENCES public.pattern_versions(id) ON DELETE SET NULL,
  viewer_hash TEXT NOT NULL, -- Hashed fingerprint/IP for deduplication
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  country_code CHAR(2),
  device_type TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partitioned index for time-series queries
CREATE INDEX IF NOT EXISTS idx_pattern_views_pattern_time
  ON public.pattern_views(pattern_id, created_at DESC);

-- Index for deduplication within time window
CREATE INDEX IF NOT EXISTS idx_pattern_views_dedup
  ON public.pattern_views(pattern_id, viewer_hash, created_at);

-- Daily aggregation view
CREATE OR REPLACE VIEW public.pattern_view_daily AS
SELECT
  pattern_id,
  DATE(created_at) as view_date,
  COUNT(*) as view_count,
  COUNT(DISTINCT viewer_hash) as unique_viewers
FROM public.pattern_views
GROUP BY pattern_id, DATE(created_at);

-- -----------------------------------------------------------------------------
-- 5. CREATE exports TABLE (job queue with status)
-- -----------------------------------------------------------------------------

CREATE TYPE export_status AS ENUM ('queued', 'processing', 'done', 'failed');
CREATE TYPE export_format AS ENUM ('svg', 'png', 'pdf', 'dxf', 'gcode', 'hpgl');

CREATE TABLE IF NOT EXISTS public.exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id UUID NOT NULL REFERENCES public.patterns(id) ON DELETE CASCADE,
  version_id UUID REFERENCES public.pattern_versions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  format export_format NOT NULL,
  settings JSONB DEFAULT '{}'::jsonb,
  status export_status DEFAULT 'queued',
  file_path TEXT,
  file_size_bytes INTEGER,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- Index for user's export history
CREATE INDEX IF NOT EXISTS idx_exports_user_created
  ON public.exports(user_id, created_at DESC);

-- Index for job queue processing
CREATE INDEX IF NOT EXISTS idx_exports_queue
  ON public.exports(status, created_at)
  WHERE status IN ('queued', 'processing');

-- Index for cleanup of expired exports
CREATE INDEX IF NOT EXISTS idx_exports_expires
  ON public.exports(expires_at)
  WHERE expires_at IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 6. CREATE listings TABLE (marketplace, versioned)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id UUID NOT NULL REFERENCES public.patterns(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES public.pattern_versions(id),
  seller_id UUID NOT NULL REFERENCES auth.users(id),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency CHAR(3) DEFAULT 'USD',
  license_type TEXT NOT NULL CHECK (license_type IN ('personal', 'commercial', 'remix')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'active', 'suspended', 'sold_out')),
  preview_image_url TEXT,
  sales_count INTEGER DEFAULT 0,
  revenue_cents INTEGER DEFAULT 0,
  featured_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pattern_id, version_id) -- One listing per version
);

-- Index for marketplace queries
CREATE INDEX IF NOT EXISTS idx_listings_active
  ON public.listings(status, created_at DESC)
  WHERE status = 'active';

-- Index for seller dashboard
CREATE INDEX IF NOT EXISTS idx_listings_seller
  ON public.listings(seller_id, created_at DESC);

-- Index for featured/trending
CREATE INDEX IF NOT EXISTS idx_listings_featured
  ON public.listings(featured_at DESC NULLS LAST)
  WHERE status = 'active';

-- -----------------------------------------------------------------------------
-- 7. CREATE payouts TABLE (creator earnings)
-- -----------------------------------------------------------------------------

CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency CHAR(3) DEFAULT 'USD',
  status payout_status DEFAULT 'pending',
  stripe_transfer_id TEXT,
  stripe_payout_id TEXT,
  error_message TEXT,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  sales_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Index for payout queue
CREATE INDEX IF NOT EXISTS idx_payouts_pending
  ON public.payouts(status, created_at)
  WHERE status IN ('pending', 'processing');

-- Index for user payout history
CREATE INDEX IF NOT EXISTS idx_payouts_user
  ON public.payouts(user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 8. CREATE local_drafts TABLE (server-side draft recovery)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.local_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_id UUID REFERENCES public.patterns(id) ON DELETE CASCADE,
  base_version_id UUID REFERENCES public.pattern_versions(id),
  snapshot JSONB NOT NULL,
  snapshot_hash TEXT NOT NULL,
  device_fingerprint_hash TEXT,
  last_modified_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, pattern_id) -- One draft per pattern per user
);

-- Index for draft recovery on login
CREATE INDEX IF NOT EXISTS idx_local_drafts_user
  ON public.local_drafts(user_id, last_modified_at DESC);

-- -----------------------------------------------------------------------------
-- 9. FUNCTIONS: Version management
-- -----------------------------------------------------------------------------

-- Function: Create a new version (returns version_id)
CREATE OR REPLACE FUNCTION public.create_pattern_version(
  p_pattern_id UUID,
  p_author_id UUID,
  p_snapshot JSONB,
  p_base_version_id UUID DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_is_autosave BOOLEAN DEFAULT false
) RETURNS TABLE(
  version_id UUID,
  conflict BOOLEAN,
  current_version_id UUID
) AS $$
DECLARE
  v_current_version_id UUID;
  v_new_version_id UUID;
  v_snapshot_hash TEXT;
  v_dna_code CHAR(8);
  v_has_conflict BOOLEAN := false;
BEGIN
  -- Get current version
  SELECT p.current_version_id INTO v_current_version_id
  FROM public.patterns p
  WHERE p.id = p_pattern_id
  FOR UPDATE; -- Lock the row

  -- Check for conflict (optimistic locking)
  IF p_base_version_id IS NOT NULL AND v_current_version_id IS NOT NULL
     AND p_base_version_id != v_current_version_id THEN
    v_has_conflict := true;
  END IF;

  -- Only create version if no conflict OR forced (autosave)
  IF NOT v_has_conflict OR p_is_autosave THEN
    -- Generate snapshot hash
    v_snapshot_hash := encode(sha256(p_snapshot::text::bytea), 'hex');

    -- Generate DNA code (simplified - real implementation in app layer)
    v_dna_code := substring(encode(sha256(p_snapshot::text::bytea), 'base64') from 1 for 8);
    v_dna_code := regexp_replace(v_dna_code, '[^A-Za-z0-9]', 'X', 'g');

    -- Insert new version
    INSERT INTO public.pattern_versions (
      pattern_id, created_by, parameters, parent_version_id,
      name, snapshot_hash, dna_code, is_autosave
    ) VALUES (
      p_pattern_id, p_author_id, p_snapshot,
      COALESCE(p_base_version_id, v_current_version_id),
      COALESCE(p_name, 'Version ' || NOW()::DATE),
      v_snapshot_hash, v_dna_code, p_is_autosave
    ) RETURNING id INTO v_new_version_id;

    -- Update pattern's current version (only if not autosave)
    IF NOT p_is_autosave THEN
      UPDATE public.patterns
      SET current_version_id = v_new_version_id,
          parameters = p_snapshot,
          updated_at = NOW()
      WHERE id = p_pattern_id;
    END IF;
  END IF;

  RETURN QUERY SELECT
    v_new_version_id,
    v_has_conflict,
    v_current_version_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Resolve DNA code to pattern/version
CREATE OR REPLACE FUNCTION public.resolve_dna(
  p_dna_code TEXT
) RETURNS TABLE(
  pattern_id UUID,
  version_id UUID,
  pattern_name TEXT,
  thumbnail_url TEXT,
  parameters JSONB,
  creator_id UUID,
  creator_name TEXT
) AS $$
BEGIN
  -- First check pattern_versions (preferred, versioned DNA)
  RETURN QUERY
  SELECT
    p.id as pattern_id,
    pv.id as version_id,
    p.name as pattern_name,
    p.thumbnail_url,
    pv.parameters,
    p.user_id as creator_id,
    pr.display_name as creator_name
  FROM public.pattern_versions pv
  JOIN public.patterns p ON p.id = pv.pattern_id
  LEFT JOIN public.profiles pr ON pr.id = p.user_id
  WHERE pv.dna_code = p_dna_code
  LIMIT 1;

  -- If no results, check legacy pattern_dna table
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      pd.pattern_id,
      NULL::UUID as version_id,
      p.name as pattern_name,
      p.thumbnail_url,
      p.parameters,
      p.user_id as creator_id,
      pr.display_name as creator_name
    FROM public.pattern_dna pd
    LEFT JOIN public.patterns p ON p.id = pd.pattern_id
    LEFT JOIN public.profiles pr ON pr.id = p.user_id
    WHERE pd.short_code = p_dna_code
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Record pattern view (deduplicated)
CREATE OR REPLACE FUNCTION public.record_pattern_view(
  p_pattern_id UUID,
  p_viewer_hash TEXT,
  p_referrer TEXT DEFAULT NULL,
  p_device_type TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_recent_view BOOLEAN;
BEGIN
  -- Check if viewer has viewed in last hour (deduplication)
  SELECT EXISTS(
    SELECT 1 FROM public.pattern_views
    WHERE pattern_id = p_pattern_id
      AND viewer_hash = p_viewer_hash
      AND created_at > NOW() - INTERVAL '1 hour'
  ) INTO v_recent_view;

  IF NOT v_recent_view THEN
    -- Insert new view
    INSERT INTO public.pattern_views (pattern_id, viewer_hash, referrer, device_type)
    VALUES (p_pattern_id, p_viewer_hash, p_referrer, p_device_type);

    -- Update denormalized count (batched, not on every view)
    -- This would be better as a scheduled job
    UPDATE public.patterns
    SET view_count = view_count + 1
    WHERE id = p_pattern_id;

    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Create export job
CREATE OR REPLACE FUNCTION public.create_export_job(
  p_pattern_id UUID,
  p_version_id UUID,
  p_user_id UUID,
  p_format export_format,
  p_settings JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  v_export_id UUID;
BEGIN
  INSERT INTO public.exports (
    pattern_id, version_id, user_id, format, settings
  ) VALUES (
    p_pattern_id, p_version_id, p_user_id, p_format, p_settings
  ) RETURNING id INTO v_export_id;

  RETURN v_export_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update export job status
CREATE OR REPLACE FUNCTION public.update_export_status(
  p_export_id UUID,
  p_status export_status,
  p_file_path TEXT DEFAULT NULL,
  p_file_size INTEGER DEFAULT NULL,
  p_error TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE public.exports SET
    status = p_status,
    file_path = COALESCE(p_file_path, file_path),
    file_size_bytes = COALESCE(p_file_size, file_size_bytes),
    error_message = p_error,
    started_at = CASE WHEN p_status = 'processing' THEN NOW() ELSE started_at END,
    completed_at = CASE WHEN p_status IN ('done', 'failed') THEN NOW() ELSE completed_at END
  WHERE id = p_export_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Generate unique short code
CREATE OR REPLACE FUNCTION public.generate_unique_short_code() RETURNS CHAR(8) AS $$
DECLARE
  v_code CHAR(8);
  v_exists BOOLEAN;
  v_chars TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
BEGIN
  LOOP
    -- Generate random 8-char code
    v_code := '';
    FOR i IN 1..8 LOOP
      v_code := v_code || substr(v_chars, floor(random() * 62 + 1)::int, 1);
    END LOOP;

    -- Check uniqueness across all tables that use short codes
    SELECT EXISTS(
      SELECT 1 FROM public.short_links WHERE code = v_code
      UNION ALL
      SELECT 1 FROM public.pattern_dna WHERE short_code = v_code
      UNION ALL
      SELECT 1 FROM public.pattern_versions WHERE dna_code = v_code
    ) INTO v_exists;

    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY POLICIES
-- -----------------------------------------------------------------------------

-- short_links
ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read non-expired short_links"
  ON public.short_links FOR SELECT
  USING (expires_at IS NULL OR expires_at > NOW());

CREATE POLICY "Users can create their own short_links"
  ON public.short_links FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own short_links"
  ON public.short_links FOR DELETE
  USING (auth.uid() = created_by);

-- pattern_views
ALTER TABLE public.pattern_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert pattern views"
  ON public.pattern_views FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Pattern owners can read their views"
  ON public.pattern_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.patterns p
      WHERE p.id = pattern_views.pattern_id
      AND p.user_id = auth.uid()
    )
  );

-- exports
ALTER TABLE public.exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own exports"
  ON public.exports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own exports"
  ON public.exports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- listings
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active listings"
  ON public.listings FOR SELECT
  USING (status = 'active' OR auth.uid() = seller_id);

CREATE POLICY "Sellers can manage their listings"
  ON public.listings FOR ALL
  USING (auth.uid() = seller_id);

-- payouts
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own payouts"
  ON public.payouts FOR SELECT
  USING (auth.uid() = user_id);

-- local_drafts
ALTER TABLE public.local_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own drafts"
  ON public.local_drafts FOR ALL
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 11. TRIGGERS
-- -----------------------------------------------------------------------------

-- Auto-update updated_at on listings
CREATE OR REPLACE FUNCTION public.update_listings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_listings_updated_at();

-- Auto-cleanup old exports
CREATE OR REPLACE FUNCTION public.cleanup_expired_exports()
RETURNS void AS $$
BEGIN
  DELETE FROM public.exports
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Auto-cleanup old views (keep 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_views()
RETURNS void AS $$
BEGIN
  DELETE FROM public.pattern_views
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 12. MIGRATION: Backfill current_version_id for existing patterns
-- -----------------------------------------------------------------------------

-- Create initial versions for patterns that don't have them
INSERT INTO public.pattern_versions (pattern_id, created_by, parameters, name, is_autosave)
SELECT
  p.id,
  p.user_id,
  p.parameters,
  'Initial Version',
  false
FROM public.patterns p
WHERE NOT EXISTS (
  SELECT 1 FROM public.pattern_versions pv WHERE pv.pattern_id = p.id
);

-- Set current_version_id to the most recent version
UPDATE public.patterns p SET
  current_version_id = (
    SELECT pv.id
    FROM public.pattern_versions pv
    WHERE pv.pattern_id = p.id
    ORDER BY pv.created_at DESC
    LIMIT 1
  )
WHERE p.current_version_id IS NULL;

COMMIT;
