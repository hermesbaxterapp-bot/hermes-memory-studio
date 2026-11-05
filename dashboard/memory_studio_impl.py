"""Memory Studio backend implementation (auto-reloaded by plugin_api.py on change)."""
from __future__ import annotations

import datetime as dt
import json
import math
import logging
import sqlite3
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

logger = logging.getLogger(__name__)

HERMES_HOME = Path('C:/Users/danci/AppData/Local/hermes')
CM_DIR = Path('C:/Users/danci/.cass-memory')
CM_EXE = 'C:/Users/danci/bin/cm.exe'
CASS_EXE = 'C:/Users/danci/bin/cass.exe'
CASS_SYNC_SCRIPT = 'C:/Users/danci/bin/cass-sync-hermes.py'

_CACHE_LOCK = threading.Lock()
_CASS_STATS_CACHE: Dict[str, Any] = {'data': None, 'expires': 0.0}
_STARTERS_CACHE: Dict[str, Any] = {'data': None, 'expires': 0.0}
_EMBEDDER_LOCK = threading.Lock()
_EMBEDDER_INSTANCE = None


def _now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace('+00:00', 'Z')


def _parse_ts(val: Any) -> float:
    if val is None:
        return time.time()
    if isinstance(val, (int, float)):
        return float(val) / 1000.0 if val > 1e11 else float(val)
    s = str(val).strip()
    if not s:
        return time.time()
    try:
        num = float(s)
        return num / 1000.0 if num > 1e11 else num
    except ValueError:
        pass
    try:
        if s.endswith('Z'):
            s = s[:-1] + '+00:00'
        return dt.datetime.fromisoformat(s).timestamp()
    except Exception:
        return time.time()


def _split_entries(raw: str) -> List[str]:
    nl = chr(10)
    blocks: List[str] = []
    cur: List[str] = []
    for line in raw.splitlines():
        if line.strip() == '§':
            text = nl.join(cur).strip()
            if text:
                blocks.append(text)
            cur = []
        else:
            cur.append(line)
    tail = nl.join(cur).strip()
    if tail:
        blocks.append(tail)
    return blocks


# ── 1. BUILT-IN MEMORY (MEMORY.md & USER.md) ─────────────────────────────────

def _read_memory_limits() -> Dict[str, int]:
    mem_limit = 3000
    user_limit = 2000
    try:
        cfg = yaml.safe_load((HERMES_HOME / 'config.yaml').read_text(encoding='utf-8')) or {}
        mcfg = cfg.get('memory') or {}
        if isinstance(mcfg.get('memory_char_limit'), int):
            mem_limit = mcfg['memory_char_limit']
        if isinstance(mcfg.get('user_char_limit'), int):
            user_limit = mcfg['user_char_limit']
    except Exception:
        pass
    return {'memory': mem_limit, 'user': user_limit}


def _parse_builtin_file(path: Path, char_limit: int) -> Dict[str, Any]:
    if not path.exists():
        return {'path': str(path), 'entries': [], 'entry_count': 0, 'chars': 0, 'char_limit': char_limit, 'configured_limit': char_limit, 'percent': 0.0}
    raw = path.read_text(encoding='utf-8', errors='replace')
    parts = _split_entries(raw)
    chars = len(raw)
    eff_limit = max(char_limit, chars if chars > char_limit else char_limit)
    return {
        'path': str(path),
        'entries': [{'index': i, 'content': p, 'chars': len(p)} for i, p in enumerate(parts)],
        'entry_count': len(parts),
        'chars': chars,
        'char_limit': eff_limit,
        'configured_limit': char_limit,
        'percent': round((chars / eff_limit) * 100.0, 1) if eff_limit > 0 else 0.0,
    }


def get_builtin_payload() -> Dict[str, Any]:
    limits = _read_memory_limits()
    mem_dir = HERMES_HOME / 'memories'
    mem = _parse_builtin_file(mem_dir / 'MEMORY.md', limits['memory'])
    usr = _parse_builtin_file(mem_dir / 'USER.md', limits['user'])
    total_chars = mem['chars'] + usr['chars']
    total_limit = mem['char_limit'] + usr['char_limit']
    return {
        'memory': mem,
        'user': usr,
        'total_entries': mem['entry_count'] + usr['entry_count'],
        'total_chars': total_chars,
        'total_limit': total_limit,
        'total_percent': round((total_chars / total_limit) * 100.0, 1) if total_limit > 0 else 0.0,
    }


def update_builtin_memory(target: str, action: str, content: str = '', index: Optional[int] = None) -> Dict[str, Any]:
    mem_dir = HERMES_HOME / 'memories'
    mem_dir.mkdir(parents=True, exist_ok=True)
    path = mem_dir / ('USER.md' if target == 'user' else 'MEMORY.md')
    raw = path.read_text(encoding='utf-8', errors='replace') if path.exists() else ''
    parts = _split_entries(raw)
    clean = (content or '').strip()
    if action == 'add':
        if not clean:
            raise ValueError('Content is required to add an entry.')
        if clean not in parts:
            parts.append(clean)
    elif action == 'remove':
        if index is not None and 0 <= int(index) < len(parts):
            parts.pop(int(index))
        elif clean:
            parts = [p for p in parts if p != clean and clean not in p]
    elif action == 'edit':
        if index is not None and 0 <= int(index) < len(parts) and clean:
            parts[int(index)] = clean
    sep = chr(10) + '§' + chr(10)
    new_raw = (sep.join(parts) + chr(10)) if parts else ''
    path.write_text(new_raw, encoding='utf-8')
    return get_builtin_payload()


# ── 2. LIMBIC (SQLite + sqlite_vec + FSRS-4.5 + Trust + Entity Graph) ────────

def _connect_limbic() -> sqlite3.Connection:
    db_path = HERMES_HOME / 'limbic.db'
    con = sqlite3.connect(str(db_path), timeout=10.0)
    try:
        import sqlite_vec
        con.enable_load_extension(True)
        sqlite_vec.load(con)
    except Exception:
        pass
    return con


