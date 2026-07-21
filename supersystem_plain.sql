--
-- PostgreSQL database dump
--

\restrict eLtKCqekCNLQf9KLoYUB7PUBx7iu1bbGQ2bQpIi3SXqY2vhDyeYTgEevhmuxheS

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: analytics; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA analytics;


ALTER SCHEMA analytics OWNER TO postgres;

--
-- Name: audit; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA audit;


ALTER SCHEMA audit OWNER TO postgres;

--
-- Name: finance; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA finance;


ALTER SCHEMA finance OWNER TO postgres;

--
-- Name: hr; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA hr;


ALTER SCHEMA hr OWNER TO postgres;

--
-- Name: iam; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA iam;


ALTER SCHEMA iam OWNER TO postgres;

--
-- Name: inventory; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA inventory;


ALTER SCHEMA inventory OWNER TO postgres;

--
-- Name: machine; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA machine;


ALTER SCHEMA machine OWNER TO postgres;

--
-- Name: manufacturing; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA manufacturing;


ALTER SCHEMA manufacturing OWNER TO postgres;

--
-- Name: master; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA master;


ALTER SCHEMA master OWNER TO postgres;

--
-- Name: part; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA part;


ALTER SCHEMA part OWNER TO postgres;

--
-- Name: procurement; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA procurement;


ALTER SCHEMA procurement OWNER TO postgres;

--
-- Name: project; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA project;


ALTER SCHEMA project OWNER TO postgres;

--
-- Name: quality; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA quality;


ALTER SCHEMA quality OWNER TO postgres;

--
-- Name: rawmaterial; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA rawmaterial;


ALTER SCHEMA rawmaterial OWNER TO postgres;

--
-- Name: supplier; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA supplier;


ALTER SCHEMA supplier OWNER TO postgres;

--
-- Name: warehouse; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA warehouse;


ALTER SCHEMA warehouse OWNER TO postgres;

--
-- Name: workflow; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA workflow;


ALTER SCHEMA workflow OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: dashboards; Type: TABLE; Schema: analytics; Owner: postgres
--

CREATE TABLE analytics.dashboards (
    id character varying(36) NOT NULL,
    name character varying(200) NOT NULL,
    code character varying(50) NOT NULL,
    layout jsonb,
    widgets jsonb,
    is_default boolean DEFAULT false,
    is_active boolean DEFAULT true,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36)
);


ALTER TABLE analytics.dashboards OWNER TO postgres;

--
-- Name: reports; Type: TABLE; Schema: analytics; Owner: postgres
--

CREATE TABLE analytics.reports (
    id character varying(36) NOT NULL,
    name character varying(200) NOT NULL,
    code character varying(50) NOT NULL,
    module character varying(50),
    type character varying(50),
    query text,
    parameters jsonb,
    schedule jsonb,
    is_active boolean DEFAULT true,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36)
);


ALTER TABLE analytics.reports OWNER TO postgres;

--
-- Name: login_history; Type: TABLE; Schema: audit; Owner: postgres
--

CREATE TABLE audit.login_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying(36) NOT NULL,
    email character varying(200),
    tenant_id character varying(100),
    login_at timestamp without time zone DEFAULT now(),
    ip_address character varying(50),
    user_agent character varying(500),
    login_type character varying(20) DEFAULT 'organization'::character varying,
    logout_at timestamp without time zone
);


ALTER TABLE audit.login_history OWNER TO postgres;

--
-- Name: logs; Type: TABLE; Schema: audit; Owner: postgres
--

CREATE TABLE audit.logs (
    id character varying(36) NOT NULL,
    user_id character varying(36),
    action character varying(50) NOT NULL,
    module character varying(50),
    entity_type character varying(100),
    entity_id character varying(36),
    old_values jsonb,
    new_values jsonb,
    ip_address character varying(50),
    user_agent character varying(500),
    extra_data jsonb,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    user_email character varying(255),
    user_name character varying(255)
);


ALTER TABLE audit.logs OWNER TO postgres;

--
-- Name: accounts; Type: TABLE; Schema: finance; Owner: postgres
--

CREATE TABLE finance.accounts (
    id character varying(36) NOT NULL,
    name character varying(200) NOT NULL,
    code character varying(50) NOT NULL,
    type character varying(50) NOT NULL,
    parent_id character varying(36),
    currency character varying(10) DEFAULT 'INR'::character varying,
    is_active boolean DEFAULT true,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE finance.accounts OWNER TO postgres;

--
-- Name: invoices; Type: TABLE; Schema: finance; Owner: postgres
--

CREATE TABLE finance.invoices (
    id character varying(36) NOT NULL,
    doc_no character varying(50) NOT NULL,
    date date NOT NULL,
    type character varying(20) NOT NULL,
    party_id character varying(36),
    party_type character varying(20),
    status character varying(20) DEFAULT 'draft'::character varying,
    lines jsonb,
    subtotal numeric(18,2),
    tax numeric(18,2),
    total numeric(18,2),
    paid numeric(18,2) DEFAULT 0,
    balance numeric(18,2),
    due_date date,
    currency character varying(10) DEFAULT 'INR'::character varying,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36),
    updated_by character varying(36)
);


ALTER TABLE finance.invoices OWNER TO postgres;

--
-- Name: journal_entries; Type: TABLE; Schema: finance; Owner: postgres
--

CREATE TABLE finance.journal_entries (
    id character varying(36) NOT NULL,
    doc_no character varying(50) NOT NULL,
    date date NOT NULL,
    type character varying(50),
    narration text,
    status character varying(20) DEFAULT 'draft'::character varying,
    lines jsonb,
    total_debit numeric(18,2),
    total_credit numeric(18,2),
    approved_by character varying(36),
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36),
    updated_by character varying(36)
);


ALTER TABLE finance.journal_entries OWNER TO postgres;

--
-- Name: payments; Type: TABLE; Schema: finance; Owner: postgres
--

CREATE TABLE finance.payments (
    id character varying(36) NOT NULL,
    doc_no character varying(50) NOT NULL,
    date date NOT NULL,
    type character varying(20),
    party_id character varying(36),
    party_type character varying(20),
    amount numeric(18,2) NOT NULL,
    method character varying(50),
    reference character varying(100),
    invoice_id character varying(36),
    status character varying(20) DEFAULT 'draft'::character varying,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36),
    updated_by character varying(36)
);


ALTER TABLE finance.payments OWNER TO postgres;

--
-- Name: attendance; Type: TABLE; Schema: hr; Owner: postgres
--

CREATE TABLE hr.attendance (
    id character varying(36) NOT NULL,
    employee_id character varying(36),
    date date NOT NULL,
    check_in timestamp without time zone,
    check_out timestamp without time zone,
    status character varying(20) DEFAULT 'present'::character varying,
    hours_worked numeric(5,2),
    remarks text,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE hr.attendance OWNER TO postgres;

--
-- Name: employee_code_criteria; Type: TABLE; Schema: hr; Owner: postgres
--

CREATE TABLE hr.employee_code_criteria (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(200) NOT NULL,
    prefix character varying(50) DEFAULT ''::character varying,
    prefix_separator character varying(5) DEFAULT ''::character varying,
    code_start integer DEFAULT 1 NOT NULL,
    current_sequence integer DEFAULT 0 NOT NULL,
    suffix_separator character varying(5) DEFAULT ''::character varying,
    suffix character varying(50) DEFAULT ''::character varying,
    tenant_id character varying(100) NOT NULL,
    is_active boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE hr.employee_code_criteria OWNER TO postgres;

--
-- Name: employees; Type: TABLE; Schema: hr; Owner: postgres
--

CREATE TABLE hr.employees (
    id character varying(36) NOT NULL,
    emp_code character varying(50) NOT NULL,
    user_id character varying(36),
    first_name character varying(100) NOT NULL,
    last_name character varying(100),
    email character varying(200),
    phone character varying(20),
    department_id character varying(36),
    designation character varying(100),
    manager_id character varying(36),
    date_of_joining date,
    date_of_birth date,
    gender character varying(10),
    status character varying(20) DEFAULT 'active'::character varying,
    address jsonb,
    bank_details jsonb,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36),
    updated_by character varying(36),
    blood_group character varying(10),
    marital_status character varying(30),
    nationality character varying(100) DEFAULT 'Indian'::character varying,
    emergency_contact_name character varying(200),
    emergency_contact_phone character varying(50),
    emergency_contact_relation character varying(100),
    employment_type character varying(50) DEFAULT 'full_time'::character varying,
    reporting_to character varying(200),
    work_location character varying(200),
    previous_experience jsonb DEFAULT '[]'::jsonb,
    qualifications jsonb DEFAULT '[]'::jsonb,
    pan_number character varying(50),
    aadhar_number character varying(50),
    uan_number character varying(50),
    esi_number character varying(50),
    code_criteria_id uuid
);


ALTER TABLE hr.employees OWNER TO postgres;

--
-- Name: leaves; Type: TABLE; Schema: hr; Owner: postgres
--

CREATE TABLE hr.leaves (
    id character varying(36) NOT NULL,
    employee_id character varying(36),
    type character varying(50) NOT NULL,
    from_date date NOT NULL,
    to_date date NOT NULL,
    days numeric(4,1),
    reason text,
    status character varying(20) DEFAULT 'pending'::character varying,
    approved_by character varying(36),
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE hr.leaves OWNER TO postgres;

--
-- Name: payroll; Type: TABLE; Schema: hr; Owner: postgres
--

CREATE TABLE hr.payroll (
    id character varying(36) NOT NULL,
    employee_id character varying(36),
    month character varying(7) NOT NULL,
    basic numeric(18,2),
    allowances jsonb,
    deductions jsonb,
    gross numeric(18,2),
    net numeric(18,2),
    status character varying(20) DEFAULT 'draft'::character varying,
    paid_at timestamp without time zone,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE hr.payroll OWNER TO postgres;

--
-- Name: module_access; Type: TABLE; Schema: iam; Owner: postgres
--

CREATE TABLE iam.module_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying(36) NOT NULL,
    module character varying(100) NOT NULL,
    role character varying(50) DEFAULT 'viewer'::character varying NOT NULL,
    permissions jsonb DEFAULT '[]'::jsonb,
    granted_by character varying(36),
    tenant_id character varying(36) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE iam.module_access OWNER TO postgres;

--
-- Name: module_roles; Type: TABLE; Schema: iam; Owner: postgres
--

CREATE TABLE iam.module_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(50) NOT NULL,
    module character varying(100) NOT NULL,
    permissions jsonb DEFAULT '{}'::jsonb,
    is_system boolean DEFAULT false,
    is_active boolean DEFAULT true,
    tenant_id character varying(100),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE iam.module_roles OWNER TO postgres;

--
-- Name: permissions; Type: TABLE; Schema: iam; Owner: postgres
--

CREATE TABLE iam.permissions (
    id character varying(36) NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(100) NOT NULL,
    module character varying(50),
    action character varying(50),
    resource character varying(100),
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE iam.permissions OWNER TO postgres;

--
-- Name: policies; Type: TABLE; Schema: iam; Owner: postgres
--

CREATE TABLE iam.policies (
    id character varying(36) NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    effect character varying(10) DEFAULT 'allow'::character varying,
    conditions jsonb NOT NULL,
    resource character varying(200),
    action character varying(50),
    priority integer DEFAULT 0,
    is_active boolean DEFAULT true,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE iam.policies OWNER TO postgres;

--
-- Name: role_permissions; Type: TABLE; Schema: iam; Owner: postgres
--

CREATE TABLE iam.role_permissions (
    role_id character varying(36) NOT NULL,
    permission_id character varying(36) NOT NULL
);


ALTER TABLE iam.role_permissions OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: iam; Owner: postgres
--

CREATE TABLE iam.roles (
    id character varying(36) NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    is_system boolean DEFAULT false,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36),
    updated_by character varying(36)
);


ALTER TABLE iam.roles OWNER TO postgres;

--
-- Name: sessions; Type: TABLE; Schema: iam; Owner: postgres
--

CREATE TABLE iam.sessions (
    id character varying(36) NOT NULL,
    user_id character varying(36),
    token character varying(500) NOT NULL,
    ip_address character varying(50),
    user_agent character varying(500),
    expires_at timestamp without time zone NOT NULL,
    is_active boolean DEFAULT true,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE iam.sessions OWNER TO postgres;

--
-- Name: tenants; Type: TABLE; Schema: iam; Owner: postgres
--

CREATE TABLE iam.tenants (
    id character varying(36) NOT NULL,
    name character varying(200) NOT NULL,
    code character varying(50) NOT NULL,
    domain character varying(200),
    is_active boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    deleted_by character varying(36),
    tenant_id character varying(36) NOT NULL,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36),
    updated_by character varying(36),
    pan character varying(20),
    gst character varying(20),
    cin character varying(25),
    email character varying(200),
    phone character varying(20),
    website character varying(200),
    address_line1 character varying(300),
    address_line2 character varying(300),
    city character varying(100),
    state character varying(100),
    pincode character varying(10),
    country character varying(100) DEFAULT 'India'::character varying,
    industry character varying(100),
    employee_count character varying(50),
    contact_person character varying(200),
    contact_designation character varying(100),
    contact_phone character varying(20),
    contact_email character varying(200)
);


ALTER TABLE iam.tenants OWNER TO postgres;

--
-- Name: user_roles; Type: TABLE; Schema: iam; Owner: postgres
--

CREATE TABLE iam.user_roles (
    user_id character varying(36) NOT NULL,
    role_id character varying(36) NOT NULL
);


ALTER TABLE iam.user_roles OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: iam; Owner: postgres
--

CREATE TABLE iam.users (
    id character varying(36) NOT NULL,
    email character varying(200) NOT NULL,
    password_hash character varying(256) NOT NULL,
    first_name character varying(100),
    last_name character varying(100),
    phone character varying(20),
    is_active boolean DEFAULT true,
    is_locked boolean DEFAULT false,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    deleted_by character varying(36),
    tenant_id character varying(36) NOT NULL,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36),
    updated_by character varying(36),
    last_login timestamp without time zone,
    failed_attempts integer DEFAULT 0,
    attributes jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE iam.users OWNER TO postgres;

--
-- Name: adjustments; Type: TABLE; Schema: inventory; Owner: postgres
--

CREATE TABLE inventory.adjustments (
    id character varying(36) NOT NULL,
    doc_no character varying(50) NOT NULL,
    date date NOT NULL,
    location_id character varying(36),
    reason character varying(200),
    status character varying(20) DEFAULT 'draft'::character varying,
    lines jsonb,
    approved_by character varying(36),
    approved_at timestamp without time zone,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36),
    updated_by character varying(36)
);


ALTER TABLE inventory.adjustments OWNER TO postgres;

--
-- Name: movements; Type: TABLE; Schema: inventory; Owner: postgres
--

CREATE TABLE inventory.movements (
    id character varying(36) NOT NULL,
    item_id character varying(36) NOT NULL,
    from_location character varying(36),
    to_location character varying(36),
    qty numeric(18,4) NOT NULL,
    type character varying(50) NOT NULL,
    reference_type character varying(50),
    reference_id character varying(36),
    batch_no character varying(50),
    remarks text,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    created_by character varying(36)
);


ALTER TABLE inventory.movements OWNER TO postgres;

--
-- Name: stock; Type: TABLE; Schema: inventory; Owner: postgres
--

CREATE TABLE inventory.stock (
    id character varying(36) NOT NULL,
    item_id character varying(36) NOT NULL,
    location_id character varying(36),
    warehouse_id character varying(36),
    batch_no character varying(50),
    serial_no character varying(50),
    qty numeric(18,4) DEFAULT 0,
    reserved_qty numeric(18,4) DEFAULT 0,
    uom character varying(20),
    unit_cost numeric(18,4),
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE inventory.stock OWNER TO postgres;

--
-- Name: efficiency; Type: TABLE; Schema: machine; Owner: postgres
--

CREATE TABLE machine.efficiency (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    machine_id uuid NOT NULL,
    period character varying(50) NOT NULL,
    availability_pct numeric(6,2) DEFAULT 100,
    performance_pct numeric(6,2) DEFAULT 100,
    quality_pct numeric(6,2) DEFAULT 100,
    oee_pct numeric(6,2),
    notes text DEFAULT ''::text,
    tenant_id character varying(100) DEFAULT ''::character varying,
    created_by character varying(200) DEFAULT ''::character varying,
    is_deleted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE machine.efficiency OWNER TO postgres;

--
-- Name: machines; Type: TABLE; Schema: machine; Owner: postgres
--

CREATE TABLE machine.machines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    machine_code character varying(50) NOT NULL,
    machine_name character varying(200) NOT NULL,
    machine_type character varying(100) DEFAULT ''::character varying,
    make character varying(100) DEFAULT ''::character varying,
    model character varying(100) DEFAULT ''::character varying,
    purchase_cost numeric(18,2) DEFAULT 0,
    buying_date date,
    vendor character varying(200) DEFAULT ''::character varying,
    invoice_ref character varying(100) DEFAULT ''::character varying,
    warranty_expiry date,
    amc_expiry date,
    depreciation_life_years numeric(6,2) DEFAULT 10,
    residual_value numeric(18,2) DEFAULT 0,
    installation_date date,
    current_status character varying(50) DEFAULT 'active'::character varying,
    plant character varying(100) DEFAULT ''::character varying,
    station_id uuid,
    rated_capacity numeric(12,2) DEFAULT 0,
    capacity_unit character varying(50) DEFAULT ''::character varying,
    power_rating_kw numeric(10,3) DEFAULT 0,
    max_hours_per_day numeric(6,2) DEFAULT 8,
    shifts_per_day numeric(4,1) DEFAULT 1,
    working_days_per_year integer DEFAULT 250,
    electricity_rate numeric(10,4) DEFAULT 0,
    annual_amc_cost numeric(18,2) DEFAULT 0,
    operator_cost_per_hour numeric(12,4) DEFAULT 0,
    overhead_percent numeric(6,2) DEFAULT 0,
    notes text DEFAULT ''::text,
    tenant_id character varying(100) DEFAULT ''::character varying,
    created_by character varying(200) DEFAULT ''::character varying,
    is_deleted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE machine.machines OWNER TO postgres;

--
-- Name: stations; Type: TABLE; Schema: machine; Owner: postgres
--

CREATE TABLE machine.stations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    station_code character varying(50) NOT NULL,
    station_name character varying(200) NOT NULL,
    plant character varying(100) DEFAULT ''::character varying,
    description text DEFAULT ''::text,
    tenant_id character varying(100) DEFAULT ''::character varying,
    created_by character varying(200) DEFAULT ''::character varying,
    is_deleted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE machine.stations OWNER TO postgres;

--
-- Name: bom; Type: TABLE; Schema: manufacturing; Owner: postgres
--

CREATE TABLE manufacturing.bom (
    id character varying(36) NOT NULL,
    name character varying(200) NOT NULL,
    code character varying(50) NOT NULL,
    product_id character varying(36) NOT NULL,
    version_no integer DEFAULT 1,
    status character varying(20) DEFAULT 'draft'::character varying,
    lines jsonb,
    routing jsonb,
    is_active boolean DEFAULT true,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36),
    updated_by character varying(36)
);


ALTER TABLE manufacturing.bom OWNER TO postgres;

--
-- Name: production_logs; Type: TABLE; Schema: manufacturing; Owner: postgres
--

CREATE TABLE manufacturing.production_logs (
    id character varying(36) NOT NULL,
    work_order_id character varying(36),
    date date NOT NULL,
    qty_produced numeric(18,4),
    qty_rejected numeric(18,4) DEFAULT 0,
    operator_id character varying(36),
    shift character varying(20),
    remarks text,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE manufacturing.production_logs OWNER TO postgres;

--
-- Name: work_orders; Type: TABLE; Schema: manufacturing; Owner: postgres
--

CREATE TABLE manufacturing.work_orders (
    id character varying(36) NOT NULL,
    doc_no character varying(50) NOT NULL,
    date date NOT NULL,
    product_id character varying(36) NOT NULL,
    bom_id character varying(36),
    qty numeric(18,4) NOT NULL,
    produced_qty numeric(18,4) DEFAULT 0,
    status character varying(20) DEFAULT 'planned'::character varying,
    priority character varying(20) DEFAULT 'normal'::character varying,
    start_date date,
    end_date date,
    work_center character varying(100),
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36),
    updated_by character varying(36)
);


ALTER TABLE manufacturing.work_orders OWNER TO postgres;

--
-- Name: currencies; Type: TABLE; Schema: master; Owner: postgres
--

CREATE TABLE master.currencies (
    id character varying(36) NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(10) NOT NULL,
    symbol character varying(5),
    exchange_rate numeric(18,6) DEFAULT 1,
    is_active boolean DEFAULT true,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE master.currencies OWNER TO postgres;

--
-- Name: customers; Type: TABLE; Schema: master; Owner: postgres
--

CREATE TABLE master.customers (
    id character varying(36) NOT NULL,
    name character varying(200) NOT NULL,
    code character varying(50) NOT NULL,
    type character varying(50),
    contact jsonb,
    address jsonb,
    credit_limit numeric(18,2),
    payment_terms character varying(100),
    is_active boolean DEFAULT true,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36),
    updated_by character varying(36)
);


ALTER TABLE master.customers OWNER TO postgres;

--
-- Name: departments; Type: TABLE; Schema: master; Owner: postgres
--

CREATE TABLE master.departments (
    id character varying(36) NOT NULL,
    name character varying(200) NOT NULL,
    code character varying(50) NOT NULL,
    org_id character varying(36),
    parent_id character varying(36),
    head_id character varying(36),
    is_active boolean DEFAULT true,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36),
    updated_by character varying(36)
);


ALTER TABLE master.departments OWNER TO postgres;

--
-- Name: items; Type: TABLE; Schema: master; Owner: postgres
--

CREATE TABLE master.items (
    id character varying(36) NOT NULL,
    name character varying(200) NOT NULL,
    code character varying(50) NOT NULL,
    category character varying(100),
    type character varying(50),
    uom_id character varying(36),
    description text,
    specs jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36),
    updated_by character varying(36)
);


ALTER TABLE master.items OWNER TO postgres;

--
-- Name: locations; Type: TABLE; Schema: master; Owner: postgres
--

CREATE TABLE master.locations (
    id character varying(36) NOT NULL,
    name character varying(200) NOT NULL,
    code character varying(50) NOT NULL,
    type character varying(50),
    address jsonb,
    geo jsonb,
    is_active boolean DEFAULT true,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36),
    updated_by character varying(36)
);


ALTER TABLE master.locations OWNER TO postgres;

--
-- Name: organizations; Type: TABLE; Schema: master; Owner: postgres
--

CREATE TABLE master.organizations (
    id character varying(36) NOT NULL,
    name character varying(200) NOT NULL,
    code character varying(50) NOT NULL,
    type character varying(50),
    parent_id character varying(36),
    address jsonb,
    contact jsonb,
    settings jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36),
    updated_by character varying(36)
);


ALTER TABLE master.organizations OWNER TO postgres;

--
-- Name: uom; Type: TABLE; Schema: master; Owner: postgres
--

CREATE TABLE master.uom (
    id character varying(36) NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20) NOT NULL,
    category character varying(50),
    base_uom character varying(20),
    conversion_factor numeric(18,6) DEFAULT 1,
    is_active boolean DEFAULT true,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE master.uom OWNER TO postgres;

--
-- Name: vendors; Type: TABLE; Schema: master; Owner: postgres
--

CREATE TABLE master.vendors (
    id character varying(36) NOT NULL,
    name character varying(200) NOT NULL,
    code character varying(50) NOT NULL,
    type character varying(50),
    contact jsonb,
    address jsonb,
    payment_terms character varying(100),
    is_active boolean DEFAULT true,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36),
    updated_by character varying(36)
);


ALTER TABLE master.vendors OWNER TO postgres;

--
-- Name: approval_workflows; Type: TABLE; Schema: part; Owner: postgres
--

CREATE TABLE part.approval_workflows (
    id character varying(36) NOT NULL,
    name character varying(200) NOT NULL,
    trigger_event character varying(100) NOT NULL,
    steps jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(36) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    part_type character varying(30) DEFAULT 'bought_out'::character varying
);


ALTER TABLE part.approval_workflows OWNER TO postgres;

--
-- Name: categories; Type: TABLE; Schema: part; Owner: postgres
--

CREATE TABLE part.categories (
    id character varying(36) NOT NULL,
    name character varying(200) NOT NULL,
    code character varying(50) NOT NULL,
    series_prefix character varying(20),
    description text,
    is_active boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(36) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    separator character varying(1) DEFAULT '-'::character varying
);


ALTER TABLE part.categories OWNER TO postgres;

--
-- Name: code_schemes; Type: TABLE; Schema: part; Owner: postgres
--

CREATE TABLE part.code_schemes (
    id character varying(36) NOT NULL,
    name character varying(200) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    category character varying(100) NOT NULL,
    sub_category character varying(100),
    category_series character varying(20),
    sub_category_series character varying(20),
    prefix character varying(20),
    suffix character varying(20),
    separator character varying(5) DEFAULT '-'::character varying,
    sequence_length integer DEFAULT 4,
    current_sequence integer DEFAULT 0,
    is_active boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(36) NOT NULL,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36),
    updated_by character varying(36),
    part_type character varying(30) DEFAULT 'bought_out'::character varying
);


ALTER TABLE part.code_schemes OWNER TO postgres;

--
-- Name: customer_mappings; Type: TABLE; Schema: part; Owner: postgres
--

CREATE TABLE part.customer_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    internal_part_number character varying(100) NOT NULL,
    internal_description text,
    customer_part_number character varying(100) NOT NULL,
    customer_description text,
    organization_id character varying(100),
    organization_name character varying(200),
    tenant_id character varying(100),
    is_deleted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(200)
);


ALTER TABLE part.customer_mappings OWNER TO postgres;

--
-- Name: electrical_parts_motors_EP_EP-MT; Type: TABLE; Schema: part; Owner: postgres
--

CREATE TABLE part."electrical_parts_motors_EP_EP-MT" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    part_number character varying(50) NOT NULL,
    description text DEFAULT ''::text,
    created_by character varying(200) DEFAULT ''::character varying,
    status character varying(20) DEFAULT 'active'::character varying,
    obsoleted_at timestamp without time zone,
    obsolete_reason text,
    created_at timestamp without time zone DEFAULT now(),
    material character varying(500),
    size character varying(500),
    part_type character varying(30) DEFAULT 'bought_out'::character varying
);


ALTER TABLE part."electrical_parts_motors_EP_EP-MT" OWNER TO postgres;

--
-- Name: electrical_parts_sensors_EP_EP-SN; Type: TABLE; Schema: part; Owner: postgres
--

CREATE TABLE part."electrical_parts_sensors_EP_EP-SN" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    part_number character varying(50) NOT NULL,
    description text DEFAULT ''::text,
    created_by character varying(200) DEFAULT ''::character varying,
    status character varying(20) DEFAULT 'active'::character varying,
    obsoleted_at timestamp without time zone,
    obsolete_reason text,
    created_at timestamp without time zone DEFAULT now(),
    material character varying(500),
    size character varying(500),
    part_type character varying(30) DEFAULT 'bought_out'::character varying
);


ALTER TABLE part."electrical_parts_sensors_EP_EP-SN" OWNER TO postgres;

--
-- Name: fasteners_hex_bolts_FP_FP-HB; Type: TABLE; Schema: part; Owner: postgres
--

CREATE TABLE part."fasteners_hex_bolts_FP_FP-HB" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    part_number character varying(50) NOT NULL,
    description text DEFAULT ''::text,
    created_by character varying(200) DEFAULT ''::character varying,
    status character varying(20) DEFAULT 'active'::character varying,
    obsoleted_at timestamp without time zone,
    obsolete_reason text,
    created_at timestamp without time zone DEFAULT now(),
    material character varying(500),
    size character varying(500),
    part_type character varying(30) DEFAULT 'bought_out'::character varying
);


ALTER TABLE part."fasteners_hex_bolts_FP_FP-HB" OWNER TO postgres;

--
-- Name: fasteners_lock_nuts_FP_FP-LN; Type: TABLE; Schema: part; Owner: postgres
--

CREATE TABLE part."fasteners_lock_nuts_FP_FP-LN" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    part_number character varying(50) NOT NULL,
    description text DEFAULT ''::text,
    created_by character varying(200) DEFAULT ''::character varying,
    status character varying(20) DEFAULT 'active'::character varying,
    obsoleted_at timestamp without time zone,
    obsolete_reason text,
    created_at timestamp without time zone DEFAULT now(),
    material character varying(500),
    size character varying(500),
    part_type character varying(30) DEFAULT 'bought_out'::character varying
);


ALTER TABLE part."fasteners_lock_nuts_FP_FP-LN" OWNER TO postgres;

--
-- Name: hydraulic_parts_cylinders_HP_HP-CY; Type: TABLE; Schema: part; Owner: postgres
--

CREATE TABLE part."hydraulic_parts_cylinders_HP_HP-CY" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    part_number character varying(50) NOT NULL,
    description text DEFAULT ''::text,
    created_by character varying(200) DEFAULT ''::character varying,
    status character varying(20) DEFAULT 'active'::character varying,
    obsoleted_at timestamp without time zone,
    obsolete_reason text,
    created_at timestamp without time zone DEFAULT now(),
    material character varying(500),
    size character varying(500),
    part_type character varying(30) DEFAULT 'bought_out'::character varying
);


ALTER TABLE part."hydraulic_parts_cylinders_HP_HP-CY" OWNER TO postgres;

--
-- Name: hydraulic_parts_pumps_HP_HP-PM; Type: TABLE; Schema: part; Owner: postgres
--

CREATE TABLE part."hydraulic_parts_pumps_HP_HP-PM" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    part_number character varying(50) NOT NULL,
    description text DEFAULT ''::text,
    created_by character varying(200) DEFAULT ''::character varying,
    status character varying(20) DEFAULT 'active'::character varying,
    obsoleted_at timestamp without time zone,
    obsolete_reason text,
    created_at timestamp without time zone DEFAULT now(),
    material character varying(500),
    size character varying(500),
    part_type character varying(30) DEFAULT 'bought_out'::character varying
);


ALTER TABLE part."hydraulic_parts_pumps_HP_HP-PM" OWNER TO postgres;

--
-- Name: masters; Type: TABLE; Schema: part; Owner: postgres
--

CREATE TABLE part.masters (
    id character varying(36) NOT NULL,
    part_number character varying(100) NOT NULL,
    name character varying(300) NOT NULL,
    description text,
    code_scheme_id character varying(36),
    category character varying(100),
    sub_category character varying(100),
    uom character varying(50),
    material_type character varying(50),
    weight numeric(12,4),
    weight_unit character varying(20),
    dimensions character varying(200),
    drawing_number character varying(100),
    revision character varying(20) DEFAULT 'A'::character varying,
    status character varying(30) DEFAULT 'Draft'::character varying,
    is_active boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(36) NOT NULL,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36),
    updated_by character varying(36),
    part_type character varying(30) DEFAULT 'bought_out'::character varying
);


ALTER TABLE part.masters OWNER TO postgres;

--
-- Name: mechanical_parts_bearings_MP_MP-BR; Type: TABLE; Schema: part; Owner: postgres
--

CREATE TABLE part."mechanical_parts_bearings_MP_MP-BR" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    part_number character varying(50) NOT NULL,
    description text DEFAULT ''::text,
    created_by character varying(200) DEFAULT ''::character varying,
    status character varying(20) DEFAULT 'active'::character varying,
    obsoleted_at timestamp without time zone,
    obsolete_reason text,
    created_at timestamp without time zone DEFAULT now(),
    material character varying(500),
    size character varying(500),
    part_type character varying(30) DEFAULT 'bought_out'::character varying
);


ALTER TABLE part."mechanical_parts_bearings_MP_MP-BR" OWNER TO postgres;

--
-- Name: mechanical_parts_gears_MP_MP-GR; Type: TABLE; Schema: part; Owner: postgres
--

CREATE TABLE part."mechanical_parts_gears_MP_MP-GR" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    part_number character varying(50) NOT NULL,
    description text DEFAULT ''::text,
    created_by character varying(200) DEFAULT ''::character varying,
    status character varying(20) DEFAULT 'active'::character varying,
    obsoleted_at timestamp without time zone,
    obsolete_reason text,
    created_at timestamp without time zone DEFAULT now(),
    material character varying(500),
    size character varying(500),
    part_type character varying(30) DEFAULT 'bought_out'::character varying
);


ALTER TABLE part."mechanical_parts_gears_MP_MP-GR" OWNER TO postgres;

--
-- Name: mechanical_parts_shafts_MP_MP-SH; Type: TABLE; Schema: part; Owner: postgres
--

CREATE TABLE part."mechanical_parts_shafts_MP_MP-SH" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    part_number character varying(50) NOT NULL,
    description text DEFAULT ''::text,
    created_by character varying(200) DEFAULT ''::character varying,
    status character varying(20) DEFAULT 'active'::character varying,
    obsoleted_at timestamp without time zone,
    obsolete_reason text,
    created_at timestamp without time zone DEFAULT now(),
    material character varying(500),
    size character varying(500),
    part_type character varying(30) DEFAULT 'bought_out'::character varying
);


ALTER TABLE part."mechanical_parts_shafts_MP_MP-SH" OWNER TO postgres;

--
-- Name: pneumatic_parts_actuators_PP_PP-AC; Type: TABLE; Schema: part; Owner: postgres
--

CREATE TABLE part."pneumatic_parts_actuators_PP_PP-AC" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    part_number character varying(50) NOT NULL,
    description text DEFAULT ''::text,
    created_by character varying(200) DEFAULT ''::character varying,
    status character varying(20) DEFAULT 'active'::character varying,
    obsoleted_at timestamp without time zone,
    obsolete_reason text,
    created_at timestamp without time zone DEFAULT now(),
    material character varying(500),
    size character varying(500),
    part_type character varying(30) DEFAULT 'bought_out'::character varying
);


ALTER TABLE part."pneumatic_parts_actuators_PP_PP-AC" OWNER TO postgres;

--
-- Name: pneumatic_parts_valves_PP_PP-VL; Type: TABLE; Schema: part; Owner: postgres
--

CREATE TABLE part."pneumatic_parts_valves_PP_PP-VL" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    part_number character varying(50) NOT NULL,
    description text DEFAULT ''::text,
    created_by character varying(200) DEFAULT ''::character varying,
    status character varying(20) DEFAULT 'active'::character varying,
    obsoleted_at timestamp without time zone,
    obsolete_reason text,
    created_at timestamp without time zone DEFAULT now(),
    material character varying(500),
    size character varying(500),
    part_type character varying(30) DEFAULT 'bought_out'::character varying
);


ALTER TABLE part."pneumatic_parts_valves_PP_PP-VL" OWNER TO postgres;

--
-- Name: resistor_smt_100_1001; Type: TABLE; Schema: part; Owner: postgres
--

CREATE TABLE part.resistor_smt_100_1001 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    part_number character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying,
    obsoleted_at timestamp without time zone,
    obsolete_reason text,
    created_at timestamp without time zone DEFAULT now(),
    value character varying,
    tolerence character varying,
    part_type character varying(30) DEFAULT 'bought_out'::character varying,
    description text DEFAULT ''::text,
    created_by character varying(200) DEFAULT ''::character varying
);


ALTER TABLE part.resistor_smt_100_1001 OWNER TO postgres;

--
-- Name: series; Type: TABLE; Schema: part; Owner: postgres
--

CREATE TABLE part.series (
    id character varying(36) NOT NULL,
    name character varying(200) NOT NULL,
    prefix character varying(20) NOT NULL,
    current_sequence integer DEFAULT 0,
    scheme_id character varying(36),
    is_active boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(36) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    part_type character varying(30) DEFAULT 'bought_out'::character varying
);


ALTER TABLE part.series OWNER TO postgres;

--
-- Name: sheemetal_mould_601_1; Type: TABLE; Schema: part; Owner: postgres
--

CREATE TABLE part.sheemetal_mould_601_1 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    part_number character varying(50) NOT NULL,
    description text DEFAULT ''::text,
    created_by character varying(200) DEFAULT ''::character varying,
    status character varying(20) DEFAULT 'active'::character varying,
    obsoleted_at timestamp without time zone,
    obsolete_reason text,
    created_at timestamp without time zone DEFAULT now(),
    asd character varying,
    df character varying,
    gf character varying,
    part_type character varying(20) DEFAULT 'bought_out'::character varying
);


ALTER TABLE part.sheemetal_mould_601_1 OWNER TO postgres;

--
-- Name: sheet_metal_fg_601_1; Type: TABLE; Schema: part; Owner: postgres
--

CREATE TABLE part.sheet_metal_fg_601_1 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    part_number character varying(50) NOT NULL,
    description text DEFAULT ''::text,
    created_by character varying(200) DEFAULT ''::character varying,
    is_bought_out boolean DEFAULT true,
    is_manufactured boolean DEFAULT false,
    status character varying(20) DEFAULT 'active'::character varying,
    obsoleted_at timestamp without time zone,
    obsolete_reason text,
    created_at timestamp without time zone DEFAULT now(),
    weight character varying,
    length character varying
);


ALTER TABLE part.sheet_metal_fg_601_1 OWNER TO postgres;

--
-- Name: subcategories; Type: TABLE; Schema: part; Owner: postgres
--

CREATE TABLE part.subcategories (
    id character varying(36) NOT NULL,
    name character varying(200) NOT NULL,
    code character varying(50) NOT NULL,
    series_prefix character varying(20),
    category_id character varying(36),
    is_active boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(36) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    current_sequence integer DEFAULT 0,
    columns_config jsonb,
    description_columns jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE part.subcategories OWNER TO postgres;

--
-- Name: validation_rules; Type: TABLE; Schema: part; Owner: postgres
--

CREATE TABLE part.validation_rules (
    id character varying(36) NOT NULL,
    name character varying(200) NOT NULL,
    type character varying(50) NOT NULL,
    pattern character varying(500),
    error_message character varying(500),
    is_active boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(36) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    part_type character varying(30) DEFAULT 'bought_out'::character varying
);


ALTER TABLE part.validation_rules OWNER TO postgres;

--
-- Name: grn; Type: TABLE; Schema: procurement; Owner: postgres
--

CREATE TABLE procurement.grn (
    id character varying(36) NOT NULL,
    doc_no character varying(50) NOT NULL,
    date date NOT NULL,
    po_id character varying(36),
    vendor_id character varying(36),
    status character varying(20) DEFAULT 'draft'::character varying,
    lines jsonb,
    remarks text,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36),
    updated_by character varying(36)
);


ALTER TABLE procurement.grn OWNER TO postgres;

--
-- Name: purchase_orders; Type: TABLE; Schema: procurement; Owner: postgres
--

CREATE TABLE procurement.purchase_orders (
    id character varying(36) NOT NULL,
    doc_no character varying(50) NOT NULL,
    date date NOT NULL,
    vendor_id character varying(36) NOT NULL,
    pr_id character varying(36),
    status character varying(20) DEFAULT 'draft'::character varying,
    lines jsonb,
    subtotal numeric(18,2),
    tax numeric(18,2),
    total numeric(18,2),
    currency character varying(10) DEFAULT 'INR'::character varying,
    payment_terms character varying(100),
    delivery_date date,
    remarks text,
    approved_by character varying(36),
    approved_at timestamp without time zone,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36),
    updated_by character varying(36),
    project_id character varying(36),
    organization_id character varying(36),
    customer_part_number character varying(100) DEFAULT ''::character varying,
    quantity numeric(12,2) DEFAULT 0,
    price_per_quantity numeric(12,2) DEFAULT 0,
    delivery_date_etd date,
    delivery_date_eta date,
    deliver_by character varying(50) DEFAULT ''::character varying,
    location character varying(200) DEFAULT ''::character varying
);


ALTER TABLE procurement.purchase_orders OWNER TO postgres;

--
-- Name: purchase_requests; Type: TABLE; Schema: procurement; Owner: postgres
--

CREATE TABLE procurement.purchase_requests (
    id character varying(36) NOT NULL,
    doc_no character varying(50) NOT NULL,
    date date NOT NULL,
    requester_id character varying(36),
    department_id character varying(36),
    priority character varying(20) DEFAULT 'normal'::character varying,
    status character varying(20) DEFAULT 'draft'::character varying,
    lines jsonb,
    remarks text,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36),
    updated_by character varying(36)
);


ALTER TABLE procurement.purchase_requests OWNER TO postgres;

--
-- Name: organizations; Type: TABLE; Schema: project; Owner: postgres
--

CREATE TABLE project.organizations (
    id character varying(36) DEFAULT (gen_random_uuid())::text NOT NULL,
    name character varying(300) NOT NULL,
    code character varying(50),
    industry character varying(100) DEFAULT ''::character varying,
    website character varying(300) DEFAULT ''::character varying,
    phone character varying(50) DEFAULT ''::character varying,
    email character varying(200) DEFAULT ''::character varying,
    gst_number character varying(50) DEFAULT ''::character varying,
    pan_number character varying(50) DEFAULT ''::character varying,
    addresses jsonb DEFAULT '[]'::jsonb,
    contacts jsonb DEFAULT '[]'::jsonb,
    tenant_id character varying(36) DEFAULT ''::character varying NOT NULL,
    is_deleted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(200) DEFAULT ''::character varying
);


ALTER TABLE project.organizations OWNER TO postgres;

--
-- Name: projects; Type: TABLE; Schema: project; Owner: postgres
--

CREATE TABLE project.projects (
    id character varying(36) NOT NULL,
    name character varying(200) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    manager_id character varying(36),
    department_id character varying(36),
    status character varying(20) DEFAULT 'planning'::character varying,
    priority character varying(20) DEFAULT 'normal'::character varying,
    start_date date,
    end_date date,
    budget numeric(18,2),
    actual_cost numeric(18,2) DEFAULT 0,
    progress integer DEFAULT 0,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36),
    updated_by character varying(36),
    project_type character varying(100) DEFAULT ''::character varying,
    due_date date,
    closing_date date,
    bp_code character varying(100) DEFAULT ''::character varying,
    bp_name character varying(200) DEFAULT ''::character varying,
    contact_person character varying(200) DEFAULT ''::character varying,
    territory character varying(200) DEFAULT ''::character varying,
    sales_employee character varying(200) DEFAULT ''::character varying,
    owner character varying(200) DEFAULT ''::character varying,
    percent_complete numeric(5,2) DEFAULT 0,
    organization_id character varying(36) DEFAULT NULL::character varying,
    addresses jsonb DEFAULT '[]'::jsonb,
    contacts jsonb DEFAULT '[]'::jsonb,
    purchase_orders jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE project.projects OWNER TO postgres;

--
-- Name: tasks; Type: TABLE; Schema: project; Owner: postgres
--

CREATE TABLE project.tasks (
    id character varying(36) NOT NULL,
    project_id character varying(36),
    name character varying(200) NOT NULL,
    description text,
    assignee_id character varying(36),
    status character varying(20) DEFAULT 'todo'::character varying,
    priority character varying(20) DEFAULT 'normal'::character varying,
    start_date date,
    due_date date,
    estimated_hours numeric(8,2),
    actual_hours numeric(8,2) DEFAULT 0,
    parent_id character varying(36),
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36),
    updated_by character varying(36),
    task_name character varying(300),
    stage character varying(100) DEFAULT ''::character varying,
    owner character varying(200) DEFAULT ''::character varying,
    end_date date,
    planned_cost numeric(18,2) DEFAULT 0,
    invoiced_amount numeric(18,2) DEFAULT 0,
    percent_complete numeric(5,2) DEFAULT 0,
    dependencies text DEFAULT ''::text
);


ALTER TABLE project.tasks OWNER TO postgres;

--
-- Name: timesheets; Type: TABLE; Schema: project; Owner: postgres
--

CREATE TABLE project.timesheets (
    id character varying(36) NOT NULL,
    project_id character varying(36),
    task_id character varying(36),
    user_id character varying(36) NOT NULL,
    date date NOT NULL,
    hours numeric(8,2) NOT NULL,
    description text,
    status character varying(20) DEFAULT 'draft'::character varying,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE project.timesheets OWNER TO postgres;

--
-- Name: inventory_batches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_batches (
    id character varying(36) NOT NULL,
    batch_no character varying(100) NOT NULL,
    part_number character varying(100) NOT NULL,
    supplier_lot character varying(100),
    manufacture_date character varying(30),
    expiry_date character varying(30),
    qty_received numeric(14,4) DEFAULT 0,
    qty_remaining numeric(14,4) DEFAULT 0,
    warehouse_code character varying(20),
    bin_code character varying(30),
    status character varying(20) DEFAULT 'active'::character varying,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.inventory_batches OWNER TO postgres;

--
-- Name: inventory_locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_locations (
    id character varying(36) NOT NULL,
    location_code character varying(100) NOT NULL,
    plant character varying(100) DEFAULT 'Plant 1'::character varying,
    floor_name character varying(50) DEFAULT 'Ground Floor'::character varying,
    shelf_name character varying(50) DEFAULT 'Shelf A'::character varying,
    row_name character varying(50) DEFAULT 'Row 01'::character varying,
    column_name character varying(50) DEFAULT 'Col 01'::character varying,
    bin_code character varying(50) DEFAULT 'RM-A-01'::character varying,
    warehouse_code character varying(20) DEFAULT 'MAIN'::character varying,
    capacity numeric(14,4) DEFAULT 1000,
    current_occupancy numeric(14,4) DEFAULT 0,
    is_active boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.inventory_locations OWNER TO postgres;

--
-- Name: inventory_reorder_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_reorder_rules (
    id character varying(36) NOT NULL,
    part_number character varying(100) NOT NULL,
    warehouse_code character varying(20),
    reorder_point numeric(14,4) DEFAULT 0,
    reorder_qty numeric(14,4) DEFAULT 0,
    lead_time_days integer DEFAULT 0,
    preferred_supplier character varying(200),
    is_active boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.inventory_reorder_rules OWNER TO postgres;

--
-- Name: inventory_serial_numbers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_serial_numbers (
    id character varying(36) NOT NULL,
    serial_no character varying(100) NOT NULL,
    part_number character varying(100) NOT NULL,
    batch_no character varying(100),
    warehouse_code character varying(20),
    bin_code character varying(30),
    status character varying(20) DEFAULT 'in_stock'::character varying,
    production_order_no character varying(100),
    notes text,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.inventory_serial_numbers OWNER TO postgres;

--
-- Name: inventory_stock_checkins; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_stock_checkins (
    id character varying(36) NOT NULL,
    checkin_no character varying(50) NOT NULL,
    po_no character varying(50) NOT NULL,
    supplier_code character varying(50) NOT NULL,
    supplier_name character varying(200) NOT NULL,
    part_or_rm_code character varying(100) NOT NULL,
    item_description text DEFAULT ''::text,
    ordered_qty numeric(14,4) NOT NULL,
    received_qty numeric(14,4) NOT NULL,
    checkin_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    checked_in_by character varying(100) DEFAULT 'Rajesh Kumar (EMP-1002)'::character varying,
    iqc_status character varying(50) DEFAULT 'pending_iqc'::character varying,
    iqc_passed_qty numeric(14,4) DEFAULT 0,
    iqc_rejected_qty numeric(14,4) DEFAULT 0,
    iqc_scrap_qty numeric(14,4) DEFAULT 0,
    iqc_time timestamp without time zone,
    iqc_elapsed_min integer DEFAULT 0,
    iqc_remarks text DEFAULT ''::text,
    iqc_inspector character varying(100) DEFAULT ''::character varying,
    location_code character varying(100) DEFAULT ''::character varying,
    warehouse_code character varying(20) DEFAULT 'MAIN'::character varying,
    bin_code character varying(30) DEFAULT ''::character varying,
    qr_code_data text DEFAULT ''::text,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.inventory_stock_checkins OWNER TO postgres;

--
-- Name: inventory_stock_count_lines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_stock_count_lines (
    id character varying(36) NOT NULL,
    count_id character varying(36),
    part_number character varying(100) NOT NULL,
    bin_code character varying(30),
    book_qty numeric(14,4) DEFAULT 0,
    counted_qty numeric(14,4),
    variance numeric(14,4) DEFAULT 0,
    status character varying(20) DEFAULT 'pending'::character varying,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.inventory_stock_count_lines OWNER TO postgres;

--
-- Name: inventory_stock_counts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_stock_counts (
    id character varying(36) NOT NULL,
    count_no character varying(50) NOT NULL,
    warehouse_code character varying(20),
    count_date character varying(30) NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying,
    assigned_to character varying(200),
    notes text,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.inventory_stock_counts OWNER TO postgres;

--
-- Name: inventory_stock_levels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_stock_levels (
    id character varying(36) NOT NULL,
    part_number character varying(100) NOT NULL,
    part_description text DEFAULT ''::text,
    item_type character varying(20) DEFAULT 'PART'::character varying,
    warehouse_id character varying(36),
    warehouse_code character varying(20),
    zone_code character varying(20),
    bin_code character varying(30),
    qty_on_hand numeric(14,4) DEFAULT 0,
    qty_reserved numeric(14,4) DEFAULT 0,
    qty_available numeric(14,4) DEFAULT 0,
    reorder_point numeric(14,4) DEFAULT 0,
    reorder_qty numeric(14,4) DEFAULT 0,
    unit character varying(20) DEFAULT 'pcs'::character varying,
    unit_cost numeric(14,4) DEFAULT 0,
    total_value numeric(14,4) DEFAULT 0,
    last_movement_at timestamp without time zone,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.inventory_stock_levels OWNER TO postgres;

--
-- Name: inventory_stock_movements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_stock_movements (
    id character varying(36) NOT NULL,
    movement_no character varying(50),
    movement_type character varying(20) NOT NULL,
    part_number character varying(100) NOT NULL,
    part_description text DEFAULT ''::text,
    item_type character varying(20) DEFAULT 'PART'::character varying,
    from_warehouse_code character varying(20),
    from_bin_code character varying(30),
    to_warehouse_code character varying(20),
    to_bin_code character varying(30),
    qty numeric(14,4) NOT NULL,
    unit character varying(20) DEFAULT 'pcs'::character varying,
    unit_cost numeric(14,4) DEFAULT 0,
    reference_type character varying(30),
    reference_no character varying(100),
    reason text,
    performed_by character varying(200),
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.inventory_stock_movements OWNER TO postgres;

--
-- Name: inventory_warehouses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_warehouses (
    id character varying(36) NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(200) NOT NULL,
    address text,
    is_active boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.inventory_warehouses OWNER TO postgres;

--
-- Name: manufacturing_bom_lines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.manufacturing_bom_lines (
    id character varying(36) NOT NULL,
    bom_id character varying(36),
    sequence integer DEFAULT 10,
    component_type character varying(10) DEFAULT 'PART'::character varying,
    component_no character varying(100) NOT NULL,
    component_description text DEFAULT ''::text,
    qty_per numeric(14,4) DEFAULT 1 NOT NULL,
    unit character varying(20) DEFAULT 'pcs'::character varying,
    scrap_factor numeric(5,2) DEFAULT 0,
    operation_ref character varying(20),
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.manufacturing_bom_lines OWNER TO postgres;

--
-- Name: manufacturing_boms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.manufacturing_boms (
    id character varying(36) NOT NULL,
    bom_no character varying(50) NOT NULL,
    fg_part_number character varying(100) NOT NULL,
    fg_description text DEFAULT ''::text,
    version character varying(10) DEFAULT '1.0'::character varying,
    effective_date character varying(30),
    status character varying(20) DEFAULT 'active'::character varying,
    yield_qty numeric(14,4) DEFAULT 1,
    unit character varying(20) DEFAULT 'pcs'::character varying,
    notes text,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.manufacturing_boms OWNER TO postgres;

--
-- Name: manufacturing_production_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.manufacturing_production_orders (
    id character varying(36) NOT NULL,
    order_no character varying(50) NOT NULL,
    fg_part_number character varying(100) NOT NULL,
    fg_description text DEFAULT ''::text,
    bom_id character varying(36),
    routing_id character varying(36),
    planned_qty numeric(14,4) NOT NULL,
    produced_qty numeric(14,4) DEFAULT 0,
    rejected_qty numeric(14,4) DEFAULT 0,
    planned_start character varying(30),
    planned_end character varying(30),
    actual_start timestamp without time zone,
    actual_end timestamp without time zone,
    status character varying(20) DEFAULT 'draft'::character varying,
    priority character varying(10) DEFAULT 'normal'::character varying,
    notes text,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.manufacturing_production_orders OWNER TO postgres;

--
-- Name: manufacturing_routing_steps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.manufacturing_routing_steps (
    id character varying(36) NOT NULL,
    routing_id character varying(36),
    sequence integer NOT NULL,
    operation_code character varying(20) NOT NULL,
    operation_name character varying(200),
    work_center_code character varying(20),
    work_center_name character varying(200),
    setup_time_min numeric(8,2) DEFAULT 0,
    run_time_min_per_unit numeric(8,2) DEFAULT 0,
    sub_operations text DEFAULT '[]'::text,
    notes text,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.manufacturing_routing_steps OWNER TO postgres;

--
-- Name: manufacturing_routings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.manufacturing_routings (
    id character varying(36) NOT NULL,
    routing_no character varying(50) NOT NULL,
    part_number character varying(100) NOT NULL,
    part_description text DEFAULT ''::text,
    version character varying(10) DEFAULT '1.0'::character varying,
    status character varying(20) DEFAULT 'active'::character varying,
    notes text,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.manufacturing_routings OWNER TO postgres;

--
-- Name: manufacturing_shop_floor_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.manufacturing_shop_floor_logs (
    id character varying(36) NOT NULL,
    production_order_no character varying(50) NOT NULL,
    part_number character varying(100) NOT NULL,
    operation_code character varying(20) NOT NULL,
    work_center_code character varying(20),
    operator character varying(200),
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    qty_produced numeric(14,4) DEFAULT 0,
    qty_rejected numeric(14,4) DEFAULT 0,
    rejection_reason text,
    actual_time_min numeric(8,2) DEFAULT 0,
    status character varying(20) DEFAULT 'in_progress'::character varying,
    notes text,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.manufacturing_shop_floor_logs OWNER TO postgres;

--
-- Name: manufacturing_work_centers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.manufacturing_work_centers (
    id character varying(36) NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(200) NOT NULL,
    machine_id character varying(100),
    machine_name character varying(200),
    capacity_hours_per_day numeric(5,2) DEFAULT 8,
    efficiency_pct numeric(5,2) DEFAULT 100,
    cost_rate_per_hour numeric(10,2) DEFAULT 0,
    mhr_rate numeric(10,2) DEFAULT 0,
    status character varying(20) DEFAULT 'active'::character varying,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.manufacturing_work_centers OWNER TO postgres;

--
-- Name: purchase_customer_demands; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_customer_demands (
    id character varying(36) NOT NULL,
    demand_no character varying(50) NOT NULL,
    customer_name character varying(200) NOT NULL,
    part_or_rm_code character varying(100) NOT NULL,
    item_type character varying(20) DEFAULT 'PART'::character varying,
    item_description text DEFAULT ''::text,
    ordered_qty numeric(14,4) NOT NULL,
    available_stock numeric(14,4) DEFAULT 0,
    occupy_option character varying(20) DEFAULT 'do_not_occupy'::character varying,
    occupied_qty numeric(14,4) DEFAULT 0,
    remaining_stock numeric(14,4) DEFAULT 0,
    qty_to_buy numeric(14,4) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    notes text DEFAULT ''::text,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    rm_code character varying(100) DEFAULT 'RM-STEEL-316L'::character varying,
    rm_description text DEFAULT 'Forged Alloy Steel Bar 316L'::text
);


ALTER TABLE public.purchase_customer_demands OWNER TO postgres;

--
-- Name: purchase_lead_time_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_lead_time_history (
    id character varying(36) NOT NULL,
    po_id character varying(36) NOT NULL,
    po_no character varying(50) NOT NULL,
    old_lead_time_days integer NOT NULL,
    new_lead_time_days integer NOT NULL,
    change_reason character varying(200) DEFAULT ''::character varying,
    remarks text DEFAULT ''::text,
    changed_by character varying(100) DEFAULT 'Purchaser'::character varying,
    changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    tenant_id character varying(100) NOT NULL
);


ALTER TABLE public.purchase_lead_time_history OWNER TO postgres;

--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_orders (
    id character varying(36) NOT NULL,
    po_no character varying(50) NOT NULL,
    req_no character varying(50),
    supplier_code character varying(50) NOT NULL,
    supplier_name character varying(200) NOT NULL,
    part_or_rm_code character varying(100) NOT NULL,
    item_description text DEFAULT ''::text,
    order_qty numeric(14,4) NOT NULL,
    unit_price numeric(14,4) NOT NULL,
    total_amount numeric(14,4) NOT NULL,
    lead_time_days integer DEFAULT 7,
    promised_delivery_date date,
    lead_time_change_count integer DEFAULT 0,
    status character varying(50) DEFAULT 'released'::character varying,
    remarks text DEFAULT ''::text,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.purchase_orders OWNER TO postgres;

--
-- Name: purchase_requisitions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_requisitions (
    id character varying(36) NOT NULL,
    req_no character varying(50) NOT NULL,
    demand_no character varying(50),
    part_or_rm_code character varying(100) NOT NULL,
    item_description text DEFAULT ''::text,
    required_qty numeric(14,4) NOT NULL,
    supplier_code character varying(50) NOT NULL,
    supplier_name character varying(200) NOT NULL,
    unit_price numeric(14,4) NOT NULL,
    moq numeric(14,4) DEFAULT 1,
    sqp numeric(14,4) DEFAULT 1,
    total_amount numeric(14,4) NOT NULL,
    requested_by character varying(100) DEFAULT 'Purchaser'::character varying,
    status character varying(50) DEFAULT 'pending'::character varying,
    notes text DEFAULT ''::text,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.purchase_requisitions OWNER TO postgres;

--
-- Name: purchase_supplier_quotations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_supplier_quotations (
    id character varying(36) NOT NULL,
    part_or_rm_code character varying(100) NOT NULL,
    supplier_code character varying(50) NOT NULL,
    supplier_name character varying(200) NOT NULL,
    unit_price numeric(14,4) NOT NULL,
    lead_time_days integer DEFAULT 7,
    min_order_qty numeric(14,4) DEFAULT 1,
    sop_price numeric(14,4) DEFAULT 0,
    sqp_pack numeric(14,4) DEFAULT 1,
    is_active boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.purchase_supplier_quotations OWNER TO postgres;

--
-- Name: quality_iqc_criteria; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quality_iqc_criteria (
    id character varying(36) NOT NULL,
    part_or_rm_code character varying(100) NOT NULL,
    criterion_name character varying(200) NOT NULL,
    spec_target character varying(100) DEFAULT ''::character varying,
    tolerance_min character varying(50) DEFAULT ''::character varying,
    tolerance_max character varying(50) DEFAULT ''::character varying,
    inspection_method character varying(100) DEFAULT 'Vernier Caliper / Micrometer'::character varying,
    is_mandatory boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.quality_iqc_criteria OWNER TO postgres;

--
-- Name: quality_ncrs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quality_ncrs (
    id character varying(36) NOT NULL,
    ncr_no character varying(50) NOT NULL,
    checkin_no character varying(50),
    part_or_rm_code character varying(100) NOT NULL,
    supplier_name character varying(200),
    rejected_qty numeric(14,4) DEFAULT 0,
    defect_type character varying(100) DEFAULT 'Dimensional Variation'::character varying,
    severity character varying(50) DEFAULT 'Major'::character varying,
    root_cause text DEFAULT ''::text,
    corrective_action text DEFAULT ''::text,
    disposition character varying(50) DEFAULT 'Return to Vendor (RTV)'::character varying,
    status character varying(50) DEFAULT 'open'::character varying,
    raised_by character varying(100) DEFAULT 'Vikram Singh (EMP-1005)'::character varying,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.quality_ncrs OWNER TO postgres;

--
-- Name: super_admins; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.super_admins (
    id character varying(36) NOT NULL,
    email character varying(200) NOT NULL,
    password_hash character varying(256) NOT NULL,
    name character varying(200) NOT NULL,
    phone character varying(20),
    is_active boolean DEFAULT true,
    last_login timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.super_admins OWNER TO postgres;

--
-- Name: warehouse_bin_scans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.warehouse_bin_scans (
    id character varying(36) NOT NULL,
    bin_code character varying(50) NOT NULL,
    warehouse_code character varying(20) DEFAULT 'MAIN'::character varying,
    scan_action character varying(50) NOT NULL,
    part_number character varying(100) NOT NULL,
    qty numeric(14,4) NOT NULL,
    performer_name character varying(100) DEFAULT 'Sunil Verma (EMP-1003)'::character varying,
    scan_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    remarks text DEFAULT ''::text,
    tenant_id character varying(100) NOT NULL
);


ALTER TABLE public.warehouse_bin_scans OWNER TO postgres;

--
-- Name: warehouse_bins; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.warehouse_bins (
    id character varying(36) NOT NULL,
    bin_code character varying(30) NOT NULL,
    zone_code character varying(20) NOT NULL,
    warehouse_code character varying(20) NOT NULL,
    aisle character varying(10),
    rack character varying(10),
    level character varying(10),
    capacity_units integer DEFAULT 500,
    current_units integer DEFAULT 0,
    status character varying(20) DEFAULT 'active'::character varying,
    qr_data text,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.warehouse_bins OWNER TO postgres;

--
-- Name: warehouse_packing_lists; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.warehouse_packing_lists (
    id character varying(36) NOT NULL,
    packing_no character varying(50) NOT NULL,
    customer_ref character varying(100),
    fg_part_number character varying(100) NOT NULL,
    qty numeric(14,4) DEFAULT 0,
    box_pallet_details character varying(200),
    weight_kg numeric(10,2) DEFAULT 0,
    dimensions character varying(100),
    status character varying(20) DEFAULT 'packed'::character varying,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.warehouse_packing_lists OWNER TO postgres;

--
-- Name: warehouse_pick_list_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.warehouse_pick_list_items (
    id character varying(36) NOT NULL,
    pick_list_id character varying(36),
    part_number character varying(100) NOT NULL,
    part_description text DEFAULT ''::text,
    bin_code character varying(30),
    qty_required numeric(14,4) NOT NULL,
    qty_picked numeric(14,4) DEFAULT 0,
    status character varying(20) DEFAULT 'pending'::character varying,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.warehouse_pick_list_items OWNER TO postgres;

--
-- Name: warehouse_pick_lists; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.warehouse_pick_lists (
    id character varying(36) NOT NULL,
    list_no character varying(50) NOT NULL,
    reference_type character varying(30),
    reference_no character varying(100),
    warehouse_code character varying(20),
    assigned_to character varying(200),
    due_date character varying(30),
    status character varying(20) DEFAULT 'open'::character varying,
    notes text,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.warehouse_pick_lists OWNER TO postgres;

--
-- Name: warehouse_putaway_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.warehouse_putaway_tasks (
    id character varying(36) NOT NULL,
    task_no character varying(50) NOT NULL,
    receipt_ref character varying(100),
    part_number character varying(100) NOT NULL,
    part_description text DEFAULT ''::text,
    qty numeric(14,4) NOT NULL,
    suggested_bin character varying(30),
    actual_bin character varying(30),
    warehouse_code character varying(20),
    status character varying(20) DEFAULT 'pending'::character varying,
    performed_by character varying(200),
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.warehouse_putaway_tasks OWNER TO postgres;

--
-- Name: warehouse_receipt_lines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.warehouse_receipt_lines (
    id character varying(36) NOT NULL,
    receipt_id character varying(36),
    part_number character varying(100) NOT NULL,
    part_description text DEFAULT ''::text,
    ordered_qty numeric(14,4) DEFAULT 0,
    received_qty numeric(14,4) DEFAULT 0,
    accepted_qty numeric(14,4) DEFAULT 0,
    rejected_qty numeric(14,4) DEFAULT 0,
    bin_code character varying(30),
    qc_status character varying(20) DEFAULT 'pending'::character varying,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.warehouse_receipt_lines OWNER TO postgres;

--
-- Name: warehouse_receipts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.warehouse_receipts (
    id character varying(36) NOT NULL,
    receipt_no character varying(50) NOT NULL,
    po_number character varying(100),
    supplier_name character varying(200),
    warehouse_code character varying(20),
    receipt_date character varying(30) NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying,
    notes text,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.warehouse_receipts OWNER TO postgres;

--
-- Name: warehouse_shipment_lines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.warehouse_shipment_lines (
    id character varying(36) NOT NULL,
    shipment_id character varying(36),
    part_number character varying(100) NOT NULL,
    part_description text DEFAULT ''::text,
    qty numeric(14,4) NOT NULL,
    bin_code character varying(30),
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.warehouse_shipment_lines OWNER TO postgres;

--
-- Name: warehouse_shipments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.warehouse_shipments (
    id character varying(36) NOT NULL,
    shipment_no character varying(50) NOT NULL,
    customer_name character varying(200),
    delivery_address text,
    warehouse_code character varying(20),
    dispatch_date character varying(30),
    carrier character varying(100),
    tracking_no character varying(100),
    status character varying(20) DEFAULT 'draft'::character varying,
    notes text,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.warehouse_shipments OWNER TO postgres;

--
-- Name: warehouse_zones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.warehouse_zones (
    id character varying(36) NOT NULL,
    zone_code character varying(20) NOT NULL,
    name character varying(200) NOT NULL,
    zone_type character varying(20) DEFAULT 'GENERAL'::character varying,
    warehouse_code character varying(20) NOT NULL,
    capacity_units integer DEFAULT 1000,
    description text,
    is_active boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.warehouse_zones OWNER TO postgres;

--
-- Name: inspections; Type: TABLE; Schema: quality; Owner: postgres
--

CREATE TABLE quality.inspections (
    id character varying(36) NOT NULL,
    doc_no character varying(50) NOT NULL,
    date date NOT NULL,
    type character varying(50),
    reference_type character varying(50),
    reference_id character varying(36),
    item_id character varying(36),
    qty_inspected numeric(18,4),
    qty_accepted numeric(18,4),
    qty_rejected numeric(18,4),
    status character varying(20) DEFAULT 'pending'::character varying,
    inspector_id character varying(36),
    parameters jsonb,
    remarks text,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36)
);


ALTER TABLE quality.inspections OWNER TO postgres;

--
-- Name: ncr; Type: TABLE; Schema: quality; Owner: postgres
--

CREATE TABLE quality.ncr (
    id character varying(36) NOT NULL,
    doc_no character varying(50) NOT NULL,
    date date NOT NULL,
    type character varying(50),
    source character varying(50),
    item_id character varying(36),
    description text,
    root_cause text,
    corrective_action text,
    status character varying(20) DEFAULT 'open'::character varying,
    severity character varying(20),
    assigned_to character varying(36),
    closed_at timestamp without time zone,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36)
);


ALTER TABLE quality.ncr OWNER TO postgres;

--
-- Name: rm_criteria; Type: TABLE; Schema: rawmaterial; Owner: postgres
--

CREATE TABLE rawmaterial.rm_criteria (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_category character varying(100) NOT NULL,
    sub_category character varying(100) DEFAULT ''::character varying,
    series_prefix character varying(50) NOT NULL,
    separator character varying(1) DEFAULT '-'::character varying,
    number_format character varying(10) DEFAULT '4'::character varying,
    description text DEFAULT ''::text,
    current_sequence integer DEFAULT 0,
    is_active boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) DEFAULT ''::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    columns_config jsonb
);


ALTER TABLE rawmaterial.rm_criteria OWNER TO postgres;

--
-- Name: rm_master; Type: TABLE; Schema: rawmaterial; Owner: postgres
--

CREATE TABLE rawmaterial.rm_master (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rm_code character varying(100) NOT NULL,
    rm_description text DEFAULT ''::text,
    material_category character varying(100) DEFAULT ''::character varying,
    sub_category character varying(100) DEFAULT ''::character varying,
    specification character varying(200) DEFAULT ''::character varying,
    unit character varying(50) DEFAULT ''::character varying,
    hsn_code character varying(50) DEFAULT ''::character varying,
    standard_size character varying(200) DEFAULT ''::character varying,
    weight_per_unit numeric,
    reorder_level numeric,
    notes text DEFAULT ''::text,
    is_active boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) DEFAULT ''::character varying,
    created_by character varying(200) DEFAULT ''::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    col_values jsonb
);


ALTER TABLE rawmaterial.rm_master OWNER TO postgres;

--
-- Name: rm_part_mapping; Type: TABLE; Schema: rawmaterial; Owner: postgres
--

CREATE TABLE rawmaterial.rm_part_mapping (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rm_code character varying(100) NOT NULL,
    rm_description text DEFAULT ''::text,
    part_number character varying(100) NOT NULL,
    part_description text DEFAULT ''::text,
    quantity_required numeric,
    unit character varying(50) DEFAULT ''::character varying,
    wastage_percent numeric DEFAULT 0,
    effective_quantity numeric,
    process_notes text DEFAULT ''::text,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) DEFAULT ''::character varying,
    created_by character varying(200) DEFAULT ''::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE rawmaterial.rm_part_mapping OWNER TO postgres;

--
-- Name: rm_vendors; Type: TABLE; Schema: rawmaterial; Owner: postgres
--

CREATE TABLE rawmaterial.rm_vendors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rm_code character varying(100) NOT NULL,
    rm_description text DEFAULT ''::text,
    vendor_name character varying(200) NOT NULL,
    vendor_code character varying(100) DEFAULT ''::character varying,
    price_per_unit numeric,
    currency character varying(10) DEFAULT 'INR'::character varying,
    moq numeric,
    lead_time_days integer,
    payment_terms character varying(200) DEFAULT ''::character varying,
    is_preferred boolean DEFAULT false,
    last_purchase_date date,
    rating integer,
    is_deleted boolean DEFAULT false,
    tenant_id character varying(100) DEFAULT ''::character varying,
    created_by character varying(200) DEFAULT ''::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE rawmaterial.rm_vendors OWNER TO postgres;

--
-- Name: addresses; Type: TABLE; Schema: supplier; Owner: postgres
--

CREATE TABLE supplier.addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_id uuid NOT NULL,
    label character varying(100) DEFAULT ''::character varying,
    billing_address text DEFAULT ''::text,
    shipping_address text DEFAULT ''::text,
    is_default boolean DEFAULT false,
    tenant_id character varying(100) DEFAULT ''::character varying,
    is_deleted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE supplier.addresses OWNER TO postgres;

--
-- Name: contacts; Type: TABLE; Schema: supplier; Owner: postgres
--

CREATE TABLE supplier.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_id uuid NOT NULL,
    designation character varying(100) DEFAULT ''::character varying,
    name character varying(200) NOT NULL,
    mobile1 character varying(20) DEFAULT ''::character varying,
    mobile2 character varying(20) DEFAULT ''::character varying,
    email character varying(200) DEFAULT ''::character varying,
    status character varying(20) DEFAULT 'active'::character varying,
    about text DEFAULT ''::text,
    remarks text DEFAULT ''::text,
    tenant_id character varying(100) DEFAULT ''::character varying,
    is_deleted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE supplier.contacts OWNER TO postgres;

--
-- Name: contracts; Type: TABLE; Schema: supplier; Owner: postgres
--

CREATE TABLE supplier.contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_id uuid NOT NULL,
    contract_no character varying(100) NOT NULL,
    title character varying(300) NOT NULL,
    contract_type character varying(50) DEFAULT 'purchase'::character varying,
    start_date date,
    end_date date,
    value numeric(16,2),
    currency character varying(10) DEFAULT 'INR'::character varying,
    status character varying(20) DEFAULT 'active'::character varying,
    terms text DEFAULT ''::text,
    document_url character varying(500) DEFAULT ''::character varying,
    tenant_id character varying(100) DEFAULT ''::character varying,
    created_by character varying(200) DEFAULT ''::character varying,
    is_deleted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    contract_number character varying(100) DEFAULT ''::character varying,
    contract_value numeric(16,2) DEFAULT 0,
    payment_terms text DEFAULT ''::text,
    delivery_terms text DEFAULT ''::text,
    attachment_path character varying(500) DEFAULT ''::character varying,
    auto_renew boolean DEFAULT false,
    lifecycle_stage character varying(30) DEFAULT 'draft'::character varying,
    notes text DEFAULT ''::text
);


ALTER TABLE supplier.contracts OWNER TO postgres;

--
-- Name: evaluations; Type: TABLE; Schema: supplier; Owner: postgres
--

CREATE TABLE supplier.evaluations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_id uuid NOT NULL,
    eval_date date DEFAULT CURRENT_DATE NOT NULL,
    quality_score numeric(4,1) DEFAULT 0,
    delivery_score numeric(4,1) DEFAULT 0,
    price_score numeric(4,1) DEFAULT 0,
    service_score numeric(4,1) DEFAULT 0,
    overall_score numeric(4,1) DEFAULT 0,
    evaluator character varying(200) DEFAULT ''::character varying,
    remarks text DEFAULT ''::text,
    status character varying(20) DEFAULT 'draft'::character varying,
    tenant_id character varying(100) DEFAULT ''::character varying,
    created_by character varying(200) DEFAULT ''::character varying,
    is_deleted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    evaluation_date date,
    period character varying(50) DEFAULT ''::character varying,
    document_verification_status character varying(30) DEFAULT 'pending'::character varying,
    workflow_stage character varying(30) DEFAULT 'registration'::character varying,
    capacity_score numeric(4,1) DEFAULT 0,
    financial_stability_score numeric(4,1) DEFAULT 0,
    experience_score numeric(4,1) DEFAULT 0,
    technical_support_score numeric(4,1) DEFAULT 0,
    approval_status character varying(20) DEFAULT 'pending'::character varying,
    evaluator_id character varying(200) DEFAULT ''::character varying,
    comments text DEFAULT ''::text
);


ALTER TABLE supplier.evaluations OWNER TO postgres;

--
-- Name: history; Type: TABLE; Schema: supplier; Owner: postgres
--

CREATE TABLE supplier.history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_id uuid NOT NULL,
    part_code character varying(100) DEFAULT ''::character varying,
    event_type character varying(50) DEFAULT ''::character varying,
    description text DEFAULT ''::text,
    amount numeric(14,2),
    quantity numeric(12,2),
    unit character varying(20) DEFAULT ''::character varying,
    reference_no character varying(100) DEFAULT ''::character varying,
    event_date date,
    created_by character varying(200) DEFAULT ''::character varying,
    tenant_id character varying(100) DEFAULT ''::character varying,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE supplier.history OWNER TO postgres;

--
-- Name: parts; Type: TABLE; Schema: supplier; Owner: postgres
--

CREATE TABLE supplier.parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_id uuid NOT NULL,
    part_code character varying(100) DEFAULT ''::character varying,
    mpn character varying(100) DEFAULT ''::character varying,
    make character varying(100) DEFAULT ''::character varying,
    moq numeric(12,2) DEFAULT 0,
    moq_price numeric(12,2) DEFAULT 0,
    spq numeric(12,2) DEFAULT 0,
    spq_price numeric(12,2) DEFAULT 0,
    sample_qty numeric(12,2) DEFAULT 0,
    sample_price numeric(12,2) DEFAULT 0,
    notes text DEFAULT ''::text,
    tenant_id character varying(100) DEFAULT ''::character varying,
    is_deleted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    unit character varying(30) DEFAULT ''::character varying NOT NULL,
    item_type character varying(10) DEFAULT 'part'::character varying NOT NULL
);


ALTER TABLE supplier.parts OWNER TO postgres;

--
-- Name: performance; Type: TABLE; Schema: supplier; Owner: postgres
--

CREATE TABLE supplier.performance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_id uuid NOT NULL,
    period character varying(20) NOT NULL,
    period_label character varying(50) DEFAULT ''::character varying,
    on_time_delivery numeric(5,2) DEFAULT 0,
    quality_rejection_rate numeric(5,2) DEFAULT 0,
    order_fulfillment_rate numeric(5,2) DEFAULT 0,
    response_time_hours numeric(8,2) DEFAULT 0,
    price_variance numeric(5,2) DEFAULT 0,
    score numeric(4,1) DEFAULT 0,
    notes text DEFAULT ''::text,
    tenant_id character varying(100) DEFAULT ''::character varying,
    created_by character varying(200) DEFAULT ''::character varying,
    is_deleted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    po_count numeric(10,0) DEFAULT 0,
    grn_count numeric(10,0) DEFAULT 0,
    inspection_pass_rate numeric(5,2) DEFAULT 0,
    ncr_count numeric(10,0) DEFAULT 0,
    quality_defect_rate numeric(5,2) DEFAULT 0,
    on_time_delivery_rate numeric(5,2) DEFAULT 0,
    overall_score numeric(5,2) DEFAULT 0,
    performance_grade character varying(5) DEFAULT ''::character varying
);


ALTER TABLE supplier.performance OWNER TO postgres;

--
-- Name: price_history; Type: TABLE; Schema: supplier; Owner: postgres
--

CREATE TABLE supplier.price_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_id uuid NOT NULL,
    item_code character varying(100) NOT NULL,
    item_type character varying(10) DEFAULT 'part'::character varying NOT NULL,
    unit character varying(30) DEFAULT ''::character varying NOT NULL,
    sample_qty numeric(14,4) DEFAULT 0,
    sample_price numeric(14,2) DEFAULT 0,
    spq numeric(14,4) DEFAULT 0,
    spq_price numeric(14,2) DEFAULT 0,
    moq numeric(14,4) DEFAULT 0,
    moq_price numeric(14,2) DEFAULT 0,
    effective_date date DEFAULT CURRENT_DATE NOT NULL,
    notes text DEFAULT ''::text,
    created_by character varying(200) DEFAULT ''::character varying,
    tenant_id character varying(100) DEFAULT ''::character varying,
    created_at timestamp without time zone DEFAULT now(),
    price numeric(14,2) DEFAULT 0,
    currency character varying(10) DEFAULT 'INR'::character varying,
    reference_no character varying(100) DEFAULT ''::character varying,
    event_date date,
    is_deleted boolean DEFAULT false
);


ALTER TABLE supplier.price_history OWNER TO postgres;

--
-- Name: suppliers; Type: TABLE; Schema: supplier; Owner: postgres
--

CREATE TABLE supplier.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    supplier_code character varying(50) NOT NULL,
    brand_name character varying(200) NOT NULL,
    company_type character varying(50) DEFAULT ''::character varying,
    registered_name character varying(200) DEFAULT ''::character varying,
    gst_no character varying(20) DEFAULT ''::character varying,
    status character varying(20) DEFAULT 'active'::character varying,
    rating numeric(3,1) DEFAULT 0,
    currency character varying(10) DEFAULT 'INR'::character varying,
    website character varying(200) DEFAULT ''::character varying,
    notes text DEFAULT ''::text,
    tenant_id character varying(100) DEFAULT ''::character varying,
    created_by character varying(200) DEFAULT ''::character varying,
    is_deleted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE supplier.suppliers OWNER TO postgres;

--
-- Name: bins; Type: TABLE; Schema: warehouse; Owner: postgres
--

CREATE TABLE warehouse.bins (
    id character varying(36) NOT NULL,
    code character varying(50) NOT NULL,
    zone_id character varying(36),
    rack character varying(20),
    shelf character varying(20),
    "position" character varying(20),
    capacity numeric(18,4),
    is_active boolean DEFAULT true,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE warehouse.bins OWNER TO postgres;

--
-- Name: transfers; Type: TABLE; Schema: warehouse; Owner: postgres
--

CREATE TABLE warehouse.transfers (
    id character varying(36) NOT NULL,
    doc_no character varying(50) NOT NULL,
    date date NOT NULL,
    from_warehouse character varying(36),
    to_warehouse character varying(36),
    status character varying(20) DEFAULT 'draft'::character varying,
    lines jsonb,
    remarks text,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36),
    updated_by character varying(36)
);


ALTER TABLE warehouse.transfers OWNER TO postgres;

--
-- Name: warehouses; Type: TABLE; Schema: warehouse; Owner: postgres
--

CREATE TABLE warehouse.warehouses (
    id character varying(36) NOT NULL,
    name character varying(200) NOT NULL,
    code character varying(50) NOT NULL,
    location_id character varying(36),
    type character varying(50),
    capacity jsonb,
    is_active boolean DEFAULT true,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36)
);


ALTER TABLE warehouse.warehouses OWNER TO postgres;

--
-- Name: zones; Type: TABLE; Schema: warehouse; Owner: postgres
--

CREATE TABLE warehouse.zones (
    id character varying(36) NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(50) NOT NULL,
    warehouse_id character varying(36),
    type character varying(50),
    capacity jsonb,
    is_active boolean DEFAULT true,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE warehouse.zones OWNER TO postgres;

--
-- Name: approval_matrix; Type: TABLE; Schema: workflow; Owner: postgres
--

CREATE TABLE workflow.approval_matrix (
    id character varying(36) NOT NULL,
    module character varying(50),
    document_type character varying(50),
    conditions jsonb,
    approvers jsonb NOT NULL,
    is_active boolean DEFAULT true,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE workflow.approval_matrix OWNER TO postgres;

--
-- Name: definitions; Type: TABLE; Schema: workflow; Owner: postgres
--

CREATE TABLE workflow.definitions (
    id character varying(36) NOT NULL,
    name character varying(200) NOT NULL,
    code character varying(50) NOT NULL,
    module character varying(50),
    steps jsonb NOT NULL,
    is_active boolean DEFAULT true,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    created_by character varying(36),
    updated_by character varying(36)
);


ALTER TABLE workflow.definitions OWNER TO postgres;

--
-- Name: instances; Type: TABLE; Schema: workflow; Owner: postgres
--

CREATE TABLE workflow.instances (
    id character varying(36) NOT NULL,
    definition_id character varying(36),
    entity_type character varying(100),
    entity_id character varying(36),
    current_step integer DEFAULT 0,
    status character varying(20) DEFAULT 'pending'::character varying,
    initiated_by character varying(36),
    data jsonb DEFAULT '{}'::jsonb,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE workflow.instances OWNER TO postgres;

--
-- Name: routing_steps; Type: TABLE; Schema: workflow; Owner: postgres
--

CREATE TABLE workflow.routing_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    routing_id uuid NOT NULL,
    process_no integer NOT NULL,
    subprocess_no integer,
    step_code character varying(20) NOT NULL,
    step_name character varying(200) NOT NULL,
    description text DEFAULT ''::text,
    is_deleted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT routing_steps_process_no_check CHECK (((process_no >= 1) AND (process_no <= 80))),
    CONSTRAINT routing_steps_subprocess_no_check CHECK (((subprocess_no >= 1) AND (subprocess_no <= 80)))
);


ALTER TABLE workflow.routing_steps OWNER TO postgres;

--
-- Name: routings; Type: TABLE; Schema: workflow; Owner: postgres
--

CREATE TABLE workflow.routings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    part_number character varying(100) NOT NULL,
    part_description text DEFAULT ''::text,
    revision character varying(20) DEFAULT '1'::character varying,
    status character varying(30) DEFAULT 'draft'::character varying,
    notes text DEFAULT ''::text,
    tenant_id character varying(100) DEFAULT ''::character varying,
    created_by character varying(200) DEFAULT ''::character varying,
    is_deleted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE workflow.routings OWNER TO postgres;

--
-- Name: step_machines; Type: TABLE; Schema: workflow; Owner: postgres
--

CREATE TABLE workflow.step_machines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    step_id uuid NOT NULL,
    machine_id uuid NOT NULL,
    cycle_time_minutes numeric(12,4) DEFAULT 0 NOT NULL,
    is_preferred boolean DEFAULT false,
    notes text DEFAULT ''::text,
    is_deleted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE workflow.step_machines OWNER TO postgres;

--
-- Name: steps; Type: TABLE; Schema: workflow; Owner: postgres
--

CREATE TABLE workflow.steps (
    id character varying(36) NOT NULL,
    instance_id character varying(36),
    step_number integer,
    approver_id character varying(36),
    status character varying(20) DEFAULT 'pending'::character varying,
    comments text,
    acted_at timestamp without time zone,
    tenant_id character varying(36) NOT NULL,
    is_deleted boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE workflow.steps OWNER TO postgres;

--
-- Data for Name: dashboards; Type: TABLE DATA; Schema: analytics; Owner: postgres
--

COPY analytics.dashboards (id, name, code, layout, widgets, is_default, is_active, tenant_id, is_deleted, version, created_at, updated_at, created_by) FROM stdin;
\.


--
-- Data for Name: reports; Type: TABLE DATA; Schema: analytics; Owner: postgres
--

COPY analytics.reports (id, name, code, module, type, query, parameters, schedule, is_active, tenant_id, is_deleted, version, created_at, updated_at, created_by) FROM stdin;
\.


--
-- Data for Name: login_history; Type: TABLE DATA; Schema: audit; Owner: postgres
--

COPY audit.login_history (id, user_id, email, tenant_id, login_at, ip_address, user_agent, login_type, logout_at) FROM stdin;
ab96887f-daa0-4df8-a9bf-14726ddce6e0	301b5714-7898-4484-834c-9257d0ad5a82	orgadmin@acme.com	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-09 09:48:12.741937	127.0.0.1	Werkzeug/3.1.8	organization	\N
ffda0806-75d8-4679-91a6-b0b8edb816f2	301b5714-7898-4484-834c-9257d0ad5a82	orgadmin@acme.com	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-09 09:48:51.451327	127.0.0.1	Werkzeug/3.1.8	organization	\N
c984e372-470c-4b1f-8e11-aab55f987c32	301b5714-7898-4484-834c-9257d0ad5a82	orgadmin@acme.com	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-09 09:49:41.671889	127.0.0.1	Werkzeug/3.1.8	organization	\N
8556c832-0500-4357-9ea8-9d9c052c486b	301b5714-7898-4484-834c-9257d0ad5a82	orgadmin@acme.com	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-09 09:52:16.854959	127.0.0.1	Werkzeug/3.1.8	organization	\N
f4690e1e-825a-4167-b30b-76122104a8b7	301b5714-7898-4484-834c-9257d0ad5a82	orgadmin@acme.com	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-09 09:58:37.03568	127.0.0.1	Werkzeug/3.1.8	organization	\N
b2b05828-5ba3-4c7a-b806-9e72e6eef05d	301b5714-7898-4484-834c-9257d0ad5a82	orgadmin@acme.com	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-09 09:58:47.464234	127.0.0.1	Werkzeug/3.1.8	organization	\N
091e02b0-e5b5-431a-ba41-54512d10c643	5e0b7eb0-96a4-4506-89c5-c03a98ab1b3a	admin@supersystems.in	platform	2026-07-09 10:00:06.181005	127.0.0.1	Werkzeug/3.1.8	super_admin	\N
cbdc5eae-f311-4925-8cda-d7aebfb7720f	5e0b7eb0-96a4-4506-89c5-c03a98ab1b3a	admin@supersystems.in	platform	2026-07-09 10:00:46.064401	127.0.0.1	Werkzeug/3.1.8	super_admin	\N
7430ab71-2a2b-463f-8f70-eb54715d2612	301b5714-7898-4484-834c-9257d0ad5a82	orgadmin@acme.com	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-09 10:43:55.819962	127.0.0.1	Werkzeug/3.1.8	organization	\N
2f9a53ee-5008-4a17-a0db-a9c745708568	5e0b7eb0-96a4-4506-89c5-c03a98ab1b3a	admin@supersystems.in	platform	2026-07-09 10:43:56.085757	127.0.0.1	Werkzeug/3.1.8	super_admin	\N
1697dbf8-3cb6-4f0d-9efa-4764663cbfae	1cbd8975-63b4-4e69-9def-5cecd488cd12	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-17 16:56:04.655462	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	organization	\N
abf40ab8-ff9d-4ecb-b963-073ce229bbe6	1cbd8975-63b4-4e69-9def-5cecd488cd12	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-18 10:42:44.260023	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	organization	\N
e02f88c4-2fb7-4cc8-9712-c3b9dd0dcf7f	f30f587a-b87e-4e50-a384-051d548b6cc8	ps@supersystme.in	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-18 11:00:22.476278	192.168.1.10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36	organization	\N
434a2ff8-6902-45f4-b985-b017d3d21bae	1cbd8975-63b4-4e69-9def-5cecd488cd12	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-18 11:46:56.534202	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	organization	\N
797adb47-aa3e-4b6e-82d3-f77444fa4792	cc28f720-ce31-451b-9b52-975059a7a2a4	neha.singh@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-18 12:13:12.295501	192.168.1.29	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	organization	\N
956f9db3-7467-4694-b395-fc1ce5d7f7d0	cc28f720-ce31-451b-9b52-975059a7a2a4	neha.singh@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-18 12:23:39.094705	192.168.1.12	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	organization	\N
46243557-70d6-4dc8-bcd2-c995115a3a03	1cbd8975-63b4-4e69-9def-5cecd488cd12	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-18 12:53:34.360777	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	organization	\N
3c8e85a7-7b43-4f27-bbbf-56a4e06a92e2	1cbd8975-63b4-4e69-9def-5cecd488cd12	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-18 14:02:43.153312	127.0.0.1	Werkzeug/3.1.8	organization	\N
a67f39ff-867e-468b-9b85-6d287921720a	f98dcc91-7d08-4f2d-997b-ac22132846cf	rahul.sharma@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-18 12:38:41.982149	192.168.1.29	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	organization	2026-07-18 14:03:20.850249
b220b869-aaa3-42f6-af32-fe852ef6244c	f98dcc91-7d08-4f2d-997b-ac22132846cf	rahul.sharma@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-18 13:40:55.605419	192.168.1.29	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	organization	2026-07-18 14:03:20.850249
81999a04-e382-4e1b-9ee3-b5f5edd159a2	f98dcc91-7d08-4f2d-997b-ac22132846cf	rahul.sharma@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-18 14:03:00.458418	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	organization	2026-07-18 14:03:20.850249
5f38b0da-782f-46b4-a7b9-2ddf041d96a7	1cbd8975-63b4-4e69-9def-5cecd488cd12	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-18 14:04:04.467301	127.0.0.1	Werkzeug/3.1.8	organization	\N
56f56c38-cb6f-46f9-9163-c109fcd8ddf5	1cbd8975-63b4-4e69-9def-5cecd488cd12	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-18 14:07:17.428609	127.0.0.1	Werkzeug/3.1.8	organization	\N
615c78db-7d26-42fa-b570-cc1865895cc9	1cbd8975-63b4-4e69-9def-5cecd488cd12	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-18 14:07:17.680099	127.0.0.1	Werkzeug/3.1.8	organization	\N
a5adf952-1ec4-4a38-969e-c48eb59f4f39	1cbd8975-63b4-4e69-9def-5cecd488cd12	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-18 14:10:40.573776	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	organization	\N
f170e16b-a23f-4f6d-ae26-492a9c2e5470	1cbd8975-63b4-4e69-9def-5cecd488cd12	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-18 15:15:39.531712	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	organization	\N
c833720c-5963-4651-b874-327c03ed1a14	d0f6ebe0-a7d2-46d1-8f2a-510c742945ec	mandeep@supersystems.in	platform	2026-07-20 12:21:34.382681	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	super_admin	\N
5a7260cd-3f91-43e3-8c30-6d0a41580223	d0f6ebe0-a7d2-46d1-8f2a-510c742945ec	mandeep@supersystems.in	platform	2026-07-20 15:47:33.915917	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	super_admin	\N
32f276fc-d1a6-4f96-8beb-07fca20dee36	1cbd8975-63b4-4e69-9def-5cecd488cd12	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-20 17:33:21.770548	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	organization	\N
13f562c9-bba1-45d9-8808-fec526ce4d25	1cbd8975-63b4-4e69-9def-5cecd488cd12	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-21 10:43:03.406008	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	organization	\N
8ea10865-3727-4fbe-9d88-353e440de9be	1cbd8975-63b4-4e69-9def-5cecd488cd12	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-21 11:51:50.058772	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	organization	\N
21a87709-eda1-4f9b-9e0c-037ba346b0c5	1cbd8975-63b4-4e69-9def-5cecd488cd12	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-21 12:55:54.802173	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	organization	\N
be8e1b1f-dad8-4d19-98e6-39fd0ebe8245	1cbd8975-63b4-4e69-9def-5cecd488cd12	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-21 14:00:35.372977	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	organization	\N
55a11e80-f07f-4935-bc3d-226ff1410ec3	1cbd8975-63b4-4e69-9def-5cecd488cd12	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-21 15:27:16.155516	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	organization	\N
\.


--
-- Data for Name: logs; Type: TABLE DATA; Schema: audit; Owner: postgres
--

COPY audit.logs (id, user_id, action, module, entity_type, entity_id, old_values, new_values, ip_address, user_agent, extra_data, tenant_id, is_deleted, version, created_at, user_email, user_name) FROM stdin;
614d3fab-76b2-49e8-839e-b5ca331c2a43	\N	UPDATE	IAM	Organization	b166190a-f949-4912-98c3-a8b858dd39a4	\N	\N	127.0.0.1	\N	\N	DEMO	f	1	2026-07-08 16:16:30.073554	\N	\N
926c075b-2459-4e89-b9ad-c7def367db6b	\N	CREATE	Part Management	Category	4a26f60f-acca-4850-8bfa-940fc4721209	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-09 16:25:00.508862	\N	\N
6bdacb74-12ac-4bbe-990d-a3b024360dd2	\N	CREATE	Part Management	Subcategory	4816e4bd-7118-4748-ae09-300ee2955d9b	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-09 16:25:00.541092	\N	\N
72c1ec25-c716-43b2-8cd6-9ce1b31f1833	\N	GENERATE	Part Management	Part	700-1-000001	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-09 16:25:00.598934	\N	\N
487e0949-1c0d-4a79-b261-07f19989f120	\N	OBSOLETE	Part Management	Part	700-1-000001	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-09 16:25:00.616106	\N	\N
abd13e1f-ecc6-44b4-94d6-f679ab0b40f2	\N	DELETE	Part Management	Subcategory	4816e4bd-7118-4748-ae09-300ee2955d9b	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-09 16:25:00.634785	\N	\N
f11d52c2-0d1f-4025-a738-849d406590de	\N	DELETE	Part Management	Category	4a26f60f-acca-4850-8bfa-940fc4721209	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-09 16:25:00.661885	\N	\N
9179c1b3-c09f-47d0-b497-cb5e4e880351	\N	EXPORT	Part Management	categories	test.csv	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-09 17:39:47.589353		
0b85ca11-b141-48fd-b676-d011472c9076	\N	TEMPLATE_DOWNLOAD	Part Management	allparts	parts_import_template.csv	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-09 17:40:49.143527		
d7570e35-77fd-4e6f-95f5-fa644be9a1c8	\N	CREATE	Part Management	Category	e7a2c82f-a646-4c80-a4dd-156e3169b6eb	\N	\N	192.168.1.4	\N	\N	TEST	f	1	2026-07-09 17:47:44.068686		
decf9ca4-1339-432c-8596-c8b6de2b40e8	\N	DELETE	Part Management	Category	e7a2c82f-a646-4c80-a4dd-156e3169b6eb	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-13 10:47:46.798525		
3a553f46-5f7a-49a0-9056-799d3e1ac85c	\N	DELETE	Part Management	Category	2fdf7bc4-c3c6-4367-8f0f-6a18cf516786	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-13 10:47:48.728878		
0ec3570c-d49f-47ed-bec1-21359f38bded	\N	DELETE	Part Management	Category	6adf2e44-275f-4add-9ef7-983bc4f6b092	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-13 10:47:50.755437		
8bb59423-7bbe-4a78-9c9a-48fa11b6daa6	\N	CREATE	Part Management	Category	c173247c-d3ea-4dc8-bcd1-f32abd293dc0	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-13 10:54:55.891488		
307c1bd4-5bd3-4203-98c9-2c895b426706	\N	CREATE	Part Management	Subcategory	6678e956-ef58-4a7e-a619-af71766321e2	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-13 10:55:29.994499		
1ea272e8-da92-42d7-9af4-e0dc188e7cef	\N	GENERATE	Part Management	Part	100-1001-000001	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-16 11:31:05.682518		
9c2fe00e-9d32-47a6-a00e-daf95597ac88	\N	GENERATE	Part Management	Part	100-1001-000002	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-16 11:31:06.49044		
9e6aa4da-3243-4e69-9e30-8ae7cc75829d	\N	GENERATE	Part Management	Part	100-1001-000003	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-16 11:31:07.04366		
45de488a-bd40-40a2-b897-7760daf0768c	\N	CREATE	Part Management	Part Mapping	MP-MP-BR-000001 -> FP-HB-0001	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-16 16:49:49.832444		
f0bbc7bf-45a9-4cd0-b3ce-05f9b50ab230	\N	CREATE	Raw Material Management	RM Criteria	167d7a41-d44a-4715-8f56-151f59e3b6d3	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-16 17:57:19.59319		
51646629-8063-4955-87d4-2067161be284	\N	CREATE	Raw Material Management	Raw Material	STL.0001	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-16 17:57:39.248162		
e249cd25-5304-4b07-a337-8b0a64bf608b	\N	CREATE	Raw Material Management	RM Criteria	0998f9da-b3ef-48cf-95d9-fffcf02a7e20	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-16 17:57:57.953402		
ff0a9f50-ca4e-49fd-9965-b4a379c7ee26	\N	CREATE	Raw Material Management	Raw Material	PLS/0001	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-16 17:57:57.960517		
a1f7cc1e-6dbd-4cc5-96bd-5fa91b96b9e1	\N	CREATE	Raw Material Management	RM Criteria	2b11f808-e1a8-46ab-bdaf-70a8e378b9d0	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-16 18:05:24.786611		
f800954e-4e63-46d9-a02a-6fd1feb957a3	\N	CREATE	Raw Material Management	Raw Material	601-0001	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-16 18:06:17.56022		
b6a15e90-fefc-4c51-907f-356c02a16bce	\N	CREATE	Raw Material Management	RM-Part Mapping	601-0001 -> MP-MP-GR-000001	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-16 18:07:00.123528		
e4652921-6972-480b-abba-46aeb10169a3	\N	IMPORT_EMPLOYEE	Auth & Security	User	mandeep@supersystems.in	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 10:38:38.326267		
aba1e58a-c638-4317-9db0-e2a5ac5dd64e	\N	GRANT_ACCESS	Part Management	Module User	mandeep@supersystems.in	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 10:38:43.739438		
b1fb9fdd-580c-4f91-a13a-9fad53d46c29	\N	CREATE	Supplier Management	Supplier	b381790b-38ca-4466-b4da-27abf638367c	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 11:55:06.388965		
9339414e-7bda-4dcd-b397-0aeb2d06c4bc	\N	CREATE	Supplier Management	Supplier	01de0d51-79e3-4cd7-b6b8-55feae37eae8	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 12:22:26.325426		
d4448830-936a-422e-aa78-aa0a1fc145d2	\N	CREATE	Machine Management	Machine	cc2a1210-447a-4def-b2c1-f714a27e57ea	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 15:05:53.620039		
289bdcd4-92eb-40d6-af83-b44cac0080f2	\N	GENERATE	Part Management	Part	MP-MP-GR-000004	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 15:07:50.842527		
a9aa39c9-2065-45ee-a422-479a70b852d1	\N	CREATE	Workflow & Costing	Routing	6117bd52-753f-4d8d-81a4-3f45fdf2dc42	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 15:08:08.720111		
3826930b-a20d-4596-9b06-5d02ca9a8a7e	\N	CREATE	Workflow & Costing	Routing Step	200a74ee-48f5-43da-a51b-d2a50189887e	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 15:20:12.977992		
5e03946b-94a7-4828-92cd-cb0715831d09	\N	CREATE	Workflow & Costing	Routing Step	34aa119f-f318-4062-9c79-cb14f99db92e	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 15:20:16.735304		
88156d69-be2e-4ab6-bd37-c184a7c85005	\N	CREATE	Workflow & Costing	Routing Step	b79298da-ac09-4b91-84d6-e8f87205640a	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 15:24:48.187976		
364512a1-f6cf-4d7c-992f-875ff329e78d	\N	CREATE	Workflow & Costing	Routing Step	970dc161-f46d-4e28-abaa-e6442c801caf	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 15:30:13.271906		
75bbfeaa-d9f2-42ed-b50f-edd966f22765	\N	CREATE	Workflow & Costing	Step Machine	c89e11ad-5691-47f2-bc9c-cc72568f1f20	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 16:11:13.005941		
a011ccc6-27d8-4f97-b874-01968d597ccd	\N	CREATE	Machine Management	Station	ac502e1c-89c4-4b73-9abf-52703128a80f	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 16:13:06.316698		
f06ed752-4bd9-4daa-abd9-493c8f73dd21	\N	CREATE	Part Management	Category	d2c728b6-e9b5-4eb9-b6c1-70ffe6bc4471	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 16:14:31.930131		
1283a042-1317-4347-8781-21cf2ad6bca4	\N	CREATE	Part Management	Subcategory	5ab4f508-f6bc-488b-964b-c47bad535eda	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 16:15:09.777368		
c817810b-b9f3-4cdb-ab20-cf67baf0a974	\N	GENERATE	Part Management	Part	MP-MP-BR-000004	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 16:20:43.901767	a@b.com	Test
561d71aa-c87d-4ad4-9dcb-9cebee83a3c0	\N	GENERATE	Part Management	Part	MP-MP-SH-000003	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 16:21:31.973907	a@b.com	Test
c263b2c0-d8d1-4fa3-beda-a758c0387b83	\N	GENERATE	Part Management	Part	EP-EP-MT-000004	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 16:21:31.982014	a@b.com	Test
0a07220f-5849-40d6-a066-8ce5732cc6bf	\N	GENERATE	Part Management	Part	EP-EP-SN-000003	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 16:21:31.985668	a@b.com	Test
d61e01d9-49eb-4e3d-a598-910aabc74259	\N	GENERATE	Part Management	Part	HP-HP-CY-000003	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 16:21:31.989069	a@b.com	Test
e75902a7-7891-4106-8549-09c5d6a75a33	\N	GENERATE	Part Management	Part	100-1001-000004	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 16:21:31.992525	a@b.com	Test
149b3b66-d116-4250-9a5b-88b04fd0fda1	\N	GENERATE	Part Management	Part	MP-MP-GR-000005	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 16:21:31.998328	a@b.com	Test
1191c829-b157-4239-a7f6-98dc1f02ff83	\N	GENERATE	Part Management	Part	HP-HP-PM-000003	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 16:21:32.004705	a@b.com	Test
5512db1d-ec38-49ee-a932-9639df8bca99	\N	GENERATE	Part Management	Part	PP-PP-VL-000003	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 16:21:32.008969	a@b.com	Test
bb1b0dfc-d986-4ef0-8e43-187f6f4e2d08	\N	GENERATE	Part Management	Part	PP-PP-AC-000003	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 16:21:32.013323	a@b.com	Test
9d7805fc-e01b-4800-8e91-f964ec6fe1f2	\N	GENERATE	Part Management	Part	FP-FP-HB-000003	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 16:21:32.017355	a@b.com	Test
d3f0835a-583b-48d5-a1db-4d20de36e830	\N	GENERATE	Part Management	Part	FP-FP-LN-000003	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 16:21:32.02143	a@b.com	Test
e70ad769-e8cb-4ba6-8fca-9e73f0b3454c	\N	GENERATE	Part Management	Part	601.1.000001	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 16:23:55.384809	a@b.com	Test
85ee6c5c-810b-47b1-a1f6-71986bcca211	\N	GENERATE	Part Management	Part	601.1.000002	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 16:24:23.353396		
fc61aa9f-b3dd-425f-8397-b279e9d36af4	\N	GENERATE	Part Management	Part	601.1.000003	\N	\N	127.0.0.1	\N	\N	TEST	f	1	2026-07-17 16:24:35.841845		
dde22015-9f05-467c-8585-7076fde3cad1	\N	IMPORT_EMPLOYEE	Auth & Security	User	ss/60002@system.local	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-17 17:51:08.871437	mandeep@supersystems.in	
c836ba8b-6906-4b8a-af59-30175daf61c7	\N	IMPORT_EMPLOYEE	Auth & Security	User	ps@supersystme.in	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 10:59:00.238154	mandeep@supersystems.in	
871b8caa-14d0-4a8e-bcea-91d22330b2ac	\N	UPDATE	Auth & Security	User	f30f587a-b87e-4e50-a384-051d548b6cc8	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 10:59:46.505403	mandeep@supersystems.in	
a1585aa6-859f-4256-a872-96d1453304c2	\N	UPDATE_PERMISSIONS	Auth & Security	Module Access	8b7e151a-9127-4eea-b83e-6c66975dec64	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 12:05:33.297898	mandeep@supersystems.in	
e1597b7c-e858-4399-8985-1a1f64fc0a9c	\N	UPDATE_PERMISSIONS	Auth & Security	Module Access	7bab18c5-bd4b-4676-a53d-85e6f814448e	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 12:05:38.533145	mandeep@supersystems.in	
35d023ca-819c-496a-ad6d-a7a549ec791b	\N	UPDATE_PERMISSIONS	Auth & Security	Module Access	7bab18c5-bd4b-4676-a53d-85e6f814448e	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 12:05:45.070409	mandeep@supersystems.in	
c3e3c96e-f9f9-47ea-8d11-492d8a10ee67	\N	CREATE	Auth & Security	User	usernew@supersystems.in	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 12:08:53.106661		
8eb169db-15b1-440b-a05f-1766c10fdfd4	\N	CREATE	Auth & Security	User	usernew2@supersystems.in	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 12:09:46.727214		
478258b6-7227-4e6a-a9cc-4e05fff863f8	\N	UPDATE	Auth & Security	User	cc28f720-ce31-451b-9b52-975059a7a2a4	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 12:12:41.433087	mandeep@supersystems.in	
27e19b5f-32de-4418-b975-63d3ce1de930	\N	UPDATE_PERMISSIONS	Auth & Security	Module Access	7bab18c5-bd4b-4676-a53d-85e6f814448e	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 12:13:38.644528	mandeep@supersystems.in	
5db84672-3685-4800-a168-6a71d57060a3	\N	UPDATE	Auth & Security	User	f98dcc91-7d08-4f2d-997b-ac22132846cf	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 12:38:12.230904	mandeep@supersystems.in	
699f525d-5e1c-4f15-bc2e-5b34ae622c55	\N	UPDATE_PERMISSIONS	Auth & Security	Module Access	ef2ee315-40bd-4ae7-bc58-91d0d1123a31	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 12:41:15.930649	mandeep@supersystems.in	
7a3b555f-bd11-4c5d-9a17-a51347d24e28	\N	UPDATE_PERMISSIONS	Auth & Security	Module Access	ef2ee315-40bd-4ae7-bc58-91d0d1123a31	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 12:41:36.133356	mandeep@supersystems.in	
1db1c60c-8d3c-4524-8956-9538e1dce46c	\N	UPDATE_PERMISSIONS	Auth & Security	Module Access	ef2ee315-40bd-4ae7-bc58-91d0d1123a31	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 12:41:44.853295	mandeep@supersystems.in	
c64b6bfc-ca68-461f-8a0c-270be79617d5	\N	UPDATE_PERMISSIONS	Auth & Security	Module Access	ef2ee315-40bd-4ae7-bc58-91d0d1123a31	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 12:41:58.948945	mandeep@supersystems.in	
52da4536-c57e-412e-a949-1c82171e3cc6	\N	UPDATE_PERMISSIONS	Auth & Security	Module Access	ef2ee315-40bd-4ae7-bc58-91d0d1123a31	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 12:53:54.967678	mandeep@supersystems.in	
1bb52c94-a433-4619-8bb2-5ef40b1edf5d	\N	UPDATE_PERMISSIONS	Auth & Security	Module Access	ef2ee315-40bd-4ae7-bc58-91d0d1123a31	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 12:54:00.762147	mandeep@supersystems.in	
6042a023-f356-4932-844a-b84ca98bea1b	\N	UPDATE_ACCESS	Auth & Security	Module Access	ef2ee315-40bd-4ae7-bc58-91d0d1123a31	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 13:27:20.238221	mandeep@supersystems.in	
8d241429-31b5-4911-92fc-d199c0b86114	\N	UPDATE_ACCESS	Auth & Security	Module Access	59c2cda5-a953-4002-81e7-65bf8059c015	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 13:28:30.479567		
113b0dc0-760a-4d88-92e8-d61679b7b978	\N	UPDATE_ACCESS	Auth & Security	Module Access	59c2cda5-a953-4002-81e7-65bf8059c015	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 13:29:00.472152		
a6a39cf5-04ad-4345-afb6-5496195408b2	\N	UPDATE_ACCESS	Auth & Security	Module Access	ef2ee315-40bd-4ae7-bc58-91d0d1123a31	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 13:32:08.901155	mandeep@supersystems.in	
3ebc0f8e-020e-4a62-8415-275c4c9b7393	\N	UPDATE_ACCESS	Auth & Security	Module Access	59c2cda5-a953-4002-81e7-65bf8059c015	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 13:38:45.720009	mandeep@supersystems.in	
6d980d2d-0723-4701-8214-973ddd869a9b	\N	UPDATE_ACCESS	Auth & Security	Module Access	64e8e1bb-c6dc-4042-a2c7-fa85f8de3042	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 13:38:45.721051	mandeep@supersystems.in	
8a32a136-b71a-40bb-9732-19a47f74de06	\N	UPDATE_ACCESS	Auth & Security	Module Access	64e8e1bb-c6dc-4042-a2c7-fa85f8de3042	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 13:40:07.217955	mandeep@supersystems.in	
b908fdeb-1307-4b13-bfc6-c019580e17f1	\N	UPDATE_ACCESS	Auth & Security	Module Access	59c2cda5-a953-4002-81e7-65bf8059c015	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 13:40:07.21813	mandeep@supersystems.in	
ba10e295-0c3f-4d5a-a9c8-f5b941c483aa	\N	LOGIN	Auth & Security	User Session	1cbd8975-63b4-4e69-9def-5cecd488cd12	\N	\N	127.0.0.1	Werkzeug/3.1.8	{"status": "SUCCESS", "login_type": "organization"}	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:02:43.153312	mandeep@supersystems.in	Mandeep Siwach
6db27aa9-eab4-4723-81ec-5be07d3bf7ed	\N	LOGIN	Auth & Security	User Session	f98dcc91-7d08-4f2d-997b-ac22132846cf	\N	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{"status": "SUCCESS", "login_type": "organization"}	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:03:00.458418	rahul.sharma@supersystems.in	Rahul Sharma
603fb991-267b-4791-902b-f3c05734b190	\N	LOGOUT	Auth & Security	User Session		\N	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{"status": "SUCCESS"}	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:03:20.850249	rahul.sharma@supersystems.in	\N
e051b489-fd40-46b0-bd87-f66977ffa383	\N	LOGIN	Auth & Security	User Session	1cbd8975-63b4-4e69-9def-5cecd488cd12	\N	\N	127.0.0.1	Werkzeug/3.1.8	{"status": "SUCCESS", "login_type": "organization"}	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:04:04.467301	mandeep@supersystems.in	Mandeep Siwach
0479e356-db64-418f-bb00-33e4e2aac07d	\N	LOGIN	Auth & Security	User Session	1cbd8975-63b4-4e69-9def-5cecd488cd12	\N	\N	127.0.0.1	Werkzeug/3.1.8	{"status": "SUCCESS", "login_type": "organization"}	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:07:17.428609	mandeep@supersystems.in	Mandeep Siwach
92ba7b8b-df87-4973-9c77-ca6f4bc3be1e	\N	LOGIN	Auth & Security	User Session	1cbd8975-63b4-4e69-9def-5cecd488cd12	\N	\N	127.0.0.1	Werkzeug/3.1.8	{"status": "SUCCESS", "login_type": "organization"}	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:07:17.680099	mandeep@supersystems.in	Mandeep Siwach
142e5201-f711-4097-a9e9-6d4ba90c8373	\N	LOGIN	Auth & Security	User Session	1cbd8975-63b4-4e69-9def-5cecd488cd12	\N	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{"status": "SUCCESS", "login_type": "organization"}	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:10:40.573776	mandeep@supersystems.in	Mandeep Siwach
23f4d351-121a-4052-9c7e-17ee508f0f90	\N	UPDATE_ACCESS	Auth & Security	Module Access	13a5b055-60e6-4513-94ec-c59d87ab59c3	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:11:43.181599	mandeep@supersystems.in	
2001a21a-7f99-4ba5-a64b-a982df9e8f57	\N	UPDATE_ACCESS	Auth & Security	Module Access	59c2cda5-a953-4002-81e7-65bf8059c015	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:11:43.294359	mandeep@supersystems.in	
b1093017-cdd0-48b2-9fd8-a6a4bd358b6f	\N	UPDATE_ACCESS	Auth & Security	Module Access	64e8e1bb-c6dc-4042-a2c7-fa85f8de3042	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:11:43.29524	mandeep@supersystems.in	
686c95df-7c43-45f4-9d62-eed4ff7944c6	\N	UPDATE_ACCESS	Auth & Security	Module Access	6285e50a-1549-445b-b063-3e4231a98026	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:23:07.256261	mandeep@supersystems.in	
a8caac3b-2d2f-4bb5-b706-22ebe0bb9c35	\N	UPDATE_ACCESS	Auth & Security	Module Access	13a5b055-60e6-4513-94ec-c59d87ab59c3	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:23:07.263607	mandeep@supersystems.in	
d44835f4-c7d2-4744-9297-30d2edb3a1b4	\N	UPDATE_ACCESS	Auth & Security	Module Access	b691769f-263f-494f-8e19-bd4186a4f411	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:23:07.279039	mandeep@supersystems.in	
355b7776-f74e-4020-b8ef-b2c1ab8c36b1	\N	UPDATE_ACCESS	Auth & Security	Module Access	59c2cda5-a953-4002-81e7-65bf8059c015	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:23:07.290006	mandeep@supersystems.in	
1280108f-6f2e-492c-acf9-73225695adc6	\N	UPDATE_ACCESS	Auth & Security	Module Access	b69e0df5-6b15-418d-afa1-c423f07bb896	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:23:07.29029	mandeep@supersystems.in	
2f0c89f6-237d-4e35-9c5d-36abf64bccb9	\N	UPDATE_ACCESS	Auth & Security	Module Access	5856805c-e783-4e44-98cc-f8adcea52482	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:23:07.299748	mandeep@supersystems.in	
d47e3c31-3ef5-4dbd-8b72-406072d0c653	\N	UPDATE_ACCESS	Auth & Security	Module Access	2fe32080-8ea6-4884-9d5b-f3830bc63706	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:23:07.302621	mandeep@supersystems.in	
12c9b0be-8f70-48e3-8c3e-ebd14bef2db4	\N	UPDATE_ACCESS	Auth & Security	Module Access	62885e20-115a-4644-a55f-c10c68e1eb46	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:23:07.303391	mandeep@supersystems.in	
08613da9-0821-4bc6-b8eb-8497b4d1f9fc	\N	UPDATE_ACCESS	Auth & Security	Module Access	541bafc4-ba05-4300-964c-fbc26dea0531	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:23:07.308924	mandeep@supersystems.in	
09c6ab8a-4f11-4fcf-b374-ecd8c2d6ee03	\N	UPDATE_ACCESS	Auth & Security	Module Access	18b40034-17a5-402b-8b35-2476899b1217	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:23:07.30953	mandeep@supersystems.in	
f7fab082-79b3-441f-95bc-454574fef798	\N	UPDATE_ACCESS	Auth & Security	Module Access	ccf6e752-5872-473f-b94c-016fe79b54f4	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:23:07.319959	mandeep@supersystems.in	
ea7534ca-4adb-4ca1-9e74-9a6a374e9477	\N	UPDATE_ACCESS	Auth & Security	Module Access	04b7454c-cba9-47cf-ba7b-500c4e166439	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:23:07.327979	mandeep@supersystems.in	
a946b35f-27a1-457a-bda7-60b01ff78ba2	\N	UPDATE_ACCESS	Auth & Security	Module Access	edade1fa-a67e-47ff-aec8-eaf27ef2dc5c	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:23:07.333402	mandeep@supersystems.in	
77e2999a-90b0-4ed1-8f08-d36b71b93264	\N	UPDATE_ACCESS	Auth & Security	Module Access	64e8e1bb-c6dc-4042-a2c7-fa85f8de3042	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:23:07.334069	mandeep@supersystems.in	
701f29de-7969-4153-83d7-841b51ee3bed	\N	UPDATE_ACCESS	Auth & Security	Module Access	972c5c98-7785-4ced-8e7e-6b2614c67a07	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:23:07.341492	mandeep@supersystems.in	
afbbb9a0-1ac2-491a-aa1e-2657f90c4bfe	\N	UPDATE_ACCESS	Auth & Security	Module Access	d3e38870-9523-4539-bf32-23a1067e7633	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:23:07.341119	mandeep@supersystems.in	
0ddebd8f-5e48-4db8-a6c9-5394d097e59b	\N	UPDATE_ACCESS	Auth & Security	Module Access	849db03a-c455-4e93-86c0-84dcc4177812	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:23:07.352109	mandeep@supersystems.in	
99d075b2-77e6-4812-88ee-cbdbd5f659a6	\N	UPDATE_ACCESS	Auth & Security	Module Access	303be7a2-ae39-4651-8e13-380536b54f46	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:23:07.352364	mandeep@supersystems.in	
96e30dd7-9939-4a8a-8437-3a3c855782e4	\N	UPDATE_ACCESS	Auth & Security	Module Access	66b43ab1-a5b2-4251-a9f7-3d5a0b8a4fc1	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:23:07.353068	mandeep@supersystems.in	
6213bb4e-5f21-4a45-b8c0-9c6b43dbcd47	\N	UPDATE_ACCESS	Auth & Security	Module Access	d4ebfa29-9a59-44ef-b045-9d799732e086	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:23:07.362146	mandeep@supersystems.in	
a8d34270-0235-4ed9-bc4f-506cdf7f230d	\N	UPDATE_ACCESS	Auth & Security	Module Access	5856805c-e783-4e44-98cc-f8adcea52482	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:30:24.398676	mandeep@supersystems.in	
bc923d98-1018-4efc-a90a-cc47116bd736	\N	UPDATE_ACCESS	Auth & Security	Module Access	2fe32080-8ea6-4884-9d5b-f3830bc63706	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:30:24.433509	mandeep@supersystems.in	
d8e970e4-123d-4c34-bac8-9368d90bc67b	\N	UPDATE_ACCESS	Auth & Security	Module Access	edade1fa-a67e-47ff-aec8-eaf27ef2dc5c	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:30:24.468638	mandeep@supersystems.in	
8a22e3e6-fe58-4f18-97f6-c8642886ea36	\N	UPDATE_ACCESS	Auth & Security	Module Access	849db03a-c455-4e93-86c0-84dcc4177812	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:30:24.480568	mandeep@supersystems.in	
30a0351a-631b-46d1-97b0-e7a79d1d5068	\N	UPDATE_ACCESS	Auth & Security	Module Access	303be7a2-ae39-4651-8e13-380536b54f46	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:30:24.493744	mandeep@supersystems.in	
f9083f9e-b6c3-47e8-800e-9f49a83f6051	\N	UPDATE_ACCESS	Auth & Security	Module Access	54476940-8656-4974-9c58-88d10767564e	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:30:24.506813	mandeep@supersystems.in	
aedbfba1-dab0-4cde-9b05-73e7edafbab6	\N	UPDATE_ACCESS	Auth & Security	Module Access	b691769f-263f-494f-8e19-bd4186a4f411	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:30:24.398343	mandeep@supersystems.in	
8ef95413-6785-403c-bd11-303d4c21ffa8	\N	UPDATE_ACCESS	Auth & Security	Module Access	b69e0df5-6b15-418d-afa1-c423f07bb896	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:30:24.426962	mandeep@supersystems.in	
a8a466f9-40cb-4c7f-94a5-26c8a36fb529	\N	UPDATE_ACCESS	Auth & Security	Module Access	541bafc4-ba05-4300-964c-fbc26dea0531	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:30:24.434983	mandeep@supersystems.in	
a9d6d6ee-0ccb-46b5-9708-67213bbb90cc	\N	UPDATE_ACCESS	Auth & Security	Module Access	ccf6e752-5872-473f-b94c-016fe79b54f4	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:30:24.452215	mandeep@supersystems.in	
bea5644c-2870-4d7b-a027-a3e0f9c873a7	\N	UPDATE_ACCESS	Auth & Security	Module Access	972c5c98-7785-4ced-8e7e-6b2614c67a07	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:30:24.478492	mandeep@supersystems.in	
f6eab802-10f9-4320-8a0d-50420fffb716	\N	UPDATE_ACCESS	Auth & Security	Module Access	9cd926ee-5086-4279-ae77-814735abd9c7	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:30:24.488714	mandeep@supersystems.in	
fedddc91-2ebe-4d72-ae25-d25c8c578949	\N	UPDATE_ACCESS	Auth & Security	Module Access	d4ebfa29-9a59-44ef-b045-9d799732e086	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:30:24.501387	mandeep@supersystems.in	
fcb4dba1-aa5e-44b2-98cd-1ea9e0876ee8	\N	UPDATE_ACCESS	Auth & Security	Module Access	6285e50a-1549-445b-b063-3e4231a98026	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:30:24.397703	mandeep@supersystems.in	
f8a92a36-5809-4a59-8095-f434b5dc3456	\N	UPDATE_ACCESS	Auth & Security	Module Access	64e8e1bb-c6dc-4042-a2c7-fa85f8de3042	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:30:24.458431	mandeep@supersystems.in	
4949a585-6725-493f-8163-1becc9f81759	\N	UPDATE_ACCESS	Auth & Security	Module Access	d3e38870-9523-4539-bf32-23a1067e7633	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:30:24.476237	mandeep@supersystems.in	
483c8788-5d9e-4f1f-b5a0-776723ceff71	\N	UPDATE_ACCESS	Auth & Security	Module Access	66b43ab1-a5b2-4251-a9f7-3d5a0b8a4fc1	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:30:24.498175	mandeep@supersystems.in	
7afc4d48-0a17-42bd-9ce8-cb0a00b17ca5	\N	CREATE	Part Management	Category	978be28c-01bf-404c-a4f0-accd3dd5165d	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:01:01.049986	mandeep@supersystems.in	
ec432500-035f-4292-b373-2457d55e6888	\N	UPDATE_ACCESS	Auth & Security	Module Access	18b40034-17a5-402b-8b35-2476899b1217	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:30:24.39923	mandeep@supersystems.in	
164d4029-fd5d-4254-94c5-2a61f8072c6c	\N	UPDATE_ACCESS	Auth & Security	Module Access	04b7454c-cba9-47cf-ba7b-500c4e166439	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:30:24.454623	mandeep@supersystems.in	
07b58044-c6ac-46f0-bccd-28e0f2b45c81	\N	UPDATE	Part Management	Part	601-1-000002	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 10:50:35.328044	mandeep@supersystems.in	Mandeep Siwach
98acf334-7c0f-4245-b09e-188f15fa3c46	\N	UPDATE	Part Management	Part	601-1-000002	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 10:50:35.330451	mandeep@supersystems.in	Mandeep Siwach
290e5899-fe3b-40ca-bfd5-de486599a740	\N	UPDATE	Part Management	Part	601-1-000002	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 10:50:37.317726	mandeep@supersystems.in	Mandeep Siwach
91fcddc9-990b-404d-8b39-56f358c969dd	\N	UPDATE	Part Management	Part	601-1-000002	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 10:50:37.319659	mandeep@supersystems.in	Mandeep Siwach
4ace1ead-beb1-4d04-a93a-70f3044684c9	\N	UPDATE	Part Management	Part	601-1-000002	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 10:50:41.887556	mandeep@supersystems.in	Mandeep Siwach
badfaadf-77d4-4584-ac2e-dc66c0089e45	\N	UPDATE	Part Management	Part	601-1-000002	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 10:50:41.88994	mandeep@supersystems.in	Mandeep Siwach
b677436a-dded-4416-b031-12a3b7c31ea0	\N	UPDATE	Part Management	Part	601-1-000002	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 10:50:43.934982	mandeep@supersystems.in	Mandeep Siwach
5e17a85f-cacf-40b5-8fe2-0e2b704fe4fa	\N	UPDATE	Part Management	Part	601-1-000002	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 10:50:43.937003	mandeep@supersystems.in	Mandeep Siwach
99b8f316-b218-42ae-9884-7bedded2b82e	\N	UPDATE	Part Management	Part	601-1-000002	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 10:50:46.360185	mandeep@supersystems.in	Mandeep Siwach
0759bef6-f78b-4217-a054-366976ef1f1e	\N	UPDATE	Part Management	Part	601-1-000002	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 10:50:46.361173	mandeep@supersystems.in	Mandeep Siwach
e18fff63-d1a5-4878-a392-09dc6e44f4e9	\N	UPDATE	Part Management	Part	601-1-000002	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 10:50:48.914819	mandeep@supersystems.in	Mandeep Siwach
ddc8ce10-1e14-46bd-b306-a5fe8f7e13e5	\N	UPDATE	Part Management	Part	601-1-000002	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 10:50:48.916387	mandeep@supersystems.in	Mandeep Siwach
fa99fcbb-7b25-45f8-b3c7-5dda0ad037df	\N	UPDATE	Part Management	Part	601-1-000002	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 10:50:50.405434	mandeep@supersystems.in	Mandeep Siwach
6eb50733-22c9-435f-ac5a-a22721a3d6ff	\N	UPDATE	Part Management	Part	601-1-000002	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 10:50:50.407797	mandeep@supersystems.in	Mandeep Siwach
5af8b6ab-9b3d-44de-922a-2c38b18a79ed	\N	UPDATE	Part Management	Part	601-1-000002	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 10:50:52.110059	mandeep@supersystems.in	Mandeep Siwach
91a10ff4-19ca-4767-b6e0-5a9ce9f1c501	\N	UPDATE	Part Management	Part	601-1-000002	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 10:50:52.111959	mandeep@supersystems.in	Mandeep Siwach
5dd132cb-94a9-47ec-9fbe-6c7b4cc488b2	\N	UPDATE	Part Management	Part	601-1-000002	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 10:50:59.33564	mandeep@supersystems.in	Mandeep Siwach
a9578ed3-55c7-4903-af04-ceebaa4f32f8	\N	UPDATE	Part Management	Part	601-1-000002	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 10:50:59.353018	mandeep@supersystems.in	Mandeep Siwach
21d3bef7-7a66-48e5-82d4-a85715056078	\N	CREATE	Supplier Management	Supplier	aaab26aa-0aa1-426f-a2b0-28388ca98f8e	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 11:14:06.985306	mandeep@supersystems.in	Mandeep Siwach
4af8ce76-ca4a-4c99-98d1-770f75d7322e	\N	LOGIN	Auth & Security	User Session	1cbd8975-63b4-4e69-9def-5cecd488cd12	\N	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{"status": "SUCCESS", "login_type": "organization"}	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 11:51:50.058772	mandeep@supersystems.in	Mandeep Siwach
9b5138f2-12ae-4ee5-93ad-b6538022508f	\N	UPDATE_ACCESS	Auth & Security	Module Access	6285e50a-1549-445b-b063-3e4231a98026	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.223568	mandeep@supersystems.in	
1771be78-15f2-4ac3-8140-c82da12fca5a	\N	UPDATE_ACCESS	Auth & Security	Module Access	6285e50a-1549-445b-b063-3e4231a98026	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.225435	mandeep@supersystems.in	
2902d846-f60a-456a-a62b-1961678a5f1b	\N	UPDATE_ACCESS	Auth & Security	Module Access	18b40034-17a5-402b-8b35-2476899b1217	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.240209	mandeep@supersystems.in	
8a120c20-0b29-425f-948b-343395b7b949	\N	UPDATE_ACCESS	Auth & Security	Module Access	18b40034-17a5-402b-8b35-2476899b1217	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.241092	mandeep@supersystems.in	
4c446bd7-0cbe-4e8a-89c6-35914b5efb64	\N	UPDATE_ACCESS	Auth & Security	Module Access	b691769f-263f-494f-8e19-bd4186a4f411	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.248878	mandeep@supersystems.in	
8dccefdd-7d30-4760-ba0b-9845641ccd60	\N	UPDATE_ACCESS	Auth & Security	Module Access	b691769f-263f-494f-8e19-bd4186a4f411	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.249871	mandeep@supersystems.in	
d7e0c174-dfab-4938-93b1-843d9880a01b	\N	UPDATE_ACCESS	Auth & Security	Module Access	5856805c-e783-4e44-98cc-f8adcea52482	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.255761	mandeep@supersystems.in	
1797c88e-4d40-41da-8a05-153d089da127	\N	UPDATE_ACCESS	Auth & Security	Module Access	59c2cda5-a953-4002-81e7-65bf8059c015	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.256082	mandeep@supersystems.in	
50479bb5-2b06-4670-be09-7af210a53e9c	\N	UPDATE_ACCESS	Auth & Security	Module Access	5856805c-e783-4e44-98cc-f8adcea52482	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.259197	mandeep@supersystems.in	
00d2906e-5aab-4355-ae38-6e6cae73c652	\N	UPDATE_ACCESS	Auth & Security	Module Access	59c2cda5-a953-4002-81e7-65bf8059c015	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.260189	mandeep@supersystems.in	
54fb528e-b393-4ae9-9269-156728029a5f	\N	UPDATE_ACCESS	Auth & Security	Module Access	13a5b055-60e6-4513-94ec-c59d87ab59c3	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.262878	mandeep@supersystems.in	
0e925ad7-7580-4d63-8210-5e93d8594376	\N	UPDATE_ACCESS	Auth & Security	Module Access	b69e0df5-6b15-418d-afa1-c423f07bb896	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.270717	mandeep@supersystems.in	
d6faef7a-7619-4996-8bf3-4421a4afe33e	\N	UPDATE_ACCESS	Auth & Security	Module Access	13a5b055-60e6-4513-94ec-c59d87ab59c3	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.270368	mandeep@supersystems.in	
0f3c8776-2409-40ed-8dfd-d272b904c7fb	\N	UPDATE_ACCESS	Auth & Security	Module Access	b69e0df5-6b15-418d-afa1-c423f07bb896	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.27387	mandeep@supersystems.in	
181c3f79-90d9-4449-bb55-fc4e5eb47a35	\N	UPDATE_ACCESS	Auth & Security	Module Access	13a5b055-60e6-4513-94ec-c59d87ab59c3	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:30:24.39896	mandeep@supersystems.in	
a27742e5-1157-4266-b25c-72c09be3c743	\N	UPDATE_ACCESS	Auth & Security	Module Access	59c2cda5-a953-4002-81e7-65bf8059c015	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:30:24.422815	mandeep@supersystems.in	
94974d0f-b553-4cdb-a7f4-15ef56adc32e	\N	UPDATE_ACCESS	Auth & Security	Module Access	62885e20-115a-4644-a55f-c10c68e1eb46	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:30:24.434257	mandeep@supersystems.in	
6df2ccff-8e21-403f-84a8-9568b1deb811	\N	UPDATE_ACCESS	Auth & Security	Module Access	868a5f54-b9dc-4cd8-ba9a-dc48121b48b7	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 14:30:24.445739	mandeep@supersystems.in	
94e0e0ff-da76-4650-a75f-7dc4fc2e7567	\N	CREATE	Part Management	Subcategory	8cecefd1-ecea-4510-9f1b-ec95cdf09009	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:06:33.271368	mandeep@supersystems.in	
b2d974c7-53fd-498b-9405-3e84d3484c14	\N	GENERATE	Part Management	Part	601-1-000001	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:09:55.848584	mandeep@supersystems.in	
9977a828-1c4c-4365-ab6e-8e74bfd36a50	\N	GENERATE	Part Management	Part	601-1-000002	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:10:18.955492	mandeep@supersystems.in	
95e35c5d-492b-463b-902e-c758d79cb7e4	\N	LOGIN	Auth & Security	User Session	1cbd8975-63b4-4e69-9def-5cecd488cd12	\N	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{"status": "SUCCESS", "login_type": "organization"}	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:15:39.531712	mandeep@supersystems.in	Mandeep Siwach
466e205a-eb2f-487e-9d69-d1654d14baf7	\N	UPDATE_ACCESS	Auth & Security	Module Access	6285e50a-1549-445b-b063-3e4231a98026	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:24:50.141451	mandeep@supersystems.in	
50cf427b-a8d8-4e03-8228-9352260a2c80	\N	UPDATE_ACCESS	Auth & Security	Module Access	5856805c-e783-4e44-98cc-f8adcea52482	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:24:50.14327	mandeep@supersystems.in	
1a9b8204-4296-4f8d-a384-8c0c3f55da1f	\N	UPDATE_ACCESS	Auth & Security	Module Access	18b40034-17a5-402b-8b35-2476899b1217	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:24:50.150504	mandeep@supersystems.in	
b9c9125a-98a0-49a0-9f8f-71e0f29d00da	\N	UPDATE_ACCESS	Auth & Security	Module Access	13a5b055-60e6-4513-94ec-c59d87ab59c3	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:24:50.152782	mandeep@supersystems.in	
cb22bfec-230f-4b17-aeb4-4ed98e0fba0f	\N	UPDATE_ACCESS	Auth & Security	Module Access	b691769f-263f-494f-8e19-bd4186a4f411	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:24:50.153932	mandeep@supersystems.in	
7fbcae03-6aef-49fa-a6e6-b964d9e87cee	\N	UPDATE_ACCESS	Auth & Security	Module Access	59c2cda5-a953-4002-81e7-65bf8059c015	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:24:50.160706	mandeep@supersystems.in	
37c73f02-e84b-4ea5-b590-35d35f51019d	\N	UPDATE_ACCESS	Auth & Security	Module Access	b69e0df5-6b15-418d-afa1-c423f07bb896	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:24:50.17696	mandeep@supersystems.in	
a7a78777-c89e-46aa-92b7-e4a32c484a0c	\N	UPDATE_ACCESS	Auth & Security	Module Access	62885e20-115a-4644-a55f-c10c68e1eb46	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:24:50.184511	mandeep@supersystems.in	
a0ec0195-0bc6-4c51-889d-a9f22e9a1609	\N	UPDATE_ACCESS	Auth & Security	Module Access	2fe32080-8ea6-4884-9d5b-f3830bc63706	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:24:50.188983	mandeep@supersystems.in	
6eed4f09-f1db-41a2-9a39-a6150d0184bb	\N	UPDATE_ACCESS	Auth & Security	Module Access	541bafc4-ba05-4300-964c-fbc26dea0531	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:24:50.198389	mandeep@supersystems.in	
1197d99a-da11-422e-ab7c-b703d0590e14	\N	UPDATE_ACCESS	Auth & Security	Module Access	868a5f54-b9dc-4cd8-ba9a-dc48121b48b7	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:24:50.204411	mandeep@supersystems.in	
6a578719-012c-4361-bf94-e627253f2293	\N	UPDATE_ACCESS	Auth & Security	Module Access	ccf6e752-5872-473f-b94c-016fe79b54f4	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:24:50.225242	mandeep@supersystems.in	
07ac4a59-7823-4451-82c9-81b0ef26ea9a	\N	UPDATE_ACCESS	Auth & Security	Module Access	04b7454c-cba9-47cf-ba7b-500c4e166439	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:24:50.248848	mandeep@supersystems.in	
8dfb26e3-1bd0-4d75-81f6-f3bf55ad2660	\N	UPDATE_ACCESS	Auth & Security	Module Access	64e8e1bb-c6dc-4042-a2c7-fa85f8de3042	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:24:50.265193	mandeep@supersystems.in	
8530849b-43dc-4a4e-b3db-6ae685c06d57	\N	UPDATE_ACCESS	Auth & Security	Module Access	edade1fa-a67e-47ff-aec8-eaf27ef2dc5c	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:24:50.276655	mandeep@supersystems.in	
8a3b20ca-f62a-447b-9953-f08361ace0e4	\N	UPDATE_ACCESS	Auth & Security	Module Access	d3e38870-9523-4539-bf32-23a1067e7633	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:24:50.304421	mandeep@supersystems.in	
bad2d2ce-702b-4280-89bd-44aceddecdd6	\N	UPDATE_ACCESS	Auth & Security	Module Access	972c5c98-7785-4ced-8e7e-6b2614c67a07	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:24:50.310192	mandeep@supersystems.in	
e4a67cb1-70a3-4567-84ca-32c146fbfbdc	\N	UPDATE_ACCESS	Auth & Security	Module Access	849db03a-c455-4e93-86c0-84dcc4177812	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:24:50.325119	mandeep@supersystems.in	
a4041d71-d192-419b-991b-570f00841a9f	\N	UPDATE_ACCESS	Auth & Security	Module Access	9cd926ee-5086-4279-ae77-814735abd9c7	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:24:50.329258	mandeep@supersystems.in	
f5ecc7ac-3967-4724-ade7-e5279d9c4f34	\N	UPDATE_ACCESS	Auth & Security	Module Access	303be7a2-ae39-4651-8e13-380536b54f46	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:24:50.339749	mandeep@supersystems.in	
c375e26d-bf2d-4338-aa9b-c5be260b33f2	\N	UPDATE_ACCESS	Auth & Security	Module Access	66b43ab1-a5b2-4251-a9f7-3d5a0b8a4fc1	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:24:50.343433	mandeep@supersystems.in	
078988b0-c6f3-498a-9e0d-92e2a0dfa8b1	\N	UPDATE_ACCESS	Auth & Security	Module Access	d4ebfa29-9a59-44ef-b045-9d799732e086	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:24:50.349396	mandeep@supersystems.in	
2bf587f7-a5f9-4d17-a799-aeb2529f6e26	\N	UPDATE_ACCESS	Auth & Security	Module Access	54476940-8656-4974-9c58-88d10767564e	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 15:24:50.352445	mandeep@supersystems.in	
8379fca3-4cd1-4188-b87a-a5a4ca3e1a76	\N	LOGIN	Auth & Security	User Session	1cbd8975-63b4-4e69-9def-5cecd488cd12	\N	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{"status": "SUCCESS", "login_type": "organization"}	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-20 17:33:21.770548	mandeep@supersystems.in	Mandeep Siwach
cbc0bf82-446d-4ed5-8e68-22f5bd0c45ef	\N	LOGIN	Auth & Security	User Session	1cbd8975-63b4-4e69-9def-5cecd488cd12	\N	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{"status": "SUCCESS", "login_type": "organization"}	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 10:43:03.406008	mandeep@supersystems.in	Mandeep Siwach
c2a3449f-d80b-4d2c-87d7-040c8be71a05	\N	UPDATE_ACCESS	Auth & Security	Module Access	62885e20-115a-4644-a55f-c10c68e1eb46	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.274048	mandeep@supersystems.in	
15716774-b343-40e8-bef8-0babcb12576f	\N	UPDATE_ACCESS	Auth & Security	Module Access	62885e20-115a-4644-a55f-c10c68e1eb46	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.276787	mandeep@supersystems.in	
00421657-296a-48cd-97dc-93d6fa8dc916	\N	UPDATE_ACCESS	Auth & Security	Module Access	2fe32080-8ea6-4884-9d5b-f3830bc63706	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.28106	mandeep@supersystems.in	
2a4bfc99-6800-43c2-a5d2-98b32c58dc78	\N	UPDATE_ACCESS	Auth & Security	Module Access	541bafc4-ba05-4300-964c-fbc26dea0531	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.289038	mandeep@supersystems.in	
a4b3de5a-527f-4e5e-b859-1ceca4def621	\N	UPDATE_ACCESS	Auth & Security	Module Access	868a5f54-b9dc-4cd8-ba9a-dc48121b48b7	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.296532	mandeep@supersystems.in	
b611e6d4-182a-459a-8d41-15432bbc1313	\N	UPDATE_ACCESS	Auth & Security	Module Access	ccf6e752-5872-473f-b94c-016fe79b54f4	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.302109	mandeep@supersystems.in	
eb2d1e8d-dde5-431c-b1ee-59fee435c467	\N	UPDATE_ACCESS	Auth & Security	Module Access	04b7454c-cba9-47cf-ba7b-500c4e166439	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.312404	mandeep@supersystems.in	
716f15e8-30c1-4a67-948a-1c936a5c9cf2	\N	UPDATE_ACCESS	Auth & Security	Module Access	64e8e1bb-c6dc-4042-a2c7-fa85f8de3042	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.319165	mandeep@supersystems.in	
8755625b-2f9d-4fc7-96eb-46586b137778	\N	UPDATE_ACCESS	Auth & Security	Module Access	d3e38870-9523-4539-bf32-23a1067e7633	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.319345	mandeep@supersystems.in	
2a9dd029-f9e3-4614-b17d-5b7d4b85a570	\N	UPDATE_ACCESS	Auth & Security	Module Access	972c5c98-7785-4ced-8e7e-6b2614c67a07	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.330196	mandeep@supersystems.in	
5cd18a3f-3b84-47f3-8e05-2b367f00ddfb	\N	UPDATE_ACCESS	Auth & Security	Module Access	9cd926ee-5086-4279-ae77-814735abd9c7	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.338309	mandeep@supersystems.in	
61056984-d89d-4b71-866a-90bf10be832d	\N	UPDATE_ACCESS	Auth & Security	Module Access	66b43ab1-a5b2-4251-a9f7-3d5a0b8a4fc1	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.352047	mandeep@supersystems.in	
b8678101-e754-4cd1-816f-f4c83cf02816	\N	UPDATE_ACCESS	Auth & Security	Module Access	d4ebfa29-9a59-44ef-b045-9d799732e086	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.355888	mandeep@supersystems.in	
77addc72-7941-44f1-97bb-054d456dbb8b	\N	UPDATE_ACCESS	Auth & Security	Module Access	54476940-8656-4974-9c58-88d10767564e	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.365673	mandeep@supersystems.in	
aef23583-56b7-405d-8f15-7786dfe3960d	\N	UPDATE_ACCESS	Auth & Security	Module Access	2fe32080-8ea6-4884-9d5b-f3830bc63706	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.284425	mandeep@supersystems.in	
c478565d-8164-4bd0-9b09-a25b0da6bab7	\N	UPDATE_ACCESS	Auth & Security	Module Access	ccf6e752-5872-473f-b94c-016fe79b54f4	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.299554	mandeep@supersystems.in	
16767012-408b-4a47-976d-1d8771036af6	\N	UPDATE_ACCESS	Auth & Security	Module Access	edade1fa-a67e-47ff-aec8-eaf27ef2dc5c	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.319699	mandeep@supersystems.in	
24bbf652-f873-4006-8540-c86aad5fae30	\N	UPDATE_ACCESS	Auth & Security	Module Access	972c5c98-7785-4ced-8e7e-6b2614c67a07	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.329421	mandeep@supersystems.in	
4c1a3326-02f3-4640-a5cf-082489f40e27	\N	UPDATE_ACCESS	Auth & Security	Module Access	849db03a-c455-4e93-86c0-84dcc4177812	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.335875	mandeep@supersystems.in	
e736cc8d-3b8b-4b83-a6a9-5930ad4b6b4a	\N	UPDATE_ACCESS	Auth & Security	Module Access	303be7a2-ae39-4651-8e13-380536b54f46	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.341105	mandeep@supersystems.in	
7564879b-6669-43d5-831d-e33e32c1d4af	\N	UPDATE_ACCESS	Auth & Security	Module Access	d4ebfa29-9a59-44ef-b045-9d799732e086	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.362339	mandeep@supersystems.in	
3e6f328c-7a09-4f36-adf9-0978c894048f	\N	UPDATE_ACCESS	Auth & Security	Module Access	541bafc4-ba05-4300-964c-fbc26dea0531	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.291651	mandeep@supersystems.in	
bf5f8031-06f7-49e7-9bdb-217a66d3067f	\N	UPDATE_ACCESS	Auth & Security	Module Access	64e8e1bb-c6dc-4042-a2c7-fa85f8de3042	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.318258	mandeep@supersystems.in	
89007355-6a52-4332-8678-9d31b8556639	\N	UPDATE_ACCESS	Auth & Security	Module Access	849db03a-c455-4e93-86c0-84dcc4177812	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.338676	mandeep@supersystems.in	
2500e737-2109-47c6-947b-4c9d26f90f98	\N	UPDATE_ACCESS	Auth & Security	Module Access	d3e38870-9523-4539-bf32-23a1067e7633	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.348434	mandeep@supersystems.in	
d3d6d944-456a-4674-b011-d19ac0896d55	\N	UPDATE_ACCESS	Auth & Security	Module Access	868a5f54-b9dc-4cd8-ba9a-dc48121b48b7	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.294642	mandeep@supersystems.in	
77c5719b-b7f3-4d23-8b56-f54889f799bf	\N	UPDATE_ACCESS	Auth & Security	Module Access	04b7454c-cba9-47cf-ba7b-500c4e166439	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.303276	mandeep@supersystems.in	
3acee217-8883-41b1-89f8-0239b561c763	\N	UPDATE_ACCESS	Auth & Security	Module Access	edade1fa-a67e-47ff-aec8-eaf27ef2dc5c	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.317858	mandeep@supersystems.in	
8e84e7c9-368d-4505-8e8b-711d9ce7a469	\N	UPDATE_ACCESS	Auth & Security	Module Access	9cd926ee-5086-4279-ae77-814735abd9c7	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.339261	mandeep@supersystems.in	
c20c0efe-7637-45e4-976d-44a29fbc770d	\N	UPDATE_ACCESS	Auth & Security	Module Access	303be7a2-ae39-4651-8e13-380536b54f46	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.348003	mandeep@supersystems.in	
e9fe46b2-bd78-4ce5-9289-213d9d0a85fe	\N	UPDATE_ACCESS	Auth & Security	Module Access	66b43ab1-a5b2-4251-a9f7-3d5a0b8a4fc1	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.356198	mandeep@supersystems.in	
7a2fa729-f9c7-454c-8d8a-783a2c293220	\N	UPDATE_ACCESS	Auth & Security	Module Access	54476940-8656-4974-9c58-88d10767564e	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:14:02.369638	mandeep@supersystems.in	
c29af991-a32a-4ea1-bf24-d35ddaf68121	\N	LOGIN	Auth & Security	User Session	1cbd8975-63b4-4e69-9def-5cecd488cd12	\N	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{"status": "SUCCESS", "login_type": "organization"}	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 12:55:54.802173	mandeep@supersystems.in	Mandeep Siwach
ca1f8583-1359-4ff9-ad2b-e0fe65d456a4	\N	LOGIN	Auth & Security	User Session	1cbd8975-63b4-4e69-9def-5cecd488cd12	\N	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{"status": "SUCCESS", "login_type": "organization"}	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 14:00:35.372977	mandeep@supersystems.in	Mandeep Siwach
538d6dcf-1bb9-46d0-88af-ce798ecd8b17	\N	CREATE	Workflow & Costing	Routing	2570ef63-dbbd-4cd1-b436-73f4dc3520ee	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 14:05:34.689758	mandeep@supersystems.in	Mandeep Siwach
22b2aefa-8a09-4207-850a-15db45680fe2	\N	CREATE	Workflow & Costing	Routing Step	ccbcc86d-a534-4f40-9a86-24916a15baca	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 14:05:47.486285	mandeep@supersystems.in	Mandeep Siwach
4238b211-3323-4568-929e-316c7ed76f62	\N	CREATE	Workflow & Costing	Routing Step	6b19c3bb-1061-42c0-8623-b9958e397dc9	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 14:05:51.32174	mandeep@supersystems.in	Mandeep Siwach
feaaf7c1-33b5-4110-8d20-3b6a30a956d2	\N	CREATE	Workflow & Costing	Routing Step	8695973e-3f37-4c9b-b469-11d6598a1251	\N	\N	127.0.0.1	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 14:05:55.611075	mandeep@supersystems.in	Mandeep Siwach
c918d7e2-bfc3-4ac0-8677-998d46edcf40	\N	LOGIN	Auth & Security	User Session	1cbd8975-63b4-4e69-9def-5cecd488cd12	\N	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36	{"status": "SUCCESS", "login_type": "organization"}	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-21 15:27:16.155516	mandeep@supersystems.in	Mandeep Siwach
\.


--
-- Data for Name: accounts; Type: TABLE DATA; Schema: finance; Owner: postgres
--

COPY finance.accounts (id, name, code, type, parent_id, currency, is_active, tenant_id, is_deleted, version, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: finance; Owner: postgres
--

COPY finance.invoices (id, doc_no, date, type, party_id, party_type, status, lines, subtotal, tax, total, paid, balance, due_date, currency, tenant_id, is_deleted, version, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: journal_entries; Type: TABLE DATA; Schema: finance; Owner: postgres
--

COPY finance.journal_entries (id, doc_no, date, type, narration, status, lines, total_debit, total_credit, approved_by, tenant_id, is_deleted, version, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: finance; Owner: postgres
--

COPY finance.payments (id, doc_no, date, type, party_id, party_type, amount, method, reference, invoice_id, status, tenant_id, is_deleted, version, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: attendance; Type: TABLE DATA; Schema: hr; Owner: postgres
--

COPY hr.attendance (id, employee_id, date, check_in, check_out, status, hours_worked, remarks, tenant_id, is_deleted, version, created_at) FROM stdin;
\.


--
-- Data for Name: employee_code_criteria; Type: TABLE DATA; Schema: hr; Owner: postgres
--

COPY hr.employee_code_criteria (id, name, prefix, prefix_separator, code_start, current_sequence, suffix_separator, suffix, tenant_id, is_active, is_deleted, created_at, updated_at) FROM stdin;
bf0c869e-ae49-4623-854a-d600871f31aa	main series	SS	/	60001	60002				t	f	2026-07-16 13:24:10.804857	2026-07-16 13:27:44.042035
66b39fa1-2942-4bbd-9069-ba7cb58010b1	main series	SS	/	1	1			b424df0e-f766-4e94-b3fd-05777e158958	t	f	2026-07-18 10:57:41.315381	2026-07-18 10:58:31.007708
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: hr; Owner: postgres
--

COPY hr.employees (id, emp_code, user_id, first_name, last_name, email, phone, department_id, designation, manager_id, date_of_joining, date_of_birth, gender, status, address, bank_details, tenant_id, is_deleted, version, created_at, updated_at, created_by, updated_by, blood_group, marital_status, nationality, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, employment_type, reporting_to, work_location, previous_experience, qualifications, pan_number, aadhar_number, uan_number, esi_number, code_criteria_id) FROM stdin;
526602f2-6a24-43cd-bb84-2dcb1155c49c	SS/60001	\N	Mandeep	Siwach	mandeep@supersystems.in	9992662555			\N	\N	2000-04-27	male	active	{"city": "", "line1": "", "line2": "", "state": "", "country": "India", "pincode": ""}	{"ifsc": "", "bank_name": "", "account_no": ""}		f	1	2026-07-16 13:24:52.308257	2026-07-16 13:24:52.308257		\N	A+	single	Indian				full_time			[]	[]					bf0c869e-ae49-4623-854a-d600871f31aa
e81ac8e0-571e-45f8-bf79-9bb7016b9baa	SS/60002	\N	Gurmeet	Siwach		9992662911			\N	\N	\N	male	active	{"city": "", "line1": "", "line2": "", "state": "", "country": "India", "pincode": ""}	{"ifsc": "", "bank_name": "", "account_no": ""}		f	1	2026-07-16 13:27:44.042035	2026-07-16 13:27:44.042035		\N	A+	single	Indian				full_time			[]	[]					bf0c869e-ae49-4623-854a-d600871f31aa
2189271e-8c8f-4d5a-8a5f-b6f4dba246d6	SS/60003	f98dcc91-7d08-4f2d-997b-ac22132846cf	Rahul	Sharma	rahul.sharma@supersystems.in	9876543210	\N	Engineer	\N	\N	\N	Male	Active	\N	\N	TEST	f	1	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	\N	\N	\N	\N	Indian	\N	\N	\N	Full-time	\N	\N	[]	[]	\N	\N	\N	\N	\N
6af2e71d-23d3-4112-a764-19d5c6e70ffd	SS/60004	66245a5e-477a-4fd7-8b29-28003a99b699	Priya	Verma	priya.verma@supersystems.in	9876543211	\N	Designer	\N	\N	\N	Female	Active	\N	\N	TEST	f	1	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	\N	\N	\N	\N	Indian	\N	\N	\N	Full-time	\N	\N	[]	[]	\N	\N	\N	\N	\N
09034ac8-6584-432f-b336-af4b54dfabbe	SS/60005	f823fef5-6ad4-41bd-a925-364297f83eee	Amit	Kumar	amit.kumar@supersystems.in	9876543212	\N	Manager	\N	\N	\N	Male	Active	\N	\N	TEST	f	1	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	\N	\N	\N	\N	Indian	\N	\N	\N	Full-time	\N	\N	[]	[]	\N	\N	\N	\N	\N
fa01c616-4f69-4ed5-a38d-c1c2d494365c	SS/60006	cc28f720-ce31-451b-9b52-975059a7a2a4	Neha	Singh	neha.singh@supersystems.in	9876543213	\N	Analyst	\N	\N	\N	Female	Active	\N	\N	TEST	f	1	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	\N	\N	\N	\N	Indian	\N	\N	\N	Full-time	\N	\N	[]	[]	\N	\N	\N	\N	\N
2dc6f019-06ad-4b68-98f8-5ec576858318	SS/1	\N	p	s	ps@supersystme.in	9876543210			\N	\N	2020-10-10	male	active	{"city": "", "line1": "", "line2": "", "state": "", "country": "India", "pincode": ""}	{"ifsc": "", "bank_name": "", "account_no": ""}	b424df0e-f766-4e94-b3fd-05777e158958	f	1	2026-07-18 10:58:31.007708	2026-07-18 10:58:31.007708	Mandeep Siwach	\N	A+	married	Indian				full_time			[]	[]					66b39fa1-2942-4bbd-9069-ba7cb58010b1
emp-1002	EMP-1002	u-emp-1002	Rajesh	Kumar	rajesh.inv@acme.com	\N	\N	Inventory Manager	\N	\N	\N	\N	active	\N	\N	TEST	f	1	2026-07-21 12:09:15.641586	2026-07-21 12:09:15.641586	\N	\N	\N	\N	Indian	\N	\N	\N	full_time	\N	\N	[]	[]	\N	\N	\N	\N	\N
emp-1003	EMP-1003	u-emp-1003	Sunil	Verma	sunil.wh@acme.com	\N	\N	Warehouse Supervisor	\N	\N	\N	\N	active	\N	\N	TEST	f	1	2026-07-21 12:09:15.642147	2026-07-21 12:09:15.642147	\N	\N	\N	\N	Indian	\N	\N	\N	full_time	\N	\N	[]	[]	\N	\N	\N	\N	\N
emp-1004	EMP-1004	u-emp-1004	Anita	Sharma	anita.mfg@acme.com	\N	\N	Production Lead	\N	\N	\N	\N	active	\N	\N	TEST	f	1	2026-07-21 12:09:15.642581	2026-07-21 12:09:15.642581	\N	\N	\N	\N	Indian	\N	\N	\N	full_time	\N	\N	[]	[]	\N	\N	\N	\N	\N
emp-1005	EMP-1005	u-emp-1005	Vikram	Singh	vikram.qc@acme.com	\N	\N	Quality Inspector	\N	\N	\N	\N	active	\N	\N	TEST	f	1	2026-07-21 12:09:15.643015	2026-07-21 12:09:15.643015	\N	\N	\N	\N	Indian	\N	\N	\N	full_time	\N	\N	[]	[]	\N	\N	\N	\N	\N
emp-1001	EMP-1001	u-emp-1001	Mandeep	Siwach	mandeep@supersystems.in	\N	\N	Plant Head	\N	\N	\N	\N	active	\N	\N	TEST	f	1	2026-07-21 12:09:15.64007	2026-07-21 12:09:15.64007	\N	\N	\N	\N	Indian	\N	\N	\N	full_time	\N	\N	[]	[]	\N	\N	\N	\N	\N
\.


--
-- Data for Name: leaves; Type: TABLE DATA; Schema: hr; Owner: postgres
--

COPY hr.leaves (id, employee_id, type, from_date, to_date, days, reason, status, approved_by, tenant_id, is_deleted, version, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: payroll; Type: TABLE DATA; Schema: hr; Owner: postgres
--

COPY hr.payroll (id, employee_id, month, basic, allowances, deductions, gross, net, status, paid_at, tenant_id, is_deleted, version, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: module_access; Type: TABLE DATA; Schema: iam; Owner: postgres
--

COPY iam.module_access (id, user_id, module, role, permissions, granted_by, tenant_id, is_active, created_at, updated_at) FROM stdin;
e2e31833-f285-47da-ba32-d749de4e606d	66245a5e-477a-4fd7-8b29-28003a99b699	Part Management	Viewer	{"sections": ["overview", "allparts"], "entity_permissions": {"Parts": ["view"], "Categories": ["view"], "Subcategories": ["view"]}}	f98dcc91-7d08-4f2d-997b-ac22132846cf	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531
ef2ee315-40bd-4ae7-bc58-91d0d1123a31	f98dcc91-7d08-4f2d-997b-ac22132846cf	Part Management	editor	{"entity_permissions": {"parts": ["view", "create", "edit", "export"], "audit_logs": ["view", "create", "edit", "export"], "categories": ["view", "create", "edit", "export"], "part_mapping": ["view", "create", "edit", "export"], "subcategories": ["view", "create", "edit", "export"], "obsolete_parts": ["view", "create", "edit", "export"], "user_management": [], "generate_part_code": ["view", "create", "edit", "export"]}}	f98dcc91-7d08-4f2d-997b-ac22132846cf	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-16 10:24:56.412531	2026-07-18 13:32:08.837142
8cca7803-29a3-4d4c-bfa4-def68ca251c8	f98dcc91-7d08-4f2d-997b-ac22132846cf	Project Management	Admin	{"sections": ["overview", "projects", "addproject", "organizations", "auditlogs", "moduleusers"], "entity_permissions": {"Tasks": ["view", "create", "edit", "delete"], "Projects": ["view", "create", "edit", "delete"], "Organizations": ["view", "create", "edit", "delete"]}}	f98dcc91-7d08-4f2d-997b-ac22132846cf	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531
a964b255-924d-4f7c-9b9f-5b47e15ce2b4	301b5714-7898-4484-834c-9257d0ad5a82	Auth & Security	module_admin	{"entity_permissions": {"users": ["view", "create", "edit", "delete"]}}	admin@test.com	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-18 11:57:03.722715	2026-07-18 11:57:03.722715
8b7e151a-9127-4eea-b83e-6c66975dec64	f823fef5-6ad4-41bd-a925-364297f83eee	Project Management	editor	{"entity_permissions": {}}	f98dcc91-7d08-4f2d-997b-ac22132846cf	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-16 10:24:56.412531	2026-07-18 12:05:33.297898
2378b13d-354a-421e-8f71-da774dd504ba	b02428e6-e93d-4dd0-86bb-e3bdc0a312dd	Warehouse Management	module_admin	{}		b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-18 12:09:46.732603	2026-07-18 12:09:46.732603
62885e20-115a-4644-a55f-c10c68e1eb46	1cbd8975-63b4-4e69-9def-5cecd488cd12	Human Resources	module_admin	{"sections": [], "entity_permissions": {"leave": ["view", "create", "edit", "delete", "export", "import"], "payroll": ["view", "create", "edit", "delete", "export", "import"], "employees": ["view", "create", "edit", "delete", "export", "import"], "attendance": ["view", "create", "edit", "delete", "export", "import"], "performance": ["view", "create", "edit", "delete", "export", "import"], "recruitment": ["view", "create", "edit", "delete", "export", "import"]}}	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-18 14:11:43.188107	2026-07-21 12:14:02.27358
7bab18c5-bd4b-4676-a53d-85e6f814448e	cc28f720-ce31-451b-9b52-975059a7a2a4	Project Management	editor	{"entity_permissions": {}}	f98dcc91-7d08-4f2d-997b-ac22132846cf	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-16 10:24:56.412531	2026-07-18 12:13:38.644528
f91ff6a2-6b33-4d97-bee2-de4e4334da63	f30f587a-b87e-4e50-a384-051d548b6cc8	Part Management	viewer	{"entity_permissions": {"parts": ["view", "export"], "audit_logs": ["view", "export"], "categories": ["view", "export"], "part_mapping": ["view", "export"], "subcategories": ["view", "export"], "obsolete_parts": ["view", "export"], "user_management": ["view", "export"], "generate_part_code": ["view", "export"]}}	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-18 12:54:42.142929	2026-07-18 12:54:42.142929
a4ec3f74-8cc5-4a82-8465-d1f115c5061e	f98dcc91-7d08-4f2d-997b-ac22132846cf	Auth & Security	module_admin	{"sections": ["overview", "users", "permissions", "modules", "roles", "matrix", "auditlogs"], "entity_permissions": {"roles": ["view", "create", "edit", "delete"], "users": ["view", "create", "edit", "delete"], "matrix": ["view", "create", "edit", "delete"], "audit_logs": ["view", "export"], "module_access": ["view", "create", "edit", "delete"], "user_permissions": ["view", "create", "edit", "delete"]}}	system_admin	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-18 13:14:42.023481	2026-07-18 13:14:42.023481
541bafc4-ba05-4300-964c-fbc26dea0531	1cbd8975-63b4-4e69-9def-5cecd488cd12	Logistics	module_admin	{"sections": [], "entity_permissions": {"general": ["view", "create", "edit", "delete", "export", "import"]}}	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-18 14:11:43.21174	2026-07-21 12:14:02.288792
972c5c98-7785-4ced-8e7e-6b2614c67a07	1cbd8975-63b4-4e69-9def-5cecd488cd12	Project Management	module_admin	{"sections": [], "entity_permissions": {"tasks": ["view", "create", "edit", "delete", "export", "import"], "reports": ["view", "create", "edit", "delete", "export", "import"], "projects": ["view", "create", "edit", "delete", "export", "import"], "resources": ["view", "create", "edit", "delete", "export", "import"], "milestones": ["view", "create", "edit", "delete", "export", "import"]}}	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-18 14:11:43.203998	2026-07-21 12:14:02.328031
59c2cda5-a953-4002-81e7-65bf8059c015	1cbd8975-63b4-4e69-9def-5cecd488cd12	Finance	module_admin	{"sections": [], "entity_permissions": {"payments": ["view", "create", "edit", "delete", "export", "import"], "invoicing": ["view", "create", "edit", "delete", "export", "import"], "general_ledger": ["view", "create", "edit", "delete", "export", "import"], "accounts_payable": ["view", "create", "edit", "delete", "export", "import"], "accounts_receivable": ["view", "create", "edit", "delete", "export", "import"]}}	admin@test.com	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-18 11:58:07.961026	2026-07-21 12:14:02.257735
2fe32080-8ea6-4884-9d5b-f3830bc63706	1cbd8975-63b4-4e69-9def-5cecd488cd12	Inventory Management	module_admin	{"sections": [], "entity_permissions": {"counts": ["view", "create", "edit", "delete", "export", "import"], "transfers": ["view", "create", "edit", "delete", "export", "import"], "adjustments": ["view", "create", "edit", "delete", "export", "import"], "stock_levels": ["view", "create", "edit", "delete", "export", "import"], "stock_movements": ["view", "create", "edit", "delete", "export", "import"]}}	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-18 14:11:43.204157	2026-07-21 12:14:02.28051
13a5b055-60e6-4513-94ec-c59d87ab59c3	1cbd8975-63b4-4e69-9def-5cecd488cd12	Auth & Security	module_admin	{"sections": ["overview", "users", "permissions", "modules", "roles", "matrix", "auditlogs"], "entity_permissions": {"roles": ["view", "create", "edit", "delete", "export", "import"], "users": ["view", "create", "edit", "delete", "export", "import"], "modules": ["view", "create", "edit", "delete", "export", "import"], "audit_logs": ["view", "create", "edit", "delete", "export", "import"], "permissions": ["view", "create", "edit", "delete", "export", "import"]}}	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-18 13:40:07.245748	2026-07-21 12:14:02.259376
d4ebfa29-9a59-44ef-b045-9d799732e086	1cbd8975-63b4-4e69-9def-5cecd488cd12	Warehouse Management	module_admin	{"sections": [], "entity_permissions": {"bins": ["view", "create", "edit", "delete", "export", "import"], "zones": ["view", "create", "edit", "delete", "export", "import"], "putaway": ["view", "create", "edit", "delete", "export", "import"], "shipping": ["view", "create", "edit", "delete", "export", "import"], "receiving": ["view", "create", "edit", "delete", "export", "import"], "pick_lists": ["view", "create", "edit", "delete", "export", "import"]}}	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-18 14:11:43.216457	2026-07-21 12:14:02.358629
5856805c-e783-4e44-98cc-f8adcea52482	1cbd8975-63b4-4e69-9def-5cecd488cd12	Asset Management	module_admin	{"sections": [], "entity_permissions": {"general": ["view", "create", "edit", "delete", "export", "import"]}}	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-18 14:11:43.243753	2026-07-21 12:14:02.255361
6285e50a-1549-445b-b063-3e4231a98026	1cbd8975-63b4-4e69-9def-5cecd488cd12	Analytics & Reporting	module_admin	{"sections": [], "entity_permissions": {"general": ["view", "create", "edit", "delete", "export", "import"]}}	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-18 14:11:43.222798	2026-07-21 12:14:02.218731
ccf6e752-5872-473f-b94c-016fe79b54f4	1cbd8975-63b4-4e69-9def-5cecd488cd12	Maintenance	module_admin	{"sections": [], "entity_permissions": {"general": ["view", "create", "edit", "delete", "export", "import"]}}	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-18 14:11:43.23294	2026-07-21 12:14:02.297989
b69e0df5-6b15-418d-afa1-c423f07bb896	1cbd8975-63b4-4e69-9def-5cecd488cd12	Governance & Risk	module_admin	{"sections": [], "entity_permissions": {"general": ["view", "create", "edit", "delete", "export", "import"]}}	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-18 14:11:43.275282	2026-07-21 12:14:02.26822
849db03a-c455-4e93-86c0-84dcc4177812	1cbd8975-63b4-4e69-9def-5cecd488cd12	Quality Management	module_admin	{"sections": [], "entity_permissions": {"capa": ["view", "create", "edit", "delete", "export", "import"], "inspections": ["view", "create", "edit", "delete", "export", "import"], "certificates": ["view", "create", "edit", "delete", "export", "import"], "quality_plans": ["view", "create", "edit", "delete", "export", "import"], "non_conformances": ["view", "create", "edit", "delete", "export", "import"]}}	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-18 14:11:43.229991	2026-07-21 12:14:02.333569
04b7454c-cba9-47cf-ba7b-500c4e166439	1cbd8975-63b4-4e69-9def-5cecd488cd12	Manufacturing	module_admin	{"sections": [], "entity_permissions": {"bom": ["view", "create", "edit", "delete", "export", "import"], "routing": ["view", "create", "edit", "delete", "export", "import"], "shop_floor": ["view", "create", "edit", "delete", "export", "import"], "work_centers": ["view", "create", "edit", "delete", "export", "import"], "production_orders": ["view", "create", "edit", "delete", "export", "import"]}}	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-18 14:11:43.213638	2026-07-21 12:14:02.307888
303be7a2-ae39-4651-8e13-380536b54f46	1cbd8975-63b4-4e69-9def-5cecd488cd12	Supplier Management	module_admin	{"sections": [], "entity_permissions": {"reports": ["view", "create", "edit", "delete", "export", "import"], "contacts": ["view", "create", "edit", "delete", "export", "import"], "contracts": ["view", "create", "edit", "delete", "export", "import"], "suppliers": ["view", "create", "edit", "delete", "export", "import"], "evaluations": ["view", "create", "edit", "delete", "export", "import"]}}	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-18 14:11:43.251287	2026-07-21 12:14:02.343746
18b40034-17a5-402b-8b35-2476899b1217	1cbd8975-63b4-4e69-9def-5cecd488cd12	Customer Service	module_admin	{"sections": [], "entity_permissions": {"general": ["view", "create", "edit", "delete", "export", "import"]}}	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-18 14:11:43.264916	2026-07-21 12:14:02.239889
66b43ab1-a5b2-4251-a9f7-3d5a0b8a4fc1	1cbd8975-63b4-4e69-9def-5cecd488cd12	Treasury	module_admin	{"sections": [], "entity_permissions": {"general": ["view", "create", "edit", "delete", "export", "import"]}}	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-18 14:11:43.246975	2026-07-21 12:14:02.350888
edade1fa-a67e-47ff-aec8-eaf27ef2dc5c	1cbd8975-63b4-4e69-9def-5cecd488cd12	Procurement	module_admin	{"sections": [], "entity_permissions": {"contracts": ["view", "create", "edit", "delete", "export", "import"], "requisitions": ["view", "create", "edit", "delete", "export", "import"], "goods_receipt": ["view", "create", "edit", "delete", "export", "import"], "purchase_orders": ["view", "create", "edit", "delete", "export", "import"], "vendor_invoices": ["view", "create", "edit", "delete", "export", "import"]}}	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-18 14:11:43.206104	2026-07-21 12:14:02.315402
9cd926ee-5086-4279-ae77-814735abd9c7	1cbd8975-63b4-4e69-9def-5cecd488cd12	RM Management	module_admin	{"sections": [], "entity_permissions": {"general": ["view", "create", "edit", "delete", "export", "import"]}}	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-18 14:23:07.230863	2026-07-21 12:14:02.337897
d3e38870-9523-4539-bf32-23a1067e7633	1cbd8975-63b4-4e69-9def-5cecd488cd12	Product Lifecycle	module_admin	{"sections": [], "entity_permissions": {"general": ["view", "create", "edit", "delete", "export", "import"]}}	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-18 14:11:43.257529	2026-07-21 12:14:02.341263
54476940-8656-4974-9c58-88d10767564e	1cbd8975-63b4-4e69-9def-5cecd488cd12	Workflow & Costing	module_admin	{"sections": [], "entity_permissions": {"general": ["view", "create", "edit", "delete", "export", "import"]}}	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-18 14:23:07.262603	2026-07-21 12:14:02.367851
b691769f-263f-494f-8e19-bd4186a4f411	1cbd8975-63b4-4e69-9def-5cecd488cd12	EHS	module_admin	{"sections": [], "entity_permissions": {"general": ["view", "create", "edit", "delete", "export", "import"]}}	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-18 14:11:43.28127	2026-07-21 12:14:02.248458
868a5f54-b9dc-4cd8-ba9a-dc48121b48b7	1cbd8975-63b4-4e69-9def-5cecd488cd12	Machine Management	module_admin	{"sections": [], "entity_permissions": {"general": ["view", "create", "edit", "delete", "export", "import"]}}	mandeep@supersystems.in	b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-18 14:23:07.260875	2026-07-21 12:14:02.293713
64e8e1bb-c6dc-4042-a2c7-fa85f8de3042	1cbd8975-63b4-4e69-9def-5cecd488cd12	Part Management	module_admin	{"sections": ["overview", "categories", "subcategories", "generate", "allparts", "partmapping", "auditlogs", "obsolete", "moduleusers"], "entity_permissions": {"parts": ["view", "create", "edit", "delete", "export", "import"], "audit_logs": ["view", "create", "edit", "delete", "export", "import"], "categories": ["view", "create", "edit", "delete", "export", "import"], "part_mapping": ["view", "create", "edit", "delete", "export", "import"], "subcategories": ["view", "create", "edit", "delete", "export", "import"], "obsolete_parts": ["view", "create", "edit", "delete", "export", "import"], "user_management": ["view", "create", "edit", "delete", "export", "import"], "generate_part_code": ["view", "create", "edit", "delete", "export", "import"]}}		b424df0e-f766-4e94-b3fd-05777e158958	t	2026-07-17 10:38:43.739438	2026-07-21 12:14:02.312149
\.


--
-- Data for Name: module_roles; Type: TABLE DATA; Schema: iam; Owner: postgres
--

COPY iam.module_roles (id, name, code, module, permissions, is_system, is_active, tenant_id, created_at, updated_at) FROM stdin;
585ad334-c4bb-48de-afbe-0a9cd61490fc	Module Admin	module_admin	Part Management	{"parts": ["view", "create", "edit", "delete", "export", "import"], "audit_logs": ["view", "export"], "categories": ["view", "create", "edit", "delete", "export", "import"], "subcategories": ["view", "create", "edit", "delete", "export", "import"], "obsolete_parts": ["view", "create", "export"], "user_management": ["view", "create", "edit", "delete"]}	t	t	SYSTEM	2026-07-16 10:54:57.891904	2026-07-16 10:54:57.891904
d3d5b6dc-890b-4453-befb-7e61a94703f1	Editor	editor	Part Management	{"parts": ["view", "create", "edit", "export", "import"], "audit_logs": ["view", "export"], "categories": ["view", "create", "edit", "export", "import"], "subcategories": ["view", "create", "edit", "export", "import"], "obsolete_parts": ["view", "create", "export"], "user_management": []}	t	t	SYSTEM	2026-07-16 10:54:57.891904	2026-07-16 10:54:57.891904
d7141737-6927-4b7f-a5dc-6e0bee49a350	Viewer	viewer	Part Management	{"parts": ["view", "export"], "audit_logs": ["view"], "categories": ["view", "export"], "subcategories": ["view", "export"], "obsolete_parts": ["view"], "user_management": []}	t	t	SYSTEM	2026-07-16 10:54:57.891904	2026-07-16 10:54:57.891904
9413fee8-de80-4309-80da-13d81dc831a4	Module Admin	module_admin	Auth & Security	{"roles": ["view", "create", "edit", "delete", "export", "import"], "users": ["view", "create", "edit", "delete", "export", "import"], "modules": ["view", "create", "edit", "delete"], "audit_logs": ["view", "export"], "permissions": ["view", "create", "edit", "delete"]}	t	t	SYSTEM	2026-07-16 10:54:57.891904	2026-07-16 10:54:57.891904
680a709a-ff5c-4c36-a82a-1fbd45ea24df	Editor	editor	Auth & Security	{"roles": ["view", "create", "edit", "export"], "users": ["view", "create", "edit", "export"], "modules": ["view"], "audit_logs": ["view", "export"], "permissions": ["view"]}	t	t	SYSTEM	2026-07-16 10:54:57.891904	2026-07-16 10:54:57.891904
5b5b7427-1340-4d02-9d11-61b947bf4c1a	Viewer	viewer	Auth & Security	{"roles": ["view"], "users": ["view", "export"], "modules": ["view"], "audit_logs": ["view"], "permissions": ["view"]}	t	t	SYSTEM	2026-07-16 10:54:57.891904	2026-07-16 10:54:57.891904
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: iam; Owner: postgres
--

COPY iam.permissions (id, name, code, module, action, resource, tenant_id, is_deleted, version, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: policies; Type: TABLE DATA; Schema: iam; Owner: postgres
--

COPY iam.policies (id, name, description, effect, conditions, resource, action, priority, is_active, tenant_id, is_deleted, version, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: iam; Owner: postgres
--

COPY iam.role_permissions (role_id, permission_id) FROM stdin;
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: iam; Owner: postgres
--

COPY iam.roles (id, name, code, description, is_system, tenant_id, is_deleted, version, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: iam; Owner: postgres
--

COPY iam.sessions (id, user_id, token, ip_address, user_agent, expires_at, is_active, tenant_id, is_deleted, version, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: tenants; Type: TABLE DATA; Schema: iam; Owner: postgres
--

COPY iam.tenants (id, name, code, domain, is_active, is_deleted, deleted_at, deleted_by, tenant_id, version, created_at, updated_at, created_by, updated_by, pan, gst, cin, email, phone, website, address_line1, address_line2, city, state, pincode, country, industry, employee_count, contact_person, contact_designation, contact_phone, contact_email) FROM stdin;
b424df0e-f766-4e94-b3fd-05777e158958	Test Corp	TEST	test.com	t	f	\N	\N	TEST	1	2026-07-08 15:46:58.285995	2026-07-08 15:46:58.285995	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	India	\N	\N	\N	\N	\N	\N
a8aa5a7e-5c7a-4ea6-885a-4fd6b439b6a1	TRIAL	1232	supersystems.in	t	f	\N	\N	1232	1	2026-07-08 15:59:29.88521	2026-07-08 16:14:21.305216	\N	\N	ABCDE1234F			mandeep@supersystems.in	9992662555	\N	123 Industrial Area		Gurgaon	Haryana	122051	India	Manufacturing	1-50	Mandeep Siwach	Architecture	+91 9876543210	mandeep@supersystems.in
b166190a-f949-4912-98c3-a8b858dd39a4	Demo Industries	DEMO		t	f	\N	\N	DEMO	1	2026-07-08 16:03:07.653086	2026-07-08 16:16:30.073554	\N	\N	ABCDE1234F	22ABCDE1234F1Z5		info@demo.com	+91 9876543210	\N	123 Industrial Areasdfa		Gurugram	Haryana	122001	India	Manufacturing		Test User		+91 9876543210	test@demo.com
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: iam; Owner: postgres
--

COPY iam.user_roles (user_id, role_id) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: iam; Owner: postgres
--

COPY iam.users (id, email, password_hash, first_name, last_name, phone, is_active, is_locked, is_deleted, deleted_at, deleted_by, tenant_id, version, created_at, updated_at, created_by, updated_by, last_login, failed_attempts, attributes) FROM stdin;
1cbd8975-63b4-4e69-9def-5cecd488cd12	mandeep@supersystems.in	$2b$12$60b/eCbaYPMUmRnKr/3NiOsshTimujgmdVm0n8LJuGfdHpldxfjxW	Mandeep	Siwach	9992662555	t	f	f	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	1	2026-07-17 10:38:38.326267	2026-07-21 09:57:16.440493	\N	\N	2026-07-21 09:57:16.429981	0	{}
301b5714-7898-4484-834c-9257d0ad5a82	orgadmin@acme.com	$2b$12$nqYuz1uWU.2gvb4sd9FBhO6VjsuExwqAT6onz/YiNqAPiBVcuwXo2	Org	Admin	\N	t	f	f	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	1	2026-07-08 17:25:50.289071	2026-07-09 05:13:56.070742	\N	\N	2026-07-09 05:13:56.061087	0	{}
66245a5e-477a-4fd7-8b29-28003a99b699	priya.verma@supersystems.in	$2b$12$nqYuz1uWU.2gvb4sd9FBhO6VjsuExwqAT6onz/YiNqAPiBVcuwXo2	Priya	Verma	9876543211	t	f	f	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	1	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	\N	\N	\N	0	{}
f823fef5-6ad4-41bd-a925-364297f83eee	amit.kumar@supersystems.in	$2b$12$nqYuz1uWU.2gvb4sd9FBhO6VjsuExwqAT6onz/YiNqAPiBVcuwXo2	Amit	Kumar	9876543212	t	f	f	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	1	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	\N	\N	\N	0	{}
f98dcc91-7d08-4f2d-997b-ac22132846cf	rahul.sharma@supersystems.in	$2b$12$nqYuz1uWU.2gvb4sd9FBhO6VjsuExwqAT6onz/YiNqAPiBVcuwXo2	Rahul	Sharma	9876543210	t	f	f	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	1	2026-07-16 10:24:56.412531	2026-07-18 08:33:00.983778	\N	\N	2026-07-18 08:33:00.983778	0	{}
7aa92975-577f-4d4f-a226-2b0299030a4f	ss/60002@system.local	$2b$12$nqYuz1uWU.2gvb4sd9FBhO6VjsuExwqAT6onz/YiNqAPiBVcuwXo2	Gurmeet	Siwach	9992662911	t	f	f	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	1	2026-07-17 17:51:08.871437	2026-07-17 17:51:08.871437	\N	\N	\N	0	{}
f30f587a-b87e-4e50-a384-051d548b6cc8	ps@supersystme.in	$2b$12$nqYuz1uWU.2gvb4sd9FBhO6VjsuExwqAT6onz/YiNqAPiBVcuwXo2	p	s	9876543210	t	f	f	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	1	2026-07-18 10:59:00.238154	2026-07-18 05:30:23.087426	\N	\N	2026-07-18 05:30:23.082118	0	{}
f3d33934-e831-4737-b8fd-5f23b0b84420	usernew@supersystems.in	$2b$12$nqYuz1uWU.2gvb4sd9FBhO6VjsuExwqAT6onz/YiNqAPiBVcuwXo2	Test	UserNew	1234567890	t	f	f	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	1	2026-07-18 12:08:53.106661	2026-07-18 12:08:53.106661	\N	\N	\N	0	{}
b02428e6-e93d-4dd0-86bb-e3bdc0a312dd	usernew2@supersystems.in	$2b$12$nqYuz1uWU.2gvb4sd9FBhO6VjsuExwqAT6onz/YiNqAPiBVcuwXo2	Test	User2	1234567899	t	f	f	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	1	2026-07-18 12:09:46.525688	2026-07-18 12:09:46.525688	\N	\N	\N	0	{}
cc28f720-ce31-451b-9b52-975059a7a2a4	neha.singh@supersystems.in	$2b$12$nqYuz1uWU.2gvb4sd9FBhO6VjsuExwqAT6onz/YiNqAPiBVcuwXo2	Neha	Singh	9876543213	t	f	f	\N	\N	b424df0e-f766-4e94-b3fd-05777e158958	1	2026-07-16 10:24:56.412531	2026-07-18 06:53:39.319923	\N	\N	2026-07-18 06:53:39.318672	0	{}
u-emp-1002	rajesh.inv@acme.com	$2b$12$3YLQuHPDweTjaRtZ4rF7BeajgeRHRqv0KKchQeg9FVPtpHScK0XZW	Rajesh	Kumar	9876543210	t	f	f	\N	\N	TEST	1	2026-07-21 12:09:15.636445	2026-07-21 12:09:15.636445	\N	\N	\N	0	{}
u-emp-1003	sunil.wh@acme.com	$2b$12$3YLQuHPDweTjaRtZ4rF7BeajgeRHRqv0KKchQeg9FVPtpHScK0XZW	Sunil	Verma	9876543211	t	f	f	\N	\N	TEST	1	2026-07-21 12:09:15.638028	2026-07-21 12:09:15.638028	\N	\N	\N	0	{}
u-emp-1004	anita.mfg@acme.com	$2b$12$3YLQuHPDweTjaRtZ4rF7BeajgeRHRqv0KKchQeg9FVPtpHScK0XZW	Anita	Sharma	9876543212	t	f	f	\N	\N	TEST	1	2026-07-21 12:09:15.638812	2026-07-21 12:09:15.638812	\N	\N	\N	0	{}
u-emp-1005	vikram.qc@acme.com	$2b$12$3YLQuHPDweTjaRtZ4rF7BeajgeRHRqv0KKchQeg9FVPtpHScK0XZW	Vikram	Singh	9876543213	t	f	f	\N	\N	TEST	1	2026-07-21 12:09:15.639436	2026-07-21 12:09:15.639436	\N	\N	\N	0	{}
\.


--
-- Data for Name: adjustments; Type: TABLE DATA; Schema: inventory; Owner: postgres
--

COPY inventory.adjustments (id, doc_no, date, location_id, reason, status, lines, approved_by, approved_at, tenant_id, is_deleted, version, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: movements; Type: TABLE DATA; Schema: inventory; Owner: postgres
--

COPY inventory.movements (id, item_id, from_location, to_location, qty, type, reference_type, reference_id, batch_no, remarks, tenant_id, is_deleted, version, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: stock; Type: TABLE DATA; Schema: inventory; Owner: postgres
--

COPY inventory.stock (id, item_id, location_id, warehouse_id, batch_no, serial_no, qty, reserved_qty, uom, unit_cost, tenant_id, is_deleted, version, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: efficiency; Type: TABLE DATA; Schema: machine; Owner: postgres
--

COPY machine.efficiency (id, machine_id, period, availability_pct, performance_pct, quality_pct, oee_pct, notes, tenant_id, created_by, is_deleted, created_at) FROM stdin;
\.


--
-- Data for Name: machines; Type: TABLE DATA; Schema: machine; Owner: postgres
--

COPY machine.machines (id, machine_code, machine_name, machine_type, make, model, purchase_cost, buying_date, vendor, invoice_ref, warranty_expiry, amc_expiry, depreciation_life_years, residual_value, installation_date, current_status, plant, station_id, rated_capacity, capacity_unit, power_rating_kw, max_hours_per_day, shifts_per_day, working_days_per_year, electricity_rate, annual_amc_cost, operator_cost_per_hour, overhead_percent, notes, tenant_id, created_by, is_deleted, created_at, updated_at) FROM stdin;
cc2a1210-447a-4def-b2c1-f714a27e57ea	MCH0001	aaa	Other	s	saf	232134.00	2020-05-27	1243	2341123414	2027-03-12	2025-04-23	10.00	10000.00	2021-03-12	active		\N	0.00		0.000	8.00	1.0	250	0.0000	0.00	0.0000	0.00		TEST		f	2026-07-17 15:05:53.620039	2026-07-17 15:05:53.620039
\.


--
-- Data for Name: stations; Type: TABLE DATA; Schema: machine; Owner: postgres
--

COPY machine.stations (id, station_code, station_name, plant, description, tenant_id, created_by, is_deleted, created_at, updated_at) FROM stdin;
ac502e1c-89c4-4b73-9abf-52703128a80f	11	123	32		TEST		f	2026-07-17 16:13:06.316698	2026-07-17 16:13:06.316698
\.


--
-- Data for Name: bom; Type: TABLE DATA; Schema: manufacturing; Owner: postgres
--

COPY manufacturing.bom (id, name, code, product_id, version_no, status, lines, routing, is_active, tenant_id, is_deleted, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: production_logs; Type: TABLE DATA; Schema: manufacturing; Owner: postgres
--

COPY manufacturing.production_logs (id, work_order_id, date, qty_produced, qty_rejected, operator_id, shift, remarks, tenant_id, is_deleted, version, created_at) FROM stdin;
\.


--
-- Data for Name: work_orders; Type: TABLE DATA; Schema: manufacturing; Owner: postgres
--

COPY manufacturing.work_orders (id, doc_no, date, product_id, bom_id, qty, produced_qty, status, priority, start_date, end_date, work_center, tenant_id, is_deleted, version, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: currencies; Type: TABLE DATA; Schema: master; Owner: postgres
--

COPY master.currencies (id, name, code, symbol, exchange_rate, is_active, tenant_id, is_deleted, version, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: master; Owner: postgres
--

COPY master.customers (id, name, code, type, contact, address, credit_limit, payment_terms, is_active, tenant_id, is_deleted, version, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: master; Owner: postgres
--

COPY master.departments (id, name, code, org_id, parent_id, head_id, is_active, tenant_id, is_deleted, version, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: items; Type: TABLE DATA; Schema: master; Owner: postgres
--

COPY master.items (id, name, code, category, type, uom_id, description, specs, is_active, tenant_id, is_deleted, version, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: locations; Type: TABLE DATA; Schema: master; Owner: postgres
--

COPY master.locations (id, name, code, type, address, geo, is_active, tenant_id, is_deleted, version, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: master; Owner: postgres
--

COPY master.organizations (id, name, code, type, parent_id, address, contact, settings, is_active, tenant_id, is_deleted, version, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: uom; Type: TABLE DATA; Schema: master; Owner: postgres
--

COPY master.uom (id, name, code, category, base_uom, conversion_factor, is_active, tenant_id, is_deleted, version, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: vendors; Type: TABLE DATA; Schema: master; Owner: postgres
--

COPY master.vendors (id, name, code, type, contact, address, payment_terms, is_active, tenant_id, is_deleted, version, created_at, updated_at, created_by, updated_by) FROM stdin;
sup-101	Tata Steel Industrial Solutions	SUP-101	Raw Material	\N	\N	\N	t	TEST	f	1	2026-07-21 12:09:15.653751	2026-07-21 12:09:15.653751	\N	\N
sup-102	Precision Castings Pvt Ltd	SUP-102	Casting & Forging	\N	\N	\N	t	TEST	f	1	2026-07-21 12:09:15.659321	2026-07-21 12:09:15.659321	\N	\N
sup-103	Bosch Automotive Systems	SUP-103	Assemblies	\N	\N	\N	t	TEST	f	1	2026-07-21 12:09:15.660125	2026-07-21 12:09:15.660125	\N	\N
\.


--
-- Data for Name: approval_workflows; Type: TABLE DATA; Schema: part; Owner: postgres
--

COPY part.approval_workflows (id, name, trigger_event, steps, is_active, is_deleted, tenant_id, created_at, part_type) FROM stdin;
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: part; Owner: postgres
--

COPY part.categories (id, name, code, series_prefix, description, is_active, is_deleted, tenant_id, created_at, updated_at, separator) FROM stdin;
4a26f60f-acca-4850-8bfa-940fc4721209	CNC	CNC	700		t	t	TEST	2026-07-09 16:25:00.508862	2026-07-09 16:25:00.508862	-
e7a2c82f-a646-4c80-a4dd-156e3169b6eb	PS TEST	PS 	603	TESTING OF MODULE	t	t	TEST	2026-07-09 17:47:44.068686	2026-07-09 17:47:44.068686	-
2fdf7bc4-c3c6-4367-8f0f-6a18cf516786	TestCat	TES	999		t	t	TEST	2026-07-09 16:21:47.286203	2026-07-09 16:21:47.286203	-
6adf2e44-275f-4add-9ef7-983bc4f6b092	Sheetmetal2	SM2	602		t	t	TEST	2026-07-09 16:08:36.695005	2026-07-09 16:08:36.695005	-
c173247c-d3ea-4dc8-bcd1-f32abd293dc0	Resistor	RES	100	resistor parts only	t	f	TEST	2026-07-13 10:54:55.891488	2026-07-13 10:54:55.891488	-
291bab45-1bca-44d3-af21-2e280ddd2705	Mechanical Parts	MECH	MP	Mechanical components and assemblies	t	f	TEST	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	-
88b3a42f-ebcb-4ad9-9491-113e2973fcc8	Electrical Parts	ELEC	EP	Electrical components and wiring	t	f	TEST	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	-
314400cd-ea43-4559-b775-01ed357afcd4	Hydraulic Parts	HYDR	HP	Hydraulic systems and fittings	t	f	TEST	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	-
a0f3d950-4b32-4d6d-bde9-1e50be49fdf4	Pneumatic Parts	PNEU	PP	Pneumatic cylinders and valves	t	f	TEST	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	-
d1222239-ac55-4471-8651-3eafb137c738	Fasteners	FAST	FP	Bolts, nuts, screws, and washers	t	f	TEST	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	-
d2c728b6-e9b5-4eb9-b6c1-70ffe6bc4471	sheemetal	SHE	601		t	f	TEST	2026-07-17 16:14:31.930131	2026-07-17 16:14:31.930131	.
978be28c-01bf-404c-a4f0-accd3dd5165d	sheet metal	SHE	601		t	f	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-18 15:01:01.049986	2026-07-18 15:01:01.049986	-
\.


--
-- Data for Name: code_schemes; Type: TABLE DATA; Schema: part; Owner: postgres
--

COPY part.code_schemes (id, name, code, description, category, sub_category, category_series, sub_category_series, prefix, suffix, separator, sequence_length, current_sequence, is_active, is_deleted, tenant_id, version, created_at, updated_at, created_by, updated_by, part_type) FROM stdin;
\.


--
-- Data for Name: customer_mappings; Type: TABLE DATA; Schema: part; Owner: postgres
--

COPY part.customer_mappings (id, internal_part_number, internal_description, customer_part_number, customer_description, organization_id, organization_name, tenant_id, is_deleted, created_at, updated_at, created_by) FROM stdin;
bb43fdf0-5e2e-409e-a2eb-d078f2118af2	MP-MP-GR-000001	Mechanical Parts, Gears, Steel, 20mm	TATA-GR-2045	Gear Assembly 20mm Steel Grade A	\N	Tata Advanced Systems	TEST	f	2026-07-16 16:31:59.434049	2026-07-16 16:31:59.434049	Rahul Sharma
be3679b1-4f15-41e1-a34a-cd8c9efd9fa2	MP-MP-GR-000002	Mechanical Parts, Gears, Brass, 30mm	TATA-GR-3060	Brass Gear 30mm Precision	\N	Tata Advanced Systems	TEST	f	2026-07-16 16:31:59.434049	2026-07-16 16:31:59.434049	Rahul Sharma
6771c070-2482-41dd-863d-5171b6ab588d	EP-EP-MT-000001	Electrical Parts, Motors, AC Servo, 750W	BEL-MOT-750S	AC Servo Motor 750W IP65	\N	Bharat Electronics Ltd	TEST	f	2026-07-16 16:31:59.434049	2026-07-16 16:31:59.434049	Rahul Sharma
0bf4cba2-2734-45b1-8cf2-b782d00d86b6	HP-HP-CY-000001	Hydraulic Parts, Cylinders, Aluminium, 50mm bore	BEL-HYD-050A	Hydraulic Cylinder 50mm Aluminium Body	\N	Bharat Electronics Ltd	TEST	f	2026-07-16 16:31:59.434049	2026-07-16 16:31:59.434049	Rahul Sharma
fbdde01a-5a24-4a70-803d-727dd385f5d5	MP-MP-BR-000001	Mechanical Parts, Bearings, Chrome Steel, 6201	FP-HB-0001				TEST	f	2026-07-16 16:49:49.832444	2026-07-16 16:49:49.832444	
\.


--
-- Data for Name: electrical_parts_motors_EP_EP-MT; Type: TABLE DATA; Schema: part; Owner: postgres
--

COPY part."electrical_parts_motors_EP_EP-MT" (id, part_number, description, created_by, status, obsoleted_at, obsolete_reason, created_at, material, size, part_type) FROM stdin;
c20c2d18-0a50-4b7a-b673-e0f070da384f	EP-EP-MT-000001	Electrical Parts, Motors, AC Servo, 750W	Rahul Sharma	active	\N	\N	2026-07-16 16:12:51.158602	AC Servo	750W	bought_out
349ea3e3-37ad-4fd5-bc8c-023f8c7adef4	EP-EP-MT-000002	Electrical Parts, Motors, DC Brushless, 400W	Rahul Sharma	active	\N	\N	2026-07-16 16:12:51.158602	DC Brushless	400W	bought_out
39d8bb61-3fa8-4c71-b7da-c3dc10966a42	EP-EP-MT-000003	Electrical Parts, Motors, Stepper, NEMA23	Rahul Sharma	active	\N	\N	2026-07-16 16:12:51.158602	Stepper	NEMA23	bought_out
3dff74e5-dd59-4b32-848b-15bb144ede00	EP-EP-MT-000004	Electrical Parts, Motors	Test	active	\N	\N	2026-07-17 16:21:31.982014	\N	\N	bought_out
\.


--
-- Data for Name: electrical_parts_sensors_EP_EP-SN; Type: TABLE DATA; Schema: part; Owner: postgres
--

COPY part."electrical_parts_sensors_EP_EP-SN" (id, part_number, description, created_by, status, obsoleted_at, obsolete_reason, created_at, material, size, part_type) FROM stdin;
9d05df3b-40f5-463d-9c08-4aa3fc860852	EP-EP-SN-000001	Electrical Parts, Sensors, Proximity, M12	Rahul Sharma	active	\N	\N	2026-07-16 16:12:51.158602	Proximity	M12	bought_out
52376d68-0f08-4e4b-817f-0d5990d0af8c	EP-EP-SN-000002	Electrical Parts, Sensors, Photoelectric, M18	Rahul Sharma	active	\N	\N	2026-07-16 16:12:51.158602	Photoelectric	M18	bought_out
dbd107b9-a4f8-4d40-a495-7e61c6cca0fd	EP-EP-SN-000003	Electrical Parts, Sensors	Test	active	\N	\N	2026-07-17 16:21:31.985668	\N	\N	bought_out
\.


--
-- Data for Name: fasteners_hex_bolts_FP_FP-HB; Type: TABLE DATA; Schema: part; Owner: postgres
--

COPY part."fasteners_hex_bolts_FP_FP-HB" (id, part_number, description, created_by, status, obsoleted_at, obsolete_reason, created_at, material, size, part_type) FROM stdin;
52d6808b-0c8a-4c0d-989b-27ca3be87e2c	FP-FP-HB-000001	Fasteners, Hex Bolts, Grade 8.8, M10x40	Rahul Sharma	active	\N	\N	2026-07-16 16:12:51.158602	Grade 8.8	M10x40	bought_out
5cc9b010-9bc0-4c01-9c26-9a6fef3b7d5b	FP-FP-HB-000002	Fasteners, Hex Bolts, Grade 10.9, M12x50	Rahul Sharma	active	\N	\N	2026-07-16 16:12:51.158602	Grade 10.9	M12x50	bought_out
74a0f114-4a1b-45be-ad28-495ac9858cba	FP-FP-HB-000003	Fasteners, Hex Bolts	Test	active	\N	\N	2026-07-17 16:21:32.017355	\N	\N	bought_out
\.


--
-- Data for Name: fasteners_lock_nuts_FP_FP-LN; Type: TABLE DATA; Schema: part; Owner: postgres
--

COPY part."fasteners_lock_nuts_FP_FP-LN" (id, part_number, description, created_by, status, obsoleted_at, obsolete_reason, created_at, material, size, part_type) FROM stdin;
1dffd254-0e2a-4095-9859-90abfddf1494	FP-FP-LN-000001	Fasteners, Lock Nuts, Zinc Plated, M10	Rahul Sharma	active	\N	\N	2026-07-16 16:12:51.158602	Zinc Plated	M10	bought_out
9e22bd3e-6113-42e8-b163-492ddb8607a1	FP-FP-LN-000002	Fasteners, Lock Nuts, SS304, M12	Rahul Sharma	active	\N	\N	2026-07-16 16:12:51.158602	SS304	M12	bought_out
ac1d9b17-2469-4939-9d07-5e17b076ecf6	FP-FP-LN-000003	Fasteners, Lock Nuts	Test	active	\N	\N	2026-07-17 16:21:32.02143	\N	\N	bought_out
\.


--
-- Data for Name: hydraulic_parts_cylinders_HP_HP-CY; Type: TABLE DATA; Schema: part; Owner: postgres
--

COPY part."hydraulic_parts_cylinders_HP_HP-CY" (id, part_number, description, created_by, status, obsoleted_at, obsolete_reason, created_at, material, size, part_type) FROM stdin;
f3cdc298-43be-414b-a523-73ee8291129c	HP-HP-CY-000001	Hydraulic Parts, Cylinders, Aluminium, 50mm bore	Rahul Sharma	active	\N	\N	2026-07-16 16:12:51.158602	Aluminium	50mm bore	bought_out
2cee5521-976e-4037-bb4e-bb618025b984	HP-HP-CY-000002	Hydraulic Parts, Cylinders, Steel, 80mm bore	Rahul Sharma	active	\N	\N	2026-07-16 16:12:51.158602	Steel	80mm bore	bought_out
75ece5ee-3285-498d-bd56-f3201a74e5dd	HP-HP-CY-000003	Hydraulic Parts, Cylinders	Test	active	\N	\N	2026-07-17 16:21:31.989069	\N	\N	bought_out
\.


--
-- Data for Name: hydraulic_parts_pumps_HP_HP-PM; Type: TABLE DATA; Schema: part; Owner: postgres
--

COPY part."hydraulic_parts_pumps_HP_HP-PM" (id, part_number, description, created_by, status, obsoleted_at, obsolete_reason, created_at, material, size, part_type) FROM stdin;
1c231890-fdbc-480f-b76f-7cd009179690	HP-HP-PM-000001	Hydraulic Parts, Pumps, Cast Iron, 10 LPM	Rahul Sharma	active	\N	\N	2026-07-16 16:12:51.158602	Cast Iron	10 LPM	bought_out
e2f4c4f3-0084-4cff-8531-fe34728410e8	HP-HP-PM-000002	Hydraulic Parts, Pumps, Aluminium, 20 LPM	Rahul Sharma	active	\N	\N	2026-07-16 16:12:51.158602	Aluminium	20 LPM	bought_out
abbca137-df8a-45ed-9904-7cab4265f504	HP-HP-PM-000003	Hydraulic Parts, Pumps	Test	active	\N	\N	2026-07-17 16:21:32.004705	\N	\N	bought_out
\.


--
-- Data for Name: masters; Type: TABLE DATA; Schema: part; Owner: postgres
--

COPY part.masters (id, part_number, name, description, code_scheme_id, category, sub_category, uom, material_type, weight, weight_unit, dimensions, drawing_number, revision, status, is_active, is_deleted, tenant_id, version, created_at, updated_at, created_by, updated_by, part_type) FROM stdin;
pm-601-base	601-0-000001	Precision Engine Crankshaft Base	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	Draft	t	f	TEST	1	2026-07-21 12:09:15.644152	2026-07-21 12:09:15.644152	\N	\N	bought_out
pm-601-op1	601-0-000001-01	Crankshaft Op 1: Rough Turning	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	In Progress	t	f	TEST	1	2026-07-21 12:09:15.646379	2026-07-21 12:09:15.646379	\N	\N	bought_out
pm-601-op2	601-0-000001-02	Crankshaft Op 2: CNC Milling & Grinding	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	In Progress	t	f	TEST	1	2026-07-21 12:09:15.647781	2026-07-21 12:09:15.647781	\N	\N	bought_out
pm-601-fg	601-0-000001-99	Finished Engine Crankshaft Assembly (FG)	\N	\N	Engine Components	Shafts & Axles	pcs	Alloy Steel 316L	\N	\N	\N	\N	A	Approved	t	f	TEST	1	2026-07-21 12:09:15.648565	2026-07-21 12:09:15.648565	\N	\N	bought_out
pm-601-ng	601-0-000001-88	Rejected Crankshaft Casting (NG)	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	Scrapped	t	f	TEST	1	2026-07-21 12:09:15.649074	2026-07-21 12:09:15.649074	\N	\N	bought_out
pm-602-fg	602-0-000002-99	High Compression Piston Assembly (FG)	\N	\N	Engine Components	Pistons	pcs	Aluminum 6061	\N	\N	\N	\N	A	Approved	t	f	TEST	1	2026-07-21 12:09:15.649505	2026-07-21 12:09:15.649505	\N	\N	bought_out
13f12f89-69f9-4460-8bd8-5851ce577623	601-0-000001	Precision Engine Crankshaft Base	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	Draft	t	f	TEST	1	2026-07-21 12:09:54.600055	2026-07-21 12:09:54.600055	\N	\N	bought_out
7ca5951c-4eee-41cd-ad69-b8fc9f7e3431	601-0-000001-01	Crankshaft Op 1: Rough Turning	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	In Progress	t	f	TEST	1	2026-07-21 12:09:54.601554	2026-07-21 12:09:54.601554	\N	\N	bought_out
40c778d3-81a6-4e0b-a921-8ed1e4374b47	601-0-000001-02	Crankshaft Op 2: CNC Milling & Grinding	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	In Progress	t	f	TEST	1	2026-07-21 12:09:54.602644	2026-07-21 12:09:54.602644	\N	\N	bought_out
905a7339-35ac-461b-9c60-49891b10b54a	601-0-000001-99	Finished Engine Crankshaft Assembly (FG)	\N	\N	Engine Components	Shafts & Axles	pcs	Alloy Steel 316L	\N	\N	\N	\N	A	Approved	t	f	TEST	1	2026-07-21 12:09:54.603145	2026-07-21 12:09:54.603145	\N	\N	bought_out
e91d0abc-4ddc-4c70-ac95-2198c09c8476	601-0-000001-88	Rejected Crankshaft Casting (NG)	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	Scrapped	t	f	TEST	1	2026-07-21 12:09:54.603632	2026-07-21 12:09:54.603632	\N	\N	bought_out
f90ab2b6-32b7-47f1-8108-7b8c9f73e97a	602-0-000002-99	High Compression Piston Assembly (FG)	\N	\N	Engine Components	Pistons	pcs	Aluminum 6061	\N	\N	\N	\N	A	Approved	t	f	TEST	1	2026-07-21 12:09:54.604262	2026-07-21 12:09:54.604262	\N	\N	bought_out
d9d970cb-4db5-4eca-a145-7f6c8b189f87	601-0-000001	Precision Engine Crankshaft Base	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	Draft	t	f	TEST	1	2026-07-21 12:16:37.82224	2026-07-21 12:16:37.82224	\N	\N	bought_out
c11d992c-14af-431c-b895-afebfbaecfb8	601-0-000001-01	Crankshaft Op 1: Rough Turning	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	In Progress	t	f	TEST	1	2026-07-21 12:16:37.823613	2026-07-21 12:16:37.823613	\N	\N	bought_out
e8805ffd-e3c8-4740-b235-8206206ced9e	601-0-000001-02	Crankshaft Op 2: CNC Milling & Grinding	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	In Progress	t	f	TEST	1	2026-07-21 12:16:37.824166	2026-07-21 12:16:37.824166	\N	\N	bought_out
a788f98e-7f6e-49c8-bf31-15fc55833643	601-0-000001-99	Finished Engine Crankshaft Assembly (FG)	\N	\N	Engine Components	Shafts & Axles	pcs	Alloy Steel 316L	\N	\N	\N	\N	A	Approved	t	f	TEST	1	2026-07-21 12:16:37.824659	2026-07-21 12:16:37.824659	\N	\N	bought_out
0ff9aa7e-1791-453f-8f02-0c26697c80c9	601-0-000001-88	Rejected Crankshaft Casting (NG)	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	Scrapped	t	f	TEST	1	2026-07-21 12:16:37.825142	2026-07-21 12:16:37.825142	\N	\N	bought_out
74ecad62-6c2f-4083-a513-a440066341d5	602-0-000002-99	High Compression Piston Assembly (FG)	\N	\N	Engine Components	Pistons	pcs	Aluminum 6061	\N	\N	\N	\N	A	Approved	t	f	TEST	1	2026-07-21 12:16:37.825665	2026-07-21 12:16:37.825665	\N	\N	bought_out
66a54aaa-4a26-45a3-8ad5-d481084a2606	601-0-000001	Precision Engine Crankshaft Base	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	Draft	t	f	TEST	1	2026-07-21 13:16:34.548907	2026-07-21 13:16:34.548907	\N	\N	bought_out
d0325e2b-e47c-455e-8959-4438a10e14a0	601-0-000001-01	Crankshaft Op 1: Rough Turning	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	In Progress	t	f	TEST	1	2026-07-21 13:16:34.551164	2026-07-21 13:16:34.551164	\N	\N	bought_out
91882669-14ec-4299-bdcd-0da18f7237ba	601-0-000001-02	Crankshaft Op 2: CNC Milling & Grinding	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	In Progress	t	f	TEST	1	2026-07-21 13:16:34.552548	2026-07-21 13:16:34.552548	\N	\N	bought_out
f5a74cb9-66d9-45d1-886f-7e6427af71f8	601-0-000001-99	Finished Engine Crankshaft Assembly (FG)	\N	\N	Engine Components	Shafts & Axles	pcs	Alloy Steel 316L	\N	\N	\N	\N	A	Approved	t	f	TEST	1	2026-07-21 13:16:34.553317	2026-07-21 13:16:34.553317	\N	\N	bought_out
45576241-e68b-4f7b-a936-bd1df773012f	601-0-000001-88	Rejected Crankshaft Casting (NG)	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	Scrapped	t	f	TEST	1	2026-07-21 13:16:34.553952	2026-07-21 13:16:34.553952	\N	\N	bought_out
d6ed558b-49d5-4b4b-b94f-c707bfc71c13	602-0-000002-99	High Compression Piston Assembly (FG)	\N	\N	Engine Components	Pistons	pcs	Aluminum 6061	\N	\N	\N	\N	A	Approved	t	f	TEST	1	2026-07-21 13:16:34.554868	2026-07-21 13:16:34.554868	\N	\N	bought_out
2c01c421-f68b-4728-8c92-b7543ae7466e	601-0-000001	Precision Engine Crankshaft Base	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	Draft	t	f	TEST	1	2026-07-21 13:44:40.141214	2026-07-21 13:44:40.141214	\N	\N	bought_out
532432ba-5a5d-44d4-a9ac-c6296cc0407b	601-0-000001-01	Crankshaft Op 1: Rough Turning	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	In Progress	t	f	TEST	1	2026-07-21 13:44:40.145346	2026-07-21 13:44:40.145346	\N	\N	bought_out
a353cc5f-a945-4081-8e75-537b429d1ff7	601-0-000001-02	Crankshaft Op 2: CNC Milling & Grinding	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	In Progress	t	f	TEST	1	2026-07-21 13:44:40.147745	2026-07-21 13:44:40.147745	\N	\N	bought_out
c0e8b89c-4a53-465b-9290-353a48a2daa2	601-0-000001-99	Finished Engine Crankshaft Assembly (FG)	\N	\N	Engine Components	Shafts & Axles	pcs	Alloy Steel 316L	\N	\N	\N	\N	A	Approved	t	f	TEST	1	2026-07-21 13:44:40.14829	2026-07-21 13:44:40.14829	\N	\N	bought_out
8fdc8e06-f1f7-4b69-9a26-6e2e8a5d4dc1	601-0-000001-88	Rejected Crankshaft Casting (NG)	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	Scrapped	t	f	TEST	1	2026-07-21 13:44:40.148764	2026-07-21 13:44:40.148764	\N	\N	bought_out
69a5eec2-06eb-49aa-acd5-6a3d48e9ea97	602-0-000002-99	High Compression Piston Assembly (FG)	\N	\N	Engine Components	Pistons	pcs	Aluminum 6061	\N	\N	\N	\N	A	Approved	t	f	TEST	1	2026-07-21 13:44:40.149233	2026-07-21 13:44:40.149233	\N	\N	bought_out
795fd9a0-8d57-4783-a22b-50725988af69	601-0-000001	Precision Engine Crankshaft Base	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	Draft	t	f	TEST	1	2026-07-21 13:45:25.70099	2026-07-21 13:45:25.70099	\N	\N	bought_out
88770e26-6a77-4344-aa38-0bf7ab50b561	601-0-000001-01	Crankshaft Op 1: Rough Turning	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	In Progress	t	f	TEST	1	2026-07-21 13:45:25.714948	2026-07-21 13:45:25.714948	\N	\N	bought_out
df50e27a-2568-4a0f-811a-7686f6e7c225	601-0-000001-02	Crankshaft Op 2: CNC Milling & Grinding	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	In Progress	t	f	TEST	1	2026-07-21 13:45:25.715905	2026-07-21 13:45:25.715905	\N	\N	bought_out
aadb339f-4ac3-4359-ae58-2dbe40c63de8	601-0-000001-99	Finished Engine Crankshaft Assembly (FG)	\N	\N	Engine Components	Shafts & Axles	pcs	Alloy Steel 316L	\N	\N	\N	\N	A	Approved	t	f	TEST	1	2026-07-21 13:45:25.716422	2026-07-21 13:45:25.716422	\N	\N	bought_out
d57a070a-e697-4658-9563-35aae82b24ac	601-0-000001-88	Rejected Crankshaft Casting (NG)	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	Scrapped	t	f	TEST	1	2026-07-21 13:45:25.716947	2026-07-21 13:45:25.716947	\N	\N	bought_out
7fbe0df0-846e-44f4-b125-e68d4146920f	602-0-000002-99	High Compression Piston Assembly (FG)	\N	\N	Engine Components	Pistons	pcs	Aluminum 6061	\N	\N	\N	\N	A	Approved	t	f	TEST	1	2026-07-21 13:45:25.717448	2026-07-21 13:45:25.717448	\N	\N	bought_out
3a66fe9a-b32e-45ff-80ff-7eb21b4e66f8	601-0-000001	Precision Engine Crankshaft Base	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	Draft	t	f	TEST	1	2026-07-21 14:11:53.561022	2026-07-21 14:11:53.561022	\N	\N	bought_out
892326f9-baa4-4068-88c3-d6ccc640828b	601-0-000001-01	Crankshaft Op 1: Rough Turning	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	In Progress	t	f	TEST	1	2026-07-21 14:11:53.578658	2026-07-21 14:11:53.578658	\N	\N	bought_out
f852a9d4-626c-442e-8d88-d3c708296a6d	601-0-000001-02	Crankshaft Op 2: CNC Milling & Grinding	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	In Progress	t	f	TEST	1	2026-07-21 14:11:53.581148	2026-07-21 14:11:53.581148	\N	\N	bought_out
8d5ea7ef-c270-4d31-9836-82e75f2f58db	601-0-000001-99	Finished Engine Crankshaft Assembly (FG)	\N	\N	Engine Components	Shafts & Axles	pcs	Alloy Steel 316L	\N	\N	\N	\N	A	Approved	t	f	TEST	1	2026-07-21 14:11:53.582533	2026-07-21 14:11:53.582533	\N	\N	bought_out
07f9687b-8c01-4e49-ad99-5be04ced6790	601-0-000001-88	Rejected Crankshaft Casting (NG)	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	Scrapped	t	f	TEST	1	2026-07-21 14:11:53.58373	2026-07-21 14:11:53.58373	\N	\N	bought_out
5e88cfc5-7eb6-4a02-9ef6-128f905fa8e1	602-0-000002-99	High Compression Piston Assembly (FG)	\N	\N	Engine Components	Pistons	pcs	Aluminum 6061	\N	\N	\N	\N	A	Approved	t	f	TEST	1	2026-07-21 14:11:53.585025	2026-07-21 14:11:53.585025	\N	\N	bought_out
5f8b5b5d-3af8-48ec-982f-24242b05be2e	601-0-000001	Precision Engine Crankshaft Base	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	Draft	t	f	TEST	1	2026-07-21 14:23:54.537687	2026-07-21 14:23:54.537687	\N	\N	bought_out
b6903001-55a6-42d2-8c23-edc58604297b	601-0-000001-01	Crankshaft Op 1: Rough Turning	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	In Progress	t	f	TEST	1	2026-07-21 14:23:54.542461	2026-07-21 14:23:54.542461	\N	\N	bought_out
a362db01-e37a-426b-a9c5-b8baa3aabb1e	601-0-000001-02	Crankshaft Op 2: CNC Milling & Grinding	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	In Progress	t	f	TEST	1	2026-07-21 14:23:54.544678	2026-07-21 14:23:54.544678	\N	\N	bought_out
feb82607-2a34-457d-bb8c-1c7fbad67c77	601-0-000001-99	Finished Engine Crankshaft Assembly (FG)	\N	\N	Engine Components	Shafts & Axles	pcs	Alloy Steel 316L	\N	\N	\N	\N	A	Approved	t	f	TEST	1	2026-07-21 14:23:54.546719	2026-07-21 14:23:54.546719	\N	\N	bought_out
69b930dd-9b58-4c1c-919b-972a5895d61a	601-0-000001-88	Rejected Crankshaft Casting (NG)	\N	\N	Engine Components	Shafts & Axles	pcs	Forged Steel	\N	\N	\N	\N	A	Scrapped	t	f	TEST	1	2026-07-21 14:23:54.548516	2026-07-21 14:23:54.548516	\N	\N	bought_out
ad191ebd-2e65-4609-be8d-73226e26b482	602-0-000002-99	High Compression Piston Assembly (FG)	\N	\N	Engine Components	Pistons	pcs	Aluminum 6061	\N	\N	\N	\N	A	Approved	t	f	TEST	1	2026-07-21 14:23:54.550285	2026-07-21 14:23:54.550285	\N	\N	bought_out
\.


--
-- Data for Name: mechanical_parts_bearings_MP_MP-BR; Type: TABLE DATA; Schema: part; Owner: postgres
--

COPY part."mechanical_parts_bearings_MP_MP-BR" (id, part_number, description, created_by, status, obsoleted_at, obsolete_reason, created_at, material, size, part_type) FROM stdin;
c0ad7d0d-796a-4a71-bae3-2b7a1738ad87	MP-MP-BR-000001	Mechanical Parts, Bearings, Chrome Steel, 6201	Rahul Sharma	active	\N	\N	2026-07-16 16:12:51.158602	Chrome Steel	6201	bought_out
021feafd-caf7-467f-9e5d-8370b0e64d46	MP-MP-BR-000002	Mechanical Parts, Bearings, Stainless, 6202	Rahul Sharma	active	\N	\N	2026-07-16 16:12:51.158602	Stainless	6202	bought_out
701c1de7-9277-4219-84c5-77afa8b753ce	MP-MP-BR-000003	Mechanical Parts, Bearings, Chrome Steel, 6203	Rahul Sharma	active	\N	\N	2026-07-16 16:12:51.158602	Chrome Steel	6203	bought_out
c28b8960-e24a-470d-a577-0895e3358636	MP-MP-BR-000004	Mechanical Parts, Bearings	Test	active	\N	\N	2026-07-17 16:20:43.901767	\N	\N	bought_out
\.


--
-- Data for Name: mechanical_parts_gears_MP_MP-GR; Type: TABLE DATA; Schema: part; Owner: postgres
--

COPY part."mechanical_parts_gears_MP_MP-GR" (id, part_number, description, created_by, status, obsoleted_at, obsolete_reason, created_at, material, size, part_type) FROM stdin;
3545c21d-ab1c-4e94-a444-f959b6e622fd	MP-MP-GR-000001	Mechanical Parts, Gears, Steel, 20mm	Rahul Sharma	active	\N	\N	2026-07-16 16:12:51.158602	Steel	20mm	bought_out
957da9dd-46b9-45ee-926a-c4fb9ec68b33	MP-MP-GR-000002	Mechanical Parts, Gears, Brass, 30mm	Rahul Sharma	active	\N	\N	2026-07-16 16:12:51.158602	Brass	30mm	bought_out
d4527573-1c3e-4b31-8034-87ec7bd87ef8	MP-MP-GR-000003	Mechanical Parts, Gears, Steel, 40mm	Rahul Sharma	active	\N	\N	2026-07-16 16:12:51.158602	Steel	40mm	bought_out
1e4c1702-5a8a-456e-b3bd-7bea3b77e7e0	MP-MP-GR-000004	Mechanical Parts, Gears, 123123, 123123		active	\N	\N	2026-07-17 15:07:50.842527	\N	\N	manufactured
a4e7d589-67fb-46ac-a8f3-2ae4c926c9e3	MP-MP-GR-000005	Mechanical Parts, Gears	Test	active	\N	\N	2026-07-17 16:21:31.998328	\N	\N	bought_out
\.


--
-- Data for Name: mechanical_parts_shafts_MP_MP-SH; Type: TABLE DATA; Schema: part; Owner: postgres
--

COPY part."mechanical_parts_shafts_MP_MP-SH" (id, part_number, description, created_by, status, obsoleted_at, obsolete_reason, created_at, material, size, part_type) FROM stdin;
3b091710-0a07-40c7-aab7-6c9951ad72d9	MP-MP-SH-000001	Mechanical Parts, Shafts, EN8, 25mm dia	Rahul Sharma	active	\N	\N	2026-07-16 16:12:51.158602	EN8	25mm dia	bought_out
46328c73-64cf-47cc-bef8-fa3b7d015d29	MP-MP-SH-000002	Mechanical Parts, Shafts, EN24, 32mm dia	Rahul Sharma	active	\N	\N	2026-07-16 16:12:51.158602	EN24	32mm dia	bought_out
97453e54-a73f-4db0-839b-79977608c2e0	MP-MP-SH-000003	Mechanical Parts, Shafts	Test	active	\N	\N	2026-07-17 16:21:31.973907	\N	\N	bought_out
\.


--
-- Data for Name: pneumatic_parts_actuators_PP_PP-AC; Type: TABLE DATA; Schema: part; Owner: postgres
--

COPY part."pneumatic_parts_actuators_PP_PP-AC" (id, part_number, description, created_by, status, obsoleted_at, obsolete_reason, created_at, material, size, part_type) FROM stdin;
0341de6d-76d0-4e85-88f3-6fb5a84b0af4	PP-PP-AC-000001	Pneumatic Parts, Actuators, Aluminium, 100mm stroke	Rahul Sharma	active	\N	\N	2026-07-16 16:12:51.158602	Aluminium	100mm stroke	bought_out
635a729c-c037-4b45-a75e-162bf7c2c133	PP-PP-AC-000002	Pneumatic Parts, Actuators, Steel, 200mm stroke	Rahul Sharma	active	\N	\N	2026-07-16 16:12:51.158602	Steel	200mm stroke	bought_out
7daec3d8-6f15-40bd-9cb4-3b4cc8d0d32d	PP-PP-AC-000003	Pneumatic Parts, Actuators	Test	active	\N	\N	2026-07-17 16:21:32.013323	\N	\N	bought_out
\.


--
-- Data for Name: pneumatic_parts_valves_PP_PP-VL; Type: TABLE DATA; Schema: part; Owner: postgres
--

COPY part."pneumatic_parts_valves_PP_PP-VL" (id, part_number, description, created_by, status, obsoleted_at, obsolete_reason, created_at, material, size, part_type) FROM stdin;
186381a3-33af-437e-865b-ae323779a037	PP-PP-VL-000001	Pneumatic Parts, Valves, Brass, 1/2 inch	Rahul Sharma	active	\N	\N	2026-07-16 16:12:51.158602	Brass	1/2 inch	bought_out
f13b9f14-074b-4709-a254-691cd57c37d0	PP-PP-VL-000002	Pneumatic Parts, Valves, SS304, 3/4 inch	Rahul Sharma	active	\N	\N	2026-07-16 16:12:51.158602	SS304	3/4 inch	bought_out
60954d52-4926-4dd1-bbe8-0895d6ccc629	PP-PP-VL-000003	Pneumatic Parts, Valves	Test	active	\N	\N	2026-07-17 16:21:32.008969	\N	\N	bought_out
\.


--
-- Data for Name: resistor_smt_100_1001; Type: TABLE DATA; Schema: part; Owner: postgres
--

COPY part.resistor_smt_100_1001 (id, part_number, status, obsoleted_at, obsolete_reason, created_at, value, tolerence, part_type, description, created_by) FROM stdin;
9e36a45b-45f4-475b-8394-96ca984b8abc	100-1001-000001	active	\N	\N	2026-07-16 11:31:05.682518	\N	\N	bought_out		
c3040fa3-6260-4635-aadd-8999b7c9bf29	100-1001-000002	active	\N	\N	2026-07-16 11:31:06.49044	\N	\N	bought_out		
d73ac367-0928-4398-9708-6097564197d8	100-1001-000003	active	\N	\N	2026-07-16 11:31:07.04366	\N	\N	bought_out		
a856b136-2d7f-4f0a-bc71-6fb390b97355	100-1001-000004	active	\N	\N	2026-07-17 16:21:31.992525	\N	\N	bought_out	Resistor, SMT	Test
\.


--
-- Data for Name: series; Type: TABLE DATA; Schema: part; Owner: postgres
--

COPY part.series (id, name, prefix, current_sequence, scheme_id, is_active, is_deleted, tenant_id, created_at, updated_at, part_type) FROM stdin;
\.


--
-- Data for Name: sheemetal_mould_601_1; Type: TABLE DATA; Schema: part; Owner: postgres
--

COPY part.sheemetal_mould_601_1 (id, part_number, description, created_by, status, obsoleted_at, obsolete_reason, created_at, asd, df, gf, part_type) FROM stdin;
61553049-10fc-4742-8911-b8c3223c67e3	601.1.000001	sheemetal, mould	Test	active	\N	\N	2026-07-17 16:23:55.384809	\N	\N	\N	bought_out
a6ca4632-5c1c-4182-912e-f8fe0dbafef8	601.1.000002	sheemetal, mould, sdf, fsda		active	\N	\N	2026-07-17 16:24:23.353396	sdf	fsda	\N	bought_out
ce0fd72c-ae1f-4e97-8c71-ac09c36976dc	601.1.000003	sheemetal, mould, asdf, dfasdf, the		active	\N	\N	2026-07-17 16:24:35.841845	asdf	dfasdf	the	manufactured
\.


--
-- Data for Name: sheet_metal_fg_601_1; Type: TABLE DATA; Schema: part; Owner: postgres
--

COPY part.sheet_metal_fg_601_1 (id, part_number, description, created_by, is_bought_out, is_manufactured, status, obsoleted_at, obsolete_reason, created_at, weight, length) FROM stdin;
ee700366-bbab-4d75-8a72-fc752ba8b692	601-1-000001	sheet metal, fg, cc, xx	mandeep@supersystems.in	t	t	active	\N	\N	2026-07-18 15:09:55.848584	cc	xx
afc03460-d4ab-4bfc-bbd6-84a3c2609947	601-1-000002	sheet metal, fg, xx, cc	mandeep@supersystems.in	t	t	active	\N	\N	2026-07-18 15:10:18.955492	xx	cc
\.


--
-- Data for Name: subcategories; Type: TABLE DATA; Schema: part; Owner: postgres
--

COPY part.subcategories (id, name, code, series_prefix, category_id, is_active, is_deleted, tenant_id, created_at, updated_at, current_sequence, columns_config, description_columns) FROM stdin;
4816e4bd-7118-4748-ae09-300ee2955d9b	Milling	MIL	1	4a26f60f-acca-4850-8bfa-940fc4721209	t	t	TEST	2026-07-09 16:25:00.541092	2026-07-09 16:25:00.598934	1	[{"name": "material", "type": "varchar", "label": "Material"}, {"name": "diameter", "type": "numeric", "label": "Diameter"}]	[]
cddd4e3b-16f7-4c8c-9cdf-888341c7d8f9	Proto	PR	0	6adf2e44-275f-4add-9ef7-983bc4f6b092	t	t	TEST	2026-07-09 16:08:56.574566	2026-07-09 16:09:35.312776	2	[{"name": "material", "type": "varchar", "label": "Material"}, {"name": "thickness", "type": "varchar", "label": "Thickness"}]	[]
5c46a9c1-7fea-4143-992a-2607a9eafa3f	Bearings	BR	MP-BR	291bab45-1bca-44d3-af21-2e280ddd2705	t	f	TEST	2026-07-16 10:24:56.412531	2026-07-17 16:20:43.901767	4	[{"name": "Material", "type": "text"}, {"name": "Size", "type": "text"}]	["Material", "Size"]
abdcb370-1cd1-4d9c-b27c-a592aea256af	Shafts	SH	MP-SH	291bab45-1bca-44d3-af21-2e280ddd2705	t	f	TEST	2026-07-16 10:24:56.412531	2026-07-17 16:21:31.973907	3	[{"name": "Material", "type": "text"}, {"name": "Size", "type": "text"}]	["Material", "Size"]
ad17c8ee-203a-4095-a8f6-5fd25a552308	Motors	MT	EP-MT	88b3a42f-ebcb-4ad9-9491-113e2973fcc8	t	f	TEST	2026-07-16 10:24:56.412531	2026-07-17 16:21:31.982014	4	[{"name": "Material", "type": "text"}, {"name": "Size", "type": "text"}]	["Material", "Size"]
b6bb6305-5ea8-4e82-b452-1126ec3602c3	Sensors	SN	EP-SN	88b3a42f-ebcb-4ad9-9491-113e2973fcc8	t	f	TEST	2026-07-16 10:24:56.412531	2026-07-17 16:21:31.985668	3	[{"name": "Material", "type": "text"}, {"name": "Size", "type": "text"}]	["Material", "Size"]
1c504cc1-d05c-467e-8eb4-b6b7a7b0e00b	Cylinders	CY	HP-CY	314400cd-ea43-4559-b775-01ed357afcd4	t	f	TEST	2026-07-16 10:24:56.412531	2026-07-17 16:21:31.989069	3	[{"name": "Material", "type": "text"}, {"name": "Size", "type": "text"}]	["Material", "Size"]
6678e956-ef58-4a7e-a619-af71766321e2	SMT	SMT	1001	c173247c-d3ea-4dc8-bcd1-f32abd293dc0	t	f	TEST	2026-07-13 10:55:29.994499	2026-07-17 16:21:31.992525	4	[{"name": "value", "type": "varchar", "label": "Value"}, {"name": "tolerence", "type": "varchar", "label": "tolerence"}]	[]
26484eeb-7342-41c5-a349-f2ffa3a13757	Gears	GR	MP-GR	291bab45-1bca-44d3-af21-2e280ddd2705	t	f	TEST	2026-07-16 10:24:56.412531	2026-07-17 16:21:31.998328	5	[{"name": "Material", "type": "text"}, {"name": "Size", "type": "text"}]	["Material", "Size"]
8cecefd1-ecea-4510-9f1b-ec95cdf09009	fg	FG	1	978be28c-01bf-404c-a4f0-accd3dd5165d	t	f	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-18 15:06:33.271368	2026-07-18 15:10:18.955492	2	[{"name": "weight", "type": "varchar", "label": "weight"}, {"name": "length", "type": "varchar", "label": "length"}]	["weight", "length"]
5dc36761-affd-4beb-a4c3-8ada07c73109	Pumps	PM	HP-PM	314400cd-ea43-4559-b775-01ed357afcd4	t	f	TEST	2026-07-16 10:24:56.412531	2026-07-17 16:21:32.004705	3	[{"name": "Material", "type": "text"}, {"name": "Size", "type": "text"}]	["Material", "Size"]
7161592e-44cd-4c70-b048-e39155e52ba5	Valves	VL	PP-VL	a0f3d950-4b32-4d6d-bde9-1e50be49fdf4	t	f	TEST	2026-07-16 10:24:56.412531	2026-07-17 16:21:32.008969	3	[{"name": "Material", "type": "text"}, {"name": "Size", "type": "text"}]	["Material", "Size"]
21e03063-e87b-47ef-af0a-e23f49bdf06b	Actuators	AC	PP-AC	a0f3d950-4b32-4d6d-bde9-1e50be49fdf4	t	f	TEST	2026-07-16 10:24:56.412531	2026-07-17 16:21:32.013323	3	[{"name": "Material", "type": "text"}, {"name": "Size", "type": "text"}]	["Material", "Size"]
d4d3e5ec-e4e1-40d5-ae27-893f5d2aaef6	Hex Bolts	HB	FP-HB	d1222239-ac55-4471-8651-3eafb137c738	t	f	TEST	2026-07-16 10:24:56.412531	2026-07-17 16:21:32.017355	3	[{"name": "Material", "type": "text"}, {"name": "Size", "type": "text"}]	["Material", "Size"]
1e2aa5b0-8aa2-453e-b7be-067ce33115dc	Lock Nuts	LN	FP-LN	d1222239-ac55-4471-8651-3eafb137c738	t	f	TEST	2026-07-16 10:24:56.412531	2026-07-17 16:21:32.02143	3	[{"name": "Material", "type": "text"}, {"name": "Size", "type": "text"}]	["Material", "Size"]
5ab4f508-f6bc-488b-964b-c47bad535eda	mould	MOU	1	d2c728b6-e9b5-4eb9-b6c1-70ffe6bc4471	t	f	TEST	2026-07-17 16:15:09.777368	2026-07-17 16:24:35.841845	3	[{"name": "asd", "type": "varchar", "label": "asd"}, {"name": "df", "type": "varchar", "label": "df"}, {"name": "gf", "type": "varchar", "label": "gf"}]	["asd", "df", "gf"]
\.


--
-- Data for Name: validation_rules; Type: TABLE DATA; Schema: part; Owner: postgres
--

COPY part.validation_rules (id, name, type, pattern, error_message, is_active, is_deleted, tenant_id, created_at, part_type) FROM stdin;
\.


--
-- Data for Name: grn; Type: TABLE DATA; Schema: procurement; Owner: postgres
--

COPY procurement.grn (id, doc_no, date, po_id, vendor_id, status, lines, remarks, tenant_id, is_deleted, version, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: purchase_orders; Type: TABLE DATA; Schema: procurement; Owner: postgres
--

COPY procurement.purchase_orders (id, doc_no, date, vendor_id, pr_id, status, lines, subtotal, tax, total, currency, payment_terms, delivery_date, remarks, approved_by, approved_at, tenant_id, is_deleted, version, created_at, updated_at, created_by, updated_by, project_id, organization_id, customer_part_number, quantity, price_per_quantity, delivery_date_etd, delivery_date_eta, deliver_by, location) FROM stdin;
0ae43c47-4faf-472e-8678-e437c636a350	PO-TEST-001	2025-01-15	NONE	\N	open	[{"location": "Mumbai", "quantity": 10, "deliver_by": "Air", "delivery_date_eta": "2025-02-15", "delivery_date_etd": "2025-02-01", "price_per_quantity": 500, "customer_part_number": "CPN-001"}, {"location": "Delhi", "quantity": 5, "deliver_by": "Sea", "delivery_date_eta": "2025-02-25", "delivery_date_etd": "2025-02-10", "price_per_quantity": 1200, "customer_part_number": "CPN-002"}]	\N	\N	11000.00	INR	\N	\N	Test PO with 2 parts	\N	\N	TEST	t	1	2026-07-16 15:19:27.594808	2026-07-16 15:20:10.668391		\N	\N	\N		0.00	0.00	\N	\N		
77e942ea-cdb2-4bd9-acc8-27019b00b45a	PO-2025-001	2025-01-20	f3b16794-3983-4aa5-b801-43a785430458	\N	Approved	[{"location": "Hyderabad Plant", "quantity": 50, "deliver_by": "BlueDart", "delivery_date_eta": "2025-02-20", "delivery_date_etd": "2025-02-15", "price_per_quantity": 1200, "customer_part_number": "MP-GR-0001"}, {"location": "Hyderabad Plant", "quantity": 20, "deliver_by": "DTDC", "delivery_date_eta": "2025-02-25", "delivery_date_etd": "2025-02-20", "price_per_quantity": 8500, "customer_part_number": "EP-MT-0001"}, {"location": "Hyderabad Plant", "quantity": 100, "deliver_by": "BlueDart", "delivery_date_eta": "2025-02-22", "delivery_date_etd": "2025-02-18", "price_per_quantity": 450, "customer_part_number": "EP-SN-0001"}]	\N	\N	275000.00	INR	\N	\N	\N	\N	\N	TEST	f	1	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	f98dcc91-7d08-4f2d-997b-ac22132846cf	\N	88598837-3bc4-491a-9127-bb311879d361	f3b16794-3983-4aa5-b801-43a785430458		0.00	0.00	\N	\N		
37f2e83b-c549-4189-873e-91f8db5f3cfa	PO-2025-003	2025-01-25	2210ffea-8c9a-49b6-8744-46e9b5430ffe	\N	Approved	[{"location": "Bangalore Unit", "quantity": 10, "deliver_by": "Delhivery", "delivery_date_eta": "2025-03-05", "delivery_date_etd": "2025-02-28", "price_per_quantity": 15000, "customer_part_number": "HP-CY-0001"}, {"location": "Bangalore Unit", "quantity": 30, "deliver_by": "Delhivery", "delivery_date_eta": "2025-03-01", "delivery_date_etd": "2025-02-25", "price_per_quantity": 3200, "customer_part_number": "PP-VL-0001"}]	\N	\N	246000.00	INR	\N	\N	\N	\N	\N	TEST	f	1	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	f98dcc91-7d08-4f2d-997b-ac22132846cf	\N	8c9dd161-1b21-4949-bf8e-9a0c9d49f788	2210ffea-8c9a-49b6-8744-46e9b5430ffe		0.00	0.00	\N	\N		
a63e3613-6f56-4d82-a1a4-aded6aa42243	PO-2025-004	2025-03-10	2210ffea-8c9a-49b6-8744-46e9b5430ffe	\N	Pending	[{"location": "Bangalore Unit", "quantity": 5, "deliver_by": "FedEx", "delivery_date_eta": "2025-04-20", "delivery_date_etd": "2025-04-15", "price_per_quantity": 22000, "customer_part_number": "EP-MT-0002"}]	\N	\N	110000.00	INR	\N	\N	\N	\N	\N	TEST	f	1	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	f98dcc91-7d08-4f2d-997b-ac22132846cf	\N	0c51d522-a336-4583-b673-3b84ae5589df	2210ffea-8c9a-49b6-8744-46e9b5430ffe		0.00	0.00	\N	\N		
18252193-14e2-49c0-a853-f387fd3950bf	PO-2025-002	2025-02-05	f3b16794-3983-4aa5-b801-43a785430458	\N	Draft	[{"location": "Hyderabad Plant", "quantity": 500, "deliver_by": "Local", "delivery_date_eta": "2025-03-05", "delivery_date_etd": "2025-03-01", "price_per_quantity": 25, "customer_part_number": "FP-HB-0001", "internal_description": "Mechanical Parts, Bearings, Chrome Steel, 6201", "internal_part_number": "MP-MP-BR-000001"}, {"location": "Hyderabad Plant", "quantity": 500, "deliver_by": "Local", "delivery_date_eta": "2025-03-05", "delivery_date_etd": "2025-03-01", "price_per_quantity": 18, "customer_part_number": "FP-LN-0001"}]	\N	\N	21500.00	INR	\N	\N	\N	\N	\N	TEST	f	1	2026-07-16 10:24:56.412531	2026-07-16 16:49:49.832444	f98dcc91-7d08-4f2d-997b-ac22132846cf	\N	88598837-3bc4-491a-9127-bb311879d361	f3b16794-3983-4aa5-b801-43a785430458		0.00	0.00	\N	\N		
\.


--
-- Data for Name: purchase_requests; Type: TABLE DATA; Schema: procurement; Owner: postgres
--

COPY procurement.purchase_requests (id, doc_no, date, requester_id, department_id, priority, status, lines, remarks, tenant_id, is_deleted, version, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: project; Owner: postgres
--

COPY project.organizations (id, name, code, industry, website, phone, email, gst_number, pan_number, addresses, contacts, tenant_id, is_deleted, created_at, updated_at, created_by) FROM stdin;
c9402b6a-0748-4120-b236-a7fd90bf7906	Tata Motors	TATA-001	Automotive		9876543210	contact@tatamotors.com	27AAACT2727Q1ZV		[]	[]	TEST	f	2026-07-16 14:23:16.096572	2026-07-16 14:23:16.096572	
f3b16794-3983-4aa5-b801-43a785430458	Tata Advanced Systems	TATA-AS	Aerospace & Defense	https://www.tataadvancedsystems.com	011-23456789	procurement@tata-as.com	27AABCT1234F1ZP	AABCT1234F	[{"pin": "500032", "city": "Hyderabad", "type": "Registered", "line1": "Plot 12, Industrial Area", "state": "Telangana"}]	[{"name": "Procurement Head", "email": "procurement@tata-as.com", "phone": "011-23456789", "designation": "GM Procurement"}]	TEST	f	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	f98dcc91-7d08-4f2d-997b-ac22132846cf
2210ffea-8c9a-49b6-8744-46e9b5430ffe	Bharat Electronics Ltd	BEL	Electronics & Defense	https://www.bel-india.in	080-22345678	orders@bel-india.in	29AABCB5678G1ZQ	AABCB5678G	[{"pin": "500032", "city": "Hyderabad", "type": "Registered", "line1": "Plot 12, Industrial Area", "state": "Telangana"}]	[{"name": "Procurement Head", "email": "orders@bel-india.in", "phone": "080-22345678", "designation": "GM Procurement"}]	TEST	f	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	f98dcc91-7d08-4f2d-997b-ac22132846cf
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: project; Owner: postgres
--

COPY project.projects (id, name, code, description, manager_id, department_id, status, priority, start_date, end_date, budget, actual_cost, progress, tenant_id, is_deleted, version, created_at, updated_at, created_by, updated_by, project_type, due_date, closing_date, bp_code, bp_name, contact_person, territory, sales_employee, owner, percent_complete, organization_id, addresses, contacts, purchase_orders) FROM stdin;
5a4c726d-f182-45b7-87eb-78cd931de9b7	EV Dashboard	PRJ-001	\N	\N	\N	open	normal	\N	\N	\N	0.00	0	TEST	f	1	2026-07-16 14:23:36.477397	2026-07-16 14:23:36.477397		\N	Client	\N	\N							0.00	c9402b6a-0748-4120-b236-a7fd90bf7906	[{"city": "Pune", "type": "Site", "line1": "Plot 5, Industrial Area", "state": "Maharashtra", "country": "India", "pincode": "411001"}]	[{"name": "Rahul Sharma", "email": "rahul@tatamotors.com", "phone": "9988776655", "designation": "Project Lead"}]	[{"amount": 500000, "status": "Active", "po_date": "2025-01-15", "po_number": "PO-2025-001", "description": "Phase 1 delivery"}]
88598837-3bc4-491a-9127-bb311879d361	Radar Module Assembly	PROJ-001	Assembly of X-band radar modules	\N	\N	In Progress	High	2025-01-15	2025-06-30	500000.00	0.00	0	TEST	f	1	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	f98dcc91-7d08-4f2d-997b-ac22132846cf	\N		\N	\N							0.00	f3b16794-3983-4aa5-b801-43a785430458	[]	[]	[]
9ab07a21-e12a-47d2-886d-d7a1d6b249a8	Avionics Harness Build	PROJ-002	Wire harness for avionics bay	\N	\N	Planning	Medium	2025-02-01	2025-08-15	300000.00	0.00	0	TEST	f	1	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	f98dcc91-7d08-4f2d-997b-ac22132846cf	\N		\N	\N							0.00	f3b16794-3983-4aa5-b801-43a785430458	[]	[]	[]
8c9dd161-1b21-4949-bf8e-9a0c9d49f788	EW Suite Integration	PROJ-003	Electronic warfare suite integration	\N	\N	In Progress	High	2025-01-01	2025-07-31	750000.00	0.00	0	TEST	f	1	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	f98dcc91-7d08-4f2d-997b-ac22132846cf	\N		\N	\N							0.00	2210ffea-8c9a-49b6-8744-46e9b5430ffe	[]	[]	[]
0c51d522-a336-4583-b673-3b84ae5589df	Communication Radio Upgrade	PROJ-004	VHF/UHF radio system upgrade	\N	\N	On Hold	Low	2025-03-01	2025-09-30	200000.00	0.00	0	TEST	f	1	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	f98dcc91-7d08-4f2d-997b-ac22132846cf	\N		\N	\N							0.00	2210ffea-8c9a-49b6-8744-46e9b5430ffe	[]	[]	[]
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: project; Owner: postgres
--

COPY project.tasks (id, project_id, name, description, assignee_id, status, priority, start_date, due_date, estimated_hours, actual_hours, parent_id, tenant_id, is_deleted, version, created_at, updated_at, created_by, updated_by, task_name, stage, owner, end_date, planned_cost, invoiced_amount, percent_complete, dependencies) FROM stdin;
3526d0a0-cd88-439c-a114-2f6db002a557	88598837-3bc4-491a-9127-bb311879d361	PCB Fabrication	Fabricate radar PCBs	\N	In Progress	High	2025-01-20	2025-03-01	\N	0.00	\N	TEST	f	1	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	f98dcc91-7d08-4f2d-997b-ac22132846cf	\N	\N			\N	0.00	0.00	0.00	
089321cb-fda4-43c9-a76a-8ead9d0e3129	88598837-3bc4-491a-9127-bb311879d361	Module Assembly	Assemble radar modules	\N	To Do	High	2025-03-05	2025-04-30	\N	0.00	\N	TEST	f	1	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	f98dcc91-7d08-4f2d-997b-ac22132846cf	\N	\N			\N	0.00	0.00	0.00	
701dc8f8-bc09-439c-828d-403c43fd00af	88598837-3bc4-491a-9127-bb311879d361	Testing & QC	Final testing and quality check	\N	To Do	Medium	2025-05-01	2025-06-15	\N	0.00	\N	TEST	f	1	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	f98dcc91-7d08-4f2d-997b-ac22132846cf	\N	\N			\N	0.00	0.00	0.00	
3d609690-0533-471e-a418-ebaa2e72c424	9ab07a21-e12a-47d2-886d-d7a1d6b249a8	Wire Cutting	Cut wires to spec lengths	\N	To Do	Medium	2025-02-10	2025-03-15	\N	0.00	\N	TEST	f	1	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	f98dcc91-7d08-4f2d-997b-ac22132846cf	\N	\N			\N	0.00	0.00	0.00	
fb652a9f-58c9-47fa-a8a2-f0570d7d393f	9ab07a21-e12a-47d2-886d-d7a1d6b249a8	Harness Assembly	Assemble wire harness	\N	To Do	High	2025-03-20	2025-05-30	\N	0.00	\N	TEST	f	1	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	f98dcc91-7d08-4f2d-997b-ac22132846cf	\N	\N			\N	0.00	0.00	0.00	
0c32a96d-0a10-4426-8a3e-095f85c87429	8c9dd161-1b21-4949-bf8e-9a0c9d49f788	Receiver Integration	Integrate EW receivers	\N	In Progress	High	2025-01-15	2025-03-31	\N	0.00	\N	TEST	f	1	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	f98dcc91-7d08-4f2d-997b-ac22132846cf	\N	\N			\N	0.00	0.00	0.00	
efef0b63-409a-4872-991e-70ecc7b51929	8c9dd161-1b21-4949-bf8e-9a0c9d49f788	Jammer Module Install	Install jammer modules	\N	To Do	High	2025-04-01	2025-06-15	\N	0.00	\N	TEST	f	1	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	f98dcc91-7d08-4f2d-997b-ac22132846cf	\N	\N			\N	0.00	0.00	0.00	
94c4255a-771a-4276-a276-45ff93cbf35a	0c51d522-a336-4583-b673-3b84ae5589df	Site Survey	Survey existing radio installation	\N	Completed	Low	2025-03-05	2025-03-20	\N	0.00	\N	TEST	f	1	2026-07-16 10:24:56.412531	2026-07-16 10:24:56.412531	f98dcc91-7d08-4f2d-997b-ac22132846cf	\N	\N			\N	0.00	0.00	0.00	
\.


--
-- Data for Name: timesheets; Type: TABLE DATA; Schema: project; Owner: postgres
--

COPY project.timesheets (id, project_id, task_id, user_id, date, hours, description, status, tenant_id, is_deleted, version, created_at) FROM stdin;
\.


--
-- Data for Name: inventory_batches; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_batches (id, batch_no, part_number, supplier_lot, manufacture_date, expiry_date, qty_received, qty_remaining, warehouse_code, bin_code, status, is_deleted, tenant_id, created_at, updated_at) FROM stdin;
bat-101	BAT-CRK-202606	601-0-000001-99	LOT-TATA-88	2026-06-01	2028-06-01	50.0000	50.0000	FG-WH	FG-A-01	active	f	TEST	2026-07-21 12:09:15.677155	2026-07-21 12:09:15.677155
70a71800-5e4b-4e5c-92f8-5e41d600f43a	BAT-CRK-202606	601-0-000001-99	LOT-TATA-88	2026-06-01	2028-06-01	50.0000	50.0000	FG-WH	FG-A-01	active	f	TEST	2026-07-21 12:09:54.621311	2026-07-21 12:09:54.621311
9e155d96-0f08-4d1b-bb8d-ce30caf05def	BAT-CRK-202606	601-0-000001-99	LOT-TATA-88	2026-06-01	2028-06-01	50.0000	50.0000	FG-WH	FG-A-01	active	f	TEST	2026-07-21 12:16:37.840943	2026-07-21 12:16:37.840943
6bdd24d3-f4c5-4dbf-b733-075aef8a951c	BAT-CRK-202606	601-0-000001-99	LOT-TATA-88	2026-06-01	2028-06-01	50.0000	50.0000	FG-WH	FG-A-01	active	f	TEST	2026-07-21 13:16:34.575836	2026-07-21 13:16:34.575836
aa54c0df-101f-4a8d-846b-c81e784b9a5c	BAT-CRK-202606	601-0-000001-99	LOT-TATA-88	2026-06-01	2028-06-01	50.0000	50.0000	FG-WH	FG-A-01	active	f	TEST	2026-07-21 13:44:40.16486	2026-07-21 13:44:40.16486
24fe1689-dffe-413e-9ef5-d6dc91766be8	BAT-CRK-202606	601-0-000001-99	LOT-TATA-88	2026-06-01	2028-06-01	50.0000	50.0000	FG-WH	FG-A-01	active	f	TEST	2026-07-21 13:45:25.734167	2026-07-21 13:45:25.734167
54625e6d-096a-47a0-9922-aa596c05ef76	BAT-CRK-202606	601-0-000001-99	LOT-TATA-88	2026-06-01	2028-06-01	50.0000	50.0000	FG-WH	FG-A-01	active	f	TEST	2026-07-21 14:11:53.629252	2026-07-21 14:11:53.629252
0bdc3217-eeab-439b-9960-5d73c1419e97	BAT-CRK-202606	601-0-000001-99	LOT-TATA-88	2026-06-01	2028-06-01	50.0000	50.0000	FG-WH	FG-A-01	active	f	TEST	2026-07-21 14:23:54.587596	2026-07-21 14:23:54.587596
\.


--
-- Data for Name: inventory_locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_locations (id, location_code, plant, floor_name, shelf_name, row_name, column_name, bin_code, warehouse_code, capacity, current_occupancy, is_active, is_deleted, tenant_id, created_at) FROM stdin;
d1bbb582-1dbe-43b7-b76a-fe6826f3e860	P1-F1-S1-R01-C01	Plant 1	Ground Floor	Shelf A1	Row 01	Col 01	RM-A-01	MAIN	1000.0000	450.0000	t	f	TEST	2026-07-21 14:11:53.750786
60936c67-1ab4-4c13-ad4b-84169922ac2e	P1-F1-S2-R02-C01	Plant 1	Ground Floor	Shelf A2	Row 02	Col 01	WIP-B-02	MAIN	500.0000	100.0000	t	f	TEST	2026-07-21 14:11:53.750786
ec99341e-ec36-4650-970d-2ec71ce794c5	P2-F2-S1-R01-C01	Plant 2	First Floor	Shelf B1	Row 01	Col 01	FG-A-01	FG-WH	2000.0000	50.0000	t	f	TEST	2026-07-21 14:11:53.750786
15676c2b-fb7b-4cd1-8d56-656efc9b49e3	P1-F1-SQ-R01-C01	Plant 1	Ground Floor	Quarantine Rack	Row Q1	Col Q1	QUARANTINE	QC-WH	200.0000	4.0000	t	f	TEST	2026-07-21 14:11:53.750786
555dac9e-f424-4971-aba1-73a50baf9036	P1-F1-S1-R01-C01	Plant 1	Ground Floor	Shelf A1	Row 01	Col 01	RM-A-01	MAIN	1000.0000	450.0000	t	f	TEST	2026-07-21 14:23:54.60365
960b0da5-9108-45c8-bedf-a42dc2336aba	P1-F1-S2-R02-C01	Plant 1	Ground Floor	Shelf A2	Row 02	Col 01	WIP-B-02	MAIN	500.0000	100.0000	t	f	TEST	2026-07-21 14:23:54.60365
2c2e4912-b88b-45f5-a3ae-ec05920ad27f	P2-F2-S1-R01-C01	Plant 2	First Floor	Shelf B1	Row 01	Col 01	FG-A-01	FG-WH	2000.0000	50.0000	t	f	TEST	2026-07-21 14:23:54.60365
8d5fe2a0-e7a7-4d18-ba3f-2bafdba49de2	P1-F1-SQ-R01-C01	Plant 1	Ground Floor	Quarantine Rack	Row Q1	Col Q1	QUARANTINE	QC-WH	200.0000	4.0000	t	f	TEST	2026-07-21 14:23:54.60365
\.


--
-- Data for Name: inventory_reorder_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_reorder_rules (id, part_number, warehouse_code, reorder_point, reorder_qty, lead_time_days, preferred_supplier, is_active, is_deleted, tenant_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: inventory_serial_numbers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_serial_numbers (id, serial_no, part_number, batch_no, warehouse_code, bin_code, status, production_order_no, notes, is_deleted, tenant_id, created_at, updated_at) FROM stdin;
sn-1	SN-CRK-2026-0001	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 12:09:15.679382	2026-07-21 12:09:15.679382
sn-2	SN-CRK-2026-0002	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 12:09:15.681156	2026-07-21 12:09:15.681156
sn-3	SN-CRK-2026-0003	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 12:09:15.681669	2026-07-21 12:09:15.681669
sn-4	SN-CRK-2026-0004	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 12:09:15.682075	2026-07-21 12:09:15.682075
sn-5	SN-CRK-2026-0005	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 12:09:15.682606	2026-07-21 12:09:15.682606
7883e926-cfe5-4dd3-ab04-1bc6f67c0262	SN-CRK-2026-0001	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 12:09:54.622869	2026-07-21 12:09:54.622869
23833114-31ec-495d-8c49-edfb48239552	SN-CRK-2026-0002	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 12:09:54.623911	2026-07-21 12:09:54.623911
6215400c-236a-43b2-8aa3-a95ffad58e07	SN-CRK-2026-0003	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 12:09:54.624369	2026-07-21 12:09:54.624369
70764608-9161-48db-88c4-042eb8ec8e67	SN-CRK-2026-0004	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 12:09:54.624969	2026-07-21 12:09:54.624969
f7edea39-3454-49d6-80ea-776343f23d1a	SN-CRK-2026-0005	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 12:09:54.625644	2026-07-21 12:09:54.625644
2efdb03b-2b5a-49c4-8688-8b5a6bf94daf	SN-CRK-2026-0001	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 12:16:37.841952	2026-07-21 12:16:37.841952
16cd3404-f269-4bcf-8708-adff1708e53e	SN-CRK-2026-0002	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 12:16:37.843011	2026-07-21 12:16:37.843011
e99b0312-dd25-4ffb-8fb4-53c8028d966a	SN-CRK-2026-0003	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 12:16:37.844468	2026-07-21 12:16:37.844468
5763bd1c-b4c0-4d76-bb30-f52603bc62f6	SN-CRK-2026-0004	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 12:16:37.845121	2026-07-21 12:16:37.845121
22dcd78b-7659-4729-bf42-cb0b7f1a34a8	SN-CRK-2026-0005	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 12:16:37.84583	2026-07-21 12:16:37.84583
7ec1439e-f2cb-4de1-bc67-8a0039812ff3	SN-CRK-2026-0001	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 13:16:34.578094	2026-07-21 13:16:34.578094
11b2554f-6461-4b32-b959-15f8c41f04df	SN-CRK-2026-0002	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 13:16:34.579974	2026-07-21 13:16:34.579974
351574dd-f77b-41d0-ac59-1f4a809fb35c	SN-CRK-2026-0003	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 13:16:34.58086	2026-07-21 13:16:34.58086
47cae730-f5a9-4e8c-a165-c0161d27431d	SN-CRK-2026-0004	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 13:16:34.581419	2026-07-21 13:16:34.581419
a953059c-8bad-49f4-950a-f8200b287df2	SN-CRK-2026-0005	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 13:16:34.581877	2026-07-21 13:16:34.581877
de19b802-5be1-4cdd-b2bb-c9b3004ef3dd	SN-CRK-2026-0001	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 13:44:40.16609	2026-07-21 13:44:40.16609
88d85882-4e43-4e2d-b95f-8d8e3181ba12	SN-CRK-2026-0002	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 13:44:40.167586	2026-07-21 13:44:40.167586
4284a521-e71b-430a-8dcc-2d6f64a77ec4	SN-CRK-2026-0003	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 13:44:40.168326	2026-07-21 13:44:40.168326
18f5368f-c99f-4cd3-8517-8d732424f67b	SN-CRK-2026-0004	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 13:44:40.168769	2026-07-21 13:44:40.168769
cd197572-185f-491d-b196-b1a2090cdf69	SN-CRK-2026-0005	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 13:44:40.16933	2026-07-21 13:44:40.16933
4002a6f7-797c-4d7e-bc0f-8ee0395ae0fc	SN-CRK-2026-0001	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 13:45:25.735541	2026-07-21 13:45:25.735541
83b3dfe9-ad52-4f8b-be25-822c77b41fc5	SN-CRK-2026-0002	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 13:45:25.736489	2026-07-21 13:45:25.736489
5c70a335-d161-4892-9f37-539bffdd9013	SN-CRK-2026-0003	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 13:45:25.736925	2026-07-21 13:45:25.736925
a259e2c9-9474-4a8c-8f5e-b3a1cea58f73	SN-CRK-2026-0004	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 13:45:25.737388	2026-07-21 13:45:25.737388
ae4387f9-020d-4dc9-b04c-98ca01f3fb8e	SN-CRK-2026-0005	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 13:45:25.737976	2026-07-21 13:45:25.737976
0a015f39-7599-4333-b261-1790bd246cf1	SN-CRK-2026-0001	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 14:11:53.634321	2026-07-21 14:11:53.634321
f76932b7-e402-4f5b-923d-7b0cb12114db	SN-CRK-2026-0002	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 14:11:53.638755	2026-07-21 14:11:53.638755
ecb9d315-ced4-4c33-8ac3-cad59bc5ee5b	SN-CRK-2026-0003	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 14:11:53.641917	2026-07-21 14:11:53.641917
f85e2c4f-9244-4eb0-b30b-ab29396ce8f8	SN-CRK-2026-0004	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 14:11:53.644142	2026-07-21 14:11:53.644142
0f507111-8d39-4e2a-a9c6-d4ae5a6a8d9a	SN-CRK-2026-0005	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 14:11:53.646002	2026-07-21 14:11:53.646002
81c2d7db-cd94-48ab-b6ff-caabb7445840	SN-CRK-2026-0001	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 14:23:54.590358	2026-07-21 14:23:54.590358
8340d7c3-be49-437f-b6a8-0450984c5fe3	SN-CRK-2026-0002	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 14:23:54.595096	2026-07-21 14:23:54.595096
4638fa7e-806b-4b32-b38b-646b05c573cc	SN-CRK-2026-0003	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 14:23:54.596467	2026-07-21 14:23:54.596467
851af8ed-c62f-4c7e-923f-2b1e260c74a8	SN-CRK-2026-0004	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 14:23:54.597722	2026-07-21 14:23:54.597722
dee80dff-6f45-4209-8141-78c773be571b	SN-CRK-2026-0005	601-0-000001-99	BAT-CRK-202606	FG-WH	FG-A-01	in_stock	\N	\N	f	TEST	2026-07-21 14:23:54.598748	2026-07-21 14:23:54.598748
\.


--
-- Data for Name: inventory_stock_checkins; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_stock_checkins (id, checkin_no, po_no, supplier_code, supplier_name, part_or_rm_code, item_description, ordered_qty, received_qty, checkin_time, checked_in_by, iqc_status, iqc_passed_qty, iqc_rejected_qty, iqc_scrap_qty, iqc_time, iqc_elapsed_min, iqc_remarks, iqc_inspector, location_code, warehouse_code, bin_code, qr_code_data, is_deleted, tenant_id, created_at, updated_at) FROM stdin;
3aa48cdf-9c9f-4eec-8fc7-c7f68c107cd1	CHK-20260721-01	PO-PUR-20260721-01	SUP-101	Tata Steel Industrial Solutions	RM-STEEL-316L	Forged Alloy Steel Bar 316L	50.0000	50.0000	2026-07-21 14:11:53.744851	Rajesh Kumar (EMP-1002)	passed	48.0000	2.0000	0.0000	2026-07-21 14:11:53.744851	15	IQC Approved: 48 units OK, 2 units rejected with surface pit defects transferred to Quarantine	Vikram Singh (EMP-1005)	P1-F1-S1-R01-C01	MAIN	RM-A-01	QR-PO-PUR-20260721-01|RM-STEEL-316L|QTY:50|SUP:SUP-101	f	TEST	2026-07-21 14:11:53.744851	2026-07-21 14:11:53.744851
912ac83a-3a5c-4538-96f4-f5601bb73aa0	CHK-20260721-01	PO-PUR-20260721-01	SUP-101	Tata Steel Industrial Solutions	RM-STEEL-316L	Forged Alloy Steel Bar 316L	50.0000	50.0000	2026-07-21 14:23:54.600902	Rajesh Kumar (EMP-1002)	passed	48.0000	2.0000	0.0000	2026-07-21 14:23:54.600902	15	IQC Approved: 48 units OK, 2 units rejected with surface pit defects transferred to Quarantine	Vikram Singh (EMP-1005)	P1-F1-S1-R01-C01	MAIN	RM-A-01	QR-PO-PUR-20260721-01|RM-STEEL-316L|QTY:50|SUP:SUP-101	f	TEST	2026-07-21 14:23:54.600902	2026-07-21 14:23:54.600902
75f60a1d-f6e4-4914-b7b6-e5aabc3a59bd	CHK-20260721-02	PO-PUR-20260721-02	SUP-102	Jindal Precision Castings Ltd	601-0-000001	Engine Crankshaft Base Part	20.0000	20.0000	2026-07-21 14:23:54.600902	Rajesh Kumar (EMP-1002)	pending_iqc	0.0000	0.0000	0.0000	\N	0				MAIN	WIP-B-02	QR-PO-PUR-20260721-02|601-0-000001|QTY:20|SUP:SUP-102	f	TEST	2026-07-21 14:23:54.600902	2026-07-21 14:23:54.600902
e4f7c0af-e05b-4aba-a5ca-6334fb3647f6	CHK-20260721-02	PO-PUR-20260721-02	SUP-102	Jindal Precision Castings Ltd	601-0-000001	Engine Crankshaft Base Part	20.0000	20.0000	2026-07-21 14:11:53.744851	Rajesh Kumar (EMP-1002)	passed	20.0000	0.0000	0.0000	2026-07-21 14:58:41.969594	15	all passed 	Vikram Singh (EMP-1005)		MAIN	WIP-B-02	QR-PO-PUR-20260721-02|601-0-000001|QTY:20|SUP:SUP-102	f	TEST	2026-07-21 14:11:53.744851	2026-07-21 14:58:41.969594
6dae8223-4e5d-47e4-b2e2-e63057229106	CHK-20260721160630	PO-PUR-20260721-01	SUP-101	Tata Steel Industrial Solutions	RM-STEEL-316L	RM-STEEL-316L	50.0000	50.0000	2026-07-21 16:06:30.068455	Rajesh Kumar (EMP-1002)	pending_iqc	0.0000	0.0000	0.0000	\N	0				MAIN	RM-A-01	QR-PO-PUR-20260721-01|RM-STEEL-316L|QTY:50.0|SUP:SUP-101|TIME:2026-07-21 16:06	f	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-21 16:06:30.068455	2026-07-21 16:06:30.068455
edc6935b-0dfd-4bc1-a751-d5d4e6a6e9bf	CHK-20260721160712	PO-PUR-20260721-01	SUP-101	Tata Steel Industrial Solutions	RM-STEEL-316L	RM-STEEL-316L	500.0000	50.0000	2026-07-21 16:07:12.870412	Rajesh Kumar (EMP-1002)	pending_iqc	0.0000	0.0000	0.0000	\N	0				MAIN	RM-A-01	QR-PO-PUR-20260721-01|RM-STEEL-316L|QTY:50.0|SUP:SUP-101|TIME:2026-07-21 16:07	f	b424df0e-f766-4e94-b3fd-05777e158958	2026-07-21 16:07:12.870412	2026-07-21 16:07:12.870412
\.


--
-- Data for Name: inventory_stock_count_lines; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_stock_count_lines (id, count_id, part_number, bin_code, book_qty, counted_qty, variance, status, tenant_id, created_at) FROM stdin;
\.


--
-- Data for Name: inventory_stock_counts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_stock_counts (id, count_no, warehouse_code, count_date, status, assigned_to, notes, is_deleted, tenant_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: inventory_stock_levels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_stock_levels (id, part_number, part_description, item_type, warehouse_id, warehouse_code, zone_code, bin_code, qty_on_hand, qty_reserved, qty_available, reorder_point, reorder_qty, unit, unit_cost, total_value, last_movement_at, is_deleted, tenant_id, created_at, updated_at) FROM stdin;
sl-001	601-0-000001-99	Finished Engine Crankshaft Assembly (FG)	FG	\N	FG-WH	Z-FG	FG-A-01	50.0000	5.0000	45.0000	15.0000	50.0000	pcs	1250.0000	62500.0000	\N	f	TEST	2026-07-21 12:09:15.670135	2026-07-21 12:09:15.670135
sl-002	RM-STEEL-316L	Forged Alloy Steel Bar 316L	RM	\N	MAIN	Z-RM	RM-A-01	500.0000	50.0000	450.0000	100.0000	200.0000	kg	180.0000	90000.0000	\N	f	TEST	2026-07-21 12:09:15.67169	2026-07-21 12:09:15.67169
sl-003	601-0-000001-88	Rejected Crankshaft Casting (NG)	NG	\N	QC-WH	Z-QC	QUARANTINE	4.0000	0.0000	4.0000	0.0000	0.0000	pcs	100.0000	400.0000	\N	f	TEST	2026-07-21 12:09:15.672319	2026-07-21 12:09:15.672319
sl-004	602-0-000002-99	High Compression Piston Assembly (FG)	FG	\N	FG-WH	Z-FG	FG-B-02	120.0000	10.0000	110.0000	20.0000	60.0000	pcs	850.0000	102000.0000	\N	f	TEST	2026-07-21 12:09:15.673049	2026-07-21 12:09:15.673049
09f6ee5f-bdfc-46e9-a0fb-f70b0f617309	601-0-000001-99	Finished Engine Crankshaft Assembly (FG)	FG	\N	FG-WH	Z-FG	FG-A-01	50.0000	5.0000	45.0000	15.0000	50.0000	pcs	1250.0000	62500.0000	\N	f	TEST	2026-07-21 12:09:54.616565	2026-07-21 12:09:54.616565
1fcea14c-16a2-4aff-9adc-1d2f8b29c271	RM-STEEL-316L	Forged Alloy Steel Bar 316L	RM	\N	MAIN	Z-RM	RM-A-01	500.0000	50.0000	450.0000	100.0000	200.0000	kg	180.0000	90000.0000	\N	f	TEST	2026-07-21 12:09:54.617633	2026-07-21 12:09:54.617633
61d75b7e-ecd1-4d50-a50a-5022efd60d4d	601-0-000001-88	Rejected Crankshaft Casting (NG)	NG	\N	QC-WH	Z-QC	QUARANTINE	4.0000	0.0000	4.0000	0.0000	0.0000	pcs	100.0000	400.0000	\N	f	TEST	2026-07-21 12:09:54.618122	2026-07-21 12:09:54.618122
1187ce69-4dc0-4c23-8e19-3c140768bb81	602-0-000002-99	High Compression Piston Assembly (FG)	FG	\N	FG-WH	Z-FG	FG-B-02	120.0000	10.0000	110.0000	20.0000	60.0000	pcs	850.0000	102000.0000	\N	f	TEST	2026-07-21 12:09:54.618553	2026-07-21 12:09:54.618553
57f7fc1c-1e1d-4636-86ac-d2f377e67924	601-0-000001-99	Finished Engine Crankshaft Assembly (FG)	FG	\N	FG-WH	Z-FG	FG-A-01	50.0000	5.0000	45.0000	15.0000	50.0000	pcs	1250.0000	62500.0000	\N	f	TEST	2026-07-21 12:16:37.835277	2026-07-21 12:16:37.835277
9c80efb6-0020-4f7d-b911-8d7a28d10cd7	RM-STEEL-316L	Forged Alloy Steel Bar 316L	RM	\N	MAIN	Z-RM	RM-A-01	500.0000	50.0000	450.0000	100.0000	200.0000	kg	180.0000	90000.0000	\N	f	TEST	2026-07-21 12:16:37.836498	2026-07-21 12:16:37.836498
6b811090-06fb-41e8-ad5b-d0c55e1ef63c	601-0-000001-88	Rejected Crankshaft Casting (NG)	NG	\N	QC-WH	Z-QC	QUARANTINE	4.0000	0.0000	4.0000	0.0000	0.0000	pcs	100.0000	400.0000	\N	f	TEST	2026-07-21 12:16:37.837311	2026-07-21 12:16:37.837311
3381e647-17ab-4676-809e-c1e58858888a	602-0-000002-99	High Compression Piston Assembly (FG)	FG	\N	FG-WH	Z-FG	FG-B-02	120.0000	10.0000	110.0000	20.0000	60.0000	pcs	850.0000	102000.0000	\N	f	TEST	2026-07-21 12:16:37.838001	2026-07-21 12:16:37.838001
6c5f5ddf-cf6c-47df-af22-c0e71020e2db	601-0-000001-99	Finished Engine Crankshaft Assembly (FG)	FG	\N	FG-WH	Z-FG	FG-A-01	50.0000	5.0000	45.0000	15.0000	50.0000	pcs	1250.0000	62500.0000	\N	f	TEST	2026-07-21 13:16:34.566761	2026-07-21 13:16:34.566761
eee039d8-af71-4477-91e8-04edcb1ad4d9	RM-STEEL-316L	Forged Alloy Steel Bar 316L	RM	\N	MAIN	Z-RM	RM-A-01	500.0000	50.0000	450.0000	100.0000	200.0000	kg	180.0000	90000.0000	\N	f	TEST	2026-07-21 13:16:34.568198	2026-07-21 13:16:34.568198
1a3617b0-dcc6-4658-81e7-fe5c19d9b0ad	601-0-000001-88	Rejected Crankshaft Casting (NG)	NG	\N	QC-WH	Z-QC	QUARANTINE	4.0000	0.0000	4.0000	0.0000	0.0000	pcs	100.0000	400.0000	\N	f	TEST	2026-07-21 13:16:34.569515	2026-07-21 13:16:34.569515
8144b617-e2a5-45ba-9df8-eba5f031ae88	602-0-000002-99	High Compression Piston Assembly (FG)	FG	\N	FG-WH	Z-FG	FG-B-02	120.0000	10.0000	110.0000	20.0000	60.0000	pcs	850.0000	102000.0000	\N	f	TEST	2026-07-21 13:16:34.570559	2026-07-21 13:16:34.570559
ef562196-d2d4-4073-aa87-ca137f39db4d	601-0-000001-99	Finished Engine Crankshaft Assembly (FG)	FG	\N	FG-WH	Z-FG	FG-A-01	50.0000	5.0000	45.0000	15.0000	50.0000	pcs	1250.0000	62500.0000	\N	f	TEST	2026-07-21 13:44:40.157872	2026-07-21 13:44:40.157872
1be318ff-6a12-46f6-9637-79d9aa96f7ee	RM-STEEL-316L	Forged Alloy Steel Bar 316L	RM	\N	MAIN	Z-RM	RM-A-01	500.0000	50.0000	450.0000	100.0000	200.0000	kg	180.0000	90000.0000	\N	f	TEST	2026-07-21 13:44:40.159198	2026-07-21 13:44:40.159198
6652b217-006f-4aee-9df5-5c82aa7e400d	601-0-000001-88	Rejected Crankshaft Casting (NG)	NG	\N	QC-WH	Z-QC	QUARANTINE	4.0000	0.0000	4.0000	0.0000	0.0000	pcs	100.0000	400.0000	\N	f	TEST	2026-07-21 13:44:40.160264	2026-07-21 13:44:40.160264
086112a7-0d34-4e3f-9501-a93ce54c0de8	602-0-000002-99	High Compression Piston Assembly (FG)	FG	\N	FG-WH	Z-FG	FG-B-02	120.0000	10.0000	110.0000	20.0000	60.0000	pcs	850.0000	102000.0000	\N	f	TEST	2026-07-21 13:44:40.160985	2026-07-21 13:44:40.160985
70fe7f28-86e0-4c7a-b0e3-fb6d65f4c667	601-0-000001-99	Finished Engine Crankshaft Assembly (FG)	FG	\N	FG-WH	Z-FG	FG-A-01	50.0000	5.0000	45.0000	15.0000	50.0000	pcs	1250.0000	62500.0000	\N	f	TEST	2026-07-21 13:45:25.727629	2026-07-21 13:45:25.727629
5baa1019-4905-4f17-a15e-f587fefb92e7	RM-STEEL-316L	Forged Alloy Steel Bar 316L	RM	\N	MAIN	Z-RM	RM-A-01	500.0000	50.0000	450.0000	100.0000	200.0000	kg	180.0000	90000.0000	\N	f	TEST	2026-07-21 13:45:25.729113	2026-07-21 13:45:25.729113
a1574854-fb91-46d3-8635-6f0089ffb992	601-0-000001-88	Rejected Crankshaft Casting (NG)	NG	\N	QC-WH	Z-QC	QUARANTINE	4.0000	0.0000	4.0000	0.0000	0.0000	pcs	100.0000	400.0000	\N	f	TEST	2026-07-21 13:45:25.729679	2026-07-21 13:45:25.729679
59b89114-6c79-4c1d-8647-bb264c7ee2be	602-0-000002-99	High Compression Piston Assembly (FG)	FG	\N	FG-WH	Z-FG	FG-B-02	120.0000	10.0000	110.0000	20.0000	60.0000	pcs	850.0000	102000.0000	\N	f	TEST	2026-07-21 13:45:25.730175	2026-07-21 13:45:25.730175
4810c7c7-9a60-43c5-aab7-aaacf6418f3a	601-0-000001-99	Finished Engine Crankshaft Assembly (FG)	FG	\N	FG-WH	Z-FG	FG-A-01	50.0000	5.0000	45.0000	15.0000	50.0000	pcs	1250.0000	62500.0000	\N	f	TEST	2026-07-21 14:11:53.605838	2026-07-21 14:11:53.605838
be9b2274-7351-48ab-871d-0f381e452cf5	RM-STEEL-316L	Forged Alloy Steel Bar 316L	RM	\N	MAIN	Z-RM	RM-A-01	500.0000	50.0000	450.0000	100.0000	200.0000	kg	180.0000	90000.0000	\N	f	TEST	2026-07-21 14:11:53.609954	2026-07-21 14:11:53.609954
8cd11f22-57d3-4579-b10f-88b027660c5c	601-0-000001-88	Rejected Crankshaft Casting (NG)	NG	\N	QC-WH	Z-QC	QUARANTINE	4.0000	0.0000	4.0000	0.0000	0.0000	pcs	100.0000	400.0000	\N	f	TEST	2026-07-21 14:11:53.611953	2026-07-21 14:11:53.611953
f5519185-0b4e-4bc8-98c2-505e83b4d537	602-0-000002-99	High Compression Piston Assembly (FG)	FG	\N	FG-WH	Z-FG	FG-B-02	120.0000	10.0000	110.0000	20.0000	60.0000	pcs	850.0000	102000.0000	\N	f	TEST	2026-07-21 14:11:53.615839	2026-07-21 14:11:53.615839
bb94d5b4-5c89-4fbd-bd4f-75c7fa92e870	601-0-000001-99	Finished Engine Crankshaft Assembly (FG)	FG	\N	FG-WH	Z-FG	FG-A-01	50.0000	5.0000	45.0000	15.0000	50.0000	pcs	1250.0000	62500.0000	\N	f	TEST	2026-07-21 14:23:54.573829	2026-07-21 14:23:54.573829
f97d4b01-b932-45d9-8ce2-7ad68b5e89a7	RM-STEEL-316L	Forged Alloy Steel Bar 316L	RM	\N	MAIN	Z-RM	RM-A-01	500.0000	50.0000	450.0000	100.0000	200.0000	kg	180.0000	90000.0000	\N	f	TEST	2026-07-21 14:23:54.577595	2026-07-21 14:23:54.577595
33dd598b-0aa2-4a8b-aedd-6e437593e9ce	601-0-000001-88	Rejected Crankshaft Casting (NG)	NG	\N	QC-WH	Z-QC	QUARANTINE	4.0000	0.0000	4.0000	0.0000	0.0000	pcs	100.0000	400.0000	\N	f	TEST	2026-07-21 14:23:54.579321	2026-07-21 14:23:54.579321
c3a7f3a2-99bf-4ee2-832d-0e26d4e3abb8	602-0-000002-99	High Compression Piston Assembly (FG)	FG	\N	FG-WH	Z-FG	FG-B-02	120.0000	10.0000	110.0000	20.0000	60.0000	pcs	850.0000	102000.0000	\N	f	TEST	2026-07-21 14:23:54.580385	2026-07-21 14:23:54.580385
652739eb-b8d3-4fcd-8bb5-4818889b9a15	601-0-000001	Base Engine Shaft	PART	\N	MAIN	Z1	A-01-01	120.0000	0.0000	120.0000	10.0000	50.0000	pcs	250.0000	30000.0000	\N	f	TEST	2026-07-21 12:05:01.364112	2026-07-21 12:05:01.364112
6dfc067e-20d3-4ee1-b94d-afac6e17fa69	601-0-000001	Base Engine Shaft	PART	\N	MAIN	Z1	A-01-01	120.0000	0.0000	120.0000	10.0000	50.0000	pcs	250.0000	30000.0000	\N	f	TEST	2026-07-21 12:05:19.125404	2026-07-21 12:05:19.125404
\.


--
-- Data for Name: inventory_stock_movements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_stock_movements (id, movement_no, movement_type, part_number, part_description, item_type, from_warehouse_code, from_bin_code, to_warehouse_code, to_bin_code, qty, unit, unit_cost, reference_type, reference_no, reason, performed_by, is_deleted, tenant_id, created_at) FROM stdin;
b945bf99-c5c2-4583-bec4-1f8dd04dd6df	FG-202607211205	RECEIPT	601-0-000001-99		FG	\N	\N	FG-WH	FG-A-01	18.0000	pcs	0.0000	PRODUCTION_ORDER	PRD-202607211205	\N	Operator 1	f	TEST	2026-07-21 12:05:19.138072
188a4c4b-0b44-4e96-8c10-bab43dad6a73	NG-202607211205	SCRAP	601-0-000001-88		NG	\N	\N	QC-WH	QUARANTINE	2.0000	pcs	0.0000	PRODUCTION_ORDER	PRD-202607211205	Quality Rejection	Operator 1	f	TEST	2026-07-21 12:05:19.138072
mov-101	MOV-20260721-01	RECEIPT	RM-STEEL-316L		RM	\N	\N	MAIN	RM-A-01	500.0000	kg	180.0000	PO	PO-2026-001	Goods Receipt against Tata Steel PO	Sunil Verma (EMP-1003)	f	TEST	2026-07-21 12:09:15.674131
mov-102	MOV-20260721-02	RECEIPT	601-0-000001-99		FG	MAIN	WIP-B-02	FG-WH	FG-A-01	18.0000	pcs	1250.0000	PRODUCTION_ORDER	PRD-20260721-01	Shop Floor Output Completion	Anita Sharma (EMP-1004)	f	TEST	2026-07-21 12:09:15.675878
mov-103	MOV-20260721-03	SCRAP	601-0-000001-88		NG	MAIN	WIP-B-02	QC-WH	QUARANTINE	2.0000	pcs	100.0000	PRODUCTION_ORDER	PRD-20260721-01	Quality Defect Rejection	Vikram Singh (EMP-1005)	f	TEST	2026-07-21 12:09:15.676467
84c52400-c272-4816-8468-896432230c28	MOV-20260721-01	RECEIPT	RM-STEEL-316L		RM	\N	\N	MAIN	RM-A-01	500.0000	kg	180.0000	PO	PO-2026-001	Goods Receipt against Tata Steel PO	Sunil Verma (EMP-1003)	f	TEST	2026-07-21 12:09:54.619124
73783643-0f35-4b46-bb66-95b6da1866ef	MOV-20260721-02	RECEIPT	601-0-000001-99		FG	MAIN	WIP-B-02	FG-WH	FG-A-01	18.0000	pcs	1250.0000	PRODUCTION_ORDER	PRD-20260721-01	Shop Floor Output Completion	Anita Sharma (EMP-1004)	f	TEST	2026-07-21 12:09:54.619994
64780495-cd96-4b01-b3e9-a710f905e73c	MOV-20260721-03	SCRAP	601-0-000001-88		NG	MAIN	WIP-B-02	QC-WH	QUARANTINE	2.0000	pcs	100.0000	PRODUCTION_ORDER	PRD-20260721-01	Quality Defect Rejection	Vikram Singh (EMP-1005)	f	TEST	2026-07-21 12:09:54.620586
29904784-c7ea-41ad-8c62-108de41b71e0	MOV-20260721-01	RECEIPT	RM-STEEL-316L		RM	\N	\N	MAIN	RM-A-01	500.0000	kg	180.0000	PO	PO-2026-001	Goods Receipt against Tata Steel PO	Sunil Verma (EMP-1003)	f	TEST	2026-07-21 12:16:37.838625
d73a99d2-6cf3-4123-896f-9370cb7e521c	MOV-20260721-02	RECEIPT	601-0-000001-99		FG	MAIN	WIP-B-02	FG-WH	FG-A-01	18.0000	pcs	1250.0000	PRODUCTION_ORDER	PRD-20260721-01	Shop Floor Output Completion	Anita Sharma (EMP-1004)	f	TEST	2026-07-21 12:16:37.839968
d8bb70f5-85e9-4921-83ad-520346e77aaa	MOV-20260721-03	SCRAP	601-0-000001-88		NG	MAIN	WIP-B-02	QC-WH	QUARANTINE	2.0000	pcs	100.0000	PRODUCTION_ORDER	PRD-20260721-01	Quality Defect Rejection	Vikram Singh (EMP-1005)	f	TEST	2026-07-21 12:16:37.840506
6c64140f-1490-4258-b0ec-7c4dbac85bbb	MOV-20260721-01	RECEIPT	RM-STEEL-316L		RM	\N	\N	MAIN	RM-A-01	500.0000	kg	180.0000	PO	PO-2026-001	Goods Receipt against Tata Steel PO	Sunil Verma (EMP-1003)	f	TEST	2026-07-21 13:16:34.57161
0c06f734-ca7a-48cc-ae84-f1859ef920e2	MOV-20260721-02	RECEIPT	601-0-000001-99		FG	MAIN	WIP-B-02	FG-WH	FG-A-01	18.0000	pcs	1250.0000	PRODUCTION_ORDER	PRD-20260721-01	Shop Floor Output Completion	Anita Sharma (EMP-1004)	f	TEST	2026-07-21 13:16:34.573798
cf0a588e-2d0f-4091-9328-e9cfd6b88264	MOV-20260721-03	SCRAP	601-0-000001-88		NG	MAIN	WIP-B-02	QC-WH	QUARANTINE	2.0000	pcs	100.0000	PRODUCTION_ORDER	PRD-20260721-01	Quality Defect Rejection	Vikram Singh (EMP-1005)	f	TEST	2026-07-21 13:16:34.574806
13a7cd9c-860f-4e71-a7c2-e324d2f98636	MOV-20260721-01	RECEIPT	RM-STEEL-316L		RM	\N	\N	MAIN	RM-A-01	500.0000	kg	180.0000	PO	PO-2026-001	Goods Receipt against Tata Steel PO	Sunil Verma (EMP-1003)	f	TEST	2026-07-21 13:44:40.162121
73beb848-5aa5-4fd1-b949-84bf944eb8f6	MOV-20260721-02	RECEIPT	601-0-000001-99		FG	MAIN	WIP-B-02	FG-WH	FG-A-01	18.0000	pcs	1250.0000	PRODUCTION_ORDER	PRD-20260721-01	Shop Floor Output Completion	Anita Sharma (EMP-1004)	f	TEST	2026-07-21 13:44:40.163657
9f11d5ba-a1dd-4547-84cb-1e8350479863	MOV-20260721-03	SCRAP	601-0-000001-88		NG	MAIN	WIP-B-02	QC-WH	QUARANTINE	2.0000	pcs	100.0000	PRODUCTION_ORDER	PRD-20260721-01	Quality Defect Rejection	Vikram Singh (EMP-1005)	f	TEST	2026-07-21 13:44:40.164302
466dfa8c-04da-4648-9d41-3d52a60ce7b6	MOV-20260721-01	RECEIPT	RM-STEEL-316L		RM	\N	\N	MAIN	RM-A-01	500.0000	kg	180.0000	PO	PO-2026-001	Goods Receipt against Tata Steel PO	Sunil Verma (EMP-1003)	f	TEST	2026-07-21 13:45:25.730852
dc7a9ff4-11ec-4fef-acd7-001bb58426c9	MOV-20260721-02	RECEIPT	601-0-000001-99		FG	MAIN	WIP-B-02	FG-WH	FG-A-01	18.0000	pcs	1250.0000	PRODUCTION_ORDER	PRD-20260721-01	Shop Floor Output Completion	Anita Sharma (EMP-1004)	f	TEST	2026-07-21 13:45:25.732729
0a5ce70d-a959-402d-85cc-d2fb2eb36d74	MOV-20260721-03	SCRAP	601-0-000001-88		NG	MAIN	WIP-B-02	QC-WH	QUARANTINE	2.0000	pcs	100.0000	PRODUCTION_ORDER	PRD-20260721-01	Quality Defect Rejection	Vikram Singh (EMP-1005)	f	TEST	2026-07-21 13:45:25.733608
799a4b55-4733-4cde-a398-ff9eff244328	MOV-20260721-01	RECEIPT	RM-STEEL-316L		RM	\N	\N	MAIN	RM-A-01	500.0000	kg	180.0000	PO	PO-2026-001	Goods Receipt against Tata Steel PO	Sunil Verma (EMP-1003)	f	TEST	2026-07-21 14:11:53.618447
ef2d662b-455f-46c3-93ac-15c78df0021e	MOV-20260721-02	RECEIPT	601-0-000001-99		FG	MAIN	WIP-B-02	FG-WH	FG-A-01	18.0000	pcs	1250.0000	PRODUCTION_ORDER	PRD-20260721-01	Shop Floor Output Completion	Anita Sharma (EMP-1004)	f	TEST	2026-07-21 14:11:53.623091
20152b17-6b68-431b-8c64-5a58fdf5e7e1	MOV-20260721-03	SCRAP	601-0-000001-88		NG	MAIN	WIP-B-02	QC-WH	QUARANTINE	2.0000	pcs	100.0000	PRODUCTION_ORDER	PRD-20260721-01	Quality Defect Rejection	Vikram Singh (EMP-1005)	f	TEST	2026-07-21 14:11:53.626042
df5e7d47-720c-4858-ad69-121417920941	MOV-20260721-01	RECEIPT	RM-STEEL-316L		RM	\N	\N	MAIN	RM-A-01	500.0000	kg	180.0000	PO	PO-2026-001	Goods Receipt against Tata Steel PO	Sunil Verma (EMP-1003)	f	TEST	2026-07-21 14:23:54.581582
1f676048-0257-4677-a613-657e8144ffe6	MOV-20260721-02	RECEIPT	601-0-000001-99		FG	MAIN	WIP-B-02	FG-WH	FG-A-01	18.0000	pcs	1250.0000	PRODUCTION_ORDER	PRD-20260721-01	Shop Floor Output Completion	Anita Sharma (EMP-1004)	f	TEST	2026-07-21 14:23:54.584733
a2b68d12-05af-4445-a6c3-deeae8267339	MOV-20260721-03	SCRAP	601-0-000001-88		NG	MAIN	WIP-B-02	QC-WH	QUARANTINE	2.0000	pcs	100.0000	PRODUCTION_ORDER	PRD-20260721-01	Quality Defect Rejection	Vikram Singh (EMP-1005)	f	TEST	2026-07-21 14:23:54.586251
\.


--
-- Data for Name: inventory_warehouses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_warehouses (id, code, name, address, is_active, is_deleted, tenant_id, created_at, updated_at) FROM stdin;
wh-main	MAIN	Central Plant Warehouse	Gate 1 Industrial Zone	t	f	TEST	2026-07-21 12:09:15.666112	2026-07-21 12:09:15.666112
wh-fg	FG-WH	Finished Goods Distribution Center	Logistics Park	t	f	TEST	2026-07-21 12:09:15.666112	2026-07-21 12:09:15.666112
wh-qc	QC-WH	Quarantine & Inspection Warehouse	Quality Building	t	f	TEST	2026-07-21 12:09:15.666112	2026-07-21 12:09:15.666112
a6e37bcf-d430-4055-a97a-c0a1117cc492	MAIN	Central Plant Warehouse	Gate 1 Industrial Zone	t	f	TEST	2026-07-21 12:09:54.615308	2026-07-21 12:09:54.615308
d7e84386-e105-43ea-933c-2f83e2d5b007	FG-WH	Finished Goods Distribution Center	Logistics Park	t	f	TEST	2026-07-21 12:09:54.615308	2026-07-21 12:09:54.615308
ea2d4787-42d5-48df-beb1-dbafb33e8464	QC-WH	Quarantine & Inspection Warehouse	Quality Building	t	f	TEST	2026-07-21 12:09:54.615308	2026-07-21 12:09:54.615308
4040ea31-3417-4f4d-af01-fd5e93df2c38	MAIN	Central Plant Warehouse	Gate 1 Industrial Zone	t	f	TEST	2026-07-21 12:16:37.833794	2026-07-21 12:16:37.833794
311ab8da-290f-4d70-8c11-858e64ddd292	FG-WH	Finished Goods Distribution Center	Logistics Park	t	f	TEST	2026-07-21 12:16:37.833794	2026-07-21 12:16:37.833794
14e0f8af-d76c-49da-bb78-2bcdcbf3c7c4	QC-WH	Quarantine & Inspection Warehouse	Quality Building	t	f	TEST	2026-07-21 12:16:37.833794	2026-07-21 12:16:37.833794
74e370cb-fae9-4053-9f9e-07afe4d8fb34	MAIN	Central Plant Warehouse	Gate 1 Industrial Zone	t	f	TEST	2026-07-21 13:16:34.565036	2026-07-21 13:16:34.565036
f5de6cf2-cdef-4fed-8bd7-8f583615cb54	FG-WH	Finished Goods Distribution Center	Logistics Park	t	f	TEST	2026-07-21 13:16:34.565036	2026-07-21 13:16:34.565036
0bbc8ab0-ccad-42a0-9a0e-9e87cb21353a	QC-WH	Quarantine & Inspection Warehouse	Quality Building	t	f	TEST	2026-07-21 13:16:34.565036	2026-07-21 13:16:34.565036
8fd2a18d-00e1-49d7-8650-5184d9890430	MAIN	Central Plant Warehouse	Gate 1 Industrial Zone	t	f	TEST	2026-07-21 13:44:40.156337	2026-07-21 13:44:40.156337
4a9f515e-f6a8-47b6-9480-28a2a2f1fe44	FG-WH	Finished Goods Distribution Center	Logistics Park	t	f	TEST	2026-07-21 13:44:40.156337	2026-07-21 13:44:40.156337
5331805e-5249-4938-b5e4-22479e662fc6	QC-WH	Quarantine & Inspection Warehouse	Quality Building	t	f	TEST	2026-07-21 13:44:40.156337	2026-07-21 13:44:40.156337
d6b01daf-13f9-4f14-9f5f-29f91c6ca27d	MAIN	Central Plant Warehouse	Gate 1 Industrial Zone	t	f	TEST	2026-07-21 13:45:25.725715	2026-07-21 13:45:25.725715
eeab2baa-a5f3-443d-b9d3-9ed45e36627a	FG-WH	Finished Goods Distribution Center	Logistics Park	t	f	TEST	2026-07-21 13:45:25.725715	2026-07-21 13:45:25.725715
b33dc8cf-1d0b-4ef4-a216-c8d64116ddc1	QC-WH	Quarantine & Inspection Warehouse	Quality Building	t	f	TEST	2026-07-21 13:45:25.725715	2026-07-21 13:45:25.725715
bca0f948-48b3-4483-b869-25c129c81586	MAIN	Central Plant Warehouse	Gate 1 Industrial Zone	t	f	TEST	2026-07-21 14:11:53.600538	2026-07-21 14:11:53.600538
8ff6dbf9-2251-4351-a9a7-7e8ef44fdb68	FG-WH	Finished Goods Distribution Center	Logistics Park	t	f	TEST	2026-07-21 14:11:53.600538	2026-07-21 14:11:53.600538
2e648834-7b19-4240-9a69-42ba1b958f44	QC-WH	Quarantine & Inspection Warehouse	Quality Building	t	f	TEST	2026-07-21 14:11:53.600538	2026-07-21 14:11:53.600538
5cecdc8f-1d2a-4696-992c-970281013a7e	MAIN	Central Plant Warehouse	Gate 1 Industrial Zone	t	f	TEST	2026-07-21 14:23:54.570981	2026-07-21 14:23:54.570981
f4ac2db6-4ca9-4d21-8534-6f88ae164c13	FG-WH	Finished Goods Distribution Center	Logistics Park	t	f	TEST	2026-07-21 14:23:54.570981	2026-07-21 14:23:54.570981
eef115e6-2231-471e-b415-a40f46bb56eb	QC-WH	Quarantine & Inspection Warehouse	Quality Building	t	f	TEST	2026-07-21 14:23:54.570981	2026-07-21 14:23:54.570981
\.


--
-- Data for Name: manufacturing_bom_lines; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.manufacturing_bom_lines (id, bom_id, sequence, component_type, component_no, component_description, qty_per, unit, scrap_factor, operation_ref, is_deleted, tenant_id, created_at) FROM stdin;
bl-101	bom-101	10	RM	RM-STEEL-316L	Steel Alloy Bar 316L	1.2000	kg	5.00	-01	f	TEST	2026-07-21 12:09:15.69756
bl-102	bom-101	20	PART	601-0-000001	Engine Crankshaft Machined Body	1.0000	pcs	0.00	-02	f	TEST	2026-07-21 12:09:15.69756
d64e7f8b-625c-432a-8290-e7c3d8339e91	38a7ae33-2aff-4621-b262-74f4864bd383	10	RM	RM-STEEL-316L	Steel Alloy Bar 316L	1.2000	kg	5.00	-01	f	TEST	2026-07-21 12:09:54.640267
aef09e26-3a02-4211-8c34-821ab82273a4	38a7ae33-2aff-4621-b262-74f4864bd383	20	PART	601-0-000001	Engine Crankshaft Machined Body	1.0000	pcs	0.00	-02	f	TEST	2026-07-21 12:09:54.640267
3306251c-b4dc-4a8b-ad57-d951d85f72df	29c06d27-d146-46cb-b2e1-d6009593b5ae	10	RM	RM-STEEL-316L	Steel Alloy Bar 316L	1.2000	kg	5.00	-01	f	TEST	2026-07-21 12:16:37.858473
10f0e994-67ad-44cc-8c70-85651d8d2e10	29c06d27-d146-46cb-b2e1-d6009593b5ae	20	PART	601-0-000001	Engine Crankshaft Machined Body	1.0000	pcs	0.00	-02	f	TEST	2026-07-21 12:16:37.858473
80d7c883-97f3-4652-af75-3ff7b6266e2a	dcb11489-b9f0-45a7-8b9b-c5b1a5b147e6	10	RM	RM-STEEL-316L	Steel Alloy Bar 316L	1.2000	kg	5.00	-01	f	TEST	2026-07-21 13:16:34.596666
5982ab65-dd2e-4c0e-971e-963556aa3b12	dcb11489-b9f0-45a7-8b9b-c5b1a5b147e6	20	PART	601-0-000001	Engine Crankshaft Machined Body	1.0000	pcs	0.00	-02	f	TEST	2026-07-21 13:16:34.596666
dfc87ed8-2c36-44ae-a397-fc7a6fdf8f4e	0a13fde3-43e5-48df-9a59-d4d47af40a7c	10	RM	RM-STEEL-316L	Steel Alloy Bar 316L	1.2000	kg	5.00	-01	f	TEST	2026-07-21 13:44:40.183978
3b52cbaf-f55d-4e20-b20d-54198903f516	0a13fde3-43e5-48df-9a59-d4d47af40a7c	20	PART	601-0-000001	Engine Crankshaft Machined Body	1.0000	pcs	0.00	-02	f	TEST	2026-07-21 13:44:40.183978
abe2bd3d-80e0-4751-ac23-8f4878858ca6	753f134c-6254-4c44-b1cf-d759490e1b6f	10	RM	RM-STEEL-316L	Steel Alloy Bar 316L	1.2000	kg	5.00	-01	f	TEST	2026-07-21 13:45:25.753168
e3588142-dd3d-4dec-8462-ceaf78b45eab	753f134c-6254-4c44-b1cf-d759490e1b6f	20	PART	601-0-000001	Engine Crankshaft Machined Body	1.0000	pcs	0.00	-02	f	TEST	2026-07-21 13:45:25.753168
feb17514-5022-4d9f-bc3b-3d48ca11c029	5c628fca-5afe-46a2-9715-2fbc3dac3987	10	RM	RM-STEEL-316L	Steel Alloy Bar 316L	1.2000	kg	5.00	-01	f	TEST	2026-07-21 14:11:53.793464
d42633db-3f27-474b-bc6d-6ca0604b2496	5c628fca-5afe-46a2-9715-2fbc3dac3987	20	PART	601-0-000001	Engine Crankshaft Machined Body	1.0000	pcs	0.00	-02	f	TEST	2026-07-21 14:11:53.793464
8b8cc57d-a49b-4ac1-853a-086be6a845b6	133fafe8-19e7-4e08-89b9-9fe2d38eba0c	10	RM	RM-STEEL-316L	Steel Alloy Bar 316L	1.2000	kg	5.00	-01	f	TEST	2026-07-21 14:23:54.634558
59e9f1e5-dbe1-4738-bffe-99ae1b6dec4f	133fafe8-19e7-4e08-89b9-9fe2d38eba0c	20	PART	601-0-000001	Engine Crankshaft Machined Body	1.0000	pcs	0.00	-02	f	TEST	2026-07-21 14:23:54.634558
\.


--
-- Data for Name: manufacturing_boms; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.manufacturing_boms (id, bom_no, fg_part_number, fg_description, version, effective_date, status, yield_qty, unit, notes, is_deleted, tenant_id, created_at, updated_at) FROM stdin;
5528d0d3-d827-4924-a509-e57f86c861c0	BOM-601-0-000001-99	601-0-000001-99	Finished Engine Shaft	1.0	2026-07-21	active	1.0000	pcs		f	TEST	2026-07-21 12:05:01.366605	2026-07-21 12:05:01.366605
598de006-e723-4be2-8b68-adc6b7b90859	BOM-601-0-000001-99	601-0-000001-99	Finished Engine Shaft	1.0	2026-07-21	active	1.0000	pcs		f	TEST	2026-07-21 12:05:19.127731	2026-07-21 12:05:19.127731
bom-101	BOM-601-0-000001-99	601-0-000001-99	Finished Engine Crankshaft Assembly	1.0	2026-01-01	active	1.0000	pcs	\N	f	TEST	2026-07-21 12:09:15.696117	2026-07-21 12:09:15.696117
38a7ae33-2aff-4621-b262-74f4864bd383	BOM-601-0-000001-99	601-0-000001-99	Finished Engine Crankshaft Assembly	1.0	2026-01-01	active	1.0000	pcs	\N	f	TEST	2026-07-21 12:09:54.639069	2026-07-21 12:09:54.639069
29c06d27-d146-46cb-b2e1-d6009593b5ae	BOM-601-0-000001-99	601-0-000001-99	Finished Engine Crankshaft Assembly	1.0	2026-01-01	active	1.0000	pcs	\N	f	TEST	2026-07-21 12:16:37.85739	2026-07-21 12:16:37.85739
dcb11489-b9f0-45a7-8b9b-c5b1a5b147e6	BOM-601-0-000001-99	601-0-000001-99	Finished Engine Crankshaft Assembly	1.0	2026-01-01	active	1.0000	pcs	\N	f	TEST	2026-07-21 13:16:34.595223	2026-07-21 13:16:34.595223
0a13fde3-43e5-48df-9a59-d4d47af40a7c	BOM-601-0-000001-99	601-0-000001-99	Finished Engine Crankshaft Assembly	1.0	2026-01-01	active	1.0000	pcs	\N	f	TEST	2026-07-21 13:44:40.182802	2026-07-21 13:44:40.182802
753f134c-6254-4c44-b1cf-d759490e1b6f	BOM-601-0-000001-99	601-0-000001-99	Finished Engine Crankshaft Assembly	1.0	2026-01-01	active	1.0000	pcs	\N	f	TEST	2026-07-21 13:45:25.752103	2026-07-21 13:45:25.752103
5c628fca-5afe-46a2-9715-2fbc3dac3987	BOM-601-0-000001-99	601-0-000001-99	Finished Engine Crankshaft Assembly	1.0	2026-01-01	active	1.0000	pcs	\N	f	TEST	2026-07-21 14:11:53.79058	2026-07-21 14:11:53.79058
133fafe8-19e7-4e08-89b9-9fe2d38eba0c	BOM-601-0-000001-99	601-0-000001-99	Finished Engine Crankshaft Assembly	1.0	2026-01-01	active	1.0000	pcs	\N	f	TEST	2026-07-21 14:23:54.632614	2026-07-21 14:23:54.632614
\.


--
-- Data for Name: manufacturing_production_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.manufacturing_production_orders (id, order_no, fg_part_number, fg_description, bom_id, routing_id, planned_qty, produced_qty, rejected_qty, planned_start, planned_end, actual_start, actual_end, status, priority, notes, is_deleted, tenant_id, created_at, updated_at) FROM stdin;
6d0c8894-c7c3-4dc3-9ed5-3227b260131b	PRD-202607211205	601-0-000001-99		\N	\N	20.0000	18.0000	2.0000	2026-07-21	2026-07-24	\N	\N	in_progress	normal		f	TEST	2026-07-21 12:05:19.134093	2026-07-21 12:05:19.134093
po-101	PRD-20260721-01	601-0-000001-99	Finished Engine Crankshaft Assembly	bom-101	rtg-101	20.0000	18.0000	2.0000	2026-07-21	2026-07-24	\N	\N	in_progress	high	\N	f	TEST	2026-07-21 12:09:15.703175	2026-07-21 12:09:15.703175
1d9a19c1-f479-49f4-8902-531ea3abd793	PRD-20260721-01	601-0-000001-99	Finished Engine Crankshaft Assembly	38a7ae33-2aff-4621-b262-74f4864bd383	980b41e2-73d2-4c70-90d1-328b6a528f4e	20.0000	18.0000	2.0000	2026-07-21	2026-07-24	\N	\N	in_progress	high	\N	f	TEST	2026-07-21 12:09:54.646702	2026-07-21 12:09:54.646702
eccff609-d7e1-4c94-a38c-589d75503080	PRD-20260721-01	601-0-000001-99	Finished Engine Crankshaft Assembly	29c06d27-d146-46cb-b2e1-d6009593b5ae	8aafadcb-d132-4a4e-b585-7298743bf06a	20.0000	18.0000	2.0000	2026-07-21	2026-07-24	\N	\N	in_progress	high	\N	f	TEST	2026-07-21 12:16:37.865032	2026-07-21 12:16:37.865032
bf6f449a-0241-4cf5-a2ed-7b42185567dc	PRD-20260721-01	601-0-000001-99	Finished Engine Crankshaft Assembly	dcb11489-b9f0-45a7-8b9b-c5b1a5b147e6	31767bcf-578c-42af-84c0-9cba2cada905	20.0000	18.0000	2.0000	2026-07-21	2026-07-24	\N	\N	in_progress	high	\N	f	TEST	2026-07-21 13:16:34.601547	2026-07-21 13:16:34.601547
04f0003a-ea09-4b67-b8d6-a822b03fe8dd	PRD-20260721-01	601-0-000001-99	Finished Engine Crankshaft Assembly	0a13fde3-43e5-48df-9a59-d4d47af40a7c	52bb41ef-a2a8-473c-8cea-001d5da46897	20.0000	18.0000	2.0000	2026-07-21	2026-07-24	\N	\N	in_progress	high	\N	f	TEST	2026-07-21 13:44:40.189949	2026-07-21 13:44:40.189949
ddc7df82-d3a6-40e9-a27e-a0cbe3661b5b	PRD-20260721-01	601-0-000001-99	Finished Engine Crankshaft Assembly	753f134c-6254-4c44-b1cf-d759490e1b6f	a7b3220b-f4ae-40eb-be3b-f91175583156	20.0000	18.0000	2.0000	2026-07-21	2026-07-24	\N	\N	in_progress	high	\N	f	TEST	2026-07-21 13:45:25.758484	2026-07-21 13:45:25.758484
1f9423e0-2b27-40d4-9f57-baf17f5635f1	PRD-20260721-01	601-0-000001-99	Finished Engine Crankshaft Assembly	5c628fca-5afe-46a2-9715-2fbc3dac3987	de941af8-eed2-4c2d-93df-41a863c2e509	20.0000	18.0000	2.0000	2026-07-21	2026-07-24	\N	\N	in_progress	high	\N	f	TEST	2026-07-21 14:11:53.808866	2026-07-21 14:11:53.808866
c19d7ef5-ab83-486c-bccc-1e6c53622998	PRD-20260721-01	601-0-000001-99	Finished Engine Crankshaft Assembly	133fafe8-19e7-4e08-89b9-9fe2d38eba0c	c0fe6084-0d0e-4cc7-822c-604650420a72	20.0000	18.0000	2.0000	2026-07-21	2026-07-24	\N	\N	in_progress	high	\N	f	TEST	2026-07-21 14:23:54.645539	2026-07-21 14:23:54.645539
\.


--
-- Data for Name: manufacturing_routing_steps; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.manufacturing_routing_steps (id, routing_id, sequence, operation_code, operation_name, work_center_code, work_center_name, setup_time_min, run_time_min_per_unit, sub_operations, notes, is_deleted, tenant_id, created_at) FROM stdin;
41742313-a4b8-48e6-87ef-2dbb864394b1	efd0da5d-0437-439c-9a18-fab11d2a0e96	10	-01	Cutting & Blanking	WC-CUT	Main Station	15.00	2.00	[{"code": "-01-01", "name": "Raw Material Inspection"}, {"code": "-01-02", "name": "Precision Cutting"}]	\N	f	TEST	2026-07-21 12:05:01.369588
8350eaf4-672a-4375-b570-5577391b027f	efd0da5d-0437-439c-9a18-fab11d2a0e96	20	-02	CNC Machining	WC-CNC	Main Station	30.00	5.00	[{"code": "-02-01", "name": "Facing"}, {"code": "-02-02", "name": "Drilling & Tapping"}]	\N	f	TEST	2026-07-21 12:05:01.369588
2291dd2e-05c7-48ab-9140-d799bce899ab	96e2e496-1c04-4428-9536-027b5c269dbd	10	-01	Cutting & Blanking	WC-CUT	Main Station	15.00	2.00	[{"code": "-01-01", "name": "Raw Material Inspection"}, {"code": "-01-02", "name": "Precision Cutting"}]	\N	f	TEST	2026-07-21 12:05:19.130713
5e0d7629-a544-430c-89eb-6cba63066cd8	96e2e496-1c04-4428-9536-027b5c269dbd	20	-02	CNC Machining	WC-CNC	Main Station	30.00	5.00	[{"code": "-02-01", "name": "Facing"}, {"code": "-02-02", "name": "Drilling & Tapping"}]	\N	f	TEST	2026-07-21 12:05:19.130713
rs-101	rtg-101	10	-01	Op -01: Blanking & Rough Turning	MAC-LATHE-02	Mazak Turning Center	15.00	3.00	[{"code": "-01-01", "name": "Raw Bar Material Inspection"}, {"code": "-01-02", "name": "Precision Saw Blanking"}]	\N	f	TEST	2026-07-21 12:09:15.70108
rs-102	rtg-101	20	-02	Op -02: CNC Milling & Drilling	MAC-CNC-01	Haas 5-Axis CNC	30.00	6.00	[{"code": "-02-01", "name": "Journal Facing & Centering"}, {"code": "-02-02", "name": "Counterweight CNC Milling"}]	\N	f	TEST	2026-07-21 12:09:15.702163
rs-103	rtg-101	30	-03	Op -03: Precision Journal Grinding	MAC-GRIND-03	Studer Cylindrical Grinder	20.00	4.00	[{"code": "-03-01", "name": "Induction Hardening Inspection"}, {"code": "-03-02", "name": "Micro-Finish Journal Grinding"}]	\N	f	TEST	2026-07-21 12:09:15.70261
2bb4bd7d-7c4b-4785-9355-c2dc99300905	980b41e2-73d2-4c70-90d1-328b6a528f4e	10	-01	Op -01: Blanking & Rough Turning	MAC-LATHE-02	Mazak Turning Center	15.00	3.00	[{"code": "-01-01", "name": "Raw Bar Material Inspection"}, {"code": "-01-02", "name": "Precision Saw Blanking"}]	\N	f	TEST	2026-07-21 12:09:54.642862
f7a0667f-0e40-4bd2-a757-07c44340c814	980b41e2-73d2-4c70-90d1-328b6a528f4e	20	-02	Op -02: CNC Milling & Drilling	MAC-CNC-01	Haas 5-Axis CNC	30.00	6.00	[{"code": "-02-01", "name": "Journal Facing & Centering"}, {"code": "-02-02", "name": "Counterweight CNC Milling"}]	\N	f	TEST	2026-07-21 12:09:54.644577
4fc5e09d-b04d-4dd4-8044-fe8ac16af539	980b41e2-73d2-4c70-90d1-328b6a528f4e	30	-03	Op -03: Precision Journal Grinding	MAC-GRIND-03	Studer Cylindrical Grinder	20.00	4.00	[{"code": "-03-01", "name": "Induction Hardening Inspection"}, {"code": "-03-02", "name": "Micro-Finish Journal Grinding"}]	\N	f	TEST	2026-07-21 12:09:54.645661
9a7d199d-a7fd-4673-8da1-c628b0a55fec	8aafadcb-d132-4a4e-b585-7298743bf06a	10	-01	Op -01: Blanking & Rough Turning	MAC-LATHE-02	Mazak Turning Center	15.00	3.00	[{"code": "-01-01", "name": "Raw Bar Material Inspection"}, {"code": "-01-02", "name": "Precision Saw Blanking"}]	\N	f	TEST	2026-07-21 12:16:37.861735
e652f3de-bb24-4b64-ba96-879ebdce459a	8aafadcb-d132-4a4e-b585-7298743bf06a	20	-02	Op -02: CNC Milling & Drilling	MAC-CNC-01	Haas 5-Axis CNC	30.00	6.00	[{"code": "-02-01", "name": "Journal Facing & Centering"}, {"code": "-02-02", "name": "Counterweight CNC Milling"}]	\N	f	TEST	2026-07-21 12:16:37.863521
f3c42c66-bec5-4832-9401-7f65433577b6	8aafadcb-d132-4a4e-b585-7298743bf06a	30	-03	Op -03: Precision Journal Grinding	MAC-GRIND-03	Studer Cylindrical Grinder	20.00	4.00	[{"code": "-03-01", "name": "Induction Hardening Inspection"}, {"code": "-03-02", "name": "Micro-Finish Journal Grinding"}]	\N	f	TEST	2026-07-21 12:16:37.864359
3fd465b4-4e24-4aa5-83ec-f0d58e2c38b5	31767bcf-578c-42af-84c0-9cba2cada905	10	-01	Op -01: Blanking & Rough Turning	MAC-LATHE-02	Mazak Turning Center	15.00	3.00	[{"code": "-01-01", "name": "Raw Bar Material Inspection"}, {"code": "-01-02", "name": "Precision Saw Blanking"}]	\N	f	TEST	2026-07-21 13:16:34.599427
12f08d65-7422-4aaa-8fce-57b443e30c2c	31767bcf-578c-42af-84c0-9cba2cada905	20	-02	Op -02: CNC Milling & Drilling	MAC-CNC-01	Haas 5-Axis CNC	30.00	6.00	[{"code": "-02-01", "name": "Journal Facing & Centering"}, {"code": "-02-02", "name": "Counterweight CNC Milling"}]	\N	f	TEST	2026-07-21 13:16:34.600667
4aba9240-8673-4936-8b79-892928c0a885	31767bcf-578c-42af-84c0-9cba2cada905	30	-03	Op -03: Precision Journal Grinding	MAC-GRIND-03	Studer Cylindrical Grinder	20.00	4.00	[{"code": "-03-01", "name": "Induction Hardening Inspection"}, {"code": "-03-02", "name": "Micro-Finish Journal Grinding"}]	\N	f	TEST	2026-07-21 13:16:34.60111
84345bb4-bb90-4f3a-aa19-303c2eeb2e4a	52bb41ef-a2a8-473c-8cea-001d5da46897	10	-01	Op -01: Blanking & Rough Turning	MAC-LATHE-02	Mazak Turning Center	15.00	3.00	[{"code": "-01-01", "name": "Raw Bar Material Inspection"}, {"code": "-01-02", "name": "Precision Saw Blanking"}]	\N	f	TEST	2026-07-21 13:44:40.187132
f99bd44c-dc15-4c61-9538-eb97bc230559	52bb41ef-a2a8-473c-8cea-001d5da46897	20	-02	Op -02: CNC Milling & Drilling	MAC-CNC-01	Haas 5-Axis CNC	30.00	6.00	[{"code": "-02-01", "name": "Journal Facing & Centering"}, {"code": "-02-02", "name": "Counterweight CNC Milling"}]	\N	f	TEST	2026-07-21 13:44:40.188999
8be4c7a1-9b15-4a5d-b7fb-fd36263ddc28	52bb41ef-a2a8-473c-8cea-001d5da46897	30	-03	Op -03: Precision Journal Grinding	MAC-GRIND-03	Studer Cylindrical Grinder	20.00	4.00	[{"code": "-03-01", "name": "Induction Hardening Inspection"}, {"code": "-03-02", "name": "Micro-Finish Journal Grinding"}]	\N	f	TEST	2026-07-21 13:44:40.189491
f2a7ace6-1f5f-4e67-8203-25326893234f	a7b3220b-f4ae-40eb-be3b-f91175583156	10	-01	Op -01: Blanking & Rough Turning	MAC-LATHE-02	Mazak Turning Center	15.00	3.00	[{"code": "-01-01", "name": "Raw Bar Material Inspection"}, {"code": "-01-02", "name": "Precision Saw Blanking"}]	\N	f	TEST	2026-07-21 13:45:25.755713
d1f4f8d6-8460-4581-85ec-d7147061754b	a7b3220b-f4ae-40eb-be3b-f91175583156	20	-02	Op -02: CNC Milling & Drilling	MAC-CNC-01	Haas 5-Axis CNC	30.00	6.00	[{"code": "-02-01", "name": "Journal Facing & Centering"}, {"code": "-02-02", "name": "Counterweight CNC Milling"}]	\N	f	TEST	2026-07-21 13:45:25.756814
ed116481-8de3-41d8-9cc2-595789b05230	a7b3220b-f4ae-40eb-be3b-f91175583156	30	-03	Op -03: Precision Journal Grinding	MAC-GRIND-03	Studer Cylindrical Grinder	20.00	4.00	[{"code": "-03-01", "name": "Induction Hardening Inspection"}, {"code": "-03-02", "name": "Micro-Finish Journal Grinding"}]	\N	f	TEST	2026-07-21 13:45:25.757814
54a7cad8-667b-4ca9-97c1-6d9413926f22	de941af8-eed2-4c2d-93df-41a863c2e509	10	-01	Op -01: Blanking & Rough Turning	MAC-LATHE-02	Mazak Turning Center	15.00	3.00	[{"code": "-01-01", "name": "Raw Bar Material Inspection"}, {"code": "-01-02", "name": "Precision Saw Blanking"}]	\N	f	TEST	2026-07-21 14:11:53.801391
6b476db1-20ad-4781-88e7-527098cb618b	de941af8-eed2-4c2d-93df-41a863c2e509	20	-02	Op -02: CNC Milling & Drilling	MAC-CNC-01	Haas 5-Axis CNC	30.00	6.00	[{"code": "-02-01", "name": "Journal Facing & Centering"}, {"code": "-02-02", "name": "Counterweight CNC Milling"}]	\N	f	TEST	2026-07-21 14:11:53.805385
d0754195-c280-44c2-8035-37d87630354d	de941af8-eed2-4c2d-93df-41a863c2e509	30	-03	Op -03: Precision Journal Grinding	MAC-GRIND-03	Studer Cylindrical Grinder	20.00	4.00	[{"code": "-03-01", "name": "Induction Hardening Inspection"}, {"code": "-03-02", "name": "Micro-Finish Journal Grinding"}]	\N	f	TEST	2026-07-21 14:11:53.806944
f1e8b06e-5a9b-4106-84a1-88fdba7ed806	c0fe6084-0d0e-4cc7-822c-604650420a72	10	-01	Op -01: Blanking & Rough Turning	MAC-LATHE-02	Mazak Turning Center	15.00	3.00	[{"code": "-01-01", "name": "Raw Bar Material Inspection"}, {"code": "-01-02", "name": "Precision Saw Blanking"}]	\N	f	TEST	2026-07-21 14:23:54.638907
66229dfe-daa6-474d-ad37-5d08ec28f53c	c0fe6084-0d0e-4cc7-822c-604650420a72	20	-02	Op -02: CNC Milling & Drilling	MAC-CNC-01	Haas 5-Axis CNC	30.00	6.00	[{"code": "-02-01", "name": "Journal Facing & Centering"}, {"code": "-02-02", "name": "Counterweight CNC Milling"}]	\N	f	TEST	2026-07-21 14:23:54.643098
e5d409b7-b7f8-4922-98d3-3145f6bf6ca9	c0fe6084-0d0e-4cc7-822c-604650420a72	30	-03	Op -03: Precision Journal Grinding	MAC-GRIND-03	Studer Cylindrical Grinder	20.00	4.00	[{"code": "-03-01", "name": "Induction Hardening Inspection"}, {"code": "-03-02", "name": "Micro-Finish Journal Grinding"}]	\N	f	TEST	2026-07-21 14:23:54.644329
\.


--
-- Data for Name: manufacturing_routings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.manufacturing_routings (id, routing_no, part_number, part_description, version, status, notes, is_deleted, tenant_id, created_at, updated_at) FROM stdin;
efd0da5d-0437-439c-9a18-fab11d2a0e96	RTG-601-0-000001	601-0-000001	Engine Shaft Routing	1.0	active		f	TEST	2026-07-21 12:05:01.369588	2026-07-21 12:05:01.369588
96e2e496-1c04-4428-9536-027b5c269dbd	RTG-601-0-000001	601-0-000001	Engine Shaft Routing	1.0	active		f	TEST	2026-07-21 12:05:19.130713	2026-07-21 12:05:19.130713
rtg-101	RTG-601-0-000001	601-0-000001	Precision Crankshaft 3-Step Manufacturing Routing	1.0	active	\N	f	TEST	2026-07-21 12:09:15.699364	2026-07-21 12:09:15.699364
980b41e2-73d2-4c70-90d1-328b6a528f4e	RTG-601-0-000001	601-0-000001	Precision Crankshaft 3-Step Manufacturing Routing	1.0	active	\N	f	TEST	2026-07-21 12:09:54.641488	2026-07-21 12:09:54.641488
8aafadcb-d132-4a4e-b585-7298743bf06a	RTG-601-0-000001	601-0-000001	Precision Crankshaft 3-Step Manufacturing Routing	1.0	active	\N	f	TEST	2026-07-21 12:16:37.859565	2026-07-21 12:16:37.859565
31767bcf-578c-42af-84c0-9cba2cada905	RTG-601-0-000001	601-0-000001	Precision Crankshaft 3-Step Manufacturing Routing	1.0	active	\N	f	TEST	2026-07-21 13:16:34.598048	2026-07-21 13:16:34.598048
52bb41ef-a2a8-473c-8cea-001d5da46897	RTG-601-0-000001	601-0-000001	Precision Crankshaft 3-Step Manufacturing Routing	1.0	active	\N	f	TEST	2026-07-21 13:44:40.185349	2026-07-21 13:44:40.185349
a7b3220b-f4ae-40eb-be3b-f91175583156	RTG-601-0-000001	601-0-000001	Precision Crankshaft 3-Step Manufacturing Routing	1.0	active	\N	f	TEST	2026-07-21 13:45:25.754547	2026-07-21 13:45:25.754547
de941af8-eed2-4c2d-93df-41a863c2e509	RTG-601-0-000001	601-0-000001	Precision Crankshaft 3-Step Manufacturing Routing	1.0	active	\N	f	TEST	2026-07-21 14:11:53.797381	2026-07-21 14:11:53.797381
c0fe6084-0d0e-4cc7-822c-604650420a72	RTG-601-0-000001	601-0-000001	Precision Crankshaft 3-Step Manufacturing Routing	1.0	active	\N	f	TEST	2026-07-21 14:23:54.636754	2026-07-21 14:23:54.636754
\.


--
-- Data for Name: manufacturing_shop_floor_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.manufacturing_shop_floor_logs (id, production_order_no, part_number, operation_code, work_center_code, operator, start_time, end_time, qty_produced, qty_rejected, rejection_reason, actual_time_min, status, notes, tenant_id, created_at) FROM stdin;
d102f61a-1644-43e5-abc1-bdd1de89cbc2	PRD-202607211205	601-0-000001	-01	WC-CNC	Operator 1	2026-07-21 11:35:19.138072	2026-07-21 12:05:19.138072	18.0000	2.0000		30.00	completed	\N	TEST	2026-07-21 12:05:19.138072
sfl-101	PRD-20260721-01	601-0-000001	-01	MAC-LATHE-02	Anita Sharma (EMP-1004)	\N	\N	20.0000	0.0000	Clean blanking	75.00	completed	\N	TEST	2026-07-21 12:09:15.704311
sfl-102	PRD-20260721-01	601-0-000001	-02	MAC-CNC-01	Anita Sharma (EMP-1004)	\N	\N	18.0000	2.0000	Casting porosity defect on 2 units -> NG -88	150.00	completed	\N	TEST	2026-07-21 12:09:15.704311
d91defc2-05ae-4369-9842-2a97eaf70f50	PRD-20260721-01	601-0-000001	-01	MAC-LATHE-02	Anita Sharma (EMP-1004)	\N	\N	20.0000	0.0000	Clean blanking	75.00	completed	\N	TEST	2026-07-21 12:09:54.648451
72b8600f-9b82-4fca-89ee-3245b033900b	PRD-20260721-01	601-0-000001	-02	MAC-CNC-01	Anita Sharma (EMP-1004)	\N	\N	18.0000	2.0000	Casting porosity defect on 2 units -> NG -88	150.00	completed	\N	TEST	2026-07-21 12:09:54.648451
023281ee-afe2-41bc-9655-996b428e5516	PRD-20260721-01	601-0-000001	-01	MAC-LATHE-02	Anita Sharma (EMP-1004)	\N	\N	20.0000	0.0000	Clean blanking	75.00	completed	\N	TEST	2026-07-21 12:16:37.866397
f133f50b-676c-4100-9942-30680a345371	PRD-20260721-01	601-0-000001	-02	MAC-CNC-01	Anita Sharma (EMP-1004)	\N	\N	18.0000	2.0000	Casting porosity defect on 2 units -> NG -88	150.00	completed	\N	TEST	2026-07-21 12:16:37.866397
23fefea6-c660-4e0a-8134-7f282dfca271	PRD-20260721-01	601-0-000001	-01	MAC-LATHE-02	Anita Sharma (EMP-1004)	\N	\N	20.0000	0.0000	Clean blanking	75.00	completed	\N	TEST	2026-07-21 13:16:34.602521
b902a528-9831-45f7-a177-e8889f357c78	PRD-20260721-01	601-0-000001	-02	MAC-CNC-01	Anita Sharma (EMP-1004)	\N	\N	18.0000	2.0000	Casting porosity defect on 2 units -> NG -88	150.00	completed	\N	TEST	2026-07-21 13:16:34.602521
ebef0f27-0223-4977-a6fe-3618a747187a	PRD-20260721-01	601-0-000001	-01	MAC-LATHE-02	Anita Sharma (EMP-1004)	\N	\N	20.0000	0.0000	Clean blanking	75.00	completed	\N	TEST	2026-07-21 13:44:40.191251
587ed448-266a-45b6-95ce-e8f23855beaa	PRD-20260721-01	601-0-000001	-02	MAC-CNC-01	Anita Sharma (EMP-1004)	\N	\N	18.0000	2.0000	Casting porosity defect on 2 units -> NG -88	150.00	completed	\N	TEST	2026-07-21 13:44:40.191251
d26c0d0d-4fce-4bcd-a0f2-da58b2c3ec08	PRD-20260721-01	601-0-000001	-01	MAC-LATHE-02	Anita Sharma (EMP-1004)	\N	\N	20.0000	0.0000	Clean blanking	75.00	completed	\N	TEST	2026-07-21 13:45:25.76016
6d513961-48ea-4c3f-890d-59e203bbca99	PRD-20260721-01	601-0-000001	-02	MAC-CNC-01	Anita Sharma (EMP-1004)	\N	\N	18.0000	2.0000	Casting porosity defect on 2 units -> NG -88	150.00	completed	\N	TEST	2026-07-21 13:45:25.76016
37c68e22-7dbd-4d2a-ac8c-3ed27acc8ad4	PRD-20260721-01	601-0-000001	-01	MAC-LATHE-02	Anita Sharma (EMP-1004)	\N	\N	20.0000	0.0000	Clean blanking	75.00	completed	\N	TEST	2026-07-21 14:11:53.812244
ab9abeb5-9ecf-4e7e-8a07-9c8101bed3a5	PRD-20260721-01	601-0-000001	-02	MAC-CNC-01	Anita Sharma (EMP-1004)	\N	\N	18.0000	2.0000	Casting porosity defect on 2 units -> NG -88	150.00	completed	\N	TEST	2026-07-21 14:11:53.812244
2e31a499-796f-43a5-b34f-85f6eff8a771	PRD-20260721-01	601-0-000001	-01	MAC-LATHE-02	Anita Sharma (EMP-1004)	\N	\N	20.0000	0.0000	Clean blanking	75.00	completed	\N	TEST	2026-07-21 14:23:54.648029
3cf3458f-0f4e-409f-9b1f-17da706d651e	PRD-20260721-01	601-0-000001	-02	MAC-CNC-01	Anita Sharma (EMP-1004)	\N	\N	18.0000	2.0000	Casting porosity defect on 2 units -> NG -88	150.00	completed	\N	TEST	2026-07-21 14:23:54.648029
\.


--
-- Data for Name: manufacturing_work_centers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.manufacturing_work_centers (id, code, name, machine_id, machine_name, capacity_hours_per_day, efficiency_pct, cost_rate_per_hour, mhr_rate, status, is_deleted, tenant_id, created_at, updated_at) FROM stdin;
mac-101	MAC-CNC-01	Haas VF-4 5-Axis CNC Center	mac-101	Haas VF-4 5-Axis CNC Center	8.00	90.00	650.00	721.50	active	f	TEST	2026-07-21 12:09:15.660972	2026-07-21 12:09:15.660972
mac-102	MAC-LATHE-02	Mazak Quick Turn CNC Lathe	mac-102	Mazak Quick Turn CNC Lathe	8.00	90.00	450.00	499.50	active	f	TEST	2026-07-21 12:09:15.664078	2026-07-21 12:09:15.664078
mac-103	MAC-GRIND-03	Studer CNC Cylindrical Grinder	mac-103	Studer CNC Cylindrical Grinder	8.00	90.00	550.00	610.50	active	f	TEST	2026-07-21 12:09:15.665103	2026-07-21 12:09:15.665103
0eeb5293-50c4-416d-83f5-ec26c9f9f45c	MAC-CNC-01	Haas VF-4 5-Axis CNC Center	0eeb5293-50c4-416d-83f5-ec26c9f9f45c	Haas VF-4 5-Axis CNC Center	8.00	90.00	650.00	721.50	active	f	TEST	2026-07-21 12:09:54.611742	2026-07-21 12:09:54.611742
aa2225d2-e8e4-4775-adae-79da86d345ec	MAC-LATHE-02	Mazak Quick Turn CNC Lathe	aa2225d2-e8e4-4775-adae-79da86d345ec	Mazak Quick Turn CNC Lathe	8.00	90.00	450.00	499.50	active	f	TEST	2026-07-21 12:09:54.613836	2026-07-21 12:09:54.613836
6ab5b0b2-9e63-4f43-ae74-864e8c87ca31	MAC-GRIND-03	Studer CNC Cylindrical Grinder	6ab5b0b2-9e63-4f43-ae74-864e8c87ca31	Studer CNC Cylindrical Grinder	8.00	90.00	550.00	610.50	active	f	TEST	2026-07-21 12:09:54.614632	2026-07-21 12:09:54.614632
99e56eac-7e66-4a8a-881a-079299185de8	MAC-CNC-01	Haas VF-4 5-Axis CNC Center	99e56eac-7e66-4a8a-881a-079299185de8	Haas VF-4 5-Axis CNC Center	8.00	90.00	650.00	721.50	active	f	TEST	2026-07-21 12:16:37.830518	2026-07-21 12:16:37.830518
5c677735-73fd-41da-a31f-12999fb910d2	MAC-LATHE-02	Mazak Quick Turn CNC Lathe	5c677735-73fd-41da-a31f-12999fb910d2	Mazak Quick Turn CNC Lathe	8.00	90.00	450.00	499.50	active	f	TEST	2026-07-21 12:16:37.832722	2026-07-21 12:16:37.832722
61fb1868-cccf-464a-b1ec-7050065fd59d	MAC-GRIND-03	Studer CNC Cylindrical Grinder	61fb1868-cccf-464a-b1ec-7050065fd59d	Studer CNC Cylindrical Grinder	8.00	90.00	550.00	610.50	active	f	TEST	2026-07-21 12:16:37.833275	2026-07-21 12:16:37.833275
873252a1-a659-421c-9a00-ff09168b1014	MAC-CNC-01	Haas VF-4 5-Axis CNC Center	873252a1-a659-421c-9a00-ff09168b1014	Haas VF-4 5-Axis CNC Center	8.00	90.00	650.00	721.50	active	f	TEST	2026-07-21 13:16:34.559689	2026-07-21 13:16:34.559689
2270aa43-5bbd-4b74-9dd1-a1c8203c621b	MAC-LATHE-02	Mazak Quick Turn CNC Lathe	2270aa43-5bbd-4b74-9dd1-a1c8203c621b	Mazak Quick Turn CNC Lathe	8.00	90.00	450.00	499.50	active	f	TEST	2026-07-21 13:16:34.563156	2026-07-21 13:16:34.563156
e24f9f77-f889-40dd-9c44-6a6eb79d4be4	MAC-GRIND-03	Studer CNC Cylindrical Grinder	e24f9f77-f889-40dd-9c44-6a6eb79d4be4	Studer CNC Cylindrical Grinder	8.00	90.00	550.00	610.50	active	f	TEST	2026-07-21 13:16:34.564125	2026-07-21 13:16:34.564125
5c9e0168-a386-4d7f-b4eb-29041bee1746	MAC-CNC-01	Haas VF-4 5-Axis CNC Center	5c9e0168-a386-4d7f-b4eb-29041bee1746	Haas VF-4 5-Axis CNC Center	8.00	90.00	650.00	721.50	active	f	TEST	2026-07-21 13:44:40.153089	2026-07-21 13:44:40.153089
598e8e10-2d8c-43af-8ab7-b9e36464a125	MAC-LATHE-02	Mazak Quick Turn CNC Lathe	598e8e10-2d8c-43af-8ab7-b9e36464a125	Mazak Quick Turn CNC Lathe	8.00	90.00	450.00	499.50	active	f	TEST	2026-07-21 13:44:40.155332	2026-07-21 13:44:40.155332
64a91a65-0fd5-4281-a639-25f2dc3c423c	MAC-GRIND-03	Studer CNC Cylindrical Grinder	64a91a65-0fd5-4281-a639-25f2dc3c423c	Studer CNC Cylindrical Grinder	8.00	90.00	550.00	610.50	active	f	TEST	2026-07-21 13:44:40.155823	2026-07-21 13:44:40.155823
7c1048cf-b2b8-45de-a2d3-48173801417f	MAC-CNC-01	Haas VF-4 5-Axis CNC Center	7c1048cf-b2b8-45de-a2d3-48173801417f	Haas VF-4 5-Axis CNC Center	8.00	90.00	650.00	721.50	active	f	TEST	2026-07-21 13:45:25.722428	2026-07-21 13:45:25.722428
ce398be2-539c-4dfb-9925-9713d62a71d2	MAC-LATHE-02	Mazak Quick Turn CNC Lathe	ce398be2-539c-4dfb-9925-9713d62a71d2	Mazak Quick Turn CNC Lathe	8.00	90.00	450.00	499.50	active	f	TEST	2026-07-21 13:45:25.724436	2026-07-21 13:45:25.724436
f3455d1b-bf5c-40a8-885e-7a4629e9ea3e	MAC-GRIND-03	Studer CNC Cylindrical Grinder	f3455d1b-bf5c-40a8-885e-7a4629e9ea3e	Studer CNC Cylindrical Grinder	8.00	90.00	550.00	610.50	active	f	TEST	2026-07-21 13:45:25.724984	2026-07-21 13:45:25.724984
817f254f-cedd-460f-a3f4-bfe2aa0b64bf	MAC-CNC-01	Haas VF-4 5-Axis CNC Center	817f254f-cedd-460f-a3f4-bfe2aa0b64bf	Haas VF-4 5-Axis CNC Center	8.00	90.00	650.00	721.50	active	f	TEST	2026-07-21 14:11:53.592061	2026-07-21 14:11:53.592061
f52f1c5b-de7d-4e4f-b89d-42b76a162c9d	MAC-LATHE-02	Mazak Quick Turn CNC Lathe	f52f1c5b-de7d-4e4f-b89d-42b76a162c9d	Mazak Quick Turn CNC Lathe	8.00	90.00	450.00	499.50	active	f	TEST	2026-07-21 14:11:53.596471	2026-07-21 14:11:53.596471
e4f71a57-3fb1-4bed-befc-8c4ab6ddc55c	MAC-GRIND-03	Studer CNC Cylindrical Grinder	e4f71a57-3fb1-4bed-befc-8c4ab6ddc55c	Studer CNC Cylindrical Grinder	8.00	90.00	550.00	610.50	active	f	TEST	2026-07-21 14:11:53.598158	2026-07-21 14:11:53.598158
3f467c1b-f376-4b18-ba0d-fd729cf92504	MAC-CNC-01	Haas VF-4 5-Axis CNC Center	3f467c1b-f376-4b18-ba0d-fd729cf92504	Haas VF-4 5-Axis CNC Center	8.00	90.00	650.00	721.50	active	f	TEST	2026-07-21 14:23:54.561525	2026-07-21 14:23:54.561525
7c5d6122-f442-4763-9cdd-f61a1170cf15	MAC-LATHE-02	Mazak Quick Turn CNC Lathe	7c5d6122-f442-4763-9cdd-f61a1170cf15	Mazak Quick Turn CNC Lathe	8.00	90.00	450.00	499.50	active	f	TEST	2026-07-21 14:23:54.567532	2026-07-21 14:23:54.567532
78d434cc-f3eb-4381-9d20-22384d1a4732	MAC-GRIND-03	Studer CNC Cylindrical Grinder	78d434cc-f3eb-4381-9d20-22384d1a4732	Studer CNC Cylindrical Grinder	8.00	90.00	550.00	610.50	active	f	TEST	2026-07-21 14:23:54.569356	2026-07-21 14:23:54.569356
\.


--
-- Data for Name: purchase_customer_demands; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_customer_demands (id, demand_no, customer_name, part_or_rm_code, item_type, item_description, ordered_qty, available_stock, occupy_option, occupied_qty, remaining_stock, qty_to_buy, status, notes, is_deleted, tenant_id, created_at, updated_at, rm_code, rm_description) FROM stdin;
3e378a36-0e7a-4d1f-90dc-ed87d6a8813f	DEM-20260721-01	Bosch Motor Works	RM-STEEL-316L	RM	Forged Alloy Steel Bar 316L	500.0000	450.0000	occupy	450.0000	0.0000	50.0000	pending	Customer urgent order requiring partial stock occupation	f	TEST	2026-07-21 13:16:34.696943	2026-07-21 13:16:34.696943	RM-STEEL-316L	Forged Alloy Steel Bar 316L
a2e625d6-24a3-4551-a9ed-01a1d6254c6a	DEM-20260721-02	Hero MotoCorp Industrial	601-0-000001	PART	Engine Crankshaft Base Part	30.0000	100.0000	do_not_occupy	0.0000	100.0000	30.0000	pending	Do not occupy option selected - full order queued to buy	f	TEST	2026-07-21 13:16:34.696943	2026-07-21 13:16:34.696943	RM-STEEL-316L	Forged Alloy Steel Bar 316L
5c1e96c8-983e-4284-958f-46c78e124b46	DEM-20260721-01	Bosch Motor Works	601-0-000001-99	PART	Finished Engine Crankshaft Assembly	500.0000	450.0000	occupy	450.0000	0.0000	50.0000	pending	Customer part order requiring raw material steel 316L stock occupation	f	TEST	2026-07-21 13:45:25.786021	2026-07-21 13:45:25.786021	RM-STEEL-316L	Forged Alloy Steel Bar 316L
33781e02-5bde-47bd-b4dd-75d30dcd36f6	DEM-20260721-02	Hero MotoCorp Industrial	601-0-000001	PART	Engine Crankshaft Base Part	30.0000	100.0000	do_not_occupy	0.0000	100.0000	30.0000	pending	Do not occupy option selected - full order queued to buy RM	f	TEST	2026-07-21 13:45:25.786021	2026-07-21 13:45:25.786021	RM-STEEL-316L	Forged Alloy Steel Bar 316L
caa9a6de-524e-4a40-be14-65e5616aac86	DEM-20260721-01	Bosch Motor Works	601-0-000001-99	PART	Finished Engine Crankshaft Assembly	500.0000	450.0000	occupy	450.0000	0.0000	50.0000	pending	Customer part order requiring raw material steel 316L stock occupation	f	TEST	2026-07-21 14:11:53.821725	2026-07-21 14:11:53.821725	RM-STEEL-316L	Forged Alloy Steel Bar 316L
c20cf72a-460c-46ad-92f4-640a6d802bcf	DEM-20260721-02	Hero MotoCorp Industrial	601-0-000001	PART	Engine Crankshaft Base Part	30.0000	100.0000	do_not_occupy	0.0000	100.0000	30.0000	pending	Do not occupy option selected - full order queued to buy RM	f	TEST	2026-07-21 14:11:53.821725	2026-07-21 14:11:53.821725	RM-STEEL-316L	Forged Alloy Steel Bar 316L
bedf46de-2ede-4a21-8011-0c2a87e58ece	DEM-20260721-01	Bosch Motor Works	601-0-000001-99	PART	Finished Engine Crankshaft Assembly	500.0000	450.0000	occupy	450.0000	0.0000	50.0000	pending	Customer part order requiring raw material steel 316L stock occupation	f	TEST	2026-07-21 14:23:54.656709	2026-07-21 14:23:54.656709	RM-STEEL-316L	Forged Alloy Steel Bar 316L
552d0cd4-852a-425e-9cc3-7139b84fcf19	DEM-20260721-02	Hero MotoCorp Industrial	601-0-000001	PART	Engine Crankshaft Base Part	30.0000	100.0000	do_not_occupy	0.0000	100.0000	30.0000	pending	Do not occupy option selected - full order queued to buy RM	f	TEST	2026-07-21 14:23:54.656709	2026-07-21 14:23:54.656709	RM-STEEL-316L	Forged Alloy Steel Bar 316L
\.


--
-- Data for Name: purchase_lead_time_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_lead_time_history (id, po_id, po_no, old_lead_time_days, new_lead_time_days, change_reason, remarks, changed_by, changed_at, tenant_id) FROM stdin;
a561444a-45d3-4be0-b2a7-7219cbaf7de7	a8af67a0-02e1-4f4e-8ef4-92f7b43a9c9c	PO-PUR-20260721-01	7	10	Supplier shipment delay	Port congestion delayed vessel arrival by 3 days	Mandeep Siwach	2026-07-21 13:16:34.705252	TEST
82e64c39-5263-417c-b871-8165f140b30d	a8af67a0-02e1-4f4e-8ef4-92f7b43a9c9c	PO-PUR-20260721-01	10	12	Customs / Freight clearance delay	Customs documentation inspection added 2 extra days	Mandeep Siwach	2026-07-21 13:16:34.705252	TEST
1bcb4e12-9b4f-45f6-bb13-0c0973e90d6a	a8af67a0-02e1-4f4e-8ef4-92f7b43a9c9c	PO-PUR-20260721-01	12	15	Expedited priority production	Raw material supplier delayed delivery by 3 additional days due to blizzard.	Purchaser	2026-07-21 13:17:07.241714	TEST
3ca3f203-d723-4988-84cb-a17c2ffa24c0	4f4a16e5-9502-4b92-9151-bd0e5ea5b7f7	PO-PUR-20260721-01	7	10	Supplier shipment delay	Port congestion delayed vessel arrival by 3 days	Mandeep Siwach	2026-07-21 13:44:40.198925	TEST
2fb8d73d-4f02-4c2d-8b87-62b335cf8834	4f4a16e5-9502-4b92-9151-bd0e5ea5b7f7	PO-PUR-20260721-01	10	12	Customs / Freight clearance delay	Customs documentation inspection added 2 extra days	Mandeep Siwach	2026-07-21 13:44:40.198925	TEST
d211fd6f-6aec-491e-8391-1fe0be48d846	d5fa20b3-5d6b-41ca-a73d-159350984bbf	PO-PUR-20260721-01	7	10	Supplier shipment delay	Port congestion delayed vessel arrival by 3 days	Mandeep Siwach	2026-07-21 13:45:25.792837	TEST
c4bd5c6b-d0ee-46cd-aec4-97a0e4feda64	d5fa20b3-5d6b-41ca-a73d-159350984bbf	PO-PUR-20260721-01	10	12	Customs / Freight clearance delay	Customs documentation inspection added 2 extra days	Mandeep Siwach	2026-07-21 13:45:25.792837	TEST
57661d5c-fad0-480e-a866-e41e84aec555	e391f9a1-4261-4f43-9156-f65af8f6f2b9	PO-PUR-20260721-01	7	10	Supplier shipment delay	Port congestion delayed vessel arrival by 3 days	Mandeep Siwach	2026-07-21 14:11:53.835954	TEST
5cafc293-26a9-4089-9538-a465887dd50d	e391f9a1-4261-4f43-9156-f65af8f6f2b9	PO-PUR-20260721-01	10	12	Customs / Freight clearance delay	Customs documentation inspection added 2 extra days	Mandeep Siwach	2026-07-21 14:11:53.835954	TEST
0690fef0-e82d-41a6-a8dd-28153b3f24fa	7d906088-6336-4a36-bbeb-1c3d718cbbd0	PO-PUR-20260721-01	7	10	Supplier shipment delay	Port congestion delayed vessel arrival by 3 days	Mandeep Siwach	2026-07-21 14:23:54.669183	TEST
4320af74-418f-4359-927e-ff7eb2150f00	7d906088-6336-4a36-bbeb-1c3d718cbbd0	PO-PUR-20260721-01	10	12	Customs / Freight clearance delay	Customs documentation inspection added 2 extra days	Mandeep Siwach	2026-07-21 14:23:54.669183	TEST
\.


--
-- Data for Name: purchase_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_orders (id, po_no, req_no, supplier_code, supplier_name, part_or_rm_code, item_description, order_qty, unit_price, total_amount, lead_time_days, promised_delivery_date, lead_time_change_count, status, remarks, is_deleted, tenant_id, created_at, updated_at) FROM stdin;
a8af67a0-02e1-4f4e-8ef4-92f7b43a9c9c	PO-PUR-20260721-01	REQ-20260721-01	SUP-101	Tata Steel Industrial Solutions	RM-STEEL-316L	Forged Alloy Steel Bar 316L	50.0000	180.0000	9000.0000	15	2026-08-05	3	released	Revised LT (15d): Raw material supplier delayed delivery by 3 additional days due to blizzard.	f	TEST	2026-07-21 13:16:34.703386	2026-07-21 13:17:07.241714
4f4a16e5-9502-4b92-9151-bd0e5ea5b7f7	PO-PUR-20260721-01	REQ-20260721-01	SUP-101	Tata Steel Industrial Solutions	RM-STEEL-316L	Forged Alloy Steel Bar 316L	50.0000	180.0000	9000.0000	12	2026-08-02	2	released	Revised LT (12d): Supplier shipment delay due to freight logistics	f	TEST	2026-07-21 13:44:40.197588	2026-07-21 13:44:40.197588
d5fa20b3-5d6b-41ca-a73d-159350984bbf	PO-PUR-20260721-01	REQ-20260721-01	SUP-101	Tata Steel Industrial Solutions	RM-STEEL-316L	Forged Alloy Steel Bar 316L	50.0000	180.0000	9000.0000	12	2026-08-02	2	released	Revised LT (12d): Supplier shipment delay due to freight logistics	f	TEST	2026-07-21 13:45:25.791381	2026-07-21 13:45:25.791381
e391f9a1-4261-4f43-9156-f65af8f6f2b9	PO-PUR-20260721-01	REQ-20260721-01	SUP-101	Tata Steel Industrial Solutions	RM-STEEL-316L	Forged Alloy Steel Bar 316L	50.0000	180.0000	9000.0000	12	2026-08-02	2	released	Revised LT (12d): Supplier shipment delay due to freight logistics	f	TEST	2026-07-21 14:11:53.833086	2026-07-21 14:11:53.833086
7d906088-6336-4a36-bbeb-1c3d718cbbd0	PO-PUR-20260721-01	REQ-20260721-01	SUP-101	Tata Steel Industrial Solutions	RM-STEEL-316L	Forged Alloy Steel Bar 316L	50.0000	180.0000	9000.0000	12	2026-08-02	2	released	Revised LT (12d): Supplier shipment delay due to freight logistics	f	TEST	2026-07-21 14:23:54.666685	2026-07-21 14:23:54.666685
\.


--
-- Data for Name: purchase_requisitions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_requisitions (id, req_no, demand_no, part_or_rm_code, item_description, required_qty, supplier_code, supplier_name, unit_price, moq, sqp, total_amount, requested_by, status, notes, is_deleted, tenant_id, created_at, updated_at) FROM stdin;
257a5fd0-751e-4adc-bba8-ed30769ccdac	REQ-20260721-01	DEM-20260721-01	RM-STEEL-316L	Forged Alloy Steel Bar 316L	50.0000	SUP-101	Tata Steel Industrial Solutions	180.0000	50.0000	10.0000	9000.0000	Purchaser	converted_to_po	Shortage purchase requisition	f	TEST	2026-07-21 13:16:34.701717	2026-07-21 13:16:34.701717
d5d285ba-aa27-497c-a488-784755d54db7	REQ-20260721-01	DEM-20260721-01	RM-STEEL-316L	Forged Alloy Steel Bar 316L	50.0000	SUP-101	Tata Steel Industrial Solutions	180.0000	50.0000	10.0000	9000.0000	Purchaser	converted_to_po	Shortage purchase requisition	f	TEST	2026-07-21 13:44:40.196117	2026-07-21 13:44:40.196117
e21c23d3-347c-4fa2-a5ba-9e9250a5b586	REQ-20260721-01	DEM-20260721-01	RM-STEEL-316L	Forged Alloy Steel Bar 316L	50.0000	SUP-101	Tata Steel Industrial Solutions	180.0000	50.0000	10.0000	9000.0000	Purchaser	converted_to_po	Shortage purchase requisition	f	TEST	2026-07-21 13:45:25.789613	2026-07-21 13:45:25.789613
9ac7ab1d-a914-4e29-842a-5fbb5e14a6c2	REQ-20260721-01	DEM-20260721-01	RM-STEEL-316L	Forged Alloy Steel Bar 316L	50.0000	SUP-101	Tata Steel Industrial Solutions	180.0000	50.0000	10.0000	9000.0000	Purchaser	converted_to_po	Shortage purchase requisition	f	TEST	2026-07-21 14:11:53.829981	2026-07-21 14:11:53.829981
670f7c97-6ab8-4c2f-b014-6549f28084b4	REQ-20260721-01	DEM-20260721-01	RM-STEEL-316L	Forged Alloy Steel Bar 316L	50.0000	SUP-101	Tata Steel Industrial Solutions	180.0000	50.0000	10.0000	9000.0000	Purchaser	converted_to_po	Shortage purchase requisition	f	TEST	2026-07-21 14:23:54.663233	2026-07-21 14:23:54.663233
\.


--
-- Data for Name: purchase_supplier_quotations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_supplier_quotations (id, part_or_rm_code, supplier_code, supplier_name, unit_price, lead_time_days, min_order_qty, sop_price, sqp_pack, is_active, is_deleted, tenant_id, created_at) FROM stdin;
8a3e4306-8657-489e-8537-0657dbde5f9d	RM-STEEL-316L	SUP-101	Tata Steel Industrial Solutions	180.0000	7	50.0000	180.0000	10.0000	t	f	TEST	2026-07-21 13:16:34.699719
9bedad3f-e14c-4353-88f3-f35ed0dbc389	601-0-000001	SUP-102	Jindal Precision Castings Ltd	450.0000	10	20.0000	450.0000	5.0000	t	f	TEST	2026-07-21 13:16:34.699719
04467f52-f579-4068-b2a5-a2bee0030f8d	RM-STEEL-316L	SUP-101	Tata Steel Industrial Solutions	180.0000	7	50.0000	180.0000	10.0000	t	f	TEST	2026-07-21 13:44:40.194364
d965d5a5-aed8-4873-9401-c50c81636639	601-0-000001	SUP-102	Jindal Precision Castings Ltd	450.0000	10	20.0000	450.0000	5.0000	t	f	TEST	2026-07-21 13:44:40.194364
5a3f4e46-014c-4186-9745-9178e8b31f83	RM-STEEL-316L	SUP-101	Tata Steel Industrial Solutions	180.0000	7	50.0000	180.0000	10.0000	t	f	TEST	2026-07-21 13:45:25.787613
61c1cf52-d8de-4c60-ae2b-9d9a904b3b21	601-0-000001	SUP-102	Jindal Precision Castings Ltd	450.0000	10	20.0000	450.0000	5.0000	t	f	TEST	2026-07-21 13:45:25.787613
378508da-3d24-44cb-8828-7db7eaf4de37	RM-STEEL-316L	SUP-101	Tata Steel Industrial Solutions	180.0000	7	50.0000	180.0000	10.0000	t	f	TEST	2026-07-21 14:11:53.825362
1b8b3118-2f0a-4e15-88ab-065717343e68	601-0-000001	SUP-102	Jindal Precision Castings Ltd	450.0000	10	20.0000	450.0000	5.0000	t	f	TEST	2026-07-21 14:11:53.825362
e9226e4f-0103-4c13-9999-c2b64b16d313	RM-STEEL-316L	SUP-101	Tata Steel Industrial Solutions	180.0000	7	50.0000	180.0000	10.0000	t	f	TEST	2026-07-21 14:23:54.660084
7b4dd631-bd9e-464f-8b05-01377137f1dd	601-0-000001	SUP-102	Jindal Precision Castings Ltd	450.0000	10	20.0000	450.0000	5.0000	t	f	TEST	2026-07-21 14:23:54.660084
\.


--
-- Data for Name: quality_iqc_criteria; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quality_iqc_criteria (id, part_or_rm_code, criterion_name, spec_target, tolerance_min, tolerance_max, inspection_method, is_mandatory, is_deleted, tenant_id, created_at) FROM stdin;
150df1ed-0ea7-4ac6-8873-7b57913daca6	RM-STEEL-316L	Bar Outer Diameter (OD)	50.0 mm	49.95 mm	50.05 mm	Digital Vernier Caliper	t	f	TEST	2026-07-21 14:23:54.747916
9d863067-d043-4930-8c67-1a0fe4cefade	RM-STEEL-316L	Material Hardness Test	60 HRC	58 HRC	62 HRC	Rockwell Hardness Tester	t	f	TEST	2026-07-21 14:23:54.747916
1cd20932-f09f-48e5-9cfa-1ec0fa98e32a	601-0-000001	Journal Surface Roughness	Ra 0.4 µm	Ra 0.2 µm	Ra 0.6 µm	Surface Roughness Tester	t	f	TEST	2026-07-21 14:23:54.747916
\.


--
-- Data for Name: quality_ncrs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quality_ncrs (id, ncr_no, checkin_no, part_or_rm_code, supplier_name, rejected_qty, defect_type, severity, root_cause, corrective_action, disposition, status, raised_by, is_deleted, tenant_id, created_at) FROM stdin;
0f6f11e5-85f5-4e77-a0f5-deb079d757c1	NCR-20260721-01	CHK-20260721-01	RM-STEEL-316L	Tata Steel Industrial Solutions	2.0000	Surface Pit Defect & OD Undersize	Major	Inadequate cooling bath during bar drawing operation at supplier mill	Supplier CAPA requested; replace 2 bars	Return to Vendor (RTV)	open	Vikram Singh (EMP-1005)	f	TEST	2026-07-21 14:23:54.752136
\.


--
-- Data for Name: super_admins; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.super_admins (id, email, password_hash, name, phone, is_active, last_login, created_at) FROM stdin;
5e0b7eb0-96a4-4506-89c5-c03a98ab1b3a	admin@supersystems.in	$2b$12$hGTMp8bnQq7MpC1WB3OJHecvU6RgHFoCrDKCeKaJpgUJLrZBT1WH.	Super Admin	\N	t	2026-07-09 05:13:56.330143	2026-07-08 17:22:14.49786
d0f6ebe0-a7d2-46d1-8f2a-510c742945ec	mandeep@supersystems.in	$2b$12$UsV9U0RG8iOLHr2TD9hScOwlctH0xK98BwMLGkiodhm/70BILOo.i	Mandeep	\N	t	2026-07-20 10:17:34.500745	2026-07-18 14:08:45.696241
\.


--
-- Data for Name: warehouse_bin_scans; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.warehouse_bin_scans (id, bin_code, warehouse_code, scan_action, part_number, qty, performer_name, scan_time, remarks, tenant_id) FROM stdin;
319c5148-2f88-4c6e-adc3-23e8dda898c4	RM-A-01	MAIN	add	RM-STEEL-316L	50.0000	Sunil Verma (EMP-1003)	2026-07-21 14:11:53.756401	Scanned bin QR code and added 50 kg raw material	TEST
ace3cb5e-a1fd-49ed-8cfe-e01e95ef30fb	QUARANTINE	QC-WH	allot	601-0-000001-88	2.0000	Vikram Singh (EMP-1005)	2026-07-21 14:11:53.756401	Allotted 2 NG units to Quarantine bin	TEST
719aeca9-0d0b-47b7-a071-7de14dea9cb2	RM-A-01	MAIN	add	RM-STEEL-316L	50.0000	Sunil Verma (EMP-1003)	2026-07-21 14:23:54.606119	Scanned bin QR code and added 50 kg raw material	TEST
c7f433f9-8f72-4443-bd08-f11d493a4ed0	QUARANTINE	QC-WH	allot	601-0-000001-88	2.0000	Vikram Singh (EMP-1005)	2026-07-21 14:23:54.606119	Allotted 2 NG units to Quarantine bin	TEST
\.


--
-- Data for Name: warehouse_bins; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.warehouse_bins (id, bin_code, zone_code, warehouse_code, aisle, rack, level, capacity_units, current_units, status, qr_data, is_deleted, tenant_id, created_at, updated_at) FROM stdin;
869e3102-1d97-49ec-9d3c-1eeba09e0e70	A-01-01	Z1	MAIN	A	01	01	500	0	active	/warehouse/bin/A-01-01	f	TEST	2026-07-21 12:05:01.35303	2026-07-21 12:05:01.35303
340c42fb-901b-43a2-aa79-65991aa55531	A-01-01	Z1	MAIN	A	01	01	500	0	active	/warehouse/bin/A-01-01	f	TEST	2026-07-21 12:05:19.115358	2026-07-21 12:05:19.115358
bin-rm-01	RM-A-01	Z-RM	MAIN	A	01	01	500	50	active	/warehouse/bin/RM-A-01	f	TEST	2026-07-21 12:09:15.686449	2026-07-21 12:09:15.686449
bin-wip-02	WIP-B-02	Z-WIP	MAIN	B	02	01	300	20	active	/warehouse/bin/WIP-B-02	f	TEST	2026-07-21 12:09:15.687515	2026-07-21 12:09:15.687515
bin-fg-01	FG-A-01	Z-FG	FG-WH	A	01	01	1000	50	active	/warehouse/bin/FG-A-01	f	TEST	2026-07-21 12:09:15.687944	2026-07-21 12:09:15.687944
bin-qc-01	QUARANTINE	Z-QC	QC-WH	Q	01	01	200	4	active	/warehouse/bin/QUARANTINE	f	TEST	2026-07-21 12:09:15.688337	2026-07-21 12:09:15.688337
d15bb72b-2804-4e8a-8856-4c74d896d364	RM-A-01	Z-RM	MAIN	A	01	01	500	50	active	/warehouse/bin/RM-A-01	f	TEST	2026-07-21 12:09:54.63115	2026-07-21 12:09:54.63115
253095ec-b4a0-41f1-94b3-e79f18b4b3f1	WIP-B-02	Z-WIP	MAIN	B	02	01	300	20	active	/warehouse/bin/WIP-B-02	f	TEST	2026-07-21 12:09:54.63251	2026-07-21 12:09:54.63251
ba3550d2-9e8a-4e2a-b6d2-6595b9891133	FG-A-01	Z-FG	FG-WH	A	01	01	1000	50	active	/warehouse/bin/FG-A-01	f	TEST	2026-07-21 12:09:54.633082	2026-07-21 12:09:54.633082
b975d7d4-0856-4810-bf1e-210a675b0c49	QUARANTINE	Z-QC	QC-WH	Q	01	01	200	4	active	/warehouse/bin/QUARANTINE	f	TEST	2026-07-21 12:09:54.633627	2026-07-21 12:09:54.633627
a5f9fcf7-7fd6-482f-b822-ca3fa4369ad7	RM-A-01	Z-RM	MAIN	A	01	01	500	50	active	/warehouse/bin/RM-A-01	f	TEST	2026-07-21 12:16:37.850124	2026-07-21 12:16:37.850124
c65bf02f-1eee-40ac-968d-ade466d1bc6b	WIP-B-02	Z-WIP	MAIN	B	02	01	300	20	active	/warehouse/bin/WIP-B-02	f	TEST	2026-07-21 12:16:37.851439	2026-07-21 12:16:37.851439
46b0525f-32c5-47ea-ae41-9bb3a9b13c8c	FG-A-01	Z-FG	FG-WH	A	01	01	1000	50	active	/warehouse/bin/FG-A-01	f	TEST	2026-07-21 12:16:37.852034	2026-07-21 12:16:37.852034
05e7bf06-4995-4bd7-be1f-b2dd4bb08832	QUARANTINE	Z-QC	QC-WH	Q	01	01	200	4	active	/warehouse/bin/QUARANTINE	f	TEST	2026-07-21 12:16:37.852492	2026-07-21 12:16:37.852492
d368c306-8815-411d-ab4f-ca9050f546a3	RM-A-01	Z-RM	MAIN	A	01	01	500	50	active	/warehouse/bin/RM-A-01	f	TEST	2026-07-21 13:16:34.585306	2026-07-21 13:16:34.585306
eb2a6b53-1178-4a27-9d56-80ae7649d985	WIP-B-02	Z-WIP	MAIN	B	02	01	300	20	active	/warehouse/bin/WIP-B-02	f	TEST	2026-07-21 13:16:34.586413	2026-07-21 13:16:34.586413
1ce1c2d2-a2b8-4537-bd07-6b2b57b8caf8	FG-A-01	Z-FG	FG-WH	A	01	01	1000	50	active	/warehouse/bin/FG-A-01	f	TEST	2026-07-21 13:16:34.586909	2026-07-21 13:16:34.586909
7a013e35-bfe0-49d0-8832-9c619b58cfaf	QUARANTINE	Z-QC	QC-WH	Q	01	01	200	4	active	/warehouse/bin/QUARANTINE	f	TEST	2026-07-21 13:16:34.587374	2026-07-21 13:16:34.587374
e07e7709-cdea-4c02-a7d0-428deb2132db	RM-A-01	Z-RM	MAIN	A	01	01	500	50	active	/warehouse/bin/RM-A-01	f	TEST	2026-07-21 13:44:40.173136	2026-07-21 13:44:40.173136
07eb4cf2-7b69-418a-aaa3-2a77a857bd69	WIP-B-02	Z-WIP	MAIN	B	02	01	300	20	active	/warehouse/bin/WIP-B-02	f	TEST	2026-07-21 13:44:40.174667	2026-07-21 13:44:40.174667
04bdbff6-7a4a-4cc8-8f4a-b3da3f4934ca	FG-A-01	Z-FG	FG-WH	A	01	01	1000	50	active	/warehouse/bin/FG-A-01	f	TEST	2026-07-21 13:44:40.175205	2026-07-21 13:44:40.175205
f9cb0156-553d-4949-a4e3-c52dacbf292f	QUARANTINE	Z-QC	QC-WH	Q	01	01	200	4	active	/warehouse/bin/QUARANTINE	f	TEST	2026-07-21 13:44:40.176229	2026-07-21 13:44:40.176229
7a08f97f-726d-492f-8234-b2f77744adaf	RM-A-01	Z-RM	MAIN	A	01	01	500	50	active	/warehouse/bin/RM-A-01	f	TEST	2026-07-21 13:45:25.741778	2026-07-21 13:45:25.741778
cf232336-6e8f-46e6-a63a-186cdc1a37b6	WIP-B-02	Z-WIP	MAIN	B	02	01	300	20	active	/warehouse/bin/WIP-B-02	f	TEST	2026-07-21 13:45:25.744162	2026-07-21 13:45:25.744162
b3302c72-365c-41ba-abdf-4afa04381a64	FG-A-01	Z-FG	FG-WH	A	01	01	1000	50	active	/warehouse/bin/FG-A-01	f	TEST	2026-07-21 13:45:25.745578	2026-07-21 13:45:25.745578
00812bc8-dd7b-438f-a9e7-506a546bca43	QUARANTINE	Z-QC	QC-WH	Q	01	01	200	4	active	/warehouse/bin/QUARANTINE	f	TEST	2026-07-21 13:45:25.74666	2026-07-21 13:45:25.74666
f74843cc-d36a-4dae-8031-5ba43668569d	RM-A-01	Z-RM	MAIN	A	01	01	500	50	active	/warehouse/bin/RM-A-01	f	TEST	2026-07-21 14:11:53.772475	2026-07-21 14:11:53.772475
af0e1a3a-505d-49ed-a2fe-3a9eaeab2eec	WIP-B-02	Z-WIP	MAIN	B	02	01	300	20	active	/warehouse/bin/WIP-B-02	f	TEST	2026-07-21 14:11:53.776142	2026-07-21 14:11:53.776142
5e96d837-6aa5-4101-94ae-abec4dc66e8e	FG-A-01	Z-FG	FG-WH	A	01	01	1000	50	active	/warehouse/bin/FG-A-01	f	TEST	2026-07-21 14:11:53.777651	2026-07-21 14:11:53.777651
9a998afc-3934-4680-b941-0654519b0b3b	QUARANTINE	Z-QC	QC-WH	Q	01	01	200	4	active	/warehouse/bin/QUARANTINE	f	TEST	2026-07-21 14:11:53.778945	2026-07-21 14:11:53.778945
6350f4dd-a88e-448a-8bd5-ca5f24afacb1	RM-A-01	Z-RM	MAIN	A	01	01	500	50	active	/warehouse/bin/RM-A-01	f	TEST	2026-07-21 14:23:54.615247	2026-07-21 14:23:54.615247
88316b3b-9ad5-4ae6-bc77-3da45c4c52db	WIP-B-02	Z-WIP	MAIN	B	02	01	300	20	active	/warehouse/bin/WIP-B-02	f	TEST	2026-07-21 14:23:54.618734	2026-07-21 14:23:54.618734
52ee24bd-eadd-44dd-919f-ea6052c8e721	FG-A-01	Z-FG	FG-WH	A	01	01	1000	50	active	/warehouse/bin/FG-A-01	f	TEST	2026-07-21 14:23:54.619727	2026-07-21 14:23:54.619727
3890143f-069c-4dc6-aa1e-f0613d7c55cf	QUARANTINE	Z-QC	QC-WH	Q	01	01	200	4	active	/warehouse/bin/QUARANTINE	f	TEST	2026-07-21 14:23:54.620922	2026-07-21 14:23:54.620922
\.


--
-- Data for Name: warehouse_packing_lists; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.warehouse_packing_lists (id, packing_no, customer_ref, fg_part_number, qty, box_pallet_details, weight_kg, dimensions, status, is_deleted, tenant_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: warehouse_pick_list_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.warehouse_pick_list_items (id, pick_list_id, part_number, part_description, bin_code, qty_required, qty_picked, status, tenant_id, created_at) FROM stdin;
5dc8cba2-0f6f-4892-85e5-3d63913c4fb2	00737545-763c-4223-acd2-a669247951b2	601-0-000001-01	Raw component for FG	A-01-01	20.0000	0.0000	pending	TEST	2026-07-21 12:05:19.134093
pli-101	pkl-101	RM-STEEL-316L	Steel Alloy Bar 316L	RM-A-01	24.0000	24.0000	picked	TEST	2026-07-21 12:09:15.689894
e7487f03-eb36-4eca-b958-f1d705d49175	1ffd7ee6-4667-43b0-a8da-2bfef30ac2d9	RM-STEEL-316L	Steel Alloy Bar 316L	RM-A-01	24.0000	24.0000	picked	TEST	2026-07-21 12:09:54.635508
dfde654b-aaa4-4867-a4c5-178b2e2a6ac3	9d69732a-546f-4d17-beee-832329835bb3	RM-STEEL-316L	Steel Alloy Bar 316L	RM-A-01	24.0000	24.0000	picked	TEST	2026-07-21 12:16:37.854232
735ef40b-64ae-402b-8dc5-46d8b56b8619	b2e70c43-e1fa-4884-a3c3-b166fe7a597d	RM-STEEL-316L	Steel Alloy Bar 316L	RM-A-01	24.0000	24.0000	picked	TEST	2026-07-21 13:16:34.589309
eac19160-89ca-4037-815c-de5a4a309656	77e882d8-30a5-4430-b03a-9bbfc419e344	RM-STEEL-316L	Steel Alloy Bar 316L	RM-A-01	24.0000	24.0000	picked	TEST	2026-07-21 13:44:40.178805
544f0aec-b54b-46f2-adbb-daad3fa180b8	9bf2f73a-35a5-4af0-9ed5-1ae6a86ff1f6	RM-STEEL-316L	Steel Alloy Bar 316L	RM-A-01	24.0000	24.0000	picked	TEST	2026-07-21 13:45:25.749185
04dbbce8-e216-483b-bc8e-710640d05fd3	509fab90-a4fa-4b72-8d52-d281cbd3a06b	RM-STEEL-316L	Steel Alloy Bar 316L	RM-A-01	24.0000	24.0000	picked	TEST	2026-07-21 14:11:53.783564
2646611e-90b5-4d33-bef7-4a67bab55717	a5af23ca-f615-4465-aaa9-fc3709fb47d9	RM-STEEL-316L	Steel Alloy Bar 316L	RM-A-01	24.0000	24.0000	picked	TEST	2026-07-21 14:23:54.624766
\.


--
-- Data for Name: warehouse_pick_lists; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.warehouse_pick_lists (id, list_no, reference_type, reference_no, warehouse_code, assigned_to, due_date, status, notes, is_deleted, tenant_id, created_at, updated_at) FROM stdin;
00737545-763c-4223-acd2-a669247951b2	PKL-PRD-202607211205	PRODUCTION_ORDER	PRD-202607211205	MAIN	Shop Floor Team	\N	open	\N	f	TEST	2026-07-21 12:05:19.134093	2026-07-21 12:05:19.134093
pkl-101	PKL-PRD-20260721	PRODUCTION_ORDER	PRD-20260721-01	MAIN	Sunil Verma (EMP-1003)	2026-07-22	in_progress	\N	f	TEST	2026-07-21 12:09:15.68877	2026-07-21 12:09:15.68877
1ffd7ee6-4667-43b0-a8da-2bfef30ac2d9	PKL-PRD-20260721	PRODUCTION_ORDER	PRD-20260721-01	MAIN	Sunil Verma (EMP-1003)	2026-07-22	in_progress	\N	f	TEST	2026-07-21 12:09:54.634268	2026-07-21 12:09:54.634268
9d69732a-546f-4d17-beee-832329835bb3	PKL-PRD-20260721	PRODUCTION_ORDER	PRD-20260721-01	MAIN	Sunil Verma (EMP-1003)	2026-07-22	in_progress	\N	f	TEST	2026-07-21 12:16:37.853052	2026-07-21 12:16:37.853052
b2e70c43-e1fa-4884-a3c3-b166fe7a597d	PKL-PRD-20260721	PRODUCTION_ORDER	PRD-20260721-01	MAIN	Sunil Verma (EMP-1003)	2026-07-22	in_progress	\N	f	TEST	2026-07-21 13:16:34.588097	2026-07-21 13:16:34.588097
77e882d8-30a5-4430-b03a-9bbfc419e344	PKL-PRD-20260721	PRODUCTION_ORDER	PRD-20260721-01	MAIN	Sunil Verma (EMP-1003)	2026-07-22	in_progress	\N	f	TEST	2026-07-21 13:44:40.177235	2026-07-21 13:44:40.177235
9bf2f73a-35a5-4af0-9ed5-1ae6a86ff1f6	PKL-PRD-20260721	PRODUCTION_ORDER	PRD-20260721-01	MAIN	Sunil Verma (EMP-1003)	2026-07-22	in_progress	\N	f	TEST	2026-07-21 13:45:25.747619	2026-07-21 13:45:25.747619
509fab90-a4fa-4b72-8d52-d281cbd3a06b	PKL-PRD-20260721	PRODUCTION_ORDER	PRD-20260721-01	MAIN	Sunil Verma (EMP-1003)	2026-07-22	in_progress	\N	f	TEST	2026-07-21 14:11:53.780683	2026-07-21 14:11:53.780683
a5af23ca-f615-4465-aaa9-fc3709fb47d9	PKL-PRD-20260721	PRODUCTION_ORDER	PRD-20260721-01	MAIN	Sunil Verma (EMP-1003)	2026-07-22	in_progress	\N	f	TEST	2026-07-21 14:23:54.621952	2026-07-21 14:23:54.621952
\.


--
-- Data for Name: warehouse_putaway_tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.warehouse_putaway_tasks (id, task_no, receipt_ref, part_number, part_description, qty, suggested_bin, actual_bin, warehouse_code, status, performed_by, is_deleted, tenant_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: warehouse_receipt_lines; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.warehouse_receipt_lines (id, receipt_id, part_number, part_description, ordered_qty, received_qty, accepted_qty, rejected_qty, bin_code, qc_status, tenant_id, created_at) FROM stdin;
\.


--
-- Data for Name: warehouse_receipts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.warehouse_receipts (id, receipt_no, po_number, supplier_name, warehouse_code, receipt_date, status, notes, is_deleted, tenant_id, created_at, updated_at) FROM stdin;
rec-101	REC-20260721-01	PO-2026-001	Tata Steel Industrial Solutions	MAIN	2026-07-21	received	\N	f	TEST	2026-07-21 12:09:15.69173	2026-07-21 12:09:15.69173
27bbe628-5616-4e31-a99f-1f3322e3318e	REC-20260721-01	PO-2026-001	Tata Steel Industrial Solutions	MAIN	2026-07-21	received	\N	f	TEST	2026-07-21 12:09:54.636572	2026-07-21 12:09:54.636572
e5e27281-65f4-4a95-9edb-1f7dfc24b579	REC-20260721-01	PO-2026-001	Tata Steel Industrial Solutions	MAIN	2026-07-21	received	\N	f	TEST	2026-07-21 12:16:37.855284	2026-07-21 12:16:37.855284
52e5a700-5dd2-4c77-ab3d-4e208fe467fa	REC-20260721-01	PO-2026-001	Tata Steel Industrial Solutions	MAIN	2026-07-21	received	\N	f	TEST	2026-07-21 13:16:34.591028	2026-07-21 13:16:34.591028
c85adce3-38e9-4f69-bf49-8cb4d6eea74b	REC-20260721-01	PO-2026-001	Tata Steel Industrial Solutions	MAIN	2026-07-21	received	\N	f	TEST	2026-07-21 13:44:40.180091	2026-07-21 13:44:40.180091
3ea37b82-4163-4ae9-8442-e6e5cd8b832d	REC-20260721-01	PO-2026-001	Tata Steel Industrial Solutions	MAIN	2026-07-21	received	\N	f	TEST	2026-07-21 13:45:25.750192	2026-07-21 13:45:25.750192
c4d88304-bc5e-4821-9989-7e7ed360d2c9	REC-20260721-01	PO-2026-001	Tata Steel Industrial Solutions	MAIN	2026-07-21	received	\N	f	TEST	2026-07-21 14:11:53.786487	2026-07-21 14:11:53.786487
b801c578-e6bf-4e2b-8777-8de650c24bd8	REC-20260721-01	PO-2026-001	Tata Steel Industrial Solutions	MAIN	2026-07-21	received	\N	f	TEST	2026-07-21 14:23:54.62788	2026-07-21 14:23:54.62788
\.


--
-- Data for Name: warehouse_shipment_lines; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.warehouse_shipment_lines (id, shipment_id, part_number, part_description, qty, bin_code, tenant_id, created_at) FROM stdin;
\.


--
-- Data for Name: warehouse_shipments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.warehouse_shipments (id, shipment_no, customer_name, delivery_address, warehouse_code, dispatch_date, carrier, tracking_no, status, notes, is_deleted, tenant_id, created_at, updated_at) FROM stdin;
shp-101	SHP-2026-001	Bosch Motor Works India	Plot 45, Auto Hub, Pune	FG-WH	2026-07-21	BlueDart Logistics	TRK-BLUE-998877	dispatched	\N	f	TEST	2026-07-21 12:09:15.693864	2026-07-21 12:09:15.693864
a14287e5-9502-4619-baed-ab9d68e9d8ce	SHP-2026-001	Bosch Motor Works India	Plot 45, Auto Hub, Pune	FG-WH	2026-07-21	BlueDart Logistics	TRK-BLUE-998877	dispatched	\N	f	TEST	2026-07-21 12:09:54.638025	2026-07-21 12:09:54.638025
fd14e168-48a9-4f8d-b840-8a4c623ee61e	SHP-2026-001	Bosch Motor Works India	Plot 45, Auto Hub, Pune	FG-WH	2026-07-21	BlueDart Logistics	TRK-BLUE-998877	dispatched	\N	f	TEST	2026-07-21 12:16:37.856253	2026-07-21 12:16:37.856253
e2442d58-0c34-4ae6-9d85-261d4795bd48	SHP-2026-001	Bosch Motor Works India	Plot 45, Auto Hub, Pune	FG-WH	2026-07-21	BlueDart Logistics	TRK-BLUE-998877	dispatched	\N	f	TEST	2026-07-21 13:16:34.592807	2026-07-21 13:16:34.592807
6267f401-3c66-4386-9488-74ff1ff4b021	SHP-2026-001	Bosch Motor Works India	Plot 45, Auto Hub, Pune	FG-WH	2026-07-21	BlueDart Logistics	TRK-BLUE-998877	dispatched	\N	f	TEST	2026-07-21 13:44:40.181395	2026-07-21 13:44:40.181395
052c2032-23ec-4637-a13d-a25b3f3dc5f9	SHP-2026-001	Bosch Motor Works India	Plot 45, Auto Hub, Pune	FG-WH	2026-07-21	BlueDart Logistics	TRK-BLUE-998877	dispatched	\N	f	TEST	2026-07-21 13:45:25.751178	2026-07-21 13:45:25.751178
d9c1a685-33b2-4bd0-98c6-7eb4c15f42c2	SHP-2026-001	Bosch Motor Works India	Plot 45, Auto Hub, Pune	FG-WH	2026-07-21	BlueDart Logistics	TRK-BLUE-998877	dispatched	\N	f	TEST	2026-07-21 14:11:53.7887	2026-07-21 14:11:53.7887
2a57a858-0d6e-4b7d-80c6-e298d1f4cf8f	SHP-2026-001	Bosch Motor Works India	Plot 45, Auto Hub, Pune	FG-WH	2026-07-21	BlueDart Logistics	TRK-BLUE-998877	dispatched	\N	f	TEST	2026-07-21 14:23:54.630515	2026-07-21 14:23:54.630515
\.


--
-- Data for Name: warehouse_zones; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.warehouse_zones (id, zone_code, name, zone_type, warehouse_code, capacity_units, description, is_active, is_deleted, tenant_id, created_at, updated_at) FROM stdin;
z-rm	Z-RM	Raw Material Staging Zone	RM	MAIN	1000	\N	t	f	TEST	2026-07-21 12:09:15.683318	2026-07-21 12:09:15.683318
z-wip	Z-WIP	Work In Progress Assembly Zone	WIP	MAIN	500	\N	t	f	TEST	2026-07-21 12:09:15.68485	2026-07-21 12:09:15.68485
z-fg	Z-FG	Finished Goods High Bay Rack Zone	FG	FG-WH	2000	\N	t	f	TEST	2026-07-21 12:09:15.685541	2026-07-21 12:09:15.685541
z-qc	Z-QC	Quality Holding Quarantine Zone	QC	QC-WH	300	\N	t	f	TEST	2026-07-21 12:09:15.68597	2026-07-21 12:09:15.68597
6173d2c8-144e-4cbe-88ac-3754aeb0e2c8	Z-RM	Raw Material Staging Zone	RM	MAIN	1000	\N	t	f	TEST	2026-07-21 12:09:54.626319	2026-07-21 12:09:54.626319
136d7e10-dd72-4c7f-8de1-ad9ec3723e8a	Z-WIP	Work In Progress Assembly Zone	WIP	MAIN	500	\N	t	f	TEST	2026-07-21 12:09:54.628222	2026-07-21 12:09:54.628222
da65c3c6-1f66-401e-87dd-1b6b4be870cf	Z-FG	Finished Goods High Bay Rack Zone	FG	FG-WH	2000	\N	t	f	TEST	2026-07-21 12:09:54.62932	2026-07-21 12:09:54.62932
a0d73abe-3a0a-4ba4-aa20-573b053512e8	Z-QC	Quality Holding Quarantine Zone	QC	QC-WH	300	\N	t	f	TEST	2026-07-21 12:09:54.630151	2026-07-21 12:09:54.630151
5540cbd4-e479-4cf1-9bd7-6435fb411591	Z-RM	Raw Material Staging Zone	RM	MAIN	1000	\N	t	f	TEST	2026-07-21 12:16:37.846782	2026-07-21 12:16:37.846782
5891dfbf-846e-47b3-9425-17cb15757c89	Z-WIP	Work In Progress Assembly Zone	WIP	MAIN	500	\N	t	f	TEST	2026-07-21 12:16:37.848368	2026-07-21 12:16:37.848368
c64748f1-bce4-4f90-a15c-996722471ee1	Z-FG	Finished Goods High Bay Rack Zone	FG	FG-WH	2000	\N	t	f	TEST	2026-07-21 12:16:37.848898	2026-07-21 12:16:37.848898
21900e8a-21d3-4b87-b31c-10c653ae1de9	Z-QC	Quality Holding Quarantine Zone	QC	QC-WH	300	\N	t	f	TEST	2026-07-21 12:16:37.849485	2026-07-21 12:16:37.849485
099e13ca-404e-4fe4-af04-0a677aa4ee18	Z-RM	Raw Material Staging Zone	RM	MAIN	1000	\N	t	f	TEST	2026-07-21 13:16:34.582681	2026-07-21 13:16:34.582681
047a3d4d-722e-4ed5-8f2e-3abd4cffd6dd	Z-WIP	Work In Progress Assembly Zone	WIP	MAIN	500	\N	t	f	TEST	2026-07-21 13:16:34.583904	2026-07-21 13:16:34.583904
b5f7ed6b-324a-49f7-9447-fa1ded6ceeb2	Z-FG	Finished Goods High Bay Rack Zone	FG	FG-WH	2000	\N	t	f	TEST	2026-07-21 13:16:34.58438	2026-07-21 13:16:34.58438
fb752846-1caf-48c5-bd1d-5a057896856c	Z-QC	Quality Holding Quarantine Zone	QC	QC-WH	300	\N	t	f	TEST	2026-07-21 13:16:34.584796	2026-07-21 13:16:34.584796
d3e0d2bf-b4aa-48fb-83e2-4c419e6fc522	Z-RM	Raw Material Staging Zone	RM	MAIN	1000	\N	t	f	TEST	2026-07-21 13:44:40.16993	2026-07-21 13:44:40.16993
715cd0a8-c0f6-4f13-9838-e36ab41285c1	Z-WIP	Work In Progress Assembly Zone	WIP	MAIN	500	\N	t	f	TEST	2026-07-21 13:44:40.171641	2026-07-21 13:44:40.171641
f9232e2e-41c3-4625-ac8a-97e00a8980b0	Z-FG	Finished Goods High Bay Rack Zone	FG	FG-WH	2000	\N	t	f	TEST	2026-07-21 13:44:40.172201	2026-07-21 13:44:40.172201
69d4d8e4-7829-4d81-a696-c794d24944f5	Z-QC	Quality Holding Quarantine Zone	QC	QC-WH	300	\N	t	f	TEST	2026-07-21 13:44:40.172614	2026-07-21 13:44:40.172614
beeb7535-cbe6-45f5-815d-edb823bdb0d4	Z-RM	Raw Material Staging Zone	RM	MAIN	1000	\N	t	f	TEST	2026-07-21 13:45:25.738617	2026-07-21 13:45:25.738617
870ba948-e459-4690-a054-e56af2499d69	Z-WIP	Work In Progress Assembly Zone	WIP	MAIN	500	\N	t	f	TEST	2026-07-21 13:45:25.739924	2026-07-21 13:45:25.739924
19cbbb04-3276-426e-87af-62d5d8b2dc3c	Z-FG	Finished Goods High Bay Rack Zone	FG	FG-WH	2000	\N	t	f	TEST	2026-07-21 13:45:25.740527	2026-07-21 13:45:25.740527
5fbfac68-e6da-455b-a756-2253c265064d	Z-QC	Quality Holding Quarantine Zone	QC	QC-WH	300	\N	t	f	TEST	2026-07-21 13:45:25.741087	2026-07-21 13:45:25.741087
f9a6dc0e-16a8-4e96-9ff0-9c4e63fd9194	Z-RM	Raw Material Staging Zone	RM	MAIN	1000	\N	t	f	TEST	2026-07-21 14:11:53.762514	2026-07-21 14:11:53.762514
1318465d-9c2d-4ad4-9d5d-e39812b7685a	Z-WIP	Work In Progress Assembly Zone	WIP	MAIN	500	\N	t	f	TEST	2026-07-21 14:11:53.766544	2026-07-21 14:11:53.766544
de58a7b6-4664-44d2-8546-290ee0e3b09f	Z-FG	Finished Goods High Bay Rack Zone	FG	FG-WH	2000	\N	t	f	TEST	2026-07-21 14:11:53.768803	2026-07-21 14:11:53.768803
9ea26758-62af-4cb0-bfb6-7e0679b45aeb	Z-QC	Quality Holding Quarantine Zone	QC	QC-WH	300	\N	t	f	TEST	2026-07-21 14:11:53.770409	2026-07-21 14:11:53.770409
1cc5ff33-f869-4435-86e0-7d13cbda8969	Z-RM	Raw Material Staging Zone	RM	MAIN	1000	\N	t	f	TEST	2026-07-21 14:23:54.60836	2026-07-21 14:23:54.60836
3cd17c2e-fb41-4ab7-b1c7-673668a0200b	Z-WIP	Work In Progress Assembly Zone	WIP	MAIN	500	\N	t	f	TEST	2026-07-21 14:23:54.612043	2026-07-21 14:23:54.612043
b3f0c1dd-4e11-4636-92f8-6e8055f82d7d	Z-FG	Finished Goods High Bay Rack Zone	FG	FG-WH	2000	\N	t	f	TEST	2026-07-21 14:23:54.613259	2026-07-21 14:23:54.613259
3faa3f05-6336-4207-8547-31440c27cd3c	Z-QC	Quality Holding Quarantine Zone	QC	QC-WH	300	\N	t	f	TEST	2026-07-21 14:23:54.614061	2026-07-21 14:23:54.614061
\.


--
-- Data for Name: inspections; Type: TABLE DATA; Schema: quality; Owner: postgres
--

COPY quality.inspections (id, doc_no, date, type, reference_type, reference_id, item_id, qty_inspected, qty_accepted, qty_rejected, status, inspector_id, parameters, remarks, tenant_id, is_deleted, version, created_at, updated_at, created_by) FROM stdin;
\.


--
-- Data for Name: ncr; Type: TABLE DATA; Schema: quality; Owner: postgres
--

COPY quality.ncr (id, doc_no, date, type, source, item_id, description, root_cause, corrective_action, status, severity, assigned_to, closed_at, tenant_id, is_deleted, version, created_at, updated_at, created_by) FROM stdin;
\.


--
-- Data for Name: rm_criteria; Type: TABLE DATA; Schema: rawmaterial; Owner: postgres
--

COPY rawmaterial.rm_criteria (id, material_category, sub_category, series_prefix, separator, number_format, description, current_sequence, is_active, is_deleted, tenant_id, created_at, updated_at, columns_config) FROM stdin;
2b11f808-e1a8-46ab-bdaf-70a8e378b9d0	sheet metal	XY	601	-	4		1	t	f	TEST	2026-07-16 18:05:24.786611	2026-07-16 18:06:17.56022	[{"name": "grade", "type": "varchar", "label": "grade"}, {"name": "unit", "type": "varchar", "label": "unit"}, {"name": "number", "type": "varchar", "label": "number"}]
\.


--
-- Data for Name: rm_master; Type: TABLE DATA; Schema: rawmaterial; Owner: postgres
--

COPY rawmaterial.rm_master (id, rm_code, rm_description, material_category, sub_category, specification, unit, hsn_code, standard_size, weight_per_unit, reorder_level, notes, is_active, is_deleted, tenant_id, created_by, created_at, updated_at, col_values) FROM stdin;
dd816cb5-1872-4925-b04b-2bdf3a10bac7	601-0001		sheet metal	XY					\N	\N		t	f	TEST		2026-07-16 18:06:17.56022	2026-07-16 18:06:17.56022	{"unit": "b", "grade": "a", "number": "c"}
45a792cd-7443-48bf-86f9-1691eef41ce7	RM-STEEL-316L	Forged Alloy Steel Bar 316L	Steel Alloy	Grade 316L		kg			\N	100		t	f	TEST		2026-07-21 12:09:54.604895	2026-07-21 12:09:54.604895	\N
bda89e83-2443-4cbb-b703-29503abeabb7	RM-ALUM-6061	Aircraft Grade Aluminum Rod 6061-T6	Non-Ferrous	Grade 6061		kg			\N	50		t	f	TEST		2026-07-21 12:09:54.604895	2026-07-21 12:09:54.604895	\N
\.


--
-- Data for Name: rm_part_mapping; Type: TABLE DATA; Schema: rawmaterial; Owner: postgres
--

COPY rawmaterial.rm_part_mapping (id, rm_code, rm_description, part_number, part_description, quantity_required, unit, wastage_percent, effective_quantity, process_notes, is_deleted, tenant_id, created_by, created_at, updated_at) FROM stdin;
b543e3d4-a86b-4baa-b42a-4ff3d720aebd	601-0001		MP-MP-GR-000001	Mechanical Parts, Gears, Steel, 20mm	10.0	kg	5.0	10.5		f	TEST		2026-07-16 18:07:00.123528	2026-07-16 18:07:00.123528
\.


--
-- Data for Name: rm_vendors; Type: TABLE DATA; Schema: rawmaterial; Owner: postgres
--

COPY rawmaterial.rm_vendors (id, rm_code, rm_description, vendor_name, vendor_code, price_per_unit, currency, moq, lead_time_days, payment_terms, is_preferred, last_purchase_date, rating, is_deleted, tenant_id, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: addresses; Type: TABLE DATA; Schema: supplier; Owner: postgres
--

COPY supplier.addresses (id, supplier_id, label, billing_address, shipping_address, is_default, tenant_id, is_deleted, created_at) FROM stdin;
\.


--
-- Data for Name: contacts; Type: TABLE DATA; Schema: supplier; Owner: postgres
--

COPY supplier.contacts (id, supplier_id, designation, name, mobile1, mobile2, email, status, about, remarks, tenant_id, is_deleted, created_at) FROM stdin;
\.


--
-- Data for Name: contracts; Type: TABLE DATA; Schema: supplier; Owner: postgres
--

COPY supplier.contracts (id, supplier_id, contract_no, title, contract_type, start_date, end_date, value, currency, status, terms, document_url, tenant_id, created_by, is_deleted, created_at, updated_at, contract_number, contract_value, payment_terms, delivery_terms, attachment_path, auto_renew, lifecycle_stage, notes) FROM stdin;
\.


--
-- Data for Name: evaluations; Type: TABLE DATA; Schema: supplier; Owner: postgres
--

COPY supplier.evaluations (id, supplier_id, eval_date, quality_score, delivery_score, price_score, service_score, overall_score, evaluator, remarks, status, tenant_id, created_by, is_deleted, created_at, updated_at, evaluation_date, period, document_verification_status, workflow_stage, capacity_score, financial_stability_score, experience_score, technical_support_score, approval_status, evaluator_id, comments) FROM stdin;
\.


--
-- Data for Name: history; Type: TABLE DATA; Schema: supplier; Owner: postgres
--

COPY supplier.history (id, supplier_id, part_code, event_type, description, amount, quantity, unit, reference_no, event_date, created_by, tenant_id, created_at) FROM stdin;
\.


--
-- Data for Name: parts; Type: TABLE DATA; Schema: supplier; Owner: postgres
--

COPY supplier.parts (id, supplier_id, part_code, mpn, make, moq, moq_price, spq, spq_price, sample_qty, sample_price, notes, tenant_id, is_deleted, created_at, updated_at, unit, item_type) FROM stdin;
\.


--
-- Data for Name: performance; Type: TABLE DATA; Schema: supplier; Owner: postgres
--

COPY supplier.performance (id, supplier_id, period, period_label, on_time_delivery, quality_rejection_rate, order_fulfillment_rate, response_time_hours, price_variance, score, notes, tenant_id, created_by, is_deleted, created_at, updated_at, po_count, grn_count, inspection_pass_rate, ncr_count, quality_defect_rate, on_time_delivery_rate, overall_score, performance_grade) FROM stdin;
\.


--
-- Data for Name: price_history; Type: TABLE DATA; Schema: supplier; Owner: postgres
--

COPY supplier.price_history (id, supplier_id, item_code, item_type, unit, sample_qty, sample_price, spq, spq_price, moq, moq_price, effective_date, notes, created_by, tenant_id, created_at, price, currency, reference_no, event_date, is_deleted) FROM stdin;
\.


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: supplier; Owner: postgres
--

COPY supplier.suppliers (id, supplier_code, brand_name, company_type, registered_name, gst_no, status, rating, currency, website, notes, tenant_id, created_by, is_deleted, created_at, updated_at) FROM stdin;
b381790b-38ca-4466-b4da-27abf638367c	SUP0001	124	manufacturer	1234	21434123	active	1.0	USD			TEST		f	2026-07-17 11:55:06.388965	2026-07-17 11:55:06.388965
01de0d51-79e3-4cd7-b6b8-55feae37eae8	123	vvvv	distributor	fsdf	21434123	active	3.0	INR			TEST		f	2026-07-17 12:22:26.325426	2026-07-17 12:22:26.325426
aaab26aa-0aa1-426f-a2b0-28388ca98f8e	3443	ffdvs	manufacturer	1234	q2eawf	active	3.0	INR			b424df0e-f766-4e94-b3fd-05777e158958	Mandeep Siwach	f	2026-07-21 11:14:06.985306	2026-07-21 11:14:06.985306
\.


--
-- Data for Name: bins; Type: TABLE DATA; Schema: warehouse; Owner: postgres
--

COPY warehouse.bins (id, code, zone_id, rack, shelf, "position", capacity, is_active, tenant_id, is_deleted, version, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: transfers; Type: TABLE DATA; Schema: warehouse; Owner: postgres
--

COPY warehouse.transfers (id, doc_no, date, from_warehouse, to_warehouse, status, lines, remarks, tenant_id, is_deleted, version, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: warehouses; Type: TABLE DATA; Schema: warehouse; Owner: postgres
--

COPY warehouse.warehouses (id, name, code, location_id, type, capacity, is_active, tenant_id, is_deleted, version, created_at, updated_at, created_by) FROM stdin;
\.


--
-- Data for Name: zones; Type: TABLE DATA; Schema: warehouse; Owner: postgres
--

COPY warehouse.zones (id, name, code, warehouse_id, type, capacity, is_active, tenant_id, is_deleted, version, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: approval_matrix; Type: TABLE DATA; Schema: workflow; Owner: postgres
--

COPY workflow.approval_matrix (id, module, document_type, conditions, approvers, is_active, tenant_id, is_deleted, version, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: definitions; Type: TABLE DATA; Schema: workflow; Owner: postgres
--

COPY workflow.definitions (id, name, code, module, steps, is_active, tenant_id, is_deleted, version, created_at, updated_at, created_by, updated_by) FROM stdin;
\.


--
-- Data for Name: instances; Type: TABLE DATA; Schema: workflow; Owner: postgres
--

COPY workflow.instances (id, definition_id, entity_type, entity_id, current_step, status, initiated_by, data, tenant_id, is_deleted, version, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: routing_steps; Type: TABLE DATA; Schema: workflow; Owner: postgres
--

COPY workflow.routing_steps (id, routing_id, process_no, subprocess_no, step_code, step_name, description, is_deleted, created_at, updated_at) FROM stdin;
200a74ee-48f5-43da-a51b-d2a50189887e	6117bd52-753f-4d8d-81a4-3f45fdf2dc42	1	\N	01	x		f	2026-07-17 15:20:12.977992	2026-07-17 15:20:12.977992
34aa119f-f318-4062-9c79-cb14f99db92e	6117bd52-753f-4d8d-81a4-3f45fdf2dc42	2	\N	02	x		f	2026-07-17 15:20:16.735304	2026-07-17 15:20:16.735304
b79298da-ac09-4b91-84d6-e8f87205640a	6117bd52-753f-4d8d-81a4-3f45fdf2dc42	1	1	01.01	12		f	2026-07-17 15:24:48.187976	2026-07-17 15:24:48.187976
970dc161-f46d-4e28-abaa-e6442c801caf	6117bd52-753f-4d8d-81a4-3f45fdf2dc42	1	2	01.02	clinching		f	2026-07-17 15:30:13.271906	2026-07-17 15:30:13.271906
ccbcc86d-a534-4f40-9a86-24916a15baca	2570ef63-dbbd-4cd1-b436-73f4dc3520ee	1	\N	01	a		f	2026-07-21 14:05:47.486285	2026-07-21 14:05:47.486285
6b19c3bb-1061-42c0-8623-b9958e397dc9	2570ef63-dbbd-4cd1-b436-73f4dc3520ee	2	\N	02	b		f	2026-07-21 14:05:51.32174	2026-07-21 14:05:51.32174
8695973e-3f37-4c9b-b469-11d6598a1251	2570ef63-dbbd-4cd1-b436-73f4dc3520ee	3	\N	03	c		f	2026-07-21 14:05:55.611075	2026-07-21 14:05:55.611075
\.


--
-- Data for Name: routings; Type: TABLE DATA; Schema: workflow; Owner: postgres
--

COPY workflow.routings (id, part_number, part_description, revision, status, notes, tenant_id, created_by, is_deleted, created_at, updated_at) FROM stdin;
6117bd52-753f-4d8d-81a4-3f45fdf2dc42	MP-MP-GR-000004		1	active		TEST		f	2026-07-17 15:08:08.720111	2026-07-17 15:30:13.271906
2570ef63-dbbd-4cd1-b436-73f4dc3520ee	601-1-000002		1	draft		b424df0e-f766-4e94-b3fd-05777e158958	Mandeep Siwach	f	2026-07-21 14:05:34.689758	2026-07-21 14:05:55.611075
\.


--
-- Data for Name: step_machines; Type: TABLE DATA; Schema: workflow; Owner: postgres
--

COPY workflow.step_machines (id, step_id, machine_id, cycle_time_minutes, is_preferred, notes, is_deleted, created_at, updated_at) FROM stdin;
c89e11ad-5691-47f2-bc9c-cc72568f1f20	970dc161-f46d-4e28-abaa-e6442c801caf	cc2a1210-447a-4def-b2c1-f714a27e57ea	11.0000	f		f	2026-07-17 16:11:13.005941	2026-07-17 16:11:13.005941
\.


--
-- Data for Name: steps; Type: TABLE DATA; Schema: workflow; Owner: postgres
--

COPY workflow.steps (id, instance_id, step_number, approver_id, status, comments, acted_at, tenant_id, is_deleted, version, created_at, updated_at) FROM stdin;
\.


--
-- Name: dashboards dashboards_code_key; Type: CONSTRAINT; Schema: analytics; Owner: postgres
--

ALTER TABLE ONLY analytics.dashboards
    ADD CONSTRAINT dashboards_code_key UNIQUE (code);


--
-- Name: dashboards dashboards_pkey; Type: CONSTRAINT; Schema: analytics; Owner: postgres
--

ALTER TABLE ONLY analytics.dashboards
    ADD CONSTRAINT dashboards_pkey PRIMARY KEY (id);


--
-- Name: reports reports_code_key; Type: CONSTRAINT; Schema: analytics; Owner: postgres
--

ALTER TABLE ONLY analytics.reports
    ADD CONSTRAINT reports_code_key UNIQUE (code);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: analytics; Owner: postgres
--

ALTER TABLE ONLY analytics.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: login_history login_history_pkey; Type: CONSTRAINT; Schema: audit; Owner: postgres
--

ALTER TABLE ONLY audit.login_history
    ADD CONSTRAINT login_history_pkey PRIMARY KEY (id);


--
-- Name: logs logs_pkey; Type: CONSTRAINT; Schema: audit; Owner: postgres
--

ALTER TABLE ONLY audit.logs
    ADD CONSTRAINT logs_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_code_key; Type: CONSTRAINT; Schema: finance; Owner: postgres
--

ALTER TABLE ONLY finance.accounts
    ADD CONSTRAINT accounts_code_key UNIQUE (code);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: finance; Owner: postgres
--

ALTER TABLE ONLY finance.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_doc_no_key; Type: CONSTRAINT; Schema: finance; Owner: postgres
--

ALTER TABLE ONLY finance.invoices
    ADD CONSTRAINT invoices_doc_no_key UNIQUE (doc_no);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: finance; Owner: postgres
--

ALTER TABLE ONLY finance.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: journal_entries journal_entries_doc_no_key; Type: CONSTRAINT; Schema: finance; Owner: postgres
--

ALTER TABLE ONLY finance.journal_entries
    ADD CONSTRAINT journal_entries_doc_no_key UNIQUE (doc_no);


--
-- Name: journal_entries journal_entries_pkey; Type: CONSTRAINT; Schema: finance; Owner: postgres
--

ALTER TABLE ONLY finance.journal_entries
    ADD CONSTRAINT journal_entries_pkey PRIMARY KEY (id);


--
-- Name: payments payments_doc_no_key; Type: CONSTRAINT; Schema: finance; Owner: postgres
--

ALTER TABLE ONLY finance.payments
    ADD CONSTRAINT payments_doc_no_key UNIQUE (doc_no);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: finance; Owner: postgres
--

ALTER TABLE ONLY finance.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: hr; Owner: postgres
--

ALTER TABLE ONLY hr.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: employee_code_criteria employee_code_criteria_pkey; Type: CONSTRAINT; Schema: hr; Owner: postgres
--

ALTER TABLE ONLY hr.employee_code_criteria
    ADD CONSTRAINT employee_code_criteria_pkey PRIMARY KEY (id);


--
-- Name: employees employees_emp_code_key; Type: CONSTRAINT; Schema: hr; Owner: postgres
--

ALTER TABLE ONLY hr.employees
    ADD CONSTRAINT employees_emp_code_key UNIQUE (emp_code);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: hr; Owner: postgres
--

ALTER TABLE ONLY hr.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: leaves leaves_pkey; Type: CONSTRAINT; Schema: hr; Owner: postgres
--

ALTER TABLE ONLY hr.leaves
    ADD CONSTRAINT leaves_pkey PRIMARY KEY (id);


--
-- Name: payroll payroll_pkey; Type: CONSTRAINT; Schema: hr; Owner: postgres
--

ALTER TABLE ONLY hr.payroll
    ADD CONSTRAINT payroll_pkey PRIMARY KEY (id);


--
-- Name: module_access module_access_pkey; Type: CONSTRAINT; Schema: iam; Owner: postgres
--

ALTER TABLE ONLY iam.module_access
    ADD CONSTRAINT module_access_pkey PRIMARY KEY (id);


--
-- Name: module_access module_access_user_id_module_tenant_id_key; Type: CONSTRAINT; Schema: iam; Owner: postgres
--

ALTER TABLE ONLY iam.module_access
    ADD CONSTRAINT module_access_user_id_module_tenant_id_key UNIQUE (user_id, module, tenant_id);


--
-- Name: module_roles module_roles_code_module_tenant_id_key; Type: CONSTRAINT; Schema: iam; Owner: postgres
--

ALTER TABLE ONLY iam.module_roles
    ADD CONSTRAINT module_roles_code_module_tenant_id_key UNIQUE (code, module, tenant_id);


--
-- Name: module_roles module_roles_pkey; Type: CONSTRAINT; Schema: iam; Owner: postgres
--

ALTER TABLE ONLY iam.module_roles
    ADD CONSTRAINT module_roles_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_code_key; Type: CONSTRAINT; Schema: iam; Owner: postgres
--

ALTER TABLE ONLY iam.permissions
    ADD CONSTRAINT permissions_code_key UNIQUE (code);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: iam; Owner: postgres
--

ALTER TABLE ONLY iam.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: policies policies_pkey; Type: CONSTRAINT; Schema: iam; Owner: postgres
--

ALTER TABLE ONLY iam.policies
    ADD CONSTRAINT policies_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: iam; Owner: postgres
--

ALTER TABLE ONLY iam.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: iam; Owner: postgres
--

ALTER TABLE ONLY iam.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: iam; Owner: postgres
--

ALTER TABLE ONLY iam.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_code_key; Type: CONSTRAINT; Schema: iam; Owner: postgres
--

ALTER TABLE ONLY iam.tenants
    ADD CONSTRAINT tenants_code_key UNIQUE (code);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: iam; Owner: postgres
--

ALTER TABLE ONLY iam.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: iam; Owner: postgres
--

ALTER TABLE ONLY iam.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: iam; Owner: postgres
--

ALTER TABLE ONLY iam.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: iam; Owner: postgres
--

ALTER TABLE ONLY iam.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: adjustments adjustments_doc_no_key; Type: CONSTRAINT; Schema: inventory; Owner: postgres
--

ALTER TABLE ONLY inventory.adjustments
    ADD CONSTRAINT adjustments_doc_no_key UNIQUE (doc_no);


--
-- Name: adjustments adjustments_pkey; Type: CONSTRAINT; Schema: inventory; Owner: postgres
--

ALTER TABLE ONLY inventory.adjustments
    ADD CONSTRAINT adjustments_pkey PRIMARY KEY (id);


--
-- Name: movements movements_pkey; Type: CONSTRAINT; Schema: inventory; Owner: postgres
--

ALTER TABLE ONLY inventory.movements
    ADD CONSTRAINT movements_pkey PRIMARY KEY (id);


--
-- Name: stock stock_pkey; Type: CONSTRAINT; Schema: inventory; Owner: postgres
--

ALTER TABLE ONLY inventory.stock
    ADD CONSTRAINT stock_pkey PRIMARY KEY (id);


--
-- Name: efficiency efficiency_pkey; Type: CONSTRAINT; Schema: machine; Owner: postgres
--

ALTER TABLE ONLY machine.efficiency
    ADD CONSTRAINT efficiency_pkey PRIMARY KEY (id);


--
-- Name: machines machines_pkey; Type: CONSTRAINT; Schema: machine; Owner: postgres
--

ALTER TABLE ONLY machine.machines
    ADD CONSTRAINT machines_pkey PRIMARY KEY (id);


--
-- Name: stations stations_pkey; Type: CONSTRAINT; Schema: machine; Owner: postgres
--

ALTER TABLE ONLY machine.stations
    ADD CONSTRAINT stations_pkey PRIMARY KEY (id);


--
-- Name: bom bom_code_key; Type: CONSTRAINT; Schema: manufacturing; Owner: postgres
--

ALTER TABLE ONLY manufacturing.bom
    ADD CONSTRAINT bom_code_key UNIQUE (code);


--
-- Name: bom bom_pkey; Type: CONSTRAINT; Schema: manufacturing; Owner: postgres
--

ALTER TABLE ONLY manufacturing.bom
    ADD CONSTRAINT bom_pkey PRIMARY KEY (id);


--
-- Name: production_logs production_logs_pkey; Type: CONSTRAINT; Schema: manufacturing; Owner: postgres
--

ALTER TABLE ONLY manufacturing.production_logs
    ADD CONSTRAINT production_logs_pkey PRIMARY KEY (id);


--
-- Name: work_orders work_orders_doc_no_key; Type: CONSTRAINT; Schema: manufacturing; Owner: postgres
--

ALTER TABLE ONLY manufacturing.work_orders
    ADD CONSTRAINT work_orders_doc_no_key UNIQUE (doc_no);


--
-- Name: work_orders work_orders_pkey; Type: CONSTRAINT; Schema: manufacturing; Owner: postgres
--

ALTER TABLE ONLY manufacturing.work_orders
    ADD CONSTRAINT work_orders_pkey PRIMARY KEY (id);


--
-- Name: currencies currencies_code_key; Type: CONSTRAINT; Schema: master; Owner: postgres
--

ALTER TABLE ONLY master.currencies
    ADD CONSTRAINT currencies_code_key UNIQUE (code);


--
-- Name: currencies currencies_pkey; Type: CONSTRAINT; Schema: master; Owner: postgres
--

ALTER TABLE ONLY master.currencies
    ADD CONSTRAINT currencies_pkey PRIMARY KEY (id);


--
-- Name: customers customers_code_key; Type: CONSTRAINT; Schema: master; Owner: postgres
--

ALTER TABLE ONLY master.customers
    ADD CONSTRAINT customers_code_key UNIQUE (code);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: master; Owner: postgres
--

ALTER TABLE ONLY master.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: master; Owner: postgres
--

ALTER TABLE ONLY master.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: items items_code_key; Type: CONSTRAINT; Schema: master; Owner: postgres
--

ALTER TABLE ONLY master.items
    ADD CONSTRAINT items_code_key UNIQUE (code);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: master; Owner: postgres
--

ALTER TABLE ONLY master.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: master; Owner: postgres
--

ALTER TABLE ONLY master.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_code_key; Type: CONSTRAINT; Schema: master; Owner: postgres
--

ALTER TABLE ONLY master.organizations
    ADD CONSTRAINT organizations_code_key UNIQUE (code);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: master; Owner: postgres
--

ALTER TABLE ONLY master.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: uom uom_code_key; Type: CONSTRAINT; Schema: master; Owner: postgres
--

ALTER TABLE ONLY master.uom
    ADD CONSTRAINT uom_code_key UNIQUE (code);


--
-- Name: uom uom_pkey; Type: CONSTRAINT; Schema: master; Owner: postgres
--

ALTER TABLE ONLY master.uom
    ADD CONSTRAINT uom_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_code_key; Type: CONSTRAINT; Schema: master; Owner: postgres
--

ALTER TABLE ONLY master.vendors
    ADD CONSTRAINT vendors_code_key UNIQUE (code);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: master; Owner: postgres
--

ALTER TABLE ONLY master.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: approval_workflows approval_workflows_pkey; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part.approval_workflows
    ADD CONSTRAINT approval_workflows_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: code_schemes code_schemes_code_key; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part.code_schemes
    ADD CONSTRAINT code_schemes_code_key UNIQUE (code);


--
-- Name: code_schemes code_schemes_pkey; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part.code_schemes
    ADD CONSTRAINT code_schemes_pkey PRIMARY KEY (id);


--
-- Name: customer_mappings customer_mappings_pkey; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part.customer_mappings
    ADD CONSTRAINT customer_mappings_pkey PRIMARY KEY (id);


--
-- Name: electrical_parts_motors_EP_EP-MT electrical_parts_motors_EP_EP-MT_part_number_key; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part."electrical_parts_motors_EP_EP-MT"
    ADD CONSTRAINT "electrical_parts_motors_EP_EP-MT_part_number_key" UNIQUE (part_number);


--
-- Name: electrical_parts_motors_EP_EP-MT electrical_parts_motors_EP_EP-MT_pkey; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part."electrical_parts_motors_EP_EP-MT"
    ADD CONSTRAINT "electrical_parts_motors_EP_EP-MT_pkey" PRIMARY KEY (id);


--
-- Name: electrical_parts_sensors_EP_EP-SN electrical_parts_sensors_EP_EP-SN_part_number_key; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part."electrical_parts_sensors_EP_EP-SN"
    ADD CONSTRAINT "electrical_parts_sensors_EP_EP-SN_part_number_key" UNIQUE (part_number);


--
-- Name: electrical_parts_sensors_EP_EP-SN electrical_parts_sensors_EP_EP-SN_pkey; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part."electrical_parts_sensors_EP_EP-SN"
    ADD CONSTRAINT "electrical_parts_sensors_EP_EP-SN_pkey" PRIMARY KEY (id);


--
-- Name: fasteners_hex_bolts_FP_FP-HB fasteners_hex_bolts_FP_FP-HB_part_number_key; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part."fasteners_hex_bolts_FP_FP-HB"
    ADD CONSTRAINT "fasteners_hex_bolts_FP_FP-HB_part_number_key" UNIQUE (part_number);


--
-- Name: fasteners_hex_bolts_FP_FP-HB fasteners_hex_bolts_FP_FP-HB_pkey; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part."fasteners_hex_bolts_FP_FP-HB"
    ADD CONSTRAINT "fasteners_hex_bolts_FP_FP-HB_pkey" PRIMARY KEY (id);


--
-- Name: fasteners_lock_nuts_FP_FP-LN fasteners_lock_nuts_FP_FP-LN_part_number_key; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part."fasteners_lock_nuts_FP_FP-LN"
    ADD CONSTRAINT "fasteners_lock_nuts_FP_FP-LN_part_number_key" UNIQUE (part_number);


--
-- Name: fasteners_lock_nuts_FP_FP-LN fasteners_lock_nuts_FP_FP-LN_pkey; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part."fasteners_lock_nuts_FP_FP-LN"
    ADD CONSTRAINT "fasteners_lock_nuts_FP_FP-LN_pkey" PRIMARY KEY (id);


--
-- Name: hydraulic_parts_cylinders_HP_HP-CY hydraulic_parts_cylinders_HP_HP-CY_part_number_key; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part."hydraulic_parts_cylinders_HP_HP-CY"
    ADD CONSTRAINT "hydraulic_parts_cylinders_HP_HP-CY_part_number_key" UNIQUE (part_number);


--
-- Name: hydraulic_parts_cylinders_HP_HP-CY hydraulic_parts_cylinders_HP_HP-CY_pkey; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part."hydraulic_parts_cylinders_HP_HP-CY"
    ADD CONSTRAINT "hydraulic_parts_cylinders_HP_HP-CY_pkey" PRIMARY KEY (id);


--
-- Name: hydraulic_parts_pumps_HP_HP-PM hydraulic_parts_pumps_HP_HP-PM_part_number_key; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part."hydraulic_parts_pumps_HP_HP-PM"
    ADD CONSTRAINT "hydraulic_parts_pumps_HP_HP-PM_part_number_key" UNIQUE (part_number);


--
-- Name: hydraulic_parts_pumps_HP_HP-PM hydraulic_parts_pumps_HP_HP-PM_pkey; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part."hydraulic_parts_pumps_HP_HP-PM"
    ADD CONSTRAINT "hydraulic_parts_pumps_HP_HP-PM_pkey" PRIMARY KEY (id);


--
-- Name: masters masters_pkey; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part.masters
    ADD CONSTRAINT masters_pkey PRIMARY KEY (id);


--
-- Name: mechanical_parts_bearings_MP_MP-BR mechanical_parts_bearings_MP_MP-BR_part_number_key; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part."mechanical_parts_bearings_MP_MP-BR"
    ADD CONSTRAINT "mechanical_parts_bearings_MP_MP-BR_part_number_key" UNIQUE (part_number);


--
-- Name: mechanical_parts_bearings_MP_MP-BR mechanical_parts_bearings_MP_MP-BR_pkey; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part."mechanical_parts_bearings_MP_MP-BR"
    ADD CONSTRAINT "mechanical_parts_bearings_MP_MP-BR_pkey" PRIMARY KEY (id);


--
-- Name: mechanical_parts_gears_MP_MP-GR mechanical_parts_gears_MP_MP-GR_part_number_key; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part."mechanical_parts_gears_MP_MP-GR"
    ADD CONSTRAINT "mechanical_parts_gears_MP_MP-GR_part_number_key" UNIQUE (part_number);


--
-- Name: mechanical_parts_gears_MP_MP-GR mechanical_parts_gears_MP_MP-GR_pkey; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part."mechanical_parts_gears_MP_MP-GR"
    ADD CONSTRAINT "mechanical_parts_gears_MP_MP-GR_pkey" PRIMARY KEY (id);


--
-- Name: mechanical_parts_shafts_MP_MP-SH mechanical_parts_shafts_MP_MP-SH_part_number_key; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part."mechanical_parts_shafts_MP_MP-SH"
    ADD CONSTRAINT "mechanical_parts_shafts_MP_MP-SH_part_number_key" UNIQUE (part_number);


--
-- Name: mechanical_parts_shafts_MP_MP-SH mechanical_parts_shafts_MP_MP-SH_pkey; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part."mechanical_parts_shafts_MP_MP-SH"
    ADD CONSTRAINT "mechanical_parts_shafts_MP_MP-SH_pkey" PRIMARY KEY (id);


--
-- Name: pneumatic_parts_actuators_PP_PP-AC pneumatic_parts_actuators_PP_PP-AC_part_number_key; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part."pneumatic_parts_actuators_PP_PP-AC"
    ADD CONSTRAINT "pneumatic_parts_actuators_PP_PP-AC_part_number_key" UNIQUE (part_number);


--
-- Name: pneumatic_parts_actuators_PP_PP-AC pneumatic_parts_actuators_PP_PP-AC_pkey; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part."pneumatic_parts_actuators_PP_PP-AC"
    ADD CONSTRAINT "pneumatic_parts_actuators_PP_PP-AC_pkey" PRIMARY KEY (id);


--
-- Name: pneumatic_parts_valves_PP_PP-VL pneumatic_parts_valves_PP_PP-VL_part_number_key; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part."pneumatic_parts_valves_PP_PP-VL"
    ADD CONSTRAINT "pneumatic_parts_valves_PP_PP-VL_part_number_key" UNIQUE (part_number);


--
-- Name: pneumatic_parts_valves_PP_PP-VL pneumatic_parts_valves_PP_PP-VL_pkey; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part."pneumatic_parts_valves_PP_PP-VL"
    ADD CONSTRAINT "pneumatic_parts_valves_PP_PP-VL_pkey" PRIMARY KEY (id);


--
-- Name: resistor_smt_100_1001 resistor_smt_100_1001_part_number_key; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part.resistor_smt_100_1001
    ADD CONSTRAINT resistor_smt_100_1001_part_number_key UNIQUE (part_number);


--
-- Name: resistor_smt_100_1001 resistor_smt_100_1001_pkey; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part.resistor_smt_100_1001
    ADD CONSTRAINT resistor_smt_100_1001_pkey PRIMARY KEY (id);


--
-- Name: series series_pkey; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part.series
    ADD CONSTRAINT series_pkey PRIMARY KEY (id);


--
-- Name: sheemetal_mould_601_1 sheemetal_mould_601_1_part_number_key; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part.sheemetal_mould_601_1
    ADD CONSTRAINT sheemetal_mould_601_1_part_number_key UNIQUE (part_number);


--
-- Name: sheemetal_mould_601_1 sheemetal_mould_601_1_pkey; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part.sheemetal_mould_601_1
    ADD CONSTRAINT sheemetal_mould_601_1_pkey PRIMARY KEY (id);


--
-- Name: sheet_metal_fg_601_1 sheet_metal_fg_601_1_part_number_key; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part.sheet_metal_fg_601_1
    ADD CONSTRAINT sheet_metal_fg_601_1_part_number_key UNIQUE (part_number);


--
-- Name: sheet_metal_fg_601_1 sheet_metal_fg_601_1_pkey; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part.sheet_metal_fg_601_1
    ADD CONSTRAINT sheet_metal_fg_601_1_pkey PRIMARY KEY (id);


--
-- Name: subcategories subcategories_pkey; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part.subcategories
    ADD CONSTRAINT subcategories_pkey PRIMARY KEY (id);


--
-- Name: validation_rules validation_rules_pkey; Type: CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part.validation_rules
    ADD CONSTRAINT validation_rules_pkey PRIMARY KEY (id);


--
-- Name: grn grn_doc_no_key; Type: CONSTRAINT; Schema: procurement; Owner: postgres
--

ALTER TABLE ONLY procurement.grn
    ADD CONSTRAINT grn_doc_no_key UNIQUE (doc_no);


--
-- Name: grn grn_pkey; Type: CONSTRAINT; Schema: procurement; Owner: postgres
--

ALTER TABLE ONLY procurement.grn
    ADD CONSTRAINT grn_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_doc_no_key; Type: CONSTRAINT; Schema: procurement; Owner: postgres
--

ALTER TABLE ONLY procurement.purchase_orders
    ADD CONSTRAINT purchase_orders_doc_no_key UNIQUE (doc_no);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: procurement; Owner: postgres
--

ALTER TABLE ONLY procurement.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_requests purchase_requests_doc_no_key; Type: CONSTRAINT; Schema: procurement; Owner: postgres
--

ALTER TABLE ONLY procurement.purchase_requests
    ADD CONSTRAINT purchase_requests_doc_no_key UNIQUE (doc_no);


--
-- Name: purchase_requests purchase_requests_pkey; Type: CONSTRAINT; Schema: procurement; Owner: postgres
--

ALTER TABLE ONLY procurement.purchase_requests
    ADD CONSTRAINT purchase_requests_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: project; Owner: postgres
--

ALTER TABLE ONLY project.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: projects projects_code_key; Type: CONSTRAINT; Schema: project; Owner: postgres
--

ALTER TABLE ONLY project.projects
    ADD CONSTRAINT projects_code_key UNIQUE (code);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: project; Owner: postgres
--

ALTER TABLE ONLY project.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: project; Owner: postgres
--

ALTER TABLE ONLY project.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: timesheets timesheets_pkey; Type: CONSTRAINT; Schema: project; Owner: postgres
--

ALTER TABLE ONLY project.timesheets
    ADD CONSTRAINT timesheets_pkey PRIMARY KEY (id);


--
-- Name: inventory_batches inventory_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_batches
    ADD CONSTRAINT inventory_batches_pkey PRIMARY KEY (id);


--
-- Name: inventory_locations inventory_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_locations
    ADD CONSTRAINT inventory_locations_pkey PRIMARY KEY (id);


--
-- Name: inventory_reorder_rules inventory_reorder_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_reorder_rules
    ADD CONSTRAINT inventory_reorder_rules_pkey PRIMARY KEY (id);


--
-- Name: inventory_serial_numbers inventory_serial_numbers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_serial_numbers
    ADD CONSTRAINT inventory_serial_numbers_pkey PRIMARY KEY (id);


--
-- Name: inventory_stock_checkins inventory_stock_checkins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_stock_checkins
    ADD CONSTRAINT inventory_stock_checkins_pkey PRIMARY KEY (id);


--
-- Name: inventory_stock_count_lines inventory_stock_count_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_stock_count_lines
    ADD CONSTRAINT inventory_stock_count_lines_pkey PRIMARY KEY (id);


--
-- Name: inventory_stock_counts inventory_stock_counts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_stock_counts
    ADD CONSTRAINT inventory_stock_counts_pkey PRIMARY KEY (id);


--
-- Name: inventory_stock_levels inventory_stock_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_stock_levels
    ADD CONSTRAINT inventory_stock_levels_pkey PRIMARY KEY (id);


--
-- Name: inventory_stock_movements inventory_stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_stock_movements
    ADD CONSTRAINT inventory_stock_movements_pkey PRIMARY KEY (id);


--
-- Name: inventory_warehouses inventory_warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_warehouses
    ADD CONSTRAINT inventory_warehouses_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_bom_lines manufacturing_bom_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.manufacturing_bom_lines
    ADD CONSTRAINT manufacturing_bom_lines_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_boms manufacturing_boms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.manufacturing_boms
    ADD CONSTRAINT manufacturing_boms_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_production_orders manufacturing_production_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.manufacturing_production_orders
    ADD CONSTRAINT manufacturing_production_orders_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_routing_steps manufacturing_routing_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.manufacturing_routing_steps
    ADD CONSTRAINT manufacturing_routing_steps_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_routings manufacturing_routings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.manufacturing_routings
    ADD CONSTRAINT manufacturing_routings_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_shop_floor_logs manufacturing_shop_floor_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.manufacturing_shop_floor_logs
    ADD CONSTRAINT manufacturing_shop_floor_logs_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_work_centers manufacturing_work_centers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.manufacturing_work_centers
    ADD CONSTRAINT manufacturing_work_centers_pkey PRIMARY KEY (id);


--
-- Name: purchase_customer_demands purchase_customer_demands_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_customer_demands
    ADD CONSTRAINT purchase_customer_demands_pkey PRIMARY KEY (id);


--
-- Name: purchase_lead_time_history purchase_lead_time_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_lead_time_history
    ADD CONSTRAINT purchase_lead_time_history_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_requisitions purchase_requisitions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_requisitions
    ADD CONSTRAINT purchase_requisitions_pkey PRIMARY KEY (id);


--
-- Name: purchase_supplier_quotations purchase_supplier_quotations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_supplier_quotations
    ADD CONSTRAINT purchase_supplier_quotations_pkey PRIMARY KEY (id);


--
-- Name: quality_iqc_criteria quality_iqc_criteria_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quality_iqc_criteria
    ADD CONSTRAINT quality_iqc_criteria_pkey PRIMARY KEY (id);


--
-- Name: quality_ncrs quality_ncrs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quality_ncrs
    ADD CONSTRAINT quality_ncrs_pkey PRIMARY KEY (id);


--
-- Name: super_admins super_admins_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.super_admins
    ADD CONSTRAINT super_admins_email_key UNIQUE (email);


--
-- Name: super_admins super_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.super_admins
    ADD CONSTRAINT super_admins_pkey PRIMARY KEY (id);


--
-- Name: warehouse_bin_scans warehouse_bin_scans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouse_bin_scans
    ADD CONSTRAINT warehouse_bin_scans_pkey PRIMARY KEY (id);


--
-- Name: warehouse_bins warehouse_bins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouse_bins
    ADD CONSTRAINT warehouse_bins_pkey PRIMARY KEY (id);


--
-- Name: warehouse_packing_lists warehouse_packing_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouse_packing_lists
    ADD CONSTRAINT warehouse_packing_lists_pkey PRIMARY KEY (id);


--
-- Name: warehouse_pick_list_items warehouse_pick_list_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouse_pick_list_items
    ADD CONSTRAINT warehouse_pick_list_items_pkey PRIMARY KEY (id);


--
-- Name: warehouse_pick_lists warehouse_pick_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouse_pick_lists
    ADD CONSTRAINT warehouse_pick_lists_pkey PRIMARY KEY (id);


--
-- Name: warehouse_putaway_tasks warehouse_putaway_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouse_putaway_tasks
    ADD CONSTRAINT warehouse_putaway_tasks_pkey PRIMARY KEY (id);


--
-- Name: warehouse_receipt_lines warehouse_receipt_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouse_receipt_lines
    ADD CONSTRAINT warehouse_receipt_lines_pkey PRIMARY KEY (id);


--
-- Name: warehouse_receipts warehouse_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouse_receipts
    ADD CONSTRAINT warehouse_receipts_pkey PRIMARY KEY (id);


--
-- Name: warehouse_shipment_lines warehouse_shipment_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouse_shipment_lines
    ADD CONSTRAINT warehouse_shipment_lines_pkey PRIMARY KEY (id);


--
-- Name: warehouse_shipments warehouse_shipments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouse_shipments
    ADD CONSTRAINT warehouse_shipments_pkey PRIMARY KEY (id);


--
-- Name: warehouse_zones warehouse_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouse_zones
    ADD CONSTRAINT warehouse_zones_pkey PRIMARY KEY (id);


--
-- Name: inspections inspections_doc_no_key; Type: CONSTRAINT; Schema: quality; Owner: postgres
--

ALTER TABLE ONLY quality.inspections
    ADD CONSTRAINT inspections_doc_no_key UNIQUE (doc_no);


--
-- Name: inspections inspections_pkey; Type: CONSTRAINT; Schema: quality; Owner: postgres
--

ALTER TABLE ONLY quality.inspections
    ADD CONSTRAINT inspections_pkey PRIMARY KEY (id);


--
-- Name: ncr ncr_doc_no_key; Type: CONSTRAINT; Schema: quality; Owner: postgres
--

ALTER TABLE ONLY quality.ncr
    ADD CONSTRAINT ncr_doc_no_key UNIQUE (doc_no);


--
-- Name: ncr ncr_pkey; Type: CONSTRAINT; Schema: quality; Owner: postgres
--

ALTER TABLE ONLY quality.ncr
    ADD CONSTRAINT ncr_pkey PRIMARY KEY (id);


--
-- Name: rm_criteria rm_criteria_pkey; Type: CONSTRAINT; Schema: rawmaterial; Owner: postgres
--

ALTER TABLE ONLY rawmaterial.rm_criteria
    ADD CONSTRAINT rm_criteria_pkey PRIMARY KEY (id);


--
-- Name: rm_master rm_master_pkey; Type: CONSTRAINT; Schema: rawmaterial; Owner: postgres
--

ALTER TABLE ONLY rawmaterial.rm_master
    ADD CONSTRAINT rm_master_pkey PRIMARY KEY (id);


--
-- Name: rm_master rm_master_rm_code_key; Type: CONSTRAINT; Schema: rawmaterial; Owner: postgres
--

ALTER TABLE ONLY rawmaterial.rm_master
    ADD CONSTRAINT rm_master_rm_code_key UNIQUE (rm_code);


--
-- Name: rm_part_mapping rm_part_mapping_pkey; Type: CONSTRAINT; Schema: rawmaterial; Owner: postgres
--

ALTER TABLE ONLY rawmaterial.rm_part_mapping
    ADD CONSTRAINT rm_part_mapping_pkey PRIMARY KEY (id);


--
-- Name: rm_vendors rm_vendors_pkey; Type: CONSTRAINT; Schema: rawmaterial; Owner: postgres
--

ALTER TABLE ONLY rawmaterial.rm_vendors
    ADD CONSTRAINT rm_vendors_pkey PRIMARY KEY (id);


--
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: supplier; Owner: postgres
--

ALTER TABLE ONLY supplier.addresses
    ADD CONSTRAINT addresses_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: supplier; Owner: postgres
--

ALTER TABLE ONLY supplier.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: supplier; Owner: postgres
--

ALTER TABLE ONLY supplier.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);


--
-- Name: evaluations evaluations_pkey; Type: CONSTRAINT; Schema: supplier; Owner: postgres
--

ALTER TABLE ONLY supplier.evaluations
    ADD CONSTRAINT evaluations_pkey PRIMARY KEY (id);


--
-- Name: history history_pkey; Type: CONSTRAINT; Schema: supplier; Owner: postgres
--

ALTER TABLE ONLY supplier.history
    ADD CONSTRAINT history_pkey PRIMARY KEY (id);


--
-- Name: parts parts_pkey; Type: CONSTRAINT; Schema: supplier; Owner: postgres
--

ALTER TABLE ONLY supplier.parts
    ADD CONSTRAINT parts_pkey PRIMARY KEY (id);


--
-- Name: performance performance_pkey; Type: CONSTRAINT; Schema: supplier; Owner: postgres
--

ALTER TABLE ONLY supplier.performance
    ADD CONSTRAINT performance_pkey PRIMARY KEY (id);


--
-- Name: price_history price_history_pkey; Type: CONSTRAINT; Schema: supplier; Owner: postgres
--

ALTER TABLE ONLY supplier.price_history
    ADD CONSTRAINT price_history_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: supplier; Owner: postgres
--

ALTER TABLE ONLY supplier.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_supplier_code_key; Type: CONSTRAINT; Schema: supplier; Owner: postgres
--

ALTER TABLE ONLY supplier.suppliers
    ADD CONSTRAINT suppliers_supplier_code_key UNIQUE (supplier_code);


--
-- Name: bins bins_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: postgres
--

ALTER TABLE ONLY warehouse.bins
    ADD CONSTRAINT bins_pkey PRIMARY KEY (id);


--
-- Name: transfers transfers_doc_no_key; Type: CONSTRAINT; Schema: warehouse; Owner: postgres
--

ALTER TABLE ONLY warehouse.transfers
    ADD CONSTRAINT transfers_doc_no_key UNIQUE (doc_no);


--
-- Name: transfers transfers_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: postgres
--

ALTER TABLE ONLY warehouse.transfers
    ADD CONSTRAINT transfers_pkey PRIMARY KEY (id);


--
-- Name: warehouses warehouses_code_key; Type: CONSTRAINT; Schema: warehouse; Owner: postgres
--

ALTER TABLE ONLY warehouse.warehouses
    ADD CONSTRAINT warehouses_code_key UNIQUE (code);


--
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: postgres
--

ALTER TABLE ONLY warehouse.warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);


--
-- Name: zones zones_pkey; Type: CONSTRAINT; Schema: warehouse; Owner: postgres
--

ALTER TABLE ONLY warehouse.zones
    ADD CONSTRAINT zones_pkey PRIMARY KEY (id);


--
-- Name: approval_matrix approval_matrix_pkey; Type: CONSTRAINT; Schema: workflow; Owner: postgres
--

ALTER TABLE ONLY workflow.approval_matrix
    ADD CONSTRAINT approval_matrix_pkey PRIMARY KEY (id);


--
-- Name: definitions definitions_pkey; Type: CONSTRAINT; Schema: workflow; Owner: postgres
--

ALTER TABLE ONLY workflow.definitions
    ADD CONSTRAINT definitions_pkey PRIMARY KEY (id);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: workflow; Owner: postgres
--

ALTER TABLE ONLY workflow.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: routing_steps routing_steps_pkey; Type: CONSTRAINT; Schema: workflow; Owner: postgres
--

ALTER TABLE ONLY workflow.routing_steps
    ADD CONSTRAINT routing_steps_pkey PRIMARY KEY (id);


--
-- Name: routing_steps routing_steps_routing_id_process_no_subprocess_no_key; Type: CONSTRAINT; Schema: workflow; Owner: postgres
--

ALTER TABLE ONLY workflow.routing_steps
    ADD CONSTRAINT routing_steps_routing_id_process_no_subprocess_no_key UNIQUE (routing_id, process_no, subprocess_no);


--
-- Name: routings routings_part_number_tenant_id_key; Type: CONSTRAINT; Schema: workflow; Owner: postgres
--

ALTER TABLE ONLY workflow.routings
    ADD CONSTRAINT routings_part_number_tenant_id_key UNIQUE (part_number, tenant_id);


--
-- Name: routings routings_pkey; Type: CONSTRAINT; Schema: workflow; Owner: postgres
--

ALTER TABLE ONLY workflow.routings
    ADD CONSTRAINT routings_pkey PRIMARY KEY (id);


--
-- Name: step_machines step_machines_pkey; Type: CONSTRAINT; Schema: workflow; Owner: postgres
--

ALTER TABLE ONLY workflow.step_machines
    ADD CONSTRAINT step_machines_pkey PRIMARY KEY (id);


--
-- Name: step_machines step_machines_step_id_machine_id_key; Type: CONSTRAINT; Schema: workflow; Owner: postgres
--

ALTER TABLE ONLY workflow.step_machines
    ADD CONSTRAINT step_machines_step_id_machine_id_key UNIQUE (step_id, machine_id);


--
-- Name: steps steps_pkey; Type: CONSTRAINT; Schema: workflow; Owner: postgres
--

ALTER TABLE ONLY workflow.steps
    ADD CONSTRAINT steps_pkey PRIMARY KEY (id);


--
-- Name: idx_part_code_schemes_tenant; Type: INDEX; Schema: part; Owner: postgres
--

CREATE INDEX idx_part_code_schemes_tenant ON part.code_schemes USING btree (tenant_id);


--
-- Name: idx_part_masters_part_number; Type: INDEX; Schema: part; Owner: postgres
--

CREATE INDEX idx_part_masters_part_number ON part.masters USING btree (part_number);


--
-- Name: idx_part_masters_tenant; Type: INDEX; Schema: part; Owner: postgres
--

CREATE INDEX idx_part_masters_tenant ON part.masters USING btree (tenant_id);


--
-- Name: attendance attendance_employee_id_fkey; Type: FK CONSTRAINT; Schema: hr; Owner: postgres
--

ALTER TABLE ONLY hr.attendance
    ADD CONSTRAINT attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES hr.employees(id);


--
-- Name: leaves leaves_employee_id_fkey; Type: FK CONSTRAINT; Schema: hr; Owner: postgres
--

ALTER TABLE ONLY hr.leaves
    ADD CONSTRAINT leaves_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES hr.employees(id);


--
-- Name: payroll payroll_employee_id_fkey; Type: FK CONSTRAINT; Schema: hr; Owner: postgres
--

ALTER TABLE ONLY hr.payroll
    ADD CONSTRAINT payroll_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES hr.employees(id);


--
-- Name: module_access module_access_user_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: postgres
--

ALTER TABLE ONLY iam.module_access
    ADD CONSTRAINT module_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES iam.users(id);


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: postgres
--

ALTER TABLE ONLY iam.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES iam.permissions(id);


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: postgres
--

ALTER TABLE ONLY iam.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES iam.roles(id);


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: postgres
--

ALTER TABLE ONLY iam.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES iam.users(id);


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: postgres
--

ALTER TABLE ONLY iam.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES iam.roles(id);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: iam; Owner: postgres
--

ALTER TABLE ONLY iam.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES iam.users(id);


--
-- Name: efficiency efficiency_machine_id_fkey; Type: FK CONSTRAINT; Schema: machine; Owner: postgres
--

ALTER TABLE ONLY machine.efficiency
    ADD CONSTRAINT efficiency_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES machine.machines(id);


--
-- Name: machines machines_station_id_fkey; Type: FK CONSTRAINT; Schema: machine; Owner: postgres
--

ALTER TABLE ONLY machine.machines
    ADD CONSTRAINT machines_station_id_fkey FOREIGN KEY (station_id) REFERENCES machine.stations(id);


--
-- Name: production_logs production_logs_work_order_id_fkey; Type: FK CONSTRAINT; Schema: manufacturing; Owner: postgres
--

ALTER TABLE ONLY manufacturing.production_logs
    ADD CONSTRAINT production_logs_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES manufacturing.work_orders(id);


--
-- Name: work_orders work_orders_bom_id_fkey; Type: FK CONSTRAINT; Schema: manufacturing; Owner: postgres
--

ALTER TABLE ONLY manufacturing.work_orders
    ADD CONSTRAINT work_orders_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES manufacturing.bom(id);


--
-- Name: masters masters_code_scheme_id_fkey; Type: FK CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part.masters
    ADD CONSTRAINT masters_code_scheme_id_fkey FOREIGN KEY (code_scheme_id) REFERENCES part.code_schemes(id);


--
-- Name: series series_scheme_id_fkey; Type: FK CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part.series
    ADD CONSTRAINT series_scheme_id_fkey FOREIGN KEY (scheme_id) REFERENCES part.code_schemes(id);


--
-- Name: subcategories subcategories_category_id_fkey; Type: FK CONSTRAINT; Schema: part; Owner: postgres
--

ALTER TABLE ONLY part.subcategories
    ADD CONSTRAINT subcategories_category_id_fkey FOREIGN KEY (category_id) REFERENCES part.categories(id);


--
-- Name: grn grn_po_id_fkey; Type: FK CONSTRAINT; Schema: procurement; Owner: postgres
--

ALTER TABLE ONLY procurement.grn
    ADD CONSTRAINT grn_po_id_fkey FOREIGN KEY (po_id) REFERENCES procurement.purchase_orders(id);


--
-- Name: tasks tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: project; Owner: postgres
--

ALTER TABLE ONLY project.tasks
    ADD CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES project.projects(id);


--
-- Name: timesheets timesheets_project_id_fkey; Type: FK CONSTRAINT; Schema: project; Owner: postgres
--

ALTER TABLE ONLY project.timesheets
    ADD CONSTRAINT timesheets_project_id_fkey FOREIGN KEY (project_id) REFERENCES project.projects(id);


--
-- Name: timesheets timesheets_task_id_fkey; Type: FK CONSTRAINT; Schema: project; Owner: postgres
--

ALTER TABLE ONLY project.timesheets
    ADD CONSTRAINT timesheets_task_id_fkey FOREIGN KEY (task_id) REFERENCES project.tasks(id);


--
-- Name: addresses addresses_supplier_id_fkey; Type: FK CONSTRAINT; Schema: supplier; Owner: postgres
--

ALTER TABLE ONLY supplier.addresses
    ADD CONSTRAINT addresses_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES supplier.suppliers(id);


--
-- Name: contacts contacts_supplier_id_fkey; Type: FK CONSTRAINT; Schema: supplier; Owner: postgres
--

ALTER TABLE ONLY supplier.contacts
    ADD CONSTRAINT contacts_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES supplier.suppliers(id);


--
-- Name: contracts contracts_supplier_id_fkey; Type: FK CONSTRAINT; Schema: supplier; Owner: postgres
--

ALTER TABLE ONLY supplier.contracts
    ADD CONSTRAINT contracts_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES supplier.suppliers(id);


--
-- Name: evaluations evaluations_supplier_id_fkey; Type: FK CONSTRAINT; Schema: supplier; Owner: postgres
--

ALTER TABLE ONLY supplier.evaluations
    ADD CONSTRAINT evaluations_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES supplier.suppliers(id);


--
-- Name: history history_supplier_id_fkey; Type: FK CONSTRAINT; Schema: supplier; Owner: postgres
--

ALTER TABLE ONLY supplier.history
    ADD CONSTRAINT history_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES supplier.suppliers(id);


--
-- Name: parts parts_supplier_id_fkey; Type: FK CONSTRAINT; Schema: supplier; Owner: postgres
--

ALTER TABLE ONLY supplier.parts
    ADD CONSTRAINT parts_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES supplier.suppliers(id);


--
-- Name: performance performance_supplier_id_fkey; Type: FK CONSTRAINT; Schema: supplier; Owner: postgres
--

ALTER TABLE ONLY supplier.performance
    ADD CONSTRAINT performance_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES supplier.suppliers(id);


--
-- Name: price_history price_history_supplier_id_fkey; Type: FK CONSTRAINT; Schema: supplier; Owner: postgres
--

ALTER TABLE ONLY supplier.price_history
    ADD CONSTRAINT price_history_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES supplier.suppliers(id);


--
-- Name: bins bins_zone_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: postgres
--

ALTER TABLE ONLY warehouse.bins
    ADD CONSTRAINT bins_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES warehouse.zones(id);


--
-- Name: zones zones_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: warehouse; Owner: postgres
--

ALTER TABLE ONLY warehouse.zones
    ADD CONSTRAINT zones_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouse.warehouses(id);


--
-- Name: instances instances_definition_id_fkey; Type: FK CONSTRAINT; Schema: workflow; Owner: postgres
--

ALTER TABLE ONLY workflow.instances
    ADD CONSTRAINT instances_definition_id_fkey FOREIGN KEY (definition_id) REFERENCES workflow.definitions(id);


--
-- Name: routing_steps routing_steps_routing_id_fkey; Type: FK CONSTRAINT; Schema: workflow; Owner: postgres
--

ALTER TABLE ONLY workflow.routing_steps
    ADD CONSTRAINT routing_steps_routing_id_fkey FOREIGN KEY (routing_id) REFERENCES workflow.routings(id);


--
-- Name: step_machines step_machines_machine_id_fkey; Type: FK CONSTRAINT; Schema: workflow; Owner: postgres
--

ALTER TABLE ONLY workflow.step_machines
    ADD CONSTRAINT step_machines_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES machine.machines(id);


--
-- Name: step_machines step_machines_step_id_fkey; Type: FK CONSTRAINT; Schema: workflow; Owner: postgres
--

ALTER TABLE ONLY workflow.step_machines
    ADD CONSTRAINT step_machines_step_id_fkey FOREIGN KEY (step_id) REFERENCES workflow.routing_steps(id);


--
-- Name: steps steps_instance_id_fkey; Type: FK CONSTRAINT; Schema: workflow; Owner: postgres
--

ALTER TABLE ONLY workflow.steps
    ADD CONSTRAINT steps_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES workflow.instances(id);


--
-- PostgreSQL database dump complete
--

\unrestrict eLtKCqekCNLQf9KLoYUB7PUBx7iu1bbGQ2bQpIi3SXqY2vhDyeYTgEevhmuxheS

