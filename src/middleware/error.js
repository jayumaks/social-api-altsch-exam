function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  if (err?.code === 11000) {
    return res.status(409).json({ message: 'A resource with the same unique value already exists' });
  }

  if (err?.name === 'ValidationError') {
    return res.status(400).json({ message: 'Database validation failed', errors: err.errors });
  }

  if (err?.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid resource id' });
  }

  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
}

module.exports = { notFound, errorHandler };
