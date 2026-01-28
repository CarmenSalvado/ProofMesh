/**
 * API Debug Utility
 * Helps diagnose connection and authentication issues
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/**
 * Test basic connectivity to the backend
 */
export async function testBackendConnection(): Promise<{
  reachable: boolean;
  status?: number;
  error?: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/social/users`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    
    return {
      reachable: true,
      status: response.status,
    };
  } catch (error) {
    return {
      reachable: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get authentication status details
 */
export function getAuthDebugInfo(): {
  hasToken: boolean;
  tokenLength: number;
  tokenPreview: string;
} {
  if (typeof window === "undefined") {
    return {
      hasToken: false,
      tokenLength: 0,
      tokenPreview: "Not in browser",
    };
  }
  
  const token = localStorage.getItem("access_token");
  
  return {
    hasToken: !!token,
    tokenLength: token?.length || 0,
    tokenPreview: token ? `${token.substring(0, 20)}...` : "No token",
  };
}

/**
 * Run comprehensive API diagnostics
 */
export async function runAPIDiagnostics(): Promise<{
  apiBaseUrl: string;
  connection: any;
  auth: any;
  timestamp: string;
}> {
  const connection = await testBackendConnection();
  const auth = getAuthDebugInfo();
  
  const diagnostics = {
    apiBaseUrl: API_BASE_URL,
    connection,
    auth,
    timestamp: new Date().toISOString(),
  };
  
  console.group("🔍 API Diagnostics");
  console.log("API Base URL:", diagnostics.apiBaseUrl);
  console.log("Connection:", diagnostics.connection);
  console.log("Authentication:", diagnostics.auth);
  console.log("Timestamp:", diagnostics.timestamp);
  console.groupEnd();
  
  return diagnostics;
}

/**
 * Log API request details for debugging
 */
export function logAPIRequest(
  method: string,
  endpoint: string,
  options?: RequestInit
): void {
  console.group(`📡 API Request: ${method} ${endpoint}`);
  console.log("Full URL:", `${API_BASE_URL}/api${endpoint}`);
  console.log("Method:", method);
  console.log("Options:", {
    headers: options?.headers,
    body: options?.body ? `${(options.body as string).substring(0, 100)}...` : undefined,
  });
  
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    console.log("Has Auth Token:", !!token);
  }
  
  console.groupEnd();
}