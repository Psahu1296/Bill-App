import React, { useState } from "react";
import { FaHome } from "react-icons/fa";
import { MdOutlineReorder, MdTableBar } from "react-icons/md";
import { BiNotepad, BiSolidDish } from "react-icons/bi";
import { useNavigate, useLocation } from "react-router-dom";
import Modal from "./Modal";
import { setCustomer } from "../../redux/slices/customerSlice";
import { useAppDispatch } from "../../redux/hooks";
import CustomerAutocomplete from "../menu/CustomerAutocomplete";

const navItems = [
  { path: "/", icon: FaHome, label: "Home" },
  { path: "/orders", icon: MdOutlineReorder, label: "Orders" },
  { path: "/tables", icon: MdTableBar, label: "Tables" },
  { path: "/ledger", icon: BiNotepad, label: "Ledger" },
];

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDriver, setIsDriver] = useState(false);
  const [guestCount, setGuestCount] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const increment = () => { if (guestCount < 6) setGuestCount((p) => p + 1); };
  const decrement = () => { if (guestCount > 0) setGuestCount((p) => p - 1); };
  const isActive = (path: string) => location.pathname === path;

  const handleCreateOrder = () => {
    dispatch(setCustomer({ name, phone, guests: guestCount }));
    navigate("/tables");
  };

  const onSpecialCheck = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = e.target;
    setIsDriver(checked);
    if (checked) { setName("Driver"); setPhone("214214214"); setGuestCount(1); }
    else { setName(""); setPhone(""); setGuestCount(0); }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      {/* Gradient fade above nav */}
      <div className="h-6 bg-gradient-to-t from-dhaba-bg to-transparent pointer-events-none" />

      <div className="glass border-t border-dhaba-border/30 px-4 py-2 flex justify-around items-center">
        {navItems.map(({ path, icon: Icon, label }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-semibold text-sm transition-all duration-300 ${
              isActive(path)
                ? "bg-dhaba-accent/15 text-dhaba-accent shadow-glow"
                : "text-dhaba-muted hover:text-dhaba-text hover:bg-dhaba-surface-hover"
            }`}
          >
            <Icon size={18} />
            <span className={isActive(path) ? "" : "hidden lg:inline"}>{label}</span>
          </button>
        ))}

        {/* Floating action button */}
        <button
          disabled={isActive("/tables") || isActive("/menu")}
          onClick={() => setIsModalOpen(true)}
          className="absolute -top-5 btn-accent rounded-2xl p-4 shadow-glow-lg disabled:opacity-40 disabled:shadow-none"
        >
          <BiSolidDish size={28} />
        </button>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Order">
        <div className="space-y-4">
          <div>
            <label className="block text-dhaba-muted mb-2 text-xs font-bold tracking-wider uppercase">
              Customer Name
            </label>
            <CustomerAutocomplete
              value={name}
              onChange={setName}
              onSelect={({ customerName, customerPhone }) => {
                setName(customerName);
                setPhone(customerPhone);
              }}
              placeholder="Enter customer name"
              inputClassName="glass-input rounded-xl px-4 py-3 w-full text-dhaba-text text-sm focus:outline-none placeholder:text-dhaba-muted/50"
            />
          </div>

          <div>
            <label className="block text-dhaba-muted mb-2 text-xs font-bold tracking-wider uppercase">
              Phone Number
            </label>
            <div className="glass-input rounded-xl px-4 py-3">
              <input
                value={phone}
                maxLength={10}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  if (val.length <= 10) setPhone(val);
                }}
                type="tel"
                placeholder="9876543210"
                className="bg-transparent flex-1 w-full text-dhaba-text text-sm focus:outline-none placeholder:text-dhaba-muted/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-dhaba-muted mb-2 text-xs font-bold tracking-wider uppercase">
              Guests
            </label>
            <div className="glass-input rounded-xl flex items-center justify-between px-4 py-3">
              <button onClick={decrement} className="text-dhaba-accent text-xl font-bold w-8 h-8 rounded-lg hover:bg-dhaba-accent/10 transition-colors">−</button>
              <span className="text-dhaba-text font-bold">{guestCount} <span className="text-dhaba-muted font-normal text-sm">Person</span></span>
              <button onClick={increment} className="text-dhaba-accent text-xl font-bold w-8 h-8 rounded-lg hover:bg-dhaba-accent/10 transition-colors">+</button>
            </div>
          </div>

          <div className="flex items-center gap-3 py-2">
            <input
              type="checkbox"
              id="isFrequent"
              checked={isDriver}
              onChange={onSpecialCheck}
              className="h-4 w-4 rounded border-dhaba-border accent-dhaba-accent"
            />
            <label htmlFor="isFrequent" className="text-sm text-dhaba-text font-medium">
              🚛 Is Truck Driver
            </label>
          </div>

          <button onClick={handleCreateOrder} className="w-full btn-accent rounded-xl py-3 text-base mt-2">
            Create Order
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default BottomNav;
