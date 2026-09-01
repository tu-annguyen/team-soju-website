import { getClientLocale } from '../../i18n';

const en = {
  page: {
    title: 'Hunt Finder - Team Soju',
    description: 'Compare wild encounter locations by shiny points, experience, levels, and EV yields.',
    eyebrow: 'Pokédex Search',
    heading: 'Hunt Finder',
    intro: 'Find and compare wild encounters by location, species, level, EV yield, shiny points, or estimated EXP per hour.',
  },
  sections: { filters: 'Filters', sort: 'Sort' },
  fields: {
    season: 'Season', region: 'Region', location: 'Location', species: 'Species', method: 'Encounter method',
    time: 'Time', minimumTier: 'Minimum tier', minimumLevel: 'Minimum level', minimumPoints: 'Minimum points/hour', minimumExp: 'Minimum EXP/hour',
    hordeSize: 'Horde size', hordesPerHour: 'Hordes/hour', sortBy: 'Sort by', direction: 'Sort direction',
  },
  options: {
    anySeason: 'Any season', everyRegion: 'Every region', everyLocation: 'Every location', everySpecies: 'Every species',
    everyMethod: 'Every wild encounter method', sweetScent: 'Sweet Scent (Hordes)', singles: 'Singles', fishing: 'Fishing',
    honeyTrees: 'Honey Trees', headbutt: 'Headbutt', rockSmash: 'Rock Smash', anyTime: 'Any time', morning: 'Morning',
    day: 'Day', night: 'Night', noMinimum: 'No minimum', hourlyUnavailable: 'Hourly data unavailable', bothHordes: '3× and 5×',
    threeOnly: '3× only', fiveOnly: '5× only', pointsHour: 'Points/hour', expHour: 'EXP/hour', alphabetical: 'Alphabetical',
    descending: 'Descending', ascending: 'Ascending', fullSplit: '100% split hordes only', nonSafari: 'Non-Safari only',
  },
  evYield: 'EV yield',
  eggGroups: 'Egg groups',
  evStats: { hp: 'HP', attack: 'Attack', defense: 'Defense', spAttack: 'Special Attack', spDefense: 'Special Defense', speed: 'Speed' },
  boosts: 'Boosts and charms', expBoosts: 'Boosts and Charms', noExpCharm: 'No EXP Charm', expCharm25: 'EXP Charm +25%', expCharm50: 'EXP Charm +50%', expCharm100: 'EXP Charm +100%',
  expReamplifier: 'Exp. Reamplifier +5%', expDonator: "Donator's Status +25%", tradeBonus: 'Trade Bonus +15%',
  reamplifierNote: 'Reamplifier distribution depends on party size, participation, and level-100 Pokémon. This estimate applies its +5% to aggregate battle EXP.',
  eventBoost: 'Event +10%', donator: 'Donator +10%', personalCharm: 'Personal charm', linkCharm: 'Link charm', chumBucket: 'Chum bucket',
  war: {
    exclude: 'Exclude caught evolution lines', unique: 'Include unique species bonus in calculations', official: 'From Official War participants',
    team: 'From Team War participants', officialExclude: 'Exclude Official caught evolution lines', teamExclude: 'Exclude Team War caught evolution lines',
    officialUnique: 'Official unique species +8', teamUnique: 'Team War unique species +8',
  },
  results: {
    location: 'Location', pokemon: 'Pokémon', collapseAll: 'Collapse all', openAll: 'Open all', matching: 'matching encounter groups. Rates are normalized within each location/time group.',
    couldNotLoad: 'Could not load hunts.', wildLocation: 'wild location', wildLocations: 'wild locations', point: 'point', points: 'points',
    split: 'split', splits: 'splits', encounter: 'encounter', lowerPoints: 'lower points/hour', lowerExp: 'lower EXP/hour',
    show: 'Show', hide: 'Hide', collapse: 'Collapse', expand: 'Expand', queue: 'Queue', huntNow: 'Hunt now', averageExp: 'average EXP/encounter',
    averageShiny: 'average/shiny', noHourly: 'No reliable encounters/hour data', encountersHour: 'encounters/hour', effectiveOdds: 'effective odds',
    includesLure: 'Includes Lure encounters', includesSpecial: 'Includes Special encounters', lureOnly: 'Lure', special: 'Special',
  },
  clock: { label: 'Current PokeMMO time', time: 'In-game time', season: 'Season', timeOfDay: 'Time of day', weekday: 'Day of week' },
  calendar: { Spring: 'Spring', Summer: 'Summer', Autumn: 'Autumn', Winter: 'Winter', Morning: 'Morning', Day: 'Day', Night: 'Night', Monday: 'Monday', Tuesday: 'Tuesday', Wednesday: 'Wednesday', Thursday: 'Thursday', Friday: 'Friday', Saturday: 'Saturday', Sunday: 'Sunday' },
} as const;

type WidenStrings<T> = { -readonly [Key in keyof T]: T[Key] extends string ? string : WidenStrings<T[Key]> };
type HuntFinderMessages = WidenStrings<typeof en>;

