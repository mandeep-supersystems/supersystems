"""
Migration: Add Length, Height, Where_used columns to Heatsink category.
Run once: python database/migrations/add_heatsink_columns.py
"""
import sys, os, json
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from app import create_app
from extensions import db

NEW_COLUMNS = [
    {"name": "length",     "label": "Length",     "type": "varchar"},
    {"name": "height",     "label": "Height",     "type": "varchar"},
    {"name": "where_used", "label": "Where Used", "type": "varchar"},
]

def run():
    app = create_app()
    with app.app_context():
        # Find Heatsink category (case-insensitive)
        row = db.session.execute(db.text(
            "SELECT id, name, series_prefix, columns_config "
            "FROM part.categories "
            "WHERE LOWER(name) = 'heatsink' AND is_deleted = false LIMIT 1"
        )).first()

        if not row:
            print("ERROR: Heatsink category not found. Check the exact name in part.categories.")
            return

        cat_id, cat_name, cat_series, cols_raw = row
        print(f"Found category: '{cat_name}' (id={cat_id}, series={cat_series})")

        # Parse existing columns_config
        if isinstance(cols_raw, list):
            existing = cols_raw
        elif cols_raw:
            existing = json.loads(cols_raw)
        else:
            existing = []

        existing_names = {c["name"].lower() for c in existing}

        # Only add columns that don't already exist
        to_add = [c for c in NEW_COLUMNS if c["name"].lower() not in existing_names]
        if not to_add:
            print("All 3 columns already exist in columns_config. Nothing to do.")
            return

        updated_cols = existing + to_add
        updated_json = json.dumps(updated_cols)

        # 1. Update part.categories columns_config
        db.session.execute(db.text(
            "UPDATE part.categories SET columns_config = :cols, updated_at = NOW() WHERE id = :id"
        ), {"cols": updated_json, "id": cat_id})
        print(f"Updated columns_config in part.categories for '{cat_name}'")

        # 2. Sync to all subcategories of this category
        db.session.execute(db.text(
            "UPDATE part.subcategories SET columns_config = :cols, updated_at = NOW() "
            "WHERE category_id = :cid AND is_deleted = false"
        ), {"cols": updated_json, "cid": cat_id})
        print("Synced columns_config to all subcategories")

        # 3. ALTER TABLE to add physical columns
        import re
        def safe_table_name(name, series):
            clean = lambda s: re.sub(r'[^a-z0-9]', '_', s.lower().strip()).strip('_')
            return f'part."{clean(name)}_{series}"'

        table_name = safe_table_name(cat_name, cat_series)
        print(f"Target table: {table_name}")

        for col in to_add:
            col_sql_name = col["name"]
            try:
                db.session.execute(db.text(
                    f'ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS "{col_sql_name}" VARCHAR(255)'
                ))
                print(f"  + Added column '{col_sql_name}' to {table_name}")
            except Exception as e:
                db.session.rollback()
                print(f"  ! Failed to add column '{col_sql_name}': {e}")

        db.session.commit()
        print("\nMigration complete.")
        print(f"Added columns: {[c['name'] for c in to_add]}")

if __name__ == "__main__":
    run()
