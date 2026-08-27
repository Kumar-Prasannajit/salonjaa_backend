import { NextFunction, Request, Response } from "express";
import { AnyZodObject, ZodEffects } from "zod";

type Schema = AnyZodObject | ZodEffects<AnyZodObject>;

export interface ValidationSchemas {
  body?: Schema;
  query?: Schema;
  params?: Schema;
}

/**
 * Validates and reassigns req.body/query/params with the parsed (and type-coerced) result.
 * Thrown ZodErrors are caught by the global error handler and mapped to 400 VALIDATION_ERROR.
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.body) {
      req.body = schemas.body.parse(req.body);
    }
    if (schemas.query) {
      req.query = schemas.query.parse(req.query) as typeof req.query;
    }
    if (schemas.params) {
      req.params = schemas.params.parse(req.params) as typeof req.params;
    }
    next();
  };
}
