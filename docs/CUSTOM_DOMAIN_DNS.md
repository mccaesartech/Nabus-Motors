# Custom domain DNS (truegoshengh.com)

Moved to avoid a OneDrive/UTF-16 filename issue with the previous file.

**Full launch cutover checklist:** [LAUNCH_DOMAIN_CUTOVER.md](../LAUNCH_DOMAIN_CUTOVER.md)

Canonical public URL: `https://www.truegoshengh.com`

**Auth / Google branding host:** `auth.truegoshengh.com` → Namecheap CNAME to
`ddrknhvkhmgdtavpuiiq.supabase.co` — see [SUPABASE_AUTH_DOMAIN.md](./SUPABASE_AUTH_DOMAIN.md).
Do not flip `NEXT_PUBLIC_SUPABASE_URL` to `auth.` until that host’s HTTPS is healthy.
