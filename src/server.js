const { port } = require('./config');
const prisma = require('./prisma');
const app = require('./app');

async function main() {
  const portNumber = Number(port);
  if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535.');
  }
  await prisma.$connect();
  const server = app.listen(portNumber, () => {
    console.log(`Book Review API is running at http://localhost:${portNumber}`);
  });

  server.on('error', async (error) => {
    console.error('Server could not start:', error.message);
    await prisma.$disconnect();
    process.exitCode = 1;
  });

  let shuttingDown = false;
  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    server.close(async () => {
      await prisma.$disconnect();
      clearTimeout(timeout);
    });
  }
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch(async (error) => {
  console.error('Could not start API:', error.message);
  console.error('Run npm run setup first.');
  await prisma.$disconnect();
  process.exitCode = 1;
});
