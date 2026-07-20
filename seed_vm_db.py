import sys
import uuid
import bcrypt
from datetime import datetime

sys.path.insert(0, '.')
from app import create_app
from extensions import db
from core.auth.models import User, Role, Tenant, Policy
from core.super_admin.models import SuperAdmin

app = create_app()

def init_vm_database():
    with app.app_context():
        print("1. Creating database tables & schemas...")
        db.create_all()

        print("2. Ensuring default tenant exists...")
        tenant = Tenant.query.filter_by(code="TEST").first()
        if not tenant:
            tenant = Tenant(
                id=str(uuid.uuid4()),
                name="Test Corp",
                code="TEST",
                is_active=True
            )
            db.session.add(tenant)
            db.session.commit()
            print("   -> Created tenant: Test Corp (TEST)")
        else:
            print("   -> Tenant TEST already exists.")

        print("3. Ensuring default Super Admin exists...")
        sa = SuperAdmin.query.filter_by(email="orgadmin@acme.com").first()
        sa_pwd_hash = bcrypt.hashpw(b"Password123!", bcrypt.gensalt()).decode()
        if not sa:
            sa = SuperAdmin(
                id=str(uuid.uuid4()),
                email="orgadmin@acme.com",
                password_hash=sa_pwd_hash,
                first_name="Platform",
                last_name="Admin",
                is_active=True,
                role="super_admin"
            )
            db.session.add(sa)
            db.session.commit()
            print("   -> Created Super Admin: orgadmin@acme.com")
        else:
            sa.password_hash = sa_pwd_hash
            db.session.commit()
            print("   -> Updated password for Super Admin: orgadmin@acme.com")

        print("4. Ensuring default Organization Admin user exists...")
        user = User.query.filter_by(email="mandeep@supersystems.in").first()
        user_pwd_hash = bcrypt.hashpw(b"Password123!", bcrypt.gensalt()).decode()
        if not user:
            user = User(
                id=str(uuid.uuid4()),
                tenant_id=tenant.id,
                email="mandeep@supersystems.in",
                password_hash=user_pwd_hash,
                first_name="Mandeep",
                last_name="Siwach",
                phone="9992662555",
                is_active=True
            )
            db.session.add(user)
            db.session.commit()
            print("   -> Created User: mandeep@supersystems.in")
        else:
            user.password_hash = user_pwd_hash
            db.session.commit()
            print("   -> Updated password for User: mandeep@supersystems.in")

        print("\n=== VM Database Setup Completed Successfully! ===")
        print("Login Credentials:")
        print("  Super Admin: orgadmin@acme.com / Password123!")
        print("  Org User:    mandeep@supersystems.in / Password123!")

if __name__ == "__main__":
    init_vm_database()
