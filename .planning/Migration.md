# Migration: Vercel → Cloudflare (Paused)

## Why We Started
- Vercel free tier hit 100k function invocations/month limit
- SSE endpoint (`/api/updates`) reconnecting frequently was burning quota

## What Was Done
1. ✅ Upgraded Next.js from 14.2.14 → 15.2.9
2. ✅ Installed `@cloudflare/next-on-pages` and `wrangler`
3. ✅ Created GitHub repo: https://github.com/MoonBagDexter/proxima-wallet-tracker
4. ✅ Connected to Cloudflare Pages
5. ✅ Added `nodejs_compat_populate_process_env` compatibility flag
6. ✅ Site deployed: https://proxima-wallet-tracker.pages.dev/
7. ✅ Batched Redis signature checks (reduced from N calls to 1)
8. ✅ Reduced staking pools from 4 to 1
9. ✅ Reduced transaction limit from 100 to 25

## Current Problem
Cloudflare Workers free tier has **50 subrequest limit** per invocation.
The `/api/cron/poll` endpoint makes ~55+ API calls:
- 1 Helius API call
- ~25 Redis calls for addWithdrawalToBucket
- ~10 Redis calls for getWithdrawalsInBucket
- ~10 Redis calls for getAlertByDestination
- ~5 Redis calls for saveAlert
- Plus stats updates

**Error:** `{"success":false,"error":"Too many subrequests."}`

## Options to Continue

### Option A: Pay for Cloudflare Workers ($5/mo)
- Gets 1000 subrequests per invocation
- Simplest fix, no code changes needed

### Option B: Go Back to Vercel + Fix SSE
- No subrequest limit on Vercel
- Fix SSE to reduce function invocations:
  - Switch from SSE to long-polling with 30-60 second intervals
  - Or remove real-time updates entirely, use manual Refresh only

### Option C: Rewrite Detection Logic
- Batch ALL Redis operations into 5-6 calls max
- Complex refactor of `lib/detection/engine.ts`
- Would need to:
  - Use Redis pipelines/transactions
  - Batch addWithdrawalToBucket
  - Batch getWithdrawalsInBucket
  - Batch getAlertByDestination

## Environment Variables (for any platform)
```
HELIUS_API_KEY=40a52361-12f4-47ef-8fed-54c7fa3d34c4
UPSTASH_REDIS_REST_URL=https://meet-horse-45351.upstash.io
UPSTASH_REDIS_REST_TOKEN=AbEnAAIncDIwODZiMDg3MWE5MTc0ZDdkYTgwNmI1MWYxN2JjMDRiY3AyNDUzNTE
CRON_SECRET=pxm-cron-secret-7f3k9x2m
```

## Files Modified
- `package.json` - added Cloudflare scripts, upgraded Next.js
- `wrangler.toml` - Cloudflare config
- `lib/helius/client.ts` - reduced pools to 1, limit to 25
- `lib/storage/redis.ts` - added `getProcessedSignatures` batch function
- `lib/detection/engine.ts` - uses batch signature check
- `app/api/clear/route.ts` - new endpoint to clear Redis data

## Current State
- Cloudflare Pages deployment works for frontend
- API endpoints work (stats, alerts load)
- Cron polling FAILS due to subrequest limit
- External cron set up on cron-job.org but can't call poll endpoint

## To Resume
1. Pick an option above
2. If going back to Vercel: `vercel --prod` and fix SSE
3. If staying Cloudflare: upgrade to paid or batch Redis ops
