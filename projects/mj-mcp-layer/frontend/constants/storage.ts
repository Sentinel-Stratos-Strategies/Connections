import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { STORAGE_KEYS, DEFAULT_MCP_BASE_URL, DEFAULT_SHELL_URL } from "./config";

const isWeb = Platform.OS === "web";

async function getStoredItem(key: string) {
  if (isWeb) {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  }

  return SecureStore.getItemAsync(key);
}

async function setStoredItem(key: string, value: string) {
  if (isWeb) {
    localStorage.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function deleteStoredItem(key: string) {
  if (isWeb) {
    localStorage.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

// Get stored configuration
export async function getConfig() {
  const [token, mcpBaseUrl, shellUrl] = await Promise.all([
    getStoredItem(STORAGE_KEYS.TOKEN),
    getStoredItem(STORAGE_KEYS.MCP_BASE_URL),
    getStoredItem(STORAGE_KEYS.SHELL_URL),
  ]);

  return {
    token,
    mcpBaseUrl: mcpBaseUrl || DEFAULT_MCP_BASE_URL,
    shellUrl: shellUrl || DEFAULT_SHELL_URL,
  };
}

export async function getToken() {
  return getStoredItem(STORAGE_KEYS.TOKEN);
}

// Set token
export async function setToken(token: string) {
  await setStoredItem(STORAGE_KEYS.TOKEN, token);
}

// Clear token (logout)
export async function clearToken() {
  await deleteStoredItem(STORAGE_KEYS.TOKEN);
}

// Set custom MCP URL
export async function setMcpBaseUrl(url: string) {
  await setStoredItem(STORAGE_KEYS.MCP_BASE_URL, url);
}

// Set custom Shell URL
export async function setShellUrl(url: string) {
  await setStoredItem(STORAGE_KEYS.SHELL_URL, url);
}

// Clear all config
export async function clearAllConfig() {
  await Promise.all([
    deleteStoredItem(STORAGE_KEYS.TOKEN),
    deleteStoredItem(STORAGE_KEYS.MCP_BASE_URL),
    deleteStoredItem(STORAGE_KEYS.SHELL_URL),
  ]);
}
