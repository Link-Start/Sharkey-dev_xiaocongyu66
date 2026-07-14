/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ChatService } from '@/core/ChatService.js';
import { ChatEntityService } from '@/core/entities/ChatEntityService.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['chat'],

	requireCredential: true,

	kind: 'write:chat',

	// SK-2026-072: tighter than default 10/s for invite-code guessing
	limit: {
		duration: 1000 * 60,
		max: 5,
	},

	res: {
		type: 'object',
		optional: false, nullable: false,
		ref: 'ChatRoom',
	},

	errors: {
		cannotJoin: {
			message: 'Cannot join this room.',
			code: 'CANNOT_JOIN',
			id: 'e0f1a2b3-c4d5-6789-e0f1-a2b3c4d56789',
		},
		banned: {
			message: 'You are banned from this room.',
			code: 'BANNED_FROM_ROOM',
			id: 'd7e8f9a0-b1c2-3456-d7e8-f9a0b1c23456',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		inviteCode: { type: 'string', minLength: 1, maxLength: 64 },
	},
	required: ['inviteCode'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private chatService: ChatService,
		private chatEntityService: ChatEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			await this.chatService.checkChatAvailability(me.id, 'write');

			try {
				const room = await this.chatService.joinByInviteCode(me.id, ps.inviteCode);
				return await this.chatEntityService.packRoom(room, me);
			} catch (e) {
				const msg = e instanceof Error ? e.message : '';
				if (msg === 'banned from room') {
					throw new ApiError(meta.errors.banned);
				}
				throw new ApiError(meta.errors.cannotJoin);
			}
		});
	}
}
