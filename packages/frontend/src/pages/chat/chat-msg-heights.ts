/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Remember chat message row heights across tab switches / remounts.
 * Prevents "scroll position vanishes" when media-heavy history re-lazy-mounts
 * with a tiny default placeholder instead of real image/video height.
 *
 * Also provides content-based estimates so first paint during fast fling
 * doesn't collapse rows from 72px → real height (multi-frame twitch).
 */

const heights = new Map<string, number>();
const MAX = 2000;

export function rememberChatMsgHeight(id: string, h: number): void {
	if (!id || !Number.isFinite(h) || h <= 0) return;
	const prev = heights.get(id) ?? 0;
	// Never shrink remembered height (media often measures short then grows)
	heights.set(id, Math.max(prev, Math.round(h)));
	if (heights.size > MAX) {
		const drop = heights.size - MAX;
		let i = 0;
		for (const k of heights.keys()) {
			heights.delete(k);
			if (++i >= drop) break;
		}
	}
}

export function getChatMsgHeight(id: string): number | null {
	return heights.get(id) ?? null;
}

/** Rough height before first mount — better than fixed 72 for long text / files. */
export function estimateChatMsgHeight(message: {
	id: string;
	text?: string | null;
	file?: { type?: string | null } | null;
	reactions?: unknown[] | null;
}): number {
	const known = heights.get(message.id);
	if (known && known > 0) return known;

	// Header row + avatar + padding
	let h = 64;
	const text = message.text ?? '';
	if (text.length > 0) {
		// ~36 chars/line @ bubble width; clamp so one wall of text doesn't reserve a page
		const lines = Math.min(12, Math.max(1, Math.ceil(text.length / 36)));
		h += lines * 22 + 16;
	} else {
		h += 12;
	}
	if (message.file) {
		const t = message.file.type ?? '';
		if (t.startsWith('image/') || t.startsWith('video/')) h += 200;
		else h += 56;
	}
	if (message.reactions && message.reactions.length > 0) {
		h += 28;
	}
	return h;
}

export function clearChatMsgHeights(): void {
	heights.clear();
}
