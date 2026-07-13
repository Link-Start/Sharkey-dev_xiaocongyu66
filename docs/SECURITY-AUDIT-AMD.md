# Sharkey Security Audit / Advisory Document (AMD)

| Field | Value |
|-------|--------|
| **Document type** | Local security audit memo (AMD-style findings register) |
| **Target tree** | `/root/Sharkey-work/Sharkey-dev-continue` |
| **Product** | Sharkey `2025.5.2-dev` (Misskey fork) |
| **Audit date** | 2026-07-14 |
| **Method** | Static code review only — no live exploitation, no PoC payloads |
| **Scope** | Backend API, chat, MFM/CSS rendering, media proxy, federation edges, OAuth/Mastodon glue, auth tokens |
| **Out of scope** | Production traffic, third-party deps CVE enumeration, full ActivityPub protocol fuzz |
| **Disposition** | **Private local report.** Do not publish until issues are triaged/fixed. Prefer responsible disclosure via instance SECURITY.md / upstream. |

---

## 0. Executive summary

Sharkey inherits a mature Misskey security baseline (private-IP SSRF guards in production, SVG not browser-safe, signed ActivityPub inbox, role policies). Local/custom surface area (chat rooms, escrow crypto, MFM advanced styling, channel colors, OAuth client_credentials stub, media `/proxy`) adds **multiple real issues**.

| Severity | Count (approx.) | Themes |
|----------|-----------------|--------|
| **Critical / High** | 3–4 | Chat WS history leak (fixed in tree), non-prod SSRF disable, OAuth dummy tokens |
| **Medium** | 15+ | CSS injection, invite entropy, SQL concat, block bypass, escrow, push unregister, SSRF surfaces |
| **Low / Info** | 20+ | Token length, DoS knobs, privacy, misconfig, TODOs, documentation drift |
| **Total IDs** | **SK-2026-001 … 042** | Living document — keep appending |

**Must verify on deploy:** commits `f95ed57` (chat stream gate + escrow) **and** the batch that closes SK-002/003/004/008/009/012/013/022/026/036 (this tree) are present in production.

---

## 1. Findings register

IDs are local (`SK-YYYY-NNN`). Severity uses: **C**ritical / **H**igh / **M**edium / **L**ow / **I**nfo.

---

### SK-2026-001 — Chat room WebSocket live stream without membership (FIXED in tree)

| | |
|--|--|
| **Severity** | **H** (was H; fixed) |
| **CWE** | CWE-862 Missing Authorization |
| **Status** | Fixed in `f95ed57` |
| **Components** | `packages/backend/src/server/api/stream/channels/chat-room.ts` |

**Description**  
Prior to the fix, any authenticated user could open channel `chatRoom` with an arbitrary `roomId` and subscribe to `chatRoomStream:${roomId}`, receiving live messages without being a member.

**Fix summary**  
Subscribe only when `hasPermissionToViewRoomTimeline` (member or site moderator). Read receipts gated to actual members.

**Residual**  
Deployments without `f95ed57` remain vulnerable. Confirm production revision.

---

### SK-2026-002 — Private-IP SSRF validation only when `NODE_ENV=production`

| | |
|--|--|
| **Severity** | **H** (if mis-deployed) / **M** (dev-only) |
| **CWE** | CWE-918 Server-Side Request Forgery |
| **Status** | **Fixed in tree** — `validateSocketConnect` always runs (not only production) |
| **Components** | `packages/backend/src/core/HttpRequestService.ts` (`HttpRequestServiceAgent` / `HttpsRequestServiceAgent`) |

**Description**  
`validateSocketConnect` (blocks non-unicast / non-allowlisted private nets) runs **only** when `NODE_ENV === 'production'`. Development, staging mislabeled as non-production, or `NODE_ENV=test` skips the socket-level private IP kill.

**Attack surface (user-influenced URLs)**  

| Entry | Auth | Notes |
|-------|------|--------|
| `GET /proxy/:url*` | Rate limit | Media proxy |
| `fetch-rss` | **None** | Arbitrary RSS URL |
| `fetch-external-resources` | Credential | JSON + hash check |
| `drive/files/upload-from-url` | Credential | Server-side download |
| URL preview `/url` | Config-dependent | Summaly |
| User / system webhooks | Credential | Deliver processor uses `httpRequestService.send` |
| ActivityPub resolve (`ap/show`, federation) | Varies | Remote fetch |

