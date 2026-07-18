const ROLES = ['sales', 'supervisor', 'admin'];

const PROFORMA_STATUSES = [
  'draft',
  'pending',
  'supervisor_approved',
  'rejected',
  'approved',
];

// Statuses a sales user may still edit their own proforma in
const EDITABLE_STATUSES = ['draft', 'pending', 'rejected'];

const STONE_CATEGORIES = ['Granite', 'Marble', 'Quartz', 'Quartzite', 'Travertine'];

const FINISHES = ['Polished', 'Honed', 'Leathered', 'Flamed', 'Brushed'];

const THICKNESS_OPTIONS = [10, 12, 15, 20, 30];

const PRODUCT_STATUSES = ['active', 'inactive'];

const APPROVAL_ACTIONS = [
  'created',
  'submitted',
  'updated',
  'supervisor_approved',
  'admin_approved',
  'rejected',
  'reverted_to_draft',
];

const NOTIFICATION_TYPES = [
  'proforma_submitted',
  'proforma_supervisor_approved',
  'proforma_admin_approved',
  'proforma_rejected',
];

module.exports = {
  ROLES,
  PROFORMA_STATUSES,
  EDITABLE_STATUSES,
  STONE_CATEGORIES,
  FINISHES,
  THICKNESS_OPTIONS,
  PRODUCT_STATUSES,
  APPROVAL_ACTIONS,
  NOTIFICATION_TYPES,
};
