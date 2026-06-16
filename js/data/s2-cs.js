// Семестр 2: Языки программирования и эксплуатация
const SEMESTER_2 = (function() {
    
    function L(id, title, type, content) {
        return { id, title, type, content };
    }
    function makeContent(semNum, lessonNum, title, bodyHTML, sources) {
        const src = sources ? `<div class="source-block"><h4><i class="fas fa-book"></i> Источники к уроку</h4><ul>${sources.map(s=>`<li>${s}</li>`).join('')}</ul></div>` : '';
        return `<h1>Урок ${semNum}.${lessonNum}: ${title}</h1>${bodyHTML}${src}`;
    }

    const lessons = [];

    // 2.1
    lessons.push(L("2.1", "Модель памяти процесса в C", "cs", makeContent(2, 1, "Модель памяти процесса в C", `
<div class="theory-block"><h3>Базовые знания для эксплуатации уязвимостей</h3>
<p>Любая атака на память — манипуляция сегментами процесса. Понимание архитектуры памяти — необходимое условие для написания эксплойтов и создания защищённых приложений. Современные защитные механизмы (ASLR, NX, PIE, Stack Canary) опираются именно на сегментную организацию памяти.</p>
<p>Модель памяти процесса в C — это не просто академическая абстракция. Это карта, по которой ориентируется злоумышленник. Знание того, где лежат код, данные, стек и куча, позволяет целенаправленно искать уязвимости и разрабатывать эксплойты под конкретные условия.</p></div>

<div class="lesson-card"><h3>Пять сегментов процесса</h3>
<table><tr><th>Сегмент</th><th>Содержимое</th><th>Права доступа</th><th>Направление роста</th></tr>
<tr><td><b>Text (Код)</b></td><td>Машинные инструкции программы</td><td>r-x (чтение, выполнение)</td><td>Фиксирован</td></tr>
<tr><td><b>Data</b></td><td>Инициализированные глобальные и статические переменные</td><td>rw- (чтение, запись)</td><td>Фиксирован</td></tr>
<tr><td><b>BSS</b></td><td>Неинициализированные глобальные и статические переменные (обнуляются при старте)</td><td>rw-</td><td>Фиксирован</td></tr>
<tr><td><b>Heap (Куча)</b></td><td>Динамически выделяемая память (malloc, calloc, realloc, new в C++)</td><td>rw-</td><td>↑ Вверх (к старшим адресам)</td></tr>
<tr><td><b>Stack (Стек)</b></td><td>Локальные переменные, аргументы функций, адреса возврата, сохранённые регистры</td><td>rw-</td><td>↓ Вниз (к младшим адресам)</td></tr></table></div>

<div class="lesson-card"><h3>Детальное устройство стека</h3>
<p>Кадр стека (stack frame) для функции состоит из:</p>
<ol>
<li><b>Аргументы функции</b> (в x86-64 первые 6 в регистрах, остальные на стеке).</li>
<li><b>Адрес возврата</b> (куда перейти после завершения функции).</li>
<li><b>Сохранённый RBP</b> (указатель базы предыдущего кадра).</li>
<li><b>Локальные переменные</b> (в порядке объявления, но компилятор может переупорядочивать).</li>
<li><b>Буферы</b> (массивы символов и т.п.).</li>
</ol></div>

<div class="warning-block"><h4>Конфликт Stack и Heap</h4>
<p>Стек растёт от старших адресов к младшим, куча — наоборот. При неограниченной рекурсии или утечке памяти они могут столкнуться — это называется <b>memory exhaustion</b>. Злоумышленник может намеренно спровоцировать такую ситуацию для вызова отказа в обслуживании (DoS).</p></div>

<div class="example-block"><h4>ИБ-пример: перезапись адреса возврата</h4>
<p>Если буфер на стеке переполняется, лишние данные затирают сначала локальные переменные, затем сохранённый RBP, и наконец — адрес возврата. Злоумышленник может подменить адрес возврата на адрес своего шелл-кода, размещённого в том же буфере (если стек исполняемый) или в другом месте памяти.</p></div>`, ["Bryant R., O'Hallaron D. «Computer Systems: A Programmer's Perspective», Глава 3","Kernighan B., Ritchie D. «The C Programming Language»","Erickson J. «Hacking: The Art of Exploitation»"])));

    // 2.2
    lessons.push(L("2.2", "Указатели и адресная арифметика", "cs", makeContent(2, 2, "Указатели и адресная арифметика", `
<div class="theory-block"><h3>Указатели — ключ к памяти</h3>
<p>Указатели в C — это прямой доступ к памяти. Именно из-за них C одновременно и мощный инструмент системного программирования, и источник большинства уязвимостей. Неправильная работа с указателями приводит к переполнениям буфера, чтению произвольной памяти, разыменованию нулевых указателей и другим критическим ошибкам.</p></div>

<div class="lesson-card"><h3>Синтаксис указателей</h3>
<pre data-lang="C">int x = 42;        // выделено 4 байта на стеке, значение 42
int *p = &x;       // оператор & — «взять адрес». p хранит адрес x
*p = 10;           // оператор * — разыменование. Запись 10 по адресу p
p++;               // арифметика указателей: сдвиг на sizeof(int)=4 байта</pre>
<p>Указатель — это переменная, хранящая адрес другой переменной. На 64-битной системе указатель занимает 8 байт.</p></div>

<div class="lesson-card"><h3>Арифметика указателей</h3>
<p>Если <code>p</code> — указатель типа <code>T*</code>, то <code>p + n</code> сдвигает адрес на <code>n * sizeof(T)</code> байт. Примеры:</p>
<ul>
<li><code>int *p; p++</code> → +4 байта.</li>
<li><code>char *p; p++</code> → +1 байт.</li>
<li><code>double *p; p++</code> → +8 байт.</li>
</ul></div>

<div class="lesson-card"><h3>Указатели и массивы</h3>
<p>Имя массива — это указатель на его первый элемент:</p>
<pre data-lang="C">int arr[5] = {1, 2, 3, 4, 5};
int *p = arr;       // p указывает на arr[0]
p[2] = 99;          // эквивалентно *(p+2) = 99; теперь arr[2] = 99</pre>
<p><b>Важно:</b> <code>arr[i]</code> полностью эквивалентно <code>*(arr + i)</code>. Компилятор не проверяет выход за границы массива — это ответственность программиста.</p></div>

<div class="warning-block"><h4>Правила безопасности указателей</h4>
<ol>
<li>Всегда инициализируйте указатели (или присваивайте NULL).</li>
<li>Проверяйте на NULL перед разыменованием.</li>
<li>Не возвращайте указатель на локальную переменную (после выхода из функции память освобождается).</li>
<li>После free() обнуляйте указатель (предотвращение use-after-free).</li>
<li>Не выходите за границы выделенной памяти.</li>
</ol></div>

<div class="example-block"><h4>ИБ-пример: уязвимость Heartbleed (CVE-2014-0160)</h4>
<p>В OpenSSL запрос heartbeat содержал длину данных, но сервер не проверял, соответствует ли эта длина реальному размеру буфера. Сервер копировал лишние байты из соседней памяти и отправлял их злоумышленнику. Это прямая ошибка работы с указателями и границами буфера.</p></div>`, ["Kernighan B., Ritchie D. «The C Programming Language»","Prata S. «C Primer Plus»","Bryant R., O'Hallaron D. «Computer Systems: A Programmer's Perspective», Глава 3"])));

    // 2.3
    lessons.push(L("2.3", "Переполнение буфера в стеке", "cs", makeContent(2, 3, "Переполнение буфера в стеке", `
<div class="theory-block"><h3>Классическая уязвимость</h3>
<p>Stack Buffer Overflow — исторически первая широко используемая уязвимость (Morris Worm, 1988). Программа выделяет на стеке буфер фиксированного размера. Злоумышленник подаёт данные большего размера, чем буфер. Избыточные байты последовательно затирают: соседние локальные переменные → сохранённый RBP → адрес возврата. Когда функция выполняет RET, управление передаётся по адресу, указанному злоумышленником — обычно это адрес шелл-кода.</p></div>

<div class="lesson-card"><h3>Схема стека до и после атаки</h3>
<pre data-lang="До переполнения">
[ buf (8 байт) ][ RBP (8 байт) ][ RET (8 байт) ]
[ A A A A A A A A ][ 0x7fffffffe100 ][ 0x40123456 ]</pre>
<pre data-lang="После переполнения">
[ A A A A A A A A ][ B B B B B B B B ][ 0x7fffffffe200 ]
    буфер               затёрт RBP         новый адрес → шелл-код</pre>
<p>Злоумышленник помещает в буфер: шелл-код + мусор (до RET) + адрес начала буфера (записывается на место RET). Когда функция возвращается, RET читает адрес буфера и передаёт управление на шелл-код.</p></div>

<div class="lesson-card"><h3>Пример уязвимой программы</h3>
<pre data-lang="C">
#include &lt;string.h&gt;

void vulnerable(char *input) {
    char buffer[8];          // буфер на 8 байт
    strcpy(buffer, input);   // НЕТ проверки длины!
}

int main(int argc, char **argv) {
    vulnerable(argv[1]);     // читаем аргумент командной строки
    return 0;
}
</pre>
<p>Если подать аргумент длиной 16+ байт — переполнение гарантировано.</p></div>

<div class="warning-block"><h4>Современные защиты</h4>
<ul>
<li><b>Stack Canary:</b> случайное значение между буфером и RET. Проверяется перед возвратом — если изменено, программа аварийно завершается.</li>
<li><b>NX-бит (DEP):</b> стек и куча помечены как неисполняемые. Шелл-код на стеке не выполнится — нужно использовать ROP.</li>
<li><b>ASLR:</b> случайные адреса загрузки библиотек, стека и кучи при каждом запуске. Атакующий не знает точного адреса буфера.</li>
<li><b>PIE:</b> позиционно-независимый исполняемый файл — даже код программы загружается по случайному адресу.</li>
<li><b>Full RELRO:</b> GOT-таблица недоступна для записи, что предотвращает атаки перезаписи указателей.</li>
</ul></div>

<div class="example-block"><h4>Обход Stack Canary</h4>
<p>Если программа печатает содержимое буфера (уязвимость форматной строки), злоумышленник может прочитать значение канарейки и воспроизвести его в эксплойте. Другой способ — перезаписать не RET, а другие указатели (например, сохранённые регистры, указывающие на буферы в куче).</p></div>`, ["Erickson J. «Hacking: The Art of Exploitation»","Anley C. et al. «The Shellcoder's Handbook»","Bryant R., O'Hallaron D. «Computer Systems: A Programmer's Perspective», Глава 5"])));

    // 2.4
    lessons.push(L("2.4", "Ассемблер x86-64: регистры", "cs", makeContent(2, 4, "Ассемблер x86-64: регистры и их назначение", `
<div class="theory-block"><h3>Зачем знать ассемблер специалисту по ИБ?</h3>
<p>Ассемблер — язык, на котором «думает» процессор. Для специалиста по компьютерной безопасности знание ассемблера необходимо для:</p>
<ul>
<li><b>Анализа вредоносного ПО:</b> вирусы часто распространяются в бинарном виде без исходного кода.</li>
<li><b>Поиска уязвимостей:</b> дизассемблирование позволяет увидеть, что программа делает на самом деле.</li>
<li><b>Написания эксплойтов:</b> шелл-код пишется на ассемблере.</li>
<li><b>Обратной разработки:</b> восстановление алгоритмов из бинарного кода.</li>
<li><b>Low-level отладки:</b> понимание, как high-level конструкции транслируются в машинные инструкции.</li>
</ul></div>

<div class="lesson-card"><h3>Регистры общего назначения x86-64</h3>
<table>
<tr><th>64-бит</th><th>32-бит</th><th>16-бит</th><th>8-бит</th><th>Назначение</th></tr>
<tr><td><b>RAX</b></td><td>EAX</td><td>AX</td><td>AL</td><td>Аккумулятор, возвращаемое значение функции</td></tr>
<tr><td><b>RBX</b></td><td>EBX</td><td>BX</td><td>BL</td><td>База, сохраняемый регистр (callee-saved)</td></tr>
<tr><td><b>RCX</b></td><td>ECX</td><td>CX</td><td>CL</td><td>Счётчик циклов, 4-й аргумент в System V</td></tr>
<tr><td><b>RDX</b></td><td>EDX</td><td>DX</td><td>DL</td><td>Данные, 3-й аргумент, остаток деления</td></tr>
<tr><td><b>RSI</b></td><td>ESI</td><td>SI</td><td>SIL</td><td>Индекс источника, 2-й аргумент</td></tr>
<tr><td><b>RDI</b></td><td>EDI</td><td>DI</td><td>DIL</td><td>Индекс приёмника, 1-й аргумент</td></tr>
<tr><td><b>RSP</b></td><td>ESP</td><td>SP</td><td>SPL</td><td>Указатель вершины стека (Stack Pointer)</td></tr>
<tr><td><b>RBP</b></td><td>EBP</td><td>BP</td><td>BPL</td><td>Указатель базы кадра стека (Base Pointer)</td></tr>
<tr><td><b>RIP</b></td><td>EIP</td><td>IP</td><td>—</td><td>Указатель текущей инструкции (Instruction Pointer)</td></tr>
</table></div>

<div class="lesson-card"><h3>Дополнительные регистры x86-64</h3>
<table>
<tr><th>64-бит</th><th>Назначение</th></tr>
<tr><td><b>R8 – R9</b></td><td>5-й и 6-й аргументы функций (System V ABI)</td></tr>
<tr><td><b>R10 – R11</b></td><td>Временные (caller-saved), используются в цепочках вызовов</td></tr>
<tr><td><b>R12 – R15</b></td><td>Сохраняемые (callee-saved), для долгоживущих переменных</td></tr>
<tr><td><b>RFLAGS</b></td><td>Регистр флагов: CF (перенос), ZF (ноль), SF (знак), OF (переполнение)</td></tr>
</table></div>

<div class="lesson-card"><h3>Соглашение о вызовах System V AMD64 (Linux)</h3>
<ol>
<li><b>Аргументы</b> передаются в регистрах: RDI, RSI, RDX, RCX, R8, R9. Остальные — через стек (в обратном порядке).</li>
<li><b>Возвращаемое значение</b> — в RAX (64 бита) или RAX+RDX (128 бит).</li>
<li><b>Caller-saved:</b> RAX, RCX, RDX, RSI, RDI, R8-R11. Вызывающая функция должна сохранить их перед вызовом, если они нужны.</li>
<li><b>Callee-saved:</b> RBX, RBP, R12-R15. Вызываемая функция обязана восстановить их перед возвратом.</li>
<li><b>Стек</b> должен быть выровнен на 16 байт перед инструкцией CALL.</li>
</ol></div>

<div class="example-block"><h4>ИБ-пример: чтение RIP через CALL</h4>
<p>Шелл-код часто использует приём для получения своего текущего адреса:</p>
<pre data-lang="x86-64 ASM">
call get_addr
get_addr:
    pop rax       ; RAX = адрес инструкции pop (т.е. текущий RIP)
    ; теперь RAX указывает на этот код — можно адресовать данные рядом
</pre>
<p>Инструкция CALL кладёт адрес возврата на стек. Мы его тут же забираем через POP — это стандартный трюк для position-independent shellcode.</p></div>`, ["Gustafson D. «Assembly Language for x86 Processors»","Intel® 64 and IA-32 Architectures Software Developer's Manual","Bryant R., O'Hallaron D. «Computer Systems: A Programmer's Perspective», Глава 3"])));

    // 2.5
    lessons.push(L("2.5", "Соглашения о вызовах (calling conventions)", "cs", makeContent(2, 5, "Соглашения о вызовах (calling conventions)", `
<div class="theory-block"><h3>Контракт между вызывающим и вызываемым</h3>
<p>Соглашение о вызовах (calling convention) — это набор правил, определяющих:</p>
<ul>
<li>Как передаются аргументы (регистры или стек)</li>
<li>Как возвращается результат</li>
<li>Кто сохраняет регистры (caller или callee)</li>
<li>Как выравнивается стек</li>
</ul>
<p>Знание calling conventions критично для написания эксплойтов: нужно знать, где на стеке или в регистрах лежат аргументы уязвимой функции, как передать управление на system() или mprotect().</p></div>

<div class="lesson-card"><h3>System V AMD64 ABI (Linux, macOS)</h3>
<table><tr><th>Параметр</th><th>Регистр</th></tr>
<tr><td>1-й аргумент</td><td>RDI</td></tr>
<tr><td>2-й аргумент</td><td>RSI</td></tr>
<tr><td>3-й аргумент</td><td>RDX</td></tr>
<tr><td>4-й аргумент</td><td>RCX</td></tr>
<tr><td>5-й аргумент</td><td>R8</td></tr>
<tr><td>6-й аргумент</td><td>R9</td></tr>
<tr><td>7-й и далее</td><td>На стеке (справа налево)</td></tr>
<tr><td>Возврат</td><td>RAX</td></tr>
</table></div>

<div class="lesson-card"><h3>Microsoft x64 ABI (Windows)</h3>
<p>Отличается от System V:</p>
<ul>
<li>Первые 4 аргумента: RCX, RDX, R8, R9</li>
<li>Остальные — на стеке</li>
<li>Требуется shadow space (32 байта на стеке) для сохранения аргументов</li>
<li>Caller должен выделить место для shadow space даже если callee его не использует</li>
</ul></div>

<div class="example-block"><h4>ИБ-пример: передача "/bin/sh" в system()</h4>
<p>Чтобы вызвать <code>system("/bin/sh")</code> через переполнение буфера:</p>
<pre data-lang="ROP-цепочка">
pop rdi; ret;           // гаджет: достаём адрес строки в RDI
0x68732f6e69622f;       // адрес строки "/bin/sh" в памяти
system@plt;             // адрес функции system() в PLT
</pre>
<p>Понимание того, что первый аргумент идёт в RDI — ключ к построению этой цепочки.</p></div>`, ["Intel® 64 and IA-32 Architectures Software Developer's Manual","Anley C. et al. «The Shellcoder's Handbook»","System V Application Binary Interface AMD64"])));

    // 2.6
    lessons.push(L("2.6", "Инструкции CALL, RET и стек", "cs", makeContent(2, 6, "Инструкции CALL, RET и манипуляции со стеком", `
<div class="theory-block"><h3>Стек как основа потока управления</h3>
<p>Инструкции CALL и RET — фундамент механизма вызова функций. Их понимание необходимо для атак переполнения буфера и ROP (Return-Oriented Programming). Каждая манипуляция со стеком — потенциальный вектор атаки.</p></div>

<div class="lesson-card"><h3>CALL — вызов функции</h3>
<p>Инструкция <code>CALL &lt;адрес&gt;</code> делает два действия атомарно:</p>
<ol>
<li>Декрементирует RSP на 8 (на 64-битной системе)</li>
<li>Сохраняет RIP (адрес следующей инструкции) на вершину стека</li>
<li>Переходит по указанному адресу</li>
</ol>
<p><b>Эквивалентно:</b></p>
<pre data-lang="Псевдокод">
PUSH адрес_следующей_инструкции
JMP целевой_адрес
</pre></div>

<div class="lesson-card"><h3>RET — возврат из функции</h3>
<p>Инструкция <code>RET</code> делает:</p>
<ol>
<li>Читает 8 байт с вершины стека (по RSP)</li>
<li>Записывает их в RIP</li>
<li>Инкрементирует RSP на 8</li>
</ol>
<p><b>Эквивалентно:</b></p>
<pre data-lang="Псевдокод">
POP RIP
</pre>
<p>Если злоумышленник перезаписал адрес возврата в стеке, RET передаст управление по его адресу.</p></div>

<div class="lesson-card"><h3>PUSH и POP</h3>
<table><tr><th>Инструкция</th><th>Действие</th></tr>
<tr><td><code>PUSH src</code></td><td>RSP -= 8; [RSP] = src</td></tr>
<tr><td><code>POP dst</code></td><td>dst = [RSP]; RSP += 8</td></tr>
<tr><td><code>PUSHFQ</code></td><td>Сохранить RFLAGS на стек</td></tr>
<tr><td><code>POPFQ</code></td><td>Восстановить RFLAGS со стека</td></tr></table></div>

<div class="warning-block"><h4>Атака: подмена адреса возврата</h4>
<pre data-lang="Уязвимый код">
void foo(char *s) {
    char buf[16];
    strcpy(buf, s);  // переполнение
}
// Злоумышленник передаёт 24 байта: 16 байт мусора + 8 байт адреса шелл-кода
</pre>
<p>Когда foo выполняет RET, RSP указывает на затёртый адрес возврата. RET загружает его в RIP — и процессор переходит на шелл-код.</p></div>`, ["Intel® 64 and IA-32 Architectures Software Developer's Manual, Vol. 2","Bryant R., O'Hallaron D. «Computer Systems: A Programmer's Perspective», Глава 3","Erickson J. «Hacking: The Art of Exploitation»"])));

    // 2.7
    lessons.push(L("2.7", "Шелл-код: пишем /bin/sh", "cs", makeContent(2, 7, "Шелл-код: пишем /bin/sh", `
<div class="theory-block"><h3>Что такое шелл-код?</h3>
<p>Шелл-код (shellcode) — это фрагмент машинного кода, который злоумышленник внедряет в память уязвимой программы для получения контроля над системой. Традиционная цель — запуск командной оболочки (/bin/sh), откуда и название. Современный шелл-код может быть многоступенчатым: загрузчик, который скачивает и выполняет основной модуль.</p></div>

<div class="lesson-card"><h3>Системный вызов execve("/bin/sh")</h3>
<p>На Linux запуск оболочки делается через системный вызов <code>execve</code> (номер 59 в x86-64):</p>
<pre data-lang="Сигнатура">
int execve(const char *path, char *const argv[], char *const envp[]);
// syscall number: 59 (0x3B)
</pre>
<p>Регистры для syscall (x86-64):</p>
<ul>
<li><b>RAX</b> = 59 (номер execve)</li>
<li><b>RDI</b> = указатель на строку "/bin/sh"</li>
<li><b>RSI</b> = argv (может быть NULL, если не передаём аргументы)</li>
<li><b>RDX</b> = envp (может быть NULL)</li>
</ul></div>

<div class="lesson-card"><h3>Минимальный шелл-код для /bin/sh</h3>
<pre data-lang="x86-64 ASM">
section .text
global _start
_start:
    ; Строка "/bin/sh\0" — 8 байт в шестнадцатеричном виде
    ; /bin/sh\0 = 0x0068732f6e69622f
    xor rsi, rsi              ; RSI = 0 (argv = NULL)
    xor rdx, rdx              ; RDX = 0 (envp = NULL)
    push rdx                  ; нуль-терминатор на стек
    mov rax, 0x68732f6e69622f ; "/bin/sh" (в обратном порядке байт)
    push rax                  ; кладём строку на стек
    mov rdi, rsp              ; RDI = указатель на "/bin/sh"
    mov rax, 59               ; номер syscall execve
    syscall                   ; вызов ядра
</pre>
<p><b>Размер:</b> около 30 байт в машинном коде.</p></div>

<div class="lesson-card"><h3>Ограничения шелл-кода</h3>
<ul>
<li><b>Нет нулевых байт</b> — strcpy и другие функции останавливаются на \0</li>
<li><b>Минимальный размер</b> — маленькие буферы требуют компактного кода</li>
<li><b>Обход NX/DEP</b> — если стек неисполняемый, шелл-код не сработает</li>
<li><b>ASLR</b> — абсолютные адреса неизвестны заранее</li>
</ul></div>

<div class="example-block"><h4>Устранение нулевых байт</h4>
<pre data-lang="Вместо">
mov rax, 59          ; 48 C7 C0 3B 00 00 00 — содержит \0
; Пишем:
xor rax, rax
mov al, 59           ; 48 31 C0 B0 3B — без нулей!
</pre></div>`, ["Anley C. et al. «The Shellcoder's Handbook»","Erickson J. «Hacking: The Art of Exploitation»","Intel® 64 and IA-32 Architectures Software Developer's Manual, Vol. 2A (SYSCALL)"])));

    // 2.8
    lessons.push(L("2.8", "Уязвимость форматной строки", "cs", makeContent(2, 8, "Уязвимость форматной строки (Format String)", `
<div class="theory-block"><h3>Недооценённая опасность</h3>
<p>Уязвимость форматной строки возникает, когда программа передаёт пользовательский ввод как первый аргумент в функции форматированного вывода (printf, sprintf, fprintf). Злоумышленник может читать произвольную память и записывать в произвольные адреса.</p></div>

<div class="lesson-card"><h3>Как это работает</h3>
<pre data-lang="C">
// Уязвимый код:
char input[256];
gets(input);
printf(input);     // ← УЯЗВИМОСТЬ: пользователь контролирует строку формата

// Правильно:
printf("%s", input);  // строка формата фиксирована
</pre>
<p>Спецификаторы формата (%x, %n, %s) читают аргументы со стека. Если программист не передал аргументы, printf всё равно читает данные со стека по инерции — это позволяет читать стек.</p></div>

<div class="lesson-card"><h3>Спецификаторы формата</h3>
<table><tr><th>Спецификатор</th><th>Действие</th><th>Использование в атаке</th></tr>
<tr><td><code>%x</code></td><td>Вывести аргумент в hex</td><td>Чтение стека</td></tr>
<tr><td><code>%p</code></td><td>Вывести указатель</td><td>Чтение адресов</td></tr>
<tr><td><code>%s</code></td><td>Вывести строку по адресу</td><td>Чтение произвольной памяти</td></tr>
<tr><td><code>%n</code></td><td><b>Записать</b> количество выведенных байт по адресу</td><td>Запись в произвольный адрес</td></tr>
<tr><td><code>%10$x</code></td><td>Вывести 10-й аргумент</td><td>Доступ к глубоким участкам стека</td></tr></table></div>

<div class="warning-block"><h4>%n — главная опасность</h4>
<p><code>%n</code> не читает, а <b>пишет</b>! Он записывает количество уже выведенных символов в адрес, переданный как аргумент.</p>
<pre data-lang="Пример атаки">
printf("AAAA%n", &counter);  // запишет 4 в counter
// Если злоумышленник может указать адрес на стеке:
// "\xfc\xd9\xff\xff%10%n" — запишет небольшое число в 0xffffd9fc
// (например, адрес возврата или GOT-запись)
</pre></div>

<div class="example-block"><h4>Использование: перезапись GOT</h4>
<p>GOT (Global Offset Table) содержит адреса библиотечных функций. Перезаписав GOT-запись printf на адрес system, злоумышленник превращает <code>printf("hello")</code> в <code>system("hello")</code>.</p></div>`, ["Erickson J. «Hacking: The Art of Exploitation»","Anley C. et al. «The Shellcoder's Handbook»","CWE-134: Use of Externally-Controlled Format String"])));

    // 2.9
    lessons.push(L("2.9", "Heap overflow и use-after-free", "cs", makeContent(2, 9, "Heap overflow и use-after-free", `
<div class="theory-block"><h3>Уязвимости кучи</h3>
<p>В отличие от стека, куча управляется аллокатором (malloc/free). Уязвимости в куче сложнее эксплуатировать, но они не менее опасны: переполнение в куче может привести к выполнению произвольного кода, а use-after-free — к чтению/записи в освобождённую память.</p></div>

<div class="lesson-card"><h3>Heap overflow</h3>
<p>Аналогично переполнению стека, но в динамически выделенной памяти:</p>
<pre data-lang="C">
char *buf = malloc(8);
char *meta = malloc(16);  // метаданные аллокатора рядом
strcpy(buf, "AAAAAAAAAAAAAAAAAAA"); // переполнение!
// Лишние байты затирают метаданные meta или данные других выделений
</pre></div>

<div class="lesson-card"><h3>Use-After-Free (UAF)</h3>
<p>Обращение к памяти после её освобождения:</p>
<pre data-lang="C">
char *ptr = malloc(16);
free(ptr);           // память освобождена
// ... много кода ...
strcpy(ptr, "evil"); // ← UAF! ptr — висячий указатель
</pre>
<p>Если после free() аллокатор выделил ту же память под другой объект, запись повредит его.</p></div>

<div class="warning-block"><h4>Double Free</h4>
<pre data-lang="C">
free(ptr);
free(ptr);  // ← Двойное освобождение! Повреждает структуры аллокатора.
</pre>
<p>Double free может позволить злоумышленнику создать цикл в списках свободных блоков и добиться выделения памяти по произвольному адресу.</p></div>`, ["Anley C. et al. «The Shellcoder's Handbook»","Sikorski M., Honig A. «Practical Malware Analysis»","CWE-416: Use After Free", "CWE-415: Double Free"])));

    // 2.10
    lessons.push(L("2.10", "Целочисленные переполнения", "cs", makeContent(2, 10, "Целочисленные переполнения", `
<div class="theory-block"><h3>Арифметика, которая ломает безопасность</h3>
<p>Целочисленное переполнение происходит, когда результат арифметической операции выходит за пределы типа данных. В контексте безопасности это часто приводит к выделению недостаточного буфера и последующему переполнению.</p></div>

<div class="lesson-card"><h3>Виды целочисленных уязвимостей</h3>
<table><tr><th>Тип</th><th>Пример</th><th>Последствие</th></tr>
<tr><td>Переполнение сложения</td><td><code>255 + 1 = 0 (uint8_t)</code></td><td>Слишком маленький буфер</td></tr>
<tr><td>Потеря значимости</td><td><code>0 - 1 = 255 (uint8_t)</code></td><td>Огромный размер копирования</td></tr>
<tr><td>Знаковое/беззнаковое</td><td><code>(int)-1 > (unsigned)100</code></td><td>Обход проверки границ</td></tr>
<tr><td>Усечение</td><td><code>0x10001 → 0x0001 (16 бит)</code></td><td>Неверный размер выделения</td></tr></table></div>

<div class="example-block"><h4>Классика: malloc(0)</h4>
<pre data-lang="C">
unsigned int n = atoi(input);  // контролируется злоумышленником
unsigned int size = n * 16;     // если n > 268435455, size переполнится
char *buf = malloc(size);       // size может быть очень малым
strcpy(buf, big_string);        // переполнение!
</pre></div>`, ["CWE-190: Integer Overflow or Wraparound","Anley C. et al. «The Shellcoder's Handbook»","Seacord R. «Secure Coding in C and C++»"])));

    // 2.11
    lessons.push(L("2.11", "Защитные механизмы компиляторов", "cs", makeContent(2, 11, "Защитные механизмы компиляторов", `
<div class="theory-block"><h3>Эшелонированная оборона</h3>
<p>Современные компиляторы и операционные системы реализуют многоуровневую защиту от эксплуатации уязвимостей. Понимание каждого механизма необходимо для обхода защит при пентесте и правильной настройки при разработке.</p></div>

<div class="lesson-card"><h3>Обзор защит</h3>
<table><tr><th>Механизм</th><th>Защищает от</th><th>Обход</th></tr>
<tr><td><b>NX/DEP</b></td><td>Выполнения кода на стеке/куче</td><td>ROP, ret2libc</td></tr>
<tr><td><b>ASLR</b></td><td>Предсказуемых адресов</td><td>Утечка адреса, brute force</td></tr>
<tr><td><b>Stack Canary</b></td><td>Перезаписи адреса возврата</td><td>Утечка канарейки, обход через другие указатели</td></tr>
<tr><td><b>PIE</b></td><td>Фиксированного адреса исполняемого файла</td><td>Частичная перезапись, утечка базы</td></tr>
<tr><td><b>Full RELRO</b></td><td>Перезаписи GOT</td><td>Неприменимо (GOT read-only), ищем другие цели</td></tr>
<tr><td><b>FORTIFY_SOURCE</b></td><td>Опасных функций (strcpy, sprintf)</td><td>Нестандартные пути переполнения</td></tr>
</table></div>

<div class="lesson-card"><h3>Как проверить защиты бинарного файла</h3>
<pre data-lang="Bash">
checksec --file=./target      # утилита pwntools
readelf -l ./target | grep GNU_STACK  # проверка NX
</pre></div>`, ["Bryant R., O'Hallaron D. «Computer Systems: A Programmer's Perspective», Глава 5","Anley C. et al. «The Shellcoder's Handbook»","GCC Manual: -fstack-protector, -pie, -Wl,-z,relro"])));

    // 2.12
    lessons.push(L("2.12", "ROP-цепи", "cs", makeContent(2, 12, "ROP-цепи (Return-Oriented Programming)", `
<div class="theory-block"><h3>Обход неисполняемого стека</h3>
<p>Return-Oriented Programming (ROP) — техника, позволяющая выполнять произвольный код даже при включённом NX-бите. Вместо внедрения своего кода злоумышленник использует уже существующие в программе и библиотеках фрагменты кода (гаджеты), заканчивающиеся на RET.</p></div>

<div class="lesson-card"><h3>Что такое ROP-гаджет?</h3>
<p>Гаджет — это короткая последовательность инструкций, заканчивающаяся на RET:</p>
<pre data-lang="Примеры гаджетов">
pop rdi; ret;              # загрузить значение в RDI
pop rsi; ret;              # загрузить значение в RSI
mov rax, [rdi]; ret;       # прочитать память
xor rax, rax; ret;         # обнулить RAX
syscall; ret;              # системный вызов (если есть)
</pre></div>

<div class="lesson-card"><h3>Как строится ROP-цепь</h3>
<ol>
<li>Переполнение стека затирает адрес возврата</li>
<li>Вместо одного адреса пишется цепочка: адрес гаджета 1, его данные, адрес гаджета 2, его данные...</li>
<li>Каждый RET передаёт управление следующему гаджету</li>
</ol>
<pre data-lang="Стек после атаки">
[ адрес pop_rdi  ]  ← первый RET берёт этот адрес
[ адрес "/bin/sh" ]  ← значение, которое pop rdi положит в RDI
[ адрес system    ]  ← следующий RET → system("/bin/sh")
</pre></div>

<div class="example-block"><h4>Поиск гаджетов</h4>
<pre data-lang="Bash">
ROPgadget --binary ./target     # ищет гаджеты в бинарном файле
ROPgadget --binary /lib/x86_64-linux-gnu/libc.so.6  # в библиотеке
</pre>
<p>Даже в небольшом бинарном файле могут найтись сотни гаджетов — этого достаточно для построения Turing-полной ROP-цепи.</p></div>`, ["Anley C. et al. «The Shellcoder's Handbook»","Roemer R. et al. «Return-Oriented Programming: Systems, Languages, and Applications»","pwntools documentation"])));

    return {
        id: 2,
        title: "Языки программирования и эксплуатация",
        motto: "C и ассемблер",
        lessons: lessons,
        literature: [
            "📘 Kernighan B., Ritchie D. «The C Programming Language» (K&R) — библия C.",
            "📘 Bryant R., O'Hallaron D. «Computer Systems: A Programmer's Perspective» (CS:APP).",
            "📘 Erickson J. «Hacking: The Art of Exploitation» — эксплуатация уязвимостей.",
            "📘 Anley C. et al. «The Shellcoder's Handbook» — продвинутая эксплуатация.",
            "📘 Sikorski M., Honig A. «Practical Malware Analysis».",
            "📄 Intel® 64 and IA-32 Architectures Software Developer's Manual.",
            "📘 Prata S. «C Primer Plus» — подробный учебник C.",
            "📘 Gustafson D. «Assembly Language for x86 Processors»."
        ],
        links: [
            {t:"🔬 Compiler Explorer (Godbolt) — C → Asm", u:"https://godbolt.org/"},
            {t:"🎮 pwn.college — практика эксплуатации", u:"https://pwn.college/"},
            {t:"🎮 Microcorruption — CTF MSP430", u:"https://microcorruption.com/"},
            {t:"📋 GDB Cheat Sheet", u:"https://darkdust.net/files/GDB%20Cheat%20Sheet.pdf"},
            {t:"🔧 IDA Free — дизассемблер", u:"https://hex-rays.com/ida-free/"},
            {t:"🔧 Ghidra — reverse engineering", u:"https://ghidra-sre.org/"}
        ]
    };
})();
