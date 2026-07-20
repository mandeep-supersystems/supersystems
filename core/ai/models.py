from extensions import db
from shared.base_model import BaseModel


class AIModel(BaseModel):
    __tablename__ = "ai_models"
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(100), nullable=False)
    model_type = db.Column(db.String(100))  # prediction, classification, recommendation, nlp
    provider = db.Column(db.String(100))  # openai, bedrock, custom
    endpoint = db.Column(db.String(500))
    config = db.Column(db.JSON, default={})
    is_active = db.Column(db.Boolean, default=True)


class KnowledgeBase(BaseModel):
    __tablename__ = "knowledge_bases"
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    source_type = db.Column(db.String(50))  # document, database, api
    config = db.Column(db.JSON, default={})
    status = db.Column(db.String(50), default="active")
    document_count = db.Column(db.Integer, default=0)


class AIAgent(BaseModel):
    __tablename__ = "ai_agents"
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    agent_type = db.Column(db.String(100))
    model_id = db.Column(db.String(36), db.ForeignKey("ai_models.id"))
    knowledge_base_id = db.Column(db.String(36), db.ForeignKey("knowledge_bases.id"))
    instructions = db.Column(db.Text)
    tools = db.Column(db.JSON, default=[])
    is_active = db.Column(db.Boolean, default=True)


class AIInteraction(BaseModel):
    __tablename__ = "ai_interactions"
    agent_id = db.Column(db.String(36), db.ForeignKey("ai_agents.id"))
    user_id = db.Column(db.String(36), nullable=False)
    input_text = db.Column(db.Text)
    output_text = db.Column(db.Text)
    tokens_used = db.Column(db.Integer)
    response_time_ms = db.Column(db.Integer)
    feedback = db.Column(db.String(20))
    module = db.Column(db.String(100))
