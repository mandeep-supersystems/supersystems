import sys, os
import json
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath("."))
from app import create_app, db

app = create_app()

CATEGORY_DESC_COLUMNS = {
    'resistor': ['value', 'package_size', 'mounting_type', 'rated_power', 'tolerance'],
    'mosfet': ['value', 'drain_source_voltage', 'drain_current', 'mounting_type'],
    'connector': ['gender', 'no_of_pins', 'pitch', 'no_of_rows', 'orientation', 'connector_type'],
    'header': ['gender', 'no_of_pins', 'pitch', 'no_of_rows', 'orientation', 'connector_type'],
    'relay': ['value', 'coil_voltage', 'current_rating', 'no_of_pins'],
    'diode': ['diode_configuration', 'forward_current', 'reverse_voltage', 'package_size', 'mounting_type'],
    'transistor': ['value', 'collector_emitter_voltage', 'dc_collector_current', 'package_size', 'mounting_type'],
    'led': ['size', 'color', 'package'],
    'switch': ['value'],
    'inductor': ['value', 'mounting_type', 'core'],
    'transformer': ['bobbin', 'core', 'no_of_pins', 'mounting_type'],
    'thermistor': ['value', 'resistance', 'mounting_type'],
    'protection': ['mounting_type', 'rated_voltage', 'current'],
    'fan': ['size_mm', 'operating_voltage', 'current_rating', 'value'],
    'heat shrink sleeve': ['size', 'colour', 'material'],
    'heatsink': ['length', 'height'],
    'stickers': ['value', 'material', 'print_format'],
    'antenna': ['antenna_type', 'value'],
    'sensor': ['value', 'mounting_type', 'current_rating'],
    'magnetics - bobbin': ['value', 'bobbin_type'],
    'magnetics - cores': ['value', 'core_type'],
    'module': ['value'],
    'lcd module': ['value']
}

with app.app_context():
    print("=== SYNCING CATEGORY DESCRIPTION_COLUMNS ===")
    cats = db.session.execute(db.text("SELECT id, name, columns_config, description_columns FROM part.categories WHERE is_deleted = false")).fetchall()

    for c in cats:
        cat_id, cat_name, cols_cfg, curr_desc_cols = c[0], c[1], c[2], c[3]
        cat_lower = cat_name.lower().strip()
        
        target_cols = CATEGORY_DESC_COLUMNS.get(cat_lower)
        if not target_cols:
            continue
        
        # Validate against actual category columns
        available_col_names = [col['name'] for col in cols_cfg] if cols_cfg else []
        valid_cols = [col for col in target_cols if col in available_col_names]
        
        if not valid_cols:
            print(f"Skipping {cat_name}: none of {target_cols} found in {available_col_names}")
            continue

        desc_json = json.dumps(valid_cols)
        print(f"Updating '{cat_name}' ({cat_id}): {valid_cols}")
        
        # Update category
        db.session.execute(db.text("""
            UPDATE part.categories 
            SET description_columns = CAST(:dc AS json), updated_at = NOW()
            WHERE id = :id
        """), {"dc": desc_json, "id": cat_id})

        # Sync to subcategories
        res = db.session.execute(db.text("""
            UPDATE part.subcategories 
            SET description_columns = CAST(:dc AS json), updated_at = NOW()
            WHERE category_id = :cid AND is_deleted = false
        """), {"dc": desc_json, "cid": cat_id})
        print(f"  Synced to {res.rowcount} subcategories")

    db.session.commit()
    print("\n=== SYNC COMPLETE ===")