def _fsrs_metrics(trust_score: float, retrieval_count: int, last_retrieved: Any, created_at: Any, now_ts: float) -> Dict[str, Any]:
    t_score = max(0.1, min(1.0, float(trust_score or 0.5)))
    ret_cnt = max(0, int(retrieval_count or 0))
    stability_s = 7.0 * (1.0 + 0.45 * math.log(1.0 + ret_cnt)) * (0.5 + t_score)
    ref_ts = _parse_ts(last_retrieved) if last_retrieved else _parse_ts(created_at)
    elapsed_days = max(0.0, (now_ts - ref_ts) / 86400.0)
    retrievability_r = math.pow(1.0 + (19.0 / 81.0) * (elapsed_days / max(0.1, stability_s)), -0.5)
    retrievability_r = max(0.0, min(1.0, retrievability_r))
    composite = 0.75 * retrievability_r + 0.25 * t_score
    tier = 'trusted' if t_score >= 0.65 else ('established' if t_score >= 0.50 else 'tentative')
    return {
        'trust_score': round(t_score, 3),
        'trust_tier': tier,
        'stability_days': round(stability_s, 2),
        'elapsed_days': round(elapsed_days, 2),
        'retrievability': round(retrievability_r, 4),
        'retrievability_pct': round(retrievability_r * 100.0, 1),
        'composite_score': round(composite, 4),
    }


def get_limbic_payload() -> Dict[str, Any]:
    now_ts = time.time()
    con = _connect_limbic()
    try:
        ent_rows = con.execute('SELECT entity_id, name, type FROM entities').fetchall()
        men_rows = con.execute('SELECT fact_id, entity_id FROM mentions').fetchall()
        ent_by_id = {eid: {'entity_id': eid, 'name': name, 'type': etype, 'fact_ids': []} for eid, name, etype in ent_rows}
        ents_by_fact: Dict[int, List[Dict[str, str]]] = {}
        for fid, eid in men_rows:
            if eid in ent_by_id:
                ent_by_id[eid]['fact_ids'].append(fid)
                ents_by_fact.setdefault(fid, []).append({
                    'entity_id': eid,
                    'name': ent_by_id[eid]['name'],
                    'type': ent_by_id[eid]['type'],
                })

        entities_list = sorted(
            [{
                **info,
                'mention_count': len(info['fact_ids']),
            } for info in ent_by_id.values()],
            key=lambda x: (-x['mention_count'], x['name'].lower())
        )

        fact_rows = con.execute(
            'SELECT fact_id, content, user_id, trust_score, retrieval_count, last_retrieved, matured_at, atrophy_marked_at, created_at, updated_at FROM facts ORDER BY trust_score DESC, fact_id DESC'
        ).fetchall()

        facts_list = []
        tiers = {'trusted': 0, 'established': 0, 'tentative': 0}
        for row in fact_rows:
            fid, content, uid, trust, ret_cnt, last_ret, matured, atrophy, created, updated = row
            metrics = _fsrs_metrics(trust, ret_cnt, last_ret, created, now_ts)
            tiers[metrics['trust_tier']] = tiers.get(metrics['trust_tier'], 0) + 1
            facts_list.append({
                'fact_id': fid,
                'content': content,
                'user_id': uid or 'anthony',
                'retrieval_count': int(ret_cnt or 0),
                'last_retrieved_iso': dt.datetime.fromtimestamp(_parse_ts(last_ret), dt.timezone.utc).isoformat().replace('+00:00', 'Z') if last_ret else None,
                'matured': bool(matured),
                'atrophy_marked': bool(atrophy),
                'created_at': created,
                'updated_at': updated,
                'entities': ents_by_fact.get(fid, []),
                **metrics,
            })

        facts_list.sort(key=lambda x: (-x['composite_score'], -x['trust_score'], -x['fact_id']))

        contra_rows = con.execute('SELECT newer_fact_id, older_fact_id, created_at, nli_label, resolved_at FROM contradictions ORDER BY created_at DESC').fetchall()
        contradictions = [
            {
                'newer_fact_id': r[0],
                'older_fact_id': r[1],
                'created_at': r[2],
                'nli_label': r[3],
                'resolved_at': r[4],
            }
            for r in contra_rows
        ]
    finally:
        con.close()

    users_manifest = []
    users_yaml_path = HERMES_HOME / 'plugins' / 'limbic' / 'users.yaml'
    if users_yaml_path.exists():
        try:
            udoc = yaml.safe_load(users_yaml_path.read_text(encoding='utf-8')) or {}
            for uid, uinfo in (udoc.get('users') or {}).items():
                users_manifest.append({
                    'canonical_id': uid,
                    'display_name': uinfo.get('display_name', uid),
                    'scope': uinfo.get('scope', 'adult'),
                    'platforms': uinfo.get('platforms') or {},
                })
        except Exception:
            pass

    avg_trust = round(sum(f['trust_score'] for f in facts_list) / len(facts_list), 3) if facts_list else 0.0
    avg_ret = round(sum(f['retrievability'] for f in facts_list) / len(facts_list), 3) if facts_list else 0.0
    avg_stab = round(sum(f['stability_days'] for f in facts_list) / len(facts_list), 1) if facts_list else 0.0

    return {
        'total_facts': len(facts_list),
        'avg_trust': avg_trust,
        'avg_retrievability': avg_ret,
        'avg_stability_days': avg_stab,
        'tiers': tiers,
        'total_entities': len(entities_list),
        'total_mentions': sum(e['mention_count'] for e in entities_list),
        'total_contradictions': len(contradictions),
        'facts': facts_list,
        'entities': entities_list,
        'contradictions': contradictions,
        'identities': users_manifest,
        'scoring_model': {
            'name': 'FSRS-4.5 Power-Law Decay + Trust Tier Ranker',
            'retrievability_formula': 'R(t, S) = (1 + (19/81) * (t / S)) ^ -0.5',
            'stability_formula': 'S = 7.0 * (1 + 0.45 * ln(1 + retrievals)) * (0.5 + trust)',
            'rank_formula': 'Rank = 0.75 * (Similarity * R(t, S)) + 0.25 * Trust',
            'trust_deltas': {'initial': 0.50, 'helpful': '+0.05', 'unhelpful': '-0.10', 'floor': 0.10, 'trusted_threshold': 0.65},
        }
    }


def _get_limbic_embedder():
    global _EMBEDDER_INSTANCE
    with _EMBEDDER_LOCK:
        if _EMBEDDER_INSTANCE is None:
            # LimbicEmbedder is the abstract base (embed() raises); OnnxEmbedder is the bundled
            # Arctic Embed 2.0 L model limbic itself writes vec_index with. embeddings.py uses
            # relative imports, so load it inside a bare package shell (skips limbic/__init__).
            import importlib
            import types
            pkg_name = '_memory_studio_limbic'
            if pkg_name not in sys.modules:
                pkg = types.ModuleType(pkg_name)
                pkg.__path__ = [str(HERMES_HOME / 'plugins' / 'limbic')]
                sys.modules[pkg_name] = pkg
            emb_mod = importlib.import_module(pkg_name + '.embeddings')
            _EMBEDDER_INSTANCE = emb_mod.OnnxEmbedder()
        return _EMBEDDER_INSTANCE


