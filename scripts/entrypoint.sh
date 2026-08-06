#!/bin/sh
# Runs before the server starts. Prisma's CLI reads DATABASE_URL straight out of the
# environment when it validates prisma/schema.prisma — before any of our own JS runs —
# so a malformed value has to be caught and fixed right here, not in code.
#
# We use `prisma db push` rather than `prisma migrate deploy` on purpose: this is a
# single SQLite file on one Railway volume, not a multi-environment Postgres setup, so
# there's no real need for migration-history bookkeeping — and that bookkeeping is
# exactly what caused the last failure (a stale migration file failed once, Prisma
# recorded it as failed in the db, and every subsequent deploy refused to proceed
# until that history was manually fixed). `db push` just diffs schema.prisma against
# the current file and applies the difference — no history table, nothing to get stuck.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "FATAL: DATABASE_URL is not set." >&2
  echo "Set it in Railway -> this service -> Variables, to a file: URL pointing at" >&2
  echo "your mounted volume, e.g.:  DATABASE_URL=file:/data/hub.db" >&2
  exit 1
fi

case "$DATABASE_URL" in
  file:*)
    ;;
  *)
    echo "WARNING: DATABASE_URL (\"$DATABASE_URL\") is missing the required 'file:' prefix." >&2
    echo "Prepending it automatically so this boot can succeed — please fix the Variable" >&2
    echo "in Railway to 'file:$DATABASE_URL' so this warning goes away." >&2
    export DATABASE_URL="file:$DATABASE_URL"
    ;;
esac

npx prisma db push --skip-generate --accept-data-loss
exec node src/server.js
