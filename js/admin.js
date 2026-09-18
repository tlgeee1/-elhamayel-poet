// ============================================================
// لوحة التحكم: تسجيل الدخول، وإضافة/عرض/حذف القصائد والصور والفيديوهات
// ============================================================

function escapeHtml(str){
  return (str || "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}

function formatDate(ts){
  if(!ts) return "";
  try{
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric' });
  }catch(e){ return ""; }
}

/* ===== تسجيل الدخول / الخروج ===== */

function showLoginError(msg){
  const el = document.getElementById('loginError');
  if(!el) return;
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

function setupAuth(){
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const loginScreen = document.getElementById('loginScreen');
  const dashboard = document.getElementById('dashboard');

  loginBtn.addEventListener('click', async ()=>{
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    showLoginError('');
    if(!email || !password){
      showLoginError('اكتب الإيميل وكلمة المرور.');
      return;
    }
    loginBtn.disabled = true;
    loginBtn.textContent = '...جاري الدخول';
    try{
      await auth.signInWithEmailAndPassword(email, password);
    }catch(e){
      const messages = {
        'auth/unauthorized-domain': 'دومين الموقع ده مش مضاف فى Firebase (Authentication → Settings → Authorized domains).',
        'auth/user-not-found': 'مفيش حساب بالإيميل ده.',
        'auth/wrong-password': 'كلمة المرور غلط.',
        'auth/invalid-credential': 'الإيميل أو كلمة المرور غلط.',
        'auth/invalid-email': 'صيغة الإيميل غلط.',
        'auth/too-many-requests': 'محاولات كتير غلط، استنى شوية وجرب تاني.',
        'auth/network-request-failed': 'فيه مشكلة فى الاتصال بالإنترنت.'
      };
      showLoginError((messages[e.code] || e.message || 'حصل خطأ غير متوقع.') + ` (${e.code || ''})`);
    }finally{
      loginBtn.disabled = false;
      loginBtn.textContent = 'دخول';
    }
  });

  logoutBtn.addEventListener('click', (e)=>{
    e.preventDefault();
    auth.signOut();
  });

  auth.onAuthStateChanged(user=>{
    if(user){
      loginScreen.style.display = 'none';
      dashboard.style.display = 'block';
      loadAllAdminData();
    }else{
      loginScreen.style.display = 'block';
      dashboard.style.display = 'none';
    }
  });
}

/* ===== التبويبات ===== */

function setupTabs(){
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
    });
  });
}

function loadAllAdminData(){
  loadPoemsAdmin();
  loadPhotosAdmin();
  loadVideosAdmin();
}

/* ===== القصائد ===== */

