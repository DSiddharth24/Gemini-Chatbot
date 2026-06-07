"""
server.py — LegalEase backend
Reads GEMINI_API_KEY from .env and proxies requests to Gemini.
The key never leaves the server.
"""

import os
import json
import requests
from flask import Flask, request, Response, send_from_directory
from dotenv import load_dotenv

load_dotenv()

API_KEY     = os.environ["GEMINI_API_KEY"]
TEMPERATURE = float(os.environ.get("GEMINI_TEMPERATURE", "0.2"))
MODEL    = "gemini-2.5-flash"
ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:streamGenerateContent"

app = Flask(__name__, static_folder=".", static_url_path="")


# ── Serve the frontend ──────────────────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory(".", "index.html")


# ── Gemini proxy ─────────────────────────────────────────────────────────────
@app.route("/api/chat", methods=["POST"])
def chat():
    body = request.get_json(force=True)

    # Override temperature from server env so the frontend can't tamper with it
    body.setdefault("generationConfig", {})
    body["generationConfig"]["temperature"] = TEMPERATURE

    url = f"{ENDPOINT}?key={API_KEY}&alt=sse"

    upstream = requests.post(
        url,
        json=body,
        stream=True,
        headers={"Content-Type": "application/json"},
        timeout=120,
    )

    if not upstream.ok:
        # If rate limited, return a clean error message
        try:
            err_body = upstream.json()
            err_msg  = err_body.get("error", {}).get("message", upstream.text)
        except Exception:
            err_msg = upstream.text

        if upstream.status_code == 429:
            err_msg = "Too many requests — please wait a moment and try again."

        return Response(
            json.dumps({"error": {"message": err_msg}}),
            status=upstream.status_code,
            mimetype="application/json",
        )

    def generate():
        for chunk in upstream.iter_content(chunk_size=None):
            if chunk:
                yield chunk

    return Response(
        generate(),
        status=upstream.status_code,
        content_type=upstream.headers.get("Content-Type", "text/event-stream"),
        headers={"X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
