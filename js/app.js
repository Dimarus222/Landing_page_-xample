// app.js v3.0 — SecOpticon
// Фичи: роутинг, a11y, ленивая загрузка, экспорт/импорт прогресса,
// прогресс-трекер, избранное, заметки, темы, оглавление, подсветка кода

// ==================== ГЛОБАЛЬНОЕ СОСТОЯНИЕ ====================
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

  // Сортируем по id, на всякий случай
  window.__SECOPTICON_SEMESTERS.sort((a, b) => a.id - b.id);

  window.__SECOPTICON_SEMESTERS.forEach(entry => {
    if (!loadedSemesters[entry.id]) {
      loadedSemesters[entry.id] = true;
      DB.semesters.push(entry.data);
    }
  });

  // Сортируем семестры в БД по id
  DB.semesters.sort((a, b) => a.id - b.id);

  console.log(`📚 Загружено семестров: ${DB.semesters.length}`);
  countLessons();
  buildTree();

  // Восстановить роут из хеша
  if (allFlatLessons.length > 0) {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#s')) {
      const parts = hash.replace('#', '').split('/');
      if (parts.length === 2) {
        const sId = parseInt(parts[0].replace('s', ''));
        const lId = parts[1];
        loadLesson(sId, lId, true);
        return;
      }
    }
    // Иначе загружаем первый урок
    loadLesson(allFlatLessons[0].sId, allFlatLessons[0].lId, true);
  }
}

// ==================== УТИЛИТЫ LOCALSTORAGE ====================
const LS_KEYS = {
  PROGRESS: 'secopticon_progress',
  FAVORITES: 'secopticon_favorites',
  NOTES: 'secopticon_notes',
  THEME: 'secopticon_theme'
};

function getLS(key, fallback = {}) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function setLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('localStorage переполнен или недоступен');
  }
}

