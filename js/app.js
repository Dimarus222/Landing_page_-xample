// app.js — ядро приложения SecOpticon v2.0
// Зависимости: data-loader.js (должен быть загружен первым), highlight.js (CDN в index.html)

// ==================== ГЛОБАЛЬНОЕ СОСТОЯНИЕ ====================
let DB = typeof LESSON_DATABASE !== 'undefined' ? LESSON_DATABASE : { semesters: [] };
let currentSemesterId = null;
let currentLessonId = null;
let totalLessons = 0;
let allFlatLessons = [];
let currentFilters = { search: '', tag: '', favorites: false };

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
function initDB() {
    if (typeof LESSON_DATABASE !== 'undefined') {
        DB = LESSON_DATABASE;
    }
}

// ==================== УТИЛИТЫ LOCALSTORAGE ====================
const LS_KEYS = {
    PROGRESS: 'secopticon_progress',
    FAVORITES: 'secopticon_favorites',
    NOTES: 'secopticon_notes',
    THEME: 'secopticon_theme',
    COMPLETED: 'secopticon_completed'
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

// ==================== ПРОГРЕСС ====================
function getProgress() {
    return getLS(LS_KEYS.PROGRESS, {});
}

function isCompleted(lessonId) {
    const progress = getProgress();
    return !!progress[lessonId];
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
    buildTree(currentFilters.search);
}

function updateGlobalProgress() {
    const progress = getProgress();
    const completedCount = Object.keys(progress).filter(id => progress[id]).length;
    const pf = document.getElementById('global-progress');
    if (pf) pf.style.width = totalLessons > 0 ? ((completedCount / totalLessons) * 100) + '%' : '0%';
    const counter = document.getElementById('lesson-counter');
    if (counter) counter.textContent = `Пройдено: ${completedCount} из ${totalLessons}`;
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
    // Обновить звёздочку в текущем уроке
    renderStarButton();
    buildTree(currentFilters.search);
}

// ==================== ЗАМЕТКИ ====================
function getNotes() {
    return getLS(LS_KEYS.NOTES, {});
}

function getNote(lessonId) {
    const notes = getNotes();
    return notes[lessonId] || '';
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
    const theme = getTheme();
    document.documentElement.setAttribute('data-theme', theme);
}

// ==================== ПОДСЧЁТ УРОКОВ ====================
function countLessons() {
    totalLessons = 0;
    allFlatLessons = [];
    if (!DB || !DB.semesters) {
        console.warn('База данных не загружена');
        return;
    }
    DB.semesters.forEach(s => {
        if (!s.lessons) return;
        totalLessons += s.lessons.length;
        s.lessons.forEach(l => allFlatLessons.push({ sId: s.id, lId: l.id }));
    });
    updateGlobalProgress();
}

// ==================== ПОСТРОЕНИЕ ДЕРЕВА ====================
function buildTree(filter = '') {
    const container = document.getElementById('tree-container');
    if (!container || !DB || !DB.semesters) return;
    container.innerHTML = '';
    const lowerFilter = filter.toLowerCase();
    const progress = getProgress();
    const favs = getFavorites();

    // Кнопка "Избранное"
    const favBtn = document.createElement('div');
    favBtn.className = `semester-header${currentFilters.favorites ? ' active-filter' : ''}`;
    favBtn.style.cssText = 'color: var(--accent-yellow); margin-bottom: 4px;';
    favBtn.innerHTML = `<span><i class="fas fa-star"></i> Избранное</span><span class="badge">${favs.length}</span>`;
    favBtn.onclick = () => {
        currentFilters.favorites = !currentFilters.favorites;
        buildTree(document.getElementById('search-box')?.value || '');
    };
    container.appendChild(favBtn);

    if (currentFilters.favorites) {
        // Показать только избранное
        const list = document.createElement('div');
        list.className = 'lesson-list open';
        allFlatLessons.forEach(({ sId, lId }) => {
            if (!favs.includes(lId)) return;
            const semester = DB.semesters.find(s => s.id === sId);
            if (!semester) return;
            const lesson = semester.lessons.find(l => l.id === lId);
            if (!lesson) return;
            const link = createLessonLink(sId, lId, lesson, progress);
            list.appendChild(link);
        });
        if (list.children.length === 0) {
            list.innerHTML = '<div style="padding:12px;color:var(--text-secondary);font-size:0.8rem;">Нет избранных уроков</div>';
        }
        container.appendChild(list);
        return;
    }

    DB.semesters.forEach(semester => {
        if (!semester.lessons) return;
        const filteredLessons = semester.lessons.filter(
            l => l.title.toLowerCase().includes(lowerFilter) ||
                 l.id.includes(lowerFilter) ||
                 semester.title.toLowerCase().includes(lowerFilter) ||
                 (l.content && l.content.toLowerCase().includes(lowerFilter))
        );
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
            const link = createLessonLink(semester.id, lesson.id, lesson, progress);
            list.appendChild(link);
        });

        group.appendChild(header);
        group.appendChild(list);
        container.appendChild(group);
    });
}

