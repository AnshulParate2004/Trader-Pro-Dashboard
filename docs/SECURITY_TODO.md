# Security Roadmap & Vulnerability Audit Tracker

This document records security considerations, dependency audit findings, and pending architectural upgrades for the Trader-Pro quantitative platform.

---

## 1. Next.js Major Version Upgrade (Critical Advisory Resolution)

### Audit Status
- **Installed Version:** `next@14.2.35` (latest patch within the 14.2.x LTS line)
- **Reported Advisory:** GHSA-9g9p-9gw9-jx7f (and related server components / image optimization advisories affecting Next.js 9.5.0 - 15.5.27)
- **Fix Requirement:** Upgrading to Next.js 16.x (`next@16.4.5+`), which introduces breaking framework changes and requires React 19.

### Decision
Per project directive, major framework version jumps (Next 14 $\to$ 16) are deferred to prevent breaking changes in the production App Router and trading terminal layout. Instead of force-upgrading, the risk profile has been evaluated and mitigated:

### Exposure & Risk Mitigation
1. **Image Optimization API (GHSA-9g9p-9gw9-jx7f):**
   - The Trader-Pro platform uses static avatar links (DiceBear) and SVG icons (`lucide-react`). It does not expose custom user-facing image optimization pipelines or arbitrary `remotePatterns`.
2. **Server Action Deserialization:**
   - The application relies on standard Next.js REST API routes (`src/app/api/*`) with explicit request schema parsing rather than experimental Server Actions.
3. **Windows-hosted Server RCE (GHSA-p293-qw3h-jr36):**
   - Production workloads execute on Linux-based serverless infrastructure (Vercel BOM1 / AWS Lambda), where Windows-specific filesystem path traversal vulnerabilities are non-executable.

### Upgrade Roadmap
When scheduled for major migration:
- Audit all dependencies for React 19 compatibility.
- Upgrade Next.js to 16.x in an isolated feature branch.
- Re-run full end-to-end simulation suites.

---

## 2. Git History Credential Sanitization

### Identified Issue
- A historical commit contained a plaintext password (`20102004`) in `src/lib/auth.ts` and `src/app/login/page.tsx` before the introduction of signed HS256 JWT cookies and bcrypt hashing.

### Required Actions (Manual Task for User)
1. **Immediate Password Burn:** The password `20102004` (and any variant matching dates of birth) must be treated as compromised. Do not use it on any personal, exchange, or development accounts.
2. **History Rewriting:** To purge the credentials from the Git commit log permanently:
   ```bash
   git filter-repo --replace-text <(echo '20102004==>[REDACTED]')
   ```
   Or use `bfg --replace-text passwords.txt`.
3. **Force Push Protection:** Coordinate with repository collaborators before running `git push origin --force --all`.

---

## 3. Strict Secrets Validation

All production endpoints now enforce mandatory presence of:
- `AUTH_SECRET`: $\ge 32$-character cryptographically secure key for jose JWT signing.
- `AUTH_PASSWORD_HASH`: Salted bcrypt hash of administrative credentials.
- `CRON_SECRET`: Bearer authentication token for scheduled background trading loops.

If any secret is missing in `NODE_ENV=production`, the application throws a fatal configuration error immediately at boot time rather than falling back to defaults.
