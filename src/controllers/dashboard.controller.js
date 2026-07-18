const asyncHandler = require('../utils/asyncHandler');
const Proforma = require('../models/proforma.model');
const Customer = require('../models/customer.model');
const User = require('../models/user.model');

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const POPULATE = [
  { path: 'customer', select: 'fullName companyName' },
  { path: 'salesPerson', select: 'name' },
];

const sales = asyncHandler(async (req, res) => {
  const mine = { salesPerson: req.user.id };
  const [recentCustomers, recentProformas, counts] = await Promise.all([
    Customer.find().sort({ createdAt: -1 }).limit(5),
    Proforma.find(mine).sort({ createdAt: -1 }).limit(5).populate(POPULATE),
    Proforma.aggregate([
      { $match: { salesPerson: req.user._id } },
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$grandTotal' } } },
    ]),
  ]);

  const byStatus = Object.fromEntries(counts.map((c) => [c._id, c]));
  res.json({
    recentCustomers,
    recentProformas,
    stats: {
      drafts: byStatus.draft?.count || 0,
      pending: byStatus.pending?.count || 0,
      supervisorApproved: byStatus.supervisor_approved?.count || 0,
      approved: byStatus.approved?.count || 0,
      rejected: byStatus.rejected?.count || 0,
      approvedValue: byStatus.approved?.total || 0,
    },
  });
});

const supervisor = asyncHandler(async (req, res) => {
  const today = startOfToday();
  const [pendingReviews, approvedToday, rejectedCount, counts] = await Promise.all([
    Proforma.find({ status: 'pending' }).sort({ createdAt: 1 }).limit(10).populate(POPULATE),
    Proforma.countDocuments({ supervisorApprovedBy: req.user.id, supervisorApprovedAt: { $gte: today } }),
    Proforma.countDocuments({ status: 'rejected' }),
    Proforma.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const byStatus = Object.fromEntries(counts.map((c) => [c._id, c.count]));
  res.json({
    pendingReviews,
    stats: {
      pending: byStatus.pending || 0,
      approvedToday,
      rejected: rejectedCount,
      supervisorApproved: byStatus.supervisor_approved || 0,
      approved: byStatus.approved || 0,
      total: counts.reduce((s, c) => s + c.count, 0),
    },
  });
});

const admin = asyncHandler(async (req, res) => {
  const [counts, totalCustomers, totalUsers, revenueAgg, awaitingFinal, monthly] =
    await Promise.all([
      Proforma.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Customer.countDocuments(),
      User.countDocuments({ isActive: true }),
      Proforma.aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: null, revenue: { $sum: '$grandTotal' } } },
      ]),
      Proforma.find({ status: 'supervisor_approved' })
        .sort({ createdAt: 1 })
        .limit(10)
        .populate(POPULATE),
      Proforma.aggregate([
        { $match: { status: 'approved' } },
        {
          $group: {
            _id: { y: { $year: '$issueDate' }, m: { $month: '$issueDate' } },
            revenue: { $sum: '$grandTotal' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.y': 1, '_id.m': 1 } },
        { $limit: 12 },
      ]),
    ]);

  const byStatus = Object.fromEntries(counts.map((c) => [c._id, c.count]));
  res.json({
    awaitingFinal,
    stats: {
      revenue: revenueAgg[0]?.revenue || 0,
      totalCustomers,
      totalUsers,
      totalProformas: counts.reduce((s, c) => s + c.count, 0),
      pending: byStatus.pending || 0,
      supervisorApproved: byStatus.supervisor_approved || 0,
      approved: byStatus.approved || 0,
      rejected: byStatus.rejected || 0,
      drafts: byStatus.draft || 0,
    },
    monthlyRevenue: monthly.map((m) => ({
      year: m._id.y,
      month: m._id.m,
      revenue: m.revenue,
      count: m.count,
    })),
  });
});

module.exports = { sales, supervisor, admin };
