import sys, os
import json
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath("."))
from app import create_app, db
from modules.part.routes import _build_description

app = create_app()

with app.app_context():
    print("=== 1. UPDATING CATEGORIES DESCRIPTION_COLUMNS ===")
    cats = db.session.execute(db.text("""
        SELECT id, name, code, series_prefix FROM part.categories 
        WHERE (LOWER(name) = 'ic' OR LOWER(name) = 'power ic') AND is_deleted = false
    """)).fetchall()

    target_desc_cols = ["type", "package"]
    desc_cols_json = json.dumps(target_desc_cols)

    for cat in cats:
        cat_id, cat_name, cat_code, cat_series = cat[0], cat[1], cat[2], cat[3]
        print(f"Updating Category '{cat_name}' ({cat_id}) -> description_columns: {target_desc_cols}")
        db.session.execute(db.text("""
            UPDATE part.categories 
            SET description_columns = CAST(:dc AS json), updated_at = NOW()
            WHERE id = :id
        """), {"dc": desc_cols_json, "id": cat_id})

        # Sync to subcategories
        res = db.session.execute(db.text("""
            UPDATE part.subcategories 
            SET description_columns = CAST(:dc AS json), updated_at = NOW()
            WHERE category_id = :cid AND is_deleted = false
        """), {"dc": desc_cols_json, "cid": cat_id})
        print(f"  Synced to {res.rowcount} subcategories of '{cat_name}'")

    db.session.commit()

    print("\n=== 2. UPDATING PARTS WITH DEFAULT/BLANK DESCRIPTIONS ===")
    # Update IC parts
    ic_rows = db.session.execute(db.text("""
        SELECT i.part_number, s.name as sub_name, i.type, i.package, i.description
        FROM part.ic_106 i
        LEFT JOIN part.subcategories s ON i.subcategory_id = s.id
        WHERE TRIM(COALESCE(i.description, '')) IN ('IC', '')
    """)).fetchall()

    print(f"Found {len(ic_rows)} IC parts with default/blank description:")
    for r in ic_rows:
        pn, sub_name, itype, ipkg, old_desc = r[0], r[1], r[2], r[3], r[4]
        # Generate new description
        new_desc = _build_description(
            columns_config=[],
            col_values={'type': itype, 'package': ipkg},
            desc_columns=target_desc_cols,
            cat_name='IC',
            sub_name=sub_name,
            cat_code='IC'
        )
        print(f"  {pn}: '{old_desc}' -> '{new_desc}'")
        db.session.execute(db.text("""
            UPDATE part.ic_106 SET description = :desc, updated_at = NOW() WHERE part_number = :pn
        """), {"desc": new_desc, "pn": pn})

    # Update Power IC parts
    pic_rows = db.session.execute(db.text("""
        SELECT p.part_number, s.name as sub_name, p.type, p.package, p.description
        FROM part.power_ic_108 p
        LEFT JOIN part.subcategories s ON p.subcategory_id = s.id
        WHERE TRIM(COALESCE(p.description, '')) IN ('Power IC', '')
    """)).fetchall()

    print(f"\nFound {len(pic_rows)} Power IC parts with default/blank description:")
    for r in pic_rows:
        pn, sub_name, ptype, ppkg, old_desc = r[0], r[1], r[2], r[3], r[4]
        # Generate new description
        new_desc = _build_description(
            columns_config=[],
            col_values={'type': ptype, 'package': ppkg},
            desc_columns=target_desc_cols,
            cat_name='Power IC',
            sub_name=sub_name,
            cat_code='Power IC'
        )
        print(f"  {pn}: '{old_desc}' -> '{new_desc}'")
        db.session.execute(db.text("""
            UPDATE part.power_ic_108 SET description = :desc, updated_at = NOW() WHERE part_number = :pn
        """), {"desc": new_desc, "pn": pn})

    db.session.commit()
    print("\n=== UPDATES COMMITTED SUCCESSFULLY ===")
