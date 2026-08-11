-- Factory ops: notifications for orders, a customer-visible reason on backward
-- step moves, an admin-approved step-change workflow, and an activity log.

-- 1. New notification kinds for the factory workflow.
ALTER TABLE notifications
  MODIFY type ENUM(
    'proforma_submitted','proforma_supervisor_approved','proforma_admin_approved',
    'proforma_rejected','proforma_auto_approved',
    'order_sent_to_factory','order_step_requested','order_step_approved','order_step_rejected'
  ) NOT NULL;

-- 2. Reason a stage was moved backward — shown to the customer on the tracker.
ALTER TABLE order_step_history
  ADD COLUMN reason VARCHAR(500) NOT NULL DEFAULT '';

-- 3. Factory workers request a stage move; admin/supervisor approve or reject.
CREATE TABLE IF NOT EXISTS step_change_requests (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  proforma_id   INT NOT NULL,
  from_step_id  INT NULL,
  to_step_id    INT NOT NULL,
  requested_by  INT NULL,
  status        ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reason        VARCHAR(500) NOT NULL DEFAULT '',
  decided_by    INT NULL,
  decision_note VARCHAR(500) NOT NULL DEFAULT '',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at    DATETIME NULL DEFAULT NULL,
  INDEX idx_scr_status (status, created_at),
  INDEX idx_scr_proforma (proforma_id),
  CONSTRAINT fk_scr_proforma FOREIGN KEY (proforma_id) REFERENCES proformas(id) ON DELETE CASCADE,
  CONSTRAINT fk_scr_from FOREIGN KEY (from_step_id) REFERENCES order_steps(id) ON DELETE SET NULL,
  CONSTRAINT fk_scr_to FOREIGN KEY (to_step_id) REFERENCES order_steps(id) ON DELETE CASCADE,
  CONSTRAINT fk_scr_requester FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_scr_decider FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Append-only audit trail of who did what, for the admin.
CREATE TABLE IF NOT EXISTS activity_log (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  actor_id    INT NULL,
  action      VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40) NOT NULL DEFAULT '',
  entity_id   INT NULL,
  summary     VARCHAR(500) NOT NULL DEFAULT '',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_activity_created (created_at),
  INDEX idx_activity_action (action),
  CONSTRAINT fk_activity_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
