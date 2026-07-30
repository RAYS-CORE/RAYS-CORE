from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from starlette.responses import JSONResponse

import os
from utils.simple_auth import (
    clear_session_cookie,
    create_session_token,
    get_auth_status,
    get_session_token_from_request,
    is_auth_configured,
    set_session_cookie,
    setup_initial_credentials,
    verify_credentials,
    _load_user_config,
    _save_user_config,
)
from utils.get_env import is_disable_auth_enabled, get_can_change_keys_env


API_V1_AUTH_ROUTER = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


class AuthCredentialsRequest(BaseModel):
    username: str = Field(min_length=3, max_length=128)
    password: str = Field(min_length=6, max_length=256)


@API_V1_AUTH_ROUTER.get("/status")
async def get_status(request: Request):
    if is_disable_auth_enabled():
        return {"configured": True, "authenticated": True, "username": "local"}
    token = get_session_token_from_request(request)
    return get_auth_status(token)


@API_V1_AUTH_ROUTER.get("/verify")
async def verify_session(request: Request):
    if is_disable_auth_enabled():
        return {"authenticated": True, "username": "local"}
    auth_status = get_auth_status(get_session_token_from_request(request))
    if not auth_status["configured"] or not auth_status["authenticated"]:
        raise HTTPException(status_code=401, detail="Unauthorized")

    return {
        "authenticated": True,
        "username": auth_status.get("username"),
    }


@API_V1_AUTH_ROUTER.post("/setup")
async def setup_credentials(body: AuthCredentialsRequest, request: Request):
    if is_auth_configured():
        raise HTTPException(status_code=409, detail="Credentials already configured")

    try:
        setup_initial_credentials(body.username, body.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    username = body.username.strip()
    return JSONResponse(
        {
            "configured": True,
            "authenticated": False,
            "username": username,
        }
    )


@API_V1_AUTH_ROUTER.post("/login")
async def login(body: AuthCredentialsRequest, request: Request):
    if not is_auth_configured():
        raise HTTPException(status_code=428, detail="Login setup is required")

    if not verify_credentials(body.username, body.password):
        raise HTTPException(status_code=401, detail="Unauthorized")

    username = body.username.strip()
    token = create_session_token(username)
    response = JSONResponse(
        {"configured": True, "authenticated": True, "username": username}
    )
    set_session_cookie(response, token, request)
    return response


@API_V1_AUTH_ROUTER.post("/logout")
async def logout(request: Request):
    response = JSONResponse({"success": True})
    clear_session_cookie(response, request)
    return response


@API_V1_AUTH_ROUTER.get("/can-change-keys")
async def get_can_change_keys():
    return {"canChange": get_can_change_keys_env() != "false"}


@API_V1_AUTH_ROUTER.get("/user-config")
async def get_user_config_endpoint():
    config = _load_user_config()
    sanitized = {
        k: v
        for k, v in config.items()
        if k not in ("AUTH_USERNAME", "AUTH_PASSWORD_HASH", "AUTH_SECRET_KEY")
    }
    return sanitized


@API_V1_AUTH_ROUTER.post("/user-config")
async def post_user_config_endpoint(body: dict):
    config = _load_user_config()
    incoming = {
        k: v
        for k, v in body.items()
        if k not in ("AUTH_USERNAME", "AUTH_PASSWORD_HASH", "AUTH_SECRET_KEY")
    }
    config.update(incoming)
    _save_user_config(config)
    sanitized = {
        k: v
        for k, v in config.items()
        if k not in ("AUTH_USERNAME", "AUTH_PASSWORD_HASH", "AUTH_SECRET_KEY")
    }
    return sanitized


@API_V1_AUTH_ROUTER.get("/telemetry-status")
async def get_telemetry_status():
    config = _load_user_config()
    file_disabled = config.get("DISABLE_ANONYMOUS_TRACKING")
    env_disabled = os.getenv("DISABLE_ANONYMOUS_TRACKING") in ("true", "True")
    is_disabled = env_disabled or file_disabled in ("true", "True", True)
    return {"telemetryEnabled": not is_disabled}

