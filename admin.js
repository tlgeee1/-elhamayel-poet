// ============================================================
// لوحة التحكم: تسجيل دخول حقيقي بـ Firebase Auth
// + إدارة كاملة (إضافة/حذف) للقصائد والصور والفيديوهات في Firestore
// ============================================================

const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const loginError = document.getElementById('loginError');

// ---------- تسجيل الدخول ----------
document.getElementById('loginBtn').addEventListener('click', ()=>{
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  loginError.style.display = 'none';

  auth.signInWithEmailAndPassword(email, password)
    .catch(err=>{
      loginError.textContent = 'بيانات الدخول غير صحيحة. تأكد من الإيميل وكلمة المرور.';
      loginError.style.display = 'block';
      console.error(err);
    });
});

document.getElementById('logoutBtn').addEventListener('click', (e)=>{
  e.preventDefault();
  auth.signOut();
});

auth.onAuthStateChanged(user=>{
  if(user){
    loginScreen.style.display = 'none';
    dashboard.style.display = 'block';
    loadPoemsAdmin();
    loadPhotosAdmin();
    loadVideosAdmin();
  } else {
    loginScreen.style.display = 'block';
    dashboard.style.display = 'none';
  }
});

// ---------- تبديل التبويبات ----------
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-'+btn.dataset.tab).classList.add('active');
  });
});

function escapeHtml(str){
  return (str || "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}

// ================= القصائد =================
document.getElementById('addPoemBtn').addEventListener('click', async ()=>{
  const title = document.getElementById('poemTitle').value.trim();
  const text = document.getElementById('poemText').value.trim();
  if(!title || !text) return alert('اكتب العنوان والنص أولاً.');

  await db.collection('poems').add({
    title, text,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  document.getElementById('poemTitle').value = '';
  document.getElementById('poemText').value = '';
  loadPoemsAdmin();
});

async function loadPoemsAdmin(){
  const el = document.getElementById('poemsAdminList');
  el.innerHTML = 'جارٍ التحميل...';
  const snap = await db.collection('poems').orderBy('createdAt','desc').get();
  if(snap.empty){ el.innerHTML = '<p class="form-note">لا توجد قصائد مضافة بعد.</p>'; return; }

  el.innerHTML = '';
  snap.forEach(doc=>{
    const p = doc.data();
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <div>
        <h4>${escapeHtml(p.title)}</h4>
        <div class="snippet">${escapeHtml((p.text||'').slice(0,90))}…</div>
      </div>
      <div class="item-actions">
        <button class="btn-sm danger" data-id="${doc.id}">حذف</button>
      </div>
    `;
    row.querySelector('.danger').addEventListener('click', async ()=>{
      if(confirm('تأكيد حذف القصيدة؟')){
        await db.collection('poems').doc(doc.id).delete();
        loadPoemsAdmin();
      }
    });
    el.appendChild(row);
  });
}

// ================= الصور =================
document.getElementById('addPhotoBtn').addEventListener('click', async ()=>{
  const url = document.getElementById('photoUrl').value.trim();
  const caption = document.getElementById('photoCaption').value.trim();
  if(!url) return alert('حط رابط الصورة أولاً.');

  await db.collection('photos').add({
    url, caption,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  document.getElementById('photoUrl').value = '';
  document.getElementById('photoCaption').value = '';
  loadPhotosAdmin();
});

async function loadPhotosAdmin(){
  const el = document.getElementById('photosAdminList');
  el.innerHTML = 'جارٍ التحميل...';
  const snap = await db.collection('photos').orderBy('createdAt','desc').get();
  if(snap.empty){ el.innerHTML = '<p class="form-note">لا توجد صور مضافة بعد.</p>'; return; }

  el.innerHTML = '';
  snap.forEach(doc=>{
    const p = doc.data();
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <div><h4>${escapeHtml(p.caption || 'بدون وصف')}</h4><div class="snippet">${escapeHtml(p.url)}</div></div>
      <div class="item-actions"><button class="btn-sm danger" data-id="${doc.id}">حذف</button></div>
    `;
    row.querySelector('.danger').addEventListener('click', async ()=>{
      if(confirm('تأكيد حذف الصورة؟')){
        await db.collection('photos').doc(doc.id).delete();
        loadPhotosAdmin();
      }
    });
    el.appendChild(row);
  });
}

// ================= الفيديوهات =================
document.getElementById('addVideoBtn').addEventListener('click', async ()=>{
  const title = document.getElementById('videoTitle').value.trim();
  const embedUrl = document.getElementById('videoUrl').value.trim();
  if(!title || !embedUrl) return alert('اكتب العنوان والرابط أولاً.');

  await db.collection('videos').add({
    title, embedUrl,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  document.getElementById('videoTitle').value = '';
  document.getElementById('videoUrl').value = '';
  loadVideosAdmin();
});

async function loadVideosAdmin(){
  const el = document.getElementById('videosAdminList');
  el.innerHTML = 'جارٍ التحميل...';
  const snap = await db.collection('videos').orderBy('createdAt','desc').get();
  if(snap.empty){ el.innerHTML = '<p class="form-note">لا توجد فيديوهات مضافة بعد.</p>'; return; }

  el.innerHTML = '';
  snap.forEach(doc=>{
    const v = doc.data();
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <div><h4>${escapeHtml(v.title)}</h4><div class="snippet">${escapeHtml(v.embedUrl)}</div></div>
      <div class="item-actions"><button class="btn-sm danger" data-id="${doc.id}">حذف</button></div>
    `;
    row.querySelector('.danger').addEventListener('click', async ()=>{
      if(confirm('تأكيد حذف الفيديو؟')){
        await db.collection('videos').doc(doc.id).delete();
        loadVideosAdmin();
      }
    });
    el.appendChild(row);
  });
}
