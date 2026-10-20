import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root, server: { middlewareMode: true, hmr: false } });
try {
  const { createGuideSession, GUIDE_BACKGROUND_FILE, GUIDE_DECKLIST_FILE } = await server.ssrLoadModule('/src/data/guideExample.ts');
  const { defaultDocument } = await server.ssrLoadModule('/src/data/defaultTemplate.ts');
  const { createTemplateDocument } = await server.ssrLoadModule('/src/lib/templateDocument.ts');
  const { exportTemplateArchive, importTemplateArchive } = await server.ssrLoadModule('/src/lib/templateArchive.ts');
  const { useProjectStore } = await server.ssrLoadModule('/src/store/projectStore.ts');
  const before = JSON.stringify(defaultDocument);
  const bytes = await fs.readFile(new URL('../public/' + GUIDE_BACKGROUND_FILE, import.meta.url));
  assert.equal(bytes.readUInt32BE(16), 1080);
  assert.equal(bytes.readUInt32BE(20), 1080);
  const diagram = await fs.readFile(new URL('../public/' + GUIDE_DECKLIST_FILE, import.meta.url));
  assert.equal(diagram.readUInt32BE(16), 900);
  assert.equal(diagram.readUInt32BE(20), 760);
  const background = { id: 'guide-background', name: 'background.png', mimeType: 'image/png', dataUrl: 'data:image/png;base64,' + bytes.toString('base64') };
  const decklist = { id: 'guide-decklist', name: 'demo-decklist.png', mimeType: 'image/png', dataUrl: 'data:image/png;base64,' + diagram.toString('base64') };
  const session = createGuideSession(background, decklist);
  const dynamicIds = session.template.layers.filter(layer => layer.dynamic).map(layer => layer.id);
  assert.deepEqual(dynamicIds, ['player', 'deck', 'decklist']);
  for (const id of dynamicIds) assert.ok(session.batchRows[0].values[id]);
  assert.ok(session.assets[session.batchRows[0].values.decklist]);
  useProjectStore.setState(session);
  useProjectStore.getState().duplicateBatchRow(session.batchRows[0].id);
  const duplicate = useProjectStore.getState().batchRows[1];
  assert.deepEqual(duplicate.values, session.batchRows[0].values);
  useProjectStore.getState().updateBatchValue(duplicate.id, 'player', '2 · Demo Player');
  assert.equal(useProjectStore.getState().batchRows[0].values.player, '1 · Alex Rossi');
  const savedTemplate = createTemplateDocument(session.template, session.assets);
  const reopened = await importTemplateArchive(await (await exportTemplateArchive(savedTemplate)).arrayBuffer());
  assert.deepEqual(reopened, savedTemplate);
  assert.equal(reopened.assets[decklist.id], undefined, 'Session-only row image must not leak into a template archive');
  assert.equal('batchRows' in reopened, false, 'Template archive must not change the existing persistence contract');
  useProjectStore.getState().loadDocument(reopened);
  assert.deepEqual(useProjectStore.getState().batchRows[0].values, {});
  session.template.layers[0].x = 999;
  assert.notEqual(createGuideSession(background, decklist).template.layers[0].x, 999);
  assert.equal(JSON.stringify(defaultDocument), before);
  console.log('Guide checks passed: 1080 × 1080 background, complete sample row, independent duplication, template archive round-trip, session-only row data and unchanged default document.');
} finally {
  await server.close();
}
