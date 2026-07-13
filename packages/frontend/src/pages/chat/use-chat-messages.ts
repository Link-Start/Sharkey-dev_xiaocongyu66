/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Message list store for chat room timeline.
 * Extracted from room.vue without behavior changes.
 */

import { ref } from 'vue';
import type { NormalizedChatMessage } from './chat-types.js';

/** Soft cap at live edge: drop oldest when new msgs arrive (only when viewing newest). */
export const MAX_MESSAGES = 400;
export const PAGE_LIMIT = 40;
/** Soft trim when tab is backgrounded (keep-alive / hidden) */
export const BACKGROUND_MESSAGE_CAP = 80;
/** Background history memory ceiling */
export const HISTORY_MEMORY_CAP = 900;
/** Concurrent normalize workers when merging a page */
export const NORMALIZE_POOL = 6;

export function useChatMessages() {
	const messages = ref<NormalizedChatMessage[]>([]);
	const canFetchMore = ref(false);
	const knownMessageIds = new Set<string>();

	function rebuildKnownIds() {
		knownMessageIds.clear();
		for (const m of messages.value) knownMessageIds.add(m.id);
	}

	/**
	 * Same as previous room.vue mergeOlderPage (includes pin-aware HISTORY_MEMORY_CAP trim).
	 */
	function mergeOlderPage(
		page: NormalizedChatMessage[],
		pinnedViewMessageId: string | null,
	) {
		if (!page.length) {
			canFetchMore.value = false;
			return;
		}
		const fresh = page.filter(m => !knownMessageIds.has(m.id));
		if (!fresh.length) {
			// All duplicates — still advance exhausted if short page handled by caller
			return;
		}
		for (const m of fresh) knownMessageIds.add(m.id);
		// Array is newest-first: older pages append at end
		messages.value.push(...fresh);
		if (messages.value.length > HISTORY_MEMORY_CAP && !pinnedViewMessageId) {
			// Soft trim from oldest end when not pinned
			const overflow = messages.value.length - HISTORY_MEMORY_CAP;
			const dropped = messages.value.splice(messages.value.length - overflow, overflow);
			for (const d of dropped) knownMessageIds.delete(d.id);
			canFetchMore.value = true;
		}
	}

	return {
		messages,
		canFetchMore,
		knownMessageIds,
		rebuildKnownIds,
		mergeOlderPage,
	};
}
