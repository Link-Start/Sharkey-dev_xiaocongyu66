/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

'use strict';

(() => {
	document.addEventListener('DOMContentLoaded', () => {
		const locale = JSON.parse(localStorage.getItem('locale') || '{}');

		const messages = Object.assign({
			title: 'Failed to initialize Sharkey',
			serverError: 'If reloading after a period of time does not resolve the problem, contact the server administrator with the following ERROR ID.',
			solution: 'The following actions may solve the problem.',
			solution1: 'Update your os and browser',
			solution2: 'Disable an adblocker',
			solution3: 'Clear the browser cache',
			solution4: '(Tor Browser) Set dom.webaudio.enabled to true',
			toolsTitle: 'Built-in recovery tools',
			toolsHint: 'Use these first — no need to dig through browser settings.',
			flushPrimary: 'Clear cache (flush)',
			otherOption: 'Other options',
			otherOption1: 'Clear preferences and cache (/flush)',
			otherOption2: 'Start the simple client (/cli)',
			otherOption3: 'Start the repair tool (/bios)',
		}, locale?._bootErrors || {});
		const reload = locale?.reload || 'Reload';

		const reloadEls = document.querySelectorAll('[data-i18n-reload]');
		for (const el of reloadEls) {
			el.textContent = reload;
		}

		/** @type {NodeListOf<HTMLElement>} */
		const i18nEls = document.querySelectorAll('[data-i18n]');
		for (const el of i18nEls) {
			const key = el.dataset.i18n;
			if (key && messages[key]) {
				el.textContent = messages[key];
			}
		}
	});
})();
