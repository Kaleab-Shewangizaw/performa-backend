-- Granite Factory Proforma Management System — MySQL / MariaDB schema.
-- Consolidated final schema (enums for fixed value sets, JSON for arrays,
-- no RETURNING/CHECK so it runs on MySQL 5.7+ and MariaDB 10.2+).

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  email         VARCHAR(200) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('sales','supervisor','admin') NOT NULL DEFAULT 'sales',
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_refresh_tokens_user (user_id),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS customers (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  full_name    VARCHAR(200) NOT NULL,
  company_name VARCHAR(200) NOT NULL DEFAULT '',
  phone        VARCHAR(50) NOT NULL,
  email        VARCHAR(200) NOT NULL DEFAULT '',
  address      VARCHAR(500) NOT NULL DEFAULT '',
  city         VARCHAR(100) NOT NULL DEFAULT '',
  tax_number   VARCHAR(100) NOT NULL DEFAULT '',
  notes        VARCHAR(2000) NOT NULL DEFAULT '',
  created_by   INT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customers_full_name (full_name),
  INDEX idx_customers_company (company_name),
  CONSTRAINT fk_customer_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS products (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  name                   VARCHAR(200) NOT NULL,
  stone_category         ENUM('Granite','Marble','Quartz','Quartzite','Travertine','Limestone') NOT NULL,
  stone_color            VARCHAR(100) NOT NULL,
  finish                 ENUM('Polished','Honed','Leathered','Flamed','Brushed') NOT NULL,
  thickness_options      JSON NOT NULL,
  default_unit_price     DECIMAL(14,2) NOT NULL,
  status                 ENUM('active','inactive') NOT NULL DEFAULT 'active',
  allows_direct_approval TINYINT(1) NOT NULL DEFAULT 0,
  created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_name (name),
  INDEX idx_products_category (stone_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS proformas (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  proforma_number        VARCHAR(50) NOT NULL UNIQUE,
  customer_id            INT NOT NULL,
  sales_person_id        INT NOT NULL,
  issue_date             DATE NOT NULL,
  expiry_date            DATE NOT NULL,
  subtotal               DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount               DECIMAL(14,2) NOT NULL DEFAULT 0,
  vat_rate               DECIMAL(5,2) NOT NULL DEFAULT 15,
  vat_amount             DECIMAL(14,2) NOT NULL DEFAULT 0,
  grand_total            DECIMAL(14,2) NOT NULL DEFAULT 0,
  payment_terms          VARCHAR(500) NOT NULL DEFAULT '',
  delivery_time          VARCHAR(300) NOT NULL DEFAULT '',
  validity_period        VARCHAR(300) NOT NULL DEFAULT '',
  notes                  VARCHAR(2000) NOT NULL DEFAULT '',
  status                 ENUM('draft','pending','supervisor_approved','rejected','approved') NOT NULL DEFAULT 'pending',
  rejection_reason       VARCHAR(1000) NOT NULL DEFAULT '',
  supervisor_approved_by INT NULL,
  supervisor_approved_at DATETIME NULL DEFAULT NULL,
  admin_approved_by      INT NULL,
  admin_approved_at      DATETIME NULL DEFAULT NULL,
  order_number           VARCHAR(50) NOT NULL DEFAULT '',
  material_type          VARCHAR(200) NOT NULL DEFAULT '',
  ordered_by             VARCHAR(200) NOT NULL DEFAULT '',
  ordered_date           DATE NULL DEFAULT NULL,
  project_name           VARCHAR(200) NOT NULL DEFAULT '',
  total_weight           VARCHAR(100) NOT NULL DEFAULT '',
  remark                 VARCHAR(1000) NOT NULL DEFAULT '',
  auto_approved          TINYINT(1) NOT NULL DEFAULT 0,
  created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_proformas_sales_person (sales_person_id),
  INDEX idx_proformas_status (status),
  INDEX idx_proformas_created_at (created_at),
  INDEX idx_proformas_customer (customer_id),
  CONSTRAINT fk_proforma_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_proforma_sales FOREIGN KEY (sales_person_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_proforma_sup FOREIGN KEY (supervisor_approved_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_proforma_admin FOREIGN KEY (admin_approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Product details are denormalized so a proforma stays accurate if the catalog changes.
CREATE TABLE IF NOT EXISTS proforma_items (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  proforma_id    INT NOT NULL,
  product_id     INT NULL,
  product_name   VARCHAR(200) NULL,
  stone_category VARCHAR(50) NULL,
  stone_color    VARCHAR(100) NULL,
  finish         VARCHAR(50) NULL,
  item_type      ENUM('area','linear') NOT NULL DEFAULT 'area',
  description    VARCHAR(200) NOT NULL DEFAULT '',
  length         DECIMAL(10,3) NOT NULL,
  width          DECIMAL(10,3) NULL,
  area           DECIMAL(14,4) NOT NULL DEFAULT 0,
  total_length   DECIMAL(14,3) NOT NULL DEFAULT 0,
  thickness      DECIMAL(6,1) NULL,
  quantity       INT NOT NULL,
  unit_price     DECIMAL(14,2) NOT NULL,
  line_total     DECIMAL(14,2) NOT NULL,
  remark         VARCHAR(300) NOT NULL DEFAULT '',
  sort_order     INT NOT NULL DEFAULT 0,
  INDEX idx_items_proforma (proforma_id),
  INDEX idx_items_product (product_id),
  CONSTRAINT fk_item_proforma FOREIGN KEY (proforma_id) REFERENCES proformas(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS approval_history (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  proforma_id INT NOT NULL,
  action      ENUM('created','submitted','updated','supervisor_approved','admin_approved','rejected','reverted_to_draft','auto_approved') NOT NULL,
  actor_id    INT NULL,
  comment     VARCHAR(1000) NOT NULL DEFAULT '',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_history_proforma (proforma_id, created_at),
  CONSTRAINT fk_history_proforma FOREIGN KEY (proforma_id) REFERENCES proformas(id) ON DELETE CASCADE,
  CONSTRAINT fk_history_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  type        ENUM('proforma_submitted','proforma_supervisor_approved','proforma_admin_approved','proforma_rejected','proforma_auto_approved') NOT NULL,
  message     VARCHAR(500) NOT NULL,
  proforma_id INT NULL,
  `read`      TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_user (user_id, `read`, created_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_proforma FOREIGN KEY (proforma_id) REFERENCES proformas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Single-row company/system settings.
CREATE TABLE IF NOT EXISTS settings (
  `key`                 VARCHAR(20) PRIMARY KEY,
  company_name          VARCHAR(200) NOT NULL DEFAULT 'Granite Factory PLC',
  company_address       VARCHAR(500) NOT NULL DEFAULT '',
  company_phone         VARCHAR(50) NOT NULL DEFAULT '',
  company_email         VARCHAR(200) NOT NULL DEFAULT '',
  company_website       VARCHAR(200) NOT NULL DEFAULT '',
  logo_url              LONGTEXT NULL,
  currency              VARCHAR(10) NOT NULL DEFAULT 'ETB',
  default_vat_rate      DECIMAL(5,2) NOT NULL DEFAULT 15,
  default_payment_terms VARCHAR(500) NOT NULL DEFAULT '50% advance, 50% on delivery',
  default_validity_days INT NOT NULL DEFAULT 30,
  proforma_prefix       VARCHAR(10) NOT NULL DEFAULT 'PF',
  terms_and_conditions  TEXT NULL,
  products_offered      TEXT NULL,
  bank_details          TEXT NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Per-year proforma sequence, incremented atomically.
CREATE TABLE IF NOT EXISTS counters (
  `key` VARCHAR(50) PRIMARY KEY,
  seq   INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
