document.getElementById('contact-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button');
    const status = document.getElementById('contact-status');
    
    if (!form.reportValidity() || button.disabled) return;
    
    button.disabled = true;
    status.textContent = 'Mengirim pesan...';
    status.style.color = 'var(--text)';
    
    // Ambil data dari form
    const formData = new FormData(form);
    const data = {
        name: formData.get('name'),
        email: formData.get('email'),
        subject: formData.get('subject'),
        message: formData.get('message')
    };

    // TODO: GANTI URL INI DENGAN URL WEB APP GOOGLE APPS SCRIPT KAMU
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbycO-ZqWUKI5EFkGo0WjXqCEIWOLUHLAFhGmr7T40JIzuzD0lzN_L9uBB60J_7kFAeoSQ/exec";

    try {
        if (SCRIPT_URL === "PASTE_URL_WEB_APP_GOOGLE_SCRIPT_CONTACT_DI_SINI") {
            throw new Error("URL Google Apps Script belum dimasukkan di contact.js!");
        }

        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            // Gunakan text/plain agar tidak terkena block CORS Preflight dari browser
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(data)
        });
        
        const result = await res.json();
        
        if (result.status === "success") {
            status.textContent = 'Pesan berhasil terkirim ke JaydreamStore! Terima kasih.';
            status.style.color = '#27ae60'; // Hijau sukses
            form.reset();
        } else {
            throw new Error(result.message || 'Server gagal merespon.');
        }
    } catch (e) {
        status.textContent = 'Gagal: ' + e.message;
        status.style.color = '#e74c3c'; // Merah error
    } finally {
        button.disabled = false;
    }
});
