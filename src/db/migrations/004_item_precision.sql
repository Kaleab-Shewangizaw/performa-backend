-- Areas like 0.28 x 1.55 x 2 = 0.868 m2 must keep their precision: rounding
-- the area to 2dp before pricing shifts the line total (6090 vs 6076 on the
-- company's own sample). Widen the measurement columns and price off the
-- unrounded area, exactly as the source spreadsheet does.
ALTER TABLE proforma_items ALTER COLUMN area         TYPE NUMERIC(14,4);
ALTER TABLE proforma_items ALTER COLUMN total_length TYPE NUMERIC(14,3);
