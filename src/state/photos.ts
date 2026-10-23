const database = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('beli-local-photos', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('photos');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
export async function savePhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/') || file.size > 15 * 1024 * 1024) throw new Error('请选择 15 MB 以内的图片');
  const db = await database(); const id = crypto.randomUUID();
  await new Promise<void>((resolve, reject) => { const tx = db.transaction('photos', 'readwrite'); tx.objectStore('photos').put(file, id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
  db.close(); return id;
}
export async function readPhoto(id: string): Promise<Blob | null> {
  const db = await database();
  const value = await new Promise<Blob | null>((resolve, reject) => { const req = db.transaction('photos').objectStore('photos').get(id); req.onsuccess = () => resolve(req.result ?? null); req.onerror = () => reject(req.error); });
  db.close(); return value;
}
export async function cachePhoto(id: string, blob: Blob): Promise<void> {
  const db = await database();
  await new Promise<void>((resolve,reject) => { const tx=db.transaction('photos','readwrite');tx.objectStore('photos').put(blob,id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error); });
  db.close();
}
