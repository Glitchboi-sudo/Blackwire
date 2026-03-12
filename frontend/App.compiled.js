 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import api from './src/utils/api.js';
import {
  calculateEntropy,
  base64urlDecode,
  base64urlEncode,
  decodeJWT,
  encodeJWT
} from './src/utils/encoding.js';
import {
  escapeHtml,
  getCaretOffset,
  setCaretOffset
} from './src/utils/dom-utils.js';
import { detectLanguage } from './src/utils/language-detect.js';
import {
  generateCurl,
  generateSQLMapRequest,
  generatePayloadList,
  generateAttackCombinations
} from './src/utils/generators.js';
import {
  buildIntRequest,
  normalizeRequest
} from './src/utils/request-utils.js';
import {
  prettyPrint,
  minify,
  formatXml,
  fmtH,
  fmtHHtml,
  colorizeHeaders,
  buildCmpText,
  fmtTime,
  stCls,
  beautifyJs
} from './src/utils/formatters.js';
import {
  deobfuscate,
  deobfuscateAndBeautify,
  detectObfuscationType
} from './src/utils/deobfuscator.js';
import {
  httpqlTokenize,
  httpqlParse,
  diffLines,
  parseHeaders,
  parseIntPositions,
  SENS_GENERAL,
  SENS_TOKENS,
  SENS_URLS,
  SENS_FILES,
  SENS_COLORS,
  SENS_DEFAULT_PATTERNS
} from './src/utils/parsing.js';
import {
  buildHighlighter,
  syntaxHighlightJSON,
  syntaxHighlightXML,
  syntaxHighlightProto,
  syntaxHighlightHTML,
  syntaxHighlightCSS,
  syntaxHighlightJS,
  syntaxHighlightPython,
  syntaxHighlightPHP,
  syntaxHighlightSQL,
  syntaxHighlightYAML,
  syntaxHighlightGraphQL,
  syntaxHighlightShell
} from './src/utils/syntax-highlight.js';

// Services
import { projectService } from './src/services/projectService.js';
import { requestService } from './src/services/requestService.js';
import { repeaterService } from './src/services/repeaterService.js';
import { interceptService } from './src/services/interceptService.js';
import { scopeService } from './src/services/scopeService.js';
import { collectionService } from './src/services/collectionService.js';
import { sessionService } from './src/services/sessionService.js';
import { chepyService } from './src/services/chepyService.js';
import { websocketService } from './src/services/websocketService.js';
import { intruderService } from './src/services/intruderService.js';
import { extensionService } from './src/services/extensionService.js';
import { webhookService } from './src/services/webhookService.js';
import { gitService } from './src/services/gitService.js';
import { proxyService } from './src/services/proxyService.js';

// Custom Hooks
import { usePagination } from './src/hooks/usePagination.js';
import { useLocalStorage } from './src/hooks/useLocalStorage.js';
import { useBodySearch } from './src/hooks/useBodySearch.js';
import { useBypass } from './src/hooks/useBypass.js';
import { useDeobfuscator } from './src/hooks/useDeobfuscator.js';
import { useDebounce } from './src/hooks/useDebounce.js';

// Domain Hooks
import { useToast } from './src/hooks/useToast.js';
import { useProxy } from './src/hooks/useProxy.js';
import { useGit } from './src/hooks/useGit.js';
import { useScope } from './src/hooks/useScope.js';
import { useIntercept } from './src/hooks/useIntercept.js';
import { useSessionRules } from './src/hooks/useSessionRules.js';
import { useChepy } from './src/hooks/useChepy.js';
import { useWebSockets } from './src/hooks/useWebSockets.js';
import { useExtensions } from './src/hooks/useExtensions.js';
import { useWebhook } from './src/hooks/useWebhook.js';
import { useProjects } from './src/hooks/useProjects.js';
import { useRequests } from './src/hooks/useRequests.js';
import { useRepeater } from './src/hooks/useRepeater.js';
import { useCollections } from './src/hooks/useCollections.js';
import { useIntruder } from './src/hooks/useIntruder.js';
import { useSensitive } from './src/hooks/useSensitive.js';
import { useConsole } from './src/hooks/useConsole.js';

// Bypass Manager Component (defined inline to avoid MIME type issues)

const { useState, useEffect, useRef } = React;

const API = '';
const WS_URL = 'ws://' + location.host + '/ws';

const THEMES = window.BW_THEMES || {};

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

/**
 * Optimized highlightMatches for large texts
 * Limits processing to avoid UI freezing
 */
function highlightMatches(text, pattern, isRegex, currentIdx) {
  if (!pattern) return { html: text, count: 0 };

  try {
    // For very large texts (>500KB), limit processing or show warning
    const MAX_HIGHLIGHT_SIZE = 500 * 1024; // 500KB limit
    const MAX_MATCHES = 10000; // Maximum number of matches to highlight

    let processText = text;
    let isTruncated = false;

    if (text.length > MAX_HIGHLIGHT_SIZE) {
      // Process only first 500KB for performance
      processText = text.substring(0, MAX_HIGHLIGHT_SIZE);
      isTruncated = true;
    }

    // Escape HTML
    const safe = processText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const escaped = isRegex ? pattern : pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(' + escaped + ')', 'gi');

    let count = 0;
    let matchCount = 0;

    // Count total matches first (with limit)
    const matches = safe.match(re);
    const totalMatches = matches ? Math.min(matches.length, MAX_MATCHES) : 0;

    // Replace with highlights
    const html = safe.replace(re, (match) => {
      if (matchCount >= MAX_MATCHES) {
        return match; // Stop highlighting after limit
      }

      const cls = count === currentIdx ? 'search-hl search-cur' : 'search-hl';
      count++;
      matchCount++;
      return '<mark class="' + cls + '">' + match + '</mark>';
    });

    // Add warning if truncated or limited
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

// Bypass Manager Component
function BypassManagerComponent({ toast, bypass }) {
  const { rules, presets, status, loading, loadRules, loadPresets, loadStatus, createRule, updateRule, deleteRule, toggleRule, applyPreset } = bypass;
  const [showPresets, setShowPresets] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState({ pattern: '', is_regex: false, description: '', enabled: true });

  useEffect(() => { loadRules(); loadPresets(); loadStatus(); }, []);

  const handleSubmit = async () => {
    if (!formData.pattern.trim()) { toast('Pattern is required', 'error'); return; }
    if (editingRule) { await updateRule(editingRule.id, formData); setEditingRule(null); } else { await createRule(formData); }
    setFormData({ pattern: '', is_regex: false, description: '', enabled: true });
  };

  const handleEdit = (rule) => { setEditingRule(rule); setFormData({ pattern: rule.pattern, is_regex: rule.is_regex, description: rule.description || '', enabled: rule.enabled }); };
  const handleDelete = async (id) => { if (confirm('Delete this bypass rule?')) await deleteRule(id); };
  const handleApplyPreset = async (presetName) => { if (confirm(`Apply ${presetName} preset?`)) { await applyPreset(presetName); setShowPresets(false); } };
  const cancelEdit = () => { setEditingRule(null); setFormData({ pattern: '', is_regex: false, description: '', enabled: true }); };

  return React.createElement('div', { className: 'scp-pnl' },
    React.createElement('div', { className: 'scp-hdr' },
      React.createElement('h3', null, 'Proxy Bypass'),
      React.createElement('p', null, 'Exclude URLs from MITM interception'),
      status && status.status === 'active' && React.createElement('p', { style: { fontSize: '11px', color: 'var(--green)', marginTop: '6px' } },
        `Active: ${status.enabled_rules_count} rule${status.enabled_rules_count !== 1 ? 's' : ''} • Restart proxy to apply changes`)
    ),

    React.createElement('div', { className: 'scp-form' },
      React.createElement('input', {
        className: 'inp',
        style: { flex: 1, fontFamily: 'monospace', fontSize: '12px' },
        placeholder: editingRule ? 'Edit pattern' : '*.google.com or regex pattern',
        value: formData.pattern,
        onChange: e => setFormData({ ...formData, pattern: e.target.value })
      }),
      React.createElement('input', {
        className: 'inp',
        style: { width: '200px', fontSize: '12px' },
        placeholder: 'Description',
        value: formData.description,
        onChange: e => setFormData({ ...formData, description: e.target.value })
      }),
      React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', whiteSpace: 'nowrap', cursor: 'pointer' } },
        React.createElement('input', {
          type: 'checkbox',
          checked: formData.is_regex,
          onChange: e => setFormData({ ...formData, is_regex: e.target.checked })
        }),
        'Regex'
      ),
      React.createElement('button', {
        className: 'btn btn-p',
        onClick: handleSubmit,
        disabled: loading || !formData.pattern.trim()
      }, editingRule ? 'Update' : '+ Add'),
      editingRule && React.createElement('button', { className: 'btn btn-s', onClick: cancelEdit }, 'Cancel'),
      React.createElement('button', {
        className: 'btn btn-s',
        onClick: () => setShowPresets(!showPresets)
      }, showPresets ? 'Hide Presets' : 'Presets')
    ),

    showPresets && React.createElement('div', { style: { margin: '0 0 16px 0', padding: '12px', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '4px' } },
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' } },
        Object.entries(presets).map(([name, rules]) =>
          React.createElement('div', {
            key: name,
            style: { padding: '10px', background: 'var(--bg)', border: '1px solid var(--brd)', borderRadius: '3px', cursor: 'pointer' },
            onClick: () => handleApplyPreset(name)
          },
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' } },
              React.createElement('span', { style: { fontWeight: '600', fontSize: '12px', textTransform: 'capitalize' } }, name.replace(/_/g, ' ')),
              React.createElement('span', { style: { fontSize: '10px', padding: '2px 5px', background: 'var(--bg2)', borderRadius: '2px', color: 'var(--txt3)' } }, rules.length)
            ),
            React.createElement('div', { style: { fontSize: '10px', color: 'var(--txt3)' } },
              rules.slice(0, 2).map(r => r.pattern).join(', ') + (rules.length > 2 ? '...' : '')
            )
          )
        )
      )
    ),

    React.createElement('div', { className: 'scp-rules' },
      rules.length === 0 ?
        React.createElement('div', { className: 'empty', style: { padding: 30 } },
          React.createElement('span', null, 'No bypass rules')
        ) :
        rules.map(rule =>
          React.createElement('div', { key: rule.id, className: 'scp-rule' + (rule.enabled ? '' : ' dis') },
            React.createElement('input', {
              type: 'checkbox',
              checked: rule.enabled,
              onChange: () => toggleRule(rule.id),
              style: { cursor: 'pointer', marginRight: '12px' }
            }),
            React.createElement('div', { style: { flex: 1, minWidth: 0 } },
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
                React.createElement('code', { className: 'rul-pat' }, rule.pattern),
                rule.is_regex && React.createElement('span', {
                  style: {
                    fontSize: '9px',
                    padding: '1px 4px',
                    background: 'var(--primary)',
                    color: '#fff',
                    borderRadius: '2px',
                    fontWeight: '600'
                  }
                }, 'RE')
              ),
              rule.description && React.createElement('div', { style: { fontSize: '11px', color: 'var(--txt3)', marginTop: '2px' } }, rule.description)
            ),
            React.createElement('div', { className: 'rul-acts' },
              React.createElement('button', { onClick: () => handleEdit(rule), className: 'btn btn-sm btn-s' }, 'Edit'),
              React.createElement('button', { onClick: () => handleDelete(rule.id), className: 'btn btn-sm btn-d' }, '×')
            )
          )
        )
    )
  );
}

