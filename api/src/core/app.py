"""FastAPI app factory: constructs the app and includes routers under /api.

An internal process boundary between simulation/control and the Next.js
dashboard — not a public third-party API surface (see
ARCHITECTURE.md#internal-api-and-dashboard).
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import controls, scenarios, snapshots, streams


def create_app() -> FastAPI:
    app = FastAPI(
        title="MaHanya internal relay",
        description="Internal FastAPI boundary between the SUMO/scheduler backend and dashboard",
        version="0.1.0",
    )

    # The dashboard is a statically exported SPA served separately (or via
    # `next dev` in development), so cross-origin requests to /api/* are
    # expected; this is an internal relay, not a public API, so a permissive
    # policy is acceptable here.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(scenarios.router, prefix="/api")
    app.include_router(controls.router, prefix="/api")
    app.include_router(snapshots.router, prefix="/api")
    app.include_router(streams.router, prefix="/api")

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
