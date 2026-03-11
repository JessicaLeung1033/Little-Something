const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scriptPath = path.join(__dirname, '..', 'script.js');
const source = fs.readFileSync(scriptPath, 'utf8');

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

runTest('script defines a dedicated origin key for local cache', () => {
  assert.match(
    source,
    /LOCAL_DATA_ORIGIN_KEY/,
    'expected script.js to define a dedicated local data origin key'
  );
});

runTest('saveLocal persists the cache origin alongside cached data', () => {
  assert.match(
    source,
    /localStorage\.setItem\(LOCAL_DATA_ORIGIN_KEY,\s*origin\)/,
    'expected saveLocal() to persist the cache origin'
  );
});

runTest('sign-in migration is gated by a dedicated predicate instead of raw ls_moments presence', () => {
  assert.match(
    source,
    /if\s*\(shouldMigrateLocalData\(\)\)/,
    'expected SIGNED_IN flow to guard migration via shouldMigrateLocalData()'
  );
});
