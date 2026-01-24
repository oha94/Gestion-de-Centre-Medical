ALTER TABLE stock_rayons ADD COLUMN code_geo VARCHAR(50);
CREATE INDEX idx_rayon_code_geo ON stock_rayons(code_geo);
