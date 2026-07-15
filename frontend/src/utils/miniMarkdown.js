// miniMarkdown — renderizador Markdown mínimo y autocontenido para la wiki
// in-app. Soporta encabezados, negrita/cursiva/código inline, enlaces, bloques
// de código con fences, listas (ordenadas y no), tablas, citas y reglas
// horizontales. El texto se escapa siempre; el contenido es estático (nuestra
// propia wiki), no entrada del usuario.

const SENT = ''; // centinela de área privada Unicode para código inline

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Marcado inline: código, negrita, cursiva y enlaces. Se aplica sobre texto ya
// escapado, cuidando de no re-procesar el interior de los spans de código.
const renderInline = (text) => {
  const codeSpans = [];
  let out = text.replace(/`([^`]+)`/g, (_, code) => {
    codeSpans.push(code);
    return SENT + (codeSpans.length - 1) + SENT;
  });
  out = escapeHtml(out);
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const safe = href.replace(/"/g, '%22');
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  out = out.replace(
    new RegExp(SENT + '(\\d+)' + SENT, 'g'),
    (_, i) => `<code>${escapeHtml(codeSpans[+i])}</code>`
  );
  return out;
};

const renderTableRow = (line, cell) => {
  const cells = line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  return '<tr>' + cells.map((c) => `<${cell}>${renderInline(c)}</${cell}>`).join('') + '</tr>';
};

/**
 * Convierte una cadena Markdown en HTML.
 * @param {string} md
 * @returns {string} HTML
 */
export const mdToHtml = (md) => {
  const lines = (md || '').replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let i = 0;

  const listStack = [];
  const closeList = () => {
    while (listStack.length) html.push(`</${listStack.pop()}>`);
  };

  while (i < lines.length) {
    const line = lines[i];

    // Bloque de código con fences ```
    if (/^```/.test(line)) {
      closeList();
      const body = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // saltar el fence de cierre
      html.push(`<pre><code>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }

    // Tabla (línea con | seguida de un separador |---|)
    if (/^\|.*\|$/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1])) {
      closeList();
      const rows = [renderTableRow(line, 'th')];
      i += 2;
      while (i < lines.length && /^\|.*\|$/.test(lines[i])) {
        rows.push(renderTableRow(lines[i], 'td'));
        i++;
      }
      html.push(`<table class="wiki-tbl">${rows.join('')}</table>`);
      continue;
    }

    // Encabezados
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    // Regla horizontal
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      closeList();
      html.push('<hr />');
      i++;
      continue;
    }

    // Cita
    if (/^>\s?/.test(line)) {
      closeList();
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      html.push(`<blockquote>${renderInline(quote.join(' '))}</blockquote>`);
      continue;
    }

    // Lista no ordenada
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (ul) {
      if (listStack[listStack.length - 1] !== 'ul') {
        closeList();
        listStack.push('ul');
        html.push('<ul>');
      }
      html.push(`<li>${renderInline(ul[1])}</li>`);
      i++;
      continue;
    }

    // Lista ordenada
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) {
      if (listStack[listStack.length - 1] !== 'ol') {
        closeList();
        listStack.push('ol');
        html.push('<ol>');
      }
      html.push(`<li>${renderInline(ol[1])}</li>`);
      i++;
      continue;
    }

    // Línea en blanco
    if (/^\s*$/.test(line)) {
      closeList();
      i++;
      continue;
    }

    // Párrafo (acumula líneas contiguas)
    closeList();
    const para = [line];
    i++;
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\|.*\|$/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    html.push(`<p>${renderInline(para.join(' '))}</p>`);
  }

  closeList();
  return html.join('\n');
};
