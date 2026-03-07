import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface SearchableMultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  chipColor?: { bg: string; text: string };
}

export default function SearchableMultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Ajouter...',
  chipColor = { bg: '#5D4037', text: '#FAF3E3' },
}: SearchableMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const available = options.filter((o) => !selected.includes(o.value));
  const filtered = available.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
    setSearch('');
  }

  function remove(value: string) {
    onChange(selected.filter((v) => v !== value));
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full bg-[#FAF3E3] border border-[#5D4037] rounded px-3 py-2 text-sm text-left text-[#5D4037] focus:outline-none focus:ring-2 focus:ring-[#8B0000] cursor-pointer"
      >
        {placeholder}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-[#FAF3E3] border-2 border-[#5D4037] rounded-md shadow-xl overflow-hidden">
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
                  onClick={() => toggle(o.value)}
                  className="w-full text-left px-3 py-2 text-sm text-[#3E2723] hover:bg-[#E8D5B7] cursor-pointer transition-colors"
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {selected.map((val) => {
            const opt = options.find((o) => o.value === val);
            return (
              <span
                key={val}
                className="text-xs font-medium px-2 py-0.5 rounded flex items-center gap-1"
                style={{ backgroundColor: chipColor.bg, color: chipColor.text }}
              >
                {opt?.label ?? val}
                <button
                  type="button"
                  onClick={() => remove(val)}
                  className="hover:opacity-70 cursor-pointer"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
