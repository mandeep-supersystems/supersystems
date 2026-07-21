-- ============================================================
-- INVENTORY SCHEMA
-- ============================================================
CREATE SCHEMA IF NOT EXISTS inventory;

CREATE TABLE IF NOT EXISTS inventory.warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory.stock_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_number VARCHAR(100) NOT NULL,
    part_description TEXT DEFAULT '',
    item_type VARCHAR(20) DEFAULT 'PART', -- PART, RM, FG, NG
    warehouse_id UUID REFERENCES inventory.warehouses(id),
    warehouse_code VARCHAR(20),
    zone_code VARCHAR(20),
    bin_code VARCHAR(30),
    qty_on_hand NUMERIC(14,4) DEFAULT 0,
    qty_reserved NUMERIC(14,4) DEFAULT 0,
    qty_available NUMERIC(14,4) GENERATED ALWAYS AS (qty_on_hand - qty_reserved) STORED,
    reorder_point NUMERIC(14,4) DEFAULT 0,
    reorder_qty NUMERIC(14,4) DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'pcs',
    unit_cost NUMERIC(14,4) DEFAULT 0,
    total_value NUMERIC(14,4) GENERATED ALWAYS AS (qty_on_hand * unit_cost) STORED,
    last_movement_at TIMESTAMP,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(part_number, warehouse_id, bin_code, tenant_id)
);

