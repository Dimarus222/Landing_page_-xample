const SEMESTER_4 = (function() {
    function L(id, title, type, content) { return { id, title, type, content }; }
    function makeContent(semNum, lessonNum, title, bodyHTML, sources) {
        const src = sources ? `<div class="source-block"><h4><i class="fas fa-book"></i> Источники</h4><ul>${sources.map(s=>`<li>${s}</li>`).join('')}</ul></div>` : '';
        return `<h1>Урок ${semNum}.${lessonNum}: ${title}</h1>${bodyHTML}${src}`;
    }
    const lessons = [];
    lessons.push(L("4.1", "Симметричное шифрование", "crypto", makeContent(4, 1, "Симметричное шифрование", `<div class="theory-block"><h3>🛠️ Семестр 4 наполняется</h3><p>Здесь будут: AES, ГОСТ, RSA, ECC, хеши, HMAC, PKI, постквантовая криптография.</p></div>`, ["Смарт Н. «Криптография»"])));
    return { id: 4, title: "🔐 Криптография", motto: "Защита информации", lessons: lessons, literature: [], links: [] };
})();
if (!window.__SECOPTICON_SEMESTERS) window.__SECOPTICON_SEMESTERS = [];
window.__SECOPTICON_SEMESTERS.push({ id: 4, data: SEMESTER_4 });
