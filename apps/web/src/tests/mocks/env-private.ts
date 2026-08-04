// Stub for $env/dynamic/private — overridden per-test by vi.mock()
export const env: Record<string, string> = {
  STRIPE_SECRET_KEY: '',
  STRIPE_WEBHOOK_SECRET: '',
  SUPABASE_SERVICE_ROLE_KEY: '',
  PRIVATE_SIGNING_SECRET: '',
  OPENAI_API_KEY: '',
  ANTHROPIC_API_KEY: '',
  SENTRY_DSN: '',
};
