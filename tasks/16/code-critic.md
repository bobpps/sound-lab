# Code Review: feat/16-dialog-generation

## Copy-paste / Качество кода

### [CP-1] `resolveLLMProvider` — полная копипаста из `llm/index.ts`
- **Severity: Major**
- **File:** `backend/src/routes/services/index.ts:10-32`
- **Что не так:** Функция `resolveLLMProvider` скопирована символ-в-символ из `backend/src/routes/llm/index.ts:12-35`. 23 строки одинакового кода.
- **Почему плохо:** Два одинаковых куска кода = два места для правок при любом изменении логики резолва провайдера (добавление проверки `enabled`, смена формата ошибки, и т.д.). Один забудут обновить, и поведение разъедется. Это классический нарушитель DRY.

## Потенциальные баги

### [BUG-1] Не валидируется количество сообщений от LLM
- **Severity: Major**
- **File:** `backend/src/services/dialog-generation.ts:80-112`
- **Что не так:** Пользователь просит `messageCount: 4`, LLM может вернуть 2 или 20 сообщений — сервис молча сохранит всё, что пришло. `parseAndValidate` проверяет формат каждого сообщения, но не количество.
- **Почему плохо:** Контракт с клиентом нарушен. Клиент просил 4 сообщения, получил 17. Или 1. При этом промпт явно говорит LLM "exactly N messages", но LLM не обязан слушаться. Данные в БД расходятся с ожиданиями.

### [BUG-2] Нет обработки ошибки `llmProvider.complete()` в роуте
- **Severity: Minor**
- **File:** `backend/src/routes/services/index.ts:51-58`
- **Что не так:** Если `generateDialog` выбросит ошибку (LLM вернул мусор, LLM API упал, сеть не работает), она не перехвачена — Fastify вернёт generic 500 с raw error message.
- **Почему плохо:** Raw error message от LLM-парсинга (`Failed to parse LLM response as JSON: {"some":"sensitive data"}...`) утекает клиенту. Да, `500: ErrorResponse` в response schema частично спасает (fast-json-stringify сериализует по схеме), но текст ошибки всё равно содержит куски LLM-ответа (первые 200 символов — см. строка 50 в service). Это информационная утечка.

### [BUG-3] Нет атомарности: диалог создаётся до сообщений без транзакции
- **Severity: Minor**
- **File:** `backend/src/services/dialog-generation.ts:94-104`
- **Что не так:** `dialogRepo.create()` выполняется на строке 94, затем в цикле создаются сообщения (97-104). Если на третьем сообщении произойдёт ошибка, в БД останется диалог с двумя сообщениями из четырёх.
- **Почему плохо:** Неконсистентные данные в БД. Диалог без полного набора сообщений — мусор, который потом отобразится в UI. Для SQLite это решается через `BEGIN/COMMIT`, для Supabase — через batch insert. Но репозиторий не предоставляет транзакций, так что это скорее ограничение архитектуры.

## Паттерны проекта

### [PAT-1] Unused import `ILLMProvider` в route
- **Severity: Minor**
- **File:** `backend/src/routes/services/index.ts:6`
- **Что не так:** `import type { ILLMProvider } from '../../providers/llm/types.js'` — этот тип используется только в возвращаемом типе `resolveLLMProvider`, но сама функция — приватная, inline. TypeScript может вывести тип без явного импорта, если убрать аннотацию `Promise<ILLMProvider | null>`. Впрочем, это тот же импорт, что и в `llm/index.ts` — пришёл вместе с копипастой.
- **Почему плохо:** Технически не мёртвый импорт (он используется в type annotation), но является симптомом CP-1 — приехал вместе с дублированным кодом. Роут `services/` не должен напрямую знать о `ILLMProvider`; он должен получать его через абстракцию.

## Тестирование

### [TEST-1] Route-тест подменяет decorator прямой мутацией объекта
- **Severity: Major**
- **File:** `backend/tests/routes/services.test.ts:20-26`
- **Что не так:** `(app as Record<string, unknown>).createLLMProvider = vi.fn(...)` — decorator `createLLMProvider` перезаписывается через type assertion после того, как приложение уже построено и зарегистрировано. Это хрупкий хак.
- **Почему плохо:** Fastify decorators заморожены после `ready()`. Этот код работает только потому, что JavaScript позволяет перезаписывать свойства объекта несмотря на TypeScript типы. При обновлении Fastify или включении `Object.freeze` на decorators — тесты молча сломаются. Правильный подход — передавать mock через plugin override или `fastify.decorate` до `ready()`.

### [TEST-2] Unit-тесты сервиса используют `await import()` в каждом тесте
- **Severity: Minor**
- **File:** `backend/tests/services/dialog-generation.test.ts:71,102,132,...`
- **Что не так:** Каждый тест делает `const { generateDialog } = await import('../../src/services/dialog-generation.js')`. Этот модуль не содержит side-effects и не нуждается в изоляции через динамический импорт.
- **Почему плохо:** Лишний шум. Простой `import { generateDialog } from ...` в шапке файла был бы достаточен. Динамический импорт оправдан, когда модуль имеет side-effects или мокается через `vi.mock()`, но ни того, ни другого здесь нет.

## Итого

| Severity    | Count |
|-------------|-------|
| Fundamental | 0     |
| Major       | 3     |
| Minor       | 4     |

Общая оценка: код рабочий и структурно адекватный, но содержит грубое дублирование (`resolveLLMProvider`), не валидирует главный контракт (количество сообщений), и тесты роутов хакают Fastify decorators небезопасным способом.
