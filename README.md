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

## Detailed Tech Stack

### Frontend
- Built with **pure HTML5, CSS3, and vanilla ES2020 JavaScript** — no frontend framework.
- `index.html` defines the chat UI, file upload controls, status indicators, and pipeline progress bar.
- `styles/main.css` provides responsive layout, light/dark theme switching, and polished messaging UI.
- `app.js` manages UI state, history, message rendering, file handling, and the send/query flow.
- `modes.js` defines 8 legal workflows and generates the mode-specific system instructions used for Gemini.

### AI Integration
- `api.js` sends user messages and document attachments to Gemini through the Flask proxy.
- Uses **streaming SSE** to render Gemini output token-by-token for a real-time chat experience.
- Supports **multimodal inline_data** payloads for PDFs, images, audio, and plain text documents.
- Includes a legal prompt strategy: low `temperature`, strong mode instructions, and a dynamic system prompt.

### Document Pipeline
- `pipeline.js` implements a six-stage flow:
  1. **Ingest** — read files and encode attachments
  2. **Chunk** — simulate clause segmentation for legal documents
  3. **Embed** — rank clause relevance for potential RAG-style summarization
  4. **Prompt** — assemble instructions, history, and document context
  5. **Gemini** — stream AI-generated answer
  6. **Parse** — extract structured labels and format the response
- The pipeline is shown visually in the UI, making the process transparent and judge-friendly.

### Response Processing
- `parser.js` converts Gemini text into safe, formatted HTML.
- It extracts structured labels like `[HIGH]`, `[MED]`, `[LOW]`, `[MISSING]`, and `[SIGNIFICANT]`.
- It renders risk heatmaps, clause coverage cards, Markdown, tables, and lists.
- This turns raw AI text into a legal review dashboard instead of plain chat output.

### Backend Proxy
- `server.py` is a **Python Flask** proxy that keeps the Gemini API key secure.
- It forwards requests to Gemini’s `streamGenerateContent` endpoint with `alt=sse`.
- The server enforces the model temperature from environment settings and handles request streaming.
- No API key is exposed to the browser.

### Why it stands out for judges
- Combines AI, legal reasoning, and document processing in one browser app.
- Uses a **minimal architecture** with a small frontend and secure backend.
- Shows deliberate design: legal prompt engineering, structured output parsing, and live streaming.
- The pipeline is both functional and visible, making technical decisions easy to evaluate.

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
