import { Response, NextFunction } from "express";
import { CustomRequest as Request } from "../types";
import createHttpError from "http-errors";
import jwt from "jsonwebtoken";
import config from "../config/config";
import * as userRepo from "../repositories/userRepo";

const isVerifiedUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accessToken } = req.cookies;

    if (!accessToken) {
      return next(createHttpError(401, "Please provide token!"));
    }

    const decodeToken = jwt.verify(accessToken, config.accessTokenSecret) as jwt.JwtPayload;
    req.user = decodeToken;

    const user = userRepo.findById(decodeToken._id);
    if (!user) {
      return next(createHttpError(401, "User does not exist!"));
    }

    next();
  } catch {
    next(createHttpError(401, "Invalid Token!"));
  }
};

export { isVerifiedUser };
