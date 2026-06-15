/** @type {import('next').NextConfig} */
const path = require('path');

// Stub vacío: reemplaza módulos problemáticos en el bundle de webpack.
// canvg importa core-js/internals que están corruptos en este entorno (OneDrive
// puede truncar instalaciones de npm). Se stubbea en AMBOS bundles (servidor y
// cliente) porque jsPDF lo importa en jspdf.es.min.js (bundle ESM del cliente).
// jsPDF solo usa canvg para el método .svg(), que no se llama en sri-ride.ts.
const browserOnlyStub = path.resolve(__dirname, 'src/stubs/empty.js');

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  typescript: {
    tsconfigPath: './tsconfig.json',
  },

  webpack: (config, { isServer }) => {
    // canvg stubbead para servidor Y cliente: evita que webpack resuelva
    // core-js/internals (archivo is-callable.js faltante en node_modules).
    config.resolve.alias = {
      ...config.resolve.alias,
      canvg: browserOnlyStub,
    };

    if (isServer) {
      // En el servidor también stubbeamos jspdf y jsbarcode completos.
      config.resolve.alias = {
        ...config.resolve.alias,
        jspdf: browserOnlyStub,
        jsbarcode: browserOnlyStub,
      };
    }

    return config;
  },
};

module.exports = nextConfig;
