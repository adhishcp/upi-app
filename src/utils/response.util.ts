export interface SuccessResponse<T = any> {
  success: true;
  message: string;
  data?: T;
  timestamp: string;
}

export interface ErrorResponse {
  success: false;
  message: string;
  errorCode?: string | number;
  details?: any;
  timestamp: string;
}

/**
 * Success response creator
 */
export function createSuccessData<T>(
  data?: T,
  message: string = 'Request successful',
): SuccessResponse<T> {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Error response creator
 */
export function createErrorData(
  error: any,
  errorCode?: string | number,
): ErrorResponse {
  return {
    success: false,
    message: error?.message || 'Unexpected error occurred',
    errorCode,
    details: process.env.NODE_ENV === 'development' ? error : undefined,
    timestamp: new Date().toISOString(),
  };
}
