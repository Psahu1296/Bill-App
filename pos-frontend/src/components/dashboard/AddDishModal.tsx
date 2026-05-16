import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaUtensils, FaPlus, FaMinus, FaTrash, FaCheckCircle, FaStar, FaGlobe, FaEyeSlash } from "react-icons/fa";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { useForm, useFieldArray } from "react-hook-form";
import { addDish, updateDish } from "../../https";
import type { Dish, AddDishPayload } from "../../types";

const DISH_TYPES = ["veg", "non-veg"];
const DISH_CATEGORIES = ["rice", "roti", "sabji", "drinks", "snacks", "other"];
const DISH_VARIANT_SIZES = ["Single", "Half", "Full", "Regular", "Small", "Large"];

const VISIBILITY_SETTINGS = [
  { id: "isAvailable", label: "Available for Order", icon: FaCheckCircle },
  { id: "isFrequent", label: "Frequently Ordered", icon: FaStar },
  { id: "isOnlineAvailable", label: "Available Online", icon: FaGlobe },
  { id: "excludeFromPopular", label: "Hide from Popular", icon: FaEyeSlash },
] as const;
interface DishFormData {
  image: string;
  name: string;
  type: string;
  category: string;
  variants: { size: string; price: number | string; markedPrice?: number | string; onlinePrice?: number | string }[];
  description: string;
  descriptionHi: string;
  isAvailable: boolean;
  isFrequent: boolean;
  isOnlineAvailable: boolean;
  excludeFromPopular: boolean;
}

interface AddDishModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDishAdded?: () => void;
  dish?: Dish | null;
}

