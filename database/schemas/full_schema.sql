-- ============================================================================
-- SUPERSYSTEMS PLATFORM - COMPLETE ALL-IN-ONE POSTGRESQL DATABASE SCHEMA
-- Execute this single script to initialize all schemas, tables, and seed data:
--   sudo -u postgres psql -d SUPERSYSTEM -f database/schemas/full_schema.sql
-- ============================================================================

-- 1. CREATE ALL SCHEMAS
CREATE SCHEMA IF NOT EXISTS iam;
CREATE SCHEMA IF NOT EXISTS workflow;
CREATE SCHEMA IF NOT EXISTS master;
CREATE SCHEMA IF NOT EXISTS project;
CREATE SCHEMA IF NOT EXISTS part;
CREATE SCHEMA IF NOT EXISTS rawmaterial;
CREATE SCHEMA IF NOT EXISTS machine;
CREATE SCHEMA IF NOT EXISTS supplier;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS inventory;
CREATE SCHEMA IF NOT EXISTS procurement;
CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS manufacturing;
CREATE SCHEMA IF NOT EXISTS quality;
CREATE SCHEMA IF NOT EXISTS warehouse;
CREATE SCHEMA IF NOT EXISTS hr;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS asset_management;
CREATE SCHEMA IF NOT EXISTS logistics;
CREATE SCHEMA IF NOT EXISTS customer_service;
CREATE SCHEMA IF NOT EXISTS ehs;
CREATE SCHEMA IF NOT EXISTS governance;
CREATE SCHEMA IF NOT EXISTS product_lifecycle;
CREATE SCHEMA IF NOT EXISTS supplier_management;
CREATE SCHEMA IF NOT EXISTS treasury;
CREATE SCHEMA IF NOT EXISTS core;

