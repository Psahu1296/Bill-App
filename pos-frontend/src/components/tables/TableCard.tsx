import React from "react";
import { useNavigate } from "react-router-dom";
import { getAvatarName, getBgColor } from "../../utils";
import { removeCustomer, updateTable as tableStateUpdate } from "../../redux/slices/customerSlice";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateTable } from "../../https";
import { removeAllItems } from "../../redux/slices/cartSlice";
import { useAppDispatch } from "../../redux/hooks";
import { MdChair } from "react-icons/md";

interface TableCardProps {
  id: string;
  name: number | string;
  status: "Available" | "Booked";
  initials?: string;
  seats: number;
  orderId?: string;
}

const TableCard: React.FC<TableCardProps> = ({ id, name, status, initials, seats, orderId }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isBooked = status === "Booked";

  const handleClick = () => {
    if (isBooked) return;
    dispatch(tableStateUpdate({ table: { tableId: id, tableNo: name } }));
    navigate("/menu");
  };

  const onChangeStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    tableUpdateMutation.mutate({ tableId: id, status: isBooked ? "Available" : "Booked", orderId: isBooked ? null : (orderId ?? null) });
  };

  const tableUpdateMutation = useMutation({
    mutationFn: (reqData: { tableId: string; status: string; orderId: string | null }) => updateTable(reqData),
    onSuccess: () => {
      dispatch(removeCustomer());
      dispatch(removeAllItems());
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  return (
    <div
      onClick={handleClick}
      className={`glass-card rounded-2xl p-5 transition-all duration-300 ${
        !isBooked ? "cursor-pointer hover:shadow-glow hover:-translate-y-1" : "cursor-default"
      }`}
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display text-lg font-bold text-dhaba-text">
          Table {name}
        </h3>
        <span className={`status-chip ${
          isBooked ? "bg-dhaba-success/15 text-dhaba-success" : "bg-dhaba-accent/15 text-dhaba-accent"
        }`}>
          {status}
        </span>
      </div>

      <div className="flex items-center justify-center py-4">
        <div
          className="h-16 w-16 rounded-2xl flex items-center justify-center text-lg font-bold text-white transition-transform hover:scale-105"
          style={{ backgroundColor: initials ? getBgColor() : "hsl(var(--dhaba-surface))" }}
        >
          {getAvatarName(initials) || "—"}
        </div>
      </div>

      <div className="flex justify-between items-center mt-4 pt-3 border-t border-dhaba-border/20">
        <div className="flex items-center gap-2 text-dhaba-muted text-sm">
          <MdChair className="text-dhaba-accent" />
          <span>{seats} seats</span>
        </div>
        <button
          className="text-xs font-bold px-3 py-1.5 rounded-xl bg-dhaba-accent/10 text-dhaba-accent hover:bg-dhaba-accent/20 transition-colors"
          onClick={onChangeStatus}
        >
          {isBooked ? "Free Up" : "Reserve"}
        </button>
      </div>
    </div>
  );
};

export default TableCard;
