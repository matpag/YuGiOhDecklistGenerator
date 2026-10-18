import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function loadModule(relative) {
  const source = await readFile(new URL(relative, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const core = await loadModule('../src/i18n/core.ts');
const { catalog, translate, UiError } = await loadModule('../src/i18n/messages.ts');

test('every UI message has five nonempty translations and matching interpolation fields', () => {
  assert.ok(Object.keys(catalog).length > 120, 'The catalog covers the whole editor');
  const fields = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const [key, values] of Object.entries(catalog)) {
    assert.equal(values.length, 5, key);
    for (const value of values) {
      assert.equal(typeof value, 'string', key);
      assert.ok(value.trim(), key);
      assert.deepEqual(fields(value), fields(values[0]), `${key}: interpolation fields`);
    }
  }
});

test('valid URL language wins over storage and browser preferences', () => {
  for (const language of core.LANGUAGES) {
    assert.equal(core.resolveLanguage(`https://retroformats.com/decklist/?ui_lang=${language}`, 'de', ['it-IT']), language);
  }
});

test('invalid URL/storage values use supported browser preferences, then English', () => {
  assert.equal(core.resolveLanguage('https://retroformats.com/?ui_lang=xx', 'fr', ['it']), 'fr');
  assert.equal(core.resolveLanguage('https://retroformats.com/?ui_lang=IT', 'xx', ['pt-BR', 'DE-de', 'it']), 'de');
  assert.equal(core.resolveLanguage('https://retroformats.com/', null, ['zh-CN', 'es-MX']), 'es');
  assert.equal(core.resolveLanguage('https://retroformats.com/', null, ['pt', 'ja']), 'en');
  assert.equal(core.resolveLanguage('invalid URL', null, []), 'en');
});

test('storage reads and writes tolerate denied access and use the suite key', () => {
  assert.equal(core.readLanguageStorage(() => { throw new Error('denied'); }), null);
  assert.doesNotThrow(() => core.writeLanguageStorage(() => { throw new Error('denied'); }, 'it'));
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  core.writeLanguageStorage(() => storage, 'es');
  assert.equal(values.get('retroformats-ui-language'), 'es');
  assert.equal(core.readLanguageStorage(() => storage), 'es');
});

test('language links preserve destination, other query parameters and hash', () => {
  const result = new URL(core.withLanguage('https://retroformats.com/decklist/?foo=one&ui_lang=en&bar=two#selected-layer', 'fr'));
  assert.equal(result.pathname, '/decklist/');
  assert.equal(result.searchParams.get('foo'), 'one');
  assert.equal(result.searchParams.get('bar'), 'two');
  assert.deepEqual(result.searchParams.getAll('ui_lang'), ['fr']);
  assert.equal(result.hash, '#selected-layer');
});

test('interpolation preserves user text, IDs and font names literally', () => {
  for (const language of core.LANGUAGES) {
    const name = 'Custom $& font {value}';
    assert.ok(translate(language, 'deleteNamed', { name }).includes(name));
    assert.ok(translate(language, 'missingText', { row: 2, id: 'player_id' }).includes('player_id'));
    const error = new UiError('missingFont', { font: name });
    assert.ok(translate(language, error.key, error.values).includes(name));
  }
});
