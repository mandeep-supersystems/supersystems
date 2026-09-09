from app import create_app, db

app = create_app()

with app.app_context():
    r = db.session.execute(db.text('SELECT subcategory_id FROM part."resistor_101" WHERE part_number = :pn'), {"pn": "101.2.0002"}).first()
    sub_id = r[0] if r else None
    print("Found subcategory_id:", sub_id)

with app.test_client() as client:
    res = client.post('/api/v1/part/part-attributes-update', json={
        "part_number": "101.2.0002",
        "subcategory_id": sub_id,
        "fields": {
            "value": "75E",
            "tolerance": "1%",
            "rated_power": "0.125W",
            "rated_voltage": "150V",
            "mounting_type": "SMD",
            "package_size": "0805"
        }
    }, headers={"X-Tenant-ID": "b424df0e-f766-4e94-b3fd-05777e158958"})
    print("Status code:", res.status_code)
    print("Response JSON:", res.get_json())

