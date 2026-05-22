const DEFAULT_MCP_BASE_URL = "https://mcp.ellis-aegis.us";

export const MCP_BASE_URL = (
  process.env.NEXT_PUBLIC_MCP_BASE_URL || DEFAULT_MCP_BASE_URL
).replace(/\/$/, "");

export class McpApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "McpApiError";
    this.status = status;
  }
}

type JsonBody = Record<string, unknown> | unknown[] | string | number | boolean | null;

type McpFetchOptions = Omit<RequestInit, "body"> & {
  token?: string | null;
  body?: BodyInit | JsonBody;
};

function buildUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${MCP_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function isBodyInit(body: unknown): body is BodyInit {
  return (
    typeof body === "string" ||
    body instanceof Blob ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body)
  );
}

export async function mcpFetch<T = unknown>(
  path: string,
  { token, headers, body, ...init }: McpFetchOptions = {}
): Promise<T> {
  const requestHeaders = new Headers(headers);

  if (token) {
    requestHeaders.set("x-ellis-aegis-token", token);
  }

  let requestBody: BodyInit | undefined;
  if (body !== undefined) {
    if (isBodyInit(body)) {
      requestBody = body;
    } else {
      requestHeaders.set("content-type", "application/json");
      requestBody = JSON.stringify(body);
    }
  }

  const response = await fetch(buildUrl(path), {
    ...init,
    headers: requestHeaders,
    body: requestBody,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new McpApiError(
      message || `MCP request failed with status ${response.status}`,
      response.status
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}

export function createFetcher(token: string) {
  return <T = unknown>(path: string) => mcpFetch<T>(path, { token });
}
