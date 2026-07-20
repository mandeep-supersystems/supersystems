from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from core.ai.models import AIModel, KnowledgeBase, AIAgent, AIInteraction
from shared.utils.helpers import success_response, paginate

ai_bp = Blueprint("ai", __name__)


@ai_bp.route("/models", methods=["GET"])
@jwt_required()
def list_models():
    identity = get_identity()
    query = AIModel.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@ai_bp.route("/models", methods=["POST"])
@jwt_required()
def create_model():
    data = request.get_json()
    identity = get_identity()
    model = AIModel(
        name=data["name"], code=data["code"], model_type=data.get("model_type"),
        provider=data.get("provider"), endpoint=data.get("endpoint"),
        config=data.get("config", {}), tenant_id=identity["tenant_id"]
    )
    db.session.add(model)
    db.session.commit()
    return success_response(model.to_dict(), "AI Model created", 201)


@ai_bp.route("/knowledge-bases", methods=["GET"])
@jwt_required()
def list_knowledge_bases():
    identity = get_identity()
    query = KnowledgeBase.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@ai_bp.route("/knowledge-bases", methods=["POST"])
@jwt_required()
def create_knowledge_base():
    data = request.get_json()
    identity = get_identity()
    kb = KnowledgeBase(
        name=data["name"], description=data.get("description"),
        source_type=data.get("source_type"), config=data.get("config", {}),
        tenant_id=identity["tenant_id"]
    )
    db.session.add(kb)
    db.session.commit()
    return success_response(kb.to_dict(), "Knowledge base created", 201)


@ai_bp.route("/agents", methods=["GET"])
@jwt_required()
def list_agents():
    identity = get_identity()
    query = AIAgent.query.filter_by(tenant_id=identity["tenant_id"], is_deleted=False)
    return success_response(paginate(query))


@ai_bp.route("/agents", methods=["POST"])
@jwt_required()
def create_agent():
    data = request.get_json()
    identity = get_identity()
    agent = AIAgent(
        name=data["name"], description=data.get("description"),
        agent_type=data.get("agent_type"), model_id=data.get("model_id"),
        knowledge_base_id=data.get("knowledge_base_id"),
        instructions=data.get("instructions"), tools=data.get("tools", []),
        tenant_id=identity["tenant_id"]
    )
    db.session.add(agent)
    db.session.commit()
    return success_response(agent.to_dict(), "Agent created", 201)


@ai_bp.route("/chat", methods=["POST"])
@jwt_required()
def chat():
    data = request.get_json()
    identity = get_identity()
    # Placeholder for AI interaction
    interaction = AIInteraction(
        agent_id=data.get("agent_id"), user_id=identity["user_id"],
        input_text=data["message"], output_text="AI response placeholder",
        module=data.get("module"), tenant_id=identity["tenant_id"]
    )
    db.session.add(interaction)
    db.session.commit()
    return success_response(interaction.to_dict())
