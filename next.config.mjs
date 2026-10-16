// next.config.mjs
import withPWAInit from "@ducanh2912/next-pwa";

// PWA: gera o service worker (public/sw.js) no build e registra o shell offline.
// Desabilitado em dev para não cachear durante o desenvolvimento.
const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  // Página servida quando a navegação falha (offline) e não há cache da rota.
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    disableDevLogs: true,
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default withPWA(nextConfig);
