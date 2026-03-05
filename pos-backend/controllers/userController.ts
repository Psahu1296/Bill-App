import { Response, NextFunction } from "express";
import { CustomRequest as Request } from "../types";
import createHttpError from "http-errors";
import User from "../models/userModel";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import config from "../config/config";

const TOKEN_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 1 day — matches JWT expiresIn

const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, phone, email, password, role } = req.body;

        if (!name || !phone || !email || !password || !role) {
            const error = createHttpError(400, "All fields are required!");
            return next(error);
        }

        const isUserPresent = await User.findOne({ email });
        if (isUserPresent) {
            const error = createHttpError(400, "User already exists!");
            return next(error);
        }

        const newUser = new User({ name, phone, email, password, role });
        await newUser.save();

        const { password: _, ...userWithoutPassword } = newUser.toObject();
        res.status(201).json({ success: true, message: "New user created!", data: userWithoutPassword });

    } catch (error) {
        next(error);
    }
}


const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            const error = createHttpError(400, "All fields are required!");
            return next(error);
        }

        const isUserPresent = await User.findOne({ email });
        if (!isUserPresent) {
            const error = createHttpError(401, "Invalid Credentials");
            return next(error);
        }

        const isMatch = await bcrypt.compare(password, isUserPresent.password);
        if (!isMatch) {
            const error = createHttpError(401, "Invalid Credentials");
            return next(error);
        }

        const accessToken = jwt.sign({ _id: isUserPresent._id }, config.accessTokenSecret, {
            expiresIn: '1d'
        });

        const isProduction = config.nodeEnv === "production";
        res.cookie('accessToken', accessToken, {
            maxAge: TOKEN_MAX_AGE_MS,
            httpOnly: true,
            sameSite: isProduction ? 'none' : 'lax',
            secure: isProduction,
        });

        const { password: _, ...userWithoutPassword } = isUserPresent.toObject();
        res.status(200).json({ success: true, message: "User login successfully!", data: userWithoutPassword });

    } catch (error) {
        next(error);
    }
}

const getUserData = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await User.findById((req.user as jwt.JwtPayload)._id).select('-password');
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
}

const logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.clearCookie('accessToken');
        res.status(200).json({ success: true, message: "User logout successfully!" });
    } catch (error) {
        next(error);
    }
}


export { register, login, getUserData, logout };
