// --- HTTPQL Parser ---
export const HTTPQL_REQ_FIELDS = ['method','host','path','port','ext','query','raw','len','tls'];
export const HTTPQL_RESP_FIELDS = ['code','raw','len'];
export const HTTPQL_STR_OPS = ['eq','ne','cont','ncont','like','nlike','regex','nregex'];
export const HTTPQL_NUM_OPS = ['eq','ne','gt','gte','lt','lte'];
export const HTTPQL_BOOL_OPS = ['eq','ne'];

// Sensitivity patterns constants
export const SENS_GENERAL = [
  { name: 'Generic Token', regex: "(?:token)[^&|;?,]{0,32}?['\"][a-zA-Z0-9_\\-+=\\/\\\\]{10,}['\"]", category: 'Credentials', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'Generic Password', regex: "(?:password|passwd|pwd)[^&|;?,]{0,32}?['\"][^'\"]{6,}['\"]", category: 'Credentials', sections: ['respHeaders','respBody'], enabled: true },
  { name: '.env Config', regex: '\\.env', category: 'Configuration', sections: ['respBody'], enabled: true },
  { name: 'Private IPv4', regex: '(?:10\\.(?:[0-9]{1,3}\\.){2}[0-9]{1,3}|172\\.(?:1[6-9]|2[0-9]|3[01])\\.(?:[0-9]{1,3}\\.)[0-9]{1,3}|192\\.168\\.[0-9]{1,3}\\.[0-9]{1,3})', category: 'Network', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'Email Address', regex: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]{3,128}\\.[a-zA-Z]{2,32}', category: 'Contact', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'Basic Auth Header', regex: 'Basic\\s+[A-Za-z0-9+/=]{10,}', category: 'Credentials', sections: ['reqHeaders','respHeaders'], enabled: true },
  { name: 'Bearer Token Header', regex: 'Bearer\\s+[A-Za-z0-9._~+/=-]{10,}', category: 'Credentials', sections: ['reqHeaders','respHeaders'], enabled: true },
  { name: 'JDBC Connection String', regex: 'jdbc:[a-z:]+://[^\\s"\']+', category: 'Configuration', sections: ['respBody'], enabled: true },
  { name: 'SSH Private Key', regex: '-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----', category: 'Data Security', sections: ['respBody'], enabled: true },
];

export const SENS_TOKENS = [
  { name: 'AWS Access Key ID', regex: '(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}', category: 'AWS', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'AWS Secret Key', regex: "(?:aws)[^;]{0,32}?['\"][0-9a-zA-Z/+=]{40}['\"]", category: 'AWS', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'Amazon MWS Token', regex: 'amzn\\.mws\\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', category: 'Amazon', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'Google API Key', regex: 'AIza[0-9A-Za-z\\-_]{35}', category: 'Google', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'Google OAuth Token', regex: 'ya29\\.[0-9A-Za-z\\-_]{32,48}', category: 'Google', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'Google OAuth Client ID', regex: '\\.apps\\.googleusercontent\\.com', category: 'Google', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'Google OAuth Client Secret', regex: 'GOCSPX-[0-9a-zA-Z\\-_]{28}', category: 'Google', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'MailGun API Key', regex: 'key-[0-9a-f]{32}', category: 'Email', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'SendGrid API Key', regex: 'SG\\.[0-9A-Za-z\\-_]{22}\\.[0-9A-Za-z\\-_]{43}', category: 'Email', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'NuGet API Key', regex: 'oy2[a-z0-9]{43}', category: 'Package', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'Slack Token', regex: 'x(?:ox[psboare]|app)(?:-[a-zA-Z0-9]{1,64}){1,5}', category: 'Communication', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'Twilio SID', regex: 'SK[0-9a-zA-Z]{32}', category: 'Communication', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'Square Token', regex: 'sq0(?:atp|csp|idp)-[0-9A-Za-z\\-_]{22,43}', category: 'Payment', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'Stripe Secret Key', regex: '[sr]k_(?:live|test)_[0-9a-zA-Z]{24}', category: 'Payment', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'Stripe Webhook Secret', regex: 'whsec_[0-9a-zA-Z]{32}', category: 'Payment', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'GitHub Token', regex: 'gh[pousr]_[A-Za-z0-9]{36}', category: 'Source Control', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'GitHub Fine-grained PAT', regex: 'github_pat_[0-9a-zA-Z]{22}_[0-9a-zA-Z]{59}', category: 'Source Control', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'OpenAI API Key', regex: 'sk-[a-zA-Z0-9]{40,128}', category: 'AI/ML', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'Heroku API Key', regex: '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', category: 'Cloud', sections: ['respHeaders','respBody'], enabled: false },
  { name: 'Facebook Access Token', regex: 'EAACEdEose0cBA[0-9A-Za-z]+', category: 'Communication', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'Twitter Secret', regex: "(?:twitter)[^;]{0,32}?['\"][0-9a-zA-Z]{35,44}['\"]", category: 'Communication', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'Twitch API Token', regex: "(?:twitch)[^;]{0,32}?['\"][0-9a-z]{30}['\"]", category: 'Communication', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'Mailchimp API Key', regex: '[0-9a-f]{32}-us[0-9]{1,2}', category: 'Email', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'JWT Token', regex: 'eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}', category: 'Credentials', sections: ['reqHeaders','respHeaders','respBody'], enabled: true },
];

