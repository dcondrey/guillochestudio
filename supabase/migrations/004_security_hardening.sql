-- Guilloché Studio Pro - Security Hardening Migration
-- Adds tables for abuse detection, device fingerprinting, usage tracking, and account security

-- =============================================================================
-- Account Security Extensions
-- =============================================================================

-- Add security fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'banned', 'under_review'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 50 CHECK (trust_score >= 0 AND trust_score <= 100);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS risk_flags TEXT[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS require_verification_for_premium BOOLEAN DEFAULT true;

-- Index for security queries
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_profiles_trust_score ON profiles(trust_score);

-- =============================================================================
-- Device Fingerprints & Sessions
-- =============================================================================

CREATE TABLE IF NOT EXISTS device_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint_hash TEXT NOT NULL, -- SHA-256 of fingerprint components
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- Fingerprint components (hashed/normalized)
  user_agent_hash TEXT NOT NULL,
  screen_hash TEXT, -- resolution + color depth + pixel ratio
  timezone TEXT,
  language TEXT,
  platform TEXT,
  webgl_hash TEXT,
  canvas_hash TEXT,
  audio_hash TEXT,
  fonts_hash TEXT,

  -- Risk indicators
  is_incognito BOOLEAN DEFAULT false,
  is_headless BOOLEAN DEFAULT false,
  is_automated BOOLEAN DEFAULT false,
  has_webdriver BOOLEAN DEFAULT false,

  -- Tracking
  first_seen_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_seen_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  visit_count INTEGER DEFAULT 1,

  -- Associated accounts (for multi-account detection)
  associated_user_ids UUID[] DEFAULT '{}',

  UNIQUE(fingerprint_hash)
);

CREATE INDEX idx_device_fingerprints_user ON device_fingerprints(user_id);
CREATE INDEX idx_device_fingerprints_hash ON device_fingerprints(fingerprint_hash);
CREATE INDEX idx_device_fingerprints_associated ON device_fingerprints USING GIN(associated_user_ids);

-- User sessions with device tracking
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  device_fingerprint_id UUID REFERENCES device_fingerprints(id) ON DELETE SET NULL,

  -- Session identifiers
  session_token_hash TEXT NOT NULL, -- SHA-256 of session token
  refresh_token_hash TEXT,

  -- Client info
  ip_address INET NOT NULL,
  user_agent TEXT,
  country_code TEXT,
  city TEXT,

  -- Security
  is_suspicious BOOLEAN DEFAULT false,
  risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  mfa_verified BOOLEAN DEFAULT false,

  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_activity_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token_hash);
CREATE INDEX idx_user_sessions_device ON user_sessions(device_fingerprint_id);
CREATE INDEX idx_user_sessions_active ON user_sessions(user_id, expires_at) WHERE revoked_at IS NULL;

-- =============================================================================
-- Usage Tracking & Limits
-- =============================================================================

CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

  -- Period tracking
  period_type TEXT NOT NULL CHECK (period_type IN ('hourly', 'daily', 'monthly')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Usage counters
  patterns_created INTEGER DEFAULT 0,
  patterns_saved INTEGER DEFAULT 0,
  ai_requests INTEGER DEFAULT 0,
  exports_png INTEGER DEFAULT 0,
  exports_svg INTEGER DEFAULT 0,
  exports_pdf INTEGER DEFAULT 0,
  exports_dxf INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  bandwidth_bytes BIGINT DEFAULT 0,

  -- Computed
  total_operations INTEGER GENERATED ALWAYS AS (
    patterns_created + ai_requests + exports_png + exports_svg + exports_pdf + exports_dxf
  ) STORED,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(user_id, period_type, period_start)
);

CREATE INDEX idx_usage_records_user_period ON usage_records(user_id, period_type, period_start DESC);
CREATE INDEX idx_usage_records_period ON usage_records(period_type, period_start);

