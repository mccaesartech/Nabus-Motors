-- =============================================================================
-- 090 — Move customer identity ownership to auth.truegoshengh.com
-- =============================================================================
-- Supabase remains the application database only. Browser clients no longer
-- authenticate to Postgres, so application tables must stop depending on
-- auth.users and stop gating rows on auth.uid().
--
-- Safe to re-run: every statement is idempotent.
--
-- Scope rule: this migration only ever touches objects in schemas that the
-- current role owns. Supabase-managed schemas (auth, storage, realtime, vault,
-- …) are owned by service roles such as supabase_auth_admin, and altering them
-- from the SQL Editor fails with `42501: must be owner of table …`. Objects the
-- current role does not own are filtered out of the catalog queries below
-- rather than being attempted and swallowed.
--
-- Deliberately NOT done here: dropping the legacy `on_auth_customer_created`
-- trigger on auth.users (migrations 010 / 018 / 044). That is inside the
-- managed auth schema and cannot be altered by this role. It is inert once the
-- external provider owns signups; remove it from the Supabase dashboard if the
-- project no longer creates Supabase Auth users at all.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- External subject mapping
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS external_auth_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_external_auth_id
  ON public.profiles (external_auth_id)
  WHERE external_auth_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.external_auth_id IS
  'Immutable subject from auth.truegoshengh.com; mapped to the internal customer UUID.';

-- ---------------------------------------------------------------------------
-- Drop foreign keys FROM application tables TO auth.users
-- ---------------------------------------------------------------------------
-- Customer UUIDs stay stable and are mapped to the external provider subject
-- through profiles.external_auth_id, so the FK is no longer needed.

DO $$
DECLARE
  fk RECORD;
  auth_users_oid OID := to_regclass('auth.users')::oid;
BEGIN
  IF auth_users_oid IS NULL THEN
    RAISE NOTICE 'auth.users does not exist; no foreign keys to drop.';
    RETURN;
  END IF;

  FOR fk IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      con.conname AS constraint_name
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.contype = 'f'
      AND con.confrelid = auth_users_oid
      -- Never touch Supabase-managed schemas.
      AND n.nspname NOT IN (
        'auth', 'storage', 'realtime', 'vault', 'extensions',
        'graphql', 'graphql_public', 'pgbouncer', 'supabase_migrations',
        'cron', 'net', 'pgsodium', 'pgsodium_masks', 'information_schema'
      )
      AND n.nspname NOT LIKE 'pg\_%'
      -- ALTER TABLE requires ownership; skip anything this role does not own.
      AND pg_has_role(current_user, c.relowner, 'USAGE')
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
      fk.schema_name,
      fk.table_name,
      fk.constraint_name
    );
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- Retire auth.uid()-based RLS policies on application tables
-- ---------------------------------------------------------------------------
-- auth.uid() is always NULL now that customers hold an external session, so
-- these policies would silently deny everything. Customer access goes through
-- server routes that verify the external session and use the service role.
-- Any table left without a policy gets the deny-by-default policy used
-- elsewhere in this schema, and keeps RLS enabled, so anon/authenticated can
-- never read customer rows directly.

DO $$
DECLARE
  policy_row RECORD;
  target RECORD;
  touched OID[] := '{}';
BEGIN
  FOR policy_row IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      pol.polname AS policy_name,
      c.oid AS table_oid
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE (
        COALESCE(pg_get_expr(pol.polqual, pol.polrelid), '') ILIKE '%auth.uid()%'
        OR COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid), '') ILIKE '%auth.uid()%'
      )
      -- Never touch Supabase-managed schemas.
      AND n.nspname NOT IN (
        'auth', 'storage', 'realtime', 'vault', 'extensions',
        'graphql', 'graphql_public', 'pgbouncer', 'supabase_migrations',
        'cron', 'net', 'pgsodium', 'pgsodium_masks', 'information_schema'
      )
      AND n.nspname NOT LIKE 'pg\_%'
      -- DROP POLICY requires table ownership; skip anything this role does not own.
      AND pg_has_role(current_user, c.relowner, 'USAGE')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_row.policy_name,
      policy_row.schema_name,
      policy_row.table_name
    );

    IF NOT (policy_row.table_oid = ANY (touched)) THEN
      touched := touched || policy_row.table_oid;
    END IF;
  END LOOP;

  FOR target IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      c.oid AS table_oid,
      c.relrowsecurity AS rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.oid = ANY (touched)
  LOOP
    IF NOT target.rls_enabled THEN
      EXECUTE format(
        'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
        target.schema_name,
        target.table_name
      );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = target.table_oid) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR ALL USING (false) WITH CHECK (false)',
        format('Service role manages %s', target.table_name),
        target.schema_name,
        target.table_name
      );
    END IF;
  END LOOP;
END
$$;

-- Reload PostgREST schema cache so external_auth_id is visible immediately.
NOTIFY pgrst, 'reload schema';
