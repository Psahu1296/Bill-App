import React, { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteDish, getDishes } from "../../https";
import { enqueueSnackbar } from "notistack";
import DishCard from "./DishesCard";
import AddDishModal from "../dashboard/AddDishModal";
import type { Dish } from "../../types";

const DishesList: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isUpdateId, setIsUpdateId] = useState<string | null>(null);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);

  const {
    data: dishes,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["dishes"],
    queryFn: getDishes,
  });

  const { mutate: deleteDishMutation } = useMutation({
    mutationFn: (id: string) => deleteDish(id),
    onSuccess: (data) => {
      enqueueSnackbar(
        (data.data as { message?: string })?.message || "Dish deleted!",
        { variant: "success" }
      );
      queryClient.invalidateQueries({ queryKey: ["dishes"] });
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      enqueueSnackbar(
        error.response?.data?.message || "Failed to delete dish.",
        { variant: "error" }
      );
    },
  });

  const dishList: Dish[] = dishes?.data?.data ?? [];

  const filteredDishes = useMemo(() => {
    if (!dishList.length) return [];
    if (searchTerm === "") return dishList;
    return dishList.filter((dish) =>
      dish.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [dishList, searchTerm]);

  const handleDeleteDish = (dishId: string) => {
    if (window.confirm("Are you sure you want to delete this dish?")) {
      deleteDishMutation(dishId);
    }
  };

  const handleUpdateDish = (dishOrId: Dish | string) => {
    const dish =
      typeof dishOrId === "object"
        ? dishOrId
        : dishList.find((d) => d._id === dishOrId);
    if (dish) {
      setIsUpdateId(dish._id);
      setSelectedDish(dish);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center p-8 text-gray-300">
        <p>Loading dishes...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center p-8 text-red-400">
        <p>Error loading dishes: {(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col px-12 pb-4 pt-0 h-full max-h-[calc(100vh-16rem)] overflow-hidden">
      <h1 className="text-3xl font-bold text-[#f5f5f5] mb-6">Dishes</h1>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search dishes by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 rounded-lg bg-[#1f1f1f] border border-[#333] text-[#f5f5f5] focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
      </div>

      <div className="flex-grow overflow-y-auto pr-2">
        {filteredDishes.length === 0 ? (
          <p className="text-center text-gray-400">
            No dishes found matching your search.
          </p>
        ) : (
          <div className="flex flex-wrap gap-6">
            {filteredDishes.map((dish) => (
              <DishCard
                key={dish._id}
                dish={dish}
                onEdit={handleUpdateDish}
                onDelete={handleDeleteDish}
              />
            ))}
          </div>
        )}
      </div>

      {isUpdateId && (
        <AddDishModal
          isOpen={!!isUpdateId}
          onClose={() => setIsUpdateId(null)}
          onDishAdded={() => setIsUpdateId(null)}
          dish={selectedDish}
        />
      )}
    </div>
  );
};

export default DishesList;
