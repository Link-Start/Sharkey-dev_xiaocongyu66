/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { SystemWebhookEntityService } from '@/core/entities/SystemWebhookEntityService.js';
import { systemWebhookEventTypes } from '@/models/SystemWebhook.js';
import { SystemWebhookService } from '@/core/SystemWebhookService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['admin', 'system-webhook'],

	requireCredential: true,
	requireModerator: true,
	secure: true,
	kind: 'write:admin:system-webhook',

	errors: {
		invalidUrl: {
			message: 'Invalid webhook URL (https required; no credentials in URL).',
			code: 'INVALID_WEBHOOK_URL',
			id: 'c0ffee00-sysw-4a11-b001-000000000001',
		},
	},

	res: {
		type: 'object',
		ref: 'SystemWebhook',
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		id: {
			type: 'string',
			format: 'misskey:id',
		},
		isActive: {
			type: 'boolean',
		},
		name: {
			type: 'string',
			minLength: 1,
			maxLength: 255,
		},
		on: {
			type: 'array',
			items: {
				type: 'string',
				enum: systemWebhookEventTypes,
			},
		},
		url: {
			type: 'string',
			minLength: 1,
			maxLength: 1024,
		},
		secret: {
			type: 'string',
			minLength: 1,
			maxLength: 1024,
		},
	},
	required: [
		'id',
		'isActive',
		'name',
		'on',
		'url',
		'secret',
	],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private systemWebhookService: SystemWebhookService,
		private systemWebhookEntityService: SystemWebhookEntityService,
		private utilityService: UtilityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// SK-2026-071: same URL hardening as user webhooks
			if (!this.utilityService.isValidUrl(ps.url, { allowHttp: false, allowFragment: false })) {
				throw new ApiError(meta.errors.invalidUrl);
			}
			try {
				const u = new URL(ps.url);
				if (u.username || u.password) throw new Error('creds');
				if (!this.utilityService.checkHttps(u, false)) throw new Error('scheme');
			} catch {
				throw new ApiError(meta.errors.invalidUrl);
			}

			const result = await this.systemWebhookService.updateSystemWebhook(
				{
					id: ps.id,
					isActive: ps.isActive,
					name: ps.name,
					on: ps.on,
					url: ps.url,
					secret: ps.secret,
				},
				me,
			);

			return await this.systemWebhookEntityService.pack(result);
		});
	}
}
