import { HttpException, HttpStatus } from '@nestjs/common';

export interface ErrorResponse {
  success: false;
  message: string;
  errorCode?: string | number;
  details?: any;
  timestamp: string;
}

export function createErrorData(
  error: any,
  status: number = HttpStatus.INTERNAL_SERVER_ERROR,
  errorCode?: string | number,
): ErrorResponse {
  // Handle known NestJS HttpException
  if (error instanceof HttpException) {
    const response = error.getResponse();
    return {
      success: false,
      message:
        typeof response === 'string'
          ? response
          : (response as any).message || error.message,
      errorCode,
      details: (response as any).details || null,
      timestamp: new Date().toISOString(),
    };
  }

  // Handle generic errors
  return {
    success: false,
    message: error?.message || 'Unexpected error occurred',
    errorCode,
    details: process.env.NODE_ENV === 'development' ? error : undefined, // hide stack trace in prod
    timestamp: new Date().toISOString(),
  };
}
