-- Add mpn_status and datasheet columns to part.manufacturers
ALTER TABLE part.manufacturers
    ADD COLUMN IF NOT EXISTS mpn_status TEXT DEFAULT 'Active',
    ADD COLUMN IF NOT EXISTS datasheet  TEXT DEFAULT '';