-- Lifetime usage stats (for quick lookups)
CREATE TABLE IF NOT EXISTS usage_lifetime (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,

  total_patterns_created INTEGER DEFAULT 0,
  total_ai_requests INTEGER DEFAULT 0,
  total_exports INTEGER DEFAULT 0,
  total_api_calls BIGINT DEFAULT 0,
  total_bandwidth_bytes BIGINT DEFAULT 0,

  -- Tier-specific counters (reset on billing cycle)
  current_period_patterns INTEGER DEFAULT 0,
  current_period_ai_requests INTEGER DEFAULT 0,
  current_period_exports INTEGER DEFAULT 0,
  current_period_start TIMESTAMPTZ,

  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- Abuse Detection & Security Events
-- =============================================================================

CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  device_fingerprint_id UUID REFERENCES device_fingerprints(id) ON DELETE SET NULL,
  session_id UUID REFERENCES user_sessions(id) ON DELETE SET NULL,

  -- Event details
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT,

  -- Context
  ip_address INET,
  user_agent TEXT,
  request_path TEXT,
  request_method TEXT,

  -- Evidence
  metadata JSONB DEFAULT '{}',

  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  resolution_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_security_events_user ON security_events(user_id);
CREATE INDEX idx_security_events_type ON security_events(event_type);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_created ON security_events(created_at DESC);
CREATE INDEX idx_security_events_unresolved ON security_events(user_id, severity) WHERE resolved_at IS NULL;

-- Event types for reference (not enforced, just documented)
COMMENT ON COLUMN security_events.event_type IS 'Types: suspicious_login, rate_limit_exceeded, multi_account_detected, payment_fraud, api_abuse, account_sharing, bot_detected, export_abuse, unauthorized_access, subscription_bypass_attempt';

-- IP reputation tracking
CREATE TABLE IF NOT EXISTS ip_reputation (
  ip_address INET PRIMARY KEY,
  reputation_score INTEGER DEFAULT 50 CHECK (reputation_score >= 0 AND reputation_score <= 100),

  -- Counters
  total_requests BIGINT DEFAULT 0,
  failed_logins INTEGER DEFAULT 0,
  rate_limit_hits INTEGER DEFAULT 0,
  abuse_reports INTEGER DEFAULT 0,

  -- Flags
  is_vpn BOOLEAN DEFAULT false,
  is_proxy BOOLEAN DEFAULT false,
  is_tor BOOLEAN DEFAULT false,
  is_datacenter BOOLEAN DEFAULT false,
  is_blocked BOOLEAN DEFAULT false,

  -- Tracking
  country_code TEXT,
  asn INTEGER,
  org_name TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_seen_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  blocked_until TIMESTAMPTZ
);

CREATE INDEX idx_ip_reputation_score ON ip_reputation(reputation_score);
CREATE INDEX idx_ip_reputation_blocked ON ip_reputation(is_blocked) WHERE is_blocked = true;

-- Account linking detection (shared fingerprints, IPs, payment methods)
CREATE TABLE IF NOT EXISTS account_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_1 UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  user_id_2 UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

  link_type TEXT NOT NULL CHECK (link_type IN ('device_fingerprint', 'ip_address', 'payment_method', 'email_pattern', 'behavioral')),
  confidence_score FLOAT NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),

  -- Evidence
  evidence JSONB NOT NULL,

  -- Review status
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id),
  is_legitimate BOOLEAN, -- NULL = unreviewed, true = legitimate, false = abuse

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE(user_id_1, user_id_2, link_type),
  CHECK (user_id_1 < user_id_2) -- Ensure consistent ordering
);

CREATE INDEX idx_account_links_user1 ON account_links(user_id_1);
CREATE INDEX idx_account_links_user2 ON account_links(user_id_2);
CREATE INDEX idx_account_links_unreviewed ON account_links(confidence_score DESC) WHERE reviewed_at IS NULL;

-- =============================================================================
-- Rate Limit Tracking (for persistence across restarts)
-- =============================================================================

