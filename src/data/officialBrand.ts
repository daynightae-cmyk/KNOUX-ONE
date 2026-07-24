import type { KnouxTheme } from '../types';

export const KNOUX_LOGO_REVISION = '2026-07-24.3';

export const OFFICIAL_KNOUX_ASSETS = {
  nightLogo: 'https://i.postimg.cc/V6LqNG8m/Knoux-Chat-GPT-01.jpg',
  dayLogo: 'https://i.postimg.cc/fLTcb2NT/Knoux-Chat-GPT-20.jpg',
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
