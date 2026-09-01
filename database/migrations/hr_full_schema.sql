-- ============================================================
-- HR FULL SCHEMA MIGRATION
-- Safe: uses CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS
-- No existing data is touched or deleted
-- ============================================================

-- ─── DEPARTMENTS ───
CREATE TABLE IF NOT EXISTS hr.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50),
    parent_id UUID,
    head_employee_id UUID,
    tenant_id VARCHAR(100),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DOCUMENT VAULT ───
CREATE TABLE IF NOT EXISTS hr.employee_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL,
    doc_type VARCHAR(100) NOT NULL,  -- offer_letter, id_proof, certificate, visa, etc.
    doc_name VARCHAR(300) NOT NULL,
    file_path VARCHAR(500),
    expiry_date DATE,
    is_expired BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'active',
    uploaded_by VARCHAR(200),
    tenant_id VARCHAR(100),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PROFILE EDIT APPROVAL REQUESTS ───
CREATE TABLE IF NOT EXISTS hr.profile_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending',  -- pending, approved, rejected
    reviewed_by VARCHAR(200),
    reviewed_at TIMESTAMPTZ,
    tenant_id VARCHAR(100),
    created_by VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SHIFTS ───
CREATE TABLE IF NOT EXISTS hr.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_minutes INTEGER DEFAULT 30,
    is_night_shift BOOLEAN DEFAULT FALSE,
    tenant_id VARCHAR(100),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SHIFT ROSTER ───
CREATE TABLE IF NOT EXISTS hr.shift_roster (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL,
    shift_id UUID NOT NULL,
    roster_date DATE NOT NULL,
    tenant_id VARCHAR(100),
    created_by VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ATTENDANCE (extend existing if needed) ───
CREATE TABLE IF NOT EXISTS hr.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL,
    date DATE NOT NULL,
    check_in TIMESTAMPTZ,
    check_out TIMESTAMPTZ,
    hours_worked NUMERIC(5,2),
    shift_id UUID,
    check_in_method VARCHAR(50) DEFAULT 'web',  -- web, biometric, geo
    check_in_location JSONB,
    status VARCHAR(50) DEFAULT 'present',  -- present, absent, half_day, holiday, leave
    remarks TEXT,
    tenant_id VARCHAR(100),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── REGULARIZATION REQUESTS ───
CREATE TABLE IF NOT EXISTS hr.regularization_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL,
    attendance_date DATE NOT NULL,
    requested_check_in TIMESTAMPTZ,
    requested_check_out TIMESTAMPTZ,
    reason TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    approved_by VARCHAR(200),
    approved_at TIMESTAMPTZ,
    tenant_id VARCHAR(100),
    created_by VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── LEAVE TYPES ───
CREATE TABLE IF NOT EXISTS hr.leave_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) NOT NULL,
    accrual_type VARCHAR(50) DEFAULT 'manual',  -- manual, monthly, yearly
    days_per_year NUMERIC(5,2) DEFAULT 0,
    carry_forward BOOLEAN DEFAULT FALSE,
    max_carry_forward NUMERIC(5,2) DEFAULT 0,
    is_paid BOOLEAN DEFAULT TRUE,
    applicable_gender VARCHAR(20) DEFAULT 'all',
    tenant_id VARCHAR(100),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── LEAVE BALANCES ───
CREATE TABLE IF NOT EXISTS hr.leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL,
    leave_type_id UUID NOT NULL,
    year INTEGER NOT NULL,
    total_days NUMERIC(5,2) DEFAULT 0,
    used_days NUMERIC(5,2) DEFAULT 0,
    pending_days NUMERIC(5,2) DEFAULT 0,
    balance_days NUMERIC(5,2) DEFAULT 0,
    tenant_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── LEAVE REQUESTS ───
CREATE TABLE IF NOT EXISTS hr.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL,
    leave_type_id UUID,
    leave_type VARCHAR(50),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days NUMERIC(5,2),
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    approved_by VARCHAR(200),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    tenant_id VARCHAR(100),
    created_by VARCHAR(200),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── HOLIDAY CALENDAR ───
CREATE TABLE IF NOT EXISTS hr.holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    date DATE NOT NULL,
    holiday_type VARCHAR(50) DEFAULT 'national',  -- national, optional, restricted
    location VARCHAR(200),
    year INTEGER,
    tenant_id VARCHAR(100),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SALARY STRUCTURES ───
CREATE TABLE IF NOT EXISTS hr.salary_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    components JSONB DEFAULT '[]',
    -- components: [{name, type(earning/deduction), calc_type(fixed/percent), value, basis}]
    is_active BOOLEAN DEFAULT TRUE,
    tenant_id VARCHAR(100),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── EMPLOYEE SALARY ASSIGNMENT ───
