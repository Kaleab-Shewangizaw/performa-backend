-- Groove edge work can be cut on both sides of a piece, which doubles the
-- billed length (bullnose has no such option). This flag lets a line item
-- request that doubling instead of sales having to fudge the quantity.
ALTER TABLE proforma_items
  ADD COLUMN both_sides TINYINT(1) NOT NULL DEFAULT 0 AFTER remark;
