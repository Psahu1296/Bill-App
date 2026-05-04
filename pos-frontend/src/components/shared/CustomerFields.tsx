import React, { useEffect, useRef, useState } from "react";
import { Command } from "cmdk";
import { searchCustomerProfiles } from "../../https";
import type { CustomerProfile } from "../../types";
import { FaUser, FaPhone, FaExclamationTriangle } from "react-icons/fa";
import { MdAccountBalanceWallet } from "react-icons/md";

export interface CustomerValue {
  name: string;
  phone: string;
}

interface Props {
  value: CustomerValue;
  onChange: (val: CustomerValue) => void;
  disabled?: boolean;
  /** className applied to each field's <input> */
  inputClassName?: string;
}

const CustomerFields: React.FC<Props> = ({ value, onChange, disabled = false, inputClassName }) => {
  const [open, setOpen]           = useState(false);
  const [results, setResults]     = useState<CustomerProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [phoneWarning, setPhoneWarning] = useState<string | null>(null);

  const containerRef     = useRef<HTMLDivElement>(null);
  const nameDebounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phoneDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Phone that was autofilled from a dropdown selection — mismatch check skips this
  const autofillPhoneRef = useRef<string>("");
  const justSelectedRef  = useRef(false);

  const inputCls = inputClassName ??
    "w-full bg-dhaba-surface border border-dhaba-border/20 rounded-xl px-4 py-2.5 text-sm text-dhaba-text placeholder:text-dhaba-muted/50 focus:outline-none focus:border-dhaba-accent/40 transition-colors";

  // ── Name search (debounced) ───────────────────────────────────────────────
  useEffect(() => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);

    const q = value.name.trim();
    if (q.length < 2) { setResults([]); setOpen(false); return; }

    nameDebounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchCustomerProfiles({ name: q });
        const data: CustomerProfile[] = res.data?.data ?? [];
        setResults(data);
        setOpen(data.length > 0);
      } catch {
        setResults([]);
        setOpen(false);
      } finally {
        setSearching(false);
      }
    }, 280);

    return () => { if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current); };
  }, [value.name]);

  // ── Phone mismatch check (debounced, 10 digits only) ─────────────────────
  useEffect(() => {
    if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);
    const p = value.phone.trim();

    // Only check complete phone numbers that weren't autofilled from a selection
    if (p.length !== 10 || p === autofillPhoneRef.current) {
      setPhoneWarning(null);
      return;
    }

    phoneDebounceRef.current = setTimeout(async () => {
      try {
        const res = await searchCustomerProfiles({ phone: p });
        const found: CustomerProfile | undefined = res.data?.data?.[0];
        if (found && found.name.toLowerCase() !== value.name.trim().toLowerCase()) {
          setPhoneWarning(`This number is already linked to ${found.name}`);
        } else {
          setPhoneWarning(null);
        }
      } catch {
        setPhoneWarning(null);
      }
    }, 500);

    return () => { if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current); };
  }, [value.phone, value.name]);

  // ── Click outside to close dropdown ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (c: CustomerProfile) => {
    justSelectedRef.current = true;
    autofillPhoneRef.current = c.phone;
    setPhoneWarning(null);
    onChange({ name: c.name, phone: c.phone });
    setOpen(false);
    setResults([]);
  };

  const handleNameChange = (name: string) => {
    // Typing in name after a selection → clear autofill ref so phone re-validates
    if (name !== value.name) autofillPhoneRef.current = "";
    onChange({ ...value, name });
  };

  const handlePhoneChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 10);
    // Manual phone edit → clear autofill ref
    if (digits !== autofillPhoneRef.current) autofillPhoneRef.current = "";
    onChange({ ...value, phone: digits });
  };

  return (
    <div ref={containerRef} className="space-y-4">
      {/* ── Name field ── */}
      <div>
        <label className="block text-xs font-bold text-dhaba-muted uppercase tracking-wider mb-1.5">
          Customer Name
        </label>
        <Command shouldFilter={false} className="relative">
          <div className="relative flex items-center">
            <FaUser className="absolute left-3 text-dhaba-muted text-xs pointer-events-none" />
            <input
              value={value.name}
              onChange={(e) => handleNameChange(e.target.value)}
              onFocus={() => { if (results.length > 0) setOpen(true); }}
              disabled={disabled}
              placeholder="Customer name"
              className={`pl-8 pr-8 ${disabled ? "opacity-60 cursor-not-allowed" : ""} ${inputCls}`}
            />
            {searching && (
              <span className="absolute right-3 h-3 w-3 border-2 border-dhaba-accent border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {open && !disabled && (
            <div className="absolute top-full left-0 right-0 mt-1.5 z-50 glass-card rounded-2xl overflow-hidden shadow-glow border border-dhaba-border/20">
              <Command.List className="max-h-52 overflow-y-auto py-1">
                <Command.Empty className="px-4 py-3 text-xs text-dhaba-muted text-center">
                  No customers found
                </Command.Empty>
                {results.map((c) => (
                  <Command.Item
                    key={c.phone}
                    value={c.name}
                    onSelect={() => handleSelect(c)}
                    className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-dhaba-surface-hover transition-colors data-[selected=true]:bg-dhaba-accent/10 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-lg bg-dhaba-accent/15 text-dhaba-accent flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-dhaba-text leading-tight">{c.name}</p>
                        <p className="text-[10px] text-dhaba-muted flex items-center gap-1 mt-0.5">
                          <FaPhone className="text-[8px]" /> {c.phone}
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

      {/* ── Phone field ── */}
      <div>
        <label className="block text-xs font-bold text-dhaba-muted uppercase tracking-wider mb-1.5">
          Phone Number
        </label>
        <div className="relative flex items-center">
          <FaPhone className="absolute left-3 text-dhaba-muted text-xs pointer-events-none" />
          <input
            type="tel"
            value={value.phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            disabled={disabled}
            maxLength={10}
            placeholder="10-digit number"
            className={`pl-8 ${disabled ? "opacity-60 cursor-not-allowed" : ""} ${inputCls}`}
          />
        </div>
        {phoneWarning && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-dhaba-warning">
            <FaExclamationTriangle className="text-[10px] flex-shrink-0" />
            {phoneWarning}
          </p>
        )}
      </div>
    </div>
  );
};

export default CustomerFields;
