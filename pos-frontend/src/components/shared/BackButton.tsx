import React from "react";
import { IoArrowBackOutline } from "react-icons/io5";
import { useNavigate } from "react-router-dom";

const BackButton: React.FC = () => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(-1)}
      className="glass-card p-2.5 rounded-xl text-dhaba-muted hover:text-dhaba-accent hover:shadow-glow transition-all duration-200"
    >
      <IoArrowBackOutline size={20} />
    </button>
  );
};

export default BackButton;
