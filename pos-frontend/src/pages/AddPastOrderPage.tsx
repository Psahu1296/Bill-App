import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  FaClipboardList, FaPlus, FaMinus, FaShoppingBag, FaArrowLeft,
} from "react-icons/fa";
import { MdTableRestaurant } from "react-icons/md";
import { PiTruckTrailerLight } from "react-icons/pi";

import { getTables, addOrder } from "../https";
import CustomerFields from "../components/shared/CustomerFields";
import { getTodayISO } from "../utils";
import type { Table, Dish, DishVariant, OrderStatus, PaymentMethod } from "../types";
import { type LocalCartItem } from "../components/orders/PastOrderItemBuilder";
import PastOrderSummary from "../components/orders/PastOrderSummary";
import MenuContainer from "../components/menu/MenuContainer";
import LocalCartDisplay from "../components/orders/LocalCartDisplay";

const AddPastOrderPage: React.FC = () => {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => { document.title = "Dhaba POS | Add Past Order"; }, []);

  // ── Customer state ────────────────────────────────────────────
  const [customerName, setCustomerName]   = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [guests, setGuests]               = useState(1);
  const [tableId, setTableId]             = useState("");
  const [orderType, setOrderType]         = useState<"dine-in" | "takeaway" | "delivery">("takeaway");
  const [isDriver, setIsDriver]           = useState(false);
  const [orderDate, setOrderDate]         = useState(getTodayISO);

  // ── Bill state ────────────────────────────────────────────────
  const [discount, setDiscount]           = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [orderStatus, setOrderStatus]     = useState<OrderStatus>("Completed");
  const [amountPaid, setAmountPaid]       = useState(0);
  const [amountPaidTouched, setAmountPaidTouched] = useState(false);

  // ── Cart state ────────────────────────────────────────────────
  const [cartItems, setCartItems] = useState<LocalCartItem[]>([]);

  // ── Tables ────────────────────────────────────────────────────
  const { data: tablesRes, isLoading: tablesLoading } = useQuery({
    queryKey: ["tables"],
    queryFn: getTables,
    staleTime: 60_000,
  });
  const allTables: Table[]      = tablesRes?.data?.data ?? [];
  const virtualTable: Table | undefined = allTables.find((t) => t.isVirtual);

  // ── Derived bill values ───────────────────────────────────────
  const subtotal          = cartItems.reduce((s, i) => s + i.price, 0);
  const finalTotal        = Math.max(0, subtotal - discount);
  const displayAmountPaid = amountPaidTouched ? amountPaid : finalTotal;

  // ── Cart handlers ─────────────────────────────────────────────
  const handleAddToCart = useCallback((dish: Dish, variant: DishVariant, qty: number) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.id === dish._id && i.variantSize === variant.size);
      if (existing) {
        return prev.map((i) =>
          i.id === dish._id && i.variantSize === variant.size
            ? { ...i, quantity: i.quantity + qty, price: (i.quantity + qty) * i.pricePerQuantity }
            : i
        );
      }
      return [
        ...prev,
        {
          dishId: dish._id,
          id: dish._id,
          name: dish.name,
          variantSize: variant.size,
          pricePerQuantity: variant.price,
          ...(variant.markedPrice != null && variant.markedPrice > variant.price
            ? { markedPricePerQuantity: variant.markedPrice }
            : {}),
          quantity: qty,
          price: variant.price * qty,
          batch: 1,
        },
      ];
    });
  }, []);

  const handleChangeQty = useCallback((id: string, variantSize: string | undefined, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((i) => {
          if (i.id !== id || i.variantSize !== variantSize) return i;
          const newQty = i.quantity + delta;
          if (newQty <= 0) return null as unknown as LocalCartItem;
          return { ...i, quantity: newQty, price: newQty * i.pricePerQuantity };
        })
        .filter(Boolean)
    );
  }, []);

  const handleRemoveFromCart = useCallback((id: string, variantSize: string | undefined) => {
    setCartItems((prev) => prev.filter((i) => !(i.id === id && i.variantSize === variantSize)));
  }, []);

  // ── Order type / table handlers ───────────────────────────────
  const handleSelectOrderType = useCallback((type: "dine-in" | "takeaway" | "delivery") => {
    setOrderType(type);
    if (type !== "dine-in") setTableId("");
    if (type !== "delivery") setIsDriver(false);
  }, []);

  const handleToggleDriver = useCallback(() => {
    setIsDriver((prev) => {
      const next = !prev;
      if (next) { setCustomerName("Driver"); setCustomerPhone("0000000000"); setTableId(""); }
      else { setCustomerName(""); setCustomerPhone(""); }
      return next;
    });
  }, []);

  // ── Submit ────────────────────────────────────────────────────
  const { mutate: submit, isPending } = useMutation({
    mutationFn: addOrder,
    onSuccess: () => {
      enqueueSnackbar("Past order added successfully!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["customerLedgers"] });
      queryClient.invalidateQueries({ queryKey: ["earnings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardEarnings"] });
      navigate("/orders");
    },
    onError: (err: Error) => {
      enqueueSnackbar("Failed to add order: " + err.message, { variant: "error" });
    },
  });

  const handleSubmit = useCallback(() => {
    if (!customerName.trim()) {
      enqueueSnackbar("Customer name is required", { variant: "warning" }); return;
    }
    if (!customerPhone.trim() || customerPhone.trim().length < 10) {
      enqueueSnackbar("Valid phone number is required", { variant: "warning" }); return;
    }
    if (cartItems.length === 0) {
      enqueueSnackbar("Add at least one item", { variant: "warning" }); return;
    }
    const paid = amountPaidTouched ? amountPaid : finalTotal;
    submit({
      customerDetails: { name: customerName.trim(), phone: customerPhone.trim(), guests },
      orderType,
      orderStatus,
      paymentStatus: paid >= finalTotal ? "Paid" : "Pending",
      bills: { total: subtotal, ...(discount > 0 && { discount }), totalWithTax: finalTotal },
      items: cartItems.map(({ dishId: _d, ...rest }) => rest),
      table: tableId || virtualTable?._id,
      paymentMethod,
      amountPaid: paid,
      orderDate: new Date(orderDate).toISOString(),
    });
  }, [
    customerName, customerPhone, guests, cartItems, amountPaidTouched, amountPaid,
    finalTotal, subtotal, discount, orderStatus, orderType, tableId, paymentMethod,
    orderDate, submit, virtualTable,
  ]);

  // ── Render ────────────────────────────────────────────────────
  const totalQty = cartItems.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="h-screen bg-dhaba-bg flex flex-col overflow-hidden">

      {/* Top bar */}
      <div className="shrink-0 bg-dhaba-bg/90 backdrop-blur-md border-b border-dhaba-border/20 px-4 sm:px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate("/orders")}
          className="p-2 rounded-xl hover:bg-dhaba-surface/60 text-dhaba-muted hover:text-dhaba-text transition-colors"
        >
          <FaArrowLeft />
        </button>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-dhaba-accent/10 flex items-center justify-center">
            <FaClipboardList className="text-dhaba-accent text-sm" />
          </div>
          <div>
            <h1 className="font-display text-base font-bold text-dhaba-text">Add Past Order</h1>
            <p className="text-[11px] text-dhaba-muted">Record an old order and update consumables</p>
          </div>
        </div>
      </div>

      {/* Body — fills remaining height, never overflows the viewport */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">

        {/* ── Left: Menu picker (scrollable) ── */}
        <main className="flex-1 min-h-0 overflow-y-auto border-b lg:border-b-0 lg:border-r border-dhaba-border/20">
          <div className="p-4 sm:p-5">
            <MenuContainer onAddToCart={handleAddToCart} />
          </div>
        </main>

        {/* ── Right sidebar: customer + cart + bill + submit ── */}
        <aside className="w-full lg:w-[400px] xl:w-[440px] shrink-0 flex flex-col min-h-0">

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* Customer */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-dhaba-muted">Customer</h2>
                <button
                  onClick={handleToggleDriver}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    isDriver
                      ? "bg-blue-500/20 border-blue-500/40 text-blue-400"
                      : "glass-input text-dhaba-muted hover:text-dhaba-text"
                  }`}
                >
                  <PiTruckTrailerLight />
                  {isDriver ? "Driver (on)" : "Driver order"}
                </button>
              </div>

              <CustomerFields
                value={{ name: customerName, phone: customerPhone }}
                onChange={({ name, phone }) => { setCustomerName(name); setCustomerPhone(phone); }}
                disabled={isDriver}
                inputClassName="glass-input w-full rounded-xl px-4 py-3 text-sm text-dhaba-text placeholder-dhaba-muted focus:outline-none focus:ring-1 focus:ring-dhaba-accent/40"
              />

              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="text-[11px] text-dhaba-muted mb-1.5 block font-semibold">Guests</label>
                  <div className="glass-input rounded-xl flex items-center overflow-hidden h-[42px]">
                    <button onClick={() => setGuests((g) => Math.max(1, g - 1))} className="px-3 h-full text-dhaba-accent font-bold hover:bg-dhaba-surface transition-colors">
                      <FaMinus className="text-xs" />
                    </button>
                    <span className="flex-1 text-center text-sm font-bold text-dhaba-text">{guests}</span>
                    <button onClick={() => setGuests((g) => g + 1)} className="px-3 h-full text-dhaba-accent font-bold hover:bg-dhaba-surface transition-colors">
                      <FaPlus className="text-xs" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-dhaba-muted mb-1.5 block font-semibold">Order Date</label>
                  <input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="glass-input w-full rounded-xl px-3 py-2.5 text-sm text-dhaba-text focus:outline-none focus:ring-1 focus:ring-dhaba-accent/40"
                  />
                </div>
              </div>
            </section>

            {/* Order type & table */}
            <section>
              <label className="text-[11px] text-dhaba-muted mb-2 block font-bold uppercase tracking-wider">Order Type & Table</label>
              {tablesLoading ? (
                <div className="glass-input rounded-xl px-4 py-3 text-sm text-dhaba-muted">Loading tables…</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleSelectOrderType("takeaway")}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                      orderType === "takeaway" ? "bg-amber-500/20 border-amber-500/40 text-amber-400" : "glass-input text-dhaba-muted hover:text-dhaba-text"
                    }`}
                  >
                    <FaShoppingBag className="text-xs" /> Takeaway
                  </button>
                  <button
                    onClick={() => handleSelectOrderType("delivery")}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                      orderType === "delivery" ? "bg-blue-500/20 border-blue-500/40 text-blue-400" : "glass-input text-dhaba-muted hover:text-dhaba-text"
                    }`}
                  >
                    <PiTruckTrailerLight className="text-xs" /> Delivery
                  </button>
                  {allTables.filter((t) => !t.isVirtual).map((t) => (
                    <button
                      key={t._id}
                      onClick={() => { handleSelectOrderType("dine-in"); setTableId(t._id); }}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                        orderType === "dine-in" && tableId === t._id ? "bg-dhaba-accent/20 border-dhaba-accent/40 text-dhaba-accent" : "glass-input text-dhaba-muted hover:text-dhaba-text"
                      }`}
                    >
                      <MdTableRestaurant className="text-sm" /> T-{t.tableNo}
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Cart items — always visible here, never below the menu */}
            {cartItems.length > 0 ? (
              <section>
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-dhaba-muted mb-2">
                  Order Items <span className="text-dhaba-accent">({totalQty})</span>
                </h2>
                <LocalCartDisplay
                  cartItems={cartItems}
                  onChangeQty={handleChangeQty}
                  onRemove={handleRemoveFromCart}
                />
              </section>
            ) : (
              <div className="glass-input rounded-2xl px-4 py-6 flex flex-col items-center gap-2 text-center">
                <FaClipboardList className="text-dhaba-muted text-2xl" />
                <p className="text-sm text-dhaba-muted">No items yet — tap a dish on the left to add it</p>
              </div>
            )}

            {/* Bill summary */}
            <PastOrderSummary
              subtotal={subtotal}
              discount={discount}
              finalTotal={finalTotal}
              paymentMethod={paymentMethod}
              orderStatus={orderStatus}
              displayAmountPaid={displayAmountPaid}
              onDiscountChange={setDiscount}
              onPaymentMethodChange={setPaymentMethod}
              onAmountPaidChange={(v) => { setAmountPaidTouched(true); setAmountPaid(v); }}
              onOrderStatusChange={setOrderStatus}
            />
          </div>

          {/* Submit — pinned to bottom of sidebar */}
          <div className="shrink-0 border-t border-dhaba-border/20 p-4">
            <button
              onClick={handleSubmit}
              disabled={isPending || cartItems.length === 0}
              className="w-full py-3.5 rounded-2xl bg-gradient-warm text-dhaba-bg font-bold text-sm
                hover:shadow-glow active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed
                flex items-center justify-center gap-2"
            >
              {isPending ? (
                <><div className="h-4 w-4 border-2 border-dhaba-bg border-t-transparent rounded-full animate-spin" /> Adding Order…</>
              ) : (
                <><FaClipboardList /> Add Past Order {totalQty > 0 && `(${totalQty} items)`}</>
              )}
            </button>
          </div>
        </aside>

      </div>
    </div>
  );
};

export default AddPastOrderPage;
