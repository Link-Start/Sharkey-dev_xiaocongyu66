/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** Distance from bottom under which we treat as "at live edge" (newest) */
export const LIVE_EDGE_PX = 48;
/** Near top of normal scroll → may load older history */
export const HISTORY_TOP_PX = 80;

export function distanceFromLiveEdge(container: HTMLElement): number {
	// Normal scroll: bottom = live edge
	return container.scrollHeight - container.scrollTop - container.clientHeight;
}

export function isNearLiveEdge(container: HTMLElement | null): boolean {
	if (!container) return false;
	return distanceFromLiveEdge(container) <= LIVE_EDGE_PX;
}

export function isNearHistoryTop(container: HTMLElement | null): boolean {
	if (!container) return false;
	return container.scrollTop <= HISTORY_TOP_PX;
}

export function scrollElementToLiveEdge(
	sc: HTMLElement,
	behavior: ScrollBehavior | 'instant' = 'instant',
) {
	// 'instant' is widely supported; fall back via cast for TS lib
	sc.scrollTo({ top: sc.scrollHeight, behavior: behavior as ScrollBehavior });
}

/**
 * After prepending older messages (top of chronological list), keep viewport
 * fixed with height-delta. Works reliably with normal (non-reversed) scroll.
 */
export function preserveScrollAfterPrepend(
	scrollContainer: HTMLElement,
	prevHeight: number,
	prevTop: number,
	anchorId: string | null,
	anchorTopBefore: number | null,
) {
	const delta = scrollContainer.scrollHeight - prevHeight;
	if (delta !== 0) {
		scrollContainer.scrollTop = prevTop + delta;
	}
	// Fine-tune with element anchor if available
	if (anchorId != null && anchorTopBefore != null) {
		const el = window.document.getElementById(`chat-msg-${anchorId}`);
		if (el) {
			const drift = el.getBoundingClientRect().top - anchorTopBefore;
			if (Math.abs(drift) > 0.5) {
				scrollContainer.scrollTop += drift;
			}
		}
	}
}

/**
 * Tracks recent user scroll so auto stick-to-live can be suppressed briefly
 * after the finger lifts (stops twitch).
 */
export function createUserScrollGuard() {
	/** Ignore stick-to-live for a moment after user scrolls */
	let userScrollUntil = 0;
	let lastScrollTop = 0;

	return {
		markUserScrolling(container: HTMLElement) {
			const top = container.scrollTop;
			// Any real movement → user is in control; suppress auto stick briefly after stop
			if (Math.abs(top - lastScrollTop) > 1) {
				userScrollUntil = Date.now() + 450;
			}
			lastScrollTop = top;
		},
		setLastScrollTop(top: number) {
			lastScrollTop = top;
		},
		/** True while user scroll grace window is active */
		get blocked() {
			return Date.now() < userScrollUntil;
		},
		get until() {
			return userScrollUntil;
		},
	};
}

/**
 * Page-level scroll (PageWithHeader _pageScrollable) save/restore.
 * Used when chat pane is hidden via v-show and scrollHeight collapses.
 */
export function createPageScrollMemory(getContainer: () => HTMLElement | null) {
	let savedTop: number | null = null;

	return {
		save() {
			const sc = getContainer();
			if (sc) savedTop = sc.scrollTop;
		},
		/**
		 * Restore after DOM shows the tall timeline again.
		 * Applies in nextTick + rAF (caller supplies nextTick).
		 */
		restore(schedule: (fn: () => void) => void) {
			const top = savedTop;
			if (top == null) return;
			const apply = () => {
				const sc = getContainer();
				if (!sc) return;
				sc.scrollTop = top;
				// Layout (footer / sticky header) may settle one frame later
				requestAnimationFrame(() => {
					const sc2 = getContainer();
					if (sc2) sc2.scrollTop = top;
				});
			};
			schedule(apply);
		},
		get saved() {
			return savedTop;
		},
	};
}
