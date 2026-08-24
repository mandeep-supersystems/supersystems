-- ============================================================
-- Migration: Add Mechanical (180) and Thermal (154) categories
-- Separator: dot (.)
-- Run once against the target database.
-- ============================================================

-- ─── VARIABLES (used inline below) ───────────────────────────
-- Category  : Mechanical  | series_prefix = 180
-- Subcats   : Sheet Metal=1, Plastic Part=2, Die Casting=3,
--             Rubber Part=4, Machined Part=5, FR Part=6, Other Misc=7
-- Columns   : value, material, thickness, finish
--
-- Category  : Thermal     | series_prefix = 159
--   NOTE: 154 is already used by 'Grommet' in this DB.
--         159 is the next free slot in the 15x range.
-- Subcats   : Thermal Pad=1, Thermal Paste=2
-- Columns   : type, material, size, th_conductivity, thickness
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
    v_tenant   TEXT := 'b424df0e-f766-4e94-b3fd-05777e158958';
    v_sep      TEXT := '.';

    -- Mechanical
    v_mech_id  UUID;
    v_mech_cols JSONB := '[
        {"name":"value",     "label":"Value",     "type":"varchar"},
        {"name":"material",  "label":"Material",  "type":"varchar"},
        {"name":"thickness", "label":"Thickness", "type":"varchar"},
        {"name":"finish",    "label":"Finish",    "type":"varchar"}
    ]'::JSONB;
    v_mech_desc_cols JSONB := '["value","material","thickness","finish"]'::JSONB;

    -- Thermal (159 — 154 is taken by Grommet)
    v_therm_id  UUID;
    v_therm_cols JSONB := '['
        {"name":"type",           "label":"Type",              "type":"varchar"},
        {"name":"material",       "label":"Material",          "type":"varchar"},
        {"name":"size",           "label":"Size",              "type":"varchar"},
        {"name":"th_conductivity","label":"Th. Conductivity",  "type":"varchar"},
        {"name":"thickness",      "label":"Thickness",         "type":"varchar"}
    ]'::JSONB;
    v_therm_desc_cols JSONB := '["type","material","size","th_conductivity","thickness"]'::JSONB;

BEGIN

-- ══════════════════════════════════════════════════════════════
-- 1. MECHANICAL CATEGORY  (series_prefix = 180)
-- ══════════════════════════════════════════════════════════════

    -- Skip only if Mechanical 180 already exists
    IF NOT EXISTS (
        SELECT 1 FROM part.categories
        WHERE LOWER(name) = 'mechanical' AND series_prefix = '180' AND is_deleted = false
    ) THEN

        v_mech_id := gen_random_uuid();

        INSERT INTO part.categories
            (id, name, code, series_prefix, separator,
             description, columns_config, description_columns,
             sequence_padding, current_sequence, tenant_id)
        VALUES
            (v_mech_id, 'Mechanical', 'MECH', '180', v_sep,
             'Mechanical parts – sheet metal, plastic, die casting, rubber, machined, FR, misc',
             v_mech_cols, v_mech_desc_cols,
             4, 0, v_tenant);

        -- Dynamic part table for Mechanical (shared across all subcategories)
        CREATE TABLE IF NOT EXISTS part."mechanical_180" (
            id              VARCHAR(36)  PRIMARY KEY,
            part_number     VARCHAR(100) NOT NULL UNIQUE,
            subcategory_id  VARCHAR(36)  NOT NULL,
            description     TEXT         DEFAULT '',
            created_by      VARCHAR(200) DEFAULT '',
            is_bought_out   BOOLEAN      DEFAULT true,
            is_manufactured BOOLEAN      DEFAULT false,
            status          VARCHAR(20)  DEFAULT 'Active',
            obsoleted_at    TIMESTAMP,
            obsolete_reason TEXT,
            "value"         VARCHAR(255),
            "material"      VARCHAR(255),
            "thickness"     VARCHAR(255),
            "finish"        VARCHAR(255),
            created_at      TIMESTAMP    DEFAULT NOW(),
            updated_at      TIMESTAMP    DEFAULT NOW()
        );

        -- Subcategory 1 – Sheet Metal
        INSERT INTO part.subcategories
            (id, name, code, series_prefix, category_id,
             columns_config, description_columns, current_sequence, tenant_id)
        VALUES
            (gen_random_uuid(), 'Sheet Metal', 'SM', '1', v_mech_id,
             v_mech_cols, v_mech_desc_cols, 0, v_tenant);

        -- Subcategory 2 – Plastic Part
        INSERT INTO part.subcategories
            (id, name, code, series_prefix, category_id,
             columns_config, description_columns, current_sequence, tenant_id)
        VALUES
            (gen_random_uuid(), 'Plastic Part', 'PP', '2', v_mech_id,
             v_mech_cols, v_mech_desc_cols, 0, v_tenant);

        -- Subcategory 3 – Die Casting
        INSERT INTO part.subcategories
            (id, name, code, series_prefix, category_id,
             columns_config, description_columns, current_sequence, tenant_id)
        VALUES
            (gen_random_uuid(), 'Die Casting', 'DC', '3', v_mech_id,
             v_mech_cols, v_mech_desc_cols, 0, v_tenant);

        -- Subcategory 4 – Rubber Part
        INSERT INTO part.subcategories
            (id, name, code, series_prefix, category_id,
             columns_config, description_columns, current_sequence, tenant_id)
        VALUES
            (gen_random_uuid(), 'Rubber Part', 'RP', '4', v_mech_id,
             v_mech_cols, v_mech_desc_cols, 0, v_tenant);

        -- Subcategory 5 – Machined Part
        INSERT INTO part.subcategories
            (id, name, code, series_prefix, category_id,
             columns_config, description_columns, current_sequence, tenant_id)
        VALUES
            (gen_random_uuid(), 'Machined Part', 'MP', '5', v_mech_id,
             v_mech_cols, v_mech_desc_cols, 0, v_tenant);

        -- Subcategory 6 – FR Part
        INSERT INTO part.subcategories
            (id, name, code, series_prefix, category_id,
             columns_config, description_columns, current_sequence, tenant_id)
        VALUES
            (gen_random_uuid(), 'FR Part', 'FR', '6', v_mech_id,
             v_mech_cols, v_mech_desc_cols, 0, v_tenant);

        -- Subcategory 7 – Other Misc
        INSERT INTO part.subcategories
            (id, name, code, series_prefix, category_id,
             columns_config, description_columns, current_sequence, tenant_id)
        VALUES
            (gen_random_uuid(), 'Other Misc', 'OM', '7', v_mech_id,
             v_mech_cols, v_mech_desc_cols, 0, v_tenant);

        RAISE NOTICE 'Mechanical (180) category and 7 subcategories created.';
    ELSE
        RAISE NOTICE 'Mechanical (180) already exists – skipped.';
    END IF;


