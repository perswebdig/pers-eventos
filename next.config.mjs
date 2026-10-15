import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Adicionada a abertura da função webpack que estava ausente
  webpack: (config, { isServer }) => {
    // Suas customizações do Webpack entram aqui se necessário
    
    return config;
  },
};

export default nextConfig;

