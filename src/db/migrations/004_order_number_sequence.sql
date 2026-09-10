-- Sales no longer have to make up the next "Order No." by hand — it's now
-- suggested/auto-filled from a running count, the same way proforma_number
-- already is. Seed that counter from proformas already on file so the
-- sequence continues from there instead of restarting at 1.
INSERT IGNORE INTO counters (`key`, seq)
SELECT 'order-number', COUNT(*) FROM proformas;
