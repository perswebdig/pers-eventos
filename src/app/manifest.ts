import type { MetadataRoute } from "next";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — Cadastro de visitantes`,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#166534",
    lang: "pt-BR",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-72.png", sizes: "72x72", type: "image/png", purpose: "any" },
      { src: "/icons/icon-96.png", sizes: "96x96", type: "image/png", purpose: "any" },
      { src: "/icons/icon-128.png", sizes: "128x128", type: "image/png", purpose: "any" },
      { src: "/icons/icon-144.png", sizes: "144x144", type: "image/png", purpose: "any" },
      { src: "/icons/icon-152.png", sizes: "152x152", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-384.png", sizes: "384x384", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/apple-icon-60.png", sizes: "60x60", type: "image/png", purpose: "any" },
      { src: "/icons/apple-icon-76.png", sizes: "76x76", type: "image/png", purpose: "any" },
      { src: "/icons/apple-icon-120.png", sizes: "120x120", type: "image/png", purpose: "any" },
      { src: "/icons/apple-icon-152.png", sizes: "152x152", type: "image/png", purpose: "any" },
      { src: "/icons/apple-icon-180.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
    screenshots: [],
    shortcuts: [
      { name: "Nova pessoa", url: "/pessoas", description: "Cadastrar visitante" },
      { name: "Novo evento", url: "/eventos", description: "Criar evento" },
      { name: "Recepção", url: "/checkin", description: "Check-in por QR" },
    ],
  };
}
