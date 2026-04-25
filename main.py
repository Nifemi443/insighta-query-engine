from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database import init_db, close_pool
from app.routes.profiles import router as profiles_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_pool()


app = FastAPI(title="Insighta Labs API", lifespan=lifespan)

# CORS — required by grading script
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": "Internal server error"},
    )


@app.get("/")
async def root():
    return {"status": "success", "message": "Insighta Labs Intelligence API"}


@app.get("/health")
async def health():
    return {"status": "success", "message": "ok"}


app.include_router(profiles_router, prefix="/api")
