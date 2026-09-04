#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { statfs } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { networkInterfaces } from 'node:os';
import process from 'node:process';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const appJson = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
const expoConfig = appJson.expo ?? appJson;
const androidApplicationId = expoConfig.android?.package;
const iosBundleIdentifier = expoConfig.ios?.bundleIdentifier;
const developmentClientScheme = `exp+${String(expoConfig.slug ?? '').replace(/[^a-zA-Z0-9+.-]/g, '')}`;
const requestedPlatform = process.argv[2] ?? 'all';
const supportedPlatforms = new Set(['all', 'android', 'ios']);
const metroPort = process.env.DEVICE_METRO_PORT ?? '8083';
const metroMode = process.env.DEVICE_METRO_MODE ?? 'lan';
const explicitMetroUrl = process.env.DEVICE_METRO_URL?.replace(/\/$/, '');
const supportedMetroModes = new Set(['lan', 'localhost', 'tunnel']);

if (!supportedPlatforms.has(requestedPlatform)) {
  console.error('Kullanım: npm run devices -- [all|android|ios]');
  process.exit(2);
}

if (!/^\d+$/.test(metroPort) || Number(metroPort) < 1 || Number(metroPort) > 65535) {
  console.error('DEVICE_METRO_PORT, 1-65535 arasında bir port olmalıdır.');
  process.exit(2);
}

if (!supportedMetroModes.has(metroMode)) {
  console.error('DEVICE_METRO_MODE; lan, localhost veya tunnel olmalıdır.');
  process.exit(2);
}

if (!androidApplicationId || !iosBundleIdentifier || developmentClientScheme === 'exp+') {
  console.error('app.json içinde slug, android.package ve ios.bundleIdentifier tanımlı olmalıdır.');
  process.exit(2);
}

function runForOutput(command, args) {
  return spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function detectAndroidDevices() {
  const adbResult = runForOutput('adb', ['devices', '-l']);
  if (adbResult.error?.code === 'ENOENT') {
    return { devices: [], unavailableReason: 'adb bulunamadı (Android SDK platform-tools gerekli).' };
  }
  if (adbResult.status !== 0) {
    return { devices: [], unavailableReason: adbResult.stderr.trim() || 'adb cihazları okuyamadı.' };
  }

  const candidates = adbResult.stdout
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [serial, state] = line.split(/\s+/, 2);
      const cliName = line.match(/\bmodel:([^\s]+)/)?.[1] ?? serial;
      return { id: serial, name: cliName.replaceAll('_', ' '), cliName, state };
    })
    .filter((device) => device.state === 'device');

  const devices = candidates.filter((device) => {
    const emulatorResult = runForOutput('adb', [
      '-s',
      device.id,
      'shell',
      'getprop',
      'ro.kernel.qemu',
    ]);
    return emulatorResult.status === 0 && emulatorResult.stdout.trim() !== '1';
  });

  return { devices, unavailableReason: null };
}

function detectIosDevices() {
  if (process.platform !== 'darwin') {
    return { devices: [], unavailableReason: 'iOS fiziksel cihaz derlemesi macOS gerektirir.' };
  }

  const xcodeResult = runForOutput('xcrun', ['xcdevice', 'list']);
  if (xcodeResult.error?.code === 'ENOENT') {
    return { devices: [], unavailableReason: 'Xcode komut satırı araçları bulunamadı.' };
  }
  if (xcodeResult.status !== 0) {
    return {
      devices: [],
      unavailableReason: xcodeResult.stderr.trim() || 'Xcode iOS cihazlarını okuyamadı.',
    };
  }

  try {
    const devices = JSON.parse(xcodeResult.stdout)
      .filter(
        (device) =>
          device.platform === 'com.apple.platform.iphoneos' &&
          device.simulator === false &&
          device.available === true &&
          device.ignored !== true,
      )
      .map((device) => ({ id: device.identifier, name: device.name }));
    return { devices, unavailableReason: null };
  } catch {
    return { devices: [], unavailableReason: 'Xcode cihaz listesi okunamadı.' };
  }
}

function isPackagerRunning() {
  return new Promise((resolve) => {
    const request = http.get(
      { hostname: '127.0.0.1', path: '/status', port: metroPort, timeout: 1200 },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => resolve(body.includes('packager-status:running')));
      },
    );
    request.on('error', () => resolve(false));
    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
  });
}

function isChildProcessRunning(child) {
  return child.exitCode === null && child.signalCode === null;
}

function getLanHost() {
  const candidates = Object.entries(networkInterfaces()).flatMap(([name, addresses]) =>
    (addresses ?? [])
      .filter((address) => address.family === 'IPv4' && !address.internal)
      .map((address) => ({ name, address: address.address })),
  );
  const isPrivate = ({ address }) =>
    address.startsWith('10.') ||
    address.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(address);

  return (
    candidates.find(({ name }) => name === 'en0') ??
    candidates.find(({ name }) => name === 'en1') ??
    candidates.find(isPrivate) ??
    candidates[0]
  )?.address;
}

