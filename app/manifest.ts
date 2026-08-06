import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Reanvil",
    short_name: "Reanvil",
    description: "Reanvil is the operating system for modern trades businesses.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0b0c",
    theme_color: "#0b0b0c",
    lang: "en-GB",
  };
}
