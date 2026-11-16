import type { Option } from "../options";

interface Props<T extends string | number> {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function ChipGroup<T extends string | number>({ label, options, value, onChange }: Props<T>) {
  return (
    <fieldset className="chips">
      <legend>{label}</legend>
      <div className="chips__row">
        {options.map((o) => (
          <button
            key={String(o.value) || o.label}
            type="button"
            className="chip"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
