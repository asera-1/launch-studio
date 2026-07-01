// Tiny IndexedDB key→value store for autosaving uploaded screenshots (data URLs).
const DB = "launch-studio", STORE = "images", VER = 1

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, VER)
    r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE) }
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}

export async function idbSet(key: string, val: string): Promise<void> {
  try {
    const db = await open()
    await new Promise<void>((res, rej) => {
      const t = db.transaction(STORE, "readwrite")
      t.objectStore(STORE).put(val, key)
      t.oncomplete = () => res(); t.onerror = () => rej(t.error)
    })
  } catch {}
}

export async function idbGet(key: string): Promise<string | undefined> {
  try {
    const db = await open()
    return await new Promise<string | undefined>((res) => {
      const t = db.transaction(STORE, "readonly")
      const rq = t.objectStore(STORE).get(key)
      rq.onsuccess = () => res(rq.result as string | undefined)
      rq.onerror = () => res(undefined)
    })
  } catch { return undefined }
}

export async function idbDelete(key: string): Promise<void> {
  try {
    const db = await open()
    await new Promise<void>((res, rej) => {
      const t = db.transaction(STORE, "readwrite")
      t.objectStore(STORE).delete(key)
      t.oncomplete = () => res(); t.onerror = () => rej(t.error)
    })
  } catch {}
}

export async function idbClear(): Promise<void> {
  try {
    const db = await open()
    await new Promise<void>((res, rej) => {
      const t = db.transaction(STORE, "readwrite")
      t.objectStore(STORE).clear()
      t.oncomplete = () => res(); t.onerror = () => rej(t.error)
    })
  } catch {}
}
