class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error instanceof HttpError) {
    return res.status(error.status).json({
      error: {
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'Request body must be valid JSON.' } });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: { message: 'Request body is too large.' } });
  }
  if (error.code === 'P2025') {
    return res.status(404).json({ error: { message: 'Resource not found.' } });
  }
  if (error.code === 'P2003') {
    return res.status(404).json({ error: { message: 'Book not found.' } });
  }

  console.error(error);
  return res.status(500).json({ error: { message: 'Internal server error.' } });
}

module.exports = { HttpError, errorHandler };
