const { PrismaClient } = require('@prisma/client');

// Backed by a SQLite file on a Railway Volume (see DATABASE_URL in .env.example) —
// no Postgres connection pool to worry about, but we still keep one PrismaClient
// instance for the process rather than creating one per request.
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

module.exports = prisma;
