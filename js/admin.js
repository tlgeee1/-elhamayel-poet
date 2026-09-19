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
  loadPressAdmin();
}

/* ===== القصائد ===== */

// بيملأ قائمة الاقتراحات (datalist) بأسماء الدواوين الموجودة فعليًا، عشان وقت
// ما تكتب اسم ديوان قديم يقترحه عليك تلقائي بدل ما تكتبه غلط بمسافة زيادة مثلًا
function updateDiwanDatalist(diwanNames){
  const datalist = document.getElementById('diwanList');
  if(!datalist) return;
  const unique = [...new Set(diwanNames.filter(Boolean))];
  datalist.innerHTML = unique.map(d => `<option value="${escapeHtml(d)}"></option>`).join('');
}

async function loadPoemsAdmin(){
  const list = document.getElementById('poemsAdminList');
  if(!list) return;
  list.innerHTML = '';
  try{
    const snap = await db.collection('poems').orderBy('createdAt','desc').get();
    if(snap.empty){
      list.innerHTML = '<p class="form-note">لسه مفيش قصائد مضافة.</p>';
      updateDiwanDatalist([]);
      return;
    }

    // تجميع القصائد حسب "الديوان" — القصيدة اللي من غير ديوان بتتحط في مجموعة منفصلة
    const UNSORTED = 'قصائد بدون ديوان';
    const groups = {};
    const order = [];
    snap.forEach(doc=>{
      const p = doc.data();
      const diwan = (p.diwan || '').trim() || UNSORTED;
      if(!groups[diwan]){ groups[diwan] = []; order.push(diwan); }
      groups[diwan].push({ id: doc.id, data: p });
    });

    updateDiwanDatalist(order.filter(d => d !== UNSORTED));

    order.forEach(diwanName=>{
      const section = document.createElement('div');
      section.className = 'diwan-group';
      section.style.marginBottom = '18px';
      section.innerHTML = `<h3 class="diwan-title" style="margin:0 0 8px;">${escapeHtml(diwanName)} <span class="form-note" style="display:inline;">(${groups[diwanName].length})</span></h3>`;

      groups[diwanName].forEach(({id, data:p})=>{
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
          startEditPoem(id, p);
        });
        row.querySelector('[data-action="delete"]').addEventListener('click', async ()=>{
          if(!confirm('متأكد إنك عايز تحذف القصيدة دي؟')) return;
          await db.collection('poems').doc(id).delete();
          if(editingPoemId === id) cancelEditPoem();
          loadPoemsAdmin();
        });
        section.appendChild(row);
      });

      list.appendChild(section);
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
  document.getElementById('poemDiwan').value = p.diwan || '';
  document.getElementById('addPoemBtn').textContent = 'حفظ التعديل';
  document.getElementById('cancelEditBtn').style.display = 'inline-block';
  document.getElementById('poemTitle').scrollIntoView({behavior:'smooth', block:'center'});
}

function cancelEditPoem(){
  editingPoemId = null;
  document.getElementById('poemTitle').value = '';
  document.getElementById('poemText').value = '';
  document.getElementById('poemBg').value = '';
  document.getElementById('poemDiwan').value = '';
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
    const diwan = document.getElementById('poemDiwan').value.trim();
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
        if(diwan) update.diwan = diwan;
        else update.diwan = firebase.firestore.FieldValue.delete();
        await db.collection('poems').doc(editingPoemId).update(update);
        cancelEditPoem();
      }else{
        const data = { title, text, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
        if(bg) data.bg = bg;
        if(diwan) data.diwan = diwan;
        await db.collection('poems').add(data);
        document.getElementById('poemTitle').value = '';
        document.getElementById('poemText').value = '';
        document.getElementById('poemBg').value = '';
        document.getElementById('poemDiwan').value = '';
      }
      loadPoemsAdmin();
    }catch(e){
      alert('حصل خطأ أثناء الحفظ، حاول تاني.');
    }finally{
      btn.disabled = false;
    }
  });
}

