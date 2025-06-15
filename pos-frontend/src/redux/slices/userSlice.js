import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    _id: "Abcdsips",
    name: "Pushpendra Sahu",
    email : "pushpendra.sahu112@gmail.com",
    phone: "9755670878",
    role: "admin",
    isAuth: true
}

const userSlice = createSlice({
    name: "user",
    initialState,
    reducers: {
        setUser: (state, action) => {
            const { _id, name, phone, email, role  } = action.payload;
            state._id = _id;
            state.name = name;
            state.phone = phone;
            state.email = email;
            state.role = role;
            state.isAuth = true;
        },

        removeUser: (state) => {
            state._id = "";
            state.email = "";
            state.name = "";
            state.phone = "";
            state.role = "";
            state.isAuth = false;
        }
    }
})

export const { setUser, removeUser } = userSlice.actions;
export default userSlice.reducer;