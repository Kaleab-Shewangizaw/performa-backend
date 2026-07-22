-- Client rules:
--   * VAT is either the standard rate or waived entirely (15% / 0%)
--   * some products are pre-cleared and skip the approval chain
--   * supervisors may edit proformas, not just approve them

-- Products that a sales person may quote without supervisor/admin sign-off.
ALTER TABLE products ADD COLUMN allows_direct_approval BOOLEAN NOT NULL DEFAULT FALSE;

-- Record auto-approval distinctly from a human decision.
ALTER TABLE approval_history DROP CONSTRAINT approval_history_action_check;
ALTER TABLE approval_history ADD CONSTRAINT approval_history_action_check
  CHECK (action IN ('created','submitted','updated','supervisor_approved',
                    'admin_approved','rejected','reverted_to_draft','auto_approved'));

ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('proforma_submitted','proforma_supervisor_approved',
                  'proforma_admin_approved','proforma_rejected','proforma_auto_approved'));

-- Flag on the proforma so the UI/PDF can explain why it needs no signatures.
ALTER TABLE proformas ADD COLUMN auto_approved BOOLEAN NOT NULL DEFAULT FALSE;
