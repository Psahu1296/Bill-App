import { Response, NextFunction } from "express";
import { CustomRequest as Request } from "../types";
import createHttpError from "http-errors";
import * as ledgerRepo from "../repositories/ledgerRepo";
import * as earningRepo from "../repositories/earningRepo";
import { getZonedStartOfDayUtc } from "./earningController";

const getCustomerLedger = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const phone = req.params.phone as string;
    if (!phone) return next(createHttpError(400, "Phone number is required."));

    const ledger = ledgerRepo.findByPhone(phone);
    if (!ledger) return next(createHttpError(404, "Customer not found in ledger!"));

    res.status(200).json({ success: true, data: ledger });
  } catch (error) {
    next(error);
  }
};

const recordCustomerPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const phone = req.params.phone as string;
    const { amountPaid, orderId, notes } = req.body;

    if (!phone || amountPaid === undefined || amountPaid <= 0) {
      return next(createHttpError(400, "Phone and valid amountPaid are required."));
    }

    const ledger = ledgerRepo.findByPhone(phone);
    if (!ledger) return next(createHttpError(404, "Customer not found in ledger to record payment!"));

    if (amountPaid > ledger.balanceDue + 0.01) {
      return next(createHttpError(400,
        `Amount exceeds outstanding balance. Max payable: ₹${ledger.balanceDue.toFixed(2)}`));
    }

    const updated = ledgerRepo.recordPayment({
      customerPhone: phone,
      amountPaid,
      orderId: orderId != null && !isNaN(Number(orderId)) ? Number(orderId) : null,
      notes: notes || `Payment received for Order #${orderId ?? "N/A"}`,
    });

    try {
      earningRepo.incrementEarnings(getZonedStartOfDayUtc(new Date()).toISOString(), amountPaid);
    } catch (e) {
      console.error("Error updating daily earnings during manual customer payment:", e);
    }

    res.status(200).json({ success: true, message: "Payment recorded successfully!", data: updated });
  } catch (error) {
    next(error);
  }
};

const addDebtToLedger = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const phone = req.params.phone as string;
    const { amountDue, orderId, customerName, notes } = req.body;

    if (!phone || amountDue === undefined || amountDue <= 0) {
      return next(createHttpError(400, "Phone and valid amountDue are required."));
    }

    const ledger = ledgerRepo.upsertWithTransaction({
      customerPhone: phone,
      customerName: customerName || phone,
      balanceDelta: amountDue,
      transaction: {
        orderId: orderId != null && !isNaN(Number(orderId)) ? Number(orderId) : null,
        transactionType: "full_payment_due",
        amount: amountDue,
        notes: notes || `Remaining balance for Order #${orderId ?? "N/A"}`,
      },
    });

    res.status(200).json({ success: true, message: "Debt added to ledger.", data: ledger });
  } catch (error) {
    next(error);
  }
};

const getAllCustomerLedgers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, phone, status, startDate, endDate } = req.query;
    const ledgers = ledgerRepo.findAll({
      name: name as string | undefined,
      phone: phone as string | undefined,
      status: status as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });
    res.status(200).json({ success: true, data: ledgers });
  } catch (error) {
    next(error);
  }
};

const createLedger = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerName, customerPhone, initialBalance = 0, notes } = req.body;
    if (!customerName || !customerPhone) {
      return next(createHttpError(400, "Customer name and phone are required."));
    }

    const existing = ledgerRepo.findByPhone(customerPhone);
    if (existing) {
      return next(createHttpError(409, `Customer with phone ${customerPhone} already exists in ledger.`));
    }

    let ledger;
    if (initialBalance > 0) {
      ledger = ledgerRepo.upsertWithTransaction({
        customerPhone,
        customerName,
        balanceDelta: initialBalance,
        transaction: {
          transactionType: "full_payment_due",
          amount: initialBalance,
          notes: notes || `Manual entry — ₹${Number(initialBalance).toFixed(2)} outstanding`,
        },
      });
    } else {
      ledger = ledgerRepo.createCustomer({ phone: customerPhone, name: customerName });
    }

    res.status(201).json({ success: true, message: "Ledger entry created.", data: ledger });
  } catch (error) {
    next(error);
  }
};

const updateLedger = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const phone = req.params.phone as string;
    const { customerName, customerPhone: newPhone } = req.body;

    if (!customerName && !newPhone) {
      return next(createHttpError(400, "Provide customerName or customerPhone to update."));
    }

    const existing = ledgerRepo.findByPhone(phone);
    if (!existing) return next(createHttpError(404, "Customer not found in ledger."));

    // If changing phone, make sure the new phone isn't already taken
    if (newPhone && newPhone !== phone) {
      const conflict = ledgerRepo.findByPhone(newPhone);
      if (conflict) return next(createHttpError(409, `Phone ${newPhone} is already used by another customer.`));
    }

    const updated = ledgerRepo.updateCustomer(phone, {
      name: customerName,
      newPhone: newPhone !== phone ? newPhone : undefined,
    });
    if (!updated) return next(createHttpError(404, "Customer not found after update."));

    res.status(200).json({ success: true, message: "Customer updated.", data: updated });
  } catch (error) {
    next(error);
  }
};

const deleteLedger = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const phone = req.params.phone as string;
    if (!phone) return next(createHttpError(400, "Phone number is required."));

    const existing = ledgerRepo.findByPhone(phone);
    if (!existing) return next(createHttpError(404, "Customer not found in ledger."));

    ledgerRepo.deleteByPhone(phone);
    res.status(200).json({ success: true, message: "Ledger entry deleted." });
  } catch (error) {
    next(error);
  }
};

export { getCustomerLedger, recordCustomerPayment, addDebtToLedger, getAllCustomerLedgers, createLedger, updateLedger, deleteLedger };
