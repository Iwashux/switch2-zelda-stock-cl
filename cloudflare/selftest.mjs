// Pruebas rápidas sin red: node cloudflare/selftest.mjs
import assert from "node:assert/strict";
import { falabellaResults, pcFactoryResults, isExternalSeller } from "./src/monitor-core.js";

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
