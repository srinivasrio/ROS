#!/usr/bin/env bash
# =============================================================================
# Copy DineIn One's database from the VPS (self-hosted Supabase) to the
# Supabase Cloud project, replacing the cloud project's current DineIn One data.
#
# RUN THIS ON THE VPS, as root:   bash copy_vps_db_to_cloud.sh
#
# What it does:
#   1. Backs up the cloud project's public schema + auth users to ./db-copy-<time>/
#   2. Dumps the VPS public schema (tables, data, functions, triggers) + auth users
#   3. Restores the public schema into the cloud project in ONE transaction
#      (if anything fails, the cloud project is left exactly as it was)
#   4. Replaces the cloud project's auth users with the VPS ones (one transaction)
#   5. Re-adds the same tables to Supabase Realtime as on the VPS
#   6. Prints row counts of key tables on both databases
#
# It asks for the cloud connection string at a hidden prompt, so it never
# appears in your shell history.
# =============================================================================
set -euo pipefail

STACK_DIR="${STACK_DIR:-/root/supabase-dineinone/docker}"
PG_IMAGE="${PG_IMAGE:-postgres:17-alpine}"
WORK_DIR="$(pwd)/db-copy-$(date +%Y%m%d-%H%M%S)"

say()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

# --- Locate the VPS Supabase database -----------------------------------------
[ -f "$STACK_DIR/.env" ] || fail "Supabase .env not found at $STACK_DIR/.env (set STACK_DIR=...)"
VPS_PASS="$(grep -E '^POSTGRES_PASSWORD=' "$STACK_DIR/.env" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"
[ -n "$VPS_PASS" ] || fail "POSTGRES_PASSWORD missing in $STACK_DIR/.env"

DB_CID="$(cd "$STACK_DIR" && docker compose ps -q db 2>/dev/null || true)"
[ -n "$DB_CID" ] || fail "Could not find the 'db' container of the stack in $STACK_DIR"
DB_NET="$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$DB_CID" | awk '{print $1}')"
DB_HOST="$(docker inspect -f '{{.Name}}' "$DB_CID" | sed 's#^/##')"
VPS_URL="postgresql://postgres:${VPS_PASS}@${DB_HOST}:5432/postgres"

# --- Cloud connection string (hidden prompt) ---------------------------------
echo
echo "Paste the cloud project's SESSION POOLER connection string"
echo "(Supabase dashboard -> Connect -> Session pooler -> URI, with your DB password filled in)."
read -r -s -p "Cloud DB URL: " CLOUD_URL; echo
case "$CLOUD_URL" in
  postgres://*|postgresql://*) ;;
  *) fail "That does not look like a postgresql:// connection string" ;;
esac
case "$CLOUD_URL" in
  *jmcsygpphwdubnanwjwz*) ;;
  *) read -r -p "Warning: the URL does not mention jmcsygpphwdubnanwjwz. Continue anyway? [y/N] " a; [ "$a" = "y" ] || exit 1 ;;
esac

mkdir -p "$WORK_DIR"; chmod 700 "$WORK_DIR"
docker pull -q "$PG_IMAGE" >/dev/null

# Run a postgres client tool inside a throwaway container on the Supabase network.
pg() { docker run --rm -i --network "$DB_NET" -v "$WORK_DIR:/work" "$PG_IMAGE" "$@"; }

say "Checking both connections"
pg psql "$VPS_URL"   -tAc "select 'VPS ok: ' || version();"   || fail "Cannot connect to the VPS database"
pg psql "$CLOUD_URL" -tAc "select 'Cloud ok: ' || version();" || fail "Cannot connect to the cloud database (check the URL/password)"

say "1/6 Backing up the cloud project (public schema + auth users)"
pg pg_dump "$CLOUD_URL" -n public -Fc --no-owner -f /work/cloud-backup-public.dump
pg pg_dump "$CLOUD_URL" --data-only -t auth.users -t auth.identities -f /work/cloud-backup-auth.sql
# Old backup_* schemas in the cloud project hold columns of public enum types, which blocks the
# restore. Save each one to the work folder, then drop it just before restoring (step 3).
OLD_SCHEMAS="$(pg psql "$CLOUD_URL" -tAc "select nspname from pg_namespace where nspname like 'backup\_%' order by 1;")"
for sch in $OLD_SCHEMAS; do
  pg pg_dump "$CLOUD_URL" -n "$sch" -Fc --no-owner -f "/work/cloud-old-schema-$sch.dump"