export const SENS_URLS = [
  { name: 'Slack Webhook', regex: 'hooks\\.slack\\.com/services/T[a-zA-Z0-9_]{8,}/B[a-zA-Z0-9_]{8,}/[a-zA-Z0-9_]{24}', category: 'Webhooks', sections: ['respBody'], enabled: true },
  { name: 'Teams Webhook', regex: 'outlook\\.office(?:365)?\\.com/webhook/[a-zA-Z0-9\\-@]+', category: 'Webhooks', sections: ['respBody'], enabled: true },
  { name: 'Teams Incoming Webhook', regex: '\\.webhook\\.office\\.com', category: 'Webhooks', sections: ['respBody'], enabled: true },
  { name: 'Firebase DB URL', regex: '\\.(?:firebaseio\\.com|firebasedatabase\\.app)', category: 'Cloud', sections: ['respBody'], enabled: true },
  { name: 'AWS S3 Bucket', regex: 's3(?:\\.[a-z0-9-]+)?\\.amazonaws\\.com(?:/[^\\s"\'<>]+)?', category: 'Cloud Storage', sections: ['respBody'], enabled: true },
  { name: 'Azure Blob Storage', regex: 'blob\\.core\\.windows\\.net', category: 'Cloud Storage', sections: ['respBody'], enabled: true },
  { name: 'Google Cloud Storage', regex: 'gs://[a-z\\d\\-]{3,63}', category: 'Cloud Storage', sections: ['respBody'], enabled: true },
  { name: 'Amazon ARN', regex: 'arn:aws(?:-(?:cn|us-gov|iso-[bcd]))?:[a-zA-Z0-9\\-]+:[a-z0-9\\-]*:[0-9]{0,12}:[a-zA-Z0-9\\-_/:.]+', category: 'AWS', sections: ['respBody'], enabled: true },
  { name: 'Discord Webhook', regex: 'discord(?:app)?\\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+', category: 'Webhooks', sections: ['respBody'], enabled: true },
];

export const SENS_FILES = [
  '.zip','.tar','.gz','.rar','.7z','.bz2','.xz','.tar.gz','.tgz',
  '.pem','.crt','.cer','.der','.p12','.pfx','.key','.csr','.jks','.keystore',
  '.kdbx','.kdb','.1pif',
  '.cfg','.conf','.config','.ini','.properties','.yaml','.yml','.toml','.xml','.json','.env',
  '.sql','.sqlite','.db','.mdb','.dump','.bak','.bkp',
  '.doc','.docx','.xls','.xlsx','.csv','.pdf',
  '.log','.swp','.swo','.DS_Store','.htaccess','.htpasswd','.npmrc','.pypirc',
  '.git','.svn','.hg',
].map(ext => ({ name: ext, regex: ext.replace(/\./g, '\\.') + '(?:\\?|$|#)', category: 'Files', sections: ['reqUrl'], enabled: true }));

