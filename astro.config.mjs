import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  adapter: node({
    mode: "standalone"
  }),
  integrations: [tailwind()],
  vite: {
    optimizeDeps: {
      include: ['@supabase/supabase-js', '@supabase/auth-js', '@supabase/functions-js', 'tslib']
    }
  }
});