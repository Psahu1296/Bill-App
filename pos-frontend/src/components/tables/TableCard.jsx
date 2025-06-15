import React from "react";
import { useNavigate } from "react-router-dom";
import { getAvatarName, getBgColor } from "../../utils";
import { useDispatch } from "react-redux";
import {
  removeCustomer,
  updateTable as tableStateUpdate,
} from "../../redux/slices/customerSlice";
import { FaLongArrowAltRight } from "react-icons/fa";
import { useMutation } from "@tanstack/react-query";
import { updateTable } from "../../https";
import { removeAllItems } from "../../redux/slices/cartSlice";

const TableCard = ({ id, name, status, initials, seats, orderId }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const handleClick = (name) => {
    if (status === "Booked") return;

    const table = { tableId: id, tableNo: name };
    dispatch(tableStateUpdate({ table }));
    navigate(`/menu`);
  };
  const onChangeStatus = (e) => {
    e.preventDefault();
    const tableData = {
      status: status === "Booked" ? "Available" : "Booked",
      orderId: status === "Booked" ? null : orderId,
      tableId: id,
    };

    tableUpdateMutation.mutate(tableData);
  };

  const tableUpdateMutation = useMutation({
    mutationFn: (reqData) => updateTable(reqData),
    onSuccess: (resData) => {
      dispatch(removeCustomer());
      dispatch(removeAllItems());
      window.location.reload()
    },
    onError: (error) => {
      console.log(error);
    },
  });

  return (
    <div
      onClick={() => handleClick(name)}
      key={id}
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
          className={`text-white rounded-full p-5 text-xl`}
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
          className="bg-[#f6b100] px-2 py-1 text-xs font-bold rounded-lg "
          onClick={onChangeStatus}
        >
          Change Status
        </button>
      </div>
    </div>
  );
};

export default TableCard;
