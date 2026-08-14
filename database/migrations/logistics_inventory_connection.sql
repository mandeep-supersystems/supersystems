-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION: Logistics ↔ Inventory ↔ Warehouse Connection
-- Adds batch tracking, physical checks, handover fields to procurement.grn
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add new columns to procurement.grn
ALTER TABLE procurement.grn
    ADD COLUMN IF NOT EXISTS batch_no              TEXT,
    ADD COLUMN IF NOT EXISTS supplier_lot          TEXT,
    ADD COLUMN IF NOT EXISTS remarks               TEXT,
    ADD COLUMN IF NOT EXISTS physical_checks       JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS assigned_bin_code     TEXT,
    ADD COLUMN IF NOT EXISTS assigned_location_id  UUID,
    ADD COLUMN IF NOT EXISTS assigned_location_code TEXT,
    ADD COLUMN IF NOT EXISTS handover_warehouse    TEXT,
    ADD COLUMN IF NOT EXISTS handover_notes        TEXT,
    ADD COLUMN IF NOT EXISTS handover_by           TEXT,
    ADD COLUMN IF NOT EXISTS handover_at           TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ DEFAULT NOW();

-- 2. Update grn_status check constraint to include 'handed_over'
ALTER TABLE procurement.grn
    DROP CONSTRAINT IF EXISTS grn_status_check;

ALTER TABLE procurement.grn
    ADD CONSTRAINT grn_status_check
    CHECK (grn_status IN ('pending_iqc', 'handed_over', 'iqc_passed', 'iqc_failed', 'partial_pass'));

-- 3. Index for fast handover queries
CREATE INDEX IF NOT EXISTS idx_grn_status ON procurement.grn (grn_status);
CREATE INDEX IF NOT EXISTS idx_grn_batch  ON procurement.grn (batch_no);
CREATE INDEX IF NOT EXISTS idx_grn_bin    ON procurement.grn (assigned_bin_code);

-- 4. Ensure inventory_stock_levels has all needed columns (already exist but safe)
ALTER TABLE inventory_stock_levels
    ADD COLUMN IF NOT EXISTS zone_code   TEXT,
    ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT NOW();

-- 5. Ensure inventory_stock_movements has is_deleted (safe)
ALTER TABLE inventory_stock_movements
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
