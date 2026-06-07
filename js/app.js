/**
 * app.js — Main application controller
 * All state is in-memory only. Nothing is persisted.
 */

(function () {
  'use strict';

  const MAX_FILE_SIZE_MB = 20;

  const state = {
    mode:          'general',
    lang:          'en',
    history:       [],   // Gemini [{role, parts}]
    files:         [],   // processed file objects
    generating:    false,
    theme:         'light',
    mediaRecorder: null,
    isRecording:   false,
  };

  const $ = id => document.getElementById(id);
  const dom = {
    modeBar:         $('modeBar'),
    themeBtn:        $('themeBtn'),
    themeIcon:       $('themeIcon'),
    clearBtn:        $('clearBtn'),
    main:            $('main'),
    pipelineBar:     $('pipelineBar'),
    emptyState:      $('emptyState'),
    messages:        $('messages'),
    suggestionChips: $('suggestionChips'),
    attachBtn:       $('attachBtn'),
    fileInput:       $('fileInput'),
    attachedRow:     $('attachedRow'),
    messageInput:    $('messageInput'),
    micBtn:          $('micBtn'),
    sendBtn:         $('sendBtn'),
    statusText:      $('statusText'),
    clauseCount:     $('clauseCount'),
  };

  // ── Boot ───────────────────────────────────────────────────────────────────
  function init() {
    applyTheme('light');
    setModeUI('general');
    bind();
    dom.messageInput.focus();
  }

  // ── Theme ──────────────────────────────────────────────────────────────────
  function applyTheme(t) {
    state.theme = t;
    document.documentElement.setAttribute('data-theme', t);
    dom.themeIcon.innerHTML = t === 'dark'
      ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
      : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  }

  // ── Mode ───────────────────────────────────────────────────────────────────
  function setModeUI(mode) {
    document.querySelectorAll('.mode-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.mode === mode)
    );
    dom.messageInput.placeholder = Modes.get(mode).placeholder;
  }

  function setMode(mode) {
    state.mode = mode;
    setModeUI(mode);
  }

  // ── Clear ──────────────────────────────────────────────────────────────────
  function clearSession() {
    state.history = [];
    state.files   = [];
    dom.messages.innerHTML       = '';
    dom.emptyState.style.display = '';
    dom.attachedRow.innerHTML    = '';
    dom.pipelineBar.hidden       = true;
    Pipeline.resetPipeline();
    setStatus('ready', 'Ready');
    updateClauseCount();
    dom.messageInput.value = '';
    autoResize();
  }

  // ── File handling ──────────────────────────────────────────────────────────
  const FILE_SIZE_LIMIT = MAX_FILE_SIZE_MB * 1024 * 1024;

  async function handleFiles(fileList) {
    for (const file of fileList) {
      // Size guard
      if (file.size > FILE_SIZE_LIMIT) {
        showError(`"${file.name}" is too large (${(file.size/1024/1024).toFixed(1)} MB). Maximum is ${MAX_FILE_SIZE_MB} MB.`);
        continue;
      }

      const ext = file.name.split('.').pop().toLowerCase();

      if (ext === 'docx') {
        await extractDocx(file);
      } else if (ext === 'txt') {
        await extractTxt(file);
      } else {
        await addBinaryFile(file);
      }
    }
  }

  async function extractDocx(file) {
    const placeholder = makePlaceholder(file.name);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result      = await mammoth.extractRawText({ arrayBuffer });
      const text        = result.value.trim();
      if (!text) throw new Error('Document is empty or has no readable text.');
      placeholder.extractedText = text;
      placeholder.loading       = false;
      renderChips();
    } catch (err) {
      removePlaceholder(placeholder);
      showError(`Could not read "${file.name}": ${err.message}`);
    }
  }

  async function extractTxt(file) {
    const placeholder = makePlaceholder(file.name);
    try {
      const text = await file.text();
      if (!text.trim()) throw new Error('File is empty.');
      placeholder.extractedText = text.trim();
      placeholder.loading       = false;
      renderChips();
    } catch (err) {
      removePlaceholder(placeholder);
      showError(`Could not read "${file.name}": ${err.message}`);
    }
  }

  async function addBinaryFile(file) {
    const b64  = await toBase64(file);
    const mime = file.type || guessMime(file.name);
    state.files.push({ name: file.name, mimeType: mime, data: b64 });
    renderChips();
  }

  function makePlaceholder(name) {
    const ph = { name, mimeType: 'text/plain', extractedText: null, loading: true };
    state.files.push(ph);
    renderChips();
    return ph;
  }

  function removePlaceholder(ph) {
    state.files = state.files.filter(f => f !== ph);
    renderChips();
  }

  function toBase64(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload  = e => res(e.target.result.split(',')[1]);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  function guessMime(name) {
    const m = {
      pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg',
      jpeg: 'image/jpeg', webp: 'image/webp', wav: 'audio/wav', mp3: 'audio/mpeg',
    };
    return m[name.split('.').pop().toLowerCase()] || 'application/octet-stream';
  }

  function renderChips() {
    dom.attachedRow.innerHTML = '';
    state.files.forEach((f, i) => {
      const chip  = document.createElement('div');
      chip.className = 'file-chip';
      const icon  = f.loading ? '⏳' : mimeIcon(f.mimeType);
      const label = f.loading ? `Reading ${esc(f.name)}…` : esc(f.name);
      chip.innerHTML = `
        <span>${icon}</span>
        <span class="file-chip-name" title="${esc(f.name)}">${label}</span>
        ${f.loading ? '' : `<button class="file-chip-rm" aria-label="Remove">✕</button>`}`;
      if (!f.loading) {
        chip.querySelector('.file-chip-rm').onclick = () => {
          state.files.splice(i, 1);
          renderChips();
        };
      }
      dom.attachedRow.appendChild(chip);
    });
  }

  function mimeIcon(m) {
    if (m.includes('pdf'))   return '📄';
    if (m.includes('image')) return '🖼';
    if (m.includes('audio')) return '🎵';
    if (m.includes('text') || m.includes('word')) return '📝';
    return '📎';
  }

  // ── Microphone ─────────────────────────────────────────────────────────────
  async function toggleMic() {
    if (state.isRecording) { stopMic(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pick a MIME type the browser actually supports
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';

      const rec    = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      const chunks = [];

      rec.ondataavailable = e => chunks.push(e.data);
      rec.onstop = async () => {
        const actualMime = rec.mimeType || 'audio/webm';
        const ext        = actualMime.includes('mp4') ? 'mp4' : 'webm';
        const blob       = new Blob(chunks, { type: actualMime });
        const audioFile  = new File([blob], `voice_query.${ext}`, { type: actualMime });
        await addBinaryFile(audioFile);
        stream.getTracks().forEach(t => t.stop());
      };

      state.mediaRecorder = rec;
      state.isRecording   = true;
      rec.start();
      dom.micBtn.classList.add('recording');
    } catch {
      alert('Microphone access denied.');
    }
  }

  function stopMic() {
    state.mediaRecorder?.stop();
    state.isRecording = false;
    dom.micBtn.classList.remove('recording');
  }

  // ── Send ───────────────────────────────────────────────────────────────────
  const MODE_DEFAULTS = {
    risk:      'Analyse this document for legal risks under Indian law.',
    missing:   'Check this document for missing standard clauses.',
    compare:   'Compare these documents and highlight significant changes.',
    simplify:  'Simplify this document into plain English.',
    ipc:       'Identify relevant IPC sections in this document.',
    draft:     'Review and suggest improvements to the clauses in this document.',
    summarise: 'Summarise this document.',
    general:   'Analyse this legal document.',
  };

  async function send(overrideText = null) {
    if (state.generating) return;
    if (state.files.some(f => f.loading)) {
      showError('Please wait — document is still being read.');
      return;
    }

    const text  = (overrideText ?? dom.messageInput.value).trim();
    const files = [...state.files];
    if (!text && files.length === 0) return;

    const effectiveText = text || MODE_DEFAULTS[state.mode] || 'Analyse this document.';

    // Reset UI
    state.files = [];
    renderChips();
    dom.messageInput.value = '';
    autoResize();
    dom.emptyState.style.display = 'none';

    // Show user message
    addMsg('user', effectiveText + (files.length ? ` [${files.map(f => f.name).join(', ')}]` : ''));

    // Run pipeline stages 1–3 for visual feedback
    if (files.length) {
      dom.pipelineBar.hidden = false;
      await Pipeline.run(files);
    }

    setStatus('processing', 'Analysing…');
    setGenerating(true);

    Pipeline.setStepState('prompt', 'active');
    const clauseCtx = Pipeline.buildClauseContext();
    await tick(80);
    Pipeline.setStepState('prompt', 'done');
    Pipeline.setGeminiActive();

    const aiEl     = addMsg('ai', '', { streaming: true });
    const bubbleEl = aiEl.querySelector('.msg-bubble');

    await GeminiAPI.streamMessage({
      userMessage:   effectiveText,
      fileDataArray: files,
      history:       state.history,
      mode:          state.mode,
      lang:          'en',
      clauseContext: clauseCtx,

      onChunk: (_, acc) => {
        bubbleEl.textContent = acc;
        scrollDown();
      },

      onDone: (final) => {
        Pipeline.setGeminiDone();
        Pipeline.setParseActive();

        bubbleEl.innerHTML = Parser.processResponse(final, state.mode);
        bubbleEl.classList.remove('typing');
        Pipeline.setParseDone();
        attachActions(aiEl, final);

        // Build history entry — only include files that have actual content
        const uParts = [];
        for (const f of files) {
          if (f.extractedText) {
            uParts.push({ text: `[Document: ${f.name}]\n\n${f.extractedText}` });
          } else if (f.data) {
            uParts.push({ inline_data: { mime_type: f.mimeType, data: f.data } });
          }
        }
        uParts.push({ text: effectiveText });

        state.history.push({ role: 'user',  parts: uParts });
        state.history.push({ role: 'model', parts: [{ text: final }] });

        setStatus('ready', 'Ready');
        updateClauseCount();
        setGenerating(false);
        scrollDown();
      },

      onError: (err) => {
        Pipeline.setGeminiError();
        bubbleEl.innerHTML = `
          <p style="color:var(--danger)">⚠ ${esc(err.message)}</p>
          <p style="font-size:12px;color:var(--text-3);margin-top:4px">
            If this keeps happening, check your API key or wait a moment and retry.
          </p>`;
        bubbleEl.classList.remove('typing');
        setStatus('error', 'Error');
        setGenerating(false);
      },
    });
  }

  function setGenerating(val) {
    state.generating     = val;
    dom.sendBtn.disabled = val;
    dom.sendBtn.innerHTML = val
      ? '<div class="spinner"></div>'
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round">
           <line x1="22" y1="2" x2="11" y2="13"/>
           <polygon points="22 2 15 22 11 13 2 9 22 2"/>
         </svg>`;
  }

  // ── Message rendering ──────────────────────────────────────────────────────
  function addMsg(role, content, opts = {}) {
    const wrap = document.createElement('div');
    wrap.className = `msg ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = role === 'user' ? '↑' : '⚖';
    avatar.setAttribute('aria-hidden', 'true');

    const body   = document.createElement('div');
    body.className = 'msg-body';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble' + (opts.streaming ? ' typing' : '');
    bubble.textContent = '';

    if (!opts.streaming) {
      if (opts.isHtml) { bubble.innerHTML = content; }
      else { bubble.innerHTML = content ? `<p>${esc(content)}</p>` : ''; }
    }

    const time = document.createElement('div');
    time.className = 'msg-time';
    time.textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    body.appendChild(bubble);
    body.appendChild(time);

    if (role === 'user') { wrap.appendChild(body); wrap.appendChild(avatar); }
    else                 { wrap.appendChild(avatar); wrap.appendChild(body); }

    dom.messages.appendChild(wrap);
    scrollDown();
    return wrap;
  }

  function showError(msg) {
    dom.emptyState.style.display = 'none';
    const el = addMsg('ai', '', {});
    el.querySelector('.msg-bubble').innerHTML =
      `<p style="color:var(--danger)">⚠ ${esc(msg)}</p>`;
  }

  function attachActions(wrapEl, rawText) {
    const body    = wrapEl.querySelector('.msg-body');
    const actions = document.createElement('div');
    actions.className = 'msg-actions';

    const copyBtn   = makeAction('Copy', () => {
      navigator.clipboard.writeText(rawText).then(() => {
        copyBtn.textContent = 'Copied';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
      });
    });
    const readBtn   = makeAction('Read aloud', () => readAloud(rawText, readBtn));
    const followBtn = makeAction('Follow-up', () => {
      dom.messageInput.value = 'Regarding your previous response: ';
      dom.messageInput.focus();
      autoResize();
    });

    actions.appendChild(copyBtn);
    actions.appendChild(readBtn);
    actions.appendChild(followBtn);
    body.appendChild(actions);
  }

  function makeAction(label, fn) {
    const b = document.createElement('button');
    b.className   = 'msg-action';
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  }

  // ── TTS ────────────────────────────────────────────────────────────────────
  let ttsUtt = null;

  function readAloud(text, btn) {
    if (!window.speechSynthesis) { alert('TTS not supported.'); return; }
    if (ttsUtt) {
      speechSynthesis.cancel();
      ttsUtt = null;
      btn.textContent = 'Read aloud';
      return;
    }
    const clean = text
      .replace(/\[(HIGH|MED|LOW|MISSING|SIGNIFICANT|PRESENT)\]:/g, '$1.')
      .replace(/[*_#>`]/g, '').replace(/\n+/g, '. ');
    const utt   = new SpeechSynthesisUtterance(clean);
    utt.lang    = 'en-IN';
    utt.rate    = 0.92;
    utt.onstart = () => { btn.textContent = 'Stop'; };
    utt.onend   = () => { btn.textContent = 'Read aloud'; ttsUtt = null; };
    utt.onerror = () => { btn.textContent = 'Read aloud'; ttsUtt = null; };
    ttsUtt = utt;
    speechSynthesis.speak(utt);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function setStatus(cls, text) {
    dom.statusText.className   = cls;
    dom.statusText.textContent = text;
  }

  function updateClauseCount() {
    const n = Pipeline.getClauseCount();
    dom.clauseCount.textContent    = n > 0 ? `${n} clauses indexed` : '';
    dom.clauseCount.style.display  = n > 0 ? '' : 'none';
  }

  function scrollDown() {
    dom.main.scrollTo({ top: dom.main.scrollHeight, behavior: 'smooth' });
  }

  function autoResize() {
    dom.messageInput.style.height = 'auto';
    dom.messageInput.style.height = Math.min(dom.messageInput.scrollHeight, 140) + 'px';
  }

  function esc(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(str || ''));
    return d.innerHTML;
  }

  function tick(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── Events ─────────────────────────────────────────────────────────────────
  function bind() {
    dom.themeBtn.addEventListener('click', () =>
      applyTheme(state.theme === 'dark' ? 'light' : 'dark')
    );
    dom.clearBtn.addEventListener('click', clearSession);
    dom.modeBar.addEventListener('click', e => {
      const b = e.target.closest('.mode-btn');
      if (b) setMode(b.dataset.mode);
    });
    dom.attachBtn.addEventListener('click', () => dom.fileInput.click());
    dom.fileInput.addEventListener('change', e => {
      handleFiles(Array.from(e.target.files));
      e.target.value = '';
    });
    dom.main.addEventListener('dragover', e => e.preventDefault());
    dom.main.addEventListener('drop', e => {
      e.preventDefault();
      handleFiles(Array.from(e.dataTransfer.files));
    });
    dom.micBtn.addEventListener('click', toggleMic);
    dom.messageInput.addEventListener('input', autoResize);
    dom.messageInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    dom.sendBtn.addEventListener('click', () => send());
    dom.suggestionChips.addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (chip) send(chip.dataset.query);
    });
  }

  // ── Start ──────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
