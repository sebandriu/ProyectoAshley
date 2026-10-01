const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api";

export async function getSystemHealth() {
  const response = await fetch(`${API_URL}/health`);

  if (!response.ok) {
    throw new Error("No fue posible comprobar el estado de Micapp.");
  }

  return response.json();
}

export { API_URL };
