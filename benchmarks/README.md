# Catalog scale benchmark

This opt-in suite writes a real generated CSV into the operating-system temporary directory,
loads it through the production catalog cache, and calls the production match and compare route
handlers. It never replaces `data/contractors.csv`. The temporary file is removed on completion.
The ordinary `npm test` suite excludes this folder.

Smoke run (1,000 actual rows):

```sh
FIREBIRD_BENCH_ROWS=1000 FIREBIRD_BENCH_REPEATS=2 npx vitest run --config benchmarks/vitest.config.ts --reporter=verbose --silent=false
```

Million-row distributed run:

```sh
NODE_OPTIONS=--max-old-space-size=3072 FIREBIRD_BENCH_ROWS=1000000 FIREBIRD_BENCH_MODE=distributed npx vitest run --config benchmarks/vitest.config.ts --reporter=verbose --silent=false
```

Million-row worst-bucket run, in a separate process:

```sh
NODE_OPTIONS=--max-old-space-size=3072 FIREBIRD_BENCH_ROWS=1000000 FIREBIRD_BENCH_MODE=dense npx vitest run --config benchmarks/vitest.config.ts --reporter=verbose --silent=false
```

The 3 GiB heap ceiling is a capacity setting, not measured consumption. Choose a machine with
enough free RAM and temporary disk space. The fixture uses approximately 1.5–2 GB of disk per
million rows; retained JS objects and indexes need additional memory. Do not run the two cases
concurrently. Default repetitions are 5 per scenario; `FIREBIRD_BENCH_REPEATS` accepts 1–20.

`distributed` cycles the 66 real source profiles across their cities, categories and formats.
`dense` puts every row in the first source profile's city/category. Both modes generate unique IDs,
names and descriptions, varying independent calendars, prices, languages and hours. Descriptions
are deliberately substantial. All profiles are busy on December 31; the last record is the unique
lexical winner on October 15. Generation streams rows with write backpressure.

The `FIREBIRD_BENCHMARK` JSON line records generation/import time, cold CSV load time, actual file
size, bucket size, machine/runtime, memory snapshots and process-lifetime peak RSS. Warm handler
p50/p95/max includes Request construction, body parsing, validation, selection, response
serialization and reading its JSON. It excludes network, Next server startup, build and browser.
The catalog is already loaded for these timings; cold load is reported separately and is **not**
asserted to meet 10 seconds. Peak RSS includes fixture generation and test runner overhead.

Assertions cover counts, at most three cards, busy/calendar exclusion, budget/format/city/category,
optional language/hours, repeated determinism, last-record winner, date comparison, empty budget,
all busy, and absent category through the selection function. Missing city/category is tested
directly because a dense fixture has only one valid city/category in API option validation.
Warm handler maximum must be below 10 seconds. A benchmark result establishes only this fixture,
hardware, process and sequential request load; it is not evidence for unlimited rows or concurrent
HTTP capacity. Concurrent initial catalog calls additionally verify shared snapshot loading.