async function loadPoemsAdmin(){
  const list = document.getElementById('poemsAdminList');
  if(!list) return;
  list.innerHTML = '';
  try{
    const snap = await db.collection('poems').orderBy('createdAt','desc').get();
    if(snap.empty){
      list.innerHTML = '<p class="form-note">لسه مفيش قصائد مضافة.</p>';
      return;
    }
    snap.forEach(doc=>{
      const p = doc.data();
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <div>
          <h4>${escapeHtml(p.title)}</h4>
          <div class="snippet">${escapeHtml((p.text||'').slice(0,90))}${(p.text||'').length>90?'…':''}</div>
        </div>
        <div class="item-actions">
          <button class="btn-sm" data-action="edit">تعديل</button>
          <button class="btn-sm danger" data-action="delete">حذف</button>
        </div>
      `;
      row.querySelector('[data-action="edit"]').addEventListener('click', ()=>{
        startEditPoem(doc.id, p);
      });
      row.querySelector('[data-action="delete"]').addEventListener('click', async ()=>{
        if(!confirm('متأكد إنك عايز تحذف القصيدة دي؟')) return;
        await db.collection('poems').doc(doc.id).delete();
        if(editingPoemId === doc.id) cancelEditPoem();
        loadPoemsAdmin();
      });
      list.appendChild(row);
    });
  }catch(e){
    list.innerHTML = '<p class="form-note">حصل خطأ في تحميل القصائد.</p>';
  }
}

let editingPoemId = null;

function startEditPoem(id, p){
  editingPoemId = id;
  document.getElementById('poemTitle').value = p.title || '';
  document.getElementById('poemText').value = p.text || '';
  document.getElementById('poemBg').value = p.bg || '';
  document.getElementById('addPoemBtn').textContent = 'حفظ التعديل';
  document.getElementById('cancelEditBtn').style.display = 'inline-block';
  document.getElementById('poemTitle').scrollIntoView({behavior:'smooth', block:'center'});
}

function cancelEditPoem(){
  editingPoemId = null;
  document.getElementById('poemTitle').value = '';
  document.getElementById('poemText').value = '';
  document.getElementById('poemBg').value = '';
  document.getElementById('addPoemBtn').textContent = 'إضافة القصيدة';
  document.getElementById('cancelEditBtn').style.display = 'none';
}

function setupPoemForm(){
  const btn = document.getElementById('addPoemBtn');
  const cancelBtn = document.getElementById('cancelEditBtn');
  if(!btn) return;

  if(cancelBtn) cancelBtn.addEventListener('click', cancelEditPoem);

  btn.addEventListener('click', async ()=>{
    const title = document.getElementById('poemTitle').value.trim();
    const text = document.getElementById('poemText').value.trim();
    const bg = document.getElementById('poemBg').value;
    if(!title || !text){
      alert('اكتب عنوان القصيدة ونصها الأول.');
      return;
    }
    btn.disabled = true;
    try{
      if(editingPoemId){
        const update = { title, text };
        if(bg) update.bg = bg;
        else update.bg = firebase.firestore.FieldValue.delete();
        await db.collection('poems').doc(editingPoemId).update(update);
        cancelEditPoem();
      }else{
        const data = { title, text, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
        if(bg) data.bg = bg;
        await db.collection('poems').add(data);
        document.getElementById('poemTitle').value = '';
        document.getElementById('poemText').value = '';
        document.getElementById('poemBg').value = '';
      }
      loadPoemsAdmin();
    }catch(e){
      alert('حصل خطأ أثناء الحفظ، حاول تاني.');
    }finally{
      btn.disabled = false;
    }
  });
}

/* ===== استيراد ديوان "قالوا فى الأمثال" دفعة واحدة ===== */

function setupBulkImport(){
  const card = document.getElementById('bulkImportCard');
  const btn = document.getElementById('bulkImportBtn');
  const status = document.getElementById('bulkImportStatus');
  if(!card || typeof DIWAN_IMPORT_DATA === 'undefined') return;

  card.style.display = 'block';
  document.getElementById('bulkCount').textContent = DIWAN_IMPORT_DATA.length;

  btn.addEventListener('click', async ()=>{
    btn.disabled = true;
    let added = 0, skipped = 0, failed = 0;
    for(let i=0;i<DIWAN_IMPORT_DATA.length;i++){
      const p = DIWAN_IMPORT_DATA[i];
      status.textContent = `جارِ الاستيراد... (${i+1}/${DIWAN_IMPORT_DATA.length})`;
      try{
        const existing = await db.collection('poems').where('title','==',p.title).limit(1).get();
        if(!existing.empty){ skipped++; continue; }
        await db.collection('poems').add({
          title: p.title,
          text: p.text,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        added++;
      }catch(e){
        failed++;
      }
    }
    status.textContent = `تم: أُضيف ${added} قصيدة، اتخطى ${skipped} (موجودة بالفعل)${failed?`، فشل ${failed}`:''}.`;
    btn.disabled = false;
    loadPoemsAdmin();
  });
}

/* ===== الصور ===== */

async function loadPhotosAdmin(){
  const list = document.getElementById('photosAdminList');
  if(!list) return;
  list.innerHTML = '';
  try{
    const snap = await db.collection('photos').orderBy('createdAt','desc').get();
    if(snap.empty){
      list.innerHTML = '<p class="form-note">لسه مفيش صور مضافة.</p>';
      return;
    }
    snap.forEach(doc=>{
      const ph = doc.data();
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <div>
          <h4>${escapeHtml(ph.caption || 'بدون وصف')}</h4>
          <div class="snippet">${escapeHtml(ph.url)}</div>
        </div>
        <div class="item-actions">
          <button class="btn-sm" data-action="edit">تعديل</button>
          <button class="btn-sm danger" data-action="delete">حذف</button>
        </div>
      `;
      row.querySelector('[data-action="edit"]').addEventListener('click', ()=>{
        startEditPhoto(doc.id, ph);
      });
      row.querySelector('[data-action="delete"]').addEventListener('click', async ()=>{
        if(!confirm('متأكد إنك عايز تحذف الصورة دي؟')) return;
        await db.collection('photos').doc(doc.id).delete();
        if(editingPhotoId === doc.id) cancelEditPhoto();
        loadPhotosAdmin();
      });
      list.appendChild(row);
    });
  }catch(e){
    list.innerHTML = '<p class="form-note">حصل خطأ في تحميل الصور.</p>';
  }
}

let editingPhotoId = null;

function startEditPhoto(id, ph){
  editingPhotoId = id;
  document.getElementById('photoUrl').value = ph.url || '';
  document.getElementById('photoCaption').value = ph.caption || '';
  document.getElementById('addPhotoBtn').textContent = 'حفظ التعديل';
  document.getElementById('cancelPhotoEditBtn').style.display = 'inline-block';
  document.getElementById('photoUrl').scrollIntoView({behavior:'smooth', block:'center'});
}

