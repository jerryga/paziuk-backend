#!/usr/bin/env node
const http = require('http');
const https = require('https');

function fetchUrl(url, timeout = 5000) {
  return new Promise((resolve, reject) => {
    try {
      const lib = url.startsWith('https') ? https : http;
      const req = lib.get(url, { timeout }, (res) => {
        const headers = {};
        for (const [k, v] of Object.entries(res.headers)) headers[k.toLowerCase()] = v;
        res.resume();
        resolve({ statusCode: res.statusCode, headers });
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });
    } catch (err) {
      reject(err);
    }
  });
}

function checkHeaders(url, response) {
  const required = [
    'content-security-policy',
    'x-frame-options',
    'x-content-type-options',
    'referrer-policy',
  ];

  const results = required.map((h) => ({ header: h, present: !!response.headers[h] }));

  // If URL is https, expect Strict-Transport-Security
  if (url.startsWith('https://')) {
    results.push({ header: 'strict-transport-security', present: !!response.headers['strict-transport-security'] });
  }

  return results;
}

async function main() {
  const url = process.argv[2] || 'http://localhost:8080/';
  console.log('Checking security headers for', url);

  try {
    const res = await fetchUrl(url);
    const checks = checkHeaders(url, res);

    let pass = true;
    checks.forEach((c) => {
      if (!c.present) pass = false;
      console.log(`${c.present ? 'PASS' : 'FAIL'}: ${c.header}`);
    });

    if (pass) {
      console.log('\nAll required security headers present.');
      process.exit(0);
    } else {
      console.log('\nSome security headers are missing.');
      process.exit(2);
    }
  } catch (err) {
    console.error('Error checking headers:', err.message || err);
    process.exit(3);
  }
}

if (require.main === module) main();
