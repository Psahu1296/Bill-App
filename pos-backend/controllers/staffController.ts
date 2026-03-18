import { Response, NextFunction } from "express";
import createHttpError from "http-errors";
import * as staffRepo from "../repositories/staffRepo";
import { CustomRequest as Request } from "../types";

const getAllStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, isActive } = req.query as Record<string, string>;
    const filters: { role?: string; isActive?: boolean } = {};
    if (role) filters.role = role;
    if (isActive !== undefined) filters.isActive = isActive === "true";
    res.status(200).json({ success: true, data: staffRepo.findAll(filters) });
  } catch (error) {
    next(error);
  }
};

const addStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, phone, role, monthlySalary, joinDate } = req.body;
    if (!name?.trim() || !phone?.trim() || !role) {
      return next(createHttpError(400, "name, phone, and role are required."));
    }
    const member = staffRepo.create({
      name: name.trim(), phone: phone.trim(), role,
      monthlySalary: Number(monthlySalary) || 0,
      joinDate: joinDate ?? new Date().toISOString().split("T")[0],
    });
    res.status(201).json({ success: true, message: "Staff member added.", data: member });
  } catch (error) {
    next(error);
  }
};

const updateStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id || isNaN(Number(id))) {
      return next(createHttpError(400, "Invalid staff ID format."));
    }
    const { _id, __v, payments, ...updates } = req.body;
    const member = staffRepo.update(id, updates);
    if (!member) return next(createHttpError(404, "Staff member not found."));
    res.status(200).json({ success: true, message: "Staff member updated.", data: member });
  } catch (error) {
    next(error);
  }
};

const deleteStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id || isNaN(Number(id))) {
      return next(createHttpError(400, "Invalid staff ID format."));
    }
    const member = staffRepo.remove(id);
    if (!member) return next(createHttpError(404, "Staff member not found."));
    res.status(200).json({ success: true, message: "Staff member deleted.", data: member });
  } catch (error) {
    next(error);
  }
};

const toggleActive = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id || isNaN(Number(id))) {
      return next(createHttpError(400, "Invalid staff ID format."));
    }
    const member = staffRepo.toggleActive(id);
    if (!member) return next(createHttpError(404, "Staff member not found."));
    const status = (member as Record<string, unknown>).isActive ? "activated" : "deactivated";
    res.status(200).json({ success: true, message: `Staff member ${status}.`, data: member });
  } catch (error) {
    next(error);
  }
};

const addPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id || isNaN(Number(id))) {
      return next(createHttpError(400, "Invalid staff ID format."));
    }
    const { amount, type, note } = req.body;
    if (!amount || !type) {
      return next(createHttpError(400, "amount and type are required."));
    }
    const member = staffRepo.findById(id);
    if (!member) return next(createHttpError(404, "Staff member not found."));
    const updated = staffRepo.addPayment(id, { amount: Number(amount), type, note });
    res.status(201).json({ success: true, message: "Payment recorded.", data: updated });
  } catch (error) {
    next(error);
  }
};

const deletePayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const paymentId = req.params.paymentId as string;
    if (!id || isNaN(Number(id)) || !paymentId || isNaN(Number(paymentId))) {
      return next(createHttpError(400, "Invalid ID format."));
    }
    const member = staffRepo.deletePayment(id, paymentId);
    if (!member) return next(createHttpError(404, "Staff member or payment not found."));
    res.status(200).json({ success: true, message: "Payment deleted.", data: member });
  } catch (error) {
    next(error);
  }
};

export { getAllStaff, addStaff, updateStaff, deleteStaff, toggleActive, addPayment, deletePayment };
