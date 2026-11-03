const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Tests use their own temporary database, never the developer's dev.db.
const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'book-review-api-'));
process.env.DATABASE_URL = `file:${path.join(temporaryDir, 'test.db').replaceAll('\\', '/')}`;
const prisma = require('../src/prisma');
const app = require('../src/app');
let server;
let baseUrl;
let book;
let otherBook;
let review;

before(async () => {
  const prismaCli = path.join(path.dirname(require.resolve('prisma/package.json')), 'build', 'index.js');
  const result = spawnSync(process.execPath, [prismaCli, 'db', 'push', '--skip-generate'], {
    cwd: path.join(__dirname, '..'), env: process.env, encoding: 'utf8', timeout: 30000,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
  await prisma.$connect();
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
  fs.rmSync(temporaryDir, { recursive: true, force: true });
});

async function request(method, url, body) {
  const response = await fetch(`${baseUrl}${url}`, {
    method,
    ...(body !== undefined ? {
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    } : {}),
  });
  const text = await response.text();
  return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : null };
}

test('health checks the SQLite connection', async () => {
  assert.deepEqual(await request('GET', '/health').then((r) => r.body), { status: 'ok' });
});

test('empty database returns an empty book array', async () => {
  const response = await request('GET', '/books');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, []);
});

test('create a book with default publishedAt and nullable coverUrl', async () => {
  const response = await request('POST', '/books', { title: ' หนังสือทดสอบ ', author: 'ผู้เขียน' });
  assert.equal(response.status, 201);
  book = response.body;
  assert.equal(book.title, 'หนังสือทดสอบ');
  assert.equal(book.author, 'ผู้เขียน');
  assert.equal(book.coverUrl, null);
  assert.deepEqual(book.reviews, []);
  assert.ok(!Number.isNaN(Date.parse(book.publishedAt)));
  assert.equal(response.headers.get('location'), `/books/${book.id}`);
});

test('create a book with all optional fields', async () => {
  const response = await request('POST', '/books', {
    title: 'เล่มที่สอง', author: 'ผู้เขียนอีกคน',
    publishedAt: '2024-01-01T00:00:00.000Z', coverUrl: 'https://example.com/cover.jpg',
  });
  assert.equal(response.status, 201);
  otherBook = response.body;
  assert.equal(otherBook.publishedAt, '2024-01-01T00:00:00.000Z');
  assert.equal(otherBook.coverUrl, 'https://example.com/cover.jpg');
});

for (const [name, body] of [
  ['missing title', { author: 'ผู้เขียน' }],
  ['blank author', { title: 'ชื่อเรื่อง', author: '   ' }],
  ['invalid date', { title: 'ชื่อเรื่อง', author: 'ผู้เขียน', publishedAt: 'invalid' }],
  ['impossible calendar date', { title: 'ชื่อเรื่อง', author: 'ผู้เขียน', publishedAt: '2026-02-30T00:00:00Z' }],
  ['invalid coverUrl type', { title: 'ชื่อเรื่อง', author: 'ผู้เขียน', coverUrl: 123 }],
  ['unknown field', { title: 'ชื่อเรื่อง', author: 'ผู้เขียน', id: 99 }],
  ['array body', []],
]) {
  test(`reject book with ${name}`, async () => {
    const response = await request('POST', '/books', body);
    assert.equal(response.status, 400);
    assert.ok(response.body.error.message);
  });
}

test('create a review linked to a specific book', async () => {
  const response = await request('POST', `/books/${book.id}/reviews`, { rating: 5, content: ' อ่านสนุก ' });
  assert.equal(response.status, 201);
  review = response.body;
  assert.equal(review.rating, 5);
  assert.equal(review.content, 'อ่านสนุก');
  assert.equal(review.bookId, book.id);
  assert.equal(response.headers.get('location'), `/books/${book.id}/reviews/${review.id}`);
});

test('one book can have many reviews, including rating 1', async () => {
  const response = await request('POST', `/books/${book.id}/reviews`, { rating: 1, content: 'อยากให้มีตัวอย่างเพิ่ม' });
  assert.equal(response.status, 201);
  assert.equal(response.body.bookId, book.id);
  assert.equal(response.body.rating, 1);
});

for (const rating of [0, 6, 2.5, '5', null]) {
  test(`reject invalid rating ${JSON.stringify(rating)}`, async () => {
    assert.equal((await request('POST', `/books/${book.id}/reviews`, { rating, content: 'รีวิว' })).status, 400);
  });
}

test('reject a review without required content', async () => {
  assert.equal((await request('POST', `/books/${book.id}/reviews`, { rating: 4 })).status, 400);
  assert.equal((await request('POST', `/books/${book.id}/reviews`, { rating: 4, content: '  ' })).status, 400);
});

