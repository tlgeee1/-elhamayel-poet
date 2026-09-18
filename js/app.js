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
      card.innerHTML = `
        <div class="frame"><iframe src="${escapeHtml(v.embedUrl)}" allowfullscreen loading="lazy"></iframe></div>
        <div class="cap">${escapeHtml(v.title||'')}</div>
      `;
      grid.appendChild(card);
    });
  }catch(e){
    console.warn('Firestore videos not loaded.', e);
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  setupDiwanModal();
  if(typeof db !== 'undefined'){
    loadPoems();
    loadPhotos();
    loadVideos();
  }
});
