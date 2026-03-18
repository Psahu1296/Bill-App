import React, { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteDish, getDishes, seedDefaultDishes } from "../../https";
import { enqueueSnackbar } from "notistack";
import DishCard from "./DishesCard";
import AddDishModal from "../dashboard/AddDishModal";
import BulkAddDishModal from "./BulkAddDishModal";
import { FaSearch, FaCloudUploadAlt, FaPlus, FaUtensils } from "react-icons/fa";
import type { Dish } from "../../types";

const DishesList: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isUpdateId, setIsUpdateId] = useState<string | null>(null);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const seedMutation = useMutation({
    mutationFn: seedDefaultDishes,
    onSuccess: () => {
      enqueueSnackbar("Default menu loaded!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["dishes"] });
      queryClient.invalidateQueries({ queryKey: ["popularDishes"] });
    },
    onError: () => {
      enqueueSnackbar("Failed to load default menu.", { variant: "error" });
    },
  });

  const { data: dishes, isLoading, isError, error } = useQuery({
    queryKey: ["dishes"],
    queryFn: getDishes,
  });

  const { mutate: deleteDishMutation } = useMutation({
    mutationFn: (id: string) => deleteDish(id),
    onSuccess: (data) => {
      enqueueSnackbar((data.data as { message?: string })?.message || "Dish deleted!", { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["dishes"] });
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      enqueueSnackbar(error.response?.data?.message || "Failed to delete dish.", { variant: "error" });
    },
  });

  const dishList: Dish[] = dishes?.data?.data ?? [];

  const filteredDishes = useMemo(() => {
    if (!dishList.length) return [];
    if (searchTerm === "") return dishList;
    return dishList.filter((dish) => dish.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [dishList, searchTerm]);

  const handleDeleteDish = (dishId: string) => {
    if (window.confirm("Are you sure you want to delete this dish?")) deleteDishMutation(dishId);
  };

  const handleUpdateDish = (dishOrId: Dish | string) => {
    const dish = typeof dishOrId === "object" ? dishOrId : dishList.find((d) => d._id === dishOrId);
    if (dish) { setIsUpdateId(dish._id); setSelectedDish(dish); }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-dhaba-muted">
        <div className="spinner mr-3" />Loading dishes...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center p-8 text-dhaba-danger">
        <p>Error loading dishes: {(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col px-6 pb-4 pt-0 h-full max-h-[calc(100vh-16rem)] overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-dhaba-text">Dishes</h1>
          <p className="text-sm text-dhaba-muted mt-0.5">{dishList.length} items in menu</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="glass-input rounded-xl flex items-center gap-3 px-4 py-2.5 w-80">
            <FaSearch className="text-dhaba-muted text-sm" />
            <input
              type="text"
              placeholder="Search dishes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent text-dhaba-text text-sm outline-none flex-1 placeholder:text-dhaba-muted/50"
            />
          </div>
          <button
            onClick={() => setIsBulkOpen(true)}
            className="glass-card flex items-center gap-2 px-5 py-2.5 rounded-xl text-dhaba-accent font-bold text-sm hover:bg-dhaba-accent/10 transition-all border border-dhaba-accent/20"
          >
            <FaCloudUploadAlt /> Bulk Add
          </button>
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-warm text-dhaba-bg font-bold text-sm hover:shadow-glow transition-all"
          >
            <FaPlus /> Add Dish
          </button>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto pr-2">
        {dishList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-dhaba-accent/10 flex items-center justify-center">
              <FaUtensils className="text-dhaba-accent text-2xl" />
            </div>
            <div>
              <p className="text-dhaba-text font-semibold">Menu is empty</p>
              <p className="text-dhaba-muted text-sm mt-1">Load the default menu or add dishes manually.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                className="px-6 py-2.5 rounded-2xl bg-gradient-warm text-dhaba-bg font-bold text-sm hover:shadow-glow transition-all disabled:opacity-50"
              >
                {seedMutation.isPending ? "Loading..." : "Load Default Menu"}
              </button>
              <button
                onClick={() => setIsAddOpen(true)}
                className="px-6 py-2.5 rounded-2xl glass-card text-dhaba-text font-semibold text-sm hover:bg-dhaba-surface-hover transition-all"
              >
                Add Manually
              </button>
            </div>
          </div>
        ) : filteredDishes.length === 0 ? (
          <p className="text-center text-dhaba-muted py-12">No dishes found matching your search.</p>
        ) : (
          <div className="flex flex-wrap gap-5">
            {filteredDishes.map((dish) => (
              <DishCard key={dish._id} dish={dish} onEdit={handleUpdateDish} onDelete={handleDeleteDish} />
            ))}
          </div>
        )}
      </div>

      {isAddOpen && (
        <AddDishModal
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          onDishAdded={() => setIsAddOpen(false)}
        />
      )}

      {isUpdateId && (
        <AddDishModal
          isOpen={!!isUpdateId}
          onClose={() => setIsUpdateId(null)}
          onDishAdded={() => setIsUpdateId(null)}
          dish={selectedDish}
        />
      )}

      <BulkAddDishModal
        isOpen={isBulkOpen}
        onClose={() => setIsBulkOpen(false)}
      />
    </div>
  );
};

export default DishesList;
