const fs = require('node:fs');
const path = require('node:path');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  // Existing environment variables take priority over values in .env.
  process.loadEnvFile(envPath);
}

module.exports = {
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  port: process.env.PORT || '3000',
};
