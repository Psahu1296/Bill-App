import React, { createContext, useCallback, useContext, useReducer, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { useAppDispatch } from "../redux/hooks";
import { updateList } from "../redux/slices/cartSlice";
import { setCustomer, updateTable } from "../redux/slices/customerSlice";
import { addOrder } from "../https";
import type { AddOrderPayload, CartItem } from "../types";

export type PendingStatus = "submitting" | "saved" | "failed";

export interface PendingOrder {
  localId: string;
  payload: AddOrderPayload;
  tableNo: string | number | undefined;
  total: number;
  status: PendingStatus;
  retries: number;
}

type Action =
  | { type: "ADD"; order: PendingOrder }
  | { type: "SET_STATUS"; localId: string; status: PendingStatus }
  | { type: "INC_RETRIES"; localId: string }
  | { type: "REMOVE"; localId: string };

function reducer(state: PendingOrder[], action: Action): PendingOrder[] {
  switch (action.type) {
    case "ADD":        return [...state, action.order];
    case "SET_STATUS": return state.map(o => o.localId === action.localId ? { ...o, status: action.status } : o);
    case "INC_RETRIES":return state.map(o => o.localId === action.localId ? { ...o, retries: o.retries + 1, status: "submitting" } : o);
    case "REMOVE":     return state.filter(o => o.localId !== action.localId);
    default:           return state;
  }
}

interface PendingOrdersCtx {
  orders: PendingOrder[];
  submit: (payload: AddOrderPayload, tableNo: string | number | undefined, total: number) => void;
  retry: (localId: string) => void;
  restoreAndEdit: (localId: string) => void;
  dismiss: (localId: string) => void;
}

const Ctx = createContext<PendingOrdersCtx | null>(null);

// 3 auto-retries (attempts 1, 2, 3) with exponential backoff, then manual retry
// Manual retry: if it also fails → restore cart and navigate to /menu
const MAX_AUTO_RETRIES = 3;

export function PendingOrdersProvider({ children }: { children: React.ReactNode }) {
  const [orders, dispatch] = useReducer(reducer, []);
  const queryClient = useQueryClient();
  const reduxDispatch = useAppDispatch();
  const navigate = useNavigate();

  // Stable ref so async retry callbacks always see latest state
  const ordersRef = useRef(orders);
  ordersRef.current = orders;

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["tables"] });
    queryClient.invalidateQueries({ queryKey: ["earnings"] });
    queryClient.invalidateQueries({ queryKey: ["dashboardEarnings"] });
  }, [queryClient]);

  const restoreAndEdit = useCallback((localId: string) => {
    const order = ordersRef.current.find(o => o.localId === localId);
    if (!order) return;
    dispatch({ type: "REMOVE", localId });

    reduxDispatch(updateList(order.payload.items as CartItem[]));

    if (order.payload.customerDetails) {
      reduxDispatch(setCustomer({
        name:   order.payload.customerDetails.name   ?? "",
        phone:  order.payload.customerDetails.phone  ?? "",
        guests: order.payload.customerDetails.guests ?? 1,
      }));
    }

    if (order.payload.table && order.tableNo != null) {
      reduxDispatch(updateTable({
        table: {
          tableId: order.payload.table as string,
          tableNo: order.tableNo,
        },
      }));
    }

    navigate("/menu");
    enqueueSnackbar("Order couldn't be saved — cart restored.", { variant: "error" });
  }, [navigate, reduxDispatch]);

  // isLastChance = true means: if this attempt also fails, restore cart instead of queuing another retry
  const fire = useCallback(async (
    localId: string,
    payload: AddOrderPayload,
    attempt: number,
    isLastChance = false,
  ) => {
    try {
      await addOrder(payload);
      dispatch({ type: "SET_STATUS", localId, status: "saved" });
      invalidate();
      setTimeout(() => dispatch({ type: "REMOVE", localId }), 3000);
    } catch {
      if (isLastChance) {
        restoreAndEdit(localId);
      } else if (attempt < MAX_AUTO_RETRIES) {
        dispatch({ type: "INC_RETRIES", localId });
        // Exponential backoff: 2s → 4s → 6s
        setTimeout(() => fire(localId, payload, attempt + 1), 2000 * (attempt + 1));
      } else {
        dispatch({ type: "SET_STATUS", localId, status: "failed" });
      }
    }
  }, [invalidate, restoreAndEdit]);

  const submit = useCallback((
    payload: AddOrderPayload,
    tableNo: string | number | undefined,
    total: number,
  ) => {
    const localId = crypto.randomUUID();
    dispatch({
      type: "ADD",
      order: { localId, payload, tableNo, total, status: "submitting", retries: 0 },
    });
    fire(localId, payload, 0);
  }, [fire]);

  // Manual retry after auto-retries exhausted.
  // isLastChance=true: one more shot, then restore+navigate on failure.
  const retry = useCallback((localId: string) => {
    const order = ordersRef.current.find(o => o.localId === localId);
    if (!order || order.status !== "failed") return;
    dispatch({ type: "SET_STATUS", localId, status: "submitting" });
    fire(localId, order.payload, MAX_AUTO_RETRIES, true);
  }, [fire]);

  const dismiss = useCallback((localId: string) => {
    dispatch({ type: "REMOVE", localId });
  }, []);

  return (
    <Ctx.Provider value={{ orders, submit, retry, restoreAndEdit, dismiss }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePendingOrders() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePendingOrders must be inside PendingOrdersProvider");
  return ctx;
}
