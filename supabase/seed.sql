-- Guilloché Studio Pro - Development Seed Data
-- Run this after migrations to populate test data

-- ============================================
-- TEST USERS (profiles)
-- ============================================
-- Note: In development, you'll need to create auth.users first via Supabase dashboard
-- or auth API. These profiles reference those auth users.

-- Create test user UUIDs (these should match auth.users if using real auth)
DO $$
DECLARE
  user1_id UUID := '00000000-0000-0000-0000-000000000001';
  user2_id UUID := '00000000-0000-0000-0000-000000000002';
  user3_id UUID := '00000000-0000-0000-0000-000000000003';

  pattern1_id UUID;
  pattern2_id UUID;
  pattern3_id UUID;
  pattern4_id UUID;
  pattern5_id UUID;
BEGIN
  -- Insert test profiles (only if not exists)
  INSERT INTO profiles (id, username, display_name, bio, subscription_tier)
  VALUES
    (user1_id, 'designer_pro', 'Sarah Chen', 'Professional guilloché pattern designer with 10+ years experience in security printing.', 'pro'),
    (user2_id, 'artisan_dev', 'Marcus Webb', 'Digital artist exploring the intersection of mathematics and beauty.', 'free'),
    (user3_id, 'enterprise_user', 'TechCorp Design Team', 'Enterprise design team creating secure document patterns.', 'enterprise')
  ON CONFLICT (id) DO NOTHING;

  -- ============================================
  -- TEST PATTERNS
  -- ============================================

  -- Pattern 1: Classic Banknote Style
  INSERT INTO patterns (
    user_id, name, description, parameters, parameter_hash,
    is_public, is_listed, license_type, price_cents, tags, view_count, download_count
  )
  VALUES (
    user1_id,
    'Classic Banknote Rosette',
    'A traditional guilloché rosette pattern inspired by classic banknote designs. Features intricate hypocycloid curves with high symmetry.',
    '{"family": "hypo", "R": 240, "r": 79, "d": 140, "k": 13, "m": 0.22, "mf": 7, "symmetry": 8, "strokeWidth": 0.5, "strokeColor": "#1a5f2a", "backgroundColor": "#f5f5dc"}',
    'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
    true, true, 'commercial', 1999, ARRAY['banknote', 'security', 'classic', 'rosette', 'green'], 1542, 234
  )
  RETURNING id INTO pattern1_id;

  -- Pattern 2: Art Deco Rose
  INSERT INTO patterns (
    user_id, name, description, parameters, parameter_hash,
    is_public, is_listed, license_type, price_cents, tags, view_count, download_count
  )
  VALUES (
    user1_id,
    'Art Deco Rose',
    'Elegant art deco inspired rose curve pattern. Perfect for certificates and formal documents.',
    '{"family": "rose", "R": 200, "r": 60, "d": 0, "k": 8, "m": 0.15, "mf": 4, "symmetry": 8, "strokeWidth": 0.8, "strokeColor": "#8b4513", "backgroundColor": "#fffef0"}',
    'b2c3d4e5f6789012345678901234567890123456789012345678901234abcde',
    true, true, 'commercial', 2499, ARRAY['art-deco', 'elegant', 'certificate', 'formal', 'gold'], 892, 156
  )
  RETURNING id INTO pattern2_id;

  -- Pattern 3: Organic Flow (Free pattern)
  INSERT INTO patterns (
    user_id, name, description, parameters, parameter_hash,
    is_public, is_listed, license_type, price_cents, tags, view_count, download_count
  )
  VALUES (
    user2_id,
    'Organic Flow',
    'A flowing, organic pattern created with epicycloid curves. Suitable for nature-themed designs.',
    '{"family": "epi", "R": 180, "r": 45, "d": 90, "k": 5, "m": 0.3, "mf": 3, "symmetry": 5, "strokeWidth": 0.6, "strokeColor": "#2d5a27", "backgroundColor": "#ffffff"}',
    'c3d4e5f6789012345678901234567890123456789012345678901234abcdef',
    true, true, 'personal', 0, ARRAY['organic', 'nature', 'flowing', 'free', 'botanical'], 2341, 567
  )
  RETURNING id INTO pattern3_id;

  -- Pattern 4: Enterprise Security Grid
  INSERT INTO patterns (
    user_id, name, description, parameters, parameter_hash,
    is_public, is_listed, license_type, price_cents, tags, view_count, download_count
  )
  VALUES (
    user3_id,
    'Enterprise Security Grid',
    'High-complexity security pattern for enterprise document protection. Features nested hypocycloid curves with mathematical precision.',
    '{"family": "hypo", "R": 300, "r": 97, "d": 180, "k": 23, "m": 0.35, "mf": 11, "symmetry": 6, "strokeWidth": 0.3, "strokeColor": "#000066", "backgroundColor": "#ffffff"}',
    'd4e5f6789012345678901234567890123456789012345678901234abcdefab',
    true, true, 'commercial', 4999, ARRAY['security', 'enterprise', 'complex', 'protection', 'blue'], 456, 23
  )
  RETURNING id INTO pattern4_id;

  -- Pattern 5: Private pattern (not listed)
  INSERT INTO patterns (
    user_id, name, description, parameters, parameter_hash,
    is_public, is_listed, license_type, price_cents, tags
  )
  VALUES (
    user2_id,
    'Work in Progress - Spiral Galaxy',
    'Experimental Fermat spiral pattern. Still refining the parameters.',
    '{"family": "fermat", "R": 200, "r": 50, "d": 0, "k": 8, "m": 0.2, "mf": 6, "symmetry": 1, "strokeWidth": 0.4, "strokeColor": "#4a0080", "backgroundColor": "#0d0015"}',
    'e5f6789012345678901234567890123456789012345678901234abcdefabcd',
    false, false, 'personal', 0, ARRAY['wip', 'spiral', 'cosmic']
  )
  RETURNING id INTO pattern5_id;

  -- ============================================
  -- PATTERN DNA (shareable codes)
  -- ============================================

  INSERT INTO pattern_dna (short_code, pattern_id, parameters_compressed)
  VALUES
    ('ABC12345', pattern1_id, 'eJyrVspIzcnJVwIADMYCqA=='),
    ('DEF67890', pattern2_id, 'eJyrVspIzcnJVwIADMYCqA=='),
    ('GHI24680', pattern3_id, 'eJyrVspIzcnJVwIADMYCqA=='),
    ('JKL13579', pattern4_id, 'eJyrVspIzcnJVwIADMYCqA==')
  ON CONFLICT (short_code) DO NOTHING;

  -- ============================================
  -- TEST PURCHASES
  -- ============================================

  INSERT INTO purchases (user_id, pattern_id, license_type, price_cents, stripe_payment_id, royalty_paid_cents)
  VALUES
    (user2_id, pattern1_id, 'commercial', 1999, 'pi_test_123456789', 400),
    (user3_id, pattern2_id, 'commercial', 2499, 'pi_test_234567890', 500),
    (user1_id, pattern4_id, 'commercial', 4999, 'pi_test_345678901', 1000)
  ON CONFLICT DO NOTHING;

  -- ============================================
  -- TEST REMIXES
  -- ============================================

  -- Pattern 3 is inspired by Pattern 1
  INSERT INTO remixes (original_pattern_id, remix_pattern_id, similarity_score)
  VALUES (pattern1_id, pattern3_id, 0.35)
  ON CONFLICT (original_pattern_id, remix_pattern_id) DO NOTHING;

  -- ============================================
  -- TEST SUBSCRIPTIONS
  -- ============================================

  INSERT INTO subscriptions (
    user_id, stripe_subscription_id, stripe_price_id, status,
    current_period_start, current_period_end, cancel_at_period_end
  )
  VALUES
    (user1_id, 'sub_test_pro_user', 'price_pro_monthly', 'active',
     NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', false),
    (user3_id, 'sub_test_enterprise', 'price_enterprise_monthly', 'active',
     NOW() - INTERVAL '10 days', NOW() + INTERVAL '20 days', false)
  ON CONFLICT (stripe_subscription_id) DO NOTHING;

  -- ============================================
  -- TEST COLLABORATION DATA
  -- ============================================

  -- Create a collaboration session
  INSERT INTO collaboration_sessions (pattern_id, host_id, is_active)
  VALUES (pattern1_id, user1_id, true)
  ON CONFLICT DO NOTHING;

  -- Add some comments
  INSERT INTO pattern_comments (pattern_id, user_id, content, position_x, position_y, resolved)
  VALUES
    (pattern1_id, user2_id, 'Love the symmetry here! Could we try 12-fold instead?', 150.5, 200.3, false),
    (pattern1_id, user1_id, 'Great suggestion! Let me create a variant.', 180.0, 220.0, true)
  ON CONFLICT DO NOTHING;

  -- Create a pattern version
  INSERT INTO pattern_versions (pattern_id, name, parameters, created_by)
  VALUES
    (pattern1_id, 'v1.0 - Initial', '{"family": "hypo", "R": 240, "r": 79, "d": 140, "k": 13}', user1_id),
    (pattern1_id, 'v1.1 - Increased symmetry', '{"family": "hypo", "R": 240, "r": 79, "d": 140, "k": 13, "symmetry": 12}', user1_id)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seed data inserted successfully!';
END $$;

-- ============================================
-- AI STYLE PRESETS (additional presets)
-- ============================================

INSERT INTO ai_style_presets (keywords, parameters) VALUES
  (ARRAY['vintage', 'antique', 'aged', 'nostalgic'],
   '{"family": "hypo", "R": 220, "r": 73, "d": 130, "k": 11, "m": 0.18, "mf": 5, "symmetry": 4, "strokeColor": "#8b7355"}'),
  (ARRAY['futuristic', 'tech', 'digital', 'cyber'],
   '{"family": "liss", "R": 250, "r": 250, "d": 0, "k": 5, "m": 0.1, "mf": 3, "symmetry": 3, "strokeColor": "#00ffff"}'),
  (ARRAY['delicate', 'fine', 'subtle', 'refined'],
   '{"family": "rose", "R": 150, "r": 45, "d": 0, "k": 12, "m": 0.08, "mf": 2, "symmetry": 12, "strokeWidth": 0.2}'),
  (ARRAY['bold', 'strong', 'prominent', 'striking'],
   '{"family": "epi", "R": 280, "r": 70, "d": 120, "k": 7, "m": 0.4, "mf": 8, "symmetry": 7, "strokeWidth": 1.5}'),
  (ARRAY['certificate', 'diploma', 'award', 'official'],
   '{"family": "hypo", "R": 200, "r": 65, "d": 110, "k": 9, "m": 0.2, "mf": 4, "symmetry": 1, "strokeColor": "#c4a000"}'),
  (ARRAY['passport', 'visa', 'travel', 'document'],
   '{"family": "hypo", "R": 180, "r": 59, "d": 100, "k": 17, "m": 0.25, "mf": 6, "symmetry": 1, "strokeColor": "#003366"}'),
  (ARRAY['watermark', 'background', 'subtle', 'light'],
   '{"family": "rose", "R": 300, "r": 90, "d": 0, "k": 6, "m": 0.05, "mf": 2, "symmetry": 6, "strokeWidth": 0.15, "strokeColor": "#dddddd"}'),
  (ARRAY['currency', 'money', 'financial', 'bank'],
   '{"family": "hypo", "R": 260, "r": 85, "d": 150, "k": 19, "m": 0.28, "mf": 9, "symmetry": 1, "strokeColor": "#006644"}')
ON CONFLICT DO NOTHING;

-- Display summary
DO $$
DECLARE
  profile_count INT;
  pattern_count INT;
  purchase_count INT;
  preset_count INT;
BEGIN
  SELECT COUNT(*) INTO profile_count FROM profiles;
  SELECT COUNT(*) INTO pattern_count FROM patterns;
  SELECT COUNT(*) INTO purchase_count FROM purchases;
  SELECT COUNT(*) INTO preset_count FROM ai_style_presets;

  RAISE NOTICE '=== Seed Data Summary ===';
  RAISE NOTICE 'Profiles: %', profile_count;
  RAISE NOTICE 'Patterns: %', pattern_count;
  RAISE NOTICE 'Purchases: %', purchase_count;
  RAISE NOTICE 'AI Presets: %', preset_count;
END $$;