// ==================== ЭКСПОРТ / ИМПОРТ ПРОГРЕССА ====================
function exportProgress() {
  const data = {
    version: 1,
    exported: new Date().toISOString(),
    progress: getLS(LS_KEYS.PROGRESS, {}),
    favorites: getLS(LS_KEYS.FAVORITES, []),
    notes: getLS(LS_KEYS.NOTES, {}),
    theme: getLS(LS_KEYS.THEME, 'dark')
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `secopticon-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importProgress(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.progress) setLS(LS_KEYS.PROGRESS, data.progress);
      if (data.favorites) setLS(LS_KEYS.FAVORITES, data.favorites);
      if (data.notes) setLS(LS_KEYS.NOTES, data.notes);
      if (data.theme) { setLS(LS_KEYS.THEME, data.theme); applyTheme(); }
      alert('✅ Прогресс, избранное, заметки и тема восстановлены!');
      location.reload();
    } catch (err) {
      alert('❌ Ошибка: файл повреждён или не является резервной копией SecOpticon.');
    }
  };
  reader.readAsText(file);
}

// ==================== ПРОГРЕСС ====================
function getProgress() {
  return getLS(LS_KEYS.PROGRESS, {});
}

function isCompleted(lessonId) {
  return !!getProgress()[lessonId];
}

function toggleComplete(lessonId) {
  const progress = getProgress();
  if (progress[lessonId]) {
    delete progress[lessonId];
  } else {
    progress[lessonId] = Date.now();
  }
  setLS(LS_KEYS.PROGRESS, progress);
  updateGlobalProgress();
  buildTree(document.getElementById('search-box')?.value || '');
  // Если сейчас открыт этот урок, обновить кнопку в шапке
  if (currentLessonId === lessonId) {
    renderStarButton(); // перерисует и кнопку "пройдено"
  }
}

// ==================== ИЗБРАННОЕ ====================
function getFavorites() {
  return getLS(LS_KEYS.FAVORITES, []);
}

function isFavorite(lessonId) {
  return getFavorites().includes(lessonId);
}

function toggleFavorite(lessonId) {
  let favs = getFavorites();
  const idx = favs.indexOf(lessonId);
  if (idx >= 0) {
    favs.splice(idx, 1);
  } else {
    favs.push(lessonId);
  }
  setLS(LS_KEYS.FAVORITES, favs);
  renderStarButton();
  buildTree(document.getElementById('search-box')?.value || '');
}

// ==================== ЗАМЕТКИ ====================
function getNotes() {
  return getLS(LS_KEYS.NOTES, {});
}

function getNote(lessonId) {
  return getNotes()[lessonId] || '';
}

function saveNote(lessonId, text) {
  const notes = getNotes();
  notes[lessonId] = text;
  setLS(LS_KEYS.NOTES, notes);
}

// ==================== ТЕМЫ ====================
const THEMES = ['dark', 'light', 'sepia'];

function getTheme() {
  return getLS(LS_KEYS.THEME, 'dark');
}

function setTheme(themeName) {
  document.documentElement.setAttribute('data-theme', themeName);
  setLS(LS_KEYS.THEME, themeName);
}

function toggleTheme() {
  const current = getTheme();
  const idx = THEMES.indexOf(current);
  const next = THEMES[(idx + 1) % THEMES.length];
  setTheme(next);
}

function applyTheme() {
  const saved = getTheme();
  document.documentElement.setAttribute('data-theme', saved);
}

// ==================== ПОДСЧЁТ УРОКОВ ====================
function countLessons() {
  totalLessons = 0;
  allFlatLessons = [];
  if (!DB || !DB.semesters) return;

  DB.semesters.forEach(s => {
    if (!s.lessons) return;
    totalLessons += s.lessons.length;
    s.lessons.forEach(l => allFlatLessons.push({ sId: s.id, lId: l.id }));
  });

  updateGlobalProgress();
}

function updateGlobalProgress() {
  const progress = getProgress();
  const completedCount = Object.keys(progress).filter(id => progress[id]).length;
  const pf = document.getElementById('global-progress');
  if (pf) {
    const percent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
    pf.style.width = percent + '%';
    pf.setAttribute('aria-valuenow', percent);
  }
  const counter = document.getElementById('lesson-counter');
  if (counter) {
    counter.textContent = `Пройдено: ${completedCount} из ${totalLessons}`;
  }
}

// ==================== ПОСТРОЕНИЕ ДЕРЕВА ====================
function buildTree(filter = '') {
  const container = document.getElementById('tree-container');
  if (!container || !DB || !DB.semesters) return;

  container.innerHTML = '';
  const lowerFilter = filter.toLowerCase();
  const progress = getProgress();
  const favs = getFavorites();

  // Кнопка "Избранное" в дереве
  const favBtn = document.createElement('div');
  favBtn.className = 'semester-header';
  favBtn.style.cssText = 'color: var(--accent-yellow); margin-bottom: 4px;';
  favBtn.innerHTML = `<span><i class="fas fa-star"></i> Избранное</span><span class="badge">${favs.length}</span>`;
  favBtn.onclick = () => {
    // Показать избранное: можно открыть модалку или просто сбросить фильтр
    document.getElementById('search-box').value = '';
    buildTree('');
    // прокрутить дерево вверх
    document.getElementById('tree-container').scrollTop = 0;
  };
  container.appendChild(favBtn);

  DB.semesters.forEach(semester => {
    if (!semester.lessons) return;

    const filteredLessons = semester.lessons.filter(l => {
      return l.title.toLowerCase().includes(lowerFilter) ||
             l.id.includes(lowerFilter) ||
             semester.title.toLowerCase().includes(lowerFilter) ||
             (l.content && l.content.toLowerCase().includes(lowerFilter));
    });

    if (filteredLessons.length === 0 && filter !== '') return;

    const group = document.createElement('div');
    group.className = 'semester-group';

    const header = document.createElement('div');
    header.className = 'semester-header';
    const isOpen = currentSemesterId === semester.id || filter !== '';
    header.innerHTML = `<span><i class="fas fa-folder${isOpen ? '-open' : ''}"></i> ${semester.title}</span><span class="badge">${filteredLessons.length}</span>`;
    header.onclick = () => toggleSemester(semester.id);

    const list = document.createElement('div');
    list.className = `lesson-list${isOpen ? ' open' : ''}`;
    list.id = `semester-${semester.id}`;

    filteredLessons.forEach(lesson => {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'display:flex;align-items:center;border-left:3px solid transparent;';
      if (currentLessonId === lesson.id && currentSemesterId === semester.id) {
        wrapper.style.borderLeftColor = 'var(--accent-blue)';
        wrapper.style.background = '#161b22';
      }

      // Галочка прогресса
      const check = document.createElement('span');
      check.style.cssText = 'cursor:pointer;padding:6px 4px 6px 16px;font-size:0.8rem;flex-shrink:0;';
      const done = !!progress[lesson.id];
      check.innerHTML = done
        ? '<i class="fas fa-check-circle" style="color:var(--accent-green)" aria-label="Урок пройден"></i>'
        : '<i class="far fa-circle" style="color:var(--text-secondary)" aria-label="Урок не пройден"></i>';
      check.onclick = (e) => {
        e.stopPropagation();
        toggleComplete(lesson.id);
      };

      // Звёздочка избранного
      const favIcon = document.createElement('span');
      favIcon.style.cssText = 'cursor:pointer;padding:6px 2px;font-size:0.7rem;flex-shrink:0;';
      const isFav = favs.includes(lesson.id);
      favIcon.innerHTML = isFav
        ? '<i class="fas fa-star" style="color:var(--accent-yellow)" aria-label="Убрать из избранного"></i>'
        : '<i class="far fa-star" style="color:var(--text-secondary)" aria-label="Добавить в избранное"></i>';
      favIcon.onclick = (e) => {
        e.stopPropagation();
        toggleFavorite(lesson.id);
      };

      const link = document.createElement('a');
      link.className = 'lesson-link';
      link.style.cssText = 'flex:1;border-left:none;padding-left:4px;';
      link.textContent = `${lesson.id}: ${lesson.title}`;
      link.href = `#s${semester.id}/${lesson.id}`;
      link.onclick = (e) => {
        e.preventDefault();
        loadLesson(semester.id, lesson.id);
        closeMobileSidebar();
      };

      wrapper.appendChild(check);
      wrapper.appendChild(favIcon);
      wrapper.appendChild(link);
      list.appendChild(wrapper);
    });

    group.appendChild(header);
    group.appendChild(list);
    container.appendChild(group);
  });
}