const AddDishModal: React.FC<AddDishModalProps> = ({
  isOpen,
  onClose,
  onDishAdded,
  dish = null,
}) => {
  const queryClient = useQueryClient();
  const isEditMode = !!dish;

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    getValues,
    setValue,
    formState: { errors, isSubmitting: isFormSubmitting },
  } = useForm<DishFormData>({
    defaultValues: {
      image: "",
      name: "",
      type: "veg",
      category: "sabji",
      variants: [{ size: "", price: "", markedPrice: "", onlinePrice: "" }],
      description: "",
      descriptionHi: "",
      isAvailable: true,
      isFrequent: false,
      isOnlineAvailable: false,
      excludeFromPopular: false,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "variants" });

  const addDishMutation = useMutation({
    mutationFn: (dishData: AddDishPayload) => addDish(dishData),
    onSuccess: (res) => {
      enqueueSnackbar(
        (res.data as { message?: string })?.message || "Dish added successfully!",
        { variant: "success" }
      );
      queryClient.invalidateQueries({ queryKey: ["dishes"] });
      reset();
      onClose();
      onDishAdded?.();
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      enqueueSnackbar(error.response?.data?.message || "Failed to add dish.", { variant: "error" });
    },
  });

  const updateDishMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: object }) => updateDish(id, updates),
    onSuccess: (data) => {
      enqueueSnackbar(
        (data.data as { message?: string })?.message || "Dish updated!",
        { variant: "success" }
      );
      queryClient.invalidateQueries({ queryKey: ["dishes"] });
      onClose();
      onDishAdded?.();
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      enqueueSnackbar(error.response?.data?.message || "Failed to update dish.", { variant: "error" });
    },
  });

  const onSubmit = (data: DishFormData) => {
    const payload = {
      ...data,
      variants: data.variants.map((v) => {
        const base = { size: v.size, price: parseFloat(String(v.price)) };
        const mp = parseFloat(String(v.markedPrice));
        const op = parseFloat(String(v.onlinePrice));
        const withMp = (!isNaN(mp) && mp > base.price) ? { ...base, markedPrice: mp } : base;
        return (!isNaN(op) && op > 0) ? { ...withMp, onlinePrice: op } : withMp;
      }),
    };
    if (isEditMode && dish) {
      updateDishMutation.mutate({ id: dish._id, updates: payload });
    } else {
      addDishMutation.mutate(payload);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && dish) {
        reset({
          image: dish.image || "",
          name: dish.name || "",
          type: dish.type || "veg",
          category: dish.category || "sabji",
          variants:
            dish.variants?.length > 0
              ? dish.variants.map((v) => ({ size: v.size || "", price: v.price || 0, markedPrice: v.markedPrice ?? "", onlinePrice: v.onlinePrice ?? "" }))
              : [{ size: "", price: "", markedPrice: "", onlinePrice: "" }],
          description: dish.description || "",
          descriptionHi: dish.descriptionHi || "",
          isAvailable: dish.isAvailable !== undefined ? dish.isAvailable : true,
          isFrequent: dish.isFrequent !== undefined ? dish.isFrequent : false,
          isOnlineAvailable: dish.isOnlineAvailable !== undefined ? dish.isOnlineAvailable : false,
          excludeFromPopular: dish.excludeFromPopular ?? false,
        });
      } else {
        reset();
      }
    }
  }, [isOpen, dish, isEditMode, reset]);

  const isActionPending = isFormSubmitting || addDishMutation.isPending || updateDishMutation.isPending;

  const inputClass =
    "w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm font-medium focus:outline-none focus:ring-2 ring-blue-500/50 placeholder:text-white/20 transition-all";
  const selectClass =
    "w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm font-medium focus:outline-none focus:ring-2 ring-blue-500/50 appearance-none transition-all";
  const labelClass = "block text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5 ml-1";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="glass-card w-full max-w-4xl rounded-[2rem] overflow-hidden max-h-[90vh] flex flex-col shadow-glow border border-white/10 relative"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 shrink-0 bg-black/20">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                  <FaUtensils className="text-blue-400 text-lg" />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 tracking-wide">
                    {isEditMode ? "Edit Dish" : "Add New Dish"}
                  </h2>
                  <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest mt-0.5">
                    {isEditMode ? "Update dish details" : "Fill in the dish details below"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2.5 bg-white/5 hover:bg-red-500/20 border border-white/5 hover:border-red-500/30 rounded-xl transition-all group"
              >
                <FaTimes className="text-white/40 group-hover:text-red-400" />
              </button>
            </div>

            {/* Body */}
            <form
              id="dish-form"
              onSubmit={handleSubmit(onSubmit)}
              className="overflow-y-auto flex-1 px-8 py-6 space-y-6 scrollbar-hide relative z-10"
            >
              {/* Primary Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Name */}
                <div>
                  <label className={labelClass}>Dish Name *</label>
                  <input
                    type="text"
                    {...register("name", { required: "Dish name is required" })}
                    className={inputClass}
                    placeholder="e.g. Paneer Butter Masala"
                  />
                  {errors.name && <p className="text-red-400 text-[10px] font-bold mt-1.5 ml-1">{errors.name.message}</p>}
                </div>

                {/* Category */}
                <div>
                  <label className={labelClass}>Category *</label>
                  <select {...register("category", { required: true })} className={selectClass}>
                    {DISH_CATEGORIES.map((c) => (
                      <option key={c} value={c} className="bg-[#1a1f2e] text-white">
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Type */}
                <div>
                  <label className={labelClass}>Dietary Type *</label>
                  <select {...register("type", { required: true })} className={selectClass}>
                    {DISH_TYPES.map((t) => (
                      <option key={t} value={t} className="bg-[#1a1f2e] text-white">
                        {t === "non-veg" ? "Non-Veg" : "Veg"}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Image URL */}
                <div>
                  <label className={labelClass}>Image URL <span className="normal-case opacity-50">(optional)</span></label>
                  <input
                    type="text"
                    {...register("image")}
                    className={inputClass}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              </div>

              {/* Variants table */}
              <div className="pt-2">
                <label className={labelClass}>Variants & Pricing *</label>
                <div className="rounded-2xl border border-white/10 overflow-hidden bg-black/10">
                  {/* Table header */}
                  <div className="grid grid-cols-[1.5fr_2fr_1.5fr_1.5fr_3rem] gap-3 px-5 py-3 bg-white/5 border-b border-white/5">
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Size</span>
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Base Price</span>
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">MRP <span className="opacity-50">(Opt)</span></span>
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Online <span className="opacity-50">(Opt)</span></span>
                    <span />
                  </div>

                  {/* Table rows */}
                  <div className="divide-y divide-white/5">
                    {fields.map((field, index) => (
                      <div key={field.id} className="grid grid-cols-[1.5fr_2fr_1.5fr_1.5fr_3rem] gap-3 items-start px-5 py-3">
                        {/* Size */}
                        <div>
                          <select
                            {...register(`variants.${index}.size`, {
                              required: "Required",
                              validate: (value) => {
                                const all = watch("variants");
                                return all.filter((v) => v.size === value).length <= 1 || "Duplicate";
                              },
                            })}
                            className={`${selectClass} py-2 text-xs`}
                          >
                            <option value="" disabled className="bg-[#1a1f2e]">Select</option>
                            {DISH_VARIANT_SIZES.map((s) => (
                              <option key={s} value={s} className="bg-[#1a1f2e] text-white">{s}</option>
                            ))}
                          </select>
                          {errors.variants?.[index]?.size && (
                            <p className="text-red-400 text-[9px] font-bold mt-1 ml-1">{errors.variants[index]?.size?.message}</p>
                          )}
                        </div>

                        {/* Base Price */}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              step="1"
                              {...register(`variants.${index}.price`, {
                                required: "Required",
                                min: { value: 0, message: "≥ 0" },
                                valueAsNumber: true,
                              })}
                              className={`${inputClass} py-2 text-xs`}
                              placeholder="0"
                            />
                            <div className="flex flex-col gap-0.5 shrink-0">
                              <button type="button" onClick={() => { const cur = Number(getValues(`variants.${index}.price`)) || 0; setValue(`variants.${index}.price`, cur + 10, { shouldValidate: true }); }} className="h-4 w-6 rounded bg-white/10 hover:bg-blue-500/30 flex items-center justify-center transition-colors text-[8px] text-white/70 hover:text-blue-400"><FaPlus /></button>
                              <button type="button" onClick={() => { const cur = Number(getValues(`variants.${index}.price`)) || 0; setValue(`variants.${index}.price`, Math.max(0, cur - 10), { shouldValidate: true }); }} className="h-4 w-6 rounded bg-white/10 hover:bg-red-500/30 flex items-center justify-center transition-colors text-[8px] text-white/70 hover:text-red-400"><FaMinus /></button>
                            </div>
                          </div>
                          {errors.variants?.[index]?.price && (
                            <p className="text-red-400 text-[9px] font-bold mt-1 ml-1">{errors.variants[index]?.price?.message}</p>
                          )}
                        </div>

                        {/* MRP */}
                        <div>
                          <input
                            type="number"
                            step="1"
                            {...register(`variants.${index}.markedPrice`, {
                              min: { value: 0, message: "≥ 0" },
                              validate: (value) => {
                                if (value === "" || value === undefined || value === null) return true;
                                const mp = Number(value);
                                const p  = Number(getValues(`variants.${index}.price`));
                                return mp > p || "Must > Price";
                              },
                            })}
                            className={`${inputClass} py-2 text-xs`}
                            placeholder="Opt."
                          />
                          {errors.variants?.[index]?.markedPrice && (
                            <p className="text-red-400 text-[9px] font-bold mt-1 ml-1">{errors.variants[index]?.markedPrice?.message}</p>
                          )}
                        </div>

                        {/* Online Price */}
                        <div>
                          <input
                            type="number"
                            step="1"
                            {...register(`variants.${index}.onlinePrice`, {
                              min: { value: 0, message: "≥ 0" },
                            })}
                            className={`${inputClass} py-2 text-xs`}
                            placeholder="Opt."
                          />
                          {errors.variants?.[index]?.onlinePrice && (
                            <p className="text-red-400 text-[9px] font-bold mt-1 ml-1">{errors.variants[index]?.onlinePrice?.message}</p>
                          )}
                        </div>

                        {/* Delete */}
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            disabled={fields.length === 1}
                            className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors border border-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <FaTrash size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add row */}
                  <div className="px-5 py-3 border-t border-white/5 bg-black/20">
                    <button
                      type="button"
                      onClick={() => append({ size: "", price: "", markedPrice: "", onlinePrice: "" })}
                      className="flex items-center gap-2 text-blue-400 text-[11px] font-black uppercase tracking-widest hover:text-blue-300 transition-colors"
                    >
                      <div className="h-5 w-5 rounded bg-blue-500/20 flex items-center justify-center"><FaPlus size={8} /></div>
                      Add Variant
                    </button>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                <div>
                  <label className={labelClass}>Description (English) <span className="normal-case opacity-50">(optional)</span></label>
                  <textarea
                    rows={3}
                    {...register("description")}
                    className={`${inputClass} resize-none`}
                    placeholder="e.g. Rich, hearty, and a dhaba favourite."
                  />
                </div>
                <div>
                  <label className={labelClass}>Description (Hindi) <span className="normal-case opacity-50">(optional)</span></label>
                  <textarea
                    rows={3}
                    {...register("descriptionHi")}
                    className={`${inputClass} resize-none`}
                    placeholder="e.g. भरपूर और स्वादिष्ट।"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="pt-2">
                <label className={labelClass}>Visibility & Settings</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {VISIBILITY_SETTINGS.map(({ id, label, icon: Icon }) => (
                    <label
                      key={id}
                      className="flex items-center justify-between cursor-pointer bg-black/20 border border-white/5 rounded-xl px-4 py-3.5 hover:bg-white/5 hover:border-white/10 transition-all group"
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="text-white/40 group-hover:text-blue-400 transition-colors text-lg" />
                        <span className="text-white/80 text-xs font-bold tracking-wide">{label}</span>
                      </div>
                      <div className="relative flex items-center justify-center">
                        <input
                          type="checkbox"
                          {...register(id)}
                          className="peer sr-only"
                        />
                        <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="px-8 py-5 bg-black/20 border-t border-white/5 flex gap-4 justify-end shrink-0 relative z-10">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 font-bold text-sm hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="dish-form"
                disabled={isActionPending}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white px-8 py-2.5 rounded-xl font-black text-sm tracking-wide flex items-center gap-2 shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-blue-400/50"
              >
                {isActionPending && (
                  <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                )}
                {isActionPending
                  ? isEditMode ? "Updating..." : "Adding..."
                  : isEditMode ? "Save Changes" : "Add Dish"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AddDishModal;
