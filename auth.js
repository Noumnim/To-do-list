// ---------- Taskflow Auth (client-side demo) ----------
// Accounts are stored in localStorage. This is for demo / test-automation
// practice only — not a real, secure authentication system.
(function () {
  const USERS_KEY = "taskflow.users";
  const SESSION_KEY = "taskflow.session";
  const DEMO_USER = { name: "Demo User", email: "demo@taskflow.com", password: "Demo@1234" };

  const read = (storage, key, fallback) => {
    try { const v = storage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  };
  const write = (storage, key, value) => {
    try { storage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  };
  const remove = (key) => {
    try { localStorage.removeItem(key); sessionStorage.removeItem(key); } catch { /* ignore */ }
  };

  // Simple, synchronous string hash (FNV-1a) so passwords aren't stored as plain text.
  function hash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return "h" + (h >>> 0).toString(16);
  }

  const normalizeEmail = (e) => String(e || "").trim().toLowerCase();
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function getUsers() {
    const users = read(localStorage, USERS_KEY, []);
    if (!users.some((u) => u.email === DEMO_USER.email)) {
      users.push({ name: DEMO_USER.name, email: DEMO_USER.email, password: hash(DEMO_USER.password), created: Date.now() });
      write(localStorage, USERS_KEY, users);
    }
    return users;
  }

  function validatePassword(pw) {
    if (!pw) return "Password is required";
    if (pw.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Password must contain letters and numbers";
    return "";
  }

  const Auth = {
    EMAIL_RE,
    validatePassword,

    register({ name, email, password }) {
      email = normalizeEmail(email);
      const users = getUsers();
      if (users.some((u) => u.email === email)) return { ok: false, field: "email", error: "An account with this email already exists" };
      users.push({ name: name.trim(), email, password: hash(password), created: Date.now() });
      write(localStorage, USERS_KEY, users);
      return { ok: true };
    },

    login({ email, password, remember }) {
      email = normalizeEmail(email);
      const user = getUsers().find((u) => u.email === email);
      if (!user || user.password !== hash(password)) return { ok: false, error: "Invalid email or password" };
      remove(SESSION_KEY);
      write(remember ? localStorage : sessionStorage, SESSION_KEY, { name: user.name, email: user.email, at: Date.now() });
      return { ok: true };
    },

    logout() { remove(SESSION_KEY); window.location.href = "login.html?logout=1"; },

    currentUser() {
      return read(sessionStorage, SESSION_KEY, null) || read(localStorage, SESSION_KEY, null);
    },

    // Redirect to login if not signed in (use on protected pages)
    requireAuth() {
      if (!Auth.currentUser()) window.location.replace("login.html");
    },

    // Redirect to the app if already signed in (use on login/register)
    redirectIfAuthed() {
      if (Auth.currentUser()) window.location.replace("index.html");
    },
  };

  getUsers(); // seed demo account
  window.Auth = Auth;
})();
