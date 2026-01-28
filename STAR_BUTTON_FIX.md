# Star Button Fix - Troubleshooting Guide

## Problem
The "Failed to fetch" error when trying to star problems on `/problems/[uuid]` page was occurring without clear error messages, making it difficult to diagnose the root cause.

## Changes Made

### 1. Enhanced API Error Handling (`frontend/src/lib/api.ts`)
- **Improved error logging**: Added detailed console logging for all API failures including URL, method, status, and authentication status
- **Better error messages**: Network errors now show "Unable to connect to the server. Please check if the backend is running."
- **Authentication checks**: Automatically clears invalid tokens on 401/403 responses
- **Fixed TypeScript issues**: Properly typed headers to avoid type errors

### 2. Improved StarButton Component (`frontend/src/components/social/StarButton.tsx`)
- **Authentication validation**: Checks if user is logged in before attempting to star
- **Visual error feedback**: Shows error icon and tooltip when errors occur
- **User-friendly messages**: Displays specific error messages like "Please log in to star items"
- **Error state styling**: Button changes color and shows warning icon when errors occur

### 3. API Debug Utilities (`frontend/src/lib/api-debug.ts`)
- **Connection testing**: `testBackendConnection()` checks if backend is reachable
- **Auth diagnostics**: `getAuthDebugInfo()` shows token status and length
- **Comprehensive diagnostics**: `runAPIDiagnostics()` runs full health check
- **Request logging**: `logAPIRequest()` logs detailed request information

### 4. Debug Tool Component (`frontend/src/components/debug/StarButtonDebug.tsx`)
- **Interactive testing**: Run diagnostics and test star operations
- **Visual feedback**: Shows success/failure with clear indicators
- **Troubleshooting guide**: Lists common issues and solutions
- **Real-time status**: Displays connection and authentication status

## How to Use the Debug Tool

To diagnose star button issues:

1. **Add the debug component** to any page where you're experiencing issues:
```tsx
import { StarButtonDebug } from "@/components/debug/StarButtonDebug";

// In your component:
<StarButtonDebug />
```

2. **Run Diagnostics** to check:
   - Backend connectivity
   - API base URL configuration
   - Authentication token status

3. **Test Star Operations** to verify:
   - Star creation endpoint works
   - Star deletion endpoint works
   - Error handling is functioning

4. **Review Console Logs** for detailed error information

## Common Issues and Solutions

### Issue: "Failed to fetch" Error

**Possible Causes:**
1. Backend server is not running
2. Wrong API_BASE_URL configuration
3. CORS issues
4. Network connectivity problems

**Solutions:**
1. Start the backend server: `cd backend && python -m uvicorn app.main:app --reload`
2. Check `.env` file for correct `NEXT_PUBLIC_API_URL`
3. Ensure both frontend and backend are running on correct ports
4. Use the debug tool to test connectivity

### Issue: Authentication Errors

**Possible Causes:**
1. User not logged in
2. Expired token
3. Invalid token format

**Solutions:**
1. Log in again to get a fresh token
2. Check localStorage for `access_token`
3. Clear token and re-authenticate if needed

### Issue: TypeScript Errors

**Solution:**
The TypeScript errors in `api.ts` have been fixed by properly typing the headers object.

## Testing Checklist

Before considering the issue resolved:

- [ ] Backend server is running and accessible
- [ ] Frontend can connect to backend (use debug tool)
- [ ] User is logged in with valid token
- [ ] Star button shows correct initial state
- [ ] Clicking star updates the UI
- [ ] Error messages display correctly
- [ ] Console logs show detailed information

## Monitoring

After deploying these changes, monitor:

1. Browser console for detailed error logs
2. Network tab for failed requests
3. User reports of star button issues
4. Backend logs for authentication failures

## Next Steps

If issues persist after these fixes:

1. Check backend logs for errors
2. Verify database connection
3. Test API endpoints directly (using curl or Postman)
4. Check firewall/proxy settings
5. Review CORS configuration on backend