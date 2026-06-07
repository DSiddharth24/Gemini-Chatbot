/**
 * parser.js — Response parsing and markdown rendering
 * Converts Gemini text output into structured UI components
 */

const Parser = (() => {
  // ── Risk Token Regex ─────────────────────────
  const RISK_PATTERN  = /^\[(HIGH|MED|LOW|MISSING|SIGNIFICANT|PRESENT)\]:\s*(.+)$/;

  // ── Markdown → HTML ──────────────────────────
  function renderMarkdown(text) {
    if (!text) return '';
    let html = escapeUnsafe(text);

    // Code blocks (must come before inline code)
    html = html.replace(/```([\s\S]*?)```/g, (_, code) =>
      `<pre><code>${code.trim()}</code></pre>`
    );

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headings
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm,   '<h1>$1</h1>');

    // Bold + italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g,          '<em>$1</em>');
    html = html.replace(/_(.+?)_/g,            '<em>$1</em>');

    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

    // Unordered lists
    html = html.replace(/((?:^[-•*] .+\n?)+)/gm, match => {
      const items = match.trim().split('\n').map(l =>
        `<li>${l.replace(/^[-•*] /, '')}</li>`
      ).join('');
      return `<ul>${items}</ul>`;
    });

    // Ordered lists
    html = html.replace(/((?:^\d+\. .+\n?)+)/gm, match => {
      const items = match.trim().split('\n').map(l =>
        `<li>${l.replace(/^\d+\. /, '')}</li>`
      ).join('');
      return `<ol>${items}</ol>`;
    });

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr>');

    // Paragraphs — wrap bare lines
    html = html.replace(/\n\n+/g, '</p><p>');
    html = `<p>${html}</p>`;

    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<[hpuobd])/g, '$1');
    html = html.replace(/(<\/[hpuobd][^>]*>)<\/p>/g, '$1');

    return html;
  }

  // Prevent XSS — escape HTML special chars in user-provided text
  function escapeUnsafe(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Restore our own markdown-generated tags after escaping
      // (We process markdown AFTER escaping, so this is safe)
      ;
    // Note: escaping happens before markdown processing, so
    // the markdown tags we add are our own and are safe.
  }

  // ── Structured Token Extraction ──────────────
  /**
   * Parse [HIGH], [MED], [LOW], [MISSING], [SIGNIFICANT], [PRESENT] lines
   * Returns { items: [{level, text}], remainingText }
   */
  function extractRiskItems(text) {
    const lines = text.split('\n');
    const riskItems = [];
    const remainingLines = [];

    lines.forEach(line => {
      const match = line.trim().match(RISK_PATTERN);
      if (match) {
        riskItems.push({ level: match[1], text: match[2].trim() });
      } else {
        remainingLines.push(line);
      }
    });

    return {
      items: riskItems,
      remainingText: remainingLines.join('\n').trim(),
    };
  }

  // ── Risk Heatmap Block ───────────────────────
  function buildRiskHeatmap(items) {
    if (!items || items.length === 0) return '';

    const levelOrder = { HIGH: 0, MED: 1, LOW: 2, MISSING: 3, SIGNIFICANT: 4, PRESENT: 5 };
    const sorted = [...items].sort((a, b) =>
      (levelOrder[a.level] ?? 99) - (levelOrder[b.level] ?? 99)
    );

    const rows = sorted.map(item => {
      const safeText = item.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `
        <div class="risk-item">
          <span class="risk-badge ${item.level}">${item.level}</span>
          <span class="risk-text">${safeText}</span>
        </div>`;
    }).join('');

    const counts = {
      HIGH: items.filter(i => i.level === 'HIGH').length,
      MED:  items.filter(i => i.level === 'MED').length,
      LOW:  items.filter(i => i.level === 'LOW').length,
    };

    const summary = [
      counts.HIGH ? `<span style="color:var(--high-risk)">${counts.HIGH} High</span>` : '',
      counts.MED  ? `<span style="color:var(--med-risk)">${counts.MED} Med</span>`   : '',
      counts.LOW  ? `<span style="color:var(--low-risk)">${counts.LOW} Low</span>`   : '',
    ].filter(Boolean).join(' · ');

    return `
      <div class="risk-heatmap">
        <div class="risk-heatmap-title">
          🔍 Risk Analysis Results
          ${summary ? `<span style="margin-left:auto;font-weight:400">${summary}</span>` : ''}
        </div>
        ${rows}
      </div>`;
  }

  // ── Clause Coverage Grid ─────────────────────
  function buildClauseGrid(items) {
    const clauseItems = items.filter(i =>
      i.level === 'PRESENT' || i.level === 'MISSING'
    );
    if (clauseItems.length === 0) return '';

    const cards = clauseItems.map(item => {
      const status = item.level.toLowerCase();
      const safeText = item.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      // Extract just the clause name (before any dash)
      const clauseName = safeText.split('—')[0].split('-')[0].trim();
      return `
        <div class="clause-card ${status}">
          <div class="clause-card-name">${clauseName}</div>
          <span class="clause-card-badge">${item.level}</span>
        </div>`;
    }).join('');

    const presentCount = clauseItems.filter(i => i.level === 'PRESENT').length;
    const missingCount = clauseItems.filter(i => i.level === 'MISSING').length;

    return `
      <div style="margin:8px 0">
        <div class="risk-heatmap-title" style="background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius-md) var(--radius-md) 0 0;padding:10px 14px;font-size:12px;font-weight:600;color:var(--text-secondary)">
          📋 Clause Coverage
          <span style="margin-left:auto;font-weight:400">
            <span style="color:var(--low-risk)">${presentCount} Present</span> ·
            <span style="color:var(--missing)">${missingCount} Missing</span>
          </span>
        </div>
        <div class="clause-grid" style="border:1px solid var(--border);border-top:none;border-radius:0 0 var(--radius-md) var(--radius-md);padding:12px">${cards}</div>
      </div>`;
  }

  // ── Full Response Processor ──────────────────
  /**
   * Process raw Gemini text response:
   * 1. Extract structured tokens
   * 2. Render remaining markdown
   * 3. Build visual components
   * Returns HTML string
   */
  function processResponse(rawText, mode) {
    if (!rawText) return '';

    const { items, remainingText } = extractRiskItems(rawText);

    let html = '';

    // Prose section (markdown rendered)
    if (remainingText) {
      html += `<div class="prose">${renderMarkdown(remainingText)}</div>`;
    }

    // Visual components
    if (items.length > 0) {
      const riskItems = items.filter(i => ['HIGH', 'MED', 'LOW', 'SIGNIFICANT'].includes(i.level));
      const clauseItems = items.filter(i => ['PRESENT', 'MISSING'].includes(i.level));

      if (riskItems.length > 0 || items.some(i => i.level === 'SIGNIFICANT')) {
        html += buildRiskHeatmap(items.filter(i => i.level !== 'PRESENT'));
      }

      if (clauseItems.length > 0) {
        html += buildClauseGrid(items);
      }
    }

    return html || '<p>No response generated.</p>';
  }

  // ── Escape for safe text display ─────────────
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }

  return {
    renderMarkdown,
    extractRiskItems,
    buildRiskHeatmap,
    buildClauseGrid,
    processResponse,
    escapeHtml,
  };
})();
