-- Phase 2 security hardening: SECURITY DEFINER RPCs must not inherit PUBLIC execute.
-- The application invokes these functions through the server-only service-role client.

REVOKE ALL ON FUNCTION public.claim_support_ticket(UUID, UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_support_ticket(UUID, UUID, BOOLEAN) FROM anon;
REVOKE ALL ON FUNCTION public.claim_support_ticket(UUID, UUID, BOOLEAN) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_support_ticket(UUID, UUID, BOOLEAN) TO service_role;

REVOKE ALL ON FUNCTION public.reopen_support_ticket(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reopen_support_ticket(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.reopen_support_ticket(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_support_ticket(UUID) TO service_role;
