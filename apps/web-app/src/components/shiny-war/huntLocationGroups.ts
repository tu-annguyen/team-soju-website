import type { HuntSpot } from './types';

export type HuntLocationGroup = {
  key: string;
  spots: HuntSpot[];
};

export function huntLocationKey(spot: HuntSpot) {
  return `${spot.region}|${spot.location}`;
}

export function groupHuntSpotsByLocation(spots: HuntSpot[]): HuntLocationGroup[] {
  const groups = new Map<string, HuntLocationGroup>();
  spots.forEach((spot) => {
    const key = huntLocationKey(spot);
    const group = groups.get(key);
    if (group) group.spots.push(spot);
    else groups.set(key, { key, spots: [spot] });
  });
  return [...groups.values()];
}
