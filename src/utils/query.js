// Shared helpers for list endpoints: pagination, sorting, and the
// { data, pagination } response envelope.

function parsePagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

// Maps a `?sort=field` / `?sort=-field` param to a safe SQL ORDER BY clause.
// `allowedFields` maps API field names to real column expressions, which is
// what keeps this injection-proof — anything unlisted falls back.
function parseSort(query, allowedFields, fallback = 'created_at DESC') {
  const raw = query.sort;
  if (!raw) return fallback;

  const desc = raw.startsWith('-');
  const field = desc ? raw.slice(1) : raw;
  const column = allowedFields[field];
  if (!column) return fallback;

  return `${column} ${desc ? 'DESC' : 'ASC'}`;
}

function buildPagination({ page, limit, total }) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

module.exports = { parsePagination, parseSort, buildPagination };
