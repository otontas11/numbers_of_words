import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const headerPath = fileURLToPath(
  new URL(
    '../node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI-Cxx/include/RuntimeScheduler.h',
    import.meta.url,
  ),
);
const originalClass = 'class RuntimeScheduler {';
const patchedClass =
  'class SWIFT_SHARED_REFERENCE(retainRuntimeScheduler, releaseRuntimeScheduler) RuntimeScheduler {';
const originalClassEnd =
  '} SWIFT_SHARED_REFERENCE(retainRuntimeScheduler, releaseRuntimeScheduler);';
const retainedConstructor = 'SWIFT_RETURNS_RETAINED RuntimeScheduler';

let source;
try {
  source = await readFile(headerPath, 'utf8');
} catch (error) {
  if (error?.code === 'ENOENT') process.exit(0);
  throw error;
}

if (
  source.includes(patchedClass) &&
  !source.includes(originalClassEnd) &&
  !source.includes(retainedConstructor)
) {
  process.exit(0);
}

if (!source.includes(patchedClass) && (!source.includes(originalClass) || !source.includes(originalClassEnd))) {
  throw new Error('expo-modules-jsi RuntimeScheduler başlığı beklenen biçimde değil.');
}

const patchedSource = source
  .replace(originalClass, patchedClass)
  .replace(originalClassEnd, '};')
  .replaceAll(retainedConstructor, 'RuntimeScheduler');

await writeFile(headerPath, patchedSource);
console.log('Xcode 26 için expo-modules-jsi RuntimeScheduler başlığı yamalandı.');
