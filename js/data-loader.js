// data-loader.js — сборщик базы данных
// Этот файл собирает все семестры в единую структуру LESSON_DATABASE

const LESSON_DATABASE = (function() {
    const DB = { semesters: [] };

    // Проверяем наличие каждого семестра и добавляем
    if (typeof SEMESTER_1 !== 'undefined' && SEMESTER_1) {
        DB.semesters.push(SEMESTER_1);
    }
    if (typeof SEMESTER_2 !== 'undefined' && SEMESTER_2) {
        DB.semesters.push(SEMESTER_2);
    }
    if (typeof SEMESTER_3 !== 'undefined' && SEMESTER_3) {
        DB.semesters.push(SEMESTER_3);
    }
    if (typeof SEMESTER_4 !== 'undefined' && SEMESTER_4) {
        DB.semesters.push(SEMESTER_4);
    }
    if (typeof SEMESTER_5 !== 'undefined' && SEMESTER_5) {
        DB.semesters.push(SEMESTER_5);
    }
    // Добавляй новые семестры по аналогии

    console.log(`📚 Загружено семестров: ${DB.semesters.length}`);
    return DB;
})();
