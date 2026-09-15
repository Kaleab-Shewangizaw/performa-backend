-- Total area (m²) was only ever computed client-side in the create/edit form
-- and never saved, so it disappeared once an order moved past that screen
-- (e.g. to the factory view). Store it alongside total_weight, which already
-- works this way.
ALTER TABLE proformas
  ADD COLUMN total_area DECIMAL(14,4) NOT NULL DEFAULT 0 AFTER total_weight;
