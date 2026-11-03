const { HttpError } = require('./errors');

function parseId(value, name = 'id') {
  const id = Number(value);
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(id) || id > 2147483647) {
    throw new HttpError(400, `${name} must be a positive integer.`);
  }
  return id;
}

function validateObject(body, allowedFields) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object.');
  }
  const unexpected = Object.keys(body).filter((field) => !allowedFields.includes(field));
  if (unexpected.length) {
    throw new HttpError(400, 'Unknown fields in request body.', unexpected);
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpError(400, `${field} must be a non-empty string.`);
  }
  return value.trim();
}

function validateBook(body, partial = false) {
  validateObject(body, ['title', 'author', 'publishedAt', 'coverUrl']);
  const data = {};
  for (const field of ['title', 'author']) {
    if (!partial || Object.hasOwn(body, field)) {
      data[field] = requiredText(body[field], field);
    }
  }
  if (Object.hasOwn(body, 'publishedAt')) {
    const value = body.publishedAt;
    // Require a full ISO timestamp and reject impossible calendar dates.
    const pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
    const date = typeof value === 'string' ? new Date(value) : new Date(NaN);
    const day = typeof value === 'string' ? value.slice(0, 10) : '';
    const calendarDate = new Date(`${day}T00:00:00.000Z`);
    if (!pattern.test(value) || Number.isNaN(date.getTime())
      || Number.isNaN(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== day) {
      throw new HttpError(400, 'publishedAt must be a valid ISO 8601 timestamp.');
    }
    data.publishedAt = date;
  }
  if (Object.hasOwn(body, 'coverUrl')) {
    if (body.coverUrl !== null && typeof body.coverUrl !== 'string') {
      throw new HttpError(400, 'coverUrl must be a string or null.');
    }
    data.coverUrl = body.coverUrl === null ? null : body.coverUrl.trim();
  }
  if (partial && Object.keys(data).length === 0) {
    throw new HttpError(400, 'Provide at least one field to update.');
  }
  return data;
}

function validateReview(body, partial = false) {
  validateObject(body, ['rating', 'content']);
  const data = {};
  if (!partial || Object.hasOwn(body, 'rating')) {
    if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
      throw new HttpError(400, 'rating must be an integer from 1 to 5.');
    }
    data.rating = body.rating;
  }
  if (!partial || Object.hasOwn(body, 'content')) {
    data.content = requiredText(body.content, 'content');
  }
  if (partial && Object.keys(data).length === 0) {
    throw new HttpError(400, 'Provide at least one field to update.');
  }
  return data;
}

module.exports = { parseId, validateBook, validateReview };
