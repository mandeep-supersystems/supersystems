-- ============================================================
-- Manufacturing BOM Full Schema Migration
-- Run this once on the DB.
-- ============================================================

-- mhr_rate column on work centers (Machine Hour Rate = cost_rate / efficiency)
ALTER TABLE manufacturing_work_centers ADD COLUMN IF NOT EXISTS mhr_rate NUMERIC(10,2) DEFAULT 0;

-- current_version + name on the existing boms table
ALTER TABLE manufacturing_boms ADD COLUMN IF NOT EXISTS current_version VARCHAR(20) DEFAULT 'V1';
ALTER TABLE manufacturing_boms ADD COLUMN IF NOT EXISTS name VARCHAR(200);

-- BOM Versions (one row per version per BOM)
CREATE TABLE IF NOT EXISTS manufacturing_bom_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id          VARCHAR(36) NOT NULL REFERENCES manufacturing_boms(id) ON DELETE CASCADE,
    version         VARCHAR(20) NOT NULL,
    version_type    VARCHAR(10) DEFAULT 'minor',   -- major / minor
    status          VARCHAR(20) DEFAULT 'Draft',   -- Draft / Released
    change_description TEXT,
    released_at     TIMESTAMP,
    created_by      VARCHAR(200),
    tenant_id       VARCHAR(100) NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mfg_bom_versions_bom ON manufacturing_bom_versions(bom_id);

-- BOM Items (live working copy)
CREATE TABLE IF NOT EXISTS manufacturing_bom_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id          VARCHAR(36) NOT NULL REFERENCES manufacturing_boms(id) ON DELETE CASCADE,
    parent_item_id  UUID REFERENCES manufacturing_bom_items(id) ON DELETE CASCADE,
    child_type      VARCHAR(20) NOT NULL DEFAULT 'component',  -- component / assembly / manufactured
    child_part_code VARCHAR(100) NOT NULL,
    description     TEXT DEFAULT '',
    quantity        NUMERIC(14,4) DEFAULT 1,
    unit            VARCHAR(20) DEFAULT 'Nos',
    level           INTEGER DEFAULT 1,
    reference       VARCHAR(300),
    notes           TEXT,
    material        VARCHAR(200),
    unit_cost       NUMERIC(14,4) DEFAULT 0,
    status          VARCHAR(50) DEFAULT 'Active',
    revision        VARCHAR(50),
    scrap_factor    NUMERIC(5,2) DEFAULT 0,
    operation_ref   VARCHAR(20),
    pinned_version  VARCHAR(20),
    added_by        VARCHAR(200),
    tenant_id       VARCHAR(100) NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mfg_bom_items_bom    ON manufacturing_bom_items(bom_id);
CREATE INDEX IF NOT EXISTS idx_mfg_bom_items_parent ON manufacturing_bom_items(parent_item_id);

-- BOM Item Snapshots (frozen copy per version / edit rollback)
CREATE TABLE IF NOT EXISTS manufacturing_bom_item_snapshots (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id              VARCHAR(36) NOT NULL REFERENCES manufacturing_boms(id) ON DELETE CASCADE,
    version             VARCHAR(20) NOT NULL,
    original_item_id    UUID,
    parent_item_id      UUID,
    child_type          VARCHAR(20) NOT NULL,
    child_part_code     VARCHAR(100) NOT NULL,
    description         TEXT DEFAULT '',
    quantity            NUMERIC(14,4) DEFAULT 1,
    unit                VARCHAR(20) DEFAULT 'Nos',
    level               INTEGER DEFAULT 1,
    reference           VARCHAR(300),
    notes               TEXT,
    material            VARCHAR(200),
    unit_cost           NUMERIC(14,4) DEFAULT 0,
    status              VARCHAR(50) DEFAULT 'Active',
    revision            VARCHAR(50),
    scrap_factor        NUMERIC(5,2) DEFAULT 0,
    operation_ref       VARCHAR(20),
    tenant_id           VARCHAR(100) NOT NULL,
    snapped_at          TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mfg_bom_snaps ON manufacturing_bom_item_snapshots(bom_id, version);

-- BOM Files
CREATE TABLE IF NOT EXISTS manufacturing_bom_files (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id      VARCHAR(36) NOT NULL REFERENCES manufacturing_boms(id) ON DELETE CASCADE,
    bom_item_id UUID REFERENCES manufacturing_bom_items(id) ON DELETE SET NULL,
    filename    VARCHAR(300) NOT NULL,
    filepath    VARCHAR(500) NOT NULL,
    file_type   VARCHAR(50),
    file_size   INTEGER,
    doc_type    VARCHAR(100),
    revision    VARCHAR(20),
    description TEXT,
    uploaded_by VARCHAR(200),
    tenant_id   VARCHAR(100) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- BOM History / Audit
CREATE TABLE IF NOT EXISTS manufacturing_bom_history (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id       VARCHAR(36) NOT NULL REFERENCES manufacturing_boms(id) ON DELETE CASCADE,
    action       VARCHAR(80) NOT NULL,
    detail       TEXT,
    performed_by VARCHAR(200),
    tenant_id    VARCHAR(100) NOT NULL,
    performed_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mfg_bom_history ON manufacturing_bom_history(bom_id);

-- BOM Costing Selections (user picks preferred vendor per part)
CREATE TABLE IF NOT EXISTS manufacturing_bom_costing_selections (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id      VARCHAR(36) NOT NULL REFERENCES manufacturing_boms(id) ON DELETE CASCADE,
    part_number VARCHAR(100) NOT NULL,
    pvp_id      INTEGER,
    selected_by VARCHAR(200),
    tenant_id   VARCHAR(100) NOT NULL,
    selected_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(bom_id, part_number)
);
