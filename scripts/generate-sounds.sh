#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
OUTPUT_DIR="${PROJECT_DIR}/assets/sounds"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Sesleri üretmek için ffmpeg gerekli." >&2
  exit 1
fi

mkdir -p "${OUTPUT_DIR}"

ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "sine=frequency=520:duration=0.09:sample_rate=44100" \
  -f lavfi -i "sine=frequency=780:duration=0.07:sample_rate=44100" \
  -filter_complex \
  "[0:a]volume=0.18,afade=t=in:st=0:d=0.004,afade=t=out:st=0.025:d=0.065[a0]; \
   [1:a]volume=0.07,afade=t=in:st=0:d=0.004,afade=t=out:st=0.02:d=0.05[a1]; \
   [a0][a1]amix=inputs=2:normalize=0,alimiter=limit=0.8[out]" \
  -map "[out]" -ar 44100 -ac 1 -c:a pcm_s16le "${OUTPUT_DIR}/select.wav"

ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "sine=frequency=523.25:duration=0.2:sample_rate=44100" \
  -f lavfi -i "sine=frequency=659.25:duration=0.2:sample_rate=44100" \
  -f lavfi -i "sine=frequency=783.99:duration=0.22:sample_rate=44100" \
  -f lavfi -i "sine=frequency=1046.5:duration=0.28:sample_rate=44100" \
  -filter_complex \
  "[0:a]volume=0.13,afade=t=in:st=0:d=0.008,afade=t=out:st=0.06:d=0.14[a0]; \
   [1:a]volume=0.13,afade=t=in:st=0:d=0.008,afade=t=out:st=0.06:d=0.14,adelay=70:all=1[a1]; \
   [2:a]volume=0.13,afade=t=in:st=0:d=0.008,afade=t=out:st=0.07:d=0.15,adelay=140:all=1[a2]; \
   [3:a]volume=0.15,afade=t=in:st=0:d=0.008,afade=t=out:st=0.08:d=0.2,adelay=210:all=1[a3]; \
   [a0][a1][a2][a3]amix=inputs=4:normalize=0,alimiter=limit=0.82[out]" \
  -map "[out]" -ar 44100 -ac 1 -c:a pcm_s16le "${OUTPUT_DIR}/success.wav"

ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "sine=frequency=880:duration=0.18:sample_rate=44100" \
  -f lavfi -i "sine=frequency=1174.66:duration=0.18:sample_rate=44100" \
  -f lavfi -i "sine=frequency=1567.98:duration=0.24:sample_rate=44100" \
  -filter_complex \
  "[0:a]volume=0.1,afade=t=in:st=0:d=0.006,afade=t=out:st=0.05:d=0.13[a0]; \
   [1:a]volume=0.09,afade=t=in:st=0:d=0.006,afade=t=out:st=0.05:d=0.13,adelay=65:all=1[a1]; \
   [2:a]volume=0.08,afade=t=in:st=0:d=0.006,afade=t=out:st=0.06:d=0.18,adelay=130:all=1[a2]; \
   [a0][a1][a2]amix=inputs=3:normalize=0,alimiter=limit=0.75[out]" \
  -map "[out]" -ar 44100 -ac 1 -c:a pcm_s16le "${OUTPUT_DIR}/bonus.wav"

ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "anoisesrc=color=pink:duration=0.24:sample_rate=44100" \
  -f lavfi -i "sine=frequency=360:duration=0.13:sample_rate=44100" \
  -filter_complex \
  "[0:a]highpass=f=650,lowpass=f=4200,volume=0.035,afade=t=in:st=0:d=0.025,afade=t=out:st=0.1:d=0.14[a0]; \
   [1:a]volume=0.07,afade=t=in:st=0:d=0.008,afade=t=out:st=0.035:d=0.095[a1]; \
   [a0][a1]amix=inputs=2:normalize=0,alimiter=limit=0.65[out]" \
  -map "[out]" -ar 44100 -ac 1 -c:a pcm_s16le "${OUTPUT_DIR}/shuffle.wav"

ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "sine=frequency=523.25:duration=0.24:sample_rate=44100" \
  -f lavfi -i "sine=frequency=659.25:duration=0.24:sample_rate=44100" \
  -f lavfi -i "sine=frequency=783.99:duration=0.24:sample_rate=44100" \
  -f lavfi -i "sine=frequency=1046.5:duration=0.3:sample_rate=44100" \
  -f lavfi -i "sine=frequency=1318.51:duration=0.34:sample_rate=44100" \
  -filter_complex \
  "[0:a]volume=0.12,afade=t=in:st=0:d=0.008,afade=t=out:st=0.08:d=0.16[a0]; \
   [1:a]volume=0.12,afade=t=in:st=0:d=0.008,afade=t=out:st=0.08:d=0.16,adelay=90:all=1[a1]; \
   [2:a]volume=0.12,afade=t=in:st=0:d=0.008,afade=t=out:st=0.08:d=0.16,adelay=180:all=1[a2]; \
   [3:a]volume=0.14,afade=t=in:st=0:d=0.008,afade=t=out:st=0.1:d=0.2,adelay=280:all=1[a3]; \
   [4:a]volume=0.13,afade=t=in:st=0:d=0.008,afade=t=out:st=0.11:d=0.23,adelay=430:all=1[a4]; \
   [a0][a1][a2][a3][a4]amix=inputs=5:normalize=0,alimiter=limit=0.84[out]" \
  -map "[out]" -ar 44100 -ac 1 -c:a pcm_s16le "${OUTPUT_DIR}/level-complete.wav"

echo "Ses dosyaları ${OUTPUT_DIR} altında üretildi."
