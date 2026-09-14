#!/usr/bin/env python3
"""Generate a short rising coin / score-tally WAV.

Does not wire the sound into the game. Writes a new file next to points.wav
and never overwrites assets/sounds/points.wav.

Usage:
    python3 tools/generate_rising_coin.py

Output:
    assets/sounds/points-rising-coin.wav
    16-bit PCM, 44.1 kHz, mono

Tries ElevenLabs sound-generation when ELEVENLABS_API_KEY or ELEVEN_API_KEY
is set. Otherwise synthesizes a 5-note FM coin arpeggio (numpy if present,
stdlib fallback so the script still runs without an API).
"""

from __future__ import annotations

import json
import math
import os
import random
import struct
import subprocess
import sys
import urllib.error
import urllib.request
import wave
from array import array
from pathlib import Path


SAMPLE_RATE = 44_100
DURATION_S = 0.82
PEAK = 0.86
PROMPT = (
    "short rising coin chime arpeggio, arcade score tally, "
    "bright metallic coin, no music bed, no voice, 0.7 seconds"
)

# C6 E6 G6 C7 E7 — rising major-arpeggio coin tally
NOTE_HZ = (1046.50, 1318.51, 1567.98, 2093.00, 2637.02)
PING_STARTS_S = (0.00, 0.105, 0.210, 0.325, 0.455)

REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = REPO_ROOT / "assets" / "sounds" / "points-rising-coin.wav"
POINTS_WAV = REPO_ROOT / "assets" / "sounds" / "points.wav"

_NP = None


def _try_import_numpy():
    global _NP
    if _NP is not None:
        return _NP
    try:
        import numpy as np

        _NP = np
        return np
    except ImportError:
        return None


def _install_numpy() -> bool:
    if _try_import_numpy() is not None:
        return True
    print("numpy missing; installing into the current Python environment…", file=sys.stderr)
    attempts = (
        [sys.executable, "-m", "pip", "install", "--user", "numpy"],
        [sys.executable, "-m", "pip", "install", "--user", "--break-system-packages", "numpy"],
    )
    for cmd in attempts:
        try:
            subprocess.check_call(cmd)
        except (subprocess.CalledProcessError, OSError) as exc:
            print(f"pip failed ({exc}); trying next installer option…", file=sys.stderr)
            continue
        if _try_import_numpy() is not None:
            return True
    print("numpy install failed; using stdlib synthesis.", file=sys.stderr)
    return False


def _write_wav(path: Path, samples) -> None:
    values = [float(x) for x in samples]
    peak = max((abs(x) for x in values), default=0.0)
    if peak > 0:
        scale = PEAK / peak
        values = [x * scale for x in values]
    pcm = array("h")
    for x in values:
        clipped = max(-0.97, min(0.97, x))
        pcm.append(int(round(clipped * 32767.0)))
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(pcm.tobytes())


def _pcm16_to_mono_float(raw: bytes) -> list[float]:
    if len(raw) < 4 or len(raw) % 2:
        raise ValueError("pcm payload too short or odd-sized")
    samples = array("h")
    samples.frombytes(raw)
    values = [s / 32768.0 for s in samples]
    expected_mono = DURATION_S * SAMPLE_RATE
    stereo_frames = len(values) / 2.0
    if len(values) % 2 == 0 and abs(stereo_frames - expected_mono) < abs(len(values) - expected_mono):
        values = [(values[i] + values[i + 1]) * 0.5 for i in range(0, len(values), 2)]
    return values


