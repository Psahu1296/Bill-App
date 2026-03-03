import { Response, NextFunction } from "express";
import { CustomRequest as Request } from "../types";
import createHttpError from "http-errors";
import jwt from "jsonwebtoken";
import config from "../config/config";
import User from "../models/userModel";


const isVerifiedUser = async (req: Request, res: Response, next: NextFunction) => {
    try{

        const { accessToken } = req.cookies;
        
        if(!accessToken){
            const error = createHttpError(401, "Please provide token!");
            return next(error);
        }

        const decodeToken = jwt.verify(accessToken, process.env.JWT_SECRET as string) as jwt.JwtPayload;
        
        req.user = decodeToken;
        const user = await User.findById(decodeToken._id);
        if(!user){
            const error = createHttpError(401, "User not exist!");
            return next(error);
        }

        next();

    }catch (error) {
        const err = createHttpError(401, "Invalid Token!");
        next(err);
    }
}

export {  isVerifiedUser  };