import api from './src/utils/api.js';
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

// Componentes y helpers extraídos (servidos transpilados desde /src/).
import { ResizeHandle } from './src/components/ResizeHandle.jsx';
import { BypassManager } from './src/components/BypassManager.jsx';
import { buildSiteTree, collectNodeReqs } from './src/utils/sitemap.js';
import { highlightMatches } from './src/utils/highlight.js';

const { useState, useEffect, useRef } = React;

const API = '';
const WS_URL = 'ws://' + location.host + '/ws';

const THEMES = window.BW_THEMES || {};

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
    return () => wsRef.current?.close();
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
  }, [selReq?.id]);

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
    setWhkApiKey(webhookExt?.config?.api_key || '');
  }, [webhookExt?.config?.api_key]);

  // Cargar webhook requests desde DB cuando el token esté disponible (persiste entre reinicios)
  useEffect(() => {
    if (!webhookExt?.enabled || !webhookExt?.config?.token_id) return;
    webhook.loadRequests(webhookExt.config.token_id);
  }, [webhookExt?.enabled, webhookExt?.config?.token_id]);

  // Auto-refresh desde webhook.site cuando estemos en las pestañas relevantes
  // NOTA: Deshabilitado para la pestaña 'webhook_site' ya que la UI personalizada maneja su propio refresh
  useEffect(() => {
    // Solo auto-refresh en 'extensions' tab, no en la tab personalizada
    if (tab !== 'extensions') return;
    if (!webhookExt?.enabled || !webhookExt?.config?.token_id) return;
    const id = setInterval(() => webhook.refresh(webhookExt.config.token_id, true), 15000); // silent refresh
    return () => clearInterval(id);
  }, [tab, webhookExt?.enabled, webhookExt?.config?.token_id]);

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
      intercept.setEnabled(r.config?.intercept_enabled || false);
      scope.setRules(r.config?.scope_rules || []);
      proxy.setPort(r.config?.proxy_port || 8080);
      proxy.setMode(r.config?.proxy_mode || 'regular');
      proxy.setArgs(r.config?.proxy_args || '');
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
  const loadWebhookLocal = () => webhook.loadRequests(webhookExt?.config?.token_id);
  const refreshWebhook = (silent = false) => webhook.refresh(webhookExt?.config?.token_id);

  const createWebhookToken = async () => {
    const success = await webhook.createToken();
    if (success) {
      await extensions.loadExtensions();
      await webhook.loadRequests(webhookExt?.config?.token_id);
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
      toast(r?.detail || 'Failed to create project', 'error');
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
      if (curPrj?.project === n) await projects.loadCurrent();
      await projects.load();
      toast('Deleted', 'success');
    } else {
      toast(r?.detail || 'Failed to delete project', 'error');
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
          if (curPrj?.project === n) {
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
          toast(`Project "${data.project_name}" created successfully! ${r.stats?.total_requests || 0} requests imported.`, 'success');
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
        if (!confirm(`${clearExisting ? 'Replace all data' : 'Merge data'} in project "${n}"?\n\nThis will ${clearExisting ? 'DELETE existing data and' : ''} import:\n- ${data.stats?.total_requests || 0} requests\n- ${data.stats?.total_repeater || 0} repeater items\n- ${data.stats?.total_collections || 0} collections`)) {
          return;
        }

        const r = await projectService.importTo(n, file, clearExisting);
        if (r && r.status === 'imported') {
          toast(`${action === 'replace' ? 'Replaced' : 'Merged'} successfully!`, 'success');
          // Recargar datos si es el proyecto actual
          if (curPrj?.project === n) {
            await loadReqs();
            await loadRep();
            await loadColls();
          }
        } else {
          toast(r?.detail || 'Import failed', 'error');
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
    if (selPend?.id !== id) return;
    const next = remaining[0] ?? null;
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
    if (selReq?.id === id) setSelReq(prev => ({ ...prev, saved: !prev.saved }));
    // Reload requests to refresh the state
    loadReqs();
  };

  const delReq = async id => {
    await requestService.delete(id);
    await loadReqs();
    if (selReq?.id === id) setSelReq(null);
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
    const rules = ext.config?.rules || [];

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
      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--brd)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--txt2)' }}>
            Rules ({rules.length})
          </div>
          <button className="btn btn-sm btn-p" onClick={addRule}>+ Add Rule</button>
        </div>

        {rules.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--txt3)', fontSize: '11px', background: 'var(--bg3)', borderRadius: '6px' }}>
            No rules yet. Click "+ Add Rule" to create one.
          </div>
        )}

        {rules.map((rule, idx) => (
          <div key={idx} style={rule.enabled ? s.card : s.cardOff}>
            {/* Row 1: Enable + When + Target + Actions */}
            <div style={s.row}>
              <input type="checkbox" checked={rule.enabled} onChange={e => updateRule(idx, 'enabled', e.target.checked)}
                title={rule.enabled ? 'Disable rule' : 'Enable rule'} />
              <span style={s.badge(whenColors[rule.when] || 'var(--txt3)')}>#{idx + 1}</span>
              <div style={{ flex: 0 }}>
                <select style={s.sel} value={rule.when} onChange={e => updateRule(idx, 'when', e.target.value)}>
                  <option value="request">Request</option>
                  <option value="response">Response</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div style={{ flex: 0 }}>
                <select style={s.sel} value={rule.target} onChange={e => updateRule(idx, 'target', e.target.value)}>
                  <option value="url">URL</option>
                  <option value="headers">Header</option>
                  <option value="body">Body</option>
                </select>
              </div>
              {rule.target === 'headers' && (
                <input style={{ ...s.inp, maxWidth: '120px' }} value={rule.header || ''} placeholder="Header name"
                  onChange={e => updateRule(idx, 'header', e.target.value)} title="Leave empty to match all headers" />
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                <button className="btn btn-sm btn-s" onClick={() => duplicateRule(idx)} title="Duplicate">⧉</button>
                <button className="btn btn-sm btn-d" onClick={() => removeRule(idx)} title="Delete">✕</button>
              </div>
            </div>

            {/* Row 2: Pattern → Replace */}
            <div style={s.lastRow}>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Match</label>
                <input style={s.inp} value={rule.pattern} placeholder={rule.regex ? '(regex)' : 'text to find'}
                  onChange={e => updateRule(idx, 'pattern', e.target.value)} />
              </div>
              <span style={{ color: 'var(--txt3)', fontSize: '14px', marginTop: '14px' }}>→</span>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Replace</label>
                <input style={s.inp} value={rule.replace} placeholder="replacement"
                  onChange={e => updateRule(idx, 'replace', e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '14px' }}>
                <button className={'btn btn-sm ' + (rule.regex ? 'btn-p' : 'btn-s')} onClick={() => updateRule(idx, 'regex', !rule.regex)}
                  title="Regular expression" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>.*</button>
                <button className={'btn btn-sm ' + (rule.ignore_case ? 'btn-p' : 'btn-s')} onClick={() => updateRule(idx, 'ignore_case', !rule.ignore_case)}
                  title="Ignore case" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>Aa</button>
              </div>
            </div>
          </div>
        ))}
      </div>
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
        <div style={{ padding: '20px', color: 'var(--txt3)', fontSize: '11px' }}>
          No UI schema defined for this extension.
        </div>
      );
    }

    const handleFieldChange = (fieldName, value) => {
      updateExtCfg(ext.name, { ...config, [fieldName]: value });
    };

    return (
      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--brd)' }}>
        {schema.fields.map(field => (
          <div key={field.name} style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--txt2)', marginBottom: '6px' }}>
              {field.label}
              {field.required && <span style={{ color: 'var(--red)' }}> *</span>}
            </label>

            {(field.type === 'text' || field.type === 'password') && (
              <input
                className="inp"
                type={field.type}
                placeholder={field.placeholder || ''}
                value={config[field.name] !== undefined ? config[field.name] : (field.default || '')}
                onChange={e => handleFieldChange(field.name, e.target.value)}
              />
            )}

            {field.type === 'textarea' && (
              <textarea
                className="inp"
                placeholder={field.placeholder || ''}
                value={config[field.name] !== undefined ? config[field.name] : (field.default || '')}
                onChange={e => handleFieldChange(field.name, e.target.value)}
                rows={field.rows || 4}
              />
            )}

            {field.type === 'number' && (
              <input
                className="inp"
                type="number"
                placeholder={field.placeholder || ''}
                value={config[field.name] !== undefined ? config[field.name] : (field.default || 0)}
                onChange={e => handleFieldChange(field.name, parseInt(e.target.value) || 0)}
                min={field.min}
                max={field.max}
              />
            )}

            {field.type === 'checkbox' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={config[field.name] !== undefined ? config[field.name] : (field.default || false)}
                  onChange={e => handleFieldChange(field.name, e.target.checked)}
                />
                {field.help && <span style={{ fontSize: '10px', color: 'var(--txt3)' }}>{field.help}</span>}
              </div>
            )}

            {field.type === 'select' && (
              <select
                className="inp"
                value={config[field.name] !== undefined ? config[field.name] : (field.default || '')}
                onChange={e => handleFieldChange(field.name, e.target.value)}
              >
                {field.options && field.options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}

            {field.help && field.type !== 'checkbox' && (
              <div style={{ fontSize: '10px', color: 'var(--txt3)', marginTop: '4px' }}>
                {field.help}
              </div>
            )}
          </div>
        ))}
      </div>
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
        <div style={{ padding: '20px', color: 'var(--txt3)', fontSize: '11px' }}>
          Loading custom UI...
        </div>
      );
    }

    if (error) {
      return (
        <div style={{ padding: '20px', color: 'var(--red)', fontSize: '11px' }}>
          Error loading custom UI: {error}
        </div>
      );
    }

    if (!component) {
      return (
        <div style={{ padding: '20px', color: 'var(--txt3)', fontSize: '11px' }}>
          No custom UI available
        </div>
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
    const norm = contextMenu?.normalized;
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
        } catch { return null; }
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
          } catch { /* invalid regex, skip */ }
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
    } catch { setSensSelDetail(null); }
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
      <React.Fragment key={fullKey}>
        <div
          className={'sm-node' + (isSelected ? ' sel' : '')}
          style={{ paddingLeft: (depth * 16 + 8) + 'px' }}
          onClick={() => setSmSelNode(node)}
        >
          <span className="sm-toggle" onClick={e => { e.stopPropagation(); if (hasChildren) toggleSmNode(fullKey); }}>
            {hasChildren ? (expanded ? '\u25BC' : '\u25B6') : '\u00B7'}
          </span>
          <span className="sm-label">{node.label}</span>
          <span className="sm-methods">
            {methods.map(m => <span key={m} className={'sm-mth mth-' + m}>{m}</span>)}
          </span>
          <span className="sm-badge">{node.count}</span>
        </div>
        {expanded && Object.entries(node.children)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, child]) => renderTreeNode(k, child, depth + 1, fullKey))}
      </React.Fragment>
    );
  };

  const themeVars = (THEMES[themeId] && THEMES[themeId].vars)
    ? THEMES[themeId].vars
    : (THEMES.midnight && THEMES.midnight.vars) ? THEMES.midnight.vars : {};

  return (
    <div className="app" style={themeVars}>
      <style dangerouslySetInnerHTML={{ __html: `
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
      `}} />

      {!appReady ? (
        <div className="splash">
          <div className="logo-i">BW</div>
          <span className="logo-t">Blackwire</span>
          <div className="splash-spin" />
        </div>
      ) : (
      <React.Fragment>
      <header className="hdr">
        <div className="logo">
          <div className="logo-i">BW</div>
          <span className="logo-t">Blackwire</span>
          {curPrj && <span className="prj-badge">{curPrj.project}</span>}
        </div>
        <div className="hdr-ctrl">
          <select className="sel" value={themeId} onChange={e => setThemeId(e.target.value)} title="Theme">
            {Object.entries(THEMES).map(([id, t]) => (
              <option key={id} value={id}>{t.label}</option>
            ))}
          </select>
          {curPrj && (
            <React.Fragment>
              <div className={'int-tog' + (intOn ? ' on' : '')} onClick={() => intercept.toggle()}>
                <span className="int-dot"></span>
                Intercept {intOn ? 'ON' : 'OFF'}
                {pending.length > 0 && <span className="pend-badge">{pending.length}</span>}
              </div>
              <div className="prx-st" onClick={() => setShowProxyCfg(true)} style={{ cursor: 'pointer' }} title={'Mode: ' + pxMode + (pxArgs ? ' | Args: ' + pxArgs : '')}>
                <div className={'st-dot ' + (pxRun ? 'run' : 'stop')}></div>
                {pxRun ? pxMode + ' :' + pxPort : 'Stopped'}
              </div>
              {!pxRun ? (
                <button className="btn btn-g" onClick={startPx} disabled={loading}>▶ Start</button>
              ) : (
                <button className="btn btn-d" onClick={() => proxy.stop()}>■ Stop</button>
              )}
              <button className="btn btn-s" onClick={() => proxy.launchBrowser()} disabled={!pxRun}>🌐</button>
            </React.Fragment>
          )}
          <button className="btn btn-sm btn-s" title="Shutdown server" onClick={() => { if (confirm('Shut down Blackwire server?')) api.post('/api/shutdown'); }} style={{ marginLeft: '4px', color: 'var(--red)', fontSize: '14px', padding: '4px 8px' }}>⏻</button>
        </div>
      </header>

      <nav className="tabs">
        <div className={'tab' + (tab === 'projects' ? ' act' : '')} onClick={() => setTab('projects')}>Projects</div>
        {curPrj && (
          <React.Fragment>
            <div className={'tab' + (tab === 'scope' ? ' act' : '')} onClick={() => setTab('scope')}>Scope</div>
            <div className={'tab' + (tab === 'history' ? ' act' : '')} onClick={() => setTab('history')}>History</div>
            <div className={'tab' + (tab === 'intercept' ? ' act' : '')} onClick={() => setTab('intercept')}>Interceptor</div>
            <div className={'tab' + (tab === 'collections' ? ' act' : '')} onClick={() => { setTab('collections'); loadColls(); }}>Collections</div>
            <div className={'tab' + (tab === 'repeater' ? ' act' : '')} onClick={() => setTab('repeater')}>Repeater</div>
            <div className={'tab' + (tab === 'intruder' ? ' act' : '')} onClick={() => setTab('intruder')}>Intruder</div>
            <div className={'tab' + (tab === 'git' ? ' act' : '')} onClick={() => setTab('git')}>Git</div>
            <div className={'tab' + (tab === 'chepy' ? ' act' : '')} onClick={() => setTab('chepy')}>Cipher</div>
            <div className={'tab' + (tab === 'compare' ? ' act' : '')} onClick={() => setTab('compare')}>Compare</div>
            <div className={'tab' + (tab === 'sensitive' ? ' act' : '')} onClick={() => setTab('sensitive')}>Sensitive</div>
            <div className={'tab' + (tab === 'bypass' ? ' act' : '')} onClick={() => { setTab('bypass'); bypass.loadRules(); bypass.loadPresets(); bypass.loadStatus(); }}>Bypass</div>
            <div className={'tab' + (tab === 'extensions' ? ' act' : '')} onClick={() => setTab('extensions')}>Extensions</div>
            <div className={'tab' + (tab === 'console' ? ' act' : '')} onClick={() => setTab('console')}>
              Console
              {proxyConsole.connected && <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', marginLeft: '5px', verticalAlign: 'middle' }} />}
            </div>
            {extensions.extensions.filter(ext => ext.enabled && ext.tabs && ext.tabs.length > 0 && ext.name !== 'sensitive').map(ext =>
              ext.tabs.map(extTab => (
                <div key={ext.name + '_' + extTab.id} className={'tab' + (tab === ext.name ? ' act' : '')} onClick={() => setTab(ext.name)}>
                  {extTab.label}
                </div>
              ))
            )}
          </React.Fragment>
        )}
      </nav>

      <main className="main">
        {tab === 'projects' && (
          <div className="prj-pnl">
            <div className="prj-hdr">
              <h2>Projects</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-p" onClick={() => setShowNew(true)}>+ New</button>
                <button className="btn btn-s" onClick={importAsNewProject} title="Create new project from Blackwire export file">↓ Create from File</button>
              </div>
            </div>
            {showNew && (
              <div className="new-prj">
                <input className="inp" placeholder="Project name" value={newName} onChange={e => setNewName(e.target.value)} />
                <input className="inp" placeholder="Description" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                <div className="form-acts">
                  <button className="btn btn-p" onClick={createPrj}>Create</button>
                  <button className="btn btn-s" onClick={() => setShowNew(false)}>Cancel</button>
                </div>
              </div>
            )}
            <div className="prj-list">
              {prjs.map(p => (
                <div key={p.name} className={'prj-card' + (p.is_current ? ' cur' : '')} onClick={() => selectPrj(p.name)}>
                  <div>
                    <div className="prj-name">
                      {p.name}
                      {p.is_current && <span className="cur-badge">ACTIVE</span>}
                    </div>
                    <div className="prj-desc">{p.description || 'No description'}</div>
                    <div className="prj-date">{p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}</div>
                  </div>
                  <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <button
                        className="btn btn-sm btn-s"
                        onClick={(e) => {
                          e.stopPropagation();
                          const menu = e.currentTarget.nextElementSibling;
                          menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                        }}
                        title="Export project data to file"
                      >
                        ↑ ▼
                      </button>
                      <div
                        style={{
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
                        }}
                        onClick={(e) => { e.stopPropagation(); e.currentTarget.style.display = 'none'; }}
                      >
                        <div
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            borderBottom: '1px solid var(--brd)',
                            color: 'var(--txt)'
                          }}
                          onClick={(e) => { e.stopPropagation(); exportProject(p.name); }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg3)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          title="Export complete project (requests, repeater, collections, rules, scope)"
                        >
                          <div style={{ fontWeight: 600 }}>↑ Complete Project (JSON)</div>
                          <div style={{ fontSize: '10px', color: 'var(--txt3)', marginTop: '2px' }}>All data: requests, repeater, collections, scope</div>
                        </div>
                        <div
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            color: 'var(--txt)'
                          }}
                          onClick={(e) => { e.stopPropagation(); exportProjectBurp(p.name); }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg3)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          title="Export only HTTP history for Burp Suite Pro"
                        >
                          <div style={{ fontWeight: 600 }}>↑ Burp Suite Format (XML)</div>
                          <div style={{ fontSize: '10px', color: 'var(--txt3)', marginTop: '2px' }}>Only HTTP history, compatible with Burp</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <button
                        className="btn btn-sm btn-s"
                        onClick={(e) => {
                          e.stopPropagation();
                          const menu = e.currentTarget.nextElementSibling;
                          menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                        }}
                        title="Import data into this project"
                      >
                        ↓ ▼
                      </button>
                      <div
                        style={{
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
                        }}
                        onClick={(e) => { e.stopPropagation(); e.currentTarget.style.display = 'none'; }}
                      >
                        <div
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            borderBottom: '1px solid var(--brd)',
                            color: 'var(--txt)'
                          }}
                          onClick={(e) => { e.stopPropagation(); importProject(p.name, false); }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg3)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          title="Add data from file to existing project data"
                        >
                          <div style={{ fontWeight: 600 }}>↓ Merge (Keep Existing)</div>
                          <div style={{ fontSize: '10px', color: 'var(--txt3)', marginTop: '2px' }}>Combine file data with current data</div>
                        </div>
                        <div
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            borderBottom: '1px solid var(--brd)',
                            color: 'var(--red)'
                          }}
                          onClick={(e) => { e.stopPropagation(); importProject(p.name, true); }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg3)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          title="Delete all current data and replace with file data"
                        >
                          <div style={{ fontWeight: 600 }}>🔄 Replace (Delete All)</div>
                          <div style={{ fontSize: '10px', color: 'var(--txt3)', marginTop: '2px' }}>Clear project and import file data</div>
                        </div>
                        <div
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            color: 'var(--txt)'
                          }}
                          onClick={(e) => { e.stopPropagation(); importBurpXML(p.name); }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg3)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          title="Import HTTP history from Burp Suite XML export"
                        >
                          <div style={{ fontWeight: 600 }}>↓ From Burp Suite (XML)</div>
                          <div style={{ fontSize: '10px', color: 'var(--txt3)', marginTop: '2px' }}>Import HTTP history from Burp export</div>
                        </div>
                      </div>
                    </div>
                    <button className="btn btn-sm btn-d" onClick={() => delPrj(p.name)}>×</button>
                  </div>
                </div>
              ))}
              {prjs.length === 0 && (
                <div className="empty">
                  <div className="empty-i"></div>
                  <span>No projects</span>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'history' && curPrj && (
          <div className="hist-wrap">
            <div className="hist-sub-tabs">
              <div className={'hist-sub-tab' + (histSubTab === 'http' ? ' act' : '')} onClick={() => setHistSubTab('http')}>HTTP</div>
              <div className={'hist-sub-tab' + (histSubTab === 'ws' ? ' act' : '')} onClick={() => { setHistSubTab('ws'); loadWsConns(); }}>WebSocket</div>
              <div className={'hist-sub-tab' + (histSubTab === 'sitemap' ? ' act' : '')} onClick={() => setHistSubTab('sitemap')}>Site Map</div>
            </div>

            {histSubTab === 'http' && (
              <div className="hist-content" ref={histContentRef}>
                <div className="panel hist-pnl" style={{ width: histPanelW + '%' }}>
                  <div className="flt-bar">
                    <div className="flt-in-wrap">
                      <input className={'flt-in' + (httpqlError ? ' flt-err' : '')} placeholder='Filter: req.method.eq:"GET" AND resp.code.lt:400' value={search} onChange={e => setSearch(e.target.value)} />
                      {httpqlError && <div className="flt-err-msg">{httpqlError}</div>}
                    </div>
                    <div className="flt-preset-wrap" style={{position:'relative'}}>
                      <div className="flt-tog" onClick={() => setShowPresets(!showPresets)} title="Filter presets">▼</div>
                      {showPresets && (
                        <div className="flt-preset-dd">
                          <div className="flt-preset-save">
                            <input className="flt-in flt-preset-name" placeholder="Preset name..." value={presetName} onChange={e => setPresetName(e.target.value)} onKeyDown={e => e.key === 'Enter' && savePreset()} />
                            <button className="btn btn-sm btn-p" onClick={savePreset} disabled={!presetName.trim() || !search.trim()}>Save</button>
                          </div>
                          {presets.length === 0 && <div className="flt-preset-empty">No presets saved</div>}
                          {presets.map(p => (
                            <div key={p.id} className="flt-preset-item">
                              <span className="flt-preset-name-label" onClick={() => applyPreset(p)} title={p.query}>{p.name}</span>
                              <span className="flt-preset-q">{p.query}</span>
                              <button className="btn btn-sm btn-d flt-preset-del" onClick={() => delPreset(p.id)}>×</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className={'flt-tog' + (scopeOnly ? ' act' : '')} onClick={() => setScopeOnly(!scopeOnly)}>Scope</div>
                    <div className={'flt-tog' + (savedOnly ? ' act' : '')} onClick={() => setSavedOnly(!savedOnly)}>★</div>
                  </div>
                  <div className="pnl-hdr">
                    <span>{totalRequests > 0 ? `${((currentPage - 1) * pageSize) + 1}-${Math.min(currentPage * pageSize, totalRequests)} of ${totalRequests}` : '0 requests'}</span>
                    <div className="acts">
                      <button className="btn btn-sm btn-s" onClick={loadReqs}>↻</button>
                      <button className="btn btn-sm btn-d" onClick={clearHist}>Clear</button>
                    </div>
                  </div>
                  {totalPages > 1 && (
                    <div className="pagination-bar">
                      <button className="btn btn-sm btn-s" onClick={firstPage} disabled={currentPage === 1} title="First page">«</button>
                      <button className="btn btn-sm btn-s" onClick={prevPage} disabled={currentPage === 1} title="Previous page">‹</button>
                      <span className="pagination-info">Page {currentPage} of {totalPages}</span>
                      <button className="btn btn-sm btn-s" onClick={nextPage} disabled={currentPage === totalPages} title="Next page">›</button>
                      <button className="btn btn-sm btn-s" onClick={lastPage} disabled={currentPage === totalPages} title="Last page">»</button>
                      <select className="pagination-size" value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
                        <option value="100">100</option>
                        <option value="250">250</option>
                        <option value="500">500</option>
                        <option value="1000">1000</option>
                      </select>
                    </div>
                  )}
                  <div className="pnl-cnt">
                    <div className="req-list">
                      {filtered.map(r => (
                        <div
                          key={r.id}
                          className={'req-item' + (selReq?.id === r.id ? ' sel' : '') + (!r.in_scope ? ' out' : '')}
                          onClick={() => setSelReq(r)}
                          onContextMenu={e => showContextMenu(e, r)}
                        >
                          <span className={'mth mth-' + r.method}>{r.method}</span>
                          <span className="url" title={r.url}>{r.url}</span>
                          <span className={'sts ' + stCls(r.response_status)}>{r.response_status || '-'}</span>
                          <span className="ts">{fmtTime(r.timestamp)}</span>
                        </div>
                      ))}
                      {filtered.length === 0 && (
                        <div className="empty">
                          <div className="empty-i">□</div>
                          <span>No requests</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <ResizeHandle onDrag={(dx) => {
                  const el = histContentRef.current;
                  if (!el) return;
                  const dpct = (dx / el.offsetWidth) * 100;
                  setHistPanelW(prev => Math.max(20, Math.min(80, prev + dpct)));
                }} />

                <div className="panel det-pnl">
                  {selReq ? (
                    <React.Fragment>
                      <div className="pnl-hdr">
                        <span>{selReq.method} {selReq.url.substring(0, 50)}</span>
                        <div className="acts">
                          <button className="btn btn-sm btn-p" onClick={() => selReqFull && toRep(selReqFull)} disabled={!selReqFull}>→ Rep</button>
                          <button className={'btn btn-sm ' + (selReq.saved ? 'btn-g' : 'btn-s')} onClick={() => togSave(selReq.id)}>
                            {selReq.saved ? '★' : '☆'}
                          </button>
                          <button className="btn btn-sm btn-d" onClick={() => delReq(selReq.id)}>×</button>
                        </div>
                      </div>
                      <div className="det-tabs">
                        <div className={'det-tab' + (detTab === 'request' ? ' act' : '')} onClick={() => setDetTab('request')}>Request</div>
                        <div className={'det-tab' + (detTab === 'response' ? ' act' : '')} onClick={() => setDetTab('response')}>Response</div>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <button className={'btn btn-sm ' + (detTab === 'request' ? (reqFormat === 'raw' ? 'btn-p' : 'btn-s') : (respFormat === 'raw' ? 'btn-p' : 'btn-s'))} onClick={() => detTab === 'request' ? setReqFormat('raw') : setRespFormat('raw')}>
                            Raw
                          </button>
                          <button className={'btn btn-sm ' + (detTab === 'request' ? (reqFormat === 'pretty' ? 'btn-p' : 'btn-s') : (respFormat === 'pretty' ? 'btn-p' : 'btn-s'))} onClick={() => detTab === 'request' ? setReqFormat('pretty') : setRespFormat('pretty')}>
                            Pretty
                          </button>
                          {detTab === 'response' && (
                            <>
                              <button className={'btn btn-sm ' + (respFormat === 'deminify' ? 'btn-p' : 'btn-s')} onClick={() => setRespFormat('deminify')} title="Beautify JavaScript">
                                Deminify
                              </button>
                              <button className={'btn btn-sm ' + (respFormat === 'render' ? 'btn-p' : 'btn-s')} onClick={() => setRespFormat('render')}>
                                Render
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {!selReqFull ? (
                        <div className="empty"><div className="splash-spin" style={{margin:'20px auto'}} /></div>
                      ) : (
                      <div className="code" ref={histSearch.contentRef}>
                        {(() => {
                          const d = selReqFull;
                          if (detTab === 'response' && respFormat === 'render') {
                            return (
                              <iframe
                                src={API + '/api/requests/' + selReq.id + '/render'}
                                sandbox="allow-same-origin"
                                style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                                title="Rendered Response"
                              />
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
                            return <div dangerouslySetInnerHTML={{ __html: hl.html }} />;
                          }
                          return <div dangerouslySetInnerHTML={{ __html: rawContent }} />;
                        })()}
                      </div>
                      )}
                      <div className="search-bar" style={{ borderTop: '1px solid var(--brd)' }}>
                        <input
                          placeholder={histSearch.isRegex ? 'Regex search...' : 'Search body...'}
                          value={histSearch.searchTerm}
                          onChange={e => { histSearch.setSearchTerm(e.target.value); histSearch.setMatchIndex(0); }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); histSearch.nextMatch(); }
                            if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); histSearch.prevMatch(); }
                            if (e.key === 'Escape') { histSearch.close(); }
                          }}
                          style={histSearch.isSearching ? { opacity: 0.7 } : {}}
                        />
                        <button className={'srch-btn' + (histSearch.isRegex ? ' act' : '')} onClick={() => { histSearch.toggleRegex(); histSearch.setMatchIndex(0); }} title="Toggle regex">.*</button>
                        <span className="search-info">{histSearch.isSearching ? '⏳' : (histSearch.matchCount > 0 ? (histSearch.matchIndex + 1) + '/' + histSearch.matchCount : '0/0')}</span>
                        <button className="srch-btn" onClick={histSearch.prevMatch} disabled={histSearch.matchCount === 0}>▲</button>
                        <button className="srch-btn" onClick={histSearch.nextMatch} disabled={histSearch.matchCount === 0}>▼</button>
                        <button className="srch-btn" onClick={histSearch.close}>✕</button>
                      </div>
                    </React.Fragment>
                  ) : (
                    <div className="empty">
                      <span>Select request</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {histSubTab === 'ws' && (
              <div className="ws-cnt">
                <div className="ws-conns panel" style={{ width: wsConnsW + 'px' }}>
                  <div className="pnl-hdr">
                    <span>Connections ({wsConns.length})</span>
                    <button className="btn btn-sm btn-s" onClick={loadWsConns}>&#8635;</button>
                  </div>
                  <div className="pnl-cnt">
                    {wsConns.map(c => (
                      <div key={c.url} className={'ws-conn-item' + (selWsConn === c.url ? ' sel' : '')}
                           onClick={() => loadWsFrames(c.url)}>
                        <span className="ws-conn-url">{c.url}</span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                          <span className="ws-conn-count">{c.frame_count} frames</span>
                          <span className="ts">{fmtTime(c.last_seen)}</span>
                        </div>
                      </div>
                    ))}
                    {wsConns.length === 0 && (
                      <div className="empty" style={{ padding: 30 }}>
                        <span>No WebSocket connections captured</span>
                      </div>
                    )}
                  </div>
                </div>
                <ResizeHandle onDrag={(dx) => setWsConnsW(w => Math.max(120, Math.min(400, w + dx)))} />
                <div className="ws-frames panel" style={{ width: wsFramesW + 'px' }}>
                  <div className="pnl-hdr">
                    <span>Frames {selWsConn ? '(' + wsFrames.length + ')' : ''}</span>
                  </div>
                  <div className="pnl-cnt">
                    {wsFrames.map(f => (
                      <div key={f.id} className={'ws-frame-item' + (selWsFrame?.id === f.id ? ' sel' : '')}
                           onClick={() => selectWsFrame(f)}
                           onContextMenu={e => showContextMenu(e, { ...f, url: selWsConn, method: 'WS', body: f.content }, 'websocket')}>
                        <span className={'ws-dir ws-dir-' + f.direction}>
                          {f.direction === 'up' ? '\u2191' : '\u2193'}
                        </span>
                        <span className="ws-frame-body">{(f.content || '').substring(0, 80)}</span>
                        <span className="ts">{fmtTime(f.timestamp)}</span>
                      </div>
                    ))}
                    {selWsConn && wsFrames.length === 0 && (
                      <div className="empty" style={{ padding: 30 }}><span>No frames</span></div>
                    )}
                    {!selWsConn && (
                      <div className="empty" style={{ padding: 30 }}><span>Select a connection</span></div>
                    )}
                  </div>
                </div>
                <ResizeHandle onDrag={(dx) => setWsFramesW(w => Math.max(150, Math.min(500, w + dx)))} />
                <div className="ws-detail panel">
                  {selWsFrame ? (
                    <React.Fragment>
                      <div className="pnl-hdr">
                        <span>{selWsFrame.direction === 'up' ? 'Client \u2192 Server' : 'Server \u2192 Client'}</span>
                        <span className="ts">{fmtTime(selWsFrame.timestamp)}</span>
                      </div>
                      <div className="code" style={{ maxHeight: '40%', borderBottom: '1px solid var(--brd)' }}>{selWsFrame.content}</div>
                      <div className="pnl-hdr"><span>Resend Frame</span></div>
                      <textarea className="ed-ta" style={{ flex: 1 }} value={wsResendMsg}
                                onChange={e => setWsResendMsg(e.target.value)} placeholder="Edit frame content..." />
                      <div style={{ padding: '10px 14px', display: 'flex', gap: '10px', background: 'var(--bg2)', borderTop: '1px solid var(--brd)' }}>
                        <button className="btn btn-p" onClick={resendWsFrame}
                                disabled={wsSending || !wsResendMsg}>
                          {wsSending ? '...' : '\u25B6 Resend'}
                        </button>
                      </div>
                      {wsResendResp && (
                        <div className="code" style={{ maxHeight: '30%', borderTop: '1px solid var(--brd)' }}>
                          {wsResendResp.error
                            ? 'Error: ' + wsResendResp.error
                            : wsResendResp.response
                              ? 'Response: ' + wsResendResp.response
                              : wsResendResp.note || 'Sent (no response)'}
                        </div>
                      )}
                    </React.Fragment>
                  ) : (
                    <div className="empty"><span>Select a frame</span></div>
                  )}
                </div>
              </div>
            )}

            {histSubTab === 'sitemap' && (
              <div className="hist-content" ref={smContentRef}>
                <div className="panel sm-tree" style={{ width: smTreeW + '%' }}>
                  <div className="pnl-hdr">
                    <span>{Object.keys(siteTree).length} hosts</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn btn-sm btn-s" onClick={() => setSmShowStats(!smShowStats)}>
                        {smShowStats ? 'Hide' : 'Show'} Stats
                      </button>
                      <button className="btn btn-sm btn-s" onClick={() => { setSmExpanded({}); setSmSelNode(null); }}>Collapse All</button>
                    </div>
                  </div>
                  {smShowStats && (
                    <div style={{ padding: '12px', borderBottom: '1px solid var(--brd)', fontSize: '10px', color: 'var(--txt2)' }}>
                      <div style={{ marginBottom: '8px', fontWeight: 600, color: 'var(--txt1)' }}>Top Methods</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                        {Object.entries(smStats.methods).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([m, c]) => (
                          <span key={m} style={{ padding: '2px 6px', background: 'var(--bg3)', borderRadius: '2px' }}>
                            <span className={'mth-' + m} style={{ fontWeight: 600 }}>{m}</span> {c}
                          </span>
                        ))}
                      </div>
                      <div style={{ marginBottom: '8px', fontWeight: 600, color: 'var(--txt1)' }}>Status Codes</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                        {Object.entries(smStats.statuses).sort((a, b) => b[1] - a[1]).map(([s, c]) => (
                          <span key={s} style={{ padding: '2px 6px', background: 'var(--bg3)', borderRadius: '2px' }}>
                            {s}: {c}
                          </span>
                        ))}
                      </div>
                      <div style={{ marginBottom: '8px', fontWeight: 600, color: 'var(--txt1)' }}>Top Extensions</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {Object.entries(smStats.extensions).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([e, c]) => (
                          <span key={e} style={{ padding: '2px 6px', background: 'var(--bg3)', borderRadius: '2px' }}>
                            .{e}: {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="pnl-cnt">
                    {Object.keys(siteTree).length === 0 ? (
                      <div className="empty">
                        <div className="empty-i">🌐</div>
                        <span>No requests captured</span>
                      </div>
                    ) : (
                      Object.entries(siteTree)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([origin, node]) => renderTreeNode(origin, node, 0, ''))
                    )}
                  </div>
                </div>
                <ResizeHandle onDrag={(dx) => {
                  const el = smContentRef.current;
                  if (!el) return;
                  const dpct = (dx / el.offsetWidth) * 100;
                  setSmTreeW(prev => Math.max(15, Math.min(70, prev + dpct)));
                }} />
                <div className="sm-right">
                  <div className="panel" style={{ flex: smSelNode && selReq ? 1 : 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div className="pnl-hdr">
                      <span>{smSelNode ? smNodeReqs.length + ' requests' : 'Select a node'}</span>
                      {smSelNode && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn btn-sm btn-s" onClick={() => exportSitemap('json')} title="Export as JSON">JSON</button>
                          <button className="btn btn-sm btn-s" onClick={() => exportSitemap('csv')} title="Export as CSV">CSV</button>
                        </div>
                      )}
                    </div>
                    {smSelNode && (
                      <div style={{ padding: '8px', borderBottom: '1px solid var(--brd)', display: 'grid', gridTemplateColumns: 'auto auto auto 1fr', gap: '6px', alignItems: 'center' }}>
                        <select className="sel" value={smFilterMethod} onChange={e => setSmFilterMethod(e.target.value)} style={{ fontSize: '10px', padding: '4px 6px' }}>
                          <option value="">All Methods</option>
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="DELETE">DELETE</option>
                          <option value="PATCH">PATCH</option>
                          <option value="OPTIONS">OPTIONS</option>
                          <option value="HEAD">HEAD</option>
                        </select>
                        <select className="sel" value={smFilterStatus} onChange={e => setSmFilterStatus(e.target.value)} style={{ fontSize: '10px', padding: '4px 6px' }}>
                          <option value="">All Status</option>
                          <option value="2">2xx</option>
                          <option value="3">3xx</option>
                          <option value="4">4xx</option>
                          <option value="5">5xx</option>
                        </select>
                        <input className="inp" placeholder="Extension" value={smFilterExt} onChange={e => setSmFilterExt(e.target.value)} style={{ fontSize: '10px', padding: '4px 6px', width: '80px' }} />
                        <input className="inp" placeholder="Search URL..." value={smFilterText} onChange={e => setSmFilterText(e.target.value)} style={{ fontSize: '10px', padding: '4px 6px' }} />
                      </div>
                    )}
                    <div className="pnl-cnt">
                      {smSelNode ? (
                        <div className="req-list">
                          {smNodeReqs.map(r => (
                            <div
                              key={r.id}
                              className={'req-item' + (selReq?.id === r.id ? ' sel' : '') + (!r.in_scope ? ' out' : '')}
                              onClick={() => setSelReq(r)}
                              onContextMenu={e => showContextMenu(e, r)}
                            >
                              <span className={'mth mth-' + r.method}>{r.method}</span>
                              <span className="url" title={r.url}>{r.url}</span>
                              <span className={'sts ' + stCls(r.response_status)}>{r.response_status || '-'}</span>
                              <span className="ts">{fmtTime(r.timestamp)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="empty"><span>Click a node in the tree</span></div>
                      )}
                    </div>
                  </div>
                  {selReq && smSelNode && (
                    <div className="panel" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--brd)' }}>
                      <div className="pnl-hdr">
                        <span>{selReq.method} {selReq.url.substring(0, 60)}</span>
                        <div className="acts">
                          <button className="btn btn-sm btn-p" onClick={() => selReqFull && toRep(selReqFull)} disabled={!selReqFull}>→ Rep</button>
                        </div>
                      </div>
                      <div className="det-tabs">
                        <div className={'det-tab' + (detTab === 'request' ? ' act' : '')} onClick={() => setDetTab('request')}>Request</div>
                        <div className={'det-tab' + (detTab === 'response' ? ' act' : '')} onClick={() => setDetTab('response')}>Response</div>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <button className={'btn btn-sm ' + (detTab === 'request' ? (reqFormat === 'raw' ? 'btn-p' : 'btn-s') : (respFormat === 'raw' ? 'btn-p' : 'btn-s'))} onClick={() => detTab === 'request' ? setReqFormat('raw') : setRespFormat('raw')}>Raw</button>
                          <button className={'btn btn-sm ' + (detTab === 'request' ? (reqFormat === 'pretty' ? 'btn-p' : 'btn-s') : (respFormat === 'pretty' ? 'btn-p' : 'btn-s'))} onClick={() => detTab === 'request' ? setReqFormat('pretty') : setRespFormat('pretty')}>Pretty</button>
                          {detTab === 'response' && (
                            <>
                              <button className={'btn btn-sm ' + (respFormat === 'deminify' ? 'btn-p' : 'btn-s')} onClick={() => setRespFormat('deminify')} title="Beautify JavaScript">
                                Deminify
                              </button>
                              <button className={'btn btn-sm ' + (respFormat === 'render' ? 'btn-p' : 'btn-s')} onClick={() => setRespFormat('render')}>
                                Render
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {!selReqFull ? (
                        <div className="empty"><div className="splash-spin" style={{margin:'20px auto'}} /></div>
                      ) : (
                      <div className="code">
                        {(() => {
                          const d = selReqFull;
                          if (detTab === 'response' && respFormat === 'render') {
                            return (
                              <iframe
                                src={API + '/api/requests/' + selReq.id + '/render'}
                                sandbox="allow-same-origin"
                                style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                                title="Rendered Response"
                              />
                            );
                          }
                          const reqF = d.body ? formatBody(d.body, reqFormat) : { text: '', html: false };
                          const resF = formatBody(d.response_body || '', respFormat);
                          const ct = detTab === 'request'
                            ? (escapeHtml(d.method + ' ' + (() => { try { return new URL(d.url).pathname; } catch (e) { return d.url; } })()) + '\n\n' + fmtHHtml(d.headers, d.url) + (d.body ? '\n\n' + (reqF.html ? reqF.text : escapeHtml(reqF.text)) : ''))
                            : (escapeHtml('HTTP ' + d.response_status) + '\n\n' + fmtHHtml(d.response_headers) + '\n\n' + (resF.html ? resF.text : escapeHtml(resF.text)));
                          return <div dangerouslySetInnerHTML={{ __html: ct }} />;
                        })()}
                      </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'intercept' && curPrj && (
          <div className="icept-pnl">
            {/* Control bar */}
            <div className="icept-bar">
              <button className={'icept-toggle ' + (intOn ? 'on' : 'off')} onClick={() => intercept.toggle()} title={intOn ? 'Disable intercept' : 'Enable intercept'}>
                <span className="icept-dot" style={{ background: intOn ? '#ef4444' : 'var(--txt3)' }} />
                {intOn ? 'Intercept ON' : 'Intercept OFF'}
              </button>
              <div className="icept-sep" />
              <button className="btn btn-g btn-sm" disabled={!selPend} onClick={() => selPend && fwdReq(selPend.id, editReq)} title="Forward selected request">▶ Forward</button>
              <button className="btn btn-d btn-sm" disabled={!selPend} onClick={() => selPend && dropReq(selPend.id)} title="Drop selected request">✕ Drop</button>
              {pending.length > 0 && (
                <>
                  <div className="icept-sep" />
                  <button className="btn btn-s btn-sm" onClick={fwdAll} title="Forward all pending">▶▶ Fwd All ({pending.length})</button>
                  <button className="btn btn-s btn-sm" onClick={dropAll} title="Drop all pending">✕ Drop All</button>
                </>
              )}
              <div style={{ flex: 1 }} />
              {intOn && pending.length > 0 && (
                <span style={{ fontSize: 10, color: 'var(--orange)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {pending.length} request{pending.length !== 1 ? 's' : ''} queued
                </span>
              )}
            </div>

            {/* Body: queue + editor */}
            <div className="icept-body">
              {/* Queue */}
              <div className="icept-queue" style={{ width: intPendW + 'px' }}>
                <div className="pnl-hdr">
                  <span>Queue</span>
                  {pending.length > 0 && (
                    <span style={{ background: 'var(--orange)', color: '#000', padding: '1px 7px', borderRadius: 10, fontSize: 9, fontWeight: 700, marginLeft: 6 }}>{pending.length}</span>
                  )}
                </div>
                <div className="icept-queue-list">
                  {pending.map(r => {
                    let host = r.url, path = '';
                    try { const u = new URL(r.url); host = u.host; path = u.pathname + (u.search || ''); } catch (e) {}
                    return (
                      <div key={r.id}
                        className={'icept-item' + (selPend?.id === r.id ? ' sel' : '')}
                        onClick={() => { setSelPend(r); setEditReq({ ...r, rawHeaders: fmtH(r.headers, r.url) }); }}
                        onContextMenu={e => showContextMenu(e, r, 'intercept')}
                      >
                        <span className={'mth mth-' + r.method}>{r.method}</span>
                        <div className="icept-item-info">
                          <span className="icept-item-host">{host}</span>
                          {path && path !== '/' && <span className="icept-item-path">{path}</span>}
                        </div>
                        <span className="icept-item-ts">{fmtTime(r.timestamp)}</span>
                      </div>
                    );
                  })}
                  {pending.length === 0 && (
                    <div className="icept-empty" style={{ padding: '40px 16px' }}>
                      <span style={{ fontSize: 28 }}>{intOn ? '⏳' : '🔓'}</span>
                      <span style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.5 }}>
                        {intOn ? 'Waiting for traffic...' : 'Enable intercept to capture requests'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <ResizeHandle onDrag={(dx) => setIntPendW(w => Math.max(160, Math.min(500, w + dx)))} />

              {/* Editor */}
              <div className="icept-edit">
                {selPend && editReq ? (
                  <>
                    <div className="ed-row" onContextMenu={e => showContextMenu(e, editReq, 'intercept')}>
                      <select className="mth-sel" value={editReq.method} onChange={e => setEditReq({ ...editReq, method: e.target.value })}>
                        {['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS','TRACE'].map(m => <option key={m}>{m}</option>)}
                      </select>
                      <input className="url-in" value={editReq.url} onChange={e => setEditReq({ ...editReq, url: e.target.value })} spellCheck="false" />
                    </div>
                    <div className="icept-section">Headers</div>
                    <div className="hdr-wrap" style={{ height: '38%', flexShrink: 0 }}>
                      <pre ref={interceptHeadersHighlightRef} className="hdr-highlight ed-ta" aria-hidden="true" style={{ pointerEvents: 'none' }}
                        dangerouslySetInnerHTML={{ __html: colorizeHeaders(editReq.rawHeaders || '') + '\n' }} />
                      <textarea ref={interceptHeadersRef} className="ed-ta hdr-ta"
                        value={editReq.rawHeaders || ''}
                        onChange={e => {
                          const raw = e.target.value;
                          const h = {};
                          raw.split('\n').forEach(l => { const ci = l.indexOf(':'); if (ci > 0) h[l.slice(0, ci).trim()] = l.slice(ci + 1).trim(); });
                          setEditReq({ ...editReq, rawHeaders: raw, headers: h });
                        }}
                        onScroll={e => { if (interceptHeadersHighlightRef.current) interceptHeadersHighlightRef.current.scrollTop = e.target.scrollTop; }}
                        spellCheck="false"
                      />
                    </div>
                    <div className="icept-section">Body</div>
                    <textarea className="ed-ta" style={{ flex: 1 }}
                      value={editReq.body || ''}
                      onChange={e => setEditReq({ ...editReq, body: e.target.value })}
                      placeholder="(empty body)"
                      spellCheck="false"
                    />
                  </>
                ) : (
                  <div className="icept-empty">
                    <span style={{ fontSize: 36 }}>{intOn ? '🔒' : '🔓'}</span>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt2)', marginBottom: 6 }}>
                        {intOn ? (pending.length > 0 ? 'Select a request from the queue' : 'Waiting for traffic...') : 'Interceptor is OFF'}
                      </div>
                      <div style={{ fontSize: 11 }}>
                        {!intOn ? 'Click "Intercept OFF" to start capturing' : pending.length === 0 ? `Proxy running on port ${pxPort}` : ''}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'scope' && curPrj && (
          <div className="scp-pnl">
            <div className="scp-hdr">
              <h3>Scope Rules</h3>
              <p>Define which hosts are in scope</p>
            </div>
            <div className="scp-form">
              <input className="inp" style={{ flex: 1 }} placeholder="Pattern: *.example.com" value={newPat} onChange={e => setNewPat(e.target.value)} />
              <select className="sel" value={newType} onChange={e => setNewType(e.target.value)}>
                <option value="include">Include</option>
                <option value="exclude">Exclude</option>
              </select>
              <button className="btn btn-p" onClick={addRule}>+ Add</button>
            </div>
            <div className="scp-rules">
              {scopeRules.map(r => (
                <div key={r.id} className={'scp-rule' + (r.enabled ? '' : ' dis')}>
                  <span className={'rul-type rul-' + (r.rule_type === 'include' ? 'inc' : 'exc')}>{r.rule_type}</span>
                  <span className="rul-pat">{r.pattern}</span>
                  <div className="rul-acts">
                    <button className="btn btn-sm btn-s" onClick={() => scope.toggleRule(r.id)}>{r.enabled ? 'Disable' : 'Enable'}</button>
                    <button className="btn btn-sm btn-d" onClick={() => scope.deleteRule(r.id)}>×</button>
                  </div>
                </div>
              ))}
              {scopeRules.length === 0 && (
                <div className="empty" style={{ padding: 30 }}>
                  <span>No rules - all in scope</span>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'repeater' && curPrj && (
          <div className="rep-cnt" ref={repCntRef}>
            <div className="rep-side" style={{ width: repSideW + 'px' }}>
              <div className="pnl-hdr">
                <span>Saved</span>
                <button className="btn btn-sm btn-p" onClick={saveRep}>+</button>
              </div>
              <div className="rep-list">
                {repReqs.map(r => (
                  <div key={r.id} className={'rep-item' + (selRep === r.id ? ' sel' : '')} onClick={() => loadRepItem(r)}
                    onContextMenu={e => showContextMenu(e, r, 'repeater')}>
                    <span className={'mth mth-' + r.method}>{r.method}</span>
                    <span className="name" onDoubleClick={e => { e.stopPropagation(); renameRepItem(r.id); }}>{r.name}</span>
                    {selRep === r.id && (
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px' }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-sm btn-s" onClick={() => renameRepItem(r.id)} title="Rename" style={{ padding: '2px 5px', fontSize: '10px' }}>✎</button>
                        <button className="btn btn-sm btn-d" onClick={() => delRepItem(r.id)} title="Delete" style={{ padding: '2px 5px', fontSize: '10px' }}>✕</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <ResizeHandle onDrag={(dx) => setRepSideW(w => Math.max(100, Math.min(400, w + dx)))} />
            <div className="rep-main">
              <div className="req-bar">
                <button className="btn btn-s" onClick={() => navigateHistory(-1)} disabled={repHistoryIndex <= 0} title="Previous">◀</button>
                <button className="btn btn-s" onClick={() => navigateHistory(1)} disabled={repHistoryIndex >= repHistory.length - 1} title="Next">▶</button>
                <select className="mth-sel" value={repM} onChange={e => setRepM(e.target.value)}>
                  <option>GET</option>
                  <option>HEAD</option>
                  <option>POST</option>
                  <option>PUT</option>
                  <option>PATCH</option>
                  <option>DELETE</option>
                  <option>CONNECT</option>
                  <option>OPTIONS</option>
                  <option>TRACE</option>
                  <option>PATCH</option>
                </select>
                <input className="url-in" placeholder="https://..." value={repU} onChange={e => setRepU(e.target.value)} />
                <button className="btn btn-p" onClick={sendRep} disabled={loading || !repU}>{loading ? '...' : '▶ Send'}</button>
                <select className="sel" value={repFollowRedirects ? 'follow' : 'manual'} onChange={e => setRepFollowRedirects(e.target.value === 'follow')}
                  style={{ fontSize: '10px', padding: '4px 6px', minWidth: '105px' }} title="Redirect mode">
                  <option value="manual">No Redirect</option>
                  <option value="follow">Auto Follow</option>
                </select>
              </div>
              <div className="rep-edit" style={{ gridTemplateColumns: repSplitPct + '% 1fr' }}>
                <div className="ed-pane">
                  <div className="ed-hdr">
                    <span>Headers</span>
                  </div>
                  <div className="hdr-wrap" style={{ height: '40%' }}>
                    <pre ref={repHeadersHighlightRef} className="hdr-highlight ed-ta" aria-hidden="true" style={{ pointerEvents: 'none' }} dangerouslySetInnerHTML={{ __html: (repH ? colorizeHeaders(repH) : '') + '\n' }} />
                    <textarea ref={repHeadersRef} className="ed-ta hdr-ta" value={repH} onChange={e => setRepH(e.target.value)}
                      onScroll={e => { if (repHeadersHighlightRef.current) repHeadersHighlightRef.current.scrollTop = e.target.scrollTop; }}
                      spellCheck="false" />
                  </div>
                  <div className="ed-hdr">
                    <span>Body</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn btn-sm btn-s" onClick={() => { setRepB(prettyPrint(repB)); setRepBodyColor(true); }} title="Pretty Print">Pretty</button>
                      <button className="btn btn-sm btn-s" onClick={() => { setRepB(minify(repB)); setRepBodyColor(false); }} title="Minify">Minify</button>
                    </div>
                  </div>
                  {repBodyColor ? (
                    <div
                      ref={repBodyEditRef}
                      className="ed-ce"
                      contentEditable
                      suppressContentEditableWarning
                      onInput={handleRepBodyInput}
                    />
                  ) : (
                    <textarea className="ed-ta" style={{ flex: 1 }} value={repB} onChange={e => setRepB(e.target.value)} />
                  )}
                </div>
                <div className="ed-pane">
                  <div className="ed-hdr">
                    <span>Response</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {repResp && !repResp.error && (
                        <span style={{ color: 'var(--txt3)' }}>
                          {repResp.status_code} • {repResp.elapsed?.toFixed(3)}s
                        </span>
                      )}
                      {repResp && repResp.body && !repResp.error && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className={'btn btn-sm ' + (repRespFormat === 'code' ? 'btn-p' : 'btn-s')} onClick={() => setRepRespFormat('code')}>Raw</button>
                          <button className="btn btn-sm btn-s" onClick={() => { setRepRespBody(prettyPrint(repRespBody)); }} title="Pretty Print">Pretty</button>
                          <button
                            className="btn btn-sm btn-s"
                            onClick={async () => {
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
                            }}
                            title="Deobfuscate & Beautify JavaScript (max 10MB)"
                            disabled={deobfuscator.isProcessing}
                          >
                            {deobfuscator.isProcessing ? '⏳ Processing...' : 'Deminify'}
                          </button>
                          <button className={'btn btn-sm ' + (repRespFormat === 'render' ? 'btn-p' : 'btn-s')} onClick={() => setRepRespFormat('render')}>Render</button>
                        </div>
                      )}
                    </div>
                  </div>
                  {repResp && repResp.error ? (
                    <div className="code">{repResp.error}</div>
                  ) : repResp ? (
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
                         onContextMenu={e => showContextMenu(e, { method: repM, url: repU, headers: repH, body: repRespBody, response_body: repRespBody, response_headers: repResp.headers, response_status: repResp.status_code }, 'repeater-response')}>
                      {repResp.redirect_chain && repResp.redirect_chain.length > 0 && (
                        <div style={{ padding: '6px 10px', background: 'var(--bg3)', borderBottom: '1px solid var(--brd)', fontSize: '10px', fontFamily: 'var(--font-mono)', flexShrink: 0, overflow: 'auto', maxHeight: '120px' }}>
                          <div style={{ color: 'var(--cyan)', marginBottom: '4px', fontWeight: 600 }}>Redirect chain ({repResp.redirect_chain.length} hops):</div>
                          {repResp.redirect_chain.map((hop, i) => (
                            <div key={i} style={{ color: 'var(--txt2)', paddingLeft: '8px' }}>
                              <span className={'sts ' + stCls(hop.status_code)}>{hop.status_code}</span> {hop.url} → {hop.location}
                            </div>
                          ))}
                          <div style={{ color: 'var(--green)', paddingLeft: '8px' }}>
                            <span className={'sts ' + stCls(repResp.status_code)}>{repResp.status_code}</span> {repResp.final_url}
                          </div>
                        </div>
                      )}
                      {repResp.is_redirect && !repFollowRedirects && repResp.redirect_url && (
                        <div style={{ padding: '6px 10px', background: 'rgba(210,153,34,.1)', borderBottom: '1px solid var(--brd)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', flexShrink: 0 }}>
                          <span style={{ color: 'var(--orange)', fontWeight: 600 }}>↪ Redirect</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--txt2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                title={repResp.redirect_url}>{repResp.redirect_url}</span>
                          <button className="btn btn-sm btn-p" onClick={followRedirect} disabled={loading} title="Follow this redirect">
                            Follow →
                          </button>
                        </div>
                      )}
                      <div className="code" style={{ height: '100px', minHeight: '60px', overflow: 'auto', flexShrink: 0, borderBottom: '1px solid var(--brd)' }} dangerouslySetInnerHTML={{ __html: fmtHHtml(repResp.headers) }} />
                      {(() => {
                        if (repRespFormat === 'render') {
                          const blob = new Blob([repRespBody], { type: 'text/html' });
                          const blobUrl = URL.createObjectURL(blob);
                          return (
                            <iframe
                              src={blobUrl}
                              sandbox="allow-same-origin"
                              style={{ flex: 1, width: '100%', border: 'none', background: '#fff' }}
                              title="Rendered Response"
                              onLoad={() => URL.revokeObjectURL(blobUrl)}
                            />
                          );
                        }
                        if (repSearch.debouncedSearchTerm) {
                          const hl = highlightMatches(repRespBody, repSearch.debouncedSearchTerm, repSearch.isRegex, repSearch.matchIndex);
                          if (hl.count !== repSearch.matchCount) setTimeout(() => repSearch.setMatchCount(hl.count), 0);
                          return <div className="code" ref={repSearch.contentRef} style={{ flex: 1, overflow: 'auto' }} dangerouslySetInnerHTML={{ __html: hl.html }} />;
                        }
                        const highlighted = colorizeBody(repRespBody);
                        return highlighted.html
                          ? <div className="code" style={{ flex: 1, overflow: 'auto' }} dangerouslySetInnerHTML={{ __html: highlighted.text }} />
                          : <textarea
                              className="ed-ta"
                              style={{ flex: 1 }}
                              value={repRespBody}
                              onChange={e => setRepRespBody(e.target.value)}
                              placeholder="Response body will appear here"
                            />;
                      })()}
                      <div className="search-bar" style={{ borderTop: '1px solid var(--brd)' }}>
                        <input
                          placeholder={repSearch.isRegex ? 'Regex search...' : 'Search body...'}
                          value={repSearch.searchTerm}
                          onChange={e => { repSearch.setSearchTerm(e.target.value); repSearch.setMatchIndex(0); }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); repSearch.nextMatch(); }
                            if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); repSearch.prevMatch(); }
                            if (e.key === 'Escape') { repSearch.close(); }
                          }}
                          style={repSearch.isSearching ? { opacity: 0.7 } : {}}
                        />
                        <button className={'srch-btn' + (repSearch.isRegex ? ' act' : '')} onClick={() => { repSearch.toggleRegex(); repSearch.setMatchIndex(0); }} title="Toggle regex">.*</button>
                        <span className="search-info">{repSearch.isSearching ? '⏳' : (repSearch.matchCount > 0 ? (repSearch.matchIndex + 1) + '/' + repSearch.matchCount : '0/0')}</span>
                        <button className="srch-btn" onClick={repSearch.prevMatch} disabled={repSearch.matchCount === 0}>▲</button>
                        <button className="srch-btn" onClick={repSearch.nextMatch} disabled={repSearch.matchCount === 0}>▼</button>
                        <button className="srch-btn" onClick={repSearch.close}>✕</button>
                      </div>
                    </div>
                  ) : (
                    <div className="code">Send a request</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'git' && curPrj && (
          <div className="git-pnl">
            <div className="git-sec">
              <div className="git-ttl">Create Commit (Press Ctrl+S for auto-commit)</div>
              <div className="cmt-form">
                <input className="cmt-in" placeholder="Message..." value={cmtMsg} onChange={e => setCmtMsg(e.target.value)} onKeyPress={e => e.key === 'Enter' && commit()} />
                <button className="btn btn-p" onClick={commit}>Commit</button>
              </div>
            </div>
            <div className="git-sec">
              <div className="git-ttl">History</div>
              <div className="cmt-list">
                {commits.map((c, i) => (
                  <div key={i} className="cmt-item">
                    <span className="cmt-hash">{c.hash}</span>
                    <span className="cmt-msg">{c.message}</span>
                    <span className="cmt-date">{c.date}</span>
                  </div>
                ))}
                {commits.length === 0 && (
                  <div className="cmt-item" style={{ justifyContent: 'center', color: 'var(--txt3)' }}>
                    No commits
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'extensions' && curPrj && (
          <div className="scp-pnl">
            <div className="scp-hdr">
              <h3>Extensions</h3>
              <p>Manage and configure extensions for request/response manipulation</p>
            </div>
            {extensions.length === 0 && (
              <div className="empty" style={{ padding: 30 }}>
                <div className="empty-i"></div>
                <span>No extensions installed</span>
              </div>
            )}
            {extensions.extensions.filter(ext => ext.name !== 'sensitive').map(ext => (
              <div key={ext.name} style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '8px', padding: '16px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>{ext.title || ext.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--txt2)' }}>{ext.description || 'No description'}</div>
                  </div>
                  <button className={'btn btn-sm ' + (ext.enabled ? 'btn-g' : 'btn-s')} onClick={() => togExtEnabled(ext.name, !ext.enabled)}>
                    {ext.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                {ext.enabled && (() => {
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
                  if (ext.ui_schema?.type === 'schema-driven') {
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
                    <div style={{ marginTop: '12px', padding: '12px', fontSize: '11px', color: 'var(--txt3)' }}>
                      Extension enabled (no UI configured)
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}


        {tab === 'collections' && curPrj && (
          <div className="coll-cnt">
            <div className="hist-sub-tabs">
              <div className={'hist-sub-tab' + (collSubTab === 'collections' ? ' act' : '')} onClick={() => setCollSubTab('collections')}>Collections</div>
              <div className={'hist-sub-tab' + (collSubTab === 'session-rules' ? ' act' : '')} onClick={() => { setCollSubTab('session-rules'); loadSessionRules(); }}>Session Rules</div>
            </div>

            {collSubTab === 'collections' && (
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <div className="coll-side panel" style={{ width: collSideW + 'px' }}>
                  <div className="pnl-hdr">
                    <span>Collections</span>
                    <button className="btn btn-sm btn-p" onClick={createColl}>+</button>
                  </div>
              <div className="pnl-cnt">
                {colls.map(c => (
                  <div key={c.id} className={'coll-item' + (selColl === c.id ? ' sel' : '')}
                       onClick={() => loadCollItems(c.id)}
                       onContextMenu={e => { e.preventDefault(); if (confirm('Delete "' + c.name + '"?')) deleteColl(c.id); }}>
                    <span className="coll-name">{c.name}</span>
                    <span className="coll-count">{c.item_count}</span>
                  </div>
                ))}
                {colls.length === 0 && (
                  <div className="empty" style={{ padding: 20, fontSize: 11 }}>
                    <span>No collections yet</span>
                  </div>
                )}
              </div>
            </div>
            <ResizeHandle onDrag={(dx) => setCollSideW(w => Math.max(100, Math.min(400, w + dx)))} />
            <div className="coll-steps panel" style={{ width: collStepsW + 'px' }}>
              <div className="pnl-hdr">
                <span>Steps {selColl ? '(' + collItems.length + ')' : ''}</span>
              </div>
              <div className="pnl-cnt">
                {collItems.map((item, idx) => (
                  <div key={item.id} className={'coll-step-item' + (collStep === idx ? ' active' : '') + (collResps[item.id] ? (collResps[item.id].error ? ' err' : ' done') : '')}
                       onClick={() => setCollStep(idx)}
                       onContextMenu={e => showContextMenu(e, item, 'collection')}>
                    <span className="coll-step-num">{idx + 1}</span>
                    <span className={'mth mth-' + item.method}>{item.method}</span>
                    <span className="url" style={{ flex: 1 }}>{item.url.length > 45 ? item.url.substring(0, 45) + '...' : item.url}</span>
                    {collResps[item.id] && !collResps[item.id].error && (
                      <span className={'sts ' + stCls(collResps[item.id].status_code)}>{collResps[item.id].status_code}</span>
                    )}
                    {collResps[item.id] && collResps[item.id].error && (
                      <span className="sts st5">ERR</span>
                    )}
                    <button className="btn btn-sm btn-d" onClick={e => { e.stopPropagation(); deleteCollItem(selColl, item.id); }} style={{ padding: '2px 5px', fontSize: '10px' }}>&#10005;</button>
                  </div>
                ))}
                {selColl && collItems.length === 0 && (
                  <div className="empty" style={{ padding: 20, fontSize: 11 }}>
                    <span>Add requests via right-click in History</span>
                  </div>
                )}
                {!selColl && (
                  <div className="empty" style={{ padding: 20, fontSize: 11 }}>
                    <span>Select a collection</span>
                  </div>
                )}
                {Object.keys(collVars).length > 0 && (
                  <div className="coll-vars">
                    <div className="coll-vars-hdr">Variables</div>
                    {Object.entries(collVars).map(([k, v]) => (
                      <div key={k} className="coll-var">
                        <span className="coll-var-name">{k}</span>
                        <span className="coll-var-val">{String(v).substring(0, 60)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <ResizeHandle onDrag={(dx) => setCollStepsW(w => Math.max(150, Math.min(600, w + dx)))} />
            <div className="coll-exec panel">
              {selColl && collItems.length > 0 ? (
                <React.Fragment>
                  <div className="pnl-hdr">
                    <span>Step {Math.min(collStep + 1, collItems.length)} of {collItems.length}</span>
                    <div className="acts">
                      <button className="btn btn-sm btn-p" onClick={executeCollStep}
                              disabled={collRunning || collStep >= collItems.length}>
                        {collRunning ? '...' : '\u25B6 Send Next'}
                      </button>
                      <button className="btn btn-sm btn-s" onClick={resetCollRun}>Reset</button>
                    </div>
                  </div>
                  {(() => {
                    const item = collItems[Math.min(collStep, collItems.length - 1)];
                    if (!item) return null;
                    const resp = collResps[item.id];
                    return (
                      <React.Fragment>
                        <div style={{ padding: '10px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--brd)', fontSize: '12px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                            <span className={'mth mth-' + item.method}>{item.method}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', flex: 1 }}>{item.url}</span>
                          </div>
                          {item.headers && Object.keys(item.headers).length > 0 && (
                            <div style={{ fontSize: '10px', color: 'var(--txt3)', marginBottom: '4px' }}>
                              {Object.entries(item.headers).map(([k, v]) => k + ': ' + v).join(' | ')}
                            </div>
                          )}
                          {item.body && (
                            <div style={{ fontSize: '10px', color: 'var(--txt3)' }}>Body: {item.body.substring(0, 100)}</div>
                          )}
                        </div>
                        <div style={{ padding: '8px 14px', background: 'var(--bg3)', borderBottom: '1px solid var(--brd)' }}>
                          <div style={{ fontSize: '10px', color: 'var(--txt2)', fontWeight: '600', marginBottom: '6px' }}>Variable Extractions</div>
                          {(item.var_extracts || []).map((ve, vi) => (
                            <div key={vi} className="coll-extract">
                              <span className="coll-extract-name">{ve.name}</span>
                              <span style={{ color: 'var(--txt3)', fontSize: '10px' }}>from {ve.source} at</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--cyan)' }}>{ve.path}</span>
                              <button className="btn btn-sm btn-d" style={{ padding: '1px 4px', fontSize: '9px' }}
                                onClick={() => {
                                  const newExtracts = item.var_extracts.filter((_, i) => i !== vi);
                                  updateCollItemExtracts(selColl, item.id, newExtracts);
                                }}>&#10005;</button>
                            </div>
                          ))}
                          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                            <input className="inp" placeholder="var name" id="ve-name" style={{ flex: 1, fontSize: '10px', padding: '4px 6px' }} />
                            <select className="sel" id="ve-source" style={{ fontSize: '10px', padding: '4px' }}>
                              <option value="body">body</option>
                              <option value="header">header</option>
                            </select>
                            <input className="inp" placeholder="$.path.to.value" id="ve-path" style={{ flex: 1, fontSize: '10px', padding: '4px 6px' }} />
                            <button className="btn btn-sm btn-s" onClick={() => {
                              const name = document.getElementById('ve-name').value;
                              const source = document.getElementById('ve-source').value;
                              const path = document.getElementById('ve-path').value;
                              if (!name || !path) return;
                              const newExtracts = [...(item.var_extracts || []), { name, source, path }];
                              updateCollItemExtracts(selColl, item.id, newExtracts);
                              document.getElementById('ve-name').value = '';
                              document.getElementById('ve-path').value = '';
                            }}>+ Add</button>
                          </div>
                        </div>
                        {resp && (
                          <React.Fragment>
                            <div className="pnl-hdr">
                              <span>Response</span>
                              {!resp.error && (
                                <span style={{ color: 'var(--txt3)', fontSize: '10px' }}>
                                  {resp.status_code} &#8226; {resp.elapsed?.toFixed(3)}s
                                </span>
                              )}
                            </div>
                            {(() => {
                              if (resp.error) return <div className="code" style={{ flex: 1 }}>{resp.error}</div>;
                              const collBodyFmt = colorizeBody(resp.body || '');
                              return collBodyFmt.html
                                ? <div className="code" style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: collBodyFmt.text }} />
                                : <div className="code" style={{ flex: 1 }}>{resp.body || ''}</div>;
                            })()}
                            {resp.extracted_variables && Object.keys(resp.extracted_variables).length > 0 && (
                              <div className="coll-vars" style={{ borderTop: '1px solid var(--brd)' }}>
                                <div className="coll-vars-hdr">Extracted</div>
                                {Object.entries(resp.extracted_variables).map(([k, v]) => (
                                  <div key={k} className="coll-var">
                                    <span className="coll-var-name">{k}</span>
                                    <span className="coll-var-val">{String(v).substring(0, 60)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </React.Fragment>
                        )}
                        {!resp && (
                          <div className="empty"><span>Click "Send Next" to execute this step</span></div>
                        )}
                      </React.Fragment>
                    );
                  })()}
                </React.Fragment>
              ) : (
                <div className="empty"><span>{selColl ? 'No steps - add requests from History' : 'Select a collection'}</span></div>
              )}
            </div>
              </div>
            )}

            {collSubTab === 'session-rules' && (
              <div style={{ padding: '20px', overflow: 'auto', flex: 1 }}>
                <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                  <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '4px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--cyan)' }}>Add Session Rule</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--txt2)', display: 'block', marginBottom: '4px' }}>Rule Name</label>
                        <input className="inp" value={newRule.name} onChange={e => setNewRule({ ...newRule, name: e.target.value })} placeholder="My Session Token" />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--txt2)', display: 'block', marginBottom: '4px' }}>Variable Name</label>
                        <input className="inp" value={newRule.variable} onChange={e => setNewRule({ ...newRule, variable: e.target.value })} placeholder="session_token" />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--txt2)', display: 'block', marginBottom: '4px' }}>When</label>
                        <select className="sel" value={newRule.when} onChange={e => setNewRule({ ...newRule, when: e.target.value })}>
                          <option value="request">Request</option>
                          <option value="response">Response</option>
                          <option value="both">Both</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--txt2)', display: 'block', marginBottom: '4px' }}>Target</label>
                        <select className="sel" value={newRule.target} onChange={e => setNewRule({ ...newRule, target: e.target.value })}>
                          <option value="url">URL</option>
                          <option value="headers">Headers</option>
                          <option value="body">Body</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--txt2)', display: 'block', marginBottom: '4px' }}>Group Number</label>
                        <input className="inp" type="number" value={newRule.group} onChange={e => setNewRule({ ...newRule, group: parseInt(e.target.value) || 1 })} />
                      </div>
                    </div>
                    {newRule.target === 'headers' && (
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '11px', color: 'var(--txt2)', display: 'block', marginBottom: '4px' }}>Header Name</label>
                        <input className="inp" value={newRule.header} onChange={e => setNewRule({ ...newRule, header: e.target.value })} placeholder="Set-Cookie" />
                      </div>
                    )}
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--txt2)', display: 'block', marginBottom: '4px' }}>Regex Pattern</label>
                      <input className="inp" value={newRule.regex} onChange={e => setNewRule({ ...newRule, regex: e.target.value })} placeholder="session=([^;]+)" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }} />
                    </div>
                    <button className="btn btn-p" onClick={addSessionRule}>Add Rule</button>
                  </div>

                  <div style={{ marginBottom: '16px', fontSize: '13px', fontWeight: 600 }}>Active Rules ({sessionRulesData.length})</div>
                  {sessionRulesData.map(rule => (
                    <div key={rule.id} style={{ marginBottom: '12px', padding: '12px', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '4px', opacity: rule.enabled ? 1 : 0.5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <input type="checkbox" checked={rule.enabled} onChange={e => toggleSessionRule(rule.id, e.target.checked)} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--txt1)' }}>{rule.name}</div>
                          <div style={{ fontSize: '10px', color: 'var(--txt2)', marginTop: '2px' }}>
                            Extract to variable: <code style={{ background: 'var(--bg3)', padding: '1px 4px', borderRadius: '2px' }}>{rule.variable}</code>
                          </div>
                        </div>
                        <button className="btn btn-sm btn-d" onClick={() => deleteSessionRule(rule.id)}>Delete</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px', fontSize: '10px', color: 'var(--txt2)' }}>
                        <span>When:</span><span>{rule.when}</span>
                        <span>Target:</span><span>{rule.target}{rule.target === 'headers' && rule.header ? ' (' + rule.header + ')' : ''}</span>
                        <span>Regex:</span><code style={{ background: 'var(--bg3)', padding: '2px 4px', borderRadius: '2px', fontFamily: 'var(--font-mono)' }}>{rule.regex}</code>
                        <span>Group:</span><span>{rule.group}</span>
                      </div>
                    </div>
                  ))}
                  {sessionRulesData.length === 0 && (
                    <div className="empty" style={{ padding: '30px' }}>
                      <span>No session rules configured</span>
                    </div>
                  )}

                  <div style={{ marginTop: '24px', padding: '16px', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '4px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--cyan)' }}>Usage</div>
                    <div style={{ fontSize: '11px', color: 'var(--txt2)', lineHeight: '1.6' }}>
                      Session rules automatically extract values from requests/responses using regex patterns. Extracted values are stored as variables that can be used in Collections.
                      <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                        <li>Use capturing groups in regex: <code style={{ background: 'var(--bg3)', padding: '1px 4px', borderRadius: '2px' }}>session=([^;]+)</code></li>
                        <li>Specify which group to extract (default is 1)</li>
                        <li>Target can be URL, specific header, or body content</li>
                        <li>Variables are automatically available in Collection requests as {'{{variable_name}}'}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'chepy' && curPrj && (
          <div className="chepy-cnt" ref={chepyCntRef}>
            <div className="hist-sub-tabs">
              <div className={'hist-sub-tab' + (chepySubTab === 'cipher' ? ' act' : '')} onClick={() => setChepySubTab('cipher')}>Cipher</div>
              <div className={'hist-sub-tab' + (chepySubTab === 'jwt' ? ' act' : '')} onClick={() => setChepySubTab('jwt')}>JWT</div>
            </div>

            {chepySubTab === 'cipher' && (
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <div className="chepy-col chepy-in-col" style={{ width: chepyInW + '%' }}>
                  <div className="pnl-hdr">
                    <span>Input</span>
                    <button className="btn btn-sm btn-s" onClick={() => setChepyIn('')}>Clear</button>
                  </div>
                  <textarea
                    className="ed-ta"
                    style={{ flex: 1 }}
                    value={chepyIn}
                    onChange={e => setChepyIn(e.target.value)}
                    placeholder="Paste or type input text here..."
                  />
                </div>

            <ResizeHandle onDrag={(dx) => {
              const el = chepyCntRef.current;
              if (!el) return;
              const dpct = (dx / el.offsetWidth) * 100;
              setChepyInW(prev => Math.max(15, Math.min(50, prev + dpct)));
            }} />

            <div className="chepy-col chepy-recipe-col" style={{ width: chepyRecW + '%' }}>
              <div className="pnl-hdr">
                <span>Recipe</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn btn-sm btn-d" onClick={clearChepyRecipe}>Clear</button>
                  <button className="btn btn-sm btn-p" onClick={bakeChepy} disabled={chepyBaking}>
                    {chepyBaking ? '...' : 'Bake'}
                  </button>
                </div>
              </div>

              <div className="chepy-add">
                <select className="sel" value={chepySelCat}
                  onChange={e => setChepySelCat(e.target.value)}
                  style={{ margin: '8px', borderRadius: '4px' }}>
                  {Object.keys(chepyCat).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <div className="chepy-ops-list">
                  {(chepyCat[chepySelCat] || []).map(op => (
                    <div key={op.name} className="chepy-avail-op" onClick={() => addChepyOp(op)}>
                      {op.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="chepy-steps">
                {chepyOps.length === 0 && (
                  <div className="empty" style={{ padding: 20, fontSize: 11 }}>
                    <span>Click operations above to build a recipe</span>
                  </div>
                )}
                {chepyOps.map((op, i) => (
                  <div key={i} className="chepy-step">
                    <div className="chepy-step-hdr">
                      <span className="chepy-step-num">{i + 1}</span>
                      <span className="chepy-step-name">{op.label}</span>
                      <div className="chepy-step-acts">
                        <button className="btn btn-sm btn-s" onClick={() => moveChepyOp(i, -1)} disabled={i === 0}>&#9650;</button>
                        <button className="btn btn-sm btn-s" onClick={() => moveChepyOp(i, 1)} disabled={i === chepyOps.length - 1}>&#9660;</button>
                        <button className="btn btn-sm btn-d" onClick={() => removeChepyOp(i)}>&#10005;</button>
                      </div>
                    </div>
                    {op.params.length > 0 && (
                      <div className="chepy-step-params">
                        {op.params.map(p => (
                          <div key={p.name} className="chepy-param">
                            <label className="chepy-param-lbl">{p.label}</label>
                            {p.type === 'select' ? (
                              <select className="sel" value={op.args[p.name] || p.default}
                                onChange={e => updateChepyArg(i, p.name, e.target.value)}
                                style={{ flex: 1, fontSize: '11px', padding: '5px 8px' }}>
                                {(p.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : (
                              <input className="inp" value={op.args[p.name] || ''}
                                onChange={e => updateChepyArg(i, p.name, e.target.value)}
                                placeholder={p.default || ''}
                                style={{ flex: 1, fontSize: '11px', padding: '5px 8px' }} />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <ResizeHandle onDrag={(dx) => {
              const el = chepyCntRef.current;
              if (!el) return;
              const dpct = (dx / el.offsetWidth) * 100;
              setChepyRecW(prev => Math.max(15, Math.min(50, prev + dpct)));
            }} />

            <div className="chepy-col chepy-out-col">
              <div className="pnl-hdr">
                <span>Output</span>
                <button className="btn btn-sm btn-s"
                  onClick={() => { navigator.clipboard.writeText(chepyOut); toast('Copied', 'success'); }}
                  disabled={!chepyOut}>
                  Copy
                </button>
              </div>
              {chepyErr ? (
                <div className="code" style={{ color: 'var(--red)' }}>{chepyErr}</div>
              ) : (
                <div className="code">{chepyOut || 'Output will appear here after baking'}</div>
              )}
            </div>
              </div>
            )}

            {chepySubTab === 'jwt' && (
              <div className="jwt-analyzer" style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '20px', gap: '16px', overflow: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--txt1)' }}>JWT Token</label>
                  <textarea
                    className="ed-ta"
                    style={{ minHeight: '80px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                    value={jwtToken}
                    onChange={e => setJwtToken(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
                  />
                  <button
                    className="btn btn-p"
                    onClick={() => {
                      const decoded = decodeJWT(jwtToken);
                      if (decoded) {
                        setJwtHeader(JSON.stringify(decoded.header, null, 2));
                        setJwtPayload(JSON.stringify(decoded.payload, null, 2));
                        setJwtSignature(decoded.signature);
                        toast('JWT decoded successfully', 'success');
                      } else {
                        toast('Invalid JWT token', 'error');
                      }
                    }}
                    disabled={!jwtToken}
                  >
                    Decode JWT
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--txt1)' }}>Header (JSON)</label>
                    <textarea
                      className="ed-ta"
                      style={{ minHeight: '120px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                      value={jwtHeader}
                      onChange={e => setJwtHeader(e.target.value)}
                      placeholder='{\n  "alg": "HS256",\n  "typ": "JWT"\n}'
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--txt1)' }}>Payload (JSON)</label>
                    <textarea
                      className="ed-ta"
                      style={{ minHeight: '120px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                      value={jwtPayload}
                      onChange={e => setJwtPayload(e.target.value)}
                      placeholder='{\n  "sub": "1234567890",\n  "name": "John Doe",\n  "iat": 1516239022\n}'
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--txt1)' }}>Signature</label>
                  <input
                    className="inp"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                    value={jwtSignature}
                    onChange={e => setJwtSignature(e.target.value)}
                    placeholder="SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
                  />
                </div>

                <button
                  className="btn btn-p"
                  onClick={() => {
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
                  }}
                >
                  Encode JWT
                </button>

                <div style={{ marginTop: '20px', padding: '16px', background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '4px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--cyan)' }}>Common JWT Attacks</div>
                  <div style={{ fontSize: '11px', color: 'var(--txt2)', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--txt1)', marginBottom: '4px' }}>1. Algorithm Confusion (alg=none)</div>
                      <div>Change the "alg" field in the header to "none" and remove the signature. Some implementations don't verify signatures when alg is none.</div>
                      <code style={{ display: 'block', marginTop: '4px', padding: '6px', background: 'var(--bg3)', borderRadius: '2px', fontSize: '10px' }}>{'{"alg": "none", "typ": "JWT"}'}</code>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--txt1)', marginBottom: '4px' }}>2. Key Confusion Attack</div>
                      <div>Change "alg" from RS256 (asymmetric) to HS256 (symmetric). If the server uses the public key as HMAC secret, you can forge signatures.</div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--txt1)', marginBottom: '4px' }}>3. Weak Secret Brute Force</div>
                      <div>If HS256/HS512 is used with a weak secret, the signature can be brute-forced offline. Use tools like hashcat or jwt_tool.</div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--txt1)', marginBottom: '4px' }}>4. JKU/X5U Header Injection</div>
                      <div>Add "jku" (JWK Set URL) or "x5u" (X.509 URL) headers pointing to attacker-controlled keys. If not validated, server may accept forged tokens.</div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--txt1)', marginBottom: '4px' }}>5. Kid Header Injection</div>
                      <div>The "kid" (Key ID) parameter can sometimes be exploited for path traversal or SQL injection if used unsafely in key lookup.</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'sensitive' && curPrj && (
          <div className="sens-cnt">
            <div className="det-tabs" style={{ justifyContent: 'flex-start', gap: 0 }}>
              <div className={'det-tab' + (sensSubTab === 'logger' ? ' act' : '')} onClick={() => setSensSubTab('logger')}>Logger</div>
              <div className={'det-tab' + (sensSubTab === 'options' ? ' act' : '')} onClick={() => setSensSubTab('options')}>Options</div>
            </div>

            {sensSubTab === 'logger' && (
              <React.Fragment>
                <div className="sens-toolbar">
                  <button className="btn btn-sm btn-g" onClick={runSensitiveScan} disabled={sensScanning || reqs.length === 0}>
                    {sensScanning ? '...' : '\u25B6'} Scan
                  </button>
                  <button className="btn btn-sm btn-d" onClick={stopSensitiveScan} disabled={!sensScanning}>
                    {'\u25A0'} Stop
                  </button>
                  <button className="btn btn-sm btn-s" onClick={() => { setSensResults([]); setSensSelResult(null); setSensSelDetail(null); setSensPct(0); }}>
                    Clear
                  </button>
                  <div className="sens-progress" style={{ flex: 1 }}>
                    <div className="sens-progress-bar" style={{ width: sensPct + '%' }} />
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--txt2)', whiteSpace: 'nowrap' }}>
                    {sensScanning ? sensPct + '%' : sensResults.length + ' findings'}
                  </span>
                </div>

                <div className="sens-filter-bar">
                  <input
                    placeholder="Filter results..."
                    value={sensFilter}
                    onChange={e => setSensFilter(e.target.value)}
                    style={{ flex: 1, padding: '4px 8px', background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '4px', color: 'var(--txt)', fontSize: '11px', fontFamily: 'var(--font-mono)', outline: 'none' }}
                  />
                  <label style={{ fontSize: '10px', color: 'var(--txt2)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={sensUnique} onChange={e => setSensUnique(e.target.checked)} />
                    Unique
                  </label>
                  <label style={{ fontSize: '10px', color: 'var(--txt2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Entropy ≥
                    <input
                      type="number"
                      min="0"
                      max="8"
                      step="0.1"
                      value={sensEntropyThreshold}
                      onChange={e => setSensEntropyThreshold(parseFloat(e.target.value) || 0)}
                      style={{ width: '50px', padding: '2px 4px', background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '4px', color: 'var(--txt)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}
                      title="Minimum entropy threshold to filter false positives (e.g., HTML tags). Default: 2.5"
                    />
                  </label>
                  <span style={{ fontSize: '10px', color: 'var(--txt3)' }}>
                    {sensFiltered.length}{sensFiltered.length !== sensResults.length ? ' / ' + sensResults.length : ''}
                  </span>
                </div>

                <div className="sens-results">
                  <div className="sens-row sens-row-hdr">
                    <span>Category</span>
                    <span>Match</span>
                    <span>Pattern / URL</span>
                  </div>
                  {sensFiltered.length === 0 && !sensScanning && (
                    <div className="empty" style={{ padding: '40px 0' }}>
                      <div className="empty-i">{sensResults.length === 0 ? '\uD83D\uDD0D' : '\uD83D\uDD0E'}</div>
                      <span>{sensResults.length === 0 ? 'Click Scan to analyze captured traffic' : 'No results match your filter'}</span>
                    </div>
                  )}
                  {sensFiltered.map((r, i) => (
                    <div key={i} className={'sens-row' + (sensSelResult === r ? ' sel' : '')} onClick={() => loadSensDetail(r)}>
                      <span className="sens-cat" style={{ background: (SENS_COLORS[r.category] || 'var(--txt3)') + '22', color: SENS_COLORS[r.category] || 'var(--txt3)' }}>
                        {r.category}
                      </span>
                      <span className="sens-match" title={r.match}>{r.match}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                        <span className="sens-pname">{r.patternName}</span>
                        <span className="sens-purl" title={r.url}>{r.method} {r.url}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {sensSelResult && (
                  <div className="sens-detail">
                    <div className="pnl-hdr">
                      <span style={{ fontSize: '11px' }}>
                        <span className="sens-cat" style={{ background: (SENS_COLORS[sensSelResult.category] || 'var(--txt3)') + '22', color: SENS_COLORS[sensSelResult.category] || 'var(--txt3)', marginRight: '8px' }}>
                          {sensSelResult.category}
                        </span>
                        {sensSelResult.patternName} — <span style={{ color: 'var(--txt3)' }}>{sensSelResult.section}</span>
                      </span>
                      <button className="btn btn-sm btn-s" onClick={() => { setSensSelResult(null); setSensSelDetail(null); }}>Close</button>
                    </div>
                    <div ref={sensDetailRef} style={{ flex: 1, overflow: 'auto', padding: '10px', fontFamily: 'var(--font-mono)', fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {sensSelDetail ? (() => {
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
                      })() : <span style={{ color: 'var(--txt3)' }}>Loading...</span>}
                    </div>
                  </div>
                )}
              </React.Fragment>
            )}

            {sensSubTab === 'options' && (
              <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                <div className="sens-opt-section">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontWeight: 600, fontSize: '12px' }}>Scanner Config</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '11px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Batch Size:
                      <input type="number" min="1" max="20" value={sensBatch} onChange={e => setSensBatch(Math.max(1, parseInt(e.target.value) || 4))}
                        style={{ width: '50px', padding: '3px 6px', background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '4px', color: 'var(--txt)', fontSize: '11px' }} />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Max Resp Size:
                      <input type="number" min="0" value={sensMaxSize} onChange={e => setSensMaxSize(parseInt(e.target.value) || 0)}
                        style={{ width: '90px', padding: '3px 6px', background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '4px', color: 'var(--txt)', fontSize: '11px' }} />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={sensScopeOnly} onChange={e => setSensScopeOnly(e.target.checked)} />
                      Scope only
                    </label>
                  </div>
                </div>

                {[
                  { key: 'general', label: 'General Patterns', defaults: SENS_GENERAL },
                  { key: 'tokens', label: 'Token Patterns', defaults: SENS_TOKENS },
                  { key: 'urls', label: 'URL Patterns', defaults: SENS_URLS },
                  { key: 'files', label: 'File Extension Patterns', defaults: SENS_FILES },
                ].map(grp => (
                  <div key={grp.key} className="sens-opt-section">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '12px' }}>{grp.label} ({sensPatterns[grp.key].filter(p => p.enabled).length}/{sensPatterns[grp.key].length})</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-sm btn-s" onClick={() => setSensPatterns(prev => ({ ...prev, [grp.key]: prev[grp.key].map(p => ({ ...p, enabled: true })) }))}>All</button>
                        <button className="btn btn-sm btn-s" onClick={() => setSensPatterns(prev => ({ ...prev, [grp.key]: prev[grp.key].map(p => ({ ...p, enabled: false })) }))}>None</button>
                        <button className="btn btn-sm btn-s" onClick={() => {
                          const name = prompt('Pattern name:');
                          if (!name) return;
                          const regex = prompt('Regex:');
                          if (!regex) return;
                          const category = prompt('Category:', grp.key === 'files' ? 'Files' : 'Custom');
                          setSensPatterns(prev => ({
                            ...prev,
                            [grp.key]: [...prev[grp.key], { name, regex, category: category || 'Custom', sections: grp.key === 'files' ? ['reqUrl'] : ['respHeaders','respBody'], enabled: true }]
                          }));
                        }}>+ Add</button>
                        <button className="btn btn-sm btn-s" onClick={() => setSensPatterns(prev => ({ ...prev, [grp.key]: grp.defaults.map(p => ({...p})) }))}>Reset</button>
                      </div>
                    </div>
                    <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                      {sensPatterns[grp.key].map((pat, pi) => (
                        <div key={pi} className="sens-pat-row">
                          <input type="checkbox" checked={pat.enabled} onChange={e => {
                            const val = e.target.checked;
                            const gk = grp.key;
                            const idx = pi;
                            setSensPatterns(prev => ({
                              ...prev,
                              [gk]: prev[gk].map((p, j) => j === idx ? { ...p, enabled: val } : p)
                            }));
                          }} />
                          <span style={{ flex: '0 0 180px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pat.name}>{pat.name}</span>
                          <span style={{ flex: 1, fontFamily: 'var(--font-mono)', color: 'var(--txt3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '10px' }} title={pat.regex}>{pat.regex}</span>
                          <span className="sens-section-badge">{pat.sections.join(', ')}</span>
                          <button className="btn btn-sm btn-s" style={{ padding: '1px 5px', fontSize: '9px' }} onClick={() => {
                            setSensPatterns(prev => {
                              const next = { ...prev, [grp.key]: prev[grp.key].filter((_, j) => j !== pi) };
                              return next;
                            });
                          }}>{'\u2715'}</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'bypass' && curPrj && React.createElement(BypassManager, { toast: hookToast, bypass: bypass })}

        {tab === 'intruder' && curPrj && (
          <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            <div className="rep-side" style={{ width: '200px', minWidth: '160px' }}>
              <div className="pnl-hdr">
                <span>Attacks</span>
                <button className="btn btn-sm btn-p" onClick={() => { setIntSelAttack(null); setIntMethod('GET'); setIntUrl(''); setIntHeaders(''); setIntBody(''); setIntResults([]); setIntDone(0); setIntTotal(0); setIntPct(0); setIntSelResult(null); setIntSubTab('positions'); }}>+ New</button>
              </div>
              <div className="rep-list">
                {intAttacks.map(a => (
                  <div key={a.id} className={'rep-item' + (intSelAttack === a.id ? ' sel' : '')} onClick={() => loadIntAttack(a.id)}>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                      <div style={{ fontSize: 9, color: 'var(--txt3)' }}>{a.total} results {'\u00b7'} {a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}</div>
                    </div>
                    {intSelAttack === a.id && (
                      <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-sm btn-s" onClick={() => renameIntAttack(a.id)} style={{ padding: '2px 5px', fontSize: 10 }}>{'\u270e'}</button>
                        <button className="btn btn-sm btn-d" onClick={() => deleteIntAttack(a.id)} style={{ padding: '2px 5px', fontSize: 10 }}>{'\u2715'}</button>
                      </div>
                    )}
                  </div>
                ))}
                {intAttacks.length === 0 && (
                  <div style={{ padding: 14, fontSize: 11, color: 'var(--txt3)', textAlign: 'center' }}>No saved attacks</div>
                )}
              </div>
            </div>
            <div className="intr-cnt" style={{ flex: 1, minWidth: 0 }}>
            <div className="det-tabs" style={{ justifyContent: 'flex-start', gap: 0 }}>
              <div className={'det-tab' + (intSubTab === 'positions' ? ' act' : '')} onClick={() => setIntSubTab('positions')}>Positions</div>
              <div className={'det-tab' + (intSubTab === 'payloads' ? ' act' : '')} onClick={() => setIntSubTab('payloads')}>Payloads</div>
              <div className={'det-tab' + (intSubTab === 'resource' ? ' act' : '')} onClick={() => setIntSubTab('resource')}>Resource Pool</div>
              <div className={'det-tab' + (intSubTab === 'results' ? ' act' : '')} onClick={() => setIntSubTab('results')}>Results {intResults.length > 0 ? '(' + intResults.length + ')' : ''}</div>
            </div>

            {intSubTab === 'positions' && (
              <div className="int-positions">
                <div className="int-section">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <label style={{ fontSize: 11, color: 'var(--txt2)' }}>Attack Type:</label>
                    <select className="sel" value={intAttackType} onChange={e => setIntAttackType(e.target.value)} style={{ fontSize: 11, padding: '4px 8px' }}>
                      <option value="targeted">Targeted</option>
                      <option value="broadcast">Broadcast</option>
                      <option value="parallel">Parallel</option>
                      <option value="matrix">Matrix</option>
                    </select>
                    <span style={{ fontSize: 10, color: 'var(--txt3)', flex: 1 }}>
                      {intAttackType === 'targeted' && 'Tests each position one at a time with a single payload set'}
                      {intAttackType === 'broadcast' && 'Same payload in all positions simultaneously'}
                      {intAttackType === 'parallel' && 'Different payload per position, iterated in parallel (zip)'}
                      {intAttackType === 'matrix' && 'Cartesian product of all payload sets — tests every combination'}
                    </span>
                  </div>
                </div>

                <div className="int-section">
                  <h4>Request</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <select className="mth-sel" value={intMethod} onChange={e => setIntMethod(e.target.value)} style={{ fontSize: 11 }}>
                      <option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option><option>HEAD</option><option>OPTIONS</option>
                    </select>
                    <input ref={intUrlRef} className="url-in" placeholder="https://example.com/api/endpoint" value={intUrl} onChange={e => setIntUrl(e.target.value)} style={{ flex: 1 }} />
                  </div>
                  <label style={{ fontSize: 10, color: 'var(--txt3)', display: 'block', marginBottom: 4 }}>Headers</label>
                  <div className="hdr-wrap">
                    <pre ref={intHeadersHighlightRef} className="hdr-highlight int-editor" aria-hidden="true" dangerouslySetInnerHTML={{ __html: (intHeaders ? colorizeHeaders(intHeaders) : '') + '\n' }} />
                    <textarea ref={intHeadersRef} className="int-editor hdr-ta" rows={4} value={intHeaders} onChange={e => setIntHeaders(e.target.value)}
                      onScroll={e => { if (intHeadersHighlightRef.current) intHeadersHighlightRef.current.scrollTop = e.target.scrollTop; }}
                      placeholder={'Content-Type: application/json\nAuthorization: Bearer \u00a7token\u00a7'} spellCheck="false" />
                  </div>
                  <label style={{ fontSize: 10, color: 'var(--txt3)', display: 'block', marginBottom: 4, marginTop: 8 }}>Body</label>
                  <textarea ref={intBodyRef} className="int-editor" rows={6} value={intBody} onChange={e => setIntBody(e.target.value)}
                    placeholder={'{"username":"\u00a7user\u00a7","password":"\u00a7pass\u00a7"}'} />
                </div>

                <div className="int-section">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button className="btn btn-sm btn-p" onClick={() => {
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
                    }}>{'\u00a7'} Add {'\u00a7'}</button>
                    <button className="btn btn-sm btn-s" onClick={() => {
                      setIntUrl(intUrl.replace(/\u00a7[^\u00a7]*\u00a7/g, m => m.slice(1, -1)));
                      setIntHeaders(intHeaders.replace(/\u00a7[^\u00a7]*\u00a7/g, m => m.slice(1, -1)));
                      setIntBody(intBody.replace(/\u00a7[^\u00a7]*\u00a7/g, m => m.slice(1, -1)));
                    }}>Clear {'\u00a7'}</button>
                    <span style={{ fontSize: 11, color: 'var(--txt2)' }}>Positions found: <strong style={{ color: 'var(--orange)' }}>{intPositions.length}</strong></span>
                  </div>
                  {intPositions.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {intPositions.map((p, i) => (
                        <span key={i} className="int-pos-tag">#{i + 1}: {p.name} <span style={{ color: 'var(--txt3)', fontSize: 9 }}>({p.section})</span></span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {intSubTab === 'payloads' && (
              <div className="int-payloads">
                <div className="int-section">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: 'var(--txt2)' }}>Payload Set:</label>
                    <select className="sel" value={intSelPayloadSet} onChange={e => setIntSelPayloadSet(Number(e.target.value))} style={{ fontSize: 11, padding: '4px 8px' }}>
                      {intPositions.map((p, i) => (
                        <option key={i} value={i}>Position #{i + 1}: {p.name}</option>
                      ))}
                    </select>
                  </div>
                  {intPositions.length === 0 && (
                    <div className="empty" style={{ padding: 30 }}>
                      <div className="empty-i">{'\u00a7'}</div>
                      <span>Add position markers in the Positions tab first</span>
                    </div>
                  )}
                  {intPositions.length > 0 && (() => {
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
                  })()}
                </div>
              </div>
            )}

            {intSubTab === 'resource' && (
              <div className="int-resource">
                <div className="int-section">
                  <h4>Throttle Settings</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <label style={{ fontSize: 11, color: 'var(--txt2)' }}>Concurrent Requests (1-50):
                      <input type="number" className="int-editor" style={{ marginTop: 4, padding: 6, minHeight: 'auto' }}
                        value={intConcurrency} onChange={e => setIntConcurrency(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} min={1} max={50} />
                    </label>
                    <label style={{ fontSize: 11, color: 'var(--txt2)' }}>Fixed Delay Between Batches (ms):
                      <input type="number" className="int-editor" style={{ marginTop: 4, padding: 6, minHeight: 'auto' }}
                        value={intDelay} onChange={e => setIntDelay(Math.max(0, Number(e.target.value) || 0))} min={0} />
                    </label>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="checkbox" checked={intRandomDelay} onChange={e => setIntRandomDelay(e.target.checked)} />
                      Random delay instead
                    </label>
                    {intRandomDelay && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8, marginLeft: 20 }}>
                        <label style={{ fontSize: 10, color: 'var(--txt3)' }}>Min (ms):
                          <input type="number" className="int-editor" style={{ marginTop: 4, padding: 6, minHeight: 'auto' }}
                            value={intDelayMin} onChange={e => setIntDelayMin(Number(e.target.value) || 0)} />
                        </label>
                        <label style={{ fontSize: 10, color: 'var(--txt3)' }}>Max (ms):
                          <input type="number" className="int-editor" style={{ marginTop: 4, padding: 6, minHeight: 'auto' }}
                            value={intDelayMax} onChange={e => setIntDelayMax(Number(e.target.value) || 0)} />
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                <div className="int-section">
                  <h4>Connection Settings</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <label style={{ fontSize: 11, color: 'var(--txt2)' }}>Request Timeout (seconds):
                      <input type="number" className="int-editor" style={{ marginTop: 4, padding: 6, minHeight: 'auto' }}
                        value={intTimeout} onChange={e => setIntTimeout(Math.max(1, Number(e.target.value) || 30))} min={1} />
                    </label>
                    <label style={{ fontSize: 11, color: 'var(--txt2)' }}>Max Retries on Error:
                      <input type="number" className="int-editor" style={{ marginTop: 4, padding: 6, minHeight: 'auto' }}
                        value={intMaxRetries} onChange={e => setIntMaxRetries(Math.max(0, Number(e.target.value) || 0))} min={0} />
                    </label>
                  </div>
                  <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
                    <input type="checkbox" checked={intFollowRedirects} onChange={e => setIntFollowRedirects(e.target.checked)} />
                    Follow redirects
                  </label>
                </div>

                <div className="int-section">
                  <h4>Attack Preview</h4>
                  <div style={{ fontSize: 11, color: 'var(--txt2)', lineHeight: 1.8 }}>
                    <div>Attack type: <strong>{intAttackType.replace('_', ' ')}</strong></div>
                    <div>Positions: <strong>{intPositions.length}</strong></div>
                    <div>Total requests: <strong style={{ color: 'var(--cyan)' }}>{intComputeTotal().toLocaleString()}</strong></div>
                    {intComputeTotal() > 0 && intConcurrency > 0 && (
                      <div>Estimated time: <strong>~{(() => {
                        const total = intComputeTotal();
                        const batches = Math.ceil(total / intConcurrency);
                        const avgDelay = intRandomDelay ? (intDelayMin + intDelayMax) / 2 : intDelay;
                        const secs = batches * 0.5 + batches * avgDelay / 1000;
                        if (secs < 60) return Math.round(secs) + 's';
                        if (secs < 3600) return Math.round(secs / 60) + ' min';
                        return (secs / 3600).toFixed(1) + ' hr';
                      })()}</strong></div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {intSubTab === 'results' && (
              <div className="int-results-cnt">
                <div className="sens-toolbar">
                  <button className="btn btn-sm btn-p" onClick={runIntruderAttack} disabled={intRunning || intPositions.length === 0}>{'\u25b6'} Start Attack</button>
                  <button className="btn btn-sm btn-d" onClick={stopIntruderAttack} disabled={!intRunning}>{'\u25a0'} Stop</button>
                  <button className="btn btn-sm btn-s" onClick={() => { setIntResults([]); setIntDone(0); setIntPct(0); setIntSelResult(null); }}>Clear</button>
                  <div className="int-progress" style={{ flex: 1, marginLeft: 8, marginRight: 8 }}>
                    <div className="int-progress-bar" style={{ width: intPct + '%' }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--txt3)', whiteSpace: 'nowrap' }}>{intPct}%</span>
                </div>
                <div className="int-stats" style={{ padding: '4px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--brd)' }}>
                  <span>{intDone}/{intTotal} requests</span>
                  {intStartTime && intDone > 0 && <span>{(intDone / ((Date.now() - intStartTime) / 1000)).toFixed(1)} req/s</span>}
                  {intStartTime && <span>Elapsed: {Math.round((Date.now() - intStartTime) / 1000)}s</span>}
                  <div style={{ flex: 1 }} />
                  <input className="int-editor" style={{ minHeight: 'auto', padding: '3px 8px', width: 180, resize: 'none', fontSize: 10 }}
                    placeholder="Filter results..." value={intFilter} onChange={e => setIntFilter(e.target.value)} />
                </div>
                <div className="int-results">
                  <div className="int-row int-row-hdr" onClick={e => {
                    const col = e.target.dataset.col;
                    if (!col) return;
                    setIntSortCol(col);
                    setIntSortDir(prev => intSortCol === col ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
                  }}>
                    <span data-col="#"># {intSortCol === '#' ? (intSortDir === 'asc' ? '\u25b2' : '\u25bc') : ''}</span>
                    <span data-col="payload">Payload {intSortCol === 'payload' ? (intSortDir === 'asc' ? '\u25b2' : '\u25bc') : ''}</span>
                    <span data-col="status">Status {intSortCol === 'status' ? (intSortDir === 'asc' ? '\u25b2' : '\u25bc') : ''}</span>
                    <span data-col="length">Length {intSortCol === 'length' ? (intSortDir === 'asc' ? '\u25b2' : '\u25bc') : ''}</span>
                    <span data-col="time">Time {intSortCol === 'time' ? (intSortDir === 'asc' ? '\u25b2' : '\u25bc') : ''}</span>
                    <span>Error</span>
                  </div>
                  {intSorted.map(r => (
                    <div key={r.num} className={'int-row' + (intSelResult && intSelResult.num === r.num ? ' sel' : '')}
                      onClick={() => setIntSelResult(prev => prev && prev.num === r.num ? null : r)}>
                      <span style={{ color: 'var(--txt3)' }}>{r.num}</span>
                      <span className="int-payload-txt" title={r.payload}>{r.payload}</span>
                      <span className={'int-status s' + String(r.status).charAt(0)}>{r.status || '-'}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{r.length > 0 ? r.length.toLocaleString() : '-'}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{r.time > 0 ? r.time + 'ms' : '-'}</span>
                      <span style={{ color: 'var(--red)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.error}>{r.error}</span>
                    </div>
                  ))}
                  {intResults.length === 0 && !intRunning && (
                    <div className="empty" style={{ padding: 40 }}>
                      <div className="empty-i">{'\u26a1'}</div>
                      <span>Click "Start Attack" to begin</span>
                    </div>
                  )}
                </div>
                {intSelResult && (
                  <div className="int-detail">
                    <div className="det-tabs" style={{ justifyContent: 'flex-start', gap: 0, flexShrink: 0 }}>
                      <div className="det-tab act" style={{ fontSize: 10 }}>Request / Response #{intSelResult.num}</div>
                      <div style={{ flex: 1 }} />
                      <button className="btn btn-sm btn-s" style={{ margin: '2px 6px', fontSize: 9 }} onClick={() => toRep(intSelResult.request)}>Send to Repeater</button>
                      <button className="btn btn-sm btn-s" style={{ margin: '2px 6px', fontSize: 9, padding: '2px 6px' }} onClick={() => setIntSelResult(null)}>{'\u2715'}</button>
                    </div>
                    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                      <div style={{ flex: 1, overflow: 'auto', padding: 10, borderRight: '1px solid var(--brd)' }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--cyan)', marginBottom: 6 }}>Request</div>
                        <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--txt)', margin: 0 }}
                          dangerouslySetInnerHTML={{ __html: escapeHtml(intSelResult.request.method + ' ' + intSelResult.request.url) + '\n' + fmtHHtml(intSelResult.request.headers, intSelResult.request.url) + (intSelResult.request.body ? '\n\n' + escapeHtml(intSelResult.request.body) : '') }} />
                      </div>
                      <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)', marginBottom: 6 }}>Response</div>
                        {intSelResult.response.error ? (
                          <div style={{ color: 'var(--red)', fontSize: 11 }}>{intSelResult.response.error}</div>
                        ) : (
                          <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--txt)', margin: 0 }}
                            dangerouslySetInnerHTML={{ __html: escapeHtml('HTTP ' + intSelResult.response.status_code + ' (' + intSelResult.time + 'ms, ' + intSelResult.length + ' bytes)') + '\n' + fmtHHtml(intSelResult.response.headers) + (intSelResult.response.body ? '\n\n' + escapeHtml(intSelResult.response.body) : '') }} />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          </div>
        )}

        {tab === 'compare' && curPrj && (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
            <div className="det-tabs" style={{ justifyContent: 'flex-start', gap: 0 }}>
              <div className={'det-tab' + (cmpView === 'request' ? ' act' : '')} onClick={() => setCmpView('request')}>Request</div>
              <div className={'det-tab' + (cmpView === 'response' ? ' act' : '')} onClick={() => setCmpView('response')}>Response</div>
              <div style={{ flex: 1 }} />
              <button className="btn btn-sm btn-s" style={{ margin: '4px 10px' }} onClick={() => { setCmpA(null); setCmpB(null); }}>Clear All</button>
            </div>
            {!cmpA && !cmpB ? (
              <div className="empty">
                <div className="empty-i">&#8596;</div>
                <span>Right-click a request and choose "Send to Compare (A/B)"</span>
              </div>
            ) : (
              <div className="cmp-wrap">
                <div className="cmp-side">
                  <div className="pnl-hdr">
                    <span style={{ fontWeight: 600, color: 'var(--red)' }}>A {cmpA ? <span style={{ fontWeight: 400, color: 'var(--txt2)' }}>{cmpA.method} {cmpA.url}</span> : '(empty)'}</span>
                    <button className="btn btn-sm btn-s" onClick={() => setCmpA(null)}>Clear</button>
                  </div>
                  <div className="cmp-body">
                    {cmpDiff.map((d, i) => {
                      const txt = d.type === 'added' ? null : (d.lineA ?? '');
                      return <div key={i} className={'cmp-line ' + (d.type === 'equal' ? 'cmp-eq' : d.type === 'removed' ? 'cmp-rem' : 'cmp-blank')}
                        dangerouslySetInnerHTML={{ __html: txt == null ? '\u00A0' : colorizeHeaders(txt) }} />;
                    })}
                  </div>
                </div>
                <div className="cmp-side">
                  <div className="pnl-hdr">
                    <span style={{ fontWeight: 600, color: 'var(--green)' }}>B {cmpB ? <span style={{ fontWeight: 400, color: 'var(--txt2)' }}>{cmpB.method} {cmpB.url}</span> : '(empty)'}</span>
                    <button className="btn btn-sm btn-s" onClick={() => setCmpB(null)}>Clear</button>
                  </div>
                  <div className="cmp-body">
                    {cmpDiff.map((d, i) => {
                      const txt = d.type === 'removed' ? null : (d.lineB ?? '');
                      return <div key={i} className={'cmp-line ' + (d.type === 'equal' ? 'cmp-eq' : d.type === 'added' ? 'cmp-add' : 'cmp-blank')}
                        dangerouslySetInnerHTML={{ __html: txt == null ? '\u00A0' : colorizeHeaders(txt) }} />;
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Generic handler for extension custom tabs */}
        {curPrj && (() => {
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
          else if (activeExt.ui_schema?.type === 'schema-driven') {
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
              <div style={{ marginTop: '12px', padding: '12px', fontSize: '11px', color: 'var(--txt3)' }}>
                Extension enabled (no UI configured)
              </div>
            );
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '20px' }}>
              {uiComponent}
            </div>
          );
        })()}
      </main>

      <div className="toast-c">
        {toasts.map(t => (
          <div key={t.id} className={'toast ' + t.type}>{t.message}</div>
        ))}
      </div>

      {contextMenu && (
        <div ref={ctxMenuRef} className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
          {(() => {
            const hasBody = contextMenu.normalized?.body || contextMenu.request?.response_body || contextMenu.source === 'selection';
            const hasUrl = contextMenu.normalized?.url;
            const isSelection = contextMenu.source === 'selection';
            const currentTab = contextMenu.currentTab;
            const hasRequest = contextMenu.normalized?.method && contextMenu.normalized?.url;

            return (
              <>
                {/* Send to Tools */}
                {hasBody && (
                  <div className="context-menu-item" onClick={() => handleContextAction('send-to-cipher')}>
                    Send to Cipher
                  </div>
                )}
                {hasRequest && !isSelection && currentTab !== 'repeater' && currentTab !== 'intruder' && (
                  <>
                    <div className="context-menu-item" onClick={() => handleContextAction('repeater')}>
                      Send to Repeater
                    </div>
                    <div className="context-menu-item" onClick={() => handleContextAction('intruder')}>
                      Send to Intruder
                    </div>
                  </>
                )}
                {hasRequest && !isSelection && currentTab !== 'collections' && (
                  <div className="context-menu-item" onClick={() => handleContextAction('add-to-collection')}>
                    Add to Collection
                  </div>
                )}
                {hasRequest && !isSelection && currentTab !== 'compare' && (
                  <>
                    <div className="context-menu-item" onClick={() => handleContextAction('compare-a')}>
                      Send to Compare (A)
                    </div>
                    <div className="context-menu-item" onClick={() => handleContextAction('compare-b')}>
                      Send to Compare (B)
                    </div>
                  </>
                )}

                {/* Copy/Download Actions */}
                {(hasBody || hasUrl) && <div className="context-menu-divider" />}
                {hasUrl && (
                  <div className="context-menu-item" onClick={() => handleContextAction('copy-url')}>
                    Copy URL
                  </div>
                )}
                {hasRequest && (
                  <>
                    <div className="context-menu-item" onClick={() => handleContextAction('copy-curl')}>
                      Copy as cURL
                    </div>
                    <div className="context-menu-item" onClick={() => handleContextAction('download-sqlmap')}>
                      Download for SQLMap
                    </div>
                  </>
                )}
                {hasBody && (
                  <div className="context-menu-item" onClick={() => handleContextAction('copy-body')}>
                    Copy Body
                  </div>
                )}
                {hasBody && !isSelection && (
                  <div className="context-menu-item" onClick={() => handleContextAction('download-body')}>
                    Download Body
                  </div>
                )}

                {/* Browser Actions */}
                {hasRequest && !isSelection && currentTab === 'history' && (
                  <div className="context-menu-item" onClick={() => handleContextAction('replay-browser')}>
                    Replay in Browser
                  </div>
                )}
                {(hasBody || hasRequest) && !isSelection && (
                  <div className="context-menu-item" onClick={() => handleContextAction('render-browser')}>
                    Render in Browser
                  </div>
                )}

                {/* Scope Actions */}
                {hasUrl && !isSelection && currentTab !== 'scope' && (
                  <>
                    <div className="context-menu-divider" />
                    <div className="context-menu-item" onClick={() => handleContextAction('scope-include')}>
                      Add host to Scope
                    </div>
                    <div className="context-menu-item" onClick={() => handleContextAction('scope-exclude')}>
                      Exclude host from Scope
                    </div>
                  </>
                )}

                {/* Tab-Specific Actions */}
                {currentTab === 'history' && contextMenu.request.id && (
                  <>
                    <div className="context-menu-divider" />
                    <div className="context-menu-item" onClick={() => handleContextAction('favorite')}>
                      {contextMenu.request.saved ? 'Unmark' : 'Mark'} as Favorite
                    </div>
                    <div className="context-menu-item" onClick={() => handleContextAction('delete')}>
                      Delete Request
                    </div>
                  </>
                )}
                {currentTab === 'repeater' && selRep && (
                  <>
                    <div className="context-menu-divider" />
                    <div className="context-menu-item" onClick={() => renameRepItem(selRep)}>
                      Rename Saved Request
                    </div>
                    <div className="context-menu-item" onClick={() => delRepItem(selRep)}>
                      Delete Saved Request
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </div>
      )}

      {showCollPick && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}
             onClick={() => setShowCollPick(null)}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '8px', padding: '20px', minWidth: '300px' }}
               onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '14px', marginBottom: '12px' }}>Add to Collection</h3>
            {colls.length === 0 && <div style={{ color: 'var(--txt3)', fontSize: '12px', marginBottom: '10px' }}>No collections yet. Create one in the Collections tab.</div>}
            {colls.map(c => (
              <div key={c.id} className="coll-pick-item" onClick={() => addToCollection(c.id, showCollPick)}>
                {c.name} <span style={{ color: 'var(--txt3)', fontSize: '10px' }}>({c.item_count} items)</span>
              </div>
            ))}
            <button className="btn btn-sm btn-s" style={{ marginTop: '10px' }} onClick={() => setShowCollPick(null)}>Cancel</button>
          </div>
        </div>
      )}

        {tab === 'console' && curPrj && (() => {
          const levelColor = { DEBUG: 'var(--txt3)', INFO: 'var(--cyan)', WARNING: 'var(--orange)', ERROR: 'var(--red)', CRITICAL: 'var(--red)' };
          const levelBg   = { DEBUG: 'transparent', INFO: 'transparent', WARNING: 'rgba(255,165,0,0.06)', ERROR: 'rgba(220,50,50,0.08)', CRITICAL: 'rgba(220,50,50,0.12)' };
          return (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden' }}>
              {/* Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: '1px solid var(--brd)', flexShrink: 0, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: proxyConsole.connected ? 'var(--green)' : 'var(--txt3)', display: 'flex', alignItems: 'center', gap: '5px', minWidth: '80px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: proxyConsole.connected ? 'var(--green)' : 'var(--txt3)', display: 'inline-block' }} />
                  {proxyConsole.connected ? 'Live' : 'Disconnected'}
                </span>
                <input
                  className="inp"
                  style={{ flex: 1, minWidth: '160px', fontSize: '11px', padding: '4px 8px' }}
                  placeholder="Filter messages..."
                  value={proxyConsole.filter}
                  onChange={e => proxyConsole.setFilter(e.target.value)}
                />
                <select
                  className="sel"
                  style={{ fontSize: '11px', padding: '4px 6px' }}
                  value={proxyConsole.levelFilter}
                  onChange={e => proxyConsole.setLevelFilter(e.target.value)}
                >
                  <option value="ALL">All levels</option>
                  <option value="DEBUG">DEBUG</option>
                  <option value="INFO">INFO</option>
                  <option value="WARNING">WARNING</option>
                  <option value="ERROR">ERROR</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--txt2)', cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={proxyConsole.autoScroll} onChange={e => proxyConsole.setAutoScroll(e.target.checked)} />
                  Auto-scroll
                </label>
                <button className="btn btn-sm btn-s" onClick={proxyConsole.clearLogs}>Clear</button>
                <span style={{ fontSize: '10px', color: 'var(--txt3)' }}>{proxyConsole.filteredLogs.length} entries</span>
              </div>
              {/* Log area */}
              <div style={{ flex: 1, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '4px 0' }}>
                {proxyConsole.filteredLogs.length === 0 ? (
                  <div className="empty">
                    <div className="empty-i">&#9654;</div>
                    <span>{proxyConsole.logs.length === 0 ? 'No proxy logs yet. Start the proxy to see output here.' : 'No entries match the current filter.'}</span>
                  </div>
                ) : (
                  proxyConsole.filteredLogs.map((entry, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', padding: '2px 12px', borderBottom: '1px solid var(--brd)', background: levelBg[entry.level] || 'transparent', lineHeight: '1.5' }}>
                      <span style={{ color: 'var(--txt3)', flexShrink: 0, minWidth: '82px' }}>
                        {entry.ts ? entry.ts.replace('T', ' ').replace(/\.\d+Z$/, 'Z') : ''}
                      </span>
                      <span style={{ color: levelColor[entry.level] || 'var(--txt)', fontWeight: '600', flexShrink: 0, minWidth: '50px' }}>
                        {entry.level}
                      </span>
                      <span style={{ color: 'var(--txt3)', flexShrink: 0, minWidth: '90px', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.name}>
                        {entry.name}
                      </span>
                      <span style={{ color: 'var(--txt)', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{entry.msg}</span>
                    </div>
                  ))
                )}
                <div ref={consoleEndRef} />
              </div>
            </div>
          );
        })()}

      {showProxyCfg && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }} onClick={() => setShowProxyCfg(false)}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--brd)', borderRadius: '8px', padding: '24px', minWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>Proxy Configuration</h3>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--txt2)', marginBottom: '6px' }}>Port</label>
              <input className="inp" type="number" value={pxPort} onChange={e => setPxPort(parseInt(e.target.value) || 8080)} min="1" max="65535" />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--txt2)', marginBottom: '6px' }}>Mode</label>
              <select className="sel" value={pxMode} onChange={e => setPxMode(e.target.value)} style={{ width: '100%' }}>
                <option value="regular">Regular</option>
                <option value="transparent">Transparent</option>
                <option value="socks5">SOCKS5</option>
                <option value="reverse:http://example.com">Reverse Proxy</option>
                <option value="upstream:http://proxy.example.com:8080">Upstream Proxy</option>
              </select>
              <div style={{ fontSize: '10px', color: 'var(--txt3)', marginTop: '4px' }}>Select proxy operating mode</div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--txt2)', marginBottom: '6px' }}>Additional Arguments</label>
              <input className="inp" type="text" value={pxArgs} onChange={e => setPxArgs(e.target.value)} placeholder="--ssl-insecure --verbose" />
              <div style={{ fontSize: '10px', color: 'var(--txt3)', marginTop: '4px' }}>Extra mitmproxy arguments (e.g., --ssl-insecure --verbose)</div>
            </div>
            <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg3)', borderRadius: '6px', fontSize: '11px' }}>
              <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--txt2)' }}>Common Configurations:</div>
              <div style={{ marginBottom: '4px' }}><strong>Transparent:</strong> Intercept traffic at network level (requires iptables)</div>
              <div style={{ marginBottom: '4px' }}><strong>SOCKS5:</strong> Run as SOCKS5 proxy server</div>
              <div style={{ marginBottom: '4px' }}><strong>Reverse:</strong> Act as reverse proxy for specific server</div>
              <div style={{ marginBottom: '4px' }}><strong>Upstream:</strong> Chain with another proxy</div>
              <div style={{ marginTop: '8px', color: 'var(--txt3)', fontSize: '10px' }}>Docs: <a href="https://docs.mitmproxy.org/stable/concepts-modes/" target="_blank" style={{ color: 'var(--cyan)' }}>mitmproxy.org/modes</a></div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-p" onClick={saveProxyCfg}>Save</button>
              <button className="btn btn-s" onClick={() => setShowProxyCfg(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      </React.Fragment>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Blackwire />);
