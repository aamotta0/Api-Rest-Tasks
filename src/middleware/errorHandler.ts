import { Request, Response, NextFunction } from "express";
import { getErrorMessage } from "../utils";

export default function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Si las cabeceras ya han sido enviadas, delegamos el manejo del error al siguiente middleware
  if (res.headersSent) {
    next(error);
    return;
  }
  // Enviar una respuesta de error genérica
  res.status(500).json({
    error: {
      message: getErrorMessage(error),
    },
  });
  next();
}
