import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ALL_CAPABILITIES } from '../data/capabilitiesCatalog';
import { NATIVE_COMMANDS } from '../services/nativeCommandRegistry';

const main = fs.readFileSync(path.resolve('src-tauri/src/main.rs'), 'utf8');
const m01 = fs.readFileSync(path.resolve('src-tauri/src/completion14/m01.rs'), 'utf8');
const m02 = fs.readFileSync(path.resolve('src-tauri/src/completion14/m02.rs'), 'utf8');
const m03 = fs.readFileSync(path.resolve('src-tauri/src/completion14/m03.rs'), 'utf8');
const m04 = fs.readFileSync(path.resolve('src-tauri/src/completion14/m04.rs'), 'utf8');

const completedPartialIds = [
  'm01_s01', 'm01_s05',
  'm02_s02', 'm02_s05', 'm02_s07', 'm02_s09',
  'm03_s03', 'm03_s04', 'm03_s05', 'm03_s07',
  'm04_s05', 'm04_s08', 'm04_s09', 'm04_s10',
] as const;

const expectedCommands = {
  'm01.system.discover': ['m01_system_discover_complete', 'm01'],
  'm01.winget.install': ['m01_winget_install_queued', 'm01'],
  'm02.scan.windows_temp': ['m02_scan_windows_temp_complete', 'm02'],
  'm02.scan.crash_dumps': ['m02_scan_crash_dumps_complete', 'm02'],
  'm02.scan.application_logs': ['m02_scan_application_logs_complete', 'm02'],
  'm02.scan.old_downloads': ['m02_scan_old_downloads_complete', 'm02'],
  'm03.scan.images': ['m03_scan_images_complete', 'm03'],
  'm03.scan.videos': ['m03_scan_videos_complete', 'm03'],
  'm03.scan.audio': ['m03_scan_audio_complete', 'm03'],
  'm03.scan.archives': ['m03_scan_archives_complete', 'm03'],
  'm04.files.old': ['m04_old_files_complete', 'm04'],
  'm04.drives.external': ['m04_external_drives_complete', 'm04'],
  'm04.space.check': ['m04_space_check_complete', 'm04'],
  'm04.report.export': ['m04_report_export_complete', 'm04'],
} as const;

describe('fourteen partial-service completion gate', () => {
  it('keeps the catalog honest after subsequent verified modules', () => {
    expect(ALL_CAPABILITIES).toHaveLength(190);
    expect(ALL_CAPABILITIES.filter(item => item.implementationState === 'implemented')).toHaveLength(60);
    expect(ALL_CAPABILITIES.filter(item => item.implementationState === 'partial')).toHaveLength(0);
    expect(ALL_CAPABILITIES.filter(item => item.implementationState === 'planned')).toHaveLength(130);
    for (const id of completedPartialIds) {
      const service = ALL_CAPABILITIES.find(item => item.id === id);
      expect(service, id).toBeDefined();
      expect(service?.implementationState, id).toBe('implemented');
      expect(service?.status, id).toBe('available');
      expect(service?.handlerId, id).toBeTruthy();
    }
  });

  it('maps each completed service to an explicit registered Rust command', () => {
    for (const [handlerId, [command, module]] of Object.entries(expectedCommands)) {
      expect(NATIVE_COMMANDS[handlerId as keyof typeof NATIVE_COMMANDS], handlerId).toBe(command);
      expect(main, handlerId).toContain(`completion14::${module}::${command}`);
    }
    for (const handlerId of Object.keys(NATIVE_COMMANDS)) {
      expect(handlerId).not.toMatch(/^m\d{2}\.service\.\d+$/);
    }
  });

  it('contains the required real evidence and safety controls', () => {
    expect(m01).toContain('Get-CimInstance Win32_DiskDrive');
    expect(m01).toContain('Get-CimInstance Win32_VideoController');
    expect(m01).toContain('queue.json');
    expect(m01).toContain('m01_winget_queue_resume');

    expect(m02).toContain('-Verb RunAs');
    expect(m02).toContain('ExpectedHash');
    expect(m02).toContain('outside_allowed_root');
    expect(m02).toContain('download-quarantine');
    expect(m02).toContain('m02_download_quarantine_restore');

    expect(m03).toContain('dhash');
    expect(m03).toContain('ahash');
    expect(m03).toContain('ffprobe');
    expect(m03).toContain('ffmpeg');
    expect(m03).toContain('ZipFile');
    expect(m03).not.toContain('extract_to');

    expect(m04).toContain('accessed_at');
    expect(m04).toContain('Get-PhysicalDisk');
    expect(m04).toContain('m04://low-space-alert');
    expect(m04).toContain('%PDF-1.4');
    expect(m04).toContain('json_evidence_path');
  });

  it('does not fabricate operating-system results in the completion engines', () => {
    const production = `${m01}\n${m02}\n${m03}\n${m04}`;
    expect(production).not.toContain('Math.random');
    expect(production).not.toContain('setTimeout');
    expect(production).not.toMatch(/\b8\.6 GB\b/);
    expect(production).not.toMatch(/\b4\.2 GB\b/);
  });
});
