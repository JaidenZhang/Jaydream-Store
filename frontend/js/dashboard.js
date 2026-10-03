async function loadAccount(){
 const panel=document.getElementById('account-panel'), status=document.getElementById('account-status');
 panel.hidden=true;status.textContent='Memeriksa sesi...';
 try{const {user}=await JDAuth.me();document.getElementById('username').textContent=user.username;panel.hidden=false;status.textContent='';}
 catch(e){if(e.status===401)location.replace('login.html');else status.textContent='Koneksi gagal. Muat ulang untuk mencoba lagi.';}
}
async function logout(){try{await JDAuth.logout();localStorage.removeItem('user');location.replace('login.html');}catch(e){if(e.status===401)location.replace('login.html');else document.getElementById('account-status').textContent=e.message;}}
window.addEventListener('pageshow',loadAccount);
