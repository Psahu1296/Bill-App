import React, { useState } from "react";
import { MdKeyboardVoice } from "react-icons/md";
import VoiceOrderModal from "./VoiceOrderModal";
import type { Dish, DishVariant } from "../../types";

interface VoiceOrderButtonProps {
  onAddToCart: (dish: Dish, variant: DishVariant, qty: number) => void;
}

const VoiceOrderButton: React.FC<VoiceOrderButtonProps> = ({ onAddToCart }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Voice Order"
        className="
          h-8 w-8 rounded-full flex items-center justify-center
          bg-gradient-to-br from-dhaba-accent/25 to-orange-500/20
          border border-dhaba-accent/35 text-dhaba-accent
          hover:from-dhaba-accent/45 hover:to-orange-500/35
          hover:shadow-[0_0_14px_rgba(var(--dhaba-accent-rgb),0.45)]
          hover:scale-110 active:scale-95
          transition-all duration-200
        "
      >
        <MdKeyboardVoice size={17} />
      </button>

      {open && (
        <VoiceOrderModal
          onAddToCart={onAddToCart}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

export default VoiceOrderButton;
