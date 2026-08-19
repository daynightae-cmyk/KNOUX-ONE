import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

export type ReleaseChannel = 'beta' | 'stable';

export interface UpdateManifestInput {
  channel: ReleaseChannel;
  version: string;
  artifactPath: string;
  signaturePath: string;
  artifactUrl: string;
  publishedAt: string;
  outputPath: string;
  notes?: string;
}

interface StaticUpdateManifest {
  version: string;
  pub_date: string;
  platforms: {
    'windows-x86_64': {
      url: string;
      signature: string;
    };
  };
  notes?: string;
}

const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function fail(message: string): never {
  throw new Error(`[update-manifest] ${message}`);
}

function requireValue(value: string | undefined, flag: string): string {
  if (!value) {
    fail(`Missing required argument ${flag}.`);
  }

  return value;
}

export function parseArguments(args: string[]): UpdateManifestInput {
  const values = new Map<string, string>();

  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];

    if (!flag?.startsWith('--')) {
      fail(`Expected a named argument, received ${flag ?? '(end of arguments)'}.`);
    }

    if (value === undefined || value.startsWith('--')) {
      fail(`Missing value for ${flag}.`);
    }

    if (values.has(flag)) {
      fail(`Argument ${flag} was provided more than once.`);
    }

    values.set(flag, value);
  }

  const unknown = [...values.keys()].filter(
    (flag) =>
      ![
        '--channel',
        '--version',
        '--artifact',
        '--signature',
        '--artifact-url',
        '--pub-date',
        '--output',
        '--notes-file',
      ].includes(flag),
  );

  if (unknown.length > 0) {
    fail(`Unknown argument(s): ${unknown.join(', ')}.`);
  }

  const channel = requireValue(values.get('--channel'), '--channel');
  if (channel !== 'beta' && channel !== 'stable') {
    fail('--channel must be either beta or stable.');
  }

  const notesPath = values.get('--notes-file');

  return {
    channel,
    version: requireValue(values.get('--version'), '--version'),
    artifactPath: requireValue(values.get('--artifact'), '--artifact'),
    signaturePath: requireValue(values.get('--signature'), '--signature'),
    artifactUrl: requireValue(values.get('--artifact-url'), '--artifact-url'),
    publishedAt: requireValue(values.get('--pub-date'), '--pub-date'),
    outputPath: requireValue(values.get('--output'), '--output'),
    notes: notesPath ? readUtf8File(notesPath, '--notes-file').trim() || undefined : undefined,
  };
}

function readUtf8File(path: string, label: string): string {
  const resolved = resolve(path);

  if (!existsSync(resolved)) {
    fail(`${label} does not exist: ${path}`);
  }

  if (!statSync(resolved).isFile()) {
    fail(`${label} must be a file: ${path}`);
  }

  return readFileSync(resolved, 'utf8');
}

function validateVersion(channel: ReleaseChannel, version: string): void {
  const match = semverPattern.exec(version);
  if (!match) {
    fail(`--version must be a valid semantic version without a leading v: ${version}`);
  }

  const prerelease = match[4];
  if (channel === 'stable' && prerelease) {
    fail('Stable releases must not use a prerelease semantic version.');
  }

  if (channel === 'beta' && !prerelease?.startsWith('beta.')) {
    fail('Beta releases must use a prerelease semantic version beginning with beta., for example 1.2.3-beta.1.');
  }
}

function validateArtifactUrl(artifactPath: string, artifactUrl: string): void {
  const url = new URL(artifactUrl);

  if (url.protocol !== 'https:') {
    fail('--artifact-url must use HTTPS.');
  }

  if (url.username || url.password || url.search || url.hash) {
    fail('--artifact-url must not contain credentials, a query string, or a fragment.');
  }

  const artifactName = basename(resolve(artifactPath));
  const urlName = basename(decodeURIComponent(url.pathname));

  if (artifactName !== urlName) {
    fail(`The artifact filename (${artifactName}) must match the HTTPS URL filename (${urlName}).`);
  }
}

function validatePublishedAt(value: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.valueOf())) {
    fail(`--pub-date must be a valid RFC 3339 timestamp: ${value}`);
  }

  return timestamp.toISOString();
}

export function createUpdateManifest(input: UpdateManifestInput): StaticUpdateManifest {
  validateVersion(input.channel, input.version);

  const artifact = resolve(input.artifactPath);
  if (!artifact.toLowerCase().endsWith('.exe')) {
    fail('The Windows updater policy publishes the signed NSIS .exe artifact; --artifact must end in .exe.');
  }

  if (!existsSync(artifact) || !statSync(artifact).isFile() || statSync(artifact).size === 0) {
    fail(`--artifact must reference a non-empty signed NSIS installer: ${input.artifactPath}`);
  }

  const signature = readUtf8File(input.signaturePath, '--signature').trim();
  if (!signature) {
    fail('--signature must contain the generated Tauri updater signature.');
  }

  validateArtifactUrl(artifact, input.artifactUrl);

  const manifest: StaticUpdateManifest = {
    version: input.version,
    pub_date: validatePublishedAt(input.publishedAt),
    platforms: {
      'windows-x86_64': {
        url: input.artifactUrl,
        signature,
      },
    },
  };

  if (input.notes) {
    manifest.notes = input.notes;
  }

  return manifest;
}

export function writeUpdateManifest(input: UpdateManifestInput): void {
  const manifest = createUpdateManifest(input);
  const destination = resolve(input.outputPath);

  if (basename(destination) !== 'latest.json') {
    fail('--output must be named latest.json so published channel endpoints remain canonical.');
  }

  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`[update-manifest] PASS channel=${input.channel} version=${input.version} output=${destination}`);
}

if (import.meta.main) {
  writeUpdateManifest(parseArguments(process.argv.slice(2)));
}
