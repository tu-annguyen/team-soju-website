export interface ShinyPokemon {
  id: string;
  name: string;
  variantName: string | null;
  status: string | null;
  imageUrl: string;
  isFailed: boolean;
  isSecret: boolean;
  isAlpha: boolean;
  encounterType: string;
  tier: string;
  pointValue: number;
  catchDate: string | null;
  totalEncounters: number | null;
  speciesEncounters: number | null;
  nature: string | null;
  ivHp: number | null;
  ivAttack: number | null;
  ivDefense: number | null;
  ivSpAttack: number | null;
  ivSpDefense: number | null;
  ivSpeed: number | null;
}

export interface Trainer {
  name: string;
  numOT: number;
  totalPoints: number;
  shinies: ShinyPokemon[];
}

export interface ShinyFromAPI {
  id: string;
  national_number?: number | null;
  pokemon_name: string;
  variants?: string | null;
  trainer_name: string;
  encounter_type: string | null;
  is_secret: boolean;
  is_alpha: boolean;
  status: string | null;
  notes: string | null;
  catch_date: string | null;
  total_encounters: number | null;
  species_encounters: number | null;
  nature: string | null;
  iv_hp: number | null;
  iv_attack: number | null;
  iv_defense: number | null;
  iv_sp_attack: number | null;
  iv_sp_defense: number | null;
  iv_speed: number | null;
}
