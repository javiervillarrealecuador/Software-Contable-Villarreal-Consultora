// Stub vacío para módulos exclusivos del navegador (jsPDF, JsBarcode, canvg).
// Webpack lo usa en el bundle del servidor en lugar del módulo real,
// evitando que core-js/canvg fallen al compilarse en Node.js.
module.exports = {};
