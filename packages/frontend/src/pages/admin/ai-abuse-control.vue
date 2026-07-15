<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px; --MI_SPACER-max: 32px;">
		<div class="_gaps">
			<MkFolder :defaultOpen="true">
				<template #icon><i class="ti ti-shield-lock"></i></template>
				<template #label>{{ t('title') }}</template>
				<template v-if="form.savedState.enabled" #suffix>{{ t('on') }}</template>
				<template v-else #suffix>{{ t('off') }}</template>
				<template v-if="form.modified.value" #footer>
					<MkFormFooter :form="form"/>
				</template>

				<div class="_gaps">
					<MkInfo>{{ t('info') }}</MkInfo>

					<MkSwitch v-model="form.state.enabled">
						<template #label>{{ t('enabled') }}<span v-if="form.modifiedStates.enabled" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('enabledCaption') }}</template>
					</MkSwitch>

					<MkSwitch v-model="form.state.checkOnSignin">
						<template #label>{{ t('checkOnSignin') }}<span v-if="form.modifiedStates.checkOnSignin" class="_modified">{{ i18n.ts.modified }}</span></template>
					</MkSwitch>

					<MkSwitch v-model="form.state.checkOnSignup">
						<template #label>{{ t('checkOnSignup') }}<span v-if="form.modifiedStates.checkOnSignup" class="_modified">{{ i18n.ts.modified }}</span></template>
					</MkSwitch>

					<MkSwitch v-model="form.state.autoSuspend">
						<template #label>{{ t('autoSuspend') }}<span v-if="form.modifiedStates.autoSuspend" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('autoSuspendCaption') }}</template>
					</MkSwitch>

					<MkSwitch v-model="form.state.hideNotesOnSuspend">
						<template #label>{{ t('hideNotes') }}<span v-if="form.modifiedStates.hideNotesOnSuspend" class="_modified">{{ i18n.ts.modified }}</span></template>
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
					</MkInput>

					<MkSelect v-model="form.state.apiStyle">
						<template #label>{{ t('apiStyle') }}<span v-if="form.modifiedStates.apiStyle" class="_modified">{{ i18n.ts.modified }}</span></template>
						<option value="auto">{{ t('apiStyleAuto') }}</option>
						<option value="chat.completions">chat/completions</option>
						<option value="responses">responses</option>
					</MkSelect>

					<MkInput v-model="form.state.minLinkedAccounts" type="number">
						<template #label>{{ t('minLinked') }}<span v-if="form.modifiedStates.minLinkedAccounts" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('minLinkedCaption') }}</template>
					</MkInput>

					<MkSwitch v-model="form.state.requireIpAndFingerprint">
						<template #label>{{ t('requireBoth') }}<span v-if="form.modifiedStates.requireIpAndFingerprint" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('requireBothCaption') }}</template>
					</MkSwitch>

					<MkInput v-model="form.state.signinWindowMinutes" type="number">
						<template #label>{{ t('signinWindow') }}<span v-if="form.modifiedStates.signinWindowMinutes" class="_modified">{{ i18n.ts.modified }}</span></template>
					</MkInput>

					<MkInput v-model="form.state.maxSigninsInWindow" type="number">
						<template #label>{{ t('maxSignins') }}<span v-if="form.modifiedStates.maxSigninsInWindow" class="_modified">{{ i18n.ts.modified }}</span></template>
					</MkInput>

					<MkInput v-model="form.state.cooldownSeconds" type="number">
						<template #label>{{ t('cooldown') }}<span v-if="form.modifiedStates.cooldownSeconds" class="_modified">{{ i18n.ts.modified }}</span></template>
					</MkInput>

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

const L = (i18n.ts as any)._aiAbuseControl ?? {};
function t(key: string): string {
	const v = L[key];
	return typeof v === 'string' && v.length ? v : key;
}


const meta = await misskeyApi('admin/meta') as any;
const cfg = meta.aiAbuseControlConfig ?? {};

const form = useForm({
	enabled: cfg.enabled === true,
	checkOnSignin: cfg.checkOnSignin !== false,
	checkOnSignup: cfg.checkOnSignup !== false,
	autoSuspend: cfg.autoSuspend === true,
	hideNotesOnSuspend: cfg.hideNotesOnSuspend !== false,
	baseUrl: cfg.baseUrl ?? '',
	apiKey: '',
	model: cfg.model ?? 'gpt-4o-mini',
	apiStyle: cfg.apiStyle ?? 'auto',
	minLinkedAccounts: cfg.minLinkedAccounts ?? 3,
	requireIpAndFingerprint: cfg.requireIpAndFingerprint !== false,
	signinWindowMinutes: cfg.signinWindowMinutes ?? 60,
	maxSigninsInWindow: cfg.maxSigninsInWindow ?? 20,
	cooldownSeconds: cfg.cooldownSeconds ?? 300,
	requestTimeoutMs: cfg.requestTimeoutMs ?? 10000,
	failOpen: cfg.failOpen !== false,
	systemPrompt: cfg.systemPrompt ?? '',
}, async (state) => {
	const payload: any = {
		enabled: state.enabled,
		checkOnSignin: state.checkOnSignin,
		checkOnSignup: state.checkOnSignup,
		autoSuspend: state.autoSuspend,
		hideNotesOnSuspend: state.hideNotesOnSuspend,
		baseUrl: state.baseUrl?.trim() ? state.baseUrl.trim() : null,
		model: state.model?.trim() || 'gpt-4o-mini',
		apiStyle: state.apiStyle,
		minLinkedAccounts: Number(state.minLinkedAccounts) || 3,
		requireIpAndFingerprint: state.requireIpAndFingerprint,
		signinWindowMinutes: Number(state.signinWindowMinutes) || 60,
		maxSigninsInWindow: Number(state.maxSigninsInWindow) || 20,
		cooldownSeconds: Number(state.cooldownSeconds) || 0,
		requestTimeoutMs: Number(state.requestTimeoutMs) || 10000,
		failOpen: state.failOpen,
		systemPrompt: state.systemPrompt?.trim() ? state.systemPrompt.trim() : null,
	};
	if (state.apiKey && state.apiKey !== '<redacted>') {
		payload.apiKey = state.apiKey;
	}
	await os.apiWithDialog('admin/update-meta', {
		aiAbuseControlConfig: payload,
	});
	form.state.apiKey = '';
	await fetchInstance(true);
});

const headerActions = computed(() => []);
const headerTabs = computed(() => []);

definePage(() => ({
	title: t('title'),
	icon: 'ti ti-shield-lock',
}));
</script>
