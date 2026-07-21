import sys
import uuid
import json
import bcrypt
from datetime import datetime, timedelta

sys.path.insert(0, '.')
from app import create_app
from extensions import db

app = create_app()

def seed_full_demo_data():
    with app.app_context():
        print("=== Seeding Complete ERP Demo Data Across All Modules ===")
        tenant_id = "TEST"

        def safe_exec(sql, params=None):
            try:
                db.session.execute(db.text(sql), params or {})
                db.session.commit()
            except Exception as e:
                db.session.rollback()

        # 1. IAM TENANT & USERS MAPPED TO HR EMPLOYEES
        print("1. Seeding IAM Tenants & Users mapped to HR Employees...")
        
        safe_exec("""
            CREATE TABLE IF NOT EXISTS iam.module_access (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                module VARCHAR(100) NOT NULL,
                role VARCHAR(50) DEFAULT 'viewer',
                permissions JSONB DEFAULT '{}',
                is_active BOOLEAN DEFAULT true,
                granted_by VARCHAR(200),
                tenant_id VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        pwd_hash = bcrypt.hashpw(b"Password123!", bcrypt.gensalt()).decode()

        u1_id, u2_id, u3_id, u4_id, u5_id = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())

        users_data = [
            (u1_id, "mandeep@supersystems.in", "Mandeep", "Siwach", "9992662555", "Plant Manager & Director"),
            (u2_id, "rajesh.inv@acme.com", "Rajesh", "Kumar", "9876543210", "Inventory Manager"),
            (u3_id, "sunil.wh@acme.com", "Sunil", "Verma", "9876543211", "Warehouse Supervisor"),
            (u4_id, "anita.mfg@acme.com", "Anita", "Sharma", "9876543212", "Production Engineer"),
            (u5_id, "vikram.qc@acme.com", "Vikram", "Singh", "9876543213", "Quality Inspector"),
        ]

        for uid, email, fn, ln, phone, role in users_data:
            safe_exec("""
                INSERT INTO iam.users (id, tenant_id, email, password_hash, first_name, last_name, phone, is_active, is_deleted, created_at, updated_at)
                VALUES (:id, :tid, :email, :pwd, :fn, :ln, :phone, true, false, NOW(), NOW())
                ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, phone = EXCLUDED.phone
            """, {"id": uid, "tid": tenant_id, "email": email, "pwd": pwd_hash, "fn": fn, "ln": ln, "phone": phone})

        # Module Access Grants
        module_grants = [
            (u1_id, "Part Management", "module_admin"),
            (u1_id, "Inventory Management", "module_admin"),
            (u1_id, "Warehouse Management", "module_admin"),
            (u1_id, "Manufacturing", "module_admin"),
            (u2_id, "Inventory Management", "module_admin"),
            (u3_id, "Warehouse Management", "module_admin"),
            (u4_id, "Manufacturing", "module_admin"),
            (u5_id, "Inventory Management", "editor"),
            (u5_id, "Warehouse Management", "editor"),
            (u5_id, "Manufacturing", "editor"),
        ]

        for uid, mod, rcode in module_grants:
            safe_exec("""
                INSERT INTO iam.module_access (id, user_id, module, role, permissions, granted_by, tenant_id)
                VALUES (:id, :uid, :mod, :rcode, '{}', 'system', :tid)
                ON CONFLICT DO NOTHING
            """, {"id": str(uuid.uuid4()), "uid": uid, "mod": mod, "rcode": rcode, "tid": tenant_id})

        # HR Employees
        hr_data = [
            (str(uuid.uuid4()), "EMP-1001", u1_id, "Mandeep", "Siwach", "mandeep@supersystems.in", "Plant Head", "Executive"),
            (str(uuid.uuid4()), "EMP-1002", u2_id, "Rajesh", "Kumar", "rajesh.inv@acme.com", "Inventory Manager", "Supply Chain"),
            (str(uuid.uuid4()), "EMP-1003", u3_id, "Sunil", "Verma", "sunil.wh@acme.com", "Warehouse Supervisor", "Logistics"),
            (str(uuid.uuid4()), "EMP-1004", u4_id, "Anita", "Sharma", "anita.mfg@acme.com", "Production Lead", "Manufacturing"),
            (str(uuid.uuid4()), "EMP-1005", u5_id, "Vikram", "Singh", "vikram.qc@acme.com", "Quality Inspector", "Quality"),
        ]

        for eid, code, uid, fn, ln, email, desig, dept in hr_data:
            safe_exec("""
                INSERT INTO hr.employees (id, emp_code, user_id, first_name, last_name, email, designation, status, tenant_id, created_at, updated_at)
                VALUES (:id, :code, :uid, :fn, :ln, :email, :desig, 'active', :tid, NOW(), NOW())
                ON CONFLICT (emp_code) DO UPDATE SET designation = EXCLUDED.designation
            """, {"id": eid, "code": code, "uid": uid, "fn": fn, "ln": ln, "email": email, "desig": desig, "tid": tenant_id})

        # 2. PART MANAGEMENT
        print("2. Seeding Part Management categories, subcategories & part numbering...")

        parts_list = [
            (str(uuid.uuid4()), "601-0-000001", "Precision Engine Crankshaft Base", "Engine Components", "Shafts & Axles", "pcs", "Forged Steel", "Draft"),
            (str(uuid.uuid4()), "601-0-000001-01", "Crankshaft Op 1: Rough Turning", "Engine Components", "Shafts & Axles", "pcs", "Forged Steel", "In Progress"),
            (str(uuid.uuid4()), "601-0-000001-02", "Crankshaft Op 2: CNC Milling & Grinding", "Engine Components", "Shafts & Axles", "pcs", "Forged Steel", "In Progress"),
            (str(uuid.uuid4()), "601-0-000001-99", "Finished Engine Crankshaft Assembly (FG)", "Engine Components", "Shafts & Axles", "pcs", "Alloy Steel 316L", "Approved"),
            (str(uuid.uuid4()), "601-0-000001-88", "Rejected Crankshaft Casting (NG)", "Engine Components", "Shafts & Axles", "pcs", "Forged Steel", "Scrapped"),
            (str(uuid.uuid4()), "602-0-000002-99", "High Compression Piston Assembly (FG)", "Engine Components", "Pistons", "pcs", "Aluminum 6061", "Approved"),
        ]

        for pid, pnum, name, cat, subcat, uom, mat, status in parts_list:
            safe_exec("""
                INSERT INTO part.masters (id, part_number, name, category, sub_category, uom, material_type, status, tenant_id, created_at, updated_at)
                VALUES (:id, :pnum, :name, :cat, :subcat, :uom, :mat, :status, :tid, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status
            """, {"id": pid, "pnum": pnum, "name": name, "cat": cat, "subcat": subcat, "uom": uom, "mat": mat, "status": status, "tid": tenant_id})

        # 3. RAW MATERIAL (RM)
        print("3. Seeding Raw Material Master...")

        safe_exec("""
            INSERT INTO rawmaterial.rm_master (id, rm_code, rm_description, material_category, sub_category, unit, reorder_level, tenant_id)
            VALUES 
            (:id1, 'RM-STEEL-316L', 'Forged Alloy Steel Bar 316L', 'Steel Alloy', 'Grade 316L', 'kg', 100, :tid),
            (:id2, 'RM-ALUM-6061', 'Aircraft Grade Aluminum Rod 6061-T6', 'Non-Ferrous', 'Grade 6061', 'kg', 50, :tid)
            ON CONFLICT (rm_code) DO NOTHING
        """, {"id1": str(uuid.uuid4()), "id2": str(uuid.uuid4()), "tid": tenant_id})

        # 4. SUPPLIER MANAGEMENT
        print("4. Seeding Supplier Profiles & Vendors...")

        suppliers = [
            (str(uuid.uuid4()), "SUP-101", "Tata Steel Industrial Solutions", "Raw Material"),
            (str(uuid.uuid4()), "SUP-102", "Precision Castings Pvt Ltd", "Casting & Forging"),
            (str(uuid.uuid4()), "SUP-103", "Bosch Automotive Systems", "Assemblies"),
        ]

        for sid, code, name, stype in suppliers:
            safe_exec("""
                INSERT INTO master.vendors (id, code, name, type, is_active, tenant_id, created_at, updated_at)
                VALUES (:id, :code, :name, :stype, true, :tid, NOW(), NOW())
                ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
            """, {"id": sid, "code": code, "name": name, "stype": stype, "tid": tenant_id})

        # 5. MACHINE MANAGEMENT
        print("5. Seeding Machines & Work Centers...")

        machines = [
            (str(uuid.uuid4()), "MAC-CNC-01", "Haas VF-4 5-Axis CNC Center", 650.00),
            (str(uuid.uuid4()), "MAC-LATHE-02", "Mazak Quick Turn CNC Lathe", 450.00),
            (str(uuid.uuid4()), "MAC-GRIND-03", "Studer CNC Cylindrical Grinder", 550.00),
        ]

        for mid, code, name, rate in machines:
            safe_exec("""
                INSERT INTO manufacturing_work_centers (id, code, name, machine_id, machine_name, capacity_hours_per_day, efficiency_pct, cost_rate_per_hour, mhr_rate, status, tenant_id, created_at, updated_at)
                VALUES (:id, :code, :name, :mid, :name, 8, 90, :rate, :mhr, 'active', :tid, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, mhr_rate = EXCLUDED.mhr_rate
            """, {"id": mid, "code": code, "name": name, "mid": mid, "rate": rate, "mhr": round(rate * 1.11, 2), "tid": tenant_id})

        # 6. INVENTORY MANAGEMENT
        print("6. Seeding Inventory Stock Levels, Movements, Batches, Serials...")

        safe_exec("""
            INSERT INTO inventory_warehouses (id, code, name, address, tenant_id)
            VALUES 
            (:id1, 'MAIN', 'Central Plant Warehouse', 'Gate 1 Industrial Zone', :tid),
            (:id2, 'FG-WH', 'Finished Goods Distribution Center', 'Logistics Park', :tid),
            (:id3, 'QC-WH', 'Quarantine & Inspection Warehouse', 'Quality Building', :tid)
            ON CONFLICT (id) DO NOTHING
        """, {"id1": str(uuid.uuid4()), "id2": str(uuid.uuid4()), "id3": str(uuid.uuid4()), "tid": tenant_id})

        stock_records = [
            (str(uuid.uuid4()), "601-0-000001-99", "Finished Engine Crankshaft Assembly (FG)", "FG", "FG-WH", "Z-FG", "FG-A-01", 50, 5, 45, 15, 50, "pcs", 1250.00, 62500.00),
            (str(uuid.uuid4()), "RM-STEEL-316L", "Forged Alloy Steel Bar 316L", "RM", "MAIN", "Z-RM", "RM-A-01", 500, 50, 450, 100, 200, "kg", 180.00, 90000.00),
            (str(uuid.uuid4()), "601-0-000001-88", "Rejected Crankshaft Casting (NG)", "NG", "QC-WH", "Z-QC", "QUARANTINE", 4, 0, 4, 0, 0, "pcs", 100.00, 400.00),
            (str(uuid.uuid4()), "602-0-000002-99", "High Compression Piston Assembly (FG)", "FG", "FG-WH", "Z-FG", "FG-B-02", 120, 10, 110, 20, 60, "pcs", 850.00, 102000.00),
        ]

        for sid, pnum, desc, itype, wh, zone, bin_code, qoh, qres, qavail, rp, rq, unit, cost, val in stock_records:
            safe_exec("""
                INSERT INTO inventory_stock_levels (id, part_number, part_description, item_type, warehouse_code, zone_code, bin_code, qty_on_hand, qty_reserved, qty_available, reorder_point, reorder_qty, unit, unit_cost, total_value, tenant_id, created_at, updated_at)
                VALUES (:id, :pnum, :desc, :itype, :wh, :zone, :bin_code, :qoh, :qres, :qavail, :rp, :rq, :unit, :cost, :val, :tid, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET qty_on_hand = EXCLUDED.qty_on_hand, total_value = EXCLUDED.total_value
            """, {"id": sid, "pnum": pnum, "desc": desc, "itype": itype, "wh": wh, "zone": zone, "bin_code": bin_code, "qoh": qoh, "qres": qres, "qavail": qavail, "rp": rp, "rq": rq, "unit": unit, "cost": cost, "val": val, "tid": tenant_id})

        movements = [
            (str(uuid.uuid4()), "MOV-20260721-01", "RECEIPT", "RM-STEEL-316L", "RM", None, None, "MAIN", "RM-A-01", 500, "kg", 180, "PO", "PO-2026-001", "Goods Receipt against Tata Steel PO", "Sunil Verma (EMP-1003)"),
            (str(uuid.uuid4()), "MOV-20260721-02", "RECEIPT", "601-0-000001-99", "FG", "MAIN", "WIP-B-02", "FG-WH", "FG-A-01", 18, "pcs", 1250, "PRODUCTION_ORDER", "PRD-20260721-01", "Shop Floor Output Completion", "Anita Sharma (EMP-1004)"),
            (str(uuid.uuid4()), "MOV-20260721-03", "SCRAP", "601-0-000001-88", "NG", "MAIN", "WIP-B-02", "QC-WH", "QUARANTINE", 2, "pcs", 100, "PRODUCTION_ORDER", "PRD-20260721-01", "Quality Defect Rejection", "Vikram Singh (EMP-1005)"),
        ]

        for mid, mno, mtype, pnum, itype, fwh, fbin, twh, tbin, qty, unit, cost, reftype, refno, reason, by in movements:
            safe_exec("""
                INSERT INTO inventory_stock_movements (id, movement_no, movement_type, part_number, item_type, from_warehouse_code, from_bin_code, to_warehouse_code, to_bin_code, qty, unit, unit_cost, reference_type, reference_no, reason, performed_by, tenant_id, created_at)
                VALUES (:id, :mno, :mtype, :pnum, :itype, :fwh, :fbin, :twh, :tbin, :qty, :unit, :cost, :reftype, :refno, :reason, :by, :tid, NOW())
                ON CONFLICT (id) DO NOTHING
            """, {"id": mid, "mno": mno, "mtype": mtype, "pnum": pnum, "itype": itype, "fwh": fwh, "fbin": fbin, "twh": twh, "tbin": tbin, "qty": qty, "unit": unit, "cost": cost, "reftype": reftype, "refno": refno, "reason": reason, "by": by, "tid": tenant_id})

        safe_exec("""
            INSERT INTO inventory_batches (id, batch_no, part_number, supplier_lot, manufacture_date, expiry_date, qty_received, qty_remaining, warehouse_code, bin_code, status, tenant_id)
            VALUES (:id, 'BAT-CRK-202606', '601-0-000001-99', 'LOT-TATA-88', '2026-06-01', '2028-06-01', 50, 50, 'FG-WH', 'FG-A-01', 'active', :tid)
            ON CONFLICT (id) DO NOTHING
        """, {"id": str(uuid.uuid4()), "tid": tenant_id})

        for i in range(1, 6):
            sno = f"SN-CRK-2026-{i:04d}"
            safe_exec("""
                INSERT INTO inventory_serial_numbers (id, serial_no, part_number, batch_no, warehouse_code, bin_code, status, tenant_id)
                VALUES (:id, :sno, '601-0-000001-99', 'BAT-CRK-202606', 'FG-WH', 'FG-A-01', 'in_stock', :tid)
                ON CONFLICT (id) DO NOTHING
            """, {"id": str(uuid.uuid4()), "sno": sno, "tid": tenant_id})

        # 6B. STOCK CHECK-INS, IQC INSPECTION & LOCATIONS
        print("6B. Seeding Stock Check-Ins, IQC Quality Inspection, Locations & Bin Scans...")
        safe_exec("""
            CREATE TABLE IF NOT EXISTS inventory_stock_checkins (
                id VARCHAR(36) PRIMARY KEY,
                checkin_no VARCHAR(50) NOT NULL,
                po_no VARCHAR(50) NOT NULL,
                supplier_code VARCHAR(50) NOT NULL,
                supplier_name VARCHAR(200) NOT NULL,
                part_or_rm_code VARCHAR(100) NOT NULL,
                item_description TEXT DEFAULT '',
                ordered_qty NUMERIC(14,4) NOT NULL,
                received_qty NUMERIC(14,4) NOT NULL,
                checkin_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                checked_in_by VARCHAR(100) DEFAULT 'Rajesh Kumar (EMP-1002)',
                iqc_status VARCHAR(50) DEFAULT 'pending_iqc',
                iqc_passed_qty NUMERIC(14,4) DEFAULT 0,
                iqc_rejected_qty NUMERIC(14,4) DEFAULT 0,
                iqc_scrap_qty NUMERIC(14,4) DEFAULT 0,
                iqc_time TIMESTAMP,
                iqc_elapsed_min INT DEFAULT 0,
                iqc_remarks TEXT DEFAULT '',
                iqc_inspector VARCHAR(100) DEFAULT '',
                location_code VARCHAR(100) DEFAULT '',
                warehouse_code VARCHAR(20) DEFAULT 'MAIN',
                bin_code VARCHAR(30) DEFAULT '',
                qr_code_data TEXT DEFAULT '',
                is_deleted BOOLEAN DEFAULT false,
                tenant_id VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS inventory_locations (
                id VARCHAR(36) PRIMARY KEY,
                location_code VARCHAR(100) NOT NULL,
                plant VARCHAR(100) DEFAULT 'Plant 1',
                floor_name VARCHAR(50) DEFAULT 'Ground Floor',
                shelf_name VARCHAR(50) DEFAULT 'Shelf A',
                row_name VARCHAR(50) DEFAULT 'Row 01',
                column_name VARCHAR(50) DEFAULT 'Col 01',
                bin_code VARCHAR(50) DEFAULT 'RM-A-01',
                warehouse_code VARCHAR(20) DEFAULT 'MAIN',
                capacity NUMERIC(14,4) DEFAULT 1000,
                current_occupancy NUMERIC(14,4) DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                is_deleted BOOLEAN DEFAULT false,
                tenant_id VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS warehouse_bin_scans (
                id VARCHAR(36) PRIMARY KEY,
                bin_code VARCHAR(50) NOT NULL,
                warehouse_code VARCHAR(20) DEFAULT 'MAIN',
                scan_action VARCHAR(50) NOT NULL,
                part_number VARCHAR(100) NOT NULL,
                qty NUMERIC(14,4) NOT NULL,
                performer_name VARCHAR(100) DEFAULT 'Sunil Verma (EMP-1003)',
                scan_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                remarks TEXT DEFAULT '',
                tenant_id VARCHAR(100) NOT NULL
            );
        """)

        chk1_id = str(uuid.uuid4())
        chk2_id = str(uuid.uuid4())
        safe_exec("""
            INSERT INTO inventory_stock_checkins (id, checkin_no, po_no, supplier_code, supplier_name, part_or_rm_code, item_description, ordered_qty, received_qty, checked_in_by, iqc_status, iqc_passed_qty, iqc_rejected_qty, iqc_scrap_qty, iqc_time, iqc_elapsed_min, iqc_remarks, iqc_inspector, location_code, warehouse_code, bin_code, qr_code_data, tenant_id)
            VALUES 
            (:c1, 'CHK-20260721-01', 'PO-PUR-20260721-01', 'SUP-101', 'Tata Steel Industrial Solutions', 'RM-STEEL-316L', 'Forged Alloy Steel Bar 316L', 50, 50, 'Rajesh Kumar (EMP-1002)', 'passed', 48, 2, 0, NOW(), 15, 'IQC Approved: 48 units OK, 2 units rejected with surface pit defects transferred to Quarantine', 'Vikram Singh (EMP-1005)', 'P1-F1-S1-R01-C01', 'MAIN', 'RM-A-01', 'QR-PO-PUR-20260721-01|RM-STEEL-316L|QTY:50|SUP:SUP-101', :tid),
            (:c2, 'CHK-20260721-02', 'PO-PUR-20260721-02', 'SUP-102', 'Jindal Precision Castings Ltd', '601-0-000001', 'Engine Crankshaft Base Part', 20, 20, 'Rajesh Kumar (EMP-1002)', 'pending_iqc', 0, 0, 0, NULL, 0, '', '', '', 'MAIN', 'WIP-B-02', 'QR-PO-PUR-20260721-02|601-0-000001|QTY:20|SUP:SUP-102', :tid)
            ON CONFLICT (id) DO NOTHING
        """, {"c1": chk1_id, "c2": chk2_id, "tid": tenant_id})

        safe_exec("""
            INSERT INTO inventory_locations (id, location_code, plant, floor_name, shelf_name, row_name, column_name, bin_code, warehouse_code, capacity, current_occupancy, tenant_id)
            VALUES 
            (:l1, 'P1-F1-S1-R01-C01', 'Plant 1', 'Ground Floor', 'Shelf A1', 'Row 01', 'Col 01', 'RM-A-01', 'MAIN', 1000, 450, :tid),
            (:l2, 'P1-F1-S2-R02-C01', 'Plant 1', 'Ground Floor', 'Shelf A2', 'Row 02', 'Col 01', 'WIP-B-02', 'MAIN', 500, 100, :tid),
            (:l3, 'P2-F2-S1-R01-C01', 'Plant 2', 'First Floor', 'Shelf B1', 'Row 01', 'Col 01', 'FG-A-01', 'FG-WH', 2000, 50, :tid),
            (:l4, 'P1-F1-SQ-R01-C01', 'Plant 1', 'Ground Floor', 'Quarantine Rack', 'Row Q1', 'Col Q1', 'QUARANTINE', 'QC-WH', 200, 4, :tid)
            ON CONFLICT (id) DO NOTHING
        """, {"l1": str(uuid.uuid4()), "l2": str(uuid.uuid4()), "l3": str(uuid.uuid4()), "l4": str(uuid.uuid4()), "tid": tenant_id})

        safe_exec("""
            INSERT INTO warehouse_bin_scans (id, bin_code, warehouse_code, scan_action, part_number, qty, performer_name, remarks, tenant_id)
            VALUES 
            (:bs1, 'RM-A-01', 'MAIN', 'add', 'RM-STEEL-316L', 50, 'Sunil Verma (EMP-1003)', 'Scanned bin QR code and added 50 kg raw material', :tid),
            (:bs2, 'QUARANTINE', 'QC-WH', 'allot', '601-0-000001-88', 2, 'Vikram Singh (EMP-1005)', 'Allotted 2 NG units to Quarantine bin', :tid)
            ON CONFLICT (id) DO NOTHING
        """, {"bs1": str(uuid.uuid4()), "bs2": str(uuid.uuid4()), "tid": tenant_id})

        # 7. WAREHOUSE MANAGEMENT
        print("7. Seeding Warehouse Zones, Bins with QR, Pick Lists, Putaways & Receipts...")

        zones = [
            (str(uuid.uuid4()), "Z-RM", "Raw Material Staging Zone", "RM", "MAIN", 1000),
            (str(uuid.uuid4()), "Z-WIP", "Work In Progress Assembly Zone", "WIP", "MAIN", 500),
            (str(uuid.uuid4()), "Z-FG", "Finished Goods High Bay Rack Zone", "FG", "FG-WH", 2000),
            (str(uuid.uuid4()), "Z-QC", "Quality Holding Quarantine Zone", "QC", "QC-WH", 300),
        ]

        for zid, zcode, name, ztype, wh, cap in zones:
            safe_exec("""
                INSERT INTO warehouse_zones (id, zone_code, name, zone_type, warehouse_code, capacity_units, tenant_id)
                VALUES (:id, :zcode, :name, :ztype, :wh, :cap, :tid)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """, {"id": zid, "zcode": zcode, "name": name, "ztype": ztype, "wh": wh, "cap": cap, "tid": tenant_id})

        bins = [
            (str(uuid.uuid4()), "RM-A-01", "Z-RM", "MAIN", "A", "01", "01", 500, 50, "/warehouse/bin/RM-A-01"),
            (str(uuid.uuid4()), "WIP-B-02", "Z-WIP", "MAIN", "B", "02", "01", 300, 20, "/warehouse/bin/WIP-B-02"),
            (str(uuid.uuid4()), "FG-A-01", "Z-FG", "FG-WH", "A", "01", "01", 1000, 50, "/warehouse/bin/FG-A-01"),
            (str(uuid.uuid4()), "QUARANTINE", "Z-QC", "QC-WH", "Q", "01", "01", 200, 4, "/warehouse/bin/QUARANTINE"),
        ]

        for bid, bcode, zcode, wh, aisle, rack, lvl, cap, curr, qr in bins:
            safe_exec("""
                INSERT INTO warehouse_bins (id, bin_code, zone_code, warehouse_code, aisle, rack, level, capacity_units, current_units, qr_data, tenant_id)
                VALUES (:id, :bcode, :zcode, :wh, :aisle, :rack, :lvl, :cap, :curr, :qr, :tid)
                ON CONFLICT (id) DO UPDATE SET bin_code = EXCLUDED.bin_code, current_units = EXCLUDED.current_units
            """, {"id": bid, "bcode": bcode, "zcode": zcode, "wh": wh, "aisle": aisle, "rack": rack, "lvl": lvl, "cap": cap, "curr": curr, "qr": qr, "tid": tenant_id})

        pkl_id = str(uuid.uuid4())
        safe_exec("""
            INSERT INTO warehouse_pick_lists (id, list_no, reference_type, reference_no, warehouse_code, assigned_to, due_date, status, tenant_id)
            VALUES (:id, 'PKL-PRD-20260721', 'PRODUCTION_ORDER', 'PRD-20260721-01', 'MAIN', 'Sunil Verma (EMP-1003)', '2026-07-22', 'in_progress', :tid)
            ON CONFLICT (id) DO NOTHING
        """, {"id": pkl_id, "tid": tenant_id})

        safe_exec("""
            INSERT INTO warehouse_pick_list_items (id, pick_list_id, part_number, part_description, bin_code, qty_required, qty_picked, status, tenant_id)
            VALUES (:id, :pid, 'RM-STEEL-316L', 'Steel Alloy Bar 316L', 'RM-A-01', 24, 24, 'picked', :tid)
            ON CONFLICT (id) DO NOTHING
        """, {"id": str(uuid.uuid4()), "pid": pkl_id, "tid": tenant_id})

        safe_exec("""
            INSERT INTO warehouse_receipts (id, receipt_no, po_number, supplier_name, warehouse_code, receipt_date, status, tenant_id)
            VALUES (:id, 'REC-20260721-01', 'PO-2026-001', 'Tata Steel Industrial Solutions', 'MAIN', '2026-07-21', 'received', :tid)
            ON CONFLICT (id) DO NOTHING
        """, {"id": str(uuid.uuid4()), "tid": tenant_id})

        safe_exec("""
            INSERT INTO warehouse_shipments (id, shipment_no, customer_name, delivery_address, warehouse_code, dispatch_date, carrier, tracking_no, status, tenant_id)
            VALUES (:id, 'SHP-2026-001', 'Bosch Motor Works India', 'Plot 45, Auto Hub, Pune', 'FG-WH', '2026-07-21', 'BlueDart Logistics', 'TRK-BLUE-998877', 'dispatched', :tid)
            ON CONFLICT (id) DO NOTHING
        """, {"id": str(uuid.uuid4()), "tid": tenant_id})

        # 8. MANUFACTURING MANAGEMENT
        print("8. Seeding Manufacturing BOM, Routings (-01 to -80), Work Centers & Shop Floor execution...")

        bom_id = str(uuid.uuid4())
        safe_exec("""
            INSERT INTO manufacturing_boms (id, bom_no, fg_part_number, fg_description, version, effective_date, status, yield_qty, unit, tenant_id)
            VALUES (:id, 'BOM-601-0-000001-99', '601-0-000001-99', 'Finished Engine Crankshaft Assembly', '1.0', '2026-01-01', 'active', 1, 'pcs', :tid)
            ON CONFLICT (id) DO NOTHING
        """, {"id": bom_id, "tid": tenant_id})

        safe_exec("""
            INSERT INTO manufacturing_bom_lines (id, bom_id, sequence, component_type, component_no, component_description, qty_per, unit, scrap_factor, operation_ref, tenant_id)
            VALUES 
            (:bl1, :bid, 10, 'RM', 'RM-STEEL-316L', 'Steel Alloy Bar 316L', 1.2, 'kg', 5, '-01', :tid),
            (:bl2, :bid, 20, 'PART', '601-0-000001', 'Engine Crankshaft Machined Body', 1.0, 'pcs', 0, '-02', :tid)
            ON CONFLICT (id) DO NOTHING
        """, {"bl1": str(uuid.uuid4()), "bl2": str(uuid.uuid4()), "bid": bom_id, "tid": tenant_id})

        rtg_id = str(uuid.uuid4())
        safe_exec("""
            INSERT INTO manufacturing_routings (id, routing_no, part_number, part_description, version, status, tenant_id)
            VALUES (:id, 'RTG-601-0-000001', '601-0-000001', 'Precision Crankshaft 3-Step Manufacturing Routing', '1.0', 'active', :tid)
            ON CONFLICT (id) DO NOTHING
        """, {"id": rtg_id, "tid": tenant_id})

        sub_ops_op1 = json.dumps([{"code": "-01-01", "name": "Raw Bar Material Inspection"}, {"code": "-01-02", "name": "Precision Saw Blanking"}])
        sub_ops_op2 = json.dumps([{"code": "-02-01", "name": "Journal Facing & Centering"}, {"code": "-02-02", "name": "Counterweight CNC Milling"}])
        sub_ops_op3 = json.dumps([{"code": "-03-01", "name": "Induction Hardening Inspection"}, {"code": "-03-02", "name": "Micro-Finish Journal Grinding"}])

        routing_steps = [
            (str(uuid.uuid4()), rtg_id, 10, "-01", "Op -01: Blanking & Rough Turning", "MAC-LATHE-02", "Mazak Turning Center", 15, 3, sub_ops_op1),
            (str(uuid.uuid4()), rtg_id, 20, "-02", "Op -02: CNC Milling & Drilling", "MAC-CNC-01", "Haas 5-Axis CNC", 30, 6, sub_ops_op2),
            (str(uuid.uuid4()), rtg_id, 30, "-03", "Op -03: Precision Journal Grinding", "MAC-GRIND-03", "Studer Cylindrical Grinder", 20, 4, sub_ops_op3),
        ]

        for rsid, rtid, seq, opcode, opname, wccode, wcname, setup, run_t, sub_json in routing_steps:
            safe_exec("""
                INSERT INTO manufacturing_routing_steps (id, routing_id, sequence, operation_code, operation_name, work_center_code, work_center_name, setup_time_min, run_time_min_per_unit, sub_operations, tenant_id)
                VALUES (:id, :rtid, :seq, :opcode, :opname, :wccode, :wcname, :setup, :run_t, :sub_json, :tid)
                ON CONFLICT (id) DO NOTHING
            """, {"id": rsid, "rtid": rtid, "seq": seq, "opcode": opcode, "opname": opname, "wccode": wccode, "wcname": wcname, "setup": setup, "run_t": run_t, "sub_json": sub_json, "tid": tenant_id})

        safe_exec("""
            INSERT INTO manufacturing_production_orders (id, order_no, fg_part_number, fg_description, bom_id, routing_id, planned_qty, produced_qty, rejected_qty, planned_start, planned_end, status, priority, tenant_id)
            VALUES (:id, 'PRD-20260721-01', '601-0-000001-99', 'Finished Engine Crankshaft Assembly', :bom_id, :rtg_id, 20, 18, 2, '2026-07-21', '2026-07-24', 'in_progress', 'high', :tid)
            ON CONFLICT (id) DO UPDATE SET produced_qty = EXCLUDED.produced_qty, rejected_qty = EXCLUDED.rejected_qty
        """, {"id": str(uuid.uuid4()), "bom_id": bom_id, "rtg_id": rtg_id, "tid": tenant_id})

        safe_exec("""
            INSERT INTO manufacturing_shop_floor_logs (id, production_order_no, part_number, operation_code, work_center_code, operator, qty_produced, qty_rejected, rejection_reason, actual_time_min, status, tenant_id)
            VALUES 
            (:sfl1, 'PRD-20260721-01', '601-0-000001', '-01', 'MAC-LATHE-02', 'Anita Sharma (EMP-1004)', 20, 0, 'Clean blanking', 75, 'completed', :tid),
            (:sfl2, 'PRD-20260721-01', '601-0-000001', '-02', 'MAC-CNC-01', 'Anita Sharma (EMP-1004)', 18, 2, 'Casting porosity defect on 2 units -> NG -88', 150, 'completed', :tid)
            ON CONFLICT (id) DO NOTHING
        """, {"sfl1": str(uuid.uuid4()), "sfl2": str(uuid.uuid4()), "tid": tenant_id})

        # 8. PURCHASE MANAGEMENT DEMO DATA
        print("8. Seeding Purchase Management tables, Demands, Supplier Rules, Requisitions, & POs with Lead Time Revisions...")
        safe_exec("""
            CREATE TABLE IF NOT EXISTS purchase_customer_demands (
                id VARCHAR(36) PRIMARY KEY,
                demand_no VARCHAR(50) NOT NULL,
                customer_name VARCHAR(200) NOT NULL,
                part_or_rm_code VARCHAR(100) NOT NULL,
                rm_code VARCHAR(100) DEFAULT 'RM-STEEL-316L',
                rm_description TEXT DEFAULT 'Forged Alloy Steel Bar 316L',
                item_type VARCHAR(20) DEFAULT 'PART',
                item_description TEXT DEFAULT '',
                ordered_qty NUMERIC(14,4) NOT NULL,
                available_stock NUMERIC(14,4) DEFAULT 0,
                occupy_option VARCHAR(20) DEFAULT 'do_not_occupy',
                occupied_qty NUMERIC(14,4) DEFAULT 0,
                remaining_stock NUMERIC(14,4) DEFAULT 0,
                qty_to_buy NUMERIC(14,4) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                notes TEXT DEFAULT '',
                is_deleted BOOLEAN DEFAULT false,
                tenant_id VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            ALTER TABLE purchase_customer_demands ADD COLUMN IF NOT EXISTS rm_code VARCHAR(100) DEFAULT 'RM-STEEL-316L';
            ALTER TABLE purchase_customer_demands ADD COLUMN IF NOT EXISTS rm_description TEXT DEFAULT 'Forged Alloy Steel Bar 316L';

            CREATE TABLE IF NOT EXISTS purchase_supplier_quotations (
                id VARCHAR(36) PRIMARY KEY,
                part_or_rm_code VARCHAR(100) NOT NULL,
                supplier_code VARCHAR(50) NOT NULL,
                supplier_name VARCHAR(200) NOT NULL,
                unit_price NUMERIC(14,4) NOT NULL,
                lead_time_days INT DEFAULT 7,
                min_order_qty NUMERIC(14,4) DEFAULT 1,
                sop_price NUMERIC(14,4) DEFAULT 0,
                sqp_pack NUMERIC(14,4) DEFAULT 1,
                is_active BOOLEAN DEFAULT true,
                is_deleted BOOLEAN DEFAULT false,
                tenant_id VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS purchase_requisitions (
                id VARCHAR(36) PRIMARY KEY,
                req_no VARCHAR(50) NOT NULL,
                demand_no VARCHAR(50),
                part_or_rm_code VARCHAR(100) NOT NULL,
                item_description TEXT DEFAULT '',
                required_qty NUMERIC(14,4) NOT NULL,
                supplier_code VARCHAR(50) NOT NULL,
                supplier_name VARCHAR(200) NOT NULL,
                unit_price NUMERIC(14,4) NOT NULL,
                moq NUMERIC(14,4) DEFAULT 1,
                sqp NUMERIC(14,4) DEFAULT 1,
                total_amount NUMERIC(14,4) NOT NULL,
                requested_by VARCHAR(100) DEFAULT 'Purchaser',
                status VARCHAR(50) DEFAULT 'pending',
                notes TEXT DEFAULT '',
                is_deleted BOOLEAN DEFAULT false,
                tenant_id VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS purchase_orders (
                id VARCHAR(36) PRIMARY KEY,
                po_no VARCHAR(50) NOT NULL,
                req_no VARCHAR(50),
                supplier_code VARCHAR(50) NOT NULL,
                supplier_name VARCHAR(200) NOT NULL,
                part_or_rm_code VARCHAR(100) NOT NULL,
                item_description TEXT DEFAULT '',
                order_qty NUMERIC(14,4) NOT NULL,
                unit_price NUMERIC(14,4) NOT NULL,
                total_amount NUMERIC(14,4) NOT NULL,
                lead_time_days INT DEFAULT 7,
                promised_delivery_date DATE,
                lead_time_change_count INT DEFAULT 0,
                status VARCHAR(50) DEFAULT 'released',
                remarks TEXT DEFAULT '',
                is_deleted BOOLEAN DEFAULT false,
                tenant_id VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS purchase_lead_time_history (
                id VARCHAR(36) PRIMARY KEY,
                po_id VARCHAR(36) NOT NULL,
                po_no VARCHAR(50) NOT NULL,
                old_lead_time_days INT NOT NULL,
                new_lead_time_days INT NOT NULL,
                change_reason VARCHAR(200) DEFAULT '',
                remarks TEXT DEFAULT '',
                changed_by VARCHAR(100) DEFAULT 'Purchaser',
                changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                tenant_id VARCHAR(100) NOT NULL
            );
        """)

        # Seed Customer Demands (Customer orders Part Code, mapped to RM Code)
        safe_exec("""
            INSERT INTO purchase_customer_demands (id, demand_no, customer_name, part_or_rm_code, rm_code, rm_description, item_type, item_description, ordered_qty, available_stock, occupy_option, occupied_qty, remaining_stock, qty_to_buy, status, notes, tenant_id)
            VALUES 
            (:d1, 'DEM-20260721-01', 'Bosch Motor Works', '601-0-000001-99', 'RM-STEEL-316L', 'Forged Alloy Steel Bar 316L', 'PART', 'Finished Engine Crankshaft Assembly', 500, 450, 'occupy', 450, 0, 50, 'pending', 'Customer part order requiring raw material steel 316L stock occupation', :tid),
            (:d2, 'DEM-20260721-02', 'Hero MotoCorp Industrial', '601-0-000001', 'RM-STEEL-316L', 'Forged Alloy Steel Bar 316L', 'PART', 'Engine Crankshaft Base Part', 30, 100, 'do_not_occupy', 0, 100, 30, 'pending', 'Do not occupy option selected - full order queued to buy RM', :tid)
            ON CONFLICT (id) DO NOTHING
        """, {"d1": str(uuid.uuid4()), "d2": str(uuid.uuid4()), "tid": tenant_id})

        # Seed Supplier SOP / SQP Rules (Raw Material suppliers & Part casting suppliers)
        safe_exec("""
            INSERT INTO purchase_supplier_quotations (id, part_or_rm_code, supplier_code, supplier_name, unit_price, lead_time_days, min_order_qty, sop_price, sqp_pack, tenant_id)
            VALUES 
            (:s1, 'RM-STEEL-316L', 'SUP-101', 'Tata Steel Industrial Solutions', 180, 7, 50, 180, 10, :tid),
            (:s2, '601-0-000001', 'SUP-102', 'Jindal Precision Castings Ltd', 450, 10, 20, 450, 5, :tid)
            ON CONFLICT (id) DO NOTHING
        """, {"s1": str(uuid.uuid4()), "s2": str(uuid.uuid4()), "tid": tenant_id})

        # Seed Requisition Orders
        safe_exec("""
            INSERT INTO purchase_requisitions (id, req_no, demand_no, part_or_rm_code, item_description, required_qty, supplier_code, supplier_name, unit_price, moq, sqp, total_amount, requested_by, status, notes, tenant_id)
            VALUES 
            (:r1, 'REQ-20260721-01', 'DEM-20260721-01', 'RM-STEEL-316L', 'Forged Alloy Steel Bar 316L', 50, 'SUP-101', 'Tata Steel Industrial Solutions', 180, 50, 10, 9000, 'Purchaser', 'converted_to_po', 'Shortage purchase requisition', :tid)
            ON CONFLICT (id) DO NOTHING
        """, {"r1": str(uuid.uuid4()), "tid": tenant_id})

        # Seed Purchase Order with Lead Time History
        po_demo_id = str(uuid.uuid4())
        safe_exec("""
            INSERT INTO purchase_orders (id, po_no, req_no, supplier_code, supplier_name, part_or_rm_code, item_description, order_qty, unit_price, total_amount, lead_time_days, promised_delivery_date, lead_time_change_count, status, remarks, tenant_id)
            VALUES 
            (:poid, 'PO-PUR-20260721-01', 'REQ-20260721-01', 'SUP-101', 'Tata Steel Industrial Solutions', 'RM-STEEL-316L', 'Forged Alloy Steel Bar 316L', 50, 180, 9000, 12, '2026-08-02', 2, 'released', 'Revised LT (12d): Supplier shipment delay due to freight logistics', :tid)
            ON CONFLICT (id) DO NOTHING
        """, {"poid": po_demo_id, "tid": tenant_id})

        safe_exec("""
            INSERT INTO purchase_lead_time_history (id, po_id, po_no, old_lead_time_days, new_lead_time_days, change_reason, remarks, changed_by, tenant_id)
            VALUES 
            (:h1, :poid, 'PO-PUR-20260721-01', 7, 10, 'Supplier shipment delay', 'Port congestion delayed vessel arrival by 3 days', 'Mandeep Siwach', :tid),
            (:h2, :poid, 'PO-PUR-20260721-01', 10, 12, 'Customs / Freight clearance delay', 'Customs documentation inspection added 2 extra days', 'Mandeep Siwach', :tid)
            ON CONFLICT (id) DO NOTHING
        """, {"h1": str(uuid.uuid4()), "h2": str(uuid.uuid4()), "poid": po_demo_id, "tid": tenant_id})

        # Seed Purchase Module Access
        for uid, role in [(u1_id, 'module_admin'), (u2_id, 'editor'), (u3_id, 'viewer')]:
            safe_exec("""
                INSERT INTO iam.module_access (id, user_id, module, role, permissions, tenant_id)
                VALUES (:id, :uid, 'Purchase Management', :role, '{"sections": ["overview", "demand", "suppliers", "requisitions", "orders", "auditlogs", "moduleusers"]}', :tid)
                ON CONFLICT (id) DO NOTHING
            """, {"id": str(uuid.uuid4()), "uid": uid, "role": role, "tid": tenant_id})

        # 9. QUALITY MANAGEMENT (IQC Criteria, IQC Inspections, NCRs)
        print("9. Seeding Quality Management (IQC Inspection Criteria Master, IQC Records & NCRs)...")
        safe_exec("""
            CREATE TABLE IF NOT EXISTS quality_iqc_criteria (
                id VARCHAR(36) PRIMARY KEY,
                part_or_rm_code VARCHAR(100) NOT NULL,
                criterion_name VARCHAR(200) NOT NULL,
                spec_target VARCHAR(100) DEFAULT '',
                tolerance_min VARCHAR(50) DEFAULT '',
                tolerance_max VARCHAR(50) DEFAULT '',
                inspection_method VARCHAR(100) DEFAULT 'Vernier Caliper / Micrometer',
                is_mandatory BOOLEAN DEFAULT true,
                is_deleted BOOLEAN DEFAULT false,
                tenant_id VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS quality_ncrs (
                id VARCHAR(36) PRIMARY KEY,
                ncr_no VARCHAR(50) NOT NULL,
                checkin_no VARCHAR(50),
                part_or_rm_code VARCHAR(100) NOT NULL,
                supplier_name VARCHAR(200),
                rejected_qty NUMERIC(14,4) DEFAULT 0,
                defect_type VARCHAR(100) DEFAULT 'Dimensional Variation',
                severity VARCHAR(50) DEFAULT 'Major',
                root_cause TEXT DEFAULT '',
                corrective_action TEXT DEFAULT '',
                disposition VARCHAR(50) DEFAULT 'Return to Vendor (RTV)',
                status VARCHAR(50) DEFAULT 'open',
                raised_by VARCHAR(100) DEFAULT 'Vikram Singh (EMP-1005)',
                is_deleted BOOLEAN DEFAULT false,
                tenant_id VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Seed IQC Criteria Master
        c1_id = str(uuid.uuid4())
        c2_id = str(uuid.uuid4())
        c3_id = str(uuid.uuid4())
        safe_exec("""
            INSERT INTO quality_iqc_criteria (id, part_or_rm_code, criterion_name, spec_target, tolerance_min, tolerance_max, inspection_method, is_mandatory, tenant_id)
            VALUES 
            (:c1, 'RM-STEEL-316L', 'Bar Outer Diameter (OD)', '50.0 mm', '49.95 mm', '50.05 mm', 'Digital Vernier Caliper', true, :tid),
            (:c2, 'RM-STEEL-316L', 'Material Hardness Test', '60 HRC', '58 HRC', '62 HRC', 'Rockwell Hardness Tester', true, :tid),
            (:c3, '601-0-000001', 'Journal Surface Roughness', 'Ra 0.4 µm', 'Ra 0.2 µm', 'Ra 0.6 µm', 'Surface Roughness Tester', true, :tid)
            ON CONFLICT (id) DO NOTHING
        """, {"c1": c1_id, "c2": c2_id, "c3": c3_id, "tid": tenant_id})

        # Seed Non-Conformance Report (NCR)
        ncr1_id = str(uuid.uuid4())
        safe_exec("""
            INSERT INTO quality_ncrs (id, ncr_no, checkin_no, part_or_rm_code, supplier_name, rejected_qty, defect_type, severity, root_cause, corrective_action, disposition, status, raised_by, tenant_id)
            VALUES 
            (:n1, 'NCR-20260721-01', 'CHK-20260721-01', 'RM-STEEL-316L', 'Tata Steel Industrial Solutions', 2, 'Surface Pit Defect & OD Undersize', 'Major', 'Inadequate cooling bath during bar drawing operation at supplier mill', 'Supplier CAPA requested; replace 2 bars', 'Return to Vendor (RTV)', 'open', 'Vikram Singh (EMP-1005)', :tid)
            ON CONFLICT (id) DO NOTHING
        """, {"n1": ncr1_id, "tid": tenant_id})

        print("\n=== Demo Data Seeded Successfully across All Modules! ===")

if __name__ == "__main__":
    seed_full_demo_data()

