import { ApiError } from "@/models/errors";

export function wrap_errors(func: any) {
  try {
    return func();
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(`Internal server error: ${error.message}`);
  }
}