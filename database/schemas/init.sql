-- SUPERSYSTEMS Platform - PostgreSQL Database Architecture
-- Database: SUPERSYSTEM
-- User: postgres
-- Password: Rewari@123
-- Enterprise Database Schema

-- ============================================
-- SCHEMAS
-- ============================================
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS master_data;
CREATE SCHEMA IF NOT EXISTS inventory;
CREATE SCHEMA IF NOT EXISTS procurement;
CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS hr;
CREATE SCHEMA IF NOT EXISTS manufacturing;
CREATE SCHEMA IF NOT EXISTS quality;
CREATE SCHEMA IF NOT EXISTS warehouse;
CREATE SCHEMA IF NOT EXISTS maintenance;
CREATE SCHEMA IF NOT EXISTS projects;
CREATE SCHEMA IF NOT EXISTS logistics;
CREATE SCHEMA IF NOT EXISTS customer_service;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS treasury;
CREATE SCHEMA IF NOT EXISTS assets;
CREATE SCHEMA IF NOT EXISTS governance;
CREATE SCHEMA IF NOT EXISTS plm;
CREATE SCHEMA IF NOT EXISTS suppliers;
CREATE SCHEMA IF NOT EXISTS ehs;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS integrations;

-- ============================================
-- DOMAINS (Custom Types)
-- ============================================
CREATE DOMAIN email_type AS VARCHAR(200) CHECK (VALUE ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
CREATE DOMAIN phone_type AS VARCHAR(20) CHECK (VALUE ~* '^\+?[0-9\-\s()]+$');
CREATE DOMAIN currency_code_type AS VARCHAR(3) CHECK (LENGTH(VALUE) = 3);
CREATE DOMAIN percentage_type AS NUMERIC(5,2) CHECK (VALUE >= 0 AND VALUE <= 100);
CREATE DOMAIN positive_amount AS NUMERIC(18,2) CHECK (VALUE >= 0);

-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ============================================
-- CORE TABLES
-- ============================================

-- Tenants
CREATE TABLE core.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    domain VARCHAR(200),
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Users
CREATE TABLE core.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id),
    email VARCHAR(200) UNIQUE NOT NULL,
    password_hash VARCHAR(256) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    is_locked BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP,
    failed_attempts INTEGER DEFAULT 0,
    attributes JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    version INTEGER DEFAULT 1
);

CREATE INDEX idx_users_tenant ON core.users(tenant_id);
CREATE INDEX idx_users_email ON core.users(email);

-- Roles
CREATE TABLE core.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Permissions
CREATE TABLE core.permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    module VARCHAR(50),
    action VARCHAR(50),
    resource VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

-- User Roles
CREATE TABLE core.user_roles (
    user_id UUID REFERENCES core.users(id),
    role_id UUID REFERENCES core.roles(id),
    PRIMARY KEY (user_id, role_id)
);

-- Role Permissions
CREATE TABLE core.role_permissions (
    role_id UUID REFERENCES core.roles(id),
    permission_id UUID REFERENCES core.permissions(id),
    PRIMARY KEY (role_id, permission_id)
);

-- Audit Logs (Partitioned by month)
CREATE TABLE audit.logs (
    id UUID DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    module VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    user_id UUID NOT NULL,
    user_email VARCHAR(200),
    ip_address VARCHAR(50),
    old_values JSONB,
    new_values JSONB,
    changes JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for current and next year
CREATE TABLE audit.logs_2025 PARTITION OF audit.logs
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE audit.logs_2026 PARTITION OF audit.logs
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE INDEX idx_audit_tenant ON audit.logs(tenant_id, created_at);
CREATE INDEX idx_audit_entity ON audit.logs(entity_type, entity_id);

-- ============================================
-- MASTER DATA TABLES
-- ============================================

CREATE TABLE master_data.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name VARCHAR(300) NOT NULL,
    code VARCHAR(50) NOT NULL,
    type VARCHAR(50),
    parent_id UUID REFERENCES master_data.organizations(id),
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    version INTEGER DEFAULT 1
);

CREATE TABLE master_data.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name VARCHAR(300) NOT NULL,
    code VARCHAR(50) NOT NULL,
    organization_id UUID REFERENCES master_data.organizations(id),
    legal_name VARCHAR(500),
    tax_id VARCHAR(50),
    currency_code VARCHAR(10),
    country_code VARCHAR(10),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE master_data.plants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name VARCHAR(300) NOT NULL,
    code VARCHAR(50) NOT NULL,
    company_id UUID REFERENCES master_data.companies(id),
    address JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE master_data.materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name VARCHAR(300) NOT NULL,
    code VARCHAR(50) NOT NULL,
    type VARCHAR(50),
    category VARCHAR(100),
    uom VARCHAR(20),
    hsn_code VARCHAR(20),
    description TEXT,
    specifications JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_materials_tenant ON master_data.materials(tenant_id);
CREATE INDEX idx_materials_code ON master_data.materials(code);

-- ============================================
-- INDEXING STANDARDS
-- ============================================
-- All tables follow: idx_{table}_{column(s)}
-- Composite indexes for common query patterns
-- GIN indexes for JSONB columns
-- Partial indexes for soft-deleted records

-- ============================================
-- DATA RETENTION & ARCHIVING
-- ============================================
-- Active data: Current schema
-- Archive: After 2 years, move to archive schema
-- Purge: After 7 years (configurable per tenant)

-- ============================================
-- BACKUP STRATEGY
-- ============================================
-- Full backup: Daily at 2 AM UTC
-- Incremental: Every 6 hours
-- WAL archiving: Continuous
-- Retention: 30 days local, 1 year S3
-- Point-in-time recovery: Enabled
