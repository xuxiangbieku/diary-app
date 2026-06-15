// 认证模块 - 使用 Supabase Auth REST API
(function(){
function init() {
  const SUPABASE_URL = SUPABASE_CONFIG.url;
  const SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey;

  let currentUser = null;
  let isRegister = false;
  let lastSession = null;

  // DOM - 每次使用时获取，防止加载时机问题
  function $id(id) { return document.getElementById(id); }

  function showError(m) {
    const el = $id("authError");
    if (el) { el.textContent = m; el.style.display = "block"; }
  }
  function clearError() {
    const el = $id("authError");
    if (el) { el.style.display = "none"; el.textContent = ""; }
  }

  // 从 localStorage 恢复会话
  function loadSession() {
    try {
      const s = localStorage.getItem("sb-session");
      if (s) { lastSession = JSON.parse(s); currentUser = lastSession.user; return true; }
    } catch(e) {}
    return false;
  }

  function saveSession(s) {
    lastSession = s;
    currentUser = s?.user || null;
    if (s) localStorage.setItem("sb-session", JSON.stringify(s));
    else localStorage.removeItem("sb-session");
  }

  async function sbFetch(path, options) {
    const headers = {
      "apikey": SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    };
    if (lastSession?.access_token) headers["Authorization"] = "Bearer " + lastSession.access_token;
    const resp = await fetch(SUPABASE_URL + path, { ...options, headers });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.msg || data.error_description || data.error || data.message || resp.statusText);
    return data;
  }

  async function signUp(email, password) {
    return await sbFetch("/auth/v1/signup", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  }

  async function signIn(email, password) {
    const data = await sbFetch("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    saveSession(data);
    return data;
  }

  async function signOut() {
    try { await sbFetch("/auth/v1/logout", { method: "POST" }); } catch(e) {}
    saveSession(null);
    currentUser = null;
    showAuth();
  }

  function toggleMode() {
    isRegister = !isRegister;
    clearError();
    const t = $id("authTitle"), b = $id("authBtn"), tg = $id("authToggle");
    if (t) t.textContent = isRegister ? "创建账号" : "登录";
    if (b) b.textContent = isRegister ? "注 册" : "登 录";
    if (tg) tg.innerHTML = isRegister
      ? "已有账号？<a href='#'>去登录</a>"
      : "没有账号？<a href='#'>注册一个</a>";
  }

  function showAuth() {
    const a = $id("authScreen"), m = $id("appMain");
    if (a) a.style.display = "flex";
    if (m) m.style.display = "none";
  }

  function showApp() {
    const a = $id("authScreen"), m = $id("appMain");
    if (a) a.style.display = "none";
    if (m) m.style.display = "flex";
    if (window.__onAuthReady) window.__onAuthReady(currentUser);
  }

  function setupAuth() {
    // 先检查本地会话
    if (loadSession()) { showApp(); return; }

    const authBtn = $id("authBtn");
    if (!authBtn) return;

    authBtn.onclick = async () => {
      clearError();
      const email = $id("authEmail")?.value?.trim();
      const password = $id("authPassword")?.value?.trim();

      if (!email || !password) { showError("请填写邮箱和密码"); return; }
      if (!email.includes("@")) { showError("请输入有效的邮箱地址"); return; }
      if (password.length < 6) { showError("密码至少6位"); return; }

      authBtn.disabled = true;
      authBtn.textContent = isRegister ? "注册中..." : "登录中...";
      try {
        if (isRegister) {
          const result = await signUp(email, password);
          if (result.id || result.user?.id) {
            // 注册成功，尝试自动登录
            await signIn(email, password);
          } else {
            showError("注册成功！请查看邮箱验证或直接登录");
            setTimeout(() => toggleMode(), 1500);
          }
        } else {
          const result = await signIn(email, password);
          if (result.user || result.access_token) showApp();
        }
      } catch (err) {
        console.error("Auth:", err.message);
        if (err.message.includes("Invalid login credentials")) showError("邮箱或密码错误");
        else if (err.message.includes("already registered")) showError("该邮箱已注册，请直接登录");
        else if (err.message.includes("duplicate key") || err.message.includes("already exists")) showError("该邮箱已注册，请直接登录");
        else showError(err.message || "操作失败，请重试");
      }
      authBtn.disabled = false;
      authBtn.textContent = isRegister ? "注 册" : "登 录";
    };

    // 切换登录/注册
    const toggle = $id("authToggle");
    if (toggle) toggle.onclick = toggleMode;

    // 回车提交
    const pwd = $id("authPassword");
    if (pwd) pwd.onkeydown = (e) => { if (e.key === "Enter") authBtn?.click(); };
    const em = $id("authEmail");
    if (em) em.onkeydown = (e) => { if (e.key === "Enter") pwd?.focus(); };
  }

  // 导出
  window.__auth = {
    getUser: () => currentUser,
  };
  window.__logout = signOut;

  // 等DOM加载完再启动
  setupAuth();
}

// 确保DOM加载完成
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
})();
