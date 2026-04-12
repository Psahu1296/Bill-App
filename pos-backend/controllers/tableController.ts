import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import createHttpError from "http-errors";
import * as tableRepo from "../repositories/tableRepo";

const addTable = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tableNo, seats } = req.body;
    if (!tableNo || !seats) {
      return next(createHttpError(400, "Please provide table number and seats!"));
    }

    if (await tableRepo.findByTableNo(Number(tableNo))) {
      return next(createHttpError(400, "Table already exist!"));
    }

    const newTable = await tableRepo.create({ tableNo: Number(tableNo), seats: Number(seats) });
    res.status(201).json({ success: true, message: "Table added!", data: newTable });
  } catch (error) {
    next(error);
  }
};

const getTables = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const tables = await tableRepo.findAll();
    res.status(200).json({ success: true, data: tables });
  } catch (error) {
    next(error);
  }
};

const updateTable = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, orderId } = req.body;
    const id = req.params.id as string;

    if (!id || !mongoose.isValidObjectId(id)) {
      return next(createHttpError(400, "Invalid table ID format!"));
    }

    const table = await tableRepo.update(id, {
      status,
      currentOrderId: orderId != null && mongoose.isValidObjectId(orderId) ? orderId : null,
    });

    if (!table) {
      return next(createHttpError(404, "Table not found!"));
    }

    res.status(200).json({ success: true, message: "Table updated!", data: table });
  } catch (error) {
    next(error);
  }
};

export { addTable, getTables, updateTable };
