/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * HTTP SSE streaming translation for notes (OpenAI-compatible upstream stream:true).
 * Falls back to classic/non-stream path is NOT done here — client should call notes/translate if stream fails hard.
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { GetterService } from '@/server/api/GetterService.js';
import type { MiUserProfile } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { hasText } from '@/models/Note.js';
import { NoteVisibilityService } from '@/core/NoteVisibilityService.js';
import { ApiError } from '@/server/api/error.js';
import { AiTranslationError, AiTranslationService } from '@/core/AiTranslationService.js';
import type { UserProfilesRepository } from '@/models/_.js';
import { createSseResponse } from '@/misc/sse-response.js';

export const meta = {
	tags: ['notes'],

	requireCredential: 'optional',
	kind: 'read:account',
	requiredRolePolicy: 'canUseTranslator',

	// OpenAPI still documents a JSON shape; actual response is text/event-stream
	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			sourceLang: { type: 'string', optional: true, nullable: false },
			text: { type: 'string', optional: true, nullable: false },
		},
	},

	errors: {
		unavailable: {
			message: 'Translate of notes unavailable.',
			code: 'UNAVAILABLE',
			id: '50a70314-2d8a-431b-b433-efa5cc56444c',
		},
		noSuchNote: {
			message: 'No such note.',
			code: 'NO_SUCH_NOTE',
			id: 'bea9b03f-36e0-49c5-a4db-627a029f8971',
		},
		cannotTranslateInvisibleNote: {
			message: 'Cannot translate invisible note.',
			code: 'CANNOT_TRANSLATE_INVISIBLE_NOTE',
			id: 'ea29f2ca-c368-43b3-aaf1-5ac3e74bbe5d',
		},
		translationFailed: {
			message: 'Failed to translate note. Please try again later or contact an administrator for assistance.',
			code: 'TRANSLATION_FAILED',
			id: '4e7a1a4f-521c-4ba2-b10a-69e5e2987b2f',
		},
		aiNotConfigured: {
			message: 'AI translation is not configured (missing endpoint or API key).',
			code: 'AI_NOT_CONFIGURED',
			id: 'a1t0c0n1-0001-4000-8000-000000000001',
			kind: 'server',
			httpStatusCode: 503,
		},
		aiBadRequest: {
			message: 'AI provider rejected the request (HTTP 400 Bad Request). Check model name and request format.',
			code: 'AI_BAD_REQUEST',
			id: 'a1t0c0n1-0001-4000-8000-000000000400',
			kind: 'client',
			httpStatusCode: 502,
		},
		aiAuthFailed: {
			message: 'AI provider rejected the API key (HTTP 401 Unauthorized).',
			code: 'AI_AUTH_FAILED',
			id: 'a1t0c0n1-0001-4000-8000-000000000401',
			kind: 'server',
			httpStatusCode: 502,
		},
		aiPaymentRequired: {
			message: 'AI provider requires payment or has insufficient quota (HTTP 402).',
			code: 'AI_PAYMENT_REQUIRED',
			id: 'a1t0c0n1-0001-4000-8000-000000000402',
			kind: 'server',
			httpStatusCode: 502,
		},
		aiForbidden: {
			message: 'AI provider denied access (HTTP 403 Forbidden).',
			code: 'AI_FORBIDDEN',
			id: 'a1t0c0n1-0001-4000-8000-000000000403',
			kind: 'server',
			httpStatusCode: 502,
		},
		aiRateLimited: {
			message: 'AI provider rate limit exceeded (HTTP 429).',
			code: 'AI_RATE_LIMITED',
			id: 'a1t0c0n1-0001-4000-8000-000000000429',
			kind: 'client',
			httpStatusCode: 429,
		},
		aiTimeout: {
			message: 'AI translation timed out.',
			code: 'AI_TIMEOUT',
			id: 'a1t0c0n1-0001-4000-8000-000000000408',
			kind: 'server',
			httpStatusCode: 504,
		},
		aiBadGateway: {
			message: 'AI gateway/upstream error (HTTP 502 Bad Gateway).',
			code: 'AI_BAD_GATEWAY',
			id: 'a1t0c0n1-0001-4000-8000-000000000502',
			kind: 'server',
			httpStatusCode: 502,
		},
		aiOriginUnreachable: {
			message: 'AI origin is unreachable (HTTP 522). Check network, DNS, or provider status.',
			code: 'AI_ORIGIN_UNREACHABLE',
			id: 'a1t0c0n1-0001-4000-8000-000000000522',
			kind: 'server',
			httpStatusCode: 502,
		},
		aiUpstreamError: {
			message: 'AI provider returned an error.',
			code: 'AI_UPSTREAM_ERROR',
			id: 'a1t0c0n1-0001-4000-8000-0000000005xx',
			kind: 'server',
			httpStatusCode: 502,
		},
		aiEmptyResponse: {
			message: 'AI returned an empty translation.',
			code: 'AI_EMPTY_RESPONSE',
			id: 'a1t0c0n1-0001-4000-8000-000000000204',
			kind: 'server',
			httpStatusCode: 502,
		},
		aiScopeDisabled: {
			message: 'AI translation is disabled for notes.',
			code: 'AI_SCOPE_DISABLED',
			id: 'a1t0c0n1-0001-4000-8000-000000000503',
			kind: 'client',
			httpStatusCode: 403,
		},
	},

	limit: {
		duration: 1000 * 5,
		max: 10,
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		noteId: { type: 'string', format: 'misskey:id' },
		targetLang: { type: 'string' },
		selective: { type: 'boolean' },
	},
	required: ['noteId', 'targetLang'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		private getterService: GetterService,
		private readonly noteVisibilityService: NoteVisibilityService,
		private readonly aiTranslationService: AiTranslationService,
	) {
		super(meta, paramDef, async (ps, me, _token, _file, _cleanup, _ip, headers) => {
			const note = await this.getterService.getNote(ps.noteId).catch(err => {
				if (err.id === '9725d0ce-ba28-4dde-95a7-2cbb2c15de24') throw new ApiError(meta.errors.noSuchNote);
				throw err;
			});

			const { accessible } = await this.noteVisibilityService.checkNoteVisibilityAsync(note, me);
			if (!accessible) {
				throw new ApiError(meta.errors.cannotTranslateInvisibleNote);
			}

			if (!hasText(note)) {
				return createSseResponse((async function* () {
					yield { event: 'done', data: { text: '' } };
				})());
			}

			let profile: MiUserProfile | null = null;
			if (me) {
				profile = await this.userProfilesRepository.findOneBy({ userId: me.id });
			}
			const userOverride = this.aiTranslationService.profileToOverride(profile);

			if (!this.aiTranslationService.isAvailable('notes', userOverride)) {
				throw new ApiError(meta.errors.unavailable);
			}

			let targetLang = ps.targetLang;
			if (userOverride?.targetLang) targetLang = userOverride.targetLang;
			const aiCfg = this.aiTranslationService.getConfig();
			const selective = ps.selective ?? userOverride?.selective ?? aiCfg.selectiveByDefault;
			const nativeLang = (profile?.lang?.trim() || userOverride?.targetLang?.trim() || targetLang) as string;

			// Client disconnect → abort upstream (ApiCallService aborts this controller)
			const ac = new AbortController();

			const mapAiError = (e: unknown): never => {
				if (e instanceof AiTranslationError) {
					const table: Record<AiTranslationError['code'], typeof meta.errors[keyof typeof meta.errors]> = {
						AI_NOT_CONFIGURED: meta.errors.aiNotConfigured,
						AI_BAD_REQUEST: meta.errors.aiBadRequest,
						AI_AUTH_FAILED: meta.errors.aiAuthFailed,
						AI_PAYMENT_REQUIRED: meta.errors.aiPaymentRequired,
						AI_FORBIDDEN: meta.errors.aiForbidden,
						AI_RATE_LIMITED: meta.errors.aiRateLimited,
						AI_TIMEOUT: meta.errors.aiTimeout,
						AI_BAD_GATEWAY: meta.errors.aiBadGateway,
						AI_ORIGIN_UNREACHABLE: meta.errors.aiOriginUnreachable,
						AI_UPSTREAM_ERROR: meta.errors.aiUpstreamError,
						AI_EMPTY_RESPONSE: meta.errors.aiEmptyResponse,
						AI_SCOPE_DISABLED: meta.errors.aiScopeDisabled,
					};
					throw new ApiError(table[e.code] ?? meta.errors.translationFailed, {
						httpStatus: e.httpStatus,
						detail: e.message,
					});
				}
				throw e;
			};

			const self = this;
			const noteText = note.text;

			return createSseResponse((async function* () {
				try {
					for await (const ev of self.aiTranslationService.translateStream({
						text: noteText,
						targetLang,
						scope: 'notes',
						selective: selective === true,
						userOverride,
						nativeLang,
						signal: ac.signal,
					})) {
						if (ev.type === 'cached') {
							yield { event: 'cached', data: { text: ev.text, sourceLang: ev.sourceLang ?? null } };
							return;
						}
						if (ev.type === 'delta') {
							yield { event: 'delta', data: { text: ev.text } };
						} else if (ev.type === 'replace') {
							yield { event: 'replace', data: { text: ev.text } };
						} else if (ev.type === 'done') {
							yield { event: 'done', data: { text: ev.text, sourceLang: ev.sourceLang ?? null } };
						}
					}
				} catch (e) {
					if (ac.signal.aborted) return;
					if (e instanceof ApiError) {
						yield {
							event: 'error',
							data: {
								code: e.code,
								message: e.message,
								id: e.id,
								httpStatus: e.info?.httpStatus ?? e.httpStatusCode ?? null,
							},
						};
						return;
					}
					try {
						mapAiError(e);
					} catch (mapped) {
						if (mapped instanceof ApiError) {
							yield {
								event: 'error',
								data: {
									code: mapped.code,
									message: mapped.message,
									id: mapped.id,
									httpStatus: mapped.info?.httpStatus ?? mapped.httpStatusCode ?? null,
								},
							};
							return;
						}
						yield {
							event: 'error',
							data: {
								code: 'TRANSLATION_FAILED',
								message: 'Failed to translate note.',
								id: meta.errors.translationFailed.id,
							},
						};
					}
				}
			})(), ac);
		});
	}
}
