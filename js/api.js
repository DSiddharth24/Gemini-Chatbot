/**
 * api.js — Gemini proxy client
 * Calls /api/chat on our own server — the API key never touches the browser.
 */

const GeminiAPI = (() => {
  const PROXY    = '/api/chat';
  const MODEL    = 'gemini-1.5-pro';

  const GENERATION_CONFIG = {
    temperature:     0.2,
    maxOutputTokens: 2048,
    topP:            0.85,
    topK:            40,
  };

  const SAFETY_SETTINGS = [
    { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
  ];

  /**
   * Stream a response via the server proxy.
   * @param {Object} options
   * @param {string}   options.userMessage
   * @param {Array}    options.fileDataArray  [{name, mimeType, data}]
   * @param {Array}    options.history        Gemini [{role, parts}]
   * @param {string}   options.mode
   * @param {string}   options.lang           'en' | 'kn' | 'hi'
   * @param {string}   options.clauseContext
   * @param {function} options.onChunk        (delta, accumulated) => void
   * @param {function} options.onDone         (fullText) => void
   * @param {function} options.onError        (Error) => void
   */
  async function streamMessage({
    userMessage,
    fileDataArray = [],
    history       = [],
    mode          = 'general',
    lang          = 'en',
    clauseContext = '',
    onChunk,
    onDone,
    onError,
  }) {
    try {
      const systemInstruction = Modes.buildSystemInstruction(mode, lang, clauseContext);

      // Build user parts
      const userParts = [];
      for (const file of fileDataArray) {
        userParts.push({ inline_data: { mime_type: file.mimeType, data: file.data } });
      }
      if (userMessage.trim()) userParts.push({ text: userMessage });

      const payload = {
        contents: [...history, { role: 'user', parts: userParts }],
        system_instruction: { parts: [{ text: systemInstruction }] },
        generationConfig:   GENERATION_CONFIG,
        safetySettings:     SAFETY_SETTINGS,
      };

      const response = await fetch(PROXY, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      if (!response.ok) {
        let msg = `Server error ${response.status}`;
        try { const e = await response.json(); msg = e?.error?.message || msg; } catch {}
        throw new Error(msg);
      }

      // Consume SSE stream from proxy
      const reader  = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer   = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const chunk = JSON.parse(jsonStr);
            const delta = chunk?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (delta) {
              fullText += delta;
              onChunk?.(delta, fullText);
            }
          } catch { /* skip malformed chunk */ }
        }
      }

      onDone?.(fullText);

    } catch (err) {
      onError?.(err);
    }
  }

  function estimateTokens(history, currentMessage, clauseContext) {
    let total = 500;
    history.forEach(t => t.parts?.forEach(p => { total += (p.text?.length || 0) / 4; }));
    total += (currentMessage?.length || 0) / 4;
    total += (clauseContext?.length  || 0) / 4;
    return Math.round(total);
  }

  return { streamMessage, estimateTokens };
})();
