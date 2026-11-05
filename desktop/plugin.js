// Memory Studio - Unified Observability & Control for Hermes Built-in Memory,
// Limbic (FSRS-4.5 + Trust + Entity Graph), CM Playbooks & Starters, and CASS Session Search.

import { createElement as h, useState, useEffect, useCallback } from 'react';
import { host, PALETTE_AREA, ROUTES_AREA, SIDEBAR_NAV_AREA } from '@hermes/plugin-sdk';

const API_BASE = '/api/plugins/memory-studio';
const ID = 'memory-studio';
const ROUTE = '/memory-studio';

const BrainIcon = (props) => {
  const size = (props && props.size) || 16;
  return h('svg', {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: props && props.className,
  },
    h('path', { d: 'M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04Z' }),
    h('path', { d: 'M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04Z' })
  );
};

const S = {
  page: {
    padding: '22px 26px 48px',
    maxWidth: 1320,
    margin: '0 auto',
    color: 'var(--foreground, #e5e7eb)',
    fontFamily: 'inherit',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  subtitle: {
    fontSize: 13,
    color: 'var(--muted-foreground, #9ca3af)',
    marginTop: 4,
    lineHeight: 1.45,
  },
  navBar: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 18,
    borderBottom: '1px solid var(--border, rgba(255,255,255,0.09))',
    paddingBottom: 10,
  },
  tabBtn: (active) => ({
    padding: '7px 14px',
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
    border: active ? '1px solid var(--accent, #60a5fa)' : '1px solid var(--border, rgba(255,255,255,0.08))',
    background: active ? 'rgba(96, 165, 250, 0.14)' : 'var(--card, rgba(255,255,255,0.02))',
    color: active ? 'var(--foreground, #fff)' : 'var(--muted-foreground, #9ca3af)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
  }),
  badgeCount: {
    fontSize: 10.5,
    padding: '1px 6px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  grid4: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 12,
    marginBottom: 18,
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
    gap: 14,
    marginBottom: 18,
  },
  card: {
    padding: '14px 16px',
    borderRadius: 10,
    border: '1px solid var(--border, rgba(255,255,255,0.08))',
    background: 'var(--card, rgba(255,255,255,0.025))',
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--muted-foreground, #9ca3af)',
  },
  cardBig: {
    fontSize: 24,
    fontWeight: 700,
    marginTop: 5,
    fontVariantNumeric: 'tabular-nums',
  },
  cardSub: {
    fontSize: 11.5,
    color: 'var(--muted-foreground, #9ca3af)',
    marginTop: 4,
    lineHeight: 1.4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  input: {
    padding: '7px 11px',
    borderRadius: 7,
    border: '1px solid var(--border, rgba(255,255,255,0.14))',
    background: 'rgba(0,0,0,0.22)',
    color: 'var(--foreground, #e5e7eb)',
    fontSize: 12.5,
    outline: 'none',
  },
  textarea: {
    padding: '8px 11px',
    borderRadius: 7,
    border: '1px solid var(--border, rgba(255,255,255,0.14))',
    background: 'rgba(0,0,0,0.22)',
    color: 'var(--foreground, #e5e7eb)',
    fontSize: 12.5,
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
    resize: 'vertical',
  },
  btn: (variant = 'default') => {
    const colors = {
      primary: { bg: 'rgba(59, 130, 246, 0.2)', border: 'rgba(59, 130, 246, 0.5)', fg: '#93c5fd' },
      success: { bg: 'rgba(16, 185, 129, 0.16)', border: 'rgba(16, 185, 129, 0.45)', fg: '#6ee7b7' },
      danger: { bg: 'rgba(239, 68, 68, 0.16)', border: 'rgba(239, 68, 68, 0.45)', fg: '#fca5a5' },
      warn: { bg: 'rgba(245, 158, 11, 0.16)', border: 'rgba(245, 158, 11, 0.45)', fg: '#fcd34d' },
      default: { bg: 'rgba(255,255,255,0.05)', border: 'var(--border, rgba(255,255,255,0.12))', fg: 'var(--foreground, #e5e7eb)' },
    };
    const c = colors[variant] || colors.default;
    return {
      padding: '6px 11px',
      borderRadius: 7,
      fontSize: 12,
      fontWeight: 500,
      cursor: 'pointer',
      border: '1px solid ' + c.border,
      background: c.bg,
      color: c.fg,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
    };
  },
  pill: (color = '#60a5fa') => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 7px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    background: color + '22',
    color: color,
    border: '1px solid ' + color + '44',
  }),
  mono: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: 11.5,
  },
  barOuter: {
    height: 7,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    width: '100%',
  },
};

const TIER_COLORS = {
  trusted: '#10b981',
  established: '#3b82f6',
  tentative: '#f59e0b',
  proven: '#10b981',
  candidate: '#a855f7',
  deprecated: '#ef4444',
};

