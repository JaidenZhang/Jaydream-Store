(() => {
  'use strict';
  let csrf = '';
  const base = window.JD_AUTH_API ? window.JD_AUTH_API.replace(/\/$/, '') : '';
  async function request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(base + path, {
        ...options, credentials: 'include', signal: controller.signal,
        headers: { 'Content-Type': 'application/json',
          ...(csrf ? {'X-CSRF-TOKEN': csrf} : {}), ...options.headers },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        const error = new Error(data.message || 'Server tidak dapat memproses permintaan.');
        error.status = response.status;
        throw error;
      }
      if (data.csrf_token) csrf = data.csrf_token;
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Koneksi terlalu lama. Coba lagi.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  window.JDAuth = {
    me: () => request('/me'),
    login: data => request('/login', {method: 'POST', body: JSON.stringify(data)}),
    register: data => request('/register', {method: 'POST', body: JSON.stringify(data)}),
    logout: async () => {
      if (!csrf) await request('/me');
      await request('/logout', {method: 'POST', body: '{}'});
      csrf = '';
    },
  };

  // GLOBAL NAVBAR AUTH CHECKER
  document.addEventListener('DOMContentLoaded', () => {
      const authBtn = document.getElementById('nav-auth-btn');
      if (authBtn) {
          JDAuth.me().then(res => {
              if (res && res.user) {
                  authBtn.textContent = 'Dashboard';
                  authBtn.onclick = () => { window.location.href = 'dashboard.html'; };
              }
          }).catch(() => {
              authBtn.textContent = 'Login';
              authBtn.onclick = () => { window.location.href = 'login.html'; };
          });
      }
  });
})();
