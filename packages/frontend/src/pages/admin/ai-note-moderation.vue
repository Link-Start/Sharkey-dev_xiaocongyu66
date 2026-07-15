<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px; --MI_SPACER-max: 32px;">
		<div class="_gaps">
			<MkFolder :defaultOpen="true">
				<template #icon><i class="ti ti-robot"></i></template>
				<template #label>{{ t('title') }}</template>
				<template v-if="form.savedState.enableLocalNotes || form.savedState.enableRemoteNotes" #suffix>{{ t('on') }}</template>
				<template v-else #suffix>{{ t('off') }}</template>
				<template v-if="form.modified.value" #footer>
					<MkFormFooter :form="form"/>
				</template>

				<div class="_gaps">
					<MkInfo>{{ t('info') }}</MkInfo>

					<MkSwitch v-model="form.state.enableLocalNotes">
						<template #label>{{ t('enableLocal') }}<span v-if="form.modifiedStates.enableLocalNotes" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('enableLocalCaption') }}</template>
					</MkSwitch>

					<MkSwitch v-model="form.state.enableRemoteNotes">
						<template #label>{{ t('enableRemote') }}<span v-if="form.modifiedStates.enableRemoteNotes" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('enableRemoteCaption') }}</template>
					</MkSwitch>

					<MkInput v-model="form.state.baseUrl" type="url">
						<template #label>{{ t('baseUrl') }}<span v-if="form.modifiedStates.baseUrl" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('baseUrlCaption') }}</template>
					</MkInput>

					<MkInput v-model="form.state.apiKey" type="password">
						<template #label>{{ t('apiKey') }}<span v-if="form.modifiedStates.apiKey" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('apiKeyCaption') }}</template>
					</MkInput>

					<MkInput v-model="form.state.model">
						<template #label>{{ t('model') }}<span v-if="form.modifiedStates.model" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('modelCaption') }}</template>
					</MkInput>

					<MkSelect v-model="form.state.apiStyle">
						<template #label>{{ t('apiStyle') }}<span v-if="form.modifiedStates.apiStyle" class="_modified">{{ i18n.ts.modified }}</span></template>
						<option value="auto">{{ t('apiStyleAuto') }}</option>
						<option value="chat.completions">chat/completions</option>
						<option value="responses">responses</option>
					</MkSelect>

					<MkSelect v-model="form.state.action">
						<template #label>{{ t('action') }}<span v-if="form.modifiedStates.action" class="_modified">{{ i18n.ts.modified }}</span></template>
						<option value="reject">{{ t('actionReject') }}</option>
						<option value="cw">{{ t('actionCw') }}</option>
						<option value="hide">{{ t('actionHide') }}</option>
						<option value="home">{{ t('actionHome') }}</option>
					</MkSelect>

					<MkInput v-model="form.state.requestTimeoutMs" type="number">
						<template #label>{{ t('timeout') }}<span v-if="form.modifiedStates.requestTimeoutMs" class="_modified">{{ i18n.ts.modified }}</span></template>
					</MkInput>

					<MkSwitch v-model="form.state.failOpen">
						<template #label>{{ t('failOpen') }}<span v-if="form.modifiedStates.failOpen" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('failOpenCaption') }}</template>
					</MkSwitch>

					<MkTextarea v-model="form.state.systemPrompt">
						<template #label>{{ t('systemPrompt') }}<span v-if="form.modifiedStates.systemPrompt" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('systemPromptCaption') }}</template>
					</MkTextarea>
				</div>
			</MkFolder>
		</div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { fetchInstance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import MkFolder from '@/components/MkFolder.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkInput from '@/components/MkInput.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkTextarea from '@/components/MkTextarea.vue';
import MkInfo from '@/components/MkInfo.vue';
import { useForm } from '@/use/use-form.js';
import MkFormFooter from '@/components/MkFormFooter.vue';

const L = (i18n.ts as any)._aiNoteModeration ?? {};
function t(key: string): string {
	const v = L[key];
	return typeof v === 'string' && v.length ? v : key;
}


const meta = await misskeyApi('admin/meta') as any;
const cfg = meta.aiNoteModerationConfig ?? {};

const form = useForm({
	enableLocalNotes: cfg.enableLocalNotes === true,
	enableRemoteNotes: cfg.enableRemoteNotes === true,
	baseUrl: cfg.baseUrl ?? '',
	apiKey: '',
	model: cfg.model ?? 'gpt-4o-mini',
	apiStyle: cfg.apiStyle ?? 'auto',
	action: cfg.action ?? 'reject',
	requestTimeoutMs: cfg.requestTimeoutMs ?? 8000,
	failOpen: cfg.failOpen !== false,
	systemPrompt: cfg.systemPrompt ?? '',
}, async (state) => {
	const payload: any = {
		enableLocalNotes: state.enableLocalNotes,
		enableRemoteNotes: state.enableRemoteNotes,
		baseUrl: state.baseUrl?.trim() ? state.baseUrl.trim() : null,
		model: state.model?.trim() || 'gpt-4o-mini',
		apiStyle: state.apiStyle,
		action: state.action,
		requestTimeoutMs: Number(state.requestTimeoutMs) || 8000,
		failOpen: state.failOpen,
		systemPrompt: state.systemPrompt?.trim() ? state.systemPrompt.trim() : null,
	};
	// Only send apiKey when user typed a new one (empty keeps previous)
	if (state.apiKey && state.apiKey !== '<redacted>') {
		payload.apiKey = state.apiKey;
	}
	await os.apiWithDialog('admin/update-meta', {
		aiNoteModerationConfig: payload,
	});
	// clear password field after save so we don't re-send
	form.state.apiKey = '';
	await fetchInstance(true);
});

const headerActions = computed(() => []);
const headerTabs = computed(() => []);

definePage(() => ({
	title: t('title'),
	icon: 'ti ti-robot',
}));
</script>
