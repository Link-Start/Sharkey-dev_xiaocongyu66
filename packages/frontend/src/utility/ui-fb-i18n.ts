/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { i18n } from '@/i18n.js';

/** Shared UI labels from locales `_uiCommon` only. */
export function tCommon(key: string): string {
	const fromI18n = (i18n.ts as any)?._uiCommon?.[key];
	if (typeof fromI18n === 'string' && fromI18n.length > 0) {
		return fromI18n;
	}
	return key;
}
