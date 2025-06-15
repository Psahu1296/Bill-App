// components/AddDishModal.jsx
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoMdClose } from 'react-icons/io';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { useForm, useFieldArray } from 'react-hook-form'; // Import useFieldArray
import { addDish, updateDish } from '../../https'; // Ensure updateDish is imported

// Define your constants for dish types and categories
const DISH_TYPES = [
  'starter',
  'main_course',
  'dessert',
  'beverage',
  'bread',
  'soup',
  'salad',
];

const DISH_CATEGORIES = [
  'veg',
  'non_veg',
  'egg',
];

// Define common sizes for variants (from dish model enum)
const DISH_VARIANT_SIZES = ["Half", "Full", "Regular", "Small", "Large"];

// This is the structure the form will handle (matches backend schema for Dish input)
// (Conceptual in JS, but good for understanding)
// {
//   image: string;
//   name: string;
//   type: string;
//   category: string;
//   variants: Array<{ size: string; price: number; }>; // Array of variant objects
//   description?: string;
//   isAvailable: boolean;
//   isFrequent: boolean;
// }

const AddDishModal = ({ isOpen, onClose, onDishAdded, dish = null }) => {
  const queryClient = useQueryClient();

  const isEditMode = !!dish;
  const modalTitle = isEditMode ? "Edit Dish" : "Add New Dish";
  const submitButtonText = isEditMode ? "Update Dish" : "Add Dish";

  const {
    register,
    handleSubmit,
    reset,
    control, // Needed for useFieldArray
    formState: { errors, isSubmitting: isFormSubmitting },
    watch, // Optional: to watch variants changes for debugging or conditional rendering
  } = useForm({
    defaultValues: {
      image: '',
      name: '',
      type: 'main_course',
      category: 'veg',
      variants: [{ size: '', price: '' }], // Initialize with one empty variant row
      description: '',
      isAvailable: true,
      isFrequent: false,
    },
  });

  // Setup useFieldArray for managing the 'variants' array
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'variants', // The name of the array field in your form data
  });

  // TanStack Query mutations
  const addDishMutation = useMutation({
    mutationFn: (dishData) => addDish(dishData),
    onSuccess: (res) => {
      enqueueSnackbar(res.message || "Dish added successfully!", { variant: "success" });
      queryClient.invalidateQueries(['dishes']);
      reset(); // Resets form, including variants, to defaultValues
      onClose();
      onDishAdded && onDishAdded();
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.message || "Failed to add dish. Please try again.";
      enqueueSnackbar(errorMessage, { variant: "error" });
      console.error("Add Dish Error:", error);
    },
  });

  const updateDishMutation = useMutation({
    mutationFn: ({ id, updates }) => updateDish(id, updates),
    onSuccess: (data) => {
      enqueueSnackbar(data.message || "Dish updated successfully!", { variant: "success" });
      queryClient.invalidateQueries(['dishes']);
      onClose();
      onDishAdded && onDishAdded();
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.message || "Failed to update dish.";
      enqueueSnackbar(errorMessage, { variant: "error" });
      console.error("Update Dish Error:", error);
    },
  });

  // Handle form submission
  const onSubmit = (data) => {
    // Convert variant prices to numbers if they are still strings
    const dishDataWithParsedPrices = {
        ...data,
        variants: data.variants.map(v => ({
            ...v,
            price: parseFloat(v.price) // Ensure price is a number
        }))
    };

    if (isEditMode) {
      updateDishMutation({ id: dish._id, updates: dishDataWithParsedPrices });
    } else {
      addDishMutation.mutate(dishDataWithParsedPrices);
    }
  };

  // Effect to prefill form for edit mode or reset for add mode
  useEffect(() => {
    if (isOpen) {
      if (isEditMode && dish) {
        reset({
          image: dish.image || '',
          name: dish.name || '',
          type: dish.type || 'main_course',
          category: dish.category || 'veg',
          variants: dish.variants && dish.variants.length > 0 ?
                      dish.variants.map(v => ({ // Map existing variants
                          size: v.size || '',
                          price: v.price || 0 // Ensure price is treated as a number
                      })) : [{ size: '', price: '' }], // Fallback to one empty variant if none exist
          description: dish.description || '',
          isAvailable: dish.isAvailable !== undefined ? dish.isAvailable : true,
          isFrequent: dish.isFrequent !== undefined ? dish.isFrequent : false,
        });
      } else {
        reset(); // Reset to default values for add mode
      }
    }
  }, [isOpen, dish, isEditMode, reset]);

  const isActionPending = isFormSubmitting || addDishMutation.isPending || updateDishMutation.isPending;

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
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[#f5f5f5] text-xl font-semibold">{modalTitle}</h2>
              <button
                onClick={onClose}
                className="text-[#f5f5f5] hover:text-red-500 transition-colors"
              >
                <IoMdClose size={24} />
              </button>
            </div>

            {/* Modal Body - Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
              {/* Dish Name */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-[#ababab] mb-1 text-sm font-medium"
                >
                  Dish Name
                </label>
                <input
                  type="text"
                  id="name"
                  {...register("name", { required: "Dish name is required" })}
                  className="w-full rounded-lg p-3 px-4 bg-[#1f1f1f] text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
                {errors.name && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Image URL */}
              <div>
                <label
                  htmlFor="image"
                  className="block text-[#ababab] mb-1 text-sm font-medium"
                >
                  Image URL
                </label>
                <input
                  type="url"
                  id="image"
                  {...register("image", {
                    required: "Image URL is required",
                    pattern: {
                      value:
                        /^https?:\/\/.+\.(png|jpg|jpeg|gif|svg|webp|avif)$/i,
                      message:
                        "Must be a valid image URL (png, jpg, jpeg, gif, svg, webp, avif)",
                    },
                  })}
                  className="w-full rounded-lg p-3 px-4 bg-[#1f1f1f] text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
                {errors.image && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.image.message}
                  </p>
                )}
              </div>

              {/* Type (Select) */}
              <div>
                <label
                  htmlFor="type"
                  className="block text-[#ababab] mb-1 text-sm font-medium"
                >
                  Dish Type
                </label>
                <select
                  id="type"
                  {...register("type", { required: "Dish type is required" })}
                  className="w-full rounded-lg p-3 px-4 bg-[#1f1f1f] text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 appearance-none pr-8"
                >
                  <option value="" disabled>
                    Select a type
                  </option>
                  {DISH_TYPES.map((type) => (
                    <option
                      key={type}
                      value={type}
                      className="bg-[#262626] text-white"
                    >
                      {type
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (char) => char.toUpperCase())}
                    </option>
                  ))}
                </select>
                {errors.type && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.type.message}
                  </p>
                )}
              </div>

              {/* Category (Select) */}
              <div>
                <label
                  htmlFor="category"
                  className="block text-[#ababab] mb-1 text-sm font-medium"
                >
                  Category
                </label>
                <select
                  id="category"
                  {...register("category", {
                    required: "Category is required",
                  })}
                  className="w-full rounded-lg p-3 px-4 bg-[#1f1f1f] text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 appearance-none pr-8"
                >
                  <option value="" disabled>
                    Select a category
                  </option>
                  {DISH_CATEGORIES.map((category) => (
                    <option
                      key={category}
                      value={category}
                      className="bg-[#262626] text-white"
                    >
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </option>
                  ))}
                </select>
                {errors.category && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.category.message}
                  </p>
                )}
              </div>

              {/* Variants Section (NEW) */}
              <div className="border border-[#333] rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">Dish Variants</h3>
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-center space-x-2 mb-3">
                    {/* Size Select */}
                    <div className="flex-grow">
                      <label htmlFor={`variants.${index}.size`} className="sr-only">Variant Size</label>
                      <select
                        id={`variants.${index}.size`}
                        {...register(`variants.${index}.size`, {
                          required: 'Size is required',
                          validate: (value) => {
                            // Ensure no duplicate sizes within the same dish
                            const currentVariants = watch('variants');
                            const sizeCount = currentVariants.filter(v => v.size === value).length;
                            return sizeCount <= 1 || 'Duplicate size not allowed';
                          }
                        })}
                        className="w-full p-2 rounded bg-[#333] border border-[#555] text-[#f5f5f5] focus:outline-none focus:ring-2 focus:ring-yellow-400 appearance-none"
                      >
                        <option value="" disabled>Select Size</option>
                        {DISH_VARIANT_SIZES.map((size) => (
                          <option key={size} value={size} className="bg-[#262626] text-white">{size}</option>
                        ))}
                      </select>
                      {errors.variants?.[index]?.size && (
                        <p className="text-red-400 text-xs mt-1">{errors.variants[index].size.message}</p>
                      )}
                    </div>

                    {/* Price Input */}
                    <div className="w-1/3">
                      <label htmlFor={`variants.${index}.price`} className="sr-only">Variant Price</label>
                      <input
                        type="number"
                        id={`variants.${index}.price`}
                        step="0.01"
                        {...register(`variants.${index}.price`, {
                          required: 'Price is required',
                          min: { value: 0, message: 'Price cannot be negative' },
                          valueAsNumber: true,
                        })}
                        className="w-full p-2 rounded bg-[#333] border border-[#555] text-[#f5f5f5] focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        placeholder="Price"
                      />
                      {errors.variants?.[index]?.price && (
                        <p className="text-red-400 text-xs mt-1">{errors.variants[index].price.message}</p>
                      )}
                    </div>

                    {/* Remove Button */}
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-red-400 hover:text-red-500 p-2 rounded-full"
                    >
                      <IoMdClose size={20} />
                    </button>
                  </div>
                ))}
                {errors.variants && errors.variants.root && (
                  <p className="text-red-400 text-xs mt-1">{errors.variants.root.message}</p>
                )}
                <button
                  type="button"
                  onClick={() => append({ size: '', price: '' })}
                  className="mt-2 text-blue-400 hover:text-blue-500 font-medium text-sm"
                >
                  + Add Another Variant
                </button>
              </div>
              {/* End Variants Section */}

              {/* Description (Optional) */}
              <div>
                <label
                  htmlFor="description"
                  className="block text-[#ababab] mb-1 text-sm font-medium"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  rows="3"
                  {...register("description")}
                  className="w-full rounded-lg p-3 px-4 bg-[#1f1f1f] text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-y"
                ></textarea>
              </div>

              {/* isAvailable Checkbox */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isAvailable"
                  {...register("isAvailable")}
                  className="h-4 w-4 text-yellow-400 rounded border-gray-600 focus:ring-yellow-500 bg-[#1f1f1f]"
                />
                <label
                  htmlFor="isAvailable"
                  className="ml-2 block text-sm text-[#f5f5f5]"
                >
                  Available for Order
                </label>
              </div>

              {/* isFrequent Checkbox */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isFrequent"
                  {...register("isFrequent")}
                  className="h-4 w-4 text-yellow-400 rounded border-gray-600 focus:ring-yellow-500 bg-[#1f1f1f]"
                />
                <label
                  htmlFor="isFrequent"
                  className="ml-2 block text-sm text-[#f5f5f5]"
                >
                  Frequently Ordered (e.g., Tea/Coffee)
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isActionPending}
                className="w-full rounded-lg mt-6 py-3 text-lg bg-yellow-400 text-gray-900 font-bold hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isActionPending ? (isEditMode ? "Updating Dish..." : "Adding Dish...") : submitButtonText}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AddDishModal;