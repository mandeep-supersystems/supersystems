import sys
sys.path.insert(0, '.')
from app import create_app
from extensions import db

def check_db():
    app = create_app()
    with app.app_context():
        # Get active tenant
        tenant_id = "b424df0e-f766-4e94-b3fd-05777e158958"
        print(f"Checking BOMs in database for tenant: {tenant_id}")
        
        rows = db.session.execute(db.text(
            "SELECT id, bom_no, fg_part_number, name, status, tenant_id FROM manufacturing_boms WHERE is_deleted = false"
        )).fetchall()
        
        if not rows:
            print("No BOMs found in the database at all!")
            return
            
        print(f"Total BOMs found in database: {len(rows)}")
        for r in rows:
            print(f"- ID: {r[0]}, BOM No: {r[1]}, FG Part: {r[2]}, Name: {r[3]}, Status: {r[4]}, Tenant: {r[5]}")

if __name__ == "__main__":
    check_db()
