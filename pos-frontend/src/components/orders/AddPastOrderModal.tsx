import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { FaTimes, FaClipboardList, FaPlus, FaMinus } from "react-icons/fa";
import { MdTableRestaurant } from "react-icons/md";
import { getTables, getDishes, addOrder } from "../../https";
import { getTodayISO } from "../../utils";
import type { Table, Dish, DishVariant, OrderStatus, PaymentMethod } from "../../types";
import PastOrderItemBuilder, { type LocalCartItem } from "./PastOrderItemBuilder";
import PastOrderSummary from "./PastOrderSummary";

interface AddPastOrderModalProps {
  onClose: () => void;
}

const AddPastOrderModal: React.FC<AddPastOrderModalProps> = ({ onClose }) => {
  const queryClient = useQueryClient();

  // ── Customer state ────────────────────────────────────────────
  const [customerName, setCustomerName]   = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [guests, setGuests]               = useState(1);
  const [tableId, setTableId]             = useState("");
  const [orderDate, setOrderDate]         = useState(getTodayISO);

  // ── Bill state ────────────────────────────────────────────────
  const [discount, setDiscount]           = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [orderStatus, setOrderStatus]     = useState<OrderStatus>("Completed");
  const [amountPaid, setAmountPaid]       = useState(0);
  const [amountPaidTouched, setAmountPaidTouched] = useState(false);

  // ── Menu / cart state ─────────────────────────────────────────
  const [search, setSearch]               = useState("");
  const [catFilter, setCatFilter]         = useState("All");
  const [cartItems, setCartItems]         = useState<LocalCartItem[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, DishVariant>>({});

  // ── Data fetching ─────────────────────────────────────────────
  const { data: tablesRes, isLoading: tablesLoading } = useQuery({
    queryKey: ["tables"],
    queryFn: getTables,
    staleTime: 60_000,
  });
  const { data: dishesRes, isLoading: dishesLoading } = useQuery({
    queryKey: ["dishes"],
    queryFn: getDishes,
    staleTime: 5 * 60_000,
  });

  const allTables: Table[] = tablesRes?.data?.data ?? [];
  const allDishes: Dish[]  = dishesRes?.data?.data ?? [];

  // ── Bill derived values ───────────────────────────────────────
  const subtotal           = cartItems.reduce((s, i) => s + i.price, 0);
  const finalTotal         = Math.max(0, subtotal - discount);
  const displayAmountPaid  = amountPaidTouched ? amountPaid : finalTotal;

  // ── Cart handlers ─────────────────────────────────────────────
  const handleVariantSelect = useCallback((dishId: string, variant: DishVariant) => {
    setSelectedVariants((prev) => ({ ...prev, [dishId]: variant }));
  }, []);

  const handleAddToCart = useCallback((dish: Dish) => {
    const variant =
      selectedVariants[dish._id] ||
      dish.variants.find((v) => v.size === "Full") ||
      dish.variants.find((v) => v.size === "Regular") ||
      dish.variants[0];
    setCartItems((prev) => {
      const existing = prev.find((i) => i.id === dish._id && i.variantSize === variant.size);
      if (existing) {
        return prev.map((i) =>
          i.id === dish._id && i.variantSize === variant.size
            ? { ...i, quantity: i.quantity + 1, price: (i.quantity + 1) * i.pricePerQuantity }
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
          quantity: 1,
          price: variant.price,
          batch: 1,
        },
      ];
    });
  }, [selectedVariants]);

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

  // ── Bill handlers ─────────────────────────────────────────────
  const handleAmountPaidChange = useCallback((v: number) => {
    setAmountPaidTouched(true);
    setAmountPaid(v);
  }, []);

  const handleDecrGuests = useCallback(() => setGuests((g) => Math.max(1, g - 1)), []);
  const handleIncrGuests = useCallback(() => setGuests((g) => g + 1), []);
  const handleSelectTable = useCallback((id: string) => setTableId(id), []);

  // ── Mutation ──────────────────────────────────────────────────
  const { mutate: submit, isPending } = useMutation({
    mutationFn: addOrder,
    onSuccess: () => {
      enqueueSnackbar("Past order added successfully!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      onClose();
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
      orderStatus,
      paymentStatus: paid >= finalTotal ? "Paid" : "Pending",
      bills: {
        total: subtotal,
        ...(discount > 0 && { discount }),
        totalWithTax: finalTotal,
      },
      items: cartItems.map(({ dishId: _d, ...rest }) => rest),
      table: tableId || undefined,
      paymentMethod,
      amountPaid: paid,
      orderDate: new Date(orderDate).toISOString(),
    });
  }, [
    customerName, customerPhone, guests, cartItems, amountPaidTouched, amountPaid,
    finalTotal, subtotal, discount, orderStatus, tableId, paymentMethod, orderDate, submit,
  ]);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-dhaba-bg/80 backdrop-blur-sm p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="glass-card w-full max-w-2xl rounded-3xl overflow-hidden my-4"
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-dhaba-border/20">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-dhaba-accent/10 flex items-center justify-center">
                <FaClipboardList className="text-dhaba-accent" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-dhaba-text">Add Past Order</h2>
                <p className="text-xs text-dhaba-muted">Record an old order and update consumables</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-dhaba-danger/10 rounded-xl transition-colors group"
            >
              <FaTimes className="text-dhaba-muted group-hover:text-dhaba-danger" />
            </button>
          </div>

          <div className="p-6 space-y-6">

            {/* ── Customer Details ── */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-dhaba-muted mb-3">Customer Details</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-dhaba-muted mb-1 block">Name *</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Customer name"
                    className="glass-input w-full rounded-xl px-4 py-2.5 text-sm text-dhaba-text placeholder-dhaba-muted focus:outline-none focus:ring-1 focus:ring-dhaba-accent/40"
                  />
                </div>
                <div>
                  <label className="text-xs text-dhaba-muted mb-1 block">Phone *</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="10-digit number"
                    className="glass-input w-full rounded-xl px-4 py-2.5 text-sm text-dhaba-text placeholder-dhaba-muted focus:outline-none focus:ring-1 focus:ring-dhaba-accent/40"
                  />
                </div>
                <div>
                  <label className="text-xs text-dhaba-muted mb-1 block">Guests</label>
                  <div className="glass-input rounded-xl flex items-center overflow-hidden">
                    <button
                      onClick={handleDecrGuests}
                      className="px-3 py-2.5 text-dhaba-accent font-bold hover:bg-dhaba-surface transition-colors"
                    >
                      <FaMinus className="text-xs" />
                    </button>
                    <span className="flex-1 text-center text-sm font-bold text-dhaba-text">{guests}</span>
                    <button
                      onClick={handleIncrGuests}
                      className="px-3 py-2.5 text-dhaba-accent font-bold hover:bg-dhaba-surface transition-colors"
                    >
                      <FaPlus className="text-xs" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-dhaba-muted mb-1 block">Order Date *</label>
                  <input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="glass-input w-full rounded-xl px-4 py-2.5 text-sm text-dhaba-text focus:outline-none focus:ring-1 focus:ring-dhaba-accent/40"
                  />
                </div>
              </div>

              {/* Table selector */}
              <div className="mt-3">
                <label className="text-xs text-dhaba-muted mb-1 block">Table</label>
                {tablesLoading ? (
                  <div className="glass-input rounded-xl px-4 py-2.5 text-sm text-dhaba-muted">Loading tables…</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleSelectTable("")}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                        tableId === ""
                          ? "bg-amber-500/20 border border-amber-500/40 text-amber-400"
                          : "glass-input text-dhaba-muted hover:text-dhaba-text"
                      }`}
                    >
                      Takeaway
                    </button>
                    {allTables.filter((t) => !t.isVirtual).map((t) => (
                      <button
                        key={t._id}
                        onClick={() => handleSelectTable(t._id)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                          tableId === t._id
                            ? "bg-dhaba-accent/20 border border-dhaba-accent/40 text-dhaba-accent"
                            : "glass-input text-dhaba-muted hover:text-dhaba-text"
                        }`}
                      >
                        <MdTableRestaurant className="text-sm" />
                        T-{t.tableNo}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <PastOrderItemBuilder
              allDishes={allDishes}
              dishesLoading={dishesLoading}
              cartItems={cartItems}
              selectedVariants={selectedVariants}
              search={search}
              catFilter={catFilter}
              onSearchChange={setSearch}
              onCatFilterChange={setCatFilter}
              onVariantSelect={handleVariantSelect}
              onAddToCart={handleAddToCart}
              onChangeQty={handleChangeQty}
              onRemoveFromCart={handleRemoveFromCart}
            />

            <PastOrderSummary
              subtotal={subtotal}
              discount={discount}
              finalTotal={finalTotal}
              paymentMethod={paymentMethod}
              orderStatus={orderStatus}
              displayAmountPaid={displayAmountPaid}
              onDiscountChange={setDiscount}
              onPaymentMethodChange={setPaymentMethod}
              onAmountPaidChange={handleAmountPaidChange}
              onOrderStatusChange={setOrderStatus}
            />

          </div>

          {/* ── Footer ── */}
          <div className="px-6 pb-6">
            <button
              onClick={handleSubmit}
              disabled={isPending || cartItems.length === 0}
              className="w-full py-3.5 rounded-2xl bg-dhaba-accent text-dhaba-bg font-bold text-sm
                hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed
                flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <div className="h-4 w-4 border-2 border-dhaba-bg border-t-transparent rounded-full animate-spin" />
                  Adding Order…
                </>
              ) : (
                <>
                  <FaClipboardList />
                  Add Past Order
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AddPastOrderModal;
