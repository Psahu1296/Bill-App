import mongoose from "mongoose";

const tableSchema = new mongoose.Schema({
    tableNo: { type: Number, required: true, unique: true },
    status: {
        type: String,
        enum: ["Available", "Booked"],
        default: "Available"
    },
    seats: { 
        type: Number,
        required: true
    },
    currentOrder: {type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null}
});

export default mongoose.model("Table", tableSchema);