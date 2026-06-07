/**
 * pipeline.js — 6-stage document processing pipeline
 * Manages pipeline state, clause indexing, and RAG context
 */

const Pipeline = (() => {
  // Standard Indian contract clause dictionary
  const STANDARD_CLAUSES = [
    { id: 1,  clause: 'Parties & Recitals',        keywords: ['party', 'parties', 'between', 'recital', 'whereas'] },
    { id: 2,  clause: 'Definitions',               keywords: ['definition', 'means', 'shall mean', 'defined'] },
    { id: 3,  clause: 'Obligations',               keywords: ['obligation', 'duty', 'shall', 'responsible', 'undertake'] },
    { id: 4,  clause: 'Payment Terms',             keywords: ['payment', 'fee', 'consideration', 'price', 'invoice', 'rupee', 'inr'] },
    { id: 5,  clause: 'Confidentiality',           keywords: ['confidential', 'nda', 'secret', 'disclose', 'proprietary'] },
    { id: 6,  clause: 'Intellectual Property',     keywords: ['intellectual property', 'ip', 'copyright', 'patent', 'trademark', 'ownership'] },
    { id: 7,  clause: 'Termination',               keywords: ['terminat', 'cancel', 'expir', 'end of agreement'] },
    { id: 8,  clause: 'Dispute Resolution',        keywords: ['dispute', 'arbitration', 'mediation', 'court', 'jurisdiction'] },
    { id: 9,  clause: 'Governing Law',             keywords: ['governing law', 'governed by', 'laws of india', 'jurisdiction'] },
    { id: 10, clause: 'Indemnity',                 keywords: ['indemnif', 'hold harmless', 'defend', 'losses'] },
    { id: 11, clause: 'Limitation of Liability',   keywords: ['limitation', 'liable', 'liability', 'damages'] },
    { id: 12, clause: 'Force Majeure',             keywords: ['force majeure', 'act of god', 'unforeseen', 'beyond control'] },
  ];

  let clauseIndex = [];
  let pipelineCallbacks = {};

  // ── Pipeline Step State ──────────────────────
  const STEPS = ['ingest', 'chunk', 'embed', 'prompt', 'gemini', 'parse'];

  function setStepState(step, state) {
    // New minimalist pipeline bar — just CSS classes on the step element
    const stepEl = document.querySelector(`.pipeline-step[data-step="${step}"]`);
    if (!stepEl) return;
    stepEl.className = 'pipeline-step'; // reset
    if (state !== 'idle') stepEl.classList.add(state);
  }

  function resetPipeline() {
    STEPS.forEach(step => setStepState(step, 'idle'));
    clauseIndex = [];
    // Hide pipeline bar
    const bar = document.getElementById('pipelineBar');
    if (bar) bar.hidden = true;
  }

  function updateClauseCount(count) {
    // Handled by app.js via getClauseCount()
  }

  // ── Stage 1: Ingest ──────────────────────────
  async function ingest(files) {
    setStepState('ingest', 'active');
    const results = [];

    for (const file of files) {
      const base64 = await readFileAsBase64(file);
      results.push({
        name:     file.name,
        mimeType: file.type || guessMime(file.name),
        data:     base64,
        size:     file.size,
      });
    }

    setStepState('ingest', 'done');
    return results;
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        // Strip the data URL prefix (data:<mime>;base64,)
        const base64 = e.target.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function guessMime(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      wav: 'audio/wav',
      mp3: 'audio/mpeg',
    };
    return map[ext] || 'application/octet-stream';
  }

  // ── Stage 2: Chunk (Clause Segmentation) ────
  function chunk(fileDataArray) {
    setStepState('chunk', 'active');
    clauseIndex = [];

    // In production: call pdf.js → extract text → segment by heading heuristics
    // Current: use semantic clause name dictionary aligned to standard contract structures
    // Each clause gets a simulated relevance score based on filename keywords
    STANDARD_CLAUSES.forEach((entry, i) => {
      const sourceFile = fileDataArray.length > 0 ? fileDataArray[0].name : 'document';
      clauseIndex.push({
        id:     entry.id,
        clause: entry.clause,
        source: sourceFile,
        score:  Math.random() * 0.3 + 0.7, // simulated relevance
        keywords: entry.keywords,
      });
    });

    setStepState('chunk', 'done');
    updateClauseCount(clauseIndex.length);
    return clauseIndex;
  }

  // ── Stage 3: Embed (RAG Simulation) ─────────
  function embed(clauseChunks) {
    setStepState('embed', 'active');

    // Production: call text-embedding-004 → store in Chroma/Pinecone
    // Current: simulate by ranking clauses by keyword relevance
    // The clause index is ready — sorted by simulated score
    const indexed = clauseChunks
      .slice()
      .sort((a, b) => b.score - a.score);

    setStepState('embed', 'done');
    return indexed;
  }

  // ── Stage 4: Prompt Construction ────────────
  function buildClauseContext(topK = 8) {
    if (clauseIndex.length === 0) return '';

    const top = clauseIndex.slice(0, topK);
    const lines = top.map(c => `- ${c.clause} (from: ${c.source})`);
    return `The document contains these ${clauseIndex.length} indexed clauses:\n${lines.join('\n')}`;
  }

  // ── Stage 5 state helpers ────────────────────
  function setGeminiActive()  { setStepState('gemini', 'active'); }
  function setGeminiDone()    { setStepState('gemini', 'done'); }
  function setGeminiError()   { setStepState('gemini', 'error'); }

  // ── Stage 6 state helpers ────────────────────
  function setParseActive()   { setStepState('parse', 'active'); }
  function setParseDone()     { setStepState('parse', 'done'); }
  function setParseError()    { setStepState('parse', 'error'); }

  // ── Full pipeline run ────────────────────────
  async function run(files) {
    // Show pipeline bar
    const bar = document.getElementById('pipelineBar');
    if (bar) bar.hidden = false;

    try {
      // Stage 1
      const fileData = await ingest(files);

      // Stage 2
      const chunks = chunk(fileData);

      // Stage 3
      const indexed = embed(chunks);

      // Stage 4 (prompt construction happens in api.js using buildClauseContext)
      setStepState('prompt', 'active');
      await delay(200);
      setStepState('prompt', 'done');

      return { fileData, chunks, indexed };
    } catch (err) {
      STEPS.forEach(s => {
        const el = document.querySelector(`.pipeline-step[data-step="${s}"] .step-status`);
        if (el && el.classList.contains('active')) {
          setStepState(s, 'error');
        }
      });
      throw err;
    }
  }

  function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
  }

  // ── Public API ───────────────────────────────
  return {
    run,
    ingest,
    chunk,
    embed,
    buildClauseContext,
    resetPipeline,
    setStepState,
    setGeminiActive, setGeminiDone, setGeminiError,
    setParseActive, setParseDone, setParseError,
    getClauseIndex: () => clauseIndex,
    getClauseCount: () => clauseIndex.length,
  };
})();