**Impact**  
Probe localhost, RFC1918, link-local, cloud metadata (`169.254.169.254`) when SSRF guards are off.

**Remediation**  
1. Always enforce private-IP checks; use config allowlist only.  
2. Fail closed if `NODE_ENV` is not production in internet-facing deploys.  
3. Harden unauthenticated fetch endpoints (`fetch-rss`) with host allowlists / stricter limits.

---

### SK-2026-003 — OAuth `client_credentials` returns random non-persisted Bearer token

| | |
|--|--|
| **Severity** | **M–H** (protocol / client trust) |
| **CWE** | CWE-287 Improper Authentication |
| **Status** | **Fixed in tree** — `client_credentials` returns `unsupported_grant_type` |
| **Components** | `packages/backend/src/server/oauth/OAuth2ProviderService.ts` |

**Description**  
```ts
if (body.grant_type === 'client_credentials') {
  return { access_token: uuid(), token_type: 'Bearer', scope: 'read', ... };
}
```  
Token is a fresh UUID **not stored** in `access_tokens`. Legitimate API auth will reject it, but:

- Clients/libraries may treat HTTP 200 as successful app-only auth.  
- Confuses security scanners and third-party apps.  
- Combined with other bugs could mask failed auth paths.

**Remediation**  
Return `400` / `unsupported_grant_type`, or implement real client credentials with DB-backed tokens and scoped permissions.

---

### SK-2026-004 — Channel `color` unsanitized → CSS injection on notes

| | |
|--|--|
| **Severity** | **M** |
| **CWE** | CWE-79 (CSS injection) / CWE-20 |
| **Status** | **Fixed in tree** (API) — `color` restricted to `#RGB` / `#RRGGBB`; invalid values fall back to `#86b300`. Frontend still trusts stored values. |
| **Components** | Backend: `channels/create.ts`, `channels/update.ts`. Frontend: `MkNote.vue`, `SkNote.vue`, `MkNoteSub.vue`, `MkPostForm.vue` — `:style="{ background: note.channel.color }"` |

**Description**  
Any user who can create/update a channel sets `color` freely (≤16 chars). Value is applied as CSS `background` on note chrome.

**Examples that fit length**  
`url(//e.co)`, `red;opacity:0`, other browser-accepted `background` tokens.

**Impact**  
UI spoofing; possible browser fetch of attacker URL when opening notes in that channel (client-side tracking / limited “SSRF from browser”). Not full script XSS via this binding alone.

**Remediation**  
Server + client: allow only `#RGB` / `#RRGGBB`. Reject otherwise; default `#86b300`.

---

### SK-2026-005 — Instance `themeColor` / remote instance theme in CSS gradients

| | |
|--|--|
| **Severity** | **M** (federation) / **L** (local admin) |
| **CWE** | CWE-79 |
| **Components** | `MkInstanceTicker.vue` — ``background: linear-gradient(90deg, ${themeColor}, ${themeColor}00)``; remote `instance.themeColor` |

**Description**  
Remote instances’ theme colors are interpolated into CSS without strict hex validation.

**Remediation**  
Same hex whitelist; strip non-matching remote values.

---

### SK-2026-006 — `sanitize-html` allows `style` on all tags (admin-controlled HTML)

| | |
|--|--|
| **Severity** | **M** (requires admin content) |
| **CWE** | CWE-79 |
| **Components** | `packages/frontend/src/utility/sanitize-html.ts`; consumers: about page, visitor dashboard, signup rules |

**Description**  
```ts
'*': (...).concat(['style'])
```  
plus `img`/`audio`/`video`. Instance description / server rules rendered via `v-html="sanitizeHtml(...)"`.

**Impact**  
Stored CSS injection for all visitors if admin account or meta is compromised; layout hijack, tracking via `url()`, UI redress.

**Remediation**  
Remove global `style`; use allowlist of tags only; prefer MFM/plain text for rules.

---

### SK-2026-007 — MFM style assembly (notes + chat + profile) — intentional CSS with incomplete hardening

