import { env } from "@/lib/env";

class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

interface FetchOpts extends RequestInit {
  /** Optional Clerk JWT string. If omitted, the request goes out unauthenticated. */
  token?: string | null;
}

/** Accept either a bare token string or a full FetchOpts for ergonomic call sites. */
type FetchArg = string | FetchOpts | null | undefined;

function asOpts(arg: FetchArg): FetchOpts {
  if (arg == null) return {};
  if (typeof arg === "string") return { token: arg };
  return arg;
}

async function request<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const { token, headers, ...rest } = opts;
  const url = path.startsWith("http") ? path : `${env.NEXT_PUBLIC_API_BASE_URL}${path}`;

  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string> | undefined),
  };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...rest, headers: finalHeaders });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* may legitimately be empty */
  }
  if (!res.ok) {
    throw new ApiError(`API ${res.status} ${res.statusText}`, res.status, body);
  }
  return body as T;
}

export const apiClient = {
  get: <T>(path: string, arg?: FetchArg) => request<T>(path, { ...asOpts(arg), method: "GET" }),
  post: <T>(path: string, body: unknown, arg?: FetchArg) =>
    request<T>(path, { ...asOpts(arg), method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown, arg?: FetchArg) =>
    request<T>(path, { ...asOpts(arg), method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string, arg?: FetchArg) => request<T>(path, { ...asOpts(arg), method: "DELETE" }),
};

export { ApiError };
