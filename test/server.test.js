'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { Writable } = require('node:stream');
const { createServer } = require('../server');

async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aidaemon-'));
  const scriptsDir = path.join(dir, 'scripts');
  await fs.mkdir(scriptsDir);
  let logs = '';
  const output = new Writable({ write(chunk, encoding, callback) { logs += chunk.toString(); callback(); } });
  const server = createServer({ scriptsDir, output });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => { server.close(resolve); server.closeIdleConnections(); });
    await fs.rm(dir, { recursive: true, force: true });
  });
  const url = `http://127.0.0.1:${server.address().port}/run`;
  return {
    dir, scriptsDir, url, logs: () => logs,
    post: (body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  };
}

test('runs a script and logs output, metadata, exit code and duration', async (t) => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.scriptsDir, 'hello.sh'), 'printf "hello stdout\\n"\nprintf "hello stderr\\n" >&2\n');
  const response = await f.post({ script: 'hello.sh' });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.exitCode, 0);
  assert.equal(result.script, 'hello.sh');
  assert.equal(result.signal, null);
  assert.ok(result.durationMs >= 0);
  for (const text of ['Time:', 'Script: hello.sh', 'User:', 'hello stdout', 'hello stderr', 'Exit code: 0', 'Total execution time:', '-'.repeat(60)]) {
    assert.ok(f.logs().includes(text), `Missing log: ${text}`);
  }
});

test('reports nonzero exit codes', async (t) => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.scriptsDir, 'fail.sh'), 'exit 7\n');
  const response = await f.post({ script: 'fail.sh' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).exitCode, 7);
  assert.match(f.logs(), /Exit code: 7/);
});

test('rejects invalid names, missing files and escaping symlinks', async (t) => {
  const f = await fixture(t);
  for (const script of ['../outside.sh', 'hello.sh; id', '/tmp/test.sh', '', 123]) {
    assert.equal((await f.post({ script })).status, 400);
  }
  assert.equal((await f.post({})).status, 400);
  assert.equal((await f.post({ script: 'missing.sh' })).status, 404);
  await fs.writeFile(path.join(f.dir, 'outside.sh'), 'echo outside\n');
  await fs.symlink(path.join(f.dir, 'outside.sh'), path.join(f.scriptsDir, 'escape.sh'));
  assert.equal((await f.post({ script: 'escape.sh' })).status, 400);
  assert.equal(f.logs(), '');
});

test('validates route, method, content type, JSON and body size', async (t) => {
  const f = await fixture(t);
  assert.equal((await fetch(f.url)).status, 405);
  assert.equal((await fetch(f.url + '/other')).status, 404);
  assert.equal((await fetch(f.url, { method: 'POST', body: '{}' })).status, 415);
  assert.equal((await fetch(f.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400);
  assert.equal((await f.post({ script: 'x'.repeat(17000) })).status, 413);
});
