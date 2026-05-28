import { describe, it, expect } from 'vitest';
import { bleu, rouge1, rouge2, rougeL } from '../textMetrics';

// ─── Эталонные посты по каждой теме ──────────────────────────────────────────

const REF_NEWBUILDS =
  'Рынок недвижимости Санкт-Петербурга показывает рост цен на новостройки в 2024 году. ' +
  'Средняя стоимость квартиры в новом доме выросла на 12 процентов по сравнению с прошлым годом. ' +
  'Эксперты связывают это с высоким спросом и ограниченным предложением на первичном рынке.';

const REF_MORTGAGE =
  'Центральный банк России сохранил ключевую ставку на уровне 16 процентов в марте 2024 года. ' +
  'Ипотечные ставки по рыночным программам достигли 17–18 процентов годовых. ' +
  'Льготные программы с государственной поддержкой остаются единственным доступным инструментом для большинства покупателей жилья.';

const REF_RENTAL =
  'Стоимость аренды однокомнатных квартир в Москве выросла на 20 процентов в первом квартале 2024 года. ' +
  'Средняя арендная ставка достигла 65 тысяч рублей в месяц. ' +
  'Аналитики объясняют рост высокой ипотечной ставкой: всё больше людей откладывают покупку и остаются в съёмном жилье.';

const REF_SUBURBAN =
  'Спрос на загородные дома и коттеджи в Подмосковье вырос на 35 процентов по итогам 2023 года. ' +
  'Средняя цена дома в организованном посёлке составила 12 миллионов рублей. ' +
  'Популярность загородного жилья объясняется развитием удалённой работы и улучшением дорожной инфраструктуры.';

const REF_COMMERCIAL =
  'Объём инвестиций в коммерческую недвижимость России составил 750 миллиардов рублей в 2023 году, ' +
  'превысив показатели 2022 года на 40 процентов. ' +
  'Склады и логистические центры стали наиболее востребованным сегментом. ' +
  'Уход иностранных компаний освободил значительный объём офисных площадей в центральных районах Москвы.';

// ─── BLEU — базовые свойства метрики ─────────────────────────────────────────