const es: HuntFinderMessages = {
  page: { title: 'Buscador de cacerías - Team Soju', description: 'Compara lugares de encuentros salvajes por puntos shiny, experiencia, niveles y EV.', eyebrow: 'Búsqueda en la Pokédex', heading: 'Buscador de cacerías', intro: 'Busca y compara encuentros salvajes por lugar, especie, nivel, EV, puntos shiny o EXP estimada por hora.' },
  sections: { filters: 'Filtros', sort: 'Ordenar' },
  fields: { season: 'Estación', region: 'Región', location: 'Lugar', species: 'Especie', method: 'Método de encuentro', time: 'Hora', minimumTier: 'Tier mínimo', minimumLevel: 'Nivel mínimo', minimumPoints: 'Puntos/hora mínimos', minimumExp: 'EXP/hora mínima', hordeSize: 'Tamaño de horda', hordesPerHour: 'Hordas/hora', sortBy: 'Ordenar por', direction: 'Dirección' },
  options: { anySeason: 'Cualquier estación', everyRegion: 'Todas las regiones', everyLocation: 'Todos los lugares', everySpecies: 'Todas las especies', everyMethod: 'Todos los métodos de encuentro salvaje', sweetScent: 'Dulce Aroma (Hordas)', singles: 'Individuales', fishing: 'Pesca', honeyTrees: 'Árboles de miel', headbutt: 'Golpe Cabeza', rockSmash: 'Golpe Roca', anyTime: 'Cualquier hora', morning: 'Mañana', day: 'Día', night: 'Noche', noMinimum: 'Sin mínimo', hourlyUnavailable: 'Datos por hora no disponibles', bothHordes: '3× y 5×', threeOnly: 'Solo 3×', fiveOnly: 'Solo 5×', pointsHour: 'Puntos/hora', expHour: 'EXP/hora', alphabetical: 'Alfabético', descending: 'Descendente', ascending: 'Ascendente', fullSplit: 'Solo hordas con reparto al 100%', nonSafari: 'Solo fuera de Safari' },
  evYield: 'EV otorgados', eggGroups: 'Grupos Huevo', evStats: { hp: 'PS', attack: 'Ataque', defense: 'Defensa', spAttack: 'Ataque Especial', spDefense: 'Defensa Especial', speed: 'Velocidad' },
  boosts: 'Mejoras y amuletos', expBoosts: 'Mejoras y amuletos', noExpCharm: 'Sin amuleto de EXP', expCharm25: 'Amuleto de EXP +25%', expCharm50: 'Amuleto de EXP +50%', expCharm100: 'Amuleto de EXP +100%', expReamplifier: 'Reamplificador de EXP +5%', expDonator: 'Estado de donador +25%', tradeBonus: 'Bonus por intercambio +15%', reamplifierNote: 'El reparto del Reamplificador depende del equipo, la participación y los Pokémon de nivel 100. Esta estimación aplica su +5% a la EXP total del combate.', eventBoost: 'Evento +10%', donator: 'Donador +10%', personalCharm: 'Amuleto personal', linkCharm: 'Amuleto de enlace', chumBucket: 'Cubo de cebo',
  war: { exclude: 'Excluir líneas evolutivas capturadas', unique: 'Incluir bonus de especie única en los cálculos', official: 'De participantes de la guerra oficial', team: 'De participantes de la guerra del equipo', officialExclude: 'Excluir líneas capturadas de la guerra oficial', teamExclude: 'Excluir líneas capturadas de la guerra del equipo', officialUnique: 'Especie única oficial +8', teamUnique: 'Especie única del equipo +8' },
  results: { location: 'Lugar', pokemon: 'Pokémon', collapseAll: 'Contraer todo', openAll: 'Abrir todo', matching: 'grupos de encuentros coincidentes. Las tasas se normalizan dentro de cada grupo de lugar/hora.', couldNotLoad: 'No se pudieron cargar las cacerías.', wildLocation: 'lugar salvaje', wildLocations: 'lugares salvajes', point: 'punto', points: 'puntos', split: 'reparto', splits: 'repartos', encounter: 'encuentro', lowerPoints: 'con menos puntos/hora', lowerExp: 'con menos EXP/hora', show: 'Mostrar', hide: 'Ocultar', collapse: 'Contraer', expand: 'Expandir', queue: 'Añadir a cola', huntNow: 'Cazar ahora', averageExp: 'EXP media/encuentro', averageShiny: 'media/shiny', noHourly: 'Sin datos fiables de encuentros/hora', encountersHour: 'encuentros/hora', effectiveOdds: 'probabilidad efectiva', includesLure: 'Incluye encuentros con Señuelo', includesSpecial: 'Incluye encuentros especiales', lureOnly: 'Señuelo', special: 'Especial' },
  clock: { label: 'Hora actual de PokeMMO', time: 'Hora del juego', season: 'Estación', timeOfDay: 'Momento del día', weekday: 'Día de la semana' },
  calendar: { Spring: 'Primavera', Summer: 'Verano', Autumn: 'Otoño', Winter: 'Invierno', Morning: 'Mañana', Day: 'Día', Night: 'Noche', Monday: 'Lunes', Tuesday: 'Martes', Wednesday: 'Miércoles', Thursday: 'Jueves', Friday: 'Viernes', Saturday: 'Sábado', Sunday: 'Domingo' },
};

