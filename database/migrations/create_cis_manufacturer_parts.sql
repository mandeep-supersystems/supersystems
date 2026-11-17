-- Create part.cis_manufacturer_parts table
-- Stores MPN/Make data linked to parts for CadDB export

CREATE TABLE IF NOT EXISTS part.cis_manufacturer_parts (
    id            SERIAL PRIMARY KEY,
    part_number   VARCHAR(100) NOT NULL,
    manufacturer  VARCHAR(255) DEFAULT '',
    manufacturer_pn VARCHAR(255) DEFAULT '',
    manufacturer_pn_status VARCHAR(100) DEFAULT '',
    datasheet     TEXT DEFAULT '',
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cis_mfr_parts_pn ON part.cis_manufacturer_parts(part_number);

-- Populate from existing part.manufacturers data
INSERT INTO part.cis_manufacturer_parts (part_number, manufacturer, manufacturer_pn, manufacturer_pn_status, datasheet)
SELECT
    m.part_number,
    COALESCE(m.make, '')        AS manufacturer,
    COALESCE(m.mpn, '')         AS manufacturer_pn,
    COALESCE(m.mpn_status, '')  AS manufacturer_pn_status,
    COALESCE(m.datasheet, '')   AS datasheet
FROM part.manufacturers m
WHERE (m.mpn IS NOT NULL AND m.mpn != '')
   OR (m.make IS NOT NULL AND m.make != '')
ON CONFLICT DO NOTHING;
