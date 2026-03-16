import React, { useState } from "react";
import { menus } from "../../constants";
import { useQuery } from "@tanstack/react-query";
import { getDishes } from "../../https";
import MenuItem from "./MenuItem";
import { FaSearch } from "react-icons/fa";
import type { Dish } from "../../types";

const MenuContainer: React.FC = () => {
  const [selected] = useState(menus[0]);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: dishes, isLoading } = useQuery({
    queryKey: ["dishes"],
    queryFn: getDishes,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-dhaba-muted">
        <div className="spinner mr-3" />
        Loading dishes...
      </div>
    );
  }

  const selectedDishes: Dish[] = dishes?.data?.data ?? [];
  const filteredDishes = selectedDishes.filter((dish) =>
    searchTerm === "" ? true : dish.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className="px-6 mb-4">
        <div className="glass-input rounded-xl flex items-center gap-3 px-4 py-2.5 w-full max-w-md">
          <FaSearch className="text-dhaba-muted text-sm" />
          <input
            type="text"
            placeholder="Search dishes..."
            className="bg-transparent text-dhaba-text text-sm outline-none flex-1 placeholder:text-dhaba-muted/50"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="h-px bg-dhaba-border/20 mx-6" />
      <div className="flex flex-wrap gap-3 px-6 py-4 overflow-y-auto">
        {filteredDishes.map((item) => (
          <MenuItem key={item._id} item={item} />
        ))}
      </div>
    </>
  );
};

export default MenuContainer;
