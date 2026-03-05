import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoMdClose } from "react-icons/io";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { useForm, useFieldArray } from "react-hook-form";
import { addDish, updateDish } from "../../https";
import type { Dish, AddDishPayload } from "../../types";

const DISH_TYPES = [
  "starter", "main_course", "dessert", "beverage", "bread", "soup", "salad",
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

  const { fields, append, remove } = useFieldArray({
    control,
    name: "variants",
  });

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
      enqueueSnackbar(
        error.response?.data?.message || "Failed to add dish.",
        { variant: "error" }
      );
    },
  });

  const updateDishMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: object }) =>
      updateDish(id, updates),
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
      enqueueSnackbar(
        error.response?.data?.message || "Failed to update dish.",
        { variant: "error" }
      );
    },
  });

  const onSubmit = (data: DishFormData) => {
    const dishDataWithParsedPrices = {
      ...data,
      variants: data.variants.map((v) => ({
        ...v,
        price: parseFloat(String(v.price)),
      })),
    };
    if (isEditMode && dish) {
      updateDishMutation.mutate({
        id: dish._id,
        updates: dishDataWithParsedPrices,
      });
    } else {
      addDishMutation.mutate(dishDataWithParsedPrices);
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

  const isActionPending =
    isFormSubmitting || addDishMutation.isPending || updateDishMutation.isPending;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="bg-[#262626] p-6 rounded-lg shadow-lg w-full max-w-lg mx-auto border border-[#333] max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[#f5f5f5] text-xl font-semibold">
                {isEditMode ? "Edit Dish" : "Add New Dish"}
              </h2>
              <button onClick={onClose} className="text-[#f5f5f5] hover:text-red-500 transition-colors">
                <IoMdClose size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div>
                <label htmlFor="name" className="block text-[#ababab] mb-1 text-sm font-medium">
                  Dish Name
                </label>
                <input
                  type="text"
                  id="name"
                  {...register("name", { required: "Dish name is required" })}
                  className="w-full rounded-lg p-3 px-4 bg-[#1f1f1f] text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
                {errors.name && (
                  <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="image" className="block text-[#ababab] mb-1 text-sm font-medium">
                  Image URL
                </label>
                <input
                  type="url"
                  id="image"
                  {...register("image", {
                    required: "Image URL is required",
                    pattern: {
                      value: /^https?:\/\/.+\.(png|jpg|jpeg|gif|svg|webp|avif)$/i,
                      message: "Must be a valid image URL",
                    },
                  })}
                  className="w-full rounded-lg p-3 px-4 bg-[#1f1f1f] text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
                {errors.image && (
                  <p className="text-red-400 text-xs mt-1">{errors.image.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="type" className="block text-[#ababab] mb-1 text-sm font-medium">
                  Dish Type
                </label>
                <select
                  id="type"
                  {...register("type", { required: "Dish type is required" })}
                  className="w-full rounded-lg p-3 px-4 bg-[#1f1f1f] text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 appearance-none pr-8"
                >
                  <option value="" disabled>Select a type</option>
                  {DISH_TYPES.map((type) => (
                    <option key={type} value={type} className="bg-[#262626] text-white">
                      {type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </option>
                  ))}
                </select>
                {errors.type && (
                  <p className="text-red-400 text-xs mt-1">{errors.type.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="category" className="block text-[#ababab] mb-1 text-sm font-medium">
                  Category
                </label>
                <select
                  id="category"
                  {...register("category", { required: "Category is required" })}
                  className="w-full rounded-lg p-3 px-4 bg-[#1f1f1f] text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 appearance-none pr-8"
                >
                  <option value="" disabled>Select a category</option>
                  {DISH_CATEGORIES.map((category) => (
                    <option key={category} value={category} className="bg-[#262626] text-white">
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </option>
                  ))}
                </select>
                {errors.category && (
                  <p className="text-red-400 text-xs mt-1">{errors.category.message}</p>
                )}
              </div>

              <div className="border border-[#333] rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">Dish Variants</h3>
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-center space-x-2 mb-3">
                    <div className="flex-grow">
                      <select
                        id={`variants.${index}.size`}
                        {...register(`variants.${index}.size`, {
                          required: "Size is required",
                          validate: (value) => {
                            const currentVariants = watch("variants");
                            const sizeCount = currentVariants.filter(
                              (v) => v.size === value
                            ).length;
                            return sizeCount <= 1 || "Duplicate size not allowed";
                          },
                        })}
                        className="w-full p-2 rounded bg-[#333] border border-[#555] text-[#f5f5f5] focus:outline-none focus:ring-2 focus:ring-yellow-400 appearance-none"
                      >
                        <option value="" disabled>Select Size</option>
                        {DISH_VARIANT_SIZES.map((size) => (
                          <option key={size} value={size} className="bg-[#262626] text-white">
                            {size}
                          </option>
                        ))}
                      </select>
                      {errors.variants?.[index]?.size && (
                        <p className="text-red-400 text-xs mt-1">
                          {errors.variants[index]?.size?.message}
                        </p>
                      )}
                    </div>
                    <div className="w-1/3">
                      <input
                        type="number"
                        step="0.01"
                        {...register(`variants.${index}.price`, {
                          required: "Price is required",
                          min: { value: 0, message: "Price cannot be negative" },
                          valueAsNumber: true,
                        })}
                        className="w-full p-2 rounded bg-[#333] border border-[#555] text-[#f5f5f5] focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        placeholder="Price"
                      />
                      {errors.variants?.[index]?.price && (
                        <p className="text-red-400 text-xs mt-1">
                          {errors.variants[index]?.price?.message}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-red-400 hover:text-red-500 p-2 rounded-full"
                    >
                      <IoMdClose size={20} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => append({ size: "", price: "" })}
                  className="mt-2 text-blue-400 hover:text-blue-500 font-medium text-sm"
                >
                  + Add Another Variant
                </button>
              </div>

              <div>
                <label htmlFor="description" className="block text-[#ababab] mb-1 text-sm font-medium">
                  Description
                </label>
                <textarea
                  id="description"
                  rows={3}
                  {...register("description")}
                  className="w-full rounded-lg p-3 px-4 bg-[#1f1f1f] text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-y"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isAvailable"
                  {...register("isAvailable")}
                  className="h-4 w-4 text-yellow-400 rounded border-gray-600 focus:ring-yellow-500 bg-[#1f1f1f]"
                />
                <label htmlFor="isAvailable" className="ml-2 block text-sm text-[#f5f5f5]">
                  Available for Order
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isFrequent"
                  {...register("isFrequent")}
                  className="h-4 w-4 text-yellow-400 rounded border-gray-600 focus:ring-yellow-500 bg-[#1f1f1f]"
                />
                <label htmlFor="isFrequent" className="ml-2 block text-sm text-[#f5f5f5]">
                  Frequently Ordered (e.g., Tea/Coffee)
                </label>
              </div>

              <button
                type="submit"
                disabled={isActionPending}
                className="w-full rounded-lg mt-6 py-3 text-lg bg-yellow-400 text-gray-900 font-bold hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isActionPending
                  ? isEditMode
                    ? "Updating Dish..."
                    : "Adding Dish..."
                  : isEditMode
                  ? "Update Dish"
                  : "Add Dish"}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AddDishModal;
