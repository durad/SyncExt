# aidaemon

A dependency-free Node.js API that runs shell scripts as the user running the server. Requires Node.js 20+ and `/bin/bash` (Linux/macOS).

## Start

```sh
npm start
```

Defaults to `127.0.0.1:3000`. Set `HOST` and `PORT` to override:

```sh
HOST=127.0.0.1 PORT=8080 npm start
```

## Run a script

Place Bash-compatible `.sh` files in `scripts/`, then call:

```sh
curl -X POST http://127.0.0.1:3000/run \
  -H 'Content-Type: application/json' \
  -d '{"script":"hello.sh"}'
```

The server prints a dashed separator, the current time, script name/path, user, and working directory, then another separator. Both stdout and stderr from the script are streamed to the server's stdout. When the script finishes, the server prints its exit code and total execution time.

The HTTP response waits for completion and looks like:

```json
{"script":"hello.sh","exitCode":0,"signal":null,"durationMs":12}
```

A completed script returns HTTP 200 even if its exit code is nonzero; check `exitCode` for success. A signal-terminated script has a null exit code and a populated `signal`. Failure to start the process returns HTTP 500. Invalid input returns 400, missing scripts 404, unsupported methods 405, oversized bodies 413, and non-JSON requests 415.

Scripts run using `/bin/bash` with `scripts/` as their working directory, inherit the server's environment and permissions, and have no interactive stdin. They do not need executable permission. Only simple `.sh` filenames are accepted, and symlinks resolving outside `scripts/` are rejected.

**Security:** This API has no authentication. Keep it on localhost or behind an authenticated proxy; anyone able to call it can execute the available scripts with the server user's privileges. Only trusted users should be able to modify `scripts/`. There is no execution timeout; concurrent requests run concurrently, so their console output may interleave. Disconnecting an HTTP client does not stop its script.

## Tests

```sh
npm test
```
