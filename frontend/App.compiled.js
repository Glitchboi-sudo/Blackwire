(function(){
 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }const { useState, useEffect, useRef } = React;

const API = '';
const WS_URL = 'ws://' + location.host + '/ws';

const THEMES = window.BW_THEMES || {};

// --- HTTPQL Parser ---
const HTTPQL_REQ_FIELDS = ['method','host','path','port','ext','query','raw','len','tls'];
const HTTPQL_RESP_FIELDS = ['code','raw','len'];
const HTTPQL_STR_OPS = ['eq','ne','cont','ncont','like','nlike','regex','nregex'];
const HTTPQL_NUM_OPS = ['eq','ne','gt','gte','lt','lte'];
const HTTPQL_BOOL_OPS = ['eq','ne'];

function httpqlTokenize(input) {
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

function httpqlParse(input) {
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

// --- Diff Algorithm (LCS-based) ---
function diffLines(textA, textB) {
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

// --- Site Map Tree Builder ---
function buildSiteTree(reqs) {
  const tree = {};
  for (const r of reqs) {
    let origin, pathname;
    try {
      const u = new URL(r.url);
      origin = u.origin;
      pathname = u.pathname || '/';
    } catch (e) {
      origin = '(other)';
      pathname = r.url || '/';
    }
    if (!tree[origin]) tree[origin] = { label: origin.replace(/^https?:\/\//, ''), children: {}, reqs: [], methods: new Set(), count: 0 };
    const host = tree[origin];
    host.count++;
    host.methods.add(r.method);
    const segs = pathname.split('/').filter(Boolean);
    if (segs.length === 0) {
      host.reqs.push(r);
    } else {
      let node = host;
      for (let i = 0; i < segs.length; i++) {
        const seg = '/' + segs[i];
        if (!node.children[seg]) node.children[seg] = { label: seg, children: {}, reqs: [], methods: new Set(), count: 0 };
        node = node.children[seg];
        node.count++;
        node.methods.add(r.method);
      }
      node.reqs.push(r);
    }
  }
  return tree;
}

function collectNodeReqs(node) {
  let all = [...node.reqs];
  for (const child of Object.values(node.children)) {
    all = all.concat(collectNodeReqs(child));
  }
  return all;
}

function ResizeHandle({ onDrag }) {
  const ref = useRef(null);
  const cbRef = useRef(onDrag);
  cbRef.current = onDrag;
  const handleMouseDown = (e) => {
    e.preventDefault();
    let lastX = e.clientX;
    const el = ref.current;
    if (el) el.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev) => {
      const dx = ev.clientX - lastX;
      lastX = ev.clientX;
      cbRef.current(dx);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (el) el.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
  return React.createElement('div', { ref, className: 'resize-h', onMouseDown: handleMouseDown });
}

function BodySearchBar({ value, onChange, isRegex, onToggleRegex, matchIdx, matchCount, onPrev, onNext, onClose }) {
  return React.createElement('div', { className: 'search-bar' },
    React.createElement('input', {
      placeholder: isRegex ? 'Regex search...' : 'Search body...',
      value: value,
      onChange: e => onChange(e.target.value),
      onKeyDown: e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onNext(); }
        if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); onPrev(); }
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      },
      autoFocus: true
    }),
    React.createElement('button', { className: 'srch-btn' + (isRegex ? ' act' : ''), onClick: onToggleRegex, title: 'Toggle regex' }, '.*'),
    React.createElement('span', { className: 'search-info' }, matchCount > 0 ? (matchIdx + 1) + '/' + matchCount : '0/0'),
    React.createElement('button', { className: 'srch-btn', onClick: onPrev, disabled: matchCount === 0, title: 'Previous match' }, '\u25B2'),
    React.createElement('button', { className: 'srch-btn', onClick: onNext, disabled: matchCount === 0, title: 'Next match' }, '\u25BC'),
    React.createElement('button', { className: 'srch-btn', onClick: onClose, title: 'Close search' }, '\u2715')
  );
}

function highlightMatches(text, pattern, isRegex, currentIdx) {
  if (!pattern) return { html: text, count: 0 };
  try {
    const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const escaped = isRegex ? pattern : pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(' + escaped + ')', 'gi');
    let count = 0;
    const html = safe.replace(re, (match) => {
      const cls = count === currentIdx ? 'search-hl search-cur' : 'search-hl';
      count++;
      return '<mark class="' + cls + '">' + match + '</mark>';
    });
    return { html, count };
  } catch (e) {
    return { html: text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'), count: 0 };
  }
}

// --- Sensitive Patterns ---
const SENS_GENERAL = [
  { name: 'Certificate/Key', regex: '-----BEGIN', category: 'Data Security', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'Generic API Key', regex: "(?:api).{0,5}(?:key)[^&|;?,]{0,32}?['\"][a-zA-Z0-9_\\-+=\\/\\\\]{10,}['\"]", category: 'Credentials', sections: ['respHeaders','respBody'], enabled: true },
  { name: 'Generic Secret', regex: "(?:secret)[^&|;?,]{0,32}?['\"][a-zA-Z0-9_\\-+=\\/\\\\]{10,}['\"]", category: 'Credentials', sections: ['respHeaders','respBody'], enabled: true },
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

const SENS_TOKENS = [
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

const SENS_URLS = [
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

const SENS_FILES = [
  '.zip','.tar','.gz','.rar','.7z','.bz2','.xz','.tar.gz','.tgz',
  '.pem','.crt','.cer','.der','.p12','.pfx','.key','.csr','.jks','.keystore',
  '.kdbx','.kdb','.1pif',
  '.cfg','.conf','.config','.ini','.properties','.yaml','.yml','.toml','.xml','.json','.env',
  '.sql','.sqlite','.db','.mdb','.dump','.bak','.bkp',
  '.doc','.docx','.xls','.xlsx','.csv','.pdf',
  '.log','.swp','.swo','.DS_Store','.htaccess','.htpasswd','.npmrc','.pypirc',
  '.git','.svn','.hg',
].map(ext => ({ name: ext, regex: ext.replace(/\./g, '\\.') + '(?:\\?|$|#)', category: 'Files', sections: ['reqUrl'], enabled: true }));

const SENS_COLORS = {
  'AWS': 'var(--orange)', 'Google': 'var(--blue)', 'Payment': 'var(--green)',
  'Credentials': 'var(--red)', 'Communication': 'var(--purple)', 'Cloud': 'var(--cyan)',
  'Network': 'var(--txt2)', 'Contact': 'var(--txt2)', 'Data Security': 'var(--red)',
  'Configuration': 'var(--orange)', 'Source Control': 'var(--purple)',
  'Email': 'var(--blue)', 'Package': 'var(--txt2)', 'AI/ML': 'var(--green)',
  'Webhooks': 'var(--cyan)', 'Cloud Storage': 'var(--cyan)', 'Files': 'var(--txt3)',
  'Amazon': 'var(--orange)',
};

const SENS_DEFAULT_PATTERNS = () => ({
  general: SENS_GENERAL.map(p => ({...p})),
  tokens: SENS_TOKENS.map(p => ({...p})),
  urls: SENS_URLS.map(p => ({...p})),
  files: SENS_FILES.map(p => ({...p})),
});

function Blackwire() {
  // Estado principal
  const [tab, setTab] = useState('projects');
  const [prjs, setPrjs] = useState([]);
  const [curPrj, setCurPrj] = useState(null);

  // Estado del proxy
  const [pxRun, setPxRun] = useState(false);
  const [pxPort, setPxPort] = useState(8080);
  const [pxMode, setPxMode] = useState('regular');
  const [pxArgs, setPxArgs] = useState('');

  // Estado de requests
  const [reqs, setReqs] = useState([]);
  const [selReq, setSelReq] = useState(null);
  const [selReqFull, setSelReqFull] = useState(null);
  const [detTab, setDetTab] = useState('request');
  const [histSubTab, setHistSubTab] = useState('http'); // 'http' | 'ws' | 'sitemap'
  const [smExpanded, setSmExpanded] = useState({});
  const [smSelNode, setSmSelNode] = useState(null);

  // Estado del Repeater
  const [repReqs, setRepReqs] = useState([]);
  const [selRep, setSelRep] = useState(null);
  const [repM, setRepM] = useState('GET');
  const [repU, setRepU] = useState('');
  const [repH, setRepH] = useState('');
  const [repB, setRepB] = useState('');
  const [repBodyColor, setRepBodyColor] = useState(false);
  const [repResp, setRepResp] = useState(null);
  const [repRespBody, setRepRespBody] = useState('');

  // Historial de navegación en Repeater
  const [repHistory, setRepHistory] = useState([]);
  const [repHistoryIndex, setRepHistoryIndex] = useState(-1);
  const [repFollowRedirects, setRepFollowRedirects] = useState(false);

  // Estado general
  const [appReady, setAppReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [commits, setCommits] = useState([]);
  const [cmtMsg, setCmtMsg] = useState('');
  const [toasts, setToasts] = useState([]);
  const [themeId, setThemeId] = useState('midnight');

  // Filtros / HTTPQL
  const [search, setSearch] = useState('');
  const [savedOnly, setSavedOnly] = useState(false);
  const [scopeOnly, setScopeOnly] = useState(false);
  const [httpqlError, setHttpqlError] = useState(null);
  const [presets, setPresets] = useState([]);
  const [showPresets, setShowPresets] = useState(false);
  const [presetName, setPresetName] = useState('');
  const searchTimer = useRef(null);

  // Intercept
  const [intOn, setIntOn] = useState(false);
  const [pending, setPending] = useState([]);
  const [selPend, setSelPend] = useState(null);
  const [editReq, setEditReq] = useState(null);

  // Scope
  const [scopeRules, setScopeRules] = useState([]);
  const [newPat, setNewPat] = useState('');
  const [newType, setNewType] = useState('include');

  // Projects
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Extensions
  const [extensions, setExtensions] = useState([]);
  const [whkReqs, setWhkReqs] = useState([]);
  const [whkLoading, setWhkLoading] = useState(false);
  const [whkApiKey, setWhkApiKey] = useState('');

  // Webhook History (interactive tab)
  const [selWhkReq, setSelWhkReq] = useState(null);
  const [whkSearch, setWhkSearch] = useState('');
  const [whkDetTab, setWhkDetTab] = useState('request');
  const [whkReqFormat, setWhkReqFormat] = useState('raw');

  // Formatos
  const [reqFormat, setReqFormat] = useState('raw');
  const [respFormat, setRespFormat] = useState('raw');

  // Proxy Config
  const [showProxyCfg, setShowProxyCfg] = useState(false);

  // Menú contextual
  const [contextMenu, setContextMenu] = useState(null);
  const ctxMenuRef = useRef(null);

  // Chepy
  const [chepyIn, setChepyIn] = useState('');
  const [chepyOps, setChepyOps] = useState([]);
  const [chepyOut, setChepyOut] = useState('');
  const [chepyErr, setChepyErr] = useState('');
  const [chepyCat, setChepyCat] = useState({});
  const [chepySelCat, setChepySelCat] = useState('');
  const [chepyBaking, setChepyBaking] = useState(false);

  // WebSocket Viewer
  const [wsConns, setWsConns] = useState([]);
  const [selWsConn, setSelWsConn] = useState(null);
  const [wsFrames, setWsFrames] = useState([]);
  const [selWsFrame, setSelWsFrame] = useState(null);
  const [wsResendMsg, setWsResendMsg] = useState('');
  const [wsResendResp, setWsResendResp] = useState(null);
  const [wsSending, setWsSending] = useState(false);

  // Collections
  const [colls, setColls] = useState([]);
  const [selColl, setSelColl] = useState(null);
  const [collItems, setCollItems] = useState([]);
  const [collVars, setCollVars] = useState({});
  const [collStep, setCollStep] = useState(0);
  const [collResps, setCollResps] = useState({});
  const [collRunning, setCollRunning] = useState(false);
  const [showCollPick, setShowCollPick] = useState(null);

  // Compare
  const [cmpA, setCmpA] = useState(null);
  const [cmpB, setCmpB] = useState(null);
  const [cmpView, setCmpView] = useState('request');

  // Resizable panels
  const [histPanelW, setHistPanelW] = useState(44);
  const [repSideW, setRepSideW] = useState(200);
  const [repSplitPct, setRepSplitPct] = useState(50);
  const [intPendW, setIntPendW] = useState(280);
  const [wsConnsW, setWsConnsW] = useState(220);
  const [wsFramesW, setWsFramesW] = useState(300);
  const [chepyInW, setChepyInW] = useState(30);
  const [chepyRecW, setChepyRecW] = useState(30);
  const [collSideW, setCollSideW] = useState(200);
  const [collStepsW, setCollStepsW] = useState(350);
  const [smTreeW, setSmTreeW] = useState(38);

  // Body search
  const [histBodySearch, setHistBodySearch] = useState('');
  const [histBodySearchIdx, setHistBodySearchIdx] = useState(0);
  const [histBodySearchRegex, setHistBodySearchRegex] = useState(false);
  const [histBodySearchCount, setHistBodySearchCount] = useState(0);
  const [showHistSearch, setShowHistSearch] = useState(false);
  const [repBodySearch, setRepBodySearch] = useState('');
  const [repBodySearchIdx, setRepBodySearchIdx] = useState(0);
  const [repBodySearchRegex, setRepBodySearchRegex] = useState(false);
  const [repBodySearchCount, setRepBodySearchCount] = useState(0);
  const [showRepSearch, setShowRepSearch] = useState(false);

  // Sensitive 
  const [sensResults, setSensResults] = useState([]);
  const [sensScanning, setSensScanning] = useState(false);
  const [sensPct, setSensPct] = useState(0);
  const [sensFilter, setSensFilter] = useState('');
  const [sensUnique, setSensUnique] = useState(false);
  const [sensSelResult, setSensSelResult] = useState(null);
  const [sensSubTab, setSensSubTab] = useState('logger');
  const [sensPatterns, setSensPatterns] = useState(SENS_DEFAULT_PATTERNS);
  const [sensScopeOnly, setSensScopeOnly] = useState(false);
  const [sensMaxSize, setSensMaxSize] = useState(10000000);
  const [sensBatch, setSensBatch] = useState(4);
  const sensStopRef = useRef(false);
  const sensDetailRef = useRef(null);
  const [sensSelDetail, setSensSelDetail] = useState(null);

  // Intruder
  const [intMethod, setIntMethod] = useState('GET');
  const [intUrl, setIntUrl] = useState('');
  const [intHeaders, setIntHeaders] = useState('');
  const [intBody, setIntBody] = useState('');
  const [intPositions, setIntPositions] = useState([]);
  const [intAttackType, setIntAttackType] = useState('targeted');
  const [intPayloads, setIntPayloads] = useState({});
  const [intResults, setIntResults] = useState([]);
  const [intRunning, setIntRunning] = useState(false);
  const [intPct, setIntPct] = useState(0);
  const [intConcurrency, setIntConcurrency] = useState(1);
  const [intDelay, setIntDelay] = useState(0);
  const [intRandomDelay, setIntRandomDelay] = useState(false);
  const [intDelayMin, setIntDelayMin] = useState(100);
  const [intDelayMax, setIntDelayMax] = useState(500);
  const [intFollowRedirects, setIntFollowRedirects] = useState(false);
  const [intTimeout, setIntTimeout] = useState(30);
  const [intMaxRetries, setIntMaxRetries] = useState(0);
  const [intSubTab, setIntSubTab] = useState('positions');
  const [intSelResult, setIntSelResult] = useState(null);
  const intStopRef = useRef(false);
  const [intTotal, setIntTotal] = useState(0);
  const [intDone, setIntDone] = useState(0);
  const [intStartTime, setIntStartTime] = useState(null);
  const [intSelPayloadSet, setIntSelPayloadSet] = useState(0);
  const [intSortCol, setIntSortCol] = useState('#');
  const [intSortDir, setIntSortDir] = useState('asc');
  const [intFilter, setIntFilter] = useState('');
  const intHeadersRef = useRef(null);
  const intBodyRef = useRef(null);
  const [intAttacks, setIntAttacks] = useState([]);
  const [intSelAttack, setIntSelAttack] = useState(null);

  const wsRef = useRef(null);
  const repBodyEditRef = useRef(null);
  const repBodyCaretRef = useRef(null);
  const histContentRef = useRef(null);
  const histCodeRef = useRef(null);
  const repCodeRef = useRef(null);
  const repCntRef = useRef(null);
  const smContentRef = useRef(null);
  const chepyCntRef = useRef(null);
  const webhookExt = extensions.find(e => e.name === 'webhook_site');

  const getSelectedText = () => {
    try {
      const sel = window.getSelection();
      if (!sel) return '';
      return sel.toString().trim();
    } catch (e) {
      return '';
    }
  };

  const toast = (m, t = 'info') => {
    const id = Date.now();
    setToasts(p => [...p, { id, message: m, type: t }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 3000);
  };

  const api = {
    get: async u => (await fetch(API + u)).json(),
    post: async (u, d) => (await fetch(API + u, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: d ? JSON.stringify(d) : undefined
    })).json(),
    put: async (u, d) => (await fetch(API + u, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: d ? JSON.stringify(d) : undefined
    })).json(),
    del: async u => (await fetch(API + u, { method: 'DELETE' })).json()
  };

  useEffect(() => {
    Promise.all([loadPrjs(), loadCur()]).finally(() => setAppReady(true));
    connectWs();
    return () => _optionalChain([wsRef, 'access', _2 => _2.current, 'optionalAccess', _3 => _3.close, 'call', _4 => _4()]);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('bw_theme');
      if (saved && THEMES[saved]) setThemeId(saved);
    } catch (e) {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('bw_theme', themeId);
    } catch (e) {
      // ignore storage errors
    }
  }, [themeId]);

  useEffect(() => {
    const handler = e => {
      const selected = getSelectedText();
      if (!selected) return;
      if (e.defaultPrevented) return;
      const target = e.target;
      if (target && target.closest('input, textarea, [contenteditable="true"]')) return;
      e.preventDefault();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        source: 'selection',
        request: { body: selected },
        normalized: { id: 'selection', method: 'TEXT', url: '', headers: {}, body: selected, source: 'selection' }
      });
    };
    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, []);

  useEffect(() => {
    if (!curPrj) return;
    // Critical data in parallel
    loadReqs();
    Promise.all([loadRep(), loadScope(), checkPx()]).then(() => {
      loadColls();
      loadExts();
    });
    loadGit();
  }, [curPrj]);

  // Ctrl+S para auto-commits
  useEffect(() => {
    const handleKeyDown = e => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (curPrj) {
          autoCommit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [curPrj]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener('click', handleClick);
      // Reposicionar si el menú se sale del viewport
      requestAnimationFrame(() => {
        const el = ctxMenuRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        let x = contextMenu.x;
        let y = contextMenu.y;
        if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 8;
        if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 8;
        if (x < 0) x = 8;
        if (y < 0) y = 8;
        if (x !== contextMenu.x || y !== contextMenu.y) {
          el.style.left = x + 'px';
          el.style.top = y + 'px';
        }
      });
      return () => window.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  // Scroll to current search match in history/repeater
  useEffect(() => {
    const el = histCodeRef.current;
    if (el) {
      const cur = el.querySelector('.search-cur');
      if (cur) cur.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [histBodySearchIdx, histBodySearch]);

  useEffect(() => {
    const el = repCodeRef.current;
    if (el) {
      const cur = el.querySelector('.search-cur');
      if (cur) cur.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [repBodySearchIdx, repBodySearch]);

  // Scroll to highlighted match in sensitive detail
  useEffect(() => {
    if (!sensSelDetail || !sensSelResult) return;
    requestAnimationFrame(() => {
      const el = sensDetailRef.current;
      if (el) {
        const cur = el.querySelector('.search-cur');
        if (cur) cur.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });
  }, [sensSelDetail, sensSelResult]);

  // Lazy-load full request detail when selected
  useEffect(() => {
    if (!selReq) { setSelReqFull(null); return; }
    // If already has full data (e.g. from WS push or repeater), skip fetch
    if (selReq.headers !== undefined) { setSelReqFull(selReq); return; }
    let cancelled = false;
    setSelReqFull(null);
    api.get('/api/requests/' + selReq.id + '/detail').then(r => {
      if (!cancelled && r.id) setSelReqFull(r);
    });
    return () => { cancelled = true; };
  }, [_optionalChain([selReq, 'optionalAccess', _5 => _5.id])]);

  // Close preset dropdown on outside click
  useEffect(() => {
    if (!showPresets) return;
    const h = (e) => { if (!e.target.closest('.flt-preset-wrap')) setShowPresets(false); };
    window.addEventListener('click', h, true);
    return () => window.removeEventListener('click', h, true);
  }, [showPresets]);

  useEffect(() => {
    if (tab === 'chepy' && Object.keys(chepyCat).length === 0) {
      loadChepyOps();
    }
  }, [tab]);

  useEffect(() => {
    setWhkApiKey(_optionalChain([webhookExt, 'optionalAccess', _6 => _6.config, 'optionalAccess', _7 => _7.api_key]) || '');
  }, [_optionalChain([webhookExt, 'optionalAccess', _8 => _8.config, 'optionalAccess', _9 => _9.api_key])]);

  // Cargar webhook requests desde DB cuando el token esté disponible (persiste entre reinicios)
  useEffect(() => {
    if (!_optionalChain([webhookExt, 'optionalAccess', _10 => _10.enabled]) || !_optionalChain([webhookExt, 'optionalAccess', _11 => _11.config, 'optionalAccess', _12 => _12.token_id])) return;
    loadWebhookLocal();
  }, [_optionalChain([webhookExt, 'optionalAccess', _13 => _13.enabled]), _optionalChain([webhookExt, 'optionalAccess', _14 => _14.config, 'optionalAccess', _15 => _15.token_id])]);

  // Auto-refresh desde webhook.site cuando estemos en las pestañas relevantes
  useEffect(() => {
    if (tab !== 'extensions' && tab !== 'webhook') return;
    if (!_optionalChain([webhookExt, 'optionalAccess', _16 => _16.enabled]) || !_optionalChain([webhookExt, 'optionalAccess', _17 => _17.config, 'optionalAccess', _18 => _18.token_id])) return;
    const id = setInterval(() => refreshWebhook(true), 15000);
    return () => clearInterval(id);
  }, [tab, _optionalChain([webhookExt, 'optionalAccess', _19 => _19.enabled]), _optionalChain([webhookExt, 'optionalAccess', _20 => _20.config, 'optionalAccess', _21 => _21.token_id])]);

  // Debounced HTTPQL search
  useEffect(() => {
    if (!curPrj) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadReqs(), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search, savedOnly, scopeOnly]);

  // Load presets when project changes
  useEffect(() => {
    if (curPrj) loadPresets();
  }, [curPrj]);

  const loadPresets = async () => {
    try {
      const r = await api.get('/api/filter-presets');
      setPresets(Array.isArray(r) ? r : []);
    } catch (e) { setPresets([]); }
  };

  const savePreset = async () => {
    if (!presetName.trim() || !search.trim()) { toast('Enter a name and query', 'error'); return; }
    const { ast, error } = httpqlParse(search);
    if (error) { toast('Fix query errors first', 'error'); return; }
    try {
      const r = await api.post('/api/filter-presets', { name: presetName.trim(), query: search, ast });
      if (r.error) { toast(r.error, 'error'); return; }
      toast('Preset saved', 'success');
      setPresetName('');
      await loadPresets();
    } catch (e) { toast('Failed to save preset', 'error'); }
  };

  const delPreset = async (id) => {
    await api.del('/api/filter-presets/' + id);
    await loadPresets();
    toast('Preset deleted', 'success');
  };

  const applyPreset = (p) => {
    setSearch(p.query);
    setShowPresets(false);
  };

  const connectWs = () => {
    const ws = new WebSocket(WS_URL);
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.type === 'new_request') {
        // If no active filter, prepend directly; otherwise re-fetch with current filters
        if (!search && !savedOnly && !scopeOnly) setReqs(p => [m.data, ...p]);
        else loadReqs();
      }
      if (m.type === 'intercept_new') setPending(p => [...p, m.data]);
      if (m.type === 'intercept_status') setIntOn(m.enabled);
      if (m.type === 'intercept_forwarded' || m.type === 'intercept_dropped')
        setPending(p => p.filter(r => r.id !== m.request_id));
      if (m.type === 'intercept_all_forwarded' || m.type === 'intercept_all_dropped')
        setPending([]);
    };
    ws.onclose = () => setTimeout(connectWs, 3000);
    wsRef.current = ws;
  };

  const loadPrjs = async () => setPrjs(await api.get('/api/projects'));

  const loadCur = async () => {
    const r = await api.get('/api/projects/current');
    if (r.project) {
      setCurPrj(r.project);
      setIntOn(_optionalChain([r, 'access', _22 => _22.config, 'optionalAccess', _23 => _23.intercept_enabled]) || false);
      setScopeRules(_optionalChain([r, 'access', _24 => _24.config, 'optionalAccess', _25 => _25.scope_rules]) || []);
      setPxPort(_optionalChain([r, 'access', _26 => _26.config, 'optionalAccess', _27 => _27.proxy_port]) || 8080);
      setPxMode(_optionalChain([r, 'access', _28 => _28.config, 'optionalAccess', _29 => _29.proxy_mode]) || 'regular');
      setPxArgs(_optionalChain([r, 'access', _30 => _30.config, 'optionalAccess', _31 => _31.proxy_args]) || '');
      setTab('history');
    }
  };

  const loadReqs = async (query, ast) => {
    const q = query !== undefined ? query : search;
    const parsed = ast !== undefined ? ast : (q ? httpqlParse(q) : { ast: null, error: null });
    if (parsed.error) { setHttpqlError(parsed.error); return; }
    setHttpqlError(null);
    try {
      const body = { limit: 500, saved_only: savedOnly, in_scope_only: scopeOnly };
      if (parsed.ast) { body.query = q; body.ast = parsed.ast; }
      const r = await api.post('/api/requests/search', body);
      if (r.error) { setHttpqlError(r.error); return; }
      setReqs(Array.isArray(r) ? r : []);
    } catch (e) {
      setHttpqlError('Search failed');
    }
  };
  const loadRep = async () => setRepReqs(await api.get('/api/repeater'));
  const loadGit = async () => setCommits(await api.get('/api/git/history'));
  const loadScope = async () => {
    const r = await api.get('/api/scope');
    setScopeRules(r.rules || []);
  };
  const loadExts = async () => {
    const r = await api.get('/api/extensions');
    setExtensions(r.extensions || []);
  };
  const checkPx = async () => {
    const r = await api.get('/api/proxy/status');
    setPxRun(r.running);
    setIntOn(r.intercept_enabled);
  };

  const loadWebhookLocal = async () => {
    if (!curPrj) return;
    if (!_optionalChain([webhookExt, 'optionalAccess', _32 => _32.config, 'optionalAccess', _33 => _33.token_id])) {
      setWhkReqs([]);
      return;
    }
    const r = await api.get('/api/webhooksite/requests?limit=200');
    setWhkReqs(r.requests || []);
  };

  const refreshWebhook = async (silent = false) => {
    if (!_optionalChain([webhookExt, 'optionalAccess', _34 => _34.config, 'optionalAccess', _35 => _35.token_id])) {
      if (!silent) toast('No webhook token', 'error');
      return;
    }
    setWhkLoading(true);
    try {
      const r = await api.post('/api/webhooksite/refresh', { limit: 50 });
      if (r.status === 'ok') {
        await loadWebhookLocal();
        if (!silent) toast('Webhook updated', 'success');
      } else {
        if (!silent) toast(r.detail || 'Webhook refresh failed', 'error');
      }
    } catch (e) {
      if (!silent) toast('Webhook refresh failed', 'error');
    }
    setWhkLoading(false);
  };

  const createWebhookToken = async () => {
    setWhkLoading(true);
    try {
      const r = await api.post('/api/webhooksite/token');
      if (r.status === 'created') {
        await loadExts();
        await loadWebhookLocal();
        toast('Webhook URL created', 'success');
      } else {
        toast(r.detail || 'Failed to create webhook', 'error');
      }
    } catch (e) {
      toast('Failed to create webhook', 'error');
    }
    setWhkLoading(false);
  };

  const clearWebhookHistory = async () => {
    await api.del('/api/webhooksite/requests');
    setWhkReqs([]);
    setSelWhkReq(null);
    toast('Webhook history cleared', 'success');
  };

  const whkToRepeater = r => {
    const hdrs = r.headers || {};
    setRepM(r.method || 'GET');
    setRepU(r.url || '');
    setRepH(Object.entries(hdrs).map(([k, v]) => k + ': ' + v).join('\n'));
    setRepB(r.content || '');
    setTab('repeater');
    toast('Sent to Repeater', 'success');
  };

  // whkContextAction removed - unified into handleContextAction

  const filteredWhk = whkReqs.filter(r => {
    if (whkSearch && !(r.url || '').toLowerCase().includes(whkSearch.toLowerCase()) &&
        !(r.method || '').toLowerCase().includes(whkSearch.toLowerCase()) &&
        !(r.ip || '').toLowerCase().includes(whkSearch.toLowerCase())) return false;
    return true;
  });

  const selectPrj = async n => {
    const r = await api.post('/api/projects/' + encodeURIComponent(n) + '/select');
    if (r && r.status === 'selected') {
      setCurPrj(n);
      await loadCur();
      setTab('history');
      toast('Project: ' + n, 'success');
    } else {
      toast(_optionalChain([r, 'optionalAccess', _36 => _36.detail]) || 'Failed to select project', 'error');
    }
  };

  const createPrj = async () => {
    const name = newName.trim();
    if (!name) return;
    if (/[\\/]/.test(name)) {
      toast('Project name cannot contain / or \\', 'error');
      return;
    }
    const r = await api.post('/api/projects', { name, description: newDesc });
    if (!r || r.status !== 'created') {
      toast(_optionalChain([r, 'optionalAccess', _37 => _37.detail]) || 'Failed to create project', 'error');
      return;
    }
    await loadPrjs();
    await selectPrj(name);
    setShowNew(false);
    setNewName('');
    setNewDesc('');
    toast('Created', 'success');
  };

  const delPrj = async n => {
    if (!confirm('Delete ' + n + '?')) return;
    const r = await api.del('/api/projects/' + encodeURIComponent(n));
    if (r && (r.status === 'deleted' || r.status === 'ok')) {
      if (curPrj === n) setCurPrj(null);
      await loadPrjs();
      toast('Deleted', 'success');
    } else {
      toast(_optionalChain([r, 'optionalAccess', _38 => _38.detail]) || 'Failed to delete project', 'error');
    }
  };

  const startPx = async () => {
    setLoading(true);
    const r = await api.post('/api/proxy/start?port=' + pxPort + '&mode=' + encodeURIComponent(pxMode) + '&extra=' + encodeURIComponent(pxArgs));
    setLoading(false);
    if (r.status === 'started' || r.status === 'already_running') {
      setPxRun(true);
      toast('Proxy started', 'success');
    } else {
      toast('Failed: ' + (r.error || 'unknown'), 'error');
    }
  };

  const stopPx = async () => {
    await api.post('/api/proxy/stop');
    setPxRun(false);
    toast('Stopped', 'success');
  };

  const launchBr = async () => {
    const r = await api.post('/api/browser/launch?proxy_port=' + pxPort);
    toast(r.status === 'launched' ? 'Browser launched' : 'Failed', 'success');
  };

  const togInt = async () => {
    const r = await api.post('/api/intercept/toggle');
    setIntOn(r.enabled);
    toast('Intercept ' + (r.enabled ? 'ON' : 'OFF'), 'success');
  };

  const fwdReq = async (id, mod = null) => {
    await api.post('/api/intercept/' + id + '/forward', mod);
    setPending(p => p.filter(r => r.id !== id));
    if (_optionalChain([selPend, 'optionalAccess', _39 => _39.id]) === id) setSelPend(null);
  };

  const dropReq = async id => {
    await api.post('/api/intercept/' + id + '/drop');
    setPending(p => p.filter(r => r.id !== id));
    if (_optionalChain([selPend, 'optionalAccess', _40 => _40.id]) === id) setSelPend(null);
  };

  const fwdAll = async () => {
    await api.post('/api/intercept/forward-all');
    setPending([]);
    setSelPend(null);
  };

  const dropAll = async () => {
    await api.post('/api/intercept/drop-all');
    setPending([]);
    setSelPend(null);
  };

  const addRule = async () => {
    if (!newPat.trim()) return;
    await api.post('/api/scope/rules', { pattern: newPat, rule_type: newType });
    await loadScope();
    setNewPat('');
    toast('Rule added', 'success');
  };

  const delRule = async id => {
    await api.del('/api/scope/rules/' + id);
    await loadScope();
  };

  const togRule = async id => {
    await api.put('/api/scope/rules/' + id);
    await loadScope();
  };

  // Pretty Print/Minify en Repeater
  // Protobuf best-effort decoder (sin esquema)
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
              } catch (e3) {
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

  const prettyPrint = text => {
    try {
      const obj = JSON.parse(text);
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      try {
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'text/xml');
        if (xml.getElementsByTagName('parsererror').length === 0) {
          return formatXml(new XMLSerializer().serializeToString(xml));
        }
      } catch (e2) {}
    }
    // Protobuf best-effort: intentar decodificar datos binarios
    const proto = tryDecodeProtobuf(text);
    if (proto) return proto;
    return text;
  };

  const minify = text => {
    try {
      const obj = JSON.parse(text);
      return JSON.stringify(obj);
    } catch (e) {}
    return text.replace(/\s+/g, ' ').trim();
  };

  const formatXml = xml => {
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

  // Chepy functions
  const loadChepyOps = async () => {
    const data = await api.get('/api/chepy/operations');
    if (data.operations) {
      setChepyCat(data.operations);
      const cats = Object.keys(data.operations);
      if (cats.length > 0 && !chepySelCat) setChepySelCat(cats[0]);
    }
  };

  const addChepyOp = op => {
    setChepyOps(prev => [...prev, {
      name: op.name,
      label: op.label,
      args: Object.fromEntries((op.params || []).map(p => [p.name, p.default || ''])),
      params: op.params || []
    }]);
  };

  const removeChepyOp = index => {
    setChepyOps(prev => prev.filter((_, i) => i !== index));
  };

  const updateChepyArg = (index, argName, value) => {
    setChepyOps(prev => prev.map((op, i) =>
      i === index ? { ...op, args: { ...op.args, [argName]: value } } : op
    ));
  };

  const moveChepyOp = (index, direction) => {
    setChepyOps(prev => {
      const arr = [...prev];
      const target = index + direction;
      if (target < 0 || target >= arr.length) return arr;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr;
    });
  };

  const bakeChepy = async () => {
    if (!chepyIn && chepyOps.length === 0) return;
    setChepyBaking(true);
    setChepyErr('');
    try {
      const data = await api.post('/api/chepy/bake', {
        input: chepyIn,
        operations: chepyOps.map(op => ({ name: op.name, args: op.args }))
      });
      if (data.error) {
        setChepyErr(data.error);
        setChepyOut('');
      } else {
        setChepyOut(data.output || '');
      }
    } catch (e) {
      setChepyErr(String(e));
    }
    setChepyBaking(false);
  };

  const clearChepyRecipe = () => {
    setChepyOps([]);
    setChepyOut('');
    setChepyErr('');
  };

  // WebSocket Viewer functions
  const loadWsConns = async () => {
    const data = await api.get('/api/websocket/connections');
    setWsConns(Array.isArray(data) ? data : []);
  };

  const loadWsFrames = async url => {
    setSelWsConn(url);
    const data = await api.get('/api/websocket/frames?url=' + encodeURIComponent(url));
    setWsFrames(Array.isArray(data) ? data : []);
    setSelWsFrame(null);
    setWsResendResp(null);
  };

  const selectWsFrame = f => {
    setSelWsFrame(f);
    setWsResendMsg(f.content || '');
    setWsResendResp(null);
  };

  const resendWsFrame = async () => {
    if (!selWsConn || !wsResendMsg) return;
    setWsSending(true);
    setWsResendResp(null);
    const r = await api.post('/api/websocket/resend', { url: selWsConn, message: wsResendMsg });
    setWsResendResp(r);
    setWsSending(false);
    if (r.error) toast('WS Error: ' + r.error, 'error');
    else toast('Frame sent', 'success');
  };

  // Collections functions
  const loadColls = async () => {
    const data = await api.get('/api/collections');
    setColls(Array.isArray(data) ? data : []);
  };

  const createColl = async () => {
    const n = prompt('Collection name:');
    if (!n) return;
    const r = await api.post('/api/collections', { name: n });
    await loadColls();
    if (r.id) { setSelColl(r.id); loadCollItems(r.id); }
    toast('Collection created', 'success');
  };

  const deleteColl = async id => {
    if (!confirm('Delete collection?')) return;
    await api.del('/api/collections/' + id);
    if (selColl === id) { setSelColl(null); setCollItems([]); }
    loadColls();
    toast('Deleted', 'success');
  };

  const loadCollItems = async cid => {
    setSelColl(cid);
    const data = await api.get('/api/collections/' + cid + '/items');
    setCollItems(Array.isArray(data) ? data : []);
    setCollStep(0);
    setCollVars({});
    setCollResps({});
  };

  const addToCollection = async (collId, req) => {
    const headers = req.headers || {};
    await api.post('/api/collections/' + collId + '/items', {
      method: req.method || 'GET',
      url: req.url || '',
      headers: typeof headers === 'string' ? {} : headers,
      body: req.body || req.content || null,
      var_extracts: []
    });
    if (selColl === collId) loadCollItems(collId);
    toast('Added to collection', 'success');
    setShowCollPick(null);
  };

  const deleteCollItem = async (cid, iid) => {
    await api.del('/api/collections/' + cid + '/items/' + iid);
    loadCollItems(cid);
  };

  const updateCollItemExtracts = async (cid, iid, extracts) => {
    await api.put('/api/collections/' + cid + '/items/' + iid, { var_extracts: extracts });
    loadCollItems(cid);
  };

  const executeCollStep = async () => {
    if (!selColl || collStep >= collItems.length) return;
    const item = collItems[collStep];
    setCollRunning(true);
    const r = await api.post('/api/collections/' + selColl + '/items/' + item.id + '/execute', { variables: collVars });
    setCollRunning(false);
    if (r.error) {
      toast('Step failed: ' + r.error, 'error');
      setCollResps(prev => ({ ...prev, [item.id]: r }));
      return;
    }
    if (r.extracted_variables) {
      setCollVars(prev => ({ ...prev, ...r.extracted_variables }));
    }
    setCollResps(prev => ({ ...prev, [item.id]: r }));
    if (collStep < collItems.length - 1) {
      setCollStep(prev => prev + 1);
    }
    toast('Step ' + (collStep + 1) + ' complete', 'success');
  };

  const resetCollRun = () => {
    setCollStep(0);
    setCollVars({});
    setCollResps({});
  };

  // Historial de navegación en Repeater
  const saveToHistory = (request, response) => {
    const historyItem = {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body,
      response: response
    };
    setRepHistory(prev => {
      const newHistory = prev.slice(0, repHistoryIndex + 1);
      return [...newHistory, historyItem];
    });
    setRepHistoryIndex(prev => prev + 1);
  };

  const navigateHistory = direction => {
    const newIndex = repHistoryIndex + direction;
    if (newIndex >= 0 && newIndex < repHistory.length) {
      const item = repHistory[newIndex];
      setRepM(item.method);
      setRepU(item.url);
      setRepH(item.headers);
      setRepB(item.body);
      setRepResp(item.response);
      setRepHistoryIndex(newIndex);
    }
  };

  const sendRep = async () => {
    setLoading(true);
    setRepResp(null);
    let h = {};
    try {
      repH.split('\n').forEach(l => {
        const [k, ...v] = l.split(':');
        if (k && v.length) h[k.trim()] = v.join(':').trim();
      });
    } catch (e) {}

    // Auto-calcular Content-Length si hay body
    if (repB) {
      const len = new TextEncoder().encode(repB).length;
      const clKey = Object.keys(h).find(k => k.toLowerCase() === 'content-length');
      if (clKey) h[clKey] = String(len);
      else h['Content-Length'] = String(len);
    } else {
      // Eliminar Content-Length si no hay body
      const clKey = Object.keys(h).find(k => k.toLowerCase() === 'content-length');
      if (clKey) delete h[clKey];
    }

    const requestData = { method: repM, url: repU, headers: h, body: repB };
    const r = await api.post('/api/repeater/send-raw', { ...requestData, body: repB || null, follow_redirects: repFollowRedirects });
    setRepResp(r);
    setRepRespBody(r.body || '');
    setLoading(false);

    // Guardar en historial de navegación
    saveToHistory(requestData, r);

    // Auto-save: siempre guardar automáticamente
    if (selRep) {
      // Actualizar item existente con datos actuales y última respuesta
      await api.put('/api/repeater/' + selRep, { method: repM, url: repU, headers: h, body: repB, last_response: r });
      loadRep();
    } else {
      // Crear nuevo item automáticamente
      let host = repU;
      try { host = new URL(repU).host; } catch (e) {}
      const autoName = repM + ' ' + host;
      await api.post('/api/repeater', { name: autoName, method: repM, url: repU, headers: h, body: repB });
      const items = await api.get('/api/repeater');
      setRepReqs(items);
      if (items.length > 0) setSelRep(items[0].id);
    }
  };

  const followRedirect = async () => {
    if (!repResp || !repResp.is_redirect || !repResp.redirect_url) return;
    let nextUrl = repResp.redirect_url;
    // Resolver URL relativa
    try {
      nextUrl = new URL(nextUrl, repU).href;
    } catch (e) {}
    setRepU(nextUrl);
    setRepM('GET');
    setLoading(true);
    setRepResp(null);
    let h = {};
    try {
      repH.split('\n').forEach(l => {
        const [k, ...v] = l.split(':');
        if (k && v.length) h[k.trim()] = v.join(':').trim();
      });
    } catch (e) {}
    const requestData = { method: 'GET', url: nextUrl, headers: h, body: null };
    const r = await api.post('/api/repeater/send-raw', { ...requestData, follow_redirects: false });
    setRepResp(r);
    setRepRespBody(r.body || '');
    setLoading(false);
    saveToHistory(requestData, r);
  };

  const toRep = r => {
    setRepM(r.method);
    const url = r.url || '';
    setRepU(url);
    const hdrs = Object.entries(r.headers || {}).map(([k, v]) => k + ': ' + v);
    if (url && !hdrs.some(h => /^host\s*:/i.test(h))) {
      try { hdrs.unshift('Host: ' + new URL(url).host); } catch (e) {}
    }
    setRepH(hdrs.join('\n'));
    setRepB(r.body || '');
    setTab('repeater');
    toast('Sent to Repeater', 'success');
  };

  // --- Intruder functions ---
  const toIntruder = r => {
    setIntMethod(r.method || 'GET');
    const url = r.url || '';
    setIntUrl(url);
    const hdrs = Object.entries(r.headers || {}).map(([k, v]) => k + ': ' + v);
    const hasHost = hdrs.some(h => h.match(/^host\s*:/i));
    if (!hasHost && url) {
      try { const u = new URL(url); hdrs.unshift('Host: ' + u.host); } catch (e) {}
    }
    setIntHeaders(hdrs.join('\n'));
    setIntBody(r.body || '');
    setIntPositions([]);
    setIntSubTab('positions');
    setTab('intruder');
    toast('Sent to Intruder', 'success');
  };

  const parseIntPositions = (url, headers, body) => {
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

  useEffect(() => {
    const p = parseIntPositions(intUrl, intHeaders, intBody);
    setIntPositions(p);
    // Initialize payload sets for new positions
    setIntPayloads(prev => {
      const next = {};
      p.forEach((pos, i) => {
        next[i] = prev[i] || { type: 'list', items: '', from: 0, to: 99, step: 1, padLen: 0, charset: 'abcdefghijklmnopqrstuvwxyz', minLen: 1, maxLen: 3, urlEncode: false, base64: false, hash: '', prefix: '', suffix: '' };
      });
      return next;
    });
  }, [intUrl, intHeaders, intBody]);

  const generatePayloadList = (cfg) => {
    let items = [];
    if (cfg.type === 'list') {
      items = (cfg.items || '').split('\n').filter(l => l.length > 0);
    } else if (cfg.type === 'numbers') {
      const from = Number(cfg.from) || 0;
      const to = Number(cfg.to) || 0;
      const step = Math.max(1, Number(cfg.step) || 1);
      const pad = Number(cfg.padLen) || 0;
      for (let n = from; n <= to; n += step) {
        let s = String(n);
        if (pad > 0) while (s.length < pad) s = '0' + s;
        items.push(s);
      }
    } else if (cfg.type === 'bruteforce') {
      const chars = (cfg.charset || 'a').split('');
      const minL = Math.max(1, Number(cfg.minLen) || 1);
      const maxL = Math.min(8, Number(cfg.maxLen) || 3);
      const gen = (prefix, len) => {
        if (prefix.length === len) { items.push(prefix); return; }
        for (const c of chars) gen(prefix + c, len);
      };
      for (let l = minL; l <= maxL; l++) gen('', l);
      if (items.length > 500000) items = items.slice(0, 500000); // safety cap
    }
    // Processing
    items = items.map(v => {
      if (cfg.prefix) v = cfg.prefix + v;
      if (cfg.suffix) v = v + cfg.suffix;
      if (cfg.urlEncode) v = encodeURIComponent(v);
      if (cfg.base64) v = btoa(v);
      return v;
    });
    return items;
  };

  const generateAttackCombinations = () => {
    const positions = parseIntPositions(intUrl, intHeaders, intBody);
    if (positions.length === 0) return [];
    const payloadSets = positions.map((_, i) => generatePayloadList(intPayloads[i] || { type: 'list', items: '' }));
    const combos = [];

    if (intAttackType === 'targeted') {
      // For each position, iterate its payloads while others keep original value
      for (let pi = 0; pi < positions.length; pi++) {
        for (const val of payloadSets[pi]) {
          const payloads = {};
          positions.forEach((_, i) => { payloads[i] = i === pi ? val : null; }); // null = keep original
          combos.push({ payloads, label: val });
        }
      }
    } else if (intAttackType === 'broadcast') {
      // Same payload in all positions
      const list = payloadSets[0] || [];
      for (const val of list) {
        const payloads = {};
        positions.forEach((_, i) => { payloads[i] = val; });
        combos.push({ payloads, label: val });
      }
    } else if (intAttackType === 'parallel') {
      // Zip all lists
      const minLen = Math.min(...payloadSets.map(s => s.length));
      for (let j = 0; j < minLen; j++) {
        const payloads = {};
        positions.forEach((_, i) => { payloads[i] = payloadSets[i][j]; });
        combos.push({ payloads, label: payloadSets.map(s => s[j]).join(' | ') });
      }
    } else if (intAttackType === 'matrix') {
      // Cartesian product
      const cart = (arr) => {
        if (arr.length === 0) return [[]];
        const [first, ...rest] = arr;
        const restCombos = cart(rest);
        const result = [];
        for (const v of first) for (const rc of restCombos) result.push([v, ...rc]);
        return result;
      };
      const products = cart(payloadSets);
      for (const combo of products) {
        const payloads = {};
        positions.forEach((_, i) => { payloads[i] = combo[i]; });
        combos.push({ payloads, label: combo.join(' | ') });
      }
      if (combos.length > 1000000) combos.length = 1000000; // safety cap
    }
    return combos;
  };

  const buildIntRequest = (combo) => {
    const marker = /\u00a7([^\u00a7]*)\u00a7/g;
    let posIdx = 0;
    const replaceMarkers = (text, section) => {
      const startIdx = posIdx;
      // count markers in this section
      let count = 0;
      marker.lastIndex = 0;
      let mm;
      while ((mm = marker.exec(text)) !== null) count++;
      const result = text.replace(marker, () => {
        const val = combo.payloads[startIdx + (posIdx - startIdx)];
        const orig = '';
        posIdx++;
        return val !== null && val !== undefined ? val : orig;
      });
      return result;
    };
    posIdx = 0;
    const url = replaceMarkers(intUrl, 'url');
    const headersText = replaceMarkers(intHeaders, 'headers');
    const body = replaceMarkers(intBody, 'body');

    let h = {};
    try {
      headersText.split('\n').forEach(l => {
        const [k, ...v] = l.split(':');
        if (k && v.length) h[k.trim()] = v.join(':').trim();
      });
    } catch (e) {}
    // Auto Content-Length
    if (body) {
      const len = new TextEncoder().encode(body).length;
      const clKey = Object.keys(h).find(k => k.toLowerCase() === 'content-length');
      if (clKey) h[clKey] = String(len); else h['Content-Length'] = String(len);
    } else {
      const clKey = Object.keys(h).find(k => k.toLowerCase() === 'content-length');
      if (clKey) delete h[clKey];
    }
    return { method: intMethod, url, headers: h, body: body || null };
  };

  const runIntruderAttack = async () => {
    const combos = generateAttackCombinations();
    if (combos.length === 0) { toast('No payload combinations to run', 'error'); return; }
    intStopRef.current = false;
    setIntRunning(true);
    setIntResults([]);
    setIntDone(0);
    setIntTotal(combos.length);
    setIntPct(0);
    setIntStartTime(Date.now());
    setIntSubTab('results');

    const conc = Math.max(1, Math.min(50, intConcurrency));
    let done = 0;

    for (let i = 0; i < combos.length; i += conc) {
      if (intStopRef.current) break;
      const batch = combos.slice(i, i + conc);
      const results = await Promise.all(batch.map(async (combo, bi) => {
        const reqData = buildIntRequest(combo);
        let retries = 0;
        let resp;
        while (true) {
          try {
            resp = await api.post('/api/repeater/send-raw', { ...reqData, follow_redirects: intFollowRedirects });
          } catch (e) {
            resp = { error: String(e) };
          }
          if (!resp.error || retries >= intMaxRetries) break;
          retries++;
        }
        return {
          num: i + bi + 1,
          payload: combo.label,
          status: resp.status_code || 0,
          length: resp.size || 0,
          time: resp.elapsed ? Math.round(resp.elapsed * 1000) : 0,
          error: resp.error || '',
          request: reqData,
          response: resp
        };
      }));
      done += results.length;
      setIntResults(prev => [...prev, ...results]);
      setIntDone(done);
      setIntPct(Math.round((done / combos.length) * 100));

      // Delay between batches
      if (i + conc < combos.length && !intStopRef.current) {
        let delay = intDelay;
        if (intRandomDelay) delay = intDelayMin + Math.random() * (intDelayMax - intDelayMin);
        if (delay > 0) await new Promise(r => setTimeout(r, delay));
      }
    }
    setIntRunning(false);
  };

  const stopIntruderAttack = () => {
    intStopRef.current = true;
    setIntRunning(false);
  };

  const intComputeTotal = () => {
    try {
      const positions = parseIntPositions(intUrl, intHeaders, intBody);
      if (positions.length === 0) return 0;
      const payloadSets = positions.map((_, i) => generatePayloadList(intPayloads[i] || { type: 'list', items: '' }));
      if (intAttackType === 'targeted') return payloadSets.reduce((s, l) => s + l.length, 0);
      if (intAttackType === 'broadcast') return (payloadSets[0] || []).length;
      if (intAttackType === 'parallel') return Math.min(...payloadSets.map(s => s.length));
      if (intAttackType === 'matrix') return payloadSets.reduce((s, l) => s * l.length, 1);
    } catch (e) {}
    return 0;
  };

  const intSorted = React.useMemo(() => {
    let arr = [...intResults];
    if (intFilter) {
      const f = intFilter.toLowerCase();
      arr = arr.filter(r => r.payload.toLowerCase().includes(f) || String(r.status).includes(f) || (r.error && r.error.toLowerCase().includes(f)));
    }
    const col = intSortCol;
    const dir = intSortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      if (col === '#') return (a.num - b.num) * dir;
      if (col === 'payload') return a.payload.localeCompare(b.payload) * dir;
      if (col === 'status') return (a.status - b.status) * dir;
      if (col === 'length') return (a.length - b.length) * dir;
      if (col === 'time') return (a.time - b.time) * dir;
      return 0;
    });
    return arr;
  }, [intResults, intFilter, intSortCol, intSortDir]);
  const loadIntAttacks = async () => {
    try {
      const r = await api.get('/api/intruder/attacks');
      setIntAttacks(Array.isArray(r) ? r : []);
    } catch (e) { setIntAttacks([]); }
  };

  const saveIntAttack = async (name) => {
    const config = { method: intMethod, url: intUrl, headers: intHeaders, body: intBody, attackType: intAttackType,
      payloads: intPayloads, concurrency: intConcurrency, delay: intDelay, randomDelay: intRandomDelay,
      delayMin: intDelayMin, delayMax: intDelayMax, followRedirects: intFollowRedirects, timeout: intTimeout, maxRetries: intMaxRetries };
    const r = await api.post('/api/intruder/attacks', { name, config, results: intResults, total: intResults.length });
    if (r.id) {
      setIntSelAttack(r.id);
      loadIntAttacks();
      toast('Attack saved', 'success');
    }
  };

  const loadIntAttack = async (id) => {
    const r = await api.get('/api/intruder/attacks/' + id);
    if (r.error) { toast('Failed to load', 'error'); return; }
    setIntSelAttack(id);
    // Restore config
    const c = r.config || {};
    setIntMethod(c.method || 'GET');
    setIntUrl(c.url || '');
    setIntHeaders(c.headers || '');
    setIntBody(c.body || '');
    setIntAttackType(c.attackType || 'targeted');
    setIntPayloads(c.payloads || {});
    setIntConcurrency(c.concurrency || 1);
    setIntDelay(c.delay || 0);
    setIntRandomDelay(c.randomDelay || false);
    setIntDelayMin(c.delayMin || 100);
    setIntDelayMax(c.delayMax || 500);
    setIntFollowRedirects(c.followRedirects || false);
    setIntTimeout(c.timeout || 30);
    setIntMaxRetries(c.maxRetries || 0);
    // Restore results
    setIntResults(r.results || []);
    setIntTotal(r.total || 0);
    setIntDone(r.total || 0);
    setIntPct(r.total > 0 ? 100 : 0);
    setIntSelResult(null);
    setIntSubTab('results');
  };

  const renameIntAttack = async (id) => {
    const atk = intAttacks.find(a => a.id === id);
    const n = prompt('Rename attack:', atk ? atk.name : '');
    if (!n) return;
    await api.put('/api/intruder/attacks/' + id, { name: n });
    loadIntAttacks();
  };

  const deleteIntAttack = async (id) => {
    await api.del('/api/intruder/attacks/' + id);
    if (intSelAttack === id) setIntSelAttack(null);
    loadIntAttacks();
    toast('Attack deleted', 'success');
  };

  const intRanRef = useRef(false);
  // Auto-save results when attack finishes
  useEffect(() => {
    if (intRunning) { intRanRef.current = true; return; }
    if (!intRanRef.current) return;
    intRanRef.current = false;
    if (intResults.length > 0 && intDone > 0) {
      // Auto-save
      const name = intMethod + ' ' + (intUrl.length > 40 ? intUrl.slice(0, 40) + '...' : intUrl) + ' (' + intResults.length + ')';
      const config = { method: intMethod, url: intUrl, headers: intHeaders, body: intBody, attackType: intAttackType,
        payloads: intPayloads, concurrency: intConcurrency, delay: intDelay, randomDelay: intRandomDelay,
        delayMin: intDelayMin, delayMax: intDelayMax, followRedirects: intFollowRedirects, timeout: intTimeout, maxRetries: intMaxRetries };
      if (intSelAttack) {
        // Update existing
        api.put('/api/intruder/attacks/' + intSelAttack, { config, results: intResults }).then(() => loadIntAttacks());
      } else {
        // Create new
        api.post('/api/intruder/attacks', { name, config, results: intResults, total: intResults.length }).then(r => {
          if (r && r.id) { setIntSelAttack(r.id); loadIntAttacks(); }
        });
      }
    }
  }, [intRunning]);

  // Load attacks list when switching to intruder tab
  useEffect(() => {
    if (tab === 'intruder' && curPrj) loadIntAttacks();
  }, [tab, curPrj]);
  // --- End Intruder functions ---

  const saveRep = async () => {
    const n = prompt('Name:');
    if (!n) return;
    let h = {};
    try {
      repH.split('\n').forEach(l => {
        const [k, ...v] = l.split(':');
        if (k && v.length) h[k.trim()] = v.join(':').trim();
      });
    } catch (e) {}
    await api.post('/api/repeater', { name: n, method: repM, url: repU, headers: h, body: repB });
    loadRep();
    toast('Saved', 'success');
  };

  const loadRepItem = r => {
    setSelRep(r.id);
    setRepM(r.method);
    setRepU(r.url);
    setRepH(Object.entries(r.headers || {}).map(([k, v]) => k + ': ' + v).join('\n'));
    setRepB(r.body || '');
    if (r.last_response) {
      setRepResp(r.last_response);
      setRepRespBody(r.last_response.body || '');
    } else {
      setRepResp(null);
      setRepRespBody('');
    }
  };

  const renameRepItem = async id => {
    const item = repReqs.find(r => r.id === id);
    if (!item) return;
    const n = prompt('Rename:', item.name);
    if (!n || n === item.name) return;
    await api.put('/api/repeater/' + id, { name: n });
    loadRep();
    toast('Renamed', 'success');
  };

  const delRepItem = async id => {
    await api.del('/api/repeater/' + id);
    if (selRep === id) setSelRep(null);
    loadRep();
    toast('Deleted', 'success');
  };

  const commit = async () => {
    if (!cmtMsg.trim()) return;
    const r = await api.post('/api/git/commit?message=' + encodeURIComponent(cmtMsg));
    if (r.status === 'committed') {
      toast('Committed: ' + r.hash, 'success');
      setCmtMsg('');
      loadGit();
    }
  };

  // Auto-commit con Ctrl+S
  const autoCommit = async () => {
    const msg = 'Auto-commit ' + new Date().toISOString();
    const r = await api.post('/api/git/commit?message=' + encodeURIComponent(msg));
    if (r.status === 'committed') {
      toast('Auto-committed: ' + r.hash.substring(0, 7), 'success');
      loadGit();
    } else {
      toast('No changes to commit', 'info');
    }
  };

  const togSave = async id => {
    await api.put('/api/requests/' + id + '/save');
    loadReqs();
  };

  const delReq = async id => {
    await api.del('/api/requests/' + id);
    loadReqs();
    if (_optionalChain([selReq, 'optionalAccess', _41 => _41.id]) === id) setSelReq(null);
  };

  const clearHist = async () => {
    if (!confirm('Clear unsaved?')) return;
    await api.del('/api/requests?keep_saved=true');
    loadReqs();
    toast('Cleared', 'success');
  };

  const togExtEnabled = async (name, enabled) => {
    const ext = extensions.find(e => e.name === name);
    if (!ext) return;
    const newCfg = { ...ext.config, enabled };
    await api.put('/api/extensions/' + name, newCfg);
    loadExts();
    toast('Extension ' + (enabled ? 'enabled' : 'disabled'), 'success');
  };

  const updateExtCfg = async (name, cfg) => {
    await api.put('/api/extensions/' + name, cfg);
    loadExts();
    toast('Extension updated', 'success');
  };

  const saveProxyCfg = async () => {
    if (!curPrj) return;
    const r = await api.get('/api/projects/current');
    if (!r.config) return;
    r.config.proxy_port = pxPort;
    r.config.proxy_mode = pxMode;
    r.config.proxy_args = pxArgs;
    await save_project_config(curPrj, r.config);
    toast('Proxy config saved', 'success');
    setShowProxyCfg(false);
  };

  const save_project_config = async (name, config) => {
    await api.put('/api/projects/' + encodeURIComponent(name), config);
  };

  // ===== EXTENSION UI COMPONENTS =====

  function MatchReplaceUI({ ext, updateExtCfg }) {
    const rules = _optionalChain([ext, 'access', _42 => _42.config, 'optionalAccess', _43 => _43.rules]) || [];

    const updateRule = (idx, field, value) => {
      const newRules = rules.map((r, i) => i === idx ? { ...r, [field]: value } : r);
      updateExtCfg(ext.name, { ...ext.config, rules: newRules });
    };

    const removeRule = idx => {
      updateExtCfg(ext.name, { ...ext.config, rules: rules.filter((_, i) => i !== idx) });
    };

    const addRule = () => {
      updateExtCfg(ext.name, { ...ext.config, rules: [...rules, {
        enabled: true, when: 'request', target: 'url', pattern: '', replace: '', regex: false, ignore_case: false, header: ''
      }]});
    };

    const duplicateRule = idx => {
      const newRules = [...rules];
      newRules.splice(idx + 1, 0, { ...rules[idx] });
      updateExtCfg(ext.name, { ...ext.config, rules: newRules });
    };

    const whenColors = { request: 'var(--blue)', response: 'var(--green)', both: 'var(--orange)' };
    const s = {
      card: { background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '6px', padding: '12px', marginBottom: '8px', opacity: 1 },
      cardOff: { background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '6px', padding: '12px', marginBottom: '8px', opacity: 0.5 },
      row: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' },
      lastRow: { display: 'flex', gap: '8px', alignItems: 'center' },
      label: { fontSize: '10px', color: 'var(--txt3)', marginBottom: '3px', display: 'block' },
      sel: { background: 'var(--bg)', color: 'var(--txt)', border: '1px solid var(--brd)', borderRadius: '4px', padding: '4px 6px', fontSize: '11px', fontFamily: 'var(--font-mono)', outline: 'none' },
      inp: { background: 'var(--bg)', color: 'var(--txt)', border: '1px solid var(--brd)', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontFamily: 'var(--font-mono)', flex: 1, outline: 'none', width: '100%' },
      badge: (color) => ({ fontSize: '9px', padding: '2px 6px', borderRadius: '3px', background: color, color: '#fff', fontWeight: '600', textTransform: 'uppercase' }),
    };

    return (
      React.createElement('div', { style: { marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--brd)' },}
        , React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },}
          , React.createElement('div', { style: { fontSize: '12px', fontWeight: '600', color: 'var(--txt2)' },}, "Rules ("
             , rules.length, ")"
          )
          , React.createElement('button', { className: "btn btn-sm btn-p"  , onClick: addRule,}, "+ Add Rule"  )
        )

        , rules.length === 0 && (
          React.createElement('div', { style: { padding: '20px', textAlign: 'center', color: 'var(--txt3)', fontSize: '11px', background: 'var(--bg3)', borderRadius: '6px' },}, "No rules yet. Click \"+ Add Rule\" to create one."

          )
        )

        , rules.map((rule, idx) => (
          React.createElement('div', { key: idx, style: rule.enabled ? s.card : s.cardOff,}
            /* Row 1: Enable + When + Target + Actions */
            , React.createElement('div', { style: s.row,}
              , React.createElement('input', { type: "checkbox", checked: rule.enabled, onChange: e => updateRule(idx, 'enabled', e.target.checked),
                title: rule.enabled ? 'Disable rule' : 'Enable rule',} )
              , React.createElement('span', { style: s.badge(whenColors[rule.when] || 'var(--txt3)'),}, "#", idx + 1)
              , React.createElement('div', { style: { flex: 0 },}
                , React.createElement('select', { style: s.sel, value: rule.when, onChange: e => updateRule(idx, 'when', e.target.value),}
                  , React.createElement('option', { value: "request",}, "Request")
                  , React.createElement('option', { value: "response",}, "Response")
                  , React.createElement('option', { value: "both",}, "Both")
                )
              )
              , React.createElement('div', { style: { flex: 0 },}
                , React.createElement('select', { style: s.sel, value: rule.target, onChange: e => updateRule(idx, 'target', e.target.value),}
                  , React.createElement('option', { value: "url",}, "URL")
                  , React.createElement('option', { value: "headers",}, "Header")
                  , React.createElement('option', { value: "body",}, "Body")
                )
              )
              , rule.target === 'headers' && (
                React.createElement('input', { style: { ...s.inp, maxWidth: '120px' }, value: rule.header || '', placeholder: "Header name" ,
                  onChange: e => updateRule(idx, 'header', e.target.value), title: "Leave empty to match all headers"     ,} )
              )
              , React.createElement('div', { style: { marginLeft: 'auto', display: 'flex', gap: '4px' },}
                , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => duplicateRule(idx), title: "Duplicate",}, "⧉")
                , React.createElement('button', { className: "btn btn-sm btn-d"  , onClick: () => removeRule(idx), title: "Delete",}, "✕")
              )
            )

            /* Row 2: Pattern → Replace */
            , React.createElement('div', { style: s.lastRow,}
              , React.createElement('div', { style: { flex: 1 },}
                , React.createElement('label', { style: s.label,}, "Match")
                , React.createElement('input', { style: s.inp, value: rule.pattern, placeholder: rule.regex ? '(regex)' : 'text to find',
                  onChange: e => updateRule(idx, 'pattern', e.target.value),} )
              )
              , React.createElement('span', { style: { color: 'var(--txt3)', fontSize: '14px', marginTop: '14px' },}, "→")
              , React.createElement('div', { style: { flex: 1 },}
                , React.createElement('label', { style: s.label,}, "Replace")
                , React.createElement('input', { style: s.inp, value: rule.replace, placeholder: "replacement",
                  onChange: e => updateRule(idx, 'replace', e.target.value),} )
              )
              , React.createElement('div', { style: { display: 'flex', gap: '6px', marginTop: '14px' },}
                , React.createElement('button', { className: 'btn btn-sm ' + (rule.regex ? 'btn-p' : 'btn-s'), onClick: () => updateRule(idx, 'regex', !rule.regex),
                  title: "Regular expression" , style: { fontFamily: 'var(--font-mono)', fontSize: '10px' },}, ".*")
                , React.createElement('button', { className: 'btn btn-sm ' + (rule.ignore_case ? 'btn-p' : 'btn-s'), onClick: () => updateRule(idx, 'ignore_case', !rule.ignore_case),
                  title: "Ignore case" , style: { fontFamily: 'var(--font-mono)', fontSize: '10px' },}, "Aa")
              )
            )
          )
        ))
      )
    );
  }

  function WebhookSiteUI({ ext, updateExtCfg, whkReqs, whkApiKey, setWhkApiKey, whkLoading, createWebhookToken, refreshWebhook, loadWebhookLocal, toast }) {
    return (
      React.createElement('div', { style: { marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--brd)' },}
        , React.createElement('div', { style: { fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: 'var(--txt2)' },}, "Webhook.site")
        , React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' },}
          , React.createElement('div', null
            , React.createElement('label', { style: { display: 'block', fontSize: '11px', color: 'var(--txt2)', marginBottom: '6px' },}, "API Key (optional)"  )
            , React.createElement('div', { style: { display: 'flex', gap: '8px' },}
              , React.createElement('input', { className: "inp", type: "password", placeholder: "Api-Key", value: whkApiKey, onChange: e => setWhkApiKey(e.target.value),} )
              , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => updateExtCfg(ext.name, { ...ext.config, api_key: whkApiKey }),}, "Save")
            )
          )
          , React.createElement('div', null
            , React.createElement('label', { style: { display: 'block', fontSize: '11px', color: 'var(--txt2)', marginBottom: '6px' },}, "Webhook URL" )
            , React.createElement('div', { style: { display: 'flex', gap: '8px' },}
              , React.createElement('input', { className: "inp", readOnly: true, value: _optionalChain([ext, 'access', _44 => _44.config, 'optionalAccess', _45 => _45.token_url]) || '', placeholder: "Create a webhook URL"   ,} )
              , React.createElement('button', { className: "btn btn-sm btn-s"  , disabled: !_optionalChain([ext, 'access', _46 => _46.config, 'optionalAccess', _47 => _47.token_url]), onClick: () => {
                navigator.clipboard.writeText(ext.config.token_url);
                toast('Copied', 'success');
              },}, "Copy")
            )
          )
          , React.createElement('div', { style: { display: 'flex', gap: '8px' },}
            , React.createElement('button', { className: "btn btn-sm btn-p"  , onClick: createWebhookToken, disabled: whkLoading,}
              , _optionalChain([ext, 'access', _48 => _48.config, 'optionalAccess', _49 => _49.token_id]) ? 'Regenerate URL' : 'Create URL'
            )
            , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => refreshWebhook(), disabled: !_optionalChain([ext, 'access', _50 => _50.config, 'optionalAccess', _51 => _51.token_id]) || whkLoading,}, "Sync Now" )
          )
          , React.createElement('div', { style: { marginTop: '6px' },}
            , React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' },}
              , React.createElement('div', { style: { fontSize: '11px', color: 'var(--txt2)' },}, "Local history" )
              , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: loadWebhookLocal, disabled: !_optionalChain([ext, 'access', _52 => _52.config, 'optionalAccess', _53 => _53.token_id]),}, "Reload")
            )
            , React.createElement('div', { style: { border: '1px solid var(--brd)', borderRadius: '6px', overflow: 'auto', maxHeight: '220px' },}
              , whkReqs.length === 0 && (
                React.createElement('div', { style: { padding: '10px', fontSize: '11px', color: 'var(--txt3)', textAlign: 'center' },}, "No requests yet"

                )
              )
              , whkReqs.map(r => (
                React.createElement('div', { key: r.request_id, style: { display: 'grid', gridTemplateColumns: '60px 1fr 120px 140px', gap: '8px', padding: '8px 10px', borderBottom: '1px solid var(--brd)', fontSize: '11px', fontFamily: 'var(--font-mono)' },}
                  , React.createElement('span', { className: 'mth mth-' + (r.method || 'GET'),}, r.method || 'GET')
                  , React.createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },}, r.url || r.path || '-')
                  , React.createElement('span', { style: { color: 'var(--txt2)' },}, r.ip || '-')
                  , React.createElement('span', { style: { color: 'var(--txt3)' },}, r.created_at || '')
                )
              ))
            )
          )
        )
      )
    );
  }

  // Registry de componentes de extensión
  const EXTENSION_COMPONENTS = {
    'match_replace': MatchReplaceUI,
    'webhook_site': WebhookSiteUI,
  };

  const syntaxHighlightJSON = json => {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, match => {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-bool';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return '<span class="' + cls + '">' + match + '</span>';
    });
  };

  const syntaxHighlightXML = xml => {
    const esc = xml.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc
      .replace(/(&lt;\/?)([\w:.-]+)/g, '$1<span class="json-key">$2</span>')
      .replace(/([\w:.-]+)(=)(&quot;|")/g, '<span class="json-bool">$1</span>$2$3')
      .replace(/(&quot;|")(.*?)(&quot;|")/g, '$1<span class="json-string">$2</span>$3')
      .replace(/(&lt;!--.*?--&gt;)/g, '<span class="json-null">$1</span>');
  };

  const syntaxHighlightProto = text => {
    const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc
      .replace(/^(\/\/.*)/gm, '<span class="json-null">$1</span>')
      .replace(/(field \d+)/g, '<span class="json-key">$1</span>')
      .replace(/\((varint|string|bytes|message|fixed32|fixed64)\)/g, '(<span class="json-bool">$1</span>)')
      .replace(/: (.+)$/gm, (m, val) => {
        if (/^\d+(\.\d+)?$/.test(val)) return ': <span class="json-number">' + val + '</span>';
        return ': <span class="json-string">' + val + '</span>';
      });
  };

  const escapeHtml = s => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const getCaretOffset = el => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.startContainer)) return null;
    const pre = range.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.startContainer, range.startOffset);
    return pre.toString().length;
  };

  const setCaretOffset = (el, offset) => {
    if (offset == null) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    let node;
    let remaining = offset;
    while ((node = walker.nextNode())) {
      const len = node.textContent.length;
      if (remaining <= len) {
        const range = document.createRange();
        range.setStart(node, remaining);
        range.collapse(true);
        const sel = window.getSelection();
        if (!sel) return;
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remaining -= len;
    }
  };

  // Colorea cualquier body inteligentemente (JSON, XML, protobuf, texto plano)
  const colorizeBody = text => {
    if (!text) return { text: text, html: false };
    // JSON
    try {
      JSON.parse(text);
      return { text: syntaxHighlightJSON(text), html: true };
    } catch (e) {}
    // XML
    try {
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'text/xml');
      if (xml.getElementsByTagName('parsererror').length === 0 && text.trim().startsWith('<')) {
        return { text: syntaxHighlightXML(text), html: true };
      }
    } catch (e) {}
    // Protobuf best-effort output
    if (text.includes('// Protobuf') && text.includes('field ')) {
      return { text: syntaxHighlightProto(text), html: true };
    }
    return { text: text, html: false };
  };

  const formatBody = (body, format) => {
    if (!body) return { text: body, html: false };
    if (format === 'pretty') {
      try {
        const obj = JSON.parse(body);
        const formatted = JSON.stringify(obj, null, 2);
        return { text: syntaxHighlightJSON(formatted), html: true };
      } catch (e) {
        // XML pretty
        try {
          const parser = new DOMParser();
          const xml = parser.parseFromString(body, 'text/xml');
          if (xml.getElementsByTagName('parsererror').length === 0 && body.trim().startsWith('<')) {
            const formatted = formatXml(new XMLSerializer().serializeToString(xml));
            return { text: syntaxHighlightXML(formatted), html: true };
          }
        } catch (e2) {}
        // Protobuf best-effort
        const proto = tryDecodeProtobuf(body);
        if (proto) return { text: syntaxHighlightProto(proto), html: true };
      }
    }
    // Siempre intentar colorear, incluso en raw
    return colorizeBody(body);
  };

  const handleRepBodyInput = () => {
    const el = repBodyEditRef.current;
    if (!el) return;
    repBodyCaretRef.current = getCaretOffset(el);
    const text = el.textContent || '';
    setRepB(text);
  };

  useEffect(() => {
    if (!repBodyColor) return;
    const el = repBodyEditRef.current;
    if (!el) return;
    const bodyFmt = formatBody(repB || '', 'pretty');
    const html = bodyFmt.html ? bodyFmt.text : escapeHtml(bodyFmt.text || '');
    if (el.innerHTML !== html) el.innerHTML = html;
    if (repBodyCaretRef.current != null) setCaretOffset(el, repBodyCaretRef.current);
  }, [repB, repBodyColor]);

  // Menú contextual
  // Unified context menu
  const normalizeRequest = (req, source) => {
    if (source === 'webhook') {
      return { id: req.request_id, method: req.method || 'GET', url: req.url || '',
        headers: req.headers || {}, body: req.content || null, source: 'webhook' };
    }
    if (source === 'repeater') {
      return { id: req.id, method: req.method, url: req.url,
        headers: req.headers || {}, body: req.body || null, name: req.name, source: 'repeater' };
    }
    if (source === 'websocket') {
      return { id: req.id, method: 'WS', url: req.url || '',
        headers: {}, body: req.content || req.body || null, source: 'websocket' };
    }
    if (source === 'collection') {
      return { id: req.id, method: req.method, url: req.url,
        headers: req.headers || {}, body: req.body || null, source: 'collection' };
    }
    if (source === 'intercept') {
      return { id: req.id, method: req.method, url: req.url,
        headers: req.headers || {}, body: req.body || null, source: 'intercept' };
    }
    if (source === 'selection') {
      return { id: 'selection', method: 'TEXT', url: '', headers: {}, body: req.body || '', source: 'selection' };
    }
    return { id: req.id, method: req.method, url: req.url,
      headers: req.headers || {}, body: req.body || null, saved: req.saved, source: 'history' };
  };

  const showContextMenu = (e, req, source) => {
    e.preventDefault();
    const norm = normalizeRequest(req, source || 'history');
    setContextMenu({ x: e.clientX, y: e.clientY, request: req, source: source || 'history', normalized: norm });
  };

  const addScopeFromRequest = async ruleType => {
    const norm = _optionalChain([contextMenu, 'optionalAccess', _54 => _54.normalized]);
    if (!norm || !norm.url) {
      toast('No URL', 'error');
      return;
    }
    let host = '';
    try {
      host = new URL(norm.url).host;
    } catch (e) {
      try {
        host = new URL('http://' + norm.url).host;
      } catch (e2) {}
    }
    if (!host) {
      toast('Invalid URL', 'error');
      return;
    }
    await api.post('/api/scope/rules', { pattern: host, rule_type: ruleType });
    await loadScope();
    toast((ruleType === 'include' ? 'Included ' : 'Excluded ') + host, 'success');
  };

  const handleContextAction = async action => {
    if (!contextMenu) return;
    let norm = contextMenu.normalized;
    const req = contextMenu.request;
    const source = contextMenu.source;
    setContextMenu(null);
    // For history list items, fetch full detail on demand for actions needing body/headers
    const needsFull = ['repeater','intruder','copy-curl','copy-body','send-to-cipher','compare-a','compare-b','add-to-collection'];
    if (source === 'history' && needsFull.includes(action) && (!norm.headers || Object.keys(norm.headers).length === 0)) {
      try {
        const full = await api.get('/api/requests/' + req.id + '/detail');
        norm = { ...norm, headers: full.headers || {}, body: full.body || null };
        req.response_status = full.response_status;
        req.response_headers = full.response_headers;
        req.response_body = full.response_body;
      } catch (e) { toast('Failed to load request', 'error'); return; }
    }
    switch (action) {
      case 'repeater':
        toRep({ method: norm.method, url: norm.url, headers: norm.headers, body: norm.body });
        break;
      case 'intruder':
        toIntruder({ method: norm.method, url: norm.url, headers: norm.headers, body: norm.body });
        break;
      case 'favorite':
        if (source === 'history' && req.id) await togSave(req.id);
        break;
      case 'copy-url':
        navigator.clipboard.writeText(norm.url);
        toast('URL copied', 'success');
        break;
      case 'copy-curl':
        navigator.clipboard.writeText(generateCurl(norm));
        toast('cURL copied', 'success');
        break;
      case 'copy-body':
        navigator.clipboard.writeText(norm.body || '');
        toast('Body copied', 'success');
        break;
      case 'send-to-cipher':
        if (norm.body) {
          setChepyIn(norm.body);
          setTab('chepy');
          toast('Sent to Cipher', 'success');
        } else {
          toast('No text selected', 'error');
        }
        break;
      case 'add-to-collection':
        setShowCollPick(norm);
        break;
      case 'scope-include':
        await addScopeFromRequest('include');
        break;
      case 'scope-exclude':
        await addScopeFromRequest('exclude');
        break;
      case 'rename':
        if (source === 'repeater') renameRepItem(req.id);
        break;
      case 'delete':
        if (source === 'history') await delReq(req.id);
        else if (source === 'repeater') await delRepItem(req.id);
        break;
      case 'compare-a':
        setCmpA({ method: norm.method, url: norm.url, headers: norm.headers, body: norm.body,
          response_status: req.response_status || null, response_headers: req.response_headers || null, response_body: req.response_body || null });
        setTab('compare');
        toast('Loaded into Compare A', 'success');
        break;
      case 'compare-b':
        setCmpB({ method: norm.method, url: norm.url, headers: norm.headers, body: norm.body,
          response_status: req.response_status || null, response_headers: req.response_headers || null, response_body: req.response_body || null });
        setTab('compare');
        toast('Loaded into Compare B', 'success');
        break;
    }
  };

  const generateCurl = req => {
    let curl = 'curl -X ' + req.method + " '" + req.url + "'";
    if (req.headers) {
      Object.entries(req.headers).forEach(([k, v]) => {
        curl += " -H '" + k + ': ' + v + "'";
      });
    }
    if (req.body) {
      curl += " -d '" + req.body.replace(/'/g, "'\\''") + "'";
    }
    return curl;
  };

  const filtered = reqs;

  const stCls = s => !s ? '' : s < 300 ? 'st2' : s < 400 ? 'st3' : s < 500 ? 'st4' : 'st5';
  const fmtTime = t => t ? new Date(t).toLocaleTimeString('en-US', { hour12: false }) : '';
  const fmtH = (h, url) => {
    if (!h) return '';
    const lines = Object.entries(h).map(([k, v]) => k + ': ' + (Array.isArray(v) ? v.join(', ') : v));
    if (url && !lines.some(l => /^host\s*:/i.test(l))) {
      try { lines.unshift('Host: ' + new URL(url).host); } catch (e) {}
    }
    return lines.join('\n');
  };
  const colorizeHeaders = text => {
    if (!text) return '';
    return text.split('\n').map(line => {
      const ci = line.indexOf(':');
      if (ci === -1) return escapeHtml(line);
      return '<span class="hdr-key">' + escapeHtml(line.slice(0, ci)) + '</span><span class="hdr-sep">:</span><span class="hdr-val">' + escapeHtml(line.slice(ci + 1)) + '</span>';
    }).join('\n');
  };
  const fmtHHtml = (h, url) => colorizeHeaders(fmtH(h, url));

  const buildCmpText = (req, view) => {
    if (!req) return '';
    if (view === 'request') {
      return req.method + ' ' + req.url + '\n' + fmtH(req.headers, req.url) + (req.body ? '\n\n' + req.body : '');
    }
    return 'HTTP ' + (req.response_status || '(no response)') + '\n' + fmtH(req.response_headers) + '\n\n' + (req.response_body || '');
  };

  // --- Sensitive scan logic ---
  const runSensitiveScan = async () => {
    sensStopRef.current = false;
    setSensScanning(true);
    setSensResults([]);
    setSensPct(0);
    setSensSelResult(null);
    setSensSelDetail(null);

    const allPatterns = [
      ...sensPatterns.general.filter(p => p.enabled),
      ...sensPatterns.tokens.filter(p => p.enabled),
      ...sensPatterns.urls.filter(p => p.enabled),
      ...sensPatterns.files.filter(p => p.enabled),
    ];

    let targets = reqs;
    if (sensScopeOnly) targets = targets.filter(r => r.in_scope);

    const results = [];
    const total = targets.length;
    let done = 0;

    const processBatch = async (batch) => {
      const details = await Promise.all(batch.map(async r => {
        try {
          const d = await api.get('/api/requests/' + r.id + '/detail');
          return d;
        } catch (e4) { return null; }
      }));

      for (const d of details) {
        if (!d || sensStopRef.current) continue;
        const sections = {
          reqUrl: d.url || '',
          reqHeaders: d.headers || '',
          reqBody: d.body || '',
          respHeaders: d.response_headers || '',
          respBody: d.response_body || '',
        };

        if (sensMaxSize > 0 && (sections.respBody.length > sensMaxSize)) {
          sections.respBody = sections.respBody.slice(0, sensMaxSize);
        }

        for (const pat of allPatterns) {
          try {
            const re = new RegExp(pat.regex, 'gi');
            for (const secKey of pat.sections) {
              const text = sections[secKey];
              if (!text) continue;
              let m;
              while ((m = re.exec(text)) !== null) {
                results.push({
                  match: m[0].length > 200 ? m[0].slice(0, 200) + '...' : m[0],
                  patternName: pat.name,
                  category: pat.category,
                  url: d.url || '',
                  method: d.method || '',
                  requestId: d.id,
                  section: secKey,
                });
                if (results.length > 50000) break;
              }
            }
          } catch (e5) { /* invalid regex, skip */ }
        }
      }
    };

    for (let i = 0; i < total; i += sensBatch) {
      if (sensStopRef.current) break;
      const batch = targets.slice(i, i + sensBatch);
      await processBatch(batch);
      done += batch.length;
      setSensPct(Math.round((done / total) * 100));
      setSensResults([...results]);
    }

    setSensScanning(false);
    setSensPct(100);
    setSensResults([...results]);
  };

  const stopSensitiveScan = () => { sensStopRef.current = true; };

  const sensFiltered = React.useMemo(() => {
    let r = sensResults;
    if (sensFilter) {
      const fl = sensFilter.toLowerCase();
      r = r.filter(x => x.match.toLowerCase().includes(fl) || x.patternName.toLowerCase().includes(fl) || x.url.toLowerCase().includes(fl) || x.category.toLowerCase().includes(fl));
    }
    if (sensUnique) {
      const seen = new Set();
      r = r.filter(x => {
        const key = x.match + '||' + x.patternName;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    return r;
  }, [sensResults, sensFilter, sensUnique]);

  const loadSensDetail = async (result) => {
    setSensSelResult(result);
    try {
      const d = await api.get('/api/requests/' + result.requestId + '/detail');
      setSensSelDetail(d);
    } catch (e6) { setSensSelDetail(null); }
  };

  const cmpDiff = React.useMemo(() => {
    if (!cmpA && !cmpB) return [];
    return diffLines(buildCmpText(cmpA, cmpView), buildCmpText(cmpB, cmpView));
  }, [cmpA, cmpB, cmpView]);

  const siteTree = React.useMemo(() => buildSiteTree(reqs), [reqs]);
  const smNodeReqs = React.useMemo(() => smSelNode ? collectNodeReqs(smSelNode) : [], [smSelNode, reqs]);

  const toggleSmNode = (key) => setSmExpanded(p => ({ ...p, [key]: !p[key] }));

  const renderTreeNode = (key, node, depth, parentKey) => {
    const fullKey = parentKey ? parentKey + key : key;
    const expanded = !!smExpanded[fullKey];
    const hasChildren = Object.keys(node.children).length > 0;
    const isSelected = smSelNode === node;
    const methods = [...node.methods].sort();
    return (
      React.createElement(React.Fragment, { key: fullKey,}
        , React.createElement('div', {
          className: 'sm-node' + (isSelected ? ' sel' : ''),
          style: { paddingLeft: (depth * 16 + 8) + 'px' },
          onClick: () => setSmSelNode(node),}

          , React.createElement('span', { className: "sm-toggle", onClick: e => { e.stopPropagation(); if (hasChildren) toggleSmNode(fullKey); },}
            , hasChildren ? (expanded ? '\u25BC' : '\u25B6') : '\u00B7'
          )
          , React.createElement('span', { className: "sm-label",}, node.label)
          , React.createElement('span', { className: "sm-methods",}
            , methods.map(m => React.createElement('span', { key: m, className: 'sm-mth mth-' + m,}, m))
          )
          , React.createElement('span', { className: "sm-badge",}, node.count)
        )
        , expanded && Object.entries(node.children)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, child]) => renderTreeNode(k, child, depth + 1, fullKey))
      )
    );
  };

  const themeVars = (THEMES[themeId] && THEMES[themeId].vars)
    ? THEMES[themeId].vars
    : (THEMES.midnight && THEMES.midnight.vars) ? THEMES.midnight.vars : {};

  return (
    React.createElement('div', { className: "app", style: themeVars,}
      , React.createElement('style', { dangerouslySetInnerHTML: { __html: `
:root{--bg:#0a0e14;--bg2:#0d1117;--bg3:#161b22;--bgh:#1f262d;--brd:#30363d;--txt:#e6edf3;--txt2:#8b949e;--txt3:#6e7681;--blue:#58a6ff;--green:#3fb950;--red:#f85149;--orange:#d29922;--purple:#a371f7;--cyan:#39c5cf;--font-main:"Inter",sans-serif;--font-mono:"JetBrains Mono",monospace}
*{margin:0;padding:0;box-sizing:border-box}body{font-family:var(--font-main);background:var(--bg);color:var(--txt);overflow:hidden}
.app{display:flex;flex-direction:column;height:100vh}
.hdr{display:flex;align-items:center;justify-content:space-between;padding:10px 20px;background:var(--bg2);border-bottom:1px solid var(--brd)}
.logo{display:flex;align-items:center;gap:10px}.logo-i{width:32px;height:32px;background:linear-gradient(135deg,var(--cyan),var(--purple));border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:700}
.logo-t{font-family:var(--font-mono);font-size:18px;font-weight:600;background:linear-gradient(90deg,var(--cyan),var(--purple));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.prj-badge{background:var(--bg3);padding:4px 10px;border-radius:4px;font-size:11px;color:var(--cyan);border:1px solid var(--brd);margin-left:12px}
.hdr-ctrl{display:flex;align-items:center;gap:10px}
.int-tog{display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--bg3);border:1px solid var(--brd);border-radius:6px;font-size:11px;cursor:pointer}
.int-tog.on{background:rgba(248,81,73,.2);border-color:var(--red)}.int-dot{width:8px;height:8px;border-radius:50%;background:var(--txt3)}
.int-tog.on .int-dot{background:var(--red);animation:pulse 1s infinite}.pend-badge{background:var(--red);color:#fff;padding:1px 6px;border-radius:10px;font-size:10px;margin-left:4px}
.prx-st{display:flex;align-items:center;gap:6px;padding:5px 10px;background:var(--bg3);border-radius:6px;font-family:var(--font-mono);font-size:11px}
.st-dot{width:8px;height:8px;border-radius:50%}.st-dot.run{background:var(--green);animation:pulse 2s infinite}.st-dot.stop{background:var(--red)}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
.btn{padding:6px 14px;border:none;border-radius:5px;font-size:12px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
.btn-p{background:var(--blue);color:#fff}.btn-s{background:var(--bg3);color:var(--txt);border:1px solid var(--brd)}.btn-d{background:var(--red);color:#fff}.btn-g{background:var(--green);color:#fff}
.btn-sm{padding:3px 8px;font-size:11px}.btn-lg{padding:10px 20px;font-size:13px}.btn:disabled{opacity:.5}
.tabs{display:flex;background:var(--bg2);border-bottom:1px solid var(--brd);padding:0 16px}
.tab{padding:10px 18px;font-size:12px;font-weight:500;color:var(--txt2);cursor:pointer;border-bottom:2px solid transparent;display:flex;align-items:center;gap:5px}
.tab:hover{color:var(--txt);background:var(--bg3)}.tab.act{color:var(--blue);border-bottom-color:var(--blue)}
.tab-badge{background:var(--red);color:#fff;padding:1px 5px;border-radius:8px;font-size:9px}
.main{flex:1;display:flex;overflow:hidden}
.panel{display:flex;flex-direction:column;overflow:hidden}.pnl-hdr{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg2);border-bottom:1px solid var(--brd);font-size:12px;font-weight:500}
.pnl-cnt{flex:1;overflow:auto}.hist-pnl{flex-shrink:0;border-right:1px solid var(--brd);overflow:hidden}.det-pnl{flex:1;display:flex;flex-direction:column;min-width:0}
.req-list{font-family:var(--font-mono);font-size:11px}.req-item{display:grid;grid-template-columns:60px 1fr 60px 55px;gap:10px;padding:8px 14px;border-bottom:1px solid var(--brd);cursor:pointer;align-items:center}
.req-item:hover{background:var(--bgh)}.req-item.sel{background:var(--bg3);border-left:3px solid var(--blue)}.req-item.out{opacity:.4}
.mth{font-weight:600;padding:2px 6px;border-radius:3px;text-align:center;font-size:10px}
.mth-GET{background:rgba(63,185,80,.15);color:var(--green)}.mth-POST{background:rgba(88,166,255,.15);color:var(--blue)}
.mth-PUT,.mth-PATCH{background:rgba(210,153,34,.15);color:var(--orange)}.mth-DELETE{background:rgba(248,81,73,.15);color:var(--red)}
.url{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sts{font-weight:500}
.st2{color:var(--green)}.st3{color:var(--blue)}.st4{color:var(--orange)}.st5{color:var(--red)}.ts{color:var(--txt3);font-size:10px}
.det-tabs{display:flex;background:var(--bg2);border-bottom:1px solid var(--brd);padding:0 10px}
.det-tab{padding:8px 14px;font-size:11px;color:var(--txt2);cursor:pointer;border-bottom:2px solid transparent}
.det-tab.act{color:var(--cyan);border-bottom-color:var(--cyan)}
.hist-wrap{display:flex;flex-direction:column;width:100%;height:100%}
.hist-content{display:flex;flex:1;overflow:hidden}
.hist-sub-tabs{display:flex;width:100%;background:var(--bg2);border-bottom:1px solid var(--brd);padding:0 16px;flex-shrink:0}
.hist-sub-tab{padding:7px 16px;font-size:11px;font-weight:600;color:var(--txt3);cursor:pointer;border-bottom:2px solid transparent;text-transform:uppercase;letter-spacing:.5px}
.hist-sub-tab:hover{color:var(--txt);background:var(--bg3)}.hist-sub-tab.act{color:var(--cyan);border-bottom-color:var(--cyan)}
.code{flex:1;padding:14px;font-family:var(--font-mono);font-size:11px;line-height:1.5;background:var(--bg);overflow:auto;white-space:pre-wrap;word-break:break-all}
.json-key{color:var(--cyan)}.json-string{color:var(--green)}.json-number{color:var(--orange)}.json-bool{color:var(--purple)}.json-null{color:var(--txt3)}
.flt-bar{display:flex;align-items:center;gap:6px;padding:6px 14px;background:var(--bg3);border-bottom:1px solid var(--brd)}
.flt-in-wrap{flex:1;position:relative}
.flt-in{width:100%;padding:5px 8px;background:var(--bg2);border:1px solid var(--brd);border-radius:4px;color:var(--txt);font-size:11px;font-family:var(--font-mono);outline:none}
.flt-in:focus{border-color:var(--blue)}.flt-in.flt-err{border-color:var(--red);background:rgba(248,81,73,.08)}
.flt-err-msg{position:absolute;top:100%;left:0;margin-top:4px;padding:4px 8px;background:var(--bg2);border:1px solid var(--red);border-radius:4px;font-size:10px;color:var(--red);white-space:nowrap;z-index:100}
.flt-tog{padding:3px 8px;background:var(--bg2);border:1px solid var(--brd);border-radius:4px;font-size:10px;cursor:pointer;user-select:none}.flt-tog.act{background:var(--blue);border-color:var(--blue)}
.flt-preset-dd{position:absolute;top:100%;right:0;margin-top:4px;min-width:300px;background:var(--bg2);border:1px solid var(--brd);border-radius:6px;z-index:200;box-shadow:0 8px 24px rgba(0,0,0,.4);max-height:300px;overflow-y:auto}
.flt-preset-save{display:flex;gap:4px;padding:8px;border-bottom:1px solid var(--brd)}.flt-preset-save .flt-in{flex:1}
.flt-preset-empty{padding:12px;text-align:center;color:var(--txt3);font-size:11px}
.flt-preset-item{display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid var(--brd);cursor:pointer}.flt-preset-item:hover{background:var(--bg3)}
.flt-preset-name-label{font-weight:600;font-size:11px;color:var(--cyan);white-space:nowrap}
.flt-preset-q{flex:1;font-size:10px;color:var(--txt3);font-family:var(--font-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.flt-preset-del{padding:1px 5px!important;font-size:10px!important;min-width:auto}
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--txt3);font-size:13px;gap:6px}.empty-i{font-size:40px;opacity:.3}
.acts{display:flex;gap:6px}
.prj-pnl{padding:24px;max-width:800px;margin:0 auto;width:100%}.prj-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}.prj-hdr h2{font-size:18px}
.new-prj{background:var(--bg2);padding:16px;border-radius:8px;margin-bottom:16px;display:flex;flex-direction:column;gap:10px}
.inp{padding:8px 12px;background:var(--bg3);border:1px solid var(--brd);border-radius:5px;color:var(--txt);font-size:12px;outline:none}.inp:focus{border-color:var(--blue)}
.form-acts{display:flex;gap:10px}.prj-list{display:flex;flex-direction:column;gap:10px}
.prj-card{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:var(--bg2);border:1px solid var(--brd);border-radius:8px;cursor:pointer}
.prj-card:hover{background:var(--bg3);border-color:var(--blue)}.prj-card.cur{border-color:var(--cyan)}
.prj-name{font-weight:600;font-size:14px;margin-bottom:3px}.cur-badge{background:var(--cyan);color:#000;padding:1px 6px;border-radius:3px;font-size:9px;margin-left:6px}
.prj-desc{color:var(--txt2);font-size:12px}.prj-date{color:var(--txt3);font-size:10px;margin-top:3px}
.int-pnl{display:flex;flex-direction:column;width:100%;height:100%}.int-ctrl{display:flex;gap:10px;padding:14px;background:var(--bg2);border-bottom:1px solid var(--brd)}
.int-cnt{display:flex;flex:1;overflow:hidden}.pend-list{flex-shrink:0;border-right:1px solid var(--brd);display:flex;flex-direction:column}
.pend-item{display:flex;gap:10px;padding:10px 14px;border-bottom:1px solid var(--brd);cursor:pointer;align-items:center}
.pend-item:hover{background:var(--bgh)}.pend-item.sel{background:var(--bg3);border-left:3px solid var(--orange)}
.int-edit{flex:1;display:flex;flex-direction:column;overflow:hidden}.ed-row{display:flex;gap:10px;padding:10px 14px;background:var(--bg2);border-bottom:1px solid var(--brd)}
.ed-ta{width:100%;padding:14px;background:var(--bg);border:none;border-bottom:1px solid var(--brd);color:var(--txt);font-family:var(--font-mono);font-size:11px;resize:none;outline:none;overflow:auto;min-height:0}
.ed-ce{flex:1;padding:14px;background:var(--bg);border:none;border-bottom:1px solid var(--brd);color:var(--txt);font-family:var(--font-mono);font-size:11px;line-height:1.5;outline:none;overflow:auto;white-space:pre-wrap;word-break:break-all;tab-size:2}
.overlay-ta::selection{background:rgba(88,166,255,.35)}
.scp-pnl{padding:24px;max-width:700px;margin:0 auto;width:100%}.scp-hdr{margin-bottom:20px}.scp-hdr h3{font-size:16px;margin-bottom:6px}.scp-hdr p{color:var(--txt2);font-size:12px}
.scp-form{display:flex;gap:10px;margin-bottom:20px}.sel{padding:8px 12px;background:var(--bg3);border:1px solid var(--brd);border-radius:5px;color:var(--txt);font-size:12px}
.scp-rules{display:flex;flex-direction:column;gap:6px}.scp-rule{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg2);border:1px solid var(--brd);border-radius:6px}
.scp-rule.dis{opacity:.4}.rul-type{padding:3px 8px;border-radius:3px;font-size:10px;font-weight:600}
.rul-inc{background:rgba(63,185,80,.15);color:var(--green)}.rul-exc{background:rgba(248,81,73,.15);color:var(--red)}
.rul-pat{flex:1;font-family:var(--font-mono);font-size:12px}.rul-acts{display:flex;gap:6px}
.rep-cnt{display:flex;width:100%;height:100%;overflow:hidden}.rep-side{flex-shrink:0;border-right:1px solid var(--brd);display:flex;flex-direction:column;overflow:hidden}
.rep-list{flex:1;overflow-y:auto;overflow-x:hidden}.rep-item{display:flex;gap:6px;padding:10px 14px;border-bottom:1px solid var(--brd);cursor:pointer;align-items:center}
.rep-item:hover{background:var(--bgh)}.rep-item.sel{background:var(--bg3);border-left:3px solid var(--purple)}.rep-item .name{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rep-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}.req-bar{display:flex;gap:10px;padding:10px 14px;background:var(--bg2);border-bottom:1px solid var(--brd);flex-shrink:0}
.mth-sel{padding:6px 10px;background:var(--bg3);border:1px solid var(--brd);border-radius:5px;color:var(--txt);font-family:var(--font-mono);font-size:12px;font-weight:600}
.url-in{flex:1;padding:6px 10px;background:var(--bg3);border:1px solid var(--brd);border-radius:5px;color:var(--txt);font-family:var(--font-mono);font-size:12px;outline:none}
.rep-edit{display:grid;grid-template-columns:1fr 1fr;flex:1;gap:1px;background:var(--brd);overflow:hidden}.ed-pane{display:flex;flex-direction:column;background:var(--bg);overflow:hidden;min-height:0}
.ed-hdr{padding:6px 14px;background:var(--bg2);border-bottom:1px solid var(--brd);font-size:11px;font-weight:500;display:flex;justify-content:space-between;flex-shrink:0}
.git-pnl{padding:24px;max-width:700px;margin:0 auto;width:100%}.git-sec{margin-bottom:20px}
.git-ttl{font-size:13px;font-weight:600;margin-bottom:10px;color:var(--txt2)}.cmt-form{display:flex;gap:10px}
.cmt-in{flex:1;padding:8px 12px;background:var(--bg3);border:1px solid var(--brd);border-radius:5px;color:var(--txt);outline:none}
.cmt-list{background:var(--bg2);border-radius:8px;border:1px solid var(--brd)}.cmt-item{display:flex;gap:14px;padding:12px 14px;border-bottom:1px solid var(--brd);font-family:var(--font-mono);font-size:11px;align-items:center}
.cmt-item:last-child{border-bottom:none}.cmt-hash{color:var(--purple);font-weight:500}.cmt-msg{flex:1}.cmt-date{color:var(--txt3);font-size:10px}
.toast-c{position:fixed;bottom:20px;right:20px;z-index:1000}.toast{padding:10px 18px;background:var(--bg3);border:1px solid var(--brd);border-radius:6px;font-size:12px;margin-top:6px;animation:slideIn .2s}
.toast.success{border-color:var(--green)}.toast.error{border-color:var(--red)}@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:var(--bg)}::-webkit-scrollbar-thumb{background:var(--brd);border-radius:3px}
.context-menu{position:fixed;background:var(--bg2);border:1px solid var(--brd);border-radius:8px;padding:4px;box-shadow:0 8px 24px rgba(0,0,0,0.5);z-index:1000;min-width:180px}
.context-menu-item{padding:8px 12px;font-size:12px;color:var(--txt);cursor:pointer;border-radius:4px;transition:all .15s ease}
.context-menu-item:hover{background:var(--bgh)}
.context-menu-divider{height:1px;background:var(--brd);margin:4px 0}
.chepy-cnt{display:flex;width:100%;height:100%}.chepy-col{display:flex;flex-direction:column;overflow:hidden}
.chepy-in-col{flex-shrink:0;border-right:1px solid var(--brd)}.chepy-recipe-col{flex-shrink:0;border-right:1px solid var(--brd)}.chepy-out-col{flex:1;min-width:0}
.chepy-add{display:flex;flex-direction:column;border-bottom:1px solid var(--brd);max-height:40%}.chepy-ops-list{flex:1;overflow:auto;padding:0 8px 8px}
.chepy-avail-op{padding:5px 10px;font-size:11px;cursor:pointer;border-radius:4px;color:var(--txt2);font-family:var(--font-mono)}.chepy-avail-op:hover{background:var(--bg3);color:var(--cyan)}
.chepy-steps{flex:1;overflow:auto;padding:8px}
.chepy-step{background:var(--bg2);border:1px solid var(--brd);border-radius:6px;margin-bottom:6px}
.chepy-step-hdr{display:flex;align-items:center;gap:8px;padding:8px 10px}
.chepy-step-num{width:20px;height:20px;border-radius:50%;background:var(--purple);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;flex-shrink:0}
.chepy-step-name{flex:1;font-size:12px;font-weight:500}.chepy-step-acts{display:flex;gap:3px}
.chepy-step-params{padding:6px 10px 10px;border-top:1px solid var(--brd);display:flex;flex-direction:column;gap:6px}
.chepy-param{display:flex;align-items:center;gap:8px}.chepy-param-lbl{font-size:10px;color:var(--txt2);min-width:60px}
.ws-cnt{display:flex;width:100%;height:100%}
.ws-conns{flex-shrink:0;border-right:1px solid var(--brd)}.ws-frames{flex-shrink:0;border-right:1px solid var(--brd)}.ws-detail{flex:1;display:flex;flex-direction:column}
.ws-conn-item{padding:10px 14px;border-bottom:1px solid var(--brd);cursor:pointer;font-size:11px}
.ws-conn-item:hover{background:var(--bgh)}.ws-conn-item.sel{background:var(--bg3);border-left:3px solid var(--cyan)}
.ws-conn-url{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-mono);font-size:11px}
.ws-conn-count{font-size:10px;color:var(--txt3)}
.ws-frame-item{display:flex;gap:8px;padding:8px 14px;border-bottom:1px solid var(--brd);cursor:pointer;align-items:center;font-size:11px}
.ws-frame-item:hover{background:var(--bgh)}.ws-frame-item.sel{background:var(--bg3);border-left:3px solid var(--cyan)}
.ws-dir{font-weight:700;font-size:14px;width:20px;text-align:center}.ws-dir-up{color:var(--green)}.ws-dir-down{color:var(--orange)}
.ws-frame-body{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-mono)}
.coll-cnt{display:flex;width:100%;height:100%}
.coll-side{flex-shrink:0;border-right:1px solid var(--brd)}.coll-steps{flex-shrink:0;border-right:1px solid var(--brd)}.coll-exec{flex:1;display:flex;flex-direction:column;min-width:0}
.coll-item{display:flex;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--brd);cursor:pointer;font-size:12px}
.coll-item:hover{background:var(--bgh)}.coll-item.sel{background:var(--bg3);border-left:3px solid var(--purple)}
.coll-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.coll-count{color:var(--txt3);font-size:10px;background:var(--bg);padding:1px 6px;border-radius:8px}
.coll-step-item{display:flex;gap:8px;padding:8px 14px;border-bottom:1px solid var(--brd);align-items:center;font-size:11px;cursor:pointer}
.coll-step-item:hover{background:var(--bgh)}
.coll-step-item.active{background:rgba(88,166,255,.1);border-left:3px solid var(--blue)}
.coll-step-item.done{background:rgba(63,185,80,.05)}.coll-step-item.err{background:rgba(248,81,73,.05)}
.coll-step-num{width:20px;height:20px;border-radius:50%;background:var(--bg3);color:var(--txt2);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;flex-shrink:0}
.coll-step-item.active .coll-step-num{background:var(--blue);color:#fff}
.coll-vars{padding:10px 14px;border-top:1px solid var(--brd);background:var(--bg2)}
.coll-vars-hdr{font-size:10px;color:var(--txt3);font-weight:600;margin-bottom:6px;text-transform:uppercase}
.coll-var{display:flex;gap:8px;font-size:11px;font-family:var(--font-mono);padding:2px 0}
.coll-var-name{color:var(--purple);font-weight:500}.coll-var-val{color:var(--green);flex:1;overflow:hidden;text-overflow:ellipsis}
.coll-extract{display:flex;gap:6px;align-items:center;padding:4px 0;font-size:11px}
.coll-extract-name{color:var(--cyan);font-weight:500}
.coll-pick-item{padding:8px 12px;cursor:pointer;border-radius:4px;font-size:12px;margin-bottom:2px}
.coll-pick-item:hover{background:var(--bgh)}
.cmp-wrap{display:flex;flex:1;overflow:hidden}
.cmp-side{flex:1;display:flex;flex-direction:column;overflow:hidden}
.cmp-side:first-child{border-right:1px solid var(--brd)}
.cmp-body{flex:1;overflow:auto}
.cmp-line{padding:0 10px;line-height:1.6;min-height:1.6em;font-family:var(--font-mono);font-size:11px;white-space:pre-wrap;word-break:break-all}
.cmp-eq{}.cmp-rem{background:rgba(248,81,73,.1);color:var(--red);border-left:3px solid var(--red)}
.cmp-add{background:rgba(63,185,80,.1);color:var(--green);border-left:3px solid var(--green)}
.cmp-blank{opacity:0.15;background:var(--bg3)}
.sm-tree{flex-shrink:0;border-right:1px solid var(--brd);display:flex;flex-direction:column;overflow:hidden}
.sm-right{flex:1;display:flex;flex-direction:column;overflow:hidden}
.sm-node{padding:4px 8px;cursor:pointer;font-size:11px;font-family:var(--font-mono);display:flex;align-items:center;gap:4px;border-left:2px solid transparent;white-space:nowrap}
.sm-node:hover{background:var(--bgh)}.sm-node.sel{background:var(--bg3);border-left-color:var(--cyan)}
.sm-toggle{width:14px;text-align:center;color:var(--txt3);flex-shrink:0;font-size:9px;cursor:pointer}
.sm-label{flex:1;overflow:hidden;text-overflow:ellipsis;color:var(--txt)}
.sm-badge{font-size:9px;background:var(--bg3);color:var(--txt3);padding:1px 6px;border-radius:8px;flex-shrink:0}
.sm-methods{display:flex;gap:2px;flex-shrink:0}
.sm-mth{font-size:8px;padding:1px 4px;border-radius:3px;font-weight:600}
.splash{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px}
.splash .logo-i{width:56px;height:56px;font-size:22px;border-radius:10px}
.splash-spin{width:24px;height:24px;border:2px solid var(--brd);border-top-color:var(--cyan);border-radius:50%;animation:spin .6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.resize-h{width:6px;cursor:col-resize;background:transparent;flex-shrink:0;position:relative;z-index:5;transition:background .15s}
.resize-h:hover,.resize-h.dragging{background:var(--blue)}
.resize-h::after{content:'';position:absolute;top:0;bottom:0;left:2px;width:2px;background:var(--brd);transition:background .15s}
.resize-h:hover::after,.resize-h.dragging::after{background:var(--blue)}
.search-bar{display:flex;align-items:center;gap:6px;padding:4px 10px;background:var(--bg2);border-top:1px solid var(--brd);flex-shrink:0}
.search-bar input{flex:1;padding:4px 8px;background:var(--bg3);border:1px solid var(--brd);border-radius:4px;color:var(--txt);font-size:11px;font-family:var(--font-mono);outline:none;min-width:0}
.search-bar input:focus{border-color:var(--blue)}
.search-info{font-size:10px;color:var(--txt2);white-space:nowrap}
.search-hl{background:rgba(210,153,34,.35);color:inherit;border-radius:2px;padding:0 1px}
.search-cur{background:rgba(88,166,255,.5);outline:1px solid var(--blue)}
.srch-btn{padding:2px 6px;background:var(--bg3);border:1px solid var(--brd);border-radius:3px;color:var(--txt2);cursor:pointer;font-size:10px;line-height:1}
.srch-btn:hover{background:var(--bgh)}.srch-btn.act{background:rgba(57,197,207,.2);border-color:var(--cyan);color:var(--cyan)}
.sens-cnt{display:flex;flex-direction:column;width:100%;height:100%}
.sens-toolbar{display:flex;align-items:center;gap:8px;padding:8px 14px;background:var(--bg2);border-bottom:1px solid var(--brd)}
.sens-filter-bar{display:flex;align-items:center;gap:10px;padding:6px 14px;background:var(--bg2);border-bottom:1px solid var(--brd)}
.sens-results{flex:1;overflow:auto}
.sens-row{display:grid;grid-template-columns:90px 1fr 1fr;gap:10px;padding:8px 14px;border-bottom:1px solid var(--brd);cursor:pointer;align-items:start;font-size:11px}
.sens-row:hover{background:var(--bgh)}.sens-row.sel{background:var(--bg3);border-left:3px solid var(--orange)}
.sens-row-hdr{font-weight:600;font-size:10px;color:var(--txt3);text-transform:uppercase;cursor:default;background:var(--bg2);position:sticky;top:0;z-index:1}
.sens-row-hdr:hover{background:var(--bg2)}
.sens-cat{font-size:9px;padding:2px 6px;border-radius:3px;font-weight:600;text-transform:uppercase;white-space:nowrap}
.sens-match{font-family:var(--font-mono);color:var(--orange);word-break:break-all;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sens-pname{font-weight:500;color:var(--txt)}.sens-purl{color:var(--txt3);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sens-detail{height:40%;border-top:1px solid var(--brd);display:flex;flex-direction:column;overflow:hidden;flex-shrink:0}
.sens-progress{height:3px;background:var(--bg3);border-radius:2px;overflow:hidden}.sens-progress-bar{height:100%;background:var(--cyan);transition:width .3s}
.sens-opt-section{background:var(--bg2);border:1px solid var(--brd);border-radius:8px;padding:14px;margin-bottom:12px}
.sens-pat-row{display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid var(--brd);font-size:11px}
.sens-pat-row:last-child{border-bottom:none}
.sens-section-badge{font-size:8px;padding:1px 4px;border-radius:3px;background:var(--bg3);color:var(--txt3);white-space:nowrap}
.int-cnt{display:flex;flex-direction:column;width:100%;height:100%}
.int-positions{flex:1;display:flex;flex-direction:column;overflow:auto;padding:14px;gap:10px}
.int-editor{font-family:var(--font-mono);font-size:12px;background:var(--bg);border:1px solid var(--brd);border-radius:6px;padding:10px;resize:vertical;min-height:80px;color:var(--txt);width:100%;box-sizing:border-box}
.hdr-key{color:var(--cyan);font-weight:500}
.hdr-sep{color:var(--txt3)}
.hdr-val{color:var(--orange)}
.hdr-wrap{position:relative;width:100%;display:flex;flex-direction:column}
.hdr-highlight{position:absolute;top:0;left:0;right:0;bottom:0;margin:0;border:1px solid transparent;white-space:pre-wrap;word-wrap:break-word;overflow:hidden;pointer-events:none;box-sizing:border-box}
.hdr-ta{background:transparent!important;color:transparent!important;caret-color:var(--txt);position:relative;z-index:1;flex:1}
.int-payloads{flex:1;overflow:auto;padding:14px}
.int-resource{flex:1;overflow:auto;padding:14px}
.int-results-cnt{flex:1;display:flex;flex-direction:column;overflow:hidden}
.int-results{flex:1;overflow:auto}
.int-row{display:grid;grid-template-columns:50px 1fr 70px 80px 70px 1fr;gap:8px;padding:6px 14px;border-bottom:1px solid var(--brd);cursor:pointer;align-items:center;font-size:11px}
.int-row:hover{background:var(--bgh)}.int-row.sel{background:var(--bg3);border-left:3px solid var(--cyan)}
.int-row-hdr{font-weight:600;font-size:10px;color:var(--txt3);text-transform:uppercase;cursor:pointer;background:var(--bg2);position:sticky;top:0;z-index:1}
.int-row-hdr:hover{background:var(--bg2)}
.int-status{font-weight:600;font-family:var(--font-mono)}
.int-status.s2{color:var(--green)}.int-status.s3{color:var(--cyan)}.int-status.s4{color:var(--orange)}.int-status.s5{color:var(--red)}
.int-payload-txt{font-family:var(--font-mono);color:var(--cyan);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.int-detail{height:40%;border-top:1px solid var(--brd);display:flex;flex-direction:column;overflow:hidden;flex-shrink:0}
.int-progress{height:3px;background:var(--bg3);border-radius:2px;overflow:hidden}.int-progress-bar{height:100%;background:var(--cyan);transition:width .3s}
.int-section{background:var(--bg2);border:1px solid var(--brd);border-radius:8px;padding:14px;margin-bottom:12px}
.int-section h4{margin:0 0 10px 0;font-size:12px;color:var(--txt2)}
.int-stats{display:flex;gap:16px;align-items:center;font-size:11px;color:var(--txt3)}
.int-pos-tag{display:inline-flex;align-items:center;gap:4px;font-size:10px;padding:2px 8px;background:var(--bg3);border:1px solid var(--brd);border-radius:4px;color:var(--orange);font-family:var(--font-mono)}
      `},} )

      , !appReady ? (
        React.createElement('div', { className: "splash",}
          , React.createElement('div', { className: "logo-i",}, "BW")
          , React.createElement('span', { className: "logo-t",}, "Blackwire")
          , React.createElement('div', { className: "splash-spin",} )
        )
      ) : (
      React.createElement(React.Fragment, null
      , React.createElement('header', { className: "hdr",}
        , React.createElement('div', { className: "logo",}
          , React.createElement('div', { className: "logo-i",}, "BW")
          , React.createElement('span', { className: "logo-t",}, "Blackwire")
          , curPrj && React.createElement('span', { className: "prj-badge",}, curPrj)
        )
        , React.createElement('div', { className: "hdr-ctrl",}
          , React.createElement('select', { className: "sel", value: themeId, onChange: e => setThemeId(e.target.value), title: "Theme",}
            , Object.entries(THEMES).map(([id, t]) => (
              React.createElement('option', { key: id, value: id,}, t.label)
            ))
          )
          , curPrj && (
            React.createElement(React.Fragment, null
              , React.createElement('div', { className: 'int-tog' + (intOn ? ' on' : ''), onClick: togInt,}
                , React.createElement('span', { className: "int-dot",}), "Intercept "
                 , intOn ? 'ON' : 'OFF'
                , pending.length > 0 && React.createElement('span', { className: "pend-badge",}, pending.length)
              )
              , React.createElement('div', { className: "prx-st", onClick: () => setShowProxyCfg(true), style: { cursor: 'pointer' }, title: 'Mode: ' + pxMode + (pxArgs ? ' | Args: ' + pxArgs : ''),}
                , React.createElement('div', { className: 'st-dot ' + (pxRun ? 'run' : 'stop'),})
                , pxRun ? pxMode + ' :' + pxPort : 'Stopped'
              )
              , !pxRun ? (
                React.createElement('button', { className: "btn btn-g" , onClick: startPx, disabled: loading,}, "▶ Start" )
              ) : (
                React.createElement('button', { className: "btn btn-d" , onClick: stopPx,}, "■ Stop" )
              )
              , React.createElement('button', { className: "btn btn-s" , onClick: launchBr, disabled: !pxRun,}, "🌐")
            )
          )
          , React.createElement('button', { className: "btn btn-sm btn-s"  , title: "Shutdown server" , onClick: () => { if (confirm('Shut down Blackwire server?')) api.post('/api/shutdown'); }, style: { marginLeft: '4px', color: 'var(--red)', fontSize: '14px', padding: '4px 8px' },}, "⏻")
        )
      )

      , React.createElement('nav', { className: "tabs",}
        , React.createElement('div', { className: 'tab' + (tab === 'projects' ? ' act' : ''), onClick: () => setTab('projects'),}, "Projects")
        , curPrj && (
          React.createElement(React.Fragment, null
            , React.createElement('div', { className: 'tab' + (tab === 'scope' ? ' act' : ''), onClick: () => setTab('scope'),}, "Scope")
            , React.createElement('div', { className: 'tab' + (tab === 'history' ? ' act' : ''), onClick: () => setTab('history'),}, "History")
            , React.createElement('div', { className: 'tab' + (tab === 'collections' ? ' act' : ''), onClick: () => { setTab('collections'); loadColls(); },}, "Collections")
            , React.createElement('div', { className: 'tab' + (tab === 'repeater' ? ' act' : ''), onClick: () => setTab('repeater'),}, "Repeater")
            , React.createElement('div', { className: 'tab' + (tab === 'intruder' ? ' act' : ''), onClick: () => setTab('intruder'),}, "Intruder")
            , React.createElement('div', { className: 'tab' + (tab === 'git' ? ' act' : ''), onClick: () => setTab('git'),}, "Git")
            , React.createElement('div', { className: 'tab' + (tab === 'chepy' ? ' act' : ''), onClick: () => setTab('chepy'),}, "Cipher")
            , React.createElement('div', { className: 'tab' + (tab === 'compare' ? ' act' : ''), onClick: () => setTab('compare'),}, "Compare")
            , React.createElement('div', { className: 'tab' + (tab === 'sensitive' ? ' act' : ''), onClick: () => setTab('sensitive'),}, "Sensitive")
            , React.createElement('div', { className: 'tab' + (tab === 'extensions' ? ' act' : ''), onClick: () => setTab('extensions'),}, "Extensions")
          )
        )
      )

      , React.createElement('main', { className: "main",}
        , tab === 'projects' && (
          React.createElement('div', { className: "prj-pnl",}
            , React.createElement('div', { className: "prj-hdr",}
              , React.createElement('h2', null, "Projects")
              , React.createElement('button', { className: "btn btn-p" , onClick: () => setShowNew(true),}, "+ New" )
            )
            , showNew && (
              React.createElement('div', { className: "new-prj",}
                , React.createElement('input', { className: "inp", placeholder: "Project name" , value: newName, onChange: e => setNewName(e.target.value),} )
                , React.createElement('input', { className: "inp", placeholder: "Description", value: newDesc, onChange: e => setNewDesc(e.target.value),} )
                , React.createElement('div', { className: "form-acts",}
                  , React.createElement('button', { className: "btn btn-p" , onClick: createPrj,}, "Create")
                  , React.createElement('button', { className: "btn btn-s" , onClick: () => setShowNew(false),}, "Cancel")
                )
              )
            )
            , React.createElement('div', { className: "prj-list",}
              , prjs.map(p => (
                React.createElement('div', { key: p.name, className: 'prj-card' + (p.is_current ? ' cur' : ''), onClick: () => selectPrj(p.name),}
                  , React.createElement('div', null
                    , React.createElement('div', { className: "prj-name",}
                      , p.name
                      , p.is_current && React.createElement('span', { className: "cur-badge",}, "ACTIVE")
                    )
                    , React.createElement('div', { className: "prj-desc",}, p.description || 'No description')
                    , React.createElement('div', { className: "prj-date",}, p.created_at ? new Date(p.created_at).toLocaleDateString() : '')
                  )
                  , React.createElement('div', { onClick: e => e.stopPropagation(),}
                    , React.createElement('button', { className: "btn btn-sm btn-d"  , onClick: () => delPrj(p.name),}, "🗑")
                  )
                )
              ))
              , prjs.length === 0 && (
                React.createElement('div', { className: "empty",}
                  , React.createElement('div', { className: "empty-i",})
                  , React.createElement('span', null, "No projects" )
                )
              )
            )
          )
        )

        , tab === 'history' && curPrj && (
          React.createElement('div', { className: "hist-wrap",}
            , React.createElement('div', { className: "hist-sub-tabs",}
              , React.createElement('div', { className: 'hist-sub-tab' + (histSubTab === 'http' ? ' act' : ''), onClick: () => setHistSubTab('http'),}, "HTTP")
              , React.createElement('div', { className: 'hist-sub-tab' + (histSubTab === 'ws' ? ' act' : ''), onClick: () => { setHistSubTab('ws'); loadWsConns(); },}, "WebSocket")
              , React.createElement('div', { className: 'hist-sub-tab' + (histSubTab === 'sitemap' ? ' act' : ''), onClick: () => setHistSubTab('sitemap'),}, "Site Map" )
            )

            , histSubTab === 'http' && (
              React.createElement('div', { className: "hist-content", ref: histContentRef,}
                , React.createElement('div', { className: "panel hist-pnl" , style: { width: histPanelW + '%' },}
                  , React.createElement('div', { className: "flt-bar",}
                    , React.createElement('div', { className: "flt-in-wrap",}
                      , React.createElement('input', { className: 'flt-in' + (httpqlError ? ' flt-err' : ''), placeholder: "Filter: req.method.eq:\"GET\" AND resp.code.lt:400"   , value: search, onChange: e => setSearch(e.target.value),} )
                      , httpqlError && React.createElement('div', { className: "flt-err-msg",}, httpqlError)
                    )
                    , React.createElement('div', { className: "flt-preset-wrap", style: {position:'relative'},}
                      , React.createElement('div', { className: "flt-tog", onClick: () => setShowPresets(!showPresets), title: "Filter presets" ,}, "▼")
                      , showPresets && (
                        React.createElement('div', { className: "flt-preset-dd",}
                          , React.createElement('div', { className: "flt-preset-save",}
                            , React.createElement('input', { className: "flt-in flt-preset-name" , placeholder: "Preset name..." , value: presetName, onChange: e => setPresetName(e.target.value), onKeyDown: e => e.key === 'Enter' && savePreset(),} )
                            , React.createElement('button', { className: "btn btn-sm btn-p"  , onClick: savePreset, disabled: !presetName.trim() || !search.trim(),}, "Save")
                          )
                          , presets.length === 0 && React.createElement('div', { className: "flt-preset-empty",}, "No presets saved"  )
                          , presets.map(p => (
                            React.createElement('div', { key: p.id, className: "flt-preset-item",}
                              , React.createElement('span', { className: "flt-preset-name-label", onClick: () => applyPreset(p), title: p.query,}, p.name)
                              , React.createElement('span', { className: "flt-preset-q",}, p.query)
                              , React.createElement('button', { className: "btn btn-sm btn-d flt-preset-del"   , onClick: () => delPreset(p.id),}, "×")
                            )
                          ))
                        )
                      )
                    )
                    , React.createElement('div', { className: 'flt-tog' + (scopeOnly ? ' act' : ''), onClick: () => setScopeOnly(!scopeOnly),}, "Scope")
                    , React.createElement('div', { className: 'flt-tog' + (savedOnly ? ' act' : ''), onClick: () => setSavedOnly(!savedOnly),}, "★")
                  )
                  , React.createElement('div', { className: "pnl-hdr",}
                    , React.createElement('span', null, filtered.length, " requests" )
                    , React.createElement('div', { className: "acts",}
                      , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: loadReqs,}, "↻")
                      , React.createElement('button', { className: "btn btn-sm btn-d"  , onClick: clearHist,}, "Clear")
                    )
                  )
                  , React.createElement('div', { className: "pnl-cnt",}
                    , React.createElement('div', { className: "req-list",}
                      , filtered.map(r => (
                        React.createElement('div', {
                          key: r.id,
                          className: 'req-item' + (_optionalChain([selReq, 'optionalAccess', _55 => _55.id]) === r.id ? ' sel' : '') + (!r.in_scope ? ' out' : ''),
                          onClick: () => setSelReq(r),
                          onContextMenu: e => showContextMenu(e, r),}

                          , React.createElement('span', { className: 'mth mth-' + r.method,}, r.method)
                          , React.createElement('span', { className: "url", title: r.url,}, r.url)
                          , React.createElement('span', { className: 'sts ' + stCls(r.response_status),}, r.response_status || '-')
                          , React.createElement('span', { className: "ts",}, fmtTime(r.timestamp))
                        )
                      ))
                      , filtered.length === 0 && (
                        React.createElement('div', { className: "empty",}
                          , React.createElement('div', { className: "empty-i",}, "📭")
                          , React.createElement('span', null, "No requests" )
                        )
                      )
                    )
                  )
                )

                , React.createElement(ResizeHandle, { onDrag: (dx) => {
                  const el = histContentRef.current;
                  if (!el) return;
                  const dpct = (dx / el.offsetWidth) * 100;
                  setHistPanelW(prev => Math.max(20, Math.min(80, prev + dpct)));
                },} )

                , React.createElement('div', { className: "panel det-pnl" ,}
                  , selReq ? (
                    React.createElement(React.Fragment, null
                      , React.createElement('div', { className: "pnl-hdr",}
                        , React.createElement('span', null, selReq.method, " " , selReq.url.substring(0, 50))
                        , React.createElement('div', { className: "acts",}
                          , React.createElement('button', { className: "btn btn-sm btn-p"  , onClick: () => selReqFull && toRep(selReqFull), disabled: !selReqFull,}, "→ Rep" )
                          , React.createElement('button', { className: 'btn btn-sm ' + (selReq.saved ? 'btn-g' : 'btn-s'), onClick: () => togSave(selReq.id),}
                            , selReq.saved ? '★' : '☆'
                          )
                          , React.createElement('button', { className: "btn btn-sm btn-d"  , onClick: () => delReq(selReq.id),}, "🗑")
                        )
                      )
                      , React.createElement('div', { className: "det-tabs",}
                        , React.createElement('div', { className: 'det-tab' + (detTab === 'request' ? ' act' : ''), onClick: () => setDetTab('request'),}, "Request")
                        , React.createElement('div', { className: 'det-tab' + (detTab === 'response' ? ' act' : ''), onClick: () => setDetTab('response'),}, "Response")
                        , React.createElement('div', { style: { marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' },}
                          , React.createElement('button', { className: 'btn btn-sm ' + (detTab === 'request' ? (reqFormat === 'raw' ? 'btn-p' : 'btn-s') : (respFormat === 'raw' ? 'btn-p' : 'btn-s')), onClick: () => detTab === 'request' ? setReqFormat('raw') : setRespFormat('raw'),}, "Raw"

                          )
                          , React.createElement('button', { className: 'btn btn-sm ' + (detTab === 'request' ? (reqFormat === 'pretty' ? 'btn-p' : 'btn-s') : (respFormat === 'pretty' ? 'btn-p' : 'btn-s')), onClick: () => detTab === 'request' ? setReqFormat('pretty') : setRespFormat('pretty'),}, "Pretty"

                          )
                        )
                      )
                      , !selReqFull ? (
                        React.createElement('div', { className: "empty",}, React.createElement('div', { className: "splash-spin", style: {margin:'20px auto'},} ))
                      ) : (
                      React.createElement('div', { className: "code", ref: histCodeRef,}
                        , (() => {
                          const d = selReqFull;
                          const reqFormatted = d.body ? formatBody(d.body, reqFormat) : { text: '', html: false };
                          const respFormatted = formatBody(d.response_body || '', respFormat);
                          const rawContent = detTab === 'request'
                            ? (escapeHtml(d.method + ' ' + (() => {
                                try { return new URL(d.url).pathname; } catch (e) { return d.url; }
                              })()) + '\n\n' + fmtHHtml(d.headers, d.url) + (d.body ? '\n\n' + (reqFormatted.html ? reqFormatted.text : escapeHtml(reqFormatted.text)) : ''))
                            : (escapeHtml('HTTP ' + d.response_status) + '\n\n' + fmtHHtml(d.response_headers) + '\n\n' + (respFormatted.html ? respFormatted.text : escapeHtml(respFormatted.text)));
                          if (histBodySearch) {
                            const plainText = rawContent.replace(/<[^>]*>/g, '');
                            const hl = highlightMatches(plainText, histBodySearch, histBodySearchRegex, histBodySearchIdx);
                            if (hl.count !== histBodySearchCount) setTimeout(() => setHistBodySearchCount(hl.count), 0);
                            return React.createElement('div', { dangerouslySetInnerHTML: { __html: hl.html },} );
                          }
                          return React.createElement('div', { dangerouslySetInnerHTML: { __html: rawContent },} );
                        })()
                      )
                      )
                      , React.createElement('div', { className: "search-bar", style: { borderTop: '1px solid var(--brd)' },}
                        , React.createElement('input', {
                          placeholder: histBodySearchRegex ? 'Regex search...' : 'Search body...',
                          value: histBodySearch,
                          onChange: e => { setHistBodySearch(e.target.value); setHistBodySearchIdx(0); },
                          onKeyDown: e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setHistBodySearchIdx(i => histBodySearchCount > 0 ? (i + 1) % histBodySearchCount : 0); }
                            if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); setHistBodySearchIdx(i => histBodySearchCount > 0 ? (i - 1 + histBodySearchCount) % histBodySearchCount : 0); }
                            if (e.key === 'Escape') { setHistBodySearch(''); setHistBodySearchIdx(0); setHistBodySearchCount(0); }
                          },}
                        )
                        , React.createElement('button', { className: 'srch-btn' + (histBodySearchRegex ? ' act' : ''), onClick: () => { setHistBodySearchRegex(!histBodySearchRegex); setHistBodySearchIdx(0); }, title: "Toggle regex" ,}, ".*")
                        , React.createElement('span', { className: "search-info",}, histBodySearchCount > 0 ? (histBodySearchIdx + 1) + '/' + histBodySearchCount : '0/0')
                        , React.createElement('button', { className: "srch-btn", onClick: () => setHistBodySearchIdx(i => histBodySearchCount > 0 ? (i - 1 + histBodySearchCount) % histBodySearchCount : 0), disabled: histBodySearchCount === 0,}, "▲")
                        , React.createElement('button', { className: "srch-btn", onClick: () => setHistBodySearchIdx(i => histBodySearchCount > 0 ? (i + 1) % histBodySearchCount : 0), disabled: histBodySearchCount === 0,}, "▼")
                        , React.createElement('button', { className: "srch-btn", onClick: () => { setHistBodySearch(''); setHistBodySearchIdx(0); setHistBodySearchCount(0); },}, "✕")
                      )
                    )
                  ) : (
                    React.createElement('div', { className: "empty",}
                      , React.createElement('span', null, "Select request" )
                    )
                  )
                )
              )
            )

            , histSubTab === 'ws' && (
              React.createElement('div', { className: "ws-cnt",}
                , React.createElement('div', { className: "ws-conns panel" , style: { width: wsConnsW + 'px' },}
                  , React.createElement('div', { className: "pnl-hdr",}
                    , React.createElement('span', null, "Connections (" , wsConns.length, ")")
                    , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: loadWsConns,}, "↻")
                  )
                  , React.createElement('div', { className: "pnl-cnt",}
                    , wsConns.map(c => (
                      React.createElement('div', { key: c.url, className: 'ws-conn-item' + (selWsConn === c.url ? ' sel' : ''),
                           onClick: () => loadWsFrames(c.url),}
                        , React.createElement('span', { className: "ws-conn-url",}, c.url)
                        , React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: '4px' },}
                          , React.createElement('span', { className: "ws-conn-count",}, c.frame_count, " frames" )
                          , React.createElement('span', { className: "ts",}, fmtTime(c.last_seen))
                        )
                      )
                    ))
                    , wsConns.length === 0 && (
                      React.createElement('div', { className: "empty", style: { padding: 30 },}
                        , React.createElement('span', null, "No WebSocket connections captured"   )
                      )
                    )
                  )
                )
                , React.createElement(ResizeHandle, { onDrag: (dx) => setWsConnsW(w => Math.max(120, Math.min(400, w + dx))),} )
                , React.createElement('div', { className: "ws-frames panel" , style: { width: wsFramesW + 'px' },}
                  , React.createElement('div', { className: "pnl-hdr",}
                    , React.createElement('span', null, "Frames " , selWsConn ? '(' + wsFrames.length + ')' : '')
                  )
                  , React.createElement('div', { className: "pnl-cnt",}
                    , wsFrames.map(f => (
                      React.createElement('div', { key: f.id, className: 'ws-frame-item' + (_optionalChain([selWsFrame, 'optionalAccess', _56 => _56.id]) === f.id ? ' sel' : ''),
                           onClick: () => selectWsFrame(f),
                           onContextMenu: e => showContextMenu(e, { ...f, url: selWsConn, method: 'WS', body: f.content }, 'websocket'),}
                        , React.createElement('span', { className: 'ws-dir ws-dir-' + f.direction,}
                          , f.direction === 'up' ? '\u2191' : '\u2193'
                        )
                        , React.createElement('span', { className: "ws-frame-body",}, (f.content || '').substring(0, 80))
                        , React.createElement('span', { className: "ts",}, fmtTime(f.timestamp))
                      )
                    ))
                    , selWsConn && wsFrames.length === 0 && (
                      React.createElement('div', { className: "empty", style: { padding: 30 },}, React.createElement('span', null, "No frames" ))
                    )
                    , !selWsConn && (
                      React.createElement('div', { className: "empty", style: { padding: 30 },}, React.createElement('span', null, "Select a connection"  ))
                    )
                  )
                )
                , React.createElement(ResizeHandle, { onDrag: (dx) => setWsFramesW(w => Math.max(150, Math.min(500, w + dx))),} )
                , React.createElement('div', { className: "ws-detail panel" ,}
                  , selWsFrame ? (
                    React.createElement(React.Fragment, null
                      , React.createElement('div', { className: "pnl-hdr",}
                        , React.createElement('span', null, selWsFrame.direction === 'up' ? 'Client \u2192 Server' : 'Server \u2192 Client')
                        , React.createElement('span', { className: "ts",}, fmtTime(selWsFrame.timestamp))
                      )
                      , React.createElement('div', { className: "code", style: { maxHeight: '40%', borderBottom: '1px solid var(--brd)' },}, selWsFrame.content)
                      , React.createElement('div', { className: "pnl-hdr",}, React.createElement('span', null, "Resend Frame" ))
                      , React.createElement('textarea', { className: "ed-ta", style: { flex: 1 }, value: wsResendMsg,
                                onChange: e => setWsResendMsg(e.target.value), placeholder: "Edit frame content..."  ,} )
                      , React.createElement('div', { style: { padding: '10px 14px', display: 'flex', gap: '10px', background: 'var(--bg2)', borderTop: '1px solid var(--brd)' },}
                        , React.createElement('button', { className: "btn btn-p" , onClick: resendWsFrame,
                                disabled: wsSending || !wsResendMsg,}
                          , wsSending ? '...' : '\u25B6 Resend'
                        )
                      )
                      , wsResendResp && (
                        React.createElement('div', { className: "code", style: { maxHeight: '30%', borderTop: '1px solid var(--brd)' },}
                          , wsResendResp.error
                            ? 'Error: ' + wsResendResp.error
                            : wsResendResp.response
                              ? 'Response: ' + wsResendResp.response
                              : wsResendResp.note || 'Sent (no response)'
                        )
                      )
                    )
                  ) : (
                    React.createElement('div', { className: "empty",}, React.createElement('span', null, "Select a frame"  ))
                  )
                )
              )
            )

            , histSubTab === 'sitemap' && (
              React.createElement('div', { className: "hist-content", ref: smContentRef,}
                , React.createElement('div', { className: "panel sm-tree" , style: { width: smTreeW + '%' },}
                  , React.createElement('div', { className: "pnl-hdr",}
                    , React.createElement('span', null, Object.keys(siteTree).length, " hosts" )
                    , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => { setSmExpanded({}); setSmSelNode(null); },}, "Collapse All" )
                  )
                  , React.createElement('div', { className: "pnl-cnt",}
                    , Object.keys(siteTree).length === 0 ? (
                      React.createElement('div', { className: "empty",}
                        , React.createElement('div', { className: "empty-i",}, "🌐")
                        , React.createElement('span', null, "No requests captured"  )
                      )
                    ) : (
                      Object.entries(siteTree)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([origin, node]) => renderTreeNode(origin, node, 0, ''))
                    )
                  )
                )
                , React.createElement(ResizeHandle, { onDrag: (dx) => {
                  const el = smContentRef.current;
                  if (!el) return;
                  const dpct = (dx / el.offsetWidth) * 100;
                  setSmTreeW(prev => Math.max(15, Math.min(70, prev + dpct)));
                },} )
                , React.createElement('div', { className: "sm-right",}
                  , React.createElement('div', { className: "panel", style: { flex: smSelNode && selReq ? 1 : 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },}
                    , React.createElement('div', { className: "pnl-hdr",}
                      , React.createElement('span', null, smSelNode ? smNodeReqs.length + ' requests' : 'Select a node')
                    )
                    , React.createElement('div', { className: "pnl-cnt",}
                      , smSelNode ? (
                        React.createElement('div', { className: "req-list",}
                          , smNodeReqs.map(r => (
                            React.createElement('div', {
                              key: r.id,
                              className: 'req-item' + (_optionalChain([selReq, 'optionalAccess', _57 => _57.id]) === r.id ? ' sel' : '') + (!r.in_scope ? ' out' : ''),
                              onClick: () => setSelReq(r),
                              onContextMenu: e => showContextMenu(e, r),}

                              , React.createElement('span', { className: 'mth mth-' + r.method,}, r.method)
                              , React.createElement('span', { className: "url", title: r.url,}, r.url)
                              , React.createElement('span', { className: 'sts ' + stCls(r.response_status),}, r.response_status || '-')
                              , React.createElement('span', { className: "ts",}, fmtTime(r.timestamp))
                            )
                          ))
                        )
                      ) : (
                        React.createElement('div', { className: "empty",}, React.createElement('span', null, "Click a node in the tree"     ))
                      )
                    )
                  )
                  , selReq && smSelNode && (
                    React.createElement('div', { className: "panel", style: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--brd)' },}
                      , React.createElement('div', { className: "pnl-hdr",}
                        , React.createElement('span', null, selReq.method, " " , selReq.url.substring(0, 60))
                        , React.createElement('div', { className: "acts",}
                          , React.createElement('button', { className: "btn btn-sm btn-p"  , onClick: () => selReqFull && toRep(selReqFull), disabled: !selReqFull,}, "→ Rep" )
                        )
                      )
                      , React.createElement('div', { className: "det-tabs",}
                        , React.createElement('div', { className: 'det-tab' + (detTab === 'request' ? ' act' : ''), onClick: () => setDetTab('request'),}, "Request")
                        , React.createElement('div', { className: 'det-tab' + (detTab === 'response' ? ' act' : ''), onClick: () => setDetTab('response'),}, "Response")
                        , React.createElement('div', { style: { marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' },}
                          , React.createElement('button', { className: 'btn btn-sm ' + (detTab === 'request' ? (reqFormat === 'raw' ? 'btn-p' : 'btn-s') : (respFormat === 'raw' ? 'btn-p' : 'btn-s')), onClick: () => detTab === 'request' ? setReqFormat('raw') : setRespFormat('raw'),}, "Raw")
                          , React.createElement('button', { className: 'btn btn-sm ' + (detTab === 'request' ? (reqFormat === 'pretty' ? 'btn-p' : 'btn-s') : (respFormat === 'pretty' ? 'btn-p' : 'btn-s')), onClick: () => detTab === 'request' ? setReqFormat('pretty') : setRespFormat('pretty'),}, "Pretty")
                        )
                      )
                      , !selReqFull ? (
                        React.createElement('div', { className: "empty",}, React.createElement('div', { className: "splash-spin", style: {margin:'20px auto'},} ))
                      ) : (
                      React.createElement('div', { className: "code",}
                        , (() => {
                          const d = selReqFull;
                          const reqF = d.body ? formatBody(d.body, reqFormat) : { text: '', html: false };
                          const resF = formatBody(d.response_body || '', respFormat);
                          const ct = detTab === 'request'
                            ? (escapeHtml(d.method + ' ' + (() => { try { return new URL(d.url).pathname; } catch (e) { return d.url; } })()) + '\n\n' + fmtHHtml(d.headers, d.url) + (d.body ? '\n\n' + (reqF.html ? reqF.text : escapeHtml(reqF.text)) : ''))
                            : (escapeHtml('HTTP ' + d.response_status) + '\n\n' + fmtHHtml(d.response_headers) + '\n\n' + (resF.html ? resF.text : escapeHtml(resF.text)));
                          return React.createElement('div', { dangerouslySetInnerHTML: { __html: ct },} );
                        })()
                      )
                      )
                    )
                  )
                )
              )
            )
          )
        )

        , tab === 'intercept' && curPrj && (
          React.createElement('div', { className: "int-pnl",}
            , React.createElement('div', { className: "int-ctrl",}
              , React.createElement('button', { className: 'btn btn-lg ' + (intOn ? 'btn-d' : 'btn-g'), onClick: togInt,}
                , intOn ? '🔴 ON' : '⚪ OFF'
              )
              , pending.length > 0 && (
                React.createElement(React.Fragment, null
                  , React.createElement('button', { className: "btn btn-p" , onClick: fwdAll,}, "▶ Forward All ("   , pending.length, ")")
                  , React.createElement('button', { className: "btn btn-d" , onClick: dropAll,}, "✕ Drop All"  )
                )
              )
            )
            , React.createElement('div', { className: "int-cnt",}
              , React.createElement('div', { className: "pend-list", style: { width: intPendW + 'px' },}
                , React.createElement('div', { className: "pnl-hdr",}
                  , React.createElement('span', null, "Pending (" , pending.length, ")")
                )
                , pending.map(r => (
                  React.createElement('div', { key: r.id, className: 'pend-item' + (_optionalChain([selPend, 'optionalAccess', _58 => _58.id]) === r.id ? ' sel' : ''), onClick: () => { setSelPend(r); setEditReq({ ...r }); },
                       onContextMenu: e => showContextMenu(e, r, 'intercept'),}
                    , React.createElement('span', { className: 'mth mth-' + r.method,}, r.method)
                    , React.createElement('span', { className: "url",}, r.url)
                  )
                ))
                , pending.length === 0 && (
                  React.createElement('div', { className: "empty", style: { padding: 30 },}
                    , React.createElement('span', null, intOn ? 'Waiting...' : 'Enable intercept')
                  )
                )
              )
              , React.createElement(ResizeHandle, { onDrag: (dx) => setIntPendW(w => Math.max(150, Math.min(500, w + dx))),} )
              , React.createElement('div', { className: "int-edit",}
                , selPend && editReq ? (
                  React.createElement(React.Fragment, null
                    , React.createElement('div', { className: "pnl-hdr", onContextMenu: e => showContextMenu(e, editReq, 'intercept'),}
                      , React.createElement('span', null, "Edit")
                      , React.createElement('div', { className: "acts",}
                        , React.createElement('button', { className: "btn btn-g" , onClick: () => fwdReq(selPend.id, editReq),}, "▶ Forward" )
                        , React.createElement('button', { className: "btn btn-d" , onClick: () => dropReq(selPend.id),}, "✕ Drop" )
                      )
                    )
                    , React.createElement('div', { className: "ed-row",}
                      , React.createElement('select', { className: "mth-sel", value: editReq.method, onChange: e => setEditReq({ ...editReq, method: e.target.value }),}
                        , React.createElement('option', null, "GET")
                        , React.createElement('option', null, "POST")
                        , React.createElement('option', null, "PUT")
                        , React.createElement('option', null, "DELETE")
                      )
                      , React.createElement('input', { className: "url-in", value: editReq.url, onChange: e => setEditReq({ ...editReq, url: e.target.value }),} )
                    )
                    , React.createElement('textarea', { className: "ed-ta", placeholder: "Headers", style: { height: '30%' }, value: fmtH(editReq.headers, editReq.url), onChange: e => {
                      const h = {};
                      e.target.value.split('\n').forEach(l => {
                        const [k, ...v] = l.split(':');
                        if (k && v.length) h[k.trim()] = v.join(':').trim();
                      });
                      setEditReq({ ...editReq, headers: h });
                    },} )
                    , React.createElement('textarea', { className: "ed-ta", placeholder: "Body", style: { flex: 1 }, value: editReq.body || '', onChange: e => setEditReq({ ...editReq, body: e.target.value }),} )
                  )
                ) : (
                  React.createElement('div', { className: "empty",}
                    , React.createElement('span', null, "Select pending request"  )
                  )
                )
              )
            )
          )
        )

        , tab === 'scope' && curPrj && (
          React.createElement('div', { className: "scp-pnl",}
            , React.createElement('div', { className: "scp-hdr",}
              , React.createElement('h3', null, "Scope Rules" )
              , React.createElement('p', null, "Define which hosts are in scope"     )
            )
            , React.createElement('div', { className: "scp-form",}
              , React.createElement('input', { className: "inp", style: { flex: 1 }, placeholder: "Pattern: *.example.com" , value: newPat, onChange: e => setNewPat(e.target.value),} )
              , React.createElement('select', { className: "sel", value: newType, onChange: e => setNewType(e.target.value),}
                , React.createElement('option', { value: "include",}, "Include")
                , React.createElement('option', { value: "exclude",}, "Exclude")
              )
              , React.createElement('button', { className: "btn btn-p" , onClick: addRule,}, "+ Add" )
            )
            , React.createElement('div', { className: "scp-rules",}
              , scopeRules.map(r => (
                React.createElement('div', { key: r.id, className: 'scp-rule' + (r.enabled ? '' : ' dis'),}
                  , React.createElement('span', { className: 'rul-type rul-' + (r.rule_type === 'include' ? 'inc' : 'exc'),}, r.rule_type)
                  , React.createElement('span', { className: "rul-pat",}, r.pattern)
                  , React.createElement('div', { className: "rul-acts",}
                    , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => togRule(r.id),}, r.enabled ? 'Disable' : 'Enable')
                    , React.createElement('button', { className: "btn btn-sm btn-d"  , onClick: () => delRule(r.id),}, "🗑")
                  )
                )
              ))
              , scopeRules.length === 0 && (
                React.createElement('div', { className: "empty", style: { padding: 30 },}
                  , React.createElement('span', null, "No rules - all in scope"     )
                )
              )
            )
          )
        )

        , tab === 'repeater' && curPrj && (
          React.createElement('div', { className: "rep-cnt", ref: repCntRef,}
            , React.createElement('div', { className: "rep-side", style: { width: repSideW + 'px' },}
              , React.createElement('div', { className: "pnl-hdr",}
                , React.createElement('span', null, "Saved")
                , React.createElement('button', { className: "btn btn-sm btn-p"  , onClick: saveRep,}, "+")
              )
              , React.createElement('div', { className: "rep-list",}
                , repReqs.map(r => (
                  React.createElement('div', { key: r.id, className: 'rep-item' + (selRep === r.id ? ' sel' : ''), onClick: () => loadRepItem(r),
                    onContextMenu: e => showContextMenu(e, r, 'repeater'),}
                    , React.createElement('span', { className: 'mth mth-' + r.method,}, r.method)
                    , React.createElement('span', { className: "name", onDoubleClick: e => { e.stopPropagation(); renameRepItem(r.id); },}, r.name)
                    , selRep === r.id && (
                      React.createElement('div', { style: { marginLeft: 'auto', display: 'flex', gap: '2px' }, onClick: e => e.stopPropagation(),}
                        , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => renameRepItem(r.id), title: "Rename", style: { padding: '2px 5px', fontSize: '10px' },}, "✎")
                        , React.createElement('button', { className: "btn btn-sm btn-d"  , onClick: () => delRepItem(r.id), title: "Delete", style: { padding: '2px 5px', fontSize: '10px' },}, "✕")
                      )
                    )
                  )
                ))
              )
            )
            , React.createElement(ResizeHandle, { onDrag: (dx) => setRepSideW(w => Math.max(100, Math.min(400, w + dx))),} )
            , React.createElement('div', { className: "rep-main",}
              , React.createElement('div', { className: "req-bar",}
                , React.createElement('button', { className: "btn btn-s" , onClick: () => navigateHistory(-1), disabled: repHistoryIndex <= 0, title: "Previous",}, "◀")
                , React.createElement('button', { className: "btn btn-s" , onClick: () => navigateHistory(1), disabled: repHistoryIndex >= repHistory.length - 1, title: "Next",}, "▶")
                , React.createElement('select', { className: "mth-sel", value: repM, onChange: e => setRepM(e.target.value),}
                  , React.createElement('option', null, "GET")
                  , React.createElement('option', null, "HEAD")
                  , React.createElement('option', null, "POST")
                  , React.createElement('option', null, "PUT")
                  , React.createElement('option', null, "PATCH")
                  , React.createElement('option', null, "DELETE")
                  , React.createElement('option', null, "CONNECT")
                  , React.createElement('option', null, "OPTIONS")
                  , React.createElement('option', null, "TRACE")
                  , React.createElement('option', null, "PATCH")
                )
                , React.createElement('input', { className: "url-in", placeholder: "https://...", value: repU, onChange: e => setRepU(e.target.value),} )
                , React.createElement('button', { className: "btn btn-p" , onClick: sendRep, disabled: loading || !repU,}, loading ? '...' : '▶ Send')
                , React.createElement('select', { className: "sel", value: repFollowRedirects ? 'follow' : 'manual', onChange: e => setRepFollowRedirects(e.target.value === 'follow'),
                  style: { fontSize: '10px', padding: '4px 6px', minWidth: '105px' }, title: "Redirect mode" ,}
                  , React.createElement('option', { value: "manual",}, "No Redirect" )
                  , React.createElement('option', { value: "follow",}, "Auto Follow" )
                )
              )
              , React.createElement('div', { className: "rep-edit", style: { gridTemplateColumns: repSplitPct + '% 1fr' },}
                , React.createElement('div', { className: "ed-pane",}
                  , React.createElement('div', { className: "ed-hdr",}
                    , React.createElement('span', null, "Headers")
                  )
                  , React.createElement('div', { className: "hdr-wrap", style: { height: '40%' },}
                    , React.createElement('pre', { className: "hdr-highlight ed-ta" , 'aria-hidden': "true", style: { pointerEvents: 'none' }, dangerouslySetInnerHTML: { __html: (repH ? colorizeHeaders(repH) : '') + '\n' },} )
                    , React.createElement('textarea', { className: "ed-ta hdr-ta" , value: repH, onChange: e => setRepH(e.target.value), spellCheck: "false",} )
                  )
                  , React.createElement('div', { className: "ed-hdr",}
                    , React.createElement('span', null, "Body")
                    , React.createElement('div', { style: { display: 'flex', gap: '4px' },}
                      , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => { setRepB(prettyPrint(repB)); setRepBodyColor(true); }, title: "Pretty Print" ,}, "Pretty")
                      , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => { setRepB(minify(repB)); setRepBodyColor(false); }, title: "Minify",}, "Minify")
                    )
                  )
                  , repBodyColor ? (
                    React.createElement('div', {
                      ref: repBodyEditRef,
                      className: "ed-ce",
                      contentEditable: true,
                      suppressContentEditableWarning: true,
                      onInput: handleRepBodyInput,}
                    )
                  ) : (
                    React.createElement('textarea', { className: "ed-ta", style: { flex: 1 }, value: repB, onChange: e => setRepB(e.target.value),} )
                  )
                )
                , React.createElement('div', { className: "ed-pane",}
                  , React.createElement('div', { className: "ed-hdr",}
                    , React.createElement('span', null, "Response")
                    , React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' },}
                      , repResp && !repResp.error && (
                        React.createElement('span', { style: { color: 'var(--txt3)' },}
                          , repResp.status_code, " • "  , _optionalChain([repResp, 'access', _59 => _59.elapsed, 'optionalAccess', _60 => _60.toFixed, 'call', _61 => _61(3)]), "s"
                        )
                      )
                      , repResp && repResp.body && !repResp.error && (
                        React.createElement('div', { style: { display: 'flex', gap: '4px' },}
                          , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => setRepRespBody(prettyPrint(repRespBody)), title: "Pretty Print" ,}, "Pretty")
                          , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => setRepRespBody(minify(repRespBody)), title: "Minify",}, "Minify")
                        )
                      )
                    )
                  )
                  , repResp && repResp.error ? (
                    React.createElement('div', { className: "code",}, repResp.error)
                  ) : repResp ? (
                    React.createElement(React.Fragment, null
                      , repResp.redirect_chain && repResp.redirect_chain.length > 0 && (
                        React.createElement('div', { style: { padding: '6px 10px', background: 'var(--bg3)', borderBottom: '1px solid var(--brd)', fontSize: '10px', fontFamily: 'var(--font-mono)', flexShrink: 0, overflow: 'auto', maxHeight: '120px' },}
                          , React.createElement('div', { style: { color: 'var(--cyan)', marginBottom: '4px', fontWeight: 600 },}, "Redirect chain ("  , repResp.redirect_chain.length, " hops):" )
                          , repResp.redirect_chain.map((hop, i) => (
                            React.createElement('div', { key: i, style: { color: 'var(--txt2)', paddingLeft: '8px' },}
                              , React.createElement('span', { className: 'sts ' + stCls(hop.status_code),}, hop.status_code), " " , hop.url, " → "  , hop.location
                            )
                          ))
                          , React.createElement('div', { style: { color: 'var(--green)', paddingLeft: '8px' },}
                            , React.createElement('span', { className: 'sts ' + stCls(repResp.status_code),}, repResp.status_code), " " , repResp.final_url
                          )
                        )
                      )
                      , repResp.is_redirect && !repFollowRedirects && repResp.redirect_url && (
                        React.createElement('div', { style: { padding: '6px 10px', background: 'rgba(210,153,34,.1)', borderBottom: '1px solid var(--brd)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', flexShrink: 0 },}
                          , React.createElement('span', { style: { color: 'var(--orange)', fontWeight: 600 },}, "↪ Redirect" )
                          , React.createElement('span', { style: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--txt2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
                                title: repResp.redirect_url,}, repResp.redirect_url)
                          , React.createElement('button', { className: "btn btn-sm btn-p"  , onClick: followRedirect, disabled: loading, title: "Follow this redirect"  ,}, "Follow →"

                          )
                        )
                      )
                      , React.createElement('div', { className: "code", style: { height: '100px', minHeight: '60px', overflow: 'auto', flexShrink: 0, borderBottom: '1px solid var(--brd)' }, dangerouslySetInnerHTML: { __html: fmtHHtml(repResp.headers) },} )
                      , (() => {
                        if (repBodySearch) {
                          const hl = highlightMatches(repRespBody, repBodySearch, repBodySearchRegex, repBodySearchIdx);
                          if (hl.count !== repBodySearchCount) setTimeout(() => setRepBodySearchCount(hl.count), 0);
                          return React.createElement('div', { className: "code", ref: repCodeRef, style: { flex: 1, overflow: 'auto' }, dangerouslySetInnerHTML: { __html: hl.html },} );
                        }
                        const highlighted = colorizeBody(repRespBody);
                        return highlighted.html
                          ? React.createElement('div', { className: "code", style: { flex: 1, overflow: 'auto' }, dangerouslySetInnerHTML: { __html: highlighted.text },} )
                          : React.createElement('textarea', {
                              className: "ed-ta",
                              style: { flex: 1 },
                              value: repRespBody,
                              onChange: e => setRepRespBody(e.target.value),
                              placeholder: "Response body will appear here"    ,}
                            );
                      })()
                      , React.createElement('div', { className: "search-bar", style: { borderTop: '1px solid var(--brd)' },}
                        , React.createElement('input', {
                          placeholder: repBodySearchRegex ? 'Regex search...' : 'Search body...',
                          value: repBodySearch,
                          onChange: e => { setRepBodySearch(e.target.value); setRepBodySearchIdx(0); },
                          onKeyDown: e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setRepBodySearchIdx(i => repBodySearchCount > 0 ? (i + 1) % repBodySearchCount : 0); }
                            if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); setRepBodySearchIdx(i => repBodySearchCount > 0 ? (i - 1 + repBodySearchCount) % repBodySearchCount : 0); }
                            if (e.key === 'Escape') { setRepBodySearch(''); setRepBodySearchIdx(0); setRepBodySearchCount(0); }
                          },}
                        )
                        , React.createElement('button', { className: 'srch-btn' + (repBodySearchRegex ? ' act' : ''), onClick: () => { setRepBodySearchRegex(!repBodySearchRegex); setRepBodySearchIdx(0); }, title: "Toggle regex" ,}, ".*")
                        , React.createElement('span', { className: "search-info",}, repBodySearchCount > 0 ? (repBodySearchIdx + 1) + '/' + repBodySearchCount : '0/0')
                        , React.createElement('button', { className: "srch-btn", onClick: () => setRepBodySearchIdx(i => repBodySearchCount > 0 ? (i - 1 + repBodySearchCount) % repBodySearchCount : 0), disabled: repBodySearchCount === 0,}, "▲")
                        , React.createElement('button', { className: "srch-btn", onClick: () => setRepBodySearchIdx(i => repBodySearchCount > 0 ? (i + 1) % repBodySearchCount : 0), disabled: repBodySearchCount === 0,}, "▼")
                        , React.createElement('button', { className: "srch-btn", onClick: () => { setRepBodySearch(''); setRepBodySearchIdx(0); setRepBodySearchCount(0); },}, "✕")
                      )
                    )
                  ) : (
                    React.createElement('div', { className: "code",}, "Send a request"  )
                  )
                )
              )
            )
          )
        )

        , tab === 'webhook' && curPrj && _optionalChain([webhookExt, 'optionalAccess', _62 => _62.enabled]) && (
          React.createElement(React.Fragment, null
            , React.createElement('div', { className: "panel hist-pnl" ,}
              , React.createElement('div', { className: "flt-bar",}
                , React.createElement('input', { className: "flt-in", placeholder: "Filter by URL, method, IP..."    , value: whkSearch, onChange: e => setWhkSearch(e.target.value),} )
                , React.createElement('div', { style: { display: 'flex', gap: '4px', alignItems: 'center' },}
                  , React.createElement('span', { style: { fontSize: '10px', color: 'var(--txt3)' },}, _optionalChain([webhookExt, 'optionalAccess', _63 => _63.config, 'optionalAccess', _64 => _64.token_url]) ? '● Live' : '')
                )
              )
              , React.createElement('div', { className: "pnl-hdr",}
                , React.createElement('span', null, filteredWhk.length, " webhook requests"  )
                , React.createElement('div', { className: "acts",}
                  , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => refreshWebhook(), disabled: whkLoading,}, whkLoading ? '⏳' : '↻', " Sync" )
                  , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: loadWebhookLocal,}, "↻")
                  , React.createElement('button', { className: "btn btn-sm btn-d"  , onClick: clearWebhookHistory,}, "Clear")
                )
              )
              , React.createElement('div', { className: "pnl-cnt",}
                , React.createElement('div', { className: "req-list",}
                  , filteredWhk.map(r => (
                    React.createElement('div', {
                      key: r.request_id,
                      className: 'req-item' + (_optionalChain([selWhkReq, 'optionalAccess', _65 => _65.request_id]) === r.request_id ? ' sel' : ''),
                      onClick: () => { setSelWhkReq(r); setWhkDetTab('request'); },
                      onContextMenu: e => showContextMenu(e, r, 'webhook'),}

                      , React.createElement('span', { className: 'mth mth-' + (r.method || 'GET'),}, r.method || 'GET')
                      , React.createElement('span', { className: "url", title: r.url,}, r.url || r.path || '-')
                      , React.createElement('span', { style: { color: 'var(--txt2)', fontSize: '10px', minWidth: '90px' },}, r.ip || '-')
                      , React.createElement('span', { className: "ts",}, fmtTime(r.created_at))
                    )
                  ))
                  , filteredWhk.length === 0 && (
                    React.createElement('div', { className: "empty",}
                      , React.createElement('div', { className: "empty-i",}, "🔗")
                      , React.createElement('span', null, _optionalChain([webhookExt, 'optionalAccess', _66 => _66.config, 'optionalAccess', _67 => _67.token_id]) ? 'No webhook requests yet' : 'Create a webhook URL first')
                    )
                  )
                )
              )
            )

            , React.createElement('div', { className: "panel det-pnl" ,}
              , selWhkReq ? (
                React.createElement(React.Fragment, null
                  , React.createElement('div', { className: "pnl-hdr",}
                    , React.createElement('span', null, selWhkReq.method || 'GET', " " , (selWhkReq.url || '').substring(0, 50))
                    , React.createElement('div', { className: "acts",}
                      , React.createElement('button', { className: "btn btn-sm btn-p"  , onClick: () => whkToRepeater(selWhkReq),}, "→ Rep" )
                      , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => {
                        navigator.clipboard.writeText(selWhkReq.url || '');
                        toast('URL copied', 'success');
                      },}, "📋")
                    )
                  )
                  , React.createElement('div', { className: "det-tabs",}
                    , React.createElement('div', { className: 'det-tab' + (whkDetTab === 'request' ? ' act' : ''), onClick: () => setWhkDetTab('request'),}, "Request")
                    , React.createElement('div', { className: 'det-tab' + (whkDetTab === 'headers' ? ' act' : ''), onClick: () => setWhkDetTab('headers'),}, "Headers")
                    , React.createElement('div', { className: 'det-tab' + (whkDetTab === 'query' ? ' act' : ''), onClick: () => setWhkDetTab('query'),}, "Query")
                    , React.createElement('div', { className: 'det-tab' + (whkDetTab === 'body' ? ' act' : ''), onClick: () => setWhkDetTab('body'),}, "Body")
                    , React.createElement('div', { style: { marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' },}
                      , (whkDetTab === 'body' || whkDetTab === 'request') && (
                        React.createElement(React.Fragment, null
                          , React.createElement('button', { className: 'btn btn-sm ' + (whkReqFormat === 'raw' ? 'btn-p' : 'btn-s'), onClick: () => setWhkReqFormat('raw'),}, "Raw")
                          , React.createElement('button', { className: 'btn btn-sm ' + (whkReqFormat === 'pretty' ? 'btn-p' : 'btn-s'), onClick: () => setWhkReqFormat('pretty'),}, "Pretty")
                        )
                      )
                    )
                  )
                  , (() => {
                    if (whkDetTab === 'request') {
                      const bodyFmt = selWhkReq.content ? formatBody(selWhkReq.content, whkReqFormat) : null;
                      const info = (selWhkReq.method || 'GET') + ' ' + (selWhkReq.url || '') + '\n'
                        + 'IP: ' + (selWhkReq.ip || '-') + '\n'
                        + 'User-Agent: ' + (selWhkReq.user_agent || '-') + '\n'
                        + 'Time: ' + (selWhkReq.created_at || '-') + '\n\n'
                        + '--- Headers ---\n' + fmtH(selWhkReq.headers)
                        + (selWhkReq.content ? '\n\n--- Body ---\n' + (bodyFmt ? bodyFmt.text : selWhkReq.content) : '');
                      const isHtml = bodyFmt && bodyFmt.html;
                      return isHtml
                        ? React.createElement('div', { className: "code", dangerouslySetInnerHTML: { __html: info },} )
                        : React.createElement('div', { className: "code",}, info);
                    }
                    if (whkDetTab === 'headers') {
                      return React.createElement('div', { className: "code",}, fmtH(selWhkReq.headers) || 'No headers');
                    }
                    if (whkDetTab === 'query') {
                      const q = selWhkReq.query || {};
                      const entries = Object.entries(q);
                      return React.createElement('div', { className: "code",}, entries.length === 0 ? 'No query parameters' : entries.map(([k, v]) => k + ' = ' + v).join('\n'));
                    }
                    if (whkDetTab === 'body') {
                      if (!selWhkReq.content) return React.createElement('div', { className: "code",}, "No body content"  );
                      const bodyFmt = formatBody(selWhkReq.content, whkReqFormat);
                      return bodyFmt.html
                        ? React.createElement('div', { className: "code", dangerouslySetInnerHTML: { __html: bodyFmt.text },} )
                        : React.createElement('div', { className: "code",}, selWhkReq.content);
                    }
                    return React.createElement('div', { className: "code",});
                  })()
                )
              ) : (
                React.createElement('div', { className: "empty",}
                  , React.createElement('span', null, "Select a webhook request"   )
                )
              )
            )
          )
        )

        , tab === 'git' && curPrj && (
          React.createElement('div', { className: "git-pnl",}
            , React.createElement('div', { className: "git-sec",}
              , React.createElement('div', { className: "git-ttl",}, "Create Commit (Press Ctrl+S for auto-commit)"     )
              , React.createElement('div', { className: "cmt-form",}
                , React.createElement('input', { className: "cmt-in", placeholder: "Message...", value: cmtMsg, onChange: e => setCmtMsg(e.target.value), onKeyPress: e => e.key === 'Enter' && commit(),} )
                , React.createElement('button', { className: "btn btn-p" , onClick: commit,}, "Commit")
              )
            )
            , React.createElement('div', { className: "git-sec",}
              , React.createElement('div', { className: "git-ttl",}, "History")
              , React.createElement('div', { className: "cmt-list",}
                , commits.map((c, i) => (
                  React.createElement('div', { key: i, className: "cmt-item",}
                    , React.createElement('span', { className: "cmt-hash",}, c.hash)
                    , React.createElement('span', { className: "cmt-msg",}, c.message)
                    , React.createElement('span', { className: "cmt-date",}, c.date)
                  )
                ))
                , commits.length === 0 && (
                  React.createElement('div', { className: "cmt-item", style: { justifyContent: 'center', color: 'var(--txt3)' },}, "No commits"

                  )
                )
              )
            )
          )
        )

        , tab === 'extensions' && curPrj && (
          React.createElement('div', { className: "scp-pnl",}
            , React.createElement('div', { className: "scp-hdr",}
              , React.createElement('h3', null, "Extensions")
              , React.createElement('p', null, "Manage and configure extensions for request/response manipulation"      )
            )
            , extensions.length === 0 && (
              React.createElement('div', { className: "empty", style: { padding: 30 },}
                , React.createElement('div', { className: "empty-i",})
                , React.createElement('span', null, "No extensions installed"  )
              )
            )
            , extensions.filter(ext => ext.name !== 'sensitive').map(ext => (
              React.createElement('div', { key: ext.name, style: { background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '8px', padding: '16px', marginBottom: '12px' },}
                , React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },}
                  , React.createElement('div', null
                    , React.createElement('div', { style: { fontSize: '14px', fontWeight: '600', marginBottom: '4px' },}, ext.title || ext.name)
                    , React.createElement('div', { style: { fontSize: '11px', color: 'var(--txt2)' },}, ext.description || 'No description')
                  )
                  , React.createElement('button', { className: 'btn btn-sm ' + (ext.enabled ? 'btn-g' : 'btn-s'), onClick: () => togExtEnabled(ext.name, !ext.enabled),}
                    , ext.enabled ? 'Enabled' : 'Disabled'
                  )
                )
                , ext.enabled && EXTENSION_COMPONENTS[ext.name] &&
                  React.createElement(EXTENSION_COMPONENTS[ext.name], {
                    ext,
                    updateExtCfg,
                    ...(ext.name === 'webhook_site' ? {
                      whkReqs,
                      whkApiKey,
                      setWhkApiKey,
                      whkLoading,
                      createWebhookToken,
                      refreshWebhook,
                      loadWebhookLocal,
                      toast
                    } : {})
                  })
                
              )
            ))
          )
        )


        , tab === 'collections' && curPrj && (
          React.createElement('div', { className: "coll-cnt",}
            , React.createElement('div', { className: "coll-side panel" , style: { width: collSideW + 'px' },}
              , React.createElement('div', { className: "pnl-hdr",}
                , React.createElement('span', null, "Collections")
                , React.createElement('button', { className: "btn btn-sm btn-p"  , onClick: createColl,}, "+")
              )
              , React.createElement('div', { className: "pnl-cnt",}
                , colls.map(c => (
                  React.createElement('div', { key: c.id, className: 'coll-item' + (selColl === c.id ? ' sel' : ''),
                       onClick: () => loadCollItems(c.id),
                       onContextMenu: e => { e.preventDefault(); if (confirm('Delete "' + c.name + '"?')) deleteColl(c.id); },}
                    , React.createElement('span', { className: "coll-name",}, c.name)
                    , React.createElement('span', { className: "coll-count",}, c.item_count)
                  )
                ))
                , colls.length === 0 && (
                  React.createElement('div', { className: "empty", style: { padding: 20, fontSize: 11 },}
                    , React.createElement('span', null, "No collections yet"  )
                  )
                )
              )
            )
            , React.createElement(ResizeHandle, { onDrag: (dx) => setCollSideW(w => Math.max(100, Math.min(400, w + dx))),} )
            , React.createElement('div', { className: "coll-steps panel" , style: { width: collStepsW + 'px' },}
              , React.createElement('div', { className: "pnl-hdr",}
                , React.createElement('span', null, "Steps " , selColl ? '(' + collItems.length + ')' : '')
              )
              , React.createElement('div', { className: "pnl-cnt",}
                , collItems.map((item, idx) => (
                  React.createElement('div', { key: item.id, className: 'coll-step-item' + (collStep === idx ? ' active' : '') + (collResps[item.id] ? (collResps[item.id].error ? ' err' : ' done') : ''),
                       onClick: () => setCollStep(idx),
                       onContextMenu: e => showContextMenu(e, item, 'collection'),}
                    , React.createElement('span', { className: "coll-step-num",}, idx + 1)
                    , React.createElement('span', { className: 'mth mth-' + item.method,}, item.method)
                    , React.createElement('span', { className: "url", style: { flex: 1 },}, item.url.length > 45 ? item.url.substring(0, 45) + '...' : item.url)
                    , collResps[item.id] && !collResps[item.id].error && (
                      React.createElement('span', { className: 'sts ' + stCls(collResps[item.id].status_code),}, collResps[item.id].status_code)
                    )
                    , collResps[item.id] && collResps[item.id].error && (
                      React.createElement('span', { className: "sts st5" ,}, "ERR")
                    )
                    , React.createElement('button', { className: "btn btn-sm btn-d"  , onClick: e => { e.stopPropagation(); deleteCollItem(selColl, item.id); }, style: { padding: '2px 5px', fontSize: '10px' },}, "✕")
                  )
                ))
                , selColl && collItems.length === 0 && (
                  React.createElement('div', { className: "empty", style: { padding: 20, fontSize: 11 },}
                    , React.createElement('span', null, "Add requests via right-click in History"     )
                  )
                )
                , !selColl && (
                  React.createElement('div', { className: "empty", style: { padding: 20, fontSize: 11 },}
                    , React.createElement('span', null, "Select a collection"  )
                  )
                )
                , Object.keys(collVars).length > 0 && (
                  React.createElement('div', { className: "coll-vars",}
                    , React.createElement('div', { className: "coll-vars-hdr",}, "Variables")
                    , Object.entries(collVars).map(([k, v]) => (
                      React.createElement('div', { key: k, className: "coll-var",}
                        , React.createElement('span', { className: "coll-var-name",}, k)
                        , React.createElement('span', { className: "coll-var-val",}, String(v).substring(0, 60))
                      )
                    ))
                  )
                )
              )
            )
            , React.createElement(ResizeHandle, { onDrag: (dx) => setCollStepsW(w => Math.max(150, Math.min(600, w + dx))),} )
            , React.createElement('div', { className: "coll-exec panel" ,}
              , selColl && collItems.length > 0 ? (
                React.createElement(React.Fragment, null
                  , React.createElement('div', { className: "pnl-hdr",}
                    , React.createElement('span', null, "Step " , Math.min(collStep + 1, collItems.length), " of "  , collItems.length)
                    , React.createElement('div', { className: "acts",}
                      , React.createElement('button', { className: "btn btn-sm btn-p"  , onClick: executeCollStep,
                              disabled: collRunning || collStep >= collItems.length,}
                        , collRunning ? '...' : '\u25B6 Send Next'
                      )
                      , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: resetCollRun,}, "Reset")
                    )
                  )
                  , (() => {
                    const item = collItems[Math.min(collStep, collItems.length - 1)];
                    if (!item) return null;
                    const resp = collResps[item.id];
                    return (
                      React.createElement(React.Fragment, null
                        , React.createElement('div', { style: { padding: '10px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--brd)', fontSize: '12px' },}
                          , React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' },}
                            , React.createElement('span', { className: 'mth mth-' + item.method,}, item.method)
                            , React.createElement('span', { style: { fontFamily: 'var(--font-mono)', fontSize: '11px', flex: 1 },}, item.url)
                          )
                          , item.headers && Object.keys(item.headers).length > 0 && (
                            React.createElement('div', { style: { fontSize: '10px', color: 'var(--txt3)', marginBottom: '4px' },}
                              , Object.entries(item.headers).map(([k, v]) => k + ': ' + v).join(' | ')
                            )
                          )
                          , item.body && (
                            React.createElement('div', { style: { fontSize: '10px', color: 'var(--txt3)' },}, "Body: " , item.body.substring(0, 100))
                          )
                        )
                        , React.createElement('div', { style: { padding: '8px 14px', background: 'var(--bg3)', borderBottom: '1px solid var(--brd)' },}
                          , React.createElement('div', { style: { fontSize: '10px', color: 'var(--txt2)', fontWeight: '600', marginBottom: '6px' },}, "Variable Extractions" )
                          , (item.var_extracts || []).map((ve, vi) => (
                            React.createElement('div', { key: vi, className: "coll-extract",}
                              , React.createElement('span', { className: "coll-extract-name",}, ve.name)
                              , React.createElement('span', { style: { color: 'var(--txt3)', fontSize: '10px' },}, "from " , ve.source, " at" )
                              , React.createElement('span', { style: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--cyan)' },}, ve.path)
                              , React.createElement('button', { className: "btn btn-sm btn-d"  , style: { padding: '1px 4px', fontSize: '9px' },
                                onClick: () => {
                                  const newExtracts = item.var_extracts.filter((_, i) => i !== vi);
                                  updateCollItemExtracts(selColl, item.id, newExtracts);
                                },}, "✕")
                            )
                          ))
                          , React.createElement('div', { style: { display: 'flex', gap: '6px', marginTop: '6px' },}
                            , React.createElement('input', { className: "inp", placeholder: "var name" , id: "ve-name", style: { flex: 1, fontSize: '10px', padding: '4px 6px' },} )
                            , React.createElement('select', { className: "sel", id: "ve-source", style: { fontSize: '10px', padding: '4px' },}
                              , React.createElement('option', { value: "body",}, "body")
                              , React.createElement('option', { value: "header",}, "header")
                            )
                            , React.createElement('input', { className: "inp", placeholder: "$.path.to.value", id: "ve-path", style: { flex: 1, fontSize: '10px', padding: '4px 6px' },} )
                            , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => {
                              const name = document.getElementById('ve-name').value;
                              const source = document.getElementById('ve-source').value;
                              const path = document.getElementById('ve-path').value;
                              if (!name || !path) return;
                              const newExtracts = [...(item.var_extracts || []), { name, source, path }];
                              updateCollItemExtracts(selColl, item.id, newExtracts);
                              document.getElementById('ve-name').value = '';
                              document.getElementById('ve-path').value = '';
                            },}, "+ Add" )
                          )
                        )
                        , resp && (
                          React.createElement(React.Fragment, null
                            , React.createElement('div', { className: "pnl-hdr",}
                              , React.createElement('span', null, "Response")
                              , !resp.error && (
                                React.createElement('span', { style: { color: 'var(--txt3)', fontSize: '10px' },}
                                  , resp.status_code, " • "  , _optionalChain([resp, 'access', _68 => _68.elapsed, 'optionalAccess', _69 => _69.toFixed, 'call', _70 => _70(3)]), "s"
                                )
                              )
                            )
                            , (() => {
                              if (resp.error) return React.createElement('div', { className: "code", style: { flex: 1 },}, resp.error);
                              const collBodyFmt = colorizeBody(resp.body || '');
                              return collBodyFmt.html
                                ? React.createElement('div', { className: "code", style: { flex: 1 }, dangerouslySetInnerHTML: { __html: collBodyFmt.text },} )
                                : React.createElement('div', { className: "code", style: { flex: 1 },}, resp.body || '');
                            })()
                            , resp.extracted_variables && Object.keys(resp.extracted_variables).length > 0 && (
                              React.createElement('div', { className: "coll-vars", style: { borderTop: '1px solid var(--brd)' },}
                                , React.createElement('div', { className: "coll-vars-hdr",}, "Extracted")
                                , Object.entries(resp.extracted_variables).map(([k, v]) => (
                                  React.createElement('div', { key: k, className: "coll-var",}
                                    , React.createElement('span', { className: "coll-var-name",}, k)
                                    , React.createElement('span', { className: "coll-var-val",}, String(v).substring(0, 60))
                                  )
                                ))
                              )
                            )
                          )
                        )
                        , !resp && (
                          React.createElement('div', { className: "empty",}, React.createElement('span', null, "Click \"Send Next\" to execute this step"      ))
                        )
                      )
                    );
                  })()
                )
              ) : (
                React.createElement('div', { className: "empty",}, React.createElement('span', null, selColl ? 'No steps - add requests from History' : 'Select a collection'))
              )
            )
          )
        )

        , tab === 'chepy' && curPrj && (
          React.createElement('div', { className: "chepy-cnt", ref: chepyCntRef,}
            , React.createElement('div', { className: "chepy-col chepy-in-col" , style: { width: chepyInW + '%' },}
              , React.createElement('div', { className: "pnl-hdr",}
                , React.createElement('span', null, "Input")
                , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => setChepyIn(''),}, "Clear")
              )
              , React.createElement('textarea', {
                className: "ed-ta",
                style: { flex: 1 },
                value: chepyIn,
                onChange: e => setChepyIn(e.target.value),
                placeholder: "Paste or type input text here..."     ,}
              )
            )

            , React.createElement(ResizeHandle, { onDrag: (dx) => {
              const el = chepyCntRef.current;
              if (!el) return;
              const dpct = (dx / el.offsetWidth) * 100;
              setChepyInW(prev => Math.max(15, Math.min(50, prev + dpct)));
            },} )

            , React.createElement('div', { className: "chepy-col chepy-recipe-col" , style: { width: chepyRecW + '%' },}
              , React.createElement('div', { className: "pnl-hdr",}
                , React.createElement('span', null, "Recipe")
                , React.createElement('div', { style: { display: 'flex', gap: '6px' },}
                  , React.createElement('button', { className: "btn btn-sm btn-d"  , onClick: clearChepyRecipe,}, "Clear")
                  , React.createElement('button', { className: "btn btn-sm btn-p"  , onClick: bakeChepy, disabled: chepyBaking,}
                    , chepyBaking ? '...' : 'Bake'
                  )
                )
              )

              , React.createElement('div', { className: "chepy-add",}
                , React.createElement('select', { className: "sel", value: chepySelCat,
                  onChange: e => setChepySelCat(e.target.value),
                  style: { margin: '8px', borderRadius: '4px' },}
                  , Object.keys(chepyCat).map(cat => (
                    React.createElement('option', { key: cat, value: cat,}, cat)
                  ))
                )
                , React.createElement('div', { className: "chepy-ops-list",}
                  , (chepyCat[chepySelCat] || []).map(op => (
                    React.createElement('div', { key: op.name, className: "chepy-avail-op", onClick: () => addChepyOp(op),}
                      , op.label
                    )
                  ))
                )
              )

              , React.createElement('div', { className: "chepy-steps",}
                , chepyOps.length === 0 && (
                  React.createElement('div', { className: "empty", style: { padding: 20, fontSize: 11 },}
                    , React.createElement('span', null, "Click operations above to build a recipe"      )
                  )
                )
                , chepyOps.map((op, i) => (
                  React.createElement('div', { key: i, className: "chepy-step",}
                    , React.createElement('div', { className: "chepy-step-hdr",}
                      , React.createElement('span', { className: "chepy-step-num",}, i + 1)
                      , React.createElement('span', { className: "chepy-step-name",}, op.label)
                      , React.createElement('div', { className: "chepy-step-acts",}
                        , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => moveChepyOp(i, -1), disabled: i === 0,}, "▲")
                        , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => moveChepyOp(i, 1), disabled: i === chepyOps.length - 1,}, "▼")
                        , React.createElement('button', { className: "btn btn-sm btn-d"  , onClick: () => removeChepyOp(i),}, "✕")
                      )
                    )
                    , op.params.length > 0 && (
                      React.createElement('div', { className: "chepy-step-params",}
                        , op.params.map(p => (
                          React.createElement('div', { key: p.name, className: "chepy-param",}
                            , React.createElement('label', { className: "chepy-param-lbl",}, p.label)
                            , p.type === 'select' ? (
                              React.createElement('select', { className: "sel", value: op.args[p.name] || p.default,
                                onChange: e => updateChepyArg(i, p.name, e.target.value),
                                style: { flex: 1, fontSize: '11px', padding: '5px 8px' },}
                                , (p.options || []).map(o => React.createElement('option', { key: o, value: o,}, o))
                              )
                            ) : (
                              React.createElement('input', { className: "inp", value: op.args[p.name] || '',
                                onChange: e => updateChepyArg(i, p.name, e.target.value),
                                placeholder: p.default || '',
                                style: { flex: 1, fontSize: '11px', padding: '5px 8px' },} )
                            )
                          )
                        ))
                      )
                    )
                  )
                ))
              )
            )

            , React.createElement(ResizeHandle, { onDrag: (dx) => {
              const el = chepyCntRef.current;
              if (!el) return;
              const dpct = (dx / el.offsetWidth) * 100;
              setChepyRecW(prev => Math.max(15, Math.min(50, prev + dpct)));
            },} )

            , React.createElement('div', { className: "chepy-col chepy-out-col" ,}
              , React.createElement('div', { className: "pnl-hdr",}
                , React.createElement('span', null, "Output")
                , React.createElement('button', { className: "btn btn-sm btn-s"  ,
                  onClick: () => { navigator.clipboard.writeText(chepyOut); toast('Copied', 'success'); },
                  disabled: !chepyOut,}, "Copy"

                )
              )
              , chepyErr ? (
                React.createElement('div', { className: "code", style: { color: 'var(--red)' },}, chepyErr)
              ) : (
                React.createElement('div', { className: "code",}, chepyOut || 'Output will appear here after baking')
              )
            )
          )
        )

        , tab === 'sensitive' && curPrj && (
          React.createElement('div', { className: "sens-cnt",}
            , React.createElement('div', { className: "det-tabs", style: { justifyContent: 'flex-start', gap: 0 },}
              , React.createElement('div', { className: 'det-tab' + (sensSubTab === 'logger' ? ' act' : ''), onClick: () => setSensSubTab('logger'),}, "Logger")
              , React.createElement('div', { className: 'det-tab' + (sensSubTab === 'options' ? ' act' : ''), onClick: () => setSensSubTab('options'),}, "Options")
            )

            , sensSubTab === 'logger' && (
              React.createElement(React.Fragment, null
                , React.createElement('div', { className: "sens-toolbar",}
                  , React.createElement('button', { className: "btn btn-sm btn-g"  , onClick: runSensitiveScan, disabled: sensScanning || reqs.length === 0,}
                    , sensScanning ? '...' : '\u25B6', " Scan"
                  )
                  , React.createElement('button', { className: "btn btn-sm btn-d"  , onClick: stopSensitiveScan, disabled: !sensScanning,}
                    , '\u25A0', " Stop"
                  )
                  , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => { setSensResults([]); setSensSelResult(null); setSensSelDetail(null); setSensPct(0); },}, "Clear"

                  )
                  , React.createElement('div', { className: "sens-progress", style: { flex: 1 },}
                    , React.createElement('div', { className: "sens-progress-bar", style: { width: sensPct + '%' },} )
                  )
                  , React.createElement('span', { style: { fontSize: '10px', color: 'var(--txt2)', whiteSpace: 'nowrap' },}
                    , sensScanning ? sensPct + '%' : sensResults.length + ' findings'
                  )
                )

                , React.createElement('div', { className: "sens-filter-bar",}
                  , React.createElement('input', {
                    placeholder: "Filter results..." ,
                    value: sensFilter,
                    onChange: e => setSensFilter(e.target.value),
                    style: { flex: 1, padding: '4px 8px', background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '4px', color: 'var(--txt)', fontSize: '11px', fontFamily: 'var(--font-mono)', outline: 'none' },}
                  )
                  , React.createElement('label', { style: { fontSize: '10px', color: 'var(--txt2)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' },}
                    , React.createElement('input', { type: "checkbox", checked: sensUnique, onChange: e => setSensUnique(e.target.checked),} ), "Unique"

                  )
                  , React.createElement('span', { style: { fontSize: '10px', color: 'var(--txt3)' },}
                    , sensFiltered.length, sensFiltered.length !== sensResults.length ? ' / ' + sensResults.length : ''
                  )
                )

                , React.createElement('div', { className: "sens-results",}
                  , React.createElement('div', { className: "sens-row sens-row-hdr" ,}
                    , React.createElement('span', null, "Category")
                    , React.createElement('span', null, "Match")
                    , React.createElement('span', null, "Pattern / URL"  )
                  )
                  , sensFiltered.length === 0 && !sensScanning && (
                    React.createElement('div', { className: "empty", style: { padding: '40px 0' },}
                      , React.createElement('div', { className: "empty-i",}, sensResults.length === 0 ? '\uD83D\uDD0D' : '\uD83D\uDD0E')
                      , React.createElement('span', null, sensResults.length === 0 ? 'Click Scan to analyze captured traffic' : 'No results match your filter')
                    )
                  )
                  , sensFiltered.map((r, i) => (
                    React.createElement('div', { key: i, className: 'sens-row' + (sensSelResult === r ? ' sel' : ''), onClick: () => loadSensDetail(r),}
                      , React.createElement('span', { className: "sens-cat", style: { background: (SENS_COLORS[r.category] || 'var(--txt3)') + '22', color: SENS_COLORS[r.category] || 'var(--txt3)' },}
                        , r.category
                      )
                      , React.createElement('span', { className: "sens-match", title: r.match,}, r.match)
                      , React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 },}
                        , React.createElement('span', { className: "sens-pname",}, r.patternName)
                        , React.createElement('span', { className: "sens-purl", title: r.url,}, r.method, " " , r.url)
                      )
                    )
                  ))
                )

                , sensSelResult && (
                  React.createElement('div', { className: "sens-detail",}
                    , React.createElement('div', { className: "pnl-hdr",}
                      , React.createElement('span', { style: { fontSize: '11px' },}
                        , React.createElement('span', { className: "sens-cat", style: { background: (SENS_COLORS[sensSelResult.category] || 'var(--txt3)') + '22', color: SENS_COLORS[sensSelResult.category] || 'var(--txt3)', marginRight: '8px' },}
                          , sensSelResult.category
                        )
                        , sensSelResult.patternName, " — "  , React.createElement('span', { style: { color: 'var(--txt3)' },}, sensSelResult.section)
                      )
                      , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => { setSensSelResult(null); setSensSelDetail(null); },}, "Close")
                    )
                    , React.createElement('div', { ref: sensDetailRef, style: { flex: 1, overflow: 'auto', padding: '10px', fontFamily: 'var(--font-mono)', fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' },}
                      , sensSelDetail ? (() => {
                        const secMap = {
                          reqUrl: sensSelDetail.url || '',
                          reqHeaders: sensSelDetail.headers || '',
                          reqBody: sensSelDetail.body || '',
                          respHeaders: sensSelDetail.response_headers || '',
                          respBody: sensSelDetail.response_body || '',
                        };
                        const text = secMap[sensSelResult.section] || '';
                        const isHdr = sensSelResult.section === 'reqHeaders' || sensSelResult.section === 'respHeaders';
                        if (isHdr) {
                          const base = colorizeHeaders(text);
                          const mt = escapeHtml(sensSelResult.match.replace(/\.\.\.$/, ''));
                          const re = mt ? new RegExp('(' + mt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi') : null;
                          const html = re ? base.replace(re, '<span class="search-hl">$1</span>') : base;
                          return React.createElement('div', { dangerouslySetInnerHTML: { __html: html } });
                        }
                        const hl = highlightMatches(text, sensSelResult.match.replace(/\.\.\.$/, ''), false, 0);
                        return React.createElement('div', { dangerouslySetInnerHTML: { __html: hl.html } });
                      })() : React.createElement('span', { style: { color: 'var(--txt3)' },}, "Loading...")
                    )
                  )
                )
              )
            )

            , sensSubTab === 'options' && (
              React.createElement('div', { style: { flex: 1, overflow: 'auto', padding: '16px' },}
                , React.createElement('div', { className: "sens-opt-section",}
                  , React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' },}
                    , React.createElement('span', { style: { fontWeight: 600, fontSize: '12px' },}, "Scanner Config" )
                  )
                  , React.createElement('div', { style: { display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '11px' },}
                    , React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: '6px' },}, "Batch Size:"

                      , React.createElement('input', { type: "number", min: "1", max: "20", value: sensBatch, onChange: e => setSensBatch(Math.max(1, parseInt(e.target.value) || 4)),
                        style: { width: '50px', padding: '3px 6px', background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '4px', color: 'var(--txt)', fontSize: '11px' },} )
                    )
                    , React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: '6px' },}, "Max Resp Size:"

                      , React.createElement('input', { type: "number", min: "0", value: sensMaxSize, onChange: e => setSensMaxSize(parseInt(e.target.value) || 0),
                        style: { width: '90px', padding: '3px 6px', background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '4px', color: 'var(--txt)', fontSize: '11px' },} )
                    )
                    , React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' },}
                      , React.createElement('input', { type: "checkbox", checked: sensScopeOnly, onChange: e => setSensScopeOnly(e.target.checked),} ), "Scope only"

                    )
                  )
                )

                , [
                  { key: 'general', label: 'General Patterns', defaults: SENS_GENERAL },
                  { key: 'tokens', label: 'Token Patterns', defaults: SENS_TOKENS },
                  { key: 'urls', label: 'URL Patterns', defaults: SENS_URLS },
                  { key: 'files', label: 'File Extension Patterns', defaults: SENS_FILES },
                ].map(grp => (
                  React.createElement('div', { key: grp.key, className: "sens-opt-section",}
                    , React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' },}
                      , React.createElement('span', { style: { fontWeight: 600, fontSize: '12px' },}, grp.label, " (" , sensPatterns[grp.key].filter(p => p.enabled).length, "/", sensPatterns[grp.key].length, ")")
                      , React.createElement('div', { style: { display: 'flex', gap: '6px' },}
                        , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => setSensPatterns(prev => ({ ...prev, [grp.key]: prev[grp.key].map(p => ({ ...p, enabled: true })) })),}, "All")
                        , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => setSensPatterns(prev => ({ ...prev, [grp.key]: prev[grp.key].map(p => ({ ...p, enabled: false })) })),}, "None")
                        , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => {
                          const name = prompt('Pattern name:');
                          if (!name) return;
                          const regex = prompt('Regex:');
                          if (!regex) return;
                          const category = prompt('Category:', grp.key === 'files' ? 'Files' : 'Custom');
                          setSensPatterns(prev => ({
                            ...prev,
                            [grp.key]: [...prev[grp.key], { name, regex, category: category || 'Custom', sections: grp.key === 'files' ? ['reqUrl'] : ['respHeaders','respBody'], enabled: true }]
                          }));
                        },}, "+ Add" )
                        , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => setSensPatterns(prev => ({ ...prev, [grp.key]: grp.defaults.map(p => ({...p})) })),}, "Reset")
                      )
                    )
                    , React.createElement('div', { style: { maxHeight: '300px', overflow: 'auto' },}
                      , sensPatterns[grp.key].map((pat, pi) => (
                        React.createElement('div', { key: pi, className: "sens-pat-row",}
                          , React.createElement('input', { type: "checkbox", checked: pat.enabled, onChange: e => {
                            const val = e.target.checked;
                            const gk = grp.key;
                            const idx = pi;
                            setSensPatterns(prev => ({
                              ...prev,
                              [gk]: prev[gk].map((p, j) => j === idx ? { ...p, enabled: val } : p)
                            }));
                          },} )
                          , React.createElement('span', { style: { flex: '0 0 180px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: pat.name,}, pat.name)
                          , React.createElement('span', { style: { flex: 1, fontFamily: 'var(--font-mono)', color: 'var(--txt3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '10px' }, title: pat.regex,}, pat.regex)
                          , React.createElement('span', { className: "sens-section-badge",}, pat.sections.join(', '))
                          , React.createElement('button', { className: "btn btn-sm btn-s"  , style: { padding: '1px 5px', fontSize: '9px' }, onClick: () => {
                            setSensPatterns(prev => {
                              const next = { ...prev, [grp.key]: prev[grp.key].filter((_, j) => j !== pi) };
                              return next;
                            });
                          },}, '\u2715')
                        )
                      ))
                    )
                  )
                ))
              )
            )
          )
        )

        , tab === 'intruder' && curPrj && (
          React.createElement('div', { style: { display: 'flex', width: '100%', height: '100%' },}
            , React.createElement('div', { className: "rep-side", style: { width: '200px', minWidth: '160px' },}
              , React.createElement('div', { className: "pnl-hdr",}
                , React.createElement('span', null, "Attacks")
                , React.createElement('button', { className: "btn btn-sm btn-p"  , onClick: () => { setIntSelAttack(null); setIntMethod('GET'); setIntUrl(''); setIntHeaders(''); setIntBody(''); setIntResults([]); setIntDone(0); setIntTotal(0); setIntPct(0); setIntSelResult(null); setIntSubTab('positions'); },}, "+ New" )
              )
              , React.createElement('div', { className: "rep-list",}
                , intAttacks.map(a => (
                  React.createElement('div', { key: a.id, className: 'rep-item' + (intSelAttack === a.id ? ' sel' : ''), onClick: () => loadIntAttack(a.id),}
                    , React.createElement('div', { style: { flex: 1, overflow: 'hidden' },}
                      , React.createElement('div', { style: { fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },}, a.name)
                      , React.createElement('div', { style: { fontSize: 9, color: 'var(--txt3)' },}, a.total, " results "  , '\u00b7', " " , a.created_at ? new Date(a.created_at).toLocaleDateString() : '')
                    )
                    , intSelAttack === a.id && (
                      React.createElement('div', { style: { display: 'flex', gap: 2 }, onClick: e => e.stopPropagation(),}
                        , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => renameIntAttack(a.id), style: { padding: '2px 5px', fontSize: 10 },}, '\u270e')
                        , React.createElement('button', { className: "btn btn-sm btn-d"  , onClick: () => deleteIntAttack(a.id), style: { padding: '2px 5px', fontSize: 10 },}, '\u2715')
                      )
                    )
                  )
                ))
                , intAttacks.length === 0 && (
                  React.createElement('div', { style: { padding: 14, fontSize: 11, color: 'var(--txt3)', textAlign: 'center' },}, "No saved attacks"  )
                )
              )
            )
            , React.createElement('div', { className: "int-cnt", style: { flex: 1, minWidth: 0 },}
            , React.createElement('div', { className: "det-tabs", style: { justifyContent: 'flex-start', gap: 0 },}
              , React.createElement('div', { className: 'det-tab' + (intSubTab === 'positions' ? ' act' : ''), onClick: () => setIntSubTab('positions'),}, "Positions")
              , React.createElement('div', { className: 'det-tab' + (intSubTab === 'payloads' ? ' act' : ''), onClick: () => setIntSubTab('payloads'),}, "Payloads")
              , React.createElement('div', { className: 'det-tab' + (intSubTab === 'resource' ? ' act' : ''), onClick: () => setIntSubTab('resource'),}, "Resource Pool" )
              , React.createElement('div', { className: 'det-tab' + (intSubTab === 'results' ? ' act' : ''), onClick: () => setIntSubTab('results'),}, "Results " , intResults.length > 0 ? '(' + intResults.length + ')' : '')
            )

            , intSubTab === 'positions' && (
              React.createElement('div', { className: "int-positions",}
                , React.createElement('div', { className: "int-section",}
                  , React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },}
                    , React.createElement('label', { style: { fontSize: 11, color: 'var(--txt2)' },}, "Attack Type:" )
                    , React.createElement('select', { className: "sel", value: intAttackType, onChange: e => setIntAttackType(e.target.value), style: { fontSize: 11, padding: '4px 8px' },}
                      , React.createElement('option', { value: "targeted",}, "Targeted")
                      , React.createElement('option', { value: "broadcast",}, "Broadcast")
                      , React.createElement('option', { value: "parallel",}, "Parallel")
                      , React.createElement('option', { value: "matrix",}, "Matrix")
                    )
                    , React.createElement('span', { style: { fontSize: 10, color: 'var(--txt3)', flex: 1 },}
                      , intAttackType === 'targeted' && 'Tests each position one at a time with a single payload set'
                      , intAttackType === 'broadcast' && 'Same payload in all positions simultaneously'
                      , intAttackType === 'parallel' && 'Different payload per position, iterated in parallel (zip)'
                      , intAttackType === 'matrix' && 'Cartesian product of all payload sets — tests every combination'
                    )
                  )
                )

                , React.createElement('div', { className: "int-section",}
                  , React.createElement('h4', null, "Request")
                  , React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },}
                    , React.createElement('select', { className: "mth-sel", value: intMethod, onChange: e => setIntMethod(e.target.value), style: { fontSize: 11 },}
                      , React.createElement('option', null, "GET"), React.createElement('option', null, "POST"), React.createElement('option', null, "PUT"), React.createElement('option', null, "PATCH"), React.createElement('option', null, "DELETE"), React.createElement('option', null, "HEAD"), React.createElement('option', null, "OPTIONS")
                    )
                    , React.createElement('input', { className: "url-in", placeholder: "https://example.com/api/endpoint", value: intUrl, onChange: e => setIntUrl(e.target.value), style: { flex: 1 },} )
                  )
                  , React.createElement('label', { style: { fontSize: 10, color: 'var(--txt3)', display: 'block', marginBottom: 4 },}, "Headers")
                  , React.createElement('div', { className: "hdr-wrap",}
                    , React.createElement('pre', { className: "hdr-highlight int-editor" , 'aria-hidden': "true", dangerouslySetInnerHTML: { __html: (intHeaders ? colorizeHeaders(intHeaders) : '') + '\n' },} )
                    , React.createElement('textarea', { ref: intHeadersRef, className: "int-editor hdr-ta" , rows: 4, value: intHeaders, onChange: e => setIntHeaders(e.target.value),
                      placeholder: 'Content-Type: application/json\nAuthorization: Bearer \u00a7token\u00a7', spellCheck: "false",} )
                  )
                  , React.createElement('label', { style: { fontSize: 10, color: 'var(--txt3)', display: 'block', marginBottom: 4, marginTop: 8 },}, "Body")
                  , React.createElement('textarea', { ref: intBodyRef, className: "int-editor", rows: 6, value: intBody, onChange: e => setIntBody(e.target.value),
                    placeholder: '{"username":"\u00a7user\u00a7","password":"\u00a7pass\u00a7"}',} )
                )

                , React.createElement('div', { className: "int-section",}
                  , React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 },}
                    , React.createElement('button', { className: "btn btn-sm btn-p"  , onClick: () => {
                      const ref = intBodyRef.current || intHeadersRef.current;
                      if (!ref) return;
                      const start = ref.selectionStart;
                      const end = ref.selectionEnd;
                      if (start === end) { toast('Select text first', 'error'); return; }
                      const val = ref.value;
                      const selected = val.substring(start, end);
                      const nv = val.substring(0, start) + '\u00a7' + selected + '\u00a7' + val.substring(end);
                      if (ref === intBodyRef.current) setIntBody(nv);
                      else setIntHeaders(nv);
                    },}, '\u00a7', " Add "  , '\u00a7')
                    , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => {
                      setIntUrl(intUrl.replace(/\u00a7[^\u00a7]*\u00a7/g, m => m.slice(1, -1)));
                      setIntHeaders(intHeaders.replace(/\u00a7[^\u00a7]*\u00a7/g, m => m.slice(1, -1)));
                      setIntBody(intBody.replace(/\u00a7[^\u00a7]*\u00a7/g, m => m.slice(1, -1)));
                    },}, "Clear " , '\u00a7')
                    , React.createElement('span', { style: { fontSize: 11, color: 'var(--txt2)' },}, "Positions found: "  , React.createElement('strong', { style: { color: 'var(--orange)' },}, intPositions.length))
                  )
                  , intPositions.length > 0 && (
                    React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 },}
                      , intPositions.map((p, i) => (
                        React.createElement('span', { key: i, className: "int-pos-tag",}, "#", i + 1, ": " , p.name, " " , React.createElement('span', { style: { color: 'var(--txt3)', fontSize: 9 },}, "(", p.section, ")"))
                      ))
                    )
                  )
                )
              )
            )

            , intSubTab === 'payloads' && (
              React.createElement('div', { className: "int-payloads",}
                , React.createElement('div', { className: "int-section",}
                  , React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },}
                    , React.createElement('label', { style: { fontSize: 11, color: 'var(--txt2)' },}, "Payload Set:" )
                    , React.createElement('select', { className: "sel", value: intSelPayloadSet, onChange: e => setIntSelPayloadSet(Number(e.target.value)), style: { fontSize: 11, padding: '4px 8px' },}
                      , intPositions.map((p, i) => (
                        React.createElement('option', { key: i, value: i,}, "Position #" , i + 1, ": " , p.name)
                      ))
                    )
                  )
                  , intPositions.length === 0 && (
                    React.createElement('div', { className: "empty", style: { padding: 30 },}
                      , React.createElement('div', { className: "empty-i",}, '\u00a7')
                      , React.createElement('span', null, "Add position markers in the Positions tab first"       )
                    )
                  )
                  , intPositions.length > 0 && (() => {
                    const idx = intSelPayloadSet;
                    const cfg = intPayloads[idx] || { type: 'list', items: '' };
                    const updateCfg = (key, val) => setIntPayloads(prev => ({ ...prev, [idx]: { ...prev[idx], [key]: val } }));
                    return React.createElement(React.Fragment, null,
                      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 } },
                        React.createElement('label', { style: { fontSize: 11, color: 'var(--txt2)' } }, 'Payload Type:'),
                        React.createElement('select', { className: 'sel', value: cfg.type, onChange: e => updateCfg('type', e.target.value), style: { fontSize: 11, padding: '4px 8px' } },
                          React.createElement('option', { value: 'list' }, 'Simple List'),
                          React.createElement('option', { value: 'numbers' }, 'Numbers'),
                          React.createElement('option', { value: 'bruteforce' }, 'Brute Forcer')
                        )
                      ),
                      cfg.type === 'list' && React.createElement('div', { className: 'int-section' },
                        React.createElement('h4', null, 'Simple List'),
                        React.createElement('textarea', { className: 'int-editor', rows: 12, value: cfg.items || '', onChange: e => updateCfg('items', e.target.value),
                          placeholder: 'Enter one payload per line...' }),
                        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 } },
                          React.createElement('button', { className: 'btn btn-sm btn-s', onClick: () => {
                            const input = document.createElement('input');
                            input.type = 'file'; input.accept = '.txt,.csv,.lst,.list';
                            input.onchange = e => {
                              const f = e.target.files[0]; if (!f) return;
                              const reader = new FileReader();
                              reader.onload = ev => updateCfg('items', (cfg.items ? cfg.items + '\n' : '') + ev.target.result);
                              reader.readAsText(f);
                            };
                            input.click();
                          }}, 'Load File'),
                          React.createElement('button', { className: 'btn btn-sm btn-s', onClick: async () => {
                            try { const t = await navigator.clipboard.readText(); updateCfg('items', (cfg.items ? cfg.items + '\n' : '') + t); } catch(e) { toast('Clipboard access denied', 'error'); }
                          }}, 'Paste'),
                          React.createElement('button', { className: 'btn btn-sm btn-d', onClick: () => updateCfg('items', '') }, 'Clear'),
                          React.createElement('span', { style: { fontSize: 10, color: 'var(--txt3)', marginLeft: 'auto' } },
                            'Items: ' + ((cfg.items || '').split('\n').filter(l => l.length > 0).length))
                        )
                      ),
                      cfg.type === 'numbers' && React.createElement('div', { className: 'int-section' },
                        React.createElement('h4', null, 'Numbers Range'),
                        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 } },
                          React.createElement('label', { style: { fontSize: 10, color: 'var(--txt3)' } }, 'From:', React.createElement('input', { type: 'number', className: 'int-editor', style: { marginTop: 4, padding: 6, minHeight: 'auto' }, value: cfg.from || 0, onChange: e => updateCfg('from', Number(e.target.value)) })),
                          React.createElement('label', { style: { fontSize: 10, color: 'var(--txt3)' } }, 'To:', React.createElement('input', { type: 'number', className: 'int-editor', style: { marginTop: 4, padding: 6, minHeight: 'auto' }, value: cfg.to || 99, onChange: e => updateCfg('to', Number(e.target.value)) })),
                          React.createElement('label', { style: { fontSize: 10, color: 'var(--txt3)' } }, 'Step:', React.createElement('input', { type: 'number', className: 'int-editor', style: { marginTop: 4, padding: 6, minHeight: 'auto' }, value: cfg.step || 1, onChange: e => updateCfg('step', Number(e.target.value)) })),
                          React.createElement('label', { style: { fontSize: 10, color: 'var(--txt3)' } }, 'Pad digits (0=none):', React.createElement('input', { type: 'number', className: 'int-editor', style: { marginTop: 4, padding: 6, minHeight: 'auto' }, value: cfg.padLen || 0, onChange: e => updateCfg('padLen', Number(e.target.value)) }))
                        ),
                        React.createElement('div', { style: { fontSize: 10, color: 'var(--txt3)', marginTop: 8 } },
                          'Will generate ' + (Math.max(0, Math.floor(((cfg.to || 99) - (cfg.from || 0)) / Math.max(1, cfg.step || 1)) + 1)) + ' payloads')
                      ),
                      cfg.type === 'bruteforce' && React.createElement('div', { className: 'int-section' },
                        React.createElement('h4', null, 'Brute Forcer'),
                        React.createElement('label', { style: { fontSize: 10, color: 'var(--txt3)', display: 'block', marginBottom: 4 } }, 'Character Set:'),
                        React.createElement('input', { className: 'int-editor', style: { minHeight: 'auto', padding: 6 }, value: cfg.charset || 'abcdefghijklmnopqrstuvwxyz', onChange: e => updateCfg('charset', e.target.value) }),
                        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 } },
                          React.createElement('label', { style: { fontSize: 10, color: 'var(--txt3)' } }, 'Min Length:', React.createElement('input', { type: 'number', className: 'int-editor', style: { marginTop: 4, padding: 6, minHeight: 'auto' }, value: cfg.minLen || 1, onChange: e => updateCfg('minLen', Number(e.target.value)) })),
                          React.createElement('label', { style: { fontSize: 10, color: 'var(--txt3)' } }, 'Max Length:', React.createElement('input', { type: 'number', className: 'int-editor', style: { marginTop: 4, padding: 6, minHeight: 'auto' }, value: cfg.maxLen || 3, onChange: e => updateCfg('maxLen', Number(e.target.value)) }))
                        ),
                        React.createElement('div', { style: { fontSize: 10, color: 'var(--txt3)', marginTop: 8 } },
                          (() => { const c = (cfg.charset || 'a').length; const mn = Math.max(1, cfg.minLen || 1); const mx = Math.min(8, cfg.maxLen || 3); let t = 0; for (let l = mn; l <= mx; l++) t += Math.pow(c, l); return 'Will generate ~' + (t > 500000 ? '500,000 (capped)' : t.toLocaleString()) + ' payloads'; })()
                        )
                      ),
                      React.createElement('div', { className: 'int-section', style: { marginTop: 12 } },
                        React.createElement('h4', null, 'Payload Processing'),
                        React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' } },
                          React.createElement('label', { style: { fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 } },
                            React.createElement('input', { type: 'checkbox', checked: cfg.urlEncode || false, onChange: e => updateCfg('urlEncode', e.target.checked) }),
                            'URL-encode'),
                          React.createElement('label', { style: { fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 } },
                            React.createElement('input', { type: 'checkbox', checked: cfg.base64 || false, onChange: e => updateCfg('base64', e.target.checked) }),
                            'Base64')
                        ),
                        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 } },
                          React.createElement('label', { style: { fontSize: 10, color: 'var(--txt3)' } }, 'Prefix:', React.createElement('input', { className: 'int-editor', style: { marginTop: 4, padding: 6, minHeight: 'auto' }, value: cfg.prefix || '', onChange: e => updateCfg('prefix', e.target.value) })),
                          React.createElement('label', { style: { fontSize: 10, color: 'var(--txt3)' } }, 'Suffix:', React.createElement('input', { className: 'int-editor', style: { marginTop: 4, padding: 6, minHeight: 'auto' }, value: cfg.suffix || '', onChange: e => updateCfg('suffix', e.target.value) }))
                        )
                      )
                    );
                  })()
                )
              )
            )

            , intSubTab === 'resource' && (
              React.createElement('div', { className: "int-resource",}
                , React.createElement('div', { className: "int-section",}
                  , React.createElement('h4', null, "Throttle Settings" )
                  , React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },}
                    , React.createElement('label', { style: { fontSize: 11, color: 'var(--txt2)' },}, "Concurrent Requests (1-50):"
                      , React.createElement('input', { type: "number", className: "int-editor", style: { marginTop: 4, padding: 6, minHeight: 'auto' },
                        value: intConcurrency, onChange: e => setIntConcurrency(Math.max(1, Math.min(50, Number(e.target.value) || 1))), min: 1, max: 50,} )
                    )
                    , React.createElement('label', { style: { fontSize: 11, color: 'var(--txt2)' },}, "Fixed Delay Between Batches (ms):"
                      , React.createElement('input', { type: "number", className: "int-editor", style: { marginTop: 4, padding: 6, minHeight: 'auto' },
                        value: intDelay, onChange: e => setIntDelay(Math.max(0, Number(e.target.value) || 0)), min: 0,} )
                    )
                  )
                  , React.createElement('div', { style: { marginTop: 10 },}
                    , React.createElement('label', { style: { fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 },}
                      , React.createElement('input', { type: "checkbox", checked: intRandomDelay, onChange: e => setIntRandomDelay(e.target.checked),} ), "Random delay instead"

                    )
                    , intRandomDelay && (
                      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8, marginLeft: 20 },}
                        , React.createElement('label', { style: { fontSize: 10, color: 'var(--txt3)' },}, "Min (ms):"
                          , React.createElement('input', { type: "number", className: "int-editor", style: { marginTop: 4, padding: 6, minHeight: 'auto' },
                            value: intDelayMin, onChange: e => setIntDelayMin(Number(e.target.value) || 0),} )
                        )
                        , React.createElement('label', { style: { fontSize: 10, color: 'var(--txt3)' },}, "Max (ms):"
                          , React.createElement('input', { type: "number", className: "int-editor", style: { marginTop: 4, padding: 6, minHeight: 'auto' },
                            value: intDelayMax, onChange: e => setIntDelayMax(Number(e.target.value) || 0),} )
                        )
                      )
                    )
                  )
                )

                , React.createElement('div', { className: "int-section",}
                  , React.createElement('h4', null, "Connection Settings" )
                  , React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },}
                    , React.createElement('label', { style: { fontSize: 11, color: 'var(--txt2)' },}, "Request Timeout (seconds):"
                      , React.createElement('input', { type: "number", className: "int-editor", style: { marginTop: 4, padding: 6, minHeight: 'auto' },
                        value: intTimeout, onChange: e => setIntTimeout(Math.max(1, Number(e.target.value) || 30)), min: 1,} )
                    )
                    , React.createElement('label', { style: { fontSize: 11, color: 'var(--txt2)' },}, "Max Retries on Error:"
                      , React.createElement('input', { type: "number", className: "int-editor", style: { marginTop: 4, padding: 6, minHeight: 'auto' },
                        value: intMaxRetries, onChange: e => setIntMaxRetries(Math.max(0, Number(e.target.value) || 0)), min: 0,} )
                    )
                  )
                  , React.createElement('label', { style: { fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 },}
                    , React.createElement('input', { type: "checkbox", checked: intFollowRedirects, onChange: e => setIntFollowRedirects(e.target.checked),} ), "Follow redirects"

                  )
                )

                , React.createElement('div', { className: "int-section",}
                  , React.createElement('h4', null, "Attack Preview" )
                  , React.createElement('div', { style: { fontSize: 11, color: 'var(--txt2)', lineHeight: 1.8 },}
                    , React.createElement('div', null, "Attack type: "  , React.createElement('strong', null, intAttackType.replace('_', ' ')))
                    , React.createElement('div', null, "Positions: " , React.createElement('strong', null, intPositions.length))
                    , React.createElement('div', null, "Total requests: "  , React.createElement('strong', { style: { color: 'var(--cyan)' },}, intComputeTotal().toLocaleString()))
                    , intComputeTotal() > 0 && intConcurrency > 0 && (
                      React.createElement('div', null, "Estimated time: "  , React.createElement('strong', null, "~", (() => {
                        const total = intComputeTotal();
                        const batches = Math.ceil(total / intConcurrency);
                        const avgDelay = intRandomDelay ? (intDelayMin + intDelayMax) / 2 : intDelay;
                        const secs = batches * 0.5 + batches * avgDelay / 1000;
                        if (secs < 60) return Math.round(secs) + 's';
                        if (secs < 3600) return Math.round(secs / 60) + ' min';
                        return (secs / 3600).toFixed(1) + ' hr';
                      })()))
                    )
                  )
                )
              )
            )

            , intSubTab === 'results' && (
              React.createElement('div', { className: "int-results-cnt",}
                , React.createElement('div', { className: "sens-toolbar",}
                  , React.createElement('button', { className: "btn btn-sm btn-p"  , onClick: runIntruderAttack, disabled: intRunning || intPositions.length === 0,}, '\u25b6', " Start Attack"  )
                  , React.createElement('button', { className: "btn btn-sm btn-d"  , onClick: stopIntruderAttack, disabled: !intRunning,}, '\u25a0', " Stop" )
                  , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => { setIntResults([]); setIntDone(0); setIntPct(0); setIntSelResult(null); },}, "Clear")
                  , React.createElement('div', { className: "int-progress", style: { flex: 1, marginLeft: 8, marginRight: 8 },}
                    , React.createElement('div', { className: "int-progress-bar", style: { width: intPct + '%' },} )
                  )
                  , React.createElement('span', { style: { fontSize: 10, color: 'var(--txt3)', whiteSpace: 'nowrap' },}, intPct, "%")
                )
                , React.createElement('div', { className: "int-stats", style: { padding: '4px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--brd)' },}
                  , React.createElement('span', null, intDone, "/", intTotal, " requests" )
                  , intStartTime && intDone > 0 && React.createElement('span', null, (intDone / ((Date.now() - intStartTime) / 1000)).toFixed(1), " req/s" )
                  , intStartTime && React.createElement('span', null, "Elapsed: " , Math.round((Date.now() - intStartTime) / 1000), "s")
                  , React.createElement('div', { style: { flex: 1 },} )
                  , React.createElement('input', { className: "int-editor", style: { minHeight: 'auto', padding: '3px 8px', width: 180, resize: 'none', fontSize: 10 },
                    placeholder: "Filter results..." , value: intFilter, onChange: e => setIntFilter(e.target.value),} )
                )
                , React.createElement('div', { className: "int-results",}
                  , React.createElement('div', { className: "int-row int-row-hdr" , onClick: e => {
                    const col = e.target.dataset.col;
                    if (!col) return;
                    setIntSortCol(col);
                    setIntSortDir(prev => intSortCol === col ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
                  },}
                    , React.createElement('span', { 'data-col': "#",}, "# " , intSortCol === '#' ? (intSortDir === 'asc' ? '\u25b2' : '\u25bc') : '')
                    , React.createElement('span', { 'data-col': "payload",}, "Payload " , intSortCol === 'payload' ? (intSortDir === 'asc' ? '\u25b2' : '\u25bc') : '')
                    , React.createElement('span', { 'data-col': "status",}, "Status " , intSortCol === 'status' ? (intSortDir === 'asc' ? '\u25b2' : '\u25bc') : '')
                    , React.createElement('span', { 'data-col': "length",}, "Length " , intSortCol === 'length' ? (intSortDir === 'asc' ? '\u25b2' : '\u25bc') : '')
                    , React.createElement('span', { 'data-col': "time",}, "Time " , intSortCol === 'time' ? (intSortDir === 'asc' ? '\u25b2' : '\u25bc') : '')
                    , React.createElement('span', null, "Error")
                  )
                  , intSorted.map(r => (
                    React.createElement('div', { key: r.num, className: 'int-row' + (intSelResult && intSelResult.num === r.num ? ' sel' : ''),
                      onClick: () => setIntSelResult(prev => prev && prev.num === r.num ? null : r),}
                      , React.createElement('span', { style: { color: 'var(--txt3)' },}, r.num)
                      , React.createElement('span', { className: "int-payload-txt", title: r.payload,}, r.payload)
                      , React.createElement('span', { className: 'int-status s' + String(r.status).charAt(0),}, r.status || '-')
                      , React.createElement('span', { style: { fontFamily: 'var(--font-mono)', fontSize: 10 },}, r.length > 0 ? r.length.toLocaleString() : '-')
                      , React.createElement('span', { style: { fontFamily: 'var(--font-mono)', fontSize: 10 },}, r.time > 0 ? r.time + 'ms' : '-')
                      , React.createElement('span', { style: { color: 'var(--red)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: r.error,}, r.error)
                    )
                  ))
                  , intResults.length === 0 && !intRunning && (
                    React.createElement('div', { className: "empty", style: { padding: 40 },}
                      , React.createElement('div', { className: "empty-i",}, '\u26a1')
                      , React.createElement('span', null, "Click \"Start Attack\" to begin"    )
                    )
                  )
                )
                , intSelResult && (
                  React.createElement('div', { className: "int-detail",}
                    , React.createElement('div', { className: "det-tabs", style: { justifyContent: 'flex-start', gap: 0, flexShrink: 0 },}
                      , React.createElement('div', { className: "det-tab act" , style: { fontSize: 10 },}, "Request / Response #"   , intSelResult.num)
                      , React.createElement('div', { style: { flex: 1 },} )
                      , React.createElement('button', { className: "btn btn-sm btn-s"  , style: { margin: '2px 6px', fontSize: 9 }, onClick: () => toRep(intSelResult.request),}, "Send to Repeater"  )
                      , React.createElement('button', { className: "btn btn-sm btn-s"  , style: { margin: '2px 6px', fontSize: 9, padding: '2px 6px' }, onClick: () => setIntSelResult(null),}, '\u2715')
                    )
                    , React.createElement('div', { style: { display: 'flex', flex: 1, overflow: 'hidden' },}
                      , React.createElement('div', { style: { flex: 1, overflow: 'auto', padding: 10, borderRight: '1px solid var(--brd)' },}
                        , React.createElement('div', { style: { fontSize: 10, fontWeight: 600, color: 'var(--cyan)', marginBottom: 6 },}, "Request")
                        , React.createElement('pre', { style: { fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--txt)', margin: 0 },
                          dangerouslySetInnerHTML: { __html: escapeHtml(intSelResult.request.method + ' ' + intSelResult.request.url) + '\n' + fmtHHtml(intSelResult.request.headers, intSelResult.request.url) + (intSelResult.request.body ? '\n\n' + escapeHtml(intSelResult.request.body) : '') },} )
                      )
                      , React.createElement('div', { style: { flex: 1, overflow: 'auto', padding: 10 },}
                        , React.createElement('div', { style: { fontSize: 10, fontWeight: 600, color: 'var(--green)', marginBottom: 6 },}, "Response")
                        , intSelResult.response.error ? (
                          React.createElement('div', { style: { color: 'var(--red)', fontSize: 11 },}, intSelResult.response.error)
                        ) : (
                          React.createElement('pre', { style: { fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--txt)', margin: 0 },
                            dangerouslySetInnerHTML: { __html: escapeHtml('HTTP ' + intSelResult.response.status_code + ' (' + intSelResult.time + 'ms, ' + intSelResult.length + ' bytes)') + '\n' + fmtHHtml(intSelResult.response.headers) + (intSelResult.response.body ? '\n\n' + escapeHtml(intSelResult.response.body) : '') },} )
                        )
                      )
                    )
                  )
                )
              )
            )
          )
          )
        )

        , tab === 'compare' && curPrj && (
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%' },}
            , React.createElement('div', { className: "det-tabs", style: { justifyContent: 'flex-start', gap: 0 },}
              , React.createElement('div', { className: 'det-tab' + (cmpView === 'request' ? ' act' : ''), onClick: () => setCmpView('request'),}, "Request")
              , React.createElement('div', { className: 'det-tab' + (cmpView === 'response' ? ' act' : ''), onClick: () => setCmpView('response'),}, "Response")
              , React.createElement('div', { style: { flex: 1 },} )
              , React.createElement('button', { className: "btn btn-sm btn-s"  , style: { margin: '4px 10px' }, onClick: () => { setCmpA(null); setCmpB(null); },}, "Clear All" )
            )
            , !cmpA && !cmpB ? (
              React.createElement('div', { className: "empty",}
                , React.createElement('div', { className: "empty-i",}, "↔")
                , React.createElement('span', null, "Right-click a request and choose \"Send to Compare (A/B)\""        )
              )
            ) : (
              React.createElement('div', { className: "cmp-wrap",}
                , React.createElement('div', { className: "cmp-side",}
                  , React.createElement('div', { className: "pnl-hdr",}
                    , React.createElement('span', { style: { fontWeight: 600, color: 'var(--red)' },}, "A " , cmpA ? React.createElement('span', { style: { fontWeight: 400, color: 'var(--txt2)' },}, cmpA.method, " " , cmpA.url) : '(empty)')
                    , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => setCmpA(null),}, "Clear")
                  )
                  , React.createElement('div', { className: "cmp-body",}
                    , cmpDiff.map((d, i) => {
                      const txt = d.type === 'added' ? null : (_nullishCoalesce(d.lineA, () => ( '')));
                      return React.createElement('div', { key: i, className: 'cmp-line ' + (d.type === 'equal' ? 'cmp-eq' : d.type === 'removed' ? 'cmp-rem' : 'cmp-blank'),
                        dangerouslySetInnerHTML: { __html: txt == null ? '\u00A0' : colorizeHeaders(txt) },} );
                    })
                  )
                )
                , React.createElement('div', { className: "cmp-side",}
                  , React.createElement('div', { className: "pnl-hdr",}
                    , React.createElement('span', { style: { fontWeight: 600, color: 'var(--green)' },}, "B " , cmpB ? React.createElement('span', { style: { fontWeight: 400, color: 'var(--txt2)' },}, cmpB.method, " " , cmpB.url) : '(empty)')
                    , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => setCmpB(null),}, "Clear")
                  )
                  , React.createElement('div', { className: "cmp-body",}
                    , cmpDiff.map((d, i) => {
                      const txt = d.type === 'removed' ? null : (_nullishCoalesce(d.lineB, () => ( '')));
                      return React.createElement('div', { key: i, className: 'cmp-line ' + (d.type === 'equal' ? 'cmp-eq' : d.type === 'added' ? 'cmp-add' : 'cmp-blank'),
                        dangerouslySetInnerHTML: { __html: txt == null ? '\u00A0' : colorizeHeaders(txt) },} );
                    })
                  )
                )
              )
            )
          )
        )
      )

      , React.createElement('div', { className: "toast-c",}
        , toasts.map(t => (
          React.createElement('div', { key: t.id, className: 'toast ' + t.type,}, t.message)
        ))
      )

      , contextMenu && (
        React.createElement('div', { ref: ctxMenuRef, className: "context-menu", style: { left: contextMenu.x, top: contextMenu.y }, onClick: e => e.stopPropagation(),}
          , (_optionalChain([contextMenu, 'access', _71 => _71.normalized, 'optionalAccess', _72 => _72.body]) || contextMenu.source === 'selection') && (
            React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('send-to-cipher'),}, "Send to Cipher"

            )
          )
          , contextMenu.source !== 'websocket' && (
            React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('repeater'),}, "Send to Repeater"

            )
          )
          , contextMenu.source !== 'websocket' && (
            React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('intruder'),}, "Send to Intruder"

            )
          )
          , React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('add-to-collection'),}, "Add to Collection"

          )
          , contextMenu.source !== 'websocket' && contextMenu.source !== 'selection' && (
            React.createElement(React.Fragment, null
              , React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('compare-a'),}, "Send to Compare (A)"

              )
              , React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('compare-b'),}, "Send to Compare (B)"

              )
            )
          )
          , React.createElement('div', { className: "context-menu-divider",} )
          , React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('copy-url'),}, "Copy URL"

          )
          , contextMenu.source !== 'websocket' && (
            React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('copy-curl'),}, "Copy as cURL"

            )
          )
          , React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('copy-body'),}, "Copy Body"

          )
          , _optionalChain([contextMenu, 'access', _73 => _73.normalized, 'optionalAccess', _74 => _74.url]) && (
            React.createElement(React.Fragment, null
              , React.createElement('div', { className: "context-menu-divider",} )
              , React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('scope-include'),}, "Add host to Scope"

              )
              , React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('scope-exclude'),}, "Exclude host to Scope"

              )
            )
          )
          , contextMenu.source === 'history' && (
            React.createElement(React.Fragment, null
              , React.createElement('div', { className: "context-menu-divider",} )
              , React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('favorite'),}
                , contextMenu.request.saved ? 'Unmark' : 'Mark', " as Favorite"
              )
              , React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('delete'),}, "Delete"

              )
            )
          )
          , contextMenu.source === 'repeater' && (
            React.createElement(React.Fragment, null
              , React.createElement('div', { className: "context-menu-divider",} )
              , React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('rename'),}, "Rename"

              )
              , React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('delete'),}, "Delete"

              )
            )
          )
        )
      )

      , showCollPick && (
        React.createElement('div', { style: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 },
             onClick: () => setShowCollPick(null),}
          , React.createElement('div', { style: { background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '8px', padding: '20px', minWidth: '300px' },
               onClick: e => e.stopPropagation(),}
            , React.createElement('h3', { style: { fontSize: '14px', marginBottom: '12px' },}, "Add to Collection"  )
            , colls.length === 0 && React.createElement('div', { style: { color: 'var(--txt3)', fontSize: '12px', marginBottom: '10px' },}, "No collections yet. Create one in the Collections tab."        )
            , colls.map(c => (
              React.createElement('div', { key: c.id, className: "coll-pick-item", onClick: () => addToCollection(c.id, showCollPick),}
                , c.name, " " , React.createElement('span', { style: { color: 'var(--txt3)', fontSize: '10px' },}, "(", c.item_count, " items)" )
              )
            ))
            , React.createElement('button', { className: "btn btn-sm btn-s"  , style: { marginTop: '10px' }, onClick: () => setShowCollPick(null),}, "Cancel")
          )
        )
      )

      , showProxyCfg && (
        React.createElement('div', { style: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }, onClick: () => setShowProxyCfg(false),}
          , React.createElement('div', { style: { background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '8px', padding: '24px', minWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }, onClick: e => e.stopPropagation(),}
            , React.createElement('h3', { style: { fontSize: '16px', marginBottom: '16px' },}, "Proxy Configuration" )
            , React.createElement('div', { style: { marginBottom: '16px' },}
              , React.createElement('label', { style: { display: 'block', fontSize: '12px', color: 'var(--txt2)', marginBottom: '6px' },}, "Port")
              , React.createElement('input', { className: "inp", type: "number", value: pxPort, onChange: e => setPxPort(parseInt(e.target.value) || 8080), min: "1", max: "65535",} )
            )
            , React.createElement('div', { style: { marginBottom: '16px' },}
              , React.createElement('label', { style: { display: 'block', fontSize: '12px', color: 'var(--txt2)', marginBottom: '6px' },}, "Mode")
              , React.createElement('select', { className: "sel", value: pxMode, onChange: e => setPxMode(e.target.value), style: { width: '100%' },}
                , React.createElement('option', { value: "regular",}, "Regular")
                , React.createElement('option', { value: "transparent",}, "Transparent")
                , React.createElement('option', { value: "socks5",}, "SOCKS5")
                , React.createElement('option', { value: "reverse:http://example.com",}, "Reverse Proxy" )
                , React.createElement('option', { value: "upstream:http://proxy.example.com:8080",}, "Upstream Proxy" )
              )
              , React.createElement('div', { style: { fontSize: '10px', color: 'var(--txt3)', marginTop: '4px' },}, "Select proxy operating mode"   )
            )
            , React.createElement('div', { style: { marginBottom: '16px' },}
              , React.createElement('label', { style: { display: 'block', fontSize: '12px', color: 'var(--txt2)', marginBottom: '6px' },}, "Additional Arguments" )
              , React.createElement('input', { className: "inp", type: "text", value: pxArgs, onChange: e => setPxArgs(e.target.value), placeholder: "--ssl-insecure --verbose" ,} )
              , React.createElement('div', { style: { fontSize: '10px', color: 'var(--txt3)', marginTop: '4px' },}, "Extra mitmproxy arguments (e.g., --ssl-insecure --verbose)"     )
            )
            , React.createElement('div', { style: { marginBottom: '16px', padding: '12px', background: 'var(--bg3)', borderRadius: '6px', fontSize: '11px' },}
              , React.createElement('div', { style: { fontWeight: '600', marginBottom: '8px', color: 'var(--txt2)' },}, "Common Configurations:" )
              , React.createElement('div', { style: { marginBottom: '4px' },}, React.createElement('strong', null, "Transparent:"), " Intercept traffic at network level (requires iptables)"       )
              , React.createElement('div', { style: { marginBottom: '4px' },}, React.createElement('strong', null, "SOCKS5:"), " Run as SOCKS5 proxy server"     )
              , React.createElement('div', { style: { marginBottom: '4px' },}, React.createElement('strong', null, "Reverse:"), " Act as reverse proxy for specific server"       )
              , React.createElement('div', { style: { marginBottom: '4px' },}, React.createElement('strong', null, "Upstream:"), " Chain with another proxy"    )
              , React.createElement('div', { style: { marginTop: '8px', color: 'var(--txt3)', fontSize: '10px' },}, "Docs: " , React.createElement('a', { href: "https://docs.mitmproxy.org/stable/concepts-modes/", target: "_blank", style: { color: 'var(--cyan)' },}, "mitmproxy.org/modes"))
            )
            , React.createElement('div', { style: { display: 'flex', gap: '10px' },}
              , React.createElement('button', { className: "btn btn-p" , onClick: saveProxyCfg,}, "Save")
              , React.createElement('button', { className: "btn btn-s" , onClick: () => setShowProxyCfg(false),}, "Cancel")
            )
          )
        )
      )
      )
      )
    )
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(Blackwire, null ));

})();