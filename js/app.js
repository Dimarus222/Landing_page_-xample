// app.js v3.1 — SecOpticon
// Функции: роутинг, a11y, прогресс, избранное, заметки, темы, оффлайн-индикатор, PWA

let DB = { semesters: [] };
let currentSemesterId = null;
let currentLessonId = null;
let totalLessons = 0;
let allFlatLessons = [];
let loadedSemesters = {};

// ==================== САМОРЕГИСТРАЦИЯ СЕМЕСТРОВ ====================
function collectSemesters() {
  if (!window.__SECOPTICON_SEMESTERS || !Array.isArray(window.__SECOPTICON_SEMESTERS)) {
    console.warn('Нет зарегистрированных семестров');
    return;
  }
  window.__SECOPTICON_SEMESTERS.sort((a, b) => a.id - b.id);
  window.__SECOPTICON_SEMESTERS.forEach(entry => {
    if (!loadedSemesters[entry.id]) {
      loadedSemesters[entry.id] = true;
      DB.semesters.push(entry.data);
    }
  });
  DB.semesters.sort((a, b) => a.id - b.id);
  console.log(`📚 Загружено семестров: ${DB.semesters.length}`);
  countLessons();
  buildTree();
  if (allFlatLessons.length > 0) {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#s')) {
      const parts = hash.replace('#', '').split('/');
      if (parts.length === 2) {
        loadLesson(parseInt(parts[0].replace('s', '')), parts[1], true);
        return;
      }
    }
    loadLesson(allFlatLessons[0].sId, allFlatLessons[0].lId, true);
  }
}

// ==================== LOCALSTORAGE ====================
const LS_KEYS = {
  PROGRESS: 'secopticon_progress',
  FAVORITES: 'secopticon_favorites',
  NOTES: 'secopticon_notes',
  THEME: 'secopticon_theme'
};
function getLS(key, fallback = {}) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch(e) { return fallback; } }
function setLS(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) {} }

