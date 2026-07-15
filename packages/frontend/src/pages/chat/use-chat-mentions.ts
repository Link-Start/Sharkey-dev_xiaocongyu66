/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * @mention jump list for group chat (Telegram-style FAB).
 * Logic moved from room.vue unchanged.
 */

import { computed, ref, type Ref } from 'vue';
import { $i } from '@/i.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import type { NormalizedChatMessage } from './chat-types.js';
import { chatT } from './chat-i18n.js';

function tChat(key: string) {
	return chatT(key);
}

export function useChatMentions(opts: {
	roomId: () => string | undefined;
	messages: Ref<NormalizedChatMessage[]>;
}) {
	const mentions = ref<Array<{ id: string; fromUserId: string; text: string | null }>>([]);
	const mentionCursor = ref(0);
	const mentionJumping = ref(false);
	const mentionsDismissed = ref(false);

	const mentionBarLabel = computed(() => {
		const n = mentions.value.length;
		if (n === 0) return '';
		const i = Math.min(mentionCursor.value, n - 1) + 1;
		return `${tChat('mentionsOfYou')} ${i}/${n}`;
	});

	function dismissMentions() {
		mentionsDismissed.value = true;
		mentions.value = [];
	}

	function isMentionOfMe(text: string | null | undefined): boolean {
		if (!text || !$i) return false;
		const username = $i.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		// @username boundary (not part of longer handle)
		const re = new RegExp(`(^|[^\\w])@${username}(?![\\w-])`, 'i');
		return re.test(text);
	}

	async function loadMentionsForRoom() {
		const roomId = opts.roomId();
		if (!roomId || !$i || mentionsDismissed.value) {
			mentions.value = [];
			return;
		}
		try {
			const q = `@${$i.username}`;
			const found = await misskeyApi('chat/messages/search', {
				query: q,
				roomId,
				limit: 50,
			} as never) as Array<{ id: string; fromUserId: string; text: string | null }>;

			// newest first
			const filtered = found
				.filter(m => m.fromUserId !== $i!.id && isMentionOfMe(m.text))
				.sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));

			mentions.value = filtered;
			mentionCursor.value = 0;
		} catch {
			// search may fail; fall back to scanning loaded messages
			const fromTimeline = opts.messages.value
				.filter(m => m.fromUserId !== $i!.id && isMentionOfMe(m.text))
				.map(m => ({ id: m.id, fromUserId: m.fromUserId, text: m.text }));
			mentions.value = fromTimeline;
			mentionCursor.value = 0;
		}
	}

	function resetMentions() {
		mentions.value = [];
		mentionCursor.value = 0;
		mentionsDismissed.value = false;
	}

	function maybePushLiveMention(message: { id: string; fromUserId: string; text: string | null }, roomId: string | undefined) {
		if (
			!mentionsDismissed.value &&
			roomId &&
			$i &&
			message.fromUserId !== $i.id &&
			isMentionOfMe(message.text)
		) {
			if (!mentions.value.some(m => m.id === message.id)) {
				mentions.value = [
					{ id: message.id, fromUserId: message.fromUserId, text: message.text },
					...mentions.value,
				];
			}
		}
	}

	return {
		mentions,
		mentionCursor,
		mentionJumping,
		mentionsDismissed,
		mentionBarLabel,
		dismissMentions,
		isMentionOfMe,
		loadMentionsForRoom,
		resetMentions,
		maybePushLiveMention,
	};
}
