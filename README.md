# LegalEase

https://gemini-chatbot-4mmq.onrender.com/

**AI-powered Indian legal document chatbot**

---

## What This Chatbot Does

This Chatbot is a legal chatbot built to analyse and interpret Indian legal documents using Gemini AI.
It lets an everyday citizen, judge or reviewer quickly interact with contracts, agreements, and legal text through a browser interface.

The app supports:

- **Risk Analysis**: identifies risky clauses and labels them as `[HIGH]`, `[MED]`, or `[LOW]`
- **Missing Clause Detection**: checks documents against standard Indian contract clauses
- **Document Comparison**: compares two versions and highlights `[SIGNIFICANT]` differences
- **Simplification**: rewrites legal text in plain language for non-lawyers
- **IPC / Bare Acts Reference**: answers Indian law questions with statute citations
- **Clause Drafting**: drafts formal and plain-language contract clauses
- **Summarisation**: generates a concise executive summary of any document
- **General Legal Q&A**: answers legal questions with focused context and citations

---

## Live Demo

Visit the deployed app here:

https://gemini-chatbot-4mmq.onrender.com/

---

## Notable Features and Accessibility

### Analysis Modes

<img width="791" height="58" alt="Screenshot 2026-06-07 233950" src="https://github.com/user-attachments/assets/5c540b71-121f-4b13-a633-a8ed8389af83" />

LegalEase offers 8 specialised analysis modes, each instructing Gemini differently to produce a specific type of legal output. Switch between modes with a single click at the top of the chat.
- **💬 Q&A** — Ask any legal question and get answers with citations to Indian statutes, IPC sections, and relevant case law.
- **⚠ Risk** — Scans every clause and returns a colour-coded heatmap of High, Medium, and Low risk findings extracted directly from Gemini's response.
- **🔍 Missing** — Checks your document against standard Indian contract templates and lists every clause that is absent, along with why it matters.
- **⚖ Compare** — Upload two versions of a document. Gemini diffs them and flags every addition, removal, and legally significant change.
- **✨ Simplify** — Rewrites dense legal language into plain English that anyone can understand, without losing any meaning.
- **📖 IPC** — Looks up exact Indian Penal Code, CrPC, and CPC sections with applicable penalties and landmark Supreme Court judgements.
- **✍ Draft** — Writes a new contract clause from scratch in formal Indian legal language, plus a plain-language alternate version.
- **📋 Summarise** — Produces a structured executive summary covering parties, obligations, payment terms, key risks, and jurisdiction.

Each mode injects a different system instruction into Gemini at runtime — same model, entirely different prompt structure, output format, and parsing logic.

### Audio Response

<img width="332" height="52" alt="image" src="https://github.com/user-attachments/assets/4f65226c-f080-4682-9068-98736a0e2c81" />

Below the response, there is an option called read aloud, where the chatbot gives out an audio of the generated response.

### Theme Toggle and Chat Delete

<img width="120" height="57" alt="image" src="https://github.com/user-attachments/assets/ffe40b0d-fb0b-435c-873c-74c9af95edf9" />

The left button is for theme toggle(dark and light) and the right button for deleting the whole converstaion.

---

## Documents for testing purposes
- [Synova_ServiceAgreement_FIXED.docx](https://github.com/user-attachments/files/28686149/Synova_ServiceAgreement_FIXED.docx)
- [Synova_ServiceAgreement_FLAWED.docx](https://github.com/user-attachments/files/28686151/Synova_ServiceAgreement_FLAWED.docx)
- Note: These are fake documents.

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

### Why it stands out ?
- Combines AI, legal reasoning, and document processing in one browser app.
- Implements a **robust, production-ready architecture** with secure backend proxying, streaming AI integration, and clear frontend/backend separation.
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