function toggleSemester(id) {
  const list = document.getElementById(`semester-${id}`);
  if (!list) return;
  const isOpen = list.classList.contains('open');
  document.querySelectorAll('.lesson-list').forEach(l => l.classList.remove('open'));
  if (!isOpen) {
    list.classList.add('open');
    currentSemesterId = id;
  } else {
    currentSemesterId = null;
  }
  buildTree(document.getElementById('search-box')?.value || '');
}

function filterLessons() {
  const query = document.getElementById('search-box')?.value || '';
  buildTree(query);
  if (query) {
    document.querySelectorAll('.lesson-list').forEach(l => l.classList.add('open'));
  }
}

// ==================== РЕНДЕР БАНКОВ ====================
function renderResourceBanks(semester) {
  let html = '';
  if (semester.literature && semester.literature.length > 0) {
    html += `<div class="resource-bank"><h3><i class="fas fa-book"></i> Банк литературы: ${semester.title}</h3><ul class="ref-list">`;
    semester.literature.forEach(l => html += `<li>${l}</li>`);
    html += `</ul></div>`;
  }
  if (semester.links && semester.links.length > 0) {
    html += `<div class="resource-bank"><h3><i class="fas fa-link"></i> Полезные ссылки: ${semester.title}</h3><ul class="ref-list">`;
    semester.links.forEach(l => html += `<li><a href="${l.u}" target="_blank" rel="noopener noreferrer">${l.t}</a></li>`);
    html += `</ul></div>`;
  }
  return html;
}

// ==================== ХЛЕБНЫЕ КРОШКИ ====================
function renderBreadcrumbs(semester, lesson) {
  return `<div class="breadcrumbs" style="display:flex;gap:8px;align-items:center;margin-bottom:16px;font-size:0.8rem;color:var(--text-secondary);flex-wrap:wrap;" aria-label="Навигационная цепочка">
    <a href="#s1/1.1" style="color:var(--accent-blue);text-decoration:none;" aria-label="На главную"><i class="fas fa-home"></i> Главная</a>
    <span aria-hidden="true">/</span>
    <a href="#" onclick="event.preventDefault();toggleSemester(${semester.id});document.getElementById('content').scrollTop=0;" style="color:var(--accent-blue);text-decoration:none;">${semester.title}</a>
    <span aria-hidden="true">/</span>
    <span>${lesson.id}: ${lesson.title}</span>
  </div>`;
}

