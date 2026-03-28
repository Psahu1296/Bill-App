import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import {
  FaTimes, FaClipboardList, FaSearch, FaPlus, FaMinus, FaTrash,
} from "react-icons/fa";
import { MdTableRestaurant } from "react-icons/md";
import { getTables, getDishes, addOrder } from "../../https";
import type { Table, Dish, DishVariant, CartItem, OrderStatus, PaymentMethod } from "../../types";

interface AddPastOrderModalProps {
  onClose: () => void;
}

interface LocalCartItem extends CartItem {
  dishId: string;
}

const TAX_RATE = 0; // No separate GST — totalWithTax = total - discount + roundOff

const AddPastOrderModal: React.FC<AddPastOrderModalProps> = ({ onClose }) => {
  const queryClient = useQueryClient();

  // ── Form state ────────────────────────────────────────────────
  const [customerName, setCustomerName]   = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [guests, setGuests]               = useState(1);
  const [tableId, setTableId]             = useState<string>("");
  const [orderDate, setOrderDate]         = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [discount, setDiscount]           = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [orderStatus, setOrderStatus]     = useState<OrderStatus>("Completed");
  const [amountPaid, setAmountPaid]       = useState(0);

  // ── Menu state ────────────────────────────────────────────────
  const [search, setSearch]               = useState("");
  const [catFilter, setCatFilter]         = useState("All");
  const [cartItems, setCartItems]         = useState<LocalCartItem[]>([]);
  // Tracks selected variant per dish: dishId -> variant
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

  const allTables: Table[]  = tablesRes?.data?.data ?? [];
  const allDishes: Dish[]   = dishesRes?.data?.data ?? [];

  // ── Category list ─────────────────────────────────────────────
  const categories = useMemo(() => {
    const cats = Array.from(new Set(allDishes.map((d) => d.category))).sort();
    return ["All", ...cats];
  }, [allDishes]);

  // ── Filtered dishes ───────────────────────────────────────────
  const filteredDishes = useMemo(() => {
    return allDishes.filter((d) => {
      if (!d.isAvailable || !d.variants.length) return false;
      const matchCat = catFilter === "All" || d.category === catFilter;
      const matchSearch = d.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [allDishes, catFilter, search]);

  // ── Get active variant for a dish ─────────────────────────────
  const getVariant = (dish: Dish): DishVariant => {
    if (selectedVariants[dish._id]) return selectedVariants[dish._id];
    return (
      dish.variants.find((v) => v.size === "Full") ||
      dish.variants.find((v) => v.size === "Regular") ||
      dish.variants[0]
    );
  };

  // ── Add dish to cart ──────────────────────────────────────────
  const addToCart = (dish: Dish) => {
    const variant = getVariant(dish);
    const key = `${dish._id}_${variant.size}`;
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
          quantity: 1,
          price: variant.price,
          batch: 1,
        },
      ];
    });
    void key; // suppress unused warning
  };

  const changeQty = (id: string, variantSize: string | undefined, delta: number) => {
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
  };

  const removeFromCart = (id: string, variantSize: string | undefined) => {
    setCartItems((prev) => prev.filter((i) => !(i.id === id && i.variantSize === variantSize)));
  };

  // ── Bill calculation ──────────────────────────────────────────
  const subtotal     = cartItems.reduce((s, i) => s + i.price, 0);
  const finalTotal   = Math.max(0, subtotal - discount);
  const TAX_UNUSED   = TAX_RATE; void TAX_UNUSED;

  // Sync amountPaid to finalTotal when it changes (unless admin has explicitly changed it)
  const [amountPaidTouched, setAmountPaidTouched] = useState(false);
  const displayAmountPaid = amountPaidTouched ? amountPaid : finalTotal;

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

  const handleSubmit = () => {
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
  };

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
                      onClick={() => setGuests((g) => Math.max(1, g - 1))}
                      className="px-3 py-2.5 text-dhaba-accent font-bold hover:bg-dhaba-surface transition-colors"
                    >
                      <FaMinus className="text-xs" />
                    </button>
                    <span className="flex-1 text-center text-sm font-bold text-dhaba-text">{guests}</span>
                    <button
                      onClick={() => setGuests((g) => g + 1)}
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
                      onClick={() => setTableId("")}
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
                        onClick={() => setTableId(t._id)}
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

            {/* ── Menu Selection ── */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-dhaba-muted mb-3">Select Menu Items</h3>

              {/* Search + category filter */}
              <div className="flex gap-2 mb-3">
                <div className="flex-1 glass-input rounded-xl flex items-center gap-2 px-3 py-2">
                  <FaSearch className="text-dhaba-muted text-xs flex-shrink-0" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search dishes…"
                    className="bg-transparent text-sm text-dhaba-text placeholder-dhaba-muted focus:outline-none flex-1"
                  />
                </div>
              </div>

              {/* Category pills */}
              <div className="flex gap-1.5 flex-wrap mb-3">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCatFilter(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      catFilter === cat
                        ? "bg-dhaba-accent text-dhaba-bg"
                        : "glass-input text-dhaba-muted hover:text-dhaba-text"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Dish cards */}
              {dishesLoading ? (
                <div className="flex items-center justify-center py-8 text-dhaba-muted gap-2">
                  <div className="h-4 w-4 border-2 border-dhaba-accent border-t-transparent rounded-full animate-spin" />
                  Loading menu…
                </div>
              ) : filteredDishes.length === 0 ? (
                <p className="text-center text-sm text-dhaba-muted py-8">No dishes found</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                  {filteredDishes.map((dish) => {
                    const variant = getVariant(dish);
                    const inCart  = cartItems.find((i) => i.id === dish._id && i.variantSize === variant.size);
                    const isNonVeg = dish.type === "non-veg";
                    return (
                      <div
                        key={dish._id}
                        className="glass-card rounded-2xl p-3 flex flex-col gap-2 border border-dhaba-border/10"
                      >
                        {/* Name + type */}
                        <div className="flex items-start gap-1.5">
                          <span className={`mt-0.5 inline-flex items-center justify-center w-3 h-3 rounded-sm border flex-shrink-0 ${isNonVeg ? "border-red-500" : "border-green-500"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isNonVeg ? "bg-red-500" : "bg-green-500"}`} />
                          </span>
                          <span className="text-xs font-bold text-dhaba-text leading-tight line-clamp-2">{dish.name}</span>
                        </div>

                        {/* Variant pills */}
                        {dish.variants.length > 1 && (
                          <div className="flex gap-1 flex-wrap">
                            {dish.variants.map((v) => (
                              <button
                                key={v.size}
                                onClick={() => setSelectedVariants((prev) => ({ ...prev, [dish._id]: v }))}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                                  variant.size === v.size
                                    ? "bg-dhaba-accent text-dhaba-bg"
                                    : "glass-input text-dhaba-muted"
                                }`}
                              >
                                {v.size}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Price + Add button */}
                        <div className="flex items-center justify-between mt-auto">
                          <span className="text-sm font-bold text-dhaba-text">₹{variant.price}</span>
                          {inCart ? (
                            <div className="flex items-center glass-input rounded-lg overflow-hidden">
                              <button
                                onClick={() => changeQty(dish._id, variant.size, -1)}
                                className="px-2 py-1 text-dhaba-accent font-bold text-xs hover:bg-dhaba-surface transition-colors"
                              >
                                <FaMinus className="text-[9px]" />
                              </button>
                              <span className="px-2 text-xs font-bold text-dhaba-text min-w-[20px] text-center">
                                {inCart.quantity}
                              </span>
                              <button
                                onClick={() => changeQty(dish._id, variant.size, 1)}
                                className="px-2 py-1 text-dhaba-accent font-bold text-xs hover:bg-dhaba-surface transition-colors"
                              >
                                <FaPlus className="text-[9px]" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addToCart(dish)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-dhaba-accent/15 text-dhaba-accent text-xs font-bold hover:bg-dhaba-accent/25 transition-colors"
                            >
                              <FaPlus className="text-[9px]" /> Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── Cart / Order Items ── */}
            {cartItems.length > 0 && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-dhaba-muted mb-3">
                  Order Items <span className="text-dhaba-accent">({cartItems.length})</span>
                </h3>
                <div className="space-y-1.5">
                  {cartItems.map((item) => (
                    <div
                      key={`${item.id}_${item.variantSize}`}
                      className="flex items-center justify-between glass-input rounded-xl px-4 py-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-dhaba-text truncate">{item.name}</p>
                        <p className="text-[11px] text-dhaba-muted">{item.variantSize} · ₹{item.pricePerQuantity} each</p>
                      </div>
                      <div className="flex items-center gap-3 ml-3">
                        <div className="flex items-center glass-card rounded-lg overflow-hidden">
                          <button
                            onClick={() => changeQty(item.id, item.variantSize, -1)}
                            className="px-2 py-1 text-dhaba-accent font-bold text-sm hover:bg-dhaba-surface transition-colors"
                          >
                            −
                          </button>
                          <span className="px-2 text-sm font-bold text-dhaba-text min-w-[24px] text-center">{item.quantity}</span>
                          <button
                            onClick={() => changeQty(item.id, item.variantSize, 1)}
                            className="px-2 py-1 text-dhaba-accent font-bold text-sm hover:bg-dhaba-surface transition-colors"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-sm font-bold text-dhaba-text w-16 text-right">₹{item.price}</span>
                        <button
                          onClick={() => removeFromCart(item.id, item.variantSize)}
                          className="p-1.5 rounded-lg hover:bg-dhaba-danger/10 text-dhaba-muted hover:text-dhaba-danger transition-colors"
                        >
                          <FaTrash className="text-xs" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Bill Summary + Payment ── */}
            <section className="glass-card rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-dhaba-muted">Bill & Payment</h3>

              {/* Bill rows */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-dhaba-muted">Subtotal</span>
                  <span className="font-semibold text-dhaba-text">₹{subtotal}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-dhaba-muted">Discount</span>
                  <div className="flex items-center gap-2">
                    <span className="text-dhaba-muted">₹</span>
                    <input
                      type="number"
                      min={0}
                      value={discount}
                      onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                      className="glass-input rounded-lg px-2 py-1 w-20 text-right text-dhaba-text focus:outline-none focus:ring-1 focus:ring-dhaba-accent/40 text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-between border-t border-dhaba-border/20 pt-2 font-bold">
                  <span className="text-dhaba-text">Total</span>
                  <span className="text-dhaba-accent text-base">₹{finalTotal}</span>
                </div>
              </div>

              {/* Payment method */}
              <div>
                <p className="text-xs text-dhaba-muted mb-2">Payment Method</p>
                <div className="flex gap-2">
                  {(["Cash", "Online"] as PaymentMethod[]).map((pm) => (
                    <button
                      key={pm}
                      onClick={() => setPaymentMethod(pm)}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                        paymentMethod === pm
                          ? "bg-dhaba-accent text-dhaba-bg"
                          : "glass-input text-dhaba-muted hover:text-dhaba-text"
                      }`}
                    >
                      {pm}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount paid */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-xs text-dhaba-muted mb-1">Amount Paid (₹)</p>
                  <input
                    type="number"
                    min={0}
                    value={displayAmountPaid}
                    onChange={(e) => {
                      setAmountPaidTouched(true);
                      setAmountPaid(Math.max(0, Number(e.target.value)));
                    }}
                    className="glass-input w-full rounded-xl px-4 py-2.5 text-sm text-dhaba-text focus:outline-none focus:ring-1 focus:ring-dhaba-accent/40"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-dhaba-muted mb-1">Order Status</p>
                  <select
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value as OrderStatus)}
                    className="glass-input w-full rounded-xl px-4 py-2.5 text-sm text-dhaba-text focus:outline-none focus:ring-1 focus:ring-dhaba-accent/40 bg-transparent"
                  >
                    <option value="Completed">Completed</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Ready">Ready</option>
                  </select>
                </div>
              </div>
            </section>

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
