import React, { useState } from "react";
import { FaSearch, FaUserCircle, FaCoffee, FaUsers, FaDatabase, FaSyncAlt } from "react-icons/fa";
import { MdSystemUpdateAlt } from "react-icons/md";
import logo from "../../assets/images/logo.png";
import { useSelector } from "react-redux";
import { IoLogOut } from "react-icons/io5";
import { useMutation } from "@tanstack/react-query";
import { logout } from "../../https";
import { removeUser } from "../../redux/slices/userSlice";
import { useNavigate } from "react-router-dom";
import { MdDashboard } from "react-icons/md";
import { useAppDispatch } from "../../redux/hooks";
import type { RootState } from "../../redux/store";

const Header: React.FC = () => {
  const userData = useSelector((state: RootState) => state.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => window.location.reload(), 400);
  };

  const logoutMutation = useMutation({
    mutationFn: () => logout(),
    onSuccess: () => {
      dispatch(removeUser());
      navigate("/auth");
    },
    onError: (error: unknown) => {
      console.log(error);
    },
  });

  return (
    <header className="glass sticky top-0 z-40 flex justify-between items-center py-3 px-8 border-b border-dhaba-border/30">
      <div
        onClick={() => navigate("/")}
        className="flex items-center gap-3 cursor-pointer group"
      >
        <div className="relative">
          <img src={logo} className="h-10 w-10 rounded-xl" alt="dhaba logo" />
          <div className="absolute -inset-1 bg-dhaba-accent/20 rounded-xl blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-dhaba-text tracking-wide">
            Dhaba<span className="text-dhaba-accent">POS</span>
          </h1>
          <p className="text-[10px] text-dhaba-muted font-medium tracking-widest uppercase">
            Point of Sale
          </p>
        </div>
      </div>

      {/* <div className="glass-input flex items-center gap-3 rounded-2xl px-5 py-2.5 w-[420px]">
        <FaSearch className="text-dhaba-muted text-sm" />
        <input
          type="text"
          placeholder="Search orders, dishes, tables..."
          className="bg-transparent outline-none text-dhaba-text text-sm font-medium placeholder:text-dhaba-muted/60 flex-1"
        />
      </div> */}

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/app-update")}
          className="glass-card rounded-xl p-2.5 hover:bg-dhaba-surface-hover transition-all duration-200 group relative"
          title="App Update"
        >
          <MdSystemUpdateAlt className="text-dhaba-muted text-xl group-hover:text-dhaba-accent transition-colors" />
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-dhaba-success border-2 border-dhaba-surface" />
        </button>
        <button
          onClick={() => navigate("/consumables")}
          className="glass-card rounded-xl p-2.5 hover:bg-dhaba-surface-hover transition-all duration-200 group"
          title="Tea / Gutka / Cigarette Tracker"
        >
          <FaCoffee className="text-dhaba-muted text-xl group-hover:text-dhaba-accent transition-colors" />
        </button>
        {userData.role === "Admin" && (
          <button
            onClick={() => navigate("/dashboard")}
            className="glass-card rounded-xl p-2.5 hover:bg-dhaba-surface-hover transition-all duration-200 group"
            title="Dashboard"
          >
            <MdDashboard className="text-dhaba-muted text-xl group-hover:text-dhaba-accent transition-colors" />
          </button>
        )}
        {userData.role === "Admin" && (
          <button
            onClick={() => navigate("/data-management")}
            className="glass-card rounded-xl p-2.5 hover:bg-dhaba-surface-hover transition-all duration-200 group"
            title="Data Management"
          >
            <FaDatabase className="text-dhaba-muted text-xl group-hover:text-dhaba-accent transition-colors" />
          </button>
        )}
        <button
          onClick={() => navigate("/staff")}
          className="glass-card rounded-xl p-2.5 hover:bg-dhaba-surface-hover transition-all relative group"
          title="Staff Management"
        >
          <FaUsers className="text-dhaba-muted text-xl group-hover:text-dhaba-accent transition-colors" />
        </button>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="glass-card rounded-xl p-2.5 hover:bg-dhaba-surface-hover transition-all duration-200 group"
          title="Refresh page"
        >
          <FaSyncAlt className={`text-dhaba-muted text-xl group-hover:text-dhaba-accent transition-colors ${refreshing ? "animate-spin text-dhaba-accent" : ""}`} />
        </button>

        <div className="h-8 w-px bg-dhaba-border/40 mx-1" />

        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-xl bg-gradient-warm flex items-center justify-center text-sm font-bold text-dhaba-bg">
              {userData.name?.charAt(0) || "U"}
            </div>
          </div>
          <div className="flex flex-col items-start">
            <h1 className="text-sm text-dhaba-text font-semibold tracking-wide">
              {userData.name || "TEST USER"}
            </h1>
            <p className="text-[10px] text-dhaba-accent font-bold tracking-wider uppercase">
              {userData.role || "Role"}
            </p>
          </div>
          <button
            onClick={() => logoutMutation.mutate()}
            className="ml-2 p-2 rounded-xl hover:bg-dhaba-danger/10 transition-colors group"
          >
            <IoLogOut className="text-dhaba-muted text-xl group-hover:text-dhaba-danger transition-colors" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
