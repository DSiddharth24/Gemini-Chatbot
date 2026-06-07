"""
server.py — LegalEase backend
Reads GEMINI_API_KEY from .env and proxies requests to Gemini.
Also handles .docx / .txt extraction server-side since Gemini
only accepts PDF and images natively.
"""

import os
import io
import json
import base64
import requests
from flask import Flask, request, Response, send_from_directory
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


# ── DOCX / TXT extraction endpoint ─────────────────────────────────────────
@app.route("/api/extract", methods=["POST"])
def extract():
    """
    Accepts a file upload, extracts plain text, returns it as JSON.
    Supports: .docx, .txt
    """
    if "file" not in request.files:
        return {"error": "No file provided"}, 400

    f        = request.files["file"]
    filename = f.filename.lower()

    try:
        if filename.endswith(".docx"):
            from docx import Document
            doc   = Document(io.BytesIO(f.read()))
            text  = "\n".join(p.text for p in doc.paragraphs if p.text.strip())

        elif filename.endswith(".txt"):
            text = f.read().decode("utf-8", errors="replace")

        else:
            return {"error": f"Unsupported file type: {filename}"}, 400

        return {"text": text, "filename": f.filename}

    except Exception as e:
        return {"error": str(e)}, 500


# ── Gemini proxy ────────────────────────────────────────────────────────────
@app.route("/api/chat", methods=["POST"])
def chat():
    body = request.get_json(force=True)

    # Override temperature from server env
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
