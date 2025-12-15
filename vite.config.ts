import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Cargar variables de entorno desde el archivo .env (si existe)
  // Fix: Cast process to any to resolve TS error "Property 'cwd' does not exist on type 'Process'"
  const env = loadEnv(mode, (process as any).cwd(), '');

  const apiKey = env.API_KEY || env.VITE_API_KEY || env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY;

  if (apiKey) {
    console.log("✅ API_KEY loaded successfully in Vite config.");
  } else {
    console.warn("⚠️ API_KEY not found in .env files. Gemini capabilities will be disabled.");
  }

  return {
    plugins: [react()],
    define: {
      // Definir process.env.API_KEY con el valor del sistema o archivo .env
      'process.env.API_KEY': JSON.stringify(apiKey),
      // Definir un objeto vacío para process.env para evitar crash por 'ReferenceError'
      'process.env': {},
    },
    server: {
      proxy: {
        // Redirigir peticiones API al backend de Python
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        }
      }
    }
  };
});