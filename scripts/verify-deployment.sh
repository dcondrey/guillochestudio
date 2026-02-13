#!/bin/bash
# Guilloché Studio - Deployment Verification Script
# Run this before deploying to ensure everything is configured correctly

set -e

echo "======================================"
echo "Guilloché Studio Deployment Verifier"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

check() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
    else
        echo -e "${RED}✗${NC} $1"
        ((ERRORS++))
    fi
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

info() {
    echo -e "  $1"
}

section() {
    echo ""
    echo "--- $1 ---"
}

# 1. Check Node.js version
section "Prerequisites"

NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 20 ] 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Node.js version: $(node -v)"
else
    echo -e "${RED}✗${NC} Node.js 20+ required (found: $(node -v 2>/dev/null || echo 'not installed'))"
    ((ERRORS++))
fi

# Check pnpm
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm -v | cut -d'.' -f1)
    if [ "$PNPM_VERSION" -ge 9 ] 2>/dev/null; then
        echo -e "${GREEN}✓${NC} pnpm version: $(pnpm -v)"
    else
        warn "pnpm 9+ recommended (found: $(pnpm -v))"
    fi
else
    echo -e "${RED}✗${NC} pnpm not installed"
    ((ERRORS++))
fi

# Check Rust (for WASM)
if command -v rustc &> /dev/null; then
    echo -e "${GREEN}✓${NC} Rust version: $(rustc --version | cut -d' ' -f2)"
else
    echo -e "${RED}✗${NC} Rust not installed (required for WASM build)"
    ((ERRORS++))
fi

# Check wasm-pack
if command -v wasm-pack &> /dev/null; then
    echo -e "${GREEN}✓${NC} wasm-pack installed"
else
    warn "wasm-pack not installed (run: cargo install wasm-pack)"
fi

# Check wrangler
if command -v wrangler &> /dev/null || npx wrangler --version &> /dev/null; then
    echo -e "${GREEN}✓${NC} Wrangler available"
else
    warn "Wrangler not installed (run: npm install -g wrangler)"
fi

# 2. Check environment files
section "Environment Configuration"

if [ -f "apps/web/.env" ]; then
    echo -e "${GREEN}✓${NC} .env file exists"

    # Check required variables
    ENV_FILE="apps/web/.env"

    check_env_var() {
        if grep -q "^$1=" "$ENV_FILE" 2>/dev/null; then
            VALUE=$(grep "^$1=" "$ENV_FILE" | cut -d'=' -f2)
            if [ -n "$VALUE" ] && [ "$VALUE" != "your-"* ] && [ "$VALUE" != "xxx"* ] && [ "$VALUE" != "pk_test_"* ]; then
                echo -e "${GREEN}✓${NC}   $1 configured"
            else
                warn "$1 has placeholder value"
            fi
        else
            echo -e "${RED}✗${NC}   $1 not set"
            ((ERRORS++))
        fi
    }

    check_env_var "PUBLIC_SUPABASE_URL"
    check_env_var "PUBLIC_SUPABASE_ANON_KEY"
    check_env_var "PUBLIC_STRIPE_PUBLISHABLE_KEY"
    check_env_var "STRIPE_SECRET_KEY"
else
    echo -e "${RED}✗${NC} .env file not found (copy from .env.example)"
    ((ERRORS++))
fi

# 3. Check project structure
section "Project Structure"

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
    else
        echo -e "${RED}✗${NC} $1 not found"
        ((ERRORS++))
    fi
}

check_file "package.json"
check_file "pnpm-workspace.yaml"
check_file "apps/web/package.json"
check_file "apps/web/svelte.config.js"
check_file "apps/web/wrangler.toml"
check_file "packages/guilloche-wasm/Cargo.toml"
check_file ".github/workflows/deploy.yml"
check_file "DEPLOYMENT.md"

# 4. Check dependencies
section "Dependencies"

if [ -f "pnpm-lock.yaml" ]; then
    echo -e "${GREEN}✓${NC} pnpm-lock.yaml exists"
else
    warn "pnpm-lock.yaml not found (run: pnpm install)"
fi

if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules installed"
else
    warn "node_modules not found (run: pnpm install)"
fi

# 5. Check WASM build
section "WASM Engine"

if [ -d "packages/guilloche-wasm/pkg" ]; then
    echo -e "${GREEN}✓${NC} WASM package built"

    if [ -f "packages/guilloche-wasm/pkg/guilloche_wasm.js" ]; then
        echo -e "${GREEN}✓${NC}   JS bindings generated"
    else
        warn "JS bindings not found"
    fi

    if [ -f "packages/guilloche-wasm/pkg/guilloche_wasm_bg.wasm" ]; then
        WASM_SIZE=$(ls -lh packages/guilloche-wasm/pkg/guilloche_wasm_bg.wasm | awk '{print $5}')
        echo -e "${GREEN}✓${NC}   WASM binary: $WASM_SIZE"
    else
        warn "WASM binary not found"
    fi
else
    warn "WASM not built (run: pnpm run build:wasm)"
fi

# 6. Test build
section "Build Test"

if [ -d "apps/web/.svelte-kit" ]; then
    echo -e "${GREEN}✓${NC} SvelteKit build cache exists"
else
    info "No build cache (will be created on build)"
fi

# 7. GitHub secrets reminder
section "GitHub Secrets (Manual Check Required)"

info "Ensure these secrets are set in GitHub repo settings:"
info "  - CLOUDFLARE_API_TOKEN"
info "  - CLOUDFLARE_ACCOUNT_ID"
info "  - CLOUDFLARE_ZONE_ID"
info "  - PUBLIC_SUPABASE_URL"
info "  - PUBLIC_SUPABASE_ANON_KEY"
info "  - PUBLIC_STRIPE_PUBLISHABLE_KEY"
info "  - SUPABASE_PROJECT_REF"
info "  - SUPABASE_ACCESS_TOKEN"

# 8. Summary
section "Summary"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}All checks passed! Ready for deployment.${NC}"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}$WARNINGS warning(s) found. Review before deploying.${NC}"
else
    echo -e "${RED}$ERRORS error(s) and $WARNINGS warning(s) found.${NC}"
    echo -e "${RED}Fix errors before deploying.${NC}"
    exit 1
fi

echo ""
echo "Next steps:"
echo "  1. Run 'pnpm install' to install dependencies"
echo "  2. Run 'pnpm run build:wasm' to build WASM engine"
echo "  3. Run 'pnpm run build' to build application"
echo "  4. Run 'pnpm run deploy' to deploy to Cloudflare"
echo ""
