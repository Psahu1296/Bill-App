import { Response, NextFunction } from "express";
import createHttpError from "http-errors";
import mongoose from "mongoose";
import Staff from "../models/staffModel";
import { CustomRequest as Request } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all staff members
// @route   GET /api/staff
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getAllStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, isActive } = req.query as Record<string, string>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = {};

    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === "true";

    const staffList = await Staff.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: staffList });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Add a new staff member
// @route   POST /api/staff
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const addStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, phone, role, monthlySalary, joinDate } = req.body;

    if (!name?.trim() || !phone?.trim() || !role) {
      return next(createHttpError(400, "name, phone, and role are required."));
    }

    const member = new Staff({
      name: name.trim(),
      phone: phone.trim(),
      role,
      monthlySalary: Number(monthlySalary) || 0,
      joinDate: joinDate ?? new Date().toISOString().split("T")[0],
      isActive: true,
      payments: [],
    });

    await member.save();
    res.status(201).json({ success: true, message: "Staff member added.", data: member });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update a staff member
// @route   PUT /api/staff/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const updateStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid staff ID format."));
    }

    const { _id, __v, payments, ...updates } = req.body;

    const member = await Staff.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!member) return next(createHttpError(404, "Staff member not found."));
    res.status(200).json({ success: true, message: "Staff member updated.", data: member });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete a staff member
// @route   DELETE /api/staff/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const deleteStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid staff ID format."));
    }

    const member = await Staff.findByIdAndDelete(id);
    if (!member) return next(createHttpError(404, "Staff member not found."));
    res.status(200).json({ success: true, message: "Staff member deleted.", data: member });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Toggle staff active status
// @route   PATCH /api/staff/:id/toggle-active
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const toggleActive = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid staff ID format."));
    }

    const member = await Staff.findById(id);
    if (!member) return next(createHttpError(404, "Staff member not found."));

    member.isActive = !member.isActive;
    await member.save();
    res.status(200).json({ success: true, message: `Staff member ${member.isActive ? "activated" : "deactivated"}.`, data: member });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Add a payment to a staff member
// @route   POST /api/staff/:id/payments
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const addPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid staff ID format."));
    }

    const { amount, type, note } = req.body;
    if (!amount || !type) {
      return next(createHttpError(400, "amount and type are required."));
    }

    const member = await Staff.findById(id);
    if (!member) return next(createHttpError(404, "Staff member not found."));

    const payment = { amount: Number(amount), type, note: note || type, date: new Date() };
    member.payments.unshift(payment as never);
    await member.save();

    res.status(201).json({ success: true, message: "Payment recorded.", data: member });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete a payment from a staff member
// @route   DELETE /api/staff/:id/payments/:paymentId
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const deletePayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, paymentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(paymentId)) {
      return next(createHttpError(400, "Invalid ID format."));
    }

    const member = await Staff.findById(id);
    if (!member) return next(createHttpError(404, "Staff member not found."));

    const before = member.payments.length;
    member.payments = member.payments.filter((p: any) => p._id.toString() !== paymentId) as never;
    if (member.payments.length === before) {
      return next(createHttpError(404, "Payment not found."));
    }

    await member.save();
    res.status(200).json({ success: true, message: "Payment deleted.", data: member });
  } catch (error) {
    next(error);
  }
};

export { getAllStaff, addStaff, updateStaff, deleteStaff, toggleActive, addPayment, deletePayment };