function Blackwire() {
  // Estado principal
  const [tab, setTab] = useState('projects');

  // Request UI state (requests list in hook)
  const [selReq, setSelReq] = useState(null);
  const [selReqFull, setSelReqFull] = useState(null);
  const [detTab, setDetTab] = useState('request');
  const [histSubTab, setHistSubTab] = useState('http'); // 'http' | 'ws' | 'sitemap'

  // Paginación (initialized after hooks below)
  const [smExpanded, setSmExpanded] = useState({});
  const [smSelNode, setSmSelNode] = useState(null);
  const [smFilterMethod, setSmFilterMethod] = useState('');
  const [smFilterStatus, setSmFilterStatus] = useState('');
  const [smFilterExt, setSmFilterExt] = useState('');
  const [smFilterText, setSmFilterText] = useState('');
  const [smShowStats, setSmShowStats] = useState(false);

  // Repeater UI state (most state in hook, but some UI-specific kept here for now)
  const [selRep, setSelRep] = useState(null);
  const [repBodyColor, setRepBodyColor] = useState(false);
  const [repRespFormat, setRepRespFormat] = useState('code');
  const [repReqs, setRepReqs] = useState([]); // Saved tabs list

  // Estado general
  const [appReady, setAppReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [themeId, setThemeId] = useLocalStorage('bw_theme', 'midnight');

  // Filtros / HTTPQL (initialized after hooks below)
  const [presets, setPresets] = useState([]);
  const [showPresets, setShowPresets] = useState(false);
  const [presetName, setPresetName] = useState('');
  const searchTimer = useRef(null);

  // Intercept UI state (most state in hook)
  const [selPend, setSelPend] = useState(null);

  // Scope UI state (rules are in hook)
  const [newPat, setNewPat] = useState('');
  const [newType, setNewType] = useState('include');

  // Projects
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Webhook UI state (extensions and requests are in hooks)
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

  // Chepy UI state (most state in hook)
  const [chepySubTab, setChepySubTab] = useState('cipher');

  // JWT Analyzer states
  const [jwtToken, setJwtToken] = useState('');
  const [jwtHeader, setJwtHeader] = useState('{}');
  const [jwtPayload, setJwtPayload] = useState('{}');
  const [jwtSignature, setJwtSignature] = useState('');

  // WebSocket UI state (most state in hook)
  const [selWsConn, setSelWsConn] = useState(null);
  const [selWsFrame, setSelWsFrame] = useState(null);

  // Collections UI state (most state in hook)
  const [selColl, setSelColl] = useState(null);
  const [collStep, setCollStep] = useState(0);
  const [showCollPick, setShowCollPick] = useState(null);
  const [collSubTab, setCollSubTab] = useState('collections');
  const [newRule, setNewRule] = useState({
    enabled: true,
    name: '',
    when: 'response',
    target: 'body',
    header: '',
    regex: '',
    group: 1,
    variable: ''
  });

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
  const histSearch = useBodySearch();
  const repSearch = useBodySearch();

  // Domain Hooks Initialization
  // Initialize toast first (needed by other hooks)
  const { toasts: hookToasts, toast: hookToast } = useToast();

  // Deobfuscator with progress tracking
  const deobfuscator = useDeobfuscator((progress) => {
    if (progress.stage === 'detecting') {
      hookToast(`Detecting obfuscation type: ${progress.obfuscationType || 'unknown'}...`, 'info');
    } else if (progress.stage === 'deobfuscating') {
      hookToast(`Deobfuscating... (${progress.iteration}/${progress.maxIterations})`, 'info');
    } else if (progress.stage === 'beautifying') {
      hookToast('Beautifying code...', 'info');
    }
  });

  // Initialize hooks that don't depend on others
  const git = useGit(hookToast);
  const scope = useScope(hookToast);
  const sessionRules = useSessionRules(hookToast);
  const extensions = useExtensions(hookToast);
  const intercept = useIntercept(hookToast);
  const chepy = useChepy(hookToast);
  const websockets = useWebSockets(hookToast);

  // Initialize hooks with dependencies (callback will be defined later via useEffect)
  const projects = useProjects(hookToast);
  const webhook = useWebhook(hookToast, extensions.extensions);
  const proxy = useProxy(hookToast, projects.currentProject);
  const requests = useRequests(hookToast);
  const repeater = useRepeater(hookToast);
  const collections = useCollections(hookToast, projects.currentProject);
  const intruder = useIntruder(hookToast);
  const sensitive = useSensitive(hookToast);
  const proxyConsole = useConsole();
  const bypass = useBypass(hookToast);

  // Initialize pagination after requests hook (needs requests.totalRequests)
  const pagination = usePagination({
    totalItems: requests.totalRequests,
    initialPageSize: 500
  });
  const { currentPage, pageSize, totalPages, setPageSize, setCurrentPage, goToPage: _goToPage, nextPage: _nextPage, prevPage: _prevPage, firstPage: _firstPage, lastPage: _lastPage } = pagination;

  // Aliases for request state
  const search = requests.search;
  const setSearch = requests.setSearch;
  const savedOnly = requests.savedOnly;
  const setSavedOnly = requests.setSavedOnly;
  const scopeOnly = requests.scopeOnly;
  const setScopeOnly = requests.setScopeOnly;
  const httpqlError = requests.httpqlError;
  const totalRequests = requests.totalRequests;

  // Sensitive UI state (most state in hook)
  const [sensSelResult, setSensSelResult] = useState(null);
  const [sensSubTab, setSensSubTab] = useState('logger');
  const sensDetailRef = useRef(null);
  const [sensSelDetail, setSensSelDetail] = useState(null);

  // Intruder UI state (most state in hook)
  const [intSubTab, setIntSubTab] = useState('positions');
  const [intSelResult, setIntSelResult] = useState(null);
  const intUrlRef = useRef(null);
  const intHeadersRef = useRef(null);
  const intHeadersHighlightRef = useRef(null);
  const intBodyRef = useRef(null);
  const [intAttacks, setIntAttacks] = useState([]);
  const [intSelAttack, setIntSelAttack] = useState(null);
  const [intSortCol, setIntSortCol] = useState('#');
  const [intSortDir, setIntSortDir] = useState('asc');
  const [intFilter, setIntFilter] = useState('');
  const [intSelPayloadSet, setIntSelPayloadSet] = useState(0);

  const wsRef = useRef(null);
  const repBodyEditRef = useRef(null);
  const repBodyCaretRef = useRef(null);
  const histContentRef = useRef(null);
  const repCntRef = useRef(null);
  const smContentRef = useRef(null);
  const chepyCntRef = useRef(null);
  const repHeadersRef = useRef(null);
  const repHeadersHighlightRef = useRef(null);
  const interceptHeadersRef = useRef(null);
  const interceptHeadersHighlightRef = useRef(null);
  const consoleEndRef = useRef(null);
  const webhookExt = extensions.extensions.find(e => e.name === 'webhook_site');

  const getSelectedText = () => {
    try {
      const sel = window.getSelection();
      if (!sel) return '';
      return sel.toString().trim();
    } catch (e) {
      return '';
    }
  };

  // Use toast from hook (keep old signature for compatibility)
  const toast = hookToast;
  const toasts = hookToasts;

  // Create aliases for hook properties to minimize code changes
  const prjs = projects.projects;
  const curPrj = projects.currentProject;
  const pxRun = proxy.isRunning;
  const pxPort = proxy.port;
  const pxMode = proxy.mode;
  const pxArgs = proxy.args;
  const setPxPort = proxy.setPort;
  const setPxMode = proxy.setMode;
  const setPxArgs = proxy.setArgs;
  const reqs = requests.requests;
  const commits = git.commits;
  const cmtMsg = git.commitMessage;
  const setCmtMsg = git.setCommitMessage;
  const scopeRules = scope.rules;
  const intOn = intercept.isEnabled;
  const setIntOn = intercept.setEnabled;
  const pending = intercept.pending;
  const editReq = intercept.editingRequest;
  const setEditReq = intercept.setEditingRequest;
  // repReqs is now UI state defined at line 245
  const repM = repeater.method;
  const repU = repeater.url;
  const repH = repeater.headers;
  const repB = repeater.body;
  const setRepM = repeater.setMethod;
  const setRepU = repeater.setUrl;
  const setRepH = repeater.setHeaders;
  const setRepB = repeater.setBody;
  const repResp = repeater.response;
  const setRepResp = repeater.setResponse;
  const repRespBody = repeater.respBody;
  const setRepRespBody = repeater.setRespBody;
  const repHistory = repeater.history || [];
  const setRepHistory = repeater.setHistory;
  const repHistoryIndex = repeater.historyIndex;
  const setRepHistoryIndex = repeater.setHistoryIndex;
  const repFollowRedirects = repeater.followRedirects;
  const setRepFollowRedirects = repeater.setFollowRedirects;
  const chepyIn = chepy.input;
  const chepyOps = chepy.operations || [];
  const chepyOut = chepy.output;
  const chepyErr = chepy.error;
  const chepyCat = chepy.categories || {};
  const chepySelCat = chepy.selectedCategory;
  const chepyBaking = chepy.isBaking;
  const setChepyIn = chepy.setInput;
  const setChepySelCat = chepy.setSelectedCategory;
  const wsConns = websockets.connections || [];
  const wsFrames = websockets.frames || [];
  const setWsFrames = websockets.setFrames;
  const wsResendMsg = websockets.resendMessage;
  const wsResendResp = websockets.resendResponse;
  const wsSending = websockets.isSending;
  const setWsResendMsg = websockets.setResendMessage;
  const colls = collections.collections || [];
  const collItems = collections.items || [];
  const collVars = collections.variables || {};
  const collResps = collections.responses || [];
  const collRunning = collections.isRunning;
  const setCollItems = collections.setItems;
  const setCollVars = collections.setVariables;
  const sessionRulesData = sessionRules.sessionRules || []; // Access array from hook
  const whkReqs = webhook.requests || [];
  const whkLoading = webhook.isLoading;
  const sensResults = sensitive.results || [];
  const sensScanning = sensitive.isScanning;
  const sensPct = sensitive.progress;
  const sensFilter = sensitive.filter;
  const sensUnique = sensitive.unique;
  const setSensFilter = sensitive.setFilter;
  const setSensUnique = sensitive.setUnique;
  const sensPatterns = sensitive.patterns || { general: [], tokens: [], urls: [], files: [] };
  const sensScopeOnly = sensitive.scopeOnly;
  const sensMaxSize = sensitive.maxSize;
  const sensEntropyThreshold = sensitive.entropyThreshold;
  const sensBatch = sensitive.batch;
  const setSensPatterns = sensitive.setPatterns;
  const setSensScopeOnly = sensitive.setScopeOnly;
  const setSensMaxSize = sensitive.setMaxSize;
  const setSensEntropyThreshold = sensitive.setEntropyThreshold;
  const setSensBatch = sensitive.setBatch;
  const sensStopRef = sensitive.stopRef;
  const intMethod = intruder.method;
  const intUrl = intruder.url;
  const intHeaders = intruder.headers;
  const intBody = intruder.body;
  const intPositions = intruder.positions || [];
  const intAttackType = intruder.attackType;
  const intPayloads = intruder.payloads || [];
  const intResults = intruder.results || [];
  const intRunning = intruder.isRunning;
  const intPct = intruder.progress;
  const intConcurrency = intruder.concurrency;
  const intDelay = intruder.delay;
  const intRandomDelay = intruder.randomDelay;
  const intDelayMin = intruder.delayMin;
  const intDelayMax = intruder.delayMax;
  const intFollowRedirects = intruder.followRedirects;
  const intTimeout = intruder.timeout;
  const intMaxRetries = intruder.maxRetries;
  const intStopRef = intruder.stopRef;
  const intTotal = intruder.total;
  const intDone = intruder.done;
  const intStartTime = intruder.startTime;
  const setIntMethod = intruder.setMethod;
  const setIntUrl = intruder.setUrl;
  const setIntHeaders = intruder.setHeaders;
  const setIntBody = intruder.setBody;
  const setIntPositions = intruder.setPositions;
  const setIntAttackType = intruder.setAttackType;
  const setIntPayloads = intruder.setPayloads;
  const setIntConcurrency = intruder.setConcurrency;
  const setIntDelay = intruder.setDelay;
  const setIntRandomDelay = intruder.setRandomDelay;
  const setIntDelayMin = intruder.setDelayMin;
  const setIntDelayMax = intruder.setDelayMax;
  const setIntFollowRedirects = intruder.setFollowRedirects;
  const setIntTimeout = intruder.setTimeout;
  const setIntMaxRetries = intruder.setMaxRetries;

  // Additional setter aliases for direct state manipulation
  const setPending = intercept.setPending;
  const setChepyBaking = chepy.setBaking;
  const setChepyCat = chepy.setCategories;
  const setChepyErr = chepy.setError;
  const setChepyOps = chepy.setOperations;
  const setChepyOut = chepy.setOutput;
  const setCollResps = collections.setResponses;
  const setCollRunning = collections.setRunning;
  const setIntDone = intruder.setDone;
  const setIntPct = intruder.setProgress;
  const setIntResults = intruder.setResults;
  const setIntRunning = intruder.setRunning;
  const setIntStartTime = intruder.setStartTime;
  const setIntTotal = intruder.setTotal;
  const setSensPct = sensitive.setProgress;
  const setSensResults = sensitive.setResults;
  const setSensScanning = sensitive.setScanning;
  const setWsConns = websockets.setConnections;
  const setWsResendResp = websockets.setResendResp;
  const setWsSending = websockets.setSending;
  const setSessionRules = sessionRules.setSessionRules;

  useEffect(() => {
    Promise.all([projects.load(), loadCur()]).finally(() => setAppReady(true));
    connectWs();
    return () => _optionalChain([wsRef, 'access', _2 => _2.current, 'optionalAccess', _3 => _3.close, 'call', _4 => _4()]);
  }, []);

  useEffect(() => {
    const handler = e => {
      // Skip if context menu was already handled by a specific element
      if (e.defaultPrevented) return;

      const target = e.target;
      // Skip if inside input fields unless there's text selected
      const selected = getSelectedText();
      if (!selected && target && target.closest('input, textarea, [contenteditable="true"]')) return;

      e.preventDefault();

      // Build context based on current tab and state
      let contextSource = tab;
      let contextRequest = {};
      let contextNormalized = {};

      if (selected) {
        contextSource = 'selection';
        contextRequest = { body: selected };
        contextNormalized = { id: 'selection', method: 'TEXT', url: '', headers: {}, body: selected, source: 'selection' };
      } else {
        // Tab-specific context
        switch (tab) {
          case 'history':
            if (selReqFull || selReq) {
              const req = selReqFull || selReq;
              contextSource = 'history';
              contextRequest = req;
              contextNormalized = normalizeRequest(req, 'history');
            }
            break;
          case 'repeater':
            contextSource = 'repeater';
            contextRequest = { method: repM, url: repU, headers: repH, body: repB };
            contextNormalized = { method: repM, url: repU, headers: parseHeaders(repH), body: repB };
            if (repResp) {
              contextRequest.response_body = repRespBody;
              contextRequest.response_headers = repResp.headers;
              contextRequest.response_status = repResp.status_code;
            }
            break;
          case 'intercept':
            if (editReq) {
              contextSource = 'intercept';
              contextRequest = editReq;
              contextNormalized = normalizeRequest(editReq, 'intercept');
            }
            break;
          case 'collections':
            if (collItems.length > 0 && collStep >= 0 && collItems[collStep]) {
              const item = collItems[collStep];
              contextSource = 'collection';
              contextRequest = item;
              contextNormalized = normalizeRequest(item, 'collection');
            }
            break;
          case 'chepy':
            contextSource = 'chepy';
            contextRequest = { body: chepyOut };
            contextNormalized = { body: chepyOut };
            break;
          case 'websockets':
            if (selWsFrame) {
              contextSource = 'websocket';
              contextRequest = { ...selWsFrame, url: selWsConn, method: 'WS', body: selWsFrame.content };
              contextNormalized = normalizeRequest(contextRequest, 'websocket');
            }
            break;
        }
      }

      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        source: contextSource,
        request: contextRequest,
        normalized: contextNormalized,
        currentTab: tab
      });
    };
    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, [tab, selReq, selReqFull, repM, repU, repH, repB, repResp, repRespBody, editReq, collItems, collStep, chepyOut, selWsFrame, selWsConn, selRep]);

  // Load data when project changes
  useEffect(() => {
    if (!curPrj) return;
    requests.loadRequests(currentPage, pageSize);
    repeater.loadTabs();
    scope.loadRules();
    proxy.loadStatus();
    git.loadHistory();
    // Secondary data loads
    setTimeout(() => {
      collections.load();
      extensions.loadExtensions();
    }, 0);
  }, [curPrj]);

  // Reset to page 1 when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    } else {
      // If already on page 1, reload with new filters
      if (curPrj && tab === 'history') {
        requests.loadRequests(1, pageSize);
      }
    }
  }, [savedOnly, scopeOnly, search]);

  // Reload when page size changes
  useEffect(() => {
    if (curPrj && tab === 'history') {
      requests.loadRequests(currentPage, pageSize);
    }
  }, [pageSize]);

  // Reload when page number changes
  useEffect(() => {
    if (curPrj && tab === 'history') {
      requests.loadRequests(currentPage, pageSize);
    }
  }, [currentPage]);

  // Auto-refresh requests in real-time (every 5 seconds, WebSocket handles immediate updates)
  useEffect(() => {
    if (!curPrj || tab !== 'history') return;

    const interval = setInterval(() => {
      // Reload to catch any requests that might have been missed by WebSocket
      requests.loadRequests(currentPage, pageSize);
    }, 5000); // Refresh every 5 seconds as backup to WebSocket

    return () => clearInterval(interval);
  }, [curPrj, tab, currentPage, pageSize]);

  // Sync repeater saved tabs
  useEffect(() => {
    if (repeater.savedTabs) {
      setRepReqs(repeater.savedTabs);
    }
  }, [repeater.savedTabs]);

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
    const el = histSearch.contentRef.current;
    if (el) {
      const cur = el.querySelector('.search-cur');
      if (cur) cur.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [histSearch.matchIndex, histSearch.searchTerm]);

  useEffect(() => {
    const el = repSearch.contentRef.current;
    if (el) {
      const cur = el.querySelector('.search-cur');
      if (cur) cur.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [repSearch.matchIndex, repSearch.searchTerm]);

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
    requestService.getDetail(selReq.id).then(r => {
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
      chepy.loadOperations();
    }
  }, [tab]);

  // Auto-scroll console to bottom when new logs arrive
  useEffect(() => {
    if (proxyConsole.autoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'instant' });
    }
  }, [proxyConsole.filteredLogs.length, proxyConsole.autoScroll]);

  useEffect(() => {
    setWhkApiKey(_optionalChain([webhookExt, 'optionalAccess', _6 => _6.config, 'optionalAccess', _7 => _7.api_key]) || '');
  }, [_optionalChain([webhookExt, 'optionalAccess', _8 => _8.config, 'optionalAccess', _9 => _9.api_key])]);

  // Cargar webhook requests desde DB cuando el token esté disponible (persiste entre reinicios)
  useEffect(() => {
    if (!_optionalChain([webhookExt, 'optionalAccess', _10 => _10.enabled]) || !_optionalChain([webhookExt, 'optionalAccess', _11 => _11.config, 'optionalAccess', _12 => _12.token_id])) return;
    webhook.loadRequests(webhookExt.config.token_id);
  }, [_optionalChain([webhookExt, 'optionalAccess', _13 => _13.enabled]), _optionalChain([webhookExt, 'optionalAccess', _14 => _14.config, 'optionalAccess', _15 => _15.token_id])]);

  // Auto-refresh desde webhook.site cuando estemos en las pestañas relevantes
  // NOTA: Deshabilitado para la pestaña 'webhook_site' ya que la UI personalizada maneja su propio refresh
  useEffect(() => {
    // Solo auto-refresh en 'extensions' tab, no en la tab personalizada
    if (tab !== 'extensions') return;
    if (!_optionalChain([webhookExt, 'optionalAccess', _16 => _16.enabled]) || !_optionalChain([webhookExt, 'optionalAccess', _17 => _17.config, 'optionalAccess', _18 => _18.token_id])) return;
    const id = setInterval(() => webhook.refresh(webhookExt.config.token_id, true), 15000); // silent refresh
    return () => clearInterval(id);
  }, [tab, _optionalChain([webhookExt, 'optionalAccess', _19 => _19.enabled]), _optionalChain([webhookExt, 'optionalAccess', _20 => _20.config, 'optionalAccess', _21 => _21.token_id])]);

  // Debounced HTTPQL search
  useEffect(() => {
    if (!curPrj) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => requests.loadRequests(currentPage, pageSize), 300);
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
      try {
        const m = JSON.parse(e.data);
        if (m.type === 'new_request') {
          // Immediately add new request to the list if on history tab
          if (tab === 'history' && m.data) {
            requests.addRequest(m.data);
          }
        }
        if (m.type === 'intercept_new') setPending(p => [...p, m.data]);
        if (m.type === 'intercept_status') setIntOn(m.enabled);
        if (m.type === 'intercept_forwarded' || m.type === 'intercept_dropped')
          setPending(p => p.filter(r => r.id !== m.request_id));
        if (m.type === 'intercept_all_forwarded' || m.type === 'intercept_all_dropped')
          setPending([]);
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    };
    ws.onclose = () => setTimeout(connectWs, 3000);
    wsRef.current = ws;
  };

  const loadCur = async () => {
    const r = await projectService.getCurrent();
    if (r.project) {
      await projects.loadCurrent(); // Refresh currentProject state in hook
      intercept.setEnabled(_optionalChain([r, 'access', _22 => _22.config, 'optionalAccess', _23 => _23.intercept_enabled]) || false);
      scope.setRules(_optionalChain([r, 'access', _24 => _24.config, 'optionalAccess', _25 => _25.scope_rules]) || []);
      proxy.setPort(_optionalChain([r, 'access', _26 => _26.config, 'optionalAccess', _27 => _27.proxy_port]) || 8080);
      proxy.setMode(_optionalChain([r, 'access', _28 => _28.config, 'optionalAccess', _29 => _29.proxy_mode]) || 'regular');
      proxy.setArgs(_optionalChain([r, 'access', _30 => _30.config, 'optionalAccess', _31 => _31.proxy_args]) || '');
      setTab('history');
    }
  };

  // Wrapper for loadReqs (kept for compatibility)
  const loadReqs = async (query, ast, page) => {
    // Note: requests hook now manages search/filters internally
    await requests.loadRequests(page !== undefined ? page : currentPage, pageSize);
  };

  // Pagination wrapper functions - state changes trigger useEffect to load requests
  const goToPage = (page) => {
    _goToPage(page);
  };
  const nextPage = () => {
    if (currentPage < totalPages) {
      _nextPage();
    }
  };
  const prevPage = () => {
    if (currentPage > 1) {
      _prevPage();
    }
  };
  const firstPage = () => _firstPage();
  const lastPage = () => _lastPage();

  // These functions are now in hooks (repeater.load, git.loadHistory, scope.loadRules, extensions.loadExtensions, proxy.checkStatus)

  // Webhook wrapper functions (delegate to hook)
  const loadWebhookLocal = () => webhook.loadRequests(_optionalChain([webhookExt, 'optionalAccess', _32 => _32.config, 'optionalAccess', _33 => _33.token_id]));
  const refreshWebhook = (silent = false) => webhook.refresh(_optionalChain([webhookExt, 'optionalAccess', _34 => _34.config, 'optionalAccess', _35 => _35.token_id]));

  const createWebhookToken = async () => {
    const success = await webhook.createToken();
    if (success) {
      await extensions.loadExtensions();
      await webhook.loadRequests(_optionalChain([webhookExt, 'optionalAccess', _36 => _36.config, 'optionalAccess', _37 => _37.token_id]));
    }
  };

  const clearWebhookHistory = async () => {
    await webhook.clearHistory();
    setSelWhkReq(null);
  };

  const whkToRepeater = r => {
    toRep({ method: r.method || 'GET', url: r.url || '', headers: r.headers || {}, body: r.content || null });
  };

  // whkContextAction removed - unified into handleContextAction

  const filteredWhk = whkReqs.filter(r => {
    if (whkSearch && !(r.url || '').toLowerCase().includes(whkSearch.toLowerCase()) &&
        !(r.method || '').toLowerCase().includes(whkSearch.toLowerCase()) &&
        !(r.ip || '').toLowerCase().includes(whkSearch.toLowerCase())) return false;
    return true;
  });

  const selectPrj = async n => {
    const success = await projects.select(n);
    if (success) {
      await loadCur();
      setTab('history');
    }
  };

  const createPrj = async () => {
    const name = newName.trim();
    if (!name) return;
    if (/[\\/]/.test(name)) {
      toast('Project name cannot contain / or \\', 'error');
      return;
    }
    const r = await projectService.create(name, newDesc);
    if (!r || r.status !== 'created') {
      toast(_optionalChain([r, 'optionalAccess', _38 => _38.detail]) || 'Failed to create project', 'error');
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
    const r = await projectService.delete(n);
    if (r && (r.status === 'deleted' || r.status === 'ok')) {
      if (_optionalChain([curPrj, 'optionalAccess', _39 => _39.project]) === n) await projects.loadCurrent();
      await loadPrjs();
      toast('Deleted', 'success');
    } else {
      toast(_optionalChain([r, 'optionalAccess', _40 => _40.detail]) || 'Failed to delete project', 'error');
    }
  };

  const exportProject = async n => {
    projectService.exportJSON(n);
    toast('Exporting project: ' + n, 'success');
  };

  const exportProjectBurp = async n => {
    projectService.exportBurp(n);
    toast('Exporting to Burp Suite format: ' + n, 'success');
  };

  const importBurpXML = async n => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml,application/xml,text/xml';
    input.onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        toast('Importing Burp Suite XML...', 'info');
        const data = await projectService.importBurp(n, file);

        if (data.status === 'success') {
          toast(`Imported ${data.imported} of ${data.total} items from Burp Suite`, 'success');
          // Recargar datos si es el proyecto actual
          if (_optionalChain([curPrj, 'optionalAccess', _41 => _41.project]) === n) {
            await loadReqs();
          }
        } else {
          toast(data.detail || 'Import failed', 'error');
        }
      } catch (err) {
        toast('Error importing Burp XML: ' + err.message, 'error');
      }
    };
    input.click();
  };

  const importAsNewProject = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Validar estructura
        if (!data.version || !data.data || !data.project_name) {
          toast('Invalid export file format', 'error');
          return;
        }

        // Importar como nuevo proyecto
        const r = await projectService.importAsNew(file);
        if (r && r.status === 'imported') {
          toast(`Project "${data.project_name}" created successfully! ${_optionalChain([r, 'access', _42 => _42.stats, 'optionalAccess', _43 => _43.total_requests]) || 0} requests imported.`, 'success');
          await loadPrjs();
        } else {
          toast('Import failed', 'error');
        }
      } catch (e) {
        toast('Error reading file: ' + e.message, 'error');
      }
    };
    input.click();
  };

  const importProject = async (n, clearExisting = false) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Validar estructura
        if (!data.version || !data.data) {
          toast('Invalid export file format', 'error');
          return;
        }

        // Preguntar si quiere merge o replace
        const action = clearExisting ? 'replace' : 'merge';
        if (!confirm(`${clearExisting ? 'Replace all data' : 'Merge data'} in project "${n}"?\n\nThis will ${clearExisting ? 'DELETE existing data and' : ''} import:\n- ${_optionalChain([data, 'access', _44 => _44.stats, 'optionalAccess', _45 => _45.total_requests]) || 0} requests\n- ${_optionalChain([data, 'access', _46 => _46.stats, 'optionalAccess', _47 => _47.total_repeater]) || 0} repeater items\n- ${_optionalChain([data, 'access', _48 => _48.stats, 'optionalAccess', _49 => _49.total_collections]) || 0} collections`)) {
          return;
        }

        const r = await projectService.importTo(n, file, clearExisting);
        if (r && r.status === 'imported') {
          toast(`${action === 'replace' ? 'Replaced' : 'Merged'} successfully!`, 'success');
          // Recargar datos si es el proyecto actual
          if (_optionalChain([curPrj, 'optionalAccess', _50 => _50.project]) === n) {
            await loadReqs();
            await loadRep();
            await loadColls();
          }
        } else {
          toast(_optionalChain([r, 'optionalAccess', _51 => _51.detail]) || 'Import failed', 'error');
        }
      } catch (err) {
        toast('Invalid JSON file: ' + err.message, 'error');
      }
    };
    input.click();
  };

  const startPx = async () => {
    setLoading(true);
    await proxy.start();
    setLoading(false);
  };

  const advanceQueue = (id, remaining) => {
    if (_optionalChain([selPend, 'optionalAccess', _52 => _52.id]) !== id) return;
    const next = _nullishCoalesce(remaining[0], () => ( null));
    setSelPend(next);
    setEditReq(next ? { ...next, rawHeaders: fmtH(next.headers, next.url) } : null);
  };

  const fwdReq = async (id, mod = null) => {
    await intercept.forward(id, mod);
    const remaining = intercept.pending.filter(r => r.id !== id);
    advanceQueue(id, remaining);
  };

  const dropReq = async id => {
    await intercept.drop(id);
    const remaining = intercept.pending.filter(r => r.id !== id);
    advanceQueue(id, remaining);
  };

  const fwdAll = async () => {
    await intercept.forwardAll();
    setSelPend(null);
  };

  const dropAll = async () => {
    await intercept.dropAll();
    setSelPend(null);
  };

  const addRule = async () => {
    if (!newPat.trim()) return;
    await scope.addRule(newPat, newType);
    setNewPat('');
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

  // Chepy functions
  const loadChepyOps = async () => {
    const data = await chepyService.getOperations();
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
      const data = await chepyService.bake(chepyIn, chepyOps.map(op => ({ name: op.name, args: op.args })));
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
    const data = await websocketService.getConnections();
    setWsConns(Array.isArray(data) ? data : []);
  };

  const loadWsFrames = async url => {
    setSelWsConn(url);
    const data = await websocketService.getFrames(url);
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
    const r = await websocketService.resendFrame(selWsConn, wsResendMsg);
    setWsResendResp(r);
    setWsSending(false);
    if (r.error) toast('WS Error: ' + r.error, 'error');
    else toast('Frame sent', 'success');
  };

  // Collections functions (delegated to hook)
  const loadColls = async () => {
    await collections.load();
  };

  const createColl = async () => {
    const n = prompt('Collection name:');
    if (!n) return;
    const r = await collectionService.create(n, '');
    await loadColls();
    if (r.id) { setSelColl(r.id); loadCollItems(r.id); }
    toast('Collection created', 'success');
  };

  const deleteColl = async id => {
    if (!confirm('Delete collection?')) return;
    await collectionService.delete(id);
    if (selColl === id) { setSelColl(null); setCollItems([]); }
    await loadColls();
    toast('Deleted', 'success');
  };

  const loadCollItems = async cid => {
    setSelColl(cid);
    const data = await collectionService.getItems(cid);
    setCollItems(Array.isArray(data) ? data : []);
    setCollStep(0);
    setCollVars({});
    setCollResps({});
  };

  const addToCollection = async (collId, req) => {
    const headers = req.headers || {};
    await collectionService.addItem(collId, {
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
    await collectionService.deleteItem(cid, iid);
    loadCollItems(cid);
  };

  const updateCollItemExtracts = async (cid, iid, extracts) => {
    await collectionService.updateItem(cid, iid, extracts);
    loadCollItems(cid);
  };

  const executeCollStep = async () => {
    if (!selColl || collStep >= collItems.length) return;
    const item = collItems[collStep];
    setCollRunning(true);
    const r = await collectionService.executeItem(selColl, item.id, collVars);
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

  // Session Rules
  const loadSessionRules = async () => {
    const rules = await sessionService.list();
    setSessionRules(rules || []);
  };

  const addSessionRule = async () => {
    if (!newRule.name || !newRule.regex || !newRule.variable) {
      toast('Name, regex, and variable are required', 'error');
      return;
    }
    await sessionService.addRule(newRule);
    setNewRule({
      enabled: true,
      name: '',
      when: 'response',
      target: 'body',
      header: '',
      regex: '',
      group: 1,
      variable: ''
    });
    loadSessionRules();
    toast('Rule added', 'success');
  };

  const deleteSessionRule = async (id) => {
    await sessionService.deleteRule(id);
    loadSessionRules();
    toast('Rule deleted', 'success');
  };

  const toggleSessionRule = async (id, enabled) => {
    await sessionService.toggleRule(id, enabled);
    loadSessionRules();
    toast('Rule ' + (enabled ? 'enabled' : 'disabled'), 'success');
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
      // Convert headers to string if they're stored as object
      setRepH(typeof item.headers === 'string' ? item.headers : Object.entries(item.headers || {}).map(([k, v]) => k + ': ' + v).join('\n'));
      setRepB(item.body || '');
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
    const r = await repeaterService.sendRaw(requestData.method, requestData.url, requestData.headers, repB || null, repFollowRedirects);
    setRepResp(r);
    setRepRespBody(r.body || '');
    setLoading(false);

    // Guardar en historial de navegación
    saveToHistory(requestData, r);

    if (selRep) {
      // Actualizar el tab existente con la request/response más reciente
      await repeaterService.update(selRep, { method: repM, url: repU, headers: h, body: repB, last_response: r });
      const items = await repeaterService.list();
      setRepReqs(items);
    } else {
      // Sin tab activo: crear uno nuevo
      let host = repU;
      try { host = new URL(repU).host; } catch (e) {}
      const timestamp = new Date().toLocaleTimeString();
      const autoName = `${repM} ${host} [${timestamp}]`;
      const newItem = await repeaterService.save(autoName, repM, repU, h, repB, r);
      const items = await repeaterService.list();
      setRepReqs(items);
      if (newItem && newItem.id) setSelRep(newItem.id);
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
    const r = await repeaterService.sendRaw(requestData.method, requestData.url, requestData.headers, requestData.body, false);
    setRepResp(r);
    setRepRespBody(r.body || '');
    setLoading(false);
    saveToHistory(requestData, r);
  };

  const toRep = async r => {
    const url = r.url || '';
    const hdrs = { ...(r.headers || {}) };
    if (url && !Object.keys(hdrs).some(k => /^host$/i.test(k))) {
      try { hdrs['Host'] = new URL(url).host; } catch (e) {}
    }
    let host = url;
    try { host = new URL(url).host; } catch (e) {}
    const name = `${r.method} ${host}`;
    const newItem = await repeaterService.save(name, r.method, url, hdrs, r.body || null, null);
    const items = await repeaterService.list();
    setRepReqs(items);
    setRepM(r.method);
    setRepU(url);
    setRepH(Object.entries(hdrs).map(([k, v]) => k + ': ' + v).join('\n'));
    setRepB(r.body || '');
    setRepResp(null);
    setRepRespBody('');
    setRepHistory([]);
    setRepHistoryIndex(-1);
    if (newItem && newItem.id) setSelRep(newItem.id);
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
        const reqData = buildIntRequest(combo, intUrl, intHeaders, intBody, intMethod);
        let retries = 0;
        let resp;
        while (true) {
          try {
            resp = await repeaterService.sendRaw(reqData.method, reqData.url, reqData.headers, reqData.body, intFollowRedirects);
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
      const r = await intruderService.listAttacks();
      setIntAttacks(Array.isArray(r) ? r : []);
    } catch (e) { setIntAttacks([]); }
  };

  const saveIntAttack = async (name) => {
    const config = { method: intMethod, url: intUrl, headers: intHeaders, body: intBody, attackType: intAttackType,
      payloads: intPayloads, concurrency: intConcurrency, delay: intDelay, randomDelay: intRandomDelay,
      delayMin: intDelayMin, delayMax: intDelayMax, followRedirects: intFollowRedirects, timeout: intTimeout, maxRetries: intMaxRetries };
    const r = await intruderService.saveAttack(name, config, intResults, intResults.length);
    if (r.id) {
      setIntSelAttack(r.id);
      loadIntAttacks();
      toast('Attack saved', 'success');
    }
  };

  const loadIntAttack = async (id) => {
    const r = await intruderService.loadAttack(id);
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
    await intruderService.updateAttack(id, n);
    loadIntAttacks();
  };

  const deleteIntAttack = async (id) => {
    await intruderService.deleteAttack(id);
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
        intruderService.updateAttack(intSelAttack, null, config, intResults).then(() => loadIntAttacks());
      } else {
        // Create new
        intruderService.saveAttack(name, config, intResults, intResults.length).then(r => {
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
    await repeaterService.save(n, repM, repU, h, repB, null);
    await loadRep();
    toast('Saved', 'success');
  };

  const loadRep = async () => {
    const items = await repeaterService.list();
    setRepReqs(items);
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
    setRepHistory([]);
    setRepHistoryIndex(-1);
  };

  const renameRepItem = async id => {
    const item = repReqs.find(r => r.id === id);
    if (!item) return;
    const n = prompt('Rename:', item.name);
    if (!n || n === item.name) return;
    await repeaterService.update(id, n);
    await loadRep();
    toast('Renamed', 'success');
  };

  const delRepItem = async id => {
    await repeaterService.delete(id);
    if (selRep === id) setSelRep(null);
    await loadRep();
    toast('Deleted', 'success');
  };

  const commit = async () => {
    await git.createCommit();
  };

  // Auto-commit con Ctrl+S
  const autoCommit = async () => {
    await git.autoCommit();
  };

  const togSave = async id => {
    await requestService.toggleSave(id);
    // Actualizar también selReq si es el request activo
    if (_optionalChain([selReq, 'optionalAccess', _53 => _53.id]) === id) setSelReq(prev => ({ ...prev, saved: !prev.saved }));
    // Reload requests to refresh the state
    loadReqs();
  };

  const delReq = async id => {
    await requestService.delete(id);
    await loadReqs();
    if (_optionalChain([selReq, 'optionalAccess', _54 => _54.id]) === id) setSelReq(null);
  };

  const clearHist = async () => {
    if (!confirm('Clear unsaved?')) return;
    await requestService.clearUnsaved();
    loadReqs();
    toast('Cleared', 'success');
  };

  const togExtEnabled = async (name, enabled) => {
    const ext = extensions.extensions.find(e => e.name === name);
    if (!ext) return;
    const newCfg = { ...ext.config, enabled };
    await extensionService.updateConfig(name, newCfg);
    await extensions.loadExtensions();
    toast('Extension ' + (enabled ? 'enabled' : 'disabled'), 'success');
  };

  const updateExtCfg = async (name, cfg) => {
    await extensionService.updateConfig(name, cfg);
    await extensions.loadExtensions();
    toast('Extension updated', 'success');
  };

  const saveProxyCfg = async () => {
    if (!curPrj) return;
    const r = await projectService.getCurrent();
    if (!r.config) return;
    r.config.proxy_port = pxPort;
    r.config.proxy_mode = pxMode;
    r.config.proxy_args = pxArgs;
    await save_project_config(curPrj.project, r.config);
    toast('Proxy config saved', 'success');
    setShowProxyCfg(false);
  };

  const save_project_config = async (name, config) => {
    await projectService.updateConfig(name, config);
  };

  // ===== EXTENSION UI COMPONENTS =====

  function MatchReplaceUI({ ext, updateExtCfg }) {
    const rules = _optionalChain([ext, 'access', _55 => _55.config, 'optionalAccess', _56 => _56.rules]) || [];

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

  // Registry de componentes de extensión custom (solo para UIs complejas)
  const EXTENSION_CUSTOM_COMPONENTS = {
    'match_replace': MatchReplaceUI,
  };

  // Componente genérico schema-driven para extensiones simples
  function SchemaBasedUI({ ext, updateExtCfg }) {
    const schema = ext.ui_schema;
    const config = ext.config || {};

    if (!schema || !schema.fields) {
      return (
        React.createElement('div', { style: { padding: '20px', color: 'var(--txt3)', fontSize: '11px' },}, "No UI schema defined for this extension."

        )
      );
    }

    const handleFieldChange = (fieldName, value) => {
      updateExtCfg(ext.name, { ...config, [fieldName]: value });
    };

    return (
      React.createElement('div', { style: { marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--brd)' },}
        , schema.fields.map(field => (
          React.createElement('div', { key: field.name, style: { marginBottom: '12px' },}
            , React.createElement('label', { style: { display: 'block', fontSize: '11px', color: 'var(--txt2)', marginBottom: '6px' },}
              , field.label
              , field.required && React.createElement('span', { style: { color: 'var(--red)' },}, " *" )
            )

            , (field.type === 'text' || field.type === 'password') && (
              React.createElement('input', {
                className: "inp",
                type: field.type,
                placeholder: field.placeholder || '',
                value: config[field.name] !== undefined ? config[field.name] : (field.default || ''),
                onChange: e => handleFieldChange(field.name, e.target.value),}
              )
            )

            , field.type === 'textarea' && (
              React.createElement('textarea', {
                className: "inp",
                placeholder: field.placeholder || '',
                value: config[field.name] !== undefined ? config[field.name] : (field.default || ''),
                onChange: e => handleFieldChange(field.name, e.target.value),
                rows: field.rows || 4,}
              )
            )

            , field.type === 'number' && (
              React.createElement('input', {
                className: "inp",
                type: "number",
                placeholder: field.placeholder || '',
                value: config[field.name] !== undefined ? config[field.name] : (field.default || 0),
                onChange: e => handleFieldChange(field.name, parseInt(e.target.value) || 0),
                min: field.min,
                max: field.max,}
              )
            )

            , field.type === 'checkbox' && (
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' },}
                , React.createElement('input', {
                  type: "checkbox",
                  checked: config[field.name] !== undefined ? config[field.name] : (field.default || false),
                  onChange: e => handleFieldChange(field.name, e.target.checked),}
                )
                , field.help && React.createElement('span', { style: { fontSize: '10px', color: 'var(--txt3)' },}, field.help)
              )
            )

            , field.type === 'select' && (
              React.createElement('select', {
                className: "inp",
                value: config[field.name] !== undefined ? config[field.name] : (field.default || ''),
                onChange: e => handleFieldChange(field.name, e.target.value),}

                , field.options && field.options.map(opt => (
                  React.createElement('option', { key: opt.value, value: opt.value,}, opt.label)
                ))
              )
            )

            , field.help && field.type !== 'checkbox' && (
              React.createElement('div', { style: { fontSize: '10px', color: 'var(--txt3)', marginTop: '4px' },}
                , field.help
              )
            )
          )
        ))
      )
    );
  }

  // Componente para cargar UIs dinámicas desde archivos .ui.jsx
  function DynamicExtensionUI({ ext, updateExtCfg, toast, ...otherProps }) {
    const [component, setComponent] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
      const loadUI = async () => {
        try {
          setLoading(true);
          setError(null);

          // Fetch del archivo .ui.js compilado
          const uiCode = await extensionService.getUI(ext.name);

          // Inicializar namespace global si no existe
          if (!window.BlackwireExtensions) {
            window.BlackwireExtensions = {};
          }

          // Ejecutar el código del componente
          // El código debe registrar una función en window.BlackwireExtensions[ext.name]
          eval(uiCode);

          // Verificar que se registró correctamente
          if (typeof window.BlackwireExtensions[ext.name] !== 'function') {
            throw new Error('Extension UI did not register properly. Must define window.BlackwireExtensions["' + ext.name + '"]');
          }

          // Obtener el componente
          const ComponentFunc = window.BlackwireExtensions[ext.name];
          setComponent(() => ComponentFunc);
          setLoading(false);
        } catch (err) {
          console.error('Error loading dynamic extension UI:', err);
          setError(err.message);
          setLoading(false);
        }
      };

      loadUI();
    }, [ext.name]);

    if (loading) {
      return (
        React.createElement('div', { style: { padding: '20px', color: 'var(--txt3)', fontSize: '11px' },}, "Loading custom UI..."

        )
      );
    }

    if (error) {
      return (
        React.createElement('div', { style: { padding: '20px', color: 'var(--red)', fontSize: '11px' },}, "Error loading custom UI: "
              , error
        )
      );
    }

    if (!component) {
      return (
        React.createElement('div', { style: { padding: '20px', color: 'var(--txt3)', fontSize: '11px' },}, "No custom UI available"

        )
      );
    }

    // Renderizar el componente dinámico con todas las props
    return React.createElement(component, { ext, updateExtCfg, toast, ...otherProps });
  }

  // Colorea cualquier body inteligentemente detectando el lenguaje
  const colorizeBody = text => {
    if (!text) return { text: text, html: false };

    const lang = detectLanguage(text);
    if (!lang) return { text: text, html: false };

    switch (lang) {
      case 'json': return { text: syntaxHighlightJSON(text), html: true };
      case 'xml': return { text: syntaxHighlightXML(text), html: true };
      case 'html': return { text: syntaxHighlightHTML(text), html: true };
      case 'css': return { text: syntaxHighlightCSS(text), html: true };
      case 'javascript': return { text: syntaxHighlightJS(text), html: true };
      case 'python': return { text: syntaxHighlightPython(text), html: true };
      case 'php': return { text: syntaxHighlightPHP(text), html: true };
      case 'sql': return { text: syntaxHighlightSQL(text), html: true };
      case 'yaml': return { text: syntaxHighlightYAML(text), html: true };
      case 'graphql': return { text: syntaxHighlightGraphQL(text), html: true };
      case 'shell': return { text: syntaxHighlightShell(text), html: true };
      case 'protobuf': return { text: syntaxHighlightProto(text), html: true };
      default: return { text: text, html: false };
    }
  };

  const formatBody = (body, format) => {
    if (!body) return { text: body, html: false };

    if (format === 'deminify') {
      // Only beautify (not deobfuscate) in History view for performance
      // User can manually deobfuscate in Repeater with the Deminify button
      const beautified = beautifyJs(body);
      return { text: syntaxHighlightJS(beautified), html: true };
    }

    if (format === 'pretty') {
      const lang = detectLanguage(body);
      if (!lang) return { text: body, html: false };

      const formatted = prettyPrint(body);

      switch (lang) {
        case 'json': return { text: syntaxHighlightJSON(formatted), html: true };
        case 'xml': return { text: syntaxHighlightXML(formatted), html: true };
        case 'html': return { text: syntaxHighlightHTML(formatted), html: true };
        case 'css': return { text: syntaxHighlightCSS(formatted), html: true };
        case 'javascript': return { text: syntaxHighlightJS(formatted), html: true };
        case 'python': return { text: syntaxHighlightPython(formatted), html: true };
        case 'php': return { text: syntaxHighlightPHP(formatted), html: true };
        case 'sql': return { text: syntaxHighlightSQL(formatted), html: true };
        case 'yaml': return { text: syntaxHighlightYAML(formatted), html: true };
        case 'graphql': return { text: syntaxHighlightGraphQL(formatted), html: true };
        case 'shell': return { text: syntaxHighlightShell(formatted), html: true };
        case 'protobuf': return { text: syntaxHighlightProto(formatted), html: true };
        default: return { text: formatted, html: false };
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
    // Always update innerHTML to ensure content is shown after remounting
    const currentContent = el.innerHTML;
    if (currentContent !== html || currentContent === '') {
      el.innerHTML = html;
    }
    if (repBodyCaretRef.current != null) setCaretOffset(el, repBodyCaretRef.current);
  }, [repB, repBodyColor]);

  // Menú contextual
  // Unified context menu
  const showContextMenu = (e, req, source) => {
    e.preventDefault();
    const norm = normalizeRequest(req, source || 'history');
    setContextMenu({ x: e.clientX, y: e.clientY, request: req, source: source || 'history', normalized: norm });
  };

  const addScopeFromRequest = async ruleType => {
    const norm = _optionalChain([contextMenu, 'optionalAccess', _57 => _57.normalized]);
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
    await scopeService.addRule(host, ruleType, true);
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
        const full = await requestService.getDetail(req.id);
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
      case 'download-sqlmap':
        const sqlmapRequest = generateSQLMapRequest(norm);
        if (sqlmapRequest) {
          const blob = new Blob([sqlmapRequest], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'sqlmap-request.txt';
          a.click();
          URL.revokeObjectURL(url);
          toast('SQLMap request downloaded', 'success');
        } else {
          toast('Failed to generate SQLMap request', 'error');
        }
        break;
      case 'copy-body':
        const bodyToCopy = source === 'repeater-response' ? (req.response_body || '') : (norm.body || '');
        navigator.clipboard.writeText(bodyToCopy);
        toast('Body copied', 'success');
        break;
      case 'download-body':
        let bodyToDownload = null;
        let filename = 'body.txt';
        let isTruncated = false;

        if (source === 'history' && req.id) {
          // For history items with response body, prioritize downloading response body
          if (req.response_body) {
            bodyToDownload = req.response_body;
            filename = 'response-body.txt';
            isTruncated = bodyToDownload && bodyToDownload.includes('[...TRUNCATED at');
            if (!isTruncated) {
              // If not truncated in memory, try to download from backend
              window.open(API + '/api/requests/' + req.id + '/download-response-body', '_blank');
              toast('Downloading response body...', 'success');
              break;
            }
          } else {
            // Otherwise download request body
            window.open(API + '/api/requests/' + req.id + '/download-body', '_blank');
            toast('Downloading request body...', 'success');
            break;
          }
        } else if (source === 'repeater-response' && req.response_body) {
          bodyToDownload = req.response_body;
          filename = 'response-body.txt';
          isTruncated = bodyToDownload.includes('[...TRUNCATED at');
        } else if (norm.body) {
          bodyToDownload = norm.body;
          filename = 'body.txt';
          isTruncated = bodyToDownload.includes('[...TRUNCATED at');
        }

        if (bodyToDownload) {
          const blob = new Blob([bodyToDownload], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
          if (isTruncated) {
            toast('Downloaded truncated body (limited to 1MB)', 'warning');
          } else {
            toast('Downloading body...', 'success');
          }
        } else {
          toast('No body available to download', 'error');
        }
        break;
      case 'replay-browser':
        if (source === 'history' && req.id) {
          window.open(API + '/api/requests/' + req.id + '/replay', '_blank');
          toast('Opening replay...', 'success');
        }
        break;
      case 'render-browser':
        if (source === 'history' && req.id) {
          window.open(API + '/api/requests/' + req.id + '/render', '_blank');
          toast('Rendering response...', 'success');
        } else if (source === 'repeater-response' && req.response_body) {
          const blob = new Blob([req.response_body], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          toast('Rendering response...', 'success');
        }
        break;
      case 'send-to-cipher':
        const bodyToSend = source === 'repeater-response' ? (req.response_body || '') : (norm.body || '');
        if (bodyToSend) {
          setChepyIn(bodyToSend);
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

  const filtered = reqs;

  // --- Sensitive scan logic ---
  const runSensitiveScan = async () => {
    try {
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

      if (allPatterns.length === 0) {
        toast('No patterns enabled', 'error');
        setSensScanning(false);
        return;
      }

      // Load ALL requests for scanning, not just current page
      toast('Loading requests for scan...', 'info');
      const allReqsData = await requestService.search('', 1, 50000, false, sensScopeOnly, null);
      let targets = allReqsData.requests || [];

      if (targets.length === 0) {
        const msg = sensScopeOnly ? 'No requests in scope to scan' : 'No requests to scan';
        toast(msg, 'warning');
        setSensScanning(false);
        return;
      }

      const results = [];
      const total = targets.length;
      let done = 0;

    const processBatch = async (batch) => {
      const details = await Promise.all(batch.map(async r => {
        try {
          const d = await requestService.getDetail(r.id);
          return d;
        } catch (e4) { return null; }
      }));

      for (const d of details) {
        if (!d || sensStopRef.current) continue;
        const sections = {
          reqUrl: d.url || '',
          reqHeaders: typeof d.headers === 'object' ? Object.entries(d.headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n') : (d.headers || ''),
          reqBody: d.body || '',
          respHeaders: typeof d.response_headers === 'object' ? Object.entries(d.response_headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n') : (d.response_headers || ''),
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
                // Apply entropy filter to reduce false positives
                const matchText = m[0];
                const entropy = calculateEntropy(matchText);
                if (entropy < sensEntropyThreshold) {
                  continue; // Skip low-entropy matches like HTML tags <password>
                }

                results.push({
                  match: matchText.length > 200 ? matchText.slice(0, 200) + '...' : matchText,
                  patternName: pat.name,
                  category: pat.category,
                  url: d.url || '',
                  method: d.method || '',
                  requestId: d.id,
                  section: secKey,
                  entropy: entropy.toFixed(2),
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
        const pct = Math.round((done / total) * 100);
        setSensPct(pct);
        setSensResults([...results]);
      }

      setSensPct(100);
      setSensResults([...results]);
      toast(`Scan complete: ${results.length} findings`, 'success');
    } catch (err) {
      console.error('Sensitive scan error:', err);
      toast('Scan failed: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setSensScanning(false);
    }
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
      const d = await requestService.getDetail(result.requestId);
      setSensSelDetail(d);
    } catch (e6) { setSensSelDetail(null); }
  };

  const cmpDiff = React.useMemo(() => {
    if (!cmpA && !cmpB) return [];
    return diffLines(buildCmpText(cmpA, cmpView), buildCmpText(cmpB, cmpView));
  }, [cmpA, cmpB, cmpView]);

  // Sitemap: fetch ALL requests (not paginated) for global view
  const [allReqsForSitemap, setAllReqsForSitemap] = useState([]);

  useEffect(() => {
    if (histSubTab === 'sitemap' && curPrj) {
      // Fetch all requests with large page size for sitemap
      requestService.search('', 1, 10000, false, false, null)
        .then(data => setAllReqsForSitemap(data.requests || []))
        .catch(err => console.error('Failed to load sitemap data:', err));
    }
  }, [histSubTab, curPrj]);

  const siteTree = React.useMemo(() => buildSiteTree(allReqsForSitemap.length > 0 ? allReqsForSitemap : reqs), [allReqsForSitemap, reqs]);
  const smNodeReqs = React.useMemo(() => {
    if (!smSelNode) return [];
    let filtered = collectNodeReqs(smSelNode);
    if (smFilterMethod) filtered = filtered.filter(r => r.method === smFilterMethod);
    if (smFilterStatus) filtered = filtered.filter(r => String(r.response_status).startsWith(smFilterStatus));
    if (smFilterExt) {
      filtered = filtered.filter(r => {
        try {
          const path = new URL(r.url).pathname;
          const ext = path.split('.').pop();
          return ext && ext.toLowerCase() === smFilterExt.toLowerCase();
        } catch (e) {
          return false;
        }
      });
    }
    if (smFilterText) filtered = filtered.filter(r => r.url.toLowerCase().includes(smFilterText.toLowerCase()));
    return filtered;
  }, [smSelNode, allReqsForSitemap, reqs, smFilterMethod, smFilterStatus, smFilterExt, smFilterText]);

  const smStats = React.useMemo(() => {
    const allReqs = allReqsForSitemap.length > 0 ? allReqsForSitemap : reqs;
    const methods = {};
    const statuses = {};
    const extensions = {};
    allReqs.forEach(r => {
      methods[r.method] = (methods[r.method] || 0) + 1;
      const status = Math.floor(r.response_status / 100) + 'xx';
      if (r.response_status) statuses[status] = (statuses[status] || 0) + 1;
      try {
        const path = new URL(r.url).pathname;
        const ext = path.split('.').pop();
        if (ext && path.includes('.')) extensions[ext.toLowerCase()] = (extensions[ext.toLowerCase()] || 0) + 1;
      } catch (e) {}
    });
    return { methods, statuses, extensions };
  }, [allReqsForSitemap, reqs]);

  const exportSitemap = (format) => {
    const data = smSelNode ? smNodeReqs : (allReqsForSitemap.length > 0 ? allReqsForSitemap : reqs);
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sitemap-' + new Date().toISOString().split('T')[0] + '.json';
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'csv') {
      const headers = ['Method', 'URL', 'Status', 'Timestamp'];
      const rows = data.map(r => [r.method, r.url, r.response_status || '', r.timestamp]);
      const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sitemap-' + new Date().toISOString().split('T')[0] + '.csv';
      a.click();
      URL.revokeObjectURL(url);
    }
    toast('Sitemap exported', 'success');
  };

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
.icept-pnl{display:flex;flex-direction:column;width:100%;height:100%}
.icept-bar{display:flex;align-items:center;gap:6px;padding:8px 12px;background:var(--bg2);border-bottom:1px solid var(--brd);flex-shrink:0}
.icept-toggle{display:inline-flex;align-items:center;gap:7px;padding:5px 13px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid transparent;transition:all 0.15s;font-family:var(--font-sans)}
.icept-toggle.on{background:rgba(239,68,68,.12);color:#f87171;border-color:rgba(239,68,68,.3)}
.icept-toggle.off{background:var(--bg3);color:var(--txt3);border-color:var(--brd)}
.icept-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.icept-sep{width:1px;height:18px;background:var(--brd);margin:0 2px;flex-shrink:0}
.icept-body{display:flex;flex:1;overflow:hidden}
.icept-queue{flex-shrink:0;border-right:1px solid var(--brd);display:flex;flex-direction:column;overflow:hidden}
.icept-queue-list{flex:1;overflow-y:auto}
.icept-item{display:flex;gap:8px;padding:8px 12px;border-bottom:1px solid var(--brd);cursor:pointer;align-items:flex-start;min-width:0}
.icept-item:hover{background:var(--bgh)}.icept-item.sel{background:var(--bg3);border-left:3px solid var(--orange)}
.icept-item .mth{flex-shrink:0;margin-top:1px;font-size:9px}
.icept-item-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.icept-item-host{font-size:11px;color:var(--txt);font-family:var(--font-mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.icept-item-path{font-size:10px;color:var(--txt3);font-family:var(--font-mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.icept-item-ts{font-size:9px;color:var(--txt3);flex-shrink:0;align-self:flex-end;padding-top:2px}
.icept-edit{flex:1;display:flex;flex-direction:column;overflow:hidden}
.icept-section{padding:4px 12px;font-size:9px;font-weight:700;color:var(--txt3);background:var(--bg2);border-bottom:1px solid var(--brd);text-transform:uppercase;letter-spacing:.06em;flex-shrink:0}
.icept-empty{flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;color:var(--txt3)}
.ed-row{display:flex;gap:8px;padding:8px 12px;background:var(--bg2);border-bottom:1px solid var(--brd);flex-shrink:0}
.ed-ta{width:100%;padding:14px;background:var(--bg);border:none;border-bottom:1px solid var(--brd);color:var(--txt);font-family:var(--font-mono);font-size:11px;resize:none;outline:none;overflow:auto;min-height:0}
.ed-ce{flex:1;padding:14px;background:var(--bg);border:none;border-bottom:1px solid var(--brd);color:var(--txt);font-family:var(--font-mono);font-size:11px;line-height:1.5;outline:none;overflow:auto;white-space:pre-wrap;word-break:break-all;tab-size:2}
.overlay-ta::selection{background:rgba(88,166,255,.35)}
.scp-pnl{padding:24px;max-width:700px;margin:0 auto;width:100%;overflow-y:auto}.scp-hdr{margin-bottom:20px}.scp-hdr h3{font-size:16px;margin-bottom:6px}.scp-hdr p{color:var(--txt2);font-size:12px}
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
.cmt-list{background:var(--bg2);border-radius:8px;border:1px solid var(--brd);max-height:500px;overflow:auto}.cmt-item{display:flex;gap:14px;padding:12px 14px;border-bottom:1px solid var(--brd);font-family:var(--font-mono);font-size:11px;align-items:center}
.cmt-item:last-child{border-bottom:none}.cmt-hash{color:var(--purple);font-weight:500}.cmt-msg{flex:1}.cmt-date{color:var(--txt3);font-size:10px}
.toast-c{position:fixed;bottom:20px;right:20px;z-index:1000}.toast{padding:10px 18px;background:var(--bg3);border:1px solid var(--brd);border-radius:6px;font-size:12px;margin-top:6px;animation:slideIn .2s}
.toast.success{border-color:var(--green)}.toast.error{border-color:var(--red)}@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:var(--bg)}::-webkit-scrollbar-thumb{background:var(--brd);border-radius:3px}
.context-menu{position:fixed;background:var(--bg2);border:1px solid var(--brd);border-radius:8px;padding:4px;box-shadow:0 8px 24px rgba(0,0,0,0.5);z-index:1000;min-width:180px}
.context-menu-item{padding:8px 12px;font-size:12px;color:var(--txt);cursor:pointer;border-radius:4px;transition:all .15s ease}
.context-menu-item:hover{background:var(--bgh)}
.context-menu-divider{height:1px;background:var(--brd);margin:4px 0}
.chepy-cnt{display:flex;flex-direction:column;width:100%;height:100%}.chepy-col{display:flex;flex-direction:column;overflow:hidden}
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
.coll-cnt{display:flex;flex-direction:column;width:100%;height:100%}
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
.intr-cnt{display:flex;flex-direction:column;width:100%;height:100%}
.int-positions{flex:1;display:flex;flex-direction:column;overflow:auto;padding:14px;gap:10px}
.int-editor{font-family:var(--font-mono);font-size:12px;background:var(--bg);border:1px solid var(--brd);border-radius:6px;padding:10px;resize:vertical;min-height:80px;color:var(--txt);width:100%;box-sizing:border-box}
.hdr-key{color:var(--cyan);font-weight:500}
.hdr-sep{color:var(--txt3)}
.hdr-val{color:var(--orange)}
.hdr-wrap{position:relative;width:100%;display:grid}
.hdr-highlight{grid-area:1/1;margin:0;border:1px solid transparent;white-space:pre-wrap;word-wrap:break-word;pointer-events:none;box-sizing:border-box;padding:10px;font-family:var(--font-mono);font-size:12px;line-height:1.5;overflow:hidden;height:100%}
.hdr-ta{grid-area:1/1;background:transparent!important;color:transparent!important;caret-color:var(--txt);z-index:1;padding:10px;font-family:var(--font-mono);font-size:12px;line-height:1.5;border:1px solid var(--brd);border-radius:6px;box-sizing:border-box;resize:vertical;min-height:80px}
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
          , curPrj && React.createElement('span', { className: "prj-badge",}, curPrj.project)
        )
        , React.createElement('div', { className: "hdr-ctrl",}
          , React.createElement('select', { className: "sel", value: themeId, onChange: e => setThemeId(e.target.value), title: "Theme",}
            , Object.entries(THEMES).map(([id, t]) => (
              React.createElement('option', { key: id, value: id,}, t.label)
            ))
          )
          , curPrj && (
            React.createElement(React.Fragment, null
              , React.createElement('div', { className: 'int-tog' + (intOn ? ' on' : ''), onClick: () => intercept.toggle(),}
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
                React.createElement('button', { className: "btn btn-d" , onClick: () => proxy.stop(),}, "■ Stop" )
              )
              , React.createElement('button', { className: "btn btn-s" , onClick: () => proxy.launchBrowser(), disabled: !pxRun,}, "🌐")
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
            , React.createElement('div', { className: 'tab' + (tab === 'intercept' ? ' act' : ''), onClick: () => setTab('intercept'),}, "Interceptor")
            , React.createElement('div', { className: 'tab' + (tab === 'collections' ? ' act' : ''), onClick: () => { setTab('collections'); loadColls(); },}, "Collections")
            , React.createElement('div', { className: 'tab' + (tab === 'repeater' ? ' act' : ''), onClick: () => setTab('repeater'),}, "Repeater")
            , React.createElement('div', { className: 'tab' + (tab === 'intruder' ? ' act' : ''), onClick: () => setTab('intruder'),}, "Intruder")
            , React.createElement('div', { className: 'tab' + (tab === 'git' ? ' act' : ''), onClick: () => setTab('git'),}, "Git")
            , React.createElement('div', { className: 'tab' + (tab === 'chepy' ? ' act' : ''), onClick: () => setTab('chepy'),}, "Cipher")
            , React.createElement('div', { className: 'tab' + (tab === 'compare' ? ' act' : ''), onClick: () => setTab('compare'),}, "Compare")
            , React.createElement('div', { className: 'tab' + (tab === 'sensitive' ? ' act' : ''), onClick: () => setTab('sensitive'),}, "Sensitive")
            , React.createElement('div', { className: 'tab' + (tab === 'bypass' ? ' act' : ''), onClick: () => { setTab('bypass'); bypass.loadRules(); bypass.loadPresets(); bypass.loadStatus(); },}, "Bypass")
            , React.createElement('div', { className: 'tab' + (tab === 'extensions' ? ' act' : ''), onClick: () => setTab('extensions'),}, "Extensions")
            , React.createElement('div', { className: 'tab' + (tab === 'console' ? ' act' : ''), onClick: () => setTab('console'),}, "Console"

              , proxyConsole.connected && React.createElement('span', { style: { display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', marginLeft: '5px', verticalAlign: 'middle' },} )
            )
            , extensions.extensions.filter(ext => ext.enabled && ext.tabs && ext.tabs.length > 0 && ext.name !== 'sensitive').map(ext =>
              ext.tabs.map(extTab => (
                React.createElement('div', { key: ext.name + '_' + extTab.id, className: 'tab' + (tab === ext.name ? ' act' : ''), onClick: () => setTab(ext.name),}
                  , extTab.label
                )
              ))
            )
          )
        )
      )

      , React.createElement('main', { className: "main",}
        , tab === 'projects' && (
          React.createElement('div', { className: "prj-pnl",}
            , React.createElement('div', { className: "prj-hdr",}
              , React.createElement('h2', null, "Projects")
              , React.createElement('div', { style: { display: 'flex', gap: '8px' },}
                , React.createElement('button', { className: "btn btn-p" , onClick: () => setShowNew(true),}, "+ New" )
                , React.createElement('button', { className: "btn btn-s" , onClick: importAsNewProject, title: "Create new project from Blackwire export file"      ,}, "↓ Create from File"   )
              )
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
                  , React.createElement('div', { onClick: e => e.stopPropagation(), style: { display: 'flex', gap: '4px', alignItems: 'center' },}
                    , React.createElement('div', { style: { position: 'relative', display: 'inline-block' },}
                      , React.createElement('button', {
                        className: "btn btn-sm btn-s"  ,
                        onClick: (e) => {
                          e.stopPropagation();
                          const menu = e.currentTarget.nextElementSibling;
                          menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                        },
                        title: "Export project data to file"    ,}
, "↑ ▼"

                      )
                      , React.createElement('div', {
                        style: {
                          display: 'none',
                          position: 'absolute',
                          right: 0,
                          background: 'var(--bg2)',
                          border: '1px solid var(--brd)',
                          borderRadius: '4px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                          zIndex: 1000,
                          minWidth: '240px',
                          marginTop: '4px'
                        },
                        onClick: (e) => { e.stopPropagation(); e.currentTarget.style.display = 'none'; },}

                        , React.createElement('div', {
                          style: {
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            borderBottom: '1px solid var(--brd)',
                            color: 'var(--txt)'
                          },
                          onClick: (e) => { e.stopPropagation(); exportProject(p.name); },
                          onMouseEnter: (e) => e.currentTarget.style.background = 'var(--bg3)',
                          onMouseLeave: (e) => e.currentTarget.style.background = 'transparent',
                          title: "Export complete project (requests, repeater, collections, rules, scope)"       ,}

                          , React.createElement('div', { style: { fontWeight: 600 },}, "↑ Complete Project (JSON)"   )
                          , React.createElement('div', { style: { fontSize: '10px', color: 'var(--txt3)', marginTop: '2px' },}, "All data: requests, repeater, collections, scope"     )
                        )
                        , React.createElement('div', {
                          style: {
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            color: 'var(--txt)'
                          },
                          onClick: (e) => { e.stopPropagation(); exportProjectBurp(p.name); },
                          onMouseEnter: (e) => e.currentTarget.style.background = 'var(--bg3)',
                          onMouseLeave: (e) => e.currentTarget.style.background = 'transparent',
                          title: "Export only HTTP history for Burp Suite Pro"       ,}

                          , React.createElement('div', { style: { fontWeight: 600 },}, "↑ Burp Suite Format (XML)"    )
                          , React.createElement('div', { style: { fontSize: '10px', color: 'var(--txt3)', marginTop: '2px' },}, "Only HTTP history, compatible with Burp"     )
                        )
                      )
                    )
                    , React.createElement('div', { style: { position: 'relative', display: 'inline-block' },}
                      , React.createElement('button', {
                        className: "btn btn-sm btn-s"  ,
                        onClick: (e) => {
                          e.stopPropagation();
                          const menu = e.currentTarget.nextElementSibling;
                          menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                        },
                        title: "Import data into this project"    ,}
, "↓ ▼"

                      )
                      , React.createElement('div', {
                        style: {
                          display: 'none',
                          position: 'absolute',
                          right: 0,
                          background: 'var(--bg2)',
                          border: '1px solid var(--brd)',
                          borderRadius: '4px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                          zIndex: 1000,
                          minWidth: '240px',
                          marginTop: '4px'
                        },
                        onClick: (e) => { e.stopPropagation(); e.currentTarget.style.display = 'none'; },}

                        , React.createElement('div', {
                          style: {
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            borderBottom: '1px solid var(--brd)',
                            color: 'var(--txt)'
                          },
                          onClick: (e) => { e.stopPropagation(); importProject(p.name, false); },
                          onMouseEnter: (e) => e.currentTarget.style.background = 'var(--bg3)',
                          onMouseLeave: (e) => e.currentTarget.style.background = 'transparent',
                          title: "Add data from file to existing project data"       ,}

                          , React.createElement('div', { style: { fontWeight: 600 },}, "↓ Merge (Keep Existing)"   )
                          , React.createElement('div', { style: { fontSize: '10px', color: 'var(--txt3)', marginTop: '2px' },}, "Combine file data with current data"     )
                        )
                        , React.createElement('div', {
                          style: {
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            borderBottom: '1px solid var(--brd)',
                            color: 'var(--red)'
                          },
                          onClick: (e) => { e.stopPropagation(); importProject(p.name, true); },
                          onMouseEnter: (e) => e.currentTarget.style.background = 'var(--bg3)',
                          onMouseLeave: (e) => e.currentTarget.style.background = 'transparent',
                          title: "Delete all current data and replace with file data"        ,}

                          , React.createElement('div', { style: { fontWeight: 600 },}, "🔄 Replace (Delete All)"   )
                          , React.createElement('div', { style: { fontSize: '10px', color: 'var(--txt3)', marginTop: '2px' },}, "Clear project and import file data"     )
                        )
                        , React.createElement('div', {
                          style: {
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            color: 'var(--txt)'
                          },
                          onClick: (e) => { e.stopPropagation(); importBurpXML(p.name); },
                          onMouseEnter: (e) => e.currentTarget.style.background = 'var(--bg3)',
                          onMouseLeave: (e) => e.currentTarget.style.background = 'transparent',
                          title: "Import HTTP history from Burp Suite XML export"       ,}

                          , React.createElement('div', { style: { fontWeight: 600 },}, "↓ From Burp Suite (XML)"    )
                          , React.createElement('div', { style: { fontSize: '10px', color: 'var(--txt3)', marginTop: '2px' },}, "Import HTTP history from Burp export"     )
                        )
                      )
                    )
                    , React.createElement('button', { className: "btn btn-sm btn-d"  , onClick: () => delPrj(p.name),}, "×")
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
                    , React.createElement('span', null, totalRequests > 0 ? `${((currentPage - 1) * pageSize) + 1}-${Math.min(currentPage * pageSize, totalRequests)} of ${totalRequests}` : '0 requests')
                    , React.createElement('div', { className: "acts",}
                      , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: loadReqs,}, "↻")
                      , React.createElement('button', { className: "btn btn-sm btn-d"  , onClick: clearHist,}, "Clear")
                    )
                  )
                  , totalPages > 1 && (
                    React.createElement('div', { className: "pagination-bar",}
                      , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: firstPage, disabled: currentPage === 1, title: "First page" ,}, "«")
                      , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: prevPage, disabled: currentPage === 1, title: "Previous page" ,}, "‹")
                      , React.createElement('span', { className: "pagination-info",}, "Page " , currentPage, " of "  , totalPages)
                      , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: nextPage, disabled: currentPage === totalPages, title: "Next page" ,}, "›")
                      , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: lastPage, disabled: currentPage === totalPages, title: "Last page" ,}, "»")
                      , React.createElement('select', { className: "pagination-size", value: pageSize, onChange: e => setPageSize(Number(e.target.value)),}
                        , React.createElement('option', { value: "100",}, "100")
                        , React.createElement('option', { value: "250",}, "250")
                        , React.createElement('option', { value: "500",}, "500")
                        , React.createElement('option', { value: "1000",}, "1000")
                      )
                    )
                  )
                  , React.createElement('div', { className: "pnl-cnt",}
                    , React.createElement('div', { className: "req-list",}
                      , filtered.map(r => (
                        React.createElement('div', {
                          key: r.id,
                          className: 'req-item' + (_optionalChain([selReq, 'optionalAccess', _58 => _58.id]) === r.id ? ' sel' : '') + (!r.in_scope ? ' out' : ''),
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
                          , React.createElement('div', { className: "empty-i",}, "□")
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
                          , React.createElement('button', { className: "btn btn-sm btn-d"  , onClick: () => delReq(selReq.id),}, "×")
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
                          , detTab === 'response' && (
                            React.createElement(React.Fragment, null
                              , React.createElement('button', { className: 'btn btn-sm ' + (respFormat === 'deminify' ? 'btn-p' : 'btn-s'), onClick: () => setRespFormat('deminify'), title: "Beautify JavaScript" ,}, "Deminify"

                              )
                              , React.createElement('button', { className: 'btn btn-sm ' + (respFormat === 'render' ? 'btn-p' : 'btn-s'), onClick: () => setRespFormat('render'),}, "Render"

                              )
                            )
                          )
                        )
                      )
                      , !selReqFull ? (
                        React.createElement('div', { className: "empty",}, React.createElement('div', { className: "splash-spin", style: {margin:'20px auto'},} ))
                      ) : (
                      React.createElement('div', { className: "code", ref: histSearch.contentRef,}
                        , (() => {
                          const d = selReqFull;
                          if (detTab === 'response' && respFormat === 'render') {
                            return (
                              React.createElement('iframe', {
                                src: API + '/api/requests/' + selReq.id + '/render',
                                sandbox: "allow-same-origin",
                                style: { width: '100%', height: '100%', border: 'none', background: '#fff' },
                                title: "Rendered Response" ,}
                              )
                            );
                          }
                          const reqFormatted = d.body ? formatBody(d.body, reqFormat) : { text: '', html: false };
                          const respFormatted = formatBody(d.response_body || '', respFormat);
                          const rawContent = detTab === 'request'
                            ? (escapeHtml(d.method + ' ' + (() => {
                                try { return new URL(d.url).pathname; } catch (e) { return d.url; }
                              })()) + '\n\n' + fmtHHtml(d.headers, d.url) + (d.body ? '\n\n' + (reqFormatted.html ? reqFormatted.text : escapeHtml(reqFormatted.text)) : ''))
                            : (escapeHtml('HTTP ' + d.response_status) + '\n\n' + fmtHHtml(d.response_headers) + '\n\n' + (respFormatted.html ? respFormatted.text : escapeHtml(respFormatted.text)));
                          if (histSearch.debouncedSearchTerm) {
                            const plainText = rawContent.replace(/<[^>]*>/g, '');
                            const hl = highlightMatches(plainText, histSearch.debouncedSearchTerm, histSearch.isRegex, histSearch.matchIndex);
                            if (hl.count !== histSearch.matchCount) setTimeout(() => histSearch.setMatchCount(hl.count), 0);
                            return React.createElement('div', { dangerouslySetInnerHTML: { __html: hl.html },} );
                          }
                          return React.createElement('div', { dangerouslySetInnerHTML: { __html: rawContent },} );
                        })()
                      )
                      )
                      , React.createElement('div', { className: "search-bar", style: { borderTop: '1px solid var(--brd)' },}
                        , React.createElement('input', {
                          placeholder: histSearch.isRegex ? 'Regex search...' : 'Search body...',
                          value: histSearch.searchTerm,
                          onChange: e => { histSearch.setSearchTerm(e.target.value); histSearch.setMatchIndex(0); },
                          onKeyDown: e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); histSearch.nextMatch(); }
                            if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); histSearch.prevMatch(); }
                            if (e.key === 'Escape') { histSearch.close(); }
                          },
                          style: histSearch.isSearching ? { opacity: 0.7 } : {},}
                        )
                        , React.createElement('button', { className: 'srch-btn' + (histSearch.isRegex ? ' act' : ''), onClick: () => { histSearch.toggleRegex(); histSearch.setMatchIndex(0); }, title: "Toggle regex" ,}, ".*")
                        , React.createElement('span', { className: "search-info",}, histSearch.isSearching ? '⏳' : (histSearch.matchCount > 0 ? (histSearch.matchIndex + 1) + '/' + histSearch.matchCount : '0/0'))
                        , React.createElement('button', { className: "srch-btn", onClick: histSearch.prevMatch, disabled: histSearch.matchCount === 0,}, "▲")
                        , React.createElement('button', { className: "srch-btn", onClick: histSearch.nextMatch, disabled: histSearch.matchCount === 0,}, "▼")
                        , React.createElement('button', { className: "srch-btn", onClick: histSearch.close,}, "✕")
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
                      React.createElement('div', { key: f.id, className: 'ws-frame-item' + (_optionalChain([selWsFrame, 'optionalAccess', _59 => _59.id]) === f.id ? ' sel' : ''),
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
                    , React.createElement('div', { style: { display: 'flex', gap: '4px' },}
                      , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => setSmShowStats(!smShowStats),}
                        , smShowStats ? 'Hide' : 'Show', " Stats"
                      )
                      , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => { setSmExpanded({}); setSmSelNode(null); },}, "Collapse All" )
                    )
                  )
                  , smShowStats && (
                    React.createElement('div', { style: { padding: '12px', borderBottom: '1px solid var(--brd)', fontSize: '10px', color: 'var(--txt2)' },}
                      , React.createElement('div', { style: { marginBottom: '8px', fontWeight: 600, color: 'var(--txt1)' },}, "Top Methods" )
                      , React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' },}
                        , Object.entries(smStats.methods).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([m, c]) => (
                          React.createElement('span', { key: m, style: { padding: '2px 6px', background: 'var(--bg3)', borderRadius: '2px' },}
                            , React.createElement('span', { className: 'mth-' + m, style: { fontWeight: 600 },}, m), " " , c
                          )
                        ))
                      )
                      , React.createElement('div', { style: { marginBottom: '8px', fontWeight: 600, color: 'var(--txt1)' },}, "Status Codes" )
                      , React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' },}
                        , Object.entries(smStats.statuses).sort((a, b) => b[1] - a[1]).map(([s, c]) => (
                          React.createElement('span', { key: s, style: { padding: '2px 6px', background: 'var(--bg3)', borderRadius: '2px' },}
                            , s, ": " , c
                          )
                        ))
                      )
                      , React.createElement('div', { style: { marginBottom: '8px', fontWeight: 600, color: 'var(--txt1)' },}, "Top Extensions" )
                      , React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px' },}
                        , Object.entries(smStats.extensions).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([e, c]) => (
                          React.createElement('span', { key: e, style: { padding: '2px 6px', background: 'var(--bg3)', borderRadius: '2px' },}, "."
                            , e, ": " , c
                          )
                        ))
                      )
                    )
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
                      , smSelNode && (
                        React.createElement('div', { style: { display: 'flex', gap: '4px' },}
                          , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => exportSitemap('json'), title: "Export as JSON"  ,}, "JSON")
                          , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => exportSitemap('csv'), title: "Export as CSV"  ,}, "CSV")
                        )
                      )
                    )
                    , smSelNode && (
                      React.createElement('div', { style: { padding: '8px', borderBottom: '1px solid var(--brd)', display: 'grid', gridTemplateColumns: 'auto auto auto 1fr', gap: '6px', alignItems: 'center' },}
                        , React.createElement('select', { className: "sel", value: smFilterMethod, onChange: e => setSmFilterMethod(e.target.value), style: { fontSize: '10px', padding: '4px 6px' },}
                          , React.createElement('option', { value: "",}, "All Methods" )
                          , React.createElement('option', { value: "GET",}, "GET")
                          , React.createElement('option', { value: "POST",}, "POST")
                          , React.createElement('option', { value: "PUT",}, "PUT")
                          , React.createElement('option', { value: "DELETE",}, "DELETE")
                          , React.createElement('option', { value: "PATCH",}, "PATCH")
                          , React.createElement('option', { value: "OPTIONS",}, "OPTIONS")
                          , React.createElement('option', { value: "HEAD",}, "HEAD")
                        )
                        , React.createElement('select', { className: "sel", value: smFilterStatus, onChange: e => setSmFilterStatus(e.target.value), style: { fontSize: '10px', padding: '4px 6px' },}
                          , React.createElement('option', { value: "",}, "All Status" )
                          , React.createElement('option', { value: "2",}, "2xx")
                          , React.createElement('option', { value: "3",}, "3xx")
                          , React.createElement('option', { value: "4",}, "4xx")
                          , React.createElement('option', { value: "5",}, "5xx")
                        )
                        , React.createElement('input', { className: "inp", placeholder: "Extension", value: smFilterExt, onChange: e => setSmFilterExt(e.target.value), style: { fontSize: '10px', padding: '4px 6px', width: '80px' },} )
                        , React.createElement('input', { className: "inp", placeholder: "Search URL..." , value: smFilterText, onChange: e => setSmFilterText(e.target.value), style: { fontSize: '10px', padding: '4px 6px' },} )
                      )
                    )
                    , React.createElement('div', { className: "pnl-cnt",}
                      , smSelNode ? (
                        React.createElement('div', { className: "req-list",}
                          , smNodeReqs.map(r => (
                            React.createElement('div', {
                              key: r.id,
                              className: 'req-item' + (_optionalChain([selReq, 'optionalAccess', _60 => _60.id]) === r.id ? ' sel' : '') + (!r.in_scope ? ' out' : ''),
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
                          , detTab === 'response' && (
                            React.createElement(React.Fragment, null
                              , React.createElement('button', { className: 'btn btn-sm ' + (respFormat === 'deminify' ? 'btn-p' : 'btn-s'), onClick: () => setRespFormat('deminify'), title: "Beautify JavaScript" ,}, "Deminify"

                              )
                              , React.createElement('button', { className: 'btn btn-sm ' + (respFormat === 'render' ? 'btn-p' : 'btn-s'), onClick: () => setRespFormat('render'),}, "Render"

                              )
                            )
                          )
                        )
                      )
                      , !selReqFull ? (
                        React.createElement('div', { className: "empty",}, React.createElement('div', { className: "splash-spin", style: {margin:'20px auto'},} ))
                      ) : (
                      React.createElement('div', { className: "code",}
                        , (() => {
                          const d = selReqFull;
                          if (detTab === 'response' && respFormat === 'render') {
                            return (
                              React.createElement('iframe', {
                                src: API + '/api/requests/' + selReq.id + '/render',
                                sandbox: "allow-same-origin",
                                style: { width: '100%', height: '100%', border: 'none', background: '#fff' },
                                title: "Rendered Response" ,}
                              )
                            );
                          }
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
          React.createElement('div', { className: "icept-pnl",}
            /* Control bar */
            , React.createElement('div', { className: "icept-bar",}
              , React.createElement('button', { className: 'icept-toggle ' + (intOn ? 'on' : 'off'), onClick: () => intercept.toggle(), title: intOn ? 'Disable intercept' : 'Enable intercept',}
                , React.createElement('span', { className: "icept-dot", style: { background: intOn ? '#ef4444' : 'var(--txt3)' },} )
                , intOn ? 'Intercept ON' : 'Intercept OFF'
              )
              , React.createElement('div', { className: "icept-sep",} )
              , React.createElement('button', { className: "btn btn-g btn-sm"  , disabled: !selPend, onClick: () => selPend && fwdReq(selPend.id, editReq), title: "Forward selected request"  ,}, "▶ Forward" )
              , React.createElement('button', { className: "btn btn-d btn-sm"  , disabled: !selPend, onClick: () => selPend && dropReq(selPend.id), title: "Drop selected request"  ,}, "✕ Drop" )
              , pending.length > 0 && (
                React.createElement(React.Fragment, null
                  , React.createElement('div', { className: "icept-sep",} )
                  , React.createElement('button', { className: "btn btn-s btn-sm"  , onClick: fwdAll, title: "Forward all pending"  ,}, "▶▶ Fwd All ("   , pending.length, ")")
                  , React.createElement('button', { className: "btn btn-s btn-sm"  , onClick: dropAll, title: "Drop all pending"  ,}, "✕ Drop All"  )
                )
              )
              , React.createElement('div', { style: { flex: 1 },} )
              , intOn && pending.length > 0 && (
                React.createElement('span', { style: { fontSize: 10, color: 'var(--orange)', fontFamily: 'var(--font-mono)', fontWeight: 600 },}
                  , pending.length, " request" , pending.length !== 1 ? 's' : '', " queued"
                )
              )
            )

            /* Body: queue + editor */
            , React.createElement('div', { className: "icept-body",}
              /* Queue */
              , React.createElement('div', { className: "icept-queue", style: { width: intPendW + 'px' },}
                , React.createElement('div', { className: "pnl-hdr",}
                  , React.createElement('span', null, "Queue")
                  , pending.length > 0 && (
                    React.createElement('span', { style: { background: 'var(--orange)', color: '#000', padding: '1px 7px', borderRadius: 10, fontSize: 9, fontWeight: 700, marginLeft: 6 },}, pending.length)
                  )
                )
                , React.createElement('div', { className: "icept-queue-list",}
                  , pending.map(r => {
                    let host = r.url, path = '';
                    try { const u = new URL(r.url); host = u.host; path = u.pathname + (u.search || ''); } catch (e) {}
                    return (
                      React.createElement('div', { key: r.id,
                        className: 'icept-item' + (_optionalChain([selPend, 'optionalAccess', _61 => _61.id]) === r.id ? ' sel' : ''),
                        onClick: () => { setSelPend(r); setEditReq({ ...r, rawHeaders: fmtH(r.headers, r.url) }); },
                        onContextMenu: e => showContextMenu(e, r, 'intercept'),}

                        , React.createElement('span', { className: 'mth mth-' + r.method,}, r.method)
                        , React.createElement('div', { className: "icept-item-info",}
                          , React.createElement('span', { className: "icept-item-host",}, host)
                          , path && path !== '/' && React.createElement('span', { className: "icept-item-path",}, path)
                        )
                        , React.createElement('span', { className: "icept-item-ts",}, fmtTime(r.timestamp))
                      )
                    );
                  })
                  , pending.length === 0 && (
                    React.createElement('div', { className: "icept-empty", style: { padding: '40px 16px' },}
                      , React.createElement('span', { style: { fontSize: 28 },}, intOn ? '⏳' : '🔓')
                      , React.createElement('span', { style: { fontSize: 11, textAlign: 'center', lineHeight: 1.5 },}
                        , intOn ? 'Waiting for traffic...' : 'Enable intercept to capture requests'
                      )
                    )
                  )
                )
              )

              , React.createElement(ResizeHandle, { onDrag: (dx) => setIntPendW(w => Math.max(160, Math.min(500, w + dx))),} )

              /* Editor */
              , React.createElement('div', { className: "icept-edit",}
                , selPend && editReq ? (
                  React.createElement(React.Fragment, null
                    , React.createElement('div', { className: "ed-row", onContextMenu: e => showContextMenu(e, editReq, 'intercept'),}
                      , React.createElement('select', { className: "mth-sel", value: editReq.method, onChange: e => setEditReq({ ...editReq, method: e.target.value }),}
                        , ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS','TRACE'].map(m => React.createElement('option', { key: m,}, m))
                      )
                      , React.createElement('input', { className: "url-in", value: editReq.url, onChange: e => setEditReq({ ...editReq, url: e.target.value }), spellCheck: "false",} )
                    )
                    , React.createElement('div', { className: "icept-section",}, "Headers")
                    , React.createElement('div', { className: "hdr-wrap", style: { height: '38%', flexShrink: 0 },}
                      , React.createElement('pre', { ref: interceptHeadersHighlightRef, className: "hdr-highlight ed-ta" , 'aria-hidden': "true", style: { pointerEvents: 'none' },
                        dangerouslySetInnerHTML: { __html: colorizeHeaders(editReq.rawHeaders || '') + '\n' },} )
                      , React.createElement('textarea', { ref: interceptHeadersRef, className: "ed-ta hdr-ta" ,
                        value: editReq.rawHeaders || '',
                        onChange: e => {
                          const raw = e.target.value;
                          const h = {};
                          raw.split('\n').forEach(l => { const ci = l.indexOf(':'); if (ci > 0) h[l.slice(0, ci).trim()] = l.slice(ci + 1).trim(); });
                          setEditReq({ ...editReq, rawHeaders: raw, headers: h });
                        },
                        onScroll: e => { if (interceptHeadersHighlightRef.current) interceptHeadersHighlightRef.current.scrollTop = e.target.scrollTop; },
                        spellCheck: "false",}
                      )
                    )
                    , React.createElement('div', { className: "icept-section",}, "Body")
                    , React.createElement('textarea', { className: "ed-ta", style: { flex: 1 },
                      value: editReq.body || '',
                      onChange: e => setEditReq({ ...editReq, body: e.target.value }),
                      placeholder: "(empty body)" ,
                      spellCheck: "false",}
                    )
                  )
                ) : (
                  React.createElement('div', { className: "icept-empty",}
                    , React.createElement('span', { style: { fontSize: 36 },}, intOn ? '🔒' : '🔓')
                    , React.createElement('div', { style: { textAlign: 'center' },}
                      , React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: 'var(--txt2)', marginBottom: 6 },}
                        , intOn ? (pending.length > 0 ? 'Select a request from the queue' : 'Waiting for traffic...') : 'Interceptor is OFF'
                      )
                      , React.createElement('div', { style: { fontSize: 11 },}
                        , !intOn ? 'Click "Intercept OFF" to start capturing' : pending.length === 0 ? `Proxy running on port ${pxPort}` : ''
                      )
                    )
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
                    , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => scope.toggleRule(r.id),}, r.enabled ? 'Disable' : 'Enable')
                    , React.createElement('button', { className: "btn btn-sm btn-d"  , onClick: () => scope.deleteRule(r.id),}, "×")
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
                    , React.createElement('pre', { ref: repHeadersHighlightRef, className: "hdr-highlight ed-ta" , 'aria-hidden': "true", style: { pointerEvents: 'none' }, dangerouslySetInnerHTML: { __html: (repH ? colorizeHeaders(repH) : '') + '\n' },} )
                    , React.createElement('textarea', { ref: repHeadersRef, className: "ed-ta hdr-ta" , value: repH, onChange: e => setRepH(e.target.value),
                      onScroll: e => { if (repHeadersHighlightRef.current) repHeadersHighlightRef.current.scrollTop = e.target.scrollTop; },
                      spellCheck: "false",} )
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
                          , repResp.status_code, " • "  , _optionalChain([repResp, 'access', _62 => _62.elapsed, 'optionalAccess', _63 => _63.toFixed, 'call', _64 => _64(3)]), "s"
                        )
                      )
                      , repResp && repResp.body && !repResp.error && (
                        React.createElement('div', { style: { display: 'flex', gap: '4px' },}
                          , React.createElement('button', { className: 'btn btn-sm ' + (repRespFormat === 'code' ? 'btn-p' : 'btn-s'), onClick: () => setRepRespFormat('code'),}, "Raw")
                          , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: () => { setRepRespBody(prettyPrint(repRespBody)); }, title: "Pretty Print" ,}, "Pretty")
                          , React.createElement('button', {
                            className: "btn btn-sm btn-s"  ,
                            onClick: async () => {
                              console.clear();
                              console.log('%c╔════════════════════════════════════════════╗', 'color: #00ff00');
                              console.log('%c║   JavaScript Deobfuscator - Diagnostics   ║', 'color: #00ff00; font-weight: bold');
                              console.log('%c╚════════════════════════════════════════════╝', 'color: #00ff00');

                              // Detailed size analysis
                              const size = repRespBody.length;
                              const byteSize = new TextEncoder().encode(repRespBody).length;
                              const sizeMB = (size / 1024 / 1024).toFixed(2);
                              const byteSizeMB = (byteSize / 1024 / 1024).toFixed(2);

                              console.log(`\n%c📊 Size Analysis:`, 'color: #00aaff; font-weight: bold');
                              console.log(`  • String length: ${size.toLocaleString()} characters (${sizeMB} MB)`);
                              console.log(`  • Byte size (UTF-8): ${byteSize.toLocaleString()} bytes (${byteSizeMB} MB)`);
                              console.log(`  • Encoding ratio: ${(byteSize / size).toFixed(2)}x`);

                              // Content analysis
                              const hasTruncated = repRespBody.includes('[...TRUNCATED');
                              console.log(`\n%c📝 Content Analysis:`, 'color: #00aaff; font-weight: bold');
                              console.log(`  • Contains TRUNCATED marker: ${hasTruncated ? 'YES ⚠️' : 'NO'}`);
                              console.log(`  • First 200 chars:`);
                              console.log(`    ${repRespBody.substring(0, 200)}`);
                              console.log(`  • Last 200 chars:`);
                              console.log(`    ${repRespBody.substring(repRespBody.length - 200)}`);

                              // Character encoding check
                              const asciiChars = repRespBody.split('').filter(c => c.charCodeAt(0) < 128).length;
                              const nonAscii = size - asciiChars;
                              console.log(`\n%c🔤 Character Encoding:`, 'color: #00aaff; font-weight: bold');
                              console.log(`  • ASCII chars: ${asciiChars.toLocaleString()} (${(asciiChars/size*100).toFixed(1)}%)`);
                              console.log(`  • Non-ASCII chars: ${nonAscii.toLocaleString()} (${(nonAscii/size*100).toFixed(1)}%)`);

                              if (size > 10 * 1024 * 1024) {
                                console.warn(`\n%c⚠ File too large (${sizeMB} MB > 10 MB), only beautifying...`, 'color: #ff6600; font-weight: bold');
                                console.log(`%c💡 Tip: Files larger than 10MB may cause performance issues`, 'color: #ffaa00');
                                hookToast(`File too large (${sizeMB} MB), only beautifying...`, 'warning');
                                try {
                                  const beautified = await deobfuscator.beautify(repRespBody);
                                  setRepRespBody(beautified);
                                  hookToast('Beautification complete!', 'success');
                                } catch (error) {
                                  console.error('Beautification error:', error);
                                  hookToast('Beautification failed: ' + error.message, 'error');
                                }
                                return;
                              }

                              console.log(`\n%c🔍 Starting deobfuscation...`, 'color: #ff00ff; font-weight: bold');
                              hookToast(`Processing ${sizeMB} MB file...`, 'info');

                              try {
                                const deobfuscated = await deobfuscator.deobfuscateAndBeautify(repRespBody);
                                setRepRespBody(deobfuscated);
                                hookToast('✓ Deobfuscation complete! Check console for details.', 'success');

                                console.log(`\n%c✓ Deobfuscation Complete!`, 'color: #00ff00; font-weight: bold; font-size: 14px');
                                console.log(`  • Original size: ${sizeMB} MB`);
                                console.log(`  • Final size: ${(deobfuscated.length / 1024 / 1024).toFixed(2)} MB`);
                              } catch (error) {
                                console.error('Deobfuscation error:', error);
                                hookToast('Deobfuscation failed: ' + error.message, 'error');
                              }
                            },
                            title: "Deobfuscate & Beautify JavaScript (max 10MB)"     ,
                            disabled: deobfuscator.isProcessing,}

                            , deobfuscator.isProcessing ? '⏳ Processing...' : 'Deminify'
                          )
                          , React.createElement('button', { className: 'btn btn-sm ' + (repRespFormat === 'render' ? 'btn-p' : 'btn-s'), onClick: () => setRepRespFormat('render'),}, "Render")
                        )
                      )
                    )
                  )
                  , repResp && repResp.error ? (
                    React.createElement('div', { className: "code",}, repResp.error)
                  ) : repResp ? (
                    React.createElement('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' },
                         onContextMenu: e => showContextMenu(e, { method: repM, url: repU, headers: repH, body: repRespBody, response_body: repRespBody, response_headers: repResp.headers, response_status: repResp.status_code }, 'repeater-response'),}
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
                        if (repRespFormat === 'render') {
                          const blob = new Blob([repRespBody], { type: 'text/html' });
                          const blobUrl = URL.createObjectURL(blob);
                          return (
                            React.createElement('iframe', {
                              src: blobUrl,
                              sandbox: "allow-same-origin",
                              style: { flex: 1, width: '100%', border: 'none', background: '#fff' },
                              title: "Rendered Response" ,
                              onLoad: () => URL.revokeObjectURL(blobUrl),}
                            )
                          );
                        }
                        if (repSearch.debouncedSearchTerm) {
                          const hl = highlightMatches(repRespBody, repSearch.debouncedSearchTerm, repSearch.isRegex, repSearch.matchIndex);
                          if (hl.count !== repSearch.matchCount) setTimeout(() => repSearch.setMatchCount(hl.count), 0);
                          return React.createElement('div', { className: "code", ref: repSearch.contentRef, style: { flex: 1, overflow: 'auto' }, dangerouslySetInnerHTML: { __html: hl.html },} );
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
                          placeholder: repSearch.isRegex ? 'Regex search...' : 'Search body...',
                          value: repSearch.searchTerm,
                          onChange: e => { repSearch.setSearchTerm(e.target.value); repSearch.setMatchIndex(0); },
                          onKeyDown: e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); repSearch.nextMatch(); }
                            if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); repSearch.prevMatch(); }
                            if (e.key === 'Escape') { repSearch.close(); }
                          },
                          style: repSearch.isSearching ? { opacity: 0.7 } : {},}
                        )
                        , React.createElement('button', { className: 'srch-btn' + (repSearch.isRegex ? ' act' : ''), onClick: () => { repSearch.toggleRegex(); repSearch.setMatchIndex(0); }, title: "Toggle regex" ,}, ".*")
                        , React.createElement('span', { className: "search-info",}, repSearch.isSearching ? '⏳' : (repSearch.matchCount > 0 ? (repSearch.matchIndex + 1) + '/' + repSearch.matchCount : '0/0'))
                        , React.createElement('button', { className: "srch-btn", onClick: repSearch.prevMatch, disabled: repSearch.matchCount === 0,}, "▲")
                        , React.createElement('button', { className: "srch-btn", onClick: repSearch.nextMatch, disabled: repSearch.matchCount === 0,}, "▼")
                        , React.createElement('button', { className: "srch-btn", onClick: repSearch.close,}, "✕")
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
            , extensions.extensions.filter(ext => ext.name !== 'sensitive').map(ext => (
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
                , ext.enabled && (() => {
                  // 1. Si tiene custom_ui_file → usar DynamicExtensionUI (carga desde .ui.jsx)
                  if (ext.custom_ui_file) {
                    return React.createElement(DynamicExtensionUI, {
                      ext,
                      updateExtCfg,
                      toast,
                      // Props adicionales para extensiones que puedan necesitarlas
                      whkReqs,
                      whkApiKey,
                      setWhkApiKey,
                      whkLoading,
                      createWebhookToken,
                      refreshWebhook,
                      loadWebhookLocal
                    });
                  }

                  // 2. Si tiene ui_schema con tipo schema-driven → usar SchemaBasedUI
                  if (_optionalChain([ext, 'access', _65 => _65.ui_schema, 'optionalAccess', _66 => _66.type]) === 'schema-driven') {
                    return React.createElement(SchemaBasedUI, { ext, updateExtCfg });
                  }

                  // 3. Si está en registry de componentes custom → usar componente custom
                  if (EXTENSION_CUSTOM_COMPONENTS[ext.name]) {
                    return React.createElement(EXTENSION_CUSTOM_COMPONENTS[ext.name], {
                      ext,
                      updateExtCfg,
                      // Props específicas solo para extensiones que las necesitan
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
                    });
                  }

                  // 4. Fallback: extensión sin UI
                  return (
                    React.createElement('div', { style: { marginTop: '12px', padding: '12px', fontSize: '11px', color: 'var(--txt3)' },}, "Extension enabled (no UI configured)"

                    )
                  );
                })()
              )
            ))
          )
        )


        , tab === 'collections' && curPrj && (
          React.createElement('div', { className: "coll-cnt",}
            , React.createElement('div', { className: "hist-sub-tabs",}
              , React.createElement('div', { className: 'hist-sub-tab' + (collSubTab === 'collections' ? ' act' : ''), onClick: () => setCollSubTab('collections'),}, "Collections")
              , React.createElement('div', { className: 'hist-sub-tab' + (collSubTab === 'session-rules' ? ' act' : ''), onClick: () => { setCollSubTab('session-rules'); loadSessionRules(); },}, "Session Rules" )
            )

            , collSubTab === 'collections' && (
              React.createElement('div', { style: { display: 'flex', flex: 1, overflow: 'hidden' },}
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
                                  , resp.status_code, " • "  , _optionalChain([resp, 'access', _67 => _67.elapsed, 'optionalAccess', _68 => _68.toFixed, 'call', _69 => _69(3)]), "s"
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

            , collSubTab === 'session-rules' && (
              React.createElement('div', { style: { padding: '20px', overflow: 'auto', flex: 1 },}
                , React.createElement('div', { style: { maxWidth: '900px', margin: '0 auto' },}
                  , React.createElement('div', { style: { marginBottom: '24px', padding: '16px', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '4px' },}
                    , React.createElement('div', { style: { fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--cyan)' },}, "Add Session Rule"  )
                    , React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' },}
                      , React.createElement('div', null
                        , React.createElement('label', { style: { fontSize: '11px', color: 'var(--txt2)', display: 'block', marginBottom: '4px' },}, "Rule Name" )
                        , React.createElement('input', { className: "inp", value: newRule.name, onChange: e => setNewRule({ ...newRule, name: e.target.value }), placeholder: "My Session Token"  ,} )
                      )
                      , React.createElement('div', null
                        , React.createElement('label', { style: { fontSize: '11px', color: 'var(--txt2)', display: 'block', marginBottom: '4px' },}, "Variable Name" )
                        , React.createElement('input', { className: "inp", value: newRule.variable, onChange: e => setNewRule({ ...newRule, variable: e.target.value }), placeholder: "session_token",} )
                      )
                    )
                    , React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' },}
                      , React.createElement('div', null
                        , React.createElement('label', { style: { fontSize: '11px', color: 'var(--txt2)', display: 'block', marginBottom: '4px' },}, "When")
                        , React.createElement('select', { className: "sel", value: newRule.when, onChange: e => setNewRule({ ...newRule, when: e.target.value }),}
                          , React.createElement('option', { value: "request",}, "Request")
                          , React.createElement('option', { value: "response",}, "Response")
                          , React.createElement('option', { value: "both",}, "Both")
                        )
                      )
                      , React.createElement('div', null
                        , React.createElement('label', { style: { fontSize: '11px', color: 'var(--txt2)', display: 'block', marginBottom: '4px' },}, "Target")
                        , React.createElement('select', { className: "sel", value: newRule.target, onChange: e => setNewRule({ ...newRule, target: e.target.value }),}
                          , React.createElement('option', { value: "url",}, "URL")
                          , React.createElement('option', { value: "headers",}, "Headers")
                          , React.createElement('option', { value: "body",}, "Body")
                        )
                      )
                      , React.createElement('div', null
                        , React.createElement('label', { style: { fontSize: '11px', color: 'var(--txt2)', display: 'block', marginBottom: '4px' },}, "Group Number" )
                        , React.createElement('input', { className: "inp", type: "number", value: newRule.group, onChange: e => setNewRule({ ...newRule, group: parseInt(e.target.value) || 1 }),} )
                      )
                    )
                    , newRule.target === 'headers' && (
                      React.createElement('div', { style: { marginBottom: '12px' },}
                        , React.createElement('label', { style: { fontSize: '11px', color: 'var(--txt2)', display: 'block', marginBottom: '4px' },}, "Header Name" )
                        , React.createElement('input', { className: "inp", value: newRule.header, onChange: e => setNewRule({ ...newRule, header: e.target.value }), placeholder: "Set-Cookie",} )
                      )
                    )
                    , React.createElement('div', { style: { marginBottom: '12px' },}
                      , React.createElement('label', { style: { fontSize: '11px', color: 'var(--txt2)', display: 'block', marginBottom: '4px' },}, "Regex Pattern" )
                      , React.createElement('input', { className: "inp", value: newRule.regex, onChange: e => setNewRule({ ...newRule, regex: e.target.value }), placeholder: "session=([^;]+)", style: { fontFamily: 'var(--font-mono)', fontSize: '11px' },} )
                    )
                    , React.createElement('button', { className: "btn btn-p" , onClick: addSessionRule,}, "Add Rule" )
                  )

                  , React.createElement('div', { style: { marginBottom: '16px', fontSize: '13px', fontWeight: 600 },}, "Active Rules ("  , sessionRulesData.length, ")")
                  , sessionRulesData.map(rule => (
                    React.createElement('div', { key: rule.id, style: { marginBottom: '12px', padding: '12px', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '4px', opacity: rule.enabled ? 1 : 0.5 },}
                      , React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' },}
                        , React.createElement('input', { type: "checkbox", checked: rule.enabled, onChange: e => toggleSessionRule(rule.id, e.target.checked),} )
                        , React.createElement('div', { style: { flex: 1 },}
                          , React.createElement('div', { style: { fontSize: '12px', fontWeight: 600, color: 'var(--txt1)' },}, rule.name)
                          , React.createElement('div', { style: { fontSize: '10px', color: 'var(--txt2)', marginTop: '2px' },}, "Extract to variable: "
                               , React.createElement('code', { style: { background: 'var(--bg3)', padding: '1px 4px', borderRadius: '2px' },}, rule.variable)
                          )
                        )
                        , React.createElement('button', { className: "btn btn-sm btn-d"  , onClick: () => deleteSessionRule(rule.id),}, "Delete")
                      )
                      , React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px', fontSize: '10px', color: 'var(--txt2)' },}
                        , React.createElement('span', null, "When:"), React.createElement('span', null, rule.when)
                        , React.createElement('span', null, "Target:"), React.createElement('span', null, rule.target, rule.target === 'headers' && rule.header ? ' (' + rule.header + ')' : '')
                        , React.createElement('span', null, "Regex:"), React.createElement('code', { style: { background: 'var(--bg3)', padding: '2px 4px', borderRadius: '2px', fontFamily: 'var(--font-mono)' },}, rule.regex)
                        , React.createElement('span', null, "Group:"), React.createElement('span', null, rule.group)
                      )
                    )
                  ))
                  , sessionRulesData.length === 0 && (
                    React.createElement('div', { className: "empty", style: { padding: '30px' },}
                      , React.createElement('span', null, "No session rules configured"   )
                    )
                  )

                  , React.createElement('div', { style: { marginTop: '24px', padding: '16px', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '4px' },}
                    , React.createElement('div', { style: { fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--cyan)' },}, "Usage")
                    , React.createElement('div', { style: { fontSize: '11px', color: 'var(--txt2)', lineHeight: '1.6' },}, "Session rules automatically extract values from requests/responses using regex patterns. Extracted values are stored as variables that can be used in Collections."

                      , React.createElement('ul', { style: { marginTop: '8px', paddingLeft: '20px' },}
                        , React.createElement('li', null, "Use capturing groups in regex: "     , React.createElement('code', { style: { background: 'var(--bg3)', padding: '1px 4px', borderRadius: '2px' },}, "session=([^;]+)"))
                        , React.createElement('li', null, "Specify which group to extract (default is 1)"       )
                        , React.createElement('li', null, "Target can be URL, specific header, or body content"        )
                        , React.createElement('li', null, "Variables are automatically available in Collection requests as "        , '{{variable_name}}')
                      )
                    )
                  )
                )
              )
            )
          )
        )

        , tab === 'chepy' && curPrj && (
          React.createElement('div', { className: "chepy-cnt", ref: chepyCntRef,}
            , React.createElement('div', { className: "hist-sub-tabs",}
              , React.createElement('div', { className: 'hist-sub-tab' + (chepySubTab === 'cipher' ? ' act' : ''), onClick: () => setChepySubTab('cipher'),}, "Cipher")
              , React.createElement('div', { className: 'hist-sub-tab' + (chepySubTab === 'jwt' ? ' act' : ''), onClick: () => setChepySubTab('jwt'),}, "JWT")
            )

            , chepySubTab === 'cipher' && (
              React.createElement('div', { style: { display: 'flex', flex: 1, overflow: 'hidden' },}
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

            , chepySubTab === 'jwt' && (
              React.createElement('div', { className: "jwt-analyzer", style: { display: 'flex', flexDirection: 'column', flex: 1, padding: '20px', gap: '16px', overflow: 'auto' },}
                , React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' },}
                  , React.createElement('label', { style: { fontSize: '12px', fontWeight: 600, color: 'var(--txt1)' },}, "JWT Token" )
                  , React.createElement('textarea', {
                    className: "ed-ta",
                    style: { minHeight: '80px', fontFamily: 'var(--font-mono)', fontSize: '11px' },
                    value: jwtToken,
                    onChange: e => setJwtToken(e.target.value),
                    placeholder: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",}
                  )
                  , React.createElement('button', {
                    className: "btn btn-p" ,
                    onClick: () => {
                      const decoded = decodeJWT(jwtToken);
                      if (decoded) {
                        setJwtHeader(JSON.stringify(decoded.header, null, 2));
                        setJwtPayload(JSON.stringify(decoded.payload, null, 2));
                        setJwtSignature(decoded.signature);
                        toast('JWT decoded successfully', 'success');
                      } else {
                        toast('Invalid JWT token', 'error');
                      }
                    },
                    disabled: !jwtToken,}
, "Decode JWT"

                  )
                )

                , React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },}
                  , React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' },}
                    , React.createElement('label', { style: { fontSize: '12px', fontWeight: 600, color: 'var(--txt1)' },}, "Header (JSON)" )
                    , React.createElement('textarea', {
                      className: "ed-ta",
                      style: { minHeight: '120px', fontFamily: 'var(--font-mono)', fontSize: '11px' },
                      value: jwtHeader,
                      onChange: e => setJwtHeader(e.target.value),
                      placeholder: "{\\n  \"alg\": \"HS256\",\\n  \"typ\": \"JWT\"\\n}"      ,}
                    )
                  )

                  , React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' },}
                    , React.createElement('label', { style: { fontSize: '12px', fontWeight: 600, color: 'var(--txt1)' },}, "Payload (JSON)" )
                    , React.createElement('textarea', {
                      className: "ed-ta",
                      style: { minHeight: '120px', fontFamily: 'var(--font-mono)', fontSize: '11px' },
                      value: jwtPayload,
                      onChange: e => setJwtPayload(e.target.value),
                      placeholder: "{\\n  \"sub\": \"1234567890\",\\n  \"name\": \"John Doe\",\\n  \"iat\": 1516239022\\n}"          ,}
                    )
                  )
                )

                , React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' },}
                  , React.createElement('label', { style: { fontSize: '12px', fontWeight: 600, color: 'var(--txt1)' },}, "Signature")
                  , React.createElement('input', {
                    className: "inp",
                    style: { fontFamily: 'var(--font-mono)', fontSize: '11px' },
                    value: jwtSignature,
                    onChange: e => setJwtSignature(e.target.value),
                    placeholder: "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",}
                  )
                )

                , React.createElement('button', {
                  className: "btn btn-p" ,
                  onClick: () => {
                    try {
                      const header = JSON.parse(jwtHeader);
                      const payload = JSON.parse(jwtPayload);
                      const token = encodeJWT(header, payload, jwtSignature);
                      if (token) {
                        setJwtToken(token);
                        toast('JWT encoded successfully', 'success');
                      } else {
                        toast('Failed to encode JWT', 'error');
                      }
                    } catch (e) {
                      toast('Invalid JSON in header or payload', 'error');
                    }
                  },}
, "Encode JWT"

                )

                , React.createElement('div', { style: { marginTop: '20px', padding: '16px', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '4px' },}
                  , React.createElement('div', { style: { fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--cyan)' },}, "Common JWT Attacks"  )
                  , React.createElement('div', { style: { fontSize: '11px', color: 'var(--txt2)', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '12px' },}
                    , React.createElement('div', null
                      , React.createElement('div', { style: { fontWeight: 600, color: 'var(--txt1)', marginBottom: '4px' },}, "1. Algorithm Confusion (alg=none)"   )
                      , React.createElement('div', null, "Change the \"alg\" field in the header to \"none\" and remove the signature. Some implementations don't verify signatures when alg is none."                     )
                      , React.createElement('code', { style: { display: 'block', marginTop: '4px', padding: '6px', background: 'var(--bg3)', borderRadius: '2px', fontSize: '10px' },}, '{"alg": "none", "typ": "JWT"}')
                    )
                    , React.createElement('div', null
                      , React.createElement('div', { style: { fontWeight: 600, color: 'var(--txt1)', marginBottom: '4px' },}, "2. Key Confusion Attack"   )
                      , React.createElement('div', null, "Change \"alg\" from RS256 (asymmetric) to HS256 (symmetric). If the server uses the public key as HMAC secret, you can forge signatures."                     )
                    )
                    , React.createElement('div', null
                      , React.createElement('div', { style: { fontWeight: 600, color: 'var(--txt1)', marginBottom: '4px' },}, "3. Weak Secret Brute Force"    )
                      , React.createElement('div', null, "If HS256/HS512 is used with a weak secret, the signature can be brute-forced offline. Use tools like hashcat or jwt_tool."                   )
                    )
                    , React.createElement('div', null
                      , React.createElement('div', { style: { fontWeight: 600, color: 'var(--txt1)', marginBottom: '4px' },}, "4. JKU/X5U Header Injection"   )
                      , React.createElement('div', null, "Add \"jku\" (JWK Set URL) or \"x5u\" (X.509 URL) headers pointing to attacker-controlled keys. If not validated, server may accept forged tokens."                     )
                    )
                    , React.createElement('div', null
                      , React.createElement('div', { style: { fontWeight: 600, color: 'var(--txt1)', marginBottom: '4px' },}, "5. Kid Header Injection"   )
                      , React.createElement('div', null, "The \"kid\" (Key ID) parameter can sometimes be exploited for path traversal or SQL injection if used unsafely in key lookup."                    )
                    )
                  )
                )
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
                  , React.createElement('label', { style: { fontSize: '10px', color: 'var(--txt2)', display: 'flex', alignItems: 'center', gap: '4px' },}, "Entropy ≥"

                    , React.createElement('input', {
                      type: "number",
                      min: "0",
                      max: "8",
                      step: "0.1",
                      value: sensEntropyThreshold,
                      onChange: e => setSensEntropyThreshold(parseFloat(e.target.value) || 0),
                      style: { width: '50px', padding: '2px 4px', background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '4px', color: 'var(--txt)', fontSize: '10px', fontFamily: 'var(--font-mono)' },
                      title: "Minimum entropy threshold to filter false positives (e.g., HTML tags). Default: 2.5"           ,}
                    )
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

        , tab === 'bypass' && curPrj && React.createElement(BypassManagerComponent, { toast: hookToast, bypass: bypass })

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
            , React.createElement('div', { className: "intr-cnt", style: { flex: 1, minWidth: 0 },}
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
                    , React.createElement('input', { ref: intUrlRef, className: "url-in", placeholder: "https://example.com/api/endpoint", value: intUrl, onChange: e => setIntUrl(e.target.value), style: { flex: 1 },} )
                  )
                  , React.createElement('label', { style: { fontSize: 10, color: 'var(--txt3)', display: 'block', marginBottom: 4 },}, "Headers")
                  , React.createElement('div', { className: "hdr-wrap",}
                    , React.createElement('pre', { ref: intHeadersHighlightRef, className: "hdr-highlight int-editor" , 'aria-hidden': "true", dangerouslySetInnerHTML: { __html: (intHeaders ? colorizeHeaders(intHeaders) : '') + '\n' },} )
                    , React.createElement('textarea', { ref: intHeadersRef, className: "int-editor hdr-ta" , rows: 4, value: intHeaders, onChange: e => setIntHeaders(e.target.value),
                      onScroll: e => { if (intHeadersHighlightRef.current) intHeadersHighlightRef.current.scrollTop = e.target.scrollTop; },
                      placeholder: 'Content-Type: application/json\nAuthorization: Bearer \u00a7token\u00a7', spellCheck: "false",} )
                  )
                  , React.createElement('label', { style: { fontSize: 10, color: 'var(--txt3)', display: 'block', marginBottom: 4, marginTop: 8 },}, "Body")
                  , React.createElement('textarea', { ref: intBodyRef, className: "int-editor", rows: 6, value: intBody, onChange: e => setIntBody(e.target.value),
                    placeholder: '{"username":"\u00a7user\u00a7","password":"\u00a7pass\u00a7"}',} )
                )

                , React.createElement('div', { className: "int-section",}
                  , React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 },}
                    , React.createElement('button', { className: "btn btn-sm btn-p"  , onClick: () => {
                      const ref = intUrlRef.current || intHeadersRef.current || intBodyRef.current;
                      if (!ref) return;
                      const start = ref.selectionStart;
                      const end = ref.selectionEnd;
                      if (start === end) { toast('Select text first', 'error'); return; }
                      const val = ref.value;
                      const selected = val.substring(start, end);
                      const nv = val.substring(0, start) + '\u00a7' + selected + '\u00a7' + val.substring(end);
                      if (ref === intUrlRef.current) setIntUrl(nv);
                      else if (ref === intHeadersRef.current) setIntHeaders(nv);
                      else if (ref === intBodyRef.current) setIntBody(nv);
                      setTimeout(() => ref.focus(), 0);
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

        /* Generic handler for extension custom tabs */
        , curPrj && (() => {
          // Lista de extensiones que ya tienen implementación hardcoded arriba
          const hardcodedTabs = ['chepy', 'sensitive', 'intruder'];

          // Check if current tab matches an extension name (excluding hardcoded ones)
          const activeExt = extensions.extensions.find(ext =>
            ext.enabled &&
            ext.tabs &&
            ext.tabs.length > 0 &&
            tab === ext.name &&
            !hardcodedTabs.includes(ext.name)
          );

          if (!activeExt) return null;

          // Determine which UI component to use (same priority as Extensions tab)
          let uiComponent = null;

          // 1. Si tiene custom_ui_file → usar DynamicExtensionUI (carga desde .ui.jsx)
          if (activeExt.custom_ui_file) {
            uiComponent = React.createElement(DynamicExtensionUI, {
              ext: activeExt,
              updateExtCfg,
              toast,
              whkReqs,
              whkApiKey,
              setWhkApiKey,
              whkLoading,
              createWebhookToken,
              refreshWebhook,
              loadWebhookLocal
            });
          }
          // 2. Si tiene ui_schema con tipo schema-driven → usar SchemaBasedUI
          else if (_optionalChain([activeExt, 'access', _70 => _70.ui_schema, 'optionalAccess', _71 => _71.type]) === 'schema-driven') {
            uiComponent = React.createElement(SchemaBasedUI, { ext: activeExt, updateExtCfg });
          }
          // 3. Si está en registry de componentes custom → usar componente custom
          else if (EXTENSION_CUSTOM_COMPONENTS[activeExt.name]) {
            uiComponent = React.createElement(EXTENSION_CUSTOM_COMPONENTS[activeExt.name], {
              ext: activeExt,
              updateExtCfg,
              ...(activeExt.name === 'webhook_site' ? {
                whkReqs,
                whkApiKey,
                setWhkApiKey,
                whkLoading,
                createWebhookToken,
                refreshWebhook,
                loadWebhookLocal,
                toast
              } : {})
            });
          }
          // 4. Fallback: extensión sin UI
          else {
            uiComponent = (
              React.createElement('div', { style: { marginTop: '12px', padding: '12px', fontSize: '11px', color: 'var(--txt3)' },}, "Extension enabled (no UI configured)"

              )
            );
          }

          return (
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '20px' },}
              , uiComponent
            )
          );
        })()
      )

      , React.createElement('div', { className: "toast-c",}
        , toasts.map(t => (
          React.createElement('div', { key: t.id, className: 'toast ' + t.type,}, t.message)
        ))
      )

      , contextMenu && (
        React.createElement('div', { ref: ctxMenuRef, className: "context-menu", style: { left: contextMenu.x, top: contextMenu.y }, onClick: e => e.stopPropagation(),}
          , (() => {
            const hasBody = _optionalChain([contextMenu, 'access', _72 => _72.normalized, 'optionalAccess', _73 => _73.body]) || _optionalChain([contextMenu, 'access', _74 => _74.request, 'optionalAccess', _75 => _75.response_body]) || contextMenu.source === 'selection';
            const hasUrl = _optionalChain([contextMenu, 'access', _76 => _76.normalized, 'optionalAccess', _77 => _77.url]);
            const isSelection = contextMenu.source === 'selection';
            const currentTab = contextMenu.currentTab;
            const hasRequest = _optionalChain([contextMenu, 'access', _78 => _78.normalized, 'optionalAccess', _79 => _79.method]) && _optionalChain([contextMenu, 'access', _80 => _80.normalized, 'optionalAccess', _81 => _81.url]);

            return (
              React.createElement(React.Fragment, null
                /* Send to Tools */
                , hasBody && (
                  React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('send-to-cipher'),}, "Send to Cipher"

                  )
                )
                , hasRequest && !isSelection && currentTab !== 'repeater' && currentTab !== 'intruder' && (
                  React.createElement(React.Fragment, null
                    , React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('repeater'),}, "Send to Repeater"

                    )
                    , React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('intruder'),}, "Send to Intruder"

                    )
                  )
                )
                , hasRequest && !isSelection && currentTab !== 'collections' && (
                  React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('add-to-collection'),}, "Add to Collection"

                  )
                )
                , hasRequest && !isSelection && currentTab !== 'compare' && (
                  React.createElement(React.Fragment, null
                    , React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('compare-a'),}, "Send to Compare (A)"

                    )
                    , React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('compare-b'),}, "Send to Compare (B)"

                    )
                  )
                )

                /* Copy/Download Actions */
                , (hasBody || hasUrl) && React.createElement('div', { className: "context-menu-divider",} )
                , hasUrl && (
                  React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('copy-url'),}, "Copy URL"

                  )
                )
                , hasRequest && (
                  React.createElement(React.Fragment, null
                    , React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('copy-curl'),}, "Copy as cURL"

                    )
                    , React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('download-sqlmap'),}, "Download for SQLMap"

                    )
                  )
                )
                , hasBody && (
                  React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('copy-body'),}, "Copy Body"

                  )
                )
                , hasBody && !isSelection && (
                  React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('download-body'),}, "Download Body"

                  )
                )

                /* Browser Actions */
                , hasRequest && !isSelection && currentTab === 'history' && (
                  React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('replay-browser'),}, "Replay in Browser"

                  )
                )
                , (hasBody || hasRequest) && !isSelection && (
                  React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('render-browser'),}, "Render in Browser"

                  )
                )

                /* Scope Actions */
                , hasUrl && !isSelection && currentTab !== 'scope' && (
                  React.createElement(React.Fragment, null
                    , React.createElement('div', { className: "context-menu-divider",} )
                    , React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('scope-include'),}, "Add host to Scope"

                    )
                    , React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('scope-exclude'),}, "Exclude host from Scope"

                    )
                  )
                )

                /* Tab-Specific Actions */
                , currentTab === 'history' && contextMenu.request.id && (
                  React.createElement(React.Fragment, null
                    , React.createElement('div', { className: "context-menu-divider",} )
                    , React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('favorite'),}
                      , contextMenu.request.saved ? 'Unmark' : 'Mark', " as Favorite"
                    )
                    , React.createElement('div', { className: "context-menu-item", onClick: () => handleContextAction('delete'),}, "Delete Request"

                    )
                  )
                )
                , currentTab === 'repeater' && selRep && (
                  React.createElement(React.Fragment, null
                    , React.createElement('div', { className: "context-menu-divider",} )
                    , React.createElement('div', { className: "context-menu-item", onClick: () => renameRepItem(selRep),}, "Rename Saved Request"

                    )
                    , React.createElement('div', { className: "context-menu-item", onClick: () => delRepItem(selRep),}, "Delete Saved Request"

                    )
                  )
                )
              )
            );
          })()
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

        , tab === 'console' && curPrj && (() => {
          const levelColor = { DEBUG: 'var(--txt3)', INFO: 'var(--cyan)', WARNING: 'var(--orange)', ERROR: 'var(--red)', CRITICAL: 'var(--red)' };
          const levelBg   = { DEBUG: 'transparent', INFO: 'transparent', WARNING: 'rgba(255,165,0,0.06)', ERROR: 'rgba(220,50,50,0.08)', CRITICAL: 'rgba(220,50,50,0.12)' };
          return (
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden' },}
              /* Toolbar */
              , React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: '1px solid var(--brd)', flexShrink: 0, flexWrap: 'wrap' },}
                , React.createElement('span', { style: { fontSize: '11px', color: proxyConsole.connected ? 'var(--green)' : 'var(--txt3)', display: 'flex', alignItems: 'center', gap: '5px', minWidth: '80px' },}
                  , React.createElement('span', { style: { width: '7px', height: '7px', borderRadius: '50%', background: proxyConsole.connected ? 'var(--green)' : 'var(--txt3)', display: 'inline-block' },} )
                  , proxyConsole.connected ? 'Live' : 'Disconnected'
                )
                , React.createElement('input', {
                  className: "inp",
                  style: { flex: 1, minWidth: '160px', fontSize: '11px', padding: '4px 8px' },
                  placeholder: "Filter messages..." ,
                  value: proxyConsole.filter,
                  onChange: e => proxyConsole.setFilter(e.target.value),}
                )
                , React.createElement('select', {
                  className: "sel",
                  style: { fontSize: '11px', padding: '4px 6px' },
                  value: proxyConsole.levelFilter,
                  onChange: e => proxyConsole.setLevelFilter(e.target.value),}

                  , React.createElement('option', { value: "ALL",}, "All levels" )
                  , React.createElement('option', { value: "DEBUG",}, "DEBUG")
                  , React.createElement('option', { value: "INFO",}, "INFO")
                  , React.createElement('option', { value: "WARNING",}, "WARNING")
                  , React.createElement('option', { value: "ERROR",}, "ERROR")
                  , React.createElement('option', { value: "CRITICAL",}, "CRITICAL")
                )
                , React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--txt2)', cursor: 'pointer', userSelect: 'none' },}
                  , React.createElement('input', { type: "checkbox", checked: proxyConsole.autoScroll, onChange: e => proxyConsole.setAutoScroll(e.target.checked),} ), "Auto-scroll"

                )
                , React.createElement('button', { className: "btn btn-sm btn-s"  , onClick: proxyConsole.clearLogs,}, "Clear")
                , React.createElement('span', { style: { fontSize: '10px', color: 'var(--txt3)' },}, proxyConsole.filteredLogs.length, " entries" )
              )
              /* Log area */
              , React.createElement('div', { style: { flex: 1, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '4px 0' },}
                , proxyConsole.filteredLogs.length === 0 ? (
                  React.createElement('div', { className: "empty",}
                    , React.createElement('div', { className: "empty-i",}, "▶")
                    , React.createElement('span', null, proxyConsole.logs.length === 0 ? 'No proxy logs yet. Start the proxy to see output here.' : 'No entries match the current filter.')
                  )
                ) : (
                  proxyConsole.filteredLogs.map((entry, i) => (
                    React.createElement('div', { key: i, style: { display: 'flex', gap: '8px', padding: '2px 12px', borderBottom: '1px solid var(--brd)', background: levelBg[entry.level] || 'transparent', lineHeight: '1.5' },}
                      , React.createElement('span', { style: { color: 'var(--txt3)', flexShrink: 0, minWidth: '82px' },}
                        , entry.ts ? entry.ts.replace('T', ' ').replace(/\.\d+Z$/, 'Z') : ''
                      )
                      , React.createElement('span', { style: { color: levelColor[entry.level] || 'var(--txt)', fontWeight: '600', flexShrink: 0, minWidth: '50px' },}
                        , entry.level
                      )
                      , React.createElement('span', { style: { color: 'var(--txt3)', flexShrink: 0, minWidth: '90px', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: entry.name,}
                        , entry.name
                      )
                      , React.createElement('span', { style: { color: 'var(--txt)', wordBreak: 'break-all', whiteSpace: 'pre-wrap' },}, entry.msg)
                    )
                  ))
                )
                , React.createElement('div', { ref: consoleEndRef,} )
              )
            )
          );
        })()

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
