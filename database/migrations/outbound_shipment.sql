-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION: Outbound Shipments (Customer Dispatch)
-- Tracks: shipment → customer PO/invoice cross-check → stock deduction
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS logistics;

-- Outbound shipment header
CREATE TABLE IF NOT EXISTS logistics.shipments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_no         TEXT NOT NULL UNIQUE,
    shipment_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    customer_name       TEXT NOT NULL,
    customer_po_no      TEXT NOT NULL,          -- PO received FROM customer
    customer_invoice_no TEXT,                   -- our invoice raised to customer
    customer_invoice_amount NUMERIC(18,4) DEFAULT 0,
    selling_price_total NUMERIC(18,4) DEFAULT 0,
    cost_price_total    NUMERIC(18,4) DEFAULT 0,
    gross_profit        NUMERIC(18,4) DEFAULT 0,
    transport_mode      TEXT DEFAULT 'Road',    -- Road / Air / Sea / Courier
    transporter_name    TEXT,
    lr_no               TEXT,                   -- Lorry Receipt / AWB
    vehicle_no          TEXT,
    dispatch_from       TEXT DEFAULT 'MAIN',    -- warehouse dispatched from
    status              TEXT DEFAULT 'draft'    -- draft / dispatched / delivered / cancelled
        CHECK (status IN ('draft','dispatched','delivered','cancelled')),
    po_verified         BOOLEAN DEFAULT FALSE,  -- customer PO cross-checked
    invoice_verified    BOOLEAN DEFAULT FALSE,  -- invoice cross-checked
    discrepancy_notes   TEXT,
    remarks             TEXT,
    created_by          TEXT,
    tenant_id           TEXT,
    is_deleted          BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Shipment line items
CREATE TABLE IF NOT EXISTS logistics.shipment_lines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id     UUID NOT NULL REFERENCES logistics.shipments(id),
    part_number     TEXT NOT NULL,
    part_description TEXT,
    warehouse_code  TEXT DEFAULT 'MAIN',
    bin_code        TEXT,
    qty_dispatched  NUMERIC(18,4) NOT NULL,
    unit            TEXT DEFAULT 'pcs',
    unit_cost       NUMERIC(18,4) DEFAULT 0,    -- cost price (from inventory)
    unit_selling    NUMERIC(18,4) DEFAULT 0,    -- selling price (from customer PO)
    total_cost      NUMERIC(18,4) DEFAULT 0,
    total_selling   NUMERIC(18,4) DEFAULT 0,
    profit          NUMERIC(18,4) DEFAULT 0,
    customer_po_no  TEXT,
    customer_po_qty NUMERIC(18,4) DEFAULT 0,    -- qty on customer PO for this part
    tenant_id       TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Stock movement tracking per shipment (sent vs remaining)
CREATE TABLE IF NOT EXISTS logistics.stock_dispatch_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id     UUID NOT NULL REFERENCES logistics.shipments(id),
    shipment_no     TEXT NOT NULL,
    part_number     TEXT NOT NULL,
    warehouse_code  TEXT,
    qty_before      NUMERIC(18,4),
    qty_dispatched  NUMERIC(18,4),
    qty_after       NUMERIC(18,4),
    dispatched_by   TEXT,
    tenant_id       TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shipments_tenant    ON logistics.shipments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_shipments_customer  ON logistics.shipments (customer_name);
CREATE INDEX IF NOT EXISTS idx_shipments_po        ON logistics.shipments (customer_po_no);
CREATE INDEX IF NOT EXISTS idx_shipment_lines_ship ON logistics.shipment_lines (shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_lines_part ON logistics.shipment_lines (part_number);
CREATE INDEX IF NOT EXISTS idx_dispatch_log_ship   ON logistics.stock_dispatch_log (shipment_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_log_part   ON logistics.stock_dispatch_log (part_number);

-- Update grn_status constraint to include all statuses used in code
ALTER TABLE procurement.grn
    DROP CONSTRAINT IF EXISTS grn_status_check;
ALTER TABLE procurement.grn
    ADD CONSTRAINT grn_status_check CHECK (
        grn_status IN (
            'pending_iqc','handed_over','partially_handed_over',
            'iqc_passed','iqc_partial','iqc_rejected','iqc_failed',
            'partial_pass','rejected'
        )
    );
