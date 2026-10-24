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
npm test          # юнит-тесты + интеграционные тесты БД (RLS, триггеры, итоги, realtime, закрытая регистрация);
                  # тесты БД пропускаются без .env.local (нужен и SUPABASE_SERVICE_ROLE_KEY локального стека)
npm run test:e2e  # UI-тесты (Playwright) на iPhone 14 Pro — WebKit, с экрана «Домой» и в Safari — и OnePlus 8;
                  # данные для них создаёт e2e/seed.ts в локальном Supabase
npm run build
```

UI-тесты ловят наложение надписей, обрезанный текст, прозрачные шторки, незанятый ряд
категорий и проверяют основные сценарии (перетаскивание, правка операции, баланс, режим правки).
Первый запуск: `npx playwright install webkit chromium`. В CI (`.github/workflows/pages.yml`)
БД- и UI-тесты идут отдельной задачей, деплой ждёт её.

## Деплой

Сайт: https://iangor.github.io/BudjetKeeper/ · Supabase-проект `rqtehljigsoupuobunub`.

1. **Фронтенд** — GitHub Pages, workflow `.github/workflows/pages.yml` на каждый push в `master`
   (typecheck, тесты, сборка с `BASE=/BudjetKeeper/`). URL и publishable-ключ Supabase —
   в переменных репозитория `SUPABASE_URL` и `SUPABASE_PUBLISHABLE_KEY`.
2. **База** — новые миграции из `supabase/migrations`:
   `npx supabase login` (в обычном терминале), `npx supabase link --project-ref rqtehljigsoupuobunub`,
   `npx supabase db push`.
3. **Авторизация** — секция `[auth]` в `supabase/config.toml` (Site URL, подтверждение email выключено)
   совпадает с облаком; после правок — `npx supabase config push`, проверив показанный diff.
4. **Доступ закрыт**: регистрация выключена (`[auth] enable_signup = false`), в бюджете не больше
   `households.max_members` участников (сейчас 2). Чтобы добавить третьего: в SQL Editor
   `update households set max_members = 3;`, затем создать ему аккаунт в Dashboard → Authentication → Add user
   и войти с ним — код приглашения снова появится в «Настройках».
5. На телефоне открыть сайт → «На экран Домой» (iOS Safari) / «Установить приложение» (Android).
   Входят существующие аккаунты; новых регистраций нет.

## Как пользоваться

- Шторка «Доходы» сверху открывается язычком. Монету дохода тянем на счёт — доход.
- Монету счёта тянем на категорию — расход, на другой счёт — перевод.
  Короткое удержание или движение вниз начинает перетаскивание; горизонтальный свайп листает ряд.
- Тап по монете — история операций (тап по операции — изменить/удалить) и настройки (имя, иконка, план, скрыть).
- «+» в конце каждой секции добавляет элемент. Скрытые элементы возвращаются в «Настройках».
- Счёт → «Изменить баланс»: вводится фактический остаток, разница записывается корректировкой
  (видна в истории счёта, не влияет на доходы/расходы месяца).
- Долгое удержание любой монеты (~0,5 с) — режим правки как на экране «Домой» iOS:
  монеты покачиваются, их можно перетащить на новое место в своей секции, «×» скрывает.
  Выход — «Готово», тап по пустому месту или Esc.
- Тема: «Настройки» → «Оформление» (Авто / Светлая / Тёмная).
- Счёт показывает баланс за всё время, доходы и категории — сумму за текущий месяц.
