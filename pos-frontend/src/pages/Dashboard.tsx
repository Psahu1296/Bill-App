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
  useEffect(() => {
    document.title = "POS | Admin Dashboard";
  }, []);

  const [modalType, setModalType] = useState("");
  const [activeTab, setActiveTab] = useState("Metrics");

  return (
    <div className="bg-[#1f1f1f] h-[calc(100vh-5rem)]">
      <div className="container mx-auto flex items-center justify-between py-14 px-6 md:px-4">
        <div className="flex items-center gap-3">
          {buttons.map(({ label, icon, action }) => (
            <button
              key={action}
              onClick={() => setModalType(action)}
              className="bg-[#1a1a1a] hover:bg-[#262626] px-8 py-3 rounded-lg text-[#f5f5f5] font-semibold text-md flex items-center gap-2"
            >
              {label} {icon}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`px-8 py-3 rounded-lg text-[#f5f5f5] font-semibold text-md flex items-center gap-2 ${
                activeTab === tab
                  ? "bg-[#262626]"
                  : "bg-[#1a1a1a] hover:bg-[#262626]"
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

      {modalType === "table" && (
        <Modal setIsTableModalOpen={() => setModalType("")} />
      )}
      {modalType === "dishes" && (
        <AddDishModal
          isOpen={modalType === "dishes"}
          onClose={() => setModalType("")}
          onDishAdded={() => setModalType("")}
        />
      )}
      {modalType === "expenses" && (
        <AddExpenseModal
          isOpen={modalType === "expenses"}
          onClose={() => setModalType("")}
          onExpenseAdded={() => setModalType("")}
        />
      )}
    </div>
  );
};

export default Dashboard;
