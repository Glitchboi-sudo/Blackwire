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

// Componentes y helpers extraídos (servidos transpilados desde /src/).
import { ResizeHandle } from './src/components/ResizeHandle.jsx';
import { BypassManager } from './src/components/BypassManager.jsx';
import { buildSiteTree, collectNodeReqs } from './src/utils/sitemap.js';
import { highlightMatches } from './src/utils/highlight.js';
import { MatchReplaceUI } from './src/components/extensions/MatchReplaceUI.jsx';
import { SchemaBasedUI } from './src/components/extensions/SchemaBasedUI.jsx';
import { DynamicExtensionUI } from './src/components/extensions/DynamicExtensionUI.jsx';
import { ProjectsPanel } from './src/components/tabs/ProjectsPanel.jsx';
import { HistoryPanel } from './src/components/tabs/HistoryPanel.jsx';
import { InterceptPanel } from './src/components/tabs/InterceptPanel.jsx';
import { ScopePanel } from './src/components/tabs/ScopePanel.jsx';
import { RepeaterPanel } from './src/components/tabs/RepeaterPanel.jsx';
import { WikiPanel } from './src/components/tabs/WikiPanel.jsx';
import { ExtensionsPanel } from './src/components/tabs/ExtensionsPanel.jsx';
import { CollectionsPanel } from './src/components/tabs/CollectionsPanel.jsx';
import { ChepyPanel } from './src/components/tabs/ChepyPanel.jsx';
import { SensitivePanel } from './src/components/tabs/SensitivePanel.jsx';
import { IntruderPanel } from './src/components/tabs/IntruderPanel.jsx';
import { ComparePanel } from './src/components/tabs/ComparePanel.jsx';
import { ConsolePanel } from './src/components/tabs/ConsolePanel.jsx';
import { ExtensionTabsPanel } from './src/components/tabs/ExtensionTabsPanel.jsx';

const { useState, useEffect, useRef } = React;

const API = '';
const WS_URL = 'ws://' + location.host + '/ws';

const THEMES = window.BW_THEMES || {};

// Registry de componentes de extensión custom (UIs complejas).
const EXTENSION_CUSTOM_COMPONENTS = {
  'match_replace': MatchReplaceUI,
};

// Aísla los fallos de render de una pestaña para que no tumben toda la GUI.
// Keyed por `tab` en el render: al cambiar de pestaña, el boundary se resetea.
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('[Blackwire] tab render error:', error, info); }
  render() {
    if (this.state.error) {
      return React.createElement('div', { className: 'empty', style: { padding: 30, textAlign: 'center' } },
        React.createElement('div', { className: 'empty-i' }, '⚠'),
        React.createElement('div', { style: { color: 'var(--red)', fontWeight: 600, marginBottom: 8 } }, 'Algo falló en esta pestaña'),
        React.createElement('div', { style: { color: 'var(--txt3)', fontSize: 12, maxWidth: 500, wordBreak: 'break-word' } },
          String((this.state.error && this.state.error.message) || this.state.error)),
        React.createElement('button', { className: 'btn btn-s', style: { marginTop: 12 }, onClick: () => this.setState({ error: null }) }, 'Reintentar')
      );
    }
    return this.props.children;
  }
}

