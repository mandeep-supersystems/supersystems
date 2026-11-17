-- Add schematic_part column to all category tables missing it
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT name, series_prefix FROM part.categories 
    WHERE series_prefix IN (
      '124','901','902','903','156','187','197','157','196','154','126','151',
      '109','119','142','141','143','180','112','163','160','201','161','152',
      '121','155','162','118','159','158','153','122'
    )
    AND is_deleted = false
  LOOP
    EXECUTE format(
      'ALTER TABLE part.%I ADD COLUMN IF NOT EXISTS schematic_part VARCHAR(255)',
      lower(replace(r.name,' ','_')) || '_' || r.series_prefix
    );
  END LOOP;
END $$;
