-- Fix 1: Rename "Mounting Type" → "Part Type" for mounting_type column in categories
UPDATE part.categories
SET columns_config = (
    SELECT jsonb_agg(
        CASE
            WHEN col->>'name' = 'mounting_type' AND col->>'label' = 'Mounting Type'
            THEN jsonb_set(col, '{label}', '"Part Type"')
            ELSE col
        END
    )
    FROM jsonb_array_elements(columns_config) AS col
)
WHERE columns_config @> '[{"name": "mounting_type", "label": "Mounting Type"}]';

-- Fix 2: Same for subcategories
UPDATE part.subcategories
SET columns_config = (
    SELECT jsonb_agg(
        CASE
            WHEN col->>'name' = 'mounting_type' AND col->>'label' = 'Mounting Type'
            THEN jsonb_set(col, '{label}', '"Part Type"')
            ELSE col
        END
    )
    FROM jsonb_array_elements(columns_config) AS col
)
WHERE columns_config @> '[{"name": "mounting_type", "label": "Mounting Type"}]';

-- Fix 3: Also rename other type columns to "Part Type"
-- connector_type → Part Type
UPDATE part.categories
SET columns_config = (
    SELECT jsonb_agg(
        CASE
            WHEN col->>'name' = 'connector_type' AND col->>'label' = 'Connector Type'
            THEN jsonb_set(col, '{label}', '"Part Type"')
            ELSE col
        END
    )
    FROM jsonb_array_elements(columns_config) AS col
)
WHERE columns_config @> '[{"name": "connector_type", "label": "Connector Type"}]';

UPDATE part.subcategories
SET columns_config = (
    SELECT jsonb_agg(
        CASE
            WHEN col->>'name' = 'connector_type' AND col->>'label' = 'Connector Type'
            THEN jsonb_set(col, '{label}', '"Part Type"')
            ELSE col
        END
    )
    FROM jsonb_array_elements(columns_config) AS col
)
WHERE columns_config @> '[{"name": "connector_type", "label": "Connector Type"}]';

-- antenna_type → Part Type
UPDATE part.categories
SET columns_config = (
    SELECT jsonb_agg(
        CASE
            WHEN col->>'name' = 'antenna_type' AND col->>'label' = 'Antenna Type'
            THEN jsonb_set(col, '{label}', '"Part Type"')
            ELSE col
        END
    )
    FROM jsonb_array_elements(columns_config) AS col
)
WHERE columns_config @> '[{"name": "antenna_type", "label": "Antenna Type"}]';

UPDATE part.subcategories
SET columns_config = (
    SELECT jsonb_agg(
        CASE
            WHEN col->>'name' = 'antenna_type' AND col->>'label' = 'Antenna Type'
            THEN jsonb_set(col, '{label}', '"Part Type"')
            ELSE col
        END
    )
    FROM jsonb_array_elements(columns_config) AS col
)
WHERE columns_config @> '[{"name": "antenna_type", "label": "Antenna Type"}]';

-- bobbin_type → Part Type
UPDATE part.categories
SET columns_config = (
    SELECT jsonb_agg(
        CASE
            WHEN col->>'name' = 'bobbin_type' AND col->>'label' = 'Bobbin Type'
            THEN jsonb_set(col, '{label}', '"Part Type"')
            ELSE col
        END
    )
    FROM jsonb_array_elements(columns_config) AS col
)
WHERE columns_config @> '[{"name": "bobbin_type", "label": "Bobbin Type"}]';

UPDATE part.subcategories
SET columns_config = (
    SELECT jsonb_agg(
        CASE
            WHEN col->>'name' = 'bobbin_type' AND col->>'label' = 'Bobbin Type'
            THEN jsonb_set(col, '{label}', '"Part Type"')
            ELSE col
        END
    )
    FROM jsonb_array_elements(columns_config) AS col
)
WHERE columns_config @> '[{"name": "bobbin_type", "label": "Bobbin Type"}]';

