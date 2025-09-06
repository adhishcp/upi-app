/**
 * Author: anoop
 * Company: www.reontel.com
 * Module: errorCodes.ts
 * Created at: 2023-11-13
 * Purpose: Provides errorCodes functionality
 */

export const ERROR_CODES = {
  ALREADY_EXIST: {
    code: 409, // HTTP code
    message: "Already exist", // message
    errorCode: "D001", // custom code
    key: "ALREADY_EXIST",
  },
  NOT_FOUND: {
    code: 404, // HTTP code
    message: "Not found", // message
    errorCode: "D001", // custom code
    key: "NOT_FOUND",
  },
  UNAUTHORIZED: {
    code: 401, // HTTP code
    message: "Unauthorized", // message
    errorCode: "D001", // custom code
    key: "UNAUTHORIZED",
  },
  INTERNAL_SERVER_ERROR: {
    code: 500, // HTTP code
    message: "Internal server error", // message
    errorCode: "D500", // custom code
    key: "INTERNAL_SERVER_ERROR",
  },
  UNIQUE_VALIDATION_FAILED: {
    code: 409, // HTTP code
    message: "Unique validation failed", // message
    errorCode: "D400", // custom code
    key: "UNIQUE_VALIDATION_FAILED",
  },
  BAD_REQUEST: {
    code: 400, // HTTP code
    message: "bad request", // message
    errorCode: "D400", // custom code
    key: "BAD_REQUEST",
  },
  FOREIGN_CONSTRAINT_FAILED: {
    code: 400, // HTTP code
    message: "foreign key constrain failed", // message
    errorCode: "D400", // custom code
    key: "FOREIGN_CONSTRAINT_FAILED",
  },
};
