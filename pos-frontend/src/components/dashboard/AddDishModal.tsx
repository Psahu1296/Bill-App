import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaUtensils, FaPlus, FaTrash } from "react-icons/fa";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { useForm, useFieldArray } from "react-hook-form";
import { addDish, updateDish } from "../../https";
import type { Dish, AddDishPayload } from "../../types";

const DISH_TYPES = [
  "starter", "main_course", "dessert", "beverage", "bread", "soup", "salad", "tobacco",
];
const DISH_CATEGORIES = ["veg", "non_veg", "egg"];
const DISH_VARIANT_SIZES = ["Half", "Full", "Regular", "Small", "Large"];

interface DishFormData {
  image: string;
  name: string;
  type: string;
  category: string;
  variants: { size: string; price: number | string }[];
  description: string;
  isAvailable: boolean;
  isFrequent: boolean;
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
    formState: { errors, isSubmitting: isFormSubmitting },
  } = useForm<DishFormData>({
    defaultValues: {
      image: "",
      name: "",
      type: "main_course",
      category: "veg",
      variants: [{ size: "", price: "" }],
      description: "",
      isAvailable: true,
      isFrequent: false,
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
      variants: data.variants.map((v) => ({ ...v, price: parseFloat(String(v.price)) })),
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
          type: dish.type || "main_course",
          category: dish.category || "veg",
          variants:
            dish.variants?.length > 0
              ? dish.variants.map((v) => ({ size: v.size || "", price: v.price || 0 }))
              : [{ size: "", price: "" }],
          description: dish.description || "",
          isAvailable: dish.isAvailable !== undefined ? dish.isAvailable : true,
          isFrequent: dish.isFrequent !== undefined ? dish.isFrequent : false,
        });
      } else {
        reset();
      }
    }
  }, [isOpen, dish, isEditMode, reset]);

  const isActionPending = isFormSubmitting || addDishMutation.isPending || updateDishMutation.isPending;

  const inputClass =
    "w-full glass-input rounded-xl px-4 py-2.5 text-dhaba-text text-sm focus:outline-none focus:ring-1 ring-dhaba-accent/50 placeholder:text-dhaba-muted/50";
  const selectClass =
    "w-full glass-input rounded-xl px-4 py-2.5 text-dhaba-text text-sm focus:outline-none focus:ring-1 ring-dhaba-accent/50 appearance-none";
  const labelClass = "block text-xs font-bold text-dhaba-muted uppercase tracking-wider mb-1.5";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dhaba-bg/80 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="glass-card w-full max-w-xl rounded-3xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-dhaba-border/20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-dhaba-accent/10 flex items-center justify-center">
                  <FaUtensils className="text-dhaba-accent" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold text-dhaba-text">
                    {isEditMode ? "Edit Dish" : "Add New Dish"}
                  </h2>
                  <p className="text-xs text-dhaba-muted">
                    {isEditMode ? "Update dish details" : "Fill in the dish details below"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-dhaba-danger/10 rounded-xl transition-colors group"
              >
                <FaTimes className="text-dhaba-muted group-hover:text-dhaba-danger" />
              </button>
            </div>

            {/* Body */}
            <form
              id="dish-form"
              onSubmit={handleSubmit(onSubmit)}
              className="overflow-y-auto flex-1 px-6 py-5 space-y-5"
            >
              {/* Name */}
              <div>
                <label className={labelClass}>Dish Name *</label>
                <input
                  type="text"
                  {...register("name", { required: "Dish name is required" })}
                  className={inputClass}
                  placeholder="e.g. Paneer Butter Masala"
                />
                {errors.name && <p className="text-dhaba-danger text-xs mt-1">{errors.name.message}</p>}
              </div>

              {/* Image URL (optional) */}
              <div>
                <label className={labelClass}>Image URL <span className="normal-case text-dhaba-muted font-normal">(optional)</span></label>
                <input
                  type="text"
                  {...register("image")}
                  className={inputClass}
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              {/* Type + Category row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Dish Type *</label>
                  <select
                    {...register("type", { required: true })}
                    className={selectClass}
                  >
                    {DISH_TYPES.map((t) => (
                      <option key={t} value={t} className="bg-dhaba-surface text-dhaba-text">
                        {t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Category *</label>
                  <select
                    {...register("category", { required: true })}
                    className={selectClass}
                  >
                    {DISH_CATEGORIES.map((c) => (
                      <option key={c} value={c} className="bg-dhaba-surface text-dhaba-text">
                        {c === "non_veg" ? "Non-Veg" : c.charAt(0).toUpperCase() + c.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Variants table */}
              <div>
                <label className={labelClass}>Variants / Pricing *</label>
                <div className="rounded-2xl border border-dhaba-border/30 overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_1fr_2.5rem] gap-2 px-4 py-2 bg-dhaba-surface/60 border-b border-dhaba-border/20">
                    <span className="text-[10px] font-bold text-dhaba-muted uppercase tracking-wider">Size</span>
                    <span className="text-[10px] font-bold text-dhaba-muted uppercase tracking-wider">Price (₹)</span>
                    <span />
                  </div>

                  {/* Table rows */}
                  <div className="divide-y divide-dhaba-border/10">
                    {fields.map((field, index) => (
                      <div key={field.id} className="grid grid-cols-[1fr_1fr_2.5rem] gap-2 items-center px-4 py-2.5">
                        <div>
                          <select
                            {...register(`variants.${index}.size`, {
                              required: "Required",
                              validate: (value) => {
                                const all = watch("variants");
                                return all.filter((v) => v.size === value).length <= 1 || "Duplicate";
                              },
                            })}
                            className="w-full glass-input rounded-lg px-3 py-2 text-dhaba-text text-sm focus:outline-none focus:ring-1 ring-dhaba-accent/50 appearance-none"
                          >
                            <option value="" disabled className="bg-dhaba-surface">Select</option>
                            {DISH_VARIANT_SIZES.map((s) => (
                              <option key={s} value={s} className="bg-dhaba-surface text-dhaba-text">{s}</option>
                            ))}
                          </select>
                          {errors.variants?.[index]?.size && (
                            <p className="text-dhaba-danger text-[10px] mt-0.5">{errors.variants[index]?.size?.message}</p>
                          )}
                        </div>
                        <div>
                          <input
                            type="number"
                            step="0.01"
                            {...register(`variants.${index}.price`, {
                              required: "Required",
                              min: { value: 0, message: "≥ 0" },
                              valueAsNumber: true,
                            })}
                            className="w-full glass-input rounded-lg px-3 py-2 text-dhaba-text text-sm focus:outline-none focus:ring-1 ring-dhaba-accent/50"
                            placeholder="0.00"
                          />
                          {errors.variants?.[index]?.price && (
                            <p className="text-dhaba-danger text-[10px] mt-0.5">{errors.variants[index]?.price?.message}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                          className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-dhaba-danger/15 text-dhaba-muted hover:text-dhaba-danger transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <FaTrash size={12} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add row */}
                  <div className="px-4 py-2.5 border-t border-dhaba-border/20 bg-dhaba-surface/30">
                    <button
                      type="button"
                      onClick={() => append({ size: "", price: "" })}
                      className="flex items-center gap-1.5 text-dhaba-accent text-xs font-bold hover:underline"
                    >
                      <FaPlus size={10} /> Add Variant
                    </button>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className={labelClass}>Description <span className="normal-case text-dhaba-muted font-normal">(optional)</span></label>
                <textarea
                  rows={2}
                  {...register("description")}
                  className={`${inputClass} resize-none`}
                  placeholder="Short description of the dish..."
                />
              </div>

              {/* Toggles */}
              <div className="flex gap-3">
                {(
                  [
                    { id: "isAvailable", label: "Available for Order" },
                    { id: "isFrequent",  label: "Frequently Ordered" },
                  ] as { id: "isAvailable" | "isFrequent"; label: string }[]
                ).map(({ id, label }) => (
                  <label
                    key={id}
                    className="flex-1 flex items-center gap-3 cursor-pointer glass-input rounded-xl px-4 py-3 hover:bg-dhaba-surface-hover transition-colors"
                  >
                    <input
                      type="checkbox"
                      {...register(id)}
                      className="h-4 w-4 accent-dhaba-accent rounded"
                    />
                    <span className="text-dhaba-text text-sm font-medium">{label}</span>
                  </label>
                ))}
              </div>
            </form>

            {/* Footer */}
            <div className="px-6 py-4 bg-dhaba-surface/30 border-t border-dhaba-border/20 flex gap-3 justify-end shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl text-dhaba-muted font-bold text-sm hover:text-dhaba-text transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="dish-form"
                disabled={isActionPending}
                className="bg-gradient-warm text-dhaba-bg px-8 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isActionPending && (
                  <div className="h-4 w-4 border-2 border-dhaba-bg border-t-transparent rounded-full animate-spin" />
                )}
                {isActionPending
                  ? isEditMode ? "Updating..." : "Adding..."
                  : isEditMode ? "Update Dish" : "Add Dish"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AddDishModal;
