// -*- coding: utf-8 -*-
// 数据库模块 - 本地 IndexedDB + 远程 Supabase 同步
const DB = (() => {
  const DB_NAME = "DiaryDB", DB_VER = 1, STORE = "entries";
  let db = null;
  let lastSyncTime = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(STORE)) {
          d.createObjectStore(STORE, { keyPath: "date" });
        }
      };
      req.onsuccess = e => { db = e.target.result; resolve(db); };
      req.onerror = e => reject(e.target.error);
    });
  }

  async function getEntry(dateStr) {
    const d = await open();
    return new Promise(resolve => {
      const tx = d.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(dateStr);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async function getAllEntries() {
    const d = await open();
    return new Promise(resolve => {
      const tx = d.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  function getUserId() {
    if (window.__auth) {
      const user = window.__auth.getUser();
      return user ? user.id : null;
    }
    return null;
  }

  // ---- 上传图片到 Supabase Storage ----
  async function uploadPhoto(blob) {
    const userId = getUserId();
    if (!userId || !window.__auth) return null;
    const sb = window.__auth.supabase;
    const fileName = userId + '/' + Date.now() + '_' + Math.random().toString(36).slice(2,8) + '.jpg';
    try {
      const { error } = await sb.storage.from('diary-photos').upload(fileName, blob, {
        cacheControl: '3600', upsert: false
      });
      if (error) throw error;
      const { publicURL } = sb.storage.from('diary-photos').getPublicUrl(fileName);
      return publicURL;
    } catch (e) {
      console.warn('上传照片失败:', e);
      return null;
    }
  }

  // ---- 保存到云端 ----
  async function syncToCloud(entry) {
    const userId = getUserId();
    if (!userId || !window.__auth) return;
    const sb = window.__auth.supabase;
    try {
      let photos = entry.photos || [];
      const uploadedPhotos = [];
      for (const p of photos) {
        if (p.startsWith('data:')) {
          const res = await fetch(p);
          const blob = await res.blob();
          const url = await uploadPhoto(blob);
          uploadedPhotos.push(url || p);
        } else {
          uploadedPhotos.push(p);
        }
      }
      const cloudEntry = {
        user_id: userId, date: entry.date,
        mood: entry.mood || '', location: entry.location || '',
        text: entry.text || '', photos: uploadedPhotos,
        shopping: entry.shopping || [],
        updated_at: new Date().toISOString()
      };
      const { error } = await sb.from('diary_entries').upsert(cloudEntry, {
        onConflict: 'user_id,date'
      });
      if (error) console.warn('云同步失败:', error);
      else lastSyncTime = new Date();
    } catch (e) { console.warn('云同步错误:', e); }
  }

  // ---- 从云端拉取 ----
  async function syncFromCloud() {
    const userId = getUserId();
    if (!userId || !window.__auth) return 0;
    const sb = window.__auth.supabase;
    try {
      const { data, error } = await sb.from('diary_entries')
        .select('*').eq('user_id', userId).order('date', { ascending: false });
      if (error) throw error;
      if (!data || !data.length) return 0;
      let count = 0;
      for (const row of data) {
        const local = await getEntry(row.date);
        const ct = new Date(row.updated_at || 0).getTime();
        const lt = local ? new Date(local.updated_at || 0).getTime() : 0;
        if (!local || ct >= lt) {
          await saveEntry({
            date: row.date, mood: row.mood || '', location: row.location || '',
            text: row.text || '', photos: row.photos || [],
            shopping: row.shopping || [], updated_at: row.updated_at
          });
          count++;
        }
      }
      lastSyncTime = new Date();
      return count;
    } catch (e) { console.warn('云拉取失败:', e); return 0; }
  }

  // ---- 保存（本地）+ 同步（云端） ----
  async function saveAndSync(entry) {
    entry.updated_at = new Date().toISOString();
    await saveEntry(entry);
    syncToCloud(entry).catch(() => {});
    return true;
  }

  // ---- 本地 IndexedDB 操作 ----
  async function saveEntry(entry) {
    const d = await open();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, "readwrite");
      const req = tx.objectStore(STORE).put(entry);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async function deleteEntry(dateStr) {
    const d = await open();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, "readwrite");
      const req = tx.objectStore(STORE).delete(dateStr);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async function exportAll() {
    return await getAllEntries();
  }

  async function importAll(entries) {
    const d = await open();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      let count = 0;
      entries.forEach(e => { const req = store.put(e); req.onsuccess = () => count++; });
      tx.oncomplete = () => resolve(count);
      tx.onerror = () => reject(tx.error);
    });
  }

  return {
    getEntry, getAllEntries, saveEntry, saveAndSync, deleteEntry,
    exportAll, importAll, syncToCloud, syncFromCloud,
    getLastSync: () => lastSyncTime
  };
})();
