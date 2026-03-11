const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function getSaveMomentSource() {
  const scriptPath = path.join(__dirname, '..', 'script.js');
  const source = fs.readFileSync(scriptPath, 'utf8');
  const start = source.indexOf('async function saveMoment() {');
  const end = source.indexOf('\nfunction spawnSparkles()', start);

  assert.notStrictEqual(start, -1, 'saveMoment() should exist in script.js');
  assert.notStrictEqual(end, -1, 'saveMoment() should end before spawnSparkles()');

  return source.slice(start, end);
}

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

runTest('saveMoment uploads a selected photo at most once', () => {
  const saveMomentSource = getSaveMomentSource();
  const uploadCalls = saveMomentSource.match(/uploadPhoto\(state\.newPhotoFile,\s*momentId\)/g) || [];

  assert.strictEqual(
    uploadCalls.length,
    1,
    `expected one uploadPhoto() call in saveMoment(), found ${uploadCalls.length}`
  );
});

runTest('saveMoment declares the moment payload only once', () => {
  const saveMomentSource = getSaveMomentSource();
  const declarations = saveMomentSource.match(/const moment = \{/g) || [];

  assert.strictEqual(
    declarations.length,
    1,
    `expected one moment payload declaration in saveMoment(), found ${declarations.length}`
  );
});
