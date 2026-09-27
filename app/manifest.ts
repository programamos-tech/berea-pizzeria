import type { MetadataRoute } from "next";

const TEAL = "#ed7464";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Berea Pizzerías",
    short_name: "Berea Pizzerías",
    description: "Berea Pizzerías · software y escuela",
    start_url: "/",
    display: "standalone",
    background_color: TEAL,
    theme_color: TEAL,
    lang: "es",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
