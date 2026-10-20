import type { KnouxTheme } from '../types';

export const KNOUX_LOGO_REVISION = '2026-10-20.1';

export const OFFICIAL_KNOUX_ASSETS = {
  nightLogo: '/brand/logos/knoux-one-night.jpg',
  dayLogo: '/brand/logos/knoux-one-day.jpg',
  website: 'https://knoux.store',
  productName: 'KNOUX ONE',
  productDescription: 'Windows Intelligence & Developer Suite',
  tagline: 'Build • Protect • Optimize',
  owner: 'Eng. Sadek Elgazar',
  ownerBrand: 'Knoux',
  location: 'Abu Dhabi, United Arab Emirates',
} as const;

function withLogoRevision(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}knoux_logo=${encodeURIComponent(KNOUX_LOGO_REVISION)}`;
}

export function getOfficialKnouxLogo(theme: KnouxTheme): string {
  const source = theme === 'light'
    ? OFFICIAL_KNOUX_ASSETS.dayLogo
    : OFFICIAL_KNOUX_ASSETS.nightLogo;

  return withLogoRevision(source);
}
