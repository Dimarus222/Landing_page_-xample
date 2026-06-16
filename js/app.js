// app.js v3.3 — SecOpticon с картой обучения
// Темы: тёмная / сепия. Полный функционал.

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
  console.log('📚 Загружено семестров: ' + DB.semesters.length);
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
    renderRoadmap();
  }
}

// ==================== LOCALSTORAGE ====================
const LS_KEYS = {
  PROGRESS: 'secopticon_progress',
  FAVORITES: 'secopticon_favorites',
  NOTES: 'secopticon_notes',
  THEME: 'secopticon_theme'
};
function getLS(key, fallback) {
  if (typeof fallback === 'undefined') fallback = {};
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch(e) { return fallback; }
}
function setLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch(e) {}
}

// ==================== ЭКСПОРТ/ИМПОРТ ====================
function exportProgress() {
  var data = {
    version: 1,
    exported: new Date().toISOString(),
    progress: getLS(LS_KEYS.PROGRESS, {}),
    favorites: getLS(LS_KEYS.FAVORITES, []),
    notes: getLS(LS_KEYS.NOTES, {}),
    theme: getLS(LS_KEYS.THEME, 'dark')
  };
  var blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'secopticon-backup-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
}

function importProgress(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result);
      if (data.progress) setLS(LS_KEYS.PROGRESS, data.progress);
      if (data.favorites) setLS(LS_KEYS.FAVORITES, data.favorites);
      if (data.notes) setLS(LS_KEYS.NOTES, data.notes);
      if (data.theme) { setLS(LS_KEYS.THEME, data.theme); applyTheme(); }
      alert('✅ Восстановлено!');
      location.reload();
    } catch(err) {
      alert('❌ Ошибка файла');
    }
  };
  reader.readAsText(file);
}

// ==================== ПРОГРЕСС ====================
function getProgress() { return getLS(LS_KEYS.PROGRESS, {}); }
function isCompleted(id) { return !!getProgress()[id]; }
function toggleComplete(id) {
  var p = getProgress();
  if (p[id]) delete p[id];
  else p[id] = Date.now();
  setLS(LS_KEYS.PROGRESS, p);
  updateGlobalProgress();
  buildTree();
  if (currentLessonId === id) renderStarButton();
}

// ==================== ИЗБРАННОЕ ====================
function getFavorites() { return getLS(LS_KEYS.FAVORITES, []); }
function isFavorite(id) { return getFavorites().indexOf(id) >= 0; }
function toggleFavorite(id) {
  var f = getFavorites();
  var idx = f.indexOf(id);
  if (idx >= 0) f.splice(idx, 1);
  else f.push(id);
  setLS(LS_KEYS.FAVORITES, f);
  renderStarButton();
  buildTree();
}

// ==================== ЗАМЕТКИ ====================
function getNotes() { return getLS(LS_KEYS.NOTES, {}); }
function getNote(id) { return getNotes()[id] || ''; }
function saveNote(id, text) {
  var n = getNotes();
  n[id] = text;
  setLS(LS_KEYS.NOTES, n);
}

// ==================== ТЕМЫ ====================
var THEMES = ['dark', 'sepia'];
function getTheme() { return getLS(LS_KEYS.THEME, 'dark'); }
function setTheme(name) {
  document.documentElement.setAttribute('data-theme', name);
  setLS(LS_KEYS.THEME, name);
}
function toggleTheme() {
  var cur = getTheme();
  var idx = THEMES.indexOf(cur);
  var next = THEMES[(idx + 1) % THEMES.length];
  setTheme(next);
}
function applyTheme() { setTheme(getTheme()); }

