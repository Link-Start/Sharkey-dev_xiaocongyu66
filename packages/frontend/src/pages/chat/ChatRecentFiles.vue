<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
  Horizontal strip of recent file attachments in a group chat.
  Sticky under announcement bar; click jumps to the message.
-->
<template>
<div v-if="items.length > 0" :class="$style.root">
	<div :class="$style.head">
		<span :class="$style.title">
			<i class="ti ti-paperclip"></i>
			{{ title }}
		</span>
		<button
			v-if="items.length > 0"
			type="button"
			class="_button"
			:class="$style.toggle"
			:aria-expanded="expanded"
			@click="expanded = !expanded"
		>
			{{ expanded ? collapseLabel : expandLabel }}
			<i :class="expanded ? 'ti ti-chevron-up' : 'ti ti-chevron-down'"></i>
		</button>
	</div>
	<div v-show="expanded" :class="$style.scroller">
		<button
			v-for="item in items"
			:key="item.messageId"
			type="button"
			class="_button"
			:class="$style.card"
			:title="item.file.name"
			@click="$emit('select', item)"
		>
			<div :class="$style.thumb">
				<img
					v-if="isImage(item.file)"
					:src="item.file.thumbnailUrl || item.file.url"
					:alt="item.file.name"
					loading="lazy"
					decoding="async"
				/>
				<div v-else-if="isVideo(item.file)" :class="$style.iconThumb">
					<img
						v-if="item.file.thumbnailUrl"
						:src="item.file.thumbnailUrl"
						alt=""
						loading="lazy"
						decoding="async"
					/>
					<i v-else class="ti ti-movie"></i>
					<span :class="$style.playBadge"><i class="ti ti-player-play-filled"></i></span>
				</div>
				<div v-else :class="$style.iconThumb">
					<i class="ti ti-file"></i>
				</div>
			</div>
			<div :class="$style.meta">
				<span :class="$style.name">{{ item.file.name }}</span>
				<span v-if="item.file.size" :class="$style.size">{{ bytes(item.file.size) }}</span>
			</div>
		</button>
	</div>
</div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';
import * as Misskey from 'misskey-js';
import { FILE_TYPE_BROWSERSAFE } from '@@/js/const.js';
import bytes from '@/filters/bytes.js';
import { misskeyApi } from '@/utility/misskey-api.js';

export type ChatRoomFileItem = {
	messageId: string;
	createdAt: string;
	fromUserId: string;
	file: Misskey.entities.DriveFile;
};

const props = defineProps<{
	roomId: string;
	title: string;
	expandLabel: string;
	collapseLabel: string;
	/** Bump to reload (e.g. after a new file message) */
	refreshKey?: number;
}>();

const emit = defineEmits<{
	(ev: 'select', item: ChatRoomFileItem): void;
	(ev: 'loaded', count: number): void;
}>();

const items = ref<ChatRoomFileItem[]>([]);
const expanded = ref(true);
let loadSeq = 0;

function isImage(file: Misskey.entities.DriveFile) {
	return file.type.startsWith('image/') && FILE_TYPE_BROWSERSAFE.includes(file.type);
}

function isVideo(file: Misskey.entities.DriveFile) {
	return file.type.startsWith('video/') && FILE_TYPE_BROWSERSAFE.includes(file.type);
}

async function load() {
	const seq = ++loadSeq;
	try {
		const res = await misskeyApi('chat/rooms/files', {
			roomId: props.roomId,
			limit: 24,
		}) as ChatRoomFileItem[];
		if (seq !== loadSeq) return;
		items.value = Array.isArray(res) ? res.filter(x => x?.file?.id) : [];
		emit('loaded', items.value.length);
	} catch {
		if (seq !== loadSeq) return;
		items.value = [];
		emit('loaded', 0);
	}
}

watch(() => [props.roomId, props.refreshKey ?? 0], () => {
	if (props.roomId) void load();
}, { immediate: true });

defineExpose({ reload: load });
</script>

<style lang="scss" module>
.root {
	position: sticky;
	top: var(--MI-stickyTop, 0px);
	z-index: 4;
	margin: 0 0 6px;
	padding: 6px 8px 8px;
	border-radius: 8px;
	background: color-mix(in srgb, var(--MI_THEME-panel) 92%, var(--MI_THEME-bg));
	border: 1px solid var(--MI_THEME-divider);
	box-shadow: 0 1px 0 color-mix(in srgb, var(--MI_THEME-bg) 80%, transparent);
}

.head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	margin-bottom: 4px;
}

.title {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	font-size: 0.8em;
	font-weight: 700;
	opacity: 0.9;
}

.toggle {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	font-size: 0.75em;
	opacity: 0.75;
	padding: 2px 6px;
	border-radius: 999px;

	&:hover {
		opacity: 1;
		background: var(--MI_THEME-buttonBg);
	}
}

.scroller {
	display: flex;
	gap: 8px;
	overflow-x: auto;
	overflow-y: hidden;
	padding-bottom: 2px;
	scroll-snap-type: x proximity;
	-webkit-overflow-scrolling: touch;

	&::-webkit-scrollbar {
		height: 4px;
	}
	&::-webkit-scrollbar-thumb {
		background: var(--MI_THEME-scrollbarHandle);
		border-radius: 4px;
	}
}

.card {
	flex: 0 0 auto;
	width: 96px;
	scroll-snap-align: start;
	text-align: left;
	border-radius: 8px;
	overflow: hidden;
	background: var(--MI_THEME-bg);
	border: 1px solid var(--MI_THEME-divider);
	padding: 0;
	color: inherit;

	&:hover {
		border-color: color-mix(in srgb, var(--MI_THEME-accent) 40%, var(--MI_THEME-divider));
	}
}

.thumb {
	width: 100%;
	height: 64px;
	background: color-mix(in srgb, var(--MI_THEME-fg) 6%, var(--MI_THEME-bg));
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
}

.iconThumb {
	position: relative;
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 1.4em;
	opacity: 0.85;

	img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0.55;
	}
}

.playBadge {
	position: relative;
	z-index: 1;
	width: 28px;
	height: 28px;
	border-radius: 50%;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	background: color-mix(in srgb, #000 45%, transparent);
	color: #fff;
	font-size: 0.75em;
}

.meta {
	padding: 4px 6px 6px;
	display: flex;
	flex-direction: column;
	gap: 1px;
	min-width: 0;
}

.name {
	font-size: 0.7em;
	font-weight: 600;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.size {
	font-size: 0.65em;
	opacity: 0.65;
}
</style>
