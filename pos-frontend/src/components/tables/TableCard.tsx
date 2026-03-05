import React from "react";
import { useNavigate } from "react-router-dom";
import { getAvatarName, getBgColor } from "../../utils";
import { removeCustomer, updateTable as tableStateUpdate } from "../../redux/slices/customerSlice";
import { FaLongArrowAltRight } from "react-icons/fa";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateTable } from "../../https";
import { removeAllItems } from "../../redux/slices/cartSlice";
import { useAppDispatch } from "../../redux/hooks";

interface TableCardProps {
  id: string;
  name: number | string;
  status: "Available" | "Booked";
  initials?: string;
  seats: number;
  orderId?: string;
}

const TableCard: React.FC<TableCardProps> = ({
  id,
  name,
  status,
  initials,
  seats,
  orderId,
}) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleClick = () => {
    if (status === "Booked") return;
    const table = { tableId: id, tableNo: name };
    dispatch(tableStateUpdate({ table }));
    navigate("/menu");
  };

  const onChangeStatus = (e: React.MouseEvent) => {
    e.preventDefault();
    const tableData = {
      status: status === "Booked" ? "Available" : "Booked",
      orderId: status === "Booked" ? null : (orderId ?? null),
      tableId: id,
    };
    tableUpdateMutation.mutate(tableData);
  };

  const tableUpdateMutation = useMutation({
    mutationFn: (reqData: { tableId: string; status: string; orderId: string | null }) =>
      updateTable(reqData),
    onSuccess: () => {
      dispatch(removeCustomer());
      dispatch(removeAllItems());
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error: unknown) => {
      console.log(error);
    },
  });

  return (
    <div
      onClick={handleClick}
      className="w-[300px] h-fit hover:bg-[#2c2c2c] bg-[#262626] p-4 rounded-lg cursor-pointer"
    >
      <div className="flex items-center justify-between px-1">
        <h1 className="text-[#f5f5f5] text-xl font-semibold">
          Table <FaLongArrowAltRight className="text-[#ababab] ml-2 inline" />{" "}
          {name}
        </h1>
        <p
          className={`${
            status === "Booked"
              ? "text-green-600 bg-[#2e4a40]"
              : "bg-[#664a04] text-white"
          } px-2 py-1 rounded-lg`}
        >
          {status}
        </p>
      </div>
      <div className="flex items-center justify-center mt-5 mb-8">
        <h1
          className="text-white rounded-full p-5 text-xl"
          style={{ backgroundColor: initials ? getBgColor() : "#1f1f1f" }}
        >
          {getAvatarName(initials) || "N/A"}
        </h1>
      </div>
      <div className="flex justify-between">
        <p className="text-[#ababab] text-xs">
          Seats: <span className="text-[#f5f5f5]">{seats}</span>
        </p>
        <button
          className="bg-[#f6b100] px-2 py-1 text-xs font-bold rounded-lg"
          onClick={onChangeStatus}
        >
          Change Status
        </button>
      </div>
    </div>
  );
};

export default TableCard;
