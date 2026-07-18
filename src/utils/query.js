// Shared helpers for list endpoints: pagination, sorting, and building
// a { data, pagination } response envelope.

function parsePagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

function parseSort(query, allowedFields, fallback = '-createdAt') {
  const raw = query.sort || fallback;
  const desc = raw.startsWith('-');
  const field = desc ? raw.slice(1) : raw;
  if (!allowedFields.includes(field)) return { createdAt: -1 };
  return { [field]: desc ? -1 : 1 };
}

async function paginatedList(model, { filter, sort, page, limit, skip, populate }) {
  let q = model.find(filter).sort(sort).skip(skip).limit(limit);
  if (populate) q = q.populate(populate);
  const [data, total] = await Promise.all([q, model.countDocuments(filter)]);
  return {
    data,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { parsePagination, parseSort, paginatedList, escapeRegex };
