-- ============================================================
-- MIGRATION: Project ↔ Manufacturing + Customer PO separation
-- ============================================================

-- 1. Add project_id to manufacturing production orders
--    (links a production order to the project it was triggered by)
ALTER TABLE manufacturing_production_orders
    ADD COLUMN IF NOT EXISTS project_id VARCHAR(36) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_mfg_prod_orders_project
    ON manufacturing_production_orders(project_id)
    WHERE project_id IS NOT NULL;

-- Also add to the schema table (manufacturing.production_orders)
ALTER TABLE manufacturing.production_orders
    ADD COLUMN IF NOT EXISTS project_id VARCHAR(36) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_mfg_prod_orders_project2
    ON manufacturing.production_orders(project_id)
    WHERE project_id IS NOT NULL;

-- 2. Add customer_pos JSONB to project.projects
--    (stores customer POs uploaded from the customer — separate from procurement POs sent to suppliers)
ALTER TABLE project.projects
    ADD COLUMN IF NOT EXISTS customer_pos JSONB DEFAULT '[]';

-- Migrate existing purchase_orders column data into customer_pos if present
UPDATE project.projects
    SET customer_pos = purchase_orders
    WHERE purchase_orders IS NOT NULL
      AND purchase_orders::text != '[]'
      AND purchase_orders::text != 'null';

-- 3. Add project_id to procurement.purchase_orders (already exists via routes but ensure column exists)
ALTER TABLE procurement.purchase_orders
    ADD COLUMN IF NOT EXISTS project_id VARCHAR(36) DEFAULT NULL;

ALTER TABLE procurement.purchase_orders
    ADD COLUMN IF NOT EXISTS organization_id VARCHAR(36) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_procurement_po_project
    ON procurement.purchase_orders(project_id)
    WHERE project_id IS NOT NULL;

-- ============================================================
-- MIGRATION: Procurement approval + Planning stock booking
-- ============================================================

-- 4. Add approval tracking to procurement.purchase_orders
ALTER TABLE procurement.purchase_orders
    ADD COLUMN IF NOT EXISTS approved_by VARCHAR(200) DEFAULT NULL;
ALTER TABLE procurement.purchase_orders
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP DEFAULT NULL;
-- status values: open | approved_pending_mapping | approved | closed | cancelled

-- 5. Add source tracking to planning.demand_plans
ALTER TABLE planning.demand_plans
    ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual';
-- source values: manual | procurement_po | reorder_rule

-- 6. Add reserved_qty tracking to inventory_stock_levels (if not exists)
ALTER TABLE inventory_stock_levels
    ADD COLUMN IF NOT EXISTS qty_reserved NUMERIC(14,4) DEFAULT 0;

-- 7. Add booked_for label to inventory_stock_levels
ALTER TABLE inventory_stock_levels
    ADD COLUMN IF NOT EXISTS booked_for TEXT DEFAULT NULL;

-- Index for fast PO demand lookups
CREATE INDEX IF NOT EXISTS idx_demand_plans_source
    ON planning.demand_plans(source, tenant_id)
    WHERE is_deleted = false;