export const SENS_COLORS = {
  'AWS': 'var(--orange)', 'Google': 'var(--blue)', 'Payment': 'var(--green)',
  'Credentials': 'var(--red)', 'Communication': 'var(--purple)', 'Cloud': 'var(--cyan)',
  'Network': 'var(--txt2)', 'Contact': 'var(--txt2)', 'Data Security': 'var(--red)',
  'Configuration': 'var(--orange)', 'Source Control': 'var(--purple)',
  'Email': 'var(--blue)', 'Package': 'var(--txt2)', 'AI/ML': 'var(--green)',
  'Webhooks': 'var(--cyan)', 'Cloud Storage': 'var(--cyan)', 'Files': 'var(--txt3)',
  'Amazon': 'var(--orange)',
};

export const SENS_DEFAULT_PATTERNS = () => ({
  general: SENS_GENERAL.map(p => ({...p})),
  tokens: SENS_TOKENS.map(p => ({...p})),
  urls: SENS_URLS.map(p => ({...p})),
  files: SENS_FILES.map(p => ({...p})),
});

export function httpqlTokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    if (/\s/.test(input[i])) { i++; continue; }
    if (input[i] === '(') { tokens.push({ type: 'LPAREN', pos: i }); i++; continue; }
    if (input[i] === ')') { tokens.push({ type: 'RPAREN', pos: i }); i++; continue; }
    if (input[i] === ':') { tokens.push({ type: 'COLON', pos: i }); i++; continue; }
    if (input[i] === '"') {
      let s = '', j = i + 1, esc = false;
      while (j < input.length) {
        if (esc) { s += input[j]; esc = false; }
        else if (input[j] === '\\') esc = true;
        else if (input[j] === '"') break;
        else s += input[j];
        j++;
      }
      if (j >= input.length) return { tokens, error: 'Unterminated string at position ' + i };
      tokens.push({ type: 'STRING', value: s, pos: i });
      i = j + 1;
      continue;
    }
    // Word: identifiers, dotted paths, numbers
    const wordRe = /^[a-zA-Z0-9_.%*?\-\/&+=@:]+/;
    const rest = input.slice(i);
    const m = rest.match(wordRe);
    if (m) {
      const w = m[0];
      // Check if it's a dotted comparison like req.method.eq:value — split on last colon
      // Actually, handle colon as separate token if it separates field.op from value
      // Parse word up to a colon that looks like operator:value
      const colonIdx = w.indexOf(':');
      let word = w;
      if (colonIdx > 0) {
        word = w.slice(0, colonIdx);
        tokens.push({ type: 'IDENT', value: word, pos: i });
        i += colonIdx;
        continue; // colon will be picked up next iteration
      }
      const upper = word.toUpperCase();
      if (upper === 'AND') tokens.push({ type: 'AND', pos: i });
      else if (upper === 'OR') tokens.push({ type: 'OR', pos: i });
      else tokens.push({ type: 'IDENT', value: word, pos: i });
      i += word.length;
      continue;
    }
    return { tokens, error: 'Unexpected character \'' + input[i] + '\' at position ' + i };
  }
  tokens.push({ type: 'EOF', pos: i });
  return { tokens, error: null };
}

