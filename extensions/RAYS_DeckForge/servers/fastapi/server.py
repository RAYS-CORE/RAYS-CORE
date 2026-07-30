import uvicorn
import argparse
import os
from api.main import app

# Default public URL for asset generation. This ensures the environment variable
# is available even when the server is started via direct uvicorn command
# (e.g. `uvicorn server:app`) rather than as a script.
if "FASTAPI_PUBLIC_URL" not in os.environ:
    os.environ["FASTAPI_PUBLIC_URL"] = "http://127.0.0.1:8000"

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the FastAPI server")
    parser.add_argument(
        "--port", type=int, required=True, help="Port number to run the server on"
    )
    parser.add_argument(
        "--reload", type=str, default="false", help="Reload the server on code changes"
    )
    args = parser.parse_args()
    reload = args.reload == "true"
    host = "127.0.0.1"

    # Override public URL with the actual runtime port.
    os.environ["FASTAPI_PUBLIC_URL"] = f"http://{host}:{args.port}"
    
    uvicorn.run(
        "api.main:app",
        host=host,
        port=args.port,
        log_level="info",
        reload=reload,
    )