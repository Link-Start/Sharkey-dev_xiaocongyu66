/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Ported from Misskey CleanRemoteNotesProcessorService, adapted for Sharkey
 * (no note.pageCount column — pages embed notes as free-form content).
 */

import { setTimeout } from 'node:timers/promises';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource, IsNull, LessThan, QueryFailedError, Not } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { MiMeta, MiNote, NotesRepository } from '@/models/_.js';
import type Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import { IdService } from '@/core/IdService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';

@Injectable()
export class CleanRemoteNotesProcessorService {
	private logger: Logger;

	constructor(
		@Inject(DI.meta)
		private meta: MiMeta,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.db)
		private db: DataSource,

		private idService: IdService,
		private queueLoggerService: QueueLoggerService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('clean-remote-notes');
	}

	@bindThis
	private computeProgress(minId: string, maxId: string, cursorLeft: string) {
		const minTs = this.idService.parse(minId).date.getTime();
		const maxTs = this.idService.parse(maxId).date.getTime();
		const cursorTs = this.idService.parse(cursorLeft).date.getTime();
		if (maxTs <= minTs) return 100;
		return ((cursorTs - minTs) / (maxTs - minTs)) * 100;
	}

	@bindThis
	public async process(job: Bull.Job<Record<string, unknown>>): Promise<{
		deletedCount: number;
		oldest: number | null;
		newest: number | null;
		skipped: boolean;
		transientErrors: number;
	}> {
		const getConfig = () => {
			return {
				enabled: this.meta.enableRemoteNotesCleaning,
				maxDuration: this.meta.remoteNotesCleaningMaxProcessingDurationInMinutes * 60 * 1000,
				newestLimit: this.idService.gen(Date.now() - (1000 * 60 * 60 * 24 * this.meta.remoteNotesCleaningExpiryDaysForEachNotes)),
			};
		};

		const initialConfig = getConfig();
		if (!initialConfig.enabled) {
			this.logger.info('Remote notes cleaning is disabled, skipping...');
			return {
				deletedCount: 0,
				oldest: null,
				newest: null,
				skipped: true,
				transientErrors: 0,
			};
		}

		this.logger.info('cleaning remote notes...');

		const startAt = Date.now();

		// Removable remote notes: old enough, remote, not clipped, not pinned, not favorited,
		// no local reactions. (pageCount omitted — Sharkey has no note.pageCount column.)
		const removalCriteria = [
			'note."id" < :newestLimit',
			'note."clippedCount" = 0',
			'note."userHost" IS NOT NULL',
			'NOT EXISTS (SELECT 1 FROM user_note_pining WHERE "noteId" = note."id")',
			'NOT EXISTS (SELECT 1 FROM note_favorite WHERE "noteId" = note."id")',
			'NOT EXISTS (SELECT 1 FROM note_reaction INNER JOIN "user" ON note_reaction."userId" = "user".id WHERE note_reaction."noteId" = note."id" AND "user"."host" IS NULL)',
		].join(' AND ');

		const minId = (await this.notesRepository.createQueryBuilder('note')
			.select('MIN(note.id)', 'minId')
			.where({
				id: LessThan(initialConfig.newestLimit),
				userHost: Not(IsNull()),
				replyId: IsNull(),
				renoteId: IsNull(),
			})
			.getRawOne<{ minId?: MiNote['id'] }>())?.minId;

		if (!minId) {
			this.logger.info('No notes can possibly be deleted, skipping...');
			return {
				deletedCount: 0,
				oldest: null,
				newest: null,
				skipped: false,
				transientErrors: 0,
			};
		}

		const minimumLimit = 10;
		let currentLimit = 100;
		let cursorLeft = '0';

		const candidateNotesCteName = 'candidate_notes';

		const candidateNotesQueryBase = this.notesRepository.createQueryBuilder('note')
			.select('note."id"', 'id')
			.addSelect('note."replyId"', 'replyId')
			.addSelect('note."renoteId"', 'renoteId')
			.addSelect('note."id"', 'rootId')
			.addSelect('TRUE', 'isRemovable')
			.addSelect('TRUE', 'isBase')
			.where('note."id" > :cursorLeft')
			.andWhere(removalCriteria)
			.andWhere({ replyId: IsNull(), renoteId: IsNull() });

		const candidateNotesQueryInductive = this.notesRepository.createQueryBuilder('note')
			.select('note.id', 'id')
			.addSelect('note."replyId"', 'replyId')
			.addSelect('note."renoteId"', 'renoteId')
			.addSelect('parent."rootId"', 'rootId')
			.addSelect(removalCriteria, 'isRemovable')
			.addSelect('FALSE', 'isBase')
			.innerJoin(candidateNotesCteName, 'parent', 'parent."id" = note."replyId" OR parent."id" = note."renoteId"')
			.where('parent."isRemovable" = TRUE');

		const candidateNotesQuery = ({ limit }: { limit: number }) => this.db.createQueryBuilder()
			.select(`"${candidateNotesCteName}"."id"`, 'id')
			.addSelect('unremovable."id" IS NULL', 'isRemovable')
			.addSelect(`BOOL_OR("${candidateNotesCteName}"."isBase")`, 'isBase')
			.addCommonTableExpression(
				`((SELECT "base".* FROM (${candidateNotesQueryBase.orderBy('note.id', 'ASC').limit(limit).getQuery()}) AS "base") UNION ${candidateNotesQueryInductive.getQuery()})`,
				candidateNotesCteName,
				{ recursive: true },
			)
			.from(candidateNotesCteName, candidateNotesCteName)
			.leftJoin(candidateNotesCteName, 'unremovable', `unremovable."rootId" = "${candidateNotesCteName}"."rootId" AND unremovable."isRemovable" = FALSE`)
			.groupBy(`"${candidateNotesCteName}"."id"`)
			.addGroupBy('unremovable."id" IS NULL');

		const stats = {
			deletedCount: 0,
			oldest: null as number | null,
			newest: null as number | null,
		};

		let lowThroughputWarned = false;
		let transientErrors = 0;
		for (;;) {
			const { enabled, maxDuration, newestLimit } = getConfig();
			if (!enabled) {
				this.logger.info('Remote notes cleaning is disabled, processing stopped...');
				break;
			}

			const batchBeginAt = Date.now();
			const elapsed = batchBeginAt - startAt;
			const progress = this.computeProgress(minId, newestLimit, cursorLeft > minId ? cursorLeft : minId);

			if (elapsed >= maxDuration) {
				job.log(`Reached maximum duration of ${maxDuration}ms, stopping... (last cursor: ${cursorLeft}, final progress ${progress}%)`);
				await job.updateProgress(100);
				break;
			}

			const wallClockUsage = elapsed / maxDuration;
			if (wallClockUsage > 0.5 && progress < 50 && !lowThroughputWarned) {
				const msg = `Not projected to finish in time! (wall clock usage ${wallClockUsage * 100}% at ${progress}%, current limit ${currentLimit})`;
				this.logger.warn(msg);
				job.log(msg);
				lowThroughputWarned = true;
			}
			await job.updateProgress(Math.min(99, Math.max(0, progress)));

			const queryBegin = performance.now();
			let noteIds = null;

			try {
				noteIds = await candidateNotesQuery({ limit: currentLimit }).setParameters(
					{ newestLimit, cursorLeft },
				).getRawMany<{ id: MiNote['id'], isRemovable: boolean, isBase: boolean }>();
			} catch (e) {
				if (e instanceof QueryFailedError && (e as QueryFailedError & { driverError?: { code?: string } }).driverError?.code === '57014') {
					if (currentLimit <= minimumLimit) {
						job.log('Local note tree complexity is too high, finding next root note...');

						const idWindow = await this.notesRepository.createQueryBuilder('note')
							.select('id')
							.where('note.id > :cursorLeft')
							.andWhere('note."id" < :newestLimit')
							.andWhere('note."userHost" IS NOT NULL')
							.andWhere({ replyId: IsNull(), renoteId: IsNull() })
							.orderBy('note.id', 'ASC')
							.limit(minimumLimit + 1)
							.setParameters({ cursorLeft, newestLimit })
							.getRawMany<{ id?: MiNote['id'] }>();

						job.log(`Skipped note IDs: ${idWindow.slice(0, minimumLimit).map(id => id.id).join(', ')}`);

						const lastId = idWindow.at(minimumLimit)?.id;
						if (!lastId) {
							job.log('No more notes to clean.');
							break;
						}
						cursorLeft = lastId;
						continue;
					}
					currentLimit = Math.max(minimumLimit, Math.floor(currentLimit * 0.25));
					continue;
				}
				throw e;
			}

			if (noteIds.length === 0) {
				job.log('No more notes to clean.');
				break;
			}

			const queryDuration = performance.now() - queryBegin;
			if (queryDuration > 5000 || noteIds.length > 5000) {
				currentLimit = Math.floor(currentLimit * 0.5);
			} else if (queryDuration < 1000 && noteIds.length < 1000) {
				currentLimit = Math.floor(currentLimit * 1.5);
			}
			currentLimit = Math.min(Math.max(currentLimit, minimumLimit), 5000);

			const deletableNoteIds = noteIds.filter(result => result.isRemovable).map(result => result.id);
			if (deletableNoteIds.length > 0) {
				try {
					await this.notesRepository.delete(deletableNoteIds);

					for (const id of deletableNoteIds) {
						const t = this.idService.parse(id).date.getTime();
						if (stats.oldest === null || t < stats.oldest) {
							stats.oldest = t;
						}
						if (stats.newest === null || t > stats.newest) {
							stats.newest = t;
						}
					}

					stats.deletedCount += deletableNoteIds.length;
				} catch (e) {
					if (e instanceof QueryFailedError && (e as QueryFailedError & { driverError?: { code?: string } }).driverError?.code?.startsWith('23')) {
						transientErrors++;
						job.log(`Error deleting notes: ${e} (transient race condition?)`);
					} else {
						throw e;
					}
				}
			}

			cursorLeft = noteIds.filter(result => result.isBase).reduce((max, { id }) => id > max ? id : max, cursorLeft);

			job.log(`Deleted ${deletableNoteIds.length} notes (batch ${noteIds.length}); ${Date.now() - batchBeginAt}ms`);

			if (process.env.NODE_ENV !== 'test') {
				await setTimeout(Math.min(1000 * 5, queryDuration));
			}
		}

		if (transientErrors > 0) {
			const msg = `${transientErrors} transient errors occurred while cleaning remote notes. You may need a second pass to complete the cleaning.`;
			this.logger.warn(msg);
			job.log(msg);
		}
		this.logger.info('cleaning of remote notes completed.');

		return {
			deletedCount: stats.deletedCount,
			oldest: stats.oldest,
			newest: stats.newest,
			skipped: false,
			transientErrors,
		};
	}
}