CREATE TABLE IF NOT EXISTS hr.employee_salaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL,
    salary_structure_id UUID,
    ctc NUMERIC(18,2),
    basic NUMERIC(18,2),
    hra NUMERIC(18,2),
    special_allowance NUMERIC(18,2),
    other_allowances JSONB DEFAULT '{}',
    pf_applicable BOOLEAN DEFAULT TRUE,
    esi_applicable BOOLEAN DEFAULT TRUE,
    pt_applicable BOOLEAN DEFAULT TRUE,
    tax_regime VARCHAR(20) DEFAULT 'new',  -- old, new
    effective_from DATE,
    tenant_id VARCHAR(100),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PAYROLL RUNS ───
CREATE TABLE IF NOT EXISTS hr.payroll_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',  -- draft, processing, finalized, paid
    total_employees INTEGER DEFAULT 0,
    total_gross NUMERIC(18,2) DEFAULT 0,
    total_deductions NUMERIC(18,2) DEFAULT 0,
    total_net NUMERIC(18,2) DEFAULT 0,
    finalized_by VARCHAR(200),
    finalized_at TIMESTAMPTZ,
    tenant_id VARCHAR(100),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PAYSLIPS (immutable once finalized) ───
CREATE TABLE IF NOT EXISTS hr.payslips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_run_id UUID,
    employee_id UUID NOT NULL,
    emp_code VARCHAR(100),
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    basic NUMERIC(18,2) DEFAULT 0,
    hra NUMERIC(18,2) DEFAULT 0,
    special_allowance NUMERIC(18,2) DEFAULT 0,
    other_earnings JSONB DEFAULT '{}',
    gross_salary NUMERIC(18,2) DEFAULT 0,
    pf_employee NUMERIC(18,2) DEFAULT 0,
    pf_employer NUMERIC(18,2) DEFAULT 0,
    eps_employer NUMERIC(18,2) DEFAULT 0,
    esi_employee NUMERIC(18,2) DEFAULT 0,
    esi_employer NUMERIC(18,2) DEFAULT 0,
    tds NUMERIC(18,2) DEFAULT 0,
    professional_tax NUMERIC(18,2) DEFAULT 0,
    lop_days NUMERIC(5,2) DEFAULT 0,
    lop_amount NUMERIC(18,2) DEFAULT 0,
    other_deductions JSONB DEFAULT '{}',
    total_deductions NUMERIC(18,2) DEFAULT 0,
    net_salary NUMERIC(18,2) DEFAULT 0,
    working_days INTEGER DEFAULT 0,
    present_days NUMERIC(5,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'draft',  -- draft, finalized (immutable after finalized)
    pdf_path VARCHAR(500),
    tenant_id VARCHAR(100),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PF CONTRIBUTIONS ───
CREATE TABLE IF NOT EXISTS hr.pf_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL,
    emp_code VARCHAR(100),
    uan_number VARCHAR(50),
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    pf_wage NUMERIC(18,2) DEFAULT 0,
    employee_contribution NUMERIC(18,2) DEFAULT 0,
    employer_epf NUMERIC(18,2) DEFAULT 0,
    employer_eps NUMERIC(18,2) DEFAULT 0,
    total_contribution NUMERIC(18,2) DEFAULT 0,
    tenant_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TDS / TAX DECLARATIONS ───
CREATE TABLE IF NOT EXISTS hr.tax_declarations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL,
    financial_year VARCHAR(10) NOT NULL,  -- e.g. 2024-25
    tax_regime VARCHAR(20) DEFAULT 'new',
    section_80c NUMERIC(18,2) DEFAULT 0,
    section_80d NUMERIC(18,2) DEFAULT 0,
    hra_exemption NUMERIC(18,2) DEFAULT 0,
    other_exemptions JSONB DEFAULT '{}',
    total_declared NUMERIC(18,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending',  -- pending, submitted, verified
    verified_by VARCHAR(200),
    verified_at TIMESTAMPTZ,
    tenant_id VARCHAR(100),
    created_by VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── JOB REQUISITIONS ───
CREATE TABLE IF NOT EXISTS hr.job_requisitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(300) NOT NULL,
    department_id UUID,
    department VARCHAR(200),
    vacancies INTEGER DEFAULT 1,
    employment_type VARCHAR(50) DEFAULT 'full_time',
    experience_min INTEGER DEFAULT 0,
    experience_max INTEGER DEFAULT 0,
    salary_min NUMERIC(18,2),
    salary_max NUMERIC(18,2),
    location VARCHAR(200),
    description TEXT,
    requirements JSONB DEFAULT '[]',
    status VARCHAR(50) DEFAULT 'open',  -- open, on_hold, closed, filled
    requested_by VARCHAR(200),
    approved_by VARCHAR(200),
    target_date DATE,
    tenant_id VARCHAR(100),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CANDIDATES ───
CREATE TABLE IF NOT EXISTS hr.candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id UUID,
    first_name VARCHAR(200) NOT NULL,
    last_name VARCHAR(200),
    email VARCHAR(300),
    phone VARCHAR(50),
    current_company VARCHAR(300),
    current_designation VARCHAR(300),
    experience_years NUMERIC(4,1),
    resume_path VARCHAR(500),
    source VARCHAR(100),  -- linkedin, referral, portal, walk-in
    stage VARCHAR(100) DEFAULT 'applied',  -- applied, screening, interview, offer, hired, rejected
    rating INTEGER,
    notes TEXT,
    tenant_id VARCHAR(100),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INTERVIEWS ───
CREATE TABLE IF NOT EXISTS hr.interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL,
    requisition_id UUID,
    interview_type VARCHAR(100) DEFAULT 'technical',  -- hr, technical, final
    scheduled_at TIMESTAMPTZ,
    interviewer VARCHAR(200),
    mode VARCHAR(50) DEFAULT 'in_person',  -- in_person, video, phone
    status VARCHAR(50) DEFAULT 'scheduled',  -- scheduled, completed, cancelled, no_show
    scorecard JSONB DEFAULT '{}',
    feedback TEXT,
    result VARCHAR(50),  -- pass, fail, hold
    tenant_id VARCHAR(100),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ONBOARDING TASKS ───
CREATE TABLE IF NOT EXISTS hr.onboarding_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL,
    task_name VARCHAR(300) NOT NULL,
    task_category VARCHAR(100),  -- documents, it_setup, training, admin
    due_date DATE,
    assigned_to VARCHAR(200),
    status VARCHAR(50) DEFAULT 'pending',  -- pending, in_progress, completed, skipped
    completed_at TIMESTAMPTZ,
    notes TEXT,
    phase VARCHAR(50) DEFAULT 'day1',  -- pre_boarding, day1, week1, month1
    tenant_id VARCHAR(100),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── EXIT REQUESTS ───
CREATE TABLE IF NOT EXISTS hr.exit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL,
    resignation_date DATE,
    last_working_date DATE,
    reason VARCHAR(200),
    reason_detail TEXT,
    status VARCHAR(50) DEFAULT 'initiated',  -- initiated, in_progress, completed
    exit_interview_done BOOLEAN DEFAULT FALSE,
    exit_interview_notes TEXT,
    clearances JSONB DEFAULT '{}',  -- {it: false, finance: false, admin: false}
    tenant_id VARCHAR(100),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PERFORMANCE GOALS ───
CREATE TABLE IF NOT EXISTS hr.performance_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    goal_type VARCHAR(50) DEFAULT 'kra',  -- kra, okr
    target_value VARCHAR(200),
    actual_value VARCHAR(200),
    weight NUMERIC(5,2) DEFAULT 0,
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'active',  -- active, completed, cancelled
    review_cycle_id UUID,
    tenant_id VARCHAR(100),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── REVIEW CYCLES ───
CREATE TABLE IF NOT EXISTS hr.review_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    cycle_type VARCHAR(50) DEFAULT 'annual',  -- annual, half_yearly, quarterly
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'active',
    tenant_id VARCHAR(100),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PERFORMANCE REVIEWS ───
CREATE TABLE IF NOT EXISTS hr.performance_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL,
    reviewer_id VARCHAR(200),
    review_cycle_id UUID,
    review_type VARCHAR(50) DEFAULT 'manager',  -- self, manager, peer, 360
    overall_rating NUMERIC(3,1),
    self_rating NUMERIC(3,1),
    manager_rating NUMERIC(3,1),
    feedback TEXT,
    strengths TEXT,
    improvements TEXT,
    status VARCHAR(50) DEFAULT 'pending',  -- pending, submitted, acknowledged
    submitted_at TIMESTAMPTZ,
    tenant_id VARCHAR(100),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TRAINING COURSES ───
CREATE TABLE IF NOT EXISTS hr.training_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(300) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    duration_hours NUMERIC(6,2),
    mode VARCHAR(50) DEFAULT 'online',  -- online, classroom, on_job
    is_mandatory BOOLEAN DEFAULT FALSE,
    certification_name VARCHAR(300),
    validity_months INTEGER,
    tenant_id VARCHAR(100),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TRAINING ASSIGNMENTS ───
CREATE TABLE IF NOT EXISTS hr.training_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    assigned_by VARCHAR(200),
    due_date DATE,
    completed_at TIMESTAMPTZ,
    score NUMERIC(5,2),
    certificate_path VARCHAR(500),
    cert_expiry_date DATE,
    status VARCHAR(50) DEFAULT 'assigned',  -- assigned, in_progress, completed, expired
    tenant_id VARCHAR(100),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── HR MODULE USERS ───
CREATE TABLE IF NOT EXISTS hr.module_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(200) NOT NULL,
    user_email VARCHAR(300),
    user_name VARCHAR(300),
    hr_role VARCHAR(100) DEFAULT 'employee',  -- hr_admin, hr_manager, manager, employee
    employee_id UUID,
    tenant_id VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_by VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INDEXES ───
CREATE INDEX IF NOT EXISTS idx_hr_attendance_emp_date ON hr.attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_emp ON hr.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_payslips_emp_period ON hr.payslips(employee_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_hr_pf_emp_period ON hr.pf_contributions(employee_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_hr_candidates_req ON hr.candidates(requisition_id);
CREATE INDEX IF NOT EXISTS idx_hr_onboarding_emp ON hr.onboarding_tasks(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_goals_emp ON hr.performance_goals(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_training_emp ON hr.training_assignments(employee_id);
