import { Response, NextFunction } from "express";
import { CustomRequest as Request } from "../types";
import createHttpError from "http-errors";
import * as userRepo from "../repositories/userRepo";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import config from "../config/config";

const TOKEN_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 1 day

// Roles that can be picked on the public /register endpoint.
// "Admin" is deliberately excluded — admin accounts are provisioned directly
// in the database, never through self-registration.
const SELF_REGISTER_ROLES = ["Waiter", "Cashier"] as const;

const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, phone, email, password, role } = req.body;

    if (!name || !phone || !email || !password || !role) {
      return next(createHttpError(400, "All fields are required!"));
    }

    const requestedRole = String(role).trim();
    const allowedRole = SELF_REGISTER_ROLES.find(
      (r) => r.toLowerCase() === requestedRole.toLowerCase()
    );
    if (!allowedRole) {
      return next(
        createHttpError(403, `Role not allowed. Choose one of: ${SELF_REGISTER_ROLES.join(", ")}.`)
      );
    }

    if (await userRepo.findByEmail(email)) {
      return next(createHttpError(400, "User already exists!"));
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await userRepo.create({ name, phone, email, password: hashed, role: allowedRole });

    const { password: _, ...userWithoutPassword } = user as Record<string, unknown>;
    res.status(201).json({ success: true, message: "New user created!", data: userWithoutPassword });
  } catch (error) {
    next(error);
  }
};

const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(createHttpError(400, "All fields are required!"));
    }

    const user = await userRepo.findByEmail(email);
    if (!user) {
      return next(createHttpError(401, "Invalid Credentials"));
    }

    const isMatch = await bcrypt.compare(password, user.password as string);
    if (!isMatch) {
      return next(createHttpError(401, "Invalid Credentials"));
    }

    const accessToken = jwt.sign({ _id: user._id }, config.accessTokenSecret, { expiresIn: "1d" });

    const isProduction = config.nodeEnv === "production";
    res.cookie("accessToken", accessToken, {
      maxAge: TOKEN_MAX_AGE_MS,
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
    });

    const { password: _, ...userWithoutPassword } = user as Record<string, unknown>;
    res.status(200).json({ success: true, message: "User login successfully!", data: userWithoutPassword });
  } catch (error) {
    next(error);
  }
};

const getUserData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await userRepo.findByIdWithoutPassword((req.user as jwt.JwtPayload)._id);
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

const logout = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.clearCookie("accessToken");
    res.status(200).json({ success: true, message: "User logout successfully!" });
  } catch (error) {
    next(error);
  }
};

export { register, login, getUserData, logout };