const zh: HuntFinderMessages = {
  page: { title: '狩猎查找器 - Team Soju', description: '按闪光积分、经验、等级和 EV 产出比较野外遭遇地点。', eyebrow: '图鉴搜索', heading: '狩猎查找器', intro: '按地点、宝可梦、等级、EV 产出、闪光积分或每小时预估经验查找并比较野外遭遇。' },
  sections: { filters: '筛选', sort: '排序' },
  fields: { season: '季节', region: '地区', location: '地点', species: '宝可梦', method: '遭遇方式', time: '时段', minimumTier: '最低阶级', minimumLevel: '最低等级', minimumPoints: '最低积分/小时', minimumExp: '最低经验/小时', hordeSize: '群怪数量', hordesPerHour: '每小时群怪数', sortBy: '排序方式', direction: '排序方向' },
  options: { anySeason: '任意季节', everyRegion: '所有地区', everyLocation: '所有地点', everySpecies: '所有宝可梦', everyMethod: '所有野外遭遇方式', sweetScent: '甜甜香气（群怪）', singles: '单只遭遇', fishing: '钓鱼', honeyTrees: '蜂蜜树', headbutt: '头锤', rockSmash: '碎岩', anyTime: '任意时段', morning: '早晨', day: '白天', night: '夜晚', noMinimum: '无最低限制', hourlyUnavailable: '无每小时数据', bothHordes: '3× 和 5×', threeOnly: '仅 3×', fiveOnly: '仅 5×', pointsHour: '积分/小时', expHour: '经验/小时', alphabetical: '字母顺序', descending: '降序', ascending: '升序', fullSplit: '仅 100% 固定群怪', nonSafari: '仅非狩猎地带' },
  evYield: 'EV 产出', eggGroups: '蛋群', evStats: { hp: 'HP', attack: '攻击', defense: '防御', spAttack: '特攻', spDefense: '特防', speed: '速度' },
  boosts: '加成与护符', expBoosts: '加成与护符', noExpCharm: '无经验护符', expCharm25: '经验护符 +25%', expCharm50: '经验护符 +50%', expCharm100: '经验护符 +100%', expReamplifier: '经验再增幅器 +5%', expDonator: '捐赠者状态 +25%', tradeBonus: '交换加成 +15%', reamplifierNote: '经验再增幅器的分配取决于队伍人数、参战情况和等级 100 的宝可梦。此估算将其 +5% 应用于战斗总经验。', eventBoost: '活动 +10%', donator: '捐赠者 +10%', personalCharm: '个人护符', linkCharm: '组队护符', chumBucket: '诱饵桶',
  war: { exclude: '排除已捕获的进化链', unique: '在计算中加入独特宝可梦加分', official: '来自官方闪光大战参与者', team: '来自队内闪光大战参与者', officialExclude: '排除官方大战已捕获进化链', teamExclude: '排除队内大战已捕获进化链', officialUnique: '官方独特宝可梦 +8', teamUnique: '队内独特宝可梦 +8' },
  results: { location: '地点', pokemon: '宝可梦', collapseAll: '全部折叠', openAll: '全部展开', matching: '个符合条件的遭遇组。概率按各地点/时段组归一化。', couldNotLoad: '无法加载狩猎数据。', wildLocation: '个野外地点', wildLocations: '个野外地点', point: '积分', points: '积分', split: '组合', splits: '组合', encounter: '遭遇', lowerPoints: '较低积分/小时', lowerExp: '较低经验/小时', show: '显示', hide: '隐藏', collapse: '折叠', expand: '展开', queue: '加入队列', huntNow: '立即狩猎', averageExp: '平均经验/遭遇', averageShiny: '平均值/闪光', noHourly: '没有可靠的每小时遭遇数据', encountersHour: '次遭遇/小时', effectiveOdds: '有效概率', includesLure: '包含诱饵遭遇', includesSpecial: '包含特殊遭遇', lureOnly: '诱饵', special: '特殊' },
  clock: { label: '当前 PokeMMO 时间', time: '游戏时间', season: '季节', timeOfDay: '时段', weekday: '星期' },
  calendar: { Spring: '春季', Summer: '夏季', Autumn: '秋季', Winter: '冬季', Morning: '早晨', Day: '白天', Night: '夜晚', Monday: '星期一', Tuesday: '星期二', Wednesday: '星期三', Thursday: '星期四', Friday: '星期五', Saturday: '星期六', Sunday: '星期日' },
};

export function getHuntFinderMessages(locale?: string): HuntFinderMessages {
  const activeLocale = getClientLocale(locale);
  return activeLocale === 'es' ? es : activeLocale === 'zh' ? zh : en;
}

export type { HuntFinderMessages };
