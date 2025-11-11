// plugins/vite-plugin-force-utf8.js

/**
 * Fixes browser mojibake in `npm run dev` by ensuring HTML responses
 * include "charset=utf-8". Only applies in dev mode.
 */
export default function forceUtf8ForHtml() {
  return {
    name: "utf8-for-html-only",
    apply: "serve", // <-- ensures plugin only runs in dev (vite serve)
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const originalSetHeader = res.setHeader.bind(res);

        res.setHeader = (name, value) => {
          if (String(name).toLowerCase() === "content-type") {
            let v = String(value);
            if (v.startsWith("text/html") && !/charset=/i.test(v)) {
              v = "text/html; charset=utf-8";
            }
            return originalSetHeader(name, v);
          }

          return originalSetHeader(name, value);
        };

        next();
      });
    },
  };
}