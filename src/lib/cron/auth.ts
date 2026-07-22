import "server-only";

export function verifyCronSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const headerSecret = req.headers.get("x-cron-secret");
  return headerSecret === secret;
}