// ==================== ОФФЛАЙН-ИНДИКАТОР ====================
function updateOnlineStatus() {
  var indicator = document.getElementById('offline-indicator');
  if (!indicator) return;
  indicator.style.display = navigator.onLine ? 'none' : 'inline';
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// ==================== СЛУЧАЙНЫЙ УРОК ====================
function openRandomLesson() {
  if (allFlatLessons.length === 0) return;
  var ri = Math.floor(Math.random() * totalLessons);
  loadLesson(allFlatLessons[ri].sId, allFlatLessons[ri].lId);
  closeMobileSidebar();
}

// ==================== ПОДСЧЁТ УРОКОВ ====================
function countLessons() {
  totalLessons = 0;
  allFlatLessons = [];
  DB.semesters.forEach(function(s) {
    if (s.lessons) {
      totalLessons += s.lessons.length;
      s.lessons.forEach(function(l) {
        allFlatLessons.push({sId: s.id, lId: l.id});
      });
    }
  });
  updateGlobalProgress();
}

function updateGlobalProgress() {
  var progress = getProgress();
  var completed = Object.keys(progress).filter(function(id) { return progress[id]; }).length;
  var pf = document.getElementById('global-progress');
  if (pf) {
    var pct = totalLessons > 0 ? Math.round(completed / totalLessons * 100) : 0;
    pf.style.width = pct + '%';
    pf.setAttribute('aria-valuenow', pct);
  }
  var counter = document.getElementById('lesson-counter');
  if (counter) counter.textContent = 'Пройдено: ' + completed + ' из ' + totalLessons;
}

// ==================== ДЕРЕВО ====================
function buildTree(filter) {
  if (typeof filter === 'undefined') filter = '';
  var container = document.getElementById('tree-container');
  if (!container) return;
  container.innerHTML = '';
  var lowerFilter = filter.toLowerCase();
  var progress = getProgress();
  var favs = getFavorites();

  DB.semesters.forEach(function(semester) {
    if (!semester.lessons) return;
    
    var filteredLessons = semester.lessons;
    if (lowerFilter) {
      filteredLessons = semester.lessons.filter(function(l) {
        return l.title.toLowerCase().indexOf(lowerFilter) >= 0 ||
               l.id.indexOf(lowerFilter) >= 0 ||
               semester.title.toLowerCase().indexOf(lowerFilter) >= 0 ||
               (l.content && l.content.toLowerCase().indexOf(lowerFilter) >= 0);
      });
    }
    if (filteredLessons.length === 0 && filter !== '') return;

    var group = document.createElement('div');
    group.className = 'semester-group';
    
    var header = document.createElement('div');
    header.className = 'semester-header';
    var isOpen = currentSemesterId === semester.id || filter !== '';
    header.innerHTML = '<span><i class="fas fa-folder' + (isOpen ? '-open' : '') + '"></i> ' + semester.title + '</span><span class="badge">' + filteredLessons.length + '</span>';
    header.onclick = function() { toggleSemester(semester.id); };
    
    var list = document.createElement('div');
    list.className = 'lesson-list' + (isOpen ? ' open' : '');
    list.id = 'semester-' + semester.id;

    filteredLessons.forEach(function(lesson) {
      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'display:flex;align-items:center;border-left:3px solid transparent;';
      if (currentLessonId === lesson.id && currentSemesterId === semester.id) {
        wrapper.style.borderLeftColor = 'var(--accent-blue)';
        wrapper.style.background = 'var(--active-bg)';
      }

      var check = document.createElement('span');
      check.style.cssText = 'cursor:pointer;padding:6px 4px 6px 16px;font-size:0.8rem;flex-shrink:0;';
      check.innerHTML = progress[lesson.id]
        ? '<i class="fas fa-check-circle" style="color:var(--accent-green)" aria-label="Пройдено"></i>'
        : '<i class="far fa-circle" style="color:var(--text-secondary)" aria-label="Не пройдено"></i>';
      check.onclick = function(e) { e.stopPropagation(); toggleComplete(lesson.id); };

      var favIcon = document.createElement('span');
      favIcon.style.cssText = 'cursor:pointer;padding:6px 2px;font-size:0.7rem;flex-shrink:0;';
      var isFav = favs.indexOf(lesson.id) >= 0;
      favIcon.innerHTML = isFav
        ? '<i class="fas fa-star" style="color:var(--accent-yellow)" aria-label="В избранном"></i>'
        : '<i class="far fa-star" style="color:var(--text-secondary)" aria-label="Не в избранном"></i>';
      favIcon.onclick = function(e) { e.stopPropagation(); toggleFavorite(lesson.id); };

      var link = document.createElement('a');
      link.className = 'lesson-link';
      link.style.cssText = 'flex:1;border-left:none;padding-left:4px;';
      link.textContent = lesson.id + ': ' + lesson.title;
      link.href = '#s' + semester.id + '/' + lesson.id;
      link.onclick = function(e) {
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
  var list = document.getElementById('semester-' + id);
  if (!list) return;
  var isOpen = list.classList.contains('open');
  document.querySelectorAll('.lesson-list').forEach(function(l) { l.classList.remove('open'); });
  if (!isOpen) {
    list.classList.add('open');
    currentSemesterId = id;
  } else {
    currentSemesterId = null;
  }
  buildTree(document.getElementById('search-box') ? document.getElementById('search-box').value : '');
}

function filterLessons() {
  var query = document.getElementById('search-box') ? document.getElementById('search-box').value : '';
  buildTree(query);
  if (query) document.querySelectorAll('.lesson-list').forEach(function(l) { l.classList.add('open'); });
}

// ==================== БАНКИ, КРОШКИ, ОГЛАВЛЕНИЕ ====================
function renderResourceBanks(semester) {
  var html = '';
  if (semester.literature && semester.literature.length > 0) {
    html += '<div class="resource-bank"><h3><i class="fas fa-book"></i> Банк литературы: ' + semester.title + '</h3><ul class="ref-list">';
    semester.literature.forEach(function(l) { html += '<li>' + l + '</li>'; });
    html += '</ul></div>';
  }
  if (semester.links && semester.links.length > 0) {
    html += '<div class="resource-bank"><h3><i class="fas fa-link"></i> Полезные ссылки: ' + semester.title + '</h3><ul class="ref-list">';
    semester.links.forEach(function(l) { html += '<li><a href="' + l.u + '" target="_blank" rel="noopener noreferrer">' + l.t + '</a></li>'; });
    html += '</ul></div>';
  }
  return html;
}

function renderBreadcrumbs(semester, lesson) {
  return '<div class="breadcrumbs" style="display:flex;gap:8px;align-items:center;margin-bottom:16px;font-size:0.8rem;color:var(--text-secondary);flex-wrap:wrap;" aria-label="Навигационная цепочка">' +
    '<a href="#s1/1.1" style="color:var(--accent-blue);text-decoration:none;" aria-label="На главную"><i class="fas fa-home"></i> Главная</a>' +
    '<span>/</span>' +
    '<a href="#" onclick="event.preventDefault();toggleSemester(' + semester.id + ');document.getElementById(\'content\').scrollTop=0;" style="color:var(--accent-blue);text-decoration:none;">' + semester.title + '</a>' +
    '<span>/</span>' +
    '<span>' + lesson.id + ': ' + lesson.title + '</span></div>';
}

function renderTableOfContents(content) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(content, 'text/html');
  var headings = doc.querySelectorAll('h2, h3');
  if (headings.length < 2) return '';
  var toc = '<nav class="lesson-card" id="table-of-contents" aria-label="Оглавление урока"><h3><i class="fas fa-list"></i> Оглавление</h3><ul style="list-style:none;margin-left:0;">';
  headings.forEach(function(h, i) {
    var id = 'toc-' + i;
    var indent = h.tagName === 'H3' ? 'margin-left:16px;' : '';
    toc += '<li style="' + indent + 'margin-bottom:4px;"><a href="#' + id + '" style="color:var(--accent-cyan);text-decoration:none;font-size:0.85rem;">' + h.textContent + '</a></li>';
  });
  toc += '</ul></nav>';
  return toc;
}

function renderStarButton() {
  var container = document.getElementById('star-container');
  if (!container || !currentLessonId) return;
  var isFav = isFavorite(currentLessonId);
  container.innerHTML = '<button onclick="toggleFavorite(\'' + currentLessonId + '\')" style="background:none;border:none;cursor:pointer;font-size:1.2rem;padding:4px 8px;border-radius:6px;" aria-label="' + (isFav ? 'Убрать из избранного' : 'Добавить в избранное') + '">' +
    '<i class="fas fa-star" style="color:' + (isFav ? 'var(--accent-yellow)' : 'var(--text-secondary)') + '" aria-hidden="true"></i></button>';
}

function renderNotesPanel() {
  if (!currentLessonId) return '';
  var note = getNote(currentLessonId);
  return '<div class="lesson-card" id="notes-panel"><h3><i class="fas fa-sticky-note"></i> Заметки к уроку</h3>' +
    '<textarea id="lesson-notes" style="width:100%;min-height:100px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px;font-family:var(--font-text);font-size:0.85rem;resize:vertical;" placeholder="Пишите заметки здесь..." aria-label="Заметки к уроку" oninput="saveNote(currentLessonId, this.value)">' + escapeHTML(note) + '</textarea></div>';
}

function escapeHTML(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ==================== КАРТА ОБУЧЕНИЯ ====================
function renderRoadmap() {
  var container = document.getElementById('lesson-render');
  if (!container) return;
  var semesters = DB.semesters;
  var progress = getProgress();

  if (!semesters || semesters.length === 0) {
    container.innerHTML = '<div class="roadmap-container"><p style="text-align:center;color:var(--text-secondary);">Семестры загружаются...</p></div>';
    return;
  }

  var html = '<div class="roadmap-container">';
  html += '<h1 class="roadmap-title">🗺️ Карта обучения</h1>';
  html += '<p class="roadmap-subtitle">Специалитет 10.05.01 «Компьютерная безопасность» — полный путь от математики до защиты КИИ</p>';
  html += '<div class="roadmap-grid">';

  var icons = ['📐', '💻', '🌐', '🔐', '🛡️', '🔍', '⚖️', '🏆'];
  var colors = ['var(--accent-blue)', 'var(--accent-cyan)', 'var(--accent-green)', 'var(--accent-yellow)', 'var(--accent-red)', 'var(--accent-purple)', 'var(--accent-law)', 'var(--accent-pink)'];

  semesters.forEach(function(sem, index) {
    var total = sem.lessons ? sem.lessons.length : 0;
    var completed = sem.lessons ? sem.lessons.filter(function(l) { return progress[l.id]; }).length : 0;
    var pct = total > 0 ? Math.round(completed / total * 100) : 0;
    var isDone = pct === 100;
    var firstLessonId = sem.lessons && sem.lessons[0] ? sem.lessons[0].id : '1.1';

    html += '<div class="roadmap-card' + (isDone ? ' completed' : '') + '" onclick="loadLesson(' + sem.id + ', \'' + firstLessonId + '\')" style="border-left: 4px solid ' + (colors[index] || colors[0]) + ';">';
    html += '<div class="roadmap-card-icon">' + (icons[index] || '📚') + '</div>';
    html += '<div class="roadmap-card-number">Семестр ' + sem.id + '</div>';
    html += '<div class="roadmap-card-title">' + sem.title + '</div>';
    html += '<div class="roadmap-card-desc">' + (sem.motto || '') + ' • ' + total + ' уроков</div>';
    html += '<div class="roadmap-progress-mini"><div class="roadmap-progress-fill" style="width:' + pct + '%;"></div></div>';
    html += '<div class="roadmap-card-stats"><span>' + completed + ' из ' + total + ' пройдено</span><span>' + pct + '%</span></div>';
    html += '<a href="#s' + sem.id + '/' + firstLessonId + '" class="roadmap-card-link" onclick="event.stopPropagation();">Начать →</a>';
    html += '</div>';
  });

  html += '</div></div>';
  container.innerHTML = html;
  document.getElementById('content').scrollTop = 0;
}

// ==================== НАВИГАЦИЯ ====================
function renderNavButtons(currentIndex) {
  var navDiv = document.createElement('div');
  navDiv.className = 'nav-buttons';
  navDiv.setAttribute('role', 'navigation');
  navDiv.setAttribute('aria-label', 'Навигация по урокам');

  var prevBtn = document.createElement('button');
  prevBtn.className = 'nav-btn';
  prevBtn.innerHTML = '← Предыдущий';
  prevBtn.disabled = currentIndex <= 0;
  prevBtn.setAttribute('aria-label', 'Предыдущий урок');
  if (currentIndex > 0) {
    prevBtn.onclick = function() {
      loadLesson(allFlatLessons[currentIndex - 1].sId, allFlatLessons[currentIndex - 1].lId);
    };
  }
  navDiv.appendChild(prevBtn);

  var info = document.createElement('span');
  info.className = 'nav-info';
  var completed = Object.keys(getProgress()).filter(function(id) { return getProgress()[id]; }).length;
  info.textContent = 'Урок ' + (currentIndex + 1) + ' из ' + totalLessons + ' | Пройдено: ' + completed;
  navDiv.appendChild(info);

  var nextBtn = document.createElement('button');
  nextBtn.className = 'nav-btn';
  nextBtn.innerHTML = 'Следующий →';
  nextBtn.disabled = currentIndex >= totalLessons - 1;
  nextBtn.setAttribute('aria-label', 'Следующий урок');
  if (currentIndex < totalLessons - 1) {
    nextBtn.onclick = function() {
      loadLesson(allFlatLessons[currentIndex + 1].sId, allFlatLessons[currentIndex + 1].lId);
    };
  }
  navDiv.appendChild(nextBtn);

  return navDiv;
}

// ==================== ЗАГРУЗКА УРОКА ====================
function loadLesson(semesterId, lessonId, skipPushState) {
  if (typeof skipPushState === 'undefined') skipPushState = false;
  if (!DB || !DB.semesters) return;
  var semester = DB.semesters.find(function(s) { return s.id === semesterId; });
  if (!semester || !semester.lessons) return;
  var lesson = semester.lessons.find(function(l) { return l.id === lessonId; });
  if (!lesson) return;

  currentSemesterId = semesterId;
  currentLessonId = lessonId;

  if (!skipPushState) {
    history.pushState({sId: semesterId, lId: lessonId}, '', '#s' + semesterId + '/' + lessonId);
  }
  document.title = lesson.id + ': ' + lesson.title + ' | SecOpticon';

  var render = document.getElementById('lesson-render');
  if (!render) return;

  var toc = renderTableOfContents(lesson.content);
  var breadcrumbs = renderBreadcrumbs(semester, lesson);
  var notesPanel = renderNotesPanel();
  var done = isCompleted(lessonId);

  render.innerHTML = breadcrumbs +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
      '<div id="star-container"></div>' +
      '<button onclick="toggleComplete(\'' + lessonId + '\')" style="background:none;border:none;cursor:pointer;font-size:0.85rem;padding:4px 8px;border-radius:6px;color:' + (done ? 'var(--accent-green)' : 'var(--text-secondary)') + ';" aria-label="' + (done ? 'Отметить как непройденное' : 'Отметить как пройденное') + '">' +
        '<i class="fas ' + (done ? 'fa-check-circle' : 'fa-circle') + '"></i> ' + (done ? 'Пройдено' : 'Отметить пройденным') +
      '</button>' +
    '</div>' +
    toc +
    lesson.content +
    notesPanel +
    renderResourceBanks(semester);

  var currentIndex = allFlatLessons.findIndex(function(l) { return l.sId === semesterId && l.lId === lessonId; });
  render.appendChild(renderNavButtons(currentIndex));

  updateGlobalProgress();
  buildTree();
  document.getElementById('content').scrollTop = 0;

  if (typeof hljs !== 'undefined') {
    document.querySelectorAll('pre code, pre').forEach(function(block) {
      if (!block.classList.contains('hljs')) {
        hljs.highlightElement(block);
      }
    });
  }

  setTimeout(function() {
    var al = document.querySelector('.lesson-link.active');
    if (al) al.scrollIntoView({behavior: 'smooth', block: 'center'});
  }, 100);
}

// ==================== МОБИЛЬНОЕ МЕНЮ ====================
function toggleMobileSidebar() {
  var sb = document.getElementById('sidebar');
  var ov = document.getElementById('sidebar-overlay');
  if (!sb || !ov) return;
  sb.classList.toggle('open');
  ov.classList.toggle('active');
}
function closeMobileSidebar() {
  var sb = document.getElementById('sidebar');
  var ov = document.getElementById('sidebar-overlay');
  if (!sb || !ov) return;
  sb.classList.remove('open');
  ov.classList.remove('active');
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', function() {
  applyTheme();
  updateOnlineStatus();
  collectSemesters();

  window.addEventListener('popstate', function(e) {
    if (e.state && e.state.sId && e.state.lId) {
      loadLesson(e.state.sId, e.state.lId, true);
    } else {
      renderRoadmap();
    }
  });
});

// ==================== ГОРЯЧИЕ КЛАВИШИ ====================
document.addEventListener('keydown', function(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'Escape') { closeMobileSidebar(); return; }
  var ci = allFlatLessons.findIndex(function(l) { return l.sId === currentSemesterId && l.lId === currentLessonId; });
  if (e.key === 'ArrowRight' && ci < totalLessons - 1) {
    e.preventDefault();
    loadLesson(allFlatLessons[ci + 1].sId, allFlatLessons[ci + 1].lId);
  } else if (e.key === 'ArrowLeft' && ci > 0) {
    e.preventDefault();
    loadLesson(allFlatLessons[ci - 1].sId, allFlatLessons[ci - 1].lId);
  } else if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    openRandomLesson();
  }
});
