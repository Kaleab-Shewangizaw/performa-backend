-- The company's product list includes Limestone alongside granite and marble.
ALTER TABLE products DROP CONSTRAINT products_stone_category_check;
ALTER TABLE products ADD CONSTRAINT products_stone_category_check
  CHECK (stone_category IN ('Granite','Marble','Quartz','Quartzite','Travertine','Limestone'));
