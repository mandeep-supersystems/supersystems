-- Migration: bin location_code, bin_type, and bin capacity rules table

-- Add location_code and bin_type to warehouse_bins if not exists
ALTER TABLE warehouse_bins ADD COLUMN IF NOT EXISTS location_code VARCHAR(100) DEFAULT '';
ALTER TABLE warehouse_bins ADD COLUMN IF NOT EXISTS bin_type VARCHAR(20) DEFAULT 'medium';

-- Create bin capacity rules table
CREATE TABLE IF NOT EXISTS warehouse_bin_capacity (
    id              VARCHAR(36) PRIMARY KEY,
    part_code       VARCHAR(100) NOT NULL,
    part_description VARCHAR(255) DEFAULT '',
    capacity_small  INTEGER DEFAULT 100,
    capacity_medium INTEGER DEFAULT 150,
    capacity_large  INTEGER DEFAULT 200,
    tenant_id       VARCHAR(100),
    is_deleted      BOOLEAN DEFAULT false,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wbc_part_code ON warehouse_bin_capacity(part_code);
CREATE INDEX IF NOT EXISTS idx_wbc_tenant ON warehouse_bin_capacity(tenant_id);
