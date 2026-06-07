"""
server.py — LegalEase backend
Proxies Gemini API requests. API key never reaches the browser.
"""

import os
import json
import requests
from flask import Flask, request, Response, send_from_directory, jsonify
from dotenv import load_dotenv

load_dotenv()

API_KEY     = os.environ["GEMINI_API_KEY"]
TEMPERATURE = float(os.environ.get("GEMINI_TEMPERATURE", "0.2"))
MODEL       = "gemini-2.5-flash"
ENDPOINT    = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:streamGenerateContent"

app = Flask(__name__, static_folder=".", static_url_path="")


# ── Serve frontend ──────────────────────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory(".", "index.html")


# ── Gemini proxy ────────────────────────────────────────────────────────────
@app.route("/api/chat", methods=["POST"])
def chat():
    body = request.get_json(force=True)

    # Enforce temperature from server env — client cannot override it
    body.setdefault("generationConfig", {})
    body["generationConfig"]["temperature"] = TEMPERATURE

    url = f"{ENDPOINT}?key={API_KEY}&alt=sse"

    try:
        upstream = requests.post(
            url,
            json=body,
            stream=True,
            headers={"Content-Type": "application/json"},
            timeout=180,
        )
    except requests.exceptions.Timeout:
        return jsonify({"error": {"message": "Request timed out. Try a shorter document."}}), 504
    except requests.exceptions.RequestException as e:
        return jsonify({"error": {"message": str(e)}}), 502

    if not upstream.ok:
        try:
            err_body = upstream.json()
            err_msg  = err_body.get("error", {}).get("message", upstream.text)
        except Exception:
            err_msg = upstream.text

        if upstream.status_code == 429:
            err_msg = "Too many requests — please wait a moment and try again."

        return jsonify({"error": {"message": err_msg}}), upstream.status_code

    def generate():
        for chunk in upstream.iter_content(chunk_size=4096):
            if chunk:
                yield chunk

    return Response(
        generate(),
        status=200,
        content_type="text/event-stream",
        headers={
            "X-Accel-Buffering": "no",
            "Cache-Control":     "no-cache",
            "Connection":        "keep-alive",
        },
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    # threaded=True is essential for SSE — one thread per connection
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
