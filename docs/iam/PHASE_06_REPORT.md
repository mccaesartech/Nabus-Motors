# Phase 6 — Google OAuth

## Delivered
- Friendly OAuth start/callback errors (no vendor strings)
- Env already accepts `auth.truegoshen.com`
- Docs: `docs/SUPABASE_AUTH_DOMAIN.md`

## User actions (required for branded Google host)
1. Supabase Pro Custom Domain → `auth.truegoshen.com` + DNS CNAME
2. Google redirect URI `https://auth.truegoshen.com/auth/v1/callback`
3. Vercel `NEXT_PUBLIC_SUPABASE_URL=https://auth.truegoshen.com` + redeploy