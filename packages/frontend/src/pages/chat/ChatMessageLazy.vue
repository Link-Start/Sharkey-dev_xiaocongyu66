<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
  Lazy mount for chat rows: light placeholder until near viewport, then mount
  XMessage. Keeps a stable minHeight (remembered / estimated) so fast fling
  doesn't collapse rows and multi-correct scroll (twitch / "multiple screens").
-->
<template>
<div
	ref="rootEl"
	:id="`chat-msg-${message.id}`"
	:class="[$style.root, { [$style.mounted]: mounted }]"
	:style="rootStyle"
>
	<XMessage
		v-if="mounted"
		:message="message"
		:highlighted="highlighted"
		@reply="(m) => emit('reply', m)"
		@scrollToReply="(id) => emit('scrollToReply', id)"
	/>
	<div v-else :class="$style.placeholder" aria-hidden="true">
		<div :class="$style.phAvatar"/>
		<div :class="$style.phBody">
			<div :class="$style.phLine"/>
			<div :class="[$style.phLine, $style.phLineShort]"/>
		</div>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import type { NormalizedChatMessage } from './chat-types.js';
import XMessage from './XMessage.vue';
import {
	estimateChatMsgHeight,
	getChatMsgHeight,
	rememberChatMsgHeight,
} from './chat-msg-heights.js';

const props = defineProps<{
	message: NormalizedChatMessage;
	highlighted?: boolean;
	/** Always mount (e.g. pinned / jump target) */
	forceMount?: boolean;
	/** Estimated height before real content measures */
	estimateHeight?: number;
}>();

const emit = defineEmits<{
	(ev: 'reply', message: NormalizedChatMessage): void;
	(ev: 'scrollToReply', id: string): void;
}>();

const rootEl = useTemplateRef<HTMLElement>('rootEl');
const estimated = props.estimateHeight || estimateChatMsgHeight(props.message);
const measuredH = ref(getChatMsgHeight(props.message.id) || estimated);
// Prefer known height as placeholder; only force-mount when asked
const mounted = ref(!!props.forceMount);

/**
 * Always reserve height — even after mount — until real measure is ≥ reserve.
 * Stops placeholder→content jump that yanks the whole list during fling.
 */
const rootStyle = computed(() => {
	const minH = Math.max(measuredH.value || 0, estimated, 56);
	return {
		minHeight: `${minH}px`,
		// Isolate layout thrash of one row from siblings during mount
		contain: 'layout style',
	} as Record<string, string>;
});

let io: IntersectionObserver | null = null;
let ro: ResizeObserver | null = null;
let measureTimers: number[] = [];

function measure() {
	const el = rootEl.value;
	if (!el || !mounted.value) return;
	const h = Math.round(el.getBoundingClientRect().height);
	if (h > 0) {
		// Only grow reserve (media loads late); shrinking would re-jump scroll
		if (h > measuredH.value) {
			measuredH.value = h;
			rememberChatMsgHeight(props.message.id, h);
		} else {
			rememberChatMsgHeight(props.message.id, Math.max(measuredH.value, h));
		}
	}
}

function setupIo() {
	io?.disconnect();
	io = null;
	if (props.forceMount) {
		mounted.value = true;
		return;
	}
	const el = rootEl.value;
	if (!el || typeof IntersectionObserver === 'undefined') {
		mounted.value = true;
		return;
	}

	let root: Element | null = null;
	let p: HTMLElement | null = el.parentElement;
	while (p) {
		const oy = getComputedStyle(p).overflowY;
		if (oy === 'auto' || oy === 'scroll') {
			root = p;
			break;
		}
		p = p.parentElement;
	}

	io = new IntersectionObserver((entries) => {
		for (const e of entries) {
			if (e.isIntersecting) {
				// Defer mount one frame so fling paint isn't blocked by many XMessages
				const id = props.message.id;
				requestAnimationFrame(() => {
					if (props.message.id !== id) return;
					mounted.value = true;
				});
				io?.disconnect();
				io = null;
			}
		}
	}, {
		root: root ?? null,
		// Large margin: mount before row enters viewport during fast fling
		rootMargin: '120% 0px',
		threshold: 0,
	});
	io.observe(el);
}

function setupRo() {
	ro?.disconnect();
	ro = null;
	const el = rootEl.value;
	if (!el || typeof ResizeObserver === 'undefined') return;
	ro = new ResizeObserver(() => measure());
	ro.observe(el);
}

watch(() => props.forceMount, (v) => {
	if (v) mounted.value = true;
});

watch(() => props.highlighted, (v) => {
	if (v) mounted.value = true;
});

watch(mounted, async (v) => {
	if (v) {
		await nextTick();
		requestAnimationFrame(() => {
			measure();
			// Late media (images/video) may grow — remeasure a few times
			for (const t of measureTimers) window.clearTimeout(t);
			measureTimers = [
				window.setTimeout(measure, 200),
				window.setTimeout(measure, 800),
				window.setTimeout(measure, 2000),
			];
		});
	}
});

onMounted(() => {
	setupIo();
	setupRo();
	if (mounted.value) {
		void nextTick().then(measure);
	}
});

onBeforeUnmount(() => {
	measure();
	io?.disconnect();
	io = null;
	ro?.disconnect();
	ro = null;
	for (const t of measureTimers) window.clearTimeout(t);
	measureTimers = [];
});
</script>

<style lang="scss" module>
.root {
	width: 100%;
}

.placeholder {
	display: flex;
	gap: 12px;
	padding: 6px 0;
	opacity: 0.35;
	pointer-events: none;
	/* Fill reserved minHeight so empty gap doesn't flash */
	min-height: inherit;
	box-sizing: border-box;
}

.phAvatar {
	width: 42px;
	height: 42px;
	border-radius: 999px;
	background: var(--MI_THEME-divider);
	flex-shrink: 0;
}

.phBody {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding-top: 4px;
}

.phLine {
	height: 12px;
	border-radius: 6px;
	background: var(--MI_THEME-divider);
	width: 70%;
}

.phLineShort {
	width: 40%;
}
</style>
