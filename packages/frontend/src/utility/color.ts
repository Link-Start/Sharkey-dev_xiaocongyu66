/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** #RGB or #RRGGBB only (SK-2026-004 / SK-2026-005 CSS injection guard) */
const SAFE_HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isSafeCssHexColor(value: string | null | undefined): value is string {
	return typeof value === 'string' && SAFE_HEX.test(value);
}

/** Return safe hex for CSS background, or fallback */
export function safeCssHexColor(value: string | null | undefined, fallback = '#86b300'): string {
	return isSafeCssHexColor(value) ? value : fallback;
}

export const alpha = (hex: string, a: number): string => {
	const safe = safeCssHexColor(hex.startsWith('#') ? hex : `#${hex}`, '#000000');
	const full = safe.length === 4
		? `#${safe[1]}${safe[1]}${safe[2]}${safe[2]}${safe[3]}${safe[3]}`
		: safe;
	const result = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(full)!;
	const r = parseInt(result[1], 16);
	const g = parseInt(result[2], 16);
	const b = parseInt(result[3], 16);
	return `rgba(${r}, ${g}, ${b}, ${a})`;
};
