import React, { useState } from "react";
import { useSelector } from "react-redux";
import { formatDate, getAvatarName } from "../../utils";
import type { RootState } from "../../redux/store";

const CustomerInfo: React.FC = () => {
  const [dateTime] = useState(new Date());
  const customerData = useSelector((state: RootState) => state.customer);

  return (
    <div className="flex items-center justify-between px-4 py-4">
      <div className="flex flex-col items-start">
        <h3 className="text-sm text-dhaba-text font-semibold">
          {customerData.customerName || "Customer Name"}
        </h3>
        <p className="text-[10px] text-dhaba-muted mt-0.5">
          #{customerData.orderId || "N/A"} · Dine in
        </p>
        <p className="text-[10px] text-dhaba-muted mt-1">
          {formatDate(dateTime)}
        </p>
      </div>
      <div className="h-10 w-10 rounded-xl bg-gradient-warm flex items-center justify-center text-sm font-bold text-dhaba-bg">
        {getAvatarName(customerData.customerName) || "CN"}
      </div>
    </div>
  );
};

export default CustomerInfo;