// ==================== ОГЛАВЛЕНИЕ ====================
function renderTableOfContents(content) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');
  const headings = doc.querySelectorAll('h2, h3');
  if (headings.length < 2) return '';

  let toc = '<nav class="lesson-card" id="table-of-contents" aria-label="Оглавление урока"><h3><i class="fas fa-list"></i> Оглавление</h3><ul style="list-style:none;margin-left:0;">';
  headings.forEach((h, i) => {
    const id = `toc-${i}`;
    h.id = id; // это влияет на парсинг, но не на живую страницу — в живом DOM id уже не поменять, но для генерации ссылок ок
    const indent = h.tagName === 'H3' ? 'margin-left:16px;' : '';
    toc += `<li style="${indent}margin-bottom:4px;"><a href="#${id}" style="color:var(--accent-cyan);text-decoration:none;font-size:0.85rem;">${h.textContent}</a></li>`;
  });
  toc += '</ul></nav>';
  return toc;
}

// ==================== ЗВЕЗДА ИЗБРАННОГО ====================
function renderStarButton() {
  const container = document.getElementById('star-container');
  if (!container || !currentLessonId) return;
  const isFav = isFavorite(currentLessonId);
  container.innerHTML = `<button onclick="toggleFavorite('${currentLessonId}')" 
    style="background:none;border:none;cursor:pointer;font-size:1.2rem;padding:4px 8px;border-radius:6px;"
    aria-label="${isFav ? 'Убрать из избранного' : 'Добавить в избранное'}">
    <i class="fas fa-star" style="color:${isFav ? 'var(--accent-yellow)' : 'var(--text-secondary)'}" aria-hidden="true"></i>
  </button>`;
}

