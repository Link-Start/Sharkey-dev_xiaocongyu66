/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Client for notes/translate-stream (HTTP SSE).
 */

import { apiUrl } from '@@/js/config.js';
import { $i } from '@/i.js';

export type TranslateStreamHandlers = {
	/** Full text from cache (no further events). */
	onCached?: (text: string, sourceLang?: string | null) => void;
	/** Incremental token/text chunk. */
	onDelta?: (chunk: string) => void;
	/** Replace entire buffer (e.g. after refusal retry). */
	onReplace?: (text: string) => void;
	/** Final cleaned translation. */
	onDone?: (text: string, sourceLang?: string | null) => void;
	/** Structured error (same codes as notes/translate). */
	onError?: (err: { code?: string; message?: string; id?: string; httpStatus?: number | null }) => void;
};

/**
 * POST /api/notes/translate-stream and consume SSE events.
 * Returns false if the server cannot stream (non-SSE response) so caller may fall back.
 */
export async function translateNoteStream(
	params: {
		noteId: string;
		targetLang: string;
		selective?: boolean;
		token?: string | null;
		signal?: AbortSignal;
	},
	handlers: TranslateStreamHandlers,
): Promise<'ok' | 'fallback' | 'error'> {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		Accept: 'text/event-stream',
	};

	const body: Record<string, unknown> = {
		noteId: params.noteId,
		targetLang: params.targetLang,
	};
	if (typeof params.selective === 'boolean') body.selective = params.selective;

	const auth = params.token !== undefined ? params.token : ($i?.token ?? null);
	if (auth) body.i = auth;

	let res: Response;
	try {
		res = await fetch(`${apiUrl}/notes/translate-stream`, {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
			credentials: 'omit',
			signal: params.signal,
		});
	} catch {
		return 'fallback';
	}

	const ct = res.headers.get('content-type') ?? '';
	if (!res.ok || !ct.includes('text/event-stream') || !res.body) {
		// JSON ApiError body
		if (!res.ok) {
			try {
				const j = await res.json();
				const err = j?.error ?? j;
				handlers.onError?.({
					code: err?.code,
					message: err?.message,
					id: err?.id,
					httpStatus: err?.info?.httpStatus ?? res.status,
				});
				return 'error';
			} catch {
				return 'fallback';
			}
		}
		return 'fallback';
	}

	const reader = res.body.getReader();
	const decoder = new TextDecoder('utf-8');
	let buffer = '';
	let sawOk = false;
	let sawError = false;

	const dispatch = (event: string, dataRaw: string) => {
		let data: any = dataRaw;
		try {
			data = JSON.parse(dataRaw);
		} catch { /* keep string */ }

		if (event === 'cached') {
			handlers.onCached?.(data?.text ?? '', data?.sourceLang);
			sawOk = true;
		} else if (event === 'delta') {
			handlers.onDelta?.(typeof data?.text === 'string' ? data.text : String(data ?? ''));
		} else if (event === 'replace') {
			handlers.onReplace?.(typeof data?.text === 'string' ? data.text : String(data ?? ''));
		} else if (event === 'done') {
			handlers.onDone?.(data?.text ?? '', data?.sourceLang);
			sawOk = true;
		} else if (event === 'error') {
			handlers.onError?.({
				code: data?.code,
				message: data?.message,
				id: data?.id,
				httpStatus: data?.httpStatus,
			});
			sawError = true;
		}
	};

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });

			// SSE events separated by blank line
			const parts = buffer.split(/\r?\n\r?\n/);
			buffer = parts.pop() ?? '';

			for (const part of parts) {
				const lines = part.split(/\r?\n/);
				let event = 'message';
				const dataLines: string[] = [];
				for (const line of lines) {
					if (line.startsWith('event:')) event = line.slice(6).trim();
					else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
				}
				if (dataLines.length) {
					dispatch(event, dataLines.join('\n'));
				}
			}
		}
	} catch (e: any) {
		if (e?.name === 'AbortError') return 'error';
		if (!sawOk && !sawError) return 'fallback';
		return sawOk ? 'ok' : 'error';
	}

	if (sawError && !sawOk) return 'error';
	if (sawOk) return 'ok';
	return 'fallback';
}
