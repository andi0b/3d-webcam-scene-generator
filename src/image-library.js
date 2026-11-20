const DATABASE = 'roomlight-image-library';
const STORE = 'library';

function openLibrary() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    let blocked = false;
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => reject(request.error);
    request.onblocked = () => { blocked = true; reject(new Error('Image library is open in another tab.')); };
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

function validImages(data) {
  if (!Array.isArray(data)) return [];
  const seen = new Set();
  return data.filter(image => {
    if (!image || typeof image.id !== 'string' || !image.id || seen.has(image.id) || typeof image.name !== 'string' || typeof image.data !== 'string' || !image.data.startsWith('data:image/')) return false;
    seen.add(image.id); return true;
  });
}

export async function readImageLibrary() {
  const db = await openLibrary();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get('images');
    tx.oncomplete = () => { db.close(); resolve(validImages(request.result)); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('Image library read was interrupted.')); };
  });
}

export async function updateImageLibrary(change) {
  const db = await openLibrary();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE), request = store.get('images');
    let next;
    request.onsuccess = () => {
      try {
        next = change(validImages(request.result));
        store.put(next, 'images');
      } catch (error) { tx.abort(); reject(error); }
    };
    tx.oncomplete = () => { db.close(); resolve(next); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('Image library update was interrupted.')); };
  });
}
