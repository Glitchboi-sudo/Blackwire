// Detecta el lenguaje del código
export const detectLanguage = text => {
  if (!text || !text.trim()) return null;
  const trimmed = text.trim();

  // JSON
  try {
    JSON.parse(text);
    return 'json';
  } catch (e) {}

  // XML/HTML
  if (trimmed.startsWith('<')) {
    try {
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'text/xml');
      if (xml.getElementsByTagName('parsererror').length === 0) {
        // Detectar si es HTML o XML
        if (trimmed.toLowerCase().startsWith('<!doctype html') ||
            /<html|<head|<body|<div|<span|<p|<a |<img |<script|<style/i.test(trimmed.substring(0, 200))) {
          return 'html';
        }
        return 'xml';
      }
    } catch (e) {}
  }

  // CSS
  if (/^\s*([.#]?[a-z][\w-]*|\*|@[\w-]+)\s*\{/im.test(trimmed) ||
      /@import|@media|@keyframes/i.test(trimmed)) {
    return 'css';
  }

  // JavaScript/TypeScript
  if (/^(import |export |const |let |var |function |class |async |\/\/|\/\*)/m.test(trimmed) ||
      /=>\s*\{|\.then\(|\.catch\(|console\.(log|error|warn)/i.test(trimmed)) {
    return 'javascript';
  }

  // Python
  if (/^(def |class |import |from |#|""")/m.test(trimmed) ||
      /:\s*$\n\s{4,}/m.test(trimmed)) {
    return 'python';
  }

  // PHP
  if (trimmed.startsWith('<?php') || /\$[a-z_]/i.test(trimmed)) {
    return 'php';
  }

  // SQL
  if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s+/im.test(trimmed)) {
    return 'sql';
  }

  // YAML
  if (/^[a-z_][\w]*:\s*$/m.test(trimmed) && !/[{}[\]]/g.test(trimmed)) {
    return 'yaml';
  }

  // GraphQL
  if (/^(query|mutation|subscription|fragment|type|interface|enum)\s+/im.test(trimmed)) {
    return 'graphql';
  }

  // Shell/Bash
  if (trimmed.startsWith('#!') || /^(echo|cd|ls|mkdir|export|source|function)\s+/m.test(trimmed)) {
    return 'shell';
  }

  // Protobuf
  if (text.includes('// Protobuf') && text.includes('field ')) {
    return 'protobuf';
  }

  return null;
};