| | |
|--|--|
| **Severity** | **L–M** (abuse / UX / phishing) |
| **CWE** | CWE-79 (limited), CWE-400 |
| **Components** | `packages/frontend/src/components/global/MkMfm.ts` |

**Description**  
Inline comment admits CSS injection via `token.props.args`. Current mitigations:

- `validColor` → `/^[0-9a-f]{3,6}$/i`  
- `validTime` → `/^\-?[0-9.]+s$/`  
- `border.style` enum  
- mfm-js rejects args containing `;` as function args (treated as plain text)

**Still abusive (any poster / chat member)**  

| Feature | Risk |
|---------|------|
| `$[position.x=N,y=M]` | No clamp → huge offsets, overlay / mis-click |
| `$[scale.x=5,y=5]` | Large scale (clamped ±5 only) |
| Fast animations (`speed=0.001s`) | CPU / vestibular harm |
| Same fg/bg colors | Hidden phishing links |
| `$[followmouse]` | Pointer tracking annoyance |
| Math (KaTeX `trust:false`) | Render cost DoS |

**Chat** uses the same `Mfm` component (`pages/chat/XMessage.vue`, room announcements) with full advanced MFM — not plain text.

**Remediation**  
Clamp position; rate-limit animation; optional “simple MFM” for chat; document abuse policy.

---

### SK-2026-008 — Chat invite codes use `Math.random()`

| | |
|--|--|
| **Severity** | **M** |
| **CWE** | CWE-330 / CWE-338 |
| **Status** | **Fixed in tree** — uses `secureRndstr` / CSPRNG |
| **Components** | `ChatService.generateInviteCode` |

**Description**  
16-char alphabet via `Math.random()` for room `inviteCode`. Used by `join-by-code` / link join policy.

**Impact**  
Weaker than CSPRNG; theoretical prediction / reduced entropy vs `crypto.randomInt`.

**Remediation**  
Use `secureRndstr` / `crypto.randomInt`; rate-limit join-by-code failures.

---

### SK-2026-009 — Room invitation ignores user blocks

| | |
|--|--|
| **Severity** | **M** |
| **CWE** | CWE-862 / business logic |
| **Status** | **Fixed in tree** — block checks both directions before invite + notify |
| **Components** | `ChatService.createRoomInvitation` |

**Description**  
DM path calls `userBlockingService.checkBlocked`; room invitations do not. Blocked users can still invite and fire `chatRoomInvitationReceived` notifications.

**Remediation**  
Mirror DM block checks both directions before insert + notify.

---

### SK-2026-010 — Chat escrow is operator-readable “encryption at rest”, not E2EE

| | |
|--|--|
| **Severity** | **M** (privacy / trust) |
| **CWE** | CWE-311 / CWE-654 |
| **Components** | `ChatCryptoService.ts`, admin `admin/chat-escrow.ts`, pack `ChatEntityService.revealBody` |

**Description**  
AES-256-GCM with server-held master secrets. Pack always reveals plaintext for authorized API paths. Moderators can view room timelines by design.

`f95ed57` stopped deriving keys from `setupPassword` (good). Config comments may still claim setupPassword default — **doc drift**.

**Impact**  
Admin, DB+key theft, or buggy new pack call without ACL → full chat plaintext. Users may believe messages are peer E2EE.

**Remediation**  
Honest UX (“escrow / operator can read”); require dedicated `chatEscrowSecret`; optional `viewerId` check inside `revealForPack`.

---

### SK-2026-011 — SQL string concatenation (poll votes, chat reactions, hashtags)

| | |
|--|--|
| **Severity** | **M** (pattern) / **L** (current exploitability) |
| **CWE** | CWE-89 |
| **Components** | |

**Poll**  
```sql
UPDATE poll SET votes[${index}] = ... WHERE "noteId" = '${poll.noteId}'
```  
(`notes/polls/vote.ts`, `PollService.ts`)  
`noteId` from DB; `choice` bounds-checked via `poll.choices[choice]`. ID format `^[a-zA-Z0-9]+$`.

**Chat react / unreact**  
```sql
array_append("reactions", '${userId}/${reaction}')
array_remove("reactions", '${userId}/${reaction}')
```  
userId alphanumeric; reaction normalized / custom emoji `\w+`.

**HashtagService / ReactionService** similar `array_append` patterns with user ids.

