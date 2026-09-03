#!/usr/bin/env python3
"""Install a hybrid Codex model catalog backed by a local model router."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path


LABEL = "com.oktaytontas.codex-model-router"
PORT = 8787
OPENAI_MODELS = [
    "gpt-5.6-sol",
    "gpt-5.6-terra",
    "gpt-5.6-luna",
    "gpt-5.5",
]
DISPLAY_NAMES = {
    "gpt-5.6-sol": "GPT-5.6 Sol (OpenAI)",
    "gpt-5.6-terra": "GPT-5.6 Terra (OpenAI)",
    "gpt-5.6-luna": "GPT-5.6 Luna (OpenAI)",
    "gpt-5.5": "GPT-5.5 (OpenAI)",
}


def codex_home() -> Path:
    return Path(os.environ.get("CODEX_HOME", "~/.codex")).expanduser()


def launch_agents_dir() -> Path:
    return Path(
        os.environ.get(
            "CODEX_ROUTER_LAUNCH_AGENTS_DIR",
            "~/Library/LaunchAgents",
        )
    ).expanduser()


def set_toml_value(text: str, key: str, value: str) -> str:
    pattern = rf"(?m)^{re.escape(key)}\s*=.*$"
    replacement = f'{key} = "{value}"'
    if re.search(pattern, text):
        return re.sub(pattern, replacement, text, count=1)
    return replacement + "\n\n" + text


def remove_provider_block(text: str) -> str:
    output: list[str] = []
    skipping = False
    for line in text.splitlines(keepends=True):
        if line.strip() == "[model_providers.Hybrid]":
            skipping = True
            continue
        if skipping and line.startswith("[") and line.rstrip().endswith("]"):
            skipping = False
        if not skipping:
            output.append(line)
    return "".join(output).rstrip() + "\n"


def build_catalog(codex_home: Path) -> dict:
    custom_path = codex_home / "models.json"
    cache_path = codex_home / "models_cache.json"
    custom = json.loads(custom_path.read_text()) if custom_path.exists() else {"models": []}
    cached = json.loads(cache_path.read_text()) if cache_path.exists() else {"models": []}

    selected: dict[str, dict] = {}
    for model in custom.get("models", []):
        if model.get("visibility") == "list" and model.get("slug", "").startswith("glm"):
            selected[model["slug"]] = dict(model)

    for model in cached.get("models", []):
        slug = model.get("slug")
        if model.get("visibility") == "list" and slug in OPENAI_MODELS:
            selected[slug] = dict(model)

    missing = sorted(set(OPENAI_MODELS) - selected.keys())
    if missing:
        raise RuntimeError(f"OpenAI catalog entries are missing: {', '.join(missing)}")
    if not any(slug.startswith("glm") for slug in selected):
        raise RuntimeError("No visible GLM model was found in models.json")

    priorities = {"gpt-5.6-sol": 1, "gpt-5.6-terra": 2, "gpt-5.6-luna": 3, "gpt-5.5": 4}
    models = []
    for slug, model in selected.items():
        if slug.startswith("glm"):
            model["display_name"] = f"{model.get('display_name', slug)} (Z.ai)"
            model["priority"] = 0
        else:
            model["display_name"] = DISPLAY_NAMES[slug]
            model["priority"] = priorities[slug]
        models.append(model)

    models.sort(key=lambda model: model.get("priority", 999))
    return {"models": models}


def provider_block() -> str:
    return f'''
[model_providers.Hybrid]
name = "Hybrid (Z.ai + OpenAI)"
base_url = "http://127.0.0.1:{PORT}/v1"
wire_api = "responses"
requires_openai_auth = true
supports_websockets = false
supports_standalone_web_search = false
'''


def write_launch_agent(codex_home: Path, destination: Path) -> None:
    python = sys.executable
    router = codex_home / "codex_hybrid_router.py"
    plist = f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>{LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>{python}</string>
    <string>{router}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>CODEX_HOME</key><string>{codex_home}</string>
    <key>CODEX_MODEL_ROUTER_PORT</key><string>{PORT}</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>{codex_home / "codex_model_router.log"}</string>
  <key>StandardErrorPath</key><string>{codex_home / "codex_model_router.log"}</string>
</dict>
</plist>
'''
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(plist)


def wait_for_router(seconds: int = 20) -> bool:
    url = f"http://127.0.0.1:{PORT}/healthz"
    for _ in range(seconds):
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                return response.status == 200
        except Exception:
            time.sleep(1)
    return False


def main() -> None:
    home = codex_home()
    home.mkdir(parents=True, exist_ok=True)
    config_path = home / "config.toml"
    if not config_path.exists():
        raise RuntimeError(f"Config not found: {config_path}")

    backup = config_path.with_name(f"config.toml.before-hybrid-{int(time.time())}")
    shutil.copy2(config_path, backup)

    catalog = build_catalog(home)
    catalog_path = home / "models_hybrid.json"
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n")

    router_source = Path(__file__).with_name("codex_hybrid_router.py")
    router_destination = home / "codex_hybrid_router.py"
    shutil.copy2(router_source, router_destination)
    router_destination.chmod(0o755)

    config = config_path.read_text()
    config = set_toml_value(config, "model", "glm-5.3-flash")
    config = set_toml_value(config, "model_provider", "Hybrid")
    config = set_toml_value(config, "model_catalog_json", str(catalog_path))
    config = remove_provider_block(config)
    config = config.rstrip() + "\n" + provider_block()
    config_path.write_text(config)

    load_agent = os.environ.get("CODEX_ROUTER_LOAD", "1") != "0"
    if load_agent:
        plist_path = launch_agents_dir() / f"{LABEL}.plist"
        write_launch_agent(home, plist_path)
        uid = os.getuid()
        subprocess.run(["launchctl", "bootout", f"gui/{uid}", LABEL], check=False)
        subprocess.run(["launchctl", "bootstrap", f"gui/{uid}", str(plist_path)], check=True)
        subprocess.run(["launchctl", "kickstart", "-k", f"gui/{uid}/{LABEL}"], check=True)
        if not wait_for_router():
            raise RuntimeError("Model router did not become healthy; see its log")

    print(f"Backed up config to: {backup}")
    print(f"Wrote catalog: {catalog_path}")
    print(f"Installed router: {router_destination}")
    if load_agent:
        print(f"LaunchAgent: {LABEL}")
        print("Router health: OK")
    else:
        print("LaunchAgent install/load skipped (CODEX_ROUTER_LOAD=0)")
    print("Run: codex debug models")


if __name__ == "__main__":
    main()