CREATE TABLE IF NOT EXISTS rate_limit_state (
  key TEXT PRIMARY KEY, -- Format: "type:identifier" e.g., "api:user:uuid" or "api:ip:1.2.3.4"
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,

  -- For graduated penalties
  violation_count INTEGER DEFAULT 0,
  last_violation_at TIMESTAMPTZ,
  penalty_multiplier FLOAT DEFAULT 1.0
);

CREATE INDEX idx_rate_limit_window ON rate_limit_state(window_end);

-- =============================================================================
-- Request Signatures (for replay attack prevention)
-- =============================================================================

CREATE TABLE IF NOT EXISTS request_signatures (
  signature_hash TEXT PRIMARY KEY, -- SHA-256 of request signature
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  request_timestamp TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,

  -- Context
  endpoint TEXT NOT NULL,
  ip_address INET
);

CREATE INDEX idx_request_signatures_expires ON request_signatures(expires_at);
CREATE INDEX idx_request_signatures_user ON request_signatures(user_id);

-- Cleanup old signatures automatically
CREATE OR REPLACE FUNCTION cleanup_expired_signatures()
RETURNS void AS $$
BEGIN
  DELETE FROM request_signatures WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Feature Access Control
-- =============================================================================

CREATE TABLE IF NOT EXISTS feature_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  feature_name TEXT NOT NULL,

  -- Access control
  is_enabled BOOLEAN DEFAULT true,
  granted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ,
  granted_by TEXT, -- 'subscription', 'admin', 'promotion', 'beta'

  -- Usage within feature
  usage_count INTEGER DEFAULT 0,
  usage_limit INTEGER, -- NULL = unlimited
  last_used_at TIMESTAMPTZ,

  UNIQUE(user_id, feature_name)
);

CREATE INDEX idx_feature_access_user ON feature_access(user_id);
CREATE INDEX idx_feature_access_feature ON feature_access(feature_name);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE device_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_lifetime ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_access ENABLE ROW LEVEL SECURITY;

-- Device fingerprints: Users can see their own
CREATE POLICY "Users can view their own device fingerprints"
  ON device_fingerprints FOR SELECT
  USING (auth.uid() = user_id);

-- User sessions: Users can view/revoke their own sessions
CREATE POLICY "Users can view their own sessions"
  ON user_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can revoke their own sessions"
  ON user_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Usage records: Users can view their own
CREATE POLICY "Users can view their own usage records"
  ON usage_records FOR SELECT
  USING (auth.uid() = user_id);

-- Usage lifetime: Users can view their own
CREATE POLICY "Users can view their own lifetime usage"
  ON usage_lifetime FOR SELECT
  USING (auth.uid() = user_id);

-- Security events: Users can view their own (non-sensitive)
CREATE POLICY "Users can view their own security events"
  ON security_events FOR SELECT
  USING (auth.uid() = user_id AND severity IN ('low', 'medium'));

-- Feature access: Users can view their own
CREATE POLICY "Users can view their own feature access"
  ON feature_access FOR SELECT
  USING (auth.uid() = user_id);

-- =============================================================================
-- Functions
-- =============================================================================

