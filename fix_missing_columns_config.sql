-- Add schematic_part to columns_config where physical column exists but config entry is missing
UPDATE part.categories c
SET columns_config = columns_config || '[{"name":"schematic_part","label":"Schematic Part","type":"varchar"}]'::jsonb
WHERE EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'part'
      AND table_name = regexp_replace(lower(c.name), '[^a-z0-9]', '_', 'g') || '_' || c.series_prefix
      AND column_name = 'schematic_part'
)
AND NOT (columns_config @> '[{"name":"schematic_part"}]');

-- Add value to columns_config where physical column exists but config entry is missing
UPDATE part.categories c
SET columns_config = columns_config || '[{"name":"value","label":"Value","type":"varchar"}]'::jsonb
WHERE EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'part'
      AND table_name = regexp_replace(lower(c.name), '[^a-z0-9]', '_', 'g') || '_' || c.series_prefix
      AND column_name = 'value'
)
AND NOT (columns_config @> '[{"name":"value"}]');

-- Sync both fixes to all subcategories
UPDATE part.subcategories s
SET columns_config = c.columns_config
FROM part.categories c
WHERE s.category_id = c.id AND s.is_deleted = false;
