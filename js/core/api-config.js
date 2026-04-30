// api-config.js
const LOCAL_API = "http://localhost:3001";
const PROD_API = "https://dma-aedes-api.onrender.com"; // ✅ A URL CORRETA DO RENDER

function resolveBaseURL() {
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return LOCAL_API;
  }
  return PROD_API;
}

window.AEDES_API_BASE_URL = resolveBaseURL();