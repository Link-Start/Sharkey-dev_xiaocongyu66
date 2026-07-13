/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { i18n } from '@/i18n.js';
import { miLocalStorage } from '@/local-storage.js';

export type RequestLogItem = {
	failed: boolean;
	url: string;
	name: string;
	error?: string;
};

export const gridSortOrderKeys = [
	'name',
	'category',
	'aliases',
	'type',
	'license',
	'host',
	'uri',
	'publicUrl',
	'isSensitive',
	'localOnly',
	'updatedAt',
] as const satisfies string[];

export type GridSortOrderKey = typeof gridSortOrderKeys[number];

/** Map grid bindTo / sort keys → _customEmojisManager._fields keys */
const FIELD_KEY_ALIASES: Record<string, string> = {
	isSensitive: 'sensitive',
	updatedAt: 'updatedAtFrom',
};

type LangPack = { en: string; zh: string; 'zh-TW'?: string; ja: string };

/**
 * Human labels when locale pack / cache lacks _customEmojisManager._fields.
 * Never fall back to raw camelCase keys (those showed as broken "符号文字" in admin UI).
 */
const FIELD_FALLBACKS: Record<string, LangPack> = {
	name: { en: 'Name', zh: '名称', 'zh-TW': '名稱', ja: '名前' },
	category: { en: 'Category', zh: '分类', 'zh-TW': '分類', ja: 'カテゴリ' },
	aliases: { en: 'Aliases', zh: '别名', 'zh-TW': '別名', ja: 'エイリアス' },
	type: { en: 'Type', zh: '类型', 'zh-TW': '類型', ja: '種類' },
	license: { en: 'License', zh: '许可证', 'zh-TW': '授權', ja: 'ライセンス' },
	sensitive: { en: 'Sensitive', zh: '敏感', 'zh-TW': '敏感', ja: 'センシティブ' },
	localOnly: { en: 'Local only', zh: '仅本地', 'zh-TW': '僅本機', ja: 'ローカルのみ' },
	updatedAtFrom: { en: 'Updated at (from)', zh: '更新时间（起）', 'zh-TW': '更新時間（起）', ja: '更新日時（開始）' },
	updatedAtTo: { en: 'Updated at (to)', zh: '更新时间（止）', 'zh-TW': '更新時間（迄）', ja: '更新日時（終了）' },
	role: { en: 'Role', zh: '角色', 'zh-TW': '角色', ja: 'ロール' },
	host: { en: 'Host', zh: '主机', 'zh-TW': '主機', ja: 'ホスト' },
	uri: { en: 'URI', zh: 'URI', ja: 'URI' },
	publicUrl: { en: 'Public URL', zh: '公开 URL', 'zh-TW': '公開 URL', ja: '公開URL' },
	image: { en: 'Image', zh: '图片', 'zh-TW': '圖片', ja: '画像' },
};

function resolveLang(): string {
	return (
		miLocalStorage.getItem('lang')
		|| (typeof navigator !== 'undefined' ? navigator.language : 'en-US')
		|| 'en-US'
	).replace('_', '-').toLowerCase();
}

function pickLang(fb: LangPack): string {
	const lang = resolveLang();
	if (lang.startsWith('zh-tw') || lang.startsWith('zh-hk') || lang.startsWith('zh-hant')) {
		return fb['zh-TW'] || fb.zh;
	}
	if (lang.startsWith('zh')) return fb.zh;
	if (lang.startsWith('ja')) return fb.ja;
	return fb.en;
}

/** True if string looks like an untranslated identifier (camelCase / raw key). */
function looksLikeKey(s: string, key: string): boolean {
	if (!s || s === key) return true;
	if (/^[a-z]+[A-Z]/.test(s)) return true; // camelCase
	if (/^[a-z][a-zA-Z0-9]+$/.test(s) && s === key) return true;
	return false;
}

/**
 * Label for emoji manager search fields and grid column titles.
 * Prefer localized _fields; for CJK UI prefer FIELD_FALLBACKS when pack is missing/stale English-only.
 */
export function emojiFieldLabel(fieldKey: string, englishFallback?: string): string {
	const key = FIELD_KEY_ALIASES[fieldKey] ?? fieldKey;
	const fields = (i18n.ts as any)._customEmojisManager?._fields;
	const fromFields = fields?.[key];
	const lang = resolveLang();
	const wantsCjk = lang.startsWith('zh') || lang.startsWith('ja');
	const fb = FIELD_FALLBACKS[key];

	if (typeof fromFields === 'string' && fromFields.length > 0 && !looksLikeKey(fromFields, key)) {
		// If UI is Chinese/Japanese but pack still English "Name"/"Aliases", prefer CJK fallback
		if (wantsCjk && fb) {
			const cjk = pickLang(fb);
			const en = fb.en;
			if (fromFields === en || fromFields === englishFallback) {
				return cjk;
			}
		}
		return fromFields;
	}

	if (fb) return pickLang(fb);

	const top = (i18n.ts as any)[key];
	if (typeof top === 'string' && top.length > 0 && !looksLikeKey(top, key)) {
		if (wantsCjk && FIELD_FALLBACKS[key]) {
			const cjk = pickLang(FIELD_FALLBACKS[key]);
			if (top === FIELD_FALLBACKS[key].en) return cjk;
		}
		return top;
	}

	if (englishFallback && !looksLikeKey(englishFallback, key)) {
		return englishFallback;
	}
	return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
}

export function emptyStrToUndefined(value: string | null) {
	return value ? value : undefined;
}

export function emptyStrToNull(value: string) {
	return value === '' ? null : value;
}

export function emptyStrToEmptyArray(value: string) {
	return value === '' ? [] : value.split(' ').map(it => it.trim());
}

export function roleIdsParser(text: string): { id: string, name: string }[] {
	// idとnameのペア配列をJSONで受け取る。それ以外の形式は許容しない
	try {
		const obj = JSON.parse(text);
		if (!Array.isArray(obj)) {
			return [];
		}
		if (!obj.every(it => typeof it === 'object' && 'id' in it && 'name' in it)) {
			return [];
		}

		return obj.map(it => ({ id: it.id, name: it.name }));
	} catch (ex) {
		console.warn(ex);
		return [];
	}
}
