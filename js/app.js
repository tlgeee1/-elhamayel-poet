// ============================================================
// يقرأ المحتوى من Firestore ويعرضه في الصفحة الرئيسية
// لو Firestore فاضي أو مش متصل، بيفضل يعرض المحتوى التجريبي
// الموجود بالفعل في index.html من غير ما يمسحه
// ============================================================

const DIWAN_BACKGROUNDS = ['bg-wine','bg-gold','bg-night','bg-parchment','bg-royal','bg-rose'];

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

// لو القصيدة معندهاش خلفية مختارة من لوحة التحكم، بنولّد واحدة ثابتة
// بناءً على العنوان (نفس القصيدة هتاخد نفس الخلفية دايمًا).
function pickBackground(p){
  if(p.bg && DIWAN_BACKGROUNDS.includes(p.bg)) return p.bg;
  const s = p.title || p.text || '';
  let hash = 0;
  for(let i=0;i<s.length;i++){ hash = (hash*31 + s.charCodeAt(i)) >>> 0; }
  return DIWAN_BACKGROUNDS[hash % DIWAN_BACKGROUNDS.length];
}

function openDiwan(p){
  const overlay = document.getElementById('diwanOverlay');
  const card = document.getElementById('diwanCard');
  if(!overlay || !card) return;
  DIWAN_BACKGROUNDS.forEach(c => card.classList.remove(c));
  card.classList.add(pickBackground(p));
  document.getElementById('diwanTitle').textContent = p.title || '';
  document.getElementById('diwanVerse').textContent = p.text || '';
  document.getElementById('diwanMeta').textContent = formatDate(p.createdAt);
  overlay.classList.add('open');
}

function closeDiwan(){
  const overlay = document.getElementById('diwanOverlay');
  if(overlay) overlay.classList.remove('open');
}

function setupDiwanModal(){
  const overlay = document.getElementById('diwanOverlay');
  const closeBtn = document.getElementById('diwanClose');
  if(closeBtn) closeBtn.addEventListener('click', closeDiwan);
  if(overlay) overlay.addEventListener('click', (e)=>{ if(e.target === overlay) closeDiwan(); });
  document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeDiwan(); });
}

async function loadPoems(){
  const listEl = document.getElementById('poemList');
  const featuredEl = document.getElementById('featuredPoem');
  if(!listEl) return;

  try{
    const snap = await db.collection('poems').orderBy('createdAt','desc').get();
    if(snap.empty) return; // keep static placeholder content

    listEl.innerHTML = '';
    let first = true;

    snap.forEach(doc=>{
      const p = doc.data();
      if(first && featuredEl){
        featuredEl.querySelector('h3').textContent = p.title || '';
        featuredEl.querySelector('.verse').textContent = p.text || '';
        featuredEl.querySelector('.meta').textContent = formatDate(p.createdAt);
        first = false;
        return;
      }
      const row = document.createElement('div');
      row.className = 'poem-row';
      row.innerHTML = `
        <div class="row-main">
          <span class="bg-dot ${pickBackground(p)}"></span>
          <div>
            <h4>${escapeHtml(p.title)}</h4>
            <div class="snippet">${escapeHtml((p.text||'').slice(0,80))}${(p.text||'').length>80?'…':''}</div>
          </div>
        </div>
        <div class="date">${formatDate(p.createdAt)}</div>
      `;
      row.addEventListener('click', ()=> openDiwan(p));
      listEl.appendChild(row);
    });

    if(listEl.children.length === 0){
      listEl.innerHTML = '<div class="empty-note">القصيدة الأولى ظاهرة فوق — باقي القصائد هتتضاف من لوحة التحكم.</div>';
    }
  }catch(e){
    console.warn('Firestore not configured yet, showing static content.', e);
  }
}

