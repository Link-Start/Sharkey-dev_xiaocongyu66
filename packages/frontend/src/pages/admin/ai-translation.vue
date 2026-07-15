<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :actions="headerActions" :tabs="headerTabs">
	<div class="_spacer" style="--MI_SPACER-w: 700px; --MI_SPACER-min: 16px; --MI_SPACER-max: 32px;">
		<div class="_gaps">
			<MkFolder :defaultOpen="true">
				<template #icon><i class="ti ti-language"></i></template>
				<template #label>{{ t('title') }}</template>
				<template v-if="form.savedState.enableNotes || form.savedState.enableChat" #suffix>{{ t('on') }}</template>
				<template v-else #suffix>{{ t('off') }}</template>
				<template v-if="form.modified.value" #footer>
					<MkFormFooter :form="form"/>
				</template>

				<div class="_gaps">
					<MkInfo>{{ t('info') }}</MkInfo>

					<MkSwitch v-model="form.state.enableNotes">
						<template #label>{{ t('enableNotes') }}<span v-if="form.modifiedStates.enableNotes" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('enableNotesCaption') }}</template>
					</MkSwitch>

					<MkSwitch v-model="form.state.enableChat">
						<template #label>{{ t('enableChat') }}<span v-if="form.modifiedStates.enableChat" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('enableChatCaption') }}</template>
					</MkSwitch>

					<MkSwitch v-model="form.state.useSharedCredentials">
						<template #label>{{ t('useShared') }}<span v-if="form.modifiedStates.useSharedCredentials" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('useSharedCaption') }}</template>
					</MkSwitch>

					<MkSwitch v-model="form.state.allowUserApiKey">
						<template #label>{{ t('allowUserKey') }}<span v-if="form.modifiedStates.allowUserApiKey" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('allowUserKeyCaption') }}</template>
					</MkSwitch>

					<MkSwitch v-model="form.state.preferAiOverClassic">
						<template #label>{{ t('preferAi') }}<span v-if="form.modifiedStates.preferAiOverClassic" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('preferAiCaption') }}</template>
					</MkSwitch>

					<MkSwitch v-model="form.state.uncensored">
						<template #label>{{ t('uncensored') }}<span v-if="form.modifiedStates.uncensored" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('uncensoredCaption') }}</template>
					</MkSwitch>

					<MkTextarea v-if="form.state.uncensored" v-model="form.state.jailbreakPrompt">
						<template #label>{{ t('jailbreakPrompt') }}<span v-if="form.modifiedStates.jailbreakPrompt" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('jailbreakPromptCaption') }}</template>
					</MkTextarea>

					<MkSwitch v-model="form.state.selectiveByDefault">
						<template #label>{{ t('selective') }}<span v-if="form.modifiedStates.selectiveByDefault" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('selectiveCaption') }}</template>
					</MkSwitch>

					<MkSwitch v-model="form.state.cacheEnabled">
						<template #label>{{ t('cacheEnabled') }}<span v-if="form.modifiedStates.cacheEnabled" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('cacheEnabledCaption') }}</template>
					</MkSwitch>

					<MkInput v-if="form.state.cacheEnabled" v-model="form.state.cacheTtlSeconds" type="number">
						<template #label>{{ t('cacheTtl') }}<span v-if="form.modifiedStates.cacheTtlSeconds" class="_modified">{{ i18n.ts.modified }}</span></template>
						<template #caption>{{ t('cacheTtlCaption') }}</template>
					</MkInput>

					<template v-if="form.state.useSharedCredentials">
						<div class="_gaps">
							<div style="font-weight: bold;">{{ t('sharedCreds') }}</div>
							<MkInput v-model="form.state.sharedBaseUrl" type="url">
								<template #label>{{ t('baseUrl') }}</template>
								<template #caption>{{ t('baseUrlCaption') }}</template>
							</MkInput>
							<MkInput v-model="form.state.sharedApiKey" type="password">
								<template #label>{{ t('apiKey') }}</template>
								<template #caption>{{ t('apiKeyCaption') }}</template>
							</MkInput>
							<MkInput v-model="form.state.sharedModel">
								<template #label>{{ t('model') }}</template>
							</MkInput>
							<MkSelect v-model="form.state.sharedApiStyle">
								<template #label>{{ t('apiStyle') }}</template>
								<option value="auto">{{ t('apiStyleAuto') }}</option>
								<option value="chat.completions">chat/completions</option>
								<option value="responses">responses</option>
							</MkSelect>
							<MkInput v-model="form.state.sharedTimeout" type="number">
								<template #label>{{ t('timeout') }}</template>
							</MkInput>
							<MkTextarea v-model="form.state.sharedSystemPrompt">
								<template #label>{{ t('systemPrompt') }}</template>
								<template #caption>{{ t('systemPromptCaption') }}</template>
							</MkTextarea>
						</div>
					</template>
					<template v-else>
						<div class="_gaps">
							<div style="font-weight: bold;">{{ t('notesCreds') }}</div>
							<MkInput v-model="form.state.notesBaseUrl" type="url">
								<template #label>{{ t('baseUrl') }}</template>
							</MkInput>
							<MkInput v-model="form.state.notesApiKey" type="password">
								<template #label>{{ t('apiKey') }}</template>
							</MkInput>
							<MkInput v-model="form.state.notesModel">
								<template #label>{{ t('model') }}</template>
							</MkInput>
							<MkSelect v-model="form.state.notesApiStyle">
								<template #label>{{ t('apiStyle') }}</template>
								<option value="auto">{{ t('apiStyleAuto') }}</option>
								<option value="chat.completions">chat/completions</option>
								<option value="responses">responses</option>
							</MkSelect>
							<MkInput v-model="form.state.notesTimeout" type="number">
								<template #label>{{ t('timeout') }}</template>
							</MkInput>
							<MkTextarea v-model="form.state.notesSystemPrompt">
								<template #label>{{ t('systemPrompt') }}</template>
							</MkTextarea>
						</div>
						<div class="_gaps">
							<div style="font-weight: bold;">{{ t('chatCreds') }}</div>
							<MkInput v-model="form.state.chatBaseUrl" type="url">
								<template #label>{{ t('baseUrl') }}</template>
							</MkInput>
							<MkInput v-model="form.state.chatApiKey" type="password">
								<template #label>{{ t('apiKey') }}</template>
							</MkInput>
							<MkInput v-model="form.state.chatModel">
								<template #label>{{ t('model') }}</template>
							</MkInput>
							<MkSelect v-model="form.state.chatApiStyle">
								<template #label>{{ t('apiStyle') }}</template>
								<option value="auto">{{ t('apiStyleAuto') }}</option>
								<option value="chat.completions">chat/completions</option>
								<option value="responses">responses</option>
							</MkSelect>
							<MkInput v-model="form.state.chatTimeout" type="number">
								<template #label>{{ t('timeout') }}</template>
							</MkInput>
							<MkTextarea v-model="form.state.chatSystemPrompt">
								<template #label>{{ t('systemPrompt') }}</template>
							</MkTextarea>
						</div>
					</template>
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

