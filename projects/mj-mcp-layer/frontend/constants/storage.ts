import * as SecureStore from "expo-secure-store";
import { STORAGE_KEYS, DEFAULT_MCP_BASE_URL, DEFAULT_SHELL_URL } from "./config";

// Get stored configuration
export async function getConfig() {
  const [token, mcpBaseUrl, shellUrl] = await Promise.all([
    SecureStore.getItemAsync(STORAGE_KEYS.TOKEN),
    SecureStore.getItemAsync(STORAGE_KEYS.MCP_BASE_URL),
    SecureStore.getItemAsync(STORAGE_KEYS.SHELL_URL),
  ]);

  return {
    token,
    mcpBaseUrl: mcpBaseUrl || DEFAULT_MCP_BASE_URL,
    shellUrl: shellUrl || DEFAULT_SHELL_URL,
  };
}

// Set token
export async function setToken(token: string) {
  await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, token);
}

// Clear token (logout)
export async function clearToken() {
  await SecureStore.deleteItemAsync(STORAGE_KEYS.TOKEN);
}

// Set custom MCP URL
export async function setMcpBaseUrl(url: string) {
  await SecureStore.setItemAsync(STORAGE_KEYS.MCP_BASE_URL, url);
}

// Set custom Shell URL
export async function setShellUrl(url: string) {
  await SecureStore.setItemAsync(STORAGE_KEYS.SHELL_URL, url);
}

// Clear all config
export async function clearAllConfig() {
  await Promise.all([
    SecureStore.deleteItemAsync(STORAGE_KEYS.TOKEN),
    SecureStore.deleteItemAsync(STORAGE_KEYS.MCP_BASE_URL),
    SecureStore.deleteItemAsync(STORAGE_KEYS.SHELL_URL),
  ]);
}