**Impact**  
Not trivially injectable today; fragile if validators change.

**Remediation**  
Parameterized queries / TypeORM parameter binding exclusively.

---

### SK-2026-012 — Unauthenticated `federation/update-remote-user` forces remote re-fetch

| | |
|--|--|
| **Severity** | **M** |
| **CWE** | CWE-770 / amplification |
| **Status** | **Fixed in tree** — requires credential (`write:account`) |
| **Components** | `endpoints/federation/update-remote-user.ts` |

**Description**  
Anyone can trigger `apPersonService.updatePerson(uri)` for a known remote user id (bucket limit 10 then 4/s). Causes outbound federation traffic / remote load.

**Remediation**  
Require credential or moderator; tighter global rate limit; CAPTCHA for anonymous.

---

### SK-2026-013 — `sponsors` `forceUpdate` unauthenticated cache bust (DoS)

| | |
|--|--|
| **Severity** | **L–M** |
| **CWE** | CWE-770 |
| **Status** | **Fixed in tree** — public `forceUpdate` ignored (always false) |
| **Components** | `endpoints/sponsors.ts` |

**Description**  
Anonymous callers can set `forceUpdate: true` (2 req/s) to force sponsor JSON re-fetch.

**Remediation**  
Staff-only or remove `forceUpdate` from public API.

---

### SK-2026-014 — Media `/proxy` open redirector-style fetch (authenticated rate-limited SSRF surface)

| | |
|--|--|
| **Severity** | **M** (depends on env guards) |
| **CWE** | CWE-918 |
| **Components** | `FileServerService` `/proxy/:url*` |

**Description**  
Fetches remote URL content (with User-Agent check against recursive Misskey UA). Relies on HttpRequestService private-IP guards (see SK-2026-002). Used for avatars/emoji transforms; also abuse for bandwidth / scanning when guards fail.

**Remediation**  
Same as SSRF hardening; consider signed proxy URLs; stricter host allowlist for non-media types.

---

### SK-2026-015 — `fetch-rss` unauthenticated outbound HTTP

| | |
|--|--|
| **Severity** | **M** |
| **CWE** | CWE-918 |
| **Components** | `endpoints/fetch-rss.ts` — `requireCredential: false`, 20/10s |

**Description**  
Server fetches attacker-supplied URL and parses feed. Amplifies SSRF when private-IP checks off; even in production, probes public IPs / port scan via timing/errors.

**Remediation**  
Auth or instance setting; block non-http(s); optional domain allowlist; lower limits.

---

### SK-2026-016 — User webhooks: arbitrary deliver URL (SSRF as authenticated user)

| | |
|--|--|
| **Severity** | **M** |
| **CWE** | CWE-918 |
| **Components** | `i/webhooks/create.ts` — `url` free string; `UserWebhookDeliverProcessorService` → `httpRequestService.send` |

**Description**  
Logged-in users register webhook URLs; instance POSTs events there. Classic “SSRF with user auth” (metadata, internal HTTP if guards fail).

**Remediation**  
Validate URL (https only, public unicast, block metadata ranges always); optional admin approval.

---

### SK-2026-017 — Native user token length 16

| | |
|--|--|
| **Severity** | **L** |
| **CWE** | CWE-330 |
| **Components** | `misc/token.ts` — `secureRndstr(16)`; `isNativeUserToken = length === 16` |

**Description**  
~95 bits if full charset — acceptable but short vs modern 32+ tokens. Session theft impact is full account.

**Remediation**  
Lengthen native tokens (migration careful because length discriminates native vs app tokens).

---

### SK-2026-018 — ID generators use `Math.random` in some schemes

| | |
|--|--|
| **Severity** | **L** |
| **CWE** | CWE-330 |
| **Components** | `misc/id/meid.ts`, `meidg.ts`, `object-id.ts`; local config uses `id: 'aidx'` |

**Description**  
Non-crypto PRNG in ID tails. Affects unpredictability of resource IDs if those schemes are used.

**Remediation**  
Prefer CSPRNG for all ID random parts.

---

### SK-2026-019 — `page-push` arbitrary events to page owner stream

| | |
|--|--|
| **Severity** | **L** |
| **CWE** | CWE-862 (logic) |
| **Components** | `endpoints/page-push.ts` |