def limbic_remember(content: str, user_id: str = 'anthony', trust_score: float = 0.70) -> Dict[str, Any]:
    clean = (content or '').strip()
    if not clean:
        raise ValueError('Fact content cannot be empty.')
    limbic_dir = str(HERMES_HOME / 'plugins' / 'limbic')
    if limbic_dir not in sys.path:
        sys.path.insert(0, limbic_dir)
    from store_sqlite import SQLiteStore
    from entities import EntityExtractor

    emb = _get_limbic_embedder()
    vec = emb.embed(clean)
    store = SQLiteStore(str(HERMES_HOME / 'limbic.db'))
    fid = store.insert_fact(clean, vec, user_id=user_id or 'anthony')
    try:
        extractor = EntityExtractor()
        extracted = extractor.extract(clean)
        if extracted:
            store.link_entities(fid, extracted)
    except Exception:
        pass
    store.close()

    t_val = max(0.10, min(1.0, float(trust_score or 0.70)))
    now_str = str(time.time())
    con = _connect_limbic()
    try:
        con.execute(
            'UPDATE facts SET trust_score = ?, retrieval_count = 1, last_retrieved = ? WHERE fact_id = ?',
            (t_val, now_str, fid)
        )
        con.commit()
    finally:
        con.close()
    return get_limbic_payload()


def limbic_feedback(fact_id: int, signal: str) -> Dict[str, Any]:
    now_str = str(time.time())
    con = _connect_limbic()
    try:
        if signal == 'decay_pass':
            rows = con.execute('SELECT fact_id, trust_score, retrieval_count, last_retrieved, created_at FROM facts').fetchall()
            now_ts = time.time()
            for fid, tr, rcnt, lret, cr in rows:
                m = _fsrs_metrics(tr, rcnt, lret, cr, now_ts)
                atrophy = now_str if (m['retrievability'] < 0.35 and m['trust_score'] < 0.45) else None
                matured = now_str if int(rcnt or 0) >= 2 else None
                con.execute('UPDATE facts SET matured_at = COALESCE(matured_at, ?), atrophy_marked_at = ? WHERE fact_id = ?', (matured, atrophy, fid))
            con.commit()
        else:
            row = con.execute('SELECT trust_score, retrieval_count FROM facts WHERE fact_id = ?', (int(fact_id),)).fetchone()
            if not row:
                raise ValueError(f'Fact #{fact_id} not found.')
            tr, rcnt = float(row[0] or 0.5), int(row[1] or 0)
            if signal == 'helpful':
                new_tr = min(1.0, round(tr + 0.05, 4))
                new_rcnt = rcnt + 1
                matured = now_str if new_rcnt >= 2 else None
                con.execute(
                    'UPDATE facts SET trust_score = ?, retrieval_count = ?, last_retrieved = ?, matured_at = COALESCE(matured_at, ?), updated_at = ? WHERE fact_id = ?',
                    (new_tr, new_rcnt, now_str, matured, _now_iso(), int(fact_id))
                )
            elif signal == 'unhelpful':
                new_tr = max(0.10, round(tr - 0.10, 4))
                con.execute(
                    'UPDATE facts SET trust_score = ?, updated_at = ? WHERE fact_id = ?',
                    (new_tr, _now_iso(), int(fact_id))
                )
            elif signal == 'reinforce':
                new_rcnt = rcnt + 1
                con.execute(
                    'UPDATE facts SET retrieval_count = ?, last_retrieved = ?, updated_at = ? WHERE fact_id = ?',
                    (new_rcnt, now_str, _now_iso(), int(fact_id))
                )
            con.commit()
    finally:
        con.close()
    return get_limbic_payload()


def limbic_forget(fact_id: int) -> Dict[str, Any]:
    fid = int(fact_id)
    con = _connect_limbic()
    try:
        con.execute('DELETE FROM mentions WHERE fact_id = ?', (fid,))
        try:
            con.execute('DELETE FROM vec_index WHERE rowid = ?', (fid,))
        except Exception:
            pass
        try:
            con.execute('DELETE FROM facts_fts WHERE rowid = ?', (fid,))
        except Exception:
            pass
        con.execute('DELETE FROM facts WHERE fact_id = ?', (fid,))
        con.commit()
    finally:
        con.close()
    return get_limbic_payload()


def limbic_recall_test(query: str, limit: int = 8, user_id: str = 'anthony') -> Dict[str, Any]:
    q = (query or '').strip()
    if not q:
        return {'query': '', 'results': []}
    t0 = time.time()
    limbic_dir = str(HERMES_HOME / 'plugins' / 'limbic')
    if limbic_dir not in sys.path:
        sys.path.insert(0, limbic_dir)
    from store_sqlite import SQLiteStore

    emb = _get_limbic_embedder()
    qvec = emb.embed(q)
    store = SQLiteStore(str(HERMES_HOME / 'limbic.db'))
    try:
        vec_hits = store.search_vector(qvec, top_k=max(limit * 2, 12), user_id=user_id or 'anthony')
    except Exception:
        vec_hits = []
    finally:
        store.close()

    sim_by_id: Dict[int, float] = {}
    for h in vec_hits:
        fid = int(h.get('fact_id', 0))
        dist = float(h.get('distance', 0.5))
        sim = max(0.05, min(1.0, 1.0 / (1.0 + dist))) if dist > 1.0 else max(0.05, min(1.0, 1.0 - dist / 2.0))
        sim_by_id[fid] = sim

    payload = get_limbic_payload()
    q_words = [w for w in ''.join(ch.lower() if ch.isalnum() else ' ' for ch in q).split() if len(w) >= 2]
    results = []
    for f in payload['facts']:
        fid = f['fact_id']
        sim = sim_by_id.get(fid, 0.25)
        hay = f['content'].lower()
        kw_matches = sum(1 for w in q_words if w in hay)
        if kw_matches > 0:
            sim = min(1.0, sim + 0.12 * kw_matches)
        rel_x_r = sim * f['retrievability']
        final_rank = 0.75 * rel_x_r + 0.25 * f['trust_score']
        results.append({
            **f,
            'vector_similarity': round(sim, 4),
            'relevance_x_retrievability': round(rel_x_r, 4),
            'final_rank_score': round(final_rank, 4),
        })
    results.sort(key=lambda x: -x['final_rank_score'])
    return {
        'query': q,
        'execution_ms': int((time.time() - t0) * 1000),
        'results': results[:limit],
    }


# ── 3. CM (CASS MEMORY SYSTEM — Playbooks, Starters, Scoring & Context) ──────

def _run_cli_json(cmd: List[str], timeout: float = 25.0) -> Dict[str, Any]:
    try:
        res = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=timeout,
        )
        out = (res.stdout or '').strip()
        if not out:
            return {'success': False, 'error': (res.stderr or 'Empty output').strip(), 'returncode': res.returncode}
        return json.loads(out)
    except Exception as exc:
        return {'success': False, 'error': str(exc)}


def _score_cm_bullet(b: Dict[str, Any], now_ts: float) -> Dict[str, Any]:
    helpful = int(b.get('helpfulCount') or 0)
    harmful = int(b.get('harmfulCount') or 0)
    half_life = float(b.get('confidenceDecayHalfLifeDays') or 90.0)
    events = b.get('feedbackEvents') or []
    last_ts = _parse_ts(b.get('updatedAt') or b.get('createdAt'))
    if events:
        ev_ts = max((_parse_ts(ev.get('timestamp')) for ev in events if ev.get('timestamp')), default=last_ts)
        last_ts = max(last_ts, ev_ts)
    age_days = max(0.0, (now_ts - last_ts) / 86400.0)
    decay_factor = math.pow(0.5, age_days / max(1.0, half_life))
    raw_net = helpful - 4.0 * harmful
    decayed_net = raw_net * decay_factor
    smoothed_conf = ((helpful + 1.0) / (helpful + 4.0 * harmful + 2.0)) * decay_factor
    maturity = str(b.get('maturity') or 'candidate')
    mat_mult = 1.25 if maturity == 'proven' else (1.0 if maturity == 'established' else (0.25 if maturity == 'deprecated' else 0.75))
    effective_score = max(0.0, decayed_net * mat_mult)
    is_anti = bool(b.get('isNegative') or b.get('type') == 'anti-pattern' or b.get('kind') == 'anti_pattern')
    return {
        'helpfulCount': helpful,
        'harmfulCount': harmful,
        'half_life_days': half_life,
        'age_days': round(age_days, 2),
        'decay_factor': round(decay_factor, 4),
        'decay_pct': round(decay_factor * 100.0, 1),
        'raw_net_score': round(raw_net, 2),
        'decayed_net_score': round(decayed_net, 3),
        'confidence_score': round(smoothed_conf, 4),
        'maturity_multiplier': mat_mult,
        'effective_score': round(effective_score, 3),
        'is_anti_pattern': is_anti,
    }


def _get_starters_list(force: bool = False) -> List[Dict[str, Any]]:
    now = time.time()
    with _CACHE_LOCK:
        if not force and _STARTERS_CACHE['data'] is not None and now < _STARTERS_CACHE['expires']:
            return list(_STARTERS_CACHE['data'])
    starters_res = _run_cli_json([CM_EXE, 'starters', '--json'], timeout=10.0)
    starters_list = list((starters_res.get('data') or {}).get('starters') or [])
    known_names = {s.get('name') for s in starters_list if isinstance(s, dict)}
    starters_dir = CM_DIR / 'starters'
    if starters_dir.exists():
        for sf in sorted(starters_dir.glob('*.yaml')):
            try:
                sdoc = yaml.safe_load(sf.read_text(encoding='utf-8')) or {}
                sname = sdoc.get('name') or sf.stem
                if sname not in known_names:
                    starters_list.append({
                        'name': sname,
                        'description': sdoc.get('description', 'Custom starter playbook'),
                        'bulletCount': len(sdoc.get('bullets') or []),
                        'source': 'custom',
                        'path': str(sf),
                    })
            except Exception:
                pass
    with _CACHE_LOCK:
        _STARTERS_CACHE['data'] = starters_list
        _STARTERS_CACHE['expires'] = now + 60.0
    return starters_list


