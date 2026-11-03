const configuredApiUrl = import.meta.env.VITE_SERVER_URL
  ?.trim()
  .replace(/\/+$/, "");

export const API_URL = configuredApiUrl?.replace(/\/api$/i, "") || "";
export const API_BASE_URL = API_URL ? `${API_URL}/api` : "";
