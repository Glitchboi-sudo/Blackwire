export const buildHighlighter = rules => text => {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const tokens = [];
  for (const [cls, regex] of rules) {
    const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
    const r = new RegExp(regex.source, flags);
    r.lastIndex = 0;
    let m;
    while ((m = r.exec(text)) !== null) {
      if (m[0].length === 0) { r.lastIndex++; continue; }
      tokens.push({ start: m.index, end: m.index + m[0].length, cls });
    }
  }
  tokens.sort((a, b) => a.start - b.start || b.end - a.end);
  let html = '', pos = 0;
  for (const { start, end, cls } of tokens) {
    if (start < pos) continue;
    html += esc(text.slice(pos, start));
    html += '<span class="' + cls + '">' + esc(text.slice(start, end)) + '</span>';
    pos = end;
  }
  return html + esc(text.slice(pos));
};

export const syntaxHighlightJSON = buildHighlighter([
  ['json-key',    /"(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"(?=\s*:)/g],
  ['json-string', /"(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"/g],
  ['json-bool',   /\b(?:true|false)\b/g],
  ['json-null',   /\bnull\b/g],
  ['json-number', /-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?/g],
]);

export const syntaxHighlightXML = buildHighlighter([
  ['json-null',   /<!--[\s\S]*?-->/g],
  ['json-string', /"[^"]*"|'[^']*'/g],
  ['json-bool',   /\b[\w:.-]+(?==)/g],
  ['json-key',    /<\/?[\w:.-]+/g],
]);

export const syntaxHighlightProto = buildHighlighter([
  ['json-null',   /\/\/[^\n]*/gm],
  ['json-key',    /\bfield \d+\b/g],
  ['json-bool',   /\b(?:varint|string|bytes|message|fixed32|fixed64)\b/g],
  ['json-number', /(?<=:\s*)\d+(?:\.\d+)?(?=\s*$)/gm],
  ['json-string', /(?<=:\s*).+$/gm],
]);

// Sistema de syntax highlighting avanzado para múltiples lenguajes
export const syntaxHighlightHTML = buildHighlighter([
  ['json-null',   /<!--[\s\S]*?-->/g],
  ['json-null',   /<!DOCTYPE[^>]*>/gi],
  ['json-string', /"[^"]*"|'[^']*'/g],
  ['json-bool',   /\b[\w:-]+(?==)/g],
  ['json-key',    /<\/?[\w:-]+/g],
]);

export const syntaxHighlightCSS = buildHighlighter([
  ['json-null',   /\/\*[\s\S]*?\*\//g],
  ['json-null',   /@[\w-]+/g],
  ['json-string', /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g],
  ['json-string', /#[0-9a-fA-F]{3,8}\b/g],
  ['json-number', /\b\d+\.?\d*(?:px|em|rem|vw|vh|%|pt|cm|mm|in|s|ms|deg|fr|ch|ex|vmin|vmax)\b/gi],
  ['json-key',    /^[^{};@\n][^{};@\n]*(?=\s*\{)/gm],
  ['json-bool',   /\b[\w-]+(?=\s*:)/g],
]);

export const syntaxHighlightJS = buildHighlighter([
  ['json-null',   /\/\/[^\n]*/gm],
  ['json-null',   /\/\*[\s\S]*?\*\//g],
  ['json-string', /`(?:\\[\s\S]|[^`\\])*`/g],
  ['json-string', /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g],
  ['json-number', /\b\d+\.?\d*(?:[eE][+-]?\d+)?\b/g],
  ['json-bool',   /\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|class|extends|import|export|from|default|async|await|yield|typeof|instanceof|delete|void|null|undefined|true|false|this|super|static|get|set)\b/g],
  ['json-key',    /\b[a-zA-Z_$][\w$]*(?=\s*\()/g],
]);

export const syntaxHighlightPython = buildHighlighter([
  ['json-null',   /#[^\n]*/gm],
  ['json-string', /"""[\s\S]*?"""|'''[\s\S]*?'''/g],
  ['json-string', /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g],
  ['json-number', /\b\d+\.?\d*(?:[eE][+-]?\d+)?\b/g],
  ['json-bool',   /\b(?:def|class|if|elif|else|for|while|return|import|from|as|try|except|finally|with|lambda|yield|async|await|pass|break|continue|raise|assert|del|global|nonlocal|and|or|not|in|is|None|True|False)\b/g],
  ['json-key',    /\b[a-zA-Z_]\w*(?=\s*\()/g],
]);

export const syntaxHighlightPHP = buildHighlighter([
  ['json-null',   /\/\/[^\n]*|#[^\n]*/gm],
  ['json-null',   /\/\*[\s\S]*?\*\//g],
  ['json-string', /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g],
  ['json-key',    /\$[a-zA-Z_]\w*/g],
  ['json-number', /\b\d+\.?\d*\b/g],
  ['json-bool',   /\b(?:function|return|if|else|elseif|for|foreach|while|do|switch|case|break|continue|try|catch|finally|throw|new|class|extends|implements|public|private|protected|static|const|namespace|use|as|trait|interface|abstract|final|echo|print|include|require|include_once|require_once|array|true|false|null)\b/g],
]);

export const syntaxHighlightSQL = buildHighlighter([
  ['json-null',   /--[^\n]*/gm],
  ['json-null',   /\/\*[\s\S]*?\*\//g],
  ['json-string', /'(?:''|[^'])*'/g],
  ['json-number', /\b\d+\.?\d*\b/g],
  ['json-bool',   /\b(?:SELECT|FROM|WHERE|AND|OR|NOT|IN|LIKE|BETWEEN|IS|NULL|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|ON|GROUP|ORDER|BY|HAVING|LIMIT|OFFSET|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|INDEX|VIEW|DATABASE|SCHEMA|PRIMARY|FOREIGN|KEY|REFERENCES|CONSTRAINT|UNIQUE|DEFAULT|AUTO_INCREMENT|CASCADE|TRUNCATE|UNION|ALL|DISTINCT|AS|CASE|WHEN|THEN|ELSE|END)\b/gi],
]);

export const syntaxHighlightYAML = buildHighlighter([
  ['json-null',   /#[^\n]*/gm],
  ['json-string', /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g],
  ['json-key',    /^[ \t]*[\w-]+(?=\s*:)/gm],
  ['json-bool',   /\b(?:true|false|null|yes|no|on|off)\b/gi],
  ['json-number', /\b-?\d+\.?\d*\b/g],
]);

export const syntaxHighlightGraphQL = buildHighlighter([
  ['json-null',   /#[^\n]*/gm],
  ['json-string', /"(?:\\.|[^"\\])*"/g],
  ['json-bool',   /\b(?:query|mutation|subscription|fragment|on|type|interface|union|enum|input|schema|extend|implements|directive|scalar)\b/g],
  ['json-key',    /\b[A-Z][a-zA-Z0-9]*\b/g],
]);

export const syntaxHighlightShell = buildHighlighter([
  ['json-null',   /#[^\n]*/gm],
  ['json-string', /"(?:\\.|[^"\\])*"|'[^']*'/g],
  ['json-key',    /\$\{?[a-zA-Z_]\w*\}?|\$\d+/g],
  ['json-bool',   /\b(?:echo|cd|ls|mkdir|rm|cp|mv|cat|grep|awk|sed|find|chmod|chown|sudo|apt|yum|npm|yarn|git|docker|curl|wget|ssh|scp|tar|zip|unzip|ps|kill|top|df|du|if|then|else|elif|fi|for|while|do|done|case|esac|function|return|export|source|alias)\b/g],
]);
