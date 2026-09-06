from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jwt import InvalidTokenError

from app.config import settings
from app.errors import ApiError
from app.routers import analytics, auth, client, departments, surveys, users

app = FastAPI(title="社内アンケート基盤 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(departments.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(surveys.router, prefix="/api/v1")
app.include_router(client.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")


@app.exception_handler(ApiError)
async def handle_api_error(_request, exc: ApiError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"error_code": exc.error_code, "message_key": exc.message_key})


@app.exception_handler(RequestValidationError)
async def handle_validation(_request, _exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"error_code": "VALIDATION_ERROR", "message_key": "error.validation"})


@app.exception_handler(InvalidTokenError)
async def handle_jwt(_request, _exc: InvalidTokenError) -> JSONResponse:
    return JSONResponse(status_code=401, content={"error_code": "UNAUTHENTICATED", "message_key": "error.unauthenticated"})


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
