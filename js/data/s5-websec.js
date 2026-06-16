const SEMESTER_5 = (function() {
    function L(id, title, type, content) { return { id, title, type, content }; }
    function makeContent(semNum, lessonNum, title, bodyHTML, sources) {
        const src = sources ? `<div class="source-block"><h4><i class="fas fa-book"></i> Источники</h4><ul>${sources.map(s=>`<li>${s}</li>`).join('')}</ul></div>` : '';
        return `<h1>Урок ${semNum}.${lessonNum}: ${title}</h1>${bodyHTML}${src}`;
    }
    const lessons = [];
    lessons.push(L("5.1", "SQL-инъекции", "web", makeContent(5, 1, "SQL-инъекции", `<div class="theory-block"><h3>🛠️ Семестр 5 наполняется</h3><p>Здесь будут: OWASP Top 10, XSS, CSRF, SSRF, IDS/IPS, WAF, VPN, DDoS.</p></div>`, ["OWASP Testing Guide"])));
    return { id: 5, title: "🌐 Безопасность приложений", motto: "Защита периметра", lessons: lessons, literature: [], links: [] };
})();
if (!window.__SECOPTICON_SEMESTERS) window.__SECOPTICON_SEMESTERS = [];
window.__SECOPTICON_SEMESTERS.push({ id: 5, data: SEMESTER_5 });
