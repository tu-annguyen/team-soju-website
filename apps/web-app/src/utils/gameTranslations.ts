import { getClientLocale, getTranslations, type Locale } from '../i18n';

const GAME_LABELS: Record<Locale, Record<string, string>> = {
  en: {},
  es: {
    'Sweet Scent': 'Dulce Aroma', Singles: 'Encuentros individuales', Grass: 'Hierba',
    'Dark Grass': 'Hierba oscura', Cave: 'Cueva', Water: 'Agua', Inside: 'Interior',
    'Dust Cloud': 'Nube de polvo', Shadow: 'Sombra', Fishing: 'Pesca',
    'Old Rod': 'Caña Vieja', 'Good Rod': 'Caña Buena', 'Super Rod': 'Supercaña',
    'Honey Tree': 'Árbol de miel', Headbutt: 'Golpe Cabeza', 'Rock Smash': 'Golpe Roca',
    Spring: 'Primavera', Summer: 'Verano', Autumn: 'Otoño', Winter: 'Invierno',
    Morning: 'Mañana', Day: 'Día', Night: 'Noche', Any: 'Cualquiera',
    HP: 'PS', Atk: 'At.', Def: 'Def.', 'Sp. Atk': 'At. Esp.', 'Sp. Def': 'Def. Esp.', Speed: 'Velocidad',
  },
  zh: {
    'Sweet Scent': '甜甜香气', Singles: '单只遭遇', Grass: '草丛', 'Dark Grass': '深色草丛',
    Cave: '洞窟', Water: '水面', Inside: '室内', 'Dust Cloud': '尘土', Shadow: '影子',
    Fishing: '钓鱼', 'Old Rod': '破旧钓竿', 'Good Rod': '好钓竿', 'Super Rod': '厉害钓竿',
    'Honey Tree': '蜂蜜树', Headbutt: '头锤', 'Rock Smash': '碎岩', Spring: '春季',
    Summer: '夏季', Autumn: '秋季', Winter: '冬季', Morning: '早晨', Day: '白天',
    Night: '夜晚', Any: '任意', HP: 'HP', Atk: '攻击', Def: '防御', 'Sp. Atk': '特攻',
    'Sp. Def': '特防', Speed: '速度',
  },
};

const EGG_GROUP_LABELS: Record<Locale, Record<string, string>> = {
  en: {},
  es: {
    Monster: 'Monstruo', 'Water A': 'Agua A', Bug: 'Bicho', Flying: 'Volador', Field: 'Campo',
    Fairy: 'Hada', Grass: 'Planta', Humanoid: 'Humanoide', 'Water C': 'Agua C', Mineral: 'Mineral',
    Amorphous: 'Amorfo', 'Water B': 'Agua B', Dragon: 'Dragón',
  },
  zh: {
    Monster: '怪兽', 'Water A': '水中 A', Bug: '虫', Flying: '飞行', Field: '陆上', Fairy: '妖精',
    Grass: '植物', Humanoid: '人形', 'Water C': '水中 C', Mineral: '矿物', Amorphous: '不定形',
    'Water B': '水中 B', Dragon: '龙',
  },
};

export function getGameTranslations(localeInput?: string) {
  const locale = getClientLocale(localeInput);
  const translations = getTranslations(locale).tools.catchEventManager;
  const species = translations.pokemonSpecies as Record<string, string>;
  const regions = translations.regions as Record<string, string>;
  const locations = translations.locations as Record<string, string>;
  const labels = GAME_LABELS[locale];

  const location = (value: string) => {
    if (locations[value]) return locations[value];
    const routeMatch = /^Route (\d+)$/.exec(value);
    if (routeMatch) return translations.routePattern.replace('{number}', routeMatch[1]);
    const base = Object.keys(locations)
      .filter((candidate) => value.startsWith(`${candidate} `))
      .sort((left, right) => right.length - left.length)[0];
    return base ? `${locations[base]}${value.slice(base.length)}` : value;
  };

  return {
    locale,
    eggGroup: (value: string) => EGG_GROUP_LABELS[locale][value] || value,
    label: (value: string) => labels[value] || value,
    location,
    region: (value: string) => regions[value] || value,
    species: (value: string) => species[value] || value,
    tier: (value: string) => {
      const number = /^Tier ([0-7])$/.exec(value)?.[1];
      if (!number || locale === 'en') return value;
      return locale === 'es' ? `Categoría ${number}` : `阶级 ${number}`;
    },
    level: locale === 'es' ? 'Nv.' : locale === 'zh' ? '等级' : 'Lv.',
  };
}
