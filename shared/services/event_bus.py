"""Event Bus - Central event management for SUPERSYSTEMS platform."""
from datetime import datetime
import json


class Event:
    def __init__(self, event_type, module, entity_type, entity_id, data, tenant_id, user_id=None):
        self.event_type = event_type
        self.module = module
        self.entity_type = entity_type
        self.entity_id = entity_id
        self.data = data
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.timestamp = datetime.utcnow().isoformat()

    def to_dict(self):
        return {
            "event_type": self.event_type,
            "module": self.module,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "data": self.data,
            "tenant_id": self.tenant_id,
            "user_id": self.user_id,
            "timestamp": self.timestamp,
        }


class EventBus:
    """In-memory event bus. Replace with Kafka/Redis in production."""

    _subscribers = {}

    @classmethod
    def subscribe(cls, event_type, handler):
        if event_type not in cls._subscribers:
            cls._subscribers[event_type] = []
        cls._subscribers[event_type].append(handler)

    @classmethod
    def publish(cls, event: Event):
        handlers = cls._subscribers.get(event.event_type, [])
        handlers += cls._subscribers.get("*", [])  # wildcard subscribers
        for handler in handlers:
            try:
                handler(event)
            except Exception as e:
                print(f"Event handler error: {e}")

    @classmethod
    def clear(cls):
        cls._subscribers = {}


# Standard event types
class EventTypes:
    # Entity lifecycle
    ENTITY_CREATED = "entity.created"
    ENTITY_UPDATED = "entity.updated"
    ENTITY_DELETED = "entity.deleted"

    # Workflow
    WORKFLOW_INITIATED = "workflow.initiated"
    WORKFLOW_APPROVED = "workflow.approved"
    WORKFLOW_REJECTED = "workflow.rejected"
    WORKFLOW_COMPLETED = "workflow.completed"

    # Notifications
    NOTIFICATION_SENT = "notification.sent"
    NOTIFICATION_FAILED = "notification.failed"

    # Integration
    INTEGRATION_SYNC = "integration.sync"
    INTEGRATION_ERROR = "integration.error"

    # AI
    AI_PREDICTION = "ai.prediction"
    AI_RECOMMENDATION = "ai.recommendation"
