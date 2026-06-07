# LegalEase

https://gemini-chatbot-4mmq.onrender.com/

**AI-powered Indian legal document chatbot**

---

## What This Website Does

This website is a legal chatbot built to analyse and interpret Indian legal documents using Gemini AI.
It lets a judge or reviewer quickly interact with contracts, agreements, and legal text through a browser interface.

The app supports:

- **Risk Analysis**: identifies risky clauses and labels them as `[HIGH]`, `[MED]`, or `[LOW]`
- **Missing Clause Detection**: checks documents against standard Indian contract clauses
- **Document Comparison**: compares two versions and highlights `[SIGNIFICANT]` differences
- **Simplification**: rewrites legal text in plain language for non-lawyers
- **IPC / Bare Acts Reference**: answers Indian law questions with statute citations
- **Clause Drafting**: drafts formal and plain-language contract clauses
- **Summarisation**: generates a concise executive summary of any document
- **General Legal Q&A**: answers legal questions with focused context and citations

It also supports multilingual output in **English**, **ಕನ್ನಡ (Kannada)**, and **हिंदी (Hindi)**.

---

## Live Demo

Visit the deployed app here:

https://gemini-chatbot-4mmq.onrender.com/

---

## Tech Stack

This project is built with a lightweight, modern stack focused on browser-based AI interaction.

- **Frontend**: Vanilla HTML5, CSS3, and modern JavaScript
- **Backend**: Python Flask server proxy
- **AI**: Google Gemini via Generative Language API (streaming SSE)
- **Document handling**: browser `FileReader`, base64 encoding, and inline multimodal data
- **State**: in-memory session state for history and file attachments
- **Styling**: responsive UI with light/dark theme support

---

## Code Overview

```
Gemini-Chatbot-2/
├── index.html          # Main web app shell and UI layout
├── server.py           # Flask proxy server for Gemini API requests
├── requirements.txt    # Python dependencies
├── README.md           # Project documentation
├── js/
│   ├── api.js         # Gemini streaming client and request builder
│   ├── app.js         # UI controller, chat flow, and state management
│   ├── modes.js       # Mode definitions and system instruction builder
│   ├── parser.js      # Response parsing, markdown rendering, and UI formatting
│   ├── pipeline.js    # Document processing pipeline and clause indexing
│   └── storage.js     # Local storage utility for settings and history
└── styles/
    └── main.css      # App styling, responsiveness, and dark mode
```

---

## Why This Is Worth Judging

This website demonstrates:

- a full end-to-end AI assistant for legal document review
- real-time streaming responses from Gemini
- a custom mode system for different legal workflows
- support for document uploads, audio input, and multilingual output
- clean separation between frontend UI and backend API proxy

---

## How to Run It Locally

1. Install dependencies:

```bash
pip install -r requirements.txt
```

2. Set your Gemini API key in `.env`:

```bash
GEMINI_API_KEY=YOUR_API_KEY_HERE
```

3. Start the server:

```bash
python server.py
```

4. Open the app in your browser:

```bash
http://localhost:5000
```

---

## Deployment Notes

The app is designed for simple deployment on platforms like Render, Railway, or Fly.io.
The Flask backend proxies Gemini requests so the API key remains secure on the server.

---

## Highlights

- **Multimodal support**: file upload, document text, and audio attachments
- **Legal-first prompts**: Indian law focus with mode-specific system instructions
- **Structured parsing**: extracts risk labels and renders them in the UI
- **Streaming UI**: shows incremental Gemini output as the response arrives

---

*This README is written to help a reviewer quickly understand the website’s purpose, architecture, and capabilities.*
