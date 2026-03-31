import { buildAnimatedShinySpriteUrl } from '@team-soju/utils';

export const getShinySpriteUrl = (
  nationalNumber?: number | null,
  variantName?: string | null
) => {
  return buildAnimatedShinySpriteUrl(nationalNumber, variantName) || '';
};
