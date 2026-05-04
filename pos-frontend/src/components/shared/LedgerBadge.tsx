import React from 'react';
import { FaWallet } from 'react-icons/fa';

const LedgerBadge: React.FC = () => {
  return (
    <span className="flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider border bg-orange-500/10 text-orange-400 border-orange-500/20 flex-shrink-0">
      <FaWallet className="text-[8px]" /> Ledger
    </span>
  );
};

export default LedgerBadge;
