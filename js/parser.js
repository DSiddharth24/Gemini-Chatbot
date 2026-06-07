/**
 * parser.js — Response parsing and markdown rendering
 * Converts Gemini text output into structured UI components
 */

const Parser = (() => {
  // ── Risk Token Regex ─────────────────────────
  // Supports flexible formats like: [HIGH]: Clause, HIGH **Clause**, **[HIGH]**: Clause, etc.
  const RISK_PATTERN = /^(?:[-*•\d+.]\s*)*(?:\*\*|\*|_)*\[?(HIGH|MED|LOW|MISSING|SIGNIFICANT|PRESENT)\]?(?:\*\*|\*|_)*(?:\s*:\s*|\s*—\s*|\s*-\s*|\s+(?=\*\*|\[|\d))(.+)$/i;

  // ── Markdown → HTML ──────────────────────────
  function renderMarkdown(text) {
    if (!text) return '';

    // Normalize line endings
    text = text.replace(/\r\n/g, '\n');
    let html = escapeUnsafe(text);

    // ── 1. Protect fenced code blocks from further processing ──
    const codeBlocks = [];
    html = html.replace(/```(?:\w*)\n?([\s\S]*?)```/g, (_, code) => {
      codeBlocks.push(`<pre><code>${code.trim()}</code></pre>`);
      return `\n\x00CB${codeBlocks.length - 1}\x00\n`;
    });

    // ── 2. Inline code ──
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // ── 3. Headings ──
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm,   '<h1>$1</h1>');

    // ── 4. Horizontal rules ──
    html = html.replace(/^---+$/gm, '<hr>');

    // ── 5. Blockquotes (> was escaped to &gt; by escapeUnsafe) ──
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/<\/blockquote>\n<blockquote>/g, '<br>');

    // ── 6. Tables ──
    html = html.replace(/((?:^\|.+\|$\n?)+)/gm, match => {
      const rows = match.trim().split('\n').filter(r => r.trim());
      if (rows.length < 2) return match;

      const parseCells = row =>
        row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

      const isSep = /^\|[\s\-:|]+\|$/.test(rows[1]);
      let thead = '', tbody = '';

      if (isSep && rows.length >= 3) {
        const hCells = parseCells(rows[0]);
        thead = `<thead><tr>${hCells.map(c => `<th>${c}</th>`).join('')}</tr></thead>`;
        tbody = `<tbody>${rows.slice(2).map(r => {
          const cells = parseCells(r);
          return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
        }).join('')}</tbody>`;
      } else {
        tbody = `<tbody>${rows.map(r => {
          const cells = parseCells(r);
          return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
        }).join('')}</tbody>`;
      }

      return `<table>${thead}${tbody}</table>\n`;
    });

    // ── 7. Lists (before bold/italic to avoid * conflicts) ──
    // Unordered
    html = html.replace(/((?:^[*\-\u2022] .+(?:\n|$))+)/gm, match => {
      const items = match.trim().split('\n')
        .filter(l => l.trim())
        .map(l => `<li>${l.replace(/^[*\-\u2022] /, '')}</li>`)
        .join('');
      return `<ul>${items}</ul>\n`;
    });
    // Ordered
    html = html.replace(/((?:^\d+[\.\)] .+(?:\n|$))+)/gm, match => {
      const items = match.trim().split('\n')
        .filter(l => l.trim())
        .map(l => `<li>${l.replace(/^\d+[\.\)] /, '')}</li>`)
        .join('');
      return `<ol>${items}</ol>\n`;
    });

    // ── 8. Bold + italic (after lists so * list markers are already consumed) ──
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>');
    html = html.replace(/\*(?!\s)(.+?)(?<!\s)\*/g, '<em>$1</em>');
    html = html.replace(/(?<!\w)_(.+?)_(?!\w)/g,   '<em>$1</em>');

    // ── 9. Paragraphs and line breaks ──
    // Split by double-newline boundaries into blocks
    const blocks = html.split(/\n{2,}/);
    html = blocks.map(block => {
      block = block.trim();
      if (!block) return '';
      // Don't wrap block-level elements in <p>
      if (/^<(?:h[1-6]|pre|ul|ol|blockquote|div|hr|table)[\s>\/]/.test(block) ||
          block.startsWith('\x00')) {
        return block;
      }
      // Single newlines → <br> within inline content
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    }).filter(Boolean).join('\n');

    // ── 10. Restore code blocks ──
    codeBlocks.forEach((block, i) => {
      html = html.replace(`\x00CB${i}\x00`, block);
    });

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
      let safeText = item.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      // Re-apply common inline formatting (bold and code backticks)
      safeText = safeText
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
      return `
        <div class="risk-row">
          <span class="risk-tag ${item.level}">${item.level}</span>
          <span>${safeText}</span>
        </div>`;
    }).join('');

    const counts = {
      HIGH: items.filter(i => i.level === 'HIGH').length,
      MED:  items.filter(i => i.level === 'MED').length,
      LOW:  items.filter(i => i.level === 'LOW').length,
    };

    const summary = [
      counts.HIGH ? `<span>${counts.HIGH} High</span>` : '',
      counts.MED  ? `<span>${counts.MED} Med</span>`   : '',
      counts.LOW  ? `<span>${counts.LOW} Low</span>`   : '',
    ].filter(Boolean).join(' · ');

    return `
      <div class="risk-block">
        <div class="risk-block-header">
          🔍 Risk Analysis Results
          ${summary ? `<span>${summary}</span>` : ''}
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
        <div class="risk-block-header" style="border:1px solid var(--border);border-bottom:none;border-radius:var(--radius) var(--radius) 0 0;">
          📋 Clause Coverage
          <span>
            <span>${presentCount} Present</span> ·
            <span>${missingCount} Missing</span>
          </span>
        </div>
        <div class="clause-grid" style="border:1px solid var(--border);border-top:none;border-radius:0 0 var(--radius);padding:12px;margin:0;">${cards}</div>
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
