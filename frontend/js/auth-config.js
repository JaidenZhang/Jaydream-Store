// Development: jalankan frontend dari http://localhost:5500.
// Production: ganti dengan origin API HTTPS milikmu, contoh
// https://api.jaydream.store. Ini contoh, bukan server yang sudah dibuat.
window.JD_AUTH_API = ['localhost', 'https://api.jaydream.store'].includes(location.hostname)
  ? 'https://api.jaydream.store'
  : location.origin;
