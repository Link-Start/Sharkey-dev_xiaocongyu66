/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

'use strict';

// ブロックの中に入れないと、定義した変数がブラウザのグローバルスコープに登録されてしまい邪魔なので
(async () => {
	window.onerror = (e) => {
		console.error(e);
		renderError('SOMETHING_HAPPENED', e);
	};
	window.onunhandledrejection = (e) => {
		console.error(e);
		renderError('SOMETHING_HAPPENED_IN_PROMISE', e);
	};

	let forceError = localStorage.getItem('forceError');
	if (forceError != null) {
		renderError('FORCED_ERROR', 'This error is forced by having forceError in local storage.');
		return;
	}

	// Force update when locales change
	const langsVersion = LANGS_VERSION;
	const localeVersion = localStorage.getItem('localeVersion');
	if (localeVersion !== langsVersion) {
		console.info(`Updating locales from version ${localeVersion ?? 'N/A'} to ${langsVersion}`);
		localStorage.removeItem('localeVersion');
		localStorage.removeItem('locale');
	}

	//#region Detect language & fetch translations
	if (!localStorage.getItem('locale')) {
		const supportedLangs = LANGS;
		/** @type {string | null | undefined} */
		let lang = localStorage.getItem('lang');
		if (lang == null || !supportedLangs.includes(lang)) {
			if (supportedLangs.includes(navigator.language)) {
				lang = navigator.language;
			} else {
				lang = supportedLangs.find(x => x.split('-')[0] === navigator.language.split('-')[0]);

				// Fallback
				if (lang == null) lang = 'en-US';
			}
		}

		// for https://github.com/misskey-dev/misskey/issues/10202
		if (lang == null || lang.toString == null || lang.toString() === 'null') {
			console.error('invalid lang value detected!!!', typeof lang, lang);
			lang = 'en-US';
		}

		const localRes = await window.fetch(`/assets/locales/${lang}.${langsVersion}.json`);
		if (localRes.status === 200) {
			localStorage.setItem('lang', lang);
			localStorage.setItem('locale', await localRes.text());
			localStorage.setItem('localeVersion', langsVersion);
		} else {
			renderError('LOCALE_FETCH');
			return;
		}
	}
	//#endregion

	//#region Script
	async function importAppScript() {
		await import(`/vite/${CLIENT_ENTRY}`)
			.catch(async e => {
				console.error(e);
				renderError('APP_IMPORT', e);
			});
	}

	// タイミングによっては、この時点でDOMの構築が済んでいる場合とそうでない場合とがある
	if (document.readyState !== 'loading') {
		importAppScript();
	} else {
		window.addEventListener('DOMContentLoaded', () => {
			importAppScript();
		});
	}
	//#endregion

	//#region Theme
	const theme = localStorage.getItem('theme');
	const themeFontFaceName = 'sharkey-theme-font-face';
	if (theme) {
		let existingFontFace;
		document.fonts.forEach((v) => { if (v.family === themeFontFaceName) existingFontFace = v;});
		if (existingFontFace) document.fonts.delete(existingFontFace);

		const themeProps = JSON.parse(theme);
		const fontFaceSrc = themeProps.fontFaceSrc;
		const fontFaceOpts = themeProps.fontFaceOpts || {};
		if (fontFaceSrc) {
			const fontFace = new FontFace(
				themeFontFaceName,
				fontFaceSrc, fontFaceOpts || {},
			);
			document.fonts.add(fontFace);
			fontFace.load().catch(
				(failure) => {
					console.log(failure);
				},
			);
		}
		for (const [k, v] of Object.entries(themeProps)) {
			if (k.startsWith('font')) continue;
			document.documentElement.style.setProperty(`--MI_THEME-${k}`, v.toString());

			// HTMLの theme-color 適用
			if (k === 'htmlThemeColor') {
				for (const tag of document.head.children) {
					if (tag.tagName === 'META' && tag.getAttribute('name') === 'theme-color') {
						tag.setAttribute('content', v);
						break;
					}
				}
			}
		}
	}
	const colorScheme = localStorage.getItem('colorScheme');
	if (colorScheme) {
		document.documentElement.style.setProperty('color-scheme', colorScheme);
	}
	//#endregion

	const fontSize = localStorage.getItem('fontSize');
	if (fontSize) {
		if (fontSize === "custom") {
			const customFontSize = localStorage.getItem('customFontSize');
			document.documentElement.style.setProperty('font-size', `${customFontSize}px`);
		} else {
			document.documentElement.classList.add('f-' + fontSize);
		}
	}

	const cornerRadius = localStorage.getItem('cornerRadius');
	if (cornerRadius) {
		document.documentElement.classList.add(`radius-${cornerRadius}`);
	}

	const useSystemFont = localStorage.getItem('useSystemFont');
	if (useSystemFont) {
		document.documentElement.classList.add('useSystemFont');
	}

	const customCss = localStorage.getItem('customCss');
	if (customCss && customCss.length > 0) {
		const style = document.createElement('style');
		style.innerHTML = customCss;
		document.head.appendChild(style);
	}

	/**
	 * @param {string} styleText
	 * @returns {Promise<void>}
	 */
	async function addStyle(styleText) {
		let css = document.createElement('style');
		css.appendChild(document.createTextNode(styleText));
		document.head.appendChild(css);
	}


	/**
	 * @param {any} details
	 * @returns {string}
	 */
	function formatErrorDetails(details) {
		if (details == null) return '';
		if (typeof details === 'string') return details;
		if (details instanceof Error) {
			return details.stack || (details.name + ': ' + details.message);
		}
		if (typeof details === 'object' && details !== null && 'reason' in details) {
			const inner = formatErrorDetails(details.reason);
			if (inner) return inner;
		}
		try {
			return JSON.stringify(details, Object.getOwnPropertyNames(details), 2);
		} catch (e) {
			try { return String(details); } catch (e2) { return '[unserializable error]'; }
		}
	}

	/**
	 * @param {string} s
	 * @returns {string}
	 */
	function escapeHtml(s) {
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	/**
	 * @param {string} code
	 * @param {any} [details]
	 * @returns {Promise<void>}
	 */
	async function renderError(code, details) {
		if (document.readyState === 'loading') {
			await new Promise(function (resolve) {
				window.addEventListener('DOMContentLoaded', resolve);
			});
		}

		var locale = {};
		try {
			locale = JSON.parse(localStorage.getItem('locale') || '{}');
		} catch (e) { /* ignore */ }

		var messages = Object.assign({
			title: 'Failed to initialize Sharkey',
			solution: 'The following actions may solve the problem.',
			solution1: 'Update your os and browser',
			solution2: 'Disable an adblocker',
			solution3: 'Clear the browser cache',
			solution4: '(Tor Browser) Set dom.webaudio.enabled to true',
			toolsTitle: 'Recovery tools',
			toolsHint: 'Open a built-in tool (recommended first):',
			otherOption1: 'Clear preferences and cache',
			otherOption2: 'Start the simple client',
			otherOption3: 'Start the repair tool',
			fullLog: 'Full log',
		}, (locale && locale._bootErrors) || {});
		var reload = (locale && locale.reload) || 'Reload';
		var logBody = formatErrorDetails(details);

		var logEl = document.getElementById('full-log');
		if (!logEl) {
			// Ensure mobile fills the screen
			document.documentElement.classList.add('mk-error-page');
			document.body.classList.add('mk-error-page');

			// viewport for mobile (boot may run inside existing shell)
			if (!document.querySelector('meta[name="viewport"]')) {
				var meta = document.createElement('meta');
				meta.name = 'viewport';
				meta.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
				document.head.appendChild(meta);
			}
			var tc = document.querySelector('meta[name="theme-color"]');
			if (!tc) {
				tc = document.createElement('meta');
				tc.name = 'theme-color';
				tc.content = '#1c1c1c';
				document.head.appendChild(tc);
			} else {
				tc.setAttribute('content', '#1c1c1c');
			}

			document.body.innerHTML =
				'<div class="err-wrap">' +
					'<section class="err-card err-top">' +
						'<svg class="icon-warning" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
							'<path stroke="none" d="M0 0h24v24H0z" fill="none"></path>' +
							'<path d="M12 9v2m0 4v.01"></path>' +
							'<path d="M5 19h14a2 2 0 0 0 1.84 -2.75l-7.1 -12.25a2 2 0 0 0 -3.5 0l-7.1 12.25a2 2 0 0 0 1.75 2.75"></path>' +
						'</svg>' +
						'<h1>' + escapeHtml(messages.title) + '</h1>' +
						'<div class="err-code-box"><code>ERROR CODE: ' + escapeHtml(code) + '</code></div>' +
						'<button type="button" class="button-big" id="err-reload">' +
							'<span class="button-label-big">' + escapeHtml(reload) + '</span>' +
						'</button>' +
					'</section>' +
					'<section class="err-card err-mid">' +
						'<p class="err-mid-title">' + escapeHtml(messages.toolsTitle) + '</p>' +
						'<p class="err-mid-hint">' + escapeHtml(messages.toolsHint) + '</p>' +
						'<div class="err-tools">' +
							'<a class="button-small" href="/flush"><span class="button-label-small">' + escapeHtml(messages.otherOption1) + '</span></a>' +
							'<a class="button-small" href="/cli"><span class="button-label-small">' + escapeHtml(messages.otherOption2) + '</span></a>' +
							'<a class="button-small" href="/bios"><span class="button-label-small">' + escapeHtml(messages.otherOption3) + '</span></a>' +
						'</div>' +
						'<div class="err-tips">' +
							'<p><b>' + escapeHtml(messages.solution) + '</b></p>' +
							'<p>' + escapeHtml(messages.solution1) + '</p>' +
							'<p>' + escapeHtml(messages.solution2) + '</p>' +
							'<p>' + escapeHtml(messages.solution3) + '</p>' +
							'<p>' + escapeHtml(messages.solution4) + '</p>' +
						'</div>' +
					'</section>' +
					'<section class="err-card err-bot">' +
						'<p class="err-bot-title">' + escapeHtml(messages.fullLog) + '</p>' +
						'<pre id="full-log" class="full-log"></pre>' +
					'</section>' +
				'</div>';

			var reloadBtn = document.getElementById('err-reload');
			if (reloadBtn) {
				reloadBtn.addEventListener('click', function () {
					location.reload();
				});
			}

			addStyle(':root { --err-bg: #1c1c1c; --err-fg: #e8e6d9; --err-muted: #9a988c; --err-panel: #2a2a2a; --err-panel-2: #333; --err-border: #404040; --err-accent: #86b300; --err-accent-2: #4ab300; --err-warn: #dec340; --err-pad: clamp(12px, 3.5vw, 28px); --err-gap: clamp(12px, 2.5vw, 20px); --err-radius: clamp(10px, 2vw, 14px); --err-max: min(36rem, 100%); --err-fs: clamp(14px, 3.6vw, 16px); --err-fs-sm: clamp(12px, 3.2vw, 14px); --err-fs-title: clamp(1.2rem, 5vw, 1.55rem); --err-safe-t: env(safe-area-inset-top, 0px); --err-safe-r: env(safe-area-inset-right, 0px); --err-safe-b: env(safe-area-inset-bottom, 0px); --err-safe-l: env(safe-area-inset-left, 0px); } * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; } #sharkey_app, #splash { display: none !important; } html.mk-error-page { height: 100%; height: 100dvh; height: -webkit-fill-available; background: var(--err-bg); color: var(--err-fg); font-family: BIZ UDGothic, "Hiragino Sans", "Noto Sans SC", Roboto, HelveticaNeue, Arial, sans-serif; font-size: var(--err-fs); line-height: 1.5; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; } body.mk-error-page { margin: 0; min-height: 100%; min-height: 100dvh; min-height: -webkit-fill-available; width: 100%; display: flex; flex-direction: column; background: var(--err-bg); color: var(--err-fg); padding: calc(var(--err-pad) + var(--err-safe-t)) calc(var(--err-pad) + var(--err-safe-r)) calc(var(--err-pad) + var(--err-safe-b)) calc(var(--err-pad) + var(--err-safe-l)); } .err-wrap { width: var(--err-max); margin: 0 auto; flex: 1 1 auto; display: flex; flex-direction: column; gap: var(--err-gap); min-height: 0; } .err-card { background: var(--err-panel); border: 1px solid var(--err-border); border-radius: var(--err-radius); padding: clamp(14px, 3.5vw, 22px); } .err-top { text-align: center; flex: 0 0 auto; } .icon-warning { color: var(--err-warn); width: clamp(2.75rem, 10vw, 3.5rem); height: clamp(2.75rem, 10vw, 3.5rem); display: block; margin: 0 auto clamp(10px, 2vw, 14px); } .err-top h1 { font-size: var(--err-fs-title); margin: 0 0 clamp(10px, 2.5vw, 14px); font-weight: 700; line-height: 1.3; word-break: break-word; } .err-code-box { margin: 0 auto clamp(14px, 3vw, 18px); max-width: 100%; } .err-code-box code { display: block; width: 100%; font-family: ui-monospace, "SF Mono", "Fira Code", Menlo, monospace; font-size: clamp(11px, 3vw, 13px); background: var(--err-panel-2); padding: clamp(8px, 2vw, 12px) clamp(10px, 2.5vw, 14px); border-radius: calc(var(--err-radius) - 4px); word-break: break-all; text-align: left; white-space: pre-wrap; color: var(--err-fg); } .button-big { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 48px; border: none; border-radius: 999px; cursor: pointer; background: linear-gradient(90deg, var(--err-accent), var(--err-accent-2)); padding: 0 clamp(16px, 4vw, 24px); margin: 0; touch-action: manipulation; font: inherit; } .button-big:hover, .button-big:active { filter: brightness(1.08); } .button-label-big { color: #1a1a1a; font-weight: 700; font-size: clamp(1rem, 4vw, 1.15rem); } .err-mid { text-align: center; flex: 0 0 auto; } .err-mid-title { font-weight: 700; font-size: clamp(1rem, 3.8vw, 1.1rem); margin: 0 0 6px; color: var(--err-accent); } .err-mid-hint { font-size: var(--err-fs-sm); color: var(--err-muted); margin: 0 0 clamp(12px, 3vw, 16px); } .err-tools { display: flex; flex-direction: column; gap: 10px; width: 100%; } a.button-small { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 48px; padding: 10px 16px; border-radius: 999px; background: var(--err-panel-2); border: 1px solid var(--err-border); color: var(--err-accent); text-decoration: none; font-size: clamp(14px, 3.5vw, 15px); font-weight: 600; touch-action: manipulation; line-height: 1.3; text-align: center; } a.button-small:hover, a.button-small:active { background: #3a3a3a; border-color: color-mix(in srgb, var(--err-accent) 35%, var(--err-border)); } .button-label-small { color: inherit; padding: 0 4px; word-break: break-word; } .err-tips { margin-top: clamp(14px, 3vw, 18px); text-align: left; padding-top: clamp(12px, 2.5vw, 16px); border-top: 1px solid var(--err-border); } .err-tips p { font-size: var(--err-fs-sm); margin: 0.35rem 0; color: var(--err-muted); line-height: 1.45; } .err-tips p b, .err-tips p:first-child { color: var(--err-fg); } .err-bot { text-align: center; flex: 1 1 auto; display: flex; flex-direction: column; min-height: 0; } .err-bot-title { font-weight: 700; margin: 0 0 10px; font-size: clamp(1rem, 3.8vw, 1.1rem); flex: 0 0 auto; } .full-log { display: block; text-align: left; flex: 1 1 auto; width: 100%; font-family: ui-monospace, "SF Mono", "Fira Code", Menlo, monospace; font-size: clamp(10px, 2.8vw, 12px); line-height: 1.45; background: #141414; color: var(--err-fg); padding: clamp(10px, 2.5vw, 14px); border-radius: calc(var(--err-radius) - 2px); border: 1px solid var(--err-border); margin: 0; white-space: pre-wrap; word-break: break-word; overflow: auto; -webkit-overflow-scrolling: touch; min-height: clamp(7rem, 28vh, 12rem); max-height: min(42vh, 22rem); } @media (max-height: 520px) { .icon-warning { width: 2.25rem; height: 2.25rem; margin-bottom: 6px; } .err-top h1 { font-size: 1.1rem; margin-bottom: 8px; } .full-log { min-height: 5rem; max-height: 32vh; } } @media (min-width: 720px) { .err-wrap { max-width: 40rem; } .err-tools { display: grid; grid-template-columns: 1fr; gap: 12px; } .full-log { max-height: min(36vh, 20rem); } } @media (min-width: 960px) { .err-wrap { max-width: 42rem; } } a { color: var(--err-accent); text-decoration: none; } p { margin: 0; }');
			logEl = document.getElementById('full-log');
		}

		if (logEl) {
			var block =
				'ERROR CODE: ' + code + '\n' +
				'TIME: ' + new Date().toISOString() + '\n' +
				'URL: ' + location.href + '\n' +
				'UA: ' + navigator.userAgent + '\n' +
				'\n---\n\n' +
				(logBody || '(no detail)');
			if (logEl.textContent && logEl.textContent.trim().length > 0) {
				logEl.textContent += '\n\n==========\n\n' + block;
			} else {
				logEl.textContent = block;
			}
		}
	}
})();
