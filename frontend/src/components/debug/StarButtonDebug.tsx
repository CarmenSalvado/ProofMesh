"use client";

import { useState } from "react";
import { createStar, deleteStar } from "@/lib/api";
import { runAPIDiagnostics } from "@/lib/api-debug";
import { Bug, Play, CheckCircle, XCircle, Loader2 } from "lucide-react";

export function StarButtonDebug() {
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const runDiagnostics = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await runAPIDiagnostics();
      setDiagnostics(result);
      
      if (!result.connection.reachable) {
        setTestResult({
          success: false,
          message: `Backend unreachable: ${result.connection.error}`,
        });
      } else if (!result.auth.hasToken) {
        setTestResult({
          success: false,
          message: "No authentication token found. Please log in.",
        });
      } else {
        setTestResult({
          success: true,
          message: "API is reachable and authentication token exists.",
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setTesting(false);
    }
  };

  const testStarCreate = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await createStar({
        target_type: "problem",
        target_id: "00000000-0000-0000-0000-000000000000",
      });
      setTestResult({
        success: true,
        message: "Star creation API endpoint is working.",
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: `Star creation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const testStarDelete = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await deleteStar(
        "problem",
        "00000000-0000-0000-0000-000000000000"
      );
      setTestResult({
        success: true,
        message: "Star deletion API endpoint is working.",
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: `Star deletion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-6 bg-neutral-50 border border-neutral-200 rounded-lg">
      <div className="flex items-center gap-2 mb-4">
        <Bug className="w-5 h-5" />
        <h2 className="text-lg font-semibold">Star Button Debug Tool</h2>
      </div>

      <div className="space-y-4">
        {/* Diagnostics Panel */}
        <div className="space-y-2">
          <h3 className="font-medium text-sm text-neutral-700">
            API Diagnostics
          </h3>
          <div className="flex gap-2">
            <button
              onClick={runDiagnostics}
              disabled={testing}
              className="px-3 py-1.5 text-sm font-medium border border-neutral-300 rounded-md hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {testing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Run Diagnostics
            </button>
            <button
              onClick={testStarCreate}
              disabled={testing}
              className="px-3 py-1.5 text-sm font-medium border border-neutral-300 rounded-md hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Test Star Create
            </button>
            <button
              onClick={testStarDelete}
              disabled={testing}
              className="px-3 py-1.5 text-sm font-medium border border-neutral-300 rounded-md hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Test Star Delete
            </button>
          </div>
        </div>

        {/* Test Results */}
        {testResult && (
          <div
            className={`p-3 rounded-md border ${
              testResult.success
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <div className="flex items-start gap-2">
              {testResult.success ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <div className="text-sm">{testResult.message}</div>
            </div>
          </div>
        )}

        {/* Diagnostics Details */}
        {diagnostics && (
          <div className="bg-white border border-neutral-200 rounded-md p-4 space-y-3 text-sm">
            <div>
              <span className="font-medium">API Base URL:</span>{" "}
              <code className="bg-neutral-100 px-1 rounded">
                {diagnostics.apiBaseUrl}
              </code>
            </div>
            <div>
              <span className="font-medium">Connection Status:</span>{" "}
              {diagnostics.connection.reachable ? (
                <span className="text-green-600">✓ Reachable</span>
              ) : (
                <span className="text-red-600">
                  ✗ Unreachable - {diagnostics.connection.error}
                </span>
              )}
            </div>
            <div>
              <span className="font-medium">Authentication:</span>{" "}
              {diagnostics.auth.hasToken ? (
                <span className="text-green-600">
                  ✓ Token present ({diagnostics.auth.tokenLength} chars)
                </span>
              ) : (
                <span className="text-red-600">
                  ✗ No token found - User not logged in
                </span>
              )}
            </div>
            <div>
              <span className="font-medium">Token Preview:</span>{" "}
              <code className="bg-neutral-100 px-1 rounded text-xs">
                {diagnostics.auth.tokenPreview}
              </code>
            </div>
            <div className="text-xs text-neutral-500">
              <span className="font-medium">Timestamp:</span>{" "}
              {diagnostics.timestamp}
            </div>
          </div>
        )}

        {/* Quick Checks */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-sm text-blue-800">
          <h4 className="font-medium mb-2">Quick Troubleshooting:</h4>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Make sure the backend server is running</li>
            <li>Check that API_BASE_URL is correct</li>
            <li>Ensure you are logged in with a valid token</li>
            <li>Open browser console for detailed error logs</li>
            <li>Check Network tab for failed requests</li>
          </ul>
        </div>
      </div>
    </div>
  );
}