def get_cm_payload(force_starters: bool = False) -> Dict[str, Any]:
    now_ts = time.time()
    cfg_path = CM_DIR / 'config.json'
    cm_config = {}
    if cfg_path.exists():
        try:
            cm_config = json.loads(cfg_path.read_text(encoding='utf-8'))
        except Exception:
            pass

    pb_path = CM_DIR / 'playbook.yaml'
    raw_bullets: List[Dict[str, Any]] = []
    if pb_path.exists():
        try:
            pb_doc = yaml.safe_load(pb_path.read_text(encoding='utf-8')) or {}
            raw_bullets = pb_doc.get('bullets') or []
        except Exception:
            pass

    bullets: List[Dict[str, Any]] = []
    by_maturity = {'proven': 0, 'established': 0, 'candidate': 0, 'deprecated': 0}
    by_category: Dict[str, int] = {}
    anti_count = 0
    total_helpful = 0
    total_harmful = 0

    for b in raw_bullets:
        if not isinstance(b, dict):
            continue
        sc = _score_cm_bullet(b, now_ts)
        mat = str(b.get('maturity') or 'candidate')
        if b.get('deprecated') or b.get('state') == 'retired':
            mat = 'deprecated'
        by_maturity[mat] = by_maturity.get(mat, 0) + 1
        cat = str(b.get('category') or 'general')
        by_category[cat] = by_category.get(cat, 0) + 1
        if sc['is_anti_pattern']:
            anti_count += 1
        total_helpful += sc['helpfulCount']
        total_harmful += sc['harmfulCount']
        bullets.append({
            'id': b.get('id', ''),
            'content': b.get('content', ''),
            'category': cat,
            'scope': b.get('scope', 'global'),
            'state': b.get('state', 'active'),
            'maturity': mat,
            'kind': 'anti-pattern' if sc['is_anti_pattern'] else 'rule',
            'pinned': bool(b.get('pinned')),
            'deprecated': bool(b.get('deprecated')),
            'tags': b.get('tags') or [],
            'source': b.get('source', 'learned'),
            'sourceAgents': b.get('sourceAgents') or [],
            'sourceSessions': b.get('sourceSessions') or [],
            'searchPointer': b.get('searchPointer', ''),
            'createdAt': b.get('createdAt'),
            'updatedAt': b.get('updatedAt'),
            'feedbackEvents': (b.get('feedbackEvents') or [])[-5:],
            **sc,
        })

    bullets.sort(key=lambda x: (-x['effective_score'], -x['confidence_score'], x['id']))
    starters_list = _get_starters_list(force=force_starters)

    avg_eff = round(sum(b['effective_score'] for b in bullets) / len(bullets), 2) if bullets else 0.0
    avg_conf = round(sum(b['confidence_score'] for b in bullets) / len(bullets), 3) if bullets else 0.0
    avg_decay = round(sum(b['decay_factor'] for b in bullets) / len(bullets), 3) if bullets else 1.0

    return {
        'total_bullets': len(bullets),
        'active_bullets': sum(1 for b in bullets if b['state'] == 'active' and not b['deprecated']),
        'anti_patterns_count': anti_count,
        'total_helpful': total_helpful,
        'total_harmful': total_harmful,
        'avg_effective_score': avg_eff,
        'avg_confidence_score': avg_conf,
        'avg_decay_factor': avg_decay,
        'by_maturity': by_maturity,
        'by_category': by_category,
        'config': {
            'provider': cm_config.get('provider', 'anthropic'),
            'model': cm_config.get('model', 'claude-sonnet-5'),
            'semanticSearchEnabled': bool(cm_config.get('semanticSearchEnabled', True)),
            'halfLifeDays': cm_config.get('scoring', {}).get('decayHalfLifeDays', 90),
            'harmfulMultiplier': cm_config.get('scoring', {}).get('harmfulMultiplier', 4),
            'crossAgent': cm_config.get('crossAgent') or {},
        },
        'scoring_model': {
            'name': 'CM Confidence Decay + 4x Harmful Penalty + Maturity Multiplier',
            'decay_formula': 'Decay(t) = 0.5 ^ (age_days / half_life_days)   [half_life = 90d]',
            'net_formula': 'DecayedNet = (Helpful - 4 * Harmful) * Decay(t)',
            'effective_formula': 'EffectiveScore = max(0, DecayedNet * MaturityMult)   [proven=1.25x, established=1.0x, candidate=0.75x]',
            'confidence_formula': 'Confidence = ((Helpful + 1) / (Helpful + 4 * Harmful + 2)) * Decay(t)',
            'promotion_thresholds': 'candidate -> established (3+ helpful, <25% harmful) -> proven (10+ helpful, <10% harmful)',
        },
        'bullets': bullets,
        'starters': starters_list,
    }


def cm_add_rule(
    content: str,
    category: str = 'general',
    kind: str = 'rule',
    maturity: str = 'established',
    scope: str = 'global',
    tags: Optional[List[str]] = None,
    pinned: bool = False,
) -> Dict[str, Any]:
    clean = (content or '').strip()
    if not clean:
        raise ValueError('Rule content is required.')
    cat = (category or 'general').strip().lower()
    is_anti = (kind == 'anti-pattern')
    if is_anti and not clean.upper().startswith(('PITFALL:', 'ANTI-PATTERN:', 'AVOID:', 'NEVER:')):
        clean = f'PITFALL: {clean}'

    pb_path = CM_DIR / 'playbook.yaml'
    pb_doc = yaml.safe_load(pb_path.read_text(encoding='utf-8')) if pb_path.exists() else {
        'schema_version': 2,
        'name': 'global-playbook',
        'description': 'Global procedural memory playbook',
        'metadata': {},
        'deprecatedPatterns': [],
        'bullets': [],
    }
    bullets = pb_doc.setdefault('bullets', [])

    now_iso = _now_iso()
    rule_id = f'b-{uuid.uuid4().hex[:8]}-{int(time.time()) % 10000}'
    init_helpful = 10 if maturity == 'proven' else (3 if maturity == 'established' else 1)
    tag_list = [t.strip() for t in (tags or []) if t.strip()]
    if is_anti and 'anti-pattern' not in tag_list:
        tag_list.append('anti-pattern')

    new_bullet = {
        'id': rule_id,
        'scope': scope or 'global',
        'category': cat,
        'content': clean,
        'source': 'learned',
        'searchPointer': clean[:80],
        'type': 'anti-pattern' if is_anti else 'rule',
        'isNegative': is_anti,
        'kind': 'anti_pattern' if is_anti else 'workflow_rule',
        'state': 'active',
        'maturity': maturity if maturity in ('candidate', 'established', 'proven') else 'established',
        'helpfulCount': init_helpful,
        'harmfulCount': 0,
        'feedbackEvents': [
            {'type': 'helpful', 'timestamp': now_iso, 'context': 'Created in Memory Studio'}
            for _ in range(init_helpful)
        ],
        'confidenceDecayHalfLifeDays': 90,
        'createdAt': now_iso,
        'updatedAt': now_iso,
        'pinned': bool(pinned),
        'deprecated': False,
        'sourceSessions': ['memory-studio'],
        'sourceAgents': ['hermes'],
        'tags': tag_list,
    }
    bullets.insert(0, new_bullet)
    pb_path.write_text(yaml.safe_dump(pb_doc, sort_keys=False, allow_unicode=True), encoding='utf-8')
    return get_cm_payload()


def cm_mark_rule(bullet_id: str, helpful: bool = True, reason: str = 'Feedback from Memory Studio') -> Dict[str, Any]:
    bid = (bullet_id or '').strip()
    if not bid:
        raise ValueError('bullet_id is required.')
    flag = '--helpful' if helpful else '--harmful'
    _run_cli_json([CM_EXE, 'mark', bid, flag, '--reason', reason or 'Memory Studio feedback', '--json'], timeout=12.0)
    pb_path = CM_DIR / 'playbook.yaml'
    if pb_path.exists():
        pb_doc = yaml.safe_load(pb_path.read_text(encoding='utf-8')) or {}
        changed = False
        for b in pb_doc.get('bullets') or []:
            if b.get('id') == bid and b.get('state') == 'draft' and not b.get('deprecated'):
                b['state'] = 'active'
                changed = True
        if changed:
            pb_path.write_text(yaml.safe_dump(pb_doc, sort_keys=False, allow_unicode=True), encoding='utf-8')
    return get_cm_payload()


def cm_remove_rule(bullet_id: str) -> Dict[str, Any]:
    bid = (bullet_id or '').strip()
    pb_path = CM_DIR / 'playbook.yaml'
    if pb_path.exists():
        pb_doc = yaml.safe_load(pb_path.read_text(encoding='utf-8')) or {}
        pb_doc['bullets'] = [b for b in (pb_doc.get('bullets') or []) if b.get('id') != bid]
        pb_path.write_text(yaml.safe_dump(pb_doc, sort_keys=False, allow_unicode=True), encoding='utf-8')
    return get_cm_payload()


