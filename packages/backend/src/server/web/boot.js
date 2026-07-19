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

			document.body.innerHTML =
				'<div class="err-wrap">' +
					'<div class="err-top">' +
						'<svg class="icon-warning" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
							'<path stroke="none" d="M0 0h24v24H0z" fill="none"></path>' +
							'<path d="M12 9v2m0 4v.01"></path>' +
							'<path d="M5 19h14a2 2 0 0 0 1.84 -2.75l-7.1 -12.25a2 2 0 0 0 -3.5 0l-7.1 12.25a2 2 0 0 0 1.75 2.75"></path>' +
						'</svg>' +
						'<h1>' + escapeHtml(messages.title) + '</h1>' +
						'<div class="err-code-box"><code>ERROR CODE: ' + escapeHtml(code) + '</code></div>' +
						'<button type="button" class="button-big" id="err-reload">' +
							'<span class="button-label-big">' + escapeHtml(reload) + '</span>' +
						'</button>' +
					'</div>' +

					'<div class="err-mid">' +
						'<p class="err-mid-title">' + escapeHtml(messages.toolsTitle) + '</p>' +
						'<p class="err-mid-hint">' + escapeHtml(messages.toolsHint) + '</p>' +
						// Use <a class="button"> only — never nest <button> inside <a> (breaks mobile taps)
						'<a class="button-small" href="/flush"><span class="button-label-small">' + escapeHtml(messages.otherOption1) + '</span></a>' +
						'<a class="button-small" href="/cli"><span class="button-label-small">' + escapeHtml(messages.otherOption2) + '</span></a>' +
						'<a class="button-small" href="/bios"><span class="button-label-small">' + escapeHtml(messages.otherOption3) + '</span></a>' +
						'<div class="err-tips">' +
							'<p><b>' + escapeHtml(messages.solution) + '</b></p>' +
							'<p>' + escapeHtml(messages.solution1) + '</p>' +
							'<p>' + escapeHtml(messages.solution2) + '</p>' +
							'<p>' + escapeHtml(messages.solution3) + '</p>' +
							'<p>' + escapeHtml(messages.solution4) + '</p>' +
						'</div>' +
					'</div>' +

					'<div class="err-bot">' +
						'<p class="err-bot-title">' + escapeHtml(messages.fullLog) + '</p>' +
						'<pre id="full-log" class="full-log"></pre>' +
					'</div>' +
				'</div>';

			var reloadBtn = document.getElementById('err-reload');
			if (reloadBtn) {
				reloadBtn.addEventListener('click', function () {
					location.reload();
				});
			}

			addStyle(
'*{box-sizing:border-box;font-family:BIZ UDGothic,Roboto,HelveticaNeue,Arial,sans-serif;}' +
'html.mk-error-page,body.mk-error-page{' +
'  min-height:100%;min-height:100dvh;min-height:-webkit-fill-available;' +
'  width:100%;margin:0;padding:0;' +
'  background:#222;color:#dfddcc;' +
'}' +
'body.mk-error-page{' +
'  display:flex;flex-direction:column;align-items:stretch;' +
'  padding:max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));' +
'}' +
'#sharkey_app,#splash{display:none!important;}' +
'.err-wrap{width:100%;max-width:28rem;margin:0 auto;flex:1;display:flex;flex-direction:column;}' +
'.err-top{text-align:center;padding:8px 0 20px;}' +
'.icon-warning{color:#dec340;height:3.5rem;width:3.5rem;display:block;margin:1rem auto 0;}' +
'h1{font-size:1.35em;margin:0.75rem 0 1rem;font-weight:700;line-height:1.35;}' +
'.err-code-box{margin:0 auto 1.25rem;}' +
'.err-code-box code{' +
'  display:inline-block;font-family:ui-monospace,Fira Code,monospace;font-size:13px;' +
'  background:#333;padding:0.55rem 0.9rem;border-radius:10px;word-break:break-all;' +
'}' +
'.button-big{' +
'  display:inline-flex;align-items:center;justify-content:center;' +
'  min-width:min(100%, 16rem);width:auto;max-width:100%;' +
'  border:none;border-radius:999px;cursor:pointer;' +
'  background:linear-gradient(90deg,rgb(134,179,0),rgb(74,179,0));' +
'  line-height:50px;padding:0 20px;margin:0 auto 4px;' +
'  -webkit-tap-highlight-color:transparent;' +
'}' +
'.button-big:hover,.button-big:active{background:rgb(153,204,0);}' +
'.button-label-big{color:#222;font-weight:bold;font-size:1.15em;}' +
'.err-mid{text-align:center;padding:8px 0 16px;border-top:1px solid #3a3a3a;}' +
'.err-mid-title{font-weight:700;font-size:1.05em;margin:1rem 0 0.35rem;color:#b8e000;}' +
'.err-mid-hint{font-size:14px;opacity:0.8;margin:0 0 1rem;}' +
'a.button-small{' +
'  display:flex;align-items:center;justify-content:center;' +
'  width:100%;max-width:22rem;margin:0 auto 10px;' +
'  min-height:44px;line-height:44px;' +
'  border-radius:999px;background:#444;color:rgb(153,204,0);' +
'  text-decoration:none;font-size:15px;' +
'  -webkit-tap-highlight-color:transparent;touch-action:manipulation;' +
'}' +
'a.button-small:hover,a.button-small:active{background:#555;}' +
'.button-label-small{padding:0 14px;color:rgb(153,204,0);}' +
'.err-tips{margin-top:1.25rem;text-align:left;max-width:22rem;margin-left:auto;margin-right:auto;}' +
'.err-tips p{font-size:14px;margin:0.4rem 0;opacity:0.9;line-height:1.45;}' +
'.err-bot{text-align:center;padding:8px 0 0;border-top:1px solid #3a3a3a;flex:1;display:flex;flex-direction:column;min-height:0;}' +
'.err-bot-title{font-weight:700;margin:1rem 0 0.5rem;}' +
'.full-log{' +
'  display:block;text-align:left;flex:1;' +
'  font-family:ui-monospace,Fira Code,monospace;font-size:11px;line-height:1.45;' +
'  background:#2a2a2a;color:#dfddcc;' +
'  padding:0.75rem 0.9rem;border-radius:10px;border:1px solid #3a3a3a;' +
'  margin:0 0 1rem;white-space:pre-wrap;word-break:break-word;' +
'  min-height:8rem;max-height:none;overflow:auto;' +
'  -webkit-overflow-scrolling:touch;' +
'}' +
'@media (min-width:600px){' +
'  .err-wrap{max-width:32rem;}' +
'  .full-log{max-height:40vh;}' +
'}'
			);
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