/* ===== استيراد ديوان (أو أكتر) دفعة واحدة ===== */
// كل ديوان بيتم استيراده بيتحط ليه اسم ثابت في حقل diwan، عشان القصايد بتاعته
// تتجمع مع بعض وتفضل متفرقة عن أي ديوان تاني.
//
// عشان تضيف ديوان جديد للاستيراد بالجملة، اعمل ملف زي js/diwan-data-2.js بالشكل ده:
//
//   window.DIWAN_IMPORTS = window.DIWAN_IMPORTS || [];
//   window.DIWAN_IMPORTS.push({
//     name: "اسم الديوان الجديد",
//     data: [
//       { title: "عنوان القصيدة الأولى", text: "نص القصيدة..." },
//       { title: "عنوان القصيدة التانية", text: "نص القصيدة..." }
//     ]
//   });
//
// وضيف سطر <script src="js/diwan-data-2.js"></script> في admin.html قبل سطر admin.js.
// هيظهرلك أوتوماتيك زرار استيراد جديد بعنوان الديوان ده، من غير أي تعديل تاني في الكود.
// (الديوان القديم "قالوا فى الأمثال" لسه شغال زي ما هو من غير أي تغيير.)

function setupBulkImport(){
  const container = document.getElementById('bulkImportContainer');
  if(!container) return;

  const imports = [];

  // الطريقة القديمة: ديوان واحد ثابت معرّف في js/diwan-data.js
  if(typeof DIWAN_IMPORT_DATA !== 'undefined' && DIWAN_IMPORT_DATA.length){
    imports.push({
      name: (typeof DIWAN_IMPORT_NAME !== 'undefined' && DIWAN_IMPORT_NAME) || 'قالوا فى الأمثال',
      data: DIWAN_IMPORT_DATA
    });
  }

  // الطريقة الجديدة: أي عدد من الدواوين معرّفة في window.DIWAN_IMPORTS
  if(typeof window.DIWAN_IMPORTS !== 'undefined'){
    window.DIWAN_IMPORTS.forEach(item=>{
      if(item && item.name && Array.isArray(item.data) && item.data.length){
        imports.push(item);
      }
    });
  }

  if(imports.length === 0) return;

  imports.forEach(imp=>{
    const card = document.createElement('div');
    card.className = 'admin-card';
    card.innerHTML = `
      <h4 style="font-family:'Amiri', serif;font-size:18px;margin-bottom:8px;">استيراد ديوان "${escapeHtml(imp.name)}" دفعة واحدة</h4>
      <p class="form-note" style="margin-top:0;">هيضيف كل القصائد اللي جوه الديوان (${imp.data.length} قصيدة) لأرشيف الموقع. آمن تدوس عليه أكتر من مرة، مش هيكرر أي قصيدة موجودة بالفعل.</p>
      <button class="btn-outline" style="cursor:pointer;background:none;font-family:inherit;">استيراد الديوان الآن</button>
      <p class="form-note"></p>
    `;
    const btn = card.querySelector('button');
    const status = card.querySelector('p.form-note:last-child');

    btn.addEventListener('click', async ()=>{
      btn.disabled = true;
      let added = 0, skipped = 0, failed = 0;
      for(let i=0;i<imp.data.length;i++){
        const p = imp.data[i];
        status.textContent = `جارِ الاستيراد... (${i+1}/${imp.data.length})`;
        try{
          const existing = await db.collection('poems').where('title','==',p.title).limit(1).get();
          if(!existing.empty){ skipped++; continue; }
          await db.collection('poems').add({
            title: p.title,
            text: p.text,
            diwan: imp.name,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          added++;
        }catch(e){
          failed++;
        }
      }
      status.textContent = `تم: أُضيف ${added} قصيدة إلى ديوان "${imp.name}"، اتخطى ${skipped} (موجودة بالفعل)${failed?`، فشل ${failed}`:''}.`;
      btn.disabled = false;
      loadPoemsAdmin();
    });

    container.appendChild(card);
  });
}

/* ===== استيراد جماعي عن طريق لصق نص ===== */
// بيدعم شكلين للنص الملصوق:
// 1) الشكل التلقائي (المفضّل): تلزق الديوان زي ما هو من الوورد، وكل عنوان قصيدة
//    مكتوب بين علامتي تنصيص فى أول سطره (زي " آخد ابن عمى ") — بيتعرف عليه لوحده
//    من غير أي تعديل يدوي.
// 2) لو مفيش علامات تنصيص على العناوين، بيرجع للفصل اليدوي: سطر لوحده فيه ===
//    بين كل قصيدة والتانية، وأول سطر بعد الفاصل بيبقى هو العنوان.
const QUOTE_CHARS = '"\u201c\u201d\u00ab\u00bb';

function isQuotedTitleLine(line){
  const t = line.trim();
  return t.length > 0 && t.length < 120 && QUOTE_CHARS.includes(t[0]);
}

function stripQuotes(line){
  let t = line.trim();
  while(t.length && QUOTE_CHARS.includes(t[0])) t = t.slice(1).trim();
  while(t.length && QUOTE_CHARS.includes(t[t.length-1])) t = t.slice(0,-1).trim();
  return t;
}

function parseByQuotedTitles(lines){
  const idx = [];
  lines.forEach((l,i)=>{ if(isQuotedTitleLine(l)) idx.push(i); });
  if(idx.length < 1) return [];
  const poems = [];
  idx.forEach((start,n)=>{
    const end = n+1 < idx.length ? idx[n+1] : lines.length;
    const title = stripQuotes(lines[start]);
    const bodyLines = lines.slice(start+1, end).map(l=>l.trim()).filter(l=>l && !/^\.{3,}$/.test(l));
    const text = bodyLines.join('\n').trim();
    if(title && text) poems.push({ title, text });
  });
  return poems;
}

function parseBySeparator(lines){
  const raw = lines.join('\n');
  const blocks = raw.split(/^[ \t]*={3,}[ \t]*$/m);
  const poems = [];
  blocks.forEach(block=>{
    const blines = block.split('\n').map(l=>l.trim());
    let i = 0;
    while(i < blines.length && blines[i] === '') i++;
    if(i >= blines.length) return;
    const title = blines[i];
    const bodyLines = blines.slice(i+1);
    while(bodyLines.length && bodyLines[0] === '') bodyLines.shift();
    while(bodyLines.length && bodyLines[bodyLines.length-1] === '') bodyLines.pop();
    const text = bodyLines.join('\n').trim();
    if(title && text) poems.push({ title, text });
  });
  return poems;
}

function parsePastedDiwan(raw){
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const quotedTitles = lines.filter(isQuotedTitleLine).length;
  // لو فيه سطرين أو أكتر شكلهم عنوان بين علامتي تنصيص، نعتبرها الطريقة المستخدمة
  if(quotedTitles >= 2){
    return parseByQuotedTitles(lines);
  }
  return parseBySeparator(lines);
}

function setupPasteImport(){
  const btn = document.getElementById('pasteImportBtn');
  const diwanInput = document.getElementById('pasteImportDiwan');
  const textArea = document.getElementById('pasteImportText');
  const preview = document.getElementById('pasteImportPreview');
  const status = document.getElementById('pasteImportStatus');
  if(!btn) return;

  textArea.addEventListener('input', ()=>{
    const poems = parsePastedDiwan(textArea.value);
    preview.textContent = poems.length
      ? `هيتم التعرف على ${poems.length} قصيدة${poems.length===1?'':''}: ${poems.slice(0,3).map(p=>p.title).join('، ')}${poems.length>3?' ...':''}`
      : '';
  });

  btn.addEventListener('click', async ()=>{
    const diwan = diwanInput.value.trim();
    const poems = parsePastedDiwan(textArea.value);
    if(!diwan){
      alert('اكتب اسم الديوان الأول.');
      return;
    }
    if(poems.length === 0){
      alert('محدّش لقيت قصائد في النص. تأكد إنك حاطط سطر === لوحده بين كل قصيدة والتانية.');
      return;
    }
    if(!confirm(`هيتم استيراد ${poems.length} قصيدة لديوان "${diwan}". متأكد؟`)) return;

    btn.disabled = true;
    let added = 0, skipped = 0, failed = 0;
    for(let i=0;i<poems.length;i++){
      const p = poems[i];
      status.textContent = `جارِ الاستيراد... (${i+1}/${poems.length})`;
      try{
        const existing = await db.collection('poems').where('title','==',p.title).limit(1).get();
        if(!existing.empty){ skipped++; continue; }
        await db.collection('poems').add({
          title: p.title,
          text: p.text,
          diwan: diwan,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        added++;
      }catch(e){
        failed++;
      }
    }
    status.textContent = `تم: أُضيف ${added} قصيدة إلى ديوان "${diwan}"، اتخطى ${skipped} (موجودة بالفعل)${failed?`، فشل ${failed}`:''}.`;
    btn.disabled = false;
    if(added > 0){
      textArea.value = '';
      preview.textContent = '';
    }
    loadPoemsAdmin();
  });
}

/* ===== صورة الشاعر الرئيسية (Hero) ===== */
/* بتتخزن في مستند إعدادات واحد ثابت: settings/profile، حقل heroImage */

function setupHeroPhotoForm(){
  const fileInput = document.getElementById('heroPhotoFile');
  const preview = document.getElementById('heroPhotoPreview');
  const status = document.getElementById('heroPhotoStatus');
  const btn = document.getElementById('saveHeroPhotoBtn');
  if(!btn) return;

  let pendingImage = null;

  db.collection('settings').doc('profile').get().then(doc=>{
    if(doc.exists && doc.data().heroImage){
      preview.src = doc.data().heroImage;
      preview.style.display = 'block';
      status.textContent = 'دي صورة الشاعر الحالية — اختر صورة جديدة بس لو عايز تستبدلها.';
    }
  }).catch(()=>{});

  fileInput.addEventListener('change', async ()=>{
    const file = fileInput.files[0];
    pendingImage = null;
    if(!file) return;
    if(file.size > 15 * 1024 * 1024){
      status.textContent = 'الصورة كبيرة أوي، اختر صورة أصغر.';
      return;
    }
    status.textContent = 'جاري تجهيز الصورة...';
    try{
      pendingImage = await compressImage(file);
      preview.src = pendingImage;
      preview.style.display = 'block';
      const kb = Math.round(pendingImage.length * 0.75 / 1024);
      status.textContent = `الصورة جاهزة (${kb} كيلوبايت تقريبًا).`;
    }catch(e){
      status.textContent = 'حصل خطأ في قراءة الصورة، جرّب صورة تانية.';
    }
  });

  btn.addEventListener('click', async ()=>{
    if(!pendingImage){
      alert('اختار صورة جديدة الأول.');
      return;
    }
    if(pendingImage.length > 900000){
      alert('الصورة لسه كبيرة شوية بعد الضغط، جرّب صورة تانية.');
      return;
    }
    btn.disabled = true;
    try{
      await db.collection('settings').doc('profile').set({ heroImage: pendingImage }, { merge: true });
      status.textContent = 'تم حفظ صورة الشاعر ✅';
      fileInput.value = '';
      pendingImage = null;
    }catch(e){
      alert('حصل خطأ أثناء الحفظ، حاول تاني.');
    }finally{
      btn.disabled = false;
    }
  });
}

/* ===== عن الشاعر والتواصل ===== */

function setupProfileForm(){
  const btn = document.getElementById('saveProfileBtn');
  const status = document.getElementById('profileStatus');
  if(!btn) return;

  db.collection('settings').doc('profile').get().then(doc=>{
    if(!doc.exists) return;
    const d = doc.data();
    if(d.aboutText) document.getElementById('aboutText').value = d.aboutText;
    if(d.contactEmail) document.getElementById('contactEmail').value = d.contactEmail;
    if(d.contactPhone) document.getElementById('contactPhone').value = d.contactPhone;
    if(d.contactNote) document.getElementById('contactNote').value = d.contactNote;
  }).catch(()=>{});

  btn.addEventListener('click', async ()=>{
    const aboutText = document.getElementById('aboutText').value.trim();
    const contactEmail = document.getElementById('contactEmail').value.trim();
    const contactPhone = document.getElementById('contactPhone').value.trim();
    const contactNote = document.getElementById('contactNote').value.trim();

    btn.disabled = true;
    status.textContent = 'جاري الحفظ...';
    try{
      await db.collection('settings').doc('profile').set({
        aboutText, contactEmail, contactPhone, contactNote
      }, { merge: true });
      status.textContent = 'تم الحفظ ✅';
    }catch(e){
      status.textContent = '';
      alert('حصل خطأ أثناء الحفظ، حاول تاني.');
    }finally{
      btn.disabled = false;
    }
  });
}

/* ===== الصحافة ===== */

async function loadPressAdmin(){
  const list = document.getElementById('pressAdminList');
  if(!list) return;
  list.innerHTML = '';
  try{
    const snap = await db.collection('press').orderBy('createdAt','desc').get();
    if(snap.empty){
      list.innerHTML = '<p class="form-note">لسه مفيش مقالات مضافة.</p>';
      return;
    }
    snap.forEach(doc=>{
      const p = doc.data();
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <div>
          <h4>${escapeHtml(p.title || 'بدون عنوان')}</h4>
          <div class="snippet">${escapeHtml(p.source || '')} — ${escapeHtml(p.url)}</div>
        </div>
        <div class="item-actions">
          <button class="btn-sm" data-action="edit">تعديل</button>
          <button class="btn-sm danger" data-action="delete">حذف</button>
        </div>
      `;
      row.querySelector('[data-action="edit"]').addEventListener('click', ()=>{
        startEditPress(doc.id, p);
      });
      row.querySelector('[data-action="delete"]').addEventListener('click', async ()=>{
        if(!confirm('متأكد إنك عايز تحذف المقال ده؟')) return;
        await db.collection('press').doc(doc.id).delete();
        if(editingPressId === doc.id) cancelEditPress();
        loadPressAdmin();
      });
      list.appendChild(row);
    });
  }catch(e){
    list.innerHTML = '<p class="form-note">حصل خطأ في تحميل المقالات.</p>';
  }
}

let editingPressId = null;

function startEditPress(id, p){
  editingPressId = id;
  document.getElementById('pressTitle').value = p.title || '';
  document.getElementById('pressSource').value = p.source || '';
  document.getElementById('pressUrl').value = p.url || '';
  document.getElementById('addPressBtn').textContent = 'حفظ التعديل';
  document.getElementById('cancelPressEditBtn').style.display = 'inline-block';
  document.getElementById('pressTitle').scrollIntoView({behavior:'smooth', block:'center'});
}

function cancelEditPress(){
  editingPressId = null;
  document.getElementById('pressTitle').value = '';
  document.getElementById('pressSource').value = '';
  document.getElementById('pressUrl').value = '';
  document.getElementById('addPressBtn').textContent = 'إضافة المقال';
  document.getElementById('cancelPressEditBtn').style.display = 'none';
}

function setupPressForm(){
  const btn = document.getElementById('addPressBtn');
  const cancelBtn = document.getElementById('cancelPressEditBtn');
  if(!btn) return;

  if(cancelBtn) cancelBtn.addEventListener('click', cancelEditPress);

  btn.addEventListener('click', async ()=>{
    const title = document.getElementById('pressTitle').value.trim();
    const source = document.getElementById('pressSource').value.trim();
    const url = document.getElementById('pressUrl').value.trim();
    if(!title || !url){
      alert('اكتب عنوان المقال والرابط الأول.');
      return;
    }
    btn.disabled = true;
    try{
      if(editingPressId){
        await db.collection('press').doc(editingPressId).update({ title, source, url });
        cancelEditPress();
      }else{
        await db.collection('press').add({
          title, source, url, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('pressTitle').value = '';
        document.getElementById('pressSource').value = '';
        document.getElementById('pressUrl').value = '';
      }
      loadPressAdmin();
    }catch(e){
      alert('حصل خطأ أثناء الحفظ، حاول تاني.');
    }finally{
      btn.disabled = false;
    }
  });
}

/* ===== الصور ===== */

function compressImage(file, maxWidth = 1200, quality = 0.75){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = e=>{
      const img = new Image();
      img.onload = ()=>{
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = ()=>reject(new Error('تعذّرت قراءة الصورة'));
      img.src = e.target.result;
    };
    reader.onerror = ()=>reject(new Error('تعذّرت قراءة الملف'));
    reader.readAsDataURL(file);
  });
}

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
        <div style="display:flex;align-items:center;gap:12px;">
          <img src="${escapeHtml(ph.url)}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:8px;flex-shrink:0;">
          <h4 style="margin:0;">${escapeHtml(ph.caption || 'بدون وصف')}</h4>
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
  document.getElementById('photoExistingUrl').value = ph.url || '';
  document.getElementById('photoCaption').value = ph.caption || '';
  document.getElementById('photoFile').value = '';
  const preview = document.getElementById('photoPreview');
  if(ph.url){ preview.src = ph.url; preview.style.display = 'block'; }
  document.getElementById('photoStatus').textContent = 'الصورة الحالية معروضة فوق — اختر صورة جديدة بس لو عايز تستبدلها.';
  document.getElementById('addPhotoBtn').textContent = 'حفظ التعديل';
  document.getElementById('cancelPhotoEditBtn').style.display = 'inline-block';
  document.getElementById('photoFile').scrollIntoView({behavior:'smooth', block:'center'});
}

function cancelEditPhoto(){
  editingPhotoId = null;
  document.getElementById('photoFile').value = '';
  document.getElementById('photoExistingUrl').value = '';
  document.getElementById('photoCaption').value = '';
  document.getElementById('photoStatus').textContent = '';
  document.getElementById('photoPreview').style.display = 'none';
  document.getElementById('addPhotoBtn').textContent = 'إضافة الصورة';
  document.getElementById('cancelPhotoEditBtn').style.display = 'none';
}

function setupPhotoForm(){
  const btn = document.getElementById('addPhotoBtn');
  const cancelBtn = document.getElementById('cancelPhotoEditBtn');
  const fileInput = document.getElementById('photoFile');
  const preview = document.getElementById('photoPreview');
  const status = document.getElementById('photoStatus');
  if(!btn) return;

  let pendingImage = null;

  fileInput.addEventListener('change', async ()=>{
    const file = fileInput.files[0];
    pendingImage = null;
    if(!file) return;
    if(file.size > 15 * 1024 * 1024){
      status.textContent = 'الصورة كبيرة أوي، اختر صورة أصغر.';
      return;
    }
    status.textContent = 'جاري تجهيز الصورة...';
    try{
      pendingImage = await compressImage(file);
      preview.src = pendingImage;
      preview.style.display = 'block';
      const kb = Math.round(pendingImage.length * 0.75 / 1024);
      status.textContent = `الصورة جاهزة (${kb} كيلوبايت تقريبًا).`;
    }catch(e){
      status.textContent = 'حصل خطأ في قراءة الصورة، جرّب صورة تانية.';
    }
  });

  if(cancelBtn) cancelBtn.addEventListener('click', ()=>{
    pendingImage = null;
    cancelEditPhoto();
  });

  btn.addEventListener('click', async ()=>{
    const caption = document.getElementById('photoCaption').value.trim();
    const existingUrl = document.getElementById('photoExistingUrl').value;
    const finalUrl = pendingImage || existingUrl;

    if(!finalUrl){
      alert('اختار صورة الأول.');
      return;
    }
    if(finalUrl.length > 900000){
      alert('الصورة لسه كبيرة شوية بعد الضغط، جرّب صورة تانية أو صورة بدقة أقل.');
      return;
    }

    btn.disabled = true;
    try{
      if(editingPhotoId){
        await db.collection('photos').doc(editingPhotoId).update({ url: finalUrl, caption });
        cancelEditPhoto();
      }else{
        await db.collection('photos').add({
          url: finalUrl, caption, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        fileInput.value = '';
        document.getElementById('photoCaption').value = '';
        preview.style.display = 'none';
        status.textContent = '';
        pendingImage = null;
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

const CLOUDINARY_CLOUD_NAME = 'qtsozhce';
const CLOUDINARY_UPLOAD_PRESET = 'elhamayel_videos';

function toEmbedUrl(link){
  if(!link) return null;
  const m = link.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/);
  if(m) return `https://www.youtube.com/embed/${m[1]}`;
  return null;
}

function uploadVideoToCloudinary(file, onProgress){
  return new Promise((resolve, reject)=>{
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.upload.onprogress = (e)=>{
      if(e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = ()=>{
      try{
        const data = JSON.parse(xhr.responseText);
        if(xhr.status >= 200 && xhr.status < 300 && data.secure_url){
          resolve(data.secure_url);
        }else{
          reject(new Error(data.error?.message || 'فشل الرفع'));
        }
      }catch(e){
        reject(new Error('استجابة غير متوقعة من سيرفر الرفع'));
      }
    };
    xhr.onerror = ()=> reject(new Error('فشل الاتصال بسيرفر الرفع'));
    xhr.send(formData);
  });
}

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
      const isUpload = v.type === 'upload';
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <div>
          <h4>${escapeHtml(v.title || 'بدون عنوان')} ${isUpload ? '<span class="form-note" style="display:inline;">(فيديو مرفوع)</span>' : '<span class="form-note" style="display:inline;">(يوتيوب)</span>'}</h4>
          <div class="snippet">${escapeHtml(isUpload ? v.fileUrl : v.embedUrl)}</div>
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
        if(editingVideoFileId === doc.id) cancelEditVideoFile();
        loadVideosAdmin();
      });
      list.appendChild(row);
    });
  }catch(e){
    list.innerHTML = '<p class="form-note">حصل خطأ في تحميل الفيديوهات.</p>';
  }
}

let editingVideoId = null;
let editingVideoFileId = null;

function startEditVideo(id, v){
  if(v.type === 'upload'){
    startEditVideoFile(id, v);
    return;
  }
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
    const rawLink = document.getElementById('videoUrl').value.trim();
    if(!rawLink){
      alert('حط رابط الفيديو الأول.');
      return;
    }
    const embedUrl = toEmbedUrl(rawLink);
    if(!embedUrl){
      alert('الرابط ده مش لينك يوتيوب معروف، جرّب تنسخه تاني من يوتيوب.');
      return;
    }
    btn.disabled = true;
    try{
      if(editingVideoId){
        await db.collection('videos').doc(editingVideoId).update({ title, embedUrl, type: 'youtube' });
        cancelEditVideo();
      }else{
        await db.collection('videos').add({
          title, embedUrl, type: 'youtube', createdAt: firebase.firestore.FieldValue.serverTimestamp()
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

function startEditVideoFile(id, v){
  editingVideoFileId = id;
  document.getElementById('videoUploadTitle').value = v.title || '';
  document.getElementById('videoExistingUrl').value = v.fileUrl || '';
  document.getElementById('videoFile').value = '';
  const preview = document.getElementById('videoPreview');
  if(v.fileUrl){ preview.src = v.fileUrl; preview.style.display = 'block'; }
  document.getElementById('videoUploadStatus').textContent = 'الفيديو الحالي معروض فوق — اختر فيديو جديد بس لو عايز تستبدله.';
  document.getElementById('addVideoFileBtn').textContent = 'حفظ التعديل';
  document.getElementById('cancelVideoFileEditBtn').style.display = 'inline-block';
  document.getElementById('videoFile').scrollIntoView({behavior:'smooth', block:'center'});
}

function cancelEditVideoFile(){
  editingVideoFileId = null;
  document.getElementById('videoUploadTitle').value = '';
  document.getElementById('videoFile').value = '';
  document.getElementById('videoExistingUrl').value = '';
  document.getElementById('videoUploadStatus').textContent = '';
  document.getElementById('videoPreview').style.display = 'none';
  document.getElementById('addVideoFileBtn').textContent = 'رفع الفيديو';
  document.getElementById('cancelVideoFileEditBtn').style.display = 'none';
}

function setupVideoUploadForm(){
  const btn = document.getElementById('addVideoFileBtn');
  const cancelBtn = document.getElementById('cancelVideoFileEditBtn');
  const fileInput = document.getElementById('videoFile');
  const preview = document.getElementById('videoPreview');
  const status = document.getElementById('videoUploadStatus');
  if(!btn) return;

  fileInput.addEventListener('change', ()=>{
    const file = fileInput.files[0];
    if(!file) return;
    if(file.size > 100 * 1024 * 1024){
      status.textContent = 'الفيديو كبير أوي (أكتر من 100 ميجا)، جرّب فيديو أقصر أو بجودة أقل.';
      fileInput.value = '';
      return;
    }
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';
    const mb = (file.size / (1024*1024)).toFixed(1);
    status.textContent = `الفيديو جاهز للرفع (${mb} ميجا).`;
  });

  if(cancelBtn) cancelBtn.addEventListener('click', cancelEditVideoFile);

  btn.addEventListener('click', async ()=>{
    const title = document.getElementById('videoUploadTitle').value.trim();
    const file = fileInput.files[0];
    const existingUrl = document.getElementById('videoExistingUrl').value;

    if(!file && !existingUrl){
      alert('اختار فيديو الأول.');
      return;
    }

    btn.disabled = true;
    try{
      let fileUrl = existingUrl;
      if(file){
        status.textContent = 'جاري الرفع... 0%';
        fileUrl = await uploadVideoToCloudinary(file, (pct)=>{
          status.textContent = `جاري الرفع... ${pct}%`;
        });
      }

      if(editingVideoFileId){
        await db.collection('videos').doc(editingVideoFileId).update({ title, fileUrl, type: 'upload' });
        cancelEditVideoFile();
      }else{
        await db.collection('videos').add({
          title, fileUrl, type: 'upload', createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('videoUploadTitle').value = '';
        fileInput.value = '';
        preview.style.display = 'none';
        status.textContent = '';
      }
      loadVideosAdmin();
    }catch(e){
      status.textContent = '';
      alert('حصل خطأ أثناء رفع الفيديو، حاول تاني. (' + e.message + ')');
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
  setupPasteImport();
  setupHeroPhotoForm();
  setupPhotoForm();
  setupVideoForm();
  setupVideoUploadForm();
  setupPressForm();
  setupProfileForm();
});