function Blackwire() {
  // Estado principal
  const [tab, setTab] = useState('projects');
  const [scopeSubTab, setScopeSubTab] = useState('scope');

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
  const [themeId, setThemeId] = useLocalStorage('bw_theme', 'githubdark');

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

  // Resizable panels — persistidos en localStorage para conservar el layout
  // "a gusto" entre recargas.
  const [histPanelW, setHistPanelW] = useLocalStorage('bw_histPanelW', 44);
  const [repSideW, setRepSideW] = useLocalStorage('bw_repSideW', 200);
  const [repSplitPct, setRepSplitPct] = useLocalStorage('bw_repSplitPct', 50);
  const [repHdrPct, setRepHdrPct] = useLocalStorage('bw_repHdrPct', 40);
  const [repRespHdrH, setRepRespHdrH] = useLocalStorage('bw_repRespHdrH', 100);
  const [cmpSplitPct, setCmpSplitPct] = useLocalStorage('bw_cmpSplitPct', 50);
  const [smDetPct, setSmDetPct] = useLocalStorage('bw_smDetPct', 50);
  const [intPendW, setIntPendW] = useLocalStorage('bw_intPendW', 280);
  const [wsConnsW, setWsConnsW] = useLocalStorage('bw_wsConnsW', 220);
  const [wsFramesW, setWsFramesW] = useLocalStorage('bw_wsFramesW', 300);
  const [chepyInW, setChepyInW] = useLocalStorage('bw_chepyInW', 30);
  const [chepyRecW, setChepyRecW] = useLocalStorage('bw_chepyRecW', 30);
  const [collSideW, setCollSideW] = useLocalStorage('bw_collSideW', 200);
  const [collStepsW, setCollStepsW] = useLocalStorage('bw_collStepsW', 350);
  const [smTreeW, setSmTreeW] = useLocalStorage('bw_smTreeW', 38);

  // Body search
  const histSearch = useBodySearch();
  const repSearch = useBodySearch();

  // Domain Hooks Initialization
  // Initialize toast first (needed by other hooks)
  const { toasts: hookToasts, toast: hookToast } = useToast();


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
  const wsResendMsg = websockets.resendMsg;
  const wsResendResp = websockets.resendResp;
  const wsSending = websockets.sending;
  const setWsResendMsg = websockets.setResendMsg;
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
  }, [curPrj, tab, currentPage, pageSize, search, savedOnly, scopeOnly]);

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
    await projects.load();
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
      await projects.load();
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
          await projects.load();
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
    // Tope de 50 entradas para acotar el crecimiento al persistir en la DB.
    const newHistory = [...repHistory.slice(0, repHistoryIndex + 1), historyItem].slice(-50);
    setRepHistory(newHistory);
    setRepHistoryIndex(newHistory.length - 1);
    return newHistory;
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

    // Guardar en historial de navegación (devuelve el array para persistirlo)
    const newHistory = saveToHistory(requestData, r);

    if (selRep) {
      // Actualizar el tab existente con la request/response más reciente + timeline
      await repeaterService.update(selRep, { method: repM, url: repU, headers: h, body: repB, last_response: r, history: newHistory });
      const items = await repeaterService.list();
      setRepReqs(items);
    } else {
      // Sin tab activo: crear uno nuevo y persistir el timeline
      let host = repU;
      try { host = new URL(repU).host; } catch (e) {}
      const timestamp = new Date().toLocaleTimeString();
      const autoName = `${repM} ${host} [${timestamp}]`;
      const newItem = await repeaterService.save(autoName, repM, repU, h, repB, r);
      if (newItem && newItem.id) {
        await repeaterService.update(newItem.id, { history: newHistory });
        setSelRep(newItem.id);
      }
      const items = await repeaterService.list();
      setRepReqs(items);
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
    const combos = generateAttackCombinations(intUrl, intHeaders, intBody, intMethod, intAttackType, intPayloads, parseIntPositions);
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
    // Rehidratar el timeline de respuestas persistido (si lo hay)
    const hist = r.history || [];
    setRepHistory(hist);
    setRepHistoryIndex(hist.length ? hist.length - 1 : -1);
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

    if (format === 'pretty') {
      // Best-effort: prettyPrint nunca lanza (devuelve el input si no sabe formatear).
      const formatted = prettyPrint(body);
      const lang = detectLanguage(body);
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
        // No reconocido: aun así formatea y colorea en vez de devolver crudo.
        default: return colorizeBody(formatted);
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

  // Pretty/Minify del body del repeater: reescriben el texto, por lo que el offset
  // de caret guardado queda obsoleto. Se anula (caret=null) para que el efecto NO
  // restaure una posición vieja y el overlay coloreado quede sincronizado.
  const prettyRepBody = () => {
    repBodyCaretRef.current = null;
    setRepB(prettyPrint(repB));
    setRepBodyColor(true);
  };
  const minifyRepBody = () => {
    repBodyCaretRef.current = null;
    setRepB(minify(repB));
    setRepBodyColor(false);
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
    const norm = _optionalChain([contextMenu, 'optionalAccess', _55 => _55.normalized]);
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
      case 'copy-body': {
        // Respetar la pestaña activa en History (request vs response).
        const onResp = source === 'repeater-response' || (source === 'history' && detTab === 'response');
        const bodyToCopy = onResp ? (req.response_body || '') : (norm.body || '');
        navigator.clipboard.writeText(bodyToCopy);
        toast(onResp ? 'Response body copied' : 'Request body copied', 'success');
        break;
      }
      case 'download-body': {
        // Respetar la pestaña activa en History (request vs response).
        const onResp = source === 'repeater-response' || (source === 'history' && detTab === 'response');
        // Descarga vía <a download> (no window.open: evita bloqueo de popups / pestaña en blanco).
        const triggerDownload = (href, fname, revoke) => {
          const a = document.createElement('a');
          a.href = href; a.download = fname;
          document.body.appendChild(a); a.click(); a.remove();
          if (revoke) URL.revokeObjectURL(href);
        };

        // History: si no está truncado en memoria, descargar directo desde el backend.
        if (source === 'history' && req.id) {
          const inMem = onResp ? req.response_body : norm.body;
          const truncated = !!(inMem && inMem.includes('[...TRUNCATED at'));
          if (!truncated) {
            const ep = onResp ? 'download-response-body' : 'download-body';
            triggerDownload(API + '/api/requests/' + req.id + '/' + ep,
                            (onResp ? 'response' : 'request') + '-body-' + req.id + '.txt', false);
            toast('Downloading ' + (onResp ? 'response' : 'request') + ' body...', 'success');
            break;
          }
        }

        // Repeater / body en memoria (o history truncado): descargar el blob local.
        const bodyToDownload = onResp ? (req.response_body || '') : (norm.body || '');
        const isTruncated = !!(bodyToDownload && bodyToDownload.includes('[...TRUNCATED at'));
        if (bodyToDownload) {
          const blob = new Blob([bodyToDownload], { type: 'application/octet-stream' });
          triggerDownload(URL.createObjectURL(blob), (onResp ? 'response' : 'request') + '-body.txt', true);
          toast(isTruncated ? 'Downloaded truncated body (limited to 1MB)' : 'Downloading body...',
                isTruncated ? 'warning' : 'success');
        } else {
          toast('No body available to download', 'error');
        }
        break;
      }
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
      case 'send-to-cipher': {
        const onResp = source === 'repeater-response' || (source === 'history' && detTab === 'response');
        const bodyToSend = onResp ? (req.response_body || '') : (norm.body || '');
        if (bodyToSend) {
          setChepyIn(bodyToSend);
          setTab('chepy');
          toast('Sent to Cipher', 'success');
        } else {
          toast('No text selected', 'error');
        }
        break;
      }
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
                // Evita bucle infinito si un patrón puede coincidir en vacío (lastIndex no avanza).
                if (m.index === re.lastIndex) re.lastIndex++;
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
    : (THEMES.githubdark && THEMES.githubdark.vars) ? THEMES.githubdark.vars : {};

  // Estado/handlers expuestos a los paneles de pestaña (src/components/tabs/).
  const __appCtx = { API, DynamicExtensionUI, EXTENSION_CUSTOM_COMPONENTS, ResizeHandle, SENS_COLORS, SENS_FILES, SENS_GENERAL, SENS_TOKENS, SENS_URLS, SchemaBasedUI, addChepyOp, addRule, addSessionRule, api, applyPreset, bakeChepy, chepy, chepyBaking, chepyCat, chepyCntRef, chepyErr, chepyIn, chepyInW, chepyOps, chepyOut, chepyRecW, chepySelCat, chepySubTab, clearChepyRecipe, clearHist, cmpA, cmpB, cmpDiff, cmpSplitPct, cmpView, cmtMsg, collItems, collResps, collRunning, collSideW, collStep, collStepsW, collSubTab, collVars, collections, colls, colorizeBody, colorizeHeaders, commit, commits, consoleEndRef, createColl, createPrj, createWebhookToken, currentPage, decodeJWT, delPreset, delPrj, delRepItem, delReq, deleteColl, deleteCollItem, deleteIntAttack, deleteSessionRule, detTab, dropAll, dropReq, editReq, encodeJWT, escapeHtml, executeCollStep, exportProject, exportProjectBurp, exportSitemap, extensions, filtered, firstPage, fmtH, fmtHHtml, fmtTime, followRedirect, formatBody, fwdAll, fwdReq, git, handleRepBodyInput, highlightMatches, histContentRef, histPanelW, histSearch, histSubTab, hookToast, httpqlError, importAsNewProject, importBurpXML, importProject, intAttackType, intAttacks, intBody, intBodyRef, intComputeTotal, intConcurrency, intDelay, intDelayMax, intDelayMin, intDone, intFilter, intFollowRedirects, intHeaders, intHeadersHighlightRef, intHeadersRef, intMaxRetries, intMethod, intOn, intPayloads, intPct, intPendW, intPositions, intRandomDelay, intResults, intRunning, intSelAttack, intSelPayloadSet, intSelResult, intSortCol, intSortDir, intSorted, intStartTime, intSubTab, intTimeout, intTotal, intUrl, intUrlRef, intercept, interceptHeadersHighlightRef, interceptHeadersRef, jwtHeader, jwtPayload, jwtSignature, jwtToken, lastPage, loadCollItems, loadIntAttack, loadRepItem, loadReqs, loadSensDetail, loadSessionRules, loadWebhookLocal, loadWsConns, loadWsFrames, loading, minify, moveChepyOp, navigateHistory, newDesc, newName, newPat, newRule, newType, nextPage, pageSize, pagination, pending, presetName, presets, prettyPrint, prettyRepBody, minifyRepBody, prevPage, prjs, projects, proxyConsole, pxPort, refreshWebhook, removeChepyOp, renameIntAttack, renameRepItem, renderTreeNode, repB, repBodyColor, repBodyEditRef, repCntRef, repFollowRedirects, repH, repHeadersHighlightRef, repHeadersRef, repHistory, repHistoryIndex, repM, repReqs, repResp, repRespBody, repRespFormat, repSearch, repHdrPct, repRespHdrH, repSideW, repSplitPct, repU, repeater, reqFormat, reqs, requests, resendWsFrame, resetCollRun, respFormat, runIntruderAttack, runSensitiveScan, savePreset, saveRep, savedOnly, scope, scopeOnly, scopeRules, search, selColl, selPend, selRep, selReq, selReqFull, selWsConn, selWsFrame, selectPrj, selectWsFrame, sendRep, sensBatch, sensDetailRef, sensEntropyThreshold, sensFilter, sensFiltered, sensMaxSize, sensPatterns, sensPct, sensResults, sensScanning, sensScopeOnly, sensSelDetail, sensSelResult, sensSubTab, sensUnique, sensitive, sessionRulesData, setChepyIn, setChepyInW, setChepyRecW, setChepySelCat, setChepySubTab, setCmpA, setCmpB, setCmpSplitPct, setCmpView, setCmtMsg, setCollSideW, setCollStep, setCollStepsW, setCollSubTab, setDetTab, setEditReq, setHistPanelW, setHistSubTab, setIntAttackType, setIntBody, setIntConcurrency, setIntDelay, setIntDelayMax, setIntDelayMin, setIntDone, setIntFilter, setIntFollowRedirects, setIntHeaders, setIntMaxRetries, setIntMethod, setIntPayloads, setIntPct, setIntPendW, setIntRandomDelay, setIntResults, setIntSelAttack, setIntSelPayloadSet, setIntSelResult, setIntSortCol, setIntSortDir, setIntSubTab, setIntTimeout, setIntTotal, setIntUrl, setJwtHeader, setJwtPayload, setJwtSignature, setJwtToken, setNewDesc, setNewName, setNewPat, setNewRule, setNewType, setPageSize, setPresetName, setRepB, setRepBodyColor, setRepFollowRedirects, setRepH, setRepM, setRepHdrPct, setRepRespBody, setRepRespFormat, setRepRespHdrH, setRepSideW, setRepSplitPct, setRepU, setReqFormat, setRespFormat, setSavedOnly, setScopeOnly, setSearch, setSelPend, setSelReq, setSensBatch, setSensEntropyThreshold, setSensFilter, setSensMaxSize, setSensPatterns, setSensPct, setSensResults, setSensScopeOnly, setSensSelDetail, setSensSelResult, setSensSubTab, setSensUnique, setShowNew, setShowPresets, setSmDetPct, setSmExpanded, setSmFilterExt, setSmFilterMethod, setSmFilterStatus, setSmFilterText, setSmSelNode, setSmShowStats, setSmTreeW, setWhkApiKey, setWsConnsW, setWsFramesW, setWsResendMsg, showContextMenu, showNew, showPresets, siteTree, smContentRef, smFilterExt, smFilterMethod, smFilterStatus, smFilterText, smDetPct, smNodeReqs, smSelNode, smShowStats, smStats, smTreeW, stCls, stopIntruderAttack, stopSensitiveScan, tab, toRep, toast, togExtEnabled, togSave, toggleSessionRule, totalPages, totalRequests, updateChepyArg, updateCollItemExtracts, updateExtCfg, whkApiKey, whkLoading, whkReqs, wsConns, wsConnsW, wsFrames, wsFramesW, wsResendMsg, wsResendResp, wsSending };

  return (
    React.createElement('div', { className: "app", style: themeVars,}
      , React.createElement('style', { dangerouslySetInnerHTML: { __html: `
:root{--bg:#0d1117;--bg2:#010409;--bg3:#161b22;--bgh:#21262d;--brd:#30363d;--txt:#e6edf3;--txt2:#c9d1d9;--txt3:#8b949e;--blue:#58a6ff;--green:#3fb950;--red:#f85149;--orange:#d29922;--purple:#bc8cff;--cyan:#56d4dd;--font-main:"Inter",sans-serif;--font-mono:"JetBrains Mono",monospace}
*{margin:0;padding:0;box-sizing:border-box}body{font-family:var(--font-main);background:var(--bg);color:var(--txt);overflow:hidden}
.app{display:flex;flex-direction:column;height:100vh}
.hdr{display:flex;align-items:center;justify-content:space-between;padding:10px 20px;background:var(--bg2);border-bottom:1px solid var(--brd)}
.logo{display:flex;align-items:center;gap:10px}.logo-i{width:32px;height:32px;border-radius:6px;object-fit:contain;display:block}
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
.req-item.sel{align-items:start}.req-item.sel .url{white-space:normal;word-break:break-all;overflow:visible}
.st2{color:var(--green)}.st3{color:var(--blue)}.st4{color:var(--orange)}.st5{color:var(--red)}.ts{color:var(--txt3);font-size:10px}
.det-tabs{display:flex;background:var(--bg2);border-bottom:1px solid var(--brd);padding:0 10px}
.det-tab{padding:8px 14px;font-size:11px;color:var(--txt2);cursor:pointer;border-bottom:2px solid transparent}
.det-tab.act{color:var(--cyan);border-bottom-color:var(--cyan)}
.det-meta{display:flex;gap:14px;padding:6px 14px;background:var(--bg2);border-bottom:1px solid var(--brd);font-size:10px;color:var(--txt3);font-family:var(--font-mono)}
.hist-wrap{display:flex;flex-direction:column;width:100%;height:100%}
.hist-content{display:flex;flex:1;overflow:hidden}
.hist-sub-tabs{display:flex;width:100%;background:var(--bg2);border-bottom:1px solid var(--brd);padding:0 16px;flex-shrink:0}
.hist-sub-tab{padding:7px 16px;font-size:11px;font-weight:600;color:var(--txt3);cursor:pointer;border-bottom:2px solid transparent;text-transform:uppercase;letter-spacing:.5px}
.hist-sub-tab:hover{color:var(--txt);background:var(--bg3)}.hist-sub-tab.act{color:var(--cyan);border-bottom-color:var(--cyan)}
.code{flex:1;padding:14px;font-family:var(--font-mono);font-size:11px;line-height:1.5;background:var(--bg);overflow:auto;white-space:pre-wrap;word-break:break-all}
.json-key{color:var(--cyan)}.json-string{color:var(--green)}.json-number{color:var(--orange)}.json-bool{color:var(--purple)}.json-null{color:var(--txt3)}
.flt-bar{display:flex;align-items:center;gap:6px;padding:6px 14px;background:var(--bg3);border-bottom:1px solid var(--brd);position:relative}
.flt-in-wrap{flex:1;position:relative}
.flt-in{width:100%;padding:5px 8px;background:var(--bg2);border:1px solid var(--brd);border-radius:4px;color:var(--txt);font-size:11px;font-family:var(--font-mono);outline:none}
.flt-in:focus{border-color:var(--blue)}.flt-in.flt-err{border-color:var(--red);background:rgba(248,81,73,.08)}
.flt-err-msg{position:absolute;top:100%;left:0;margin-top:4px;padding:4px 8px;background:var(--bg2);border:1px solid var(--red);border-radius:4px;font-size:10px;color:var(--red);white-space:nowrap;z-index:100}
.flt-tog{padding:3px 8px;background:var(--bg2);border:1px solid var(--brd);border-radius:4px;font-size:10px;cursor:pointer;user-select:none}.flt-tog.act{background:var(--blue);border-color:var(--blue)}
.flt-preset-wrap{position:static}
.flt-preset-dd{position:absolute;top:100%;left:8px;right:8px;margin-top:4px;background:var(--bg2);border:1px solid var(--brd);border-radius:6px;z-index:200;box-shadow:0 8px 24px rgba(0,0,0,.4);max-height:320px;overflow-y:auto}
.flt-builder-wrap{position:static}
.flt-builder-dd{position:absolute;top:100%;left:8px;right:8px;margin-top:4px;background:var(--bg2);border:1px solid var(--brd);border-radius:6px;z-index:200;box-shadow:0 8px 24px rgba(0,0,0,.4);max-height:70vh;overflow-y:auto;padding:10px}
.flt-builder-hd{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;font-size:11px;font-weight:600;color:var(--txt2)}
.flt-builder-hd .sel{font-size:11px;padding:3px 6px}
.flt-builder-row{display:flex;align-items:center;gap:6px;margin-bottom:6px}
.flt-builder-row .sel{font-size:11px;padding:4px 6px;flex:1;min-width:0}
.flt-builder-row .inp{font-size:11px;padding:4px 6px;flex:1;min-width:0}
.flt-builder-del{padding:2px 8px!important;flex-shrink:0}
.flt-builder-add{margin:2px 0 10px}
.flt-builder-preview{background:var(--bg);border:1px solid var(--brd);border-radius:4px;padding:8px;margin-bottom:10px}
.flt-builder-preview-lbl{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:var(--txt3);margin-bottom:4px}
.flt-builder-preview code{font-family:var(--font-mono);font-size:11px;color:var(--cyan);word-break:break-all}
.flt-builder-acts{display:flex;justify-content:flex-end;gap:8px}
.flt-preset-save{display:flex;gap:4px;padding:8px;border-bottom:1px solid var(--brd)}.flt-preset-save .flt-in{flex:1}
.flt-preset-empty{padding:12px;text-align:center;color:var(--txt3);font-size:11px}
.flt-preset-group-label{padding:6px 8px 2px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--txt3)}
.flt-preset-item{display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid var(--brd);cursor:pointer}.flt-preset-item:hover{background:var(--bg3)}
.flt-preset-name-label{font-weight:600;font-size:11px;color:var(--cyan);white-space:nowrap}
.flt-preset-q{flex:1;font-size:10px;color:var(--txt3);font-family:var(--font-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.flt-preset-del{padding:1px 5px!important;font-size:10px!important;min-width:auto}
.pagination-bar{display:flex;align-items:center;gap:8px;padding:6px 14px;background:var(--bg2);border-bottom:1px solid var(--brd)}
.pagination-info{font-size:11px;color:var(--txt2);white-space:nowrap}
.pagination-size{background:var(--bg3);color:var(--txt);border:1px solid var(--brd);border-radius:4px;padding:3px 6px;font-size:11px;outline:none;cursor:pointer;margin-left:auto}
.pagination-size:focus{border-color:var(--blue)}.pagination-size option{background:var(--bg2);color:var(--txt)}
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--txt3);font-size:13px;gap:6px;text-align:center;padding:20px}.empty-i{font-size:40px;opacity:.3}
.empty span{color:var(--txt2);font-weight:500}
.empty .empty-hint{max-width:340px;font-size:11px;font-weight:400;color:var(--txt3);line-height:1.5}
.empty .empty-hint b{color:var(--txt2)}.empty .empty-hint code{font-family:var(--font-mono);font-size:10px;background:var(--bg3);padding:1px 4px;border-radius:3px;color:var(--cyan)}
.acts{display:flex;gap:6px}
.prj-pnl{padding:24px;max-width:800px;margin:0 auto;width:100%;height:100%;overflow-y:auto}.prj-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}.prj-hdr h2{font-size:18px}
.new-prj{background:var(--bg2);padding:16px;border-radius:8px;margin-bottom:16px;display:flex;flex-direction:column;gap:10px}
.inp{padding:8px 12px;background:var(--bg3);border:1px solid var(--brd);border-radius:5px;color:var(--txt);font-size:12px;outline:none}.inp:focus{border-color:var(--blue)}
.form-acts{display:flex;gap:10px}.prj-list{display:flex;flex-direction:column;gap:10px}
.prj-card{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:var(--bg2);border:1px solid var(--brd);border-radius:8px;cursor:pointer}
.prj-card:hover{background:var(--bg3);border-color:var(--blue)}.prj-card.cur{border-color:var(--cyan)}
.prj-name{font-weight:600;font-size:14px;margin-bottom:3px}.cur-badge{background:var(--cyan);color:#000;padding:1px 6px;border-radius:3px;font-size:9px;margin-left:6px}
.prj-desc{color:var(--txt2);font-size:12px}.prj-date{color:var(--txt3);font-size:10px;margin-top:3px}
.prj-menu-wrap{position:relative;display:inline-block}
.prj-menu{position:absolute;right:0;top:100%;margin-top:4px;background:var(--bg2);border:1px solid var(--brd);border-radius:4px;box-shadow:0 4px 12px rgba(0,0,0,.3);z-index:1000;min-width:240px}
.prj-menu-item{padding:8px 12px;cursor:pointer;font-size:11px;color:var(--txt);border-bottom:1px solid var(--brd)}
.prj-menu-item:last-child{border-bottom:none}.prj-menu-item:hover{background:var(--bg3)}
.prj-menu-sub{font-size:10px;color:var(--txt3);margin-top:2px}
.wiki-wrap{display:flex;width:100%;height:100%;overflow:hidden}
.wiki-nav{width:220px;flex-shrink:0;background:var(--bg2);border-right:1px solid var(--brd);overflow-y:auto;padding:8px}
.wiki-nav-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--txt3);padding:6px 10px}
.wiki-nav-item{padding:8px 10px;font-size:12px;color:var(--txt2);cursor:pointer;border-radius:5px;margin-bottom:2px}
.wiki-nav-item:hover{background:var(--bg3);color:var(--txt)}
.wiki-nav-item.act{background:var(--bg3);color:var(--cyan);font-weight:600}
.wiki-body{flex:1;overflow-y:auto}
.wiki-doc{max-width:820px;margin:0 auto;padding:28px 32px;color:var(--txt);font-size:13px;line-height:1.65}
.wiki-doc h1{font-size:22px;margin:0 0 16px;padding-bottom:8px;border-bottom:1px solid var(--brd)}
.wiki-doc h2{font-size:17px;margin:26px 0 10px;color:var(--cyan)}
.wiki-doc h3{font-size:14px;margin:18px 0 8px;color:var(--txt)}
.wiki-doc p{margin:0 0 12px}
.wiki-doc ul,.wiki-doc ol{margin:0 0 12px;padding-left:22px}
.wiki-doc li{margin:3px 0}
.wiki-doc a{color:var(--blue);text-decoration:none}.wiki-doc a:hover{text-decoration:underline}
.wiki-doc code{font-family:var(--font-mono);font-size:11.5px;background:var(--bg3);padding:1px 5px;border-radius:3px;color:var(--orange)}
.wiki-doc pre{background:var(--bg2);border:1px solid var(--brd);border-radius:6px;padding:12px 14px;overflow-x:auto;margin:0 0 14px}
.wiki-doc pre code{background:none;padding:0;color:var(--txt);font-size:11.5px;line-height:1.5}
.wiki-doc blockquote{border-left:3px solid var(--cyan);background:var(--bg2);padding:8px 14px;margin:0 0 14px;color:var(--txt2);border-radius:0 4px 4px 0}
.wiki-doc hr{border:none;border-top:1px solid var(--brd);margin:20px 0}
.wiki-doc .wiki-tbl{border-collapse:collapse;width:100%;margin:0 0 14px;font-size:12px}
.wiki-doc .wiki-tbl th,.wiki-doc .wiki-tbl td{border:1px solid var(--brd);padding:6px 10px;text-align:left}
.wiki-doc .wiki-tbl th{background:var(--bg3);font-weight:600}
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
.chepy-add{display:flex;flex-direction:column;border-bottom:1px solid var(--brd);max-height:48%}.chepy-ops-list{flex:1;overflow:auto;padding:0 8px 8px}
.chepy-op-search{display:flex;align-items:center;gap:6px;padding:8px}.chepy-op-search .sel{flex-shrink:0;max-width:45%}.chepy-op-filter{flex:1;font-size:11px;padding:5px 8px}
.chepy-ops-empty{padding:12px;text-align:center;color:var(--txt3);font-size:11px}
.chepy-avail-op{display:flex;align-items:center;gap:8px;padding:5px 10px;font-size:11px;cursor:pointer;border-radius:4px;color:var(--txt2);font-family:var(--font-mono)}.chepy-avail-op:hover{background:var(--bg3);color:var(--cyan)}
.chepy-avail-plus{width:16px;height:16px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border-radius:3px;background:var(--bg3);color:var(--txt3);font-weight:700;font-size:12px}.chepy-avail-op:hover .chepy-avail-plus{background:var(--cyan);color:var(--bg)}
.chepy-avail-label{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.chepy-avail-cat{font-size:9px;color:var(--txt3);background:var(--bg3);padding:1px 5px;border-radius:3px;flex-shrink:0}
.chepy-steps{flex:1;overflow:auto;padding:8px}
.chepy-step{background:var(--bg2);border:1px solid var(--brd);border-radius:6px;margin-bottom:6px}
.chepy-step-hdr{display:flex;align-items:center;gap:8px;padding:8px 10px}
.chepy-step-num{width:20px;height:20px;border-radius:50%;background:var(--purple);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;flex-shrink:0}
.chepy-step-name{flex:1;font-size:12px;font-weight:500}.chepy-step-acts{display:flex;gap:3px}
.chepy-step-params{padding:6px 10px 10px;border-top:1px solid var(--brd);display:flex;flex-direction:column;gap:6px}
.chepy-param{display:flex;align-items:center;gap:8px}.chepy-param-lbl{font-size:10px;color:var(--txt2);min-width:60px}
.chepy-param-field{flex:1;font-size:11px;padding:5px 8px}
.jwt-analyzer{display:flex;flex-direction:column;flex:1;padding:20px;gap:16px;overflow:auto}
.jwt-field{display:flex;flex-direction:column;gap:8px}
.jwt-label{font-size:12px;font-weight:600;color:var(--txt)}
.jwt-label-h{color:var(--red)}.jwt-label-p{color:var(--purple)}.jwt-label-s{color:var(--cyan)}
.jwt-token-ta{min-height:80px;font-family:var(--font-mono);font-size:11px}
.jwt-json-ta{min-height:120px;font-family:var(--font-mono);font-size:11px}
.jwt-sig-in{font-family:var(--font-mono);font-size:11px}
.jwt-token-view{font-family:var(--font-mono);font-size:11px;word-break:break-all;background:var(--bg2);border:1px solid var(--brd);border-radius:4px;padding:8px 10px;line-height:1.5}
.jwt-seg-h{color:var(--red)}.jwt-seg-p{color:var(--purple)}.jwt-seg-s{color:var(--cyan)}.jwt-dot{color:var(--txt3)}
.jwt-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.jwt-claims{display:flex;flex-wrap:wrap;gap:8px;background:var(--bg2);border:1px solid var(--brd);border-radius:6px;padding:10px 12px}
.jwt-claim{display:flex;flex-direction:column;gap:2px;min-width:120px}
.jwt-claim-k{font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:var(--txt3)}
.jwt-claim-v{font-size:12px;font-family:var(--font-mono);color:var(--txt)}.jwt-claim-v.warn{color:var(--red);font-weight:600}
.jwt-attacks{padding:16px;background:var(--bg2);border:1px solid var(--brd);border-radius:6px;display:flex;flex-direction:column;gap:12px}
.jwt-attacks-title{font-size:13px;font-weight:600;color:var(--cyan)}
.jwt-attack-title{font-size:11px;font-weight:600;color:var(--txt);margin-bottom:3px}
.jwt-attack-body{font-size:11px;color:var(--txt2);line-height:1.55}
.jwt-attack-code{display:block;margin-top:5px;padding:6px 8px;background:var(--bg3);border-radius:3px;font-size:10px;font-family:var(--font-mono);color:var(--orange)}
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
.resize-v{height:6px;cursor:row-resize;background:transparent;flex-shrink:0;position:relative;z-index:5;transition:background .15s}
.resize-v:hover,.resize-v.dragging{background:var(--blue)}
.resize-v::after{content:'';position:absolute;left:0;right:0;top:2px;height:2px;background:var(--brd);transition:background .15s}
.resize-v:hover::after,.resize-v.dragging::after{background:var(--blue)}
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
          , React.createElement('img', { className: "logo-i", src: "/logo.svg", alt: "Blackwire",} )
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
            )
          )
          , React.createElement('button', { className: "btn btn-sm btn-s"  , title: "Shutdown server" , onClick: () => { if (confirm('Shut down Blackwire server?')) api.post('/api/shutdown'); }, style: { marginLeft: '4px', color: 'var(--red)', fontSize: '14px', padding: '4px 8px' },}, "⏻")
        )
      )

      , React.createElement('nav', { className: "tabs",}
        , React.createElement('div', { className: 'tab' + (tab === 'projects' ? ' act' : ''), onClick: () => setTab('projects'),}, "Projects")
        , React.createElement('div', { className: 'tab' + (tab === 'wiki' ? ' act' : ''), onClick: () => setTab('wiki'),}, "Wiki")
        , curPrj && (
          React.createElement(React.Fragment, null
            , React.createElement('div', { className: 'tab' + (tab === 'scope' ? ' act' : ''), onClick: () => setTab('scope'),}, "Scope")
            , React.createElement('div', { className: 'tab' + (tab === 'history' ? ' act' : ''), onClick: () => setTab('history'),}, "History")
            , React.createElement('div', { className: 'tab' + (tab === 'intercept' ? ' act' : ''), onClick: () => setTab('intercept'),}, "Interceptor")
            , React.createElement('div', { className: 'tab' + (tab === 'collections' ? ' act' : ''), onClick: () => { setTab('collections'); loadColls(); },}, "Collections")
            , React.createElement('div', { className: 'tab' + (tab === 'repeater' ? ' act' : ''), onClick: () => setTab('repeater'),}, "Repeater")
            , React.createElement('div', { className: 'tab' + (tab === 'intruder' ? ' act' : ''), onClick: () => setTab('intruder'),}, "Intruder")
            , React.createElement('div', { className: 'tab' + (tab === 'chepy' ? ' act' : ''), onClick: () => setTab('chepy'),}, "Cipher")
            , React.createElement('div', { className: 'tab' + (tab === 'compare' ? ' act' : ''), onClick: () => setTab('compare'),}, "Compare")
            , React.createElement('div', { className: 'tab' + (tab === 'sensitive' ? ' act' : ''), onClick: () => setTab('sensitive'),}, "Sensitive")
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
        , React.createElement(ErrorBoundary, { key: tab,}
        , tab === 'projects' && React.createElement(ProjectsPanel, __appCtx)

        , tab === 'history' && curPrj && React.createElement(HistoryPanel, __appCtx)

        , tab === 'intercept' && curPrj && React.createElement(InterceptPanel, __appCtx)

        , tab === 'scope' && curPrj && (
          React.createElement('div', { className: "hist-wrap",}
            , React.createElement('div', { className: "hist-sub-tabs",}
              , React.createElement('div', { className: 'hist-sub-tab' + (scopeSubTab === 'scope' ? ' act' : ''), onClick: () => setScopeSubTab('scope'),}, "Scope")
              , React.createElement('div', { className: 'hist-sub-tab' + (scopeSubTab === 'bypass' ? ' act' : ''), onClick: () => { setScopeSubTab('bypass'); bypass.loadRules(); bypass.loadPresets(); bypass.loadStatus(); },}, "Proxy Bypass" )
            )
            , React.createElement('div', { style: { flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' },}
              , scopeSubTab === 'scope'
                ? React.createElement(ScopePanel, __appCtx)
                : React.createElement(BypassManager, { toast: hookToast, bypass: bypass })
            )
          )
        )

        , tab === 'repeater' && curPrj && React.createElement(RepeaterPanel, __appCtx)

        , tab === 'wiki' && React.createElement(WikiPanel, __appCtx)

        , tab === 'extensions' && curPrj && React.createElement(ExtensionsPanel, __appCtx)


        , tab === 'collections' && curPrj && React.createElement(CollectionsPanel, __appCtx)

        , tab === 'chepy' && curPrj && React.createElement(ChepyPanel, __appCtx)

        , tab === 'sensitive' && curPrj && React.createElement(SensitivePanel, __appCtx)

        , tab === 'intruder' && curPrj && React.createElement(IntruderPanel, __appCtx)

        , tab === 'compare' && curPrj && React.createElement(ComparePanel, __appCtx)

        /* Pestañas de extensiones dinámicas */
        , curPrj && React.createElement(ExtensionTabsPanel, __appCtx)
        )
      )

      , React.createElement('div', { className: "toast-c",}
        , toasts.map(t => (
          React.createElement('div', { key: t.id, className: 'toast ' + t.type,}, t.message)
        ))
      )

      , contextMenu && (
        React.createElement('div', { ref: ctxMenuRef, className: "context-menu", style: { left: contextMenu.x, top: contextMenu.y }, onClick: e => e.stopPropagation(),}
          , (() => {
            const hasBody = _optionalChain([contextMenu, 'access', _56 => _56.normalized, 'optionalAccess', _57 => _57.body]) || _optionalChain([contextMenu, 'access', _58 => _58.request, 'optionalAccess', _59 => _59.response_body]) || contextMenu.source === 'selection';
            const hasUrl = _optionalChain([contextMenu, 'access', _60 => _60.normalized, 'optionalAccess', _61 => _61.url]);
            const isSelection = contextMenu.source === 'selection';
            const currentTab = contextMenu.currentTab;
            const hasRequest = _optionalChain([contextMenu, 'access', _62 => _62.normalized, 'optionalAccess', _63 => _63.method]) && _optionalChain([contextMenu, 'access', _64 => _64.normalized, 'optionalAccess', _65 => _65.url]);

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

        , tab === 'console' && curPrj && React.createElement(ConsolePanel, __appCtx)

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
