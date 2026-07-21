import sys
import uuid
import os
from datetime import datetime, timedelta

sys.path.insert(0, '.')
from app import create_app
from extensions import db

app = create_app()

SQL_SCHEMA = """
CREATE TABLE IF NOT EXISTS inventory_warehouses (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_stock_levels (
    id VARCHAR(36) PRIMARY KEY,
    part_number VARCHAR(100) NOT NULL,
    part_description TEXT DEFAULT '',
    item_type VARCHAR(20) DEFAULT 'PART',
    warehouse_id VARCHAR(36),
    warehouse_code VARCHAR(20),
    zone_code VARCHAR(20),
    bin_code VARCHAR(30),
    qty_on_hand NUMERIC(14,4) DEFAULT 0,
    qty_reserved NUMERIC(14,4) DEFAULT 0,
    qty_available NUMERIC(14,4) DEFAULT 0,
    reorder_point NUMERIC(14,4) DEFAULT 0,
    reorder_qty NUMERIC(14,4) DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'pcs',
    unit_cost NUMERIC(14,4) DEFAULT 0,
    total_value NUMERIC(14,4) DEFAULT 0,
    last_movement_at TIMESTAMP,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_stock_movements (
    id VARCHAR(36) PRIMARY KEY,
    movement_no VARCHAR(50),
    movement_type VARCHAR(20) NOT NULL,
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
    reference_type VARCHAR(30),
    reference_no VARCHAR(100),
    reason TEXT,
    performed_by VARCHAR(200),
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_batches (
    id VARCHAR(36) PRIMARY KEY,
    batch_no VARCHAR(100) NOT NULL,
    part_number VARCHAR(100) NOT NULL,
    supplier_lot VARCHAR(100),
    manufacture_date VARCHAR(30),
    expiry_date VARCHAR(30),
    qty_received NUMERIC(14,4) DEFAULT 0,
    qty_remaining NUMERIC(14,4) DEFAULT 0,
    warehouse_code VARCHAR(20),
    bin_code VARCHAR(30),
    status VARCHAR(20) DEFAULT 'active',
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_serial_numbers (
    id VARCHAR(36) PRIMARY KEY,
    serial_no VARCHAR(100) NOT NULL,
    part_number VARCHAR(100) NOT NULL,
    batch_no VARCHAR(100),
    warehouse_code VARCHAR(20),
    bin_code VARCHAR(30),
    status VARCHAR(20) DEFAULT 'in_stock',
    production_order_no VARCHAR(100),
    notes TEXT,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_reorder_rules (
    id VARCHAR(36) PRIMARY KEY,
    part_number VARCHAR(100) NOT NULL,
    warehouse_code VARCHAR(20),
    reorder_point NUMERIC(14,4) DEFAULT 0,
    reorder_qty NUMERIC(14,4) DEFAULT 0,
    lead_time_days INTEGER DEFAULT 0,
    preferred_supplier VARCHAR(200),
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_stock_counts (
    id VARCHAR(36) PRIMARY KEY,
    count_no VARCHAR(50) NOT NULL,
    warehouse_code VARCHAR(20),
    count_date VARCHAR(30) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    assigned_to VARCHAR(200),
    notes TEXT,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_stock_count_lines (
    id VARCHAR(36) PRIMARY KEY,
    count_id VARCHAR(36),
    part_number VARCHAR(100) NOT NULL,
    bin_code VARCHAR(30),
    book_qty NUMERIC(14,4) DEFAULT 0,
    counted_qty NUMERIC(14,4),
    variance NUMERIC(14,4) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouse_zones (
    id VARCHAR(36) PRIMARY KEY,
    zone_code VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    zone_type VARCHAR(20) DEFAULT 'GENERAL',
    warehouse_code VARCHAR(20) NOT NULL,
    capacity_units INTEGER DEFAULT 1000,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouse_bins (
    id VARCHAR(36) PRIMARY KEY,
    bin_code VARCHAR(30) NOT NULL,
    zone_code VARCHAR(20) NOT NULL,
    warehouse_code VARCHAR(20) NOT NULL,
    aisle VARCHAR(10),
    rack VARCHAR(10),
    level VARCHAR(10),
    capacity_units INTEGER DEFAULT 500,
    current_units INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    qr_data TEXT,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouse_pick_lists (
    id VARCHAR(36) PRIMARY KEY,
    list_no VARCHAR(50) NOT NULL,
    reference_type VARCHAR(30),
    reference_no VARCHAR(100),
    warehouse_code VARCHAR(20),
    assigned_to VARCHAR(200),
    due_date VARCHAR(30),
    status VARCHAR(20) DEFAULT 'open',
    notes TEXT,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouse_pick_list_items (
    id VARCHAR(36) PRIMARY KEY,
    pick_list_id VARCHAR(36),
    part_number VARCHAR(100) NOT NULL,
    part_description TEXT DEFAULT '',
    bin_code VARCHAR(30),
    qty_required NUMERIC(14,4) NOT NULL,
    qty_picked NUMERIC(14,4) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouse_putaway_tasks (
    id VARCHAR(36) PRIMARY KEY,
    task_no VARCHAR(50) NOT NULL,
    receipt_ref VARCHAR(100),
    part_number VARCHAR(100) NOT NULL,
    part_description TEXT DEFAULT '',
    qty NUMERIC(14,4) NOT NULL,
    suggested_bin VARCHAR(30),
    actual_bin VARCHAR(30),
    warehouse_code VARCHAR(20),
    status VARCHAR(20) DEFAULT 'pending',
    performed_by VARCHAR(200),
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouse_receipts (
    id VARCHAR(36) PRIMARY KEY,
    receipt_no VARCHAR(50) NOT NULL,
    po_number VARCHAR(100),
    supplier_name VARCHAR(200),
    warehouse_code VARCHAR(20),
    receipt_date VARCHAR(30) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    notes TEXT,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouse_receipt_lines (
    id VARCHAR(36) PRIMARY KEY,
    receipt_id VARCHAR(36),
    part_number VARCHAR(100) NOT NULL,
    part_description TEXT DEFAULT '',
    ordered_qty NUMERIC(14,4) DEFAULT 0,
    received_qty NUMERIC(14,4) DEFAULT 0,
    accepted_qty NUMERIC(14,4) DEFAULT 0,
    rejected_qty NUMERIC(14,4) DEFAULT 0,
    bin_code VARCHAR(30),
    qc_status VARCHAR(20) DEFAULT 'pending',
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouse_packing_lists (
    id VARCHAR(36) PRIMARY KEY,
    packing_no VARCHAR(50) NOT NULL,
    customer_ref VARCHAR(100),
    fg_part_number VARCHAR(100) NOT NULL,
    qty NUMERIC(14,4) DEFAULT 0,
    box_pallet_details VARCHAR(200),
    weight_kg NUMERIC(10,2) DEFAULT 0,
    dimensions VARCHAR(100),
    status VARCHAR(20) DEFAULT 'packed',
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouse_shipments (
    id VARCHAR(36) PRIMARY KEY,
    shipment_no VARCHAR(50) NOT NULL,
    customer_name VARCHAR(200),
    delivery_address TEXT,
    warehouse_code VARCHAR(20),
    dispatch_date VARCHAR(30),
    carrier VARCHAR(100),
    tracking_no VARCHAR(100),
    status VARCHAR(20) DEFAULT 'draft',
    notes TEXT,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS warehouse_shipment_lines (
    id VARCHAR(36) PRIMARY KEY,
    shipment_id VARCHAR(36),
    part_number VARCHAR(100) NOT NULL,
    part_description TEXT DEFAULT '',
    qty NUMERIC(14,4) NOT NULL,
    bin_code VARCHAR(30),
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS manufacturing_boms (
    id VARCHAR(36) PRIMARY KEY,
    bom_no VARCHAR(50) NOT NULL,
    fg_part_number VARCHAR(100) NOT NULL,
    fg_description TEXT DEFAULT '',
    version VARCHAR(10) DEFAULT '1.0',
    effective_date VARCHAR(30),
    status VARCHAR(20) DEFAULT 'active',
    yield_qty NUMERIC(14,4) DEFAULT 1,
    unit VARCHAR(20) DEFAULT 'pcs',
    notes TEXT,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS manufacturing_bom_lines (
    id VARCHAR(36) PRIMARY KEY,
    bom_id VARCHAR(36),
    sequence INTEGER DEFAULT 10,
    component_type VARCHAR(10) DEFAULT 'PART',
    component_no VARCHAR(100) NOT NULL,
    component_description TEXT DEFAULT '',
    qty_per NUMERIC(14,4) NOT NULL DEFAULT 1,
    unit VARCHAR(20) DEFAULT 'pcs',
    scrap_factor NUMERIC(5,2) DEFAULT 0,
    operation_ref VARCHAR(20),
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS manufacturing_work_centers (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    machine_id VARCHAR(100),
    machine_name VARCHAR(200),
    capacity_hours_per_day NUMERIC(5,2) DEFAULT 8,
    efficiency_pct NUMERIC(5,2) DEFAULT 100,
    cost_rate_per_hour NUMERIC(10,2) DEFAULT 0,
    mhr_rate NUMERIC(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS manufacturing_routings (
    id VARCHAR(36) PRIMARY KEY,
    routing_no VARCHAR(50) NOT NULL,
    part_number VARCHAR(100) NOT NULL,
    part_description TEXT DEFAULT '',
    version VARCHAR(10) DEFAULT '1.0',
    status VARCHAR(20) DEFAULT 'active',
    notes TEXT,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS manufacturing_routing_steps (
    id VARCHAR(36) PRIMARY KEY,
    routing_id VARCHAR(36),
    sequence INTEGER NOT NULL,
    operation_code VARCHAR(20) NOT NULL,
    operation_name VARCHAR(200),
    work_center_code VARCHAR(20),
    work_center_name VARCHAR(200),
    setup_time_min NUMERIC(8,2) DEFAULT 0,
    run_time_min_per_unit NUMERIC(8,2) DEFAULT 0,
    sub_operations TEXT DEFAULT '[]',
    notes TEXT,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS manufacturing_production_orders (
    id VARCHAR(36) PRIMARY KEY,
    order_no VARCHAR(50) NOT NULL,
    fg_part_number VARCHAR(100) NOT NULL,
    fg_description TEXT DEFAULT '',
    bom_id VARCHAR(36),
    routing_id VARCHAR(36),
    planned_qty NUMERIC(14,4) NOT NULL,
    produced_qty NUMERIC(14,4) DEFAULT 0,
    rejected_qty NUMERIC(14,4) DEFAULT 0,
    planned_start VARCHAR(30),
    planned_end VARCHAR(30),
    actual_start TIMESTAMP,
    actual_end TIMESTAMP,
    status VARCHAR(20) DEFAULT 'draft',
    priority VARCHAR(10) DEFAULT 'normal',
    notes TEXT,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS manufacturing_shop_floor_logs (
    id VARCHAR(36) PRIMARY KEY,
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
    status VARCHAR(20) DEFAULT 'in_progress',
    notes TEXT,
    tenant_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

def init_modules_db():
    with app.app_context():
        print("Initializing Inventory, Warehouse, and Manufacturing database tables...")
        statements = [stmt.strip() for stmt in SQL_SCHEMA.split(";") if stmt.strip()]
        for stmt in statements:
            try:
                db.session.execute(db.text(stmt))
            except Exception as e:
                db.session.rollback()
                print(f"Notice executing statement: {e}")
        db.session.commit()
        print("Tables initialized successfully.")

if __name__ == "__main__":
    init_modules_db()
