// Pruebas rápidas sin red: node cloudflare/selftest.mjs
import assert from "node:assert/strict";
import { falabellaResults, pcFactoryResults, isExternalSeller, detectRegion } from "./src/monitor-core.js";

const regions = [
  ["Consola Nintendo Switch 2 – The Legend of Zelda 40th Anniversary Hong Kong Version", "045496885434", "Hong Kong"],
  ["Consola Nintendo Switch 2 Zelda Aniversario HK", null, "Hong Kong"],
  ["Nintendo Switch 2 Zelda 40 aniversario versión japonesa", null, "⚠️ Japonesa: solo funciona en japonés y con cuentas japonesas"],
  ["Consola Switch 2 256GB The Legend of Zelda 40 - Versión Global Original", null, "Global"],
  ["Nintendo Switch 2 Formato US, 256GB", null, "Americana"],
  ["Switch 2 Zelda 40 edición USA", null, "Americana"],
  ["Consola de EE.UU. Switch 2 Zelda", null, "Americana"],
  ["Switch 2 Zelda 40 versión europea", null, "Europea"],
  ["Nintendo Switch 2 – The Legend of Zelda 40.º Aniversario", "045496905897", "Americana (Nintendo of America)"],
  ["Switch 2 Zelda 40: se usa con tu cuenta. Idiomas: inglés, japonés", null, "Región no indicada"],
  ["Nintendo Switch 2 Zelda 40th", "4902370551234", "Región no indicada"],
];
for (const [text, gtin, expected] of regions) assert.equal(detectRegion(text, gtin), expected, text);

const nextData = {
  props: {
    pageProps: {
      results: [
        {
          displayName: "Consola Switch 2 256GB The Legend of Zelda 40 - Versión Global Original",
          url: "https://www.falabella.com/falabella-cl/product/1/zelda-40",
          sellerName: "Pocketzonecl",
          prices: [{ crossed: false, price: ["829.990"] }, { crossed: true, price: ["1.019.990"] }],
        },
        { displayName: "The Legend of Zelda Tears of The Kingdom - Switch", url: "https://www.falabella.com/x", sellerName: "Falabella" },
      ],
    },
  },
};
const fal = falabellaResults(`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script>`);
assert.equal(fal.length, 1);
assert.equal(fal[0].price_clp, 829990);
assert.equal(fal[0].seller, "Pocketzonecl");
assert.equal(fal[0].region, "Global");
assert.equal(isExternalSeller("Pocketzonecl"), true);
assert.equal(isExternalSeller("Falabella"), false);
assert.equal(isExternalSeller(null), false);

const pcf = pcFactoryResults(JSON.stringify({
  content: {
    items: [
      { nombre: "Consola Nintendo Switch 2 Edición The Legend of Zelda 40 Aniversario", slug: "1-zelda", stock: "+100", precio: { efectivo: 699990.0 } },
      { nombre: "Consola Nintendo Switch 2 Zelda 40th Anniversary", slug: "2-zelda", stock: "0", precio: { efectivo: 699990.0 } },
      { nombre: "Nintendo Switch 2 Formato US, 256GB", slug: "3-base", stock: "3", precio: { efectivo: 599990.0 } },
    ],
  },
}));
assert.deepEqual(pcf.map((i) => [i.status, i.price_clp]), [["available", 699990], ["unavailable", 699990]]);
assert.equal(pcf[0].url, "https://www.pcfactory.cl/producto/1-zelda");

console.log("selftest OK");
