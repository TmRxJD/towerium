import { assetUrl, powerUrls } from './assets';

const glyph=(body:string)=>`<svg class="weapon-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const art=(url:string)=>`<img class="weapon-icon" src="${url}" width="30" height="30" alt="" aria-hidden="true">`;

export const weaponIcons=[
  glyph('<path d="M5 9h13m-16 7h18M5 23h13"/><path d="m21 6 6 3-6 3m2 1 6 3-6 3m-2 1 6 3-6 3"/>'),
  glyph('<path d="M3 16h21M6 11h10M6 21h10M24 6l3 7 4 3-4 3-3 7-3-7-4-3 4-3Z"/>'),
  art(assetUrl('Weapon Smart Missilies','ultimate-weapons')),
  glyph('<circle cx="15" cy="21" r="8"/><path d="m18 14 2-5c2-6 9-5 9-1 0 3-4 4-4 1M11 18l-1 3"/>'),
  art(powerUrls[8]),
];
