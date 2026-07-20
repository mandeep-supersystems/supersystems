# Application-wide constants

MODULES = [
    "auth", "workflow", "audit", "notification", "dms", "reporting",
    "api_gateway", "ai", "master_data", "inventory", "procurement",
    "finance", "hr", "manufacturing", "quality", "warehouse",
    "maintenance", "project_management", "logistics", "customer_service",
    "analytics", "treasury", "asset_management", "governance_risk",
    "product_lifecycle", "supplier_management", "ehs",
]

STATUSES = {
    "DRAFT": "draft",
    "PENDING": "pending",
    "IN_PROGRESS": "in_progress",
    "APPROVED": "approved",
    "REJECTED": "rejected",
    "COMPLETED": "completed",
    "CANCELLED": "cancelled",
    "CLOSED": "closed",
}

PRIORITIES = ["critical", "high", "medium", "low"]

ACTIONS = ["create", "read", "update", "delete", "approve", "reject", "export", "import"]

NOTIFICATION_CHANNELS = ["email", "sms", "push", "in_app", "webhook"]

WORKFLOW_ACTIONS = ["approve", "reject", "return", "escalate", "delegate"]
