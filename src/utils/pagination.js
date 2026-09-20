function getPagination(query, defaultLimit = 20, maxLimit = 100) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}

function buildMeta(total, page, limit) {
  return {
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
    has_next: page * limit < total,
    has_previous: page > 1
  };
}

module.exports = { getPagination, buildMeta };