describe('BLEU — базовые свойства', () => {
  it('идентичные тексты дают оценку 1.0', () => {
    expect(bleu(REF_NEWBUILDS, REF_NEWBUILDS)).toBeCloseTo(1.0, 5);
  });

  it('пустой кандидат возвращает 0', () => {
    expect(bleu('', REF_NEWBUILDS)).toBe(0);
  });

  it('результат всегда в диапазоне [0, 1]', () => {
    const score = bleu('цены на квартиры в Санкт-Петербурге растут каждый год', REF_NEWBUILDS);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('короткий кандидат получает штраф за краткость', () => {
    const short = bleu('новостройки рост цены', REF_NEWBUILDS);
    const longer = bleu(REF_NEWBUILDS.slice(0, 80), REF_NEWBUILDS);
    expect(short).toBeLessThan(longer);
  });

  it('BLEU-1 выше BLEU-4 для перефразированного текста', () => {
    const paraphrased = 'Цены на жильё в Петербурге растут. Новостройки подорожали на десять процентов.';
    expect(bleu(paraphrased, REF_NEWBUILDS, 1)).toBeGreaterThan(bleu(paraphrased, REF_NEWBUILDS, 4));
  });
});

// ─── ROUGE-1 — базовые свойства ───────────────────────────────────────────────

describe('ROUGE-1 — базовые свойства', () => {
  it('идентичные тексты: F1 = 1.0', () => {
    expect(rouge1(REF_NEWBUILDS, REF_NEWBUILDS).f1).toBeCloseTo(1.0, 5);
  });

  it('пустой кандидат: все компоненты = 0', () => {
    const { precision, recall, f1 } = rouge1('', REF_NEWBUILDS);
    expect(precision).toBe(0);
    expect(recall).toBe(0);
    expect(f1).toBe(0);
  });

  it('стоп-слова не дают значимого F1 для офтопик-текста', () => {
    const { f1 } = rouge1('жираф прыгает через высокий забор в африканской саванне', REF_NEWBUILDS);
    expect(f1).toBeLessThan(0.1);
  });

  it('recall выше у длинного поста (больше слов из эталона)', () => {
    const longPost = REF_NEWBUILDS + ' Застройщики планируют новые проекты для удовлетворения спроса.';
    const shortPost = 'рост цен новостройки Санкт-Петербург спрос предложение';
    expect(rouge1(longPost, REF_NEWBUILDS).recall).toBeGreaterThan(rouge1(shortPost, REF_NEWBUILDS).recall);
  });

  it('все компоненты в диапазоне [0, 1]', () => {
    const { precision, recall, f1 } = rouge1('цены на квартиры выросли на рынке недвижимости', REF_NEWBUILDS);
    expect(precision).toBeGreaterThanOrEqual(0);
    expect(precision).toBeLessThanOrEqual(1);
    expect(recall).toBeGreaterThanOrEqual(0);
    expect(recall).toBeLessThanOrEqual(1);
    expect(f1).toBeGreaterThanOrEqual(0);
    expect(f1).toBeLessThanOrEqual(1);
  });
});

// ─── ROUGE-2 — базовые свойства ───────────────────────────────────────────────

describe('ROUGE-2 — базовые свойства', () => {
  it('идентичные тексты: F1 = 1.0', () => {
    expect(rouge2(REF_NEWBUILDS, REF_NEWBUILDS).f1).toBeCloseTo(1.0, 5);
  });

  it('ROUGE-2 строже ROUGE-1 для перефразированного текста', () => {
    const paraphrased =
      'Стоимость жилья в Петербурге продолжает увеличиваться. ' +
      'Квартиры в новых домах стали дороже на двенадцать процентов.';
    expect(rouge2(paraphrased, REF_NEWBUILDS).f1).toBeLessThan(rouge1(paraphrased, REF_NEWBUILDS).f1);
  });

  it('дословный фрагмент эталона даёт F1 > 0.2', () => {
    const fragment = REF_NEWBUILDS.split('. ')[0];
    expect(rouge2(fragment, REF_NEWBUILDS).f1).toBeGreaterThan(0.2);
  });

  it('результат в диапазоне [0, 1]', () => {
    const { f1 } = rouge2('рынок недвижимости цены выросли новостройки', REF_NEWBUILDS);
    expect(f1).toBeGreaterThanOrEqual(0);
    expect(f1).toBeLessThanOrEqual(1);
  });
});

// ─── ROUGE-L — базовые свойства ───────────────────────────────────────────────

describe('ROUGE-L — базовые свойства', () => {
  it('идентичные тексты: F1 = 1.0', () => {
    expect(rougeL(REF_NEWBUILDS, REF_NEWBUILDS).f1).toBeCloseTo(1.0, 5);
  });

  it('пустой кандидат: все компоненты = 0', () => {
    const { precision, recall, f1 } = rougeL('', REF_NEWBUILDS);
    expect(precision).toBe(0);
    expect(recall).toBe(0);
    expect(f1).toBe(0);
  });

  it('перемешанные слова: ROUGE-L ≤ ROUGE-1 (порядок важен)', () => {
    const shuffled = 'предложение первичном рынке спрос высоким ограниченным это с связывают эксперты';
    expect(rougeL(shuffled, REF_NEWBUILDS).f1).toBeLessThanOrEqual(rouge1(shuffled, REF_NEWBUILDS).f1);
  });

  it('последовательный фрагмент даёт recall > 0.2', () => {
    const fragment = 'Рынок недвижимости Санкт-Петербурга показывает рост цен на новостройки';
    expect(rougeL(fragment, REF_NEWBUILDS).recall).toBeGreaterThan(0.2);
  });

  it('результат в диапазоне [0, 1]', () => {
    const { f1 } = rougeL('цены растут на рынке недвижимости в Санкт-Петербурге', REF_NEWBUILDS);
    expect(f1).toBeGreaterThanOrEqual(0);
    expect(f1).toBeLessThanOrEqual(1);
  });
});

// ─── Тема: Ипотечные ставки ───────────────────────────────────────────────────

describe('Тема: Ипотечные ставки', () => {
  const highPost =
    'ЦБ России сохранил ключевую ставку на уровне 16 процентов в марте 2024 года. ' +
    'Рыночные ипотечные ставки составляют от 17 до 18 процентов годовых. ' +
    'Льготные программы с господдержкой остаются главным инструментом доступности жилья.';

  const medPost =
    'Ипотека стала значительно дороже. Ставки по кредитам на жильё превысили 17 процентов. ' +
    'Без льготных программ многие граждане не могут купить квартиру.';

  const lowPost = 'Одобрим ипотеку за 24 часа! Минимальный пакет документов. Любая кредитная история.';

  it('высокое сходство: ROUGE-1 F1 > 0.4', () => {
    expect(rouge1(highPost, REF_MORTGAGE).f1).toBeGreaterThan(0.4);
  });

  it('среднее сходство: ROUGE-1 F1 между 0.1 и 0.4', () => {
    const f1 = rouge1(medPost, REF_MORTGAGE).f1;
    expect(f1).toBeGreaterThan(0.1);
    expect(f1).toBeLessThan(0.4);
  });

  it('нерелевантный пост: ROUGE-2 F1 = 0', () => {
    expect(rouge2(lowPost, REF_MORTGAGE).f1).toBe(0);
  });

  it('высокое сходство лучше нерелевантного по BLEU', () => {
    expect(bleu(highPost, REF_MORTGAGE)).toBeGreaterThan(bleu(lowPost, REF_MORTGAGE));
  });
});

// ─── Тема: Рынок аренды ──────────────────────────────────────────────────────

describe('Тема: Рынок аренды', () => {
  const highPost =
    'Аренда однокомнатных квартир в Москве подорожала на 20 процентов в первом квартале 2024 года. ' +
    'Средняя стоимость найма достигла 65 тысяч рублей в месяц. ' +
    'Эксперты связывают рост с высокими ставками по ипотеке — покупка жилья откладывается.';

  const medPost =
    'Снять квартиру в Москве стало заметно дороже. ' +
    'Цены на аренду выросли почти на пятую часть. ' +
    'Причина — недоступность ипотеки при высоких процентных ставках.';

  const lowPost = 'Сдам квартиру. Две комнаты, евроремонт, мебель, техника. Без посредников.';

  it('высокое сходство: ROUGE-1 F1 > 0.5', () => {
    expect(rouge1(highPost, REF_RENTAL).f1).toBeGreaterThan(0.5);
  });

  it('среднее сходство: ROUGE-1 F1 > 0.08', () => {
    expect(rouge1(medPost, REF_RENTAL).f1).toBeGreaterThan(0.08);
  });

  it('нерелевантный пост: ROUGE-1 F1 < 0.15', () => {
    expect(rouge1(lowPost, REF_RENTAL).f1).toBeLessThan(0.15);
  });

  it('монотонность: high > medium > low по ROUGE-1 F1', () => {
    const hi = rouge1(highPost, REF_RENTAL).f1;
    const md = rouge1(medPost, REF_RENTAL).f1;
    const lo = rouge1(lowPost, REF_RENTAL).f1;
    expect(hi).toBeGreaterThan(md);
    expect(md).toBeGreaterThan(lo);
  });
});

// ─── Тема: Загородная недвижимость ───────────────────────────────────────────

describe('Тема: Загородная недвижимость', () => {
  const highPost =
    'Загородная недвижимость Подмосковья показала рост спроса на 35 процентов в 2023 году. ' +
    'Средняя стоимость коттеджа в организованном посёлке достигла 12 миллионов рублей. ' +
    'Удалённая работа и развитие дорожной инфраструктуры повышают привлекательность жизни за городом.';

  const medPost =
    'Всё больше людей хотят жить за городом. ' +
    'Подмосковные коттеджи заметно подорожали и пользуются высоким спросом. ' +
    'Тренд на удалённую работу делает загородное жильё привлекательным.';

  const lowPost = 'Построим дом вашей мечты под ключ. Гарантия 10 лет. Рассрочка без процентов.';

  it('высокое сходство: BLEU-1 > 0.2 (BLEU-4 чувствителен к точным 4-граммам)', () => {
    expect(bleu(highPost, REF_SUBURBAN, 1)).toBeGreaterThan(0.2);
  });

  it('высокое сходство: ROUGE-L F1 > 0.35', () => {
    expect(rougeL(highPost, REF_SUBURBAN).f1).toBeGreaterThan(0.35);
  });

  it('нерелевантный пост: ROUGE-2 F1 < 0.05', () => {
    expect(rouge2(lowPost, REF_SUBURBAN).f1).toBeLessThan(0.05);
  });

  it('монотонность: high > medium > low по ROUGE-1 F1', () => {
    const hi = rouge1(highPost, REF_SUBURBAN).f1;
    const md = rouge1(medPost, REF_SUBURBAN).f1;
    const lo = rouge1(lowPost, REF_SUBURBAN).f1;
    expect(hi).toBeGreaterThan(md);
    expect(md).toBeGreaterThan(lo);
  });
});

// ─── Тема: Коммерческая недвижимость ─────────────────────────────────────────

describe('Тема: Коммерческая недвижимость', () => {
  const highPost =
    'Инвестиции в коммерческую недвижимость России достигли 750 миллиардов рублей в 2023 году — ' +
    'рост на 40 процентов относительно 2022 года. ' +
    'Складская и логистическая недвижимость лидирует по спросу. ' +
    'Уход иностранных компаний высвободил офисные площади в центре Москвы.';

  const medPost =
    'Рынок коммерческой недвижимости в России растёт. ' +
    'Инвесторы вкладывают рекордные суммы, особенно в склады и логистику. ' +
    'Освободившиеся офисы после ухода иностранцев переходят к новым арендаторам.';

  const lowPost = 'Аренда офисов от собственника. Гибкие условия, конференц-залы, парковка. Первый месяц бесплатно.';

  it('высокое сходство: ROUGE-1 F1 > 0.5', () => {
    expect(rouge1(highPost, REF_COMMERCIAL).f1).toBeGreaterThan(0.5);
  });

  it('среднее сходство: ROUGE-1 F1 > ROUGE-2 F1 (перефраз теряет биграммы)', () => {
    expect(rouge1(medPost, REF_COMMERCIAL).f1).toBeGreaterThan(rouge2(medPost, REF_COMMERCIAL).f1);
  });

  it('нерелевантный пост: ROUGE-2 F1 < 0.05', () => {
    expect(rouge2(lowPost, REF_COMMERCIAL).f1).toBeLessThan(0.05);
  });

  it('монотонность: high > medium > low по ROUGE-1 F1', () => {
    const hi = rouge1(highPost, REF_COMMERCIAL).f1;
    const md = rouge1(medPost, REF_COMMERCIAL).f1;
    const lo = rouge1(lowPost, REF_COMMERCIAL).f1;
    expect(hi).toBeGreaterThan(md);
    expect(md).toBeGreaterThan(lo);
  });
});

// ─── Сквозная проверка монотонности по всем темам ────────────────────────────

describe('Монотонность метрик по всем 5 темам', () => {
  const pairs: { ref: string; high: string; low: string; topic: string }[] = [
    {
      topic: 'Новостройки',
      ref: REF_NEWBUILDS,
      high:
        'Рынок недвижимости Санкт-Петербурга демонстрирует рост цен на новостройки в 2024 году. ' +
        'Средняя стоимость квартир выросла на 12 процентов. Спрос превышает предложение.',
      low: 'Купите квартиру мечты! Лучшие условия и скидки только для вас.',
    },
    {
      topic: 'Ипотека',
      ref: REF_MORTGAGE,
      high:
        'ЦБ сохранил ключевую ставку 16 процентов. Ипотечные ставки достигли 17–18 процентов годовых. ' +
        'Льготные программы господдержки остаются доступным инструментом.',
      low: 'Одобрим ипотеку за 24 часа. Любая кредитная история.',
    },
    {
      topic: 'Аренда',
      ref: REF_RENTAL,
      high:
        'Аренда квартир в Москве выросла на 20 процентов в первом квартале 2024 года. ' +
        'Ставка достигла 65 тысяч рублей в месяц из-за высокой ипотеки.',
      low: 'Сдам квартиру. Евроремонт, мебель. Без посредников.',
    },
    {
      topic: 'Загородная',
      ref: REF_SUBURBAN,
      high:
        'Спрос на коттеджи в Подмосковье вырос на 35 процентов в 2023 году. ' +
        'Средняя цена дома составила 12 миллионов рублей. Удалённая работа повышает интерес к загородному жилью.',
      low: 'Построим дом под ключ. Гарантия 10 лет.',
    },
    {
      topic: 'Коммерческая',
      ref: REF_COMMERCIAL,
      high:
        'Инвестиции в коммерческую недвижимость России достигли 750 миллиардов рублей в 2023 году. ' +
        'Рост на 40 процентов. Склады и логистика — самый востребованный сегмент.',
      low: 'Аренда офисов от собственника. Первый месяц бесплатно.',
    },
  ];

  it.each(pairs)(
    '$topic: релевантный пост имеет ROUGE-1 F1 выше нерелевантного',
    ({ ref, high, low }) => {
      expect(rouge1(high, ref).f1).toBeGreaterThan(rouge1(low, ref).f1);
    }
  );

  it.each(pairs)(
    '$topic: релевантный пост имеет ROUGE-L F1 выше нерелевантного',
    ({ ref, high, low }) => {
      expect(rougeL(high, ref).f1).toBeGreaterThan(rougeL(low, ref).f1);
    }
  );
});