test('reject a review for a missing book', async () => {
  assert.equal((await request('POST', '/books/2147483647/reviews', { rating: 4, content: 'รีวิว' })).status, 404);
});

test('SQLite foreign key prevents orphan reviews', async () => {
  await assert.rejects(
    prisma.review.create({ data: { rating: 4, content: 'orphan', bookId: 2147483647 } }),
    (error) => error.code === 'P2003',
  );
});

test('book detail includes its nested reviews', async () => {
  const response = await request('GET', `/books/${book.id}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.reviews.length, 2);
  assert.deepEqual(response.body.reviews[0], review);
});

test('book list includes nested reviews for each book', async () => {
  const response = await request('GET', '/books');
  assert.equal(response.body.length, 2);
  assert.equal(response.body[0].reviews.length, 2);
  assert.deepEqual(response.body[1].reviews, []);
});

test('retrieve a book review list and a single review', async () => {
  const list = await request('GET', `/books/${book.id}/reviews`);
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 2);
  const detail = await request('GET', `/books/${book.id}/reviews/${review.id}`);
  assert.equal(detail.status, 200);
  assert.deepEqual(detail.body, review);
});

test('a review cannot be read, updated, or deleted through another book', async () => {
  const url = `/books/${otherBook.id}/reviews/${review.id}`;
  assert.equal((await request('GET', url)).status, 404);
  assert.equal((await request('PATCH', url, { rating: 2 })).status, 404);
  assert.equal((await request('DELETE', url)).status, 404);
  assert.equal((await request('GET', `/books/${book.id}/reviews/${review.id}`)).body.rating, 5);
});

test('update a review and validate its new rating', async () => {
  const url = `/books/${book.id}/reviews/${review.id}`;
  assert.equal((await request('PATCH', url, { rating: 7 })).status, 400);
  assert.equal((await request('PATCH', url, {})).status, 400);
  const response = await request('PATCH', url, { rating: 4, content: 'แก้ไขรีวิว' });
  assert.equal(response.status, 200);
  assert.equal(response.body.rating, 4);
  assert.equal(response.body.content, 'แก้ไขรีวิว');
});

test('PATCH book updates only supplied fields and keeps reviews', async () => {
  const response = await request('PATCH', `/books/${book.id}`, { title: 'ชื่อใหม่', coverUrl: null });
  assert.equal(response.status, 200);
  assert.equal(response.body.title, 'ชื่อใหม่');
  assert.equal(response.body.author, 'ผู้เขียน');
  assert.equal(response.body.coverUrl, null);
  assert.equal(response.body.reviews.length, 2);
  assert.equal((await request('PATCH', `/books/${book.id}`, {})).status, 400);
});

test('PUT book requires title and author', async () => {
  assert.equal((await request('PUT', `/books/${otherBook.id}`, { title: 'ชื่อใหม่' })).status, 400);
  const response = await request('PUT', `/books/${otherBook.id}`, { title: 'ชื่อใหม่', author: 'ผู้เขียนใหม่' });
  assert.equal(response.status, 200);
  assert.equal(response.body.author, 'ผู้เขียนใหม่');
});

test('data persists when the database client reconnects', async () => {
  await prisma.$disconnect();
  await prisma.$connect();
  const response = await request('GET', `/books/${book.id}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.reviews.length, 2);
});

test('return 400 for malformed IDs and 404 for unknown resources', async () => {
  for (const id of ['abc', '0', '-1', '1.5', '2147483648', '12abc']) {
    assert.equal((await request('GET', `/books/${id}`)).status, 400);
  }
  assert.equal((await request('GET', '/books/2147483647')).status, 404);
  assert.equal((await request('DELETE', '/books/2147483647')).status, 404);
  assert.equal((await request('GET', '/unknown')).status, 404);
});

test('malformed JSON and oversized bodies return JSON errors', async () => {
  const malformed = await fetch(`${baseUrl}/books`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  });
  assert.equal(malformed.status, 400);
  assert.ok((await malformed.json()).error.message);
  const oversized = await request('POST', '/books', { title: 'a'.repeat(110000), author: 'test' });
  assert.equal(oversized.status, 413);
});

test('delete one review without deleting its book', async () => {
  const response = await request('DELETE', `/books/${book.id}/reviews/${review.id}`);
  assert.equal(response.status, 204);
  assert.equal(response.body, null);
  assert.equal((await request('GET', `/books/${book.id}`)).body.reviews.length, 1);
});

test('deleting a book cascades to all remaining reviews', async () => {
  assert.equal((await request('DELETE', `/books/${book.id}`)).status, 204);
  assert.equal(await prisma.review.count({ where: { bookId: book.id } }), 0);
  assert.equal((await request('GET', `/books/${book.id}`)).status, 404);
  assert.equal((await request('GET', `/books/${book.id}/reviews`)).status, 404);
  assert.equal((await request('GET', `/books/${otherBook.id}`)).status, 200);
});
