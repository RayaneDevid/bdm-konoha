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
      className="bg-[#FAF3E3] border-2 border-[#5D4037] rounded-md shadow-xl overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#E8D5B7]">
        <Search size={14} className="text-[#5D4037] shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher..."
          className="w-full bg-transparent text-sm text-[#3E2723] placeholder:text-[#5D4037]/50 outline-none"
        />
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs text-[#5D4037]">Aucun résultat</p>
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
                  ? 'bg-[#8B0000] text-[#FAF3E3]'
                  : 'text-[#3E2723] hover:bg-[#E8D5B7]'
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
        className="w-full bg-[#FAF3E3] border border-[#5D4037] rounded px-3 py-2 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[#8B0000] cursor-pointer"
      >
        <span className={selectedLabel ? 'text-[#3E2723]' : 'text-[#5D4037]'}>
          {selectedLabel ?? placeholder}
        </span>
        <ChevronDown size={16} className="text-[#5D4037] shrink-0" />
      </button>

      {createPortal(dropdown, document.body)}
    </div>
  );
}