def try_elevenlabs() -> bool:
    key = os.environ.get("ELEVENLABS_API_KEY") or os.environ.get("ELEVEN_API_KEY")
    if not key:
        return False

    body = json.dumps(
        {
            "text": PROMPT,
            "duration_seconds": 0.8,
            "prompt_influence": 0.35,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        "https://api.elevenlabs.io/v1/sound-generation?output_format=pcm_44100",
        data=body,
        headers={
            "xi-api-key": key,
            "Content-Type": "application/json",
            "Accept": "application/octet-stream",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            raw = response.read()
        _write_wav(OUTPUT_PATH, _pcm16_to_mono_float(raw))
        return True
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError, TimeoutError, OSError) as exc:
        print(f"ElevenLabs unavailable ({exc}); falling back to synthesis.", file=sys.stderr)
        return False


def _ping_sample(t: float, freq: float, index: int, noise: float, prev_noise: float) -> float:
    attack_s = 0.0012
    tau = 0.078 + index * 0.016
    amp = (1.0 - math.exp(-t / attack_s)) * math.exp(-t / tau)
    mod_hz = freq * 2.017
    index_env = (4.2 - 0.35 * index) * math.exp(-t / 0.016)
    modulator = math.sin(2.0 * math.pi * mod_hz * t)
    carrier = math.sin(2.0 * math.pi * freq * t + index_env * modulator)
    overtone = 0.20 * math.sin(2.0 * math.pi * freq * 2.01 * t) * math.exp(-t / (tau * 0.52))
    sparkle = 0.08 * math.sin(2.0 * math.pi * freq * 3.02 * t) * math.exp(-t / 0.028)
    click = (noise - prev_noise) * math.exp(-t / 0.0038) * (0.16 + 0.015 * index)
    gain = 1.0 - 0.06 * index
    return ((carrier + overtone + sparkle) * amp + click) * gain


def _highpass(mix: list[float]) -> list[float]:
    if not mix:
        return mix
    mean = sum(mix) / len(mix)
    out: list[float] = []
    prev = mix[0] - mean
    for x in mix:
        x = x - mean
        out.append(x - 0.92 * prev)
        prev = x
    return out


def synthesize_numpy() -> None:
    np = _try_import_numpy()
    if np is None:
        raise RuntimeError("numpy unavailable")
    n = int(round(DURATION_S * SAMPLE_RATE))
    mix = np.zeros(n, dtype=np.float64)
    rng = np.random.default_rng(20260912)

    for index, (freq, start_s) in enumerate(zip(NOTE_HZ, PING_STARTS_S)):
        start = int(round(start_s * SAMPLE_RATE))
        remaining = n - start
        if remaining <= 0:
            continue
        t = np.arange(remaining, dtype=np.float64) / SAMPLE_RATE
        attack_s = 0.0012
        tau = 0.078 + index * 0.016
        amp = (1.0 - np.exp(-t / attack_s)) * np.exp(-t / tau)
        mod_hz = freq * 2.017
        index_env = (4.2 - 0.35 * index) * np.exp(-t / 0.016)
        modulator = np.sin(2.0 * np.pi * mod_hz * t)
        carrier = np.sin(2.0 * np.pi * freq * t + index_env * modulator)
        overtone = 0.20 * np.sin(2.0 * np.pi * freq * 2.01 * t) * np.exp(-t / (tau * 0.52))
        sparkle = 0.08 * np.sin(2.0 * np.pi * freq * 3.02 * t) * np.exp(-t / 0.028)
        noise = rng.standard_normal(remaining)
        highpass = np.diff(noise, prepend=noise[:1])
        click = highpass * np.exp(-t / 0.0038) * (0.16 + 0.015 * index)
        ping = (carrier + overtone + sparkle) * amp + click
        mix[start:] += ping * (1.0 - 0.06 * index)

    mix = mix - np.mean(mix)
    mix = mix - 0.92 * np.concatenate(([mix[0]], mix[:-1]))
    _write_wav(OUTPUT_PATH, mix)


def synthesize_stdlib() -> None:
    n = int(round(DURATION_S * SAMPLE_RATE))
    mix = [0.0] * n
    rng = random.Random(20260912)

    for index, (freq, start_s) in enumerate(zip(NOTE_HZ, PING_STARTS_S)):
        start = int(round(start_s * SAMPLE_RATE))
        remaining = n - start
        if remaining <= 0:
            continue
        prev_noise = 0.0
        for i in range(remaining):
            t = i / SAMPLE_RATE
            noise = rng.gauss(0.0, 1.0)
            mix[start + i] += _ping_sample(t, freq, index, noise, prev_noise)
            prev_noise = noise

    _write_wav(OUTPUT_PATH, _highpass(mix))


def synthesize() -> str:
    if _try_import_numpy() is not None or _install_numpy():
        synthesize_numpy()
        return "numpy-synthesis"
    synthesize_stdlib()
    return "stdlib-synthesis"


def _report(source: str) -> None:
    with wave.open(str(OUTPUT_PATH), "rb") as wav:
        channels = wav.getnchannels()
        sampwidth = wav.getsampwidth()
        rate = wav.getframerate()
        frames = wav.getnframes()
        duration = frames / float(rate)
        raw = wav.readframes(frames)

    peak = 0
    for (sample,) in struct.iter_unpack("<h", raw):
        peak = max(peak, abs(sample))

    print(f"source: {source}")
    print(f"wrote: {OUTPUT_PATH}")
    print(
        f"format: {channels} ch, {sampwidth * 8}-bit PCM, {rate} Hz, "
        f"{duration:.3f}s, peak={peak}/32767"
    )
    if POINTS_WAV.resolve() == OUTPUT_PATH.resolve():
        raise SystemExit("refusing to overwrite points.wav")
    if not POINTS_WAV.exists():
        print(f"note: existing tally tick is missing at {POINTS_WAV}", file=sys.stderr)


def main() -> int:
    if OUTPUT_PATH.resolve() == POINTS_WAV.resolve():
        print("refusing to overwrite assets/sounds/points.wav", file=sys.stderr)
        return 1

    source = "elevenlabs"
    if not try_elevenlabs():
        source = synthesize()

    _report(source)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
