// Import-only identifiers from the original project format. No vendor content,
// logos, product defaults, or official affiliation are supplied by this adapter.
const studioLegacyKind = 'fortify-presentation-project';
const studioLegacyDatabase = 'fortify-presentation-editor-v1';
function studioCompatibleKind(kind) {
  return kind === 'presentation-studio-project' || kind === studioLegacyKind;
}
async function studioMigrateDrafts(target) {
  // Copy recovery data only on first use of an empty new database. The old
  // database stays intact. Browsers without database enumeration can import ZIPs.
  if (!indexedDB.databases) return;
  const names = await indexedDB.databases();
  if (!names.some(db => db.name === studioLegacyDatabase)) return;
  const request = req => new Promise((resolve,reject) => {
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
  if (await request(target.transaction('projects').objectStore('projects').count())) return;
  const source = await request(indexedDB.open(studioLegacyDatabase));
  try {
    if (!['projects','assets'].every(name => source.objectStoreNames.contains(name))) return;
    const transaction = source.transaction(['projects','assets']);
    const entries = await Promise.all(['projects','assets'].map(async name => {
      const store = transaction.objectStore(name);
      const [keys,values] = await Promise.all([request(store.getAllKeys()),request(store.getAll())]);
      return {name,keys,values};
    }));
    await new Promise((resolve,reject) => {
      const tx = target.transaction(['projects','assets'],'readwrite');
      for (const {name,keys,values} of entries) values.forEach((value,i) => tx.objectStore(name).put(value,keys[i]));
      tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(tx.error || new Error('Draft migration failed.'));
    });
  } finally { source.close(); }
}
