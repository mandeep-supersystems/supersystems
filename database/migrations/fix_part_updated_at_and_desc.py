"""
Migration: Add updated_at to part tables & backfill descriptions.
Categories:
- mosfet: MOS, MOSFET, [sub category], [Value], [Drain source voltage], [Drain current], [Mounting type]
- resistor: Res, [Value], [Package], [Mounting type], [rated power], [tolerance]
- capacitor: Cap, [Sub category], [Value], [Voltage], [Package type], [Mounting type]
- connector: Conn, [sub category], [Gender], [No of pin Pin], [pitch], [orientation], [no of row Row], [connector type]
- screw: SCR, Screw, [sub category], [size], [length], [material], [finish/coating]
- washer: WAS, Washer, [sub category], [size], [material], [finish/coating]
- relay: Relay, [sub category], [value], [coil voltage], [current rating], [no. of pin Pin]
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from app import create_app, db

app = create_app()


def build_part_description(cat_code, cat_name, sub_name, row):
    def get(k):
        v = row.get(k)
        if v is None:
            return ''
        v_str = str(v).strip()
        return v_str if v_str.lower() not in ('none', 'null') else ''

    parts = []
    code = (cat_code or '').strip()
    cname = (cat_name or '').strip()
    sname = (sub_name or '').strip()
    cat_lower = cname.lower()

    if 'mosfet' in cat_lower or code == 'MOS':
        header = [code or 'MOS', cname or 'MOSFET']
        if sname and sname != cname:
            header.append(sname)
        parts.extend(header)
        for val in [get('value'), get('drain_source_voltage'), get('drain_current'), get('mounting_type')]:
            if val:
                parts.append(val)

    elif 'resistor' in cat_lower or code == 'Res':
        parts.append(code or 'Res')
        for val in [get('value'), get('package_size') or get('package'), get('mounting_type'), get('rated_power'), get('tolerance')]:
            if val:
                parts.append(val)

    elif 'capacitor' in cat_lower or code == 'Cap':
        parts.append(code or 'Cap')
        if sname:
            parts.append(sname)
        for val in [get('value'), get('voltage'), get('package_size') or get('package_height'), get('mounting_type')]:
            if val:
                parts.append(val)

    elif 'connector' in cat_lower or code in ('Con', 'Conn'):
        parts.append('Conn')
        if sname:
            parts.append(sname)
        pin_val = get('no_of_pins')
        if pin_val and not pin_val.lower().endswith(('pin', 'pins', 'p')):
            pin_val = f"{pin_val} Pin"
        row_val = get('no_of_rows')
        if row_val and not row_val.lower().endswith(('row', 'rows', 'r')):
            row_val = f"{row_val} Row"
        for val in [get('gender'), pin_val, get('pitch'), get('orientation'), row_val, get('connector_type')]:
            if val:
                parts.append(val)

    elif 'screw' in cat_lower or code == 'SCR':
        header = [code or 'SCR', cname or 'Screw']
        if sname and sname != cname:
            header.append(sname)
        parts.extend(header)
        for val in [get('size'), get('length'), get('material'), get('finish_coating')]:
            if val:
                parts.append(val)

    elif 'washer' in cat_lower or code == 'WAS':
        header = [code or 'WAS', cname or 'Washer']
        if sname and sname != cname:
            header.append(sname)
        parts.extend(header)
        for val in [get('size'), get('material'), get('finish_coating')]:
            if val:
                parts.append(val)

    elif 'relay' in cat_lower or code == 'Relay':
        header = [code or 'Relay']
        if sname and sname != cname:
            header.append(sname)
        parts.extend(header)
        pin_val = get('no_of_pins')
        if pin_val and not pin_val.lower().endswith(('pin', 'pins', 'p')):
            pin_val = f"{pin_val} Pin"
        for val in [get('value'), get('coil_voltage'), get('current_rating'), pin_val]:
            if val:
                parts.append(val)

    else:
        parts.append(code or cname)
        if sname and sname != cname:
            parts.append(sname)
        for k in ['value', 'package_size', 'voltage', 'current', 'power', 'material']:
            val = get(k)
            if val:
                parts.append(val)

    cleaned = []
    for p in parts:
        p_clean = str(p).strip(', ')
        if p_clean and p_clean not in cleaned:
            cleaned.append(p_clean)
    return ', '.join(cleaned)


def run_migration():
    with app.app_context():
        # 1. Add updated_at column to missing tables
        print("--- Step 1: Ensuring updated_at column exists across all part tables ---")
        part_tables = db.session.execute(db.text(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'part'"
        )).fetchall()

        for (tname,) in part_tables:
            has_col = db.session.execute(db.text(
                "SELECT 1 FROM information_schema.columns WHERE table_schema = 'part' AND table_name = :t AND column_name = 'updated_at'"
            ), {"t": tname}).scalar()
            if not has_col:
                print(f"Adding updated_at to part.\"{tname}\"...")
                db.session.execute(db.text(f'ALTER TABLE part."{tname}" ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()'))
                db.session.commit()
        print("All part tables verified with updated_at column.")

        # 2. Backfill descriptions for target categories
        print("\n--- Step 2: Backfilling descriptions for target categories ---")
        target_tables = [
            ('resistor_101', 'Res', 'Resistor'),
            ('capacitor_102', 'Cap', 'Capacitor'),
            ('mosfet_105', 'MOS', 'MOSFET'),
            ('connector_114', 'Conn', 'Connector'),
            ('relay_117', 'Relay', 'Relay'),
            ('screw_152', 'SCR', 'Screw'),
            ('washer_153', 'WAS', 'Washer')
        ]

        total_updated = 0
        for tbl, code, cname in target_tables:
            rows = db.session.execute(db.text(f"""
                SELECT t.*, s.name as sub_name
                FROM part."{tbl}" t
                LEFT JOIN part.subcategories s ON s.id = t.subcategory_id
            """)).fetchall()

            tbl_updated = 0
            for r in rows:
                r_dict = dict(r._mapping)
                pn = r_dict.get('part_number')
                new_desc = build_part_description(code, cname, r_dict.get('sub_name'), r_dict)
                if new_desc:
                    db.session.execute(db.text(
                        f'UPDATE part."{tbl}" SET description = :d WHERE part_number = :pn'
                    ), {"d": new_desc, "pn": pn})
                    tbl_updated += 1

            db.session.commit()
            print(f"Updated {tbl_updated} descriptions in {tbl}")
            total_updated += tbl_updated

        print(f"\nMigration complete! Total descriptions updated: {total_updated}")


if __name__ == '__main__':
    run_migration()