function createLessonLink(sId, lId, lesson, progress) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;align-items:center;border-left:3px solid transparent;';
    if (currentLessonId === lId && currentSemesterId === sId) {
        wrapper.style.borderLeftColor = 'var(--accent-blue)';
        wrapper.style.background = '#161b22';
    }

    const check = document.createElement('span');
    check.style.cssText = 'cursor:pointer;padding:6px 4px 6px 16px;font-size:0.8rem;flex-shrink:0;';
    check.innerHTML = progress[lId] ? '<i class="fas fa-check-circle" style="color:var(--accent-green)"></i>' : '<i class="far fa-circle" style="color:var(--text-secondary)"></i>';
    check.title = progress[lId] ? 'Отметить как непройденное' : 'Отметить как пройденное';
    check.onclick = (e) => {
        e.stopPropagation();
        toggleComplete(lId);
    };

    const favIcon = document.createElement('span');
    favIcon.style.cssText = 'cursor:pointer;padding:6px 2px;font-size:0.7rem;flex-shrink:0;';
    const isFav = isFavorite(lId);
    favIcon.innerHTML = isFav ? '<i class="fas fa-star" style="color:var(--accent-yellow)"></i>' : '<i class="far fa-star" style="color:var(--text-secondary)"></i>';
    favIcon.title = isFav ? 'Убрать из избранного' : 'Добавить в избранное';
    favIcon.onclick = (e) => {
        e.stopPropagation();
        toggleFavorite(lId);
    };

    const link = document.createElement('a');
    link.className = 'lesson-link';
    link.style.cssText = 'flex:1;border-left:none;padding-left:4px;';
    link.textContent = `${lId}: ${lesson.title}`;
    link.onclick = (e) => {
        e.preventDefault();
        loadLesson(sId, lId);
        closeMobileSidebar();
    };

    wrapper.appendChild(check);
    wrapper.appendChild(favIcon);
    wrapper.appendChild(link);
    return wrapper;
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
    currentFilters.search = query;
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
    return `<div class="breadcrumbs" style="display:flex;gap:8px;align-items:center;margin-bottom:16px;font-size:0.8rem;color:var(--text-secondary);flex-wrap:wrap;">
        <a href="#" onclick="event.preventDefault();loadLesson(allFlatLessons[0].sId,allFlatLessons[0].lId)" style="color:var(--accent-blue);text-decoration:none;">
            <i class="fas fa-home"></i> Главная
        </a>
        <span>/</span>
        <a href="#" onclick="event.preventDefault();toggleSemester(${semester.id});document.getElementById('content').scrollTop=0;" style="color:var(--accent-blue);text-decoration:none;">
            ${semester.title}
        </a>
        <span>/</span>
        <span>${lesson.id}: ${lesson.title}</span>
    </div>`;
}

// ==================== ОГЛАВЛЕНИЕ ====================
function renderTableOfContents(content) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const headings = doc.querySelectorAll('h2, h3');
    if (headings.length < 2) return '';

    let toc = '<div class="lesson-card" id="table-of-contents"><h3><i class="fas fa-list"></i> Оглавление</h3><ul style="list-style:none;margin-left:0;">';
    headings.forEach((h, i) => {
        const id = `toc-${i}`;
        h.id = id;
        const indent = h.tagName === 'H3' ? 'margin-left:16px;' : '';
        toc += `<li style="${indent}margin-bottom:4px;"><a href="#${id}" style="color:var(--accent-cyan);text-decoration:none;font-size:0.85rem;">${h.textContent}</a></li>`;
    });
    toc += '</ul></div>';
    return toc;
}