def cm_apply_starter(starter_name: str) -> Dict[str, Any]:
    sname = (starter_name or '').strip()
    if not sname:
        raise ValueError('starter_name is required.')
    res = _run_cli_json([CM_EXE, 'init', '--starter', sname, '--json'], timeout=15.0)
    pb_path = CM_DIR / 'playbook.yaml'
    if pb_path.exists():
        pb_doc = yaml.safe_load(pb_path.read_text(encoding='utf-8')) or {}
        for b in pb_doc.get('bullets') or []:
            if b.get('state') == 'draft':
                b['state'] = 'active'
            if int(b.get('helpfulCount') or 0) == 0:
                b['helpfulCount'] = 1
        pb_path.write_text(yaml.safe_dump(pb_doc, sort_keys=False, allow_unicode=True), encoding='utf-8')
    payload = get_cm_payload(force_starters=True)
    payload['starter_apply_result'] = res.get('data') or res
    return payload


def cm_create_starter(name: str, description: str, rules: List[Dict[str, Any]], apply_now: bool = True) -> Dict[str, Any]:
    slug = ''.join(ch if (ch.isalnum() or ch in '-_') else '-' for ch in (name or '').strip().lower()).strip('-')
    while '--' in slug:
        slug = slug.replace('--', '-')
    if not slug:
        raise ValueError('Starter name is required.')
    starters_dir = CM_DIR / 'starters'
    starters_dir.mkdir(parents=True, exist_ok=True)
    now_iso = _now_iso()
    bullets = []
    for idx, r in enumerate(rules or []):
        content = (r.get('content') or '').strip()
        if not content:
            continue
        cat = (r.get('category') or 'general').strip().lower()
        mat = r.get('maturity') if r.get('maturity') in ('candidate', 'established', 'proven') else 'established'
        hc = 5 if mat == 'proven' else (3 if mat == 'established' else 1)
        bullets.append({
            'id': f'starter-{slug}-{idx+1}',
            'content': content,
            'category': cat,
            'scope': 'global',
            'state': 'active',
            'maturity': mat,
            'helpfulCount': hc,
            'harmfulCount': 0,
            'createdAt': now_iso,
            'updatedAt': now_iso,
            'tags': r.get('tags') or [slug, cat],
        })
    if not bullets:
        raise ValueError('At least one rule is required to create a starter.')
    sdoc = {
        'name': slug,
        'description': (description or f'Custom starter pack: {slug}').strip(),
        'bullets': bullets,
    }
    (starters_dir / f'{slug}.yaml').write_text(yaml.safe_dump(sdoc, sort_keys=False, allow_unicode=True), encoding='utf-8')
    if apply_now:
        return cm_apply_starter(slug)
    return get_cm_payload(force_starters=True)


def cm_context_test(task: str) -> Dict[str, Any]:
    q = (task or '').strip()
    if not q:
        return {'task': '', 'relevantBullets': [], 'antiPatterns': [], 'historySnippets': [], 'suggestedCassQueries': []}
    t0 = time.time()
    res = _run_cli_json([CM_EXE, 'context', q, '--json'], timeout=25.0)
    data = res.get('data') or {}
    return {
        'task': q,
        'execution_ms': int((time.time() - t0) * 1000),
        'semanticMode': data.get('semanticMode', 'hybrid'),
        'relevantBullets': data.get('relevantBullets') or [],
        'antiPatterns': data.get('antiPatterns') or [],
        'historySnippets': data.get('historySnippets') or [],
        'deprecatedWarnings': data.get('deprecatedWarnings') or [],
        'suggestedCassQueries': data.get('suggestedCassQueries') or [],
    }


# ── 4. CASS (Cross-Agent Session Search + Hermes Sync Bridge) ────────────────

def get_cass_payload(force_refresh: bool = False) -> Dict[str, Any]:
    now = time.time()
    with _CACHE_LOCK:
        if not force_refresh and _CASS_STATS_CACHE['data'] is not None and now < _CASS_STATS_CACHE['expires']:
            return _CASS_STATS_CACHE['data']

    stats_res = _run_cli_json([CASS_EXE, 'stats', '--json'], timeout=12.0)
    health_res = _run_cli_json([CASS_EXE, 'health', '--json'], timeout=8.0)

    by_agent = stats_res.get('by_agent') or []
    hermes_count = sum(int(a.get('count') or 0) for a in by_agent if a.get('agent') == 'hermes')
    hermes_snap_db = Path('C:/Users/danci/.hermes/state.db')
    if hermes_count == 0 and hermes_snap_db.exists():
        try:
            with sqlite3.connect(str(hermes_snap_db)) as con:
                hermes_count = int(con.execute('SELECT COUNT(*) FROM sessions').fetchone()[0])
        except Exception:
            pass

    # cass stats gives conversation `count` only; add per-agent / per-workspace message counts from its db.
    db_path = stats_res.get('db_path') or 'C:/Users/danci/AppData/Roaming/coding-agent-search/coding-agent-search/data/agent_search.db'
    agent_msgs: Dict[str, int] = {}
    ws_msgs: Dict[str, int] = {}
    try:
        with sqlite3.connect(f'file:{Path(db_path).as_posix()}?mode=ro', uri=True, timeout=5) as con:
            for slug, n in con.execute('SELECT a.slug, COUNT(m.id) FROM messages m JOIN conversations c ON c.id = m.conversation_id JOIN agents a ON a.id = c.agent_id GROUP BY a.slug'):
                agent_msgs[slug] = int(n)
            for wpath, n in con.execute('SELECT w.path, COUNT(m.id) FROM messages m JOIN conversations c ON c.id = m.conversation_id JOIN workspaces w ON w.id = c.workspace_id GROUP BY w.path'):
                ws_msgs[wpath] = int(n)
    except sqlite3.Error as exc:
        logger.warning('memory-studio: cass per-agent message counts unavailable: %s', exc)
    by_agent = [
        {'agent': a.get('agent'), 'conversations': int(a.get('count') or 0), 'messages': agent_msgs.get(a.get('agent'), 0)}
        for a in by_agent
    ]
    top_workspaces = [
        {'workspace': w.get('workspace'), 'conversations': int(w.get('count') or 0), 'messages': ws_msgs.get(w.get('workspace'), 0)}
        for w in (stats_res.get('top_workspaces') or [])[:12]
    ]

    payload = {
        'healthy': bool(health_res.get('healthy', True)),
        'latency_ms': health_res.get('latency_ms', 0),
        'conversations': int(stats_res.get('conversations') or 0),
        'messages': int(stats_res.get('messages') or 0),
        'by_agent': by_agent,
        'top_workspaces': top_workspaces,
        'date_range': stats_res.get('date_range') or {},
        'db_path': stats_res.get('db_path', 'C:/Users/danci/AppData/Roaming/coding-agent-search/coding-agent-search/data/agent_search.db'),
        'hermes_bridge': {
            'script': CASS_SYNC_SCRIPT,
            'sync_dir': str(hermes_snap_db),
            'synced_sessions': hermes_count,
            'status': 'active' if hermes_count > 0 else 'empty',
        },
    }
    with _CACHE_LOCK:
        _CASS_STATS_CACHE['data'] = payload
        _CASS_STATS_CACHE['expires'] = now + 30.0
    return payload


