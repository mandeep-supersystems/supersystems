-- 1. Rename existing type column labels to "Part Type"
UPDATE part.categories SET columns_config = (
  SELECT jsonb_agg(
    CASE 
      WHEN col->>'name' IN ('antenna_type','connector_type','bobbin_type','core_type','adhesive_type','type')
      THEN jsonb_set(col, '{label}', '"Part Type"')
      ELSE col
    END
  )
  FROM jsonb_array_elements(columns_config) col
)
WHERE series_prefix IN ('124','114','115','113','106','144','143','142','141','108','155','162','159')
AND is_deleted = false;

-- 2. Add mounting_type as first column for categories with no type column
UPDATE part.categories SET columns_config = (
  '[{"name":"mounting_type","type":"varchar","label":"Mounting Type"}]'::jsonb 
  || columns_config
)
WHERE series_prefix IN ('901','902','903','156','187','197','157','196','154','126','151','109','119','120','180','112','163','160','201','161','152','118','158','153','122')
AND is_deleted = false;

-- 3. Add mounting_type physical column to tables that need it
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT name, series_prefix FROM part.categories 
    WHERE series_prefix IN ('901','902','903','156','187','197','157','196','154','126','151','109','119','120','180','112','163','160','201','161','152','118','158','153','122')
    AND is_deleted = false
  LOOP
    EXECUTE format('ALTER TABLE part.%I ADD COLUMN IF NOT EXISTS mounting_type VARCHAR(255)', 
      lower(replace(r.name,' ','_')) || '_' || r.series_prefix);
  END LOOP;
END $$;

-- 4. Sync columns_config to all subcategories
UPDATE part.subcategories s
SET columns_config = c.columns_config, updated_at = NOW()
FROM part.categories c
WHERE s.category_id = c.id AND s.is_deleted = false;
