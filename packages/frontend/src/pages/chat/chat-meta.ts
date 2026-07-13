/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Room / peer profile loaders: WebSocket first, REST fallback.
 * Extracted from room.vue without behavior changes.
 */

import type * as Misskey from 'misskey-js';
import { misskeyApi } from '@/utility/misskey-api.js';
import type { ChatWsApi } from './chat-ws.js';

export async function loadRoomMeta(
	chatWs: ChatWsApi,
	roomId: string,
): Promise<any> {
	if (chatWs.ready()) {
		try {
			const res = await chatWs.request<{ room?: any }>(
				'roomShow',
				{},
				'room',
				'roomError',
				'chat/rooms/show',
				{ roomId },
				6000,
			);
			// WS shape: { reqId, room }  | REST shape: room object
			return (res as any)?.room ?? res;
		} catch {
			// fall through
		}
	}
	return await misskeyApi('chat/rooms/show', { roomId }) as any;
}

export async function loadUserMeta(
	chatWs: ChatWsApi,
	userId: string,
): Promise<Misskey.entities.UserDetailed> {
	if (chatWs.ready()) {
		try {
			const res = await chatWs.request<{ user?: any }>(
				'userShow',
				{ userId },
				'user',
				'userError',
				'users/show',
				{ userId },
				6000,
			);
			return ((res as any)?.user ?? res) as Misskey.entities.UserDetailed;
		} catch {
			// fall through
		}
	}
	return await misskeyApi('users/show', { userId });
}

/** Apply avatar cache-bust patch from userAvatarUpdated stream event. */
export function patchAvatarUrls<T extends { avatarUrl?: string | null }>(
	user: T,
	updatedAt?: string,
): T {
	const bust = updatedAt ? `?t=${encodeURIComponent(updatedAt)}` : '';
	const applyBust = (url: string | null | undefined) => {
		if (!url) return url;
		const base = String(url).split('?')[0];
		return bust ? `${base}${bust}` : base;
	};
	return {
		...user,
		avatarUrl: applyBust(user.avatarUrl) ?? user.avatarUrl,
	};
}
