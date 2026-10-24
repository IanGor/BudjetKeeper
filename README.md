# BudjetKeeper

Общий бюджет на двоих в духе классического CoinKeeper: доходы → счета → категории,
операция — перетаскивание монеты на монету. PWA (iPhone, iPad, Android) + Supabase
(Postgres, Auth, Realtime). План и решения — `docs/PLAN.md`.

## Локальный запуск

```bash
npm install
npx supabase start            # Docker; применяет supabase/migrations
npx supabase status -o env    # API_URL и ANON_KEY → в .env.local (см. .env.example)
npm run dev                   # http://localhost:5173
```

`npm run db:reset` пересоздаёт локальную базу из миграций.

## Проверки

```bash
npm run typecheck
npm test        # юнит-тесты + интеграционные тесты БД (RLS, триггеры, итоги, realtime);
                # тесты БД пропускаются, если .env.local не задан
npm run build
```

## Деплой

1. **Supabase**: создать проект на supabase.com, затем
   `npx supabase link --project-ref <ref>` и `npx supabase db push`.
   - Authentication → URL Configuration: Site URL = адрес фронтенда.
   - Authentication → Providers → Email: «Confirm email» можно выключить —
     пользователей всего двое. Если оставить включённым, приложение попросит подтвердить почту.
2. **Фронтенд** (Cloudflare Pages / Vercel / Netlify): команда сборки `npm run build`,
   каталог `dist`, переменные `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`
   (Project Settings → API). HTTPS обязателен для PWA.
3. На телефоне открыть сайт → «На экран Домой» (iOS Safari) / «Установить приложение» (Android).
   Первый регистрируется и создаёт бюджет, второй регистрируется и вводит код из «Настроек».

## Как пользоваться

- Шторка «Доходы» сверху открывается язычком. Монету дохода тянем на счёт — доход.
- Монету счёта тянем на категорию — расход, на другой счёт — перевод.
  Короткое удержание или движение вниз начинает перетаскивание; горизонтальный свайп листает ряд.
- Тап по монете — история операций (тап по операции — изменить/удалить) и настройки (имя, иконка, план, скрыть).
- «+» в конце каждой секции добавляет элемент. Скрытые элементы возвращаются в «Настройках».
- Счёт показывает баланс за всё время, доходы и категории — сумму за текущий месяц.
