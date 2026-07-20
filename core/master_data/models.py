from extensions import db
from shared.base_model import BaseModel


class Organization(BaseModel):
    __tablename__ = "organizations"
    name = db.Column(db.String(300), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    type = db.Column(db.String(50))
    parent_id = db.Column(db.String(36), db.ForeignKey("organizations.id"))
    is_active = db.Column(db.Boolean, default=True)
    settings = db.Column(db.JSON, default={})


class Company(BaseModel):
    __tablename__ = "companies"
    name = db.Column(db.String(300), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    organization_id = db.Column(db.String(36), db.ForeignKey("organizations.id"))
    legal_name = db.Column(db.String(500))
    tax_id = db.Column(db.String(50))
    currency_code = db.Column(db.String(10))
    country_code = db.Column(db.String(10))
    is_active = db.Column(db.Boolean, default=True)


class Plant(BaseModel):
    __tablename__ = "plants"
    name = db.Column(db.String(300), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    company_id = db.Column(db.String(36), db.ForeignKey("companies.id"))
    address = db.Column(db.JSON)
    is_active = db.Column(db.Boolean, default=True)


class Warehouse(BaseModel):
    __tablename__ = "warehouses"
    name = db.Column(db.String(300), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    plant_id = db.Column(db.String(36), db.ForeignKey("plants.id"))
    type = db.Column(db.String(50))
    address = db.Column(db.JSON)
    capacity = db.Column(db.Float)
    is_active = db.Column(db.Boolean, default=True)


class Department(BaseModel):
    __tablename__ = "departments"
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    company_id = db.Column(db.String(36), db.ForeignKey("companies.id"))
    parent_id = db.Column(db.String(36), db.ForeignKey("departments.id"))
    manager_id = db.Column(db.String(36))
    is_active = db.Column(db.Boolean, default=True)


class Employee(BaseModel):
    __tablename__ = "employees"
    employee_number = db.Column(db.String(50), nullable=False)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(200))
    phone = db.Column(db.String(20))
    department_id = db.Column(db.String(36), db.ForeignKey("departments.id"))
    designation = db.Column(db.String(100))
    manager_id = db.Column(db.String(36), db.ForeignKey("employees.id"))
    date_of_joining = db.Column(db.Date)
    status = db.Column(db.String(50), default="active")


class Customer(BaseModel):
    __tablename__ = "customers"
    name = db.Column(db.String(300), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    type = db.Column(db.String(50))  # individual, corporate
    email = db.Column(db.String(200))
    phone = db.Column(db.String(20))
    tax_id = db.Column(db.String(50))
    credit_limit = db.Column(db.Numeric(18, 2))
    payment_terms = db.Column(db.String(50))
    address = db.Column(db.JSON)
    is_active = db.Column(db.Boolean, default=True)


class Vendor(BaseModel):
    __tablename__ = "vendors"
    name = db.Column(db.String(300), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    type = db.Column(db.String(50))
    email = db.Column(db.String(200))
    phone = db.Column(db.String(20))
    tax_id = db.Column(db.String(50))
    payment_terms = db.Column(db.String(50))
    bank_details = db.Column(db.JSON)
    address = db.Column(db.JSON)
    is_active = db.Column(db.Boolean, default=True)


class Supplier(BaseModel):
    __tablename__ = "suppliers"
    name = db.Column(db.String(300), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    category = db.Column(db.String(100))
    email = db.Column(db.String(200))
    phone = db.Column(db.String(20))
    rating = db.Column(db.Float)
    lead_time_days = db.Column(db.Integer)
    address = db.Column(db.JSON)
    is_active = db.Column(db.Boolean, default=True)


class Material(BaseModel):
    __tablename__ = "materials"
    name = db.Column(db.String(300), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    type = db.Column(db.String(50))  # raw, semi_finished, finished
    category = db.Column(db.String(100))
    uom = db.Column(db.String(20))
    hsn_code = db.Column(db.String(20))
    description = db.Column(db.Text)
    specifications = db.Column(db.JSON)
    is_active = db.Column(db.Boolean, default=True)


class Product(BaseModel):
    __tablename__ = "products"
    name = db.Column(db.String(300), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    category = db.Column(db.String(100))
    uom = db.Column(db.String(20))
    price = db.Column(db.Numeric(18, 2))
    cost = db.Column(db.Numeric(18, 2))
    description = db.Column(db.Text)
    specifications = db.Column(db.JSON)
    is_active = db.Column(db.Boolean, default=True)


class Service(BaseModel):
    __tablename__ = "services"
    name = db.Column(db.String(300), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    category = db.Column(db.String(100))
    rate = db.Column(db.Numeric(18, 2))
    uom = db.Column(db.String(20))
    sac_code = db.Column(db.String(20))
    is_active = db.Column(db.Boolean, default=True)


class Asset(BaseModel):
    __tablename__ = "assets"
    name = db.Column(db.String(300), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    category = db.Column(db.String(100))
    type = db.Column(db.String(50))
    location_id = db.Column(db.String(36))
    purchase_date = db.Column(db.Date)
    purchase_value = db.Column(db.Numeric(18, 2))
    current_value = db.Column(db.Numeric(18, 2))
    depreciation_method = db.Column(db.String(50))
    useful_life_years = db.Column(db.Integer)
    status = db.Column(db.String(50), default="active")


class Project(BaseModel):
    __tablename__ = "projects"
    name = db.Column(db.String(300), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text)
    manager_id = db.Column(db.String(36))
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    budget = db.Column(db.Numeric(18, 2))
    status = db.Column(db.String(50), default="planning")
    priority = db.Column(db.String(20))


class CostCenter(BaseModel):
    __tablename__ = "cost_centers"
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    company_id = db.Column(db.String(36), db.ForeignKey("companies.id"))
    parent_id = db.Column(db.String(36), db.ForeignKey("cost_centers.id"))
    manager_id = db.Column(db.String(36))
    is_active = db.Column(db.Boolean, default=True)


class ProfitCenter(BaseModel):
    __tablename__ = "profit_centers"
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    company_id = db.Column(db.String(36), db.ForeignKey("companies.id"))
    manager_id = db.Column(db.String(36))
    is_active = db.Column(db.Boolean, default=True)


class GLAccount(BaseModel):
    __tablename__ = "gl_accounts"
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    account_type = db.Column(db.String(50))  # asset, liability, equity, revenue, expense
    parent_id = db.Column(db.String(36), db.ForeignKey("gl_accounts.id"))
    is_active = db.Column(db.Boolean, default=True)


class Currency(BaseModel):
    __tablename__ = "currencies"
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(10), nullable=False)
    symbol = db.Column(db.String(5))
    decimal_places = db.Column(db.Integer, default=2)
    is_active = db.Column(db.Boolean, default=True)


class TaxCode(BaseModel):
    __tablename__ = "tax_codes"
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    rate = db.Column(db.Numeric(5, 2), nullable=False)
    type = db.Column(db.String(50))  # gst, vat, sales_tax
    is_active = db.Column(db.Boolean, default=True)


class UnitOfMeasure(BaseModel):
    __tablename__ = "units_of_measure"
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(20), nullable=False)
    category = db.Column(db.String(50))  # weight, length, volume, quantity
    base_unit = db.Column(db.String(20))
    conversion_factor = db.Column(db.Float, default=1.0)
    is_active = db.Column(db.Boolean, default=True)


class Country(BaseModel):
    __tablename__ = "countries"
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(10), nullable=False)
    iso3 = db.Column(db.String(10))
    currency_code = db.Column(db.String(10))
    is_active = db.Column(db.Boolean, default=True)


class Region(BaseModel):
    __tablename__ = "regions"
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    country_id = db.Column(db.String(36), db.ForeignKey("countries.id"))
    is_active = db.Column(db.Boolean, default=True)


class Location(BaseModel):
    __tablename__ = "locations"
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    type = db.Column(db.String(50))
    address = db.Column(db.JSON)
    coordinates = db.Column(db.JSON)
    region_id = db.Column(db.String(36), db.ForeignKey("regions.id"))
    is_active = db.Column(db.Boolean, default=True)


class Part(BaseModel):
    __tablename__ = "parts"
    name = db.Column(db.String(300), nullable=False)
    code = db.Column(db.String(50), nullable=False)
    category = db.Column(db.String(100))
    material_id = db.Column(db.String(36), db.ForeignKey("materials.id"))
    uom = db.Column(db.String(20))
    specifications = db.Column(db.JSON)
    is_active = db.Column(db.Boolean, default=True)
