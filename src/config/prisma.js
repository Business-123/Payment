const { PrismaClient } = require('@prisma/client');

// Reuse a single Prisma instance across the app (avoids exhausting DB connections on Railway).
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

module.exports = prisma;
