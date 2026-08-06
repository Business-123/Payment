#!/bin/sh
# Runs before Prisma/the server start. Prisma's CLI reads DATABASE_URL straight out
# of the environment when it validates prisma/schema.prisma — before any of our own
# JS runs — so a malformed value has to be caught and fixed right here, not in code.
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

npx prisma migrate deploy
exec node src/server.js
