import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import createHttpError from "http-errors";
import * as presetRepo from "../repositories/expensePresetRepo";
import { CustomRequest as Request } from "../types";

const getPresets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const presets = await presetRepo.findAll();
    res.status(200).json({ success: true, data: presets });
  } catch (error) {
    next(error);
  }
};

const createPreset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, category, type, isStaffLinked } = req.body;
    if (!name || !category || !type) {
      return next(createHttpError(400, "name, category, and type are required."));
    }
    const preset = await presetRepo.create({ name: name.trim(), category, type, isStaffLinked: !!isStaffLinked });
    res.status(201).json({ success: true, message: "Preset created!", data: preset });
  } catch (error) {
    next(error);
  }
};

const updatePreset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!mongoose.isValidObjectId(id)) return next(createHttpError(400, "Invalid preset ID."));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, __v, ...updates } = req.body;
    const preset = await presetRepo.update(id, updates);
    if (!preset) return next(createHttpError(404, "Preset not found."));
    res.status(200).json({ success: true, message: "Preset updated!", data: preset });
  } catch (error) {
    next(error);
  }
};

const deletePreset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!mongoose.isValidObjectId(id)) return next(createHttpError(400, "Invalid preset ID."));
    const preset = await presetRepo.remove(id);
    if (!preset) return next(createHttpError(404, "Preset not found."));
    res.status(200).json({ success: true, message: "Preset removed!", data: preset });
  } catch (error) {
    next(error);
  }
};

const recordPresetPrice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { amount } = req.body;
    if (!mongoose.isValidObjectId(id)) return next(createHttpError(400, "Invalid preset ID."));
    if (amount === undefined || amount === null || Number(amount) < 0) {
      return next(createHttpError(400, "A valid amount is required."));
    }
    const preset = await presetRepo.updatePriceHistory(id, Number(amount));
    if (!preset) return next(createHttpError(404, "Preset not found."));
    res.status(200).json({ success: true, data: preset });
  } catch (error) {
    next(error);
  }
};

const updatePresetPieceMap = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!mongoose.isValidObjectId(id)) return next(createHttpError(400, "Invalid preset ID."));
    const { variantPieceMap } = req.body;
    // null = remove mapping, object = set mapping
    const preset = await presetRepo.updateVariantPieceMap(id, variantPieceMap ?? null);
    if (!preset) return next(createHttpError(404, "Preset not found."));
    res.status(200).json({ success: true, data: preset });
  } catch (error) {
    next(error);
  }
};

export { getPresets, createPreset, updatePreset, deletePreset, recordPresetPrice, updatePresetPieceMap };
