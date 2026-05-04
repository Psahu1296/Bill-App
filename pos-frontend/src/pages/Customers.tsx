import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { searchCustomerProfiles } from "../https";
import type { CustomerProfile } from "../types";
import BottomNav from "../components/shared/BottomNav";
import Skeleton from "../components/shared/Skeleton";
import UserAvatar from "../components/shared/UserAvatar";
import LedgerBadge from "../components/shared/LedgerBadge";
import { FaUsers, FaSearch, FaPhone, FaWallet, FaFilter } from "react-icons/fa";
import { MdAccountBalanceWallet, MdArrowForwardIos } from "react-icons/md";

const Customers: React.FC = () => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "dues" | "ledger">("all");
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["customerProfiles", search],
    queryFn: () => searchCustomerProfiles({ name: search }),
    placeholderData: (prev) => prev,
  });

  const customers: CustomerProfile[] = data?.data?.data ?? [];

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      if (filter === "dues" && (c.balanceDue ?? 0) <= 0) return false;
      if (filter === "ledger" && !c.isLedgerOnly) return false;
      return true;
    });
  }, [customers, filter]);

  const totalOutstanding = customers.reduce((s, c) => s + (c.balanceDue ?? 0), 0);
  const totalWithDues = customers.filter(c => (c.balanceDue ?? 0) > 0).length;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-dhaba-bg relative overflow-y-auto">
      {/* Ambient Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px] z-0 pointer-events-none" />
      <div className="fixed top-[20%] right-[-10%] w-[30%] h-[30%] bg-purple-500/10 rounded-full blur-[100px] z-0 pointer-events-none" />

      <div className="relative z-10 flex-1 flex flex-col pb-24 px-4 sm:px-6 md:px-8 max-w-6xl mx-auto w-full pt-8 space-y-8">

        {/* Header */}
        <div>
          <h1 className="font-display text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 tracking-wide">Customers Directory</h1>
          <p className="text-sm text-white/50 mt-1 font-medium tracking-wide">Manage past orders and ledger balances</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="glass-card rounded-[1.25rem] p-5 flex flex-col gap-3 border border-dhaba-border/20 shadow-sm relative overflow-hidden group hover:border-blue-500/30 transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
              <FaUsers className="text-blue-400 text-lg" />
            </div>
            <div>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Total Customers</p>
              <p className="font-display text-2xl font-black text-white/90 mt-0.5 tracking-tight">{customers.length}</p>
            </div>
          </div>
          <div className="glass-card rounded-[1.25rem] p-5 flex flex-col gap-3 border border-dhaba-border/20 shadow-sm relative overflow-hidden group hover:border-red-500/30 transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20">
              <MdAccountBalanceWallet className="text-red-400 text-lg" />
            </div>
            <div>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Outstanding Due</p>
              <p className="font-display text-2xl font-black text-red-400 mt-0.5 tracking-tight drop-shadow-[0_0_10px_rgba(248,113,113,0.3)]">₹{totalOutstanding.toFixed(0)}</p>
            </div>
          </div>
          <div className="glass-card rounded-[1.25rem] p-5 flex flex-col gap-3 border border-dhaba-border/20 shadow-sm relative overflow-hidden group hover:border-orange-500/30 transition-all hidden md:flex">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0 border border-orange-500/20">
              <FaWallet className="text-orange-400 text-lg" />
            </div>
            <div>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">With Dues</p>
              <p className="font-display text-2xl font-black text-orange-400 mt-0.5 tracking-tight">{totalWithDues}</p>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl border border-white/10 shrink-0">
              <FaFilter className="text-white/40 text-xs" />
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Filter</span>
            </div>
            {(["all", "dues", "ledger"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider shrink-0 transition-all border ${filter === f
                    ? "bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                    : "bg-[#1e293b] text-white/50 border-white/5 hover:bg-white/10 hover:text-white/80"
                  }`}
              >
                {f === "all" ? "All Customers" : f === "dues" ? "With Dues" : "Ledger Only"}
              </button>
            ))}
          </div>

          <div className="relative group">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-sm pointer-events-none group-focus-within:text-blue-400 transition-colors" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone..."
              className="w-full bg-[#1e293b] rounded-2xl pl-11 pr-4 py-3.5 text-white font-black text-sm focus:outline-none focus:ring-2 ring-blue-500/50 border border-white/5 placeholder:text-white/20 transition-all shadow-inner"
            />
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <Skeleton className="h-[76px] rounded-[1.25rem]" count={6} gap="gap-3" />
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10 shadow-inner">
              <FaUsers className="text-3xl text-white/20" />
            </div>
            <p className="text-white/80 font-black tracking-wide">No customers found</p>
            <p className="text-xs text-white/40 mt-1 max-w-[250px]">
              {search || filter !== "all" ? "Try clearing your filters or search query." : "Customers appear here after their first order."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCustomers.map((c) => (
              <button
                key={c.phone}
                onClick={() => navigate(`/customers/${c.phone}`)}
                className="w-full glass-card rounded-[1.25rem] px-5 py-4 flex items-center gap-4 hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)] transition-all duration-300 text-left border border-dhaba-border/20 group"
              >
                <UserAvatar name={c.name} className="h-12 w-12 text-lg group-hover:scale-105 transition-transform" />

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <p className="font-black text-white/90 text-[15px] leading-tight truncate tracking-wide">{c.name}</p>
                    {c.isLedgerOnly && <LedgerBadge />}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[11px] text-white/40 font-bold flex items-center gap-1 uppercase tracking-wider">
                      <FaPhone className="text-[9px]" /> {c.phone}
                    </span>
                    {!c.isLedgerOnly && c.totalOrders > 0 && (
                      <>
                        <span className="text-white/20 text-[10px]">•</span>
                        <span className="text-[9px] font-black uppercase tracking-wider text-blue-400 px-1.5 py-0.5 bg-blue-500/10 rounded border border-blue-500/20">
                          {c.totalOrders} orders
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  {c.balanceDue > 0 ? (
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-black text-red-400/70 uppercase tracking-[0.15em]">Due</span>
                      <span className="text-sm font-black text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.3)] tracking-tight">
                        ₹{c.balanceDue.toFixed(0)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[9px] font-black text-emerald-400/50 uppercase tracking-[0.15em]">Settled</span>
                  )}
                  <MdArrowForwardIos className="text-white/20 text-xs group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative z-20">
        <BottomNav />
      </div>
    </div>
  );
};

export default Customers;
