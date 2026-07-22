-- Aligns the schema with the company's real proforma layout:
--   * order/project metadata in the header
--   * items described by construction element (Window sill, Tread, Riser, ...)
--     with Size = Length x Width, thickness, total length and total area
--   * edge-work lines (Bullnose, Groove) that are priced per linear metre
--   * terms & conditions / product list carried in settings

-- ---- proformas: header metadata from the sample ----
ALTER TABLE proformas ADD COLUMN order_number   VARCHAR(50)  NOT NULL DEFAULT '';
ALTER TABLE proformas ADD COLUMN material_type  VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE proformas ADD COLUMN ordered_by     VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE proformas ADD COLUMN ordered_date   DATE;
ALTER TABLE proformas ADD COLUMN project_name   VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE proformas ADD COLUMN total_weight   VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE proformas ADD COLUMN remark         VARCHAR(1000) NOT NULL DEFAULT '';

-- ---- proforma_items ----
-- Drop the dimension checks before renaming; linear items carry no width.
ALTER TABLE proforma_items DROP CONSTRAINT proforma_items_width_check;
ALTER TABLE proforma_items DROP CONSTRAINT proforma_items_height_check;

-- "Size (m)" in the sample is Length x Width.
ALTER TABLE proforma_items RENAME COLUMN width  TO length;
ALTER TABLE proforma_items RENAME COLUMN height TO width;

ALTER TABLE proforma_items ALTER COLUMN width     DROP NOT NULL;
ALTER TABLE proforma_items ALTER COLUMN thickness DROP NOT NULL;

-- Items may be priced by area (m2) or by linear metre (edge work).
ALTER TABLE proforma_items ADD COLUMN item_type VARCHAR(20) NOT NULL DEFAULT 'area';
ALTER TABLE proforma_items ADD CONSTRAINT proforma_items_item_type_check
  CHECK (item_type IN ('area', 'linear'));

-- Element being produced, e.g. Window sill / Tread / Riser / Bullnose.
ALTER TABLE proforma_items ADD COLUMN description  VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE proforma_items ADD COLUMN total_length NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE proforma_items ADD COLUMN remark       VARCHAR(300) NOT NULL DEFAULT '';

-- A catalog product is optional: an item can be a plain described element.
ALTER TABLE proforma_items ALTER COLUMN product_name   DROP NOT NULL;
ALTER TABLE proforma_items ALTER COLUMN stone_category DROP NOT NULL;
ALTER TABLE proforma_items ALTER COLUMN stone_color    DROP NOT NULL;
ALTER TABLE proforma_items ALTER COLUMN finish         DROP NOT NULL;

ALTER TABLE proforma_items ADD CONSTRAINT proforma_items_length_check CHECK (length > 0);
ALTER TABLE proforma_items ADD CONSTRAINT proforma_items_width_check
  CHECK (width IS NULL OR width > 0);

-- Backfill existing rows so they satisfy the new expectations.
UPDATE proforma_items
   SET description  = COALESCE(NULLIF(description, ''), product_name, 'Item'),
       total_length = ROUND(length * quantity, 2)
 WHERE description = '' OR total_length = 0;

-- ---- settings: terms and the "our products" block printed on the proforma ----
ALTER TABLE settings ADD COLUMN terms_and_conditions TEXT NOT NULL DEFAULT '';
ALTER TABLE settings ADD COLUMN products_offered     TEXT NOT NULL DEFAULT '';
ALTER TABLE settings ADD COLUMN bank_details         TEXT NOT NULL DEFAULT '';
