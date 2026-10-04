from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.database.db import Base
from src.database.db import engine

from src.auth.models import User
from src.auth.routes import router as auth_router

from src.api.dashboard import router as dashboard_router
from src.api.prediction import router as prediction_router
from src.api.gis import router as gis_router
from src.api.dynamic import router as dynamic_router
from src.api.alerts import router as alerts_router


# ============================================================
# AQUASENTINEL AI
# MAIN FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="AquaSentinel AI",
    description=(
        "AI-powered heavy rainfall and "
        "flood early warning system"
    ),
    version="1.0.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# ============================================================
# DATABASE
# ============================================================

Base.metadata.create_all(
    bind=engine
)


# ============================================================
# API ROUTERS
# ============================================================

app.include_router(
    auth_router
)

app.include_router(
    dashboard_router
)

app.include_router(
    prediction_router
)

app.include_router(
    gis_router
)

app.include_router(
    dynamic_router
)

app.include_router(
    alerts_router
)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():
    return {
        "system": "AquaSentinel AI",
        "status": "online",
        "message": "Backend is running"
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/api/health")
def health():
    return {
        "status": "online",
        "database": "connected",
        "system": "AquaSentinel AI"
    }