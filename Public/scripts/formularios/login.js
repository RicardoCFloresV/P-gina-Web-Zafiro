// login.js
// Módulo ES para manejar el formulario de inicio de sesión
// POST /api/auth/login { login, password } → { success, message, redirect }

const form          = document.getElementById('form-login');
const loginInput    = document.getElementById('loginInput');
const passwordInput = document.getElementById('loginPassword');
const submitBtn     = document.getElementById('loginSubmitBtn');
const btnText       = document.getElementById('loginBtnText');
const btnSpinner    = document.getElementById('loginBtnSpinner');
const errorBox      = document.getElementById('login-error');
const errorText     = document.getElementById('login-error-text');
const togglePwdBtn  = document.getElementById('togglePassword');
const togglePwdIcon = document.getElementById('togglePasswordIcon');


// ─── Toggle password visibility ─────────────────────────────────────────────
if (togglePwdBtn) {
  togglePwdBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    togglePwdIcon.classList.toggle('fa-eye', !isPassword);
    togglePwdIcon.classList.toggle('fa-eye-slash', isPassword);
  });
}


// ─── Show / hide error ──────────────────────────────────────────────────────
function showError(msg) {
  errorText.textContent = msg;
  errorBox.style.display = 'flex';
}

function hideError() {
  errorBox.style.display = 'none';
  errorText.textContent = '';
}


// ─── Loading state ──────────────────────────────────────────────────────────
function setLoading(loading) {
  submitBtn.disabled = loading;
  btnText.textContent = loading ? 'Verificando...' : 'Iniciar Sesión';
  btnSpinner.style.display = loading ? 'inline-block' : 'none';
}


// ─── Clear errors when modal opens ──────────────────────────────────────────
const loginModal = document.getElementById('loginmodal');
if (loginModal) {
  loginModal.addEventListener('show.bs.modal', () => {
    hideError();
    form.reset();
    setLoading(false);
    // Reset password visibility
    passwordInput.type = 'password';
    togglePwdIcon.classList.add('fa-eye');
    togglePwdIcon.classList.remove('fa-eye-slash');
  });
}


// ─── Form submit ────────────────────────────────────────────────────────────
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const login    = loginInput.value.trim();
    const password = passwordInput.value;

    // Frontend validation
    if (!login) {
      showError('Ingresa tu usuario o correo electrónico.');
      loginInput.focus();
      return;
    }
    if (!password) {
      showError('Ingresa tu contraseña.');
      passwordInput.focus();
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password })
      });

      let json;
      try {
        json = await res.json();
      } catch {
        throw new Error('No se pudo conectar con el servidor.');
      }

      if (!res.ok || !json.success) {
        // Show server error message
        showError(json.message || 'Credenciales inválidas.');
        setLoading(false);
        return;
      }

      // Login successful — redirect to the admin or user panel
      console.log('[Login] Éxito:', json.message, '→', json.redirect);

      // Brief success feedback before redirect
      btnText.textContent = '¡Bienvenido!';
      submitBtn.style.background = '#16a34a';

      setTimeout(() => {
        window.location.href = json.redirect || '/';
      }, 600);

    } catch (err) {
      console.error('[Login] Error:', err);
      showError(err.message || 'Error de conexión con el servidor.');
      setLoading(false);
    }
  });
}