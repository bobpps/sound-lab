# Code Review: feat/26-tts-selection

## Дублирование кода и нарушение DRY

### [DRY-1] `useDialogs` — дубликат хука из datasets  **[Major]**
**Файл:** `frontend/src/features/tts/api/queries.ts:32-37`
**Что не так:** Создан новый хук `useDialogs()`, который делает ровно то же самое, что `useDialogs()` из `features/datasets/api/queries.ts:50-55` — вызывает `api.get<Dialog[]>("/dialogs")`. Это не обёртка, не адаптация — буквальная копипаста логики.
**Почему плохо:** Два хука обращаются к одному API-эндпоинту, но используют **разные query keys**: datasets использует `["dialogs", "list"]`, а tts — `["tts", "dialogs"]`. Это значит, что TanStack Query будет кэшировать один и тот же ответ дважды, и инвалидация в одном фиче не затронет другой. Когда пользователь создаёт новый диалог на странице Datasets, список на странице TTS останется устаревшим до рефетча. Два источника правды для одних и тех же данных — прямой путь к рассинхрону.

### [DRY-2] `useAnnotationsByDialog` — дубликат, который ещё и появится в datasets  **[Major]**
**Файл:** `frontend/src/features/tts/api/queries.ts:39-46`
**Что не так:** Хук `useAnnotationsByDialog` обращается к `/dialogs/${dialogId}/annotations` — это endpoint, принадлежащий домену datasets (аннотации к диалогам). Логически этот хук должен жить в `features/datasets/api/queries.ts`, откуда его могут использовать оба фичера через shared hooks или реэкспорт на уровне маршрутов.
**Почему плохо:** Когда datasets-фича начнёт работать с аннотациями (а она начнёт — это её домен), возникнет второй хук для того же эндпоинта. Снова — два разных query key для одного ресурса, невозможность согласованной инвалидации.

### [DRY-3] `useTtsProviders` дублирует `useProviders` из providers  **[Major]**
**Файл:** `frontend/src/features/tts/api/queries.ts:17-21`
**Что не так:** `useTtsProviders()` вызывает `api.get<Provider[]>("/providers?type=tts")`. Уже существует `useProviders(type)` в `features/providers/api/queries.ts:15-19`, который делает ровно это: `api.get<Provider[]>("/providers?type=${type}")`. Один и тот же эндпоинт, один и тот же ответ.
**Почему плохо:** Query keys снова разные: providers использует `["providers", "tts"]`, а tts — `["tts", "providers"]`. Та же проблема двойного кэша. Если пользователь на странице Providers переключает `enabled` у провайдера, инвалидация `["providers"]` не затронет кэш `["tts", "providers"]` — TTS-страница покажет уже отключённого провайдера как активного.

### [DRY-4] `jsonResponse` и `extractUrl` копируются в каждый тест-файл  **[Minor]**
**Файлы:** `queries.test.tsx`, `AnnotationSelector.test.tsx`, `DialogSelector.test.tsx`, `ProviderSelector.test.tsx`, `TtsPage.test.tsx`
**Что не так:** Функция `jsonResponse()` определена идентично в 5 файлах. `extractUrl()` — в 2. Это не абстракция ради абстракции; это буквально одна и та же утилита, скопированная пять раз.
**Почему плохо:** При изменении формата ответа (добавлении headers, изменении Content-Type) придётся менять во всех файлах. В остальном проекте та же проблема, но это не оправдание — codebase уже страдает от этого.

## Архитектурные нарушения

### [ARCH-1] Нарушение "no cross-feature imports" — но в другую сторону  **[Major]**
**Файл:** `frontend/src/features/tts/api/queries.ts`
**Что не так:** Формально cross-feature импортов нет — tts не импортирует из datasets или providers. Но по факту tts дублирует их хуки вместо того, чтобы использовать shared hooks. Frontend CLAUDE.md говорит: *"Shared code lives in top-level `components/`, `hooks/`, `lib/`, `utils/`"*. Хуки для dialogs и providers — это shared-данные, используемые несколькими фичами. Они должны жить в shared `hooks/` или `lib/`, а не дублироваться внутри каждого фичера.
**Почему плохо:** Правило "no cross-feature imports" существует не для того, чтобы дублировать код. Оно существует, чтобы вынуждать выносить общие зависимости в shared-слой. Текущая реализация — обход правила через копипасту.

### [ARCH-2] Query key factory не согласована с codebase  **[Minor]**
**Файл:** `frontend/src/features/tts/api/queries.ts:10-15`
**Что не так:** `ttsKeys` использует плоскую структуру: `["tts", "providers"]`, `["tts", "dialogs"]`. Datasets feature использует иерархическую: `dialogKeys.all = ["dialogs"]`, `dialogKeys.list = [...all, "list"]`, `dialogKeys.detail = [...all, "detail", id]`. Providers feature вообще не использует key factory — хардкодит `["providers", type]`.
**Почему плохо:** Три разных подхода к query keys в трёх фичах. Без единого стандарта невозможно надёжно делать partial invalidation (например, `queryClient.invalidateQueries({ queryKey: ["dialogs"] })` не затронет `["tts", "dialogs"]`).

## Потенциальные баги

### [BUG-1] `useTtsVoices` вызовется с пустой строкой в key, даже когда disabled  **[Minor]**
**Файл:** `frontend/src/features/tts/api/queries.ts:25-29`
**Что не так:** `queryKey: ttsKeys.voices(providerId ?? "")` — когда `providerId` равен `null`, query key будет `["tts", "voices", ""]`. Хук disabled и запрос не пойдёт, но ключ с пустой строкой остаётся в query cache. Если позже пользователь выберет провайдера, а потом снимет выбор — в кэше будет мусорный entry `["tts", "voices", ""]`.
**Почему плохо:** Мусор в кэше. Не критично, но неаккуратно. `datasets/api/queries.ts` делает ту же ошибку с `dialogKeys.detail(dialogId ?? 0)` — это паттерн, который расползается.

### [BUG-2] `useAnnotationsByDialog` аналогично — `dialogId ?? 0` создаёт фантомный ключ  **[Minor]**
**Файл:** `frontend/src/features/tts/api/queries.ts:41`
**Что не так:** `ttsKeys.annotations(dialogId ?? 0)` при `dialogId === null` создаёт ключ `["tts", "annotations", 0]`. Если в базе есть диалог с `id = 0` (маловероятно, но формально допустимо), это collision.
**Почему плохо:** То же, что BUG-1, плюс потенциальная коллизия ключей.

### [BUG-3] `ProviderSelector` фильтрует на клиенте то, что сервер уже может отфильтровать  **[Minor]**
**Файл:** `frontend/src/features/tts/components/ProviderSelector.tsx:37`
**Что не так:** `providersQuery.data.filter((p) => p.enabled)` — запрос уже идёт на `/providers?type=tts`, но enabled/disabled фильтрация происходит на клиенте. Если API поддерживает `?enabled=true`, нагрузка на клиент зря.
**Почему плохо:** При 100 провайдерах (маловероятно, но) клиент получит все, нарисует только enabled. Если API не поддерживает такой фильтр — это ладно, но тогда фильтрация в queryFn была бы чище (результат сразу в кэше отфильтрован).

### [BUG-4] Нет обработки `NaN` при `Number(e.target.value)` в DialogSelector  **[Minor]**
**Файл:** `frontend/src/features/tts/components/DialogSelector.tsx:48`
**Что не так:** `onChange={(e) => onSelect(Number(e.target.value))}` — если `value` окажется пустой строкой или не-числом, `Number("")` даёт `0`, `Number("abc")` даёт `NaN`. `onSelect` принимает `number`, но не проверяет, что это валидный ID.
**Почему плохо:** При выборе disabled placeholder `""` получим `onSelect(0)`, что будет воспринято как ID диалога 0. Да, placeholder имеет `disabled`, но это UI-гарантия — программно ничто не мешает вызвать onChange с невалидным значением.

## Качество тестов

### [TEST-1] frontend/CLAUDE.md предписывает MSW, а тесты используют `vi.stubGlobal("fetch")`  **[Minor]**
**Файл:** все `*.test.tsx` в `features/tts/`
**Что не так:** Frontend CLAUDE.md в разделе Testing: *"**MSW** for API mocking"*. Все тесты в этой фиче мокают `fetch` напрямую через `vi.stubGlobal`.
**Почему плохо:** `vi.stubGlobal("fetch")` — хрупкий мок, который не проверяет URL-matching, не поддерживает параллельные запросы, не отличает GET от POST. MSW перехватывает на уровне network layer и ближе к реальному поведению. Впрочем, остальной codebase тоже использует `vi.stubGlobal`, так что это системная проблема, а не уникальная для этого PR.

### [TEST-2] Отсутствует тест на `useTtsVoices` с реальным providerId, потом сменой на null  **[Minor]**
**Файл:** `frontend/src/features/tts/api/queries.test.tsx`
**Что не так:** Тест проверяет, что `useTtsVoices(null)` не фетчит (fetchStatus idle), и что `useTtsVoices("elevenlabs")` фетчит. Но нет теста, где providerId меняется с "elevenlabs" на null — это ключевой сценарий для TtsPage (сброс при смене провайдера).
**Почему плохо:** Regression risk. Если кто-то сломает `enabled` логику, тесты не поймают.

## Проблемы компонентного дизайна

### [COMP-1] Hardcoded `id` атрибуты нарушают переиспользуемость  **[Minor]**
**Файлы:** `ProviderSelector.tsx:34` (`id="tts-provider-select"`), `DialogSelector.tsx:42` (`id="dialog-select"`), `AnnotationSelector.tsx:23` (`id="annotation-select"`)
**Что не так:** HTML `id` должны быть уникальными на странице. Если два `DialogSelector` рендерятся на одной странице, будет два элемента с `id="dialog-select"`. React 18+ имеет `useId()` именно для этого.
**Почему плохо:** Сейчас один инстанс на страницу — не ломается. Но это бомба замедленного действия. `useId()` доступен бесплатно.

### [COMP-2] AnnotationSelector не обрабатывает пустой список аннотаций  **[Minor]**
**Файл:** `frontend/src/features/tts/components/AnnotationSelector.tsx`
**Что не так:** `DialogSelector` обрабатывает `data.length === 0` и показывает "No dialogs available." `AnnotationSelector` этого не делает — при пустом массиве аннотаций покажет select с единственной опцией "Clean (no annotation)". Это не баг, но inconsistency с соседним компонентом.
**Почему плохо:** Непоследовательный UX между компонентами одного фичера.

## Резюме

| Severity    | Count |
|-------------|-------|
| Fundamental | 0     |
| Major       | 4     |
| Minor       | 9     |

**Общая оценка:** Код написан аккуратно, следует конвенциям проекта (feature-based structure, TanStack Query, Tailwind, .tsx extensions, userEvent в тестах). Компонентная декомпозиция разумна, тесты покрывают ключевые сценарии. Но главная проблема — системная: три хука из четырёх (useDialogs, useAnnotationsByDialog, useTtsProviders) дублируют существующие хуки из других фичей, создавая параллельные кэши для тех же API-ресурсов. Это не стилистическая претензия — это гарантированный рассинхрон данных между страницами при мутациях.