-- 2. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- 3. PUBLIC SCHEMA (SUPER ADMINS)
CREATE TABLE IF NOT EXISTS public.super_admins (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(200) UNIQUE NOT NULL,
    password_hash VARCHAR(256) NOT NULL,
    name VARCHAR(200) NOT NULL DEFAULT 'Super Admin',
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. IAM SCHEMA
CREATE TABLE IF NOT EXISTS iam.tenants (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    domain VARCHAR(200),
    email VARCHAR(200),
    phone VARCHAR(20),
    pan VARCHAR(50),
    gst VARCHAR(50),
    cin VARCHAR(50),
    address_line1 TEXT,
    address_line2 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(20),
    country VARCHAR(100) DEFAULT 'India',
    industry VARCHAR(100),
    employee_count VARCHAR(50),
    contact_person VARCHAR(100),
    contact_designation VARCHAR(100),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(200),
    tenant_id VARCHAR(50),
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE iam.tenants ADD COLUMN IF NOT EXISTS email VARCHAR(200);
ALTER TABLE iam.tenants ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE iam.tenants ADD COLUMN IF NOT EXISTS pan VARCHAR(50);
ALTER TABLE iam.tenants ADD COLUMN IF NOT EXISTS gst VARCHAR(50);
ALTER TABLE iam.tenants ADD COLUMN IF NOT EXISTS cin VARCHAR(50);
ALTER TABLE iam.tenants ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE iam.tenants ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE iam.tenants ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE iam.tenants ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE iam.tenants ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);
ALTER TABLE iam.tenants ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE iam.tenants ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
ALTER TABLE iam.tenants ADD COLUMN IF NOT EXISTS employee_count VARCHAR(50);
ALTER TABLE iam.tenants ADD COLUMN IF NOT EXISTS contact_person VARCHAR(100);
ALTER TABLE iam.tenants ADD COLUMN IF NOT EXISTS contact_designation VARCHAR(100);
ALTER TABLE iam.tenants ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
ALTER TABLE iam.tenants ADD COLUMN IF NOT EXISTS contact_email VARCHAR(200);
ALTER TABLE iam.tenants ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(50);

CREATE TABLE IF NOT EXISTS iam.users (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    tenant_id VARCHAR(36) NOT NULL,
    email VARCHAR(200) UNIQUE NOT NULL,
    password_hash VARCHAR(256) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    is_locked BOOLEAN DEFAULT false,
    last_login TIMESTAMP,
    failed_attempts INTEGER DEFAULT 0,
    attributes JSONB DEFAULT '{}',
    is_deleted BOOLEAN DEFAULT false,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS iam.roles (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    tenant_id VARCHAR(36) NOT NULL,
    is_deleted BOOLEAN DEFAULT false,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(36),
    updated_by VARCHAR(36)
);

CREATE TABLE IF NOT EXISTS iam.permissions (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    module VARCHAR(50),
    action VARCHAR(50),
    resource VARCHAR(100),
    tenant_id VARCHAR(36) NOT NULL,
    is_deleted BOOLEAN DEFAULT false,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS iam.user_roles (
    user_id VARCHAR(36) REFERENCES iam.users(id),
    role_id VARCHAR(36) REFERENCES iam.roles(id),
    PRIMARY KEY(user_id, role_id)
);

CREATE TABLE IF NOT EXISTS iam.role_permissions (
    role_id VARCHAR(36) REFERENCES iam.roles(id),
    permission_id VARCHAR(36) REFERENCES iam.permissions(id),
    PRIMARY KEY(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS iam.sessions (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id VARCHAR(36) REFERENCES iam.users(id),
    token VARCHAR(500) NOT NULL,
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    tenant_id VARCHAR(36) NOT NULL,
    is_deleted BOOLEAN DEFAULT false,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS iam.policies (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    effect VARCHAR(10) DEFAULT 'allow',
    conditions JSONB NOT NULL,
    resource VARCHAR(200),
    action VARCHAR(50),
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    tenant_id VARCHAR(36) NOT NULL,
    is_deleted BOOLEAN DEFAULT false,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. AUDIT SCHEMA
CREATE TABLE IF NOT EXISTS audit.logs (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id VARCHAR(36),
    action VARCHAR(50) NOT NULL,
    module VARCHAR(50),
    entity_type VARCHAR(100),
    entity_id VARCHAR(36),
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    extra_data JSONB,
    tenant_id VARCHAR(36) NOT NULL,
    is_deleted BOOLEAN DEFAULT false,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit.login_history (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    user_id VARCHAR(36),
    email VARCHAR(200),
    tenant_id VARCHAR(36),
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    login_type VARCHAR(50),
    login_at TIMESTAMP DEFAULT NOW(),
    logout_at TIMESTAMP
);

-- 6. PART MODULE SCHEMA
CREATE TABLE IF NOT EXISTS part.code_schemes (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    sub_category VARCHAR(100),
    category_series VARCHAR(20),
    sub_category_series VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(36) NOT NULL,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(36),
    updated_by VARCHAR(36)
);

CREATE TABLE IF NOT EXISTS part.masters (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    part_number VARCHAR(100) NOT NULL,
    name VARCHAR(300) NOT NULL,
    description TEXT,
    code_scheme_id VARCHAR(36) REFERENCES part.code_schemes(id),
    category VARCHAR(100),
    sub_category VARCHAR(100),
    uom VARCHAR(50),
    material_type VARCHAR(50),
    weight NUMERIC(12,4),
    weight_unit VARCHAR(20),
    dimensions VARCHAR(200),
    drawing_number VARCHAR(100),
    revision VARCHAR(20) DEFAULT 'A',
    status VARCHAR(30) DEFAULT 'Draft',
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(36) NOT NULL,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(36),
    updated_by VARCHAR(36)
);

-- 7. WORKFLOW SCHEMA
CREATE TABLE IF NOT EXISTS workflow.definitions (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) NOT NULL,
    module VARCHAR(50),
    steps JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    tenant_id VARCHAR(36) NOT NULL,
    is_deleted BOOLEAN DEFAULT false,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(36),
    updated_by VARCHAR(36)
);

CREATE TABLE IF NOT EXISTS workflow.instances (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    definition_id VARCHAR(36) REFERENCES workflow.definitions(id),
    entity_type VARCHAR(100),
    entity_id VARCHAR(36),
    current_step INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    initiated_by VARCHAR(36),
    data JSONB DEFAULT '{}',
    tenant_id VARCHAR(36) NOT NULL,
    is_deleted BOOLEAN DEFAULT false,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow.steps (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    instance_id VARCHAR(36) REFERENCES workflow.instances(id),
    step_number INTEGER,
    approver_id VARCHAR(36),
    status VARCHAR(20) DEFAULT 'pending',
    comments TEXT,
    acted_at TIMESTAMP,
    tenant_id VARCHAR(36) NOT NULL,
    is_deleted BOOLEAN DEFAULT false,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow.approval_matrix (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    module VARCHAR(50),
    document_type VARCHAR(50),
    conditions JSONB,
    approvers JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    tenant_id VARCHAR(36) NOT NULL,
    is_deleted BOOLEAN DEFAULT false,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 8. MASTER DATA SCHEMA
CREATE TABLE IF NOT EXISTS master.organizations (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(50),
    parent_id VARCHAR(36),
    address JSONB,
    contact JSONB,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    tenant_id VARCHAR(36) NOT NULL,
    is_deleted BOOLEAN DEFAULT false,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master.departments (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) NOT NULL,
    org_id VARCHAR(36),
    parent_id VARCHAR(36),
    head_id VARCHAR(36),
    is_active BOOLEAN DEFAULT true,
    tenant_id VARCHAR(36) NOT NULL,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master.locations (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) NOT NULL,
    type VARCHAR(50),
    address JSONB,
    geo JSONB,
    is_active BOOLEAN DEFAULT true,
    tenant_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master.currencies (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(10) UNIQUE NOT NULL,
    symbol VARCHAR(5),
    exchange_rate DECIMAL(18,6) DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    tenant_id VARCHAR(36) NOT NULL
);

CREATE TABLE IF NOT EXISTS master.uom (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    category VARCHAR(50),
    base_uom VARCHAR(20),
    conversion_factor DECIMAL(18,6) DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    tenant_id VARCHAR(36) NOT NULL
);

CREATE TABLE IF NOT EXISTS master.items (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    category VARCHAR(100),
    type VARCHAR(50),
    uom_id VARCHAR(36),
    description TEXT,
    specs JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    tenant_id VARCHAR(36) NOT NULL
);

CREATE TABLE IF NOT EXISTS master.vendors (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(50),
    contact JSONB,
    address JSONB,
    payment_terms VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    tenant_id VARCHAR(36) NOT NULL
);

CREATE TABLE IF NOT EXISTS master.customers (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(50),
    contact JSONB,
    address JSONB,
    credit_limit DECIMAL(18,2),
    payment_terms VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    tenant_id VARCHAR(36) NOT NULL
);

-- 9. INVENTORY SCHEMA
CREATE TABLE IF NOT EXISTS inventory.stock (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    item_id VARCHAR(36) NOT NULL,
    location_id VARCHAR(36),
    warehouse_id VARCHAR(36),
    batch_no VARCHAR(50),
    serial_no VARCHAR(50),
    qty DECIMAL(18,4) DEFAULT 0,
    reserved_qty DECIMAL(18,4) DEFAULT 0,
    uom VARCHAR(20),
    unit_cost DECIMAL(18,4),
    tenant_id VARCHAR(36) NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory.movements (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    item_id VARCHAR(36) NOT NULL,
    from_location VARCHAR(36),
    to_location VARCHAR(36),
    qty DECIMAL(18,4) NOT NULL,
    type VARCHAR(50) NOT NULL,
    reference_type VARCHAR(50),
    reference_id VARCHAR(36),
    batch_no VARCHAR(50),
    remarks TEXT,
    tenant_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 10. PROCUREMENT SCHEMA
CREATE TABLE IF NOT EXISTS procurement.purchase_requests (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    doc_no VARCHAR(50) UNIQUE NOT NULL,
    date DATE NOT NULL,
    requester_id VARCHAR(36),
    department_id VARCHAR(36),
    priority VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(20) DEFAULT 'draft',
    lines JSONB,
    remarks TEXT,
    tenant_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS procurement.purchase_orders (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    doc_no VARCHAR(50) UNIQUE NOT NULL,
    date DATE NOT NULL,
    vendor_id VARCHAR(36) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    lines JSONB,
    subtotal DECIMAL(18,2),
    tax DECIMAL(18,2),
    total DECIMAL(18,2),
    currency VARCHAR(10) DEFAULT 'INR',
    tenant_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 11. FINANCE SCHEMA
CREATE TABLE IF NOT EXISTS finance.accounts (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL,
    parent_id VARCHAR(36),
    currency VARCHAR(10) DEFAULT 'INR',
    is_active BOOLEAN DEFAULT true,
    tenant_id VARCHAR(36) NOT NULL
);

CREATE TABLE IF NOT EXISTS finance.journal_entries (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    doc_no VARCHAR(50) UNIQUE NOT NULL,
    date DATE NOT NULL,
    type VARCHAR(50),
    narration TEXT,
    status VARCHAR(20) DEFAULT 'draft',
    lines JSONB,
    total_debit DECIMAL(18,2),
    total_credit DECIMAL(18,2),
    tenant_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance.invoices (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    doc_no VARCHAR(50) UNIQUE NOT NULL,
    date DATE NOT NULL,
    type VARCHAR(20) NOT NULL,
    party_id VARCHAR(36),
    status VARCHAR(20) DEFAULT 'draft',
    lines JSONB,
    subtotal DECIMAL(18,2),
    tax DECIMAL(18,2),
    total DECIMAL(18,2),
    balance DECIMAL(18,2),
    tenant_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 12. HR SCHEMA
CREATE TABLE IF NOT EXISTS hr.employees (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    emp_code VARCHAR(50) UNIQUE NOT NULL,
    user_id VARCHAR(36),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    email VARCHAR(200),
    phone VARCHAR(20),
    department_id VARCHAR(36),
    designation VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    tenant_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr.attendance (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    employee_id VARCHAR(36) REFERENCES hr.employees(id),
    date DATE NOT NULL,
    check_in TIMESTAMP,
    check_out TIMESTAMP,
    status VARCHAR(20) DEFAULT 'present',
    tenant_id VARCHAR(36) NOT NULL
);

CREATE TABLE IF NOT EXISTS hr.leave_requests (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    employee_id VARCHAR(36) REFERENCES hr.employees(id),
    type VARCHAR(50) NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    tenant_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 13. PROJECT SCHEMA
CREATE TABLE IF NOT EXISTS project.projects (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    manager_id VARCHAR(36),
    status VARCHAR(20) DEFAULT 'planning',
    budget DECIMAL(18,2),
    tenant_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project.tasks (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    project_id VARCHAR(36) REFERENCES project.projects(id),
    name VARCHAR(200) NOT NULL,
    assignee_id VARCHAR(36),
    status VARCHAR(20) DEFAULT 'todo',
    due_date DATE,
    tenant_id VARCHAR(36) NOT NULL
);

-- 14. SEED INITIAL DATA (TENANT & SUPER ADMIN)
INSERT INTO iam.tenants (id, name, code, is_active)
VALUES ('tenant-ss-001', 'SUPERSYSTEMS', 'SS', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.super_admins (id, email, password_hash, name, is_active, created_at)
VALUES (
    'sa-admin-001',
    'admin@supersystems.in',
    '$2b$12$GQ2hVpGh3hxENo0acUnfH.RzQtGqsqucfsdrwb0PXqGGU9eQTlVye',
    'Super Admin',
    true,
    NOW()
)
ON CONFLICT (email) DO UPDATE 
SET password_hash = '$2b$12$GQ2hVpGh3hxENo0acUnfH.RzQtGqsqucfsdrwb0PXqGGU9eQTlVye',
    is_active = true;

-- ============================================================================
-- FULL SCHEMA CREATION COMPLETED SUCCESSFULLY
-- ============================================================================
