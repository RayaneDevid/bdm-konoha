import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Sélectionner...',
  required,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ferme si clic en dehors
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Focus l'input quand le dropdown s'ouvre
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  // Calcule la position du dropdown en suivant le trigger
  useEffect(() => {
    if (!open || !triggerRef.current) return;

    function updatePosition() {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open]);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedLabel = options.find((o) => o.value === value)?.label;

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="bg-[var(--v-off-white)] border-2 border-[var(--v-medium)] rounded-md shadow-xl overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--v-light-beige)]">
        <Search size={14} className="text-[var(--v-medium)] shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher..."
          className="w-full bg-transparent text-sm text-[var(--v-dark)] placeholder:text-[var(--v-medium)]/50 outline-none"
        />
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs text-[var(--v-medium)]">Aucun résultat</p>
        ) : (
          filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // empêche le blur avant le click
                onChange(o.value);
                setOpen(false);
                setSearch('');
              }}
              className={`w-full text-left px-3 py-2 text-sm cursor-pointer transition-colors ${
                o.value === value
                  ? 'bg-[var(--v-primary)] text-[var(--v-off-white)]'
                  : 'text-[var(--v-dark)] hover:bg-[var(--v-light-beige)]'
              }`}
            >
              {o.label}
            </button>
          ))
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="relative">
      {required && (
        <input
          tabIndex={-1}
          value={value}
          onChange={() => {}}
          required
          className="absolute inset-0 opacity-0 pointer-events-none"
        />
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full bg-[var(--v-off-white)] border border-[var(--v-medium)] rounded px-3 py-2 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[var(--v-primary)] cursor-pointer"
      >
        <span className={selectedLabel ? 'text-[var(--v-dark)]' : 'text-[var(--v-medium)]'}>
          {selectedLabel ?? placeholder}
        </span>
        <ChevronDown size={16} className="text-[var(--v-medium)] shrink-0" />
      </button>

      {createPortal(dropdown, document.body)}
    </div>
  );
}