-- core_type → Part Type
UPDATE part.categories
SET columns_config = (
    SELECT jsonb_agg(
        CASE
            WHEN col->>'name' = 'core_type' AND col->>'label' = 'Core Type'
            THEN jsonb_set(col, '{label}', '"Part Type"')
            ELSE col
        END
    )
    FROM jsonb_array_elements(columns_config) AS col
)
WHERE columns_config @> '[{"name": "core_type", "label": "Core Type"}]';

UPDATE part.subcategories
SET columns_config = (
    SELECT jsonb_agg(
        CASE
            WHEN col->>'name' = 'core_type' AND col->>'label' = 'Core Type'
            THEN jsonb_set(col, '{label}', '"Part Type"')
            ELSE col
        END
    )
    FROM jsonb_array_elements(columns_config) AS col
)
WHERE columns_config @> '[{"name": "core_type", "label": "Core Type"}]';

-- adhesive_type → Part Type
UPDATE part.categories
SET columns_config = (
    SELECT jsonb_agg(
        CASE
            WHEN col->>'name' = 'adhesive_type' AND col->>'label' = 'Adhesive Type'
            THEN jsonb_set(col, '{label}', '"Part Type"')
            ELSE col
        END
    )
    FROM jsonb_array_elements(columns_config) AS col
)
WHERE columns_config @> '[{"name": "adhesive_type", "label": "Adhesive Type"}]';

UPDATE part.subcategories
SET columns_config = (
    SELECT jsonb_agg(
        CASE
            WHEN col->>'name' = 'adhesive_type' AND col->>'label' = 'Adhesive Type'
            THEN jsonb_set(col, '{label}', '"Part Type"')
            ELSE col
        END
    )
    FROM jsonb_array_elements(columns_config) AS col
)
WHERE columns_config @> '[{"name": "adhesive_type", "label": "Adhesive Type"}]';

-- generic "type" column with label "Type" → Part Type
UPDATE part.categories
SET columns_config = (
    SELECT jsonb_agg(
        CASE
            WHEN col->>'name' = 'type' AND col->>'label' = 'Type'
            THEN jsonb_set(col, '{label}', '"Part Type"')
            ELSE col
        END
    )
    FROM jsonb_array_elements(columns_config) AS col
)
WHERE columns_config @> '[{"name": "type", "label": "Type"}]';

UPDATE part.subcategories
SET columns_config = (
    SELECT jsonb_agg(
        CASE
            WHEN col->>'name' = 'type' AND col->>'label' = 'Type'
            THEN jsonb_set(col, '{label}', '"Part Type"')
            ELSE col
        END
    )
    FROM jsonb_array_elements(columns_config) AS col
)
WHERE columns_config @> '[{"name": "type", "label": "Type"}]';

-- Fix 4: Fix subcategories where labels are raw column names (lowercase/underscores)
-- These are the "bad" rows where label = column name (e.g. "mounting_type", "value", etc.)
UPDATE part.subcategories
SET columns_config = (
    SELECT jsonb_agg(
        CASE
            WHEN col->>'label' = col->>'name' THEN
                jsonb_set(col, '{label}',
                    to_jsonb(
                        initcap(replace(col->>'name', '_', ' '))
                    )
                )
            ELSE col
        END
    )
    FROM jsonb_array_elements(columns_config) AS col
)
WHERE EXISTS (
    SELECT 1 FROM jsonb_array_elements(columns_config) AS col
    WHERE col->>'label' = col->>'name'
);

-- Fix 5: After fix 4, mounting_type label will now be "Mounting Type" again for those rows — fix to "Part Type"
UPDATE part.subcategories
SET columns_config = (
    SELECT jsonb_agg(
        CASE
            WHEN col->>'name' = 'mounting_type' AND col->>'label' = 'Mounting Type'
            THEN jsonb_set(col, '{label}', '"Part Type"')
            ELSE col
        END
    )
    FROM jsonb_array_elements(columns_config) AS col
)
WHERE columns_config @> '[{"name": "mounting_type", "label": "Mounting Type"}]';