// ==================== ЗВЕЗДА ИЗБРАННОГО ====================
function renderStarButton() {
    const container = document.getElementById('star-container');
    if (!container || !currentLessonId) return;
    const isFav = isFavorite(currentLessonId);
    container.innerHTML = `<button onclick="toggleFavorite('${currentLessonId}')" 
        style="background:none;border:none;cursor:pointer;font-size:1.2rem;padding:4px 8px;border-radius:6px;"
        title="${isFav ? 'Убрать из избранного' : 'Добавить в избранное'}">
        <i class="fas fa-star" style="color:${isFav ? 'var(--accent-yellow)' : 'var(--text-secondary)'}"></i>
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
            oninput="saveNote(currentLessonId, this.value)"
        >${escapeHTML(note)}</textarea>
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

    // Предыдущий
    const prevBtn = document.createElement('button');
    prevBtn.className = 'nav-btn';
    prevBtn.innerHTML = '← Предыдущий';
    prevBtn.disabled = currentIndex <= 0;
    if (currentIndex > 0) {
        prevBtn.onclick = () => loadLesson(allFlatLessons[currentIndex - 1].sId, allFlatLessons[currentIndex - 1].lId);
    }
    navDiv.appendChild(prevBtn);

    // Инфо
    const info = document.createElement('span');
    info.className = 'nav-info';
    const progress = getProgress();
    const completedCount = Object.keys(progress).filter(id => progress[id]).length;
    info.textContent = `Урок ${currentIndex + 1} из ${totalLessons} | Пройдено: ${completedCount}`;
    navDiv.appendChild(info);

    // Случайный урок
    const randomBtn = document.createElement('button');
    randomBtn.className = 'nav-btn';
    randomBtn.innerHTML = '🎲 Случайный';
    randomBtn.title = 'Открыть случайный урок';
    randomBtn.onclick = () => {
        const ri = Math.floor(Math.random() * totalLessons);
        loadLesson(allFlatLessons[ri].sId, allFlatLessons[ri].lId);
    };
    navDiv.appendChild(randomBtn);

    // Экспорт PDF
    const pdfBtn = document.createElement('button');
    pdfBtn.className = 'nav-btn';
    pdfBtn.innerHTML = '🖨️ PDF';
    pdfBtn.title = 'Сохранить урок как PDF';
    pdfBtn.onclick = () => window.print();
    navDiv.appendChild(pdfBtn);

    // Следующий
    const nextBtn = document.createElement('button');
    nextBtn.className = 'nav-btn';
    nextBtn.innerHTML = 'Следующий →';
    nextBtn.disabled = currentIndex >= totalLessons - 1;
    if (currentIndex < totalLessons - 1) {
        nextBtn.onclick = () => loadLesson(allFlatLessons[currentIndex + 1].sId, allFlatLessons[currentIndex + 1].lId);
    }
    navDiv.appendChild(nextBtn);

    return navDiv;
}

// ==================== ЗАГРУЗКА УРОКА ====================
function loadLesson(semesterId, lessonId) {
    if (!DB || !DB.semesters) return;
    const semester = DB.semesters.find(s => s.id === semesterId);
    if (!semester || !semester.lessons) return;
    const lesson = semester.lessons.find(l => l.id === lessonId);
    if (!lesson) return;

    currentSemesterId = semesterId;
    currentLessonId = lessonId;

    const render = document.getElementById('lesson-render');
    if (!render) return;

    // Собираем контент
    const toc = renderTableOfContents(lesson.content);
    const breadcrumbs = renderBreadcrumbs(semester, lesson);
    const notesPanel = renderNotesPanel();

    render.innerHTML = `
        ${breadcrumbs}
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <div id="star-container"></div>
            <button onclick="toggleComplete('${lessonId}')" 
                style="background:none;border:none;cursor:pointer;font-size:0.85rem;padding:4px 8px;border-radius:6px;color:${isCompleted(lessonId) ? 'var(--accent-green)' : 'var(--text-secondary)'};"
                title="${isCompleted(lessonId) ? 'Отметить как непройденное' : 'Отметить как пройденное'}">
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
        if (!al) {
            // Ищем по data-атрибуту или тексту
            const links = document.querySelectorAll('.lesson-link');
            links.forEach(l => {
                if (l.textContent.startsWith(`${lessonId}:`)) {
                    l.classList.add('active');
                    l.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        } else {
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

// ==================== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ====================
document.addEventListener('DOMContentLoaded', () => {
    initDB();
    applyTheme();
    countLessons();
    buildTree();
    if (allFlatLessons.length > 0) {
        loadLesson(allFlatLessons[0].sId, allFlatLessons[0].lId);
    }

    // Добавляем кнопку темы в мобильный topbar
    const topbar = document.getElementById('mobile-topbar');
    if (topbar) {
        const themeBtn = document.createElement('button');
        themeBtn.onclick = toggleTheme;
        themeBtn.title = 'Переключить тему (тёмная / светлая / сепия)';
        themeBtn.innerHTML = '<i class="fas fa-palette"></i>';
        themeBtn.style.cssText = 'margin-left:auto;margin-right:8px;';
        topbar.appendChild(themeBtn);
    }
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