const L = (i18n.ts as any)._aiTranslation ?? {};
function t(key: string): string {
	const v = L[key];
	return typeof v === 'string' && v.length ? v : key;
}


const meta = await misskeyApi('admin/meta') as any;
const cfg = meta.aiTranslationConfig ?? {};
const shared = cfg.shared ?? {};
const notes = cfg.notes ?? {};
const chat = cfg.chat ?? {};

const form = useForm({
	enableNotes: cfg.enableNotes === true,
	enableChat: cfg.enableChat === true,
	useSharedCredentials: cfg.useSharedCredentials !== false,
	allowUserApiKey: cfg.allowUserApiKey !== false,
	preferAiOverClassic: cfg.preferAiOverClassic !== false,
	uncensored: cfg.uncensored !== false,
	jailbreakPrompt: cfg.jailbreakPrompt ?? '',
	selectiveByDefault: cfg.selectiveByDefault !== false,
	cacheEnabled: cfg.cacheEnabled !== false,
	cacheTtlSeconds: cfg.cacheTtlSeconds ?? 604800,
	sharedBaseUrl: shared.baseUrl ?? '',
	sharedApiKey: '',
	sharedModel: shared.model ?? 'gpt-4o-mini',
	sharedApiStyle: shared.apiStyle ?? 'auto',
	sharedTimeout: shared.requestTimeoutMs ?? 20000,
	sharedSystemPrompt: shared.systemPrompt ?? '',
	notesBaseUrl: notes.baseUrl ?? '',
	notesApiKey: '',
	notesModel: notes.model ?? 'gpt-4o-mini',
	notesApiStyle: notes.apiStyle ?? 'auto',
	notesTimeout: notes.requestTimeoutMs ?? 20000,
	notesSystemPrompt: notes.systemPrompt ?? '',
	chatBaseUrl: chat.baseUrl ?? '',
	chatApiKey: '',
	chatModel: chat.model ?? 'gpt-4o-mini',
	chatApiStyle: chat.apiStyle ?? 'auto',
	chatTimeout: chat.requestTimeoutMs ?? 20000,
	chatSystemPrompt: chat.systemPrompt ?? '',
}, async (state) => {
	const ep = (baseUrl: string, apiKey: string, model: string, apiStyle: string, timeout: number, systemPrompt: string) => {
		const o: any = {
			baseUrl: baseUrl?.trim() ? baseUrl.trim() : null,
			model: model?.trim() || 'gpt-4o-mini',
			apiStyle,
			requestTimeoutMs: Number(timeout) || 20000,
			systemPrompt: systemPrompt?.trim() ? systemPrompt.trim() : null,
		};
		if (apiKey && apiKey !== '<redacted>') o.apiKey = apiKey;
		return o;
	};
	const payload: any = {
		enableNotes: state.enableNotes,
		enableChat: state.enableChat,
		useSharedCredentials: state.useSharedCredentials,
		allowUserApiKey: state.allowUserApiKey,
		preferAiOverClassic: state.preferAiOverClassic,
		uncensored: state.uncensored,
		jailbreakPrompt: state.jailbreakPrompt?.trim() ? state.jailbreakPrompt.trim() : null,
		selectiveByDefault: state.selectiveByDefault,
		cacheEnabled: state.cacheEnabled,
		cacheTtlSeconds: Math.max(60, Math.min(Number(state.cacheTtlSeconds) || 604800, 2592000)),
		shared: ep(state.sharedBaseUrl, state.sharedApiKey, state.sharedModel, state.sharedApiStyle, state.sharedTimeout, state.sharedSystemPrompt),
		notes: ep(state.notesBaseUrl, state.notesApiKey, state.notesModel, state.notesApiStyle, state.notesTimeout, state.notesSystemPrompt),
		chat: ep(state.chatBaseUrl, state.chatApiKey, state.chatModel, state.chatApiStyle, state.chatTimeout, state.chatSystemPrompt),
	};
	await os.apiWithDialog('admin/update-meta', {
		aiTranslationConfig: payload,
	});
	form.state.sharedApiKey = '';
	form.state.notesApiKey = '';
	form.state.chatApiKey = '';
	await fetchInstance(true);
});

const headerActions = computed(() => []);
const headerTabs = computed(() => []);

definePage(() => ({
	title: t('title'),
	icon: 'ti ti-language',
}));
</script>
