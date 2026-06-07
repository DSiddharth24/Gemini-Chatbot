/**
 * api.js — Gemini proxy client
 * POSTs to /api/chat on the Flask server. The API key never touches the browser.
 */

const GeminiAPI = (() => {
  const PROXY = '/api/chat';

  const GENERATION_CONFIG = {
    temperature:     0.2,
    maxOutputTokens: 8192,
    topP:            0.85,
    topK:            40,
  };

  const SAFETY_SETTINGS = [
    { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
  ];

  /** Pull text delta out of a Gemini SSE chunk, handles all response shapes */
  function extractDelta(chunk) {
    try {
      const parts = chunk?.candidates?.[0]?.content?.parts;
      if (Array.isArray(parts)) {
        return parts.map(p => p.text || '').join('');
      }
    } catch (_) {}
    return '';
  }

  /**
   * Stream a response from Gemini via the server proxy.
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
    // AbortController so we can cancel a hung request
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 180_000);

    try {
      const systemInstruction = Modes.buildSystemInstruction(mode, lang, clauseContext);

      // ── Build user parts ──────────────────────────────────────────────────
      const userParts = [];

      for (const file of fileDataArray) {
        if (file.extractedText) {
          // DOCX / TXT — full text injected directly
          userParts.push({
            text: `--- START OF DOCUMENT: ${file.name} ---\n\n${file.extractedText}\n\n--- END OF DOCUMENT: ${file.name} ---`,
          });
        } else if (file.data) {
          // PDF / image / audio — native multimodal inline_data
          userParts.push({
            inline_data: { mime_type: file.mimeType, data: file.data },
          });
        }
      }

      if (userMessage && userMessage.trim()) {
        userParts.push({ text: userMessage.trim() });
      }

      if (userParts.length === 0) {
        throw new Error('Nothing to send — add a message or attach a file.');
      }

      const payload = {
        contents: [
          ...history,
          { role: 'user', parts: userParts },
        ],
        system_instruction: { parts: [{ text: systemInstruction }] },
        generationConfig:   GENERATION_CONFIG,
        safetySettings:     SAFETY_SETTINGS,
      };

      // ── Fetch ─────────────────────────────────────────────────────────────
      const response = await fetch(PROXY, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
        signal:  controller.signal,
      });

      if (!response.ok) {
        let msg = `Server error ${response.status}`;
        try {
          const e = await response.json();
          msg = e?.error?.message || msg;
        } catch (_) {}
        throw new Error(msg);
      }

      // ── Read SSE stream ───────────────────────────────────────────────────
      const reader  = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer    = '';
      let fullText  = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode and append to buffer, handle both \n and \r\n
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? ''; // keep last incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let jsonStr = null;
          if (trimmed.startsWith('data:')) {
            jsonStr = trimmed.slice(5).trim();
          } else if (trimmed.startsWith('{')) {
            jsonStr = trimmed; // raw JSON without SSE prefix
          }

          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const chunk = JSON.parse(jsonStr);

            // Surface API-level errors embedded in the stream
            if (chunk?.error) {
              throw new Error(chunk.error.message || 'Gemini API error in stream');
            }

            const delta = extractDelta(chunk);
            if (delta) {
              fullText += delta;
              onChunk?.(delta, fullText);
            }
          } catch (e) {
            // Ignore JSON syntax errors in streaming chunks (e.g. malformed or partial frames), re-throw real errors
            if (!(e instanceof SyntaxError)) {
              throw e;
            }
          }
        }
      }

      // Drain any remaining buffer
      if (buffer.trim()) {
        const jsonStr = buffer.trim().startsWith('data:')
          ? buffer.trim().slice(5).trim()
          : buffer.trim();
        if (jsonStr && jsonStr !== '[DONE]') {
          try {
            const chunk = JSON.parse(jsonStr);
            const delta = extractDelta(chunk);
            if (delta) fullText += delta;
          } catch (_) {}
        }
      }

      clearTimeout(timeout);

      if (!fullText.trim()) {
        throw new Error('Gemini returned an empty response. The document may be too large, or the request was blocked by safety filters.');
      }

      onDone?.(fullText);

    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        onError?.(new Error('Request timed out. Try a shorter document or question.'));
      } else {
        onError?.(err);
      }
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
