# Code Review: feat/20-frontend-api-client

## Потенциальные баги

### [BUG-1] `undefined as T` — тихое превращение 204 в бомбу замедленного действия
**Severity: Major**
**File:** `frontend/src/lib/api-client.ts:17`
**Что не так:** При получении `204 No Content` функция `handleResponse<T>` возвращает `undefined as T`. Это означает, что вызывающий код типа `const result = await api.post<Provider>('/providers', data)` получит `undefined`, но TypeScript будет считать, что это `Provider`. Далее `result.id` — runtime crash.
**Почему это плохо:** Caller вынужден *знать*, что конкретный endpoint возвращает 204, и вручную игнорировать тип. Это нарушает контракт дженерика — `Promise<T>` врёт, когда на самом деле это `Promise<T | undefined>`. В реальности DELETE уже обработан отдельно (метод `delete` возвращает `void`), но если кто-то вызовет `api.post<Something>(...)` для endpoint, возвращающего 204, он получит `undefined` под маской `Something`.

### [BUG-2] Дублированная логика обработки ошибок в `delete`
**Severity: Minor**
**File:** `frontend/src/lib/api-client.ts:71-85`
**Что не так:** Метод `delete` содержит собственную, полностью дублированную логику парсинга ошибок (строки 75-84), вместо того чтобы вызвать `handleResponse<void>(response)`. Тело обработки ошибки — точная копипаста из `handleResponse`.
**Почему это плохо:** Два места для одной и той же логики. Когда формат ошибок бэкенда изменится (например, добавится поле `code`), нужно будет обновлять оба места. Кто-то обновит одно и забудет о другом.

### [BUG-3] Условие `!response.ok && response.status !== 204` в delete — лишнее
**Severity: Minor**
**File:** `frontend/src/lib/api-client.ts:75`
**Что не так:** Проверка `response.status !== 204` избыточна: HTTP 204 — это success-код (2xx), поэтому `response.ok` для 204 всегда `true`. Условие `!response.ok && response.status !== 204` эквивалентно просто `!response.ok`. Дополнительная проверка создаёт ложное впечатление, что 204 мог бы быть "not ok".
**Почему это плохо:** Вводит в заблуждение читателя. Выглядит так, будто автор не знает, что 204 — это success-код, или подстраховывается от невозможного сценария.

## Качество кода

### [QUAL-1] Отсутствие `PATCH` метода в API-клиенте
**Severity: Minor**
**File:** `frontend/src/lib/api-client.ts`
**Что не так:** Клиент предоставляет `get`, `post`, `put`, `delete`, `fetchRaw`, но не `patch`. На данный момент бэкенд не использует PATCH, но клиент позиционируется как универсальный HTTP wrapper. Если завтра добавится partial update через PATCH (что семантически корректнее для текущих PUT-обновлений с optional-полями), придётся дописывать метод.
**Почему это плохо:** Некритично, но неполнота API создаёт асимметрию.

## Дрейф типов (Schema Drift)

### [DRIFT-1] Тип `Voice` во фронтенде не имеет бэкенд-аналога в data layer
**Severity: Major**
**File:** `frontend/src/types/api.ts:87-95`
**Что не так:** Тип `Voice` во фронтенде скопирован с `IVoice` из `backend/src/providers/tts/types.ts`. Однако `IVoice` — это не доменный тип из data layer, а тип из TTS-провайдера. На бэкенде нет API-endpoint, который бы возвращал `Voice` через REST. Этот тип не проходит через `db/types.ts` и не имеет route-схемы. Фронтенд определяет тип для ответа, которого ещё не существует.
**Почему это плохо:** Когда появится endpoint для Voices, его response schema может отличаться от `IVoice` (например, добавится `provider_id`, или `providerMeta` будет отфильтрован). Фронтенд-тип уже задаёт контракт, которого бэкенд не обещал. Это рецепт для рассинхрона.

### [DRIFT-2] Типы во фронтенде — ручные копии бэкенд-типов без механизма синхронизации
**Severity: Major**
**File:** `frontend/src/types/api.ts:1-103`
**Что не так:** Все типы (`Provider`, `Dialog`, `DialogMessage`, `AnnotatedDialog`, `AnnotatedMessage`, `AnnotationPrompt`, `AgentPrompt`) — ручные копии из `backend/src/db/types.ts`. Нет ни кодогенерации, ни shared-пакета, ни даже комментария, указывающего на источник. Единственная связь — совпадение имён и полей.
**Почему это плохо:** Это классический schema drift waiting to happen. Когда бэкенд добавит поле `updated_at` или переименует `created_by` — фронтенд-типы останутся старыми, TypeScript промолчит, и баг обнаружится только в рантайме. При наличии TypeBox-схем на бэкенде, можно было бы генерировать типы через `@sinclair/typebox` Static inference и shared workspace package.

## Нарушения проектных правил

### [RULE-1] Отсутствие тестов для нового кода
**Severity: Major**
**File:** `frontend/src/lib/api-client.ts`, `frontend/src/types/api.ts`
**Что не так:** Добавлены два новых файла. Ноль тестов. `CLAUDE.md` явно требует: "TDD by default. Write tests first, then implement. Red -> Green -> Refactor". `frontend/CLAUDE.md` указывает: "Testing: Vitest + React Testing Library + MSW for API mocking". API-клиент — идеальный кандидат для модульного тестирования с MSW: проверка обработки 200, 204, 4xx, 5xx, невалидного JSON в теле ошибки, сетевых ошибок.
**Почему это плохо:** Нарушение основного правила проекта. Код обработки ошибок содержит нюансы (204 handling, JSON parse fallback, дублированная delete-логика), которые легко сломать. Без тестов это обнаружится только когда пользователь увидит необработанный crash.

## Резюме

| Severity    | Count |
|-------------|-------|
| Fundamental | 0     |
| Major       | 4     |
| Minor       | 3     |

**Общая оценка:** Код чистый, структура правильная, размещение в `lib/` и `types/` соответствует конвенциям. Основные проблемы: (1) `undefined as T` — это type-lie, который рано или поздно выстрелит; (2) дублирование логики ошибок в delete; (3) ручная копия бэкенд-типов без механизма синхронизации — бомба замедленного действия; (4) полное отсутствие тестов при TDD-first правиле проекта.
