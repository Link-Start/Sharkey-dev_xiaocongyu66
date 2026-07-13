/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Background history prefetch + ensure-message-loaded for chat room.
 * Extracted from room.vue; scroll policies unchanged.
 */

import { nextTick, ref, type Ref } from 'vue';
import { ChatHistoryPrefetcher, loadUntilMessageFound } from './chat-history-loader.js';
import {
	isNearLiveEdge,
	preserveScrollAfterPrepend,
} from './chat-scroll.js';
import type { NormalizedChatMessage } from './chat-types.js';
import {
	PAGE_LIMIT,
	HISTORY_MEMORY_CAP,
	NORMALIZE_POOL,
} from './use-chat-messages.js';

export type HistoryPageFetcher = (args: {
	limit: number;
	untilId: string | null;
}) => Promise<NormalizedChatMessage[]>;

export function useChatHistory(opts: {
	messages: Ref<NormalizedChatMessage[]>;
	canFetchMore: Ref<boolean>;
	knownMessageIds: Set<string>;
	mergeOlderPage: (page: NormalizedChatMessage[]) => void;
	makeTimelineFetcher: () => HistoryPageFetcher;
	getScrollContainer: () => HTMLElement | null;
	isReadingHistory: (sc: HTMLElement | null) => boolean;
	/** true while user-scroll grace window blocks stick-to-live */
	isUserScrollBlocked: () => boolean;
	scrollToLiveEdge: (behavior?: ScrollBehavior | 'instant') => void;
	isActivated: () => boolean;
	hasConversation: () => boolean;
}) {
	const historyLoading = ref(false);
	const historyPrefetching = ref(false);
	const historyPrefetchLabel = ref('');
	const moreFetching = ref(false);

	let historyPrefetcher: ChatHistoryPrefetcher<NormalizedChatMessage> | null = null;

	function stopHistoryPrefetch() {
		historyPrefetcher?.stop();
		historyPrefetcher = null;
		historyPrefetching.value = false;
		historyPrefetchLabel.value = '';
	}

	/**
	 * Start / restart background async history pipeline (not tied to scroll chain).
	 */
	function startHistoryPrefetch() {
		stopHistoryPrefetch();
		if (!opts.canFetchMore.value || opts.messages.value.length === 0) return;
		if (!opts.hasConversation()) return;

		const oldestId = opts.messages.value[opts.messages.value.length - 1]?.id ?? null;
		historyPrefetcher = new ChatHistoryPrefetcher<NormalizedChatMessage>({
			pageSize: PAGE_LIMIT,
			maxPages: 30,
			maxMessages: HISTORY_MEMORY_CAP,
			fetchPage: opts.makeTimelineFetcher(),
			shouldPause: () => !opts.isActivated() || window.document.hidden,
			onPage: (page) => {
				if (!page.length) {
					opts.canFetchMore.value = false;
					historyPrefetching.value = false;
					historyPrefetchLabel.value = '';
					return;
				}
				const sc = opts.getScrollContainer();
				const reading = opts.isReadingHistory(sc);
				const nearLive = !reading && isNearLiveEdge(sc);
				const anchorId = opts.messages.value[opts.messages.value.length - 1]?.id ?? oldestId;
				const anchorEl = anchorId ? window.document.getElementById(`chat-msg-${anchorId}`) : null;
				const anchorTop = anchorEl?.getBoundingClientRect().top ?? null;
				const prevH = sc?.scrollHeight ?? 0;
				const prevTop = sc?.scrollTop ?? 0;

				opts.mergeOlderPage(page);
				opts.canFetchMore.value = page.length >= PAGE_LIMIT && !historyPrefetcher?.isExhausted;
				historyPrefetchLabel.value = opts.canFetchMore.value
					? `${opts.messages.value.length}`
					: '';

				void nextTick().then(() => {
					requestAnimationFrame(() => {
						if (!sc?.isConnected) return;
						if (reading && prevH > 0) {
							preserveScrollAfterPrepend(sc, prevH, prevTop, anchorId, anchorTop);
						} else if (nearLive && !opts.isUserScrollBlocked()) {
							opts.scrollToLiveEdge('instant');
						} else if (prevH > 0 && sc.scrollHeight !== prevH) {
							preserveScrollAfterPrepend(sc, prevH, prevTop, anchorId, anchorTop);
						}
					});
				});

				if (historyPrefetcher?.isExhausted) {
					opts.canFetchMore.value = false;
					historyPrefetching.value = false;
					historyPrefetchLabel.value = '';
				}
			},
		});
		historyPrefetching.value = true;
		historyPrefetchLabel.value = '…';
		historyPrefetcher.start(oldestId);
	}

	async function ensureMessageLoaded(id: string): Promise<boolean> {
		if (
			opts.knownMessageIds.has(id)
			|| opts.messages.value.some(m => m.id === id)
			|| window.document.getElementById(`chat-msg-${id}`)
		) {
			return true;
		}
		if (!opts.hasConversation()) return false;

		historyLoading.value = true;
		moreFetching.value = true;
		try {
			const oldestId = opts.messages.value[opts.messages.value.length - 1]?.id ?? null;
			const { pages, found, exhausted } = await loadUntilMessageFound<NormalizedChatMessage>({
				targetId: id,
				oldestId,
				pageSize: PAGE_LIMIT,
				maxPages: 40,
				fetchPage: opts.makeTimelineFetcher(),
				mapConcurrency: NORMALIZE_POOL,
			});
			for (const page of pages) {
				opts.mergeOlderPage(page);
			}
			if (exhausted) opts.canFetchMore.value = false;
			else if (pages.length) opts.canFetchMore.value = true;
			await nextTick();
			return found
				|| opts.messages.value.some(m => m.id === id)
				|| !!window.document.getElementById(`chat-msg-${id}`);
		} finally {
			moreFetching.value = false;
			historyLoading.value = false;
		}
	}

return {
		historyLoading,
		historyPrefetching,
		historyPrefetchLabel,
		moreFetching,
		/** Live prefetcher instance (may be null when idle). */
		getHistoryPrefetcher: () => historyPrefetcher,
		startHistoryPrefetch,
		stopHistoryPrefetch,
		ensureMessageLoaded,
	};
}
