-- Add location_id to inventory_stock_levels
-- Links each stock record to a specific physical location
-- so location detail popup only shows stock actually placed there

ALTER TABLE inventory_stock_levels
    ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES inventory_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_levels_location_id ON inventory_stock_levels(location_id);
