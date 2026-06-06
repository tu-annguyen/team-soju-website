import React from 'react';

type Props = {
  className?: string;
  id?: string;
  options: readonly string[];
  placeholder?: string;
  required?: boolean;
  value: string;
  getOptionLabel?: (option: string) => string;
  onChange: (value: string) => void;
};

const MAX_VISIBLE_OPTIONS = 80;

const normalizeSearchValue = (value: string) => value.trim().toLowerCase();

export function FilteredCombobox({
  className = '',
  id,
  options,
  placeholder,
  required,
  value,
  getOptionLabel = (option) => option,
  onChange,
}: Props) {
  const listId = React.useId();
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const searchValue = normalizeSearchValue(value);

  const filteredOptions = React.useMemo(() => {
    const matches = searchValue
      ? options.filter((option) => {
          const label = getOptionLabel(option);
          return (
            normalizeSearchValue(option).includes(searchValue) ||
            normalizeSearchValue(label).includes(searchValue)
          );
        })
      : options;

    return matches.slice(0, MAX_VISIBLE_OPTIONS);
  }, [getOptionLabel, options, searchValue]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [searchValue, options]);

  const selectOption = (option: string) => {
    onChange(option);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <input
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={isOpen}
        aria-activedescendant={isOpen && filteredOptions[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        className={className}
        id={id}
        onBlur={() => setIsOpen(false)}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (!isOpen && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
            setIsOpen(true);
            return;
          }

          if (!isOpen || filteredOptions.length === 0) return;

          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((currentIndex) => Math.min(currentIndex + 1, filteredOptions.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((currentIndex) => Math.max(currentIndex - 1, 0));
          } else if (event.key === 'Enter') {
            event.preventDefault();
            selectOption(filteredOptions[activeIndex]);
          } else if (event.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        placeholder={placeholder}
        required={required}
        role="combobox"
        value={value}
      />
      {isOpen && filteredOptions.length > 0 && (
        <ul
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-xl dark:border-gray-700 dark:bg-gray-950"
          id={listId}
          role="listbox"
        >
          {filteredOptions.map((option, index) => {
            const label = getOptionLabel(option);
            const isActive = index === activeIndex;

            return (
              <li
                aria-selected={isActive}
                className={`cursor-pointer px-3 py-2 font-semibold ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
                    : 'text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800'
                }`}
                id={`${listId}-${index}`}
                key={option}
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectOption(option);
                }}
                role="option"
              >
                <span>{label}</span>
                {label !== option && (
                  <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">{option}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
