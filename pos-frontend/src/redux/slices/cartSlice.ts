import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { CartItem } from "../../types";
import type { RootState } from "../store";

type CartState = CartItem[];

const initialState: CartState = [];

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addItems: (
      state,
      action: PayloadAction<{
        id: string;
        quantity: number;
        name: string;
        pricePerQuantity: number;
        markedPricePerQuantity?: number;
        variantSize?: string;
        price?: number;
      }>
    ) => {
      const { id, quantity: quantityChange, name, pricePerQuantity, markedPricePerQuantity } = action.payload;
      const existingItem = state.find((item) => item.id === id);

      if (existingItem) {
        existingItem.quantity += quantityChange;
        existingItem.price = existingItem.quantity * existingItem.pricePerQuantity;
        if (existingItem.quantity <= 0) {
          return state.filter((item) => item.id !== id);
        }
      } else {
        if (quantityChange > 0) {
          state.push({
            id,
            name,
            pricePerQuantity,
            ...(markedPricePerQuantity != null && markedPricePerQuantity > pricePerQuantity
              ? { markedPricePerQuantity }
              : {}),
            quantity: quantityChange,
            price: quantityChange * pricePerQuantity,
          });
        }
      }
    },

    updateList: (_state, action: PayloadAction<CartItem[]>) => {
      return action.payload;
    },

    updateItem: (
      state,
      action: PayloadAction<{ id: string; quantity: number }>
    ) => {
      const { id, quantity: quantityChange } = action.payload;
      const index = state.findIndex((item) => item.id === id);
      if (index === -1) return;
      const newQty = state[index].quantity + quantityChange;
      if (newQty <= 0) {
        state.splice(index, 1);
      } else {
        state[index].quantity = newQty;
        state[index].price = newQty * state[index].pricePerQuantity;
      }
    },

    removeItem: (state, action: PayloadAction<string>) => {
      return state.filter((item) => item.id !== action.payload);
    },

    removeAllItems: () => {
      return [];
    },
  },
});

export const getTotalPrice = (state: RootState): number =>
  state.cart.reduce((total, item) => total + item.price, 0);

export const { addItems, removeItem, removeAllItems, updateList, updateItem } =
  cartSlice.actions;

export default cartSlice.reducer;
