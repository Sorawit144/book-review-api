const express = require('express');
const booksRouter = require('./routes/books');
const prisma = require('./prisma');
const { errorHandler } = require('./errors');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

app.get('/', (req, res) => {
  res.json({ name: 'Book Review API', framework: 'Express', books: '/books', health: '/health' });
});

app.get('/health', async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ok' });
});

app.use('/books', booksRouter);
app.use((req, res) => res.status(404).json({ error: { message: 'Endpoint not found.' } }));
app.use(errorHandler);

module.exports = app;
