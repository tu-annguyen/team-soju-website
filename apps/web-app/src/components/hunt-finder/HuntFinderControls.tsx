import type { Dispatch, SetStateAction } from 'react';
import { CATCH_EVENT_REGIONS } from '../../utils/catchEventLocations';
import { POKEMON_SPECIES_NAMES } from '../../utils/pokemonSpecies';
import NumberSpinner from '../NumberSpinner';
import { FilteredCombobox } from '../catch-events/FilteredCombobox';
import { getHuntFinderMessages, type HuntFinderMessages } from './messages';
import { EGG_GROUP_OPTIONS, EV_STAT_OPTIONS, type EggGroup, type EvAmount, type HuntFinderContext, type HuntFinderFilters } from './types';
import { getGameTranslations } from '../../utils/gameTranslations';

type Props = { context: HuntFinderContext; filters: HuntFinderFilters; locale?: string; locations: string[]; setFilters: Dispatch<SetStateAction<HuntFinderFilters>>; teamWarAvailable: boolean };
type SectionProps = Props & { messages: HuntFinderMessages };
const field = 'mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-gray-700 dark:bg-gray-950 dark:text-white';
const label = 'text-sm font-semibold text-gray-800 dark:text-gray-100';
const check = 'h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-2 focus:ring-primary-500/30 dark:border-gray-600 dark:bg-gray-950';
const section = 'grid gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4 dark:border-gray-700 dark:bg-gray-950';
const subsection = 'rounded-lg border border-gray-200 bg-gray-100 p-4 dark:border-gray-700 dark:bg-gray-900';
const DEFAULT_ENCOUNTERS_PER_HOUR: Partial<Record<HuntFinderFilters['method'], string>> = {
  'Sweet Scent': '240',
  Singles: '300',
  Fishing: '200',
  'Honey Trees': '50',
};

function defaultEncountersPerHour(method: string, chumBucket: boolean) {
  return method === 'Fishing' && chumBucket ? '400' : DEFAULT_ENCOUNTERS_PER_HOUR[method] || '';
}

export default function HuntFinderControls(props: Props) {
  const messages = getHuntFinderMessages(props.locale);
  return <div className="space-y-4"><Filters {...props} messages={messages} /><Sort {...props} messages={messages} /></div>;
}

