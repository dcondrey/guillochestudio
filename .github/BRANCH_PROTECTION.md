# Branch Protection Rules

This document describes the recommended branch protection rules for the Guilloche Studio repository.

## Main Branch (`main`)

The `main` branch is the production branch. It should be protected with the following rules:

### Required Status Checks

Enable "Require status checks to pass before merging" with these required checks:

- `Lint & Type Check`
- `Test (Node 20)`
- `Build WASM Engine`
- `Build Web Application`
- `Analyze JavaScript/TypeScript` (CodeQL)
- `Security Summary`

### Pull Request Requirements

- **Require a pull request before merging**: Yes
- **Required approving reviews**: 1 (or more for larger teams)
- **Dismiss stale pull request approvals when new commits are pushed**: Yes
- **Require review from Code Owners**: Yes (if CODEOWNERS file exists)
- **Require approval of the most recent reviewable push**: Yes

### Branch Restrictions

- **Require signed commits**: Recommended for production
- **Require linear history**: Recommended (enables squash or rebase merging only)
- **Include administrators**: Yes (enforce rules for admins too)
- **Allow force pushes**: No
- **Allow deletions**: No

### Merge Settings

- **Allow merge commits**: No (optional, depends on team preference)
- **Allow squash merging**: Yes
- **Allow rebase merging**: Yes
- **Automatically delete head branches**: Yes

## Staging Branch (`staging`)

The `staging` branch is for pre-production testing. Apply similar but slightly relaxed rules:

### Required Status Checks

- `Lint & Type Check`
- `Test (Node 20)`
- `Build WASM Engine`

### Pull Request Requirements

- **Require a pull request before merging**: Yes
- **Required approving reviews**: 0 (optional for faster iteration)
- **Dismiss stale pull request approvals when new commits are pushed**: Yes

### Branch Restrictions

- **Require signed commits**: Optional
- **Require linear history**: Optional
- **Include administrators**: No (allow admins to bypass for hotfixes)
- **Allow force pushes**: No
- **Allow deletions**: No

## Setting Up Branch Protection

### Via GitHub UI

1. Go to repository **Settings** > **Branches**
2. Click **Add branch protection rule**
3. Enter branch name pattern (e.g., `main`)
4. Configure the settings as described above
5. Click **Create** or **Save changes**

### Via GitHub CLI

```bash
# Protect main branch
gh api repos/{owner}/{repo}/branches/main/protection \
  -X PUT \
  -H "Accept: application/vnd.github+json" \
  -f required_status_checks='{"strict":true,"contexts":["Lint & Type Check","Test (Node 20)","Build WASM Engine","Build Web Application"]}' \
  -f enforce_admins=true \
  -f required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  -f restrictions=null \
  -f allow_force_pushes=false \
  -f allow_deletions=false
```

### Via Terraform (for IaC)

```hcl
resource "github_branch_protection" "main" {
  repository_id = github_repository.guilloche.node_id
  pattern       = "main"

  enforce_admins = true

  required_status_checks {
    strict   = true
    contexts = [
      "Lint & Type Check",
      "Test (Node 20)",
      "Build WASM Engine",
      "Build Web Application"
    ]
  }

  required_pull_request_reviews {
    dismiss_stale_reviews           = true
    required_approving_review_count = 1
  }

  restrictions {
    users = []
    teams = []
  }
}
```

## CODEOWNERS File

Create a `CODEOWNERS` file to automatically request reviews from specific teams or individuals:

```
# Default owner for everything
* @guilloche-studio/core-team

# Frontend code
/apps/web/ @guilloche-studio/frontend-team

# WASM/Rust code
/packages/guilloche-wasm/ @guilloche-studio/rust-team

# CI/CD configuration
/.github/ @guilloche-studio/devops-team

# Documentation
/docs/ @guilloche-studio/docs-team
*.md @guilloche-studio/docs-team
```

## Rulesets (GitHub Enterprise)

For organizations using GitHub Enterprise, consider using repository rulesets for more granular control:

1. Go to repository **Settings** > **Rules** > **Rulesets**
2. Create rulesets for:
   - Branch naming conventions
   - Tag protection
   - Commit message requirements
   - File path restrictions

## Environment Protection Rules

Configure environment protection for deployment environments:

### Production Environment

1. Go to **Settings** > **Environments** > **production**
2. Configure:
   - **Required reviewers**: Add team leads
   - **Wait timer**: 0-30 minutes (optional)
   - **Deployment branches**: Only `main`
   - **Environment secrets**: Configure production secrets

### Staging Environment

1. Go to **Settings** > **Environments** > **staging**
2. Configure:
   - **Required reviewers**: None (optional)
   - **Deployment branches**: `staging`, `main`
   - **Environment secrets**: Configure staging secrets

## Security Recommendations

1. **Enable secret scanning**: Settings > Security > Secret scanning
2. **Enable Dependabot alerts**: Settings > Security > Dependabot
3. **Enable code scanning alerts**: Configured via CodeQL workflow
4. **Enable push protection**: Prevents pushing detected secrets
5. **Require 2FA**: Organization settings > Authentication security

## Monitoring and Alerts

Set up notifications for:

- Failed deployments
- Security alerts
- Dependabot updates
- Branch protection bypass attempts

Configure these in **Settings** > **Notifications** or via GitHub Actions notifications.
