// -*- coding: utf-8 -*-
// 数据库模块 - 本地 IndexedDB + Supabase REST API
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

  // ---- 获取当前 access_token ----
  function getToken() {
    try {
      const s = localStorage.getItem("sb-session");
      if (s) { const parsed = JSON.parse(s); return parsed.access_token || null; }
    } catch(e) {}
    return null;
  }

  function getUserId() {
    try {
      const s = localStorage.getItem("sb-session");
      if (s) { const parsed = JSON.parse(s); return parsed.user?.id || null; }
    } catch(e) {}
    return null;
  }

  // ---- REST API 通用请求（支持额外请求头）----
  async function sbApi(method, path, body, extraHeaders) {
    const headers = {
      "apikey": SUPABASE_CONFIG.anonKey,
      "Content-Type": "application/json",
      ...extraHeaders,
    };
    const token = getToken();
    if (token) headers["Authorization"] = "Bearer " + token;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const resp = await fetch(SUPABASE_CONFIG.url + path, opts);
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(text || resp.statusText);
    }
    return resp.status === 204 ? null : await resp.json();
  }

  // ---- 上传图片到 Supabase Storage ----
  async function uploadPhoto(blob) {
    const userId = getUserId();
    if (!userId) return null;
    const token = getToken();
    const fileName = userId + "/" + Date.now() + "_" + Math.random().toString(36).slice(2,8) + ".jpg";
    try {
      const headers = { "apikey": SUPABASE_CONFIG.anonKey };
      if (token) headers["Authorization"] = "Bearer " + token;
      const resp = await fetch(SUPABASE_CONFIG.url + "/storage/v1/object/diary-photos/" + fileName, {
        method: "POST", headers, body: blob
      });
      if (!resp.ok) throw new Error("Upload failed");
      return SUPABASE_CONFIG.url + "/storage/v1/object/public/diary-photos/" + fileName;
    } catch (e) { console.warn("上传失败:", e); return null; }
  }

  // ---- 保存到云端（使用 upsert 防止冲突）----
  async function syncToCloud(entry) {
    const userId = getUserId();
    const token = getToken();
    if (!userId || !token) return;
    try {
      let photos = entry.photos || [];
      const uploadedPhotos = [];
      for (const p of photos) {
        if (p.startsWith("data:")) {
          const res = await fetch(p);
          const blob = await res.blob();
          const url = await uploadPhoto(blob);
          uploadedPhotos.push(url || p);
        } else {
          uploadedPhotos.push(p);
        }
      }
      await sbApi("POST", "/rest/v1/diary_entries", {
        user_id: userId, date: entry.date,
        mood: entry.mood || "", location: entry.location || "",
        text: entry.text || "", photos: uploadedPhotos,
        shopping: entry.shopping || [],
        updated_at: new Date().toISOString()
      }, { "Prefer": "resolution=merge-duplicates" });
      lastSyncTime = new Date();
    } catch (e) { console.warn("云同步错误:", e); }
  }

  // ---- 从云端拉取 ----
  async function syncFromCloud() {
    const userId = getUserId();
    const token = getToken();
    if (!userId || !token) return 0;
    try {
      const data = await sbApi("GET", "/rest/v1/diary_entries?user_id=eq." + userId + "&order=date.desc");
      if (!data || !data.length) return 0;
      let count = 0;
      for (const row of data) {
        const local = await getEntry(row.date);
        const ct = new Date(row.updated_at || 0).getTime();
        const lt = local ? new Date(local.updated_at || 0).getTime() : 0;
        if (!local || ct >= lt) {
          await saveEntry({
            date: row.date, mood: row.mood || "", location: row.location || "",
            text: row.text || "", photos: row.photos || [],
            shopping: row.shopping || [], updated_at: row.updated_at
          });
          count++;
        }
      }
      lastSyncTime = new Date();
      return count;
    } catch (e) { console.warn("云拉取失败:", e); return 0; }
  }

  // ---- 本地 + 云端同步保存 ----
  async function saveAndSync(entry) {
    entry.updated_at = new Date().toISOString();
    await saveEntry(entry);
    syncToCloud(entry).catch(() => {});
    return true;
  }

  // ---- 本地 IndexedDB ----
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

  async function exportAll() { return await getAllEntries(); }

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
