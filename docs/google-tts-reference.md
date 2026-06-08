# Справочник по Google TTS: цены, языки и голоса

Сводный документ по результатам исследования провайдеров Google Text-to-Speech
(Cloud TTS и Gemini TTS). Данные собраны из официальной документации Google
(июнь 2026) и перепроверены прямым чтением отрендеренных страниц.

**Основные источники:**
- [Review pricing for Text-to-Speech — Google Cloud](https://cloud.google.com/text-to-speech/pricing)
- [Supported voices and languages — Google Cloud TTS](https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types)
- [Speech generation (TTS) — Gemini API](https://ai.google.dev/gemini-api/docs/speech-generation)
- [Gemini-TTS — Google Cloud Docs](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts)

---

## 1. Цены по моделям Cloud TTS

Все цены приведены к единой единице — **за 1 млн символов** введённого текста,
после исчерпания бесплатного лимита. Отсортировано от дешёвой модели к дорогой.

Для Cloud TTS это нативная единица. Для Gemini TTS цена нативно считается **за
токены**, поэтому значения помечены `≈` и являются **оценкой** (пересчёт
токены → аудио → символы, методика в примечании †).

| # | Модель | Цена за 1M символов | Бесплатный лимит в месяц |
|---|--------|--------------------:|--------------------------|
| 1 | **Standard** | $4 | 4 000 000 символов |
| 2 | **Wavenet** | $16 | 1 000 000 символов |
| 3 | **Neural2** | $16 | 1 000 000 символов |
| 4 | **Polyglot** | $16 | 1 000 000 символов |
| 5 | **Gemini 2.5 Flash Preview TTS** † | ≈ $18 (оценка) | бесплатный тир Gemini API ‡ |
| 6 | **Chirp-HD** | $30 | 1 000 000 символов |
| 7 | **Chirp3-HD** | $30 | 1 000 000 символов |
| 8 | **Gemini 2.5 Pro Preview TTS** † | ≈ $36 (оценка) | бесплатный тир Gemini API ‡ |
| 9 | **Gemini 3.1 Flash TTS** † | ≈ $36 (оценка) | бесплатный тир Gemini API ‡ |
| 10 | **News** | $160 (тариф Studio) ⚠️ | 1 000 000 символов |
| 11 | **Casual** | $160 (тариф Studio) ⚠️ | 1 000 000 символов |
| 12 | **Studio** | $160 | 1 000 000 символов |

> Нативные токен-цены Gemini TTS (для справки): Flash 2.5 — $0.50 вход / $10 выход;
> Pro 2.5 — $1 / $20; 3.1 Flash — $1 / $20 (за 1M токенов).

### Про бесплатные лимиты

- Бесплатные лимиты есть, но это **месячные** квоты по каждой тарифной группе, а
  не разовый бонус. Каждый месяц обнуляются.
- Лимиты считаются **отдельно по тарифным группам**: «дешёвые» голоса
  (Standard — 4M, WaveNet — 1M) и «премиальные» (Neural2 / Polyglot / Chirp /
  Studio — по 1M) имеют свои отдельные счётчики.
- Сверх квоты — оплата строго по символам (без минималки).
- Для новых аккаунтов Google Cloud действует общий стартовый кредит **$300** на 90 дней.

### Примечания

- ⚠️ **News и Casual** — в документации Google это «Premium»-голоса
  (`en-US-News-*`, `en-US-Casual-K`). Отдельной строки в прайсе у них нет; они
  тарифицируются по ставке **Studio ($160/1M)**. Это единственный пункт, который
  не удалось подтвердить из чистого источника (официальная таблица отдавалась
  обрезанной) — стоит перепроверить в своём биллинге Google Cloud.
- ⚠️ **Chirp-HD vs Chirp3-HD** — обе линейки по данным источников идут по $30/1M.
  Chirp 3: HD подтверждён точно ($0.00003/символ); по старому Chirp HD данные
  менее однозначны.

### Про Gemini TTS (строки 5, 8, 9) — методика пересчёта в символы

- **† Цена Gemini TTS — оценка.** Нативно Gemini TTS тарифицируется **за токены**
  (отдельно вход-текст и выход-аудио), а не за символы. Чтобы привести к общей
  единице «за 1M символов», сделан пересчёт.
- **Исходные факты (официальные):**
  - аудио-выход тарифицируется как **25 токенов на 1 секунду** синтезированного
    аудио (т.е. 1M выходных токенов ≈ 11,1 часа аудио);
  - токен-цены: Flash 2.5 — $0.50/$10, Pro 2.5 — $1/$20, 3.1 Flash — $1/$20 за 1M
    токенов ([Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)).
- **Допущения (мои, не официальные):**
  - темп речи ≈ **14 символов/сек** (≈150 слов/мин — типичная английская речь);
  - входной текст ≈ **4 символа/токен**.
- **Расчёт на 1M символов:** 1 000 000 ÷ 14 ≈ 71 400 сек аудио × 25 ≈ **1,79M
  выходных токенов**; вход ≈ **0,25M токенов**.
  - Flash 2.5: 1,79M × $10 + 0,25M × $0.50 ≈ **$18**
  - Pro 2.5: 1,79M × $20 + 0,25M × $1 ≈ **$36**
  - 3.1 Flash: 1,79M × $20 + 0,25M × $1 ≈ **$36**
- **Чувствительность к темпу речи:** при 13–16 симв/сек диапазон выходит примерно
  **$15–20** для Flash 2.5 и **$31–39** для Pro 2.5 / 3.1 Flash. Реальная цена
  зависит от длительности аудио (пауз, скорости голоса, языка), а не от числа
  символов текста, поэтому это ориентир, а не точный тариф.
- **Цифры $0.30 вход / $2.50 выход** у сторонних агрегаторов относятся к обычной
  **текстовой** модели Gemini 2.5 Flash, а не к TTS — здесь не используются.
- **‡ Бесплатный лимит.** У Gemini API нет помесячной символьной квоты, как у
  Cloud TTS. Есть общий **бесплатный тир Gemini API** (пониженные rate-limits;
  данные могут использоваться для улучшения моделей) и стартовые кредиты Google
  Cloud. Лимиты для preview-моделей TTS стоит сверять в
  [актуальном прайсе](https://ai.google.dev/gemini-api/docs/pricing) и
  [лимитах Gemini API](https://ai.google.dev/gemini-api/docs/rate-limits).

---

## 2. Языки: Standard (Cloud TTS) vs Gemini 2.5 Flash Preview TTS

- **Модель 1 = Standard** (Cloud TTS) — список привязан к локалям.
- **Модель 2 = Gemini 2.5 Flash Preview TTS** (Gemini API) — определяет язык
  автоматически, набор расширен далеко за изначальные 24 языка.

| Язык | Standard (Модель 1) | Gemini 2.5 Flash Preview TTS (Модель 2) |
|------|:---:|:---:|
| Afrikaans (африкаанс) | ✅ af-ZA | ✅ |
| Albanian (албанский) | — | ✅ |
| Amharic (амхарский) | — | ✅ |
| Arabic (арабский) | ✅ ar-XA | ✅ |
| Armenian (армянский) | — | ✅ |
| Azerbaijani (азербайджанский) | — | ✅ |
| Basque (баскский) | — | ✅ |
| Belarusian (белорусский) | — | ✅ |
| Bengali / Bangla (бенгальский) | — | ✅ |
| Bulgarian (болгарский) | ✅ bg-BG | ✅ |
| Catalan (каталанский) | ✅ ca-ES | ✅ |
| Cebuano (себуанский) | — | ✅ |
| Chinese — Cantonese (кантонский) | ✅ yue-HK | — |
| Chinese — Mandarin (мандарин) | ✅ cmn-CN | ✅ |
| Croatian (хорватский) | — | ✅ |
| Czech (чешский) | ✅ cs-CZ | ✅ |
| Danish (датский) | ✅ da-DK | ✅ |
| Dutch (нидерландский) | ✅ nl-NL, nl-BE | ✅ |
| English (английский) | ✅ en-US, en-GB, en-AU, en-IN | ✅ |
| Estonian (эстонский) | ✅ et-EE | ✅ |
| Filipino (филиппинский) | ✅ fil-PH | ✅ |
| Finnish (финский) | ✅ fi-FI | ✅ |
| French (французский) | ✅ fr-FR, fr-CA | ✅ |
| Galician (галисийский) | ✅ gl-ES | ✅ |
| Georgian (грузинский) | — | ✅ |
| German (немецкий) | ✅ de-DE | ✅ |
| Greek (греческий) | ✅ el-GR | ✅ |
| Gujarati (гуджарати) | ✅ gu-IN | ✅ |
| Haitian Creole (гаитянский креольский) | — | ✅ |
| Hebrew (иврит) | ✅ he-IL | ✅ |
| Hindi (хинди) | ✅ hi-IN | ✅ |
| Hungarian (венгерский) | ✅ hu-HU | ✅ |
| Icelandic (исландский) | ✅ is-IS | ✅ |
| Indonesian (индонезийский) | ✅ id-ID | ✅ |
| Italian (итальянский) | ✅ it-IT | ✅ |
| Japanese (японский) | ✅ ja-JP | ✅ |
| Javanese (яванский) | — | ✅ |
| Kannada (каннада) | ✅ kn-IN | ✅ |
| Konkani (конкани) | — | ✅ |
| Korean (корейский) | ✅ ko-KR | ✅ |
| Lao (лаосский) | — | ✅ |
| Latin (латынь) | — | ✅ |
| Latvian (латышский) | ✅ lv-LV | ✅ |
| Lithuanian (литовский) | ✅ lt-LT | ✅ |
| Luxembourgish (люксембургский) | — | ✅ |
| Macedonian (македонский) | — | ✅ |
| Maithili (майтхили) | — | ✅ |
| Malagasy (малагасийский) | — | ✅ |
| Malay (малайский) | ✅ ms-MY | ✅ |
| Malayalam (малаялам) | ✅ ml-IN | ✅ |
| Marathi (маратхи) | ✅ mr-IN | ✅ |
| Mongolian (монгольский) | — | ✅ |
| Nepali (непальский) | — | ✅ |
| Norwegian Bokmål (норвежский букмол) | ✅ nb-NO | ✅ |
| Norwegian Nynorsk (нюнорск) | — | ✅ |
| Odia (ория) | — | ✅ |
| Pashto (пушту) | — | ✅ |
| Persian (персидский/фарси) | — | ✅ |
| Polish (польский) | ✅ pl-PL | ✅ |
| Portuguese (португальский) | ✅ pt-BR, pt-PT | ✅ |
| Punjabi (панджаби) | ✅ pa-IN | ✅ |
| Romanian (румынский) | ✅ ro-RO | ✅ |
| Russian (русский) | ✅ ru-RU | ✅ |
| Serbian (сербский) | ✅ sr-RS | ✅ |
| Sindhi (синдхи) | — | ✅ |
| Sinhala (сингальский) | — | ✅ |
| Slovak (словацкий) | ✅ sk-SK | ✅ |
| Slovenian (словенский) | — | ✅ |
| Spanish (испанский) | ✅ es-ES, es-US | ✅ |
| Swahili (суахили) | — | ✅ |
| Swedish (шведский) | ✅ sv-SE | ✅ |
| Tamil (тамильский) | ✅ ta-IN | ✅ |
| Telugu (телугу) | ✅ te-IN | ✅ |
| Thai (тайский) | ✅ th-TH | ✅ |
| Turkish (турецкий) | ✅ tr-TR | ✅ |
| Ukrainian (украинский) | ✅ uk-UA | ✅ |
| Urdu (урду) | ✅ ur-IN | ✅ |
| Vietnamese (вьетнамский) | ✅ vi-VN | ✅ |

**Итог:** Standard — около 47 языков; Gemini 2.5 Flash Preview TTS — около 76
языков. Почти всё, что есть в Standard, перекрывается Gemini; единственное
заметное исключение — **кантонский (yue-HK)**, которого у Gemini нет.

> Примечание: Gemini-список отражает текущий расширенный набор (с автоопределением
> языка), который вырос с изначальных 24 языков на старте.

---

## 3. Точная выкладка по локалям: Standard / WaveNet / Neural2

Данные получены чтением полностью отрендеренной официальной страницы (все ~2033
строки таблицы) и определением тира по фактическим именам голосов
(`-Standard-`, `-Wavenet-`, `-Neural2-`).

| Локаль | Язык / регион | Standard | WaveNet | Neural2 |
|--------|---------------|:---:|:---:|:---:|
| af-ZA | африкаанс (ЮАР) | ✅ | — | — |
| ar-XA | арабский | ✅ | ✅ | — |
| bg-BG | болгарский | ✅ | — | — |
| bn-IN | бенгальский (Индия) | ✅ | ✅ | — |
| ca-ES | каталанский | ✅ | — | — |
| cmn-CN | мандарин (Китай) | ✅ | ✅ | — |
| cmn-TW | мандарин (Тайвань) | ✅ | ✅ | — |
| cs-CZ | чешский | ✅ | ✅ | — |
| da-DK | датский | ✅ | ✅ | ✅ |
| de-DE | немецкий | ✅ | ✅ | ✅ |
| el-GR | греческий | ✅ | ✅ | — |
| en-AU | английский (Австралия) | ✅ | ✅ | ✅ |
| en-GB | английский (Великобритания) | ✅ | ✅ | ✅ |
| en-IN | английский (Индия) | ✅ | ✅ | ✅ |
| en-US | английский (США) | ✅ | ✅ | ✅ |
| es-ES | испанский (Испания) | ✅ | ✅ | ✅ |
| es-US | испанский (США) | ✅ | ✅ | ✅ |
| et-EE | эстонский | ✅ | — | — |
| eu-ES | баскский | ✅ | — | — |
| fi-FI | финский | ✅ | ✅ | — |
| fil-PH | филиппинский | ✅ | ✅ | ✅ |
| fr-CA | французский (Канада) | ✅ | ✅ | ✅ |
| fr-FR | французский (Франция) | ✅ | ✅ | ✅ |
| gl-ES | галисийский | ✅ | — | — |
| gu-IN | гуджарати | ✅ | ✅ | — |
| he-IL | иврит | ✅ | ✅ | — |
| hi-IN | хинди | ✅ | ✅ | ✅ |
| hu-HU | венгерский | ✅ | ✅ | — |
| id-ID | индонезийский | ✅ | ✅ | — |
| is-IS | исландский | ✅ | — | — |
| it-IT | итальянский | ✅ | ✅ | ✅ |
| ja-JP | японский | ✅ | ✅ | ✅ |
| kn-IN | каннада | ✅ | ✅ | — |
| ko-KR | корейский | ✅ | ✅ | ✅ |
| lt-LT | литовский | ✅ | — | — |
| lv-LV | латышский | ✅ | — | — |
| ml-IN | малаялам | ✅ | ✅ | — |
| mr-IN | маратхи | ✅ | ✅ | — |
| ms-MY | малайский | ✅ | ✅ | — |
| nb-NO | норвежский (букмол) | ✅ | ✅ | — |
| nl-BE | нидерландский (Бельгия) | ✅ | ✅ | — |
| nl-NL | нидерландский (Нидерланды) | ✅ | ✅ | — |
| pa-IN | панджаби | ✅ | ✅ | — |
| pl-PL | польский | ✅ | ✅ | — |
| pt-BR | португальский (Бразилия) | ✅ | ✅ | ✅ |
| pt-PT | португальский (Португалия) | ✅ | ✅ | — |
| ro-RO | румынский | ✅ | ✅ | — |
| ru-RU | русский | ✅ | ✅ | — |
| sk-SK | словацкий | ✅ | ✅ | — |
| sr-RS | сербский (кириллица) | ✅ | — | — |
| sv-SE | шведский | ✅ | ✅ | — |
| ta-IN | тамильский | ✅ | ✅ | — |
| te-IN | телугу | ✅ | — | — |
| th-TH | тайский | ✅ | — | ✅ |
| tr-TR | турецкий | ✅ | ✅ | — |
| uk-UA | украинский | ✅ | ✅ | — |
| ur-IN | урду | ✅ | ✅ | — |
| vi-VN | вьетнамский | ✅ | ✅ | ✅ |
| yue-HK | кантонский (Гонконг) | ✅ | — | — |

### Итоги по тирам (уникальные локали)

| Тир | Кол-во локалей |
|-----|:---:|
| **Standard** | 59–60 |
| **WaveNet** | 46 |
| **Neural2** | 18 |

Каждая локаль WaveNet и Neural2 одновременно присутствует и в Standard —
«эксклюзивных» для WaveNet/Neural2 локалей нет. Standard — самый широкий охват,
Neural2 — самый узкий.

### Примечания

- **Google переименовал колонку «Voice type».** Сейчас на странице остались
  только метки `Standard`, `Premium` и `Studio` — WaveNet, Neural2, Chirp, News,
  Polyglot свёрнуты под общий ярлык **Premium**. Принадлежность к тиру всё ещё
  однозначно зашита в **имени голоса** (`en-US-Wavenet-A`, `de-DE-Neural2-B`),
  откуда и взяты данные.
- **th-TH** — необычный случай: есть Standard и Neural2, но **нет WaveNet**.
  Проверено по сырым строкам — это так на странице.
- **hr-HR (хорватский)** и **sl-SI (словенский)** присутствуют на странице, но
  только в Premium/Chirp — в Standard/WaveNet/Neural2 их нет (в таблицу не попали).

---

## 4. Пересечение Standard ∩ Gemini Flash + имена Standard-голосов

В Gemini Flash есть все языки Standard, **кроме кантонского (yue-HK)**. Поэтому
ниже все Standard-локали, кроме `yue-HK`, с точными именами Standard-голосов
(извлечены из живой DOM официальной страницы).

| Локаль | Язык | Имена Standard-голосов | Кол-во |
|--------|------|------------------------|:---:|
| af-ZA | африкаанс | af-ZA-Standard-A | 1 |
| ar-XA | арабский | ar-XA-Standard-A, -B, -C, -D | 4 |
| bg-BG | болгарский | bg-BG-Standard-B | 1 |
| bn-IN | бенгальский | bn-IN-Standard-A, -B, -C, -D | 4 |
| ca-ES | каталанский | ca-ES-Standard-B | 1 |
| cmn-CN | мандарин (Китай) | cmn-CN-Standard-A, -B, -C, -D | 4 |
| cmn-TW | мандарин (Тайвань) | cmn-TW-Standard-A, -B, -C | 3 |
| cs-CZ | чешский | cs-CZ-Standard-B | 1 |
| da-DK | датский | da-DK-Standard-F, -G | 2 |
| de-DE | немецкий | de-DE-Standard-G, -H | 2 |
| el-GR | греческий | el-GR-Standard-B | 1 |
| en-AU | английский (Австралия) | en-AU-Standard-A, -B, -C, -D | 4 |
| en-GB | английский (Великобритания) | en-GB-Standard-A, -B, -C, -D, -F, -N, -O | 7 |
| en-IN | английский (Индия) | en-IN-Standard-A, -B, -C, -D, -E, -F | 6 |
| en-US | английский (США) | en-US-Standard-A, -B, -C, -D, -E, -F, -G, -H, -I, -J | 10 |
| es-ES | испанский (Испания) | es-ES-Standard-A, -E, -F, -G, -H | 5 |
| es-US | испанский (США) | es-US-Standard-A, -B, -C | 3 |
| et-EE | эстонский | et-EE-Standard-A | 1 |
| eu-ES | баскский | eu-ES-Standard-B | 1 |
| fi-FI | финский | fi-FI-Standard-B | 1 |
| fil-PH | филиппинский | fil-PH-Standard-A, -B, -C, -D | 4 |
| fr-CA | французский (Канада) | fr-CA-Standard-A, -B, -C, -D | 4 |
| fr-FR | французский (Франция) | fr-FR-Standard-F, -G | 2 |
| gl-ES | галисийский | gl-ES-Standard-B | 1 |
| gu-IN | гуджарати | gu-IN-Standard-A, -B, -C, -D | 4 |
| he-IL | иврит | he-IL-Standard-A, -B, -C, -D | 4 |
| hi-IN | хинди | hi-IN-Standard-A, -B, -C, -D, -E, -F | 6 |
| hu-HU | венгерский | hu-HU-Standard-B | 1 |
| id-ID | индонезийский | id-ID-Standard-A, -B, -C, -D | 4 |
| is-IS | исландский | is-IS-Standard-B | 1 |
| it-IT | итальянский | it-IT-Standard-E, -F | 2 |
| ja-JP | японский | ja-JP-Standard-A, -B, -C, -D | 4 |
| kn-IN | каннада | kn-IN-Standard-A, -B, -C, -D | 4 |
| ko-KR | корейский | ko-KR-Standard-A, -B, -C, -D | 4 |
| lt-LT | литовский | lt-LT-Standard-B | 1 |
| lv-LV | латышский | lv-LV-Standard-B | 1 |
| ml-IN | малаялам | ml-IN-Standard-A, -B, -C, -D | 4 |
| mr-IN | маратхи | mr-IN-Standard-A, -B, -C | 3 |
| ms-MY | малайский | ms-MY-Standard-A, -B, -C, -D | 4 |
| nb-NO | норвежский (букмол) | nb-NO-Standard-F, -G | 2 |
| nl-BE | нидерландский (Бельгия) | nl-BE-Standard-C, -D | 2 |
| nl-NL | нидерландский (Нидерланды) | nl-NL-Standard-F, -G | 2 |
| pa-IN | панджаби | pa-IN-Standard-A, -B, -C, -D | 4 |
| pl-PL | польский | pl-PL-Standard-F, -G | 2 |
| pt-BR | португальский (Бразилия) | pt-BR-Standard-A, -B, -C, -D, -E | 5 |
| pt-PT | португальский (Португалия) | pt-PT-Standard-E, -F | 2 |
| ro-RO | румынский | ro-RO-Standard-B | 1 |
| ru-RU | русский | ru-RU-Standard-A, -B, -C, -D, -E | 5 |
| sk-SK | словацкий | sk-SK-Standard-B | 1 |
| sr-RS | сербский | sr-RS-Standard-B | 1 |
| sv-SE | шведский | sv-SE-Standard-A, -B, -C, -D, -E, -F, -G | 7 |
| ta-IN | тамильский | ta-IN-Standard-A, -B, -C, -D | 4 |
| te-IN | телугу | te-IN-Standard-A, -B, -C, -D | 4 |
| th-TH | тайский | th-TH-Standard-A | 1 |
| tr-TR | турецкий | tr-TR-Standard-A, -B, -C, -D, -E | 5 |
| uk-UA | украинский | uk-UA-Standard-B | 1 |
| ur-IN | урду | ur-IN-Standard-A, -B | 2 |
| vi-VN | вьетнамский | vi-VN-Standard-A, -B, -C, -D | 4 |

### Итоги

- **Локалей в пересечении:** 59 (все Standard-локали, кроме `yue-HK`).
- **Имён Standard-голосов в пересечении:** 175.
- **Исключено:** `yue-HK` (кантонский) — 4 голоса (`yue-HK-Standard-A…D`), т.к.
  Gemini Flash не поддерживает кантонский.

### Примечания

- Имена сокращены для читаемости (`-A, -B` = `…-Standard-A`, `…-Standard-B`).
  Буквы суффиксов даны точно как на странице — у некоторых локалей они идут не
  подряд от A (например, `en-GB` имеет A–D, F, N, O; `da-DK` — только F и G).
- Всего по странице Standard-голосов 179 в 60 локалях; здесь 175 в 59 локалях
  после исключения кантонского.

---

## 4a. Два Standard-голоса на локаль (женский + мужской)

Вариант таблицы из раздела 4: те же первые столбцы (локаль, язык), но вместо
списка голосов — **по одному женскому и одному мужскому** Standard-голосу на
локаль (первый по порядку голос каждого пола). Пол взят из официального поля
`ssmlGender` Google Cloud TTS. Здесь 58 локалей — тот же набор, что в таблице
раздела 4 (`yue-HK` исключён).

> ⚠️ Расхождение: «Итоги» раздела 4 заявляют 59 локалей, но строк в таблице 58.
> Сверка с живым API Google показала, что пропущен **амхарский (`am-ET`)** — он
> есть в Standard (`am-ET-Standard-A` жен., `am-ET-Standard-B` муж.) и
> поддерживается Gemini Flash, то есть законно входит в пересечение. С учётом
> него было бы 59. Здесь набор оставлен идентичным разделу 4; `am-ET` не добавлен.

Где в тире Standard нет голоса нужного пола, стоит прочерк (—). Таких локалей
**18**: `af-ZA`, `bg-BG`, `ca-ES`, `cs-CZ`, `el-GR`, `et-EE`, `eu-ES`, `fi-FI`, `gl-ES`, `hu-HU`, `is-IS`, `lt-LT`, `lv-LV`, `ro-RO`, `sk-SK`, `sr-RS`, `th-TH`, `uk-UA`.

> **Можно ли закрыть прочерки голосами других моделей?** Проверено по живому API:
> - **WaveNet и Neural2 — нет.** Ни для одной из 18 локалей недостающего пола в
>   них нет: либо локали в этих тирах нет вообще, либо есть голос **того же** пола,
>   что уже в Standard (напр. `cs-CZ-Wavenet-B`, `el-GR-Wavenet-B`,
>   `uk-UA-Wavenet-B`, `th-TH-Neural2-C` — все женские, как и Standard).
> - **Chirp3-HD — да, для 13 из 18** (`bg-BG`, `cs-CZ`, `el-GR`, `fi-FI`, `hu-HU`,
>   `ro-RO`, `sk-SK`, `sr-RS`, `th-TH`, `uk-UA` — муж.; `et-EE`, `lt-LT`, `lv-LV` —
>   жен.). Но это премиум-тир ($30/1M против $4/1M) с именованными голосами
>   (Puck, Kore, …), а не `…-Standard-*`.
> - **5 локалей не закрыть ничем** (`af-ZA`, `ca-ES`, `eu-ES`, `gl-ES`, `is-IS`) —
>   противоположного пола нет ни в одном из тиров Standard/WaveNet/Neural2/Chirp3-HD.
>
> Таблица оставлена строго в тире Standard, прочерки сохранены.

| Локаль | Язык | Женский голос | Мужской голос |
|--------|------|---------------|---------------|
| af-ZA | африкаанс | af-ZA-Standard-A | — |
| ar-XA | арабский | ar-XA-Standard-A | ar-XA-Standard-B |
| bg-BG | болгарский | bg-BG-Standard-B | — |
| bn-IN | бенгальский | bn-IN-Standard-A | bn-IN-Standard-B |
| ca-ES | каталанский | ca-ES-Standard-B | — |
| cmn-CN | мандарин (Китай) | cmn-CN-Standard-A | cmn-CN-Standard-B |
| cmn-TW | мандарин (Тайвань) | cmn-TW-Standard-A | cmn-TW-Standard-B |
| cs-CZ | чешский | cs-CZ-Standard-B | — |
| da-DK | датский | da-DK-Standard-F | da-DK-Standard-G |
| de-DE | немецкий | de-DE-Standard-G | de-DE-Standard-H |
| el-GR | греческий | el-GR-Standard-B | — |
| en-AU | английский (Австралия) | en-AU-Standard-A | en-AU-Standard-B |
| en-GB | английский (Великобритания) | en-GB-Standard-A | en-GB-Standard-B |
| en-IN | английский (Индия) | en-IN-Standard-A | en-IN-Standard-B |
| en-US | английский (США) | en-US-Standard-C | en-US-Standard-A |
| es-ES | испанский (Испания) | es-ES-Standard-F | es-ES-Standard-E |
| es-US | испанский (США) | es-US-Standard-A | es-US-Standard-B |
| et-EE | эстонский | — | et-EE-Standard-A |
| eu-ES | баскский | eu-ES-Standard-B | — |
| fi-FI | финский | fi-FI-Standard-B | — |
| fil-PH | филиппинский | fil-PH-Standard-A | fil-PH-Standard-C |
| fr-CA | французский (Канада) | fr-CA-Standard-A | fr-CA-Standard-B |
| fr-FR | французский (Франция) | fr-FR-Standard-F | fr-FR-Standard-G |
| gl-ES | галисийский | gl-ES-Standard-B | — |
| gu-IN | гуджарати | gu-IN-Standard-A | gu-IN-Standard-B |
| he-IL | иврит | he-IL-Standard-A | he-IL-Standard-B |
| hi-IN | хинди | hi-IN-Standard-A | hi-IN-Standard-B |
| hu-HU | венгерский | hu-HU-Standard-B | — |
| id-ID | индонезийский | id-ID-Standard-A | id-ID-Standard-B |
| is-IS | исландский | is-IS-Standard-B | — |
| it-IT | итальянский | it-IT-Standard-E | it-IT-Standard-F |
| ja-JP | японский | ja-JP-Standard-A | ja-JP-Standard-C |
| kn-IN | каннада | kn-IN-Standard-A | kn-IN-Standard-B |
| ko-KR | корейский | ko-KR-Standard-A | ko-KR-Standard-C |
| lt-LT | литовский | — | lt-LT-Standard-B |
| lv-LV | латышский | — | lv-LV-Standard-B |
| ml-IN | малаялам | ml-IN-Standard-A | ml-IN-Standard-B |
| mr-IN | маратхи | mr-IN-Standard-A | mr-IN-Standard-B |
| ms-MY | малайский | ms-MY-Standard-A | ms-MY-Standard-B |
| nb-NO | норвежский (букмол) | nb-NO-Standard-F | nb-NO-Standard-G |
| nl-BE | нидерландский (Бельгия) | nl-BE-Standard-C | nl-BE-Standard-D |
| nl-NL | нидерландский (Нидерланды) | nl-NL-Standard-F | nl-NL-Standard-G |
| pa-IN | панджаби | pa-IN-Standard-A | pa-IN-Standard-B |
| pl-PL | польский | pl-PL-Standard-F | pl-PL-Standard-G |
| pt-BR | португальский (Бразилия) | pt-BR-Standard-A | pt-BR-Standard-B |
| pt-PT | португальский (Португалия) | pt-PT-Standard-E | pt-PT-Standard-F |
| ro-RO | румынский | ro-RO-Standard-B | — |
| ru-RU | русский | ru-RU-Standard-A | ru-RU-Standard-B |
| sk-SK | словацкий | sk-SK-Standard-B | — |
| sr-RS | сербский | sr-RS-Standard-B | — |
| sv-SE | шведский | sv-SE-Standard-A | sv-SE-Standard-D |
| ta-IN | тамильский | ta-IN-Standard-A | ta-IN-Standard-B |
| te-IN | телугу | te-IN-Standard-A | te-IN-Standard-B |
| th-TH | тайский | th-TH-Standard-A | — |
| tr-TR | турецкий | tr-TR-Standard-A | tr-TR-Standard-B |
| uk-UA | украинский | uk-UA-Standard-B | — |
| ur-IN | урду | ur-IN-Standard-A | ur-IN-Standard-B |
| vi-VN | вьетнамский | vi-VN-Standard-A | vi-VN-Standard-B |

### Те же данные в JSON

```json
[
  {
    "locale": "af-ZA",
    "language": "африкаанс",
    "female": "af-ZA-Standard-A",
    "male": null
  },
  {
    "locale": "ar-XA",
    "language": "арабский",
    "female": "ar-XA-Standard-A",
    "male": "ar-XA-Standard-B"
  },
  {
    "locale": "bg-BG",
    "language": "болгарский",
    "female": "bg-BG-Standard-B",
    "male": null
  },
  {
    "locale": "bn-IN",
    "language": "бенгальский",
    "female": "bn-IN-Standard-A",
    "male": "bn-IN-Standard-B"
  },
  {
    "locale": "ca-ES",
    "language": "каталанский",
    "female": "ca-ES-Standard-B",
    "male": null
  },
  {
    "locale": "cmn-CN",
    "language": "мандарин (Китай)",
    "female": "cmn-CN-Standard-A",
    "male": "cmn-CN-Standard-B"
  },
  {
    "locale": "cmn-TW",
    "language": "мандарин (Тайвань)",
    "female": "cmn-TW-Standard-A",
    "male": "cmn-TW-Standard-B"
  },
  {
    "locale": "cs-CZ",
    "language": "чешский",
    "female": "cs-CZ-Standard-B",
    "male": null
  },
  {
    "locale": "da-DK",
    "language": "датский",
    "female": "da-DK-Standard-F",
    "male": "da-DK-Standard-G"
  },
  {
    "locale": "de-DE",
    "language": "немецкий",
    "female": "de-DE-Standard-G",
    "male": "de-DE-Standard-H"
  },
  {
    "locale": "el-GR",
    "language": "греческий",
    "female": "el-GR-Standard-B",
    "male": null
  },
  {
    "locale": "en-AU",
    "language": "английский (Австралия)",
    "female": "en-AU-Standard-A",
    "male": "en-AU-Standard-B"
  },
  {
    "locale": "en-GB",
    "language": "английский (Великобритания)",
    "female": "en-GB-Standard-A",
    "male": "en-GB-Standard-B"
  },
  {
    "locale": "en-IN",
    "language": "английский (Индия)",
    "female": "en-IN-Standard-A",
    "male": "en-IN-Standard-B"
  },
  {
    "locale": "en-US",
    "language": "английский (США)",
    "female": "en-US-Standard-C",
    "male": "en-US-Standard-A"
  },
  {
    "locale": "es-ES",
    "language": "испанский (Испания)",
    "female": "es-ES-Standard-F",
    "male": "es-ES-Standard-E"
  },
  {
    "locale": "es-US",
    "language": "испанский (США)",
    "female": "es-US-Standard-A",
    "male": "es-US-Standard-B"
  },
  {
    "locale": "et-EE",
    "language": "эстонский",
    "female": null,
    "male": "et-EE-Standard-A"
  },
  {
    "locale": "eu-ES",
    "language": "баскский",
    "female": "eu-ES-Standard-B",
    "male": null
  },
  {
    "locale": "fi-FI",
    "language": "финский",
    "female": "fi-FI-Standard-B",
    "male": null
  },
  {
    "locale": "fil-PH",
    "language": "филиппинский",
    "female": "fil-PH-Standard-A",
    "male": "fil-PH-Standard-C"
  },
  {
    "locale": "fr-CA",
    "language": "французский (Канада)",
    "female": "fr-CA-Standard-A",
    "male": "fr-CA-Standard-B"
  },
  {
    "locale": "fr-FR",
    "language": "французский (Франция)",
    "female": "fr-FR-Standard-F",
    "male": "fr-FR-Standard-G"
  },
  {
    "locale": "gl-ES",
    "language": "галисийский",
    "female": "gl-ES-Standard-B",
    "male": null
  },
  {
    "locale": "gu-IN",
    "language": "гуджарати",
    "female": "gu-IN-Standard-A",
    "male": "gu-IN-Standard-B"
  },
  {
    "locale": "he-IL",
    "language": "иврит",
    "female": "he-IL-Standard-A",
    "male": "he-IL-Standard-B"
  },
  {
    "locale": "hi-IN",
    "language": "хинди",
    "female": "hi-IN-Standard-A",
    "male": "hi-IN-Standard-B"
  },
  {
    "locale": "hu-HU",
    "language": "венгерский",
    "female": "hu-HU-Standard-B",
    "male": null
  },
  {
    "locale": "id-ID",
    "language": "индонезийский",
    "female": "id-ID-Standard-A",
    "male": "id-ID-Standard-B"
  },
  {
    "locale": "is-IS",
    "language": "исландский",
    "female": "is-IS-Standard-B",
    "male": null
  },
  {
    "locale": "it-IT",
    "language": "итальянский",
    "female": "it-IT-Standard-E",
    "male": "it-IT-Standard-F"
  },
  {
    "locale": "ja-JP",
    "language": "японский",
    "female": "ja-JP-Standard-A",
    "male": "ja-JP-Standard-C"
  },
  {
    "locale": "kn-IN",
    "language": "каннада",
    "female": "kn-IN-Standard-A",
    "male": "kn-IN-Standard-B"
  },
  {
    "locale": "ko-KR",
    "language": "корейский",
    "female": "ko-KR-Standard-A",
    "male": "ko-KR-Standard-C"
  },
  {
    "locale": "lt-LT",
    "language": "литовский",
    "female": null,
    "male": "lt-LT-Standard-B"
  },
  {
    "locale": "lv-LV",
    "language": "латышский",
    "female": null,
    "male": "lv-LV-Standard-B"
  },
  {
    "locale": "ml-IN",
    "language": "малаялам",
    "female": "ml-IN-Standard-A",
    "male": "ml-IN-Standard-B"
  },
  {
    "locale": "mr-IN",
    "language": "маратхи",
    "female": "mr-IN-Standard-A",
    "male": "mr-IN-Standard-B"
  },
  {
    "locale": "ms-MY",
    "language": "малайский",
    "female": "ms-MY-Standard-A",
    "male": "ms-MY-Standard-B"
  },
  {
    "locale": "nb-NO",
    "language": "норвежский (букмол)",
    "female": "nb-NO-Standard-F",
    "male": "nb-NO-Standard-G"
  },
  {
    "locale": "nl-BE",
    "language": "нидерландский (Бельгия)",
    "female": "nl-BE-Standard-C",
    "male": "nl-BE-Standard-D"
  },
  {
    "locale": "nl-NL",
    "language": "нидерландский (Нидерланды)",
    "female": "nl-NL-Standard-F",
    "male": "nl-NL-Standard-G"
  },
  {
    "locale": "pa-IN",
    "language": "панджаби",
    "female": "pa-IN-Standard-A",
    "male": "pa-IN-Standard-B"
  },
  {
    "locale": "pl-PL",
    "language": "польский",
    "female": "pl-PL-Standard-F",
    "male": "pl-PL-Standard-G"
  },
  {
    "locale": "pt-BR",
    "language": "португальский (Бразилия)",
    "female": "pt-BR-Standard-A",
    "male": "pt-BR-Standard-B"
  },
  {
    "locale": "pt-PT",
    "language": "португальский (Португалия)",
    "female": "pt-PT-Standard-E",
    "male": "pt-PT-Standard-F"
  },
  {
    "locale": "ro-RO",
    "language": "румынский",
    "female": "ro-RO-Standard-B",
    "male": null
  },
  {
    "locale": "ru-RU",
    "language": "русский",
    "female": "ru-RU-Standard-A",
    "male": "ru-RU-Standard-B"
  },
  {
    "locale": "sk-SK",
    "language": "словацкий",
    "female": "sk-SK-Standard-B",
    "male": null
  },
  {
    "locale": "sr-RS",
    "language": "сербский",
    "female": "sr-RS-Standard-B",
    "male": null
  },
  {
    "locale": "sv-SE",
    "language": "шведский",
    "female": "sv-SE-Standard-A",
    "male": "sv-SE-Standard-D"
  },
  {
    "locale": "ta-IN",
    "language": "тамильский",
    "female": "ta-IN-Standard-A",
    "male": "ta-IN-Standard-B"
  },
  {
    "locale": "te-IN",
    "language": "телугу",
    "female": "te-IN-Standard-A",
    "male": "te-IN-Standard-B"
  },
  {
    "locale": "th-TH",
    "language": "тайский",
    "female": "th-TH-Standard-A",
    "male": null
  },
  {
    "locale": "tr-TR",
    "language": "турецкий",
    "female": "tr-TR-Standard-A",
    "male": "tr-TR-Standard-B"
  },
  {
    "locale": "uk-UA",
    "language": "украинский",
    "female": "uk-UA-Standard-B",
    "male": null
  },
  {
    "locale": "ur-IN",
    "language": "урду",
    "female": "ur-IN-Standard-A",
    "male": "ur-IN-Standard-B"
  },
  {
    "locale": "vi-VN",
    "language": "вьетнамский",
    "female": "vi-VN-Standard-A",
    "male": "vi-VN-Standard-B"
  }
]
```

---

## 5. Голоса Gemini Flash TTS (характер + пол)

30 предустановленных голосов. Имена и **характер звучания** — из Gemini API;
**пол** — из официальной колонки Gender в Google Cloud Gemini-TTS (оба источника
дают идентичный набор из 30 голосов).

| Голос | Характер звучания (офиц.) | Пол |
|-------|---------------------------|-----|
| Zephyr | Bright — яркий | Женский |
| Puck | Upbeat — бодрый | Мужской |
| Charon | Informative — информативный | Мужской |
| Kore | Firm — уверенный | Женский |
| Fenrir | Excitable — возбуждённый | Мужской |
| Leda | Youthful — юный | Женский |
| Orus | Firm — уверенный | Мужской |
| Aoede | Breezy — лёгкий, непринуждённый | Женский |
| Callirrhoe | Easy-going — расслабленный | Женский |
| Autonoe | Bright — яркий | Женский |
| Enceladus | Breathy — с придыханием | Мужской |
| Iapetus | Clear — чистый | Мужской |
| Umbriel | Easy-going — расслабленный | Мужской |
| Algieba | Smooth — гладкий | Мужской |
| Despina | Smooth — гладкий | Женский |
| Erinome | Clear — чистый | Женский |
| Algenib | Gravelly — хрипловатый | Мужской |
| Rasalgethi | Informative — информативный | Мужской |
| Laomedeia | Upbeat — бодрый | Женский |
| Achernar | Soft — мягкий | Женский |
| Alnilam | Firm — уверенный | Мужской |
| Schedar | Even — ровный | Мужской |
| Gacrux | Mature — зрелый | Женский |
| Pulcherrima | Forward — напористый | Женский |
| Achird | Friendly — дружелюбный | Мужской |
| Zubenelgenubi | Casual — непринуждённый | Мужской |
| Vindemiatrix | Gentle — деликатный | Женский |
| Sadachbia | Lively — живой | Мужской |
| Sadaltager | Knowledgeable — «знающий» | Мужской |
| Sulafat | Warm — тёплый | Женский |

### Итоги

- **Всего голосов:** 30
- **Женских:** 14 — Zephyr, Kore, Leda, Aoede, Callirrhoe, Autonoe, Despina,
  Erinome, Laomedeia, Achernar, Gacrux, Pulcherrima, Vindemiatrix, Sulafat
- **Мужских:** 16 — Puck, Charon, Fenrir, Orus, Enceladus, Iapetus, Umbriel,
  Algieba, Algenib, Rasalgethi, Alnilam, Schedar, Achird, Zubenelgenubi,
  Sadachbia, Sadaltager

### Примечания

- Перевод характеров — для удобства; в коде/API используются англоязычные
  оригиналы (`Bright`, `Firm`, и т.д.).
- На слух **Umbriel** и **Sadachbia** (офиц. мужские) некоторые воспринимают как
  андрогинные, но официальная метка Google — мужская.
- Один и тот же набор из 30 голосов доступен для `gemini-2.5-flash-preview-tts`
  и `gemini-2.5-pro-preview-tts`.

---

## 6. Gemini 3.1 Flash TTS — тот же набор голосов

**Да, Gemini 3.1 Flash TTS использует тот же набор из 30 голосов** — с теми же
именами, характеристиками и гендерной разметкой, что и Gemini 2.5 Flash Preview
TTS. Таблица из раздела 5 применима к обеим моделям.

Отличается не набор голосов, а возможности:

| Аспект | Gemini 2.5 Flash Preview TTS | Gemini 3.1 Flash TTS |
|--------|------------------------------|----------------------|
| Набор голосов | 30 (те же имена) | **30 (те же имена)** |
| Пол / характер | официальные метки | те же метки |
| Языки | ~76 | **100+ (часть в preview)** |
| Управление стилем | director's note (промпт) | + **audio tags** / расширенная экспрессивность |

> ⚠️ Имена и пол совпадают по всем проверенным источникам; формулировки «характера»
> у отдельных голосов в 3.1 теоретически могли быть подкорректированы Google, но
> в найденных данных расхождений с набором 2.5 нет.

**Доп. источники по 3.1:**
- [Gemini 3.1 Flash TTS Preview — Gemini API](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-tts-preview)
- [Gemini 3.1 Flash TTS — Google blog](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-flash-tts/)

---

*Данные актуальны на июнь 2026. Цены и наборы голосов/языков у Google меняются —
при критичных решениях сверяйтесь с официальными страницами, указанными выше.*

---

## 7. Выбранные голоса

После прослушивания всех голосов Gemini выбраны:

- **Autonoe** — Bright (яркий), женский
- **Schedar** — Even (ровный), мужской
