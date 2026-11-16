import logging
from flask import Blueprint, request, jsonify
from services.github_service import GitHubService

webhooks_bp = Blueprint("webhooks", __name__, url_prefix="/api/webhooks")
logger = logging.getLogger(__name__)

@webhooks_bp.route("/github", methods=["POST"])
def github_webhook():
    """
    Receive, verify, and process incoming GitHub webhooks securely.
    Supports events: push, workflow_run, workflow_job, deployment_status.
    """
    signature = request.headers.get("X-Hub-Signature-256")
    event_type = request.headers.get("X-GitHub-Event", "ping")
    delivery_id = request.headers.get("X-GitHub-Delivery")

    if not delivery_id:
        return jsonify({"error": "Missing X-GitHub-Delivery header."}), 400

    # 1. Signature Verification
    # If a webhook secret is configured in the backend, require and verify the signature
    creds = GitHubService.get_credentials()
    configured_secret = creds.get("webhook_secret")
    
    if configured_secret:
        if not signature:
            return jsonify({"error": "Missing X-Hub-Signature-256 header."}), 401
        is_valid = GitHubService.verify_webhook_signature(
            payload_bytes=request.data,
            signature_header=signature,
            secret=configured_secret
        )
        if not is_valid:
            logger.warning(f"Invalid webhook signature for delivery {delivery_id}")
            return jsonify({"error": "Invalid HMAC signature."}), 401

    # Ping event response
    if event_type == "ping":
        return jsonify({"message": "PONG: Webhook endpoint verified and active."}), 200

    # 2. Process payload safely
    payload = request.get_json(silent=True) or {}
    result = GitHubService.process_webhook_event(
        delivery_id=delivery_id,
        event_type=event_type,
        payload=payload
    )

    status_code = 200 if result.get("status") in ["success", "duplicate"] else 400
    return jsonify(result), status_code
