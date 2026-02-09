"use client";

import * as React from "react";
import {
  loadSharedGatewayPassword,
  loadSharedGatewayToken,
} from "@/lib/api/device-auth-storage";

/**
 * Connection status returned from the gateway
 */
export interface ConnectionStatus {
  connected: boolean;
  email?: string;
  expiresAt?: string;
  scopes?: string[];
  lastSync?: string;
  userInfo?: Record<string, unknown>;
}

/**
 * Map of provider IDs to their connection statuses
 */
export type ConnectionStatusMap = Record<string, ConnectionStatus>;

/**
 * Options for initiating an OAuth flow
 */
export interface OAuthConnectOptions {
  providerId: string;
  scopes?: string[];
  redirectUri?: string;
}

/**
 * Hook for managing OAuth connections via the gateway.
 * Provides methods to connect, disconnect, and check status of providers.
 */
export function useConnectionManager(gatewayBaseUrl = "") {
  const [statuses, setStatuses] = React.useState<ConnectionStatusMap>({});
  const [loading, setLoading] = React.useState<Record<string, boolean>>({});
  const [error, setError] = React.useState<string | null>(null);

  const getGatewayAuthHeader = React.useCallback((): { Authorization: string } | null => {
    const token = loadSharedGatewayToken() ?? loadSharedGatewayPassword();
    if (!token) {
      return null;
    }
    return { Authorization: `Bearer ${token}` };
  }, []);

  const requireGatewayAuth = React.useCallback(
    (): { Authorization: string } | null => {
      const header = getGatewayAuthHeader();
      if (!header) {
        setError(
          "Gateway credentials are missing. Add a gateway token or password in the Gateway settings.",
        );
      }
      return header;
    },
    [getGatewayAuthHeader],
  );

  /**
   * Fetch the status of a specific provider
   */
  const fetchStatus = React.useCallback(
    async (providerId: string): Promise<ConnectionStatus> => {
      const authHeader = requireGatewayAuth();
      if (!authHeader) {
        const status: ConnectionStatus = { connected: false };
        setStatuses((prev) => ({ ...prev, [providerId]: status }));
        return status;
      }
      try {
        setLoading((prev) => ({ ...prev, [providerId]: true }));
        const response = await fetch(
          `${gatewayBaseUrl}/oauth/status/${providerId}`,
          {
            headers: authHeader,
            credentials: "include",
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            // Not connected
            const status: ConnectionStatus = { connected: false };
            setStatuses((prev) => ({ ...prev, [providerId]: status }));
            return status;
          }
          throw new Error(`Failed to fetch status: ${response.statusText}`);
        }

        const data = await response.json();
        const status: ConnectionStatus = {
          connected: data.connected ?? false,
          email: data.email,
          expiresAt: data.expiresAt,
          scopes: data.grantedScopes ?? data.scopes,
          lastSync: data.lastSync,
          userInfo: data.userInfo,
        };
        setStatuses((prev) => ({ ...prev, [providerId]: status }));
        return status;
      } catch (err) {
        const status: ConnectionStatus = { connected: false };
        setStatuses((prev) => ({ ...prev, [providerId]: status }));
        setError(err instanceof Error ? err.message : "Unknown error");
        return status;
      } finally {
        setLoading((prev) => ({ ...prev, [providerId]: false }));
      }
    },
    [gatewayBaseUrl]
  );

  /**
   * Fetch statuses for multiple providers
   */
  const fetchAllStatuses = React.useCallback(
    async (providerIds: string[]): Promise<ConnectionStatusMap> => {
      const results = await Promise.all(
        providerIds.map(async (id) => {
          const status = await fetchStatus(id);
          return [id, status] as const;
        })
      );
      return Object.fromEntries(results);
    },
    [fetchStatus]
  );

  /**
   * Initiate OAuth connection flow.
   * Opens the authorization URL in a new window/tab.
   */
  const connect = React.useCallback(
    async (options: OAuthConnectOptions): Promise<void> => {
      const { providerId, scopes, redirectUri } = options;
      let completed = false;

      try {
        setLoading((prev) => ({ ...prev, [providerId]: true }));
        setError(null);

        // Build the authorization URL
        const params = new URLSearchParams();
        if (scopes && scopes.length > 0) {
          params.set("scopes", scopes.join(","));
        }
        if (redirectUri) {
          params.set("redirect_uri", redirectUri);
        }

        const queryString = params.toString();
        const authUrl = `${gatewayBaseUrl}/oauth/authorize/${providerId}${queryString ? `?${queryString}` : ""}`;

        // Open in a popup window for better UX
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
          authUrl,
          `oauth_${providerId}`,
          `width=${width},height=${height},left=${left},top=${top},popup=yes`
        );

        if (!popup) {
          // Popup blocked, fall back to redirect
          setError("Popup blocked. Redirecting to complete authorization.");
          window.location.href = authUrl;
          return;
        }

        // Poll for popup closure and check status
        const pollInterval = setInterval(async () => {
          if (popup.closed) {
            clearInterval(pollInterval);
            // Refresh status after popup closes
            const status = await fetchStatus(providerId);
            completed = true;
            if (!status.connected) {
              setError("Authorization was canceled or denied by the provider.");
            }
            setLoading((prev) => ({ ...prev, [providerId]: false }));
          }
        }, 500);

        // Also listen for postMessage from callback page
        const handleMessage = async (event: MessageEvent) => {
          if (event.data?.type === "oauth_callback" && event.data?.provider === providerId) {
            clearInterval(pollInterval);
            window.removeEventListener("message", handleMessage);
            popup.close();
            const status = await fetchStatus(providerId);
            completed = true;
            if (!status.connected) {
              setError("Authorization was canceled or denied by the provider.");
            }
            setLoading((prev) => ({ ...prev, [providerId]: false }));
          }
        };
        window.addEventListener("message", handleMessage);

        // Cleanup after timeout (5 minutes)
        setTimeout(() => {
          clearInterval(pollInterval);
          window.removeEventListener("message", handleMessage);
          if (!completed) {
            setError("Authorization timed out before completion.");
          }
          setLoading((prev) => ({ ...prev, [providerId]: false }));
        }, 5 * 60 * 1000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initiate OAuth");
        setLoading((prev) => ({ ...prev, [providerId]: false }));
      }
    },
    [gatewayBaseUrl, fetchStatus]
  );

  /**
   * Disconnect a provider
   */
  const disconnect = React.useCallback(
    async (providerId: string): Promise<void> => {
      try {
        setLoading((prev) => ({ ...prev, [providerId]: true }));
        setError(null);

        const authHeader = requireGatewayAuth();
        if (!authHeader) {
          return;
        }

        const response = await fetch(`${gatewayBaseUrl}/oauth/${providerId}`, {
          method: "DELETE",
          headers: authHeader,
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Failed to disconnect: ${response.statusText}`);
        }

        setStatuses((prev) => ({
          ...prev,
          [providerId]: { connected: false },
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to disconnect");
      } finally {
        setLoading((prev) => ({ ...prev, [providerId]: false }));
      }
    },
    [gatewayBaseUrl]
  );

  /**
   * Store API key or token credentials (non-OAuth)
   */
  const storeCredentials = React.useCallback(
    async (
      providerId: string,
      credentials: Record<string, unknown>
    ): Promise<boolean> => {
      try {
        setLoading((prev) => ({ ...prev, [providerId]: true }));
        setError(null);

        const authHeader = requireGatewayAuth();
        if (!authHeader) {
          return false;
        }

        const response = await fetch(
          `${gatewayBaseUrl}/oauth/store/${providerId}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...authHeader,
            },
            credentials: "include",
            body: JSON.stringify(credentials),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to store credentials: ${response.statusText}`);
        }

        await fetchStatus(providerId);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to store credentials");
        return false;
      } finally {
        setLoading((prev) => ({ ...prev, [providerId]: false }));
      }
    },
    [gatewayBaseUrl, fetchStatus]
  );

  return {
    statuses,
    loading,
    error,
    connect,
    disconnect,
    fetchStatus,
    fetchAllStatuses,
    storeCredentials,
    clearError: () => setError(null),
  };
}

export default useConnectionManager;
