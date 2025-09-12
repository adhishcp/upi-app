export const AUTH_ERROR_CODES = {
  EMAIL_ALREADY_EXISTS: {
    code: 409, // Conflict
    message: 'Email Already Exists',
    errorCode: 'D001',
    key: 'EMAIL_ALREADY_EXISTS',
  },
  VPA_ALREADY_EXISTS: {
    code: 409, // Conflict
    message: 'VPA Already Exists',
    errorCode: 'D002',
    key: 'VPA_ALREADY_EXISTS',
  },
  MOBILE_ALREADY_EXISTS: {
    code: 409, // Conflict
    message: 'Mobile Number Already Exists',
    errorCode: 'D003',
    key: 'MOBILE_ALREADY_EXISTS',
  },
};
