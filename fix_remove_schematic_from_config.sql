-- Remove schematic_part from columns_config in categories (it's a physical column, not a user attribute)
UPDATE part.categories
SET columns_config = (
    SELECT jsonb_agg(col)
    FROM jsonb_array_elements(columns_config) AS col
    WHERE col->>'name' != 'schematic_part'
)
WHERE columns_config @> '[{"name":"schematic_part"}]';

-- Same for subcategories
UPDATE part.subcategories
SET columns_config = (
    SELECT jsonb_agg(col)
    FROM jsonb_array_elements(columns_config) AS col
    WHERE col->>'name' != 'schematic_part'
)
WHERE columns_config @> '[{"name":"schematic_part"}]';
