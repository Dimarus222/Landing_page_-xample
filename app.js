// app.js — KERNEL
// v4.0.0 "Kernel" — ребрендинг SecOpticon -> KERNEL + кибернетический редизайн + новые фичи.
// См. CLAUDE.md для карты архитектуры и инструкций по дальнейшей доработке.

let DB = { semesters: [] };
let currentSemesterId = null;
let currentLessonId = null;
let totalLessons = 0;
let allFlatLessons = [];
let loadedSemesters = {};

// ==================== САМОРЕГИСТРАЦИЯ СЕМЕСТРОВ ====================
function collectSemesters() {
  if (!window.__KERNEL_SEMESTERS || !Array.isArray(window.__KERNEL_SEMESTERS)) {
    console.warn('Нет зарегистрированных семестров');
    return;
  }
  window.__KERNEL_SEMESTERS.sort(function(a, b) { return a.id - b.id; });
  window.__KERNEL_SEMESTERS.forEach(function(entry) {
    if (!loadedSemesters[entry.id]) {
      loadedSemesters[entry.id] = true;
      DB.semesters.push(entry.data);
    }
  });
  DB.semesters.sort(function(a, b) { return a.id - b.id; });
  console.log('📚 KERNEL: загружено семестров — ' + DB.semesters.length);
  countLessons();
  buildTree();
  updateStatsPanel();
  updateStreak();
  if (allFlatLessons.length > 0) {
    var hash = window.location.hash;
    if (hash && hash.startsWith('#s')) {
      var parts = hash.replace('#', '').split('/');
      if (parts.length === 2) {
        loadLesson(parseInt(parts[0].replace('s', '')), parts[1], true);
        return;
      }
    }
    if (hash === '#glossary') { renderGlossary(); return; }
    renderWelcomeOrRoadmap();
  }
}

function renderWelcomeOrRoadmap() {
  // Показываем экран "продолжить" при наличии сохранённого места, иначе карту обучения
  var last = getLS(LS_KEYS.LAST_LESSON, null);
  if (last && last.sId != null && last.lId) {
    renderContinueScreen(last);
  } else {
    renderRoadmap();
  }
}

// ==================== LOCALSTORAGE ====================
var LS_KEYS = {
  PROGRESS: 'kernel_progress',
  FAVORITES: 'kernel_favorites',
  NOTES: 'kernel_notes',
  THEME: 'kernel_theme',
  STREAK: 'kernel_streak',
  ACHIEVEMENTS: 'kernel_achievements',
  LAST_LESSON: 'kernel_last_lesson'
};

// Старые ключи от версии SecOpticon — переносим один раз, чтобы не терять прогресс пользователей
var LEGACY_LS_KEYS = {
  PROGRESS: 'secopticon_progress',
  FAVORITES: 'secopticon_favorites',
  NOTES: 'secopticon_notes',
  THEME: 'secopticon_theme'
};

function migrateLegacyStorage() {
  try {
    if (localStorage.getItem('kernel_migrated_v1')) return;
    Object.keys(LEGACY_LS_KEYS).forEach(function(k) {
      var legacyVal = localStorage.getItem(LEGACY_LS_KEYS[k]);
      var newKey = LS_KEYS[k];
      if (legacyVal !== null && localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, legacyVal);
      }
    });
    localStorage.setItem('kernel_migrated_v1', '1');
  } catch (e) { /* localStorage недоступен — не критично */ }
}

function getLS(key, fallback) {
  if (typeof fallback === 'undefined') fallback = {};
  try {
    var v = JSON.parse(localStorage.getItem(key));
    return v === null || typeof v === 'undefined' ? fallback : v;
  } catch(e) {
    return fallback;
  }
}

function setLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch(e) {}
}

// ==================== ЭКСПОРТ / ИМПОРТ ====================
function exportProgress() {
  var data = {
    version: 2,
    app: 'KERNEL',
    exported: new Date().toISOString(),
    progress: getLS(LS_KEYS.PROGRESS, {}),
    favorites: getLS(LS_KEYS.FAVORITES, []),
    notes: getLS(LS_KEYS.NOTES, {}),
    theme: getLS(LS_KEYS.THEME, 'dark'),
    streak: getLS(LS_KEYS.STREAK, {}),
    achievements: getLS(LS_KEYS.ACHIEVEMENTS, [])
  };
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'kernel-backup-' + new Date().toISOString().slice(0, 10) + '.json';
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
      if (data.streak) setLS(LS_KEYS.STREAK, data.streak);
      if (data.achievements) setLS(LS_KEYS.ACHIEVEMENTS, data.achievements);
      if (data.theme) {
        setLS(LS_KEYS.THEME, data.theme);
        applyTheme();
      }
      alert('✅ Восстановлено!');
      location.reload();
    } catch(err) {
      alert('❌ Ошибка файла');
    }
  };
  reader.readAsText(file);
}

// ==================== ПРОГРЕСС ====================
function getProgress() {
  return getLS(LS_KEYS.PROGRESS, {});
}

function isCompleted(id) {
  return !!getProgress()[id];
}