done
echo "Backup saved in $WORK_DIR"

say "2/6 Dumping the VPS database"
pg pg_dump "$VPS_URL" -n public -Fc --no-owner --no-privileges -f /work/vps-public.dump
pg pg_dump "$VPS_URL" --data-only -t auth.users -t auth.identities -f /work/vps-auth.sql
pg psql "$VPS_URL" -tAc "select tablename from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' order by 1;" > "$WORK_DIR/vps-realtime-tables.txt"
echo "Realtime tables on VPS: $(wc -l < "$WORK_DIR/vps-realtime-tables.txt")"

echo
read -r -p "About to REPLACE the cloud project's public tables and auth users with the VPS copy. Type COPY to continue: " ok
[ "$ok" = "COPY" ] || fail "Cancelled. Nothing in the cloud project was changed."

say "3/6 Restoring the public schema into the cloud project (single transaction)"
# Restore everything except the "public" schema object itself: Supabase keeps its own
# objects in public, so dropping/recreating the schema would fail.
# Cloud has a trigger on auth.users that depends on public.handle_new_user(); drop it so the
# function can be replaced, and re-add it after the auth users are copied (step 4).
TRG_ADD="DO \$\$ BEGIN IF to_regprocedure('public.handle_new_user()') IS NOT NULL THEN DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users; CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user(); END IF; END \$\$;"
pg psql "$CLOUD_URL" -v ON_ERROR_STOP=1 -c "DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;"
for sch in $OLD_SCHEMAS; do pg psql "$CLOUD_URL" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS \"$sch\" CASCADE;"; done
pg pg_restore -l /work/vps-public.dump | grep -vE " SCHEMA - public | COMMENT - SCHEMA public " > "$WORK_DIR/restore.list"
pg pg_restore -d "$CLOUD_URL" -L /work/restore.list --clean --if-exists --no-owner --no-privileges --single-transaction --exit-on-error /work/vps-public.dump \
  || { pg psql "$CLOUD_URL" -c "$TRG_ADD" >/dev/null 2>&1; fail "Restore failed and was rolled back; the cloud project is unchanged. Send the error above."; }

# Supabase's standard grants: row-level security decides what anon/authenticated can see.
pg psql "$CLOUD_URL" -v ON_ERROR_STOP=1 <<'SQL'
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
SQL

say "4/6 Replacing auth users (single transaction)"
{
  echo "DELETE FROM auth.identities;"
  echo "DELETE FROM auth.users;"
  cat "$WORK_DIR/vps-auth.sql"
} > "$WORK_DIR/apply-auth.sql"
pg psql "$CLOUD_URL" -v ON_ERROR_STOP=1 --single-transaction -q -f /work/apply-auth.sql \
  || echo "WARNING: auth users were NOT copied (rolled back; cloud auth users unchanged). App logins use DineIn One's own tables, so this only affects the Supabase Auth fallback. Send the error above."

pg psql "$CLOUD_URL" -v ON_ERROR_STOP=1 -c "$TRG_ADD"

say "5/6 Re-enabling realtime on the same tables as the VPS"
while read -r t; do
  [ -z "$t" ] && continue
  pg psql "$CLOUD_URL" -q -v ON_ERROR_STOP=1 -c "DO \$\$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='${t}') THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.${t}';
      END IF; END \$\$;" || echo "  could not add ${t} to realtime"
done < "$WORK_DIR/vps-realtime-tables.txt"

say "6/6 Comparing row counts (VPS vs cloud)"
COUNT_SQL="select 'restaurants', count(*) from public.restaurants union all
select 'tables', count(*) from public.tables union all
select 'menu_items', count(*) from public.menu_items union all
select 'employees', count(*) from public.employees union all
select 'customers', count(*) from public.customers union all
select 'orders', count(*) from public.orders union all
select 'order_items', count(*) from public.order_items union all
select 'auth.users', count(*) from auth.users;"
echo "--- VPS";   pg psql "$VPS_URL"   -tA -F ' | ' -c "$COUNT_SQL" || true
echo "--- Cloud"; pg psql "$CLOUD_URL" -tA -F ' | ' -c "$COUNT_SQL" || true

say "Done. Backups and dumps are in $WORK_DIR (they contain data: delete them when no longer needed)."
