/**
 * Author: Alan
 * Company: www.reontel.com
 * Module: response builder.ts
 * Created at: 2023-12-11
 * Purpose: Provides response builder functionality
 */

import { Prisma } from "@prisma/client";
import { CustomErrorInterface, ErrorGenerator } from "./error-generator";
import { HttpException } from "@nestjs/common";
import { ERROR_CODES } from "../contants/errorCodes";

export type TCustomError = {
  ALREADY_EXIST: CustomErrorInterface;
  NOT_FOUND: CustomErrorInterface;
  FOREIGN_CONSTRAINT_FAILED: CustomErrorInterface;
};

export function createErrorData<T = any, D = any>(
  cause:
    | ErrorGenerator
    | Prisma.PrismaClientKnownRequestError
    | Prisma.PrismaClientUnknownRequestError
    | Prisma.PrismaClientRustPanicError
    | Prisma.PrismaClientInitializationError
    | Prisma.PrismaClientValidationError
    | Error,
  module?: string,
  customError: typeof ERROR_CODES | TCustomError = ERROR_CODES
): {
  data: T;
  error: CustomErrorInterface;
  cause: any;
} {
  console.log("Error Response Builder : ", cause);
  if (cause instanceof Prisma.PrismaClientKnownRequestError) {
    if (cause.code === "P2002") {
      // const startIndex = cause?.meta?.target?.indexOf('(');
      // const endIndex = cause?.meta?.target?.indexOf(':');
      // const field = cause?.meta?.target?.substring(startIndex, endIndex);
      return {
        data: null,
        error: {
          ...customError.ALREADY_EXIST,
          errorType: "Prisma Error",
          message: `Unique validation failed ${cause?.meta?.target}`,
          field: cause?.meta?.target,
          module,
        },
        cause: cause,
      };
    } else if (cause.code === "P2015") {
      return {
        data: null,
        error: {
          ...customError.NOT_FOUND,
          errorType: "Prisma Error",
          module,
        },
        cause: cause,
      };
    } else if (cause.code === "P2003") {
      return {
        data: null,
        error: {
          ...customError.FOREIGN_CONSTRAINT_FAILED,
          errorType: "Prisma Error",
          field: cause?.meta?.field_name,
          module,
        },
        cause: cause,
      };
    } else if (cause.code === "P2025") {
      return {
        data: null,
        error: {
          ...customError.NOT_FOUND,
          errorType: "Prisma Error",
          field: cause?.meta?.field_name,
          module,
        },
        cause: cause,
      };
    } else {
      return {
        data: null,
        error: {
          ...ERROR_CODES.INTERNAL_SERVER_ERROR,
          errorType: "Prisma Error",
          module,
        },
        cause: cause,
      };
    }
  }
  if (
    cause instanceof Prisma.PrismaClientUnknownRequestError ||
    cause instanceof Prisma.PrismaClientRustPanicError ||
    cause instanceof Prisma.PrismaClientInitializationError ||
    cause instanceof Prisma.PrismaClientValidationError
  ) {
    return {
      data: null,
      error: {
        ...ERROR_CODES.INTERNAL_SERVER_ERROR,
        errorType: "Prisma Error",
        module,
      },
      cause: cause,
    };
  } else if (cause instanceof ErrorGenerator) {
    return {
      data: null,
      error: {
        ...cause.error,
        module,
      },
      cause: cause,
    };
  } else {
    return {
      data: null,
      error: {
        ...ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: cause.message,
        errorType: "Unknown Error",
        module,
      },
      cause: cause,
    };
  }
}

export function createResponseData<T>(data: T): {
  data: T;
  error: CustomErrorInterface;
  cause: any;
} {
  return {
    data,
    error: null,
    cause: null,
  };
}

export function responseBuilder({
  cause,
  data,
  error,
}: {
  data: any;
  error: any;
  cause: any;
}) {
  return {
    data,
    error,
    success: true,
  };
}

export function errorResponseBuilder({
  cause,
  data,
  error,
}: {
  data: any;
  error: CustomErrorInterface;
  cause: any;
}) {
  console.log(data, error, cause);

  throw new HttpException({ error, data, success: false }, error.code, {
    cause,
  });
}
