# ⚖️ LegalEase

**AI-powered Indian legal document intelligence platform**  
Built for GDGoC × PES College of Engineering, Mandya — Build Your Own Chatbot (BYOC)

---

## What It Does

LegalEase lets you upload any Indian legal document (PDF, image, audio) and instantly get:

- **Risk Analysis** — clause-level `[HIGH]` / `[MED]` / `[LOW]` risk scoring with visual heatmap
- **Missing Clause Detection** — checks against standard Indian contract templates
- **Document Comparison** — diffs two versions, flags `[SIGNIFICANT]` changes
- **Plain Language Simplification** — rewrites dense legal language for everyday citizens
- **IPC / Bare Acts Reference** — precise statute citations, section text, and landmark cases
- **Clause Drafting** — generates formal + plain-language versions of any contract clause
- **Executive Summary** — structured 6-point summary of any document
- **General Legal Q&A** — answer any Indian law question with statute citations

Multilingual output in **English**, **ಕನ್ನಡ (Kannada)**, and **हिंदी (Hindi)** — native Gemini generation, no translation API.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML5 / CSS3 / ES2020 JavaScript |
| AI Model | Gemini 1.5 Pro (multimodal, streaming, 1M token context) |
| API | Google Generative Language REST API v1beta (SSE streaming) |
| Storage | localStorage (sessions, API key, theme) |
| TTS | Web Speech API (en-IN / hi-IN / kn-IN) |
| Fonts | Inter, DM Serif Display, DM Mono (Google Fonts) |

---

## Project Structure

```
LegalEase/
├── index.html          # App shell — layout, sidebar, chat, input
├── styles/
│   └── main.css        # Full design system — light/dark themes, responsive
├── js/
│   ├── storage.js      # localStorage: API key, sessions, preferences
│   ├── modes.js        # 8 analysis modes + system instruction builder
│   ├── pipeline.js     # 6-stage processing pipeline + clause indexing
│   ├── parser.js       # Markdown renderer + structured token extraction
│   ├── api.js          # Gemini 1.5 Pro streaming API client
│   └── app.js          # Main controller — wires all modules together
└── README.md
```

---

## Setup & Usage

### 1. Get a Gemini API Key
Go to [Google AI Studio](https://aistudio.google.com/app/apikey) and create a free API key.

### 2. Run the App
No build step required. Open `index.html` directly in any modern browser, or serve it:

```bash
# Python (simplest)
python -m http.server 8000

# Node.js
npx serve .
```

Then open `http://localhost:8000`.

### 3. Enter Your API Key
Click the 🔑 button in the top-right corner, paste your key, and click **Save**.

### 4. Start Using
- **Chat** — type any legal question and press Enter
- **Upload document** — click 📎 to attach a PDF, image, or audio file
- **Change mode** — click any mode button in the top bar (Risk Analysis, Simplify, etc.)
- **Change language** — click EN / ಕನ್ನಡ / हिंदी in the top-right

---

## Gemini Features Used

| Feature | Implementation |
|---|---|
| **Streaming (SSE)** | `streamGenerateContent?alt=sse` — token-by-token rendering |
| **Multimodal Input** | PDF + image + audio sent as `inline_data` parts in one API call |
| **Long Context (1M tokens)** | Full conversation history sent on every call — no truncation |
| **System Instructions** | Dynamic `system_instruction` block with mode + language + clause context |
| **Structured Output** | Prompt-engineered `[HIGH]/[MED]/[LOW]/[MISSING]/[SIGNIFICANT]` token extraction |
| **Multi-turn Memory** | Full `conversationHistory` array maintained across all turns |
| **Multilingual Output** | Native Kannada/Hindi generation via language instruction in system prompt |
| **Audio Input** | Voice recordings sent as `audio/wav` inline_data — no external STT needed |

---

## The 6-Stage Pipeline

Every query passes through this pipeline, visualised live in the sidebar:

```
INGEST → CHUNK → EMBED → PROMPT → GEMINI → PARSE
```

1. **Ingest** — `FileReader` reads files, encodes to base64
2. **Chunk** — segments document into standard Indian contract clause units
3. **Embed** — RAG layer: clause index ranked by semantic relevance (production: `text-embedding-004` + Chroma/Pinecone)
4. **Prompt** — assembles system instruction + history + clause context + user message
5. **Gemini** — streams response from Gemini 1.5 Pro via SSE
6. **Parse** — extracts structured tokens, renders risk heatmaps and clause grids

---

## Deployment

### GitHub Pages (recommended)
```bash
git add .
git commit -m "LegalEase"
git push origin main
# Enable Pages in repo Settings → Pages → Deploy from main branch
```

### Streamlit Cloud (if required)
Create `app.py`:
```python
import streamlit as st, pathlib
st.set_page_config(layout="wide")
st.components.v1.html(pathlib.Path("index.html").read_text(), height=900, scrolling=True)
```
Then deploy to [streamlit.io/cloud](https://streamlit.io/cloud).

---

## Generation Config

```json
{
  "temperature": 0.2,
  "maxOutputTokens": 2048,
  "topP": 0.85,
  "topK": 40
}
```

Low temperature (0.2) is critical for legal applications — minimises hallucination and keeps responses grounded in actual statute.

---

*LegalEase — Making Indian law understandable for everyone.*
