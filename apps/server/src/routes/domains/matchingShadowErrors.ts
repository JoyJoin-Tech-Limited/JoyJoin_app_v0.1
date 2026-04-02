export function classifyShadowExperimentError(error: unknown): {
  status: number;
  message: string;
} {
  const message = typeof error === "object" && error && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : "";

  if (message.includes("活动池不存在") || message.toLowerCase().includes("pool not found")) {
    return {
      status: 404,
      message: "Pool not found",
    };
  }

  if (message.includes("报名人数不足") || message.toLowerCase().includes("insufficient")) {
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
