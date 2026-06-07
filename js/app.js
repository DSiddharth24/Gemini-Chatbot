/**
 * app.js — Main application controller
 * No localStorage. All state is in-memory.
 */

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────
  const state = {
    mode:      'general',
    lang:      'en',
    history:   [],      // Gemini [{role, parts}] — in memory only
    files:     [],      // [{name, mimeType, data}] — current turn attachments
    generating: false,
    session:    null,
    theme:      'light',
    mediaRecorder: null,
    isRecording:   false,
  };

  // ── DOM ────────────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const dom = {
    // Header
    modeBar:       $('modeBar'),
    themeBtn:      $('themeBtn'),
    themeIcon:     $('themeIcon'),
    clearBtn:      $('clearBtn'),

    // Main
    main:          $('main'),
    pipelineBar:   $('pipelineBar'),
    emptyState:    $('emptyState'),
    messages:      $('messages'),
    suggestionChips: $('suggestionChips'),

    // Input
    attachBtn:     $('attachBtn'),
    fileInput:     $('fileInput'),
    attachedRow:   $('attachedRow'),
    messageInput:  $('messageInput'),
    micBtn:        $('micBtn'),
    sendBtn:       $('sendBtn'),
    sendIcon:      $('sendIcon'),
    statusText:    $('statusText'),
    clauseCount:   $('clauseCount'),
  };

  // ── Boot ───────────────────────────────────────────────────────────────────
  function init() {
    state.session = Storage.createNewSession();
    applyTheme('light');
    setModeUI('general');
    bind();
    dom.messageInput.focus();
  }

  // ── Theme ──────────────────────────────────────────────────────────────────
  function applyTheme(t) {
    state.theme = t;
    document.documentElement.setAttribute('data-theme', t);
    // Swap icon: moon = dark mode toggle, sun = light mode toggle
    dom.themeIcon.innerHTML = t === 'dark'
      ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
      : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  }

  // ── Mode ───────────────────────────────────────────────────────────────────
  function setModeUI(mode) {
    document.querySelectorAll('.mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    const cfg = Modes.get(mode);
    dom.messageInput.placeholder = cfg.placeholder;
  }

  function setMode(mode) {
    state.mode = mode;
    setModeUI(mode);
  }

  // ── Language (fixed to English) ───────────────────────────────────────────
  // Language toggle removed — English only

  // ── Clear session ──────────────────────────────────────────────────────────
  function clearSession() {
    state.history  = [];
    state.files    = [];
    state.session  = Storage.createNewSession();
    dom.messages.innerHTML = '';
    dom.emptyState.style.display = '';
    dom.attachedRow.innerHTML = '';
    Pipeline.resetPipeline();
    dom.pipelineBar.hidden = true;
    setStatus('ready', 'Ready');
    updateClauseCount();
    dom.messageInput.value = '';
    autoResize();
  }

  // ── File handling ──────────────────────────────────────────────────────────
  async function handleFiles(fileList) {
    for (const file of fileList) {
      const b64  = await toBase64(file);
      const mime = file.type || guessMime(file.name);
      state.files.push({ name: file.name, mimeType: mime, data: b64 });
    }
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
    const m = { pdf:'application/pdf', png:'image/png', jpg:'image/jpeg',
                jpeg:'image/jpeg', webp:'image/webp', wav:'audio/wav', mp3:'audio/mpeg' };
    return m[name.split('.').pop().toLowerCase()] || 'application/octet-stream';
  }

  function renderChips() {
    dom.attachedRow.innerHTML = '';
    state.files.forEach((f, i) => {
      const chip = document.createElement('div');
      chip.className = 'file-chip';
      chip.innerHTML = `
        <span>${mimeIcon(f.mimeType)}</span>
        <span class="file-chip-name" title="${esc(f.name)}">${esc(f.name)}</span>
        <button class="file-chip-rm" data-i="${i}" aria-label="Remove ${esc(f.name)}">✕</button>`;
      chip.querySelector('.file-chip-rm').onclick = () => {
        state.files.splice(i, 1);
        renderChips();
      };
      dom.attachedRow.appendChild(chip);
    });
  }

  function mimeIcon(m) {
    if (m.includes('pdf'))   return '📄';
    if (m.includes('image')) return '🖼';
    if (m.includes('audio')) return '🎵';
    return '📎';
  }

  // ── Microphone ─────────────────────────────────────────────────────────────
  async function toggleMic() {
    if (state.isRecording) { stopMic(); return; }
    try {
      const stream  = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec     = new MediaRecorder(stream);
      const chunks  = [];
      rec.ondataavailable = e => chunks.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        await handleFiles([new File([blob], 'voice_query.wav', { type: 'audio/wav' })]);
        stream.getTracks().forEach(t => t.stop());
      };
      state.mediaRecorder = rec;
      state.isRecording   = true;
      rec.start();
      dom.micBtn.classList.add('recording');
      dom.micBtn.setAttribute('aria-label', 'Stop recording');
    } catch {
      alert('Microphone access denied.');
    }
  }

  function stopMic() {
    state.mediaRecorder?.stop();
    state.isRecording = false;
    dom.micBtn.classList.remove('recording');
    dom.micBtn.setAttribute('aria-label', 'Voice query');
  }

  // ── Send ───────────────────────────────────────────────────────────────────
  async function send(overrideText = null) {
    if (state.generating) return;

    const text  = (overrideText ?? dom.messageInput.value).trim();
    const files = [...state.files];

    if (!text && files.length === 0) return;

    // Reset input
    state.files = [];
    renderChips();
    dom.messageInput.value = '';
    autoResize();
    dom.emptyState.style.display = 'none';

    // User message
    addMsg('user', text + (files.length ? ` [${files.map(f => f.name).join(', ')}]` : ''));

    // Pipeline
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

    // AI bubble
    const aiEl     = addMsg('ai', '', { streaming: true });
    const bubbleEl = aiEl.querySelector('.msg-bubble');

    try {
      await GeminiAPI.streamMessage({
        userMessage:   text,
        fileDataArray: files,
        history:       state.history,
        mode:          state.mode,
        lang:          state.lang,
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

          // Record history (in-memory only)
          const uParts = [];
          files.forEach(f => uParts.push({ inline_data: { mime_type: f.mimeType, data: f.data } }));
          if (text) uParts.push({ text });
          state.history.push({ role: 'user',  parts: uParts });
          state.history.push({ role: 'model', parts: [{ text: final }] });

          setStatus('ready', 'Ready');
          updateClauseCount();
          setGenerating(false);
          scrollDown();
        },
        onError: (err) => {
          Pipeline.setGeminiError();
          bubbleEl.innerHTML = `<p style="color:var(--danger)">⚠ ${esc(err.message)}</p>
            <p style="font-size:12px;color:var(--text-3);margin-top:4px">Check your API key and try again.</p>`;
          bubbleEl.classList.remove('typing');
          setStatus('error', 'Error');
          setGenerating(false);
        },
      });
    } catch (_) { /* handled in onError */ }
  }

  function setGenerating(val) {
    state.generating     = val;
    dom.sendBtn.disabled = val;

    if (val) {
      // Replace SVG icon with spinner div
      dom.sendBtn.innerHTML = '<div class="spinner"></div>';
    } else {
      // Restore SVG send icon
      dom.sendBtn.innerHTML = `
        <svg id="sendIcon" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>`;
    }
  }

  // ── Message rendering ──────────────────────────────────────────────────────
  function addMsg(role, content, opts = {}) {
    const wrap   = document.createElement('div');
    wrap.className = `msg ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = role === 'user' ? '↑' : '⚖';
    avatar.setAttribute('aria-hidden', 'true');

    const body   = document.createElement('div');
    body.className = 'msg-body';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble' + (opts.streaming ? ' typing' : '');

    if (opts.streaming) {
      bubble.textContent = '';
    } else if (opts.isHtml) {
      bubble.innerHTML = content;
    } else {
      bubble.innerHTML = content ? `<p>${esc(content)}</p>` : '';
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

  function attachActions(wrapEl, rawText) {
    const body    = wrapEl.querySelector('.msg-body');
    const actions = document.createElement('div');
    actions.className = 'msg-actions';

    const copyBtn = makeAction('Copy', () => {
      navigator.clipboard.writeText(rawText).then(() => {
        copyBtn.textContent = 'Copied';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
      });
    });

    const readBtn = makeAction('Read aloud', () => readAloud(rawText, readBtn));

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
    b.className = 'msg-action';
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  }

  // ── Read aloud ─────────────────────────────────────────────────────────────
  let ttsUtterance = null;

  function readAloud(text, btn) {
    if (!window.speechSynthesis) { alert('TTS not supported in this browser.'); return; }
    if (ttsUtterance) {
      speechSynthesis.cancel();
      ttsUtterance = null;
      btn.textContent = 'Read aloud';
      return;
    }
    const locale = { en:'en-IN', kn:'kn-IN', hi:'hi-IN' }[state.lang] || 'en-IN';
    const clean  = text
      .replace(/\[(HIGH|MED|LOW|MISSING|SIGNIFICANT|PRESENT)\]:/g, '$1 risk.')
      .replace(/[*_#>`]/g, '').replace(/\n+/g, '. ');

    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang  = locale;
    utt.rate  = 0.92;
    utt.onstart = () => { btn.textContent = 'Stop'; };
    utt.onend   = () => { btn.textContent = 'Read aloud'; ttsUtterance = null; };
    utt.onerror = () => { btn.textContent = 'Read aloud'; ttsUtterance = null; };
    ttsUtterance = utt;
    speechSynthesis.speak(utt);
  }

  // ── Status helpers ─────────────────────────────────────────────────────────
  function setStatus(cls, text) {
    dom.statusText.className = cls;
    dom.statusText.textContent = text;
  }

  function updateClauseCount() {
    const n = Pipeline.getClauseCount();
    if (n > 0) {
      dom.clauseCount.textContent = `${n} clauses indexed`;
      dom.clauseCount.style.display = '';
    } else {
      dom.clauseCount.style.display = 'none';
    }
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

  // ── Event binding ──────────────────────────────────────────────────────────
  function bind() {
    // Theme
    dom.themeBtn.addEventListener('click', () => {
      applyTheme(state.theme === 'dark' ? 'light' : 'dark');
    });

    // Clear
    dom.clearBtn.addEventListener('click', clearSession);

    // Modes
    dom.modeBar.addEventListener('click', e => {
      const b = e.target.closest('.mode-btn');
      if (b) setMode(b.dataset.mode);
    });

    // Files
    dom.attachBtn.addEventListener('click', () => dom.fileInput.click());
    dom.fileInput.addEventListener('change', e => {
      handleFiles(Array.from(e.target.files));
      e.target.value = '';
    });

    // Drag & drop onto main
    dom.main.addEventListener('dragover', e => e.preventDefault());
    dom.main.addEventListener('drop', e => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      if (files.length) handleFiles(files);
    });

    // Mic
    dom.micBtn.addEventListener('click', toggleMic);

    // Textarea
    dom.messageInput.addEventListener('input', autoResize);
    dom.messageInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });

    // Send
    dom.sendBtn.addEventListener('click', () => send());

    // Suggestions
    dom.suggestionChips.addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (chip) send(chip.dataset.query);
    });

    // Escape key — no-op (no modal)
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { /* reserved */ }
    });
  }

  // ── Start ──────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
