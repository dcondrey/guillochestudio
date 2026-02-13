# Guilloché Studio Pro - Deployment Guide

This guide covers deploying Guilloché Studio to Cloudflare Pages with Workers AI integration.

## Prerequisites

- [Cloudflare Account](https://dash.cloudflare.com/sign-up) with Workers Paid plan
- [Supabase Account](https://supabase.com) with project created
- [Stripe Account](https://stripe.com) with API keys
- Domain configured in Cloudflare DNS (guillochestudio.com)
- Node.js 20+, pnpm, and Rust toolchain installed

## Environment Setup

### 1. Cloudflare Configuration

Create a Cloudflare Pages project:

```bash
# Login to Cloudflare
npx wrangler login

# Create the Pages project
npx wrangler pages project create guilloche-studio
```

Configure custom domain in Cloudflare Dashboard:
1. Go to Pages > guilloche-studio > Custom domains
2. Add `guillochestudio.com` and `www.guillochestudio.com`
3. Verify DNS records are configured

### 2. Required Secrets

Set up the following secrets in GitHub repository settings (Settings > Secrets and variables > Actions):

**Cloudflare:**
- `CLOUDFLARE_API_TOKEN` - API token with Pages/Workers permissions
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `CLOUDFLARE_ZONE_ID` - Zone ID for guillochestudio.com

**Supabase:**
- `PUBLIC_SUPABASE_URL` - Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_PROJECT_REF` - Supabase project reference
- `SUPABASE_ACCESS_TOKEN` - Supabase CLI access token

**Stripe:**
- `PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `STRIPE_SECRET_KEY` - Stripe secret key (for Workers)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret

### 3. Cloudflare Workers Secrets

Set secrets for the Worker environment:

```bash
# Set production secrets
npx wrangler secret put SUPABASE_SERVICE_KEY
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

### 4. Cloudflare Resources

Create required Cloudflare resources:

```bash
# Create KV namespace for caching
npx wrangler kv:namespace create PATTERN_CACHE
npx wrangler kv:namespace create PATTERN_CACHE --preview

# Create R2 bucket for assets
npx wrangler r2 bucket create guilloche-assets
npx wrangler r2 bucket create guilloche-assets-preview
```

Update `wrangler.toml` with the generated IDs.

## Build & Deploy

### Local Development

```bash
# Install dependencies
pnpm install

# Build WASM engine
cd packages/guilloche-wasm
wasm-pack build --target web --dev
cd ../..

# Start development server
pnpm dev
```

### Manual Deployment

```bash
# Build WASM (release)
cd packages/guilloche-wasm
wasm-pack build --target web --release
cd ../..

# Build SvelteKit app
pnpm build

# Deploy to Cloudflare Pages
npx wrangler pages deploy apps/web/.svelte-kit/cloudflare --project-name=guilloche-studio
```

### Automated Deployment (CI/CD)

The GitHub Actions workflow automatically deploys:
- **staging** branch → staging.guillochestudio.com
- **main** branch → guillochestudio.com

## Post-Deployment

### 1. Configure Stripe Webhooks

In Stripe Dashboard, add webhook endpoint:
- URL: `https://guillochestudio.com/api/webhooks/stripe`
- Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`

### 2. Configure Supabase

Run migrations:
```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Set up RLS policies and enable realtime for collaboration tables.

### 3. Verify Workers AI

Test AI features:
```bash
curl -X POST https://guillochestudio.com/api/ai/suggest \
  -H "Content-Type: application/json" \
  -d '{"keywords": ["art deco", "gold"]}'
```

## Monitoring

### Cloudflare Analytics

- Pages Analytics: Real-time traffic, Core Web Vitals
- Workers Analytics: Function invocations, errors
- R2 Analytics: Storage usage, bandwidth

### Error Tracking

Configure Sentry or similar:
```javascript
// apps/web/src/hooks.client.ts
import * as Sentry from '@sentry/sveltekit';

Sentry.init({
  dsn: 'YOUR_SENTRY_DSN',
  environment: import.meta.env.MODE,
});
```

### Health Checks

Add uptime monitoring for:
- `https://guillochestudio.com` (main site)
- `https://guillochestudio.com/api/health` (API)
- Supabase project health

## Troubleshooting

### Build Failures

**WASM build fails:**
```bash
# Ensure Rust and wasm-pack are installed
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
```

**Missing dependencies:**
```bash
pnpm install --frozen-lockfile
```

### Runtime Errors

**Workers AI not responding:**
- Verify AI binding in wrangler.toml
- Check Workers Paid plan is active
- Review Workers Analytics for errors

**Supabase connection issues:**
- Verify environment variables
- Check RLS policies allow access
- Review Supabase logs

### Performance Issues

**Slow renders:**
- Ensure WASM engine is loading
- Check browser console for fallback messages
- Verify CDN caching is working

**High latency:**
- Enable Cloudflare Argo
- Review Workers Analytics for slow functions
- Optimize Supabase queries

## Rollback

To rollback to a previous deployment:

```bash
# List deployments
npx wrangler pages deployment list --project-name=guilloche-studio

# Rollback to specific deployment
npx wrangler pages deployment rollback --project-name=guilloche-studio --deployment-id=DEPLOYMENT_ID
```

## Support

- GitHub Issues: https://github.com/guilloche-studio/guilloche/issues
- Documentation: https://docs.guillochestudio.com
- Email: support@guillochestudio.com