**Description**  
Any authenticated user pushes `pageEvent` with arbitrary `event`/`var` to page owner’s main stream (120/min). Harassment / AiScript interaction abuse.

**Remediation**  
Verify page interaction policy; rate-limit per target; schema-validate `var`.

---

### SK-2026-020 — Shared-access / miauth tokens can carry admin `rank` + broad `permission`

| | |
|--|--|
| **Severity** | **L–M** (feature risk) |
| **CWE** | CWE-269 |
| **Components** | `miauth/gen-token.ts`, `i/shared-access/login.ts`, `RoleService` rank demotion |

**Description**  
Admin can mint token with `rank: 'admin'` and permissions, grant to grantees; grantee obtains full token string via `shared-access/login`. Rank demotes privileges when set to `user`/`mod` but **cannot elevate** non-admins. Risk is intentional privilege sharing + token exfiltration.

**Remediation**  
Audit UX warnings; force expiry; disallow `rank: admin` on shared grants; scope permissions tightly.

**Note**  
`ApiCallService` admin checks use `getUserRoles`, which **does** apply rank demotion — good. Root user id bypasses admin checks regardless of rank.

---

### SK-2026-021 — `reset-db` exposed when `NODE_ENV=test`

| | |
|--|--|
| **Severity** | **H** if test mode on internet; **I** otherwise |
| **CWE** | CWE-284 |
| **Components** | `endpoints/reset-db.ts` |

**Description**  
Unauthenticated endpoint flushes Redis + DB when `NODE_ENV === 'test'`.

**Remediation**  
Never expose test mode publicly; bind localhost only in CI.

---

### SK-2026-022 — OAuth authorize `client_id` base64 URL open redirect pattern

| | |
|--|--|
| **Severity** | **L–M** |
| **CWE** | CWE-601 |
| **Status** | **Partially fixed** — only `http:`/`https:` schemes accepted after base64 decode; still not full app registration allowlist |
| **Components** | `OAuth2ProviderService` GET `/authorize` |

**Description**  
```ts
const redirectUri = new URL(Buffer.from(request.query.client_id, 'base64').toString());
return reply.redirect(redirectUri.toString());
```  
Redirects to decoded `client_id` without strict app registration check in this handler.

**Impact**  
Phishing open redirect if this path is reachable and users trust the host.

**Remediation**  
Validate against registered OAuth apps / allowlisted redirect URIs only.

---

### SK-2026-023 — Password reset: username+email enumeration timing / silent fail

| | |
|--|--|
| **Severity** | **I–L** |
| **CWE** | CWE-203 |
| **Components** | `request-reset-password.ts` |

**Description**  
Returns empty success for missing user / wrong email (good), but differential timing / email send side-channels may remain. Token is 64-char CSPRNG; 30-minute expiry — good.

**Remediation**  
Constant-time path; generic response always; rate-limit by IP+username.

---

### SK-2026-024 — Sign-in user existence observable (404 vs flow)

| | |
|--|--|
| **Severity** | **L** |
| **CWE** | CWE-203 |
| **Components** | `SigninApiService` — `assertClientUser` deletedError 404 |

**Description**  
Unknown users may differ from known users in response, enabling username enumeration (rate-limited).

---

### SK-2026-025 — CORS `Access-Control-Allow-Origin: *` on API utility / files / AP

| | |
|--|--|
| **Severity** | **I** (often intentional for public APIs) |
| **CWE** | CWE-942 |
| **Components** | `ServerUtilityService.addCORS`, FileServer, ActivityPub GET |

**Description**  
Public federation/media APIs use `*`. Sign-in uses origin-locked CORS with credentials — better.

**Remediation**  
Ensure credentialed endpoints never pair with `*`.

---

### SK-2026-026 — `InternalStorageService.resolvePath` no path traversal guard

| | |
|--|--|
| **Severity** | **L** (keys are UUID-generated today) |
| **CWE** | CWE-22 |
| **Status** | **Fixed in tree** — reject `..`, separators, and escape from media root |
| **Components** | `InternalStorageService.resolvePath(key)` |

**Description**  
If a key ever contains `../`, path could escape media root. Current writers use `randomUUID()` keys.

**Remediation**  
Reject keys matching `[/\\]` or not matching UUID pattern; `path.resolve` + ensure prefix under media root.

