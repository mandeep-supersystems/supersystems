-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION: Purchase ↔ Supplier Connection
-- Links purchase_orders to supplier.suppliers
-- Adds supplier invoice tracking on purchase orders
-- Cleans procurement.purchase_orders to customer-only
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add supplier_id FK to purchase_orders (purchase module flat table)
ALTER TABLE purchase_orders
    ADD COLUMN IF NOT EXISTS supplier_id        UUID REFERENCES supplier.suppliers(id),
    ADD COLUMN IF NOT EXISTS supplier_invoice_no TEXT,
    ADD COLUMN IF NOT EXISTS supplier_invoice_date DATE,
    ADD COLUMN IF NOT EXISTS supplier_invoice_amount NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS invoice_received_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS invoice_received_by TEXT,
    ADD COLUMN IF NOT EXISTS po_status          TEXT DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS sent_to_supplier_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS acknowledged_at    TIMESTAMPTZ;

-- 2. Index for supplier lookup
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders (supplier_id);

-- 3. Add supplier_id + po_type to procurement.purchase_orders (customer POs only)
ALTER TABLE procurement.purchase_orders
    ADD COLUMN IF NOT EXISTS po_type    TEXT DEFAULT 'customer',
    ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES supplier.suppliers(id);

-- 4. Ensure all existing procurement POs are marked as customer type
UPDATE procurement.purchase_orders SET po_type = 'customer' WHERE po_type IS NULL;

-- 5. Supplier invoice table for tracking invoices against purchase orders
CREATE TABLE IF NOT EXISTS purchase_supplier_invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id           character varying(36) NOT NULL REFERENCES procurement.purchase_orders(id),
    po_no           TEXT NOT NULL,
    supplier_id     UUID REFERENCES supplier.suppliers(id),
    supplier_name   TEXT,
    invoice_no      TEXT NOT NULL,
    invoice_date    DATE,
    invoice_amount  NUMERIC(14,2),
    currency        TEXT DEFAULT 'INR',
    line_items      JSONB DEFAULT '[]',
    status          TEXT DEFAULT 'received',  -- received, verified, disputed, paid
    notes           TEXT,
    received_by     TEXT,
    tenant_id       TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    is_deleted      BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_psi_po_id      ON purchase_supplier_invoices (po_id);
CREATE INDEX IF NOT EXISTS idx_psi_supplier_id ON purchase_supplier_invoices (supplier_id);
CREATE INDEX IF NOT EXISTS idx_psi_invoice_no  ON purchase_supplier_invoices (invoice_no);
