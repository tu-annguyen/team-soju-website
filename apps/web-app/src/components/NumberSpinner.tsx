import type { InputHTMLAttributes, KeyboardEvent } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'value'> & {
  clearOnDecrementAtMax?: boolean;
  decrementLabel?: string;
  incrementLabel?: string;
  onValueChange: (value: string) => void;
  reverse?: boolean;
  value: number | string;
  wrapperClassName?: string;
};

const spinnerButtonClasses =
  'flex flex-1 items-center justify-center bg-gray-50 text-[10px] text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800';

function decimalPlaces(value: number) {
  const [, decimals = ''] = String(value).split('.');
  return decimals.length;
}

function formatValue(value: number, step: number) {
  const precision = decimalPlaces(step);
  return precision ? value.toFixed(precision).replace(/\.?0+$/, '') : String(value);
}

function matchesStep(value: number, minimum: number, step: number) {
  const stepBase = Number.isFinite(minimum) ? minimum : 0;
  const stepsFromBase = (value - stepBase) / step;
  return Math.abs(stepsFromBase - Math.round(stepsFromBase)) < 1e-9;
}

export default function NumberSpinner({
  'aria-label': ariaLabel,
  className = '',
  clearOnDecrementAtMax = false,
  decrementLabel,
  disabled,
  incrementLabel,
  max,
  min,
  onKeyDown,
  onValueChange,
  reverse = false,
  step = 1,
  value,
  wrapperClassName = '',
  ...inputProps
}: Props) {
  const minimum = min === undefined ? Number.NEGATIVE_INFINITY : Number(min);
  const maximum = max === undefined ? Number.POSITIVE_INFINITY : Number(max);
  const stepSize = Number(step) || 1;

  const changeValue = (direction: 'increment' | 'decrement') => {
    if (disabled) return;
    const currentValue = value === '' ? null : Number(value);

    if (clearOnDecrementAtMax && direction === 'decrement'
      && currentValue !== null && currentValue >= maximum) {
      onValueChange('');
      return;
    }

    if (currentValue === null || !Number.isFinite(currentValue)) {
      if (reverse && direction === 'decrement') return;
      const initialValue = reverse && Number.isFinite(maximum)
        ? maximum
        : Number.isFinite(minimum) ? minimum : 0;
      onValueChange(formatValue(initialValue, stepSize));
      return;
    }

    const directionMultiplier = direction === 'increment' ? 1 : -1;
    const nextValue = currentValue + directionMultiplier * (reverse ? -1 : 1) * stepSize;
    const boundedValue = Math.min(maximum, Math.max(minimum, nextValue));
    onValueChange(formatValue(boundedValue, stepSize));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    changeValue(event.key === 'ArrowUp' ? 'increment' : 'decrement');
  };

  const handleValueChange = (nextValue: string) => {
    if (nextValue === '') {
      onValueChange('');
      return;
    }
    const numericValue = Number(nextValue);
    if (!Number.isFinite(numericValue)
      || numericValue < minimum
      || numericValue > maximum
      || !matchesStep(numericValue, minimum, stepSize)) return;
    onValueChange(nextValue);
  };

  return (
    <div className={`relative ${wrapperClassName}`}>
      <input
        {...inputProps}
        aria-label={ariaLabel}
        className={`${className} pr-10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
        disabled={disabled}
        max={max}
        min={min}
        onChange={(event) => handleValueChange(event.target.value)}
        onKeyDown={handleKeyDown}
        step={step}
        type="number"
        value={value}
      />
      <div className="absolute bottom-px right-px top-px flex w-8 flex-col overflow-hidden rounded-r-lg border-l border-gray-300 dark:border-gray-700">
        <button
          aria-label={incrementLabel || 'Increase value'}
          className={spinnerButtonClasses}
          disabled={disabled}
          onClick={() => changeValue('increment')}
          type="button"
        >▲</button>
        <button
          aria-label={decrementLabel || 'Decrease value'}
          className={`${spinnerButtonClasses} border-t border-gray-300 dark:border-gray-700`}
          disabled={disabled}
          onClick={() => changeValue('decrement')}
          type="button"
        >▼</button>
      </div>
    </div>
  );
}