function Filters({ context, filters: f, locale, locations, messages: m, setFilters, teamWarAvailable }: SectionProps) {
  const set = <K extends keyof HuntFinderFilters>(key: K, value: HuntFinderFilters[K]) => setFilters((old) => ({ ...old, [key]: value }));
  const scent = ['All', 'Sweet Scent'].includes(f.method);
  const encounterRateDisabled = ['All', 'Headbutt', 'Rock Smash'].includes(f.method);
  const nonSafari = ['All', 'Singles', 'Fishing'].includes(f.method);
  const alphabetical = f.sort === 'alphabetical';
  const hasEvStats = f.evStats.length > 0;
  const game = getGameTranslations(locale);
  const methods = [['All', m.options.everyMethod], ['Sweet Scent', m.options.sweetScent], ['Singles', m.options.singles], ['Fishing', m.options.fishing], ['Honey Trees', m.options.honeyTrees], ['Headbutt', m.options.headbutt], ['Rock Smash', m.options.rockSmash]] as const;
  return <section aria-labelledby="hunt-filters-heading" className={section}>
    <h2 className="text-lg font-bold sm:col-span-2 lg:col-span-4" id="hunt-filters-heading">{m.sections.filters}</h2>
    <Select title={m.fields.season} value={f.season} onChange={(v) => set('season', v)} options={[['', m.options.anySeason], ...(['Summer', 'Autumn', 'Winter', 'Spring'] as const).map((v) => [v, m.calendar[v]] as const)]} />
    <label className={label}>{m.fields.region}<FilteredCombobox className={field} getOptionLabel={game.region} options={CATCH_EVENT_REGIONS} value={f.region} onChange={(region) => setFilters((old) => ({ ...old, region, location: '' }))} placeholder={m.options.everyRegion} /></label>
    <label className={label}>{m.fields.location}<FilteredCombobox className={field} getOptionLabel={game.location} options={locations} value={f.location} onChange={(v) => set('location', v)} placeholder={m.options.everyLocation} /></label>
    <label className={label}>{m.fields.species}<FilteredCombobox className={field} getOptionLabel={game.species} options={POKEMON_SPECIES_NAMES} value={f.species} onChange={(v) => set('species', v)} placeholder={m.options.everySpecies} /></label>
    <Select title={m.fields.method} value={f.method} onChange={(method) => setFilters((old) => ({
      ...old,
      method,
      encountersPerHour: defaultEncountersPerHour(method, old.chumBucket),
      ...(old.sort === 'expPerHour' && !['All', 'Sweet Scent'].includes(method)
        ? { sort: 'alphabetical' as const, sortDirection: 'asc' as const }
        : {}),
    }))} options={methods} />
    <Select title={m.fields.time} value={f.time} onChange={(v) => set('time', v)} options={[['', m.options.anyTime], ['morning', m.options.morning], ['day', m.options.day], ['night', m.options.night]]} />
    {f.sort !== 'expPerHour' && <Spinner title={m.fields.minimumTier} value={f.minTier} setValue={(v) => set('minTier', v)} placeholder={m.options.noMinimum} min={0} max={7} reverse />}
    {f.sort !== 'pointsPerHour' && <Spinner title={m.fields.minimumLevel} value={f.minLevel} setValue={(v) => set('minLevel', v)} placeholder={m.options.noMinimum} min={1} max={100} />}
    {(f.sort === 'pointsPerHour' || alphabetical) && <Spinner title={m.fields.minimumPoints} value={f.minPointsPerHour} setValue={(v) => set('minPointsPerHour', v)} placeholder={m.options.noMinimum} min={0} step={0.001} />}
    {(f.sort === 'expPerHour' || alphabetical) && <Spinner title={m.fields.minimumExp} value={f.minExpPerHour} setValue={(v) => set('minExpPerHour', v)} placeholder={m.options.noMinimum} min={0} />}
    <Select title={m.fields.hordeSize} value={f.hordeSize} disabled={!scent} onChange={(v) => set('hordeSize', v)} options={[['', m.options.bothHordes], ['3', m.options.threeOnly], ['5', m.options.fiveOnly]]} />
    <Spinner title={f.method === 'Sweet Scent' ? m.fields.hordesPerHour : m.fields.encountersPerHour} value={f.encountersPerHour} setValue={(v) => set('encountersPerHour', v)} min={1} max={5000} disabled={encounterRateDisabled} />
    <Check panel disabled={!scent} text={m.options.fullSplit} checked={f.fullSplitOnly} onChange={(v) => set('fullSplitOnly', v)} />
    <Check panel disabled={!nonSafari} text={m.options.nonSafari} checked={f.nonSafari} onChange={(v) => set('nonSafari', v)} />
    {(f.sort === 'expPerHour' || alphabetical) && <fieldset className={`${subsection} sm:col-span-2 lg:col-span-4`}><legend className="px-1 text-sm font-semibold">{m.evYield}</legend>
      <div className="grid gap-4 lg:grid-cols-[3fr_1fr]"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{EV_STAT_OPTIONS.map(([v]) => <label key={v} className="flex items-center gap-2 text-sm"><input className={check} type="checkbox" checked={f.evStats.includes(v)} onChange={() => setFilters((old) => {
        const evStats = old.evStats.includes(v) ? old.evStats.filter((stat) => stat !== v) : [...old.evStats, v];
        return { ...old, evStats, evAmounts: evStats.length ? old.evAmounts : [] };
      })} />{m.evStats[v]}</label>)}</div>
      <div className="flex gap-4">{(['1', '2'] as EvAmount[]).map((v) => <label key={v} className={`flex items-center gap-2 text-sm ${hasEvStats ? '' : 'opacity-50'}`}><input className={check} disabled={!hasEvStats} type="checkbox" checked={f.evAmounts[0] === v} onChange={() => set('evAmounts', f.evAmounts[0] === v ? [] : [v])} />+{v} EV</label>)}</div></div>
    </fieldset>}
    {(f.sort === 'pointsPerHour' || alphabetical) && <fieldset className={`${subsection} sm:col-span-2 lg:col-span-4`}><legend className="px-1 text-sm font-semibold">{m.eggGroups}</legend>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{EGG_GROUP_OPTIONS.map((group) => <label key={group} className="flex items-center gap-2 text-sm"><input className={check} type="checkbox" checked={f.eggGroups.includes(group)} onChange={() => set('eggGroups', f.eggGroups.includes(group) ? f.eggGroups.filter((value) => value !== group) : [...f.eggGroups, group] as EggGroup[])} />{game.eggGroup(group)}</label>)}</div>
    </fieldset>}
    {context === 'shinyWar' && <War filters={f} messages={m} setFilters={setFilters} teamWarAvailable={teamWarAvailable} />}
  </section>;
}

