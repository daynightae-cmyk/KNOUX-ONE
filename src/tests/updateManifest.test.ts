import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createUpdateManifest,
  parseArguments,
  writeUpdateManifest,
  type UpdateManifestInput,
} from '../../scripts/create-update-manifest';

const temporaryDirectories: string[] = [];

function fixture(overrides: Partial<UpdateManifestInput> = {}): UpdateManifestInput {
  const directory = mkdtempSync(join(tmpdir(), 'knoux-update-manifest-'));
  temporaryDirectories.push(directory);
  const artifactPath = join(directory, 'KNOUX ONE_1.2.3_x64-setup.exe');
  const signaturePath = `${artifactPath}.sig`;

  writeFileSync(artifactPath, 'signed-installer-placeholder');
  writeFileSync(signaturePath, 'tauri-signature-from-real-build\n');

  return {
    channel: 'stable',
    version: '1.2.3',
    artifactPath,
    signaturePath,
    artifactUrl:
      'https://github.com/daynightae-cmyk/KNOUX-ONE/releases/download/v1.2.3/KNOUX%20ONE_1.2.3_x64-setup.exe',
    publishedAt: '2026-08-19T12:34:56Z',
    outputPath: join(directory, 'latest.json'),
    ...overrides,
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('create-update-manifest', () => {
  it('writes a static Windows manifest from the generated Tauri signature', () => {
    const input = fixture({
      channel: 'beta',
      version: '1.2.3-beta.1',
      artifactUrl:
        'https://github.com/daynightae-cmyk/KNOUX-ONE/releases/download/beta/KNOUX%20ONE_1.2.3_x64-setup.exe',
    });

    writeUpdateManifest(input);

    expect(JSON.parse(readFileSync(input.outputPath, 'utf8'))).toEqual({
      version: '1.2.3-beta.1',
      pub_date: '2026-08-19T12:34:56.000Z',
      platforms: {
        'windows-x86_64': {
          url: input.artifactUrl,
          signature: 'tauri-signature-from-real-build',
        },
      },
    });
  });

  it('rejects a prerelease on stable and an unsigned or non-HTTPS artifact route', () => {
    expect(() => createUpdateManifest(fixture({ version: '1.2.3-beta.1' }))).toThrow(
      'Stable releases must not use a prerelease semantic version.',
    );

    expect(() =>
      createUpdateManifest(
        fixture({
          artifactUrl: 'http://github.com/daynightae-cmyk/KNOUX-ONE/releases/download/v1.2.3/KNOUX%20ONE_1.2.3_x64-setup.exe',
        }),
      ),
    ).toThrow('--artifact-url must use HTTPS.');
  });

  it('parses only the explicit release arguments and rejects unknown input', () => {
    const input = fixture();
    const parsed = parseArguments([
      '--channel',
      input.channel,
      '--version',
      input.version,
      '--artifact',
      input.artifactPath,
      '--signature',
      input.signaturePath,
      '--artifact-url',
      input.artifactUrl,
      '--pub-date',
      input.publishedAt,
      '--output',
      input.outputPath,
    ]);

    expect(parsed).toMatchObject({ channel: 'stable', version: '1.2.3' });
    expect(() => parseArguments(['--unsafe', 'value'])).toThrow('Unknown argument(s): --unsafe.');
  });
});
