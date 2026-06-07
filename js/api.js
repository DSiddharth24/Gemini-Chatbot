/**
 * api.js — Gemini 1.5 Pro API integration
 * Handles: streaming SSE, multimodal input, conversation history,
 * system instructions, safety settings, generation config
 */

const GeminiAPI = (() => {
  const MODEL    = 'gemini-1.5-pro';
  const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent`;

  const GENERATION_CONFIG = {
    temperature:      0.2,   // Low temp = grounded legal reasoning
    maxOutputTokens:  2048,
    topP:             0.85,
    topK:             40,
  };

  const SAFETY_SETTINGS = [
    { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
  ];

  /**
   * Stream a response from Gemini 1.5 Pro
   * @param {Object} options
   * @param {string}   options.apiKey         — Gemini API key
   * @param {string}   options.userMessage     — current user text
   * @param {Array}    options.fileDataArray   — [{name, mimeType, data (base64)}]
   * @param {Array}    options.history         — conversation history [{role, parts:[{text}]}]
   * @param {string}   options.mode            — active analysis mode key
   * @param {string}   options.lang            — 'en' | 'kn' | 'hi'
   * @param {string}   options.clauseContext   — clause index string from pipeline
   * @param {function} options.onChunk         — called with each text delta (string)
   * @param {function} options.onDone          — called when stream ends
   * @param {function} options.onError         — called on error (Error)
   */
  async function streamMessage({
    apiKey,
    userMessage,
    fileDataArray = [],
    history = [],
    mode = 'general',
    lang = 'en',
    clauseContext = '',
    onChunk,
    onDone,
    onError,
  }) {
    try {
      // ── Stage 4: Build system instruction ─────
      const systemInstruction = Modes.buildSystemInstruction(mode, lang, clauseContext);

      // ── Build current user parts ───────────────
      const userParts = [];

      // Attach files as inline_data
      for (const file of fileDataArray) {
        userParts.push({
          inline_data: {
            mime_type: file.mimeType,
            data:      file.data,
          },
        });
      }

      // Append user text
      if (userMessage.trim()) {
        userParts.push({ text: userMessage });
      }

      // ── Assemble full contents array ───────────
      // Full history + current turn
      const contents = [
        ...history,
        { role: 'user', parts: userParts },
      ];

      // ── Build request payload ──────────────────
      const payload = {
        contents,
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        generationConfig: GENERATION_CONFIG,
        safetySettings:   SAFETY_SETTINGS,
      };

      // ── Stage 5: Call Gemini streaming API ─────
      const url = `${ENDPOINT}?key=${encodeURIComponent(apiKey)}&alt=sse`;
      const response = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      if (!response.ok) {
        let errMsg = `API error ${response.status}`;
        try {
          const errBody = await response.json();
          errMsg = errBody?.error?.message || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      // ── Consume SSE stream ─────────────────────
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

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

            // Check for finish reason
            const finishReason = chunk?.candidates?.[0]?.finishReason;
            if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
              console.warn('Gemini finish reason:', finishReason);
            }
          } catch (parseErr) {
            // Skip malformed SSE chunks
          }
        }
      }

      onDone?.(fullText);
      return fullText;

    } catch (err) {
      onError?.(err);
      throw err;
    }
  }

  /**
   * Estimate token count (rough — 1 token ≈ 4 chars for English)
   */
  function estimateTokens(history, currentMessage, clauseContext) {
    let total = 0;
    history.forEach(turn => {
      turn.parts?.forEach(p => { total += (p.text?.length || 0) / 4; });
    });
    total += (currentMessage?.length || 0) / 4;
    total += (clauseContext?.length || 0) / 4;
    total += 500; // system instruction overhead
    return Math.round(total);
  }

  return { streamMessage, estimateTokens };
})();
