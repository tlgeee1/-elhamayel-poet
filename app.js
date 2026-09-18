// ============================================================
// يقرأ المحتوى من Firestore ويعرضه في الصفحة الرئيسية
// لو Firestore فاضي أو مش متصل، بيفضل يعرض المحتوى التجريبي
// الموجود بالفعل في index.html من غير ما يمسحه
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
        <div>
          <h4>${escapeHtml(p.title)}</h4>
          <div class="snippet">${escapeHtml((p.text||'').slice(0,80))}${(p.text||'').length>80?'…':''}</div>
        </div>
        <div class="date">${formatDate(p.createdAt)}</div>
      `;
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
  if(typeof db !== 'undefined'){
    loadPoems();
    loadPhotos();
    loadVideos();
  }
});