function getMetroProjectUrl(platform) {
  if (explicitMetroUrl) return explicitMetroUrl;
  if (platform === 'android') return `http://127.0.0.1:${metroPort}`;

  const lanHost = getLanHost();
  if (!lanHost) return null;
  return `http://${lanHost}:${metroPort}`;
}

function getDevelopmentClientUrl(platform) {
  const projectUrl = getMetroProjectUrl(platform);
  if (!projectUrl) return null;
  return `${developmentClientScheme}://expo-development-client/?url=${encodeURIComponent(projectUrl)}`;
}

async function openNativeDevelopmentClient(target) {
  const developmentClientUrl = getDevelopmentClientUrl(target.platform);
  if (!developmentClientUrl) {
    console.error(`✗ ${target.name}: Metro adresi belirlenemedi.`);
    console.error('DEVICE_METRO_URL ile erişilebilir Metro adresini belirtin.');
    return 1;
  }

  if (target.platform === 'android') {
    const reverseResult = runForOutput('adb', [
      '-s',
      target.id,
      'reverse',
      `tcp:${metroPort}`,
      `tcp:${metroPort}`,
    ]);
    if (reverseResult.status !== 0) {
      console.error(
        `✗ ${target.name}: USB Metro yönlendirmesi kurulamadı: ${reverseResult.stderr.trim()}`,
      );
      return 1;
    }

    return runInteractive('adb', [
      '-s',
      target.id,
      'shell',
      'am',
      'start',
      '-a',
      'android.intent.action.VIEW',
      '-d',
      developmentClientUrl,
      androidApplicationId,
    ]);
  }

  return runInteractive('xcrun', [
    'devicectl',
    'device',
    'process',
    'launch',
    '--device',
    target.id,
    '--terminate-existing',
    '--payload-url',
    developmentClientUrl,
    iosBundleIdentifier,
  ]);
}

async function waitForPackager(child) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (!isChildProcessRunning(child)) {
      const reason = child.exitCode ?? child.signalCode ?? 'bilinmiyor';
      throw new Error(`Metro beklenmedik şekilde kapandı (${reason}).`);
    }
    if (await isPackagerRunning()) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Metro ${metroPort} portunda 90 saniye içinde başlamadı.`);
}

function runInteractive(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: { ...process.env, EXPO_NO_TELEMETRY: '1' },
      stdio: 'inherit',
    });
    child.on('error', (error) => {
      console.error(`${command} başlatılamadı: ${error.message}`);
      resolve(1);
    });
    child.on('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

async function getNativeBuildSpace(targets) {
  const iosOnly = targets.every((target) => target.platform === 'ios');
  const defaultMinimumGiB = iosOnly ? 3 : 4;
  const recommendedGiB = 4;
  const minimumGiB = Number(process.env.DEVICE_MIN_FREE_GB ?? defaultMinimumGiB);
  const stats = await statfs(projectRoot);
  const freeBytes = Number(stats.bavail) * Number(stats.bsize);
  const freeGiB = freeBytes / 1024 ** 3;

  if (!Number.isFinite(minimumGiB) || minimumGiB <= 0) {
    console.error('DEVICE_MIN_FREE_GB pozitif bir sayı olmalıdır.');
    process.exit(2);
  }
  return {
    freeGiB,
    minimumGiB,
    recommendedGiB,
    sufficient: freeGiB >= minimumGiB,
  };
}

async function openAndroidWithExpoGo(target) {
  const packageResult = runForOutput('adb', [
    '-s',
    target.id,
    'shell',
    'pm',
    'path',
    'host.exp.exponent',
  ]);
  if (packageResult.status !== 0 || !packageResult.stdout.includes('package:')) {
    console.error(`✗ ${target.name}: Expo Go cihazda kurulu değil.`);
    return 1;
  }

  const reverseResult = runForOutput('adb', [
    '-s',
    target.id,
    'reverse',
    `tcp:${metroPort}`,
    `tcp:${metroPort}`,
  ]);
  if (reverseResult.status !== 0) {
    console.error(
      `✗ ${target.name}: USB Metro yönlendirmesi kurulamadı: ${reverseResult.stderr.trim()}`,
    );
    return 1;
  }

  return runInteractive('adb', [
    '-s',
    target.id,
    'shell',
    'am',
    'start',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    `exp://127.0.0.1:${metroPort}`,
    'host.exp.exponent',
  ]);
}

const androidDetection =
  requestedPlatform === 'ios' ? { devices: [], unavailableReason: null } : detectAndroidDevices();
const iosDetection =
  requestedPlatform === 'android' ? { devices: [], unavailableReason: null } : detectIosDevices();

const targets = [];
targets.push(
  ...androidDetection.devices.map((device) => ({ platform: 'android', ...device })),
  ...iosDetection.devices.map((device) => ({ platform: 'ios', ...device })),
);

