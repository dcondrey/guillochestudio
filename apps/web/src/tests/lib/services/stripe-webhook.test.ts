import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks — must come before vi.mock() factories reference them
const { mockConstructEvent, mockSubscriptionsRetrieve } = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockSubscriptionsRetrieve: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeBuilder(): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: Record<string, any> = {};
  b.select = vi.fn(() => b);
  b.update = vi.fn(() => b);
  b.upsert = vi.fn(() => b);
  b.eq = vi.fn(() => b);
  b.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
  return b;
}

const profileBuilder = makeBuilder();
const subscriptionBuilder = makeBuilder();

const mockFrom = vi.hoisted(() =>
  vi.fn((table: string) => {
    if (table === 'profiles') return profileBuilder;
    if (table === 'subscriptions') return subscriptionBuilder;
    return makeBuilder();
  })
);

vi.mock('$env/static/private', () => ({
  STRIPE_SECRET_KEY: 'sk_test_mock',
  STRIPE_WEBHOOK_SECRET: 'whsec_mock',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-mock',
  PRIVATE_SIGNING_SECRET: 'signing-secret-mock',
}));

vi.mock('$env/static/public', () => ({
  PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  PUBLIC_SUPABASE_ANON_KEY: 'anon-key-mock',
}));

vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    webhooks: { constructEvent: mockConstructEvent },
    subscriptions: { retrieve: mockSubscriptionsRetrieve },
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

import { POST } from '../../../routes/api/stripe/webhook/+server.js';

// ---------------------------------------------------------------------------

function makeLocals() {
  return {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    supabase: null,
    safeGetSession: vi.fn(),
    requestId: 'req-test',
    nonce: 'nonce-test',
    session: null,
    user: null,
    performanceMonitor: { start: vi.fn(), end: vi.fn() },
  };
}

function makeRequest(body: string, signature: string | null = 'sig-mock') {
  const headers = new Headers({ 'content-type': 'text/plain' });
  if (signature !== null) headers.set('stripe-signature', signature);
  return new Request('https://example.com/api/stripe/webhook', {
    method: 'POST',
    headers,
    body,
  });
}

function stripeEvent(type: string, object: Record<string, unknown>) {
  return { type, data: { object }, id: 'evt_test' };
}

// ---------------------------------------------------------------------------

describe('signature verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects missing stripe-signature with 400', async () => {
    const ev = { request: makeRequest('{}', null), locals: makeLocals() };
    await expect(POST(ev as never)).rejects.toMatchObject({ status: 400 });
  });

  it('rejects invalid signature with 400', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Webhook signature verification failed');
    });
    const ev = { request: makeRequest('{}'), locals: makeLocals() };
    await expect(POST(ev as never)).rejects.toMatchObject({ status: 400 });
  });
});

describe('checkout.session.completed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(profileBuilder).forEach((fn) => fn.mockReset());
    Object.values(subscriptionBuilder).forEach((fn) => fn.mockReset());
    // Default chain: each builder method returns itself
    profileBuilder.select.mockReturnValue(profileBuilder);
    profileBuilder.update.mockReturnValue(profileBuilder);
    profileBuilder.upsert.mockReturnValue(profileBuilder);
    profileBuilder.eq.mockReturnValue(profileBuilder);
    profileBuilder.single.mockResolvedValue({ data: null, error: null });
    subscriptionBuilder.select.mockReturnValue(subscriptionBuilder);
    subscriptionBuilder.update.mockReturnValue(subscriptionBuilder);
    subscriptionBuilder.upsert.mockReturnValue(subscriptionBuilder);
    subscriptionBuilder.eq.mockReturnValue({ data: null, error: null });
    subscriptionBuilder.single.mockResolvedValue({ data: null, error: null });
  });

  it('returns 200 and updates profile tier when metadata is valid', async () => {
    const session = {
      metadata: { user_id: 'user-123', tier: 'pro' },
      customer: 'cus_test',
      subscription: null,
    };
    mockConstructEvent.mockReturnValue(stripeEvent('checkout.session.completed', session));
    profileBuilder.eq.mockReturnValue({ data: null, error: null });

    const ev = { request: makeRequest('{}'), locals: makeLocals() };
    const response = await POST(ev as never);
    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
    expect(profileBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ subscription_tier: 'pro', stripe_customer_id: 'cus_test' })
    );
  });

  it('returns 200 and skips update when user_id is missing', async () => {
    const session = { metadata: {}, customer: 'cus_test', subscription: null };
    mockConstructEvent.mockReturnValue(stripeEvent('checkout.session.completed', session));

    const ev = { request: makeRequest('{}'), locals: makeLocals() };
    const response = await POST(ev as never);
    expect(response.status).toBe(200);
    expect(profileBuilder.update).not.toHaveBeenCalled();
  });

  it('returns 500 when profile update fails so Stripe retries', async () => {
    const session = {
      metadata: { user_id: 'user-123', tier: 'pro' },
      customer: 'cus_test',
      subscription: null,
    };
    mockConstructEvent.mockReturnValue(stripeEvent('checkout.session.completed', session));
    profileBuilder.eq.mockReturnValue({ data: null, error: { message: 'DB error' } });

    const ev = { request: makeRequest('{}'), locals: makeLocals() };
    await expect(POST(ev as never)).rejects.toMatchObject({ status: 500 });
  });
});

