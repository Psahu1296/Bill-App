import { createSlice } from "@reduxjs/toolkit";

const initialState = [];

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addItems: (state, action) => {
      const {
        id,
        quantity: quantityChange,
        name,
        pricePerQuantity,
      } = action.payload;

      const existingItem = state.find((item) => item.id === id);

      if (existingItem) {
        // Item already exists, update its quantity
        existingItem.quantity += quantityChange;
        existingItem.price =
          existingItem.quantity * existingItem.pricePerQuantity;

        // If quantity drops to 0 or less, remove the item
        if (existingItem.quantity <= 0) {
          // Immer allows us to return a new array directly to remove the item
          return state.filter((item) => item.id !== id);
        }
      } else {
        // Item does not exist, add it only if the quantity change is positive
        if (quantityChange > 0) {
          state.push({
            id,
            name,
            pricePerQuantity,
            quantity: quantityChange,
            price: quantityChange * pricePerQuantity,
          });
        }
        // If quantityChange is 0 or negative for a non-existent item, do nothing.
      }
    },
    updateList: (state, action) => {
      return action.payload;
    },
    updateItem: (state, action) => {
      const { id, quantity: quantityChange } = action.payload; // Renamed for clarity: it's a change

      const existingItem = state.find((item) => item.id === id);
      const num = existingItem.quantity + quantityChange
      if (existingItem && num > 0) {
        existingItem.quantity += quantityChange;
        existingItem.price =
          existingItem.quantity * existingItem.pricePerQuantity;
      }
    },

    removeItem: (state, action) => {
      return state.filter((item) => item.id != action.payload);
    },

    removeAllItems: (state) => {
      return [];
    },
  },
});

export const getTotalPrice = (state) =>
  state.cart.reduce((total, item) => total + item.price, 0);
export const { addItems, removeItem, removeAllItems, updateList, updateItem } =
  cartSlice.actions;
export default cartSlice.reducer;
