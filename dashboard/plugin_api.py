"""Memory Studio FastAPI router mounted at /api/plugins/memory-studio/.

Dynamically reloads memory_studio_impl.py on file modification so backend updates
take effect immediately without restarting the gateway.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any, Dict

from fastapi import APIRouter, Body, HTTPException, Query

router = APIRouter()

_IMPL_PATH = Path(__file__).resolve().parent / 'memory_studio_impl.py'
_IMPL_MOD = None
_IMPL_MTIME = 0.0


def _impl():
    global _IMPL_MOD, _IMPL_MTIME
    mtime = _IMPL_PATH.stat().st_mtime
    if _IMPL_MOD is None or mtime != _IMPL_MTIME:
        spec = importlib.util.spec_from_file_location('memory_studio_impl', str(_IMPL_PATH))
        mod = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        spec.loader.exec_module(mod)
        _IMPL_MOD = mod
        _IMPL_MTIME = mtime
    return _IMPL_MOD


@router.get('/snapshot')
async def api_snapshot() -> Dict[str, Any]:
    try:
        return _impl().get_full_snapshot()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post('/builtin/update')
async def api_builtin_update(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    try:
        return _impl().update_builtin_memory(
            target=str(payload.get('target') or 'memory'),
            action=str(payload.get('action') or 'add'),
            content=str(payload.get('content') or ''),
            index=payload.get('index'),
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post('/limbic/remember')
async def api_limbic_remember(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    try:
        return _impl().limbic_remember(
            content=str(payload.get('content') or ''),
            user_id=str(payload.get('user_id') or 'anthony'),
            trust_score=float(payload.get('trust_score') or 0.70),
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post('/limbic/feedback')
async def api_limbic_feedback(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    try:
        return _impl().limbic_feedback(
            fact_id=int(payload.get('fact_id') or 0),
            signal=str(payload.get('signal') or 'helpful'),
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post('/limbic/forget')
async def api_limbic_forget(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    try:
        return _impl().limbic_forget(fact_id=int(payload.get('fact_id') or 0))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get('/limbic/recall')
async def api_limbic_recall(
    q: str = Query('', description='Recall query'),
    limit: str = Query('8'),
    user_id: str = Query('anthony'),
) -> Dict[str, Any]:
    try:
        return _impl().limbic_recall_test(query=q, limit=int(limit or 8), user_id=user_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post('/cm/add')
async def api_cm_add(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    try:
        tags = payload.get('tags')
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(',') if t.strip()]
        return _impl().cm_add_rule(
            content=str(payload.get('content') or ''),
            category=str(payload.get('category') or 'general'),
            kind=str(payload.get('kind') or 'rule'),
            maturity=str(payload.get('maturity') or 'established'),
            scope=str(payload.get('scope') or 'global'),
            tags=tags if isinstance(tags, list) else [],
            pinned=bool(payload.get('pinned', False)),
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post('/cm/mark')
async def api_cm_mark(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    try:
        return _impl().cm_mark_rule(
            bullet_id=str(payload.get('bullet_id') or ''),
            helpful=bool(payload.get('helpful', True)),
            reason=str(payload.get('reason') or 'Memory Studio feedback'),
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post('/cm/remove')
async def api_cm_remove(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    try:
        return _impl().cm_remove_rule(bullet_id=str(payload.get('bullet_id') or ''))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post('/cm/starter/apply')
async def api_cm_starter_apply(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    try:
        return _impl().cm_apply_starter(starter_name=str(payload.get('starter_name') or ''))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post('/cm/starter/create')
async def api_cm_starter_create(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    try:
        return _impl().cm_create_starter(
            name=str(payload.get('name') or ''),
            description=str(payload.get('description') or ''),
            rules=payload.get('rules') or [],
            apply_now=bool(payload.get('apply_now', True)),
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get('/cm/context')
async def api_cm_context(task: str = Query('', description='Task description for cm context')) -> Dict[str, Any]:
    try:
        return _impl().cm_context_test(task=task)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get('/cass/search')
async def api_cass_search(
    q: str = Query('', description='CASS search query'),
    agent: str = Query('', description='Agent filter'),
    workspace: str = Query('', description='Workspace filter'),
    days: str = Query('0'),
    limit: str = Query('25'),
) -> Dict[str, Any]:
    try:
        return _impl().cass_search(query=q, agent=agent, workspace=workspace, days=int(days or 0), limit=int(limit or 25))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post('/cass/sync')
async def api_cass_sync() -> Dict[str, Any]:
    try:
        return _impl().cass_sync_hermes()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def register(app, ctx) -> None:
    app.include_router(router, prefix=ctx.prefix)