---

### SK-2026-027 — SVG treated as unsafe for browser display (positive control)

| | |
|--|--|
| **Severity** | **I** (hardening note) |
| **Components** | `const.ts` FILE_TYPE_BROWSERSAFE excludes SVG; drive converts SVG |

Documented intentional XSS prevention for SVG. Keep tests for regressions.

---

### SK-2026-028 — x-algorithm gateway optional API key + DB credentials in example

| | |
|--|--|
| **Severity** | **M** if exposed |
| **CWE** | CWE-306 / CWE-798 |
| **Components** | `services/x-algorithm-gateway/server.mjs` |

**Description**  
`API_KEY` optional; default PG password in source; ranks notes via raw SQL with parameterized userId (good) but entire service is privileged to DB.

**Remediation**  
Require API key; no default passwords; bind loopback; network policy.

---

### SK-2026-029 — Escrow / setupPassword documentation vs code mismatch

| | |
|--|--|
| **Severity** | **L** |
| **Status** | **Fixed in tree** — config comments aligned; no setupPassword fallback in code |
| **Components** | `.config/default.yml` comments vs `ChatCryptoService.listKeyMaterials` |

**Description**  
Comments may still say fallback to `setupPassword`; code after `f95ed57` uses only `chatEscrowSecret` / env / meta keys.

**Remediation**  
Align docs; warn operators who relied on old behavior.

---

### SK-2026-030 — Role color CSS custom property injection (admin)

| | |
|--|--|
| **Severity** | **L** |
| **Components** | User profile roles `:style="{ '--color': role.color }"` |

Admin-defined role colors without hex validation.

---

### SK-2026-031 — Flash / Page AiScript scripts stored and executed client-side

| | |
|--|--|
| **Severity** | **L–M** (sandbox dependent) |
| **CWE** | CWE-94 (if sandbox breaks) |
| **Components** | `flash/create`, `pages/create` — free `script` strings |

**Description**  
User-supplied AiScript. Security depends on AiScript sandbox isolation (not fully re-audited here). Historical Misskey AiScript issues should be tracked upstream.

**Remediation**  
Keep sandbox updated; permission prompts; limit public flash capabilities.

---

### SK-2026-032 — WebSocket connect/disconnect not fully rate-limited (TODO)

| | |
|--|--|
| **Severity** | **L** |
| **Components** | `stream/Connection.ts` — `TODO rate-limit connect/disconnect cycles` |

Resource exhaustion via reconnect storms.

---

### SK-2026-033 — Chat search only matches plaintext `message.text`

| | |
|--|--|
| **Severity** | **I** (functional / privacy side-effect) |
| **Components** | `ChatService.searchMessages` — `LOWER(message.text) LIKE` |

Escrow-encrypted messages store null text → invisible to search (not an auth bypass; operational surprise). Ciphertext not searchable without server-side decrypt index.

---

### SK-2026-034 — `ap/get` admin-only federation fetch (intentional powerful SSRF-ish)

| | |
|--|--|
| **Severity** | **I** for admin abuse |
| **Components** | `endpoints/ap/get.ts` — `requireAdmin` |

Admins can resolve arbitrary URIs (expand collections). High privilege by design; protect admin accounts.

---

### SK-2026-035 — ActivityPub inbox signature + digest verification (positive)

| | |
|--|--|
| **Severity** | **I** |
| **Components** | `ActivityPubServerService` |

Host header, digest SHA-256, signature verify with key refresh — solid baseline. Continue regression tests for signature bypass classes known in Fediverse history.

---

### SK-2026-036 — Unauthenticated `sw/unregister` deletes push subscription by endpoint only

| | |
|--|--|
| **Severity** | **M** |
| **CWE** | CWE-862 / CWE-306 |
| **Status** | **Fixed in tree** — requires credential; delete scoped by `userId` + endpoint |
| **Components** | `endpoints/sw/unregister.ts` |

**Description**  
```ts
requireCredential: false
// ...
await this.swSubscriptionsRepository.delete({
  ...(me ? { userId: me.id } : {}),
  endpoint: ps.endpoint,
});
```  
Without auth, delete filter is **only** `endpoint`. Anyone who learns or guesses a Web Push `endpoint` URL can unregister that subscription (DoS against push notifications for that device/user).

**Remediation**  
Require credential; always scope delete by `userId`; or require proof (endpoint secret / subscription auth key).

---

### SK-2026-037 — Telegram sticker import embeds bot token in fetch URLs

| | |
|--|--|
| **Severity** | **L–M** |
| **CWE** | CWE-532 / CWE-598 |
| **Components** | `ChatStickerService.ts` — `https://api.telegram.org/file/bot${token}/...` |

**Description**  
Bot token appears in URL path for `getFile` downloads and drive `uploadFromUrl`. Access logs, proxy logs, or error telemetry that store full URLs may leak `TELEGRAM_BOT_TOKEN`, enabling sticker spam / Telegram API abuse as the bot.

Uses raw `fetch()` (not always the guarded agent path for Telegram API host — fixed public host, low SSRF).

**Remediation**  
Avoid logging full Telegram URLs; prefer header-based auth if API allows; rotate token if logs exposed; restrict import to trusted roles.

---

### SK-2026-038 — Translator sends note text to third-party (DeepL/Libre) with shared instance keys

| | |
|--|--|
| **Severity** | **L** (privacy) |
| **CWE** | CWE-359 |
| **Components** | `endpoints/notes/translate.ts` |

**Description**  
Users with `canUseTranslator` send note body to configured DeepL/Libre endpoints using **instance** API keys. Visibility is checked (good). Privacy risk: third-party processors see private/followers-only note text if policy allows those users to translate.

**Remediation**  
Document data sharing; optional local-only translator; restrict translator policy carefully.

---

### SK-2026-039 — `export-custom-emojis` any logged-in user can queue full emoji export

| | |
|--|--|
| **Severity** | **L** |
| **CWE** | CWE-770 |
| **Components** | `endpoints/export-custom-emojis.ts` — `secure: true`, 1/hour |

**Description**  
Any authenticated user triggers server-side custom emoji pack export job (resource cost / bulk download of instance assets). Rate-limited to 1/hour — mitigates but not staff-only.

**Remediation**  
Moderator-only if emoji pack is sensitive/large.

---

### SK-2026-040 — Admin API checks use role flags but root user bypasses

| | |
|--|--|
| **Severity** | **I** (design) |
| **Components** | `ApiCallService` — `rootUserId !== user?.id` skips role checks |

Root account is superuser regardless of token rank demotion on some paths. Protect root credentials strongly; prefer break-glass use only.

---

### SK-2026-041 — Public user list membership enumeration when `isPublic`

| | |
|--|--|
| **Severity** | **I** |
| **Components** | `users/lists/show`, `get-memberships` — unauthenticated for public lists |

By design for public lists; ensure private lists always 404 for non-owners (code checks `isPublic` — OK).

---

### SK-2026-042 — `deeplFreeInstance` URL fully admin-controlled outbound target

| | |
|--|--|
| **Severity** | **L** (admin SSRF) |
| **Components** | `notes/translate.ts` — `deeplFreeInstance` as POST endpoint |

Admin-set URL receives note text + instance may send DeepL-shaped traffic. Malicious/compromised admin can point at internal services (subject to HttpRequestService guards).

---

## 2. Attack surface map (abbreviated)

```
Internet
  ├─ /api/*  (Misskey API + rate limits + kinds)
  ├─ /oauth/* (authorize redirect, token, client_credentials stub)
  ├─ /api/v1/* Mastodon API
  ├─ /proxy/* media proxy ──► HttpRequestService ──► SSRF guards?
  ├─ /files/* drive keys (UUID)
  ├─ /url preview
  ├─ ActivityPub inbox/outbox (signed)
  ├─ WebSocket streaming (chatRoom, main, timelines)
  └─ optional x-algorithm-gateway (DB)
```

**Highest ROI for attackers**  
1. SSRF chain if non-production or webhook/proxy abuse  
2. Chat auth bugs (history stream — fixed; invite codes; blocks)  
3. CSS injection on high-traffic note chrome (channel color)  
4. Token/session theft (short native tokens, shared access)

---

## 3. Priority remediation plan

### P0 — before public exposure of this tree’s custom features

