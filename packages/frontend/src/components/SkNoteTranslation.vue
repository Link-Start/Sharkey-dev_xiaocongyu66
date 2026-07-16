<!--
SPDX-FileCopyrightText: hazelnoot and other Sharkey contributors
SPDX-License-Identifier: AGPL-3.0-only

Displays a translated version of a note.
-->

<template>
<div v-if="translating || translation != null" :class="$style.translation">
	<!-- Streaming: show partial text while still loading -->
	<div v-if="translation && translation.text != null">
		<b v-if="translation.sourceLang">{{ i18n.tsx.translatedFrom({ x: translation.sourceLang }) }}: </b>
		<span v-else-if="translating" :class="$style.streamingLabel"><i class="ti ti-language"></i> …</span>
		<Mfm :text="translation.text" :isBlock="true" :author="note.user" :nyaize="'respect'" :emojiUrls="note.emojis" class="_selectable"/>
		<span v-if="translating" :class="$style.caret" aria-hidden="true">▍</span>
	</div>
	<MkLoading v-else-if="translating" mini/>
	<div v-else>{{ i18n.ts.translationFailed }}</div>
</div>
</template>

<script setup lang="ts">
import * as Misskey from 'misskey-js';
import { watch } from 'vue';
import { i18n } from '@/i18n.js';

const props = withDefaults(defineProps<{
	note: Misskey.entities.Note;
	translating?: boolean;
	translation?: Misskey.entities.NotesTranslateResponse | false | null;
}>(), {
	translating: false,
	translation: null,
});

if (_DEV_) {
	// Prop watch syntax: https://stackoverflow.com/a/59127059
	watch(
		[() => props.translation, () => props.translating],
		([translation, translating]) => console.debug('Translation status changed: ', { translation, translating }),
	);
}
</script>

<style module lang="scss">
.translation {
	border: solid 0.5px var(--MI_THEME-divider);
	border-radius: var(--MI-radius);
	padding: 12px;
	margin-top: 8px;
}

.streamingLabel {
	opacity: 0.7;
	font-size: 0.9em;
	margin-right: 0.35em;
}

.caret {
	display: inline-block;
	margin-left: 1px;
	animation: skTranslateBlink 1s step-end infinite;
	opacity: 0.7;
}

@keyframes skTranslateBlink {
	50% { opacity: 0; }
}
</style>
