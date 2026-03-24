import React, { useEffect, useRef, useState } from "react";
import { Command } from "cmdk";
import { getAllCustomerLedgers } from "../../https";
import type { CustomerLedger } from "../../types";
import { FaUser, FaPhone } from "react-icons/fa";
import { MdAccountBalanceWallet } from "react-icons/md";

interface Props {
  value: string;
  onChange: (name: string) => void;
  onSelect: (customer: { customerName: string; customerPhone: string }) => void;
  placeholder?: string;
  /** Override the <input> className to match the parent form's style */
  inputClassName?: string;
}

const CustomerAutocomplete: React.FC<Props> = ({
  value,
  onChange,
  onSelect,
  placeholder = "Customer name",
  inputClassName,
}) => {
  const [open, setOpen]             = useState(false);
  const [results, setResults]       = useState<CustomerLedger[]>([]);
  const [loading, setLoading]       = useState(false);
  const containerRef                = useRef<HTMLDivElement>(null);
  const debounceRef                 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justSelectedRef             = useRef(false);

  // ── Debounced search ──────────────────────────────────────────────────────
  useEffect(() => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = value.trim();
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await getAllCustomerLedgers({ name: q });
        const data: CustomerLedger[] = res.data?.data ?? [];
        setResults(data);
        setOpen(data.length > 0);
      } catch {
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  // ── Click outside to close ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (customer: CustomerLedger) => {
    justSelectedRef.current = true;
    onSelect({ customerName: customer.customerName, customerPhone: customer.customerPhone });
    setOpen(false);
    setResults([]);
  };

  return (
    <div ref={containerRef} className="relative">
      <Command shouldFilter={false} className="relative">
        {/* Input */}
        <div className="relative flex items-center">
          <FaUser className="absolute left-3 text-dhaba-muted text-xs pointer-events-none" />
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => { if (results.length > 0) setOpen(true); }}
            placeholder={placeholder}
            className={inputClassName ?? "w-full bg-dhaba-surface border border-dhaba-border/20 rounded-xl pl-8 pr-3 py-2 text-sm text-dhaba-text placeholder:text-dhaba-muted/50 focus:outline-none focus:border-dhaba-accent/40 transition-colors"}
          />
          {loading && (
            <span className="absolute right-3 h-3 w-3 border-2 border-dhaba-accent border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* Dropdown */}
        {open && (
          <div className="absolute top-full left-0 right-0 mt-1.5 z-50 glass-card rounded-2xl overflow-hidden shadow-glow border border-dhaba-border/20">
            <Command.List className="max-h-52 overflow-y-auto py-1">
              <Command.Empty className="px-4 py-3 text-xs text-dhaba-muted text-center">
                No customers found
              </Command.Empty>

              {results.map((c) => (
                <Command.Item
                  key={c._id}
                  value={c.customerName}
                  onSelect={() => handleSelect(c)}
                  className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-dhaba-surface-hover transition-colors data-[selected=true]:bg-dhaba-accent/10 group"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="h-7 w-7 rounded-lg bg-dhaba-accent/15 text-dhaba-accent flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {c.customerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-dhaba-text leading-tight">{c.customerName}</p>
                      <p className="text-[10px] text-dhaba-muted flex items-center gap-1 mt-0.5">
                        <FaPhone className="text-[8px]" /> {c.customerPhone}
                      </p>
                    </div>
                  </div>
                  {c.balanceDue > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-dhaba-danger bg-dhaba-danger/10 px-2 py-0.5 rounded-full flex-shrink-0">
                      <MdAccountBalanceWallet className="text-xs" />
                      ₹{c.balanceDue}
                    </span>
                  )}
                </Command.Item>
              ))}
            </Command.List>
          </div>
        )}
      </Command>
    </div>
  );
};

export default CustomerAutocomplete;
