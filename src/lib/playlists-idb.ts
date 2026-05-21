import type { Track } from "./search";

export type Playlist = {
  id: string;
  name: string;
  createdAt: number;
  tracks: Track[];
};

const DB_NAME = "RudraMusicHub";
const STORE_NAME = "playlists";
const DB_VERSION = 1;

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

export async function getPlaylists(): Promise<Playlist[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      // Sort by createdAt descending
      const playlists = (request.result as Playlist[]).sort((a, b) => b.createdAt - a.createdAt);
      resolve(playlists);
    };
  });
}

export async function savePlaylist(playlist: Playlist): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(playlist);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function deletePlaylist(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function overwriteAllPlaylists(playlists: Playlist[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    // Clear existing
    store.clear();

    // Insert new ones
    playlists.forEach((p) => store.put(p));

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
