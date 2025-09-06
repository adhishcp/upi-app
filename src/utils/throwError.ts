
import { CustomErrorInterface, ErrorGenerator } from "./error-generator";
import { errorResponseBuilder } from "./response.builder";

export const throwError = (error: CustomErrorInterface): void => {
  const errorGen = new ErrorGenerator(error);
  errorResponseBuilder({
    data: null,
    error: error,
    cause: errorGen
  });
};
