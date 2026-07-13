/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type * as Misskey from 'misskey-js';
import type { NormalizedChatMessage } from './chat-types.js';

/**
 * Fill missing fromUser / reaction.user from local identity + peer profile.
 * Same rules as the previous inline normalizeMessage in room.vue.
 */
export function normalizeChatMessage(
	message: Misskey.entities.ChatMessageLite | Misskey.entities.ChatMessage,
	me: Misskey.entities.UserLite,
	peerUser: Misskey.entities.UserLite | null | undefined,
): NormalizedChatMessage {
	return {
		...message,
		fromUser: message.fromUser ?? (message.fromUserId === me.id ? me : peerUser!),
		reactions: message.reactions.map(record => ({
			...record,
			user: record.user ?? (message.fromUserId === me.id ? peerUser! : me),
		})),
	};
}