function toggleComplete(id) {
  var p = getProgress();
  if (p[id]) {
    delete p[id];
  } else {
    p[id] = Date.now();
  }
  setLS(LS_KEYS.PROGRESS, p);
  updateGlobalProgress();
  updateStatsPanel();
  buildTree();
  checkAchievements();
  if (currentLessonId === id) renderStarButton();
}

// ==================== ИЗБРАННОЕ ====================
function getFavorites() {
  return getLS(LS_KEYS.FAVORITES, []);
}

function isFavorite(id) {
  return getFavorites().indexOf(id) >= 0;
}

function toggleFavorite(id) {
  var f = getFavorites();
  var idx = f.indexOf(id);
  if (idx >= 0) {
    f.splice(idx, 1);
  } else {
    f.push(id);
  }
  setLS(LS_KEYS.FAVORITES, f);
  updateStatsPanel();
  renderStarButton();
  buildTree();
  checkAchievements();
}

// ==================== ЗАМЕТКИ ====================
function getNotes() {
  return getLS(LS_KEYS.NOTES, {});
}

function getNote(id) {
  return getNotes()[id] || '';
}

function saveNote(id, text) {
  var n = getNotes();
  n[id] = text;
  setLS(LS_KEYS.NOTES, n);
  updateStatsPanel();
  checkAchievements();
}

// ==================== ТЕМЫ (dark / matrix / sepia) ====================
var THEMES = ['dark', 'matrix', 'sepia'];
var THEME_LABELS = { dark: 'Тёмная', matrix: 'Матрица', sepia: 'Сепия' };

function getTheme() {
  return getLS(LS_KEYS.THEME, 'dark');
}

function setTheme(name) {
  document.documentElement.setAttribute('data-theme', name);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', name === 'sepia' ? '#faf5eb' : (name === 'matrix' ? '#000502' : '#05070b'));
  setLS(LS_KEYS.THEME, name);
}

function toggleTheme() {
  var cur = getTheme();
  var idx = THEMES.indexOf(cur);
  var next = THEMES[(idx + 1) % THEMES.length];
  setTheme(next);
}

function applyTheme() {
  var t = getTheme();
  if (THEMES.indexOf(t) < 0) t = 'dark';
  setTheme(t);
}

// ==================== ОФФЛАЙН-ИНДИКАТОР ====================
function updateOnlineStatus() {
  var indicator = document.getElementById('offline-indicator');
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
        allFlatLessons.push({ sId: s.id, lId: l.id, title: l.title, semTitle: s.title });
      });
    }
  });
  updateGlobalProgress();
}

function updateGlobalProgress() {
  var progress = getProgress();
  var completed = Object.keys(progress).filter(function(id) {
    return progress[id];
  }).length;
  var pf = document.getElementById('global-progress');
  if (pf) {
    var pct = totalLessons > 0 ? Math.round(completed / totalLessons * 100) : 0;
    pf.style.width = pct + '%';
    pf.setAttribute('aria-valuenow', pct);
  }
  var counter = document.getElementById('lesson-counter');
  if (counter) {
    counter.textContent = 'Пройдено: ' + completed + ' из ' + totalLessons;
  }
}

// ==================== ПАНЕЛЬ СТАТИСТИКИ ====================
function updateStatsPanel() {
  var panel = document.getElementById('stats-panel');
  if (!panel) return;
  var progress = getProgress();
  var completed = Object.keys(progress).filter(function(id) {
    return progress[id];
  }).length;
  var favs = getFavorites().length;
  var notes = getNotes();
  var notesCount = Object.keys(notes).filter(function(id) {
    return notes[id] && notes[id].trim();
  }).length;
  panel.innerHTML = '<i class="fas fa-chart-bar"></i> ' + completed +
    ' &nbsp;|&nbsp; <i class="fas fa-star"></i> ' + favs +
    ' &nbsp;|&nbsp; <i class="fas fa-sticky-note"></i> ' + notesCount;
}

// ==================== СЕРИЯ ДНЕЙ (STREAK) ====================
function updateStreak() {
  var today = new Date().toISOString().slice(0, 10);
  var s = getLS(LS_KEYS.STREAK, { lastDate: null, count: 0, best: 0 });
  if (s.lastDate === today) {
    renderStreakLine(s);
    return;
  }
  var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (s.lastDate === yesterday) {
    s.count += 1;
  } else {
    s.count = 1;
  }
  s.lastDate = today;
  if (s.count > (s.best || 0)) s.best = s.count;
  setLS(LS_KEYS.STREAK, s);
  renderStreakLine(s);
  checkAchievements();
}

function renderStreakLine(s) {
  var el = document.getElementById('streak-line');
  if (!el) return;
  if (s.count > 1) {
    el.innerHTML = '<i class="fas fa-fire"></i> Серия: ' + s.count + ' дн. подряд' + (s.best ? (' (рекорд ' + s.best + ')') : '');
  } else {
    el.innerHTML = '<i class="fas fa-fire"></i> Серия: 1 день — заходите каждый день!';
  }
}

