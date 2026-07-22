-- Granite Factory Proforma Management System
-- Target: PostgreSQL 10 (no generated columns, no gen_random_uuid built-in)

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  email         VARCHAR(200) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'sales'
                CHECK (role IN ('sales', 'supervisor', 'admin')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS customers (
  id           SERIAL PRIMARY KEY,
  full_name    VARCHAR(200) NOT NULL,
  company_name VARCHAR(200) NOT NULL DEFAULT '',
  phone        VARCHAR(50) NOT NULL,
  email        VARCHAR(200) NOT NULL DEFAULT '',
  address      VARCHAR(500) NOT NULL DEFAULT '',
  city         VARCHAR(100) NOT NULL DEFAULT '',
  tax_number   VARCHAR(100) NOT NULL DEFAULT '',
  notes        TEXT NOT NULL DEFAULT '',
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_full_name ON customers(lower(full_name));
CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(lower(company_name));

CREATE TABLE IF NOT EXISTS products (
  id                 SERIAL PRIMARY KEY,
  name               VARCHAR(200) NOT NULL,
  stone_category     VARCHAR(50) NOT NULL
                     CHECK (stone_category IN ('Granite','Marble','Quartz','Quartzite','Travertine')),
  stone_color        VARCHAR(100) NOT NULL,
  finish             VARCHAR(50) NOT NULL
                     CHECK (finish IN ('Polished','Honed','Leathered','Flamed','Brushed')),
  thickness_options  INTEGER[] NOT NULL,
  default_unit_price NUMERIC(14,2) NOT NULL CHECK (default_unit_price >= 0),
  status             VARCHAR(20) NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','inactive')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT products_thickness_not_empty CHECK (array_length(thickness_options, 1) >= 1)
);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(lower(name));
CREATE INDEX IF NOT EXISTS idx_products_category ON products(stone_category);

CREATE TABLE IF NOT EXISTS proformas (
  id                     SERIAL PRIMARY KEY,
  proforma_number        VARCHAR(50) NOT NULL UNIQUE,
  customer_id            INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  sales_person_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  issue_date             DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date            DATE NOT NULL,
  subtotal               NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount               NUMERIC(14,2) NOT NULL DEFAULT 0,
  vat_rate               NUMERIC(5,2) NOT NULL DEFAULT 15,
  vat_amount             NUMERIC(14,2) NOT NULL DEFAULT 0,
  grand_total            NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_terms          VARCHAR(500) NOT NULL DEFAULT '',
  delivery_time          VARCHAR(300) NOT NULL DEFAULT '',
  validity_period        VARCHAR(300) NOT NULL DEFAULT '',
  notes                  TEXT NOT NULL DEFAULT '',
  status                 VARCHAR(30) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('draft','pending','supervisor_approved','rejected','approved')),
  rejection_reason       VARCHAR(1000) NOT NULL DEFAULT '',
  supervisor_approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  supervisor_approved_at TIMESTAMPTZ,
  admin_approved_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  admin_approved_at      TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proformas_sales_person ON proformas(sales_person_id);
CREATE INDEX IF NOT EXISTS idx_proformas_status ON proformas(status);
CREATE INDEX IF NOT EXISTS idx_proformas_created_at ON proformas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proformas_customer ON proformas(customer_id);

-- Product details are denormalized so a proforma stays accurate if the catalog changes.
CREATE TABLE IF NOT EXISTS proforma_items (
  id             SERIAL PRIMARY KEY,
  proforma_id    INTEGER NOT NULL REFERENCES proformas(id) ON DELETE CASCADE,
  product_id     INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name   VARCHAR(200) NOT NULL,
  stone_category VARCHAR(50) NOT NULL,
  stone_color    VARCHAR(100) NOT NULL,
  finish         VARCHAR(50) NOT NULL,
  width          NUMERIC(10,3) NOT NULL CHECK (width > 0),
  height         NUMERIC(10,3) NOT NULL CHECK (height > 0),
  area           NUMERIC(12,2) NOT NULL CHECK (area >= 0),
  thickness      INTEGER NOT NULL,
  quantity       INTEGER NOT NULL CHECK (quantity > 0),
  unit_price     NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
  line_total     NUMERIC(14,2) NOT NULL CHECK (line_total >= 0),
  sort_order     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_proforma_items_proforma ON proforma_items(proforma_id);
CREATE INDEX IF NOT EXISTS idx_proforma_items_product ON proforma_items(product_id);

CREATE TABLE IF NOT EXISTS approval_history (
  id          SERIAL PRIMARY KEY,
  proforma_id INTEGER NOT NULL REFERENCES proformas(id) ON DELETE CASCADE,
  action      VARCHAR(40) NOT NULL
              CHECK (action IN ('created','submitted','updated','supervisor_approved',
                                'admin_approved','rejected','reverted_to_draft')),
  actor_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  comment     VARCHAR(1000) NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_approval_history_proforma ON approval_history(proforma_id, created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL
              CHECK (type IN ('proforma_submitted','proforma_supervisor_approved',
                              'proforma_admin_approved','proforma_rejected')),
  message     VARCHAR(500) NOT NULL,
  proforma_id INTEGER REFERENCES proformas(id) ON DELETE CASCADE,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at DESC);

-- Single-row table holding company/system settings.
CREATE TABLE IF NOT EXISTS settings (
  key                   VARCHAR(20) PRIMARY KEY DEFAULT 'global',
  company_name          VARCHAR(200) NOT NULL DEFAULT 'Granite Factory PLC',
  company_address       VARCHAR(500) NOT NULL DEFAULT '',
  company_phone         VARCHAR(50) NOT NULL DEFAULT '',
  company_email         VARCHAR(200) NOT NULL DEFAULT '',
  company_website       VARCHAR(200) NOT NULL DEFAULT '',
  logo_url              TEXT NOT NULL DEFAULT '',
  currency              VARCHAR(10) NOT NULL DEFAULT 'ETB',
  default_vat_rate      NUMERIC(5,2) NOT NULL DEFAULT 15,
  default_payment_terms VARCHAR(500) NOT NULL DEFAULT '50% advance, 50% on delivery',
  default_validity_days INTEGER NOT NULL DEFAULT 30,
  proforma_prefix       VARCHAR(10) NOT NULL DEFAULT 'PF',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-year proforma sequence, incremented atomically.
CREATE TABLE IF NOT EXISTS counters (
  key VARCHAR(50) PRIMARY KEY,
  seq INTEGER NOT NULL DEFAULT 0
);