-- Function to check if user can perform an action based on tier limits
CREATE OR REPLACE FUNCTION check_tier_limit(
  p_user_id UUID,
  p_action TEXT, -- 'pattern_save', 'ai_request', 'export_svg', etc.
  p_tier subscription_tier DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_tier subscription_tier;
  v_usage usage_lifetime%ROWTYPE;
  v_limit INTEGER;
  v_current INTEGER;
  v_allowed BOOLEAN;
BEGIN
  -- Get tier if not provided
  IF p_tier IS NULL THEN
    SELECT subscription_tier INTO v_tier FROM profiles WHERE id = p_user_id;
  ELSE
    v_tier := p_tier;
  END IF;

  -- Get current usage
  SELECT * INTO v_usage FROM usage_lifetime WHERE user_id = p_user_id;

  -- Define limits per tier
  CASE p_action
    WHEN 'pattern_save' THEN
      v_limit := CASE v_tier
        WHEN 'free' THEN 3
        WHEN 'pro' THEN 100
        WHEN 'enterprise' THEN 2147483647 -- Max int, effectively unlimited
      END;
      v_current := COALESCE(v_usage.current_period_patterns, 0);
    WHEN 'ai_request' THEN
      v_limit := CASE v_tier
        WHEN 'free' THEN 0
        WHEN 'pro' THEN 100
        WHEN 'enterprise' THEN 2147483647
      END;
      v_current := COALESCE(v_usage.current_period_ai_requests, 0);
    WHEN 'export_svg', 'export_pdf', 'export_dxf' THEN
      -- Free tier can't export these formats
      v_limit := CASE v_tier WHEN 'free' THEN 0 ELSE 2147483647 END;
      v_current := 0;
    ELSE
      v_limit := 2147483647;
      v_current := 0;
  END CASE;

  v_allowed := v_current < v_limit;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'current', v_current,
    'limit', v_limit,
    'remaining', GREATEST(0, v_limit - v_current),
    'tier', v_tier
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage counter
CREATE OR REPLACE FUNCTION increment_usage(
  p_user_id UUID,
  p_action TEXT,
  p_amount INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
BEGIN
  -- Calculate current monthly period
  v_period_start := date_trunc('month', NOW());
  v_period_end := v_period_start + INTERVAL '1 month';

  -- Upsert usage record
  INSERT INTO usage_records (user_id, period_type, period_start, period_end)
  VALUES (p_user_id, 'monthly', v_period_start, v_period_end)
  ON CONFLICT (user_id, period_type, period_start) DO NOTHING;

  -- Update the counter
  EXECUTE format(
    'UPDATE usage_records SET %I = %I + $1, updated_at = NOW()
     WHERE user_id = $2 AND period_type = $3 AND period_start = $4',
    p_action, p_action
  ) USING p_amount, p_user_id, 'monthly', v_period_start;

  -- Update lifetime stats
  INSERT INTO usage_lifetime (user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  EXECUTE format(
    'UPDATE usage_lifetime SET
       total_%s = total_%s + $1,
       current_period_%s = current_period_%s + $1,
       updated_at = NOW()
     WHERE user_id = $2',
    p_action, p_action,
    CASE
      WHEN p_action LIKE 'patterns%' THEN 'patterns'
      WHEN p_action LIKE 'ai%' THEN 'ai_requests'
      WHEN p_action LIKE 'export%' THEN 'exports'
      ELSE 'api_calls'
    END,
    CASE
      WHEN p_action LIKE 'patterns%' THEN 'patterns'
      WHEN p_action LIKE 'ai%' THEN 'ai_requests'
      WHEN p_action LIKE 'export%' THEN 'exports'
      ELSE 'api_calls'
    END
  ) USING p_amount, p_user_id;

  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log security event
CREATE OR REPLACE FUNCTION log_security_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_severity TEXT,
  p_description TEXT,
  p_metadata JSONB DEFAULT '{}',
  p_ip_address INET DEFAULT NULL,
  p_device_fingerprint_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO security_events (
    user_id, device_fingerprint_id, event_type, severity,
    description, ip_address, metadata
  ) VALUES (
    p_user_id, p_device_fingerprint_id, p_event_type, p_severity,
    p_description, p_ip_address, p_metadata
  ) RETURNING id INTO v_event_id;

  -- Update user trust score based on severity
  IF p_user_id IS NOT NULL THEN
    UPDATE profiles SET
      trust_score = GREATEST(0, trust_score - CASE p_severity
        WHEN 'low' THEN 1
        WHEN 'medium' THEN 5
        WHEN 'high' THEN 15
        WHEN 'critical' THEN 30
      END),
      risk_flags = CASE
        WHEN NOT (p_event_type = ANY(risk_flags))
        THEN array_append(risk_flags, p_event_type)
        ELSE risk_flags
      END
    WHERE id = p_user_id;

    -- Auto-suspend if trust score drops too low
    UPDATE profiles SET
      account_status = 'under_review'
    WHERE id = p_user_id AND trust_score < 20 AND account_status = 'active';
  END IF;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to detect multi-account abuse
CREATE OR REPLACE FUNCTION detect_account_link(
  p_user_id UUID,
  p_fingerprint_hash TEXT,
  p_ip_address INET
)
RETURNS JSONB AS $$
DECLARE
  v_linked_users UUID[];
  v_link_count INTEGER;
  v_result JSONB;
BEGIN
  -- Find users sharing this fingerprint
  SELECT array_agg(DISTINCT user_id) INTO v_linked_users
  FROM device_fingerprints
  WHERE fingerprint_hash = p_fingerprint_hash
    AND user_id IS NOT NULL
    AND user_id != p_user_id;

  -- Create account links if found
  IF v_linked_users IS NOT NULL THEN
    FOREACH v_link_count IN ARRAY v_linked_users LOOP
      INSERT INTO account_links (user_id_1, user_id_2, link_type, confidence_score, evidence)
      VALUES (
        LEAST(p_user_id, v_linked_users[v_link_count]),
        GREATEST(p_user_id, v_linked_users[v_link_count]),
        'device_fingerprint',
        0.9,
        jsonb_build_object('fingerprint_hash', p_fingerprint_hash)
      )
      ON CONFLICT (user_id_1, user_id_2, link_type) DO UPDATE
      SET confidence_score = GREATEST(account_links.confidence_score, 0.9);
    END LOOP;
  END IF;

  v_link_count := COALESCE(array_length(v_linked_users, 1), 0);

  RETURN jsonb_build_object(
    'has_linked_accounts', v_link_count > 0,
    'linked_count', v_link_count,
    'linked_user_ids', COALESCE(v_linked_users, '{}')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate request signature (prevent replay attacks)
CREATE OR REPLACE FUNCTION validate_request_signature(
  p_signature_hash TEXT,
  p_user_id UUID,
  p_endpoint TEXT,
  p_timestamp TIMESTAMPTZ,
  p_ip_address INET
)
RETURNS JSONB AS $$
DECLARE
  v_existing RECORD;
  v_valid BOOLEAN;
  v_reason TEXT;
BEGIN
  -- Check if signature was already used
  SELECT * INTO v_existing FROM request_signatures WHERE signature_hash = p_signature_hash;

  IF v_existing IS NOT NULL THEN
    IF v_existing.used_at IS NOT NULL THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'signature_already_used');
    END IF;

    IF v_existing.expires_at < NOW() THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'signature_expired');
    END IF;

    -- Mark as used
    UPDATE request_signatures SET used_at = NOW() WHERE signature_hash = p_signature_hash;
    RETURN jsonb_build_object('valid', true);
  END IF;

  -- Check timestamp freshness (5 minute window)
  IF p_timestamp < NOW() - INTERVAL '5 minutes' OR p_timestamp > NOW() + INTERVAL '1 minute' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'timestamp_out_of_range');
  END IF;

  -- Store new signature
  INSERT INTO request_signatures (signature_hash, user_id, endpoint, request_timestamp, expires_at, ip_address)
  VALUES (p_signature_hash, p_user_id, p_endpoint, p_timestamp, NOW() + INTERVAL '5 minutes', p_ip_address);

  RETURN jsonb_build_object('valid', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create lifetime usage record on profile creation
CREATE OR REPLACE FUNCTION create_usage_lifetime_on_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO usage_lifetime (user_id, current_period_start)
  VALUES (NEW.id, date_trunc('month', NOW()))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created_usage
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_usage_lifetime_on_profile();

-- =============================================================================
-- Scheduled Cleanup Jobs (to be run via pg_cron or external scheduler)
-- =============================================================================

-- Function to reset monthly usage counters
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS void AS $$
BEGIN
  UPDATE usage_lifetime SET
    current_period_patterns = 0,
    current_period_ai_requests = 0,
    current_period_exports = 0,
    current_period_start = date_trunc('month', NOW())
  WHERE current_period_start < date_trunc('month', NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old rate limit entries
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limit_state WHERE window_end < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
