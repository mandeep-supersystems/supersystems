import sys
import traceback

sys.path.insert(0, '.')
from app import create_app
from extensions import db

def run_test():
    app = create_app()
    with app.app_context():
        # Setup request context
        from flask import request
        with app.test_request_context('/api/v1/manufacturing/boms/by-part/901.1.0001', headers={"X-Tenant-ID": "b424df0e-f766-4e94-b3fd-05777e158958"}):
            from modules.manufacturing.routes import get_bom_details_by_part
            print("Triggering get_bom_details_by_part...")
            try:
                res = get_bom_details_by_part("901.1.0001")
                print("Response code:", res.status_code if hasattr(res, 'status_code') else 'No status_code')
                print("Response data:", res.get_data(as_text=True) if hasattr(res, 'get_data') else res)
            except Exception as e:
                print("Exception encountered during API call:")
                traceback.print_exc()

if __name__ == "__main__":
    run_test()
