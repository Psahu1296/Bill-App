import React from "react";
import { motion } from "framer-motion";
import { IoMdClose } from "react-icons/io";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="glass-card rounded-3xl shadow-elevated w-full max-w-lg mx-4"
      >
        <div className="flex justify-between items-center px-6 py-5 border-b border-dhaba-border/30">
          <h2 className="font-display text-xl font-bold text-dhaba-text">{title}</h2>
          <button
            className="text-dhaba-muted hover:text-dhaba-danger p-1.5 rounded-xl hover:bg-dhaba-danger/10 transition-all"
            onClick={onClose}
          >
            <IoMdClose size={20} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </div>
  );
};

export default Modal;
