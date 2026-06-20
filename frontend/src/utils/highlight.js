// Resaltado de coincidencias de búsqueda en texto, optimizado para textos grandes
// (limita el procesado para no congelar la UI).

export function highlightMatches(text, pattern, isRegex, currentIdx) {
  if (!pattern) return { html: text, count: 0 };

  try {
    const MAX_HIGHLIGHT_SIZE = 500 * 1024; // límite de 500KB
    const MAX_MATCHES = 10000; // máximo de coincidencias a resaltar

    let processText = text;
    let isTruncated = false;

    if (text.length > MAX_HIGHLIGHT_SIZE) {
      processText = text.substring(0, MAX_HIGHLIGHT_SIZE);
      isTruncated = true;
    }

    // Escapar HTML
    const safe = processText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const escaped = isRegex ? pattern : pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(' + escaped + ')', 'gi');

    let count = 0;
    let matchCount = 0;

    const matches = safe.match(re);
    const totalMatches = matches ? Math.min(matches.length, MAX_MATCHES) : 0;

    const html = safe.replace(re, (match) => {
      if (matchCount >= MAX_MATCHES) {
        return match; // dejar de resaltar tras el límite
      }
      const cls = count === currentIdx ? 'search-hl search-cur' : 'search-hl';
      count++;
      matchCount++;
      return '<mark class="' + cls + '">' + match + '</mark>';
    });

    let finalHtml = html;
    if (isTruncated) {
      finalHtml = html + '\n\n<div style="color: var(--orange); padding: 10px; background: rgba(210,153,34,0.1); margin-top: 10px;">' +
        '⚠ Search limited to first 500KB for performance. Total text size: ' + (text.length / 1024).toFixed(0) + 'KB' +
        '</div>';
    } else if (matchCount >= MAX_MATCHES) {
      finalHtml = html + '\n\n<div style="color: var(--orange); padding: 10px; background: rgba(210,153,34,0.1); margin-top: 10px;">' +
        '⚠ Showing first 10,000 matches only. Refine your search for better results.' +
        '</div>';
    }

    return { html: finalHtml, count: totalMatches };
  } catch (e) {
    console.error('Search error:', e);
    return {
      html: text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
      count: 0
    };
  }
}
