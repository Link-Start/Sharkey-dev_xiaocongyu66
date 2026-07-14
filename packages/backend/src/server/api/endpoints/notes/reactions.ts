/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Brackets, type FindOptionsWhere } from 'typeorm';
import type { NoteReactionsRepository } from '@/models/_.js';
import type { MiNoteReaction } from '@/models/NoteReaction.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { NoteReactionEntityService } from '@/core/entities/NoteReactionEntityService.js';
import { DI } from '@/di-symbols.js';
import { QueryService } from '@/core/QueryService.js';
import { GetterService } from '@/server/api/GetterService.js';
import { NoteVisibilityService } from '@/core/NoteVisibilityService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['notes', 'reactions'],

	requireCredential: false,

	allowGet: true,
	cacheSec: 60,

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'NoteReaction',
		},
	},

	errors: {
		noSuchNote: {
			message: 'No such note.',
			code: 'NO_SUCH_NOTE',
			id: '263fff3d-d0e1-4af4-bea7-8408059b451a',
		},
	},

	// 10 calls per 5 seconds
	limit: {
		duration: 1000 * 5,
		max: 10,
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		noteId: { type: 'string', format: 'misskey:id' },
		type: { type: 'string', nullable: true },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
	},
	required: ['noteId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.noteReactionsRepository)
		private noteReactionsRepository: NoteReactionsRepository,

		private noteReactionEntityService: NoteReactionEntityService,
		private queryService: QueryService,
		private getterService: GetterService,
		private readonly noteVisibilityService: NoteVisibilityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// SK-2026-075: seed note must be accessible
			const seed = await this.getterService.getNote(ps.noteId).catch(err => {
				if (err.id === '9725d0ce-ba28-4dde-95a7-2cbb2c15de24') throw new ApiError(meta.errors.noSuchNote);
				throw err;
			});
			const { accessible } = await this.noteVisibilityService.checkNoteVisibilityAsync(seed, me);
			if (!accessible) {
				throw new ApiError(meta.errors.noSuchNote);
			}

			const query = this.queryService.makePaginationQuery(this.noteReactionsRepository.createQueryBuilder('reaction'), ps.sinceId, ps.untilId)
				.andWhere('reaction.noteId = :noteId', { noteId: ps.noteId })
				.leftJoinAndSelect('reaction.user', 'user')
				.leftJoinAndSelect('reaction.note', 'note');

			if (ps.type) {
				// ローカルリアクションはホスト名が . とされているが
				// DB 上ではそうではないので、必要に応じて変換
				const suffix = '@.:';
				const type = ps.type.endsWith(suffix) ? ps.type.slice(0, ps.type.length - suffix.length) + ':' : ps.type;
				query.andWhere('reaction.reaction = :type', { type });
			}

			if (me) this.queryService.generateMutedUserQueryForNotes(query, me);
			if (me) this.queryService.generateBlockedUserQueryForNotes(query, me);

			const reactions = await query.limit(ps.limit).getMany();

			return await this.noteReactionEntityService.packMany(reactions, me);
		});
	}
}
