require('dotenv').config();
// pkg cannot resolve Node subpath imports ("#main-entry-point") used by
// Prisma's generated default.js, so require the real entry point directly.
const { PrismaClient } = require('.prisma/client/index.js');

const globalForPrisma = globalThis;

// DATABASE_URL is always set before this module is loaded.
// In offline/desktop mode it points to a SQLite file (set by index.offline.js).
// In normal server mode it points to MySQL (set by .env).
const dbUrl = process.env.DATABASE_URL || 'mysql://root:@localhost:3306/samurai_food';

const prisma = globalForPrisma.prisma || new PrismaClient({
  datasources: {
    db: { url: dbUrl }
  },
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn']
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

module.exports = { prisma };
