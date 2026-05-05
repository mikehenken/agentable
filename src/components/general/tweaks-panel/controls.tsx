import * as React from "react";

export type RadioOption<T extends string> = T | { value: T; label: string };
export type SelectOption<T extends string> = T | { value: T; label: string };

interface TweakRowProps {
  label: string;
  value?: React.ReactNode;
  inline?: boolean;
  children: React.ReactNode;
}

export const TweakSection: React.FC<{ label: string; children?: React.ReactNode }> = ({ label, children }) => (
  <>
    <div className="twk-sect">{label}</div>
    {children}
  </>
);

export const TweakRow: React.FC<TweakRowProps> = ({ label, value, inline = false, children }) => (
  <div className={inline ? "twk-row twk-row-h" : "twk-row"}>
    <div className="twk-lbl">
      <span>{label}</span>
      {value != null && <span className="twk-val">{value}</span>}
    </div>
    {children}
  </div>
);

export const TweakSlider: React.FC<{
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}> = ({ label, value, min = 0, max = 100, step = 1, unit = "", onChange }) => (
  <TweakRow label={label} value={`${value}${unit}`}>
    <input
      type="range"
      className="twk-slider"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  </TweakRow>
);

export const TweakToggle: React.FC<{
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, value, onChange }) => (
  <div className="twk-row twk-row-h">
    <div className="twk-lbl">
      <span>{label}</span>
    </div>
    <button
      type="button"
      className="twk-toggle"
      data-on={value ? "1" : "0"}
      role="switch"
      aria-checked={!!value}
      onClick={() => onChange(!value)}
    >
      <i />
    </button>
  </div>
);

export function TweakRadio<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: RadioOption<T>[];
  onChange: (v: T) => void;
}) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const opts = options.map((o) =>
    typeof o === "object" ? o : ({ value: o, label: o } as { value: T; label: string }),
  );
  const idx = Math.max(
    0,
    opts.findIndex((o) => o.value === value),
  );
  const n = opts.length;

  const valueRef = React.useRef(value);
  valueRef.current = value;

  const segAt = (clientX: number): T => {
    const r = trackRef.current!.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor(((clientX - r.left - 2) / inner) * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = (ev: PointerEvent) => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <TweakRow label={label}>
      <div
        ref={trackRef}
        role="radiogroup"
        onPointerDown={onPointerDown}
        className={dragging ? "twk-seg dragging" : "twk-seg"}
      >
        <div
          className="twk-seg-thumb"
          style={{
            left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
            width: `calc((100% - 4px) / ${n})`,
          }}
        />
        {opts.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
          >
            {o.label}
          </button>
        ))}
      </div>
    </TweakRow>
  );
}

export function TweakSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (v: T) => void;
}) {
  return (
    <TweakRow label={label}>
      <select className="twk-field" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => {
          const v = typeof o === "object" ? o.value : o;
          const l = typeof o === "object" ? o.label : o;
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </select>
    </TweakRow>
  );
}

export const TweakText: React.FC<{
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}> = ({ label, value, placeholder, onChange }) => (
  <TweakRow label={label}>
    <input
      className="twk-field"
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  </TweakRow>
);

export const TweakNumber: React.FC<{
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step = 1, unit = "", onChange }) => {
  const clamp = (n: number) => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({ x: 0, val: 0 });
  const onScrubStart: React.PointerEventHandler<HTMLSpanElement> = (e) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, val: value };
    const decimals = (String(step).split(".")[1] || "").length;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <div className="twk-num">
      <span className="twk-num-lbl" onPointerDown={onScrubStart}>
        {label}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
      />
      {unit && <span className="twk-num-unit">{unit}</span>}
    </div>
  );
};

export const TweakColor: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => (
  <div className="twk-row twk-row-h">
    <div className="twk-lbl">
      <span>{label}</span>
    </div>
    <input
      type="color"
      className="twk-swatch"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

export const TweakButton: React.FC<{
  label: string;
  onClick: () => void;
  secondary?: boolean;
}> = ({ label, onClick, secondary = false }) => (
  <button
    type="button"
    className={secondary ? "twk-btn secondary" : "twk-btn"}
    onClick={onClick}
  >
    {label}
  </button>
);
