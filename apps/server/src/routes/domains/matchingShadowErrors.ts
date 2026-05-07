import { logger } from "../../lib/logger";
export function classifyShadowExperimentError(error: unknown): {
  status: number;
  message: string;
} {
  const rawMessage = typeof error === "object" && error && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : "";
  const normalizedMessage = rawMessage.toLowerCase();

  if (normalizedMessage.includes("活动池不存在") || normalizedMessage.includes("pool not found")) {
    return {
      status: 404,
      message: "Pool not found",
    };
  }

  if (normalizedMessage.includes("报名人数不足") || normalizedMessage.includes("insufficient")) {
    return {
      status: 400,
      message: "Insufficient pending registrations for matching shadow experiment request",
    };
  }

  return {
    status: 500,
    message: "Failed to run matching shadow experiment",
  };
}