-- ══════════════════════════════════════════════════════════════
-- 2. THERMAL CATEGORY  (series_prefix = 159)
-- ══════════════════════════════════════════════════════════════

    IF NOT EXISTS (
        SELECT 1 FROM part.categories
        WHERE LOWER(name) = 'thermal' AND series_prefix = '159' AND is_deleted = false
    ) THEN

        v_therm_id := gen_random_uuid();

        INSERT INTO part.categories
            (id, name, code, series_prefix, separator,
             description, columns_config, description_columns,
             sequence_padding, current_sequence, tenant_id)
        VALUES
            (v_therm_id, 'Thermal', 'THRM', '159', v_sep,
             'Thermal interface materials – pads and pastes',
             v_therm_cols, v_therm_desc_cols,
             4, 0, v_tenant);

        -- Dynamic part table for Thermal
        CREATE TABLE IF NOT EXISTS part."thermal_159" (
            id              VARCHAR(36)  PRIMARY KEY,
            part_number     VARCHAR(100) NOT NULL UNIQUE,
            subcategory_id  VARCHAR(36)  NOT NULL,
            description     TEXT         DEFAULT '',
            created_by      VARCHAR(200) DEFAULT '',
            is_bought_out   BOOLEAN      DEFAULT true,
            is_manufactured BOOLEAN      DEFAULT false,
            status          VARCHAR(20)  DEFAULT 'Active',
            obsoleted_at    TIMESTAMP,
            obsolete_reason TEXT,
            "type"           VARCHAR(255),
            "material"       VARCHAR(255),
            "size"           VARCHAR(255),
            "th_conductivity" VARCHAR(255),
            "thickness"      VARCHAR(255),
            created_at      TIMESTAMP    DEFAULT NOW(),
            updated_at      TIMESTAMP    DEFAULT NOW()
        );

        -- Subcategory 1 – Thermal Pad
        INSERT INTO part.subcategories
            (id, name, code, series_prefix, category_id,
             columns_config, description_columns, current_sequence, tenant_id)
        VALUES
            (gen_random_uuid(), 'Thermal Pad', 'TP', '1', v_therm_id,
             v_therm_cols, v_therm_desc_cols, 0, v_tenant);

        -- Subcategory 2 – Thermal Paste
        INSERT INTO part.subcategories
            (id, name, code, series_prefix, category_id,
             columns_config, description_columns, current_sequence, tenant_id)
        VALUES
            (gen_random_uuid(), 'Thermal Paste', 'TPS', '2', v_therm_id,
             v_therm_cols, v_therm_desc_cols, 0, v_tenant);

        RAISE NOTICE 'Thermal (159) category and 2 subcategories created.';
    ELSE
        RAISE NOTICE 'Thermal (159) already exists – skipped.';
    END IF;

END $$;


-- ─── Verify ───────────────────────────────────────────────────
SELECT
    c.name        AS category,
    c.series_prefix,
    c.separator,
    s.name        AS subcategory,
    s.series_prefix AS sub_series
FROM part.categories c
JOIN part.subcategories s ON s.category_id = c.id
WHERE c.series_prefix IN ('180', '159')
  AND c.is_deleted = false
  AND s.is_deleted = false
ORDER BY c.series_prefix, s.series_prefix::int;