def cass_search(
    query: str,
    agent: str = '',
    workspace: str = '',
    days: int = 0,
    limit: int = 25,
) -> Dict[str, Any]:
    q = (query or '').strip()
    if not q:
        return {'query': '', 'count': 0, 'total_matches': 0, 'hits': []}
    cmd = [CASS_EXE, 'search', q, '--json', '--limit', str(max(1, min(100, int(limit or 25))))]
    ag = (agent or '').strip()
    if ag and ag != 'all':
        cmd.extend(['--agent', ag])
    ws = (workspace or '').strip()
    if ws:
        cmd.extend(['--workspace', ws])
    if days and int(days) > 0:
        cmd.extend(['--days', str(int(days))])

    t0 = time.time()
    res = _run_cli_json(cmd, timeout=20.0)
    hits = res.get('hits') or []
    enriched_hits = []
    for h in hits:
        sp = str(h.get('source_path') or '')
        raw_ag = h.get('agent') or 'unknown'
        is_hermes = (raw_ag == 'hermes') or ('hermes' in Path(sp).as_posix().lower() if sp else False)
        enriched_hits.append({
            'title': h.get('title') or '(Untitled session)',
            'agent': raw_ag,
            'raw_agent': raw_ag,
            'is_hermes': is_hermes,
            'workspace': h.get('workspace') or '',
            'source_path': sp,
            'line_number': h.get('line_number'),
            'score': round(float(h.get('score') or 0.0), 3),
            'snippet': h.get('snippet') or h.get('content') or '',
            'created_at': h.get('created_at'),
        })
    return {
        'query': q,
        'agent_filter': ag or 'all',
        'execution_ms': int((time.time() - t0) * 1000),
        'count': len(enriched_hits),
        'total_matches': res.get('total_matches', len(enriched_hits)),
        'hits': enriched_hits,
    }


def cass_sync_hermes() -> Dict[str, Any]:
    t0 = time.time()
    res = subprocess.run(
        [sys.executable, CASS_SYNC_SCRIPT, '--index'],
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='replace',
        timeout=60.0,
    )
    out = (res.stdout or '').strip()
    sync_info = {}
    for line in out.splitlines():
        line_s = line.strip()
        if line_s.startswith('{') and line_s.endswith('}'):
            try:
                sync_info = json.loads(line_s)
            except Exception:
                pass
    cass_payload = get_cass_payload(force_refresh=True)
    return {
        'sync_result': sync_info,
        'execution_ms': int((time.time() - t0) * 1000),
        'cass': cass_payload,
    }


# ── 5. UNIFIED SNAPSHOT ──────────────────────────────────────────────────────


# ── 5. UNIFIED MEMORY GRAPH (3D view) ────────────────────────────────────────
#
# Real edges: limbic `mentions` (fact -> entity, from limbic's NER pass).
# Derived edges, labelled as such:
#   * `similar`  - cosine similarity between texts, using limbic's own Arctic Embed
#                  vectors (facts read straight from vec_index; built-in entries and
#                  cm bullets embedded with the same model and cached on disk).
#   * `names`    - a built-in entry or cm bullet whose text contains a limbic entity name.

NOISE_ENTITY_TYPES = {'CARDINAL', 'DATE', 'TIME', 'MONEY', 'PERCENT', 'ORDINAL', 'QUANTITY'}
_GRAPH_EMB_CACHE_PATH = HERMES_HOME / 'cache' / 'memory-studio' / 'embeddings.json'
_GRAPH_EMB_CACHE: Dict[str, List[float]] = {}
_GRAPH_SIM_FLOOR = 0.30
_GRAPH_SIM_TOPK = 4


def _load_emb_cache() -> None:
    if _GRAPH_EMB_CACHE or not _GRAPH_EMB_CACHE_PATH.exists():
        return
    try:
        _GRAPH_EMB_CACHE.update(json.loads(_GRAPH_EMB_CACHE_PATH.read_text(encoding='utf-8')))
    except (OSError, ValueError) as exc:
        logger.warning('memory-studio: embedding cache unreadable, rebuilding: %s', exc)


def _embed_cached(texts: List[str]) -> List[Optional[List[float]]]:
    import hashlib
    _load_emb_cache()
    keys = [hashlib.sha1(tx.encode('utf-8')).hexdigest() for tx in texts]
    missing = [i for i, k in enumerate(keys) if k not in _GRAPH_EMB_CACHE]
    if missing:
        emb = _get_limbic_embedder()
        for i in missing:
            vec = emb.embed(texts[i])
            if vec is not None:
                _GRAPH_EMB_CACHE[keys[i]] = [round(float(x), 6) for x in vec]
        _GRAPH_EMB_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        live = set(keys)
        keep = {k: v for k, v in _GRAPH_EMB_CACHE.items() if k in live}
        _GRAPH_EMB_CACHE_PATH.write_text(json.dumps(keep), encoding='utf-8')
    return [_GRAPH_EMB_CACHE.get(k) for k in keys]


