import React, { useState, useEffect } from "react";
import { MdTableBar, MdCategory } from "react-icons/md";
import { BiSolidDish } from "react-icons/bi";
import Metrics from "../components/dashboard/Metrics";
import RecentOrders from "../components/dashboard/RecentOrders";
import Modal from "../components/dashboard/Modal";
import AddDishModal from "../components/dashboard/AddDishModal";
import DishesList from "../components/dishes/Dishes";
import AddExpenseModal from "../components/dashboard/AddExpenseModal";

const buttons = [
  { label: "Add Table", icon: <MdTableBar />, action: "table" },
  { label: "Add Expense", icon: <MdCategory />, action: "expenses" },
  { label: "Add Dishes", icon: <BiSolidDish />, action: "dishes" },
];

const tabs = ["Metrics", "Orders", "Dishes"];

const Dashboard: React.FC = () => {
  useEffect(() => { document.title = "Dhaba POS | Dashboard"; }, []);
  const [modalType, setModalType] = useState("");
  const [activeTab, setActiveTab] = useState("Metrics");

  return (
    <div className="bg-dhaba-bg min-h-[calc(100vh-4rem)] pb-8">
      <div className="container mx-auto flex items-center justify-between py-8 px-6">
        <div className="flex items-center gap-3">
          {buttons.map(({ label, icon, action }) => (
            <button
              key={action}
              onClick={() => setModalType(action)}
              className="glass-card hover:shadow-glow px-6 py-3 rounded-2xl text-dhaba-text font-semibold text-sm flex items-center gap-2 transition-all duration-200 hover:-translate-y-0.5"
            >
              {label}
              <span className="text-dhaba-accent">{icon}</span>
            </button>
          ))}
        </div>

        <div className="glass-card rounded-2xl p-1 flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === tab
                  ? "bg-dhaba-accent/15 text-dhaba-accent shadow-glow"
                  : "text-dhaba-muted hover:text-dhaba-text hover:bg-dhaba-surface-hover"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "Metrics" && <Metrics />}
      {activeTab === "Orders" && <RecentOrders />}
      {activeTab === "Dishes" && <DishesList />}

      {modalType === "table" && <Modal setIsTableModalOpen={() => setModalType("")} />}
      {modalType === "dishes" && (
        <AddDishModal isOpen={modalType === "dishes"} onClose={() => setModalType("")} onDishAdded={() => setModalType("")} />
      )}
      {modalType === "expenses" && (
        <AddExpenseModal isOpen={modalType === "expenses"} onClose={() => setModalType("")} onExpenseAdded={() => setModalType("")} />
      )}
    </div>
  );
};

export default Dashboard;
