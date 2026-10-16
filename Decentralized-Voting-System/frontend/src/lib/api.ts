"use client";

import { getConfiguredApiBaseUrl, getStoredAppNetwork } from "./network";
import type {
  AuthResponse,
  Election,
  ElectionResults,
  NetworkStatusResponse,
  PendingVerificationResponse,
  User,
} from "./types";

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

function normalizeApiErrorDetails(details: unknown, message?: string): ApiErrorDetails | undefined {
  if (!details || typeof details !== "object") {
    return message ? { formErrors: [message] } : undefined;
  }

  const normalizedDetails = details as ApiErrorDetails;
  const formErrors = (normalizedDetails.formErrors ?? []).filter(Boolean);
  const fieldErrors = Object.fromEntries(
    Object.entries(normalizedDetails.fieldErrors ?? {}).map(([fieldName, fieldMessages]) => [
      fieldName,
      (fieldMessages ?? []).filter(Boolean),
    ])
  );
  const hasFieldErrors = Object.values(fieldErrors).some((fieldMessages) => fieldMessages.length > 0);

  if (!formErrors.length && !hasFieldErrors && message) {
    return { formErrors: [message] };
  }

  return {
    formErrors,
    fieldErrors,
  };
}

function collectApiErrorMessages(details?: ApiErrorDetails) {
  if (!details) {
    return [];
  }

  const fieldErrors = Object.values(details.fieldErrors ?? {}).flat().filter(Boolean) as string[];
  const formErrors = (details.formErrors ?? []).filter(Boolean);
  return Array.from(new Set([...formErrors, ...fieldErrors]));
}

export function getApiErrorMessages(error: unknown, fallbackMessage = "Request failed") {
  if (error instanceof ApiError) {
    const messages = collectApiErrorMessages(error.details);
    if (messages.length > 0) {
      return messages;
    }

    return [error.message || fallbackMessage];
  }

  if (error instanceof Error && error.message) {
    return [error.message];
  }

  return [fallbackMessage];
}

export function getApiFormErrors(error: unknown, fallbackMessage = "Request failed") {
  if (error instanceof ApiError) {
    const formErrors = (error.details?.formErrors ?? []).filter(Boolean);

    if (formErrors.length > 0) {
      return Array.from(new Set(formErrors));
    }

    if (!error.details || collectApiErrorMessages(error.details).length === 0) {
      return [error.message || fallbackMessage];
    }

    return [];
  }

  if (error instanceof Error && error.message) {
    return [error.message];
  }

  return [fallbackMessage];
}

export function getApiFieldErrors(error: unknown) {
  if (error instanceof ApiError) {
    return error.details?.fieldErrors ?? {};
  }

  return {};
}

function withSelectedNetwork(path: string) {
  const url = new URL(path, "https://dva.local");
  url.searchParams.set("network", getStoredAppNetwork());
  return `${url.pathname}${url.search}`;
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

async function request<T>(path: string, init: RequestInit = {}, options?: { networkAware?: boolean }): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getAuthToken();

  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const requestPath = options?.networkAware ? withSelectedNetwork(path) : path;
  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    response = await fetch(`${getConfiguredApiBaseUrl()}${requestPath}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: init.signal || controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (networkError: unknown) {
    const err = networkError as Error;
    if (err?.name === "AbortError") {
      throw new ApiError(
        "Backend request timed out. If the service is on free tier (Render), it may take ~45s to wake up from sleep. Please try again in a moment."
      );
    }
    throw new ApiError(
      `Unable to reach backend service (${getConfiguredApiBaseUrl()}). Please verify server is online.`
    );
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const details = normalizeApiErrorDetails(payload.details, payload.message);
    const normalizedMessage = collectApiErrorMessages(details)[0] || payload.message || "Request failed";

    throw new ApiError(normalizedMessage, details);
  }

  return payload as T;
}

export const api = {
  getNetworkStatus: () => request<NetworkStatusResponse>("/networks"),
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
    }, { networkAware: true }),
  verifyAll: (role?: "student" | "teacher") =>
    request<{ verifiedCount: number; transactionHashes: string[] }>("/admin/verifications/bulk", {
      method: "POST",
      body: JSON.stringify(role ? { role } : {}),
    }, { networkAware: true }),
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
    }, { networkAware: true }),
  deactivateElection: (electionId: number) =>
    request<{ electionId: number; transactionHash: string; message: string }>(`/elections/${electionId}/deactivate`, {
      method: "PATCH",
    }, { networkAware: true }),
  deleteElection: (electionId: number) =>
    request<{ electionId: number; message: string }>(`/admin/elections/${electionId}`, {
      method: "DELETE",
    }, { networkAware: true }),
  getElectionResults: (electionId: number) =>
    request<ElectionResults>(`/elections/${electionId}/results`, {}, { networkAware: true }),
  listElections: async () => {
    const response = await request<{ elections: Election[]; message?: string }>("/elections", {}, { networkAware: true });
    return response;
  },
};
