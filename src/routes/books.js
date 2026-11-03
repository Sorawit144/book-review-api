const express = require('express');
const prisma = require('../prisma');
const { HttpError } = require('../errors');
const { parseId, validateBook, validateReview } = require('../validation');

const router = express.Router();
const withReviews = { reviews: { orderBy: { id: 'asc' } } };

router.param('bookId', (req, res, next, value) => {
  try {
    req.bookId = parseId(value, 'bookId');
    next();
  } catch (error) { next(error); }
});

router.param('reviewId', (req, res, next, value) => {
  try {
    req.reviewId = parseId(value, 'reviewId');
    next();
  } catch (error) { next(error); }
});

async function requireBook(bookId) {
  const book = await prisma.book.findUnique({ where: { id: bookId }, select: { id: true } });
  if (!book) throw new HttpError(404, 'Book not found.');
}

router.get('/', async (req, res) => {
  const books = await prisma.book.findMany({ include: withReviews, orderBy: { id: 'asc' } });
  res.json(books);
});

router.post('/', async (req, res) => {
  const data = validateBook(req.body);
  const book = await prisma.book.create({ data, include: withReviews });
  res.location(`/books/${book.id}`).status(201).json(book);
});

router.get('/:bookId', async (req, res) => {
  const book = await prisma.book.findUnique({ where: { id: req.bookId }, include: withReviews });
  if (!book) throw new HttpError(404, 'Book not found.');
  res.json(book);
});

async function updateBook(req, res) {
  const data = validateBook(req.body, req.method === 'PATCH');
  const book = await prisma.book.update({ where: { id: req.bookId }, data, include: withReviews });
  res.json(book);
}

router.put('/:bookId', updateBook);
router.patch('/:bookId', updateBook);

router.delete('/:bookId', async (req, res) => {
  // The relation's onDelete: Cascade also removes this book's reviews.
  await prisma.book.delete({ where: { id: req.bookId } });
  res.status(204).end();
});

router.get('/:bookId/reviews', async (req, res) => {
  await requireBook(req.bookId);
  const reviews = await prisma.review.findMany({ where: { bookId: req.bookId }, orderBy: { id: 'asc' } });
  res.json(reviews);
});

router.post('/:bookId/reviews', async (req, res) => {
  const data = validateReview(req.body);
  await requireBook(req.bookId);
  const review = await prisma.review.create({ data: { ...data, bookId: req.bookId } });
  res.location(`/books/${req.bookId}/reviews/${review.id}`).status(201).json(review);
});

router.get('/:bookId/reviews/:reviewId', async (req, res) => {
  const review = await prisma.review.findFirst({ where: { id: req.reviewId, bookId: req.bookId } });
  if (!review) throw new HttpError(404, 'Review not found for this book.');
  res.json(review);
});

router.patch('/:bookId/reviews/:reviewId', async (req, res) => {
  const data = validateReview(req.body, true);
  const review = await prisma.review.update({
    where: { id: req.reviewId, bookId: req.bookId }, data,
  });
  res.json(review);
});

router.delete('/:bookId/reviews/:reviewId', async (req, res) => {
  await prisma.review.delete({ where: { id: req.reviewId, bookId: req.bookId } });
  res.status(204).end();
});

module.exports = router;