// ==================== ЗАМЕТКИ ====================
function renderNotesPanel() {
  if (!currentLessonId) return '';
  const note = getNote(currentLessonId);
  return `<div class="lesson-card" id="notes-panel">
    <h3><i class="fas fa-sticky-note"></i> Заметки к уроку</h3>
    <textarea id="lesson-notes" 
      style="width:100%;min-height:100px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px;font-family:var(--font-text);font-size:0.85rem;resize:vertical;"
      placeholder="Пишите заметки здесь... (сохраняются автоматически)"
      aria-label="Заметки к уроку"
      oninput="saveNote(currentLessonId, this.value)">${escapeHTML(note)}</textarea>
  </div>`;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ==================== КНОПКИ НАВИГАЦИИ ====================
function renderNavButtons(currentIndex) {
  const navDiv = document.createElement('div');
  navDiv.className = 'nav-buttons';
  navDiv.setAttribute('role', 'navigation');
  navDiv.setAttribute('aria-label', 'Навигация по урокам');

  const prevBtn = document.createElement('button');
  prevBtn.className = 'nav-btn';
  prevBtn.innerHTML = '← Предыдущий';
  prevBtn.disabled = currentIndex <= 0;
  prevBtn.setAttribute('aria-label', 'Предыдущий урок');
  if (currentIndex > 0) {
    prevBtn.onclick = () => loadLesson(allFlatLessons[currentIndex - 1].sId, allFlatLessons[currentIndex - 1].lId);
  }
  navDiv.appendChild(prevBtn);

  const info = document.createElement('span');
  info.className = 'nav-info';
  const progress = getProgress();
  const completedCount = Object.keys(progress).filter(id => progress[id]).length;
  info.textContent = `Урок ${currentIndex + 1} из ${totalLessons} | Пройдено: ${completedCount}`;
  navDiv.appendChild(info);

  const randomBtn = document.createElement('button');
  randomBtn.className = 'nav-btn';
  randomBtn.innerHTML = '🎲 Случайный';
  randomBtn.setAttribute('aria-label', 'Открыть случайный урок');
  randomBtn.onclick = () => {
    const ri = Math.floor(Math.random() * totalLessons);
    loadLesson(allFlatLessons[ri].sId, allFlatLessons[ri].lId);
  };
  navDiv.appendChild(randomBtn);

  const pdfBtn = document.createElement('button');
  pdfBtn.className = 'nav-btn';
  pdfBtn.innerHTML = '🖨️ PDF';
  pdfBtn.setAttribute('aria-label', 'Сохранить урок как PDF');
  pdfBtn.onclick = () => window.print();
  navDiv.appendChild(pdfBtn);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'nav-btn';
  nextBtn.innerHTML = 'Следующий →';
  nextBtn.disabled = currentIndex >= totalLessons - 1;
  nextBtn.setAttribute('aria-label', 'Следующий урок');
  if (currentIndex < totalLessons - 1) {
    nextBtn.onclick = () => loadLesson(allFlatLessons[currentIndex + 1].sId, allFlatLessons[currentIndex + 1].lId);
  }
  navDiv.appendChild(nextBtn);

  return navDiv;
}

// ==================== ЗАГРУЗКА УРОКА ====================
function loadLesson(semesterId, lessonId, skipPushState = false) {
  if (!DB || !DB.semesters) return;
  const semester = DB.semesters.find(s => s.id === semesterId);
  if (!semester || !semester.lessons) return;
  const lesson = semester.lessons.find(l => l.id === lessonId);
  if (!lesson) return;

  currentSemesterId = semesterId;
  currentLessonId = lessonId;

  // Обновить URL
  if (!skipPushState) {
    history.pushState({ sId: semesterId, lId: lessonId }, '', `#s${semesterId}/${lessonId}`);
  }

  // Обновить title
  document.title = `${lesson.id}: ${lesson.title} | SecOpticon`;

  const render = document.getElementById('lesson-render');
  if (!render) return;

  const toc = renderTableOfContents(lesson.content);
  const breadcrumbs = renderBreadcrumbs(semester, lesson);
  const notesPanel = renderNotesPanel();

  // Сборка контента
  render.innerHTML = `
    ${breadcrumbs}
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <div id="star-container"></div>
      <button onclick="toggleComplete('${lessonId}')" 
        style="background:none;border:none;cursor:pointer;font-size:0.85rem;padding:4px 8px;border-radius:6px;color:${isCompleted(lessonId) ? 'var(--accent-green)' : 'var(--text-secondary)'};"
        aria-label="${isCompleted(lessonId) ? 'Отметить как непройденное' : 'Отметить как пройденное'}">
        <i class="fas ${isCompleted(lessonId) ? 'fa-check-circle' : 'fa-circle'}"></i>
        ${isCompleted(lessonId) ? ' Пройдено' : ' Отметить пройденным'}
      </button>
    </div>
    ${toc}
    ${lesson.content}
    ${notesPanel}
    ${renderResourceBanks(semester)}
  `;

  // Кнопки навигации
  const currentIndex = allFlatLessons.findIndex(l => l.sId === semesterId && l.lId === lessonId);
  render.appendChild(renderNavButtons(currentIndex));

  // Обновить прогресс-бар
  updateGlobalProgress();

  // Обновить дерево
  buildTree(document.getElementById('search-box')?.value || '');

  // Прокрутка вверх
  document.getElementById('content').scrollTop = 0;

  // Подсветка синтаксиса
  if (typeof hljs !== 'undefined') {
    document.querySelectorAll('pre code, pre').forEach(block => {
      if (!block.classList.contains('hljs')) {
        hljs.highlightElement(block);
      }
    });
  }

  // Подсветка активного урока в дереве
  setTimeout(() => {
    const al = document.querySelector('.lesson-link.active');
    if (al) {
      al.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 100);
}

// ==================== МОБИЛЬНОЕ МЕНЮ ====================
function toggleMobileSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  if (!sb || !ov) return;
  sb.classList.toggle('open');
  ov.classList.toggle('active');
}

function closeMobileSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  if (!sb || !ov) return;
  sb.classList.remove('open');
  ov.classList.remove('active');
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  // Сбор семестров должен быть после того, как все скрипты выполнены
  collectSemesters();

  // Обработка кнопок назад/вперёд браузера
  window.addEventListener('popstate', (event) => {
    if (event.state && event.state.sId && event.state.lId) {
      loadLesson(event.state.sId, event.state.lId, true);
    } else {
      // Вернулись на начальное состояние – загружаем первый урок
      if (allFlatLessons.length > 0) {
        loadLesson(allFlatLessons[0].sId, allFlatLessons[0].lId, true);
      }
    }
  });
});

// ==================== ГОРЯЧИЕ КЛАВИШИ ====================
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'Escape') {
    closeMobileSidebar();
    return;
  }
  const ci = allFlatLessons.findIndex(l => l.sId === currentSemesterId && l.lId === currentLessonId);
  if (e.key === 'ArrowRight' && ci < totalLessons - 1) {
    e.preventDefault();
    loadLesson(allFlatLessons[ci + 1].sId, allFlatLessons[ci + 1].lId);
  } else if (e.key === 'ArrowLeft' && ci > 0) {
    e.preventDefault();
    loadLesson(allFlatLessons[ci - 1].sId, allFlatLessons[ci - 1].lId);
  } else if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    const ri = Math.floor(Math.random() * totalLessons);
    loadLesson(allFlatLessons[ri].sId, allFlatLessons[ri].lId);
  }
});
