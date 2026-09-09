import sys, os
import json

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from app import create_app, db

TARGET_TABLES = [
    ("capacitor_102", "Capacitor"),
    ("mosfet_105", "MOSFET"),
    ("diode_103", "Diode"),
    ("transistor_104", "Transistor"),
    ("led_120", "LED"),
    ("switch_118", "Switch"),
    ("inductor_199", "Inductor"),
    ("transformer_110", "Transformer"),
    ("ic_106", "IC"),
    ("ic2_159", "IC2"),
    ("power_ic_108", "Power IC"),
    ("thermistor_198", "Thermistor"),
    ("relay_117", "Relay"),
    ("protection_111", "Protection"),
    ("connector_114", "Connector")
]

app = create_app()

def run_migration():
    print("=== Adding 'schematic_part' Column Migration ===")
    with app.app_context():
        # Step 1: Add column to database tables
        print("\n--- Step 1: Adding 'schematic_part' column to tables ---")
        for tbl, cat_name in TARGET_TABLES:
            try:
                db.session.execute(db.text(
                    f'ALTER TABLE part."{tbl}" ADD COLUMN IF NOT EXISTS schematic_part VARCHAR(200);'
                ))
                print(f"  [OK] part.\"{tbl}\" -> ensured 'schematic_part VARCHAR(200)'")
            except Exception as e:
                print(f"  [ERROR] part.\"{tbl}\": {e}")
                db.session.rollback()
        db.session.commit()

        # Step 2: Ensure subcategories columns_config includes schematic_part
        print("\n--- Step 2: Updating subcategories columns_config ---")
        category_names = [t[1] for t in TARGET_TABLES]
        subs = db.session.execute(db.text("""
            SELECT s.id, s.name, s.columns_config, c.name as cat_name
            FROM part.subcategories s
            JOIN part.categories c ON s.category_id = c.id
            WHERE c.name = ANY(:cats) AND s.is_deleted = false
        """), {"cats": category_names}).fetchall()

        updated_sub_count = 0
        for sub_id, sub_name, cols_cfg_raw, cat_name in subs:
            cols_cfg = []
            if isinstance(cols_cfg_raw, list):
                cols_cfg = cols_cfg_raw
            elif isinstance(cols_cfg_raw, str) and cols_cfg_raw.strip():
                try:
                    cols_cfg = json.loads(cols_cfg_raw)
                except Exception:
                    cols_cfg = []

            has_col = any(c.get("name") == "schematic_part" for c in cols_cfg if isinstance(c, dict))
            if not has_col:
                # Find appropriate position: insert after value or description if present, else append
                new_field = {"name": "schematic_part", "type": "varchar", "label": "Schematic Part"}
                
                # Insert near top after value/description if exists
                insert_idx = None
                for i, col in enumerate(cols_cfg):
                    if isinstance(col, dict) and col.get("name") in ("value", "description"):
                        insert_idx = i + 1
                if insert_idx is not None:
                    cols_cfg.insert(insert_idx, new_field)
                else:
                    cols_cfg.append(new_field)

                db.session.execute(db.text("""
                    UPDATE part.subcategories 
                    SET columns_config = CAST(:cfg AS json)
                    WHERE id = :id
                """), {"cfg": json.dumps(cols_cfg), "id": str(sub_id)})
                updated_sub_count += 1

        db.session.commit()
        print(f"Updated {updated_sub_count} subcategories with 'schematic_part' in columns_config.")

        # Step 3: Verification
        print("\n--- Step 3: Verifying Columns in Database ---")
        for tbl, _ in TARGET_TABLES:
            col_info = db.session.execute(db.text("""
                SELECT column_name, data_type, character_maximum_length, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'part' AND table_name = :tbl AND column_name = 'schematic_part';
            """), {"tbl": tbl}).first()
            if col_info:
                print(f"  Verified part.\"{tbl}\": {col_info[0]} ({col_info[1]}({col_info[2]}))")
            else:
                print(f"  MISSING part.\"{tbl}\"!")

        print("\n=== MIGRATION COMPLETE ===")

if __name__ == "__main__":
    run_migration()