function MemoryStudioPage({ api }) {

  const [tab, setTab] = useState('overview');
  const [snap, setSnap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [toast, setToast] = useState(null);

  // Unified search / simulator state
  const [uniQuery, setUniQuery] = useState('configure hermes plugin and limbic sqlite memory');
  const [uniBusy, setUniBusy] = useState(false);
  const [uniResult, setUniResult] = useState(null);

  // Builtin state
  const [bTarget, setBTarget] = useState('memory');
  const [bNewText, setBNewText] = useState('');
  const [bFilter, setBFilter] = useState('');
  const [bEditIdx, setBEditIdx] = useState(null);
  const [bEditText, setBEditText] = useState('');

  // Limbic state
  const [lFilter, setLFilter] = useState('');
  const [lTier, setLTier] = useState('all');
  const [lEntity, setLEntity] = useState('');
  const [lSort, setLSort] = useState('composite');
  const [lNewFact, setLNewFact] = useState('');
  const [lNewTrust, setLNewTrust] = useState('0.70');
  const [lRecallQuery, setLRecallQuery] = useState('');
  const [lRecallRes, setLRecallRes] = useState(null);
  const [lRecallBusy, setLRecallBusy] = useState(false);

  // CM state
  const [cmKind, setCmKind] = useState('all');
  const [cmMat, setCmMat] = useState('all');
  const [cmCat, setCmCat] = useState('all');
  const [cmFilter, setCmFilter] = useState('');
  const [cmNewContent, setCmNewContent] = useState('');
  const [cmNewCat, setCmNewCat] = useState('workflow');
  const [cmNewKind, setCmNewKind] = useState('rule');
  const [cmNewMat, setCmNewMat] = useState('established');
  const [cmNewTags, setCmNewTags] = useState('hermes, workflow');
  const [cmNewPinned, setCmNewPinned] = useState(false);
  const [stName, setStName] = useState('');
  const [stDesc, setStDesc] = useState('');
  const [stRulesRaw, setStRulesRaw] = useState('');
  const [cmTaskQuery, setCmTaskQuery] = useState('');
  const [cmTaskRes, setCmTaskRes] = useState(null);
  const [cmTaskBusy, setCmTaskBusy] = useState(false);

  // CASS state
  const [cassQuery, setCassQuery] = useState('limbic');
  const [cassAgent, setCassAgent] = useState('all');
  const [cassWs, setCassWs] = useState('');
  const [cassDays, setCassDays] = useState('0');
  const [cassHits, setCassHits] = useState(null);
  const [cassBusy, setCassBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const callApi = useCallback(async (path, opts = {}) => {
    let parsedBody = opts.body;
    if (typeof parsedBody === 'string') {
      try { parsedBody = JSON.parse(parsedBody); } catch (_e) {}
    }
    const reqInit = {
      method: opts.method || (parsedBody !== undefined ? 'POST' : 'GET'),
      body: parsedBody,
      headers: opts.headers,
    };
    if (api && typeof api.rest === 'function') {
      try {
        return await api.rest(path, reqInit);
      } catch (err) {
        if (typeof window !== 'undefined' && window.hermesDesktop && typeof window.hermesDesktop.pluginRest === 'function') {
          const fb = await window.hermesDesktop.pluginRest('hermes-memory-ui', path, reqInit);
          if (fb && fb.ok) return fb.data;
        }
        throw err;
      }
    }
    const url = API_BASE + path;
    const r = await fetch(url, opts);
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(txt || ('HTTP ' + r.status));
    }
    return r.json();
  }, [api]);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await callApi('/snapshot');
      setSnap(data);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [callApi]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  const runUnifiedSearch = async (ev) => {
    if (ev) ev.preventDefault();
    if (!uniQuery.trim()) return;
    setUniBusy(true);
    try {
      const qEnc = encodeURIComponent(uniQuery.trim());
      const [cassR, cmR, limR] = await Promise.all([
        callApi('/cass/search?q=' + qEnc + '&limit=8'),
        callApi('/cm/context?task=' + qEnc),
        callApi('/limbic/recall?q=' + qEnc + '&limit=6'),
      ]);
      setUniResult({ cass: cassR, cm: cmR, limbic: limR });
    } catch (e) {
      notify('Search error: ' + e.message);
    } finally {
      setUniBusy(false);
    }
  };

  // Builtin actions
  const handleBuiltinAction = async (target, action, content = '', index = null) => {
    try {
      const updated = await callApi('/builtin/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, action, content, index }),
      });
      setSnap((prev) => prev ? { ...prev, builtin: updated } : prev);
      setBEditIdx(null);
      if (action === 'add') setBNewText('');
      notify('Updated ' + (target === 'user' ? 'USER.md' : 'MEMORY.md'));
    } catch (e) {
      notify('Error: ' + e.message);
    }
  };

  // Limbic actions
  const handleLimbicRemember = async (ev) => {
    if (ev) ev.preventDefault();
    if (!lNewFact.trim()) return;
    try {
      const updated = await callApi('/limbic/remember', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: lNewFact.trim(), trust_score: parseFloat(lNewTrust) || 0.70 }),
      });
      setSnap((prev) => prev ? { ...prev, limbic: updated } : prev);
      setLNewFact('');
      notify('Stored fact in Limbic with embedding & entity links');
    } catch (e) {
      notify('Error: ' + e.message);
    }
  };

  const handleLimbicFeedback = async (factId, signal) => {
    try {
      const updated = await callApi('/limbic/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fact_id: factId, signal }),
      });
      setSnap((prev) => prev ? { ...prev, limbic: updated } : prev);
      notify('Applied Limbic signal: ' + signal);
    } catch (e) {
      notify('Error: ' + e.message);
    }
  };

  const handleLimbicForget = async (factId) => {
    try {
      const updated = await callApi('/limbic/forget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fact_id: factId }),
      });
      setSnap((prev) => prev ? { ...prev, limbic: updated } : prev);
      notify('Removed fact #' + factId);
    } catch (e) {
      notify('Error: ' + e.message);
    }
  };

  const handleLimbicRecall = async (ev) => {
    if (ev) ev.preventDefault();
    if (!lRecallQuery.trim()) return;
    setLRecallBusy(true);
    try {
      const res = await callApi('/limbic/recall?q=' + encodeURIComponent(lRecallQuery.trim()) + '&limit=8');
      setLRecallRes(res);
    } catch (e) {
      notify('Error: ' + e.message);
    } finally {
      setLRecallBusy(false);
    }
  };

  // CM actions
  const handleCmAdd = async (ev) => {
    if (ev) ev.preventDefault();
    if (!cmNewContent.trim()) return;
    try {
      const updated = await callApi('/cm/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: cmNewContent.trim(),
          category: cmNewCat,
          kind: cmNewKind,
          maturity: cmNewMat,
          tags: cmNewTags,
          pinned: cmNewPinned,
        }),
      });
      setSnap((prev) => prev ? { ...prev, cm: updated } : prev);
      setCmNewContent('');
      notify('Added rule to CM playbook');
    } catch (e) {
      notify('Error: ' + e.message);
    }
  };

  const handleCmMark = async (bulletId, helpful) => {
    try {
      const updated = await callApi('/cm/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bullet_id: bulletId, helpful }),
      });
      setSnap((prev) => prev ? { ...prev, cm: updated } : prev);
      notify('Marked ' + bulletId + (helpful ? ' +Helpful' : ' -Harmful'));
    } catch (e) {
      notify('Error: ' + e.message);
    }
  };

  const handleCmRemove = async (bulletId) => {
    try {
      const updated = await callApi('/cm/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bullet_id: bulletId }),
      });
      setSnap((prev) => prev ? { ...prev, cm: updated } : prev);
      notify('Removed rule ' + bulletId);
    } catch (e) {
      notify('Error: ' + e.message);
    }
  };

  const handleApplyStarter = async (starterName) => {
    try {
      notify('Applying starter ' + starterName + '...');
      const updated = await callApi('/cm/starter/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starter_name: starterName }),
      });
      setSnap((prev) => prev ? { ...prev, cm: updated } : prev);
      notify('Applied starter playbook: ' + starterName);
    } catch (e) {
      notify('Error: ' + e.message);
    }
  };

  const handleCreateStarter = async (ev) => {
    if (ev) ev.preventDefault();
    if (!stName.trim() || !stRulesRaw.trim()) return;
    const lines = stRulesRaw.split("\n").map((l) => l.trim()).filter(Boolean);
    const rules = lines.map((line) => {
      const pipeIdx = line.indexOf('|');
      if (pipeIdx > 0 && pipeIdx < 24) {
        return { category: line.slice(0, pipeIdx).trim(), content: line.slice(pipeIdx + 1).trim(), maturity: 'established' };
      }
      return { category: 'general', content: line, maturity: 'established' };
    });
    try {
      const updated = await callApi('/cm/starter/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: stName.trim(), description: stDesc.trim(), rules, apply_now: true }),
      });
      setSnap((prev) => prev ? { ...prev, cm: updated } : prev);
      setStName('');
      setStDesc('');
      setStRulesRaw('');
      notify('Created and applied custom starter: ' + stName.trim());
    } catch (e) {
      notify('Error: ' + e.message);
    }
  };

  const handleCmContextTest = async (ev) => {
    if (ev) ev.preventDefault();
    if (!cmTaskQuery.trim()) return;
    setCmTaskBusy(true);
    try {
      const res = await callApi('/cm/context?task=' + encodeURIComponent(cmTaskQuery.trim()));
      setCmTaskRes(res);
    } catch (e) {
      notify('Error: ' + e.message);
    } finally {
      setCmTaskBusy(false);
    }
  };

  // CASS actions
  const handleCassSearch = async (ev) => {
    if (ev) ev.preventDefault();
    if (!cassQuery.trim()) return;
    setCassBusy(true);
    try {
      const qs = '?q=' + encodeURIComponent(cassQuery.trim()) +
        '&agent=' + encodeURIComponent(cassAgent) +
        '&workspace=' + encodeURIComponent(cassWs.trim()) +
        '&days=' + encodeURIComponent(cassDays) + '&limit=30';
      const res = await callApi('/cass/search' + qs);
      setCassHits(res);
    } catch (e) {
      notify('CASS search error: ' + e.message);
    } finally {
      setCassBusy(false);
    }
  };

  const handleCassSync = async () => {
    setSyncBusy(true);
    try {
      const res = await callApi('/cass/sync', { method: 'POST' });
      if (res.cass) {
        setSnap((prev) => prev ? { ...prev, cass: res.cass } : prev);
      }
      notify('Synced Hermes sessions into CASS (' + (res.execution_ms || 0) + ' ms)');
    } catch (e) {
      notify('Sync error: ' + e.message);
    } finally {
      setSyncBusy(false);
    }
  };

  if (loading && !snap) {
    return h('div', { style: S.page }, h('p', { style: S.subtitle }, 'Loading Memory Studio snapshot...'));
  }
  if (err && !snap) {
    return h('div', { style: S.page },
      h('div', { style: { ...S.card, borderColor: '#ef4444' } },
        h('div', { style: { fontWeight: 600, color: '#fca5a5' } }, 'Failed to load Memory Studio API'),
        h('div', { style: { ...S.mono, marginTop: 6 } }, err),
        h('button', { style: { ...S.btn('primary'), marginTop: 10 }, onClick: loadSnapshot }, 'Retry')
      )
    );
  }

  const builtin = (snap && snap.builtin) || { memory: { entries: [] }, user: { entries: [] } };
  const limbic = (snap && snap.limbic) || { facts: [], entities: [], tiers: {}, scoring_model: {} };
  const cm = (snap && snap.cm) || { bullets: [], starters: [], by_maturity: {}, by_category: {}, scoring_model: {} };
  const cass = (snap && snap.cass) || { by_agent: [], top_workspaces: [], hermes_bridge: {} };

  return h('div', { style: S.page, className: 'ms-root' },
    // Header
    h('div', { style: S.headerRow },
      h('div', null,
        h('h1', { style: S.title },
          h(BrainIcon, { size: 22 }),
          'Memory Studio',
          h('span', { style: S.pill('#10b981') }, '4-Tier Stack Live')
        ),
        h('p', { style: S.subtitle },
          'Unified observability, scoring & control across Hermes Built-in Memory, Limbic (FSRS-4.5 + Trust + Entity Graph), CM Playbooks, and CASS Cross-Agent Search.'
        )
      ),
      h('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
        toast ? h('span', { style: S.pill('#60a5fa') }, toast) : null,
        h('button', { style: S.btn('default'), onClick: loadSnapshot }, 'Refresh Snapshot')
      )
    ),

    // Top Summary Cards
    h('div', { style: S.grid4 },
      h('div', { style: { ...S.card, cursor: 'pointer' }, onClick: () => setTab('builtin') },
        h('div', { style: S.cardLabel }, '1. Built-in Memory (MEMORY + USER)'),
        h('div', { style: S.cardBig }, builtin.total_entries + ' entries'),
        h('div', { style: { ...S.barOuter, marginTop: 8 } },
          h('div', { style: { height: '100%', width: Math.min(100, builtin.total_percent || 0) + '%', background: '#3b82f6' } })
        ),
        h('div', { style: S.cardSub }, builtin.total_chars + ' / ' + builtin.total_limit + ' chars (' + builtin.total_percent + '%)')
      ),
      h('div', { style: { ...S.card, cursor: 'pointer' }, onClick: () => setTab('limbic') },
        h('div', { style: S.cardLabel }, '2. Limbic (FSRS-4.5 + Entities)'),
        h('div', { style: S.cardBig }, limbic.total_facts + ' facts · ' + limbic.total_entities + ' entities'),
        h('div', { style: S.cardSub },
          'Avg Trust: ' + limbic.avg_trust + ' · Avg Retrievability R(t,S): ' + Math.round((limbic.avg_retrievability || 0) * 100) + '% · Avg Stability: ' + limbic.avg_stability_days + 'd'
        )
      ),
      h('div', { style: { ...S.card, cursor: 'pointer' }, onClick: () => setTab('cm') },
        h('div', { style: S.cardLabel }, '3. CM Playbooks & Starters'),
        h('div', { style: S.cardBig }, cm.total_bullets + ' rules (' + cm.anti_patterns_count + ' pitfalls)'),
        h('div', { style: S.cardSub },
          'Proven: ' + (cm.by_maturity.proven || 0) + ' · Established: ' + (cm.by_maturity.established || 0) + ' · Avg Score: ' + cm.avg_effective_score + ' · Starters: ' + (cm.starters || []).length
        )
      ),
      h('div', { style: { ...S.card, cursor: 'pointer' }, onClick: () => setTab('cass') },
        h('div', { style: S.cardLabel }, '4. CASS Cross-Agent Search'),
        h('div', { style: S.cardBig }, (cass.conversations || 0).toLocaleString() + ' sessions'),
        h('div', { style: S.cardSub },
          (cass.messages || 0).toLocaleString() + ' messages indexed · Hermes Bridged: ' + ((cass.hermes_bridge && cass.hermes_bridge.synced_sessions) || 0) + ' sessions'
        )
      )
    ),

    // Navigation Tabs
    h('div', { style: S.navBar },
      [
        { id: 'overview', label: 'Unified Search & Overview', count: 'All 4' },
        { id: 'builtin', label: 'Built-in Memory', count: builtin.total_entries },
        { id: 'limbic', label: 'Limbic (FSRS + Entities)', count: limbic.total_facts },
        { id: 'cm', label: 'CM Playbooks & Starters', count: cm.total_bullets },
        { id: 'cass', label: 'CASS Session Search', count: cass.conversations },
      ].map((t) =>
        h('button', {
          key: t.id,
          style: S.tabBtn(tab === t.id),
          onClick: () => setTab(t.id),
        },
          t.label,
          h('span', { style: S.badgeCount }, t.count)
        )
      )
    ),

    // TAB 1: OVERVIEW & UNIFIED MULTI-TIER SEARCH
    tab === 'overview' && h('div', null,
      h('div', { style: { ...S.card, marginBottom: 18 } },
        h('div', { style: S.sectionTitle },
          h('span', null, 'Unified Multi-Tier Memory Search & Context Simulator (CASS + CM + Limbic)'),
          h('span', { style: S.pill('#a855f7') }, 'Queries all 3 engines in parallel')
        ),
        h('form', { onSubmit: runUnifiedSearch, style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
          h('input', {
            style: { ...S.input, flex: 1, minWidth: 280 },
            value: uniQuery,
            onChange: (e) => setUniQuery(e.target.value),
            placeholder: 'Enter a task or query to test CASS episodic search, CM procedural rules, and Limbic FSRS recall simultaneously...',
          }),
          h('button', { type: 'submit', style: S.btn('primary'), disabled: uniBusy },
            uniBusy ? 'Querying CASS + CM + Limbic...' : 'Run Multi-Tier Recall'
          )
        ),
        uniResult && h('div', { style: { marginTop: 16 } },
          h('div', { style: S.grid2 },
            // CM Procedural hits
            h('div', { style: S.card },
              h('div', { style: S.sectionTitle },
                h('span', null, 'CM Procedural Rules & Anti-Patterns (' + (uniResult.cm.relevantBullets || []).length + ' rules, ' + (uniResult.cm.antiPatterns || []).length + ' pitfalls)'),
                h('span', { style: S.mono }, (uniResult.cm.execution_ms || 0) + ' ms')
              ),
              (uniResult.cm.relevantBullets || []).map((b) =>
                h('div', { key: b.id, style: { padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' } },
                  h('div', { style: { display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 } },
                    h('span', { style: S.pill(TIER_COLORS[b.maturity] || '#3b82f6') }, b.maturity),
                    h('span', { style: S.pill('#60a5fa') }, b.category),
                    h('span', { style: S.mono }, 'rel=' + Number(b.relevanceScore || 0).toFixed(2) + ' eff=' + Number(b.effectiveScore || 0).toFixed(2))
                  ),
                  h('div', { style: { fontSize: 12.5 } }, b.content)
                )
              ),
              (uniResult.cm.antiPatterns || []).length > 0 && h('div', { style: { marginTop: 10 } },
                h('div', { style: { fontSize: 11.5, fontWeight: 600, color: '#fca5a5', marginBottom: 4 } }, 'Matched Anti-Patterns / Pitfalls:'),
                (uniResult.cm.antiPatterns || []).map((ap) =>
                  h('div', { key: ap.id, style: { fontSize: 12, color: '#fca5a5', padding: '4px 0' } }, '⚠ ' + ap.content)
                )
              )
            ),
            // Limbic FSRS hits
            h('div', { style: S.card },
              h('div', { style: S.sectionTitle },
                h('span', null, 'Limbic Hybrid + FSRS-4.5 Ranked Facts (' + (uniResult.limbic.results || []).length + ')'),
                h('span', { style: S.mono }, (uniResult.limbic.execution_ms || 0) + ' ms')
              ),
              (uniResult.limbic.results || []).map((f) =>
                h('div', { key: f.fact_id, style: { padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' } },
                  h('div', { style: { display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' } },
                    h('span', { style: S.pill('#10b981') }, 'Rank ' + f.final_rank_score),
                    h('span', { style: S.mono }, 'Sim=' + f.vector_similarity + ' · R=' + f.retrievability_pct + '% · Trust=' + f.trust_score),
                    (f.entities || []).map((en) => h('span', { key: en.entity_id, style: S.pill('#a855f7') }, en.name))
                  ),
                  h('div', { style: { fontSize: 12.5 } }, f.content)
                )
              )
            )
          ),
          // CASS Episodic hits
          h('div', { style: S.card },
            h('div', { style: S.sectionTitle },
              h('span', null, 'CASS Cross-Agent Session Hits (' + (uniResult.cass.total_matches || 0) + ' total matches)'),
              h('span', { style: S.mono }, (uniResult.cass.execution_ms || 0) + ' ms')
            ),
            (uniResult.cass.hits || []).map((hit, idx) =>
              h('div', { key: idx, style: { padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' } },
                h('div', { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 3 } },
                  h('span', { style: S.pill(hit.is_hermes ? '#10b981' : '#3b82f6') }, hit.agent),
                  h('span', { style: { fontWeight: 600, fontSize: 12.5 } }, hit.title),
                  h('span', { style: S.mono }, 'score=' + hit.score),
                  h('span', { style: { ...S.mono, color: 'var(--muted-foreground)' } }, hit.workspace)
                ),
                h('div', { style: { fontSize: 12, color: 'var(--muted-foreground)' } }, hit.snippet)
              )
            )
          )
        )
      ),

      // Scoring & Ranking Architecture Reference Side-by-Side
      h('div', { style: S.grid2 },
        h('div', { style: S.card },
          h('div', { style: S.sectionTitle },
            h('span', null, 'Limbic Ranking & FSRS-4.5 Forgetting Curve'),
            h('span', { style: S.pill('#10b981') }, 'limbic.db + sqlite_vec')
          ),
          h('div', { style: { ...S.mono, lineHeight: 1.7, color: 'var(--muted-foreground)' } },
            h('div', null, '• Retrievability: ' + (limbic.scoring_model && limbic.scoring_model.retrievability_formula)),
            h('div', null, '• Stability (days): ' + (limbic.scoring_model && limbic.scoring_model.stability_formula)),
            h('div', null, '• Hybrid Ranker:  ' + (limbic.scoring_model && limbic.scoring_model.rank_formula)),
            h('div', null, '• Trust Tiers:    Trusted (>=0.65), Established (0.50-0.64), Tentative (<0.50); +0.05 helpful / -0.10 unhelpful')
          )
        ),
        h('div', { style: S.card },
          h('div', { style: S.sectionTitle },
            h('span', null, 'CM Playbook Scoring, Decay & Promotion Pipeline'),
            h('span', { style: S.pill('#3b82f6') }, '~/.cass-memory/playbook.yaml')
          ),
          h('div', { style: { ...S.mono, lineHeight: 1.7, color: 'var(--muted-foreground)' } },
            h('div', null, '• Half-Life Decay: ' + (cm.scoring_model && cm.scoring_model.decay_formula)),
            h('div', null, '• 4x Penalty Net:  ' + (cm.scoring_model && cm.scoring_model.net_formula)),
            h('div', null, '• Effective Score: ' + (cm.scoring_model && cm.scoring_model.effective_formula)),
            h('div', null, '• Promotion Path:  ' + (cm.scoring_model && cm.scoring_model.promotion_thresholds))
          )
        )
      )
    ),

    // TAB 2: BUILT-IN MEMORY (MEMORY.md & USER.md)
    tab === 'builtin' && h('div', null,
      h('div', { style: S.grid2 },
        ['memory', 'user'].map((key) => {
          const info = builtin[key] || { entries: [], chars: 0, char_limit: 2000, percent: 0 };
          const label = key === 'memory' ? 'MEMORY.md (Environment, Architecture & Standing Facts)' : 'USER.md (User Profile, Role & Preferences)';
          return h('div', { key, style: S.card },
            h('div', { style: S.sectionTitle },
              h('span', null, label),
              h('span', { style: S.mono }, info.chars + ' / ' + info.char_limit + ' chars (' + info.percent + '%)')
            ),
            h('div', { style: { ...S.barOuter, marginBottom: 8 } },
              h('div', { style: { height: '100%', width: Math.min(100, info.percent || 0) + '%', background: key === 'memory' ? '#3b82f6' : '#10b981' } })
            ),
            h('div', { style: { fontSize: 11.5, color: 'var(--muted-foreground)' } }, info.entry_count + ' entries · Path: ' + info.path)
          );
        })
      ),

      h('div', { style: { ...S.card, marginBottom: 16 } },
        h('div', { style: S.sectionTitle }, 'Add Entry to Built-in Memory'),
        h('div', { style: { display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' } },
          h('select', { style: S.input, value: bTarget, onChange: (e) => setBTarget(e.target.value) },
            h('option', { value: 'memory' }, 'Target: MEMORY.md'),
            h('option', { value: 'user' }, 'Target: USER.md')
          ),
          h('input', {
            style: { ...S.input, flex: 1, minWidth: 260 },
            value: bNewText,
            onChange: (e) => setBNewText(e.target.value),
            placeholder: 'Declarative fact to persist across all Hermes sessions...',
          }),
          h('button', { style: S.btn('primary'), onClick: () => handleBuiltinAction(bTarget, 'add', bNewText) }, '+ Add Entry')
        )
      ),

      h('div', { style: { marginBottom: 12 } },
        h('input', {
          style: { ...S.input, width: 320 },
          value: bFilter,
          onChange: (e) => setBFilter(e.target.value),
          placeholder: 'Filter MEMORY.md and USER.md entries...',
        })
      ),

      h('div', { style: S.grid2 },
        ['memory', 'user'].map((key) => {
          const info = builtin[key] || { entries: [] };
          const filtered = (info.entries || []).filter((en) => !bFilter.trim() || en.content.toLowerCase().includes(bFilter.toLowerCase()));
          return h('div', { key, style: S.card },
            h('div', { style: S.sectionTitle },
              h('span', null, (key === 'memory' ? 'MEMORY.md' : 'USER.md') + ' (' + filtered.length + ')')
            ),
            filtered.map((en) => {
              const editKey = key + ':' + en.index;
              const isEditing = bEditIdx === editKey;
              return h('div', { key: en.index, style: { padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' } },
                h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 } },
                  h('span', { style: S.mono }, '#' + (en.index + 1) + ' · ' + en.chars + ' chars'),
                  h('div', { style: { display: 'flex', gap: 6 } },
                    isEditing
                      ? h('button', { style: S.btn('success'), onClick: () => handleBuiltinAction(key, 'edit', bEditText, en.index) }, 'Save')
                      : h('button', { style: S.btn('default'), onClick: () => { setBEditIdx(editKey); setBEditText(en.content); } }, 'Edit'),
                    isEditing
                      ? h('button', { style: S.btn('default'), onClick: () => setBEditIdx(null) }, 'Cancel')
                      : h('button', { style: S.btn('danger'), onClick: () => handleBuiltinAction(key, 'remove', '', en.index) }, 'Remove')
                  )
                ),
                isEditing
                  ? h('textarea', { rows: 3, style: S.textarea, value: bEditText, onChange: (e) => setBEditText(e.target.value) })
                  : h('div', { style: { fontSize: 12.5, lineHeight: 1.5, whiteSpace: 'pre-wrap' } }, en.content)
              );
            })
          );
        })
      )
    ),

    // TAB 3: LIMBIC MEMORY (FSRS-4.5 + TRUST + ENTITY GRAPH + IDENTITIES)
    tab === 'limbic' && h('div', null,
      // Limbic controls & Add Fact
      h('div', { style: S.grid2 },
        h('div', { style: S.card },
          h('div', { style: S.sectionTitle },
            h('span', null, 'Remember New Fact in Limbic (Vector + Entity Graph)'),
            h('button', { style: S.btn('warn'), onClick: () => handleLimbicFeedback(0, 'decay_pass') }, 'Run FSRS Decay Pass')
          ),
          h('form', { onSubmit: handleLimbicRemember, style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            h('textarea', {
              rows: 2,
              style: S.textarea,
              value: lNewFact,
              onChange: (e) => setLNewFact(e.target.value),
              placeholder: 'Enter a durable fact (Limbic will embed it with FastEmbed and auto-link named entities)...',
            }),
            h('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
              h('label', { style: { fontSize: 12, color: 'var(--muted-foreground)' } }, 'Initial Trust:'),
              h('input', { style: { ...S.input, width: 80 }, value: lNewTrust, onChange: (e) => setLNewTrust(e.target.value) }),
              h('button', { type: 'submit', style: S.btn('primary') }, '+ Remember Fact')
            )
          )
        ),
        h('div', { style: S.card },
          h('div', { style: S.sectionTitle }, 'Limbic Hybrid Vector + FSRS-4.5 Recall Sandbox'),
          h('form', { onSubmit: handleLimbicRecall, style: { display: 'flex', gap: 8, marginBottom: 8 } },
            h('input', {
              style: { ...S.input, flex: 1 },
              value: lRecallQuery,
              onChange: (e) => setLRecallQuery(e.target.value),
              placeholder: 'Test semantic + FSRS ranker (e.g., Scribetech FastAPI stack)...',
            }),
            h('button', { type: 'submit', style: S.btn('primary'), disabled: lRecallBusy }, lRecallBusy ? '...' : 'Test Recall')
          ),
          lRecallRes && h('div', { style: { maxHeight: 165, overflowY: 'auto' } },
            (lRecallRes.results || []).map((r) =>
              h('div', { key: r.fact_id, style: { padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 12 } },
                h('span', { style: S.pill('#10b981') }, 'Rank ' + r.final_rank_score),
                ' ',
                h('span', { style: S.mono }, '[Sim=' + r.vector_similarity + ' R=' + r.retrievability_pct + '% T=' + r.trust_score + '] '),
                r.content
              )
            )
          )
        )
      ),

      // Entity Graph Explorer
      h('div', { style: { ...S.card, marginBottom: 16 } },
        h('div', { style: S.sectionTitle },
          h('span', null, 'Entity Graph Explorer (' + (limbic.entities || []).length + ' entities across ' + (limbic.total_mentions || 0) + ' mentions — click to filter facts)'),
          lEntity && h('button', { style: S.btn('default'), onClick: () => setLEntity('') }, 'Clear Entity Filter: ' + lEntity)
        ),
        h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 120, overflowY: 'auto' } },
          (limbic.entities || []).map((en) => {
            const active = lEntity === en.name;
            return h('button', {
              key: en.entity_id,
              style: {
                ...S.pill(active ? '#10b981' : '#60a5fa'),
                cursor: 'pointer',
                padding: '4px 9px',
              },
              onClick: () => setLEntity(active ? '' : en.name),
            }, en.name + ' (' + en.type + ' · ' + en.mention_count + ')');
          })
        )
      ),

      // Fact Filters & Sorting
      h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' } },
        h('input', {
          style: { ...S.input, width: 260 },
          value: lFilter,
          onChange: (e) => setLFilter(e.target.value),
          placeholder: 'Search fact content...',
        }),
        h('select', { style: S.input, value: lTier, onChange: (e) => setLTier(e.target.value) },
          h('option', { value: 'all' }, 'All Trust Tiers (' + limbic.total_facts + ')'),
          h('option', { value: 'trusted' }, 'Trusted >= 0.65 (' + (limbic.tiers.trusted || 0) + ')'),
          h('option', { value: 'established' }, 'Established 0.50-0.64 (' + (limbic.tiers.established || 0) + ')'),
          h('option', { value: 'tentative' }, 'Tentative < 0.50 (' + (limbic.tiers.tentative || 0) + ')')
        ),
        h('select', { style: S.input, value: lSort, onChange: (e) => setLSort(e.target.value) },
          h('option', { value: 'composite' }, 'Sort: Composite Rank (0.75*R + 0.25*Trust)'),
          h('option', { value: 'trust' }, 'Sort: Trust Score DESC'),
          h('option', { value: 'retrievability' }, 'Sort: Retrievability R(t,S) DESC'),
          h('option', { value: 'stability' }, 'Sort: Stability S (days) DESC'),
          h('option', { value: 'retrievals' }, 'Sort: Retrieval Count DESC')
        )
      ),

      // Facts List
      h('div', { style: S.card },
        (() => {
          let list = (limbic.facts || []).slice();
          if (lTier !== 'all') list = list.filter((f) => f.trust_tier === lTier);
          if (lEntity) list = list.filter((f) => (f.entities || []).some((e) => e.name === lEntity));
          if (lFilter.trim()) {
            const q = lFilter.toLowerCase();
            list = list.filter((f) => f.content.toLowerCase().includes(q));
          }
          list.sort((a, b) => {
            if (lSort === 'trust') return b.trust_score - a.trust_score;
            if (lSort === 'retrievability') return b.retrievability - a.retrievability;
            if (lSort === 'stability') return b.stability_days - a.stability_days;
            if (lSort === 'retrievals') return b.retrieval_count - a.retrieval_count;
            return b.composite_score - a.composite_score;
          });
          return list.map((f) =>
            h('div', { key: f.fact_id, style: { padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' } },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 } },
                h('div', { style: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' } },
                  h('span', { style: S.mono }, '#' + f.fact_id),
                  h('span', { style: S.pill(TIER_COLORS[f.trust_tier] || '#3b82f6') }, f.trust_tier.toUpperCase() + ' · Trust ' + f.trust_score),
                  h('span', { style: S.pill('#10b981') }, 'Composite ' + f.composite_score),
                  h('span', { style: S.mono }, 'R(t,S)=' + f.retrievability_pct + '% · S=' + f.stability_days + 'd · Elapsed=' + f.elapsed_days + 'd · Retrievals=' + f.retrieval_count),
                  f.matured && h('span', { style: S.pill('#a855f7') }, 'Matured')
                ),
                h('div', { style: { display: 'flex', gap: 6 } },
                  h('button', { style: S.btn('success'), onClick: () => handleLimbicFeedback(f.fact_id, 'helpful') }, '+0.05 Helpful'),
                  h('button', { style: S.btn('warn'), onClick: () => handleLimbicFeedback(f.fact_id, 'unhelpful') }, '-0.10 Unhelpful'),
                  h('button', { style: S.btn('default'), onClick: () => handleLimbicFeedback(f.fact_id, 'reinforce') }, 'Reinforce R'),
                  h('button', { style: S.btn('danger'), onClick: () => handleLimbicForget(f.fact_id) }, 'Forget')
                )
              ),
              h('div', { style: { fontSize: 13, lineHeight: 1.5, marginBottom: 6 } }, f.content),
              (f.entities || []).length > 0 && h('div', { style: { display: 'flex', gap: 5, flexWrap: 'wrap' } },
                (f.entities || []).map((en) =>
                  h('span', {
                    key: en.entity_id,
                    style: { ...S.pill('#60a5fa'), cursor: 'pointer' },
                    onClick: () => setLEntity(en.name),
                  }, en.name + ' (' + en.type + ')')
                )
              )
            )
          );
        })()
      )
    ),

    // TAB 4: CM PLAYBOOKS & STARTERS
    tab === 'cm' && h('div', null,
      h('div', { style: S.grid2 },
        // Add Rule / Anti-Pattern Form
        h('div', { style: S.card },
          h('div', { style: S.sectionTitle }, 'Add Playbook Rule or Pitfall (Anti-Pattern)'),
          h('form', { onSubmit: handleCmAdd, style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            h('textarea', {
              rows: 2,
              style: S.textarea,
              value: cmNewContent,
              onChange: (e) => setCmNewContent(e.target.value),
              placeholder: 'Write a concrete procedural rule or PITFALL anti-pattern for coding agents...',
            }),
            h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' } },
              h('select', { style: S.input, value: cmNewKind, onChange: (e) => setCmNewKind(e.target.value) },
                h('option', { value: 'rule' }, 'Kind: Playbook Rule'),
                h('option', { value: 'anti-pattern' }, 'Kind: Pitfall / Anti-Pattern')
              ),
              h('select', { style: S.input, value: cmNewCat, onChange: (e) => setCmNewCat(e.target.value) },
                ['workflow', 'architecture', 'debugging', 'testing', 'configuration', 'performance', 'security', 'database', 'api', 'general'].map((c) =>
                  h('option', { key: c, value: c }, 'Category: ' + c)
                )
              ),
              h('select', { style: S.input, value: cmNewMat, onChange: (e) => setCmNewMat(e.target.value) },
                h('option', { value: 'established' }, 'Maturity: Established (1.0x)'),
                h('option', { value: 'proven' }, 'Maturity: Proven (1.25x)'),
                h('option', { value: 'candidate' }, 'Maturity: Candidate (0.75x)')
              )
            ),
            h('div', { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } },
              h('input', {
                style: { ...S.input, flex: 1 },
                value: cmNewTags,
                onChange: (e) => setCmNewTags(e.target.value),
                placeholder: 'Tags (comma-separated)...',
              }),
              h('label', { style: { fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' } },
                h('input', { type: 'checkbox', checked: cmNewPinned, onChange: (e) => setCmNewPinned(e.target.checked) }),
                'Pin Rule'
              ),
              h('button', { type: 'submit', style: S.btn('primary') }, '+ Add to Playbook')
            )
          )
        ),

        // CM Context Simulator
        h('div', { style: S.card },
          h('div', { style: S.sectionTitle }, 'Test `cm context <task>` Retrieval & Anti-Pattern Guard'),
          h('form', { onSubmit: handleCmContextTest, style: { display: 'flex', gap: 8, marginBottom: 8 } },
            h('input', {
              style: { ...S.input, flex: 1 },
              value: cmTaskQuery,
              onChange: (e) => setCmTaskQuery(e.target.value),
              placeholder: 'Describe a task (e.g. edit hermes config and sync cass sessions)...',
            }),
            h('button', { type: 'submit', style: S.btn('primary'), disabled: cmTaskBusy }, cmTaskBusy ? '...' : 'Run cm context')
          ),
          cmTaskRes && h('div', { style: { maxHeight: 165, overflowY: 'auto', fontSize: 12 } },
            (cmTaskRes.relevantBullets || []).map((b) =>
              h('div', { key: b.id, style: { padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' } },
                h('span', { style: S.pill('#10b981') }, 'score=' + Number(b.relevanceScore || 0).toFixed(2)),
                ' ',
                b.content
              )
            ),
            (cmTaskRes.antiPatterns || []).map((ap) =>
              h('div', { key: ap.id, style: { padding: '4px 0', color: '#fca5a5' } }, '⚠ ' + ap.content)
            )
          )
        )
      ),

      // Starter Playbooks Library + Create Custom Starter
      h('div', { style: S.grid2 },
        h('div', { style: S.card },
          h('div', { style: S.sectionTitle }, 'Starter Playbooks Library (Built-in & Custom)'),
          h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8 } },
            (cm.starters || []).map((st) =>
              h('div', { key: st.name, style: { ...S.card, padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 6 } },
                h('div', null,
                  h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                    h('span', { style: { fontWeight: 600, fontSize: 13 } }, st.name),
                    h('span', { style: S.pill(st.source === 'custom' ? '#10b981' : '#3b82f6') }, st.bulletCount + ' rules')
                  ),
                  h('div', { style: { fontSize: 11.5, color: 'var(--muted-foreground)', marginTop: 4 } }, st.description)
                ),
                h('button', { style: S.btn('default'), onClick: () => handleApplyStarter(st.name) }, 'Apply Starter')
              )
            )
          )
        ),
        h('div', { style: S.card },
          h('div', { style: S.sectionTitle }, 'Create Custom Starter Pack (~/.cass-memory/starters/)'),
          h('form', { onSubmit: handleCreateStarter, style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            h('div', { style: { display: 'flex', gap: 8 } },
              h('input', { style: { ...S.input, width: 180 }, value: stName, onChange: (e) => setStName(e.target.value), placeholder: 'Starter slug (e.g. fastapi-ops)' }),
              h('input', { style: { ...S.input, flex: 1 }, value: stDesc, onChange: (e) => setStDesc(e.target.value), placeholder: 'Description of starter pack...' })
            ),
            h('textarea', {
              rows: 3,
              style: S.textarea,
              value: stRulesRaw,
              onChange: (e) => setStRulesRaw(e.target.value),
              placeholder: 'One rule per line (optional prefix: category | rule content), e.g. workflow | Always run pytest -q before committing API changes',
            }),
            h('button', { type: 'submit', style: S.btn('success') }, 'Save & Apply Custom Starter Pack')
          )
        )
      ),

      // Playbook Rules Filter Bar
      h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' } },
        h('input', {
          style: { ...S.input, width: 260 },
          value: cmFilter,
          onChange: (e) => setCmFilter(e.target.value),
          placeholder: 'Filter rules by text, id, or tag...',
        }),
        h('select', { style: S.input, value: cmKind, onChange: (e) => setCmKind(e.target.value) },
          h('option', { value: 'all' }, 'All Kinds (' + cm.total_bullets + ')'),
          h('option', { value: 'rule' }, 'Workflow Rules (' + (cm.total_bullets - cm.anti_patterns_count) + ')'),
          h('option', { value: 'anti-pattern' }, 'Pitfalls / Anti-Patterns (' + cm.anti_patterns_count + ')')
        ),
        h('select', { style: S.input, value: cmMat, onChange: (e) => setCmMat(e.target.value) },
          h('option', { value: 'all' }, 'All Maturities'),
          h('option', { value: 'proven' }, 'Proven (' + (cm.by_maturity.proven || 0) + ')'),
          h('option', { value: 'established' }, 'Established (' + (cm.by_maturity.established || 0) + ')'),
          h('option', { value: 'candidate' }, 'Candidate (' + (cm.by_maturity.candidate || 0) + ')'),
          h('option', { value: 'deprecated' }, 'Deprecated (' + (cm.by_maturity.deprecated || 0) + ')')
        ),
        h('select', { style: S.input, value: cmCat, onChange: (e) => setCmCat(e.target.value) },
          h('option', { value: 'all' }, 'All Categories'),
          Object.keys(cm.by_category || {}).sort().map((cat) =>
            h('option', { key: cat, value: cat }, cat + ' (' + cm.by_category[cat] + ')')
          )
        )
      ),

      // Playbook Bullets List
      h('div', { style: S.card },
        (() => {
          let list = (cm.bullets || []).slice();
          if (cmKind !== 'all') list = list.filter((b) => b.kind === cmKind);
          if (cmMat !== 'all') list = list.filter((b) => b.maturity === cmMat);
          if (cmCat !== 'all') list = list.filter((b) => b.category === cmCat);
          if (cmFilter.trim()) {
            const q = cmFilter.toLowerCase();
            list = list.filter((b) =>
              b.content.toLowerCase().includes(q) ||
              b.id.toLowerCase().includes(q) ||
              (b.tags || []).some((t) => t.toLowerCase().includes(q))
            );
          }
          return list.map((b) =>
            h('div', { key: b.id, style: { padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' } },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 } },
                h('div', { style: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' } },
                  h('span', { style: S.mono }, b.id),
                  b.is_anti_pattern && h('span', { style: S.pill('#ef4444') }, 'PITFALL / ANTI-PATTERN'),
                  h('span', { style: S.pill(TIER_COLORS[b.maturity] || '#3b82f6') }, b.maturity.toUpperCase() + ' (' + b.maturity_multiplier + 'x)'),
                  h('span', { style: S.pill('#60a5fa') }, b.category),
                  b.pinned && h('span', { style: S.pill('#f59e0b') }, 'PINNED'),
                  h('span', { style: S.mono },
                    'EffScore=' + b.effective_score +
                    ' · Conf=' + Math.round((b.confidence_score || 0) * 100) + '%' +
                    ' · Decay=' + b.decay_pct + '%' +
                    ' · +' + b.helpfulCount + '/-' + b.harmfulCount
                  )
                ),
                h('div', { style: { display: 'flex', gap: 6 } },
                  h('button', { style: S.btn('success'), onClick: () => handleCmMark(b.id, true) }, '+ Helpful'),
                  h('button', { style: S.btn('warn'), onClick: () => handleCmMark(b.id, false) }, '- Harmful (4x)'),
                  h('button', { style: S.btn('danger'), onClick: () => handleCmRemove(b.id) }, 'Delete')
                )
              ),
              h('div', { style: { fontSize: 13, lineHeight: 1.5, marginBottom: 5 } }, b.content),
              (b.tags || []).length > 0 && h('div', { style: { display: 'flex', gap: 5, flexWrap: 'wrap' } },
                (b.tags || []).map((t) => h('span', { key: t, style: S.badgeCount }, '#' + t))
              )
            )
          );
        })()
      )
    ),

    // TAB 5: CASS CROSS-AGENT SESSION SEARCH
    tab === 'cass' && h('div', null,
      h('div', { style: S.grid2 },
        h('div', { style: S.card },
          h('div', { style: S.sectionTitle },
            h('span', null, 'CASS Indexed Harnesses (' + (cass.conversations || 0).toLocaleString() + ' conversations, ' + (cass.messages || 0).toLocaleString() + ' messages)'),
            h('button', { style: S.btn('success'), onClick: handleCassSync, disabled: syncBusy },
              syncBusy ? 'Syncing Hermes...' : 'Sync Hermes Sessions Now'
            )
          ),
          (cass.by_agent || []).map((ag) => {
            const pct = Math.min(100, Math.round(((ag.messages || 0) / Math.max(1, cass.messages || 1)) * 100));
            return h('div', { key: ag.agent, style: { marginBottom: 8 } },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 } },
                h('span', { style: { fontWeight: 600 } }, ag.agent + (ag.agent === 'codex' ? ' (includes Hermes Bridged)' : '')),
                h('span', { style: S.mono }, ag.conversations + ' convs · ' + (ag.messages || 0).toLocaleString() + ' msgs (' + pct + '%)')
              ),
              h('div', { style: S.barOuter },
                h('div', { style: { height: '100%', width: Math.max(3, pct) + '%', background: '#3b82f6' } })
              )
            );
          })
        ),
        h('div', { style: S.card },
          h('div', { style: S.sectionTitle }, 'Hermes -> CASS Bridge & Top Indexed Workspaces'),
          h('div', { style: { ...S.mono, marginBottom: 10, color: 'var(--muted-foreground)', lineHeight: 1.6 } },
            h('div', null, 'Bridge Script: ' + ((cass.hermes_bridge && cass.hermes_bridge.script) || '')),
            h('div', null, 'Sync Folder:   ' + ((cass.hermes_bridge && cass.hermes_bridge.sync_dir) || '')),
            h('div', null, 'Bridged Convs: ' + ((cass.hermes_bridge && cass.hermes_bridge.synced_sessions) || 0) + ' Hermes sessions indexed')
          ),
          h('div', { style: { maxHeight: 150, overflowY: 'auto' } },
            (cass.top_workspaces || []).map((w, i) =>
              h('div', { key: i, style: { display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' } },
                h('span', { style: { ...S.mono, cursor: 'pointer', color: '#93c5fd' }, onClick: () => setCassWs(w.workspace) }, w.workspace),
                h('span', { style: S.mono }, w.conversations + ' convs')
              )
            )
          )
        )
      ),

      // CASS Search Bar
      h('div', { style: { ...S.card, marginBottom: 16 } },
        h('div', { style: S.sectionTitle }, 'Search All Coding Agent & Hermes Sessions via CASS (Tantivy + SQLite FTS)'),
        h('form', { onSubmit: handleCassSearch, style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
          h('input', {
            style: { ...S.input, flex: 1, minWidth: 240 },
            value: cassQuery,
            onChange: (e) => setCassQuery(e.target.value),
            placeholder: 'Full-text query across all agent sessions...',
          }),
          h('select', { style: S.input, value: cassAgent, onChange: (e) => setCassAgent(e.target.value) },
            h('option', { value: 'all' }, 'All Agents'),
            h('option', { value: 'hermes' }, 'Hermes Only (Bridged)'),
            h('option', { value: 'codex' }, 'Codex (+ Hermes)'),
            h('option', { value: 'claude_code' }, 'Claude Code'),
            h('option', { value: 'gemini' }, 'Gemini CLI'),
            h('option', { value: 'antigravity' }, 'Antigravity (agy)'),
            h('option', { value: 'opencode' }, 'OpenCode')
          ),
          h('input', {
            style: { ...S.input, width: 200 },
            value: cassWs,
            onChange: (e) => setCassWs(e.target.value),
            placeholder: 'Workspace filter (optional)...',
          }),
          h('select', { style: S.input, value: cassDays, onChange: (e) => setCassDays(e.target.value) },
            h('option', { value: '0' }, 'All Time'),
            h('option', { value: '1' }, 'Last 24 Hours'),
            h('option', { value: '7' }, 'Last 7 Days'),
            h('option', { value: '30' }, 'Last 30 Days')
          ),
          h('button', { type: 'submit', style: S.btn('primary'), disabled: cassBusy }, cassBusy ? 'Searching...' : 'Search CASS')
        )
      ),

      // CASS Search Results
      cassHits && h('div', { style: S.card },
        h('div', { style: S.sectionTitle },
          h('span', null, 'CASS Results for "' + cassHits.query + '" (' + cassHits.count + ' shown of ' + cassHits.total_matches + ' total matches)'),
          h('span', { style: S.mono }, cassHits.execution_ms + ' ms')
        ),
        (cassHits.hits || []).map((hit, i) =>
          h('div', { key: i, style: { padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' } },
            h('div', { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 } },
              h('span', { style: S.pill(hit.is_hermes ? '#10b981' : '#3b82f6') }, hit.agent),
              h('span', { style: { fontWeight: 600, fontSize: 13 } }, hit.title),
              h('span', { style: S.pill('#a855f7') }, 'BM25 ' + hit.score),
              hit.workspace && h('span', { style: { ...S.mono, color: 'var(--muted-foreground)' } }, hit.workspace)
            ),
            h('div', { style: { fontSize: 12.5, lineHeight: 1.5, color: 'var(--foreground)', marginBottom: 4 } }, hit.snippet),
            h('div', { style: { ...S.mono, fontSize: 11, color: 'var(--muted-foreground)' } },
              hit.source_path + (hit.line_number ? ':' + hit.line_number : '')
            )
          )
        )
      )
    )
  );
}

export default {
  id: ID,
  name: 'Memory Studio',
  description: 'Unified observability & control for Hermes Built-in Memory, Limbic (FSRS-4.5 + Trust + Entity Graph), CM Playbooks & Starters, and CASS Session Search.',
  version: '0.1.0',
  defaultEnabled: true,
  register(ctx) {
    ctx.registerMany([
      { id: 'route', area: ROUTES_AREA, data: { path: ROUTE }, render: () => h(MemoryStudioPage, { api: ctx }) },
      { id: 'nav', area: SIDEBAR_NAV_AREA, order: 57, data: { path: ROUTE, label: 'Memory Studio', codicon: 'database' } },
      {
        id: 'open',
        area: PALETTE_AREA,
        data: {
          id: `${ID}.open`,
          label: 'Memory Studio: Open Memory Studio',
          keywords: ['memory', 'limbic', 'cass', 'cm', 'playbook', 'studio'],
          run: () => host.navigate(ROUTE),
        },
      },
    ]);
  },
};
