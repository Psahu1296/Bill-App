// components/dishes/DishesList.jsx
import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { deleteDish, getDishes, updateDish } from "../../https"; // Adjust import path for your API functions
import DishCard from "./DishesCard";
import AddDishModal from "../dashboard/AddDishModal";

const DishesList = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isUpdateId, setIsUpdateId] = useState(null);
  const [selectedDish, setSelectedDish] = useState(null);

  // Fetch all dishes using TanStack Query
  const {
    data: dishes,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["dishes"], // Unique key for this query
    queryFn: getDishes, // The function that fetches the data
  });

  const {
    mutate: deleteDishMutation,
    isPending: isDeleting,
    data: deletedDishData,
    error: deleteError,
  } = useMutation({
    mutationFn: (id) => deleteDish(id),
    onSuccess: (data) => {
      enqueueSnackbar(data.message || "Dish deleted successfully!", {
        variant: "success",
      });
      queryClient.invalidateQueries(["dishes"]);
    },
    onError: (error) => {
      const errorMessage =
        error.response?.data?.message || "Failed to delete dish.";
      enqueueSnackbar(errorMessage, { variant: "error" });
      console.error("Delete Dish Error:", error);
    },
  });

  //   Filter dishes based on search term
  const filteredDishes = useMemo(() => {
    if (!dishes?.data.data.length) return [];
    if (searchTerm === "") return dishes?.data.data;
    // return dishes?.data.data.filter(dish =>
    //   dish.name.toLowerCase().includes(searchTerm.toLowerCase())
    // );
  }, [dishes, searchTerm]);

  const handleDeleteDish = (dishId) => {
    if (window.confirm("Are you sure you want to delete this dish?")) {
      deleteDishMutation(dishId); // Call the delete mutation
    }
  };

  const handleUpdateDish = (dishId) => {
    setIsUpdateId(dishId);
    setSelectedDish(dishes?.data.data.find((d) => d._id === dishId));
  };

  if (isLoading) {
    return (
      <div className="text-center p-8 text-gray-300">
        <p>Loading dishes...</p>
        {/* You can add a spinner here */}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center p-8 text-red-400">
        <p>Error loading dishes: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col px-12 pb-4 pt-0 h-full max-h-[calc(100vh-16rem)] overflow-hidden">
      <h1 className="text-3xl font-bold text-[#f5f5f5] mb-6">Dishes</h1>

      {/* Search Bar */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search dishes by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 rounded-lg bg-[#1f1f1f] border border-[#333] text-[#f5f5f5] focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
      </div>

      {/* Dishes List Container */}
      <div className="flex-grow overflow-y-auto pr-2">
        {filteredDishes?.length === 0 ? (
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
