import React, { useEffect } from "react";
import DishesList from "../components/dishes/Dishes";

const DishesPage: React.FC = () => {
  useEffect(() => { document.title = "Dhaba POS | Dishes"; }, []);

  return (
    <div className="bg-dhaba-bg min-h-[calc(100vh-4rem)] pb-8">
      <DishesList />
    </div>
  );
};

export default DishesPage;
