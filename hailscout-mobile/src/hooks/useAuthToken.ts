import { useAuth } from "@/auth/AuthProvider";

/**
 * Back-compat shim. Existing screens call `const { token } = useAuthToken();`
 * then `await token()`. We now back it with the first-party AuthProvider.
 */
export function useAuthToken() {
  const { getToken } = useAuth();
  return { token: getToken, isLoading: false, error: null as Error | null };
}
