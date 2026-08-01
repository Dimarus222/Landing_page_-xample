// Семестр 3: Архитектура ОС и сети
const SEMESTER_3 = (function() {
    function L(id, title, type, content) { return { id, title, type, content }; }
    function makeContent(semNum, lessonNum, title, bodyHTML, sources) {
        const src = sources ? `<div class="source-block"><h4><i class="fas fa-book"></i> Источники</h4><ul>${sources.map(s=>`<li>${s}</li>`).join('')}</ul></div>` : '';
        return `<h1>Урок ${semNum}.${lessonNum}: ${title}</h1>${bodyHTML}${src}`;
    }
    const lessons = [];

    // 3.1
    lessons.push(L("3.1", "Архитектура ОС: ядро, процессы, режимы работы", "os", makeContent(3, 1, "Архитектура ОС: ядро, процессы, режимы работы", `
<div class="theory-block"><h3>Зачем это специалисту по ИБ</h3>
<p>Любая уязвимость в конечном счёте эксплуатируется <span class="highlight">внутри</span> операционной системы: через системные вызовы, права процессов, файловые дескрипторы. Без понимания того, как ОС разделяет режимы выполнения и изолирует процессы друг от друга, невозможно ни писать эксплойты, ни строить защиту.</p></div>

<div class="lesson-card"><h3>Kernel space и user space</h3>
<p>Процессор поддерживает как минимум два уровня привилегий — <span class="definition">kernel mode</span> (кольцо 0) и <span class="definition">user mode</span> (кольцо 3). Ядро ОС работает в kernel mode и имеет полный доступ к железу: памяти, портам ввода-вывода, регистрам управления. Обычные программы работают в user mode и не могут напрямую трогать железо — только через <span class="definition">системные вызовы</span> (syscalls), которые переключают процессор в kernel mode на время выполнения запроса.</p>
<p>Это разделение — фундаментальный защитный барьер. Эксплойт, который добивается выполнения кода в kernel mode (LPE — Local Privilege Escalation), получает контроль над всей машиной, а не только над одним процессом.</p>
<pre data-lang="c"><code>// Пример системного вызова в Linux
#include &lt;unistd.h&gt;
int main() {
    write(1, "Hello, kernel\\n", 14); // переход user -> kernel -> user
    return 0;
}</code></pre>
</div>

<div class="lesson-card"><h3>Процессы и потоки</h3>
<p><b>Процесс</b> — это единица изоляции: у него своё виртуальное адресное пространство, таблица дескрипторов, идентификатор (PID). <b>Поток (thread)</b> — единица планирования внутри процесса; все потоки одного процесса разделяют память, но имеют свой стек и регистры.</p>
<p>ОС управляет процессами через <b>таблицу процессов</b> (Process Control Block в Linux — <code>task_struct</code>), где хранятся PID, состояние, приоритет, открытые файлы, права доступа (UID/GID), пространство имён (namespaces) и cgroups (в контейнерах).</p>
<table><tr><th>Состояние</th><th>Описание</th></tr>
<tr><td>Running</td><td>выполняется на CPU</td></tr>
<tr><td>Ready</td><td>готов, ждёт CPU</td></tr>
<tr><td>Blocked/Waiting</td><td>ждёт ввода-вывода или события</td></tr>
<tr><td>Zombie</td><td>завершился, но родитель не считал код возврата</td></tr></table>
</div>

<div class="warning-block"><h3>Аспект безопасности</h3>
<p>Изоляция процессов не абсолютна: race condition при доступе к разделяемым ресурсам, некорректная проверка UID перед выполнением привилегированной операции, TOCTOU (Time-Of-Check-Time-Of-Use) — классические источники LPE-уязвимостей. Именно поэтому аудит системных вызовов и мониторинг подозрительной активности (auditd, eBPF) — базовая практика harden-инга серверов.</p></div>
`, ["Tanenbaum A., Bos H. «Modern Operating Systems», 4th ed.", "Bovet D., Cesati M. «Understanding the Linux Kernel»", "docs.kernel.org — Process management"])));

    // 3.2
    lessons.push(L("3.2", "Управление памятью и файловые системы", "os", makeContent(3, 2, "Управление памятью и файловые системы", `
<div class="theory-block"><h3>Виртуальная память</h3>
<p>ОС даёт каждому процессу иллюзию собственного линейного адресного пространства через <span class="definition">виртуальную память</span>. Реальное отображение виртуальных адресов на физические страницы RAM выполняет MMU (Memory Management Unit) по таблицам страниц, которые ведёт ядро. Это даёт изоляцию (процесс А не видит память процесса Б) и позволяет использовать своп (swap) на диск.</p></div>

<div class="lesson-card"><h3>Layout адресного пространства процесса</h3>
<p>Классическая карта памяти процесса на Linux/x86-64 (снизу вверх): <b>text</b> (код, read-only), <b>data/bss</b> (глобальные переменные), <b>heap</b> (растёт вверх, malloc/free), незанятое пространство, <b>shared libraries/mmap-регион</b>, <b>stack</b> (растёт вниз, локальные переменные и адреса возврата).</p>
<p>Именно эта раскладка — карта для эксплуатации переполнений буфера (stack overflow, heap overflow) и одновременно карта для защитных механизмов: <b>ASLR</b> рандомизирует базовые адреса, <b>NX/DEP</b> запрещает исполнение данных в стеке и куче, <b>Stack Canary</b> обнаруживает перезапись адреса возврата.</p>
</div>

<div class="lesson-card"><h3>Файловые системы</h3>
<p>ФС организует хранение данных на блочном устройстве через структуры метаданных: <b>inode</b> (Unix-подобные системы: ext4, XFS) хранит атрибуты файла (владелец, права, время, указатели на блоки данных) отдельно от имени файла, которое живёт в каталоге как пара «имя → номер inode». Это позволяет иметь жёсткие ссылки (hard links) на один и тот же inode.</p>
<table><tr><th>ФС</th><th>Особенность</th><th>Где используется</th></tr>
<tr><td>ext4</td><td>журналируемая, зрелая</td><td>Linux по умолчанию</td></tr>
<tr><td>NTFS</td><td>ACL, журнал, шифрование (EFS)</td><td>Windows</td></tr>
<tr><td>APFS</td><td>copy-on-write, снапшоты</td><td>macOS/iOS</td></tr>
<tr><td>ZFS/Btrfs</td><td>checksum данных, снапшоты, RAID</td><td>серверы, NAS</td></tr></table>
</div>

<div class="example-block"><h4>Права доступа как поверхность атаки</h4>
<p>Классическая модель прав Unix (rwx для владельца/группы/остальных) дополняется ACL и специальными битами <code>setuid</code>/<code>setgid</code>/<code>sticky</code>. Бинарник с установленным <code>setuid root</code> выполняется с правами владельца (root), даже если его запустил непривилегированный пользователь — частый источник LPE, если внутри такого бинарника есть уязвимость или он неосторожно вызывает внешние команды.</p>
<pre data-lang="bash"><code># Поиск потенциально опасных setuid-бинарников
find / -perm -4000 -type f 2>/dev/null</code></pre>
</div>
`, ["Love R. «Linux Kernel Development», 3rd ed.", "Russinovich M. «Windows Internals», 7th ed.", "«The Linux Programming Interface», Kerrisk M."])));

    // 3.3
    lessons.push(L("3.3", "Стек TCP/IP и маршрутизация", "net", makeContent(3, 3, "Стек TCP/IP и маршрутизация", `
<div class="theory-block"><h3>Модель OSI vs TCP/IP</h3>
<p>Практическая модель TCP/IP из 4 уровней (канальный, сетевой, транспортный, прикладной) — то, с чем реально работают инструменты анализа трафика. Академическая модель OSI из 7 уровней полезна для терминологии, но на практике инженеры ИБ мыслят в терминах TCP/IP.</p></div>

<div class="lesson-card"><h3>IP: адресация и маршрутизация</h3>
<p>IPv4-адрес — 32 бита, записывается в форме точечной нотации (например, <code>192.168.1.1</code>). Маска подсети определяет границу между сетевой и хостовой частью (CIDR-нотация: <code>/24</code> = 255.255.255.0). Маршрутизатор принимает решение о пересылке пакета на основе таблицы маршрутизации, сопоставляя адрес назначения с наиболее специфичным подходящим маршрутом (longest prefix match).</p>
<p>IPv6 (128 бит) решает проблему исчерпания адресного пространства IPv4 и меняет ряд механизмов (NDP вместо ARP, отсутствие NAT по задумке, встроенный IPsec как опция).</p>
</div>

<div class="lesson-card"><h3>TCP vs UDP</h3>
<table><tr><th>Свойство</th><th>TCP</th><th>UDP</th></tr>
<tr><td>Соединение</td><td>устанавливается (3-way handshake: SYN, SYN-ACK, ACK)</td><td>отсутствует</td></tr>
<tr><td>Надёжность</td><td>гарантирует доставку и порядок</td><td>без гарантий</td></tr>
<tr><td>Применение</td><td>HTTP(S), SSH, база данных</td><td>DNS, видеосвязь, DHCP</td></tr>
</table>
<p>3-way handshake — не только про надёжность, но и про безопасность: атаки типа <b>SYN flood</b> эксплуатируют то, что сервер выделяет ресурсы на полуоткрытые соединения после первого SYN, ещё не получив финальный ACK. Защита — SYN cookies, ограничение backlog, firewall-фильтрация.</p>
</div>

<div class="warning-block"><h3>ARP и его слабости</h3>
<p>ARP (Address Resolution Protocol) сопоставляет IP-адрес с MAC-адресом в локальной сети. Протокол не аутентифицирован — любой узел может разослать поддельный ARP-ответ (<b>ARP spoofing/poisoning</b>), выдав себя, например, за шлюз, и перехватывать трафик жертвы (Man-in-the-Middle). Защита: статические ARP-записи для критичных узлов, Dynamic ARP Inspection на управляемых коммутаторах, сегментация сети.</p></div>
`, ["Stevens W.R. «TCP/IP Illustrated, Volume 1», 2nd ed.", "RFC 793 (TCP), RFC 791 (IP), RFC 826 (ARP)", "Kurose J., Ross K. «Computer Networking: A Top-Down Approach»"])));

    // 3.4
    lessons.push(L("3.4", "DNS, TLS и анализ трафика", "net", makeContent(3, 4, "DNS, TLS и анализ трафика", `
<div class="theory-block"><h3>DNS — телефонная книга интернета</h3>
<p>DNS транслирует доменные имена в IP-адреса через иерархию серверов: корневые → серверы зоны (.ru, .com) → авторитативные серверы домена. Рекурсивный резолвер (например, у провайдера или 8.8.8.8) выполняет всю цепочку запросов от имени клиента и кеширует результат по TTL.</p></div>

<div class="lesson-card"><h3>Атаки на DNS</h3>
<ul>
<li><b>DNS spoofing / cache poisoning</b> — подсунуть резолверу поддельный ответ, чтобы домен жертвы резолвился в IP злоумышленника.</li>
<li><b>DNS tunneling</b> — эксфильтрация данных или C2-канал через DNS-запросы, обходя фаерволы, которые обычно не инспектируют DNS-трафик глубоко.</li>
<li><b>DNS amplification (DDoS)</b> — использование открытых резолверов для многократного усиления объёма трафика, направленного на жертву (запрос с подделанным IP источника).</li>
</ul>
<p><b>Защита:</b> DNSSEC (криптографическая подпись записей зоны), DoH/DoT (DNS поверх HTTPS/TLS для защиты от прослушивания и подмены на пути), мониторинг аномальных объёмов и длины DNS-запросов.</p>
</div>

<div class="lesson-card"><h3>TLS в двух словах</h3>
<p>TLS обеспечивает три свойства для канала связи: <b>конфиденциальность</b> (шифрование), <b>целостность</b> (MAC/AEAD) и <b>аутентификацию</b> (сертификаты x.509, цепочка доверия до корневого CA). Handshake TLS 1.3 согласовывает алгоритмы, обменивается ключами (обычно ECDHE — эфемерный Диффи-Хеллман на эллиптических кривых, что даёт forward secrecy) и проверяет сертификат сервера.</p>
<pre data-lang="bash"><code># Быстрая проверка сертификата сайта из консоли
openssl s_client -connect example.com:443 -servername example.com | openssl x509 -noout -dates -subject -issuer</code></pre>
</div>

<div class="example-block"><h4>Инструменты анализа трафика</h4>
<p><b>Wireshark</b> — GUI-анализатор, разбирает пакеты по протоколам, поддерживает мощные фильтры (<code>tcp.port == 443 && ip.addr == 10.0.0.5</code>). <b>tcpdump</b> — консольный сборщик трафика для серверов без GUI. <b>Zeek (ex-Bro)</b> — сетевой IDS, строит структурированные логи по протоколам для последующего анализа/SIEM. Понимание этих инструментов необходимо и атакующей, и защищающей стороне: пентестеру — для перехвата и анализа, аналитику SOC — для расследования инцидентов.</p>
</div>
`, ["RFC 8446 (TLS 1.3)", "RFC 1035 (DNS)", "Sanders C. «Practical Packet Analysis»", "OWASP DNS Security Cheat Sheet"])));

    return { id: 3, title: "💻 ОС и сети", motto: "Инфраструктура", lessons: lessons,
        literature: [
            "Tanenbaum A., Bos H. «Modern Operating Systems», 4th ed., 2014",
            "Stevens W.R. «TCP/IP Illustrated, Volume 1», 2nd ed., 2011",
            "Kerrisk M. «The Linux Programming Interface», 2010"
        ],
        links: [
            {t: "📘 docs.kernel.org — документация ядра Linux", u: "https://docs.kernel.org/"},
            {t: "🌐 IANA — реестр протоколов и портов", u: "https://www.iana.org/protocols"},
            {t: "🦈 Wireshark — официальный сайт", u: "https://www.wireshark.org/"},
            {t: "📡 RFC Editor — база всех RFC", u: "https://www.rfc-editor.org/"}
        ]
    };
})();
if (!window.__KERNEL_SEMESTERS) window.__KERNEL_SEMESTERS = [];
window.__KERNEL_SEMESTERS.push({ id: 3, data: SEMESTER_3 });
