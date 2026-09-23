document.getElementById('contact-form').addEventListener('submit',async event=>{
 event.preventDefault();const form=event.currentTarget,button=form.querySelector('button'),status=document.getElementById('contact-status');
 if(!form.reportValidity()||button.disabled)return;button.disabled=true;status.textContent='Mengirim...';
 try{const res=await fetch(window.JD_AUTH_API.replace(/\/$/,'')+'/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});const data=await res.json();if(!res.ok||!data.success)throw Error(data.message||'Pengiriman gagal.');status.textContent=data.message;form.reset();}catch(e){status.textContent='Pesan belum terkirim. '+e.message;}finally{button.disabled=false;}
});
