// Development: jalankan frontend dari http://localhost:5500.
// Production: ganti dengan origin API HTTPS milikmu, contoh
// https://api.jaydream.store. Ini contoh, bukan server yang sudah dibuat.
window.JD_AUTH_API = ['localhost', '127.0.0.1'].includes(location.hostname)
  ? 'http://localhost:5000'
  : location.origin;
