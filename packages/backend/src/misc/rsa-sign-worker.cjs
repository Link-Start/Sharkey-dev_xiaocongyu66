/*
 * SPDX-FileCopyrightText: Sharkey contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Piscina worker: RSA-SHA256 sign off the main thread.
 * Input: { dataBase64: string, privateKeyPem: string }
 * Output: base64 signature string
 */

'use strict';

const { createSign } = require('node:crypto');

module.exports = ({ dataBase64, privateKeyPem }) => {
	const data = Buffer.from(dataBase64, 'base64');
	const signer = createSign('sha256');
	signer.update(data);
	signer.end();
	return signer.sign(privateKeyPem, 'base64');
};