function Sort({ filters: f, messages: m, setFilters }: SectionProps) {
  const set = <K extends keyof HuntFinderFilters>(key: K, value: HuntFinderFilters[K]) => setFilters((old) => ({ ...old, [key]: value }));
  const exp = ['All', 'Sweet Scent'].includes(f.method);
  const fishing = ['All', 'Fishing'].includes(f.method);
  return <section aria-labelledby="hunt-sort-heading" className={section}>
    <h2 className="text-lg font-bold sm:col-span-2 lg:col-span-4" id="hunt-sort-heading">{m.sections.sort}</h2>
    <Select title={m.fields.sortBy} value={f.sort} onChange={(v) => setFilters((old) => ({
      ...old,
      sort: v as HuntFinderFilters['sort'],
      sortDirection: v === 'alphabetical' ? 'asc' : 'desc',
    }))} options={[['alphabetical', m.options.alphabetical], ['pointsPerHour', m.options.pointsHour], ['expPerHour', m.options.expHour, !exp]]} />
    <Select title={m.fields.direction} value={f.sortDirection} onChange={(v) => set('sortDirection', v as HuntFinderFilters['sortDirection'])} options={[['asc', m.options.ascending], ['desc', m.options.descending]]} />
    {f.sort === 'pointsPerHour' && <fieldset className={`${subsection} sm:col-span-2 lg:col-span-4`}><legend className="px-1 text-sm font-semibold">{m.boosts}</legend><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{([['eventBoost', m.eventBoost], ['donator', m.donator], ['personalCharm', m.personalCharm], ['linkCharm', m.linkCharm], ['chumBucket', m.chumBucket]] as const).map(([k, text]) => <Check key={k} disabled={k === 'chumBucket' && !fishing} text={text} checked={f[k]} onChange={(v) => setFilters((old) => ({
      ...old,
      [k]: v,
      ...(k === 'chumBucket' && old.method === 'Fishing'
        ? { encountersPerHour: v ? '400' : '200' }
        : {}),
    }))} />)}</div></fieldset>}
    {f.sort === 'expPerHour' && <fieldset className={`${subsection} sm:col-span-2 lg:col-span-4`}><legend className="px-1 text-sm font-semibold">{m.expBoosts}</legend><div className="grid gap-3 sm:grid-cols-3">{([['expReamplifier', m.expReamplifier], ['expDonator', m.expDonator], ['tradeBonus', m.tradeBonus]] as const).map(([key, text]) => <Check key={key} text={text} checked={f[key]} onChange={(value) => set(key, value)} />)}</div><div className="mt-4 grid gap-3 sm:grid-cols-4 border-t pt-4">{([['', m.noExpCharm], ['0.25', m.expCharm25], ['0.5', m.expCharm50], ['1', m.expCharm100]] as const).map(([v, text]) => <label key={v || 'none'} className="flex items-center gap-2 text-sm"><input type="radio" name="exp-charm" checked={f.expCharm === v} onChange={() => set('expCharm', v)} />{text}</label>)}</div>{f.expReamplifier && <p className="mt-3 text-xs text-gray-500">{m.reamplifierNote}</p>}</fieldset>}
  </section>;
}

function Select({ title, value, options, onChange, disabled }: { title: string; value: string; options: ReadonlyArray<readonly [string, string, boolean?]>; onChange: (v: string) => void; disabled?: boolean }) {
  return <label className={label}>{title}<select aria-label={title} className={`${field} disabled:opacity-50`} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([v, text, off]) => <option key={v} value={v} disabled={off}>{text}</option>)}</select></label>;
}
function Spinner({ title, value, setValue, placeholder, min, max, disabled, reverse, step = 1 }: { title: string; value: string; setValue: (v: string) => void; placeholder?: string; min: number; max?: number; disabled?: boolean; reverse?: boolean; step?: number }) {
  const controlName = title === 'Minimum tier' ? 'minimum tier' : title;
  return <div className={label}><span>{title}</span><NumberSpinner aria-label={title} className={`${field} !mt-0`} disabled={disabled} min={min} max={max} onValueChange={setValue} placeholder={placeholder} step={step} value={value} wrapperClassName="mt-2" reverse={reverse} clearOnDecrementAtMax={reverse} decrementLabel={`Decrease ${controlName}`} incrementLabel={`Increase ${controlName}`} /></div>;
}
function Check({ checked, disabled, panel, text, onChange }: { checked: boolean; disabled?: boolean; panel?: boolean; text: string; onChange: (v: boolean) => void }) {
  return <label className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm ${panel ? 'border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-900' : ''} ${disabled ? 'opacity-50' : ''}`}><input aria-label={text} className={check} disabled={disabled} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{text}</label>;
}
function War({ filters: f, messages: m, setFilters, teamWarAvailable }: Pick<SectionProps, 'filters' | 'messages' | 'setFilters' | 'teamWarAvailable'>) {
  return <><fieldset className={`${subsection} sm:col-span-2`}><legend>{m.war.exclude}</legend><Check text={m.war.officialExclude} checked={f.excludeOfficialCaught} onChange={(v) => setFilters((o) => ({ ...o, excludeOfficialCaught: v, excludeTeamCaught: v ? false : o.excludeTeamCaught }))} /><Check text={m.war.teamExclude} disabled={!teamWarAvailable} checked={f.excludeTeamCaught} onChange={(v) => setFilters((o) => ({ ...o, excludeTeamCaught: v, excludeOfficialCaught: v ? false : o.excludeOfficialCaught }))} /></fieldset>
    <fieldset className={`${subsection} sm:col-span-2`}><legend>{m.war.unique}</legend><Check text={m.war.officialUnique} checked={f.officialUniqueBonus} onChange={(v) => setFilters((o) => ({ ...o, officialUniqueBonus: v, teamUniqueBonus: v ? false : o.teamUniqueBonus }))} /><Check text={m.war.teamUnique} disabled={!teamWarAvailable} checked={f.teamUniqueBonus} onChange={(v) => setFilters((o) => ({ ...o, teamUniqueBonus: v, officialUniqueBonus: v ? false : o.officialUniqueBonus }))} /></fieldset></>;
}
