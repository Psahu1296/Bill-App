import { useMemo } from "react";
import { FaSearch, FaPlus, FaMinus, FaTrash } from "react-icons/fa";
import type { Dish, DishVariant } from "../../types";

export interface LocalCartItem {
  dishId: string;
  id: string;
  name: string;
  variantSize: string | undefined;
  pricePerQuantity: number;
  markedPricePerQuantity?: number;
  quantity: number;
  price: number;
  batch: number;
}

interface PastOrderItemBuilderProps {
  allDishes: Dish[];
  dishesLoading: boolean;
  cartItems: LocalCartItem[];
  selectedVariants: Record<string, DishVariant>;
  search: string;
  catFilter: string;
  onSearchChange: (v: string) => void;
  onCatFilterChange: (v: string) => void;
  onVariantSelect: (dishId: string, variant: DishVariant) => void;
  onAddToCart: (dish: Dish) => void;
  onChangeQty: (id: string, variantSize: string | undefined, delta: number) => void;
  onRemoveFromCart: (id: string, variantSize: string | undefined) => void;
}

function getVariant(dish: Dish, selectedVariants: Record<string, DishVariant>): DishVariant {
  if (selectedVariants[dish._id]) return selectedVariants[dish._id];
  return (
    dish.variants.find((v) => v.size === "Full") ||
    dish.variants.find((v) => v.size === "Regular") ||
    dish.variants[0]
  );
}

const PastOrderItemBuilder: React.FC<PastOrderItemBuilderProps> = ({
  allDishes,
  dishesLoading,
  cartItems,
  selectedVariants,
  search,
  catFilter,
  onSearchChange,
  onCatFilterChange,
  onVariantSelect,
  onAddToCart,
  onChangeQty,
  onRemoveFromCart,
}) => {
  const categories = useMemo(() => {
    const cats = Array.from(new Set(allDishes.map((d) => d.category))).sort();
    return ["All", ...cats];
  }, [allDishes]);

  const filteredDishes = useMemo(() => {
    return allDishes.filter((d) => {
      if (!d.isAvailable || !d.variants.length) return false;
      const matchCat = catFilter === "All" || d.category === catFilter;
      const matchSearch = d.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [allDishes, catFilter, search]);

  return (
    <>
      {/* ── Menu Selection ── */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-dhaba-muted mb-3">Select Menu Items</h3>

        {/* Search */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 glass-input rounded-xl flex items-center gap-2 px-3 py-2">
            <FaSearch className="text-dhaba-muted text-xs flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
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
              onClick={() => onCatFilterChange(cat)}
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
              const variant = getVariant(dish, selectedVariants);
              const inCart  = cartItems.find((i) => i.id === dish._id && i.variantSize === variant.size);
              const isNonVeg = dish.type === "non-veg";
              return (
                <div
                  key={dish._id}
                  className="glass-card rounded-2xl p-3 flex flex-col gap-2 border border-dhaba-border/10"
                >
                  {/* Name + type indicator */}
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
                          onClick={() => onVariantSelect(dish._id, v)}
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
                    <div className="flex flex-col">
                      {variant.markedPrice != null && variant.markedPrice > variant.price && (
                        <span className="text-[10px] line-through text-dhaba-muted leading-none">
                          ₹{variant.markedPrice}
                        </span>
                      )}
                      <span className="text-sm font-bold text-dhaba-text">₹{variant.price}</span>
                    </div>
                    {inCart ? (
                      <div className="flex items-center glass-input rounded-lg overflow-hidden">
                        <button
                          onClick={() => onChangeQty(dish._id, variant.size, -1)}
                          className="px-2 py-1 text-dhaba-accent font-bold text-xs hover:bg-dhaba-surface transition-colors"
                        >
                          <FaMinus className="text-[9px]" />
                        </button>
                        <span className="px-2 text-xs font-bold text-dhaba-text min-w-[20px] text-center">
                          {inCart.quantity}
                        </span>
                        <button
                          onClick={() => onChangeQty(dish._id, variant.size, 1)}
                          className="px-2 py-1 text-dhaba-accent font-bold text-xs hover:bg-dhaba-surface transition-colors"
                        >
                          <FaPlus className="text-[9px]" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onAddToCart(dish)}
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

      {/* ── Cart Items ── */}
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
                      onClick={() => onChangeQty(item.id, item.variantSize, -1)}
                      className="px-2 py-1 text-dhaba-accent font-bold text-sm hover:bg-dhaba-surface transition-colors"
                    >
                      −
                    </button>
                    <span className="px-2 text-sm font-bold text-dhaba-text min-w-[24px] text-center">{item.quantity}</span>
                    <button
                      onClick={() => onChangeQty(item.id, item.variantSize, 1)}
                      className="px-2 py-1 text-dhaba-accent font-bold text-sm hover:bg-dhaba-surface transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-sm font-bold text-dhaba-text w-16 text-right">₹{item.price}</span>
                  <button
                    onClick={() => onRemoveFromCart(item.id, item.variantSize)}
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
    </>
  );
};

export default PastOrderItemBuilder;
