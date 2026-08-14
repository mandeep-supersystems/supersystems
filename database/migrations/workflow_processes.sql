-- Process Master table
CREATE TABLE IF NOT EXISTS workflow.processes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_code        VARCHAR(50) NOT NULL,
    process_name        VARCHAR(200) NOT NULL,
    description         TEXT,
    tenant_id           VARCHAR(100),
    created_by          VARCHAR(200),
    is_deleted          BOOLEAN DEFAULT false,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Process → Machine assignments
CREATE TABLE IF NOT EXISTS workflow.process_machines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_id          UUID NOT NULL REFERENCES workflow.processes(id) ON DELETE CASCADE,
    machine_id          UUID NOT NULL,
    cycle_time_minutes  NUMERIC(10,4) DEFAULT 0,
    is_preferred        BOOLEAN DEFAULT false,
    is_deleted          BOOLEAN DEFAULT false,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processes_tenant ON workflow.processes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_process_machines_process ON workflow.process_machines(process_id);
