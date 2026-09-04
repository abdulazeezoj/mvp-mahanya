"""WebSocket relay: /api/streams/{scenario_id}, live simulation ticks.

Read-only telemetry, so a simple poll-and-push loop against the session's
thread-safe latest snapshot is sufficient; no bidirectional control flows
over this channel (controls.py owns run/pause/step/reset).
"""

from __future__ import annotations

import asyncio
import contextlib

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from core.deps import SessionRegistry, get_registry
from mahanya.schemas import DecisionLogRecord

router = APIRouter(prefix="/streams", tags=["streams"])


@router.websocket("/{scenario_id}")
async def stream_scenario(
    websocket: WebSocket,
    scenario_id: str,
    registry: SessionRegistry = Depends(get_registry),
) -> None:
    await websocket.accept()
    session = registry.get_or_create(scenario_id)
    last_tick: int | None = None
    with contextlib.suppress(WebSocketDisconnect):
        while True:
            state = session.latest_state()
            decision = session.latest_decision()
            if state is not None and decision is not None and state.tick != last_tick:
                last_tick = state.tick
                record = DecisionLogRecord(state=state, decision=decision)
                await websocket.send_text(record.model_dump_json(by_alias=True))
            await asyncio.sleep(session.refresh_interval_sec)