// ==================== ДОСТИЖЕНИЯ ====================
var ACHIEVEMENT_DEFS = [
  { id: 'first_lesson', icon: '🚀', title: 'Первая загрузка', desc: 'Пройден первый урок', check: function(ctx) { return ctx.completed >= 1; } },
  { id: 'ten_lessons', icon: '⚙️', title: 'В процессе компиляции', desc: '10 уроков пройдено', check: function(ctx) { return ctx.completed >= 10; } },
  { id: 'twentyfive_lessons', icon: '🧠', title: 'Ядро прогрето', desc: '25 уроков пройдено', check: function(ctx) { return ctx.completed >= 25; } },
  { id: 'half_course', icon: '🛡️', title: 'На полпути', desc: 'Пройдено 50% курса', check: function(ctx) { return ctx.total > 0 && ctx.completed / ctx.total >= 0.5; } },
  { id: 'full_course', icon: '🏆', title: 'root@kernel', desc: 'Курс пройден полностью', check: function(ctx) { return ctx.total > 0 && ctx.completed === ctx.total; } },
  { id: 'collector', icon: '⭐', title: 'Коллекционер', desc: '5 уроков в избранном', check: function(ctx) { return ctx.favorites >= 5; } },
  { id: 'note_taker', icon: '📝', title: 'Внимательный читатель', desc: 'Сделано 5 заметок', check: function(ctx) { return ctx.notes >= 5; } },
  { id: 'streak_3', icon: '🔥', title: 'На связи', desc: '3 дня подряд на сайте', check: function(ctx) { return ctx.streak >= 3; } },
  { id: 'streak_7', icon: '🔥', title: 'Недельный аптайм', desc: '7 дней подряд на сайте', check: function(ctx) { return ctx.streak >= 7; } }
];

function checkAchievements() {
  var unlocked = getLS(LS_KEYS.ACHIEVEMENTS, []);
  var progress = getProgress();
  var completed = Object.keys(progress).filter(function(id) { return progress[id]; }).length;
  var notes = getNotes();
  var notesCount = Object.keys(notes).filter(function(id) { return notes[id] && notes[id].trim(); }).length;
  var streak = getLS(LS_KEYS.STREAK, { count: 0 }).count || 0;
  var ctx = { completed: completed, total: totalLessons, favorites: getFavorites().length, notes: notesCount, streak: streak };

  var newlyUnlocked = null;
  ACHIEVEMENT_DEFS.forEach(function(def) {
    if (unlocked.indexOf(def.id) < 0 && def.check(ctx)) {
      unlocked.push(def.id);
      if (!newlyUnlocked) newlyUnlocked = def;
    }
  });
  if (newlyUnlocked) {
    setLS(LS_KEYS.ACHIEVEMENTS, unlocked);
    showAchievementToast(newlyUnlocked);
  }
}

function showAchievementToast(def) {
  var toast = document.getElementById('achievement-toast');
  if (!toast) return;
  toast.innerHTML = '<span class="ach-icon">' + def.icon + '</span>' +
    '<span><span class="ach-title">Достижение открыто: ' + def.title + '</span><br>' +
    '<span class="ach-desc">' + def.desc + '</span></span>';
  toast.classList.add('show');
  clearTimeout(window.__achToastTimer);
  window.__achToastTimer = setTimeout(function() { toast.classList.remove('show'); }, 4200);
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
    header.innerHTML = '<span><i class="fas fa-folder' + (isOpen ? '-open' : '') + '"></i> ' +
      semester.title + '</span><span class="badge">' + filteredLessons.length + '</span>';
    header.onclick = function() {
      toggleSemester(semester.id);
    };

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
      check.innerHTML = progress[lesson.id] ?
        '<i class="fas fa-check-circle" style="color:var(--accent-green)" aria-label="Пройдено"></i>' :
        '<i class="far fa-circle" style="color:var(--text-secondary)" aria-label="Не пройдено"></i>';
      check.onclick = function(e) {
        e.stopPropagation();
        toggleComplete(lesson.id);
      };

      var favIcon = document.createElement('span');
      favIcon.style.cssText = 'cursor:pointer;padding:6px 2px;font-size:0.7rem;flex-shrink:0;';
      var isFav = favs.indexOf(lesson.id) >= 0;
      favIcon.innerHTML = isFav ?
        '<i class="fas fa-star" style="color:var(--accent-yellow)" aria-label="В избранном"></i>' :
        '<i class="far fa-star" style="color:var(--text-secondary)" aria-label="Не в избранном"></i>';
      favIcon.onclick = function(e) {
        e.stopPropagation();
        toggleFavorite(lesson.id);
      };

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
  document.querySelectorAll('.lesson-list').forEach(function(l) {
    l.classList.remove('open');
  });
  if (!isOpen) {
    list.classList.add('open');
    currentSemesterId = id;
  } else {
    currentSemesterId = null;
  }
  buildTree((document.getElementById('search-box') || {}).value || '');
}

function filterLessons() {
  var query = (document.getElementById('search-box') || {}).value || '';
  buildTree(query);
  if (query) {
    document.querySelectorAll('.lesson-list').forEach(function(l) {
      l.classList.add('open');
    });
  }
}