1. ~~Confirm chat stream gating (`f95ed57`)~~ **done in tree**.  
2. ~~Always-on private IP deny~~ **done in tree**.  
3. ~~OAuth `client_credentials` stub~~ **rejected in tree**.  
4. ~~Channel colors as hex only~~ **API done**; themeColor / frontend display still open.

### P1 — short term

5. ~~CSPRNG chat invite codes~~ **done**; still add join-by-code rate limits if missing.  
6. ~~Room invite block checks~~ **done**.  
7. Parameterize all `array_append` / poll SQL.  
8. Harden `fetch-rss` / webhooks / `/proxy`.  
9. Strip `style` from `sanitize-html` defaults.  
10. ~~`sw/unregister` auth~~ **done**.  
11. ~~`sponsors.forceUpdate` public DoS~~ **done**.  
12. ~~`federation/update-remote-user` auth~~ **done**.

### P2 — medium term

10. Clamp MFM position; chat simple-MFM mode.  
11. Escrow UX honesty + pack-time viewer checks.  
12. Lengthen tokens; CSPRNG IDs.  
13. Staff-only `sponsors.forceUpdate`; auth on `update-remote-user`.  
14. OAuth authorize redirect allowlist.

### P3 — hygiene

15. Align config comments; remove example secrets.  
16. WS reconnect limits; page-push validation.  
17. External gateway API keys mandatory.

---

## 4. Verification checklist (for operators)

- [x] Chat room stream membership gate (`f95ed57`+)  
- [x] Private-IP SSRF checks always on (not only production)  
- [x] OAuth `client_credentials` rejected  
- [x] Channel `color` API hex-only  
- [x] Chat invite CSPRNG + room invite block checks  
- [x] `sw/unregister` requires login  
- [x] `sponsors.forceUpdate` ignored publicly  
- [x] `federation/update-remote-user` requires credential  
- [x] Internal storage path traversal guard  
- [ ] `NODE_ENV=production` on public nodes (ops)  
- [ ] `chatEscrowSecret` set; not equal to weak `setupPassword` (ops)  
- [ ] `reset-db` not reachable (ops)  
- [ ] x-algorithm gateway not public without `API_KEY` (ops)  
- [ ] Frontend still sanitizes legacy channel colors in CSS  
- [ ] Private IP fetch to `http://127.0.0.1/` via `/proxy` and `fetch-rss` fails (smoke)  

---

## 5. Methodology notes

- Grep/AST review of backend `src/`, frontend MFM/sanitize/chat, services.  
- Confirmed mfm-js rejects semicolon breakouts in fn args.  
- Did **not** run dynamic exploits, fuzzers, or attack live instances.  
- Findings may include defense-in-depth issues not yet weaponized.

---

## 6. Revision history

| Rev | Date | Notes |
|-----|------|--------|
| 0.1 | 2026-07-14 | Initial deep audit: chat, CSS/MFM, SSRF, OAuth, SQL patterns, auth |
| 0.2 | 2026-07-14 | + push unregister, Telegram token URLs, translator privacy, export emoji, more |
| 0.3 | 2026-07-14 | Chat stream gate + escrow setupPassword cut |
| 0.4 | 2026-07-14 | Batch fix: SSRF always-on, OAuth stub, channel color, invite CSPRNG, room invite blocks, sw unregister, sponsors forceUpdate, federation update-remote-user auth, storage path, docs |

---

## 7. Appendix — key file index

| Area | Paths |
|------|--------|
| Chat stream | `server/api/stream/channels/chat-room.ts` |
| Chat service | `core/ChatService.ts` |
| Chat crypto | `core/ChatCryptoService.ts` |
| Chat pack | `core/entities/ChatEntityService.ts` |
| HTTP/SSRF | `core/HttpRequestService.ts`, `core/DownloadService.ts` |
| Media proxy | `server/FileServerService.ts` |
| MFM | `frontend/src/components/global/MkMfm.ts` |
| Sanitize | `frontend/src/utility/sanitize-html.ts` |
| OAuth | `server/oauth/OAuth2ProviderService.ts` |
| API authz | `server/api/ApiCallService.ts`, `AuthenticateService.ts` |
| Roles/rank | `core/RoleService.ts` |
| Poll SQL | `server/api/endpoints/notes/polls/vote.ts`, `core/PollService.ts` |

---

*End of AMD document. Continue appending findings as `SK-2026-0xx`.*
