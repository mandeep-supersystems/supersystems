-- Part Code Scheme (category, sub_category, series, sub_cat_series)
CREATE TABLE part.code_schemes (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    sub_category VARCHAR(100),
    category_series VARCHAR(20),
    sub_category_series VARCHAR(20),
    prefix VARCHAR(20),
    suffix VARCHAR(20),
    separator VARCHAR(5) DEFAULT '-',
    sequence_length INTEGER DEFAULT 4,
    current_sequence INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    tenant_id VARCHAR(36) NOT NULL,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(36),
    updated_by VARCHAR(36)
);

-- Part Master
CREATE TABLE part.masters (
    id VARCHAR(36) PRIMARY KEY,
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

CREATE INDEX idx_part_masters_part_number ON part.masters(part_number);
CREATE INDEX idx_part_masters_tenant ON part.masters(tenant_id);
CREATE INDEX idx_part_code_schemes_tenant ON part.code_schemes(tenant_id);