export function httpqlParse(input) {
  input = input.trim();
  if (!input) return { ast: null, error: null };
  const { tokens, error: tokErr } = httpqlTokenize(input);
  if (tokErr) return { ast: null, error: tokErr };
  let pos = 0;
  const peek = () => tokens[pos] || { type: 'EOF' };
  const advance = () => tokens[pos++];

  function parseOr() {
    let left = parseAnd();
    while (peek().type === 'OR') {
      advance();
      const right = parseAnd();
      if (left.type === 'or') { left.children.push(right); }
      else { left = { type: 'or', children: [left, right] }; }
    }
    return left;
  }

  function parseAnd() {
    let left = parseAtom();
    while (true) {
      const p = peek();
      if (p.type === 'AND') { advance(); left = mergeAnd(left, parseAtom()); continue; }
      // Implicit AND: next token starts a new clause
      if (p.type === 'IDENT' || p.type === 'STRING' || p.type === 'LPAREN') {
        left = mergeAnd(left, parseAtom());
        continue;
      }
      break;
    }
    return left;
  }

  function mergeAnd(left, right) {
    if (left.type === 'and') { left.children.push(right); return left; }
    return { type: 'and', children: [left, right] };
  }

  function parseAtom() {
    const tok = peek();
    if (tok.type === 'LPAREN') {
      advance();
      const expr = parseOr();
      if (peek().type !== 'RPAREN') throw new Error('Expected ) at position ' + peek().pos);
      advance();
      return expr;
    }
    if (tok.type === 'STRING') {
      advance();
      return { type: 'shorthand', value: tok.value };
    }
    if (tok.type === 'IDENT') {
      const ident = tok.value;
      advance();
      // preset:value
      if (ident === 'preset' && peek().type === 'COLON') {
        advance();
        const val = parseValue();
        return { type: 'preset', name: val };
      }
      // namespace.field.operator:value
      const parts = ident.split('.');
      if (parts.length !== 3) throw new Error('Expected namespace.field.operator at position ' + tok.pos + ', got "' + ident + '"');
      const [ns, field, op] = parts;
      if (ns !== 'req' && ns !== 'resp') throw new Error('Unknown namespace "' + ns + '" at position ' + tok.pos);
      const validFields = ns === 'req' ? HTTPQL_REQ_FIELDS : HTTPQL_RESP_FIELDS;
      if (!validFields.includes(field)) throw new Error('Unknown field "' + ns + '.' + field + '" at position ' + tok.pos);
      const isNum = ['port','len','code'].includes(field);
      const isBool = field === 'tls';
      const validOps = isBool ? HTTPQL_BOOL_OPS : isNum ? HTTPQL_NUM_OPS : HTTPQL_STR_OPS;
      if (!validOps.includes(op)) throw new Error('Operator "' + op + '" not valid for ' + ns + '.' + field);
      if (peek().type !== 'COLON') throw new Error('Expected : after ' + ident + ' at position ' + peek().pos);
      advance();
      const val = parseValue();
      return { type: 'comparison', namespace: ns, field, operator: op, value: val };
    }
    throw new Error('Unexpected token at position ' + tok.pos);
  }

  function parseValue() {
    const tok = peek();
    if (tok.type === 'STRING') { advance(); return tok.value; }
    if (tok.type === 'IDENT') { advance(); return tok.value; }
    throw new Error('Expected value at position ' + tok.pos);
  }

  try {
    const ast = parseOr();
    if (peek().type !== 'EOF') throw new Error('Unexpected input at position ' + peek().pos);
    return { ast, error: null };
  } catch (e) {
    return { ast: null, error: e.message };
  }
}

export function diffLines(textA, textB) {
  const a = (textA || '').split('\n');
  const b = (textB || '').split('\n');
  const m = a.length, n = b.length;
  // Fallback for very large texts
  if (m > 5000 || n > 5000) {
    const max = Math.max(m, n);
    const result = [];
    for (let i = 0; i < max; i++) {
      const la = i < m ? a[i] : null;
      const lb = i < n ? b[i] : null;
      if (la === lb) result.push({ type: 'equal', lineA: la, lineB: lb });
      else {
        if (la !== null) result.push({ type: 'removed', lineA: la, lineB: null });
        if (lb !== null) result.push({ type: 'added', lineA: null, lineB: lb });
      }
    }
    return result;
  }
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const result = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.push({ type: 'equal', lineA: a[i - 1], lineB: b[j - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: 'added', lineA: null, lineB: b[--j] });
    } else {
      result.push({ type: 'removed', lineA: a[--i], lineB: null });
    }
  }
  return result.reverse();
}

export function parseHeaders(headersString) {
  if (!headersString) return {};
  const headers = {};
  const lines = headersString.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      if (key) headers[key] = value;
    }
  }
  return headers;
}

export const parseIntPositions = (url, headers, body) => {
  const positions = [];
  const marker = /\u00a7([^\u00a7]*)\u00a7/g;
  let idx = 0;
  let m;
  const scan = (text, section) => {
    marker.lastIndex = 0;
    while ((m = marker.exec(text)) !== null) {
      positions.push({ idx: idx++, name: m[1] || ('pos' + idx), section, start: m.index, end: m.index + m[0].length });
    }
  };
  scan(url, 'url');
  scan(headers, 'headers');
  scan(body, 'body');
  return positions;
};
