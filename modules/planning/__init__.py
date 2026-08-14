from flask import Blueprint

planning_bp = Blueprint("planning", __name__)

from .notifications import notifications_bp
from .purchase_requests import purchase_requests_bp
from .overview import overview_bp
from .customer_orders import customer_orders_bp

planning_bp.register_blueprint(notifications_bp)
planning_bp.register_blueprint(purchase_requests_bp)
planning_bp.register_blueprint(overview_bp)
planning_bp.register_blueprint(customer_orders_bp)
