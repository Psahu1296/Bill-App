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
      <div className="text-center p-8 text-gray-300">
        <p>Loading dishes...</p>
      </div>
    );
  }

  const selectedDishes: Dish[] = dishes?.data?.data ?? [];
  const filteredDishes = selectedDishes.filter((dish) =>
    searchTerm === ""
      ? true
      : dish.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className="flex items-center gap-2 bg-[#1f1f1f] rounded-[15px] mx-8 px-4 py-2 w-[500px] border border-[#2a2a2a] focus-within:border-[#F6B100]">
        <FaSearch className="text-[#f5f5f5]" />
        <input
          type="text"
          placeholder="Search"
          className="bg-[#1f1f1f] text-[#f5f5f5] outline-none focus:outline-none flex-1"
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <hr className="border-[#2a2a2a] border-t-2 mt-4" />
      <div className="flex flex-wrap gap-4 px-4 py-4 w-full overflow-y-auto justify-center flex-[3]">
        {filteredDishes.map((item) => (
          <MenuItem key={item._id} item={item} />
        ))}
      </div>
    </>
  );
};

export default MenuContainer;
