// ####################################################################
// #####                    ЧАСТЬ 2: ЯДРО ПРИЛОЖЕНИЯ              #####
// ####################################################################

let DB = LESSON_DATABASE;
let currentSemesterId = null;
let currentLessonId = null;
let totalLessons = 0;
let allFlatLessons = [];

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
    const counter = document.getElementById('lesson-counter');
    if (counter) counter.textContent = `Загружено уроков: ${totalLessons}`;
}

function buildTree(filter = '') {
    const container = document.getElementById('tree-container');
    if (!container || !DB || !DB.semesters) return;
    container.innerHTML = '';
    const lowerFilter = filter.toLowerCase();

    DB.semesters.forEach(semester => {
        if (!semester.lessons) return;
        const filteredLessons = semester.lessons.filter(
            l => l.title.toLowerCase().includes(lowerFilter) ||
                 l.id.includes(lowerFilter) ||
                 semester.title.toLowerCase().includes(lowerFilter)
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
            const link = document.createElement('a');
            link.className = `lesson-link${currentLessonId === lesson.id && currentSemesterId === semester.id ? ' active' : ''}`;
            link.textContent = `${lesson.id}: ${lesson.title}`;
            link.onclick = (e) => {
                e.preventDefault();
                loadLesson(semester.id, lesson.id);
                closeMobileSidebar();
            };
            list.appendChild(link);
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

    render.innerHTML = lesson.content + renderResourceBanks(semester);

    const currentIndex = allFlatLessons.findIndex(l => l.sId === semesterId && l.lId === lessonId);

    const navDiv = document.createElement('div');
    navDiv.className = 'nav-buttons';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'nav-btn';
    prevBtn.innerHTML = '← Предыдущий';
    prevBtn.disabled = currentIndex <= 0;
    if (currentIndex > 0) {
        prevBtn.onclick = () => loadLesson(allFlatLessons[currentIndex - 1].sId, allFlatLessons[currentIndex - 1].lId);
    }
    navDiv.appendChild(prevBtn);

    const info = document.createElement('span');
    info.className = 'nav-info';
    info.textContent = `Урок ${currentIndex + 1} из ${totalLessons}`;
    navDiv.appendChild(info);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'nav-btn';
    nextBtn.innerHTML = 'Следующий →';
    nextBtn.disabled = currentIndex >= totalLessons - 1;
    if (currentIndex < totalLessons - 1) {
        nextBtn.onclick = () => loadLesson(allFlatLessons[currentIndex + 1].sId, allFlatLessons[currentIndex + 1].lId);
    }
    navDiv.appendChild(nextBtn);
    render.appendChild(navDiv);

    const pf = document.getElementById('global-progress');
    if (pf) pf.style.width = ((currentIndex + 1) / totalLessons * 100) + '%';

    buildTree(document.getElementById('search-box')?.value || '');
    document.getElementById('content').scrollTop = 0;

    setTimeout(() => {
        const al = document.querySelector('.lesson-link.active');
        if (al) al.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

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

document.addEventListener('DOMContentLoaded', () => {
    DB = typeof LESSON_DATABASE !== 'undefined' ? LESSON_DATABASE : { semesters: [] };
    countLessons();
    buildTree();
    if (allFlatLessons.length > 0) {
        loadLesson(allFlatLessons[0].sId, allFlatLessons[0].lId);
    }
});

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.tagName === 'INPUT') return;
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
    }
});
