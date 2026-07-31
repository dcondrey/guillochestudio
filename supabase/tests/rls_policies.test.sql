-- pgTAP RLS policy tests for Guilloche Studio
-- Run via: supabase test db
--
-- Tests user data isolation enforced by Row Level Security.

BEGIN;

SELECT plan(32);

-- =============================================================================
-- Setup (runs as superuser, bypasses RLS)
-- =============================================================================

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid, 'alice@example.com', 'hashed', NOW(), NOW(), NOW(), '{}', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'bob@example.com',   'hashed', NOW(), NOW(), NOW(), '{}', '{}', 'authenticated', 'authenticated');

INSERT INTO profiles (id, username, subscription_tier)
VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid, 'alice', 'pro'),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'bob',   'free');

INSERT INTO patterns (id, user_id, name, parameters, parameter_hash, is_public)
VALUES
  ('10000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Alice Public',  '{}', 'hash1', true),
  ('10000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Alice Private', '{}', 'hash2', false),
  ('10000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'Bob Public',    '{}', 'hash3', true),
  ('10000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'Bob Private',   '{}', 'hash4', false);

INSERT INTO purchases (id, user_id, pattern_id, license_type, price_cents)
VALUES
  ('20000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'personal', 500),
  ('20000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'personal', 500);

INSERT INTO subscriptions (id, user_id, stripe_subscription_id, stripe_price_id, status)
VALUES
  ('30000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'sub_alice', 'price_pro', 'active'),
  ('30000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'sub_bob',   'price_pro', 'active');

INSERT INTO security_events (id, user_id, event_type, severity)
VALUES
  ('40000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'rate_limit_exceeded', 'low'),
  ('40000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'suspicious_login',    'high'),
  ('40000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'rate_limit_exceeded', 'low');

-- =============================================================================
-- Profiles
-- =============================================================================

-- Anon: public SELECT policy means all profiles visible
SELECT results_eq(
  'SELECT count(*)::int FROM profiles',
  ARRAY[2],
  'profiles: anon sees all profiles (public read policy)'
);

-- Alice
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT results_eq(
  'SELECT count(*)::int FROM profiles',
  ARRAY[2],
  'profiles: authenticated user sees all profiles'
);

SELECT lives_ok(
  $$UPDATE profiles SET bio = 'Hello' WHERE id = '00000000-0000-0000-0000-000000000001'$$,
  'profiles: user can update own profile'
);

-- RLS USING blocks other user's rows silently (0 rows, no error)
UPDATE profiles SET bio = 'Hacked' WHERE id = '00000000-0000-0000-0000-000000000002';
SELECT is(
  (SELECT bio FROM profiles WHERE id = '00000000-0000-0000-0000-000000000002'),
  NULL,
  'profiles: user cannot update another user''s profile'
);

-- =============================================================================
-- Patterns
-- =============================================================================

-- Alice: own 2 + Bob's 1 public = 3
SELECT results_eq(
  'SELECT count(*)::int FROM patterns',
  ARRAY[3],
  'patterns: alice sees own patterns plus public patterns from others'
);

SELECT is(
  (SELECT count(*)::int FROM patterns WHERE id = '10000000-0000-0000-0000-000000000004'),
  0,
  'patterns: alice cannot see bob''s private pattern'
);

SELECT lives_ok(
  $$INSERT INTO patterns (id, user_id, name, parameters, parameter_hash)
    VALUES ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Alice New', '{}', 'hash5')$$,
  'patterns: user can insert own pattern'
);

-- WITH CHECK violation on INSERT raises an error
SELECT throws_ok(
  $$INSERT INTO patterns (id, user_id, name, parameters, parameter_hash)
    VALUES ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002', 'Spoofed', '{}', 'hash6')$$,
  'patterns: insert attributed to another user violates WITH CHECK'
);

SELECT lives_ok(
  $$UPDATE patterns SET name = 'Alice Public v2' WHERE id = '10000000-0000-0000-0000-000000000001'$$,
  'patterns: user can update own pattern'
);

-- USING block on UPDATE is silent (0 rows affected)
UPDATE patterns SET name = 'Hacked' WHERE id = '10000000-0000-0000-0000-000000000003';
SELECT is(
  (SELECT name FROM patterns WHERE id = '10000000-0000-0000-0000-000000000003'),
  'Bob Public',
  'patterns: user cannot update another user''s pattern'
);

SELECT lives_ok(
  $$DELETE FROM patterns WHERE id = '10000000-0000-0000-0000-000000000005'$$,
  'patterns: user can delete own pattern'
);

-- USING block on DELETE is silent (0 rows affected)
DELETE FROM patterns WHERE id = '10000000-0000-0000-0000-000000000003';
SELECT results_eq(
  $$SELECT count(*)::int FROM patterns WHERE id = '10000000-0000-0000-0000-000000000003'$$,
  ARRAY[1],
  'patterns: user cannot delete another user''s pattern'
);

-- =============================================================================
-- Purchases
-- =============================================================================

SELECT results_eq(
  'SELECT count(*)::int FROM purchases',
  ARRAY[1],
  'purchases: alice sees only her own purchase'
);

SELECT is(
  (SELECT user_id::text FROM purchases LIMIT 1),
  '00000000-0000-0000-0000-000000000001',
  'purchases: returned purchase belongs to alice'
);

SELECT is(
  (SELECT count(*)::int FROM purchases WHERE user_id = '00000000-0000-0000-0000-000000000002'),
  0,
  'purchases: alice cannot read bob''s purchases'
);

SELECT lives_ok(
  $$INSERT INTO purchases (id, user_id, pattern_id, license_type, price_cents)
    VALUES ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
            '10000000-0000-0000-0000-000000000003', 'personal', 0)$$,
  'purchases: user can insert own purchase'
);

SELECT throws_ok(
  $$INSERT INTO purchases (id, user_id, pattern_id, license_type, price_cents)
    VALUES ('20000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000002',
            '10000000-0000-0000-0000-000000000001', 'personal', 0)$$,
  'purchases: insert attributed to another user violates WITH CHECK'
);

-- =============================================================================
-- Subscriptions
-- =============================================================================

SELECT results_eq(
  'SELECT count(*)::int FROM subscriptions',
  ARRAY[1],
  'subscriptions: alice sees only her own subscription'
);

SELECT is(
  (SELECT user_id::text FROM subscriptions LIMIT 1),
  '00000000-0000-0000-0000-000000000001',
  'subscriptions: returned subscription belongs to alice'
);

SELECT is(
  (SELECT count(*)::int FROM subscriptions WHERE user_id = '00000000-0000-0000-0000-000000000002'),
  0,
  'subscriptions: alice cannot read bob''s subscription'
);

-- =============================================================================
-- Switch to Bob — verify isolation is symmetric
-- =============================================================================

SET LOCAL request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';

SELECT results_eq(
  'SELECT count(*)::int FROM patterns',
  ARRAY[3],
  'patterns: bob sees own patterns plus public patterns from others'
);

SELECT is(
  (SELECT count(*)::int FROM patterns WHERE id = '10000000-0000-0000-0000-000000000002'),
  0,
  'patterns: bob cannot see alice''s private pattern'
);

SELECT results_eq(
  'SELECT count(*)::int FROM purchases',
  ARRAY[1],
  'purchases: bob sees only his own purchase'
);

SELECT results_eq(
  'SELECT count(*)::int FROM subscriptions',
  ARRAY[1],
  'subscriptions: bob sees only his own subscription'
);

-- =============================================================================
-- Anon: unauthenticated access
-- =============================================================================

SET LOCAL ROLE anon;

SELECT results_eq(
  'SELECT count(*)::int FROM profiles',
  ARRAY[2],
  'profiles: anon user sees all profiles (public read policy)'
);

SELECT results_eq(
  'SELECT count(*)::int FROM patterns',
  ARRAY[2],
  'patterns: anon sees only public patterns'
);

SELECT results_eq(
  'SELECT count(*)::int FROM purchases',
  ARRAY[0],
  'purchases: anon cannot read any purchases'
);

SELECT results_eq(
  'SELECT count(*)::int FROM subscriptions',
  ARRAY[0],
  'subscriptions: anon cannot read any subscriptions'
);

SELECT throws_ok(
  $$INSERT INTO purchases (id, user_id, pattern_id, license_type, price_cents)
    VALUES ('20000000-0000-0000-0000-000000000098', '00000000-0000-0000-0000-000000000001',
            '10000000-0000-0000-0000-000000000001', 'personal', 0)$$,
  'purchases: anon cannot insert a purchase'
);

-- =============================================================================
-- Security events: users can only see own low/medium severity
-- =============================================================================

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM security_events WHERE id = '40000000-0000-0000-0000-000000000001'$$,
  ARRAY[1],
  'security_events: alice can see her own low-severity event'
);

SELECT results_eq(
  $$SELECT count(*)::int FROM security_events WHERE id = '40000000-0000-0000-0000-000000000002'$$,
  ARRAY[0],
  'security_events: alice cannot see her own high-severity event (policy: low/medium only)'
);

SELECT results_eq(
  $$SELECT count(*)::int FROM security_events WHERE user_id = '00000000-0000-0000-0000-000000000002'$$,
  ARRAY[0],
  'security_events: alice cannot see bob''s security events'
);

SELECT * FROM finish();

ROLLBACK;
