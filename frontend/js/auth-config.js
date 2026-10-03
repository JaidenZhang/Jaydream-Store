// Development: jalankan frontend dari http://localhost:5500.
// Production: langsung arahkan ke origin API HTTPS Railway milikmu
window.JD_AUTH_API = ['localhost', '127.0.0.1'].includes(location.hostname)
  ? 'https://localhost:5000'           // URL Backend saat tes di komputer lokal
  : 'https://api.jaydream.store';     // URL Backend Railway kamu saat di-deploy