def _cos(a: List[float], b: List[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (na * nb)


def get_memory_graph(builtin: Optional[Dict[str, Any]] = None, limbic: Optional[Dict[str, Any]] = None,
                     cm: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    import re
    t0 = time.time()
    builtin = builtin or get_builtin_payload()
    limbic = limbic or get_limbic_payload()
    cm = cm or get_cm_payload()

    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    text_nodes: List[Dict[str, Any]] = []  # nodes that take part in similarity

    for f in limbic.get('facts') or []:
        n = {'id': f'fact:{f["fact_id"]}', 'kind': 'fact', 'label': f['content'][:70], 'text': f['content'],
             'weight': f.get('composite_score', 0.5),
             'meta': {'fact_id': f['fact_id'], 'trust': f.get('trust_score'), 'tier': f.get('trust_tier'),
                      'retrievability_pct': f.get('retrievability_pct'), 'retrievals': f.get('retrieval_count')}}
        nodes.append(n)
        text_nodes.append(n)

    for target in ('memory', 'user'):
        for e in (builtin.get(target) or {}).get('entries') or []:
            n = {'id': f'{target}:{e["index"]}', 'kind': 'builtin', 'label': e['content'][:70], 'text': e['content'],
                 'weight': 0.6, 'meta': {'store': 'MEMORY.md' if target == 'memory' else 'USER.md', 'chars': e.get('chars')}}
            nodes.append(n)
            text_nodes.append(n)

    for b in cm.get('bullets') or []:
        if b.get('deprecated') or b.get('state') == 'retired':
            continue
        n = {'id': f'cm:{b["id"]}', 'kind': 'cm', 'label': b['content'][:70], 'text': b['content'],
             'weight': max(0.2, min(1.0, float(b.get('effective_score') or 0.5))),
             'meta': {'bullet_id': b['id'], 'category': b.get('category'), 'maturity': b.get('maturity'),
                      'kind': b.get('kind'), 'effective_score': b.get('effective_score')}}
        nodes.append(n)
        text_nodes.append(n)

    ent_name_by_id: Dict[str, Dict[str, Any]] = {}
    for en in limbic.get('entities') or []:
        noise = en.get('type') in NOISE_ENTITY_TYPES or bool(re.fullmatch(r'[\d\s.,:/-]+', en['name']))
        ent_name_by_id[en['entity_id']] = en
        nodes.append({'id': f'ent:{en["entity_id"]}', 'kind': 'entity', 'label': en['name'], 'text': en['name'],
                      'weight': 0.3 + 0.2 * min(4, en.get('mention_count') or 1), 'noise': noise,
                      'meta': {'type': en.get('type'), 'mentions': en.get('mention_count')}})
        for fid in en.get('fact_ids') or []:
            edges.append({'s': f'fact:{fid}', 't': f'ent:{en["entity_id"]}', 'kind': 'mention', 'w': 1.0})

    # names: built-in / cm text containing a (non-noise) entity name
    for n in text_nodes:
        if n['kind'] == 'fact':
            continue
        low = n['text'].lower()
        for eid, en in ent_name_by_id.items():
            name = en['name'].strip()
            if len(name) < 3 or en.get('type') in NOISE_ENTITY_TYPES or re.fullmatch(r'[\d\s.,:/-]+', name):
                continue
            if re.search(r'(?<![\w])' + re.escape(name.lower()) + r'(?![\w])', low):
                edges.append({'s': n['id'], 't': f'ent:{eid}', 'kind': 'names', 'w': 0.8})

    # similar: cosine over Arctic Embed vectors
    vec_by_fact: Dict[int, List[float]] = {}
    con = _connect_limbic()
    try:
        for rowid, vjson in con.execute('SELECT rowid, vec_to_json(embedding) FROM vec_index'):
            vec_by_fact[int(rowid)] = json.loads(vjson)
    except sqlite3.Error as exc:
        logger.warning('memory-studio: limbic vectors unavailable (sqlite_vec not loaded?): %s', exc)
    finally:
        con.close()
    others = [n for n in text_nodes if n['kind'] != 'fact']
    other_vecs = _embed_cached([n['text'] for n in others]) if others else []
    vecs: List[Optional[List[float]]] = []
    for n in text_nodes:
        if n['kind'] == 'fact':
            vecs.append(vec_by_fact.get(n['meta']['fact_id']))
    vecs.extend(other_vecs)
    ordered = [n for n in text_nodes if n['kind'] == 'fact'] + others
    seen = set()
    sims_all: List[float] = []
    for i, a in enumerate(ordered):
        va = vecs[i]
        if va is None:
            continue
        scored = []
        for j, b in enumerate(ordered):
            if i == j or vecs[j] is None:
                continue
            scored.append((_cos(va, vecs[j]), j))
        scored.sort(reverse=True)
        for sim, j in scored[:_GRAPH_SIM_TOPK]:
            sims_all.append(sim)
            if sim < _GRAPH_SIM_FLOOR:
                continue
            key = tuple(sorted((a['id'], ordered[j]['id'])))
            if key in seen:
                continue
            seen.add(key)
            edges.append({'s': key[0], 't': key[1], 'kind': 'similar', 'w': round(sim, 4)})

    kinds: Dict[str, int] = {}
    for n in nodes:
        kinds[n['kind']] = kinds.get(n['kind'], 0) + 1
    ekinds: Dict[str, int] = {}
    for e in edges:
        ekinds[e['kind']] = ekinds.get(e['kind'], 0) + 1
    return {
        'nodes': nodes,
        'edges': edges,
        'stats': {
            'nodes': kinds, 'edges': ekinds,
            'noise_entities': sum(1 for n in nodes if n.get('noise')),
            'shared_entities': sum(1 for en in ent_name_by_id.values() if (en.get('mention_count') or 0) >= 2),
            'sim_floor': _GRAPH_SIM_FLOOR, 'sim_topk': _GRAPH_SIM_TOPK,
            'sim_max': round(max(sims_all), 4) if sims_all else None,
            'generation_ms': int((time.time() - t0) * 1000),
        },
    }


def get_full_snapshot() -> Dict[str, Any]:
    t0 = time.time()
    builtin = get_builtin_payload()
    limbic = get_limbic_payload()
    cm = get_cm_payload()
    cass = get_cass_payload()
    try:
        graph = get_memory_graph(builtin, limbic, cm)
    except Exception as exc:  # graph is optional; never take the snapshot down with it
        logger.exception('memory-studio: graph build failed')
        graph = {'nodes': [], 'edges': [], 'stats': {}, 'error': str(exc)}
    return {
        'plugin': 'memory-studio',
        'version': '1.0.0',
        'generated_at': _now_iso(),
        'generation_ms': int((time.time() - t0) * 1000),
        'builtin': builtin,
        'limbic': limbic,
        'cm': cm,
        'cass': cass,
        'graph': graph,
    }
