"use client";

import type { AuthResponse, Election, ElectionResults, PendingVerificationResponse, User } from "./types";

const TOKEN_STORAGE_KEY = "dva-token";

export type ApiErrorDetails = {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
};

export class ApiError extends Error {
  details?: ApiErrorDetails;

  constructor(message: string, details?: ApiErrorDetails) {
    super(message);
    this.name = "ApiError";
    this.details = details;
  }
}

function getApiBaseUrl() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (!apiBaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_API_BASE_URL");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(apiBaseUrl);
  } catch {
    throw new Error("Invalid NEXT_PUBLIC_API_BASE_URL");
  }

  const normalizedPathname = parsedUrl.pathname.replace(/\/+$/, "");

  if (!normalizedPathname || normalizedPathname === "/") {
    parsedUrl.pathname = "/api";
  } else if (!normalizedPathname.endsWith("/api")) {
    parsedUrl.pathname = `${normalizedPathname}/api`;
  } else {
    parsedUrl.pathname = normalizedPathname;
  }

  return parsedUrl.toString().replace(/\/+$/, "");
}

export function getAuthToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setAuthToken(token: string) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }
}

export function clearAuthToken() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getAuthToken();

  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(payload.message || "Request failed", payload.details);
  }

  return payload as T;
}

export const api = {
  signup: (body: Record<string, unknown>) =>
    request<AuthResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  me: async () => {
    const response = await request<{ user: User }>("/auth/me");
    return response.user;
  },
  submitWallet: async (walletAddress: string) => {
    const response = await request<{ user: User; message: string }>("/users/me/wallet", {
      method: "POST",
      body: JSON.stringify({ walletAddress }),
    });
    return response;
  },
  getPendingVerifications: () => request<PendingVerificationResponse>("/admin/verifications"),
  verifyUser: (userId: string) =>
    request<{ user: User; transactionHash: string }>(`/admin/verifications/${userId}`, {
      method: "POST",
    }),
  verifyAll: (role?: "student" | "teacher") =>
    request<{ verifiedCount: number; transactionHashes: string[] }>("/admin/verifications/bulk", {
      method: "POST",
      body: JSON.stringify(role ? { role } : {}),
    }),
  createElection: (body: {
    title: string;
    description: string;
    eligibleVoters: "students" | "teachers" | "both";
    candidateNames: string[];
    startTime: string;
    endTime: string;
  }) =>
    request<{ electionId: number | null; transactionHash: string }>("/elections", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deactivateElection: (electionId: number) =>
    request<{ electionId: number; transactionHash: string; message: string }>(`/elections/${electionId}/deactivate`, {
      method: "PATCH",
    }),
  getElectionResults: (electionId: number) => request<ElectionResults>(`/elections/${electionId}/results`),
  listElections: async () => {
    const response = await request<{ elections: Election[]; message?: string }>("/elections");
    return response;
  },
};
