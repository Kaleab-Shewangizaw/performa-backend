-- Order tracking: a shared, admin-defined production pipeline that an approved
-- proforma (the order) walks through, plus a public status timeline.
-- Adds the `factory` role for the workers who advance orders through the steps.

-- 1. New role for factory-floor workers.
ALTER TABLE users
  MODIFY role ENUM('sales','supervisor','admin','factory') NOT NULL DEFAULT 'sales';

-- 2. The pipeline itself: one ordered, admin-editable list of stages.
CREATE TABLE IF NOT EXISTS order_steps (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  position   INT NOT NULL,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_order_steps_position (position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Fast "where is it now" pointer on the order. SET NULL so deleting a step
--    never orphans a proforma row.
ALTER TABLE proformas
  ADD COLUMN current_step_id INT NULL DEFAULT NULL,
  ADD INDEX idx_proformas_current_step (current_step_id),
  ADD CONSTRAINT fk_proforma_current_step
    FOREIGN KEY (current_step_id) REFERENCES order_steps(id) ON DELETE SET NULL;

-- 4. The timeline / audit log. step_name is denormalized so the customer-facing
--    history survives a later rename or delete of the step.
CREATE TABLE IF NOT EXISTS order_step_history (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  proforma_id INT NOT NULL,
  step_id     INT NULL,
  step_name   VARCHAR(100) NOT NULL,
  changed_by  INT NULL,
  note        VARCHAR(1000) NOT NULL DEFAULT '',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_step_history_proforma (proforma_id, created_at),
  CONSTRAINT fk_step_history_proforma FOREIGN KEY (proforma_id) REFERENCES proformas(id) ON DELETE CASCADE,
  CONSTRAINT fk_step_history_step FOREIGN KEY (step_id) REFERENCES order_steps(id) ON DELETE SET NULL,
  CONSTRAINT fk_step_history_actor FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Default pipeline. Admins can rename, reorder, deactivate or add to these.
INSERT INTO order_steps (name, position) VALUES
  ('Ordered', 1),
  ('Sent to factory', 2),
  ('Cutting', 3),
  ('Polishing', 4),
  ('Quality check', 5),
  ('Ready for delivery', 6),
  ('Delivered', 7);