function cancelEditPhoto(){
  editingPhotoId = null;
  document.getElementById('photoUrl').value = '';
  document.getElementById('photoCaption').value = '';
  document.getElementById('addPhotoBtn').textContent = 'إضافة الصورة';
  document.getElementById('cancelPhotoEditBtn').style.display = 'none';
}

function setupPhotoForm(){
  const btn = document.getElementById('addPhotoBtn');
  const cancelBtn = document.getElementById('cancelPhotoEditBtn');
  if(!btn) return;

  if(cancelBtn) cancelBtn.addEventListener('click', cancelEditPhoto);

  btn.addEventListener('click', async ()=>{
    const url = document.getElementById('photoUrl').value.trim();
    const caption = document.getElementById('photoCaption').value.trim();
    if(!url){
      alert('حط رابط الصورة الأول.');
      return;
    }
    btn.disabled = true;
    try{
      if(editingPhotoId){
        await db.collection('photos').doc(editingPhotoId).update({ url, caption });
        cancelEditPhoto();
      }else{
        await db.collection('photos').add({
          url, caption, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('photoUrl').value = '';
        document.getElementById('photoCaption').value = '';
      }
      loadPhotosAdmin();
    }catch(e){
      alert('حصل خطأ أثناء الحفظ، حاول تاني.');
    }finally{
      btn.disabled = false;
    }
  });
}

/* ===== الفيديوهات ===== */

async function loadVideosAdmin(){
  const list = document.getElementById('videosAdminList');
  if(!list) return;
  list.innerHTML = '';
  try{
    const snap = await db.collection('videos').orderBy('createdAt','desc').get();
    if(snap.empty){
      list.innerHTML = '<p class="form-note">لسه مفيش فيديوهات مضافة.</p>';
      return;
    }
    snap.forEach(doc=>{
      const v = doc.data();
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <div>
          <h4>${escapeHtml(v.title || 'بدون عنوان')}</h4>
          <div class="snippet">${escapeHtml(v.embedUrl)}</div>
        </div>
        <div class="item-actions">
          <button class="btn-sm" data-action="edit">تعديل</button>
          <button class="btn-sm danger" data-action="delete">حذف</button>
        </div>
      `;
      row.querySelector('[data-action="edit"]').addEventListener('click', ()=>{
        startEditVideo(doc.id, v);
      });
      row.querySelector('[data-action="delete"]').addEventListener('click', async ()=>{
        if(!confirm('متأكد إنك عايز تحذف الفيديو ده؟')) return;
        await db.collection('videos').doc(doc.id).delete();
        if(editingVideoId === doc.id) cancelEditVideo();
        loadVideosAdmin();
      });
      list.appendChild(row);
    });
  }catch(e){
    list.innerHTML = '<p class="form-note">حصل خطأ في تحميل الفيديوهات.</p>';
  }
}

let editingVideoId = null;

function startEditVideo(id, v){
  editingVideoId = id;
  document.getElementById('videoTitle').value = v.title || '';
  document.getElementById('videoUrl').value = v.embedUrl || '';
  document.getElementById('addVideoBtn').textContent = 'حفظ التعديل';
  document.getElementById('cancelVideoEditBtn').style.display = 'inline-block';
  document.getElementById('videoTitle').scrollIntoView({behavior:'smooth', block:'center'});
}

function cancelEditVideo(){
  editingVideoId = null;
  document.getElementById('videoTitle').value = '';
  document.getElementById('videoUrl').value = '';
  document.getElementById('addVideoBtn').textContent = 'إضافة الفيديو';
  document.getElementById('cancelVideoEditBtn').style.display = 'none';
}

function setupVideoForm(){
  const btn = document.getElementById('addVideoBtn');
  const cancelBtn = document.getElementById('cancelVideoEditBtn');
  if(!btn) return;

  if(cancelBtn) cancelBtn.addEventListener('click', cancelEditVideo);

  btn.addEventListener('click', async ()=>{
    const title = document.getElementById('videoTitle').value.trim();
    const embedUrl = document.getElementById('videoUrl').value.trim();
    if(!embedUrl){
      alert('حط رابط التضمين الأول.');
      return;
    }
    btn.disabled = true;
    try{
      if(editingVideoId){
        await db.collection('videos').doc(editingVideoId).update({ title, embedUrl });
        cancelEditVideo();
      }else{
        await db.collection('videos').add({
          title, embedUrl, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('videoTitle').value = '';
        document.getElementById('videoUrl').value = '';
      }
      loadVideosAdmin();
    }catch(e){
      alert('حصل خطأ أثناء الحفظ، حاول تاني.');
    }finally{
      btn.disabled = false;
    }
  });
}

document.addEventListener('DOMContentLoaded', ()=>{
  setupAuth();
  setupTabs();
  setupPoemForm();
  setupBulkImport();
  setupPhotoForm();
  setupVideoForm();
});
