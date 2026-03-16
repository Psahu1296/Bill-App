import { Request } from "express";
import { JwtPayload } from "jsonwebtoken";

export interface CustomRequest extends Request {
  user?: JwtPayload | string | Record<string, unknown>;
}

export interface IQueryOptions {
  date?: string;
  paymentStatus?: string;
  orderStatus?: string;
  role?: string;
  customerPhone?: string;
  expenseDate?: {
    $gte?: Date;
    $lte?: Date;
  };
  type?: string;
  orderDate?: {
    $gte?: Date;
    $lte?: Date;
  };
  table?: string;
  "customerDetails.phone"?: string;
  customerName?: {
    $regex: string;
    $options: string;
  };
  balanceDue?: number | { $gt: number };
  consumableType?: string;
  consumerType?: string;
  timestamp?: {
    $gte?: Date;
    $lte?: Date;
  };
}

export interface IUpdateOrderPayload {
  orderStatus?: string;
  paymentStatus?: string;
  [key: string]: any; // Allow other standard mongoose fields
}
