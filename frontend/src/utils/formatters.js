import { detectLanguage } from './language-detect.js';
import { escapeHtml } from './dom-utils.js';

const tryDecodeProtobuf = raw => {
  try {
    const bytes = typeof raw === 'string'
      ? new Uint8Array([...raw].map(c => c.charCodeAt(0)))
      : new Uint8Array(raw);
    if (bytes.length < 2) return null;

    const readVarint = (buf, offset) => {
      let result = 0, shift = 0;
      while (offset < buf.length) {
        const b = buf[offset++];
        result |= (b & 0x7f) << shift;
        if ((b & 0x80) === 0) return { value: result, offset };
        shift += 7;
        if (shift > 35) return null;
      }
      return null;
    };

    const decodeFields = (buf, start, end) => {
      const fields = [];
      let pos = start;
      while (pos < end) {
        const tag = readVarint(buf, pos);
        if (!tag || tag.value === 0) return null;
        pos = tag.offset;
        const fieldNum = tag.value >>> 3;
        const wireType = tag.value & 0x7;
        if (fieldNum < 1 || fieldNum > 536870911) return null;

        if (wireType === 0) { // varint
          const v = readVarint(buf, pos);
          if (!v) return null;
          pos = v.offset;
          fields.push({ field: fieldNum, type: 'varint', value: v.value });
        } else if (wireType === 2) { // length-delimited
          const len = readVarint(buf, pos);
          if (!len || len.value < 0 || pos + len.value > end) return null;
          pos = len.offset;
          const chunk = buf.slice(pos, pos + len.value);
          pos += len.value;
          // Intentar decodificar recursivamente como submensaje
          const sub = decodeFields(buf, pos - len.value, pos);
          if (sub && sub.length > 0) {
            fields.push({ field: fieldNum, type: 'message', value: sub });
          } else {
            // Intentar como string UTF-8
            try {
              const str = new TextDecoder('utf-8', { fatal: true }).decode(chunk);
              if (/^[\x20-\x7e\n\r\t]*$/.test(str) && str.length > 0) {
                fields.push({ field: fieldNum, type: 'string', value: str });
              } else {
                fields.push({ field: fieldNum, type: 'bytes', value: Array.from(chunk).map(b => b.toString(16).padStart(2, '0')).join(' ') });
              }
            } catch {
              fields.push({ field: fieldNum, type: 'bytes', value: Array.from(chunk).map(b => b.toString(16).padStart(2, '0')).join(' ') });
            }
          }
        } else if (wireType === 5) { // 32-bit
          if (pos + 4 > end) return null;
          const v = new DataView(buf.buffer, buf.byteOffset + pos, 4);
          fields.push({ field: fieldNum, type: 'fixed32', value: v.getFloat32(0, true) });
          pos += 4;
        } else if (wireType === 1) { // 64-bit
          if (pos + 8 > end) return null;
          const v = new DataView(buf.buffer, buf.byteOffset + pos, 8);
          fields.push({ field: fieldNum, type: 'fixed64', value: v.getFloat64(0, true) });
          pos += 8;
        } else {
          return null; // wire type desconocido
        }
      }
      return fields.length > 0 ? fields : null;
    };

    const formatFields = (fields, indent = 0) => {
      const pad = '  '.repeat(indent);
      return fields.map(f => {
        if (f.type === 'message') {
          return pad + 'field ' + f.field + ' {' + '\n' + formatFields(f.value, indent + 1) + '\n' + pad + '}';
        }
        return pad + 'field ' + f.field + ' (' + f.type + '): ' + f.value;
      }).join('\n');
    };

    const fields = decodeFields(bytes, 0, bytes.length);
    if (fields && fields.length > 0) {
      return '// Protobuf (best-effort decode)\n' + formatFields(fields);
    }
  } catch (e) {}
  return null;
};

export const prettyPrint = text => {
  if (!text) return text;

  const lang = detectLanguage(text);

  // JSON - formatear
  if (lang === 'json') {
    try {
      const obj = JSON.parse(text);
      return JSON.stringify(obj, null, 2);
    } catch (e) {}
  }

  // XML/HTML - formatear
  if (lang === 'xml' || lang === 'html') {
    try {
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'text/xml');
      if (xml.getElementsByTagName('parsererror').length === 0) {
        return formatXml(new XMLSerializer().serializeToString(xml));
      }
    } catch (e) {}
  }

  // CSS - formatear
  if (lang === 'css') {
    return text
      .replace(/\s*{\s*/g, ' {\n  ')
      .replace(/;\s*/g, ';\n  ')
      .replace(/\s*}\s*/g, '\n}\n')
      .replace(/,\s*/g, ',\n')
      .trim();
  }

  // JavaScript - formateo básico
  if (lang === 'javascript') {
    return text
      .replace(/\s*{\s*/g, ' {\n  ')
      .replace(/;\s*/g, ';\n  ')
      .replace(/\s*}\s*/g, '\n}\n')
      .trim();
  }

  // SQL - formateo básico
  if (lang === 'sql') {
    return text
      .replace(/\b(SELECT|FROM|WHERE|AND|OR|JOIN|LEFT|RIGHT|INNER|OUTER|GROUP BY|ORDER BY|HAVING|LIMIT)\b/gi, '\n$1')
      .replace(/,\s*/g, ',\n  ')
      .trim();
  }

  // Protobuf
  const proto = tryDecodeProtobuf(text);
  if (proto) return proto;

  return text;
};

export const minify = text => {
  try {
    const obj = JSON.parse(text);
    return JSON.stringify(obj);
  } catch (e) {}
  return text.replace(/\s+/g, ' ').trim();
};

export const beautifyJs = code => {
  if (!code || typeof code !== 'string') return code;

  let result = '';
  let indent = 0;
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let inMultilineComment = false;
  let lastChar = '';
  let parenDepth = 0;

  const getIndent = () => '  '.repeat(indent);

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const nextChar = code[i + 1] || '';
    const prevChar = i > 0 ? code[i - 1] : '';

    // Handle strings (with proper escape handling)
    if ((char === '"' || char === "'" || char === '`') && lastChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
    }

    // Handle comments
    if (!inString) {
      if (char === '/' && nextChar === '/' && !inMultilineComment) {
        inComment = true;
      } else if (char === '/' && nextChar === '*') {
        inMultilineComment = true;
      } else if (char === '*' && nextChar === '/' && inMultilineComment) {
        result += char + nextChar;
        i++;
        inMultilineComment = false;
        lastChar = '/';
        continue;
      } else if (char === '\n' && inComment) {
        inComment = false;
      }
    }

    // Keep comments as-is
    if (inComment || inMultilineComment) {
      result += char;
      lastChar = char;
      continue;
    }

    // Format code if not in string
    if (!inString) {
      // Track parentheses depth
      if (char === '(') parenDepth++;
      if (char === ')') parenDepth = Math.max(0, parenDepth - 1);

      // Opening braces
      if (char === '{' || char === '[') {
        result += char + '\n';
        indent++;
        result += getIndent();
        lastChar = char;
        continue;
      }

      // Closing braces
      if (char === '}' || char === ']') {
        indent = Math.max(0, indent - 1);
        result = result.trimEnd() + '\n' + getIndent() + char;
        lastChar = char;
        continue;
      }

      // Semicolons
      if (char === ';') {
        result += char;
        if (nextChar !== '\n' && nextChar !== '}' && nextChar !== ')') {
          result += '\n' + getIndent();
        }
        lastChar = char;
        continue;
      }

      // Commas - add newline if in arrays/objects (not in function calls)
      if (char === ',' && parenDepth === 0) {
        result += char;
        if (nextChar !== '\n' && nextChar !== ' ') {
          result += '\n' + getIndent();
        } else if (nextChar === ' ' && code[i + 2] !== '\n') {
          result += '\n' + getIndent();
          i++; // Skip the space
        }
        lastChar = char;
        continue;
      }

      // Add space after operators for readability
      if (char === '=' && nextChar === '=' && code[i + 2] === '=') {
        result += ' === ';
        i += 2;
        lastChar = '=';
        continue;
      }
      if (char === '=' && nextChar === '=') {
        result += ' == ';
        i++;
        lastChar = '=';
        continue;
      }
      if (char === '!' && nextChar === '=' && code[i + 2] === '=') {
        result += ' !== ';
        i += 2;
        lastChar = '=';
        continue;
      }
      if (char === '!' && nextChar === '=') {
        result += ' != ';
        i++;
        lastChar = '=';
        continue;
      }

      // Remove multiple consecutive spaces
      if (char === ' ' && (lastChar === ' ' || lastChar === '\n')) {
        continue;
      }

      // Handle newlines - preserve indent
      if (char === '\n') {
        if (lastChar !== '\n' && lastChar !== '{' && lastChar !== '[') {
          result = result.trimEnd() + '\n' + getIndent();
        }
        lastChar = char;
        continue;
      }
    }

    result += char;
    lastChar = char;
  }

  return result.trim();
};

export const formatXml = xml => {
  const PADDING = '  ';
  const reg = /(>)(<)(\/*)/g;
  let pad = 0;
  xml = xml.replace(reg, '$1\n$2$3');
  return xml.split('\n').map(node => {
    let indent = 0;
    if (node.match(/.+<\/\w[^>]*>$/)) {
      indent = 0;
    } else if (node.match(/^<\/\w/)) {
      if (pad !== 0) pad -= 1;
    } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
      indent = 1;
    }
    const padding = PADDING.repeat(pad);
    pad += indent;
    return padding + node;
  }).join('\n');
};

export const fmtH = (h, url) => {
  if (!h) return '';
  const lines = Object.entries(h).map(([k, v]) => k + ': ' + (Array.isArray(v) ? v.join(', ') : v));
  if (url && !lines.some(l => /^host\s*:/i.test(l))) {
    try { lines.unshift('Host: ' + new URL(url).host); } catch (e) {}
  }
  return lines.join('\n');
};

export const fmtHHtml = (h, url) => colorizeHeaders(fmtH(h, url));

export const colorizeHeaders = text => {
  if (!text) return '';
  return text.split('\n').map(line => {
    const ci = line.indexOf(':');
    if (ci === -1) return escapeHtml(line);
    return '<span class="hdr-key">' + escapeHtml(line.slice(0, ci)) + '</span><span class="hdr-sep">:</span><span class="hdr-val">' + escapeHtml(line.slice(ci + 1)) + '</span>';
  }).join('\n');
};

export const buildCmpText = (req, view) => {
  if (!req) return '';
  if (view === 'request') {
    return req.method + ' ' + req.url + '\n' + fmtH(req.headers, req.url) + (req.body ? '\n\n' + req.body : '');
  }
  return 'HTTP ' + (req.response_status || '(no response)') + '\n' + fmtH(req.response_headers) + '\n\n' + (req.response_body || '');
};

export const fmtTime = t => t ? new Date(t).toLocaleTimeString('en-US', { hour12: false }) : '';

export const stCls = s => !s ? '' : s < 300 ? 'st2' : s < 400 ? 'st3' : s < 500 ? 'st4' : 'st5';