// ==================== ЭКСПОРТ/ИМПОРТ ====================
function exportProgress() {
  const data = { version:1, exported:new Date().toISOString(),
    progress: getLS(LS_KEYS.PROGRESS,{}), favorites: getLS(LS_KEYS.FAVORITES,[]), notes: getLS(LS_KEYS.NOTES,{}), theme: getLS(LS_KEYS.THEME,'dark') };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `secopticon-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
}
function importProgress(input) {
  const file = input.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if(data.progress) setLS(LS_KEYS.PROGRESS, data.progress);
      if(data.favorites) setLS(LS_KEYS.FAVORITES, data.favorites);
      if(data.notes) setLS(LS_KEYS.NOTES, data.notes);
      if(data.theme) { setLS(LS_KEYS.THEME, data.theme); applyTheme(); }
      alert('✅ Восстановлено!'); location.reload();
    } catch { alert('❌ Ошибка файла'); }
  };
  reader.readAsText(file);
}

// ==================== ПРОГРЕСС ====================
function getProgress() { return getLS(LS_KEYS.PROGRESS, {}); }
function isCompleted(id) { return !!getProgress()[id]; }
function toggleComplete(id) {
  const p = getProgress(); p[id] = p[id] ? undefined : Date.now();
  setLS(LS_KEYS.PROGRESS, p); updateGlobalProgress(); buildTree();
  if(currentLessonId === id) renderStarButton();
}

// ==================== ИЗБРАННОЕ ====================
function getFavorites() { return getLS(LS_KEYS.FAVORITES, []); }
function isFavorite(id) { return getFavorites().includes(id); }
function toggleFavorite(id) {
  let f = getFavorites(); const idx = f.indexOf(id);
  if(idx>=0) f.splice(idx,1); else f.push(id);
  setLS(LS_KEYS.FAVORITES, f); renderStarButton(); buildTree();
}

// ==================== ЗАМЕТКИ ====================
function getNotes() { return getLS(LS_KEYS.NOTES, {}); }
function getNote(id) { return getNotes()[id] || ''; }
function saveNote(id, text) { const n = getNotes(); n[id] = text; setLS(LS_KEYS.NOTES, n); }

// ==================== ТЕМЫ ====================
const THEMES = ['dark', 'light', 'sepia'];
function getTheme() { return getLS(LS_KEYS.THEME, 'dark'); }
function setTheme(name) { document.documentElement.setAttribute('data-theme', name); setLS(LS_KEYS.THEME, name); }
function toggleTheme() { const cur = getTheme(); const next = THEMES[(THEMES.indexOf(cur)+1)%THEMES.length]; setTheme(next); }
function applyTheme() { setTheme(getTheme()); }

// ==================== ОФФЛАЙН-ИНДИКАТОР ====================
function updateOnlineStatus() {
  const indicator = document.getElementById('offline-indicator');
  if (!indicator) return;
  if (navigator.onLine) {
    indicator.style.display = 'none';
  } else {
    indicator.style.display = 'inline';
  }
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// ==================== СЛУЧАЙНЫЙ УРОК ====================
function openRandomLesson() {
  if (allFlatLessons.length === 0) return;
  const ri = Math.floor(Math.random() * totalLessons);
  loadLesson(allFlatLessons[ri].sId, allFlatLessons[ri].lId);
  closeMobileSidebar();
}

// ==================== ПОДСЧЁТ УРОКОВ ====================
function countLessons() {
  totalLessons = 0; allFlatLessons = [];
  DB.semesters.forEach(s => { if(s.lessons) { totalLessons += s.lessons.length; s.lessons.forEach(l => allFlatLessons.push({sId:s.id,lId:l.id})); } });
  updateGlobalProgress();
}
function updateGlobalProgress() {
  const progress = getProgress();
  const completed = Object.keys(progress).filter(id => progress[id]).length;
  const pf = document.getElementById('global-progress');
  if(pf) { const pct = totalLessons ? Math.round(completed/totalLessons*100) : 0; pf.style.width = pct+'%'; pf.setAttribute('aria-valuenow', pct); }
  const counter = document.getElementById('lesson-counter');
  if(counter) counter.textContent = `Пройдено: ${completed} из ${totalLessons}`;
}

// ==================== ДЕРЕВО ====================
function buildTree(filter = '') {
  const container = document.getElementById('tree-container'); if(!container) return;
  container.innerHTML = '';
  const lowerFilter = filter.toLowerCase();
  const progress = getProgress(); const favs = getFavorites();

  DB.semesters.forEach(semester => {
    if(!semester.lessons) return;
    const filteredLessons = semester.lessons.filter(l =>
      l.title.toLowerCase().includes(lowerFilter) || l.id.includes(lowerFilter) ||
      semester.title.toLowerCase().includes(lowerFilter) || (l.content && l.content.toLowerCase().includes(lowerFilter))
    );
    if(filteredLessons.length === 0 && filter !== '') return;

    const group = document.createElement('div'); group.className = 'semester-group';
    const header = document.createElement('div'); header.className = 'semester-header';
    const isOpen = currentSemesterId === semester.id || filter !== '';
    header.innerHTML = `<span><i class="fas fa-folder${isOpen?'-open':''}"></i> ${semester.title}</span><span class="badge">${filteredLessons.length}</span>`;
    header.onclick = () => toggleSemester(semester.id);
    const list = document.createElement('div'); list.className = `lesson-list${isOpen?' open':''}`;
    list.id = `semester-${semester.id}`;

    filteredLessons.forEach(lesson => {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'display:flex;align-items:center;border-left:3px solid transparent;';
      if(currentLessonId === lesson.id && currentSemesterId === semester.id) { wrapper.style.borderLeftColor = 'var(--accent-blue)'; wrapper.style.background = '#161b22'; }

      const check = document.createElement('span'); check.style.cssText = 'cursor:pointer;padding:6px 4px 6px 16px;font-size:0.8rem;flex-shrink:0;';
      check.innerHTML = progress[lesson.id] ? '<i class="fas fa-check-circle" style="color:var(--accent-green)" aria-label="Пройдено"></i>' : '<i class="far fa-circle" style="color:var(--text-secondary)" aria-label="Не пройдено"></i>';
      check.onclick = (e) => { e.stopPropagation(); toggleComplete(lesson.id); };

      const favIcon = document.createElement('span'); favIcon.style.cssText = 'cursor:pointer;padding:6px 2px;font-size:0.7rem;flex-shrink:0;';
      const isFav = favs.includes(lesson.id);
      favIcon.innerHTML = isFav ? '<i class="fas fa-star" style="color:var(--accent-yellow)" aria-label="В избранном"></i>' : '<i class="far fa-star" style="color:var(--text-secondary)" aria-label="Не в избранном"></i>';
      favIcon.onclick = (e) => { e.stopPropagation(); toggleFavorite(lesson.id); };

      const link = document.createElement('a'); link.className = 'lesson-link';
      link.style.cssText = 'flex:1;border-left:none;padding-left:4px;';
      link.textContent = `${lesson.id}: ${lesson.title}`;
      link.href = `#s${semester.id}/${lesson.id}`;
      link.onclick = (e) => { e.preventDefault(); loadLesson(semester.id, lesson.id); closeMobileSidebar(); };

      wrapper.appendChild(check); wrapper.appendChild(favIcon); wrapper.appendChild(link);
      list.appendChild(wrapper);
    });
    group.appendChild(header); group.appendChild(list);
    container.appendChild(group);
  });
}

