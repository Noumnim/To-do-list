// ---------- Login & Register page logic ----------
(function () {
  const $ = (s) => document.querySelector(s);

  // Apply saved theme (shared with the main app)
  try {
    const saved = JSON.parse(localStorage.getItem("taskflow.theme"));
    const theme = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
  } catch { /* ignore */ }

  const alertBox = $("#form-alert");
  function showAlert(msg, type = "error") {
    alertBox.textContent = msg;
    alertBox.className = `alert ${type}`;
    alertBox.hidden = false;
  }
  function hideAlert() { alertBox.hidden = true; }

  function setError(field, msg) {
    const input = $(`#${field}`);
    const err = $(`#${field}-error`);
    if (err) err.textContent = msg || "";
    if (input) {
      input.classList.toggle("invalid", !!msg);
      input.setAttribute("aria-invalid", msg ? "true" : "false");
    }
    return !msg;
  }

  // Show / hide password buttons
  document.querySelectorAll(".toggle-pw").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.textContent = show ? "Hide" : "Show";
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });

  // Clear a field's error while typing
  document.querySelectorAll(".auth-form input").forEach((input) => {
    input.addEventListener("input", () => { setError(input.id, ""); hideAlert(); });
  });

  // ---------- Login ----------
  const loginForm = $("#login-form");
  if (loginForm) {
    const params = new URLSearchParams(location.search);
    if (params.get("registered")) {
      showAlert("Account created successfully. Please sign in.", "success");
      if (params.get("email")) $("#email").value = params.get("email");
      $("#password").focus();
    } else if (params.get("logout")) {
      showAlert("You have been signed out.", "success");
    }

    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      hideAlert();
      const email = $("#email").value.trim();
      const password = $("#password").value;

      let ok = true;
      if (!email) ok = setError("email", "Email is required") && ok;
      else if (!Auth.EMAIL_RE.test(email)) ok = setError("email", "Please enter a valid email address") && ok;
      else setError("email", "");
      if (!password) ok = setError("password", "Password is required") && ok;
      else setError("password", "");
      if (!ok) return;

      const res = Auth.login({ email, password, remember: $("#remember").checked });
      if (!res.ok) { showAlert(res.error); $("#password").value = ""; $("#password").focus(); return; }
      window.location.href = "index.html";
    });
  }

  // ---------- Register ----------
  const registerForm = $("#register-form");
  if (registerForm) {
    const bar = $("#strength-bar");
    const label = $("#strength-label");
    const LEVELS = [
      { text: "Use 8+ characters with letters and numbers.", cls: "" },
      { text: "Weak password", cls: "weak" },
      { text: "Fair password", cls: "fair" },
      { text: "Good password", cls: "good" },
      { text: "Strong password", cls: "strong" },
    ];
    $("#password").addEventListener("input", (e) => {
      const pw = e.target.value;
      let score = 0;
      if (pw) {
        score = 1;
        if (pw.length >= 8) score++;
        if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) score++;
        if (pw.length >= 12 || /[^A-Za-z0-9]/.test(pw)) score++;
      }
      const lvl = LEVELS[score];
      bar.className = lvl.cls;
      bar.style.width = `${score * 25}%`;
      label.textContent = lvl.text;
    });

    registerForm.addEventListener("submit", (e) => {
      e.preventDefault();
      hideAlert();
      const name = $("#name").value.trim();
      const email = $("#email").value.trim();
      const password = $("#password").value;
      const confirm = $("#confirm").value;
      const terms = $("#terms").checked;

      let ok = true;
      ok = setError("name", !name ? "Full name is required" : name.length < 2 ? "Name must be at least 2 characters" : "") && ok;
      ok = setError("email", !email ? "Email is required" : !Auth.EMAIL_RE.test(email) ? "Please enter a valid email address" : "") && ok;
      ok = setError("password", Auth.validatePassword(password)) && ok;
      ok = setError("confirm", !confirm ? "Please confirm your password" : confirm !== password ? "Passwords do not match" : "") && ok;
      ok = setError("terms", terms ? "" : "You must agree to the Terms of Service") && ok;
      if (!ok) { registerForm.querySelector(".invalid")?.focus(); return; }

      const res = Auth.register({ name, email, password });
      if (!res.ok) { setError(res.field, res.error); $(`#${res.field}`).focus(); return; }
      window.location.href = `login.html?registered=1&email=${encodeURIComponent(email.toLowerCase())}`;
    });

    $("#terms").addEventListener("change", () => setError("terms", ""));
  }
})();
