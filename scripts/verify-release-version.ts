import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  version?: string;
};
const tauriConfig = JSON.parse(
  readFileSync(resolve(root, 'src-tauri', 'tauri.conf.json'), 'utf8'),
) as { version?: string };
const cargoToml = readFileSync(resolve(root, 'src-tauri', 'Cargo.toml'), 'utf8');

function cargoPackageVersion(source: string): string | undefined {
  const packageSection = source.match(/^\[package\]([\s\S]*?)(?=^\[|\z)/m)?.[1];
  return packageSection?.match(/^version\s*=\s*"([^"]+)"\s*$/m)?.[1];
}

function fail(message: string): never {
  console.error(`[release-version] ${message}`);
  process.exit(1);
}

const frontendVersion = packageJson.version;
const nativeVersion = cargoPackageVersion(cargoToml);
const tauriVersion = tauriConfig.version;

if (!frontendVersion || !nativeVersion || !tauriVersion) {
  fail('A required version is missing from package.json, Cargo.toml, or tauri.conf.json.');
}

const versions = new Set([frontendVersion, nativeVersion, tauriVersion]);
if (versions.size !== 1) {
  fail(
    `Version mismatch: package.json=${frontendVersion}, Cargo.toml=${nativeVersion}, tauri.conf.json=${tauriVersion}.`,
  );
}

const requireTag = process.argv.includes('--require-tag');
const tag =
  process.env.RELEASE_TAG ??
  (process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : undefined);

if (requireTag && !tag) {
  fail('A release tag is required. Set RELEASE_TAG or run from a GitHub tag ref.');
}

if (tag) {
  const expectedTag = `v${frontendVersion}`;
  if (tag !== expectedTag) {
    fail(`Tag mismatch: expected ${expectedTag}, received ${tag}.`);
  }
}

console.log(
  `[release-version] PASS version=${frontendVersion}${tag ? ` tag=${tag}` : ' tag=not-required'}`,
);