function toggleSemester(id) {
  const list = document.getElementById(`semester-${id}`); if(!list) return;
  const isOpen = list.classList.contains('open');
  document.querySelectorAll('.lesson-list').forEach(l => l.classList.remove('open'));
  if(!isOpen) { list.classList.add('open'); currentSemesterId = id; } else currentSemesterId = null;
  buildTree(document.getElementById('search-box')?.value || '');
}
function filterLessons() {
  const query = document.getElementById('search-box')?.value || '';
  buildTree(query);
  if(query) document.querySelectorAll('.lesson-list').forEach(l => l.classList.add('open'));
}

// ==================== БАНКИ, КРОШКИ, ОГЛАВЛЕНИЕ ====================
function renderResourceBanks(semester) {
  let html = '';
  if(semester.literature?.length) {
    html += `<div class="resource-bank"><h3><i class="fas fa-book"></i> Банк литературы: ${semester.title}</h3><ul class="ref-list">${semester.literature.map(l=>`<li>${l}</li>`).join('')}</ul></div>`;
  }
  if(semester.links?.length) {
    html += `<div class="resource-bank"><h3><i class="fas fa-link"></i> Полезные ссылки: ${semester.title}</h3><ul class="ref-list">${semester.links.map(l=>`<li><a href="${l.u}" target="_blank" rel="noopener noreferrer">${l.t}</a></li>`).join('')}</ul></div>`;
  }
  return html;
}
function renderBreadcrumbs(semester, lesson) {
  return `<div class="breadcrumbs" style="display:flex;gap:8px;align-items:center;margin-bottom:16px;font-size:0.8rem;color:var(--text-secondary);flex-wrap:wrap;" aria-label="Навигационная цепочка">
    <a href="#s1/1.1" style="color:var(--accent-blue);text-decoration:none;" aria-label="На главную"><i class="fas fa-home"></i> Главная</a><span>/</span>
    <a href="#" onclick="event.preventDefault();toggleSemester(${semester.id});document.getElementById('content').scrollTop=0;" style="color:var(--accent-blue);text-decoration:none;">${semester.title}</a><span>/</span>
    <span>${lesson.id}: ${lesson.title}</span></div>`;
}
function renderTableOfContents(content) {
  const parser = new DOMParser(); const doc = parser.parseFromString(content, 'text/html');
  const headings = doc.querySelectorAll('h2, h3'); if(headings.length < 2) return '';
  let toc = '<nav class="lesson-card" id="table-of-contents" aria-label="Оглавление урока"><h3><i class="fas fa-list"></i> Оглавление</h3><ul style="list-style:none;margin-left:0;">';
  headings.forEach((h, i) => { const id = `toc-${i}`; const indent = h.tagName === 'H3' ? 'margin-left:16px;' : ''; toc += `<li style="${indent}margin-bottom:4px;"><a href="#${id}" style="color:var(--accent-cyan);text-decoration:none;font-size:0.85rem;">${h.textContent}</a></li>`; });
  toc += '</ul></nav>'; return toc;
}
function renderStarButton() {
  const container = document.getElementById('star-container'); if(!container || !currentLessonId) return;
  const isFav = isFavorite(currentLessonId);
  container.innerHTML = `<button onclick="toggleFavorite('${currentLessonId}')" style="background:none;border:none;cursor:pointer;font-size:1.2rem;padding:4px 8px;border-radius:6px;" aria-label="${isFav?'Убрать из избранного':'Добавить в избранное'}"><i class="fas fa-star" style="color:${isFav?'var(--accent-yellow)':'var(--text-secondary)'}" aria-hidden="true"></i></button>`;
}
function renderNotesPanel() {
  if(!currentLessonId) return '';
  const note = getNote(currentLessonId);
  return `<div class="lesson-card" id="notes-panel"><h3><i class="fas fa-sticky-note"></i> Заметки к уроку</h3><textarea id="lesson-notes" style="width:100%;min-height:100px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px;font-family:var(--font-text);font-size:0.85rem;resize:vertical;" placeholder="Пишите заметки здесь..." aria-label="Заметки к уроку" oninput="saveNote(currentLessonId, this.value)">${escapeHTML(note)}</textarea></div>`;
}
function escapeHTML(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }

// ==================== НАВИГАЦИЯ ====================
function renderNavButtons(currentIndex) {
  const navDiv = document.createElement('div'); navDiv.className = 'nav-buttons'; navDiv.setAttribute('role','navigation'); navDiv.setAttribute('aria-label','Навигация по урокам');
  const prevBtn = document.createElement('button'); prevBtn.className = 'nav-btn'; prevBtn.innerHTML = '← Предыдущий'; prevBtn.disabled = currentIndex <= 0; prevBtn.setAttribute('aria-label','Предыдущий урок');
  if(currentIndex > 0) prevBtn.onclick = () => loadLesson(allFlatLessons[currentIndex-1].sId, allFlatLessons[currentIndex-1].lId);
  navDiv.appendChild(prevBtn);
  const info = document.createElement('span'); info.className = 'nav-info';
  const completed = Object.keys(getProgress()).filter(id => getProgress()[id]).length;
  info.textContent = `Урок ${currentIndex+1} из ${totalLessons} | Пройдено: ${completed}`;
  navDiv.appendChild(info);
  const nextBtn = document.createElement('button'); nextBtn.className = 'nav-btn'; nextBtn.innerHTML = 'Следующий →'; nextBtn.disabled = currentIndex >= totalLessons-1; nextBtn.setAttribute('aria-label','Следующий урок');
  if(currentIndex < totalLessons-1) nextBtn.onclick = () => loadLesson(allFlatLessons[currentIndex+1].sId, allFlatLessons[currentIndex+1].lId);
  navDiv.appendChild(nextBtn);
  return navDiv;
}

// ==================== ЗАГРУЗКА УРОКА ====================
function loadLesson(semesterId, lessonId, skipPushState = false) {
  if(!DB||!DB.semesters) return;
  const semester = DB.semesters.find(s => s.id === semesterId); if(!semester?.lessons) return;
  const lesson = semester.lessons.find(l => l.id === lessonId); if(!lesson) return;
  currentSemesterId = semesterId; currentLessonId = lessonId;
  if(!skipPushState) history.pushState({sId:semesterId,lId:lessonId}, '', `#s${semesterId}/${lessonId}`);
  document.title = `${lesson.id}: ${lesson.title} | SecOpticon`;
  const render = document.getElementById('lesson-render'); if(!render) return;
  const toc = renderTableOfContents(lesson.content);
  const breadcrumbs = renderBreadcrumbs(semester, lesson);
  const notesPanel = renderNotesPanel();
  render.innerHTML = `${breadcrumbs}
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <div id="star-container"></div>
      <button onclick="toggleComplete('${lessonId}')" style="background:none;border:none;cursor:pointer;font-size:0.85rem;padding:4px 8px;border-radius:6px;color:${isCompleted(lessonId)?'var(--accent-green)':'var(--text-secondary)'};" aria-label="${isCompleted(lessonId)?'Отметить как непройденное':'Отметить как пройденное'}"><i class="fas ${isCompleted(lessonId)?'fa-check-circle':'fa-circle'}"></i> ${isCompleted(lessonId)?'Пройдено':'Отметить пройденным'}</button>
    </div>${toc}${lesson.content}${notesPanel}${renderResourceBanks(semester)}`;
  const currentIndex = allFlatLessons.findIndex(l => l.sId===semesterId && l.lId===lessonId);
  render.appendChild(renderNavButtons(currentIndex));
  updateGlobalProgress(); buildTree();
  document.getElementById('content').scrollTop = 0;
  if(typeof hljs !== 'undefined') { document.querySelectorAll('pre code, pre').forEach(block => { if(!block.classList.contains('hljs')) hljs.highlightElement(block); }); }
  setTimeout(() => { const al = document.querySelector('.lesson-link.active'); if(al) al.scrollIntoView({behavior:'smooth',block:'center'}); }, 100);
}

// ==================== МОБИЛЬНОЕ МЕНЮ ====================
function toggleMobileSidebar() { const sb = document.getElementById('sidebar'); const ov = document.getElementById('sidebar-overlay'); if(!sb||!ov) return; sb.classList.toggle('open'); ov.classList.toggle('active'); }
function closeMobileSidebar() { const sb = document.getElementById('sidebar'); const ov = document.getElementById('sidebar-overlay'); if(!sb||!ov) return; sb.classList.remove('open'); ov.classList.remove('active'); }

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(); updateOnlineStatus();
  collectSemesters();
  window.addEventListener('popstate', (e) => {
    if(e.state?.sId && e.state?.lId) loadLesson(e.state.sId, e.state.lId, true);
    else if(allFlatLessons.length > 0) loadLesson(allFlatLessons[0].sId, allFlatLessons[0].lId, true);
  });
});

document.addEventListener('keydown', (e) => {
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
  if(e.key==='Escape') { closeMobileSidebar(); return; }
  const ci = allFlatLessons.findIndex(l => l.sId===currentSemesterId && l.lId===currentLessonId);
  if(e.key==='ArrowRight' && ci < totalLessons-1) { e.preventDefault(); loadLesson(allFlatLessons[ci+1].sId, allFlatLessons[ci+1].lId); }
  else if(e.key==='ArrowLeft' && ci > 0) { e.preventDefault(); loadLesson(allFlatLessons[ci-1].sId, allFlatLessons[ci-1].lId); }
  else if(e.key==='r'||e.key==='R') { e.preventDefault(); openRandomLesson(); }
});
