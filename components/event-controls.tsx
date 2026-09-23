"use client";
import { useId, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { ru } from "react-day-picker/locale";
import * as Slider from "@radix-ui/react-slider";
import "react-day-picker/style.css";
import { Icon } from "./ui-icon";

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
  );
  return date.getFullYear() === Number(match[1]) &&
    date.getMonth() === Number(match[2]) - 1 &&
    date.getDate() === Number(match[3])
    ? date
    : undefined;
}
function dateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function EventDatePicker({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = parseDate(value);
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div className="event-date-control">
      <label htmlFor={id}>{label}</label>
      <div className="date-input-row">
        <input
          id={id}
          name={name}
          type="date"
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={`${id}-hint`}
        />
        <button
          type="button"
          ref={trigger}
          className="calendar-trigger"
          aria-label={`Календарь: ${label}`}
          aria-expanded={open}
          aria-controls={open ? `${id}-calendar` : undefined}
          onClick={() => setOpen(!open)}
        >
          <Icon name="calendar" />
        </button>
      </div>
      {open && (
        <div
          id={`${id}-calendar`}
          className="event-calendar"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              close();
            }
          }}
        >
          <DayPicker
            mode="single"
            required
            locale={ru}
            selected={selected}
            defaultMonth={selected || new Date(2026, 9, 1)}
            autoFocus
            startMonth={new Date(2026, 8, 1)}
            endMonth={new Date(2026, 11, 1)}
            disabled={{
              before: new Date(2026, 8, 23),
              after: new Date(2026, 11, 31),
            }}
            onSelect={(date) => {
              if (date) {
                onChange(dateValue(date));
                close();
              }
            }}
          />
        </div>
      )}
      <small id={`${id}-hint`}>Календарь каталога: 23.09–31.12.2026</small>
    </div>
  );
}

export function BudgetPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const amount = Number(value);
  const [ceiling, setCeiling] = useState(
    Math.max(5000000, Number.isFinite(amount) ? amount : 0),
  );
  const max = Math.max(ceiling, Number.isFinite(amount) ? amount : 0);
  const formatted = (number: number) => `${number.toLocaleString("ru-RU")} ₸`;
  return (
    <div className="budget-control">
      <label htmlFor={id}>Бюджет на подрядчика, ₸</label>
      <input
        id={id}
        name="budget"
        type="number"
        inputMode="numeric"
        min="0"
        max="1000000000"
        step="1"
        required
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          if (Number(next) > ceiling)
            setCeiling(
              Math.min(1000000000, Math.ceil(Number(next) / 1000000) * 1000000),
            );
          onChange(next);
        }}
      />
      <Slider.Root
        className="budget-slider"
        min={0}
        max={max}
        step={10000}
        value={[Math.max(0, Number.isFinite(amount) ? amount : 0)]}
        onValueChange={(values) => onChange(String(values[0]))}
      >
        <Slider.Track className="budget-track">
          <Slider.Range className="budget-range" />
        </Slider.Track>
        <Slider.Thumb
          className="budget-thumb"
          aria-label="Бюджет — ползунок"
          aria-valuetext={formatted(amount || 0)}
        />
      </Slider.Root>
      <div className="budget-scale">
        <span>0 ₸</span>
        <span>{formatted(max)}</span>
      </div>
      <small>Шаг ползунка — 10 000 ₸. Точную сумму можно ввести выше.</small>
    </div>
  );
}
