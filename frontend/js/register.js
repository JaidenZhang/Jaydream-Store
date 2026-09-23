document.getElementById('account-form').addEventListener('submit', async event => {
 event.preventDefault();
 const form=event.currentTarget, button=form.querySelector('button');
 if(!form.reportValidity() || button.disabled)return;
 button.disabled=true;
 const status=document.getElementById('account-status');
 status.textContent='Memproses...';
 try {
  await JDAuth.register(Object.fromEntries(new FormData(form)));
  localStorage.removeItem('user');
  location.replace('login.html?registered=1');
 } catch(error){status.textContent=error.message;} finally{button.disabled=false;}
});
if(new URLSearchParams(location.search).get('registered'))document.getElementById('account-status').textContent='Akun berhasil dibuat. Silakan login.';
