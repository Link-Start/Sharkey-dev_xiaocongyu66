/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { i18n } from '@/i18n.js';
import { miLocalStorage } from '@/local-storage.js';

/** Chat UI strings live only in locales `_chat`. */
export function chatT(key: string): string {
	const fromI18n = (i18n.ts as any)?._chat?.[key];
	if (typeof fromI18n === 'string' && fromI18n.length > 0) {
		return fromI18n;
	}
	return key;
}

/** Drop cached locale once if core chat keys are missing so next load re-fetches packs. */
export function ensureChatLocaleFresh(): void {
	const muted = (i18n.ts as any)?._chat?.mutedAll;
	if (typeof muted === 'string' && muted.length > 0) return;
	try {
		miLocalStorage.removeItem('locale');
		miLocalStorage.removeItem('localeVersion');
	} catch {
		// ignore
	}
}
