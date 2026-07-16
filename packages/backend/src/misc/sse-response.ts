/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** Marker returned from Endpoint.exec to stream Server-Sent Events instead of JSON. */
export const SSE_RESPONSE = Symbol.for('misskey.sseResponse');

export type SseEvent = {
	/** SSE event name (optional) */
	event?: string;
	/** JSON-serializable payload */
	data: Record<string, unknown> | string;
};

export type SseResponse = {
	[SSE_RESPONSE]: true;
	events: AsyncIterable<SseEvent>;
	/** Aborted when the HTTP client disconnects */
	abort?: AbortController;
};

export function isSseResponse(x: unknown): x is SseResponse {
	return typeof x === 'object' && x != null && (x as any)[SSE_RESPONSE] === true && (x as any).events != null;
}

export function createSseResponse(
	events: AsyncIterable<SseEvent>,
	abort?: AbortController,
): SseResponse {
	return {
		[SSE_RESPONSE]: true,
		events,
		abort,
	};
}
