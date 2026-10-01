#!/usr/bin/env python3
"""Build a loop-friendly puzzle BGM from the existing journey bed.

Does not overwrite assets/sounds/journey.mp3. Writes a new candidate file.

Usage:
    python3 tools/generate_bgm_loop.py

Output:
    assets/sounds/bgm-loop.mp3
    stereo, 256 kbps CBR, same sample rate as the source

No music-generation API key is required. If SUNO / REPLICATE / ELEVENLABS
music keys are present this script still refuses to invent a new composition
from a short SFX endpoint — it loop-masters the existing bed (F major,
~108 BPM, cut before the cadence / fade-to-silence).
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import wave
from pathlib import Path


BPM = 108.0
CROSSFADE_S = 1.6
EDGE_FADE_S = 0.004
CADENCE_SEARCH_START_S = 92.0
REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = REPO_ROOT / "assets" / "sounds" / "journey.mp3"
OUTPUT_MP3 = REPO_ROOT / "assets" / "sounds" / "bgm-loop.mp3"


def _try_import_numpy():
    try:
        import numpy as np
    except ImportError:
        return None
    return np


def _install_numpy():
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
    return False


def _require_ffmpeg() -> str:
    from shutil import which

    ffmpeg = which("ffmpeg")
    if not ffmpeg:
        raise SystemExit("ffmpeg is required to decode journey.mp3 and encode bgm-loop.mp3")
    return ffmpeg


def _decode_source(ffmpeg: str, wav_path: Path) -> None:
    subprocess.check_call(
        [
            ffmpeg,
            "-y",
            "-i",
            str(SOURCE_PATH),
            "-acodec",
            "pcm_s16le",
            str(wav_path),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def _read_wav(path: Path):
    np = _try_import_numpy()
    if np is None:
        raise RuntimeError("numpy unavailable")
    with wave.open(str(path), "rb") as wav:
        channels = wav.getnchannels()
        sampwidth = wav.getsampwidth()
        rate = wav.getframerate()
        frames = wav.getnframes()
        raw = wav.readframes(frames)
    if sampwidth != 2:
        raise RuntimeError(f"expected 16-bit PCM, got {sampwidth * 8}-bit")
    samples = np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768.0
    if channels == 1:
        samples = np.column_stack((samples, samples))
    else:
        samples = samples.reshape(-1, channels)[:, :2]
    return samples, rate


def _write_wav(path: Path, samples, rate: int) -> None:
    np = _try_import_numpy()
    if np is None:
        raise RuntimeError("numpy unavailable")
    peak = float(np.max(np.abs(samples)))
    if peak > 0.97:
        samples = samples * (0.97 / peak)
    pcm = np.clip(np.round(samples * 32767.0), -32767, 32767).astype(np.int16)
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(pcm.tobytes())


def _block_rms(mono, rate: int, hop_s: float = 0.05):
    np = _try_import_numpy()
    hop = max(1, int(round(rate * hop_s)))
    n = (len(mono) // hop) * hop
    blocks = mono[:n].reshape(-1, hop)
    return np.sqrt(np.mean(blocks * blocks, axis=1)), hop


def _snap_to_beat(seconds: float) -> float:
    beat = 60.0 / BPM
    beats = max(1, round(seconds / beat))
    return beats * beat


def _choose_loop_end(samples, rate: int) -> float:
    np = _try_import_numpy()
    mono = samples.mean(axis=1)
    duration = len(mono) / rate
    rms, hop = _block_rms(mono, rate)
    times = np.arange(len(rms)) * (hop / rate)
    mid = rms[(times >= 20.0) & (times < 80.0)]
    median = float(np.median(mid)) if len(mid) else float(np.median(rms))
    search = (times >= CADENCE_SEARCH_START_S) & (times < duration - 0.25)
    search_rms = rms[search]
    search_t = times[search]
    if len(search_rms) == 0:
        return _snap_to_beat(max(CROSSFADE_S * 4, duration - 4.0))

    # Cadence = last strong swell followed by a collapse toward silence.
    peak_i = int(np.argmax(search_rms))
    peak_t = float(search_t[peak_i])
    collapse_t = peak_t
    for t, value in zip(search_t[peak_i:], search_rms[peak_i:]):
        if value < median * 0.35:
            collapse_t = float(t)
            break

    # Stay in mid-tension: at least 1.6s before the swell, while still loud.
    cut = peak_t - max(CROSSFADE_S, 60.0 / BPM * 3)
    loud = times[(times >= 80.0) & (times <= peak_t) & (rms >= median * 0.78)]
    if len(loud):
        cut = min(cut, float(loud[-1]))
    cut = min(cut, collapse_t - 0.75)
    cut = max(CROSSFADE_S * 8, cut)
    cut = min(cut, duration - 0.5)
    return _snap_to_beat(cut)


def _edge_fade(samples, rate: int):
    np = _try_import_numpy()
    n = int(round(EDGE_FADE_S * rate))
    if n <= 1 or len(samples) < n * 4:
        return samples
    ramp = np.linspace(0.0, 1.0, n, endpoint=True)
    fade = np.sin(ramp * (np.pi * 0.5))
    samples = samples.copy()
    samples[:n] *= fade[:, None]
    samples[-n:] *= fade[::-1, None]
    return samples


def _encode_mp3(ffmpeg: str, wav_path: Path, mp3_path: Path) -> None:
    subprocess.check_call(
        [
            ffmpeg,
            "-y",
            "-i",
            str(wav_path),
            "-codec:a",
            "libmp3lame",
            "-b:a",
            "256k",
            "-ac",
            "2",
            str(mp3_path),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def _report(samples, rate: int, loop_end_s: float, source: str) -> None:
    np = _try_import_numpy()
    mono = samples.mean(axis=1)
    duration = len(mono) / rate
    head = float(np.sqrt(np.mean(mono[: int(0.5 * rate)] ** 2)))
    tail = float(np.sqrt(np.mean(mono[-int(0.5 * rate) :] ** 2)))
    size = OUTPUT_MP3.stat().st_size if OUTPUT_MP3.exists() else 0
    print(f"source: {source}")
    print(f"input: {SOURCE_PATH}")
    print(f"wrote: {OUTPUT_MP3}")
    print(
        f"loop: {duration:.3f}s @ {rate} Hz stereo, cut={loop_end_s:.3f}s, "
        f"BPM={BPM:.0f}, player-crossfade={int(CROSSFADE_S * 1000)}ms"
    )
    print(f"rms: head0.5s={head:.4f} tail0.5s={tail:.4f} mp3_bytes={size}")
    if SOURCE_PATH.resolve() == OUTPUT_MP3.resolve():
        raise SystemExit("refusing to overwrite journey.mp3")


def _music_api_key_present() -> bool:
    names = (
        "SUNO_API_KEY",
        "REPLICATE_API_TOKEN",
        "REPLICATE_API_KEY",
        "ELEVENLABS_API_KEY",
        "ELEVEN_API_KEY",
        "OPENAI_API_KEY",
    )
    return any(os.environ.get(name) for name in names)


def main() -> int:
    if not SOURCE_PATH.exists():
        print(f"missing source bed: {SOURCE_PATH}", file=sys.stderr)
        return 1
    if OUTPUT_MP3.resolve() == SOURCE_PATH.resolve():
        print("refusing to overwrite assets/sounds/journey.mp3", file=sys.stderr)
        return 1
    if not _install_numpy():
        print("numpy is required to loop-master the bed", file=sys.stderr)
        return 1

    ffmpeg = _require_ffmpeg()
    if _music_api_key_present():
        print(
            "music API key detected, but this generator loop-masters journey.mp3 "
            "instead of calling a short SFX endpoint.",
            file=sys.stderr,
        )

    with tempfile.TemporaryDirectory(prefix="bgm-loop-") as tmp:
        decoded = Path(tmp) / "journey.wav"
        _decode_source(ffmpeg, decoded)
        samples, rate = _read_wav(decoded)
        loop_end_s = _choose_loop_end(samples, rate)
        cut = int(round(loop_end_s * rate))
        loop = _edge_fade(samples[:cut], rate)
        pcm_path = Path(tmp) / "bgm-loop.wav"
        _write_wav(pcm_path, loop, rate)
        _encode_mp3(ffmpeg, pcm_path, OUTPUT_MP3)

    _report(loop, rate, loop_end_s, "journey-loop-master")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
