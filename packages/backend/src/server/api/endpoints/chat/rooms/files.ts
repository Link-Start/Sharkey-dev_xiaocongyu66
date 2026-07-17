/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ChatService } from '@/core/ChatService.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { IdService } from '@/core/IdService.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['chat'],

	requireCredential: true,

	kind: 'read:chat',

	limit: {
		duration: 1000 * 60,
		max: 60,
	},

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			properties: {
				messageId: { type: 'string', optional: false, nullable: false, format: 'misskey:id' },
				createdAt: { type: 'string', optional: false, nullable: false, format: 'date-time' },
				fromUserId: { type: 'string', optional: false, nullable: false, format: 'misskey:id' },
				file: {
					type: 'object',
					optional: false, nullable: false,
					ref: 'DriveFile',
				},
			},
		},
	},

	errors: {
		noSuchRoom: {
			message: 'No such room.',
			code: 'NO_SUCH_ROOM',
			id: 'a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		roomId: { type: 'string', format: 'misskey:id' },
		limit: { type: 'integer', minimum: 1, maximum: 50, default: 24 },
	},
	required: ['roomId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private chatService: ChatService,
		private driveFileEntityService: DriveFileEntityService,
		private idService: IdService,
	) {
		super(meta, paramDef, async (ps, me) => {
			await this.chatService.checkChatAvailability(me.id, 'read');

			const room = await this.chatService.findRoomById(ps.roomId);
			if (room == null) {
				throw new ApiError(meta.errors.noSuchRoom);
			}

			if (!await this.chatService.hasPermissionToViewRoomTimeline(me, room)) {
				throw new ApiError(meta.errors.noSuchRoom);
			}

			const messages = await this.chatService.roomRecentFiles(ps.roomId, ps.limit);
			const fileIds = messages.map(m => m.fileId!).filter(Boolean);
			const packedMap = await this.driveFileEntityService.packManyByIdsMap(fileIds);

			const out = [];
			for (const m of messages) {
				const file = m.fileId ? packedMap.get(m.fileId) : null;
				if (file == null) continue;
				out.push({
					messageId: m.id,
					createdAt: this.idService.parse(m.id).date.toISOString(),
					fromUserId: m.fromUserId,
					file,
				});
			}
			return out;
		});
	}
}