async function loadProfileSettings(){
  try{
    const doc = await db.collection('settings').doc('profile').get();
    if(!doc.exists) return;
    const d = doc.data();

    // صورة الشاعر
    const frame = document.querySelector('.portrait-frame .inner');
    if(frame && d.heroImage){
      frame.innerHTML = `<img src="${escapeHtml(d.heroImage)}" alt="محمد الحمايل" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
    }

    // نبذة "عن الشاعر"
    const aboutBody = document.getElementById('aboutBody');
    if(aboutBody && d.aboutText){
      const paragraphs = d.aboutText.split(/\n+/).map(t=>t.trim()).filter(Boolean);
      if(paragraphs.length){
        aboutBody.innerHTML = paragraphs.map(t=>`<p>${escapeHtml(t)}</p>`).join('');
      }
    }

    // بيانات التواصل
    const emailLink = document.getElementById('contactEmailLink');
    if(emailLink && d.contactEmail){
      emailLink.href = `mailto:${d.contactEmail}`;
    }
    const phoneLink = document.getElementById('contactPhoneLink');
    if(phoneLink && d.contactPhone){
      const digits = d.contactPhone.replace(/[^0-9]/g, '');
      phoneLink.href = `https://wa.me/${digits}`;
      phoneLink.target = '_blank';
      phoneLink.rel = 'noopener';
      phoneLink.style.display = 'inline-block';
    }
    const contactNote = document.getElementById('contactNote');
    if(contactNote && d.contactNote){
      contactNote.textContent = d.contactNote;
    }
  }catch(e){
    console.warn('Profile settings not loaded.', e);
  }
}

async function loadPhotos(){
  const grid = document.getElementById('galleryGrid');
  if(!grid) return;
  try{
    const snap = await db.collection('photos').orderBy('createdAt','desc').get();
    if(snap.empty) return;
    grid.innerHTML = '';
    snap.forEach(doc=>{
      const ph = doc.data();
      const item = document.createElement('div');
      item.className = 'gallery-item';
      item.innerHTML = `<img src="${escapeHtml(ph.url)}" alt="${escapeHtml(ph.caption||'')}" loading="lazy">`;
      grid.appendChild(item);
    });
  }catch(e){
    console.warn('Firestore photos not loaded.', e);
  }
}

async function loadVideos(){
  const grid = document.getElementById('videosGrid');
  if(!grid) return;
  try{
    const snap = await db.collection('videos').orderBy('createdAt','desc').get();
    if(snap.empty) return;
    grid.innerHTML = '';
    snap.forEach(doc=>{
      const v = doc.data();
      const card = document.createElement('div');
      card.className = 'video-card';
      const mediaHtml = v.type === 'upload'
        ? `<video src="${escapeHtml(v.fileUrl)}" controls preload="metadata" style="width:100%;height:100%;"></video>`
        : `<iframe src="${escapeHtml(v.embedUrl)}" allowfullscreen loading="lazy"></iframe>`;
      card.innerHTML = `
        <div class="frame">${mediaHtml}</div>
        <div class="cap">${escapeHtml(v.title||'')}</div>
      `;
      grid.appendChild(card);
    });
  }catch(e){
    console.warn('Firestore videos not loaded.', e);
  }
}

async function loadPress(){
  const listEl = document.getElementById('pressList');
  if(!listEl) return;
  try{
    const snap = await db.collection('press').orderBy('createdAt','desc').get();
    if(snap.empty) return; // keep static placeholder content
    listEl.innerHTML = '';
    snap.forEach(doc=>{
      const p = doc.data();
      const row = document.createElement('a');
      row.className = 'poem-row';
      row.href = p.url;
      row.target = '_blank';
      row.rel = 'noopener';
      row.style.textDecoration = 'none';
      row.style.color = 'inherit';
      row.innerHTML = `
        <div class="row-main">
          <div>
            <h4>${escapeHtml(p.title)}</h4>
            <div class="snippet">${escapeHtml(p.source || '')}</div>
          </div>
        </div>
        <div class="date">${formatDate(p.createdAt)}</div>
      `;
      listEl.appendChild(row);
    });
  }catch(e){
    console.warn('Firestore press not loaded.', e);
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  setupDiwanModal();
  if(typeof db !== 'undefined'){
    loadProfileSettings();
    loadPoems();
    loadPhotos();
    loadVideos();
    loadPress();
  }
});
