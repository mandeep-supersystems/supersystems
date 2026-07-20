"""Base integration class for all external system integrations."""


class BaseIntegration:
    def __init__(self, tenant_id, config):
        self.tenant_id = tenant_id
        self.config = config

    def connect(self):
        raise NotImplementedError

    def send(self, data):
        raise NotImplementedError

    def receive(self, params):
        raise NotImplementedError

    def health_check(self):
        raise NotImplementedError


class SAPIntegration(BaseIntegration):
    """SAP ERP Integration - RFC/BAPI/IDoc"""
    def connect(self):
        pass  # SAP connection via pyrfc

    def send_material_master(self, material):
        pass

    def receive_purchase_order(self, po_number):
        pass


class BankIntegration(BaseIntegration):
    """Bank Integration - Payment gateway, statements"""
    def initiate_payment(self, payment_data):
        pass

    def fetch_statement(self, account_id, from_date, to_date):
        pass


class GSTIntegration(BaseIntegration):
    """GST Portal Integration - E-invoicing, returns"""
    def generate_irn(self, invoice_data):
        pass

    def file_return(self, return_type, period):
        pass


class VendorPortalIntegration(BaseIntegration):
    """Vendor Portal - PO sharing, invoice submission"""
    def share_po(self, po_data):
        pass

    def receive_invoice(self, invoice_data):
        pass


class CustomerPortalIntegration(BaseIntegration):
    """Customer Portal - Order tracking, support"""
    def share_order_status(self, order_id):
        pass

    def receive_order(self, order_data):
        pass


class MobileIntegration(BaseIntegration):
    """Mobile App Integration - Push notifications, sync"""
    def send_push(self, user_id, message):
        pass

    def sync_data(self, entity_type, last_sync):
        pass


class AIAgentIntegration(BaseIntegration):
    """AI Agent Integration - External AI services"""
    def invoke_agent(self, agent_id, input_data):
        pass

    def get_prediction(self, model_id, features):
        pass