CREATE TABLE IF NOT EXISTS inventory.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movement_no VARCHAR(50),
    movement_type VARCHAR(20) NOT NULL, -- RECEIPT, ISSUE, TRANSFER, ADJUSTMENT, RETURN, SCRAP
    part_number VARCHAR(100) NOT NULL,
    part_description TEXT DEFAULT '',
    item_type VARCHAR(20) DEFAULT 'PART',
    from_warehouse_code VARCHAR(20),
    from_bin_code VARCHAR(30),
    to_warehouse_code VARCHAR(20),
    to_bin_code VARCHAR(30),
    qty NUMERIC(14,4) NOT NULL,
    unit VARCHAR(20) DEFAULT 'pcs',
    unit_cost NUMERIC(14,4) DEFAULT 0,
    reference_type VARCHAR(30), -- PO, PRODUCTION_ORDER, MANUAL
    reference_no VARCHAR(100),
    reason TEXT,
    performed_by VARCHAR(200),
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory.batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_no VARCHAR(100) NOT NULL,
    part_number VARCHAR(100) NOT NULL,
    supplier_lot VARCHAR(100),
    manufacture_date DATE,
    expiry_date DATE,
    qty_received NUMERIC(14,4) DEFAULT 0,
    qty_remaining NUMERIC(14,4) DEFAULT 0,
    warehouse_code VARCHAR(20),
    bin_code VARCHAR(30),
    status VARCHAR(20) DEFAULT 'active', -- active, consumed, expired, quarantine
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory.serial_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_no VARCHAR(100) NOT NULL,
    part_number VARCHAR(100) NOT NULL,
    batch_no VARCHAR(100),
    warehouse_code VARCHAR(20),
    bin_code VARCHAR(30),
    status VARCHAR(20) DEFAULT 'in_stock', -- in_stock, in_production, shipped, scrapped
    production_order_no VARCHAR(100),
    notes TEXT,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory.reorder_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_number VARCHAR(100) NOT NULL,
    warehouse_code VARCHAR(20),
    reorder_point NUMERIC(14,4) DEFAULT 0,
    reorder_qty NUMERIC(14,4) DEFAULT 0,
    lead_time_days INTEGER DEFAULT 0,
    preferred_supplier VARCHAR(200),
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory.stock_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    count_no VARCHAR(50) NOT NULL,
    warehouse_code VARCHAR(20),
    count_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'draft', -- draft, in_progress, completed, posted
    assigned_to VARCHAR(200),
    notes TEXT,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory.stock_count_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    count_id UUID REFERENCES inventory.stock_counts(id),
    part_number VARCHAR(100) NOT NULL,
    bin_code VARCHAR(30),
    book_qty NUMERIC(14,4) DEFAULT 0,
    counted_qty NUMERIC(14,4),
    variance NUMERIC(14,4) GENERATED ALWAYS AS (COALESCE(counted_qty,0) - book_qty) STORED,
    status VARCHAR(20) DEFAULT 'pending', -- pending, counted, approved
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_levels_part ON inventory.stock_levels(part_number, tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_part ON inventory.stock_movements(part_number, tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON inventory.stock_movements(movement_type, tenant_id);

-- ============================================================
-- WAREHOUSE SCHEMA
-- ============================================================
CREATE SCHEMA IF NOT EXISTS warehouse;

CREATE TABLE IF NOT EXISTS warehouse.zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_code VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    zone_type VARCHAR(20) DEFAULT 'GENERAL', -- RM, WIP, FG, QC, STAGING, GENERAL
    warehouse_code VARCHAR(20) NOT NULL,
    capacity_units INTEGER,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse.bins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bin_code VARCHAR(30) NOT NULL,
    zone_code VARCHAR(20) NOT NULL,
    warehouse_code VARCHAR(20) NOT NULL,
    aisle VARCHAR(10),
    rack VARCHAR(10),
    level VARCHAR(10),
    capacity_units INTEGER,
    current_units INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active', -- active, blocked, reserved, full
    qr_data TEXT, -- encoded QR string
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(bin_code, warehouse_code, tenant_id)
);

CREATE TABLE IF NOT EXISTS warehouse.pick_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_no VARCHAR(50) NOT NULL,
    reference_type VARCHAR(30), -- PRODUCTION_ORDER, SALES_ORDER, MANUAL
    reference_no VARCHAR(100),
    warehouse_code VARCHAR(20),
    assigned_to VARCHAR(200),
    due_date DATE,
    status VARCHAR(20) DEFAULT 'open', -- open, in_progress, completed, cancelled
    notes TEXT,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse.pick_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pick_list_id UUID REFERENCES warehouse.pick_lists(id),
    part_number VARCHAR(100) NOT NULL,
    part_description TEXT DEFAULT '',
    bin_code VARCHAR(30),
    qty_required NUMERIC(14,4) NOT NULL,
    qty_picked NUMERIC(14,4) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending', -- pending, picked, short
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse.putaway_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_no VARCHAR(50) NOT NULL,
    receipt_ref VARCHAR(100),
    part_number VARCHAR(100) NOT NULL,
    part_description TEXT DEFAULT '',
    qty NUMERIC(14,4) NOT NULL,
    suggested_bin VARCHAR(30),
    actual_bin VARCHAR(30),
    warehouse_code VARCHAR(20),
    status VARCHAR(20) DEFAULT 'pending', -- pending, completed
    performed_by VARCHAR(200),
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse.receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_no VARCHAR(50) NOT NULL,
    po_number VARCHAR(100),
    supplier_name VARCHAR(200),
    warehouse_code VARCHAR(20),
    receipt_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'draft', -- draft, received, qc_pending, putaway, completed
    notes TEXT,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse.receipt_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID REFERENCES warehouse.receipts(id),
    part_number VARCHAR(100) NOT NULL,
    part_description TEXT DEFAULT '',
    ordered_qty NUMERIC(14,4) DEFAULT 0,
    received_qty NUMERIC(14,4) DEFAULT 0,
    accepted_qty NUMERIC(14,4) DEFAULT 0,
    rejected_qty NUMERIC(14,4) DEFAULT 0,
    bin_code VARCHAR(30),
    qc_status VARCHAR(20) DEFAULT 'pending', -- pending, passed, failed
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse.shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_no VARCHAR(50) NOT NULL,
    customer_name VARCHAR(200),
    delivery_address TEXT,
    warehouse_code VARCHAR(20),
    dispatch_date DATE,
    carrier VARCHAR(100),
    tracking_no VARCHAR(100),
    status VARCHAR(20) DEFAULT 'draft', -- draft, packed, dispatched, delivered
    notes TEXT,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse.shipment_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID REFERENCES warehouse.shipments(id),
    part_number VARCHAR(100) NOT NULL,
    part_description TEXT DEFAULT '',
    qty NUMERIC(14,4) NOT NULL,
    bin_code VARCHAR(30),
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bins_warehouse ON warehouse.bins(warehouse_code, tenant_id);
CREATE INDEX IF NOT EXISTS idx_pick_lists_status ON warehouse.pick_lists(status, tenant_id);

-- ============================================================
-- MANUFACTURING SCHEMA
-- ============================================================
CREATE SCHEMA IF NOT EXISTS manufacturing;

CREATE TABLE IF NOT EXISTS manufacturing.boms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_no VARCHAR(50) NOT NULL,
    fg_part_number VARCHAR(100) NOT NULL,
    fg_description TEXT DEFAULT '',
    version VARCHAR(10) DEFAULT '1.0',
    effective_date DATE,
    status VARCHAR(20) DEFAULT 'draft', -- draft, active, obsolete
    yield_qty NUMERIC(14,4) DEFAULT 1,
    unit VARCHAR(20) DEFAULT 'pcs',
    notes TEXT,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manufacturing.bom_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bom_id UUID REFERENCES manufacturing.boms(id),
    sequence INTEGER DEFAULT 10,
    component_type VARCHAR(10) DEFAULT 'PART', -- PART, RM
    component_no VARCHAR(100) NOT NULL,
    component_description TEXT DEFAULT '',
    qty_per NUMERIC(14,4) NOT NULL DEFAULT 1,
    unit VARCHAR(20) DEFAULT 'pcs',
    scrap_factor NUMERIC(5,2) DEFAULT 0,
    operation_ref VARCHAR(20), -- links to routing step e.g. -01
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manufacturing.work_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    machine_id VARCHAR(100), -- links to machine management
    machine_name VARCHAR(200),
    capacity_hours_per_day NUMERIC(5,2) DEFAULT 8,
    efficiency_pct NUMERIC(5,2) DEFAULT 100,
    cost_rate_per_hour NUMERIC(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manufacturing.routings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    routing_no VARCHAR(50) NOT NULL,
    part_number VARCHAR(100) NOT NULL,
    part_description TEXT DEFAULT '',
    version VARCHAR(10) DEFAULT '1.0',
    status VARCHAR(20) DEFAULT 'draft', -- draft, active, obsolete
    notes TEXT,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manufacturing.routing_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    routing_id UUID REFERENCES manufacturing.routings(id),
    sequence INTEGER NOT NULL,
    operation_code VARCHAR(20) NOT NULL, -- e.g. -01, -02 ... -80
    operation_name VARCHAR(200),
    work_center_code VARCHAR(20),
    work_center_name VARCHAR(200),
    setup_time_min NUMERIC(8,2) DEFAULT 0,
    run_time_min_per_unit NUMERIC(8,2) DEFAULT 0,
    sub_operations JSONB DEFAULT '[]', -- [{code:"-01-01", name:"...", time:0}]
    notes TEXT,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manufacturing.production_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_no VARCHAR(50) NOT NULL,
    fg_part_number VARCHAR(100) NOT NULL,
    fg_description TEXT DEFAULT '',
    bom_id UUID REFERENCES manufacturing.boms(id),
    routing_id UUID REFERENCES manufacturing.routings(id),
    planned_qty NUMERIC(14,4) NOT NULL,
    produced_qty NUMERIC(14,4) DEFAULT 0,
    rejected_qty NUMERIC(14,4) DEFAULT 0,
    planned_start DATE,
    planned_end DATE,
    actual_start TIMESTAMP,
    actual_end TIMESTAMP,
    status VARCHAR(20) DEFAULT 'draft', -- draft, released, in_progress, completed, closed
    priority VARCHAR(10) DEFAULT 'normal', -- low, normal, high, urgent
    notes TEXT,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manufacturing.shop_floor_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_order_no VARCHAR(50) NOT NULL,
    part_number VARCHAR(100) NOT NULL,
    operation_code VARCHAR(20) NOT NULL,
    work_center_code VARCHAR(20),
    operator VARCHAR(200),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    qty_produced NUMERIC(14,4) DEFAULT 0,
    qty_rejected NUMERIC(14,4) DEFAULT 0,
    rejection_reason TEXT,
    actual_time_min NUMERIC(8,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'in_progress', -- in_progress, completed
    notes TEXT,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boms_part ON manufacturing.boms(fg_part_number, tenant_id);
CREATE INDEX IF NOT EXISTS idx_prod_orders_status ON manufacturing.production_orders(status, tenant_id);
CREATE INDEX IF NOT EXISTS idx_shop_floor_order ON manufacturing.shop_floor_logs(production_order_no, tenant_id);
CREATE INDEX IF NOT EXISTS idx_routings_part ON manufacturing.routings(part_number, tenant_id);
