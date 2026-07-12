/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import type { ChatE2eeKeysRepository } from '@/models/_.js';
import { ChatService } from '@/core/ChatService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';

export const meta = {
	tags: ['chat'],
	requireCredential: true,
	kind: 'write:chat',
	secure: true,
	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			ok: { type: 'boolean', optional: false, nullable: false },
			keyId: { type: 'string', optional: false, nullable: true },
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		publicKey: { type: 'string', minLength: 32, maxLength: 8192 },
		keyId: { type: 'string', nullable: true, maxLength: 64 },
	},
	required: ['publicKey'],
} as const;

function fingerprintKeyId(publicKey: string): string {
	return createHash('sha256').update(publicKey).digest('hex').slice(0, 16);
}

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.chatE2eeKeysRepository)
		private chatE2eeKeysRepository: ChatE2eeKeysRepository,
		private chatService: ChatService,
		private globalEventService: GlobalEventService,
	) {
		super(meta, paramDef, async (ps, me) => {
			await this.chatService.checkChatAvailability(me.id, 'write');

			// Validate JWK JSON shape lightly
			let parsed: any;
			try {
				parsed = JSON.parse(ps.publicKey);
			} catch {
				throw new Error('invalid public key json');
			}
			if (parsed?.kty !== 'EC' || !parsed?.x || !parsed?.y) {
				throw new Error('invalid public key jwk');
			}
			// Never accept private material
			if (parsed.d) {
				throw new Error('private key not allowed');
			}

			const keyId = (ps.keyId && ps.keyId.trim()) || fingerprintKeyId(ps.publicKey);
			const updatedAt = new Date();

			const existing = await this.chatE2eeKeysRepository.findOneBy({ userId: me.id });
			if (existing) {
				await this.chatE2eeKeysRepository.update(me.id, {
					publicKey: ps.publicKey,
					keyId,
					updatedAt,
				});
			} else {
				await this.chatE2eeKeysRepository.insert({
					userId: me.id,
					publicKey: ps.publicKey,
					keyId,
					updatedAt,
				});
			}

			// Notify self (other devices) and rely on peers to refresh on next chat open /
			// when they receive e2eeKeyUpdated via main if subscribed
			await this.globalEventService.publishMainStream(me.id, 'e2eeKeyUpdated', {
				userId: me.id,
				keyId,
				updatedAt: updatedAt.toISOString(),
			});

			return { ok: true, keyId };
		});
	}
}
