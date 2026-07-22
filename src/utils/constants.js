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

const STONE_CATEGORIES = ['Granite', 'Marble', 'Quartz', 'Quartzite', 'Travertine', 'Limestone'];

const FINISHES = ['Polished', 'Honed', 'Leathered', 'Flamed', 'Brushed'];

// Millimetres. Displayed in centimetres on the proforma, matching how the
// company quotes stone (3 cm, 2 cm, ...).
const THICKNESS_OPTIONS = [10, 12, 15, 20, 30];

const PRODUCT_STATUSES = ['active', 'inactive'];

// An item is either cut to size and priced per square metre, or it is edge
// work (bullnose, groove) priced per linear metre of finished edge.
const ITEM_TYPES = ['area', 'linear'];

// Construction elements the factory produces. Suggestions for the
// "Description" column — free text is still accepted.
const ELEMENT_TYPES = [
  'Window sill',
  'Door sill',
  'Tread',
  'Riser',
  'Landing',
  'Flamed Landing',
  'Polished Landing',
  'Skirting',
  'Copping',
  'Kitchen Top',
  'Wall Cladding',
  'Floor Tile',
];

// Edge/finishing work billed per linear metre.
const LINEAR_SERVICES = ['Bullnose', 'Groove', 'Half Bullnose', 'Chamfer', 'Polishing'];

const APPROVAL_ACTIONS = [
  'created',
  'submitted',
  'updated',
  'supervisor_approved',
  'admin_approved',
  'rejected',
  'reverted_to_draft',
  'auto_approved',
];

const NOTIFICATION_TYPES = [
  'proforma_submitted',
  'proforma_supervisor_approved',
  'proforma_admin_approved',
  'proforma_rejected',
  'proforma_auto_approved',
];

// Roles allowed to edit a proforma, and the statuses they may edit it in.
// Admin is unrestricted and handled separately.
const EDIT_RULES = {
  sales: ['draft', 'pending', 'rejected'],
  supervisor: ['draft', 'pending', 'supervisor_approved', 'rejected'],
};

module.exports = {
  ROLES,
  PROFORMA_STATUSES,
  EDITABLE_STATUSES,
  EDIT_RULES,
  STONE_CATEGORIES,
  FINISHES,
  THICKNESS_OPTIONS,
  PRODUCT_STATUSES,
  ITEM_TYPES,
  ELEMENT_TYPES,
  LINEAR_SERVICES,
  APPROVAL_ACTIONS,
  NOTIFICATION_TYPES,
};
