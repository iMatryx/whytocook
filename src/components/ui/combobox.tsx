"use client";

import { useId, useRef, useState, type KeyboardEvent, type Ref } from "react";
import * as Popover from "@radix-ui/react-popover";

import { cn } from "@/shared/presentation/cn";

import { filterOptions, nextEnabledIndex, type ComboboxOption } from "./combobox-model";
import { Icon } from "./icon";
import { Input } from "./input";

export type ComboboxProps = {
  label: string;
  options: readonly ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
  name?: string;
  placeholder?: string;
  emptyMessage?: string;
  loading?: boolean;
  disabled?: boolean;
  required?: boolean;
  hint?: string;
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
  queryValue?: string;
  onQueryChange?: (query: string) => void;
  filterMode?: "local" | "remote";
};

export function Combobox({
  label,
  options,
  value,
  onValueChange,
  id,
  name,
  placeholder = "Caută o opțiune…",
  emptyMessage = "Nu am găsit opțiuni. Încearcă alt termen.",
  loading = false,
  disabled = false,
  required = false,
  hint,
  error,
  inputRef,
  queryValue,
  onQueryChange,
  filterMode = "local",
}: ComboboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-options`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const anchorRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const filtered = filterMode === "remote" ? options : filterOptions(options, query ?? "");
  const expanded = open && !disabled;
  const activeOption = filtered[active];

  function close() {
    setOpen(false);
    setQuery(null);
    setActive(-1);
  }

  function select(option: ComboboxOption) {
    if (option.disabled || loading) return;
    onValueChange(option.value);
    close();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape" && expanded) {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      close();
    } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !loading) {
      event.preventDefault();
      setOpen(true);
      const index = nextEnabledIndex(filtered, active, event.key === "ArrowDown" ? 1 : -1);
      setActive(index);
    } else if (event.key === "Enter" && expanded) {
      event.preventDefault();
      if (activeOption) select(activeOption);
    }
  }

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-medium">
        {label}
        {required && <span className="sr-only"> obligatoriu</span>}
      </label>
      <Popover.Root open={expanded} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <Popover.Anchor asChild>
          <div ref={anchorRef} className="relative">
            <Icon
              name="search"
              className="pointer-events-none absolute top-3 left-3 text-muted-foreground"
            />
            <Input
              ref={inputRef}
              id={inputId}
              role="combobox"
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={expanded}
              aria-controls={expanded ? listId : undefined}
              aria-activedescendant={
                expanded && activeOption && !loading ? `${listId}-${active}` : undefined
              }
              aria-describedby={
                [hint && `${inputId}-hint`, error && `${inputId}-error`]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              aria-invalid={Boolean(error)}
              aria-busy={loading}
              required={required}
              disabled={disabled}
              placeholder={placeholder}
              value={queryValue ?? query ?? selected?.label ?? ""}
              className="pr-10 pl-10"
              onFocus={() => setOpen(true)}
              onClick={() => setOpen(true)}
              onBlur={close}
              onChange={(event) => {
                setQuery(event.target.value);
                onQueryChange?.(event.target.value);
                setActive(-1);
                setOpen(true);
              }}
              onKeyDown={handleKeyDown}
            />
            <Icon
              name="chevron"
              className="pointer-events-none absolute top-3 right-3 text-muted-foreground"
            />
          </div>
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            role="presentation"
            align="start"
            sideOffset={6}
            className="z-[60] w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popper-anchor-width)] rounded-xl border border-border bg-card p-1.5 text-card-foreground shadow-lg outline-none"
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onInteractOutside={(event) => {
              if (event.target instanceof Node && anchorRef.current?.contains(event.target))
                event.preventDefault();
            }}
          >
            <div id={listId} role="listbox" aria-label={label} className="max-h-64 overflow-y-auto">
              {!loading &&
                filtered.map((option, index) => (
                  <button
                    key={option.value}
                    ref={(node) => {
                      if (node && index === active) node.scrollIntoView({ block: "nearest" });
                    }}
                    id={`${listId}-${index}`}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={option.value === value}
                    disabled={option.disabled}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50",
                      active === index && "bg-accent text-accent-foreground",
                    )}
                    onPointerDown={(event) => event.preventDefault()}
                    onPointerMove={() => {
                      if (!option.disabled) setActive(index);
                    }}
                    onClick={() => select(option)}
                  >
                    {option.label}
                    {option.value === value && <Icon name="check" className="size-4" />}
                  </button>
                ))}
            </div>
            {(loading || !filtered.length) && (
              <p role="status" className="px-3 py-4 text-sm text-muted-foreground">
                {loading ? "Se încarcă opțiunile…" : emptyMessage}
              </p>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {name && <input type="hidden" name={name} value={value} disabled={disabled} />}
      {hint && (
        <p id={`${inputId}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-sm text-danger-foreground">
          {error}
        </p>
      )}
    </div>
  );
}