if (targets.length === 0) {
  console.error('\nFiziksel iOS veya Android cihaz bulunamadı.');
  console.error('Android: USB hata ayıklamayı açın ve bilgisayara izin verin.');
  console.error('iOS: cihazı Mac\'e bağlayın, güven verin ve Geliştirici Modu\'nu açın.');
  if (androidDetection.unavailableReason) console.error(`Android ayrıntısı: ${androidDetection.unavailableReason}`);
  if (iosDetection.unavailableReason) console.error(`iOS ayrıntısı: ${iosDetection.unavailableReason}`);
  process.exit(1);
}

for (const target of targets) {
  console.log(`✓ ${target.platform.toUpperCase()}: ${target.name} (${target.id})`);
}

const buildSpace = await getNativeBuildSpace(targets);
const expoGoFallback =
  !buildSpace.sufficient && targets.every((target) => target.platform === 'android');

if (!buildSpace.sufficient && !expoGoFallback) {
  console.error(
    `\nNative derleme durduruldu: diskte ${buildSpace.freeGiB.toFixed(1)} GB boş alan var; en az ${buildSpace.minimumGiB.toFixed(1)} GB gerekli.`,
  );
  console.error('Bağlı iOS cihaz için Expo Go fallback otomatikleştirilemedi.');
  process.exit(1);
}

if (expoGoFallback) {
  console.warn(
    `\n⚠ Native build için alan yetersiz (${buildSpace.freeGiB.toFixed(1)} GB). Fiziksel Android Expo Go ile açılacak.`,
  );
  console.warn(
    `Native development build için en az ${buildSpace.minimumGiB.toFixed(1)} GB alan açıldığında aynı komut otomatik olarak Gradle build çalıştırır.`,
  );
} else if (buildSpace.freeGiB < buildSpace.recommendedGiB) {
  console.warn(
    `⚠ Disk alanı düşük: ${buildSpace.freeGiB.toFixed(1)} GB kullanılabilir. Native derleme devam edecek; mümkünse en az ${buildSpace.recommendedGiB.toFixed(1)} GB boş alan bırakın.`,
  );
} else {
  console.log(`✓ Disk alanı: ${buildSpace.freeGiB.toFixed(1)} GB kullanılabilir.`);
}

let metroProcess = null;
let ownsMetro = false;

if (await isPackagerRunning()) {
  console.log(`✓ ${metroPort} portundaki mevcut Metro kullanılıyor.`);
} else {
  console.log(`Metro ${metroMode} modunda ${metroPort} portunda başlatılıyor...`);
  metroProcess = spawn(
    'npx',
    [
      'expo',
      'start',
      expoGoFallback ? '--go' : '--dev-client',
      `--${metroMode}`,
      '--port',
      metroPort,
    ],
    {
      cwd: projectRoot,
      env: { ...process.env, EXPO_NO_TELEMETRY: '1' },
      stdio: 'inherit',
    },
  );
  ownsMetro = true;
  await waitForPackager(metroProcess);
  console.log('✓ Metro hazır.');
}

let failed = false;
for (const target of targets) {
  if (expoGoFallback) {
    console.log(`\n${target.name} Expo Go ile açılıyor...`);
    const exitCode = await openAndroidWithExpoGo(target);
    if (exitCode !== 0) {
      failed = true;
      console.error(`✗ ${target.name} üzerinde Expo Go açılamadı (kod: ${exitCode}).`);
    }
    continue;
  }

  console.log(`\n${target.name} için ${target.platform.toUpperCase()} derleniyor ve açılıyor...`);
  // Expo CLI SDK 57 resolves Android's --device value by the display name,
  // while iOS accepts the physical device UDID.
  const expoDeviceSelector = target.platform === 'android' ? target.cliName : target.id;
  const exitCode = await runInteractive('npx', [
    'expo',
    `run:${target.platform}`,
    '--device',
    expoDeviceSelector,
    '--port',
    metroPort,
  ]);
  if (exitCode !== 0) {
    failed = true;
    console.error(`✗ ${target.platform.toUpperCase()} başlatılamadı (kod: ${exitCode}).`);
    continue;
  }

  const openExitCode = await openNativeDevelopmentClient(target);
  if (openExitCode !== 0) {
    failed = true;
    console.error(`✗ ${target.name}: oyun Metro'ya otomatik bağlanamadı (kod: ${openExitCode}).`);
  } else {
    console.log(`✓ ${target.name}: oyun Metro'ya bağlandı.`);
  }
}

if (failed) {
  metroProcess?.kill('SIGTERM');
  process.exit(1);
}

console.log(
  expoGoFallback
    ? '\n✓ Bağlı fiziksel Android cihaz Expo Go ile hazır.'
    : '\n✓ Bağlı fiziksel cihazlar native development build ile hazır.',
);
if (ownsMetro && metroProcess && isChildProcessRunning(metroProcess)) {
  console.log('Metro çalışıyor; kapatmak için Ctrl+C kullanın.');
  await new Promise((resolve) => metroProcess.once('exit', resolve));
} else if (ownsMetro && (await isPackagerRunning())) {
  console.log(`✓ Metro ${metroPort} portunda arka planda çalışmaya devam ediyor.`);
}
