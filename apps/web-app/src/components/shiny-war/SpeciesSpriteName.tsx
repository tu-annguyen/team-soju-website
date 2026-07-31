type Props = {
  name: string;
  slug?: string;
  form?: string;
  className?: string;
};

const spriteSlug = (name: string, slug?: string, form?: string) => {
  const base = (slug || name)
    .toLowerCase()
    .replace(/♀/g, '-f')
    .replace(/♂/g, '-m')
    .replace(/\bmr\.\s*/g, 'mr-')
    .replace(/farfetch['’]d/g, 'farfetchd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const normalizedForm = (form || '').toLowerCase();

  if (normalizedForm.includes('female') && !base.endsWith('-f')) return `${base}-f`;
  return base;
};

export default function SpeciesSpriteName({ name, slug, form, className = '' }: Props) {
  const imageSlug = spriteSlug(name, slug, form);

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <img
        aria-hidden="true"
        alt=""
        className="h-8 w-8 shrink-0 object-contain [image-rendering:pixelated]"
        loading="lazy"
        onError={(event) => { event.currentTarget.style.display = 'none'; }}
        src={`https://img.pokemondb.net/sprites/black-white/anim/shiny/${imageSlug}.gif`}
      />
      <span>{name}</span>
    </span>
  );
}
