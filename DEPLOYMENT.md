# Deployment Guide - SolarInvest to Vercel

This guide walks through deploying the SolarInvest app to Vercel with Neon PostgreSQL and Stack Auth.

## Prerequisites

1. **Vercel Account** - Sign up at https://vercel.com
2. **Neon PostgreSQL Database** - Create a database at https://neon.tech
3. **Stack Auth Project** - Set up at https://stack-auth.com (optional but recommended)
4. **ConvertAPI Account** - For PDF conversion at https://www.convertapi.com

## Step 1: Prepare Neon Database

1. Create a new project in Neon
2. Note your connection string (pooled)
3. Run migrations (optional, tables auto-create on first use):
   ```bash
   # Connect to your Neon database
   psql "postgresql://user:password@host:5432/database?sslmode=require"
   
   # Run migration files
   \i db/migrations/0001_create_storage_events.sql
   \i db/migrations/0002_create_clients.sql
   \i db/migrations/0003_crm_schema.sql
   ```

## Step 2: Configure Stack Auth

1. Create a new project at https://stack-auth.com
2. Configure allowed origins:
   - Development: `http://localhost:5173`, `http://127.0.0.1:5173`
   - Production: `https://app.solarinvest.info` (or your domain)
3. Note the following credentials:
   - Project ID (`NEXT_PUBLIC_STACK_PROJECT_ID`)
   - Publishable Client Key (`NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY`)
   - Secret Server Key (`STACK_SECRET_SERVER_KEY`)
   - JWKS URL (auto-generated from Project ID)

## Step 3: Deploy to Vercel

### Option A: Deploy via Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   # First deployment (creates project)
   vercel
   
   # Production deployment
   vercel --prod
   ```

### Option B: Deploy via GitHub Integration

1. Push your code to GitHub
2. Go to https://vercel.com/new
3. Import your GitHub repository
4. Vercel will auto-detect the Node.js project

## Step 4: Configure Environment Variables in Vercel

Go to your project in Vercel → Settings → Environment Variables

Add the following variables for **Production**, **Preview**, and **Development** environments:

### Database (Required)
```
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
```

### Stack Auth (Required for authentication)
```
NEXT_PUBLIC_STACK_PROJECT_ID=your-stack-project-id
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=pck_your_publishable_key
STACK_SECRET_SERVER_KEY=ssk_your_secret_key
STACK_JWKS_URL=https://api.stack-auth.com/api/v1/projects/your-project-id/.well-known/jwks.json
```

### CORS (Required for production)
```
TRUSTED_WEB_ORIGINS=https://app.solarinvest.info
```

### PDF Conversion (Optional)
```
CONVERTAPI_SECRET=your_convertapi_secret
```

### Other (Optional)
```
NODE_ENV=production
PORT=3000
```

## Step 5: Trigger Deployment

After adding environment variables:

1. Go to Deployments tab
2. Click "Redeploy" on the latest deployment
3. Check "Use existing build cache" if available
4. Click "Redeploy"

Or push a new commit to trigger automatic deployment:
```bash
git commit --allow-empty -m "Trigger deployment"
git push
```

## Step 6: Verify Deployment

### Check Health Endpoints

```bash
# Basic health
curl https://app.solarinvest.info/health

# Database health
curl https://app.solarinvest.info/api/health/db

# PDF conversion health
curl https://app.solarinvest.info/api/health/pdf

# Contracts health
curl https://app.solarinvest.info/api/health/contracts
```

### Run Smoke Tests

```bash
BASE_URL=https://app.solarinvest.info node scripts/smoke-test-db.mjs
```

## Step 7: Configure Custom Domain (Optional)

1. Go to project Settings → Domains
2. Add your custom domain (e.g., `app.solarinvest.info`)
3. Follow DNS configuration instructions
4. Update `TRUSTED_WEB_ORIGINS` to include the new domain

## Troubleshooting

### Database Connection Issues

**Symptom:** `/api/health/db` returns 503 or connection errors

**Solutions:**
1. Verify `DATABASE_URL` is set correctly in Vercel
2. Check Neon dashboard - ensure database is not paused
3. Verify SSL mode is set: `?sslmode=require`
4. Check Neon connection pooling is enabled

### Authentication Issues

**Symptom:** 401 errors on protected endpoints

**Solutions:**
1. Verify all Stack Auth environment variables are set
2. Check Stack Auth dashboard - ensure origins are whitelisted
3. Test JWT token is valid: https://jwt.io
4. Check browser console for CORS errors

### PDF Conversion Issues

**Symptom:** Contracts fail to generate or return DOCX instead of PDF

**Solutions:**
1. Verify `CONVERTAPI_SECRET` is set
2. Check ConvertAPI dashboard for usage limits
3. Consider setting up Gotenberg as fallback

### CORS Errors

**Symptom:** Browser blocks requests with CORS policy errors

**Solutions:**
1. Add your domain to `TRUSTED_WEB_ORIGINS`
2. Ensure format is: `https://domain.com` (no trailing slash)
3. Multiple origins: `https://domain1.com,https://domain2.com`
4. Redeploy after changing environment variables

### Build Failures

**Symptom:** Deployment fails during build

**Solutions:**
1. Check build logs in Vercel dashboard
2. Verify `package.json` scripts are correct
3. Run `npm install` locally to check dependencies
4. Clear build cache and redeploy

## Monitoring

### Vercel Analytics

Enable in project Settings → Analytics to track:
- Page views
- Performance metrics
- Real User Monitoring (RUM)

### Database Monitoring

Check Neon dashboard for:
- Connection count
- Query performance
- Storage usage

### Logs

View runtime logs in Vercel:
1. Go to project Deployments
2. Click on a deployment
3. View Functions logs
4. Filter by endpoint or error level

## Rollback

If a deployment has issues:

1. Go to Deployments tab
2. Find a previous stable deployment
3. Click "..." menu → "Promote to Production"

Or use CLI:
```bash
vercel rollback
```

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '24'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

## Security Best Practices

1. **Never commit `.env` files** - Use `.env.example` as template
2. **Rotate secrets regularly** - Especially database passwords and API keys
3. **Use environment-specific variables** - Different secrets for dev/staging/prod
4. **Enable Vercel Authentication** - For preview deployments
5. **Monitor API usage** - Track ConvertAPI and database usage
6. **Enable rate limiting** - Protect against abuse (consider Vercel Edge Config)
7. **Review Vercel logs** - Check for suspicious activity

## Support

- **Vercel Support:** https://vercel.com/support
- **Neon Support:** https://neon.tech/docs
- **Stack Auth Support:** https://stack-auth.com/docs
- **Project Issues:** https://github.com/LeandroFrancaUS/solarinvest-app/issues
