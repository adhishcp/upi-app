export const BANK_ACCOUNT_ERRORS = {
  ACCOUNT_NOT_FOUND: {
    code: 400, // HTTP code
    message: 'bank account not found', // message
    errorCode: 'D001', // custom code
    key: 'ACCOUNT_NOT_FOUND',
  },
  CANT_DELETE_ACCOUNT_WITH_POSITIVE_ACC_BAL: {
    code: 400,
    message: 'Cannot delete account with positive balance',
    errorCode: 'D002',
    key: 'CANT_DELETE_ACCOUNT_WITH_POSITIVE_ACC_BAL',
  },
  TRANSACTION_ALREADY_PROCESSING: {
    code: 400,
    message: 'Transaction already processing',
    errorCode: 'D003',
    key: 'TRANSACTION_ALREADY_PROCESSING',
  },
};
