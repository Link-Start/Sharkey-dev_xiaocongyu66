/*
 * SPDX-FileCopyrightText: syuilo and misskey-project / Sharkey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class RemoteNotesCleaning1776400000000 {
	name = 'RemoteNotesCleaning1776400000000';

	async up(queryRunner) {
		await queryRunner.query(`
			ALTER TABLE "meta"
			ADD COLUMN IF NOT EXISTS "enableRemoteNotesCleaning" boolean NOT NULL DEFAULT false
		`);
		await queryRunner.query(`
			ALTER TABLE "meta"
			ADD COLUMN IF NOT EXISTS "remoteNotesCleaningMaxProcessingDurationInMinutes" integer NOT NULL DEFAULT 60
		`);
		await queryRunner.query(`
			ALTER TABLE "meta"
			ADD COLUMN IF NOT EXISTS "remoteNotesCleaningExpiryDaysForEachNotes" integer NOT NULL DEFAULT 90
		`);
	}

	async down(queryRunner) {
		await queryRunner.query(`
			ALTER TABLE "meta" DROP COLUMN IF EXISTS "enableRemoteNotesCleaning"
		`);
		await queryRunner.query(`
			ALTER TABLE "meta" DROP COLUMN IF EXISTS "remoteNotesCleaningMaxProcessingDurationInMinutes"
		`);
		await queryRunner.query(`
			ALTER TABLE "meta" DROP COLUMN IF EXISTS "remoteNotesCleaningExpiryDaysForEachNotes"
		`);
	}
}