describe('customer.subscription.updated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(profileBuilder).forEach((fn) => fn.mockReset());
    Object.values(subscriptionBuilder).forEach((fn) => fn.mockReset());
    profileBuilder.select.mockReturnValue(profileBuilder);
    profileBuilder.update.mockReturnValue(profileBuilder);
    profileBuilder.eq.mockReturnValue({ data: null, error: null });
    profileBuilder.single.mockResolvedValue({ data: { id: 'user-123' }, error: null });
    subscriptionBuilder.update.mockReturnValue(subscriptionBuilder);
    subscriptionBuilder.eq.mockReturnValue({ data: null, error: null });
  });

  it('downgrades to free tier when subscription is canceled', async () => {
    const sub = {
      id: 'sub_test',
      customer: 'cus_test',
      status: 'canceled',
      items: { data: [{ price: { id: 'price_test' } }] },
      current_period_start: 1000,
      current_period_end: 2000,
      cancel_at_period_end: true,
    };
    mockConstructEvent.mockReturnValue(stripeEvent('customer.subscription.updated', sub));
    // select chain: .select('id').eq(...).single()
    profileBuilder.eq.mockReturnValueOnce({
      single: () => Promise.resolve({ data: { id: 'user-123' }, error: null }),
    });
    // subscriptions.update().eq() — no error
    subscriptionBuilder.eq.mockReturnValueOnce({ data: null, error: null });
    // profiles.update({ subscription_tier: 'free' }).eq() — no error
    profileBuilder.eq.mockReturnValueOnce({ data: null, error: null });

    const ev = { request: makeRequest('{}'), locals: makeLocals() };
    const response = await POST(ev as never);
    expect(response.status).toBe(200);
    expect(profileBuilder.update).toHaveBeenCalledWith({ subscription_tier: 'free' });
  });

  it('does not downgrade when subscription stays active', async () => {
    const sub = {
      id: 'sub_test',
      customer: 'cus_test',
      status: 'active',
      items: { data: [{ price: { id: 'price_test' } }] },
      current_period_start: 1000,
      current_period_end: 2000,
      cancel_at_period_end: false,
    };
    mockConstructEvent.mockReturnValue(stripeEvent('customer.subscription.updated', sub));
    profileBuilder.eq.mockReturnValueOnce({
      single: () => Promise.resolve({ data: { id: 'user-123' }, error: null }),
    });
    subscriptionBuilder.eq.mockReturnValueOnce({ data: null, error: null });

    const ev = { request: makeRequest('{}'), locals: makeLocals() };
    const response = await POST(ev as never);
    expect(response.status).toBe(200);
    const freeCalls = profileBuilder.update.mock.calls.filter(
      (c: unknown[]) => (c[0] as Record<string, unknown>)?.subscription_tier === 'free'
    );
    expect(freeCalls).toHaveLength(0);
  });
});

describe('customer.subscription.deleted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(profileBuilder).forEach((fn) => fn.mockReset());
    Object.values(subscriptionBuilder).forEach((fn) => fn.mockReset());
    profileBuilder.select.mockReturnValue(profileBuilder);
    profileBuilder.update.mockReturnValue(profileBuilder);
    profileBuilder.eq.mockReturnValue({ data: null, error: null });
    profileBuilder.single.mockResolvedValue({ data: { id: 'user-123' }, error: null });
    subscriptionBuilder.update.mockReturnValue(subscriptionBuilder);
    subscriptionBuilder.eq.mockReturnValue({ data: null, error: null });
  });

  it('downgrades to free tier and marks subscription canceled', async () => {
    const sub = { id: 'sub_test', customer: 'cus_test' };
    mockConstructEvent.mockReturnValue(stripeEvent('customer.subscription.deleted', sub));
    profileBuilder.eq.mockReturnValueOnce({
      single: () => Promise.resolve({ data: { id: 'user-123' }, error: null }),
    });
    profileBuilder.eq.mockReturnValueOnce({ data: null, error: null });
    subscriptionBuilder.eq.mockReturnValueOnce({ data: null, error: null });

    const ev = { request: makeRequest('{}'), locals: makeLocals() };
    const response = await POST(ev as never);
    expect(response.status).toBe(200);
    expect(profileBuilder.update).toHaveBeenCalledWith({ subscription_tier: 'free' });
    expect(subscriptionBuilder.update).toHaveBeenCalledWith({ status: 'canceled' });
  });
});

describe('other events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 for invoice.payment_failed and logs a warning', async () => {
    const invoice = { customer: 'cus_test', attempt_count: 2 };
    mockConstructEvent.mockReturnValue(stripeEvent('invoice.payment_failed', invoice));
    const locals = makeLocals();
    const response = await POST({ request: makeRequest('{}'), locals } as never);
    expect(response.status).toBe(200);
    expect(locals.logger.warn).toHaveBeenCalled();
  });

  it('returns 200 for unhandled event types and logs info', async () => {
    mockConstructEvent.mockReturnValue(stripeEvent('customer.created', { id: 'cus_test' }));
    const locals = makeLocals();
    const response = await POST({ request: makeRequest('{}'), locals } as never);
    expect(response.status).toBe(200);
    expect(locals.logger.info).toHaveBeenCalledWith(expect.stringContaining('customer.created'));
  });
});
