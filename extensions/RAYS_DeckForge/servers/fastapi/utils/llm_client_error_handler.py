from fastapi import HTTPException
from openai import APIError as OpenAIAPIError
from google.genai.errors import APIError as GoogleAPIError
import traceback

from llmai.shared.errors import BaseError as LLMAIBaseError


def handle_llm_client_exceptions(e: Exception) -> HTTPException:
    traceback.print_exc()
    if isinstance(e, HTTPException):
        return e

    detail = str(e)
    status_code = 500

    if isinstance(e, LLMAIBaseError):
        status_code = getattr(e, "status_code", 500)
        detail = e.message
    elif isinstance(e, OpenAIAPIError):
        detail = f"OpenAI API error: {e.message}"
    elif isinstance(e, GoogleAPIError):
        detail = f"Google API error: {e.message}"

    # Professional formatting for common issues
    if "does not support tools" in detail.lower():
        return HTTPException(
            status_code=400,
            detail="The selected model does not support tool calling (required for advanced editing). Please switch to a more capable model like Llama 3 or Gemini Pro."
        )

    if "invalid_api_key" in detail.lower() or "incorrect api key" in detail.lower():
        return HTTPException(
            status_code=401,
            detail="Invalid API key. Please check your LLM configuration in settings."
        )

    if "insufficient_quota" in detail.lower() or "rate_limit" in detail.lower():
        return HTTPException(
            status_code=429,
            detail="Rate limit reached or insufficient quota. Please check your LLM provider billing/limits."
        )

    return HTTPException(status_code=status_code, detail=detail)
