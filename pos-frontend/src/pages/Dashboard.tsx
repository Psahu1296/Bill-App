import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MdTableBar, MdCategory } from "react-icons/md";
import { BiSolidDish } from "react-icons/bi";
import Metrics from "../components/dashboard/Metrics";
import RecentOrders from "../components/dashboard/RecentOrders";
import AddTableModal from "../components/dashboard/AddTableModal";
import AddExpenseModal from "../components/dashboard/AddExpenseModal";
import BottomNav from "../components/shared/BottomNav";

const QUICK_ACTIONS = [
  {
    label: "Add Table",
    desc: "Create a new dining table",
    icon: <MdTableBar />,
    action: "table",
    color: "blue"
  },
  {
    label: "Add Expense",
    desc: "Log a new business expense",
    icon: <MdCategory />,
    action: "expenses",
    color: "red"
  },
  {
    label: "Manage Dishes",
    desc: "Update menu items & prices",
    icon: <BiSolidDish />,
    action: "dishes",
    color: "emerald"
  },
];

const tabs = ["Metrics", "Orders"];

const Dashboard: React.FC = () => {
  useEffect(() => { document.title = "Dhaba POS | Dashboard"; }, []);
  const navigate = useNavigate();
  const [modalType, setModalType] = useState("");
  const [activeTab, setActiveTab] = useState("Metrics");
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(currentTime);

  const handleButtonClick = (action: string) => {
    if (action === "dishes") { navigate("/dashboard/dishes"); return; }
    if (action === "expenses") { navigate("/expenses"); return; }
    setModalType(action);
  };

  const getColorClasses = (color: string) => {
    switch (color) {
      case "blue": return {
        icon: "text-dhaba-info bg-dhaba-info/10 border-dhaba-info/20 group-hover:border-dhaba-info/40",
        bg: "from-dhaba-info/5"
      };
      case "red": return {
        icon: "text-dhaba-danger bg-dhaba-danger/10 border-dhaba-danger/20 group-hover:border-dhaba-danger/40",
        bg: "from-dhaba-danger/5"
      };
      case "emerald": return {
        icon: "text-dhaba-success bg-dhaba-success/10 border-dhaba-success/20 group-hover:border-dhaba-success/40",
        bg: "from-dhaba-success/5"
      };
      default: return {
        icon: "text-dhaba-muted bg-dhaba-surface border-dhaba-border",
        bg: "from-dhaba-surface"
      };
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-dhaba-bg relative overflow-y-auto">
      {/* Ambient Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-dhaba-accent/10 rounded-full blur-[120px] z-0 pointer-events-none" />
      <div className="fixed top-[20%] right-[-10%] w-[30%] h-[30%] bg-dhaba-orange/10 rounded-full blur-[120px] z-0 pointer-events-none" />

      <div className="relative z-10 flex-1 flex flex-col pb-24 px-4 sm:px-6 md:px-8 max-w-7xl mx-auto w-full pt-8 space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-black text-transparent bg-clip-text bg-gradient-warm tracking-tight">
              Admin Dashboard
            </h1>
            <p className="text-sm text-dhaba-muted mt-1 font-medium tracking-wide">
              Manage operations and monitor real-time metrics
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-dhaba-surface/50 border border-dhaba-border/50 rounded-xl backdrop-blur-md self-start md:self-auto shadow-elevated">
            <span className="h-2 w-2 rounded-full bg-dhaba-success shadow-[0_0_8px_hsl(var(--dhaba-success)/0.8)] animate-pulse" />
            <span className="text-[11px] font-black tracking-widest uppercase text-dhaba-text/70">
              {formattedTime}
            </span>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {QUICK_ACTIONS.map(({ label, desc, icon, action, color }) => {
            const styles = getColorClasses(color);
            return (
              <button
                key={action}
                onClick={() => handleButtonClick(action)}
                className="glass-card rounded-[1.25rem] p-5 flex items-start gap-4 border border-dhaba-border/50 shadow-sm relative overflow-hidden group hover:border-dhaba-accent/50 hover:shadow-elevated transition-all text-left"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${styles.bg} to-transparent opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none`} />
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border text-xl transition-colors ${styles.icon}`}>
                  {icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-[15px] font-black text-dhaba-text tracking-wide group-hover:text-dhaba-accent transition-colors">{label}</h3>
                  <p className="text-[11px] text-dhaba-muted font-bold mt-0.5 leading-relaxed line-clamp-1">{desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Main Content Area */}
        <div className="flex flex-col gap-6">
          {/* Tabs */}
          <div className="flex items-center justify-between border-b border-dhaba-border/30 pb-4">
            <div className="flex items-center gap-2 p-1 bg-dhaba-surface/50 rounded-2xl border border-dhaba-border/50 shadow-inner">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  className={`px-8 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${activeTab === tab
                      ? "bg-dhaba-accent/10 text-dhaba-accent shadow-glow border border-dhaba-accent/30"
                      : "text-dhaba-muted hover:text-dhaba-text hover:bg-dhaba-surface border border-transparent"
                    }`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Render Active Tab */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {activeTab === "Metrics" && <Metrics />}
            {activeTab === "Orders" && <RecentOrders />}
          </div>
        </div>

      </div>

      {/* Modals */}
      {modalType === "table" && <AddTableModal setIsTableModalOpen={() => setModalType("")} />}
      {modalType === "expenses" && (
        <AddExpenseModal isOpen={modalType === "expenses"} onClose={() => setModalType("")} onExpenseAdded={() => setModalType("")} />
      )}

      {/* Bottom Navigation */}
      <div className="relative z-20">
        <BottomNav />
      </div>
    </div>
  );
};

export default Dashboard;
