-- Thickness is typed per line rather than picked from the product's presets,
-- so it must accept sizes the catalog doesn't list (e.g. 2.5 cm = 25 mm) and
-- half-millimetre values. Stored in millimetres, printed in centimetres.
ALTER TABLE proforma_items ALTER COLUMN thickness TYPE NUMERIC(6,1);
