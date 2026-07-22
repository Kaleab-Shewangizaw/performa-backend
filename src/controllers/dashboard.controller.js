const asyncHandler = require('../utils/asyncHandler');
const proformaModel = require('../models/proforma.model');
const customerModel = require('../models/customer.model');
const userModel = require('../models/user.model');

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Turns the [{status, count, total}] aggregate into a lookup.
function byStatus(counts) {
  return Object.fromEntries(counts.map((c) => [c.status, c]));
}

function totalOf(counts) {
  return counts.reduce((sum, c) => sum + c.count, 0);
}

const sales = asyncHandler(async (req, res) => {
  const [recentCustomers, recentProformas, counts] = await Promise.all([
    customerModel.recent(5),
    proformaModel.list({
      salesPersonId: req.user.id,
      sort: 'p.created_at DESC',
      limit: 5,
      offset: 0,
    }),
    proformaModel.statusCounts(req.user.id),
  ]);

  const s = byStatus(counts);
  res.json({
    recentCustomers,
    recentProformas: recentProformas.data,
    stats: {
      drafts: s.draft?.count || 0,
      pending: s.pending?.count || 0,
      supervisorApproved: s.supervisor_approved?.count || 0,
      approved: s.approved?.count || 0,
      rejected: s.rejected?.count || 0,
      approvedValue: s.approved?.total || 0,
    },
  });
});

const supervisor = asyncHandler(async (req, res) => {
  const [pendingReviews, approvedToday, counts] = await Promise.all([
    proformaModel.list({ status: 'pending', sort: 'p.created_at ASC', limit: 10, offset: 0 }),
    proformaModel.countApprovedBySupervisorSince(req.user.id, startOfToday()),
    proformaModel.statusCounts(),
  ]);

  const s = byStatus(counts);
  res.json({
    pendingReviews: pendingReviews.data,
    stats: {
      pending: s.pending?.count || 0,
      approvedToday,
      rejected: s.rejected?.count || 0,
      supervisorApproved: s.supervisor_approved?.count || 0,
      approved: s.approved?.count || 0,
      total: totalOf(counts),
    },
  });
});

const admin = asyncHandler(async (req, res) => {
  const [counts, totalCustomers, totalUsers, revenue, awaitingFinal, monthly] = await Promise.all([
    proformaModel.statusCounts(),
    customerModel.count(),
    userModel.countActive(),
    proformaModel.approvedRevenue(),
    proformaModel.list({
      status: 'supervisor_approved',
      sort: 'p.created_at ASC',
      limit: 10,
      offset: 0,
    }),
    proformaModel.monthlyRevenue(12),
  ]);

  const s = byStatus(counts);
  res.json({
    awaitingFinal: awaitingFinal.data,
    stats: {
      revenue,
      totalCustomers,
      totalUsers,
      totalProformas: totalOf(counts),
      pending: s.pending?.count || 0,
      supervisorApproved: s.supervisor_approved?.count || 0,
      approved: s.approved?.count || 0,
      rejected: s.rejected?.count || 0,
      drafts: s.draft?.count || 0,
    },
    monthlyRevenue: monthly,
  });
});

module.exports = { sales, supervisor, admin };
