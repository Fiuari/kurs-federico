# BankHotel — курсова робота

Авторка: Olga-Francesca Federico, група PI-23-01.
Тема: сайт готелю із сервісом онлайн-бронювання номерів.

HTML, CSS, JavaScript; Node.js + Express; Supabase PostgreSQL та Authentication.
Клієнт працює на GitHub Pages, API — на Render. React не використовується.

## Локальний запуск

1. Потрібен Node.js 22 або новіший.
2. У корені проєкту: `npm ci`.
3. Відкрити `index.html` через Live Server на `http://127.0.0.1:5500`.
   Відкриття через `file://` не підтримує нормальну роботу API та сесії.
4. Адреса API в `assets/js/api-config.js`. Зараз налаштовано опублікований Render API.
5. Для локального API: `cd server`, `npm ci`, створити `.env` за `.env.example`,
   виконати `npm start`. Інструкція налаштування Render: `server/SETUP.txt`.
   Для локального API тимчасово встановити його адресу в `assets/js/api-config.js`.

## Структура й оновлення контенту

- `index.html` — головна; каталог номерів читається через API з Supabase.
- `room.html?room=slug` — спільна сторінка будь-якого активного номера з бази.
- `rooms/*.html` — сумісні адреси чотирьох початкових номерів.
- `facilities/*.html` — ресторан, конференц-зал і винний бар.
- `booking.html`, `payment.html`, `auth.html`, `admin.html` — бронювання, демонстраційна оплата, обліковий запис, адміністрування.
- `about.html`, `contacts.html`, `404.html` — інформаційні сторінки та помилка.
- `templates/` і `data/` — шаблони й початкові дані генератора. Для змін шаблонів:
  `node generate-pages.js`. Актуальні номери редагуються через адмінку, не через ці початкові дані.
- `assets/js/translations-uk.js` — переклади; мова зберігається в `sessionStorage`.
  Нові довільні тексти з адмінки показуються мовою введення; автоматичного перекладача немає.
- `supabase/001_initial.sql`–`004_grant_admin.sql` — схема, правила доступу та призначення адміністратора.
  Покрокові інструкції: `supabase/BOOKING_SETUP.txt`, `supabase/ADMIN_SETUP.txt`.

## Фото й CSS Sprite

`npm run build` послідовно оптимізує фото, збирає спрайт і генерує сторінки.
Оригінали фото зберігаються в `assets/img/`; WebP-копії — в `assets/img/optimized/`.
`assets/js/images.js` зіставляє початкові імена з бази з оптимізованими файлами.
Після додавання фото в адмінський список онови збірку та опублікуй нові файли.

`build-sprite.cjs` створює `assets/img/icons/sprite.svg` і `assets/css/sprite.css`.
Шість початкових PNG вбудовуються без перекодування; три полігонні варіанти
зберігають власну геометрію. Стрілки слайдера використовують початкове зображення.
Supabase JS 2.119.2 з MIT-ліцензією збережено локально в `assets/js/vendor/`.

## Перевірки

- `npm test` — DOM, переклад, бронювання, модальні вікна, каталог, спрайт, посилання й структура сторінок.
- `npm run test:security` — SQL/RLS/CRUD у відокремленій локальній PostgreSQL (PGlite), без змін робочої Supabase.
- `npm --prefix server ci`, потім `npm run test:server` — тести Express API з імітацією Supabase.
- `python scripts/validate-w3c.py all` — надсилає публічні HTML/CSS до сервісів W3C;
  потрібен інтернет. Зберігає оригінальні відповіді та SHA-256 у `quality/w3c/`.

Підсумок перевірки та обмеження: `quality/REPORT.txt`.

## Публікація

Згенеровані HTML, WebP, SVG і JS потрібно включити в commit та відправити в GitHub.
GitHub Pages використовує корінь гілки `main`; окрема збірка на Pages не потрібна.
Render використовує каталог `server` та налаштування з `server/SETUP.txt`.
Після публікації перевірити основні сценарії на реальній адресі та виконати
PageSpeed Insights для опублікованих сторінок. Поточна онлайн-оплата — навчальна заглушка.

`.env`, `.env.*` і `node_modules` виключені з Git. Publishable key у браузері публічний;
доступ до даних обмежують RLS та серверна перевірка користувача/ролі.
Серверні secret/service_role ключі чи пароль бази в клієнтський код не додавати.
