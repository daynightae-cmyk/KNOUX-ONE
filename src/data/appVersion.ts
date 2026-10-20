/**
 * KNOUX ONE — Single source of truth for application identity.
 *
 * Keep this in sync with `package.json` version and
 * `src-tauri/tauri.conf.json` version. The desktop shell and installer
 * must not display a different version from these files.
 */

export const APP_NAME = 'KNOUX ONE';
export const APP_VERSION = '1.0.0';

export function appLabel(): string {
  return `${APP_NAME} ${APP_VERSION}`;
}
