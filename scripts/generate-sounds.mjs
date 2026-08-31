import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 44_100;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputDirectory = resolve(scriptDirectory, '../assets/sounds');

function renderExponentialChirp({
  startFrequency,
  endFrequency,
  duration,
  startGain,
  endGain,
}) {
  const sampleCount = Math.ceil(duration * SAMPLE_RATE);
  const samples = new Float64Array(sampleCount);
  const frequencyGrowth = Math.log(endFrequency / startFrequency) / duration;
  const gainRatio = endGain / startGain;

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / SAMPLE_RATE;
    const progress = Math.min(1, time / duration);
    const phase =
      (2 * Math.PI * startFrequency * (Math.exp(frequencyGrowth * time) - 1)) /
      frequencyGrowth;
    const gain = startGain * Math.pow(gainRatio, progress);
    samples[index] = Math.sin(phase) * gain;
  }

  return samples;
}

function renderPop(startFrequency) {
  return renderExponentialChirp({
    startFrequency,
    endFrequency: startFrequency * 1.4,
    duration: 0.08,
    startGain: 0.15,
    endGain: 0.01,
  });
}

function triangle(phase) {
  return (2 / Math.PI) * Math.asin(Math.sin(phase));
}

function renderSuccess() {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  const noteDelay = 0.07;
  const noteDuration = 0.25;
  const attackDuration = 0.02;
  const totalDuration = noteDelay * (notes.length - 1) + noteDuration;
  const samples = new Float64Array(Math.ceil(totalDuration * SAMPLE_RATE));

  notes.forEach((frequency, noteIndex) => {
    const noteStart = noteIndex * noteDelay;
    const startSample = Math.floor(noteStart * SAMPLE_RATE);
    const endSample = Math.min(samples.length, Math.ceil((noteStart + noteDuration) * SAMPLE_RATE));

    for (let index = startSample; index < endSample; index += 1) {
      const localTime = index / SAMPLE_RATE - noteStart;
      const gain =
        localTime <= attackDuration
          ? 0.2 * (localTime / attackDuration)
          : 0.2 *
            Math.pow(
              0.001 / 0.2,
              (localTime - attackDuration) / (noteDuration - attackDuration),
            );
      samples[index] += triangle(2 * Math.PI * frequency * localTime) * gain;
    }
  });

  return samples;
}

function writePcmWave(filename, samples) {
  const bytesPerSample = BITS_PER_SAMPLE / 8;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(CHANNELS, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * CHANNELS * bytesPerSample, 28);
  buffer.writeUInt16LE(CHANNELS * bytesPerSample, 32);
  buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let peak = 0;
  samples.forEach((sample, index) => {
    const finiteSample = Number.isFinite(sample) ? sample : 0;
    const clampedSample = Math.max(-1, Math.min(1, finiteSample));
    peak = Math.max(peak, Math.abs(clampedSample));
    const integerSample =
      clampedSample < 0 ? Math.round(clampedSample * 32_768) : Math.round(clampedSample * 32_767);
    buffer.writeInt16LE(integerSample, 44 + index * bytesPerSample);
  });

  writeFileSync(resolve(outputDirectory, filename), buffer);
  const duration = samples.length / SAMPLE_RATE;
  const peakDb = peak > 0 ? 20 * Math.log10(peak) : Number.NEGATIVE_INFINITY;
  console.log(`${filename}: ${duration.toFixed(3)} sn, peak ${peakDb.toFixed(1)} dBFS`);
}

mkdirSync(outputDirectory, { recursive: true });

const success = renderSuccess();

[
  ['select.wav', 420],
  ['select-2.wav', 600],
  ['select-3.wav', 690],
  ['select-4.wav', 780],
  ['select-5.wav', 870],
  ['select-6.wav', 960],
  ['select-7.wav', 1050],
].forEach(([filename, frequency]) => {
  writePcmWave(filename, renderPop(frequency));
});
writePcmWave('hint.wav', renderPop(620));
writePcmWave('shuffle.wav', renderPop(360));
writePcmWave('success.wav', success);
writePcmWave(
  'bonus.wav',
  renderExponentialChirp({
    startFrequency: 880,
    endFrequency: 1320,
    duration: 0.15,
    startGain: 0.2,
    endGain: 0.01,
  }),
);

// Referans HTML bölüm sonunda ikinci bir ses çalmaz. Dosya geriye dönük paket
// uyumluluğu için geçerli PCM olarak tutulur; runtime tarafından kullanılmaz.
writePcmWave('level-complete.wav', success);
