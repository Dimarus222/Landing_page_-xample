const SEMESTER_3 = (function() {
    function L(id, title, type, content) { return { id, title, type, content }; }
    function makeContent(semNum, lessonNum, title, bodyHTML, sources) {
        const src = sources ? `<div class="source-block"><h4><i class="fas fa-book"></i> Источники</h4><ul>${sources.map(s=>`<li>${s}</li>`).join('')}</ul></div>` : '';
        return `<h1>Урок ${semNum}.${lessonNum}: ${title}</h1>${bodyHTML}${src}`;
    }
    const lessons = [];
    lessons.push(L("3.1", "Архитектура ОС", "os", makeContent(3, 1, "Архитектура ОС", `<div class="theory-block"><h3>🛠️ Семестр 3 наполняется</h3><p>Здесь будут: архитектура ОС, процессы, память, файловые системы, стек TCP/IP, DNS, TLS, анализ трафика.</p></div>`, ["Tanenbaum A. «Modern Operating Systems»"])));
    return { id: 3, title: "💻 ОС и сети", motto: "Инфраструктура", lessons: lessons, literature: [], links: [] };
})();
if (!window.__SECOPTICON_SEMESTERS) window.__SECOPTICON_SEMESTERS = [];
window.__SECOPTICON_SEMESTERS.push({ id: 3, data: SEMESTER_3 });
