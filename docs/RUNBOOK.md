# Operations Runbook

This document covers deployment procedures, monitoring, common issues, and rollback procedures for the PMS application.

## Deployment

### Production Environment

- **URL:** https://pms-nine-gold.vercel.app
- **Platform:** Vercel
- **Database:** Supabase (Project ID: `lazhmdyajdqbnxxwyxun`)

### Deployment Process

1. **Automatic Deployment**
   - Push to `main` branch triggers auto-deploy on Vercel
   - Build runs `next build`
   - Preview deployments for PRs

2. **Manual Deployment**
   ```bash
   vercel --prod
   ```

3. **Database Migrations**
   ```bash
   npx supabase db push
   ```

### Pre-Deployment Checklist

- [ ] All tests passing (`pnpm test:e2e`)
- [ ] Lint check passing (`pnpm lint`)
- [ ] Build successful (`pnpm build`)
- [ ] Environment variables configured in Vercel
- [ ] Database migrations applied

## Environment Variables (Production)

| Variable | Location | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel | Public Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel | Secret - server only |
| `NEXT_PUBLIC_SITE_URL` | Vercel | Production URL |
| `ENCRYPTION_KEY` | Vercel | Secret - 64 hex chars |
| `KV_REST_API_URL` | Vercel | Rate limiting |
| `KV_REST_API_TOKEN` | Vercel | Rate limiting |

## Monitoring

### Health Checks

1. **Application Health**
   - Visit production URL
   - Check login/signup flow
   - Verify dashboard loads

2. **Database Health**
   - Supabase Dashboard > Database > Health
   - Check connection pool usage
   - Monitor query performance

3. **Vercel Analytics**
   - Deployment status
   - Function execution times
   - Error rates

### Key Metrics to Watch

| Metric | Threshold | Action |
|--------|-----------|--------|
| API Response Time | > 2s | Check database queries |
| Error Rate | > 1% | Check logs, rollback if needed |
| Database Connections | > 80% | Scale or optimize queries |
| Build Time | > 5min | Check for optimization issues |

## Common Issues

### 1. Authentication Failures

**Symptoms:** Users can't login, OAuth redirects fail

**Diagnosis:**
```bash
# Check Supabase auth logs
# Dashboard > Authentication > Logs
```

**Solutions:**
- Verify `NEXT_PUBLIC_SITE_URL` matches production URL
- Check OAuth callback URLs in Supabase
- Verify Google OAuth credentials in Supabase

### 2. Database Connection Issues

**Symptoms:** Timeout errors, 500 responses

**Diagnosis:**
```bash
# Check connection pool
npx supabase db show-pool-status
```

**Solutions:**
- Check Supabase Dashboard for outages
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
- Check RLS policies for infinite loops

### 3. Rate Limiting Errors

**Symptoms:** 429 Too Many Requests

**Diagnosis:**
- Check Vercel KV usage
- Review rate limit configuration in `lib/rate-limit/`

**Solutions:**
- If KV unavailable, rate limiting degrades gracefully
- Adjust limits in `lib/rate-limit/limiter.ts`

### 4. Build Failures

**Symptoms:** Vercel deployment fails

**Diagnosis:**
```bash
pnpm build   # Reproduce locally
pnpm lint    # Check for lint errors
```

**Solutions:**
- Fix TypeScript errors
- Fix ESLint warnings (zero tolerance)
- Check for missing environment variables

### 5. Realtime Subscription Issues

**Symptoms:** Live updates not working

**Diagnosis:**
- Check browser console for WebSocket errors
- Verify Supabase Realtime is enabled

**Solutions:**
- Check RLS policies allow SELECT
- Verify table has realtime enabled in Supabase

## Rollback Procedures

### Application Rollback (Vercel)

1. **Via Dashboard:**
   - Go to Vercel Dashboard > Deployments
   - Find last working deployment
   - Click "..." > "Promote to Production"

2. **Via CLI:**
   ```bash
   vercel rollback
   ```

### Database Rollback

**WARNING:** Database rollbacks are destructive. Use with caution.

1. **Identify the migration to rollback:**
   ```bash
   npx supabase migration list
   ```

2. **Create a rollback migration:**
   ```bash
   # Create a new migration that reverses the changes
   npx supabase migration new rollback_[feature_name]
   ```

3. **Apply the rollback:**
   ```bash
   npx supabase db push
   ```

### Emergency Procedures

1. **Site Down:**
   - Check Vercel status page
   - Check Supabase status page
   - Rollback to last known good deployment

2. **Data Breach:**
   - Rotate `SUPABASE_SERVICE_ROLE_KEY`
   - Rotate `ENCRYPTION_KEY` (will invalidate stored API keys)
   - Review Supabase auth logs
   - Enable leaked password protection

3. **Database Corruption:**
   - Contact Supabase support
   - Restore from point-in-time backup (if available)

## Maintenance Tasks

### Regular Tasks

| Task | Frequency | Command/Action |
|------|-----------|----------------|
| Dependency updates | Weekly | `pnpm update` |
| Security audit | Weekly | `pnpm audit` |
| Database vacuum | Automatic | Supabase handles |
| Log review | Daily | Check Vercel/Supabase logs |

### Supabase Maintenance

```bash
# Regenerate TypeScript types after schema changes
npx supabase gen types typescript --project-id lazhmdyajdqbnxxwyxun > lib/supabase/database.types.ts

# Check for security advisories
# Use Supabase MCP: get_advisors with type="security"
```

## Contacts

- **Vercel Support:** https://vercel.com/support
- **Supabase Support:** https://supabase.com/support
- **GitHub Issues:** https://github.com/Faresabdelghany/PMS/issues
