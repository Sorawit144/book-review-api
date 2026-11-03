const { PrismaClient } = require('@prisma/client');
const { databaseUrl } = require('./config');

const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl } },
});

module.exports = prisma;
