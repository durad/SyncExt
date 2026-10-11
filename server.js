'use strict';

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { performance } = require('node:perf_hooks');

const MAX_BODY_BYTES = 16 * 1024;
const SEPARATOR = '-'.repeat(60);

function respond(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body) + '\n');
}

async function resolveScript(scriptsDir, name) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.sh$/.test(name)) {
    const error = new Error('script must be a .sh filename, without directory components');
    error.status = 400;
    throw error;
  }

  const root = await fs.realpath(scriptsDir);
  const filename = await fs.realpath(path.join(root, name));
  if (path.dirname(filename) !== root || !(await fs.stat(filename)).isFile()) {
    const error = new Error('Script must be a regular file inside the scripts directory');
    error.status = 400;
    throw error;
  }
  return filename;
}

function runScript(filename, name, output) {
  return new Promise((resolve) => {
    const started = performance.now();
    output.write([
      '', SEPARATOR,
      `Time: ${new Date().toISOString()}`,
      `Script: ${name}`,
      `Path: ${filename}`,
      `User: ${os.userInfo().username} (uid: ${process.getuid?.() ?? 'n/a'})`,
      `Working directory: ${path.dirname(filename)}`,
      SEPARATOR, '',
    ].join('\n'));

    // No shell interpolation, privilege changes, or executable permission required.
    const child = spawn('/bin/bash', [filename], {
      cwd: path.dirname(filename),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.pipe(output, { end: false });
    child.stderr.pipe(output, { end: false });

    let spawnError;
    child.on('error', (error) => {
      spawnError = error.message;
      output.write(`\nFailed to start script: ${error.message}\n`);
    });
    // "close" fires after stdout and stderr have both finished.
    child.on('close', (exitCode, signal) => {
      const durationMs = Math.round(performance.now() - started);
      output.write(`\n${SEPARATOR}\nScript: ${name}\nExit code: ${exitCode ?? 'n/a'}\n`);
      if (signal) output.write(`Signal: ${signal}\n`);
      output.write(`Total execution time: ${durationMs} ms\n${SEPARATOR}\n`);
      resolve({ script: name, exitCode, signal, durationMs, ...(spawnError && { error: spawnError }) });
    });
  });
}

function createServer({ scriptsDir = path.join(__dirname, 'scripts'), output = process.stdout } = {}) {
  return http.createServer((req, res) => {
    if (req.url.split('?')[0] !== '/run') {
      respond(res, 404, { error: 'Not found' });
      req.resume();
      return;
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      respond(res, 405, { error: 'Use POST /run' });
      req.resume();
      return;
    }
    if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      respond(res, 415, { error: 'Content-Type must be application/json' });
      req.resume();
      return;
    }

    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (res.writableEnded) return;
      if (size > MAX_BODY_BYTES) {
        chunks.length = 0;
        respond(res, 413, { error: 'Request body too large' });
        return;
      }
      chunks.push(chunk);
    });
    req.on('error', () => {
      if (!res.writableEnded && !res.destroyed) respond(res, 400, { error: 'Unable to read request' });
    });
    req.on('end', async () => {
      if (res.writableEnded) return;
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        respond(res, 400, { error: 'Invalid JSON body' });
        return;
      }
      try {
        const filename = await resolveScript(scriptsDir, body?.script);
        const result = await runScript(filename, body.script, output);
        respond(res, result.error ? 500 : 200, result);
      } catch (error) {
        const status = error.status ?? (['ENOENT', 'ENOTDIR'].includes(error.code) ? 404 : 500);
        if (status === 500) output.write(`Server error: ${error.message}\n`);
        respond(res, status, { error: status === 404 ? 'Script not found' : status === 500 ? 'Internal server error' : error.message });
      }
    });
  });
}

if (require.main === module) {
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 3000);
  const server = createServer();
  server.on('error', (error) => {
    console.error(`Server error: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, host, () => {
    console.log(`Listening on http://${host}:${server.address().port}`);
  });
}

module.exports = { createServer };