// ==================== БАНКИ / КРОШКИ ====================
function renderResourceBanks(semester) {
  var html = '';
  if (semester.literature && semester.literature.length > 0) {
    html += '<div class="resource-bank"><h3><i class="fas fa-book"></i> Банк литературы: ' +
      semester.title + '</h3><ul class="ref-list">';
    semester.literature.forEach(function(l) {
      html += '<li>' + l + '</li>';
    });
    html += '</ul></div>';
  }
  if (semester.links && semester.links.length > 0) {
    html += '<div class="resource-bank"><h3><i class="fas fa-link"></i> Полезные ссылки: ' +
      semester.title + '</h3><ul class="ref-list">';
    semester.links.forEach(function(l) {
      html += '<li><a href="' + l.u + '" target="_blank" rel="noopener noreferrer">' + l.t + '</a></li>';
    });
    html += '</ul></div>';
  }
  return html;
}

function renderBreadcrumbs(semester, lesson) {
  return '<div class="breadcrumbs" style="display:flex;gap:8px;align-items:center;margin-bottom:16px;' +
    'font-size:0.8rem;color:var(--text-secondary);flex-wrap:wrap;" aria-label="Навигационная цепочка">' +
    '<a href="#s1/1.1" style="color:var(--accent-blue);text-decoration:none;" aria-label="На главную">' +
    '<i class="fas fa-home"></i> Главная</a><span>/</span>' +
    '<a href="#" onclick="event.preventDefault();toggleSemester(' + semester.id +
    ');document.getElementById(\'content\').scrollTop=0;" style="color:var(--accent-blue);text-decoration:none;">' +
    semester.title + '</a><span>/</span><span>' + lesson.id + ': ' + lesson.title + '</span></div>';
}

// ==================== ВРЕМЯ ЧТЕНИЯ ====================
function estimateReadingTime(htmlContent) {
  var tmp = document.createElement('div');
  tmp.innerHTML = htmlContent;
  var text = tmp.textContent || tmp.innerText || '';
  var words = text.trim().split(/\s+/).filter(Boolean).length;
  var minutes = Math.max(1, Math.round(words / 170)); // ~170 слов/мин для технического текста на русском
  return minutes;
}

// ==================== ОГЛАВЛЕНИЕ ====================
function renderTableOfContents(htmlContent) {
  var tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  var headings = tempDiv.querySelectorAll('h2, h3');
  if (headings.length < 2) return '';

  var toc = '<nav class="lesson-card" id="table-of-contents" aria-label="Оглавление урока">' +
    '<h3><i class="fas fa-list"></i> Оглавление</h3><ul id="toc-list" style="list-style:none;margin-left:0;">';

  headings.forEach(function(h, i) {
    var tocId = 'heading-' + i;
    var indent = h.tagName === 'H3' ? 'margin-left:16px;' : '';
    toc += '<li style="' + indent + 'margin-bottom:4px;">';
    toc += '<a href="javascript:void(0)" onclick="scrollToHeading(\'' + tocId + '\')" ' +
      'data-toc="' + tocId + '" style="color:var(--accent-cyan);text-decoration:none;font-size:0.85rem;">' +
      h.textContent + '</a>';
    toc += '</li>';
  });

  toc += '</ul></nav>';
  return toc;
}

function addHeadingIDs() {
  var content = document.getElementById('lesson-render');
  if (!content) return;
  var headings = content.querySelectorAll('h2, h3');
  headings.forEach(function(h, i) {
    h.id = 'heading-' + i;
  });
}

function scrollToHeading(id) {
  var el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.querySelectorAll('#toc-list a').forEach(function(a) {
      a.style.fontWeight = 'normal';
      a.style.color = 'var(--accent-cyan)';
    });
    var link = document.querySelector('#toc-list a[data-toc="' + id + '"]');
    if (link) {
      link.style.fontWeight = 'bold';
      link.style.color = 'var(--accent-blue)';
    }
  }
}

// ==================== ЗВЕЗДА / ЗАМЕТКИ ====================
function renderStarButton() {
  var container = document.getElementById('star-container');
  if (!container || !currentLessonId) return;
  var isFav = isFavorite(currentLessonId);
  container.innerHTML = '<button onclick="toggleFavorite(\'' + currentLessonId + '\')" ' +
    'style="background:none;border:none;cursor:pointer;font-size:1.2rem;padding:4px 8px;border-radius:6px;" ' +
    'aria-label="' + (isFav ? 'Убрать из избранного' : 'Добавить в избранное') + '">' +
    '<i class="fas fa-star" style="color:' + (isFav ? 'var(--accent-yellow)' : 'var(--text-secondary)') +
    '" aria-hidden="true"></i></button>';
}

function renderNotesPanel() {
  if (!currentLessonId) return '';
  var note = getNote(currentLessonId);
  return '<div class="lesson-card" id="notes-panel"><h3><i class="fas fa-sticky-note"></i> Заметки к уроку</h3>' +
    '<textarea id="lesson-notes" style="width:100%;min-height:100px;background:var(--bg);color:var(--text);' +
    'border:1px solid var(--border);border-radius:6px;padding:8px;font-family:var(--font-text);font-size:0.85rem;' +
    'resize:vertical;" placeholder="Пишите заметки здесь..." aria-label="Заметки к уроку" ' +
    'oninput="saveNote(currentLessonId, this.value)">' + escapeHTML(note) + '</textarea></div>';
}

function escapeHTML(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ==================== КНОПКА НАВЕРХ ====================
function initScrollToTop() {
  var btn = document.getElementById('scroll-to-top');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'scroll-to-top';
    btn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    btn.setAttribute('aria-label', 'Наверх');
    btn.title = 'Наверх (Home)';
    btn.style.cssText = 'position:fixed;bottom:30px;right:30px;z-index:99;width:44px;height:44px;' +
      'border-radius:50%;background:var(--accent-blue);color:#00121a;border:none;cursor:pointer;' +
      'font-size:1.2rem;display:none;box-shadow:0 4px 12px rgba(0,0,0,0.4), var(--glow-blue);transition:all 0.3s;';
    btn.onclick = function() {
      document.getElementById('content').scrollTo({ top: 0, behavior: 'smooth' });
    };
    document.body.appendChild(btn);
  }
}

function toggleScrollToTop() {
  var content = document.getElementById('content');
  var btn = document.getElementById('scroll-to-top');
  if (!content || !btn) return;
  btn.style.display = content.scrollTop > 400 ? 'block' : 'none';
}

// ==================== SPY-SCROLL ====================
function initSpyScroll() {
  var content = document.getElementById('content');
  if (!content) return;
  content.addEventListener('scroll', function() {
    highlightTocItem();
    toggleScrollToTop();
  });
}

function highlightTocItem() {
  var headings = document.querySelectorAll('#lesson-render h2, #lesson-render h3');
  var tocLinks = document.querySelectorAll('#toc-list a');
  if (headings.length === 0 || tocLinks.length === 0) return;

  var content = document.getElementById('content');
  var scrollTop = content.scrollTop + 120;
  var currentId = null;

  headings.forEach(function(h) {
    if (h.offsetTop <= scrollTop) {
      currentId = h.id;
    }
  });

  tocLinks.forEach(function(link) {
    link.style.fontWeight = 'normal';
    link.style.color = 'var(--accent-cyan)';
  });

  if (currentId) {
    var activeLink = document.querySelector('#toc-list a[data-toc="' + currentId + '"]');
    if (activeLink) {
      activeLink.style.fontWeight = 'bold';
      activeLink.style.color = 'var(--accent-blue)';
    }
  }
}

// ==================== ШПАРГАЛКА ПО ГОРЯЧИМ КЛАВИШАМ ====================
function showCheatSheet() {
  var overlay = document.createElement('div');
  overlay.id = 'cheatsheet-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:999;' +
    'display:flex;align-items:center;justify-content:center;';
  overlay.onclick = function(e) {
    if (e.target === overlay) overlay.remove();
  };

  var rows = [
    ['←', 'Предыдущий урок'], ['→', 'Следующий урок'], ['R', 'Случайный урок'],
    ['Ctrl/⌘+K', 'Быстрый поиск (командная палитра)'],
    ['Esc', 'Закрыть меню / окно'], ['?', 'Показать эту шпаргалку']
  ];

  var modal = document.createElement('div');
  modal.style.cssText = 'background:var(--surface);border:2px solid var(--accent-blue);' +
    'border-radius:16px;padding:30px;max-width:500px;width:90%;color:var(--text);' +
    'box-shadow:0 20px 40px rgba(0,0,0,0.6), var(--glow-blue);';
  var rowsHtml = rows.map(function(r) {
    return '<tr><td style="padding:8px;border-bottom:1px solid var(--border);">' +
      '<kbd style="background:var(--surface2);padding:2px 8px;border-radius:4px;font-weight:bold;border:1px solid var(--border);">' + r[0] + '</kbd></td>' +
      '<td style="padding:8px;border-bottom:1px solid var(--border);">' + r[1] + '</td></tr>';
  }).join('');
  modal.innerHTML = '<h2 style="color:var(--accent-blue);margin-bottom:16px;">' +
    '<i class="fas fa-keyboard"></i> Горячие клавиши</h2>' +
    '<table style="width:100%;border-collapse:collapse;font-size:0.9rem;">' + rowsHtml + '</table>' +
    '<button onclick="document.getElementById(\'cheatsheet-overlay\').remove()" ' +
    'style="margin-top:16px;padding:8px 20px;background:var(--accent-blue);color:#00121a;' +
    'border:none;border-radius:6px;cursor:pointer;font-size:0.9rem;font-weight:bold;">Закрыть</button>';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// ==================== КОМАНДНАЯ ПАЛИТРА (Ctrl+K) ====================
function openCommandPalette() {
  if (document.getElementById('cmdk-overlay')) return;
  var overlay = document.createElement('div');
  overlay.id = 'cmdk-overlay';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  var box = document.createElement('div');
  box.id = 'cmdk-box';
  box.innerHTML =
    '<input id="cmdk-input" type="text" placeholder="Поиск урока... (например: XSS, AES, ARP)" autocomplete="off">' +
    '<div id="cmdk-results"></div>' +
    '<div class="cmdk-hint"><kbd>↑</kbd><kbd>↓</kbd> навигация · <kbd>Enter</kbd> открыть · <kbd>Esc</kbd> закрыть</div>';
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  var input = document.getElementById('cmdk-input');
  var selIndex = 0;
  var currentResults = [];

  function render(query) {
    var q = query.trim().toLowerCase();
    var results = allFlatLessons;
    if (q) {
      results = allFlatLessons.filter(function(l) {
        return l.title.toLowerCase().indexOf(q) >= 0 || l.lId.toLowerCase().indexOf(q) >= 0;
      });
    }
    results = results.slice(0, 30);
    currentResults = results;
    selIndex = 0;
    var container = document.getElementById('cmdk-results');
    if (!container) return;
    if (results.length === 0) {
      container.innerHTML = '<div class="cmdk-empty">Ничего не найдено</div>';
      return;
    }
    container.innerHTML = results.map(function(l, i) {
      return '<div class="cmdk-item' + (i === 0 ? ' sel' : '') + '" data-i="' + i + '">' +
        '<span>' + l.lId + ': ' + l.title + '</span><span class="cmdk-sem">' + l.semTitle + '</span></div>';
    }).join('');
    Array.prototype.forEach.call(container.querySelectorAll('.cmdk-item'), function(el) {
      el.onclick = function() {
        var i = parseInt(el.getAttribute('data-i'));
        selectResult(i);
      };
    });
  }

  function selectResult(i) {
    var r = currentResults[i];
    if (!r) return;
    loadLesson(r.sId, r.lId);
    closeMobileSidebar();
    overlay.remove();
  }

  function updateSelection() {
    var items = document.querySelectorAll('.cmdk-item');
    items.forEach(function(el, i) {
      el.classList.toggle('sel', i === selIndex);
    });
    if (items[selIndex]) items[selIndex].scrollIntoView({ block: 'nearest' });
  }

  input.addEventListener('input', function() { render(input.value); });
  input.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); selIndex = Math.min(selIndex + 1, currentResults.length - 1); updateSelection(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); selIndex = Math.max(selIndex - 1, 0); updateSelection(); }
    else if (e.key === 'Enter') { e.preventDefault(); selectResult(selIndex); }
    else if (e.key === 'Escape') { overlay.remove(); }
  });

  render('');
  setTimeout(function() { input.focus(); }, 30);
}

