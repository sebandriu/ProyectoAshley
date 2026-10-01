const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api";

export async function getSystemHealth() {
  const response = await fetch(`${API_URL}/health`);

  if (!response.ok) {
    throw new Error("No fue posible comprobar el estado de Micapp.");
  }

  return response.json();
}

export async function importSapFile(file) {
  const formData = new FormData();
  formData.append("archivo", file);

  const response = await fetch(`${API_URL}/importaciones`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "No fue posible importar el archivo.");
  }

  return data;
}

export { API_URL };
