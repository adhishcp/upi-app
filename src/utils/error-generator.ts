export interface CustomErrorInterface {
  code: number; // HTTP code
  message?: string; // message
  errorCode?: string; // custom code
  key?: string;
  errorType?: string;
  module?: string;
  screen?: string;
  field?: any;
}

export class ErrorGenerator extends Error {
  error: CustomErrorInterface;
  cause: any;
  constructor(error: CustomErrorInterface, cause: any = null) {
    super(error.message);
    this.error = error;
    this.cause = cause;
  }
}