// ==================== ГЛОССАРИЙ ====================
function renderGlossary() {
  var container = document.getElementById('lesson-render');
  if (!container) return;
  history.pushState({ glossary: true }, '', '#glossary');
  document.title = 'Глоссарий | KERNEL';

  var terms = {};
  DB.semesters.forEach(function(sem) {
    (sem.lessons || []).forEach(function(lesson) {
      var tmp = document.createElement('div');
      tmp.innerHTML = lesson.content;
      tmp.querySelectorAll('.definition').forEach(function(el) {
        var term = el.textContent.trim();
        if (term && !terms[term]) {
          var parent = el.closest('p') || el.parentElement;
          terms[term] = { context: parent ? parent.textContent.trim() : '', lesson: lesson.id, sId: sem.id };
        }
      });
    });
  });

  var sortedTerms = Object.keys(terms).sort(function(a, b) { return a.localeCompare(b, 'ru'); });
  var html = '<div class="glossary-container"><h1><i class="fas fa-language"></i> Глоссарий терминов</h1>' +
    '<p style="color:var(--text-secondary);margin-bottom:18px;">Термины, встречающиеся в уроках курса (' + sortedTerms.length + ' шт.). Собирается автоматически из размеченного контента.</p>';

  if (sortedTerms.length === 0) {
    html += '<p>Термины появятся здесь по мере загрузки уроков.</p>';
  } else {
    sortedTerms.forEach(function(term) {
      var t = terms[term];
      var snippet = t.context.length > 220 ? t.context.slice(0, 220) + '…' : t.context;
      html += '<div class="glossary-item"><div class="glossary-term">' + term + '</div>' +
        '<p style="font-size:0.85rem;color:var(--text-secondary);margin-top:4px;">' + snippet + '</p>' +
        '<a href="#" onclick="event.preventDefault();loadLesson(' + t.sId + ',\'' + t.lesson + '\')" style="font-size:0.78rem;color:var(--accent-cyan);">→ урок ' + t.lesson + '</a></div>';
    });
  }
  html += '</div>';
  container.innerHTML = html;
  document.getElementById('content').scrollTop = 0;
}

// ==================== ПРОФИЛЬ / АВТОРИЗАЦИЯ (заглушка на будущее) ====================
function openProfilePanel() {
  if (document.getElementById('profile-panel-overlay')) return;
  var overlay = document.createElement('div');
  overlay.id = 'profile-panel-overlay';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  var panel = document.createElement('div');
  panel.id = 'profile-panel';
  panel.innerHTML =
    '<h2><i class="fas fa-user-astronaut"></i> Профиль</h2>' +
    '<p>Авторизация и облачная синхронизация прогресса между устройствами пока не подключены — весь прогресс хранится локально в этом браузере.</p>' +
    '<p style="margin-top:8px;">Пока используйте кнопки «Резерв» / «Загрузить» в боковом меню, чтобы перенести прогресс на другое устройство вручную.</p>' +
    '<span class="profile-badge"><i class="fas fa-hourglass-half"></i> Вход по аккаунту — в разработке</span>' +
    '<button class="close-btn" onclick="document.getElementById(\'profile-panel-overlay\').remove()">Понятно</button>';
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

// ==================== ЭКРАН «ПРОДОЛЖИТЬ» ====================
function renderContinueScreen(last) {
  var container = document.getElementById('lesson-render');
  if (!container) return;
  var sem = DB.semesters.find(function(s) { return s.id === last.sId; });
  var lesson = sem && sem.lessons ? sem.lessons.find(function(l) { return l.id === last.lId; }) : null;
  var progress = getProgress();
  var completed = Object.keys(progress).filter(function(id) { return progress[id]; }).length;

  container.innerHTML =
    '<div id="welcome-screen">' +
    '<i class="fas fa-microchip"></i>' +
    '<h2>С возвращением в KERNEL</h2>' +
    '<p style="color:var(--text-secondary);">Пройдено уроков: ' + completed + ' из ' + totalLessons + '</p>' +
    (lesson ? ('<p>Последний открытый урок: <b>' + lesson.id + ': ' + lesson.title + '</b></p>' +
      '<button onclick="loadLesson(' + last.sId + ',\'' + last.lId + '\')" style="margin-top:16px;padding:10px 24px;background:var(--accent-green);color:#00190f;border:none;border-radius:8px;cursor:pointer;font-size:1rem;font-weight:bold;box-shadow:var(--glow-green);">' +
      '<i class="fas fa-play"></i> Продолжить обучение</button>') : '') +
    '<div style="margin-top:14px;">' +
    '<button onclick="renderRoadmap()" style="padding:10px 24px;background:var(--accent-blue);color:#00121a;border:none;border-radius:8px;cursor:pointer;font-size:0.95rem;font-weight:bold;margin-right:8px;">' +
    '<i class="fas fa-map"></i> Карта обучения</button>' +
    '<button onclick="openRandomLesson()" style="padding:10px 24px;background:var(--surface2);color:var(--accent-cyan);border:1px solid var(--accent-cyan);border-radius:8px;cursor:pointer;font-size:0.95rem;">' +
    '<i class="fas fa-dice"></i> Случайный урок</button>' +
    '</div></div>';
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
  setLS(LS_KEYS.LAST_LESSON, { sId: semesterId, lId: lessonId });

  if (!skipPushState) {
    history.pushState({ sId: semesterId, lId: lessonId }, '',
      '#s' + semesterId + '/' + lessonId);
  }
  document.title = lesson.id + ': ' + lesson.title + ' | KERNEL';

  var render = document.getElementById('lesson-render');
  if (!render) return;

  render.style.opacity = '0';
  render.style.transition = 'opacity 0.2s ease';

  var toc = renderTableOfContents(lesson.content);
  var breadcrumbs = renderBreadcrumbs(semester, lesson);
  var notesPanel = renderNotesPanel();
  var done = isCompleted(lessonId);
  var minutes = estimateReadingTime(lesson.content);

  render.innerHTML = breadcrumbs +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px;">' +
    '<div id="star-container"></div>' +
    '<div style="display:flex;align-items:center;gap:14px;">' +
    '<span class="reading-time"><i class="fas fa-clock"></i> ~' + minutes + ' мин чтения</span>' +
    '<button onclick="toggleComplete(\'' + lessonId + '\')" ' +
    'style="background:none;border:none;cursor:pointer;font-size:0.85rem;padding:4px 8px;' +
    'border-radius:6px;color:' + (done ? 'var(--accent-green)' : 'var(--text-secondary)') + ';" ' +
    'aria-label="' + (done ? 'Отметить как непройденное' : 'Отметить как пройденное') + '">' +
    '<i class="fas ' + (done ? 'fa-check-circle' : 'fa-circle') + '"></i> ' +
    (done ? 'Пройдено' : 'Отметить пройденным') + '</button></div></div>' +
    toc + lesson.content + notesPanel + renderResourceBanks(semester);

  var currentIndex = allFlatLessons.findIndex(function(l) {
    return l.sId === semesterId && l.lId === lessonId;
  });
  render.appendChild(renderNavButtons(currentIndex));

  updateGlobalProgress();
  buildTree();
  document.getElementById('content').scrollTop = 0;

  setTimeout(function() { addHeadingIDs(); }, 50);
  setTimeout(function() { render.style.opacity = '1'; }, 60);

  if (typeof hljs !== 'undefined') {
    document.querySelectorAll('pre code, pre').forEach(function(block) {
      if (!block.classList.contains('hljs')) {
        hljs.highlightElement(block);
      }
    });
  }

  setTimeout(function() {
    var al = document.querySelector('.lesson-link.active');
    if (al) al.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 150);
}

// ==================== НАВИГАЦИЯ (КНОПКИ ВНИЗУ УРОКА) ====================
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
  var completed = Object.keys(getProgress()).filter(function(id) {
    return getProgress()[id];
  }).length;
  info.textContent = 'Урок ' + (currentIndex + 1) + ' из ' + totalLessons +
    ' | Пройдено: ' + completed;
  navDiv.appendChild(info);

  var pdfBtn = document.createElement('button');
  pdfBtn.className = 'nav-btn';
  pdfBtn.innerHTML = '🖨️ PDF';
  pdfBtn.setAttribute('aria-label', 'Сохранить урок как PDF');
  pdfBtn.title = 'Сохранить урок как PDF (Ctrl+P)';
  pdfBtn.onclick = function() { window.print(); };
  navDiv.appendChild(pdfBtn);

  var randomBtn = document.createElement('button');
  randomBtn.className = 'nav-btn';
  randomBtn.innerHTML = '🎲 Случайный';
  randomBtn.setAttribute('aria-label', 'Открыть случайный урок');
  randomBtn.onclick = openRandomLesson;
  navDiv.appendChild(randomBtn);

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

// ==================== КАРТА ОБУЧЕНИЯ ====================
function renderRoadmap() {
  var container = document.getElementById('lesson-render');
  if (!container) return;
  history.pushState({ roadmap: true }, '', '#roadmap');
  var semesters = DB.semesters;
  var progress = getProgress();

  if (!semesters || semesters.length === 0) {
    container.innerHTML = '<div class="roadmap-container"><p style="text-align:center;' +
      'color:var(--text-secondary);">Семестры загружаются...</p></div>';
    return;
  }

  var html = '<div class="roadmap-container">';
  html += '<h1 class="roadmap-title">🗺️ Карта обучения</h1>';
  html += '<p class="roadmap-subtitle">Специалитет 10.05.01 «Компьютерная безопасность»</p>';
  html += '<div class="roadmap-grid">';

  var icons = ['⚖️', '📐', '💻', '🌐', '🔐', '🛡️'];
  var colors = ['var(--accent-law)', 'var(--accent-blue)', 'var(--accent-cyan)',
    'var(--accent-green)', 'var(--accent-purple)', 'var(--accent-pink)'];

  semesters.forEach(function(sem, index) {
    var total = sem.lessons ? sem.lessons.length : 0;
    var completed = sem.lessons ?
      sem.lessons.filter(function(l) { return progress[l.id]; }).length : 0;
    var pct = total > 0 ? Math.round(completed / total * 100) : 0;
    var isDone = pct === 100;
    var firstLessonId = sem.lessons && sem.lessons[0] ? sem.lessons[0].id : '1.1';

    html += '<div class="roadmap-card' + (isDone ? ' completed' : '') +
      '" onclick="loadLesson(' + sem.id + ', \'' + firstLessonId + '\')" ' +
      'style="border-left:4px solid ' + (colors[index] || colors[0]) + ';">';
    html += '<div class="roadmap-card-icon">' + (icons[index] || '📚') + '</div>';
    html += '<div class="roadmap-card-number">Семестр ' + sem.id + '</div>';
    html += '<div class="roadmap-card-title">' + sem.title + '</div>';
    html += '<div class="roadmap-card-desc">' + (sem.motto || '') + ' • ' + total + ' уроков</div>';
    html += '<div class="roadmap-progress-mini">' +
      '<div class="roadmap-progress-fill" style="width:' + pct + '%;"></div></div>';
    html += '<div class="roadmap-card-stats"><span>' + completed + ' из ' + total +
      ' пройдено</span><span>' + pct + '%</span></div>';
    html += '<a href="#s' + sem.id + '/' + firstLessonId +
      '" class="roadmap-card-link" onclick="event.stopPropagation();">Начать →</a>';
    html += '</div>';
  });

  html += '</div></div>';
  container.innerHTML = html;
  document.getElementById('content').scrollTop = 0;
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
  migrateLegacyStorage();
  applyTheme();
  updateOnlineStatus();
  initScrollToTop();
  initSpyScroll();
  collectSemesters();

  window.addEventListener('popstate', function(e) {
    if (e.state && e.state.sId && e.state.lId) {
      loadLesson(e.state.sId, e.state.lId, true);
    } else if (e.state && e.state.glossary) {
      renderGlossary();
    } else {
      renderRoadmap();
    }
  });
});

// ==================== ГОРЯЧИЕ КЛАВИШИ ====================
document.addEventListener('keydown', function(e) {
  // Ctrl/Cmd+K — командная палитра (работает даже в полях ввода)
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    openCommandPalette();
    return;
  }
  if (e.ctrlKey || e.metaKey) return;

  if (e.key === 'Escape') {
    var overlay = document.getElementById('cheatsheet-overlay');
    if (overlay) { overlay.remove(); return; }
    var cmdk = document.getElementById('cmdk-overlay');
    if (cmdk) { cmdk.remove(); return; }
    var profile = document.getElementById('profile-panel-overlay');
    if (profile) { profile.remove(); return; }
    closeMobileSidebar();
    return;
  }

  if (e.key === '?') {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      showCheatSheet();
    }
    return;
  }

  if (e.altKey) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  var ci = allFlatLessons.findIndex(function(l) {
    return l.sId === currentSemesterId && l.lId === currentLessonId;
  });

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
