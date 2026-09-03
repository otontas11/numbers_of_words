#!/usr/bin/env python3
"""Local Responses-API router for Codex."""

from __future__ import annotations

import http.client
import json
import os
import tomllib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


HOST = "127.0.0.1"
PORT = int(os.environ.get("CODEX_MODEL_ROUTER_PORT", "8787"))
CHATGPT_BASE = "chatgpt.com"
CHATGPT_PREFIX = "/backend-api/codex"
ZAI_BASE = "api.z.ai"
ZAI_PREFIX = "/api/v1"
HOP_HEADERS = {
    "host",
    "content-length",
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
}
RESPONSE_DROP_HEADERS = {"content-length", "transfer-encoding", "connection", "keep-alive"}


def codex_home() -> Path:
    return Path(os.environ.get("CODEX_HOME", "~/.codex")).expanduser()


def route_for_model(model: str) -> str:
    return "openai" if model.startswith("gpt") else "zai"


def upstream_parts(route: str, request_path: str) -> tuple[str, int, str]:
    path = urlsplit(request_path).path
    suffix = path[len("/v1"):] if path.startswith("/v1/") else path.lstrip("/")
    suffix = suffix.lstrip("/")
    if route == "openai":
        return CHATGPT_BASE, 443, f"{CHATGPT_PREFIX}/{suffix}"
    return ZAI_BASE, 443, f"{ZAI_PREFIX}/{suffix}"


def zai_token() -> str:
    config_path = codex_home() / "config.toml"
    with config_path.open("rb") as handle:
        config = tomllib.load(handle)
    providers = config.get("model_providers", {})
    token = providers.get("ZAI", {}).get("experimental_bearer_token")
    if not token:
        raise RuntimeError("ZAI experimental_bearer_token is not configured")
    return token


class RouterHandler(BaseHTTPRequestHandler):
    server_version = "CodexHybridRouter/1.0"

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"[router] {self.address_string()} {fmt % args}", flush=True)

    def do_GET(self) -> None:
        if urlsplit(self.path).path == "/healthz":
            body = b'{"ok":true}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_error(404)

    def do_POST(self) -> None:
        sent = False
        connection = None
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length)
            request = json.loads(body)
            route = route_for_model(str(request.get("model", "")))
            host, port, upstream_path = upstream_parts(route, self.path)

            headers: dict[str, str] = {}
            for key, value in self.headers.items():
                if key.lower() not in HOP_HEADERS:
                    headers[key] = value

            if route == "zai":
                headers.pop("Authorization", None)
                headers.pop("chatgpt-account-id", None)
                headers["Authorization"] = f"Bearer {zai_token()}"

            headers["Host"] = host
            headers["Content-Length"] = str(len(body))
            headers["Connection"] = "close"

            connection = http.client.HTTPSConnection(host, port, timeout=600)
            connection.request("POST", upstream_path, body=body, headers=headers)
            upstream = connection.getresponse()

            self.send_response(upstream.status, upstream.reason)
            for key, value in upstream.getheaders():
                if key.lower() not in RESPONSE_DROP_HEADERS:
                    self.send_header(key, value)
            self.send_header("Connection", "close")
            self.end_headers()
            sent = True

            while True:
                chunk = upstream.read(8192)
                if not chunk:
                    break
                self.wfile.write(chunk)
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception as exc:
            self.log_error("routing failed: %s", exc)
            if not sent:
                payload = json.dumps({"error": str(exc)}).encode()
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
        finally:
            if connection is not None:
                connection.close()


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), RouterHandler)
    print(f"[router] listening on http://{HOST}:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
