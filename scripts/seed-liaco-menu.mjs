#!/usr/bin/env node
/**
 * Seeds Liaco menu: categories, ingredients, prep/menu recipes + BOM lines,
 * sellable products, and Napolitana/Americana pizza variants.
 *
 * Usage:
 *   node scripts/seed-liaco-menu.mjs            # print SQL
 *   node scripts/seed-liaco-menu.mjs --apply    # apply via local docker db
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const APPLY = process.argv.includes("--apply");
const CONTAINER = process.env.LIACO_DB_CONTAINER || "supabase_db_berea-pizzerias";

function esc(s) {
  return String(s ?? "").replace(/'/g, "''");
}

function slugify(s) {
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** @typedef {{ qty: number, unit: string, ingredient?: string, recipe?: string, optional?: boolean, note?: string }} Line */

const CATEGORIES = [
  { name: "Masas", sort: 10, icon: "pizza" },
  { name: "Salsas", sort: 20, icon: "droplet" },
  { name: "Preparaciones", sort: 30, icon: "chef-hat" },
  { name: "Pizzas", sort: 40, icon: "pizza" },
  { name: "Panouzzos", sort: 50, icon: "sandwich" },
  { name: "Lasañas", sort: 60, icon: "layers" },
  { name: "Strombolis", sort: 70, icon: "roll" },
  { name: "Limonadas", sort: 80, icon: "glass-water" },
  { name: "Postres", sort: 90, icon: "cake" },
  { name: "Bebidas", sort: 100, icon: "cup-soda" },
  { name: "Adiciones", sort: 110, icon: "plus" },
];

/** Raw ingredients appearing in the manual (unit = default stock UoM). */
const INGREDIENTS = [
  ["Harina", "g"],
  ["Agua", "ml"],
  ["Levadura", "g"],
  ["Hielo", "g"],
  ["Sal", "g"],
  ["Aceite de oliva", "ml"],
  ["Azúcar", "g"],
  ["Leche en polvo", "g"],
  ["Esencia de queso", "ml"],
  ["Orégano", "g"],
  ["Tomates frescos", "lb"],
  ["Cebolla", "g"],
  ["Ajo", "unidad"],
  ["Albahaca", "al_gusto"],
  ["Tomillo", "al_gusto"],
  ["Albahaca fresca", "al_gusto"],
  ["Margarina Astra", "lb"],
  ["Miel", "g"],
  ["Picante Ají Basco", "g"],
  ["Pepperoncino", "al_gusto"],
  ["Arequipe", "g"],
  ["Vinagre balsámico", "ml"],
  ["Mayonesa", "ml"],
  ["Perejil o cilantro", "g"],
  ["Leche", "ml"],
  ["Mozzarella", "g"],
  ["Queso mozzarella", "g"],
  ["Jamón serrano", "g"],
  ["Chorizo español", "g"],
  ["Pepperoni", "g"],
  ["Pollo", "g"],
  ["Tocineta salteada", "g"],
  ["Maíz", "g"],
  ["Chorizo argentino salteado", "unidad"],
  ["Chorizo argentino", "g"],
  ["Parmesano", "g"],
  ["Queso parmesano", "g"],
  ["Salami", "g"],
  ["Jalapeños", "g"],
  ["Piña caramelizada", "g"],
  ["Salsa BBQ", "al_gusto"],
  ["Puerro crocante", "al_gusto"],
  ["Salsa bechamel", "al_gusto"],
  ["Setas", "g"],
  ["Queso azul", "al_gusto"],
  ["Jamón", "g"],
  ["Tomate cherry", "g"],
  ["Pesto", "al_gusto"],
  ["Pollo BBQ", "g"],
  ["Queso crema", "g"],
  ["Cebolla avinada", "g"],
  ["Queso pera", "g"],
  ["Mermelada de tomate cherry", "g"],
  ["Pasta lasaña", "g"],
  ["Ragú de carne", "g"],
  ["Champiñones", "g"],
  ["Pan artesanal", "unidad"],
  ["Papa ripio", "g"],
  ["Bocadillo", "g"],
  ["Vino tinto", "oz"],
  ["Vino rosado", "oz"],
  ["Vino blanco", "oz"],
  ["Sweet and Sour", "oz"],
  ["Jugo de naranja", "oz"],
  ["Manzana", "unidad"],
  ["Patilla", "g"],
  ["Lychee", "unidad"],
  ["Canada Dry", "oz"],
  ["Hierbabuena", "al_gusto"],
  ["Romero", "al_gusto"],
  ["Naranja", "unidad"],
  ["Brownie preparado", "unidad"],
  ["Helado Popsy Gourmet", "g"],
  ["Salsa de arequipe", "al_gusto"],
  // Portion / prep outputs used as BOM components on menu items
  ["Porción masa napolitana", "g"],
  ["Porción masa americana", "g"],
  ["Salsa napolitana", "ml"],
  ["Mantequilla de ajo", "al_gusto"],
  ["Miel picante", "al_gusto"],
  ["Salsa tártara", "al_gusto"],
  ["Queso para borde", "g"],
];

/** Prep recipes: batch formulas from manual sections 1–4 (+ helpers). */
/** @type {{ name: string, slug: string, category_key: string, yield_qty: number, yield_unit: string, procedure: string, lines: Line[] }[]} */
const PREP_RECIPES = [
  {
    name: "Polish (prefermento)",
    slug: "polish-prefermento",
    category_key: "masas",
    yield_qty: 1,
    yield_unit: "lote",
    procedure:
      "Mezclar y dejar fermentar 2 horas afuera y 3 horas en nevera.",
    lines: [
      { qty: 900, unit: "g", ingredient: "Harina" },
      { qty: 900, unit: "g", ingredient: "Agua" },
      { qty: 6, unit: "g", ingredient: "Levadura" },
    ],
  },
  {
    name: "Masa napolitana (lote)",
    slug: "masa-napolitana-lote",
    category_key: "masas",
    yield_qty: 1,
    yield_unit: "lote",
    procedure:
      "Incorporar polish; amasar 25 min hasta masa lisa. Embolar 180 g; madurar 48 h nevera.",
    lines: [
      { qty: 1, unit: "lote", recipe: "polish-prefermento", note: "Incorporar el polish" },
      { qty: 1700, unit: "g", ingredient: "Hielo" },
      { qty: 1000, unit: "ml", ingredient: "Agua" },
      { qty: 5100, unit: "g", ingredient: "Harina" },
      { qty: 150, unit: "g", ingredient: "Sal" },
      { qty: 180, unit: "ml", ingredient: "Aceite de oliva" },
    ],
  },
  {
    name: "Masa americana (lote)",
    slug: "masa-americana-lote",
    category_key: "masas",
    yield_qty: 1,
    yield_unit: "lote",
    procedure:
      "Activar levadura+azúcar 15 min. Amasar 5+5 min. Reposar 30 min. Embolar 200 g.",
    lines: [
      { qty: 3000, unit: "g", ingredient: "Harina" },
      { qty: 1500, unit: "ml", ingredient: "Agua", note: "Agua al clima" },
      { qty: 30, unit: "g", ingredient: "Levadura" },
      { qty: 120, unit: "g", ingredient: "Azúcar" },
      { qty: 60, unit: "g", ingredient: "Sal" },
      { qty: 90, unit: "ml", ingredient: "Aceite de oliva" },
      { qty: 60, unit: "g", ingredient: "Leche en polvo" },
      { qty: 30, unit: "ml", ingredient: "Esencia de queso" },
      { qty: 3, unit: "g", ingredient: "Orégano" },
    ],
  },
  {
    name: "Salsa napolitana (lote)",
    slug: "salsa-napolitana-lote",
    category_key: "salsas",
    yield_qty: 1,
    yield_unit: "lote",
    procedure: "Hornear 4 h; licuar; fuego bajo hasta rojo espeso.",
    lines: [
      { qty: 7, unit: "lb", ingredient: "Tomates frescos" },
      { qty: 0, unit: "al_gusto", ingredient: "Orégano", optional: true, note: "Al gusto" },
      { qty: 1, unit: "lb", ingredient: "Cebolla" },
      { qty: 1, unit: "unidad", ingredient: "Ajo", note: "1 cabeza" },
      { qty: 0, unit: "al_gusto", ingredient: "Albahaca", optional: true, note: "Al gusto" },
      { qty: 0, unit: "al_gusto", ingredient: "Tomillo", optional: true, note: "Al gusto" },
    ],
  },
  {
    name: "Mantequilla de ajo",
    slug: "mantequilla-de-ajo",
    category_key: "salsas",
    yield_qty: 1,
    yield_unit: "lote",
    procedure: "1 cabeza ajo por libra de margarina; fuego lento hasta homogéneo.",
    lines: [
      { qty: 1, unit: "lb", ingredient: "Margarina Astra" },
      { qty: 1, unit: "unidad", ingredient: "Ajo", note: "1 cabeza por libra" },
    ],
  },
  {
    name: "Miel picante",
    slug: "miel-picante",
    category_key: "salsas",
    yield_qty: 980,
    yield_unit: "g",
    procedure: "Mezclar miel + picante; pepperoncino al gusto.",
    lines: [
      { qty: 950, unit: "g", ingredient: "Miel" },
      { qty: 30, unit: "g", ingredient: "Picante Ají Basco" },
      { qty: 0, unit: "al_gusto", ingredient: "Pepperoncino", optional: true, note: "Decorar al gusto" },
    ],
  },
  {
    name: "Vinagre balsámico reducido",
    slug: "vinagre-balsamico-reducido",
    category_key: "salsas",
    yield_qty: 375,
    yield_unit: "ml",
    procedure: "Mezclar hasta homogéneo.",
    lines: [
      { qty: 250, unit: "ml", ingredient: "Vinagre balsámico" },
      { qty: 125, unit: "g", ingredient: "Azúcar" },
    ],
  },
  {
    name: "Salsa tártara",
    slug: "salsa-tartara",
    category_key: "salsas",
    yield_qty: 1,
    yield_unit: "lote",
    procedure: "Licuar hasta cremosa sin grumos.",
    lines: [
      { qty: 3785, unit: "ml", ingredient: "Mayonesa", note: "1 galón" },
      { qty: 250, unit: "g", ingredient: "Azúcar" },
      { qty: 595, unit: "g", ingredient: "Cebolla", note: "3 cebollas" },
      { qty: 80, unit: "g", ingredient: "Ajo", note: "3 cabezas" },
      { qty: 0, unit: "al_gusto", ingredient: "Perejil o cilantro", optional: true, note: "Cantidad a normalizar (~$500)" },
      { qty: 1000, unit: "ml", ingredient: "Leche" },
    ],
  },
  {
    name: "Arequipe (acompañante)",
    slug: "arequipe-acompanante",
    category_key: "salsas",
    yield_qty: 1,
    yield_unit: "porcion",
    procedure: "Usar arequipe listo.",
    lines: [{ qty: 0, unit: "al_gusto", ingredient: "Arequipe", optional: true, note: "Al gusto / porción servicio" }],
  },
  {
    name: "Aceite de oliva (acompañante)",
    slug: "aceite-oliva-acompanante",
    category_key: "salsas",
    yield_qty: 1,
    yield_unit: "porcion",
    procedure: "Servir aceite de oliva.",
    lines: [{ qty: 0, unit: "al_gusto", ingredient: "Aceite de oliva", optional: true }],
  },
];

/** Shared pizza topping lines (without masa / border cheese). */
/** @type {Record<string, Line[]>} */
const PIZZA_TOPPINGS = {
  "Di Carne": [
    { qty: 50, unit: "ml", ingredient: "Salsa napolitana" },
    { qty: 75, unit: "g", ingredient: "Mozzarella" },
    { qty: 15, unit: "g", ingredient: "Jamón serrano", note: "1 lonja" },
    { qty: 25, unit: "g", ingredient: "Chorizo español", note: "3 unidades" },
    { qty: 10, unit: "g", ingredient: "Pepperoni", note: "5 uni" },
    { qty: 40, unit: "g", ingredient: "Pollo" },
    { qty: 40, unit: "g", ingredient: "Tocineta salteada" },
  ],
  Campagnola: [
    { qty: 50, unit: "ml", ingredient: "Salsa napolitana" },
    { qty: 75, unit: "g", ingredient: "Mozzarella" },
    { qty: 50, unit: "g", ingredient: "Pollo" },
    { qty: 10, unit: "g", ingredient: "Maíz" },
    { qty: 1, unit: "unidad", ingredient: "Chorizo argentino salteado" },
  ],
  "Pollo Español": [
    { qty: 50, unit: "ml", ingredient: "Salsa napolitana" },
    { qty: 75, unit: "g", ingredient: "Mozzarella" },
    { qty: 50, unit: "g", ingredient: "Pollo" },
    { qty: 40, unit: "g", ingredient: "Tocineta salteada" },
    { qty: 25, unit: "g", ingredient: "Chorizo español", note: "3 unidades" },
    { qty: 5, unit: "g", ingredient: "Parmesano", note: "aprox" },
  ],
  "Di Calabria": [
    { qty: 50, unit: "ml", ingredient: "Salsa napolitana" },
    { qty: 75, unit: "g", ingredient: "Mozzarella" },
    { qty: 30, unit: "g", ingredient: "Salami", note: "7 unidades" },
    { qty: 15, unit: "g", ingredient: "Jalapeños", note: "6 pedacitos" },
    { qty: 0, unit: "al_gusto", ingredient: "Pepperoncino", optional: true, note: "Al gusto" },
    { qty: 5, unit: "g", ingredient: "Parmesano", note: "aprox" },
  ],
  Barbacoa: [
    { qty: 50, unit: "ml", ingredient: "Salsa napolitana" },
    { qty: 75, unit: "g", ingredient: "Mozzarella" },
    { qty: 80, unit: "g", ingredient: "Piña caramelizada" },
    { qty: 0, unit: "al_gusto", ingredient: "Salsa BBQ", optional: true, note: "Al gusto" },
    { qty: 15, unit: "g", ingredient: "Jalapeños", note: "6 pedacitos / al gusto", optional: true },
    { qty: 40, unit: "g", ingredient: "Tocineta salteada" },
    { qty: 10, unit: "g", ingredient: "Cebolla" },
  ],
  Tentación: [
    { qty: 50, unit: "ml", ingredient: "Salsa napolitana" },
    { qty: 75, unit: "g", ingredient: "Mozzarella" },
    { qty: 20, unit: "g", ingredient: "Pepperoni", note: "10–12 unidades" },
    { qty: 0, unit: "al_gusto", ingredient: "Puerro crocante", optional: true },
    { qty: 0, unit: "al_gusto", ingredient: "Miel picante", optional: true, note: "Al gusto" },
  ],
  Primavera: [
    { qty: 50, unit: "ml", ingredient: "Salsa napolitana" },
    { qty: 75, unit: "g", ingredient: "Mozzarella" },
    { qty: 80, unit: "g", ingredient: "Piña caramelizada" },
    { qty: 20, unit: "g", ingredient: "Pepperoni", note: "10–12 unidades" },
  ],
  "Pollo Bechamel": [
    { qty: 50, unit: "ml", ingredient: "Salsa napolitana" },
    { qty: 75, unit: "g", ingredient: "Mozzarella" },
    { qty: 50, unit: "g", ingredient: "Pollo" },
    { qty: 0, unit: "al_gusto", ingredient: "Salsa bechamel", optional: true, note: "Al gusto" },
    { qty: 50, unit: "g", ingredient: "Setas" },
    { qty: 5, unit: "g", ingredient: "Parmesano", note: "aprox" },
  ],
  Liaco: [
    { qty: 50, unit: "ml", ingredient: "Salsa napolitana" },
    { qty: 75, unit: "g", ingredient: "Mozzarella" },
    { qty: 1, unit: "unidad", ingredient: "Jamón serrano", note: "1 unidad" },
    { qty: 0, unit: "al_gusto", ingredient: "Queso azul", optional: true, note: "Al gusto" },
    { qty: 50, unit: "g", ingredient: "Setas", note: "1 grande" },
  ],
  "Pollo Tocineta": [
    { qty: 50, unit: "ml", ingredient: "Salsa napolitana" },
    { qty: 75, unit: "g", ingredient: "Mozzarella" },
    { qty: 40, unit: "g", ingredient: "Tocineta salteada" },
    { qty: 50, unit: "g", ingredient: "Pollo" },
  ],
  "Tres Quesos": [
    { qty: 50, unit: "ml", ingredient: "Salsa napolitana" },
    { qty: 75, unit: "g", ingredient: "Mozzarella" },
    { qty: 0, unit: "al_gusto", ingredient: "Queso azul", optional: true, note: "Al gusto" },
    { qty: 0, unit: "al_gusto", ingredient: "Salsa bechamel", optional: true, note: "Al gusto" },
    { qty: 5, unit: "g", ingredient: "Parmesano", note: "aprox" },
  ],
  Pepperoni: [
    { qty: 50, unit: "ml", ingredient: "Salsa napolitana" },
    { qty: 75, unit: "g", ingredient: "Mozzarella" },
    { qty: 30, unit: "g", ingredient: "Pepperoni", note: "13/15 unidades" },
    { qty: 5, unit: "g", ingredient: "Parmesano", note: "aprox" },
  ],
  Salami: [
    { qty: 50, unit: "ml", ingredient: "Salsa napolitana" },
    { qty: 75, unit: "g", ingredient: "Mozzarella" },
    { qty: 30, unit: "g", ingredient: "Salami", note: "7 unidades" },
    { qty: 5, unit: "g", ingredient: "Parmesano", note: "aprox" },
  ],
  Hawaiana: [
    { qty: 50, unit: "ml", ingredient: "Salsa napolitana" },
    { qty: 75, unit: "g", ingredient: "Mozzarella" },
    { qty: 25, unit: "g", ingredient: "Jamón" },
    { qty: 80, unit: "g", ingredient: "Piña caramelizada" },
    { qty: 5, unit: "g", ingredient: "Parmesano", note: "aprox" },
  ],
  "Jamón & Queso": [
    { qty: 50, unit: "ml", ingredient: "Salsa napolitana" },
    { qty: 75, unit: "g", ingredient: "Mozzarella" },
    { qty: 30, unit: "g", ingredient: "Jamón" },
    { qty: 5, unit: "g", ingredient: "Parmesano", note: "aprox" },
  ],
  Vegetariana: [
    { qty: 50, unit: "ml", ingredient: "Salsa napolitana" },
    { qty: 75, unit: "g", ingredient: "Mozzarella" },
    { qty: 10, unit: "g", ingredient: "Cebolla" },
    { qty: 30, unit: "g", ingredient: "Setas" },
    { qty: 10, unit: "g", ingredient: "Maíz" },
    { qty: 60, unit: "g", ingredient: "Tomate cherry", note: "7–8 unidades" },
    { qty: 5, unit: "g", ingredient: "Parmesano", note: "aprox" },
  ],
  Margarita: [
    { qty: 50, unit: "ml", ingredient: "Salsa napolitana" },
    { qty: 75, unit: "g", ingredient: "Mozzarella" },
    { qty: 70, unit: "g", ingredient: "Tomate cherry", note: "10 unidades" },
    { qty: 0, unit: "al_gusto", ingredient: "Pesto", optional: true, note: "Al gusto" },
  ],
};

const PANOUZZOS = {
  "Il Forno": [
    { qty: 180, unit: "g", ingredient: "Porción masa napolitana" },
    { qty: 50, unit: "ml", ingredient: "Salsa napolitana" },
    { qty: 75, unit: "g", ingredient: "Mozzarella" },
    { qty: 40, unit: "g", ingredient: "Pollo" },
    { qty: 40, unit: "g", ingredient: "Tocineta salteada" },
    { qty: 1, unit: "unidad", ingredient: "Jamón serrano" },
    { qty: 25, unit: "g", ingredient: "Chorizo español", note: "3 unidades" },
    { qty: 10, unit: "g", ingredient: "Pepperoni" },
    { qty: 0, unit: "al_gusto", ingredient: "Albahaca fresca", optional: true },
    { qty: 5, unit: "g", ingredient: "Queso parmesano", note: "aprox" },
  ],
  Supremo: [
    { qty: 180, unit: "g", ingredient: "Porción masa napolitana" },
    { qty: 50, unit: "ml", ingredient: "Salsa napolitana" },
    { qty: 75, unit: "g", ingredient: "Mozzarella" },
    { qty: 80, unit: "g", ingredient: "Pollo BBQ" },
    { qty: 40, unit: "g", ingredient: "Tocineta salteada" },
    { qty: 10, unit: "g", ingredient: "Queso crema" },
    { qty: 0, unit: "al_gusto", ingredient: "Albahaca fresca", optional: true },
    { qty: 5, unit: "g", ingredient: "Queso parmesano", note: "aprox" },
  ],
  Rústico: [
    { qty: 180, unit: "g", ingredient: "Porción masa napolitana" },
    { qty: 50, unit: "ml", ingredient: "Salsa napolitana" },
    { qty: 75, unit: "g", ingredient: "Mozzarella" },
    { qty: 1, unit: "unidad", ingredient: "Chorizo argentino salteado" },
    { qty: 5, unit: "g", ingredient: "Queso azul" },
    { qty: 10, unit: "g", ingredient: "Cebolla avinada" },
    { qty: 0, unit: "al_gusto", ingredient: "Albahaca fresca", optional: true },
    { qty: 5, unit: "g", ingredient: "Parmesano" },
  ],
  Vesuvio: [
    { qty: 180, unit: "g", ingredient: "Porción masa napolitana" },
    { qty: 75, unit: "g", ingredient: "Mozzarella" },
    { qty: 1, unit: "unidad", ingredient: "Queso pera" },
    { qty: 0, unit: "al_gusto", ingredient: "Mermelada de tomate cherry", optional: true },
    { qty: 10, unit: "g", ingredient: "Pepperoni" },
    { qty: 6, unit: "unidad", ingredient: "Jalapeños", note: "6–7 unidades" },
    { qty: 0, unit: "al_gusto", ingredient: "Pepperoncino", optional: true },
    { qty: 0, unit: "al_gusto", ingredient: "Albahaca fresca", optional: true },
    { qty: 5, unit: "g", ingredient: "Parmesano" },
  ],
  Mediterráneo: [
    { qty: 180, unit: "g", ingredient: "Porción masa napolitana" },
    { qty: 75, unit: "g", ingredient: "Mozzarella" },
    { qty: 15, unit: "g", ingredient: "Mermelada de tomate cherry" },
    { qty: 5, unit: "g", ingredient: "Pesto" },
    { qty: 38, unit: "g", ingredient: "Queso pera", note: "1 unidad" },
    { qty: 10, unit: "g", ingredient: "Queso crema" },
    { qty: 25, unit: "g", ingredient: "Chorizo español", note: "3–4 unidades" },
    { qty: 0, unit: "al_gusto", ingredient: "Albahaca fresca", optional: true },
    { qty: 5, unit: "g", ingredient: "Parmesano" },
  ],
};

const LASANAS = {
  "Lasaña de Carne": [
    { qty: 60, unit: "g", ingredient: "Pasta lasaña", note: "1 pasta y media" },
    { qty: 150, unit: "g", ingredient: "Ragú de carne" },
    { qty: 75, unit: "g", ingredient: "Mozzarella" },
    { qty: 5, unit: "g", ingredient: "Parmesano" },
    { qty: 3, unit: "unidad", ingredient: "Pan artesanal", note: "3 pedacitos" },
    { qty: 0, unit: "al_gusto", ingredient: "Mantequilla de ajo", optional: true },
  ],
  "Lasaña de Pollo y Champiñones": [
    { qty: 60, unit: "g", ingredient: "Pasta lasaña", note: "1 pasta y media" },
    { qty: 150, unit: "g", ingredient: "Pollo" },
    { qty: 100, unit: "g", ingredient: "Champiñones" },
    { qty: 75, unit: "g", ingredient: "Mozzarella" },
    { qty: 5, unit: "g", ingredient: "Parmesano" },
    { qty: 3, unit: "unidad", ingredient: "Pan artesanal" },
    { qty: 0, unit: "al_gusto", ingredient: "Mantequilla de ajo", optional: true },
  ],
  "Lasaña Mixta": [
    { qty: 60, unit: "g", ingredient: "Pasta lasaña" },
    { qty: 75, unit: "g", ingredient: "Pollo" },
    { qty: 75, unit: "g", ingredient: "Ragú de carne" },
    { qty: 100, unit: "g", ingredient: "Champiñones" },
    { qty: 75, unit: "g", ingredient: "Mozzarella" },
    { qty: 5, unit: "g", ingredient: "Parmesano" },
    { qty: 3, unit: "unidad", ingredient: "Pan artesanal" },
    { qty: 0, unit: "al_gusto", ingredient: "Mantequilla de ajo", optional: true },
  ],
};

const STROMBOLIS = {
  Bravissimo: [
    { qty: 200, unit: "g", ingredient: "Porción masa americana" },
    { qty: 0, unit: "al_gusto", ingredient: "Mantequilla de ajo", optional: true },
    { qty: 0, unit: "al_gusto", ingredient: "Orégano", optional: true },
    { qty: 120, unit: "g", ingredient: "Queso mozzarella" },
    { qty: 60, unit: "g", ingredient: "Chorizo argentino", note: "1 unidad" },
    { qty: 30, unit: "g", ingredient: "Tocineta salteada" },
    { qty: 10, unit: "g", ingredient: "Maíz" },
    { qty: 10, unit: "g", ingredient: "Papa ripio" },
    { qty: 0, unit: "al_gusto", ingredient: "Salsa tártara", optional: true },
    { qty: 5, unit: "g", ingredient: "Queso parmesano" },
  ],
  Diavolo: [
    { qty: 200, unit: "g", ingredient: "Porción masa americana" },
    { qty: 0, unit: "al_gusto", ingredient: "Mantequilla de ajo", optional: true },
    { qty: 0, unit: "al_gusto", ingredient: "Orégano", optional: true },
    { qty: 75, unit: "g", ingredient: "Queso mozzarella" },
    { qty: 20, unit: "g", ingredient: "Pepperoni" },
    { qty: 40, unit: "g", ingredient: "Salami", note: "10 unidades" },
    { qty: 20, unit: "g", ingredient: "Jalapeños", note: "10 unidades" },
    { qty: 0, unit: "al_gusto", ingredient: "Pepperoncino", optional: true },
    { qty: 0, unit: "al_gusto", ingredient: "Miel picante", optional: true },
    { qty: 5, unit: "g", ingredient: "Queso parmesano" },
  ],
  Bianco: [
    { qty: 200, unit: "g", ingredient: "Porción masa americana" },
    { qty: 0, unit: "al_gusto", ingredient: "Mantequilla de ajo", optional: true },
    { qty: 0, unit: "al_gusto", ingredient: "Orégano", optional: true },
    { qty: 120, unit: "g", ingredient: "Queso mozzarella" },
    { qty: 40, unit: "g", ingredient: "Pollo" },
    { qty: 40, unit: "g", ingredient: "Tocineta salteada" },
    { qty: 50, unit: "g", ingredient: "Setas" },
    { qty: 0, unit: "al_gusto", ingredient: "Salsa bechamel", optional: true },
    { qty: 5, unit: "g", ingredient: "Queso parmesano" },
  ],
  Ananas: [
    { qty: 200, unit: "g", ingredient: "Porción masa americana" },
    { qty: 0, unit: "al_gusto", ingredient: "Mantequilla de ajo", optional: true },
    { qty: 0, unit: "al_gusto", ingredient: "Orégano", optional: true },
    { qty: 120, unit: "g", ingredient: "Queso mozzarella" },
    { qty: 40, unit: "g", ingredient: "Jamón" },
    { qty: 100, unit: "g", ingredient: "Piña caramelizada" },
    { qty: 5, unit: "g", ingredient: "Queso parmesano" },
  ],
  "Dolce Amore": [
    { qty: 200, unit: "g", ingredient: "Porción masa americana" },
    { qty: 0, unit: "al_gusto", ingredient: "Mantequilla de ajo", optional: true },
    { qty: 0, unit: "al_gusto", ingredient: "Orégano", optional: true },
    { qty: 100, unit: "g", ingredient: "Bocadillo" },
    { qty: 120, unit: "g", ingredient: "Queso mozzarella" },
    { qty: 5, unit: "g", ingredient: "Queso parmesano" },
  ],
};

const LIMONADAS = {
  "Limonada vino tinto y manzana": [
    { qty: 4.5, unit: "oz", ingredient: "Vino tinto" },
    { qty: 1.5, unit: "oz", ingredient: "Sweet and Sour" },
    { qty: 1.5, unit: "oz", ingredient: "Jugo de naranja" },
    { qty: 1, unit: "unidad", ingredient: "Manzana", note: "1 rodaja" },
    { qty: 500, unit: "g", ingredient: "Hielo" },
    { qty: 3, unit: "oz", ingredient: "Canada Dry" },
    { qty: 0, unit: "al_gusto", ingredient: "Naranja", optional: true, note: "Decoración" },
    { qty: 0, unit: "al_gusto", ingredient: "Hierbabuena", optional: true, note: "Decoración" },
  ],
  "Limonada vino rosado y sandía": [
    { qty: 4.5, unit: "oz", ingredient: "Vino rosado" },
    { qty: 1.5, unit: "oz", ingredient: "Sweet and Sour" },
    { qty: 30, unit: "g", ingredient: "Patilla" },
    { qty: 500, unit: "g", ingredient: "Hielo" },
    { qty: 3, unit: "oz", ingredient: "Canada Dry" },
    { qty: 0, unit: "al_gusto", ingredient: "Romero", optional: true, note: "Decoración" },
  ],
  "Limonada vino blanco y lychee": [
    { qty: 4.5, unit: "oz", ingredient: "Vino blanco" },
    { qty: 1.5, unit: "oz", ingredient: "Sweet and Sour" },
    { qty: 3, unit: "unidad", ingredient: "Lychee" },
    { qty: 500, unit: "g", ingredient: "Hielo" },
    { qty: 3, unit: "oz", ingredient: "Canada Dry" },
    { qty: 0, unit: "al_gusto", ingredient: "Hierbabuena", optional: true, note: "Decoración" },
  ],
  "Copa tinto de verano": [
    { qty: 4.5, unit: "oz", ingredient: "Vino tinto" },
    { qty: 1.5, unit: "oz", ingredient: "Sweet and Sour" },
    { qty: 1.5, unit: "oz", ingredient: "Jugo de naranja" },
    { qty: 3, unit: "oz", ingredient: "Canada Dry" },
    { qty: 0, unit: "al_gusto", ingredient: "Hielo", optional: true, note: "Más de la mitad de la copa" },
    { qty: 0, unit: "al_gusto", ingredient: "Naranja", optional: true, note: "Decoración" },
    { qty: 0, unit: "al_gusto", ingredient: "Hierbabuena", optional: true, note: "Decoración" },
  ],
  "Jarra tinto de verano (4 copas)": [
    { qty: 18, unit: "oz", ingredient: "Vino tinto" },
    { qty: 6, unit: "oz", ingredient: "Sweet and Sour" },
    { qty: 6, unit: "oz", ingredient: "Jugo de naranja" },
    { qty: 12, unit: "oz", ingredient: "Canada Dry" },
    { qty: 0, unit: "al_gusto", ingredient: "Hielo", optional: true, note: "Más de la mitad de la jarra" },
    { qty: 4, unit: "unidad", ingredient: "Naranja", note: "4 rodajas" },
    { qty: 0, unit: "al_gusto", ingredient: "Hierbabuena", optional: true },
  ],
};

const POSTRES = {
  "Brownie con helado y arequipe": [
    { qty: 1, unit: "unidad", ingredient: "Brownie preparado" },
    { qty: 60, unit: "g", ingredient: "Helado Popsy Gourmet" },
    { qty: 0, unit: "al_gusto", ingredient: "Salsa de arequipe", optional: true },
  ],
  Brownie: [
    { qty: 1, unit: "unidad", ingredient: "Brownie preparado" },
    { qty: 0, unit: "al_gusto", ingredient: "Salsa de arequipe", optional: true },
  ],
  "Helado Popsy Gourmet 60 g": [
    { qty: 60, unit: "g", ingredient: "Helado Popsy Gourmet" },
  ],
};

const BEBIDAS = [
  "Coca-Cola Original PET 400 ml",
  "Coca-Cola Zero PET 400 ml",
  "Kola Román PET 400 ml",
  "Postobón PET 400 ml",
  "Jugo Hit 500 ml",
  "Té Hatsu 250 ml",
  "Agua saborizada 400 ml",
  "Canada Dry 400 ml",
  "Bretaña 300 ml",
  "Agua 600 ml",
];

const ADICIONES = {
  "Queso para borde": [{ qty: 120, unit: "g", ingredient: "Queso para borde" }],
  "Pollo horneado": [{ qty: 50, unit: "g", ingredient: "Pollo" }],
  "Tocineta salteada (extra)": [{ qty: 50, unit: "g", ingredient: "Tocineta salteada" }],
  "Piña caramelizada (extra)": [{ qty: 80, unit: "g", ingredient: "Piña caramelizada" }],
  "Mix de vegetales": [
    { qty: 10, unit: "g", ingredient: "Cebolla" },
    { qty: 30, unit: "g", ingredient: "Setas" },
    { qty: 10, unit: "g", ingredient: "Maíz" },
    { qty: 60, unit: "g", ingredient: "Tomate cherry", note: "7–8 unidades" },
  ],
  "Chorizo argentino (extra)": [
    { qty: 60, unit: "g", ingredient: "Chorizo argentino", note: "1 unidad" },
  ],
};

/** Placeholder menu prices in COP pesos (column is named price_cents but stores pesos). */
const PRICE = {
  pizza: 35000,
  panouzzo: 28000,
  lasagna: 32000,
  stromboli: 30000,
  limonada: 18000,
  jarra: 55000,
  postre: 14000,
  bebida: 4500,
  adicion: 7000,
  prep: 0,
};

function pizzaLines(variant, toppings) {
  if (variant === "napolitana") {
    return [
      { qty: 180, unit: "g", ingredient: "Porción masa napolitana" },
      ...toppings,
    ];
  }
  return [
    { qty: 200, unit: "g", ingredient: "Porción masa americana" },
    { qty: 120, unit: "g", ingredient: "Queso para borde", note: "Borde Americana" },
    ...toppings,
  ];
}

function buildSql() {
  const out = [];
  out.push(`-- Generated by scripts/seed-liaco-menu.mjs — Liaco menú seed (idempotent)`);
  out.push(`do $$`);
  out.push(`declare`);
  out.push(`  tid uuid;`);
  out.push(`  v_cat_id uuid;`);
  out.push(`  v_ing_id uuid;`);
  out.push(`  v_recipe_id uuid;`);
  out.push(`  v_product_id uuid;`);
  out.push(`  v_line_sort int;`);
  out.push(`  v_comp_id uuid;`);
  out.push(`begin`);
  out.push(`  select id into tid from public.tenants where slug = 'liaco' limit 1;`);
  out.push(`  if tid is null then`);
  out.push(`    raise exception 'tenant liaco not found';`);
  out.push(`  end if;`);
  out.push(``);

  // Categories
  for (const c of CATEGORIES) {
    out.push(`  select id into v_cat_id from public.categories`);
    out.push(`    where tenant_id = tid and lower(trim(name)) = lower('${esc(c.name)}') limit 1;`);
    out.push(`  if v_cat_id is null then`);
    out.push(`    insert into public.categories (tenant_id, name, sort_order, icon_key)`);
    out.push(`    values (tid, '${esc(c.name)}', ${c.sort}, '${esc(c.icon)}')`);
    out.push(`    returning id into v_cat_id;`);
    out.push(`  else`);
    out.push(`    update public.categories set sort_order = ${c.sort}, icon_key = '${esc(c.icon)}', updated_at = now()`);
    out.push(`    where id = v_cat_id;`);
    out.push(`  end if;`);
  }

  // Ingredients
  for (const [name, unit] of INGREDIENTS) {
    const slug = slugify(name);
    out.push(`  select id into v_ing_id from public.ingredients where tenant_id = tid and slug = '${slug}' limit 1;`);
    out.push(`  if v_ing_id is null then`);
    out.push(`    insert into public.ingredients (tenant_id, name, slug, unit)`);
    out.push(`    values (tid, '${esc(name)}', '${slug}', '${unit}');`);
    out.push(`  else`);
    out.push(`    update public.ingredients set name = '${esc(name)}', unit = '${unit}', is_active = true, updated_at = now()`);
    out.push(`    where id = v_ing_id;`);
    out.push(`  end if;`);
  }

  function emitRecipe(kind, categoryKey, name, slug, yieldQty, yieldUnit, procedure, lines) {
    out.push(`  select id into v_recipe_id from public.recipes where tenant_id = tid and slug = '${slug}' limit 1;`);
    out.push(`  if v_recipe_id is null then`);
    out.push(`    insert into public.recipes (tenant_id, name, slug, kind, category_key, yield_qty, yield_unit, procedure_text)`);
    out.push(`    values (tid, '${esc(name)}', '${slug}', '${kind}', '${categoryKey}', ${yieldQty}, '${esc(yieldUnit)}', '${esc(procedure)}')`);
    out.push(`    returning id into v_recipe_id;`);
    out.push(`  else`);
    out.push(`    update public.recipes set name = '${esc(name)}', kind = '${kind}', category_key = '${categoryKey}',`);
    out.push(`      yield_qty = ${yieldQty}, yield_unit = '${esc(yieldUnit)}', procedure_text = '${esc(procedure)}',`);
    out.push(`      is_active = true, updated_at = now() where id = v_recipe_id;`);
    out.push(`    delete from public.recipe_lines where recipe_id = v_recipe_id;`);
    out.push(`  end if;`);
    out.push(`  v_line_sort := 0;`);
    for (const line of lines) {
      out.push(`  v_line_sort := v_line_sort + 10;`);
      if (line.recipe) {
        out.push(`  select id into v_comp_id from public.recipes where tenant_id = tid and slug = '${line.recipe}' limit 1;`);
        out.push(`  if v_comp_id is null then raise exception 'missing component recipe ${line.recipe}'; end if;`);
        out.push(`  insert into public.recipe_lines (tenant_id, recipe_id, component_recipe_id, quantity, unit, is_optional, note, sort_order)`);
        out.push(`  values (tid, v_recipe_id, v_comp_id, ${line.qty}, '${esc(line.unit)}', ${line.optional ? "true" : "false"}, '${esc(line.note || "")}', v_line_sort);`);
      } else {
        const ingSlug = slugify(line.ingredient);
        out.push(`  select id into v_ing_id from public.ingredients where tenant_id = tid and slug = '${ingSlug}' limit 1;`);
        out.push(`  if v_ing_id is null then raise exception 'missing ingredient ${esc(line.ingredient)}'; end if;`);
        out.push(`  insert into public.recipe_lines (tenant_id, recipe_id, ingredient_id, quantity, unit, is_optional, note, sort_order)`);
        out.push(`  values (tid, v_recipe_id, v_ing_id, ${line.qty}, '${esc(line.unit)}', ${line.optional ? "true" : "false"}, '${esc(line.note || "")}', v_line_sort);`);
      }
    }
  }

  function emitProduct(categoryName, name, reference, priceCents, recipeSlug, description = "", sizeOptions = null) {
    const sizeJson = sizeOptions
      ? `'${esc(JSON.stringify(sizeOptions))}'::jsonb`
      : `'[]'::jsonb`;
    out.push(`  select id into v_cat_id from public.categories`);
    out.push(`    where tenant_id = tid and lower(trim(name)) = lower('${esc(categoryName)}') limit 1;`);
    out.push(`  select id into v_recipe_id from public.recipes where tenant_id = tid and slug = '${recipeSlug}' limit 1;`);
    out.push(`  select id into v_product_id from public.products`);
    out.push(`    where tenant_id = tid and reference = '${esc(reference)}' limit 1;`);
    out.push(`  if v_product_id is null then`);
    out.push(`    insert into public.products (`);
    out.push(`      tenant_id, name, description, price_cents, currency, is_published, category_id,`);
    out.push(`      reference, brand, cost_cents, cost_gross_cents, has_vat, vat_percent,`);
    out.push(`      stock_warehouse, stock_local, recipe_id, size_options`);
    out.push(`    ) values (`);
    out.push(`      tid, '${esc(name)}', '${esc(description)}', ${priceCents}, 'COP', true, v_cat_id,`);
    out.push(`      '${esc(reference)}', 'Liaco', 0, 0, false, null,`);
    out.push(`      0, 0, v_recipe_id, ${sizeJson}`);
    out.push(`    ) returning id into v_product_id;`);
    out.push(`  else`);
    out.push(`    update public.products set`);
    out.push(`      name = '${esc(name)}', description = '${esc(description)}',`);
    out.push(`      price_cents = ${priceCents}, category_id = v_cat_id, brand = 'Liaco',`);
    out.push(`      is_published = true, recipe_id = v_recipe_id, size_options = ${sizeJson},`);
    out.push(`      updated_at = now()`);
    out.push(`    where id = v_product_id;`);
    out.push(`  end if;`);
  }

  function emitVariant(productRef, variantKey, label, recipeSlug, sort) {
    out.push(`  select id into v_product_id from public.products where tenant_id = tid and reference = '${esc(productRef)}' limit 1;`);
    out.push(`  select id into v_recipe_id from public.recipes where tenant_id = tid and slug = '${recipeSlug}' limit 1;`);
    out.push(`  if not exists (`);
    out.push(`    select 1 from public.product_recipe_variants`);
    out.push(`    where product_id = v_product_id and variant_key = '${variantKey}'`);
    out.push(`  ) then`);
    out.push(`    insert into public.product_recipe_variants (tenant_id, product_id, variant_key, label, recipe_id, sort_order)`);
    out.push(`    values (tid, v_product_id, '${variantKey}', '${esc(label)}', v_recipe_id, ${sort});`);
    out.push(`  else`);
    out.push(`    update public.product_recipe_variants set label = '${esc(label)}', recipe_id = v_recipe_id, sort_order = ${sort}`);
    out.push(`    where product_id = v_product_id and variant_key = '${variantKey}';`);
    out.push(`  end if;`);
  }

  // Prep recipes first (polish before masa napolitana)
  for (const r of PREP_RECIPES) {
    emitRecipe("prep", r.category_key, r.name, r.slug, r.yield_qty, r.yield_unit, r.procedure, r.lines);
    // Also create unpublished catalog entries under Masas/Salsas/Preparaciones for visibility
    const catName =
      r.category_key === "masas" ? "Masas" : r.category_key === "salsas" ? "Salsas" : "Preparaciones";
    emitProduct(catName, r.name, `PREP-${r.slug.toUpperCase()}`, PRICE.prep, r.slug, r.procedure.slice(0, 240));
    // Mark prep products unpublished (kitchen, not storefront)
    out.push(`  update public.products set is_published = false where tenant_id = tid and reference = 'PREP-${r.slug.toUpperCase()}';`);
  }

  // Pizzas with variants
  for (const [flavor, toppings] of Object.entries(PIZZA_TOPPINGS)) {
    const base = slugify(flavor);
    const napoSlug = `pizza-${base}-napolitana`;
    const amerSlug = `pizza-${base}-americana`;
    emitRecipe(
      "menu",
      "pizzas",
      `Pizza ${flavor} · Napolitana`,
      napoSlug,
      1,
      "porcion",
      "Masa napolitana 180 g. Orden: masa → salsa → mozzarella → ingredientes → hornear.",
      pizzaLines("napolitana", toppings),
    );
    emitRecipe(
      "menu",
      "pizzas",
      `Pizza ${flavor} · Americana`,
      amerSlug,
      1,
      "porcion",
      "Masa americana 200 g + 120 g queso borde. Orden: masa → salsa → mozzarella → ingredientes → hornear.",
      pizzaLines("americana", toppings),
    );
    const ref = `PIZ-${base.toUpperCase().replace(/-/g, "").slice(0, 12)}`;
    emitProduct(
      "Pizzas",
      `Pizza ${flavor}`,
      ref,
      PRICE.pizza,
      napoSlug,
      "Variantes Napolitana (180 g) o Americana (200 g + 120 g queso borde). Precio placeholder.",
      [
        { label: "Napolitana", key: "napolitana", recipe_slug: napoSlug },
        { label: "Americana", key: "americana", recipe_slug: amerSlug },
      ],
    );
    emitVariant(ref, "napolitana", "Napolitana", napoSlug, 10);
    emitVariant(ref, "americana", "Americana", amerSlug, 20);
  }

  function emitSimpleMenu(map, category, prefix, price, categoryKey, procedure) {
    for (const [name, lines] of Object.entries(map)) {
      const slug = `${prefix}-${slugify(name)}`;
      const ref = `${prefix.toUpperCase()}-${slugify(name).toUpperCase().replace(/-/g, "").slice(0, 14)}`;
      emitRecipe("menu", categoryKey, name, slug, 1, "porcion", procedure, lines);
      const p = name.toLowerCase().includes("jarra") ? PRICE.jarra : price;
      emitProduct(category, name, ref, p, slug, "Precio placeholder — menú Liaco.");
    }
  }

  emitSimpleMenu(
    PANOUZZOS,
    "Panouzzos",
    "panz",
    PRICE.panouzzo,
    "panouzzos",
    "Masa napolitana 180 g → sándwich → 1ª horneada → montaje → 2ª horneada.",
  );
  emitSimpleMenu(LASANAS, "Lasañas", "las", PRICE.lasagna, "lasanas", "Armado al instante; acompañan 3 panes artesanales.");
  emitSimpleMenu(
    STROMBOLIS,
    "Strombolis",
    "strb",
    PRICE.stromboli,
    "strombolis",
    "Masa americana 200 g → laminadora → enrollar → hornear.",
  );
  emitSimpleMenu(
    LIMONADAS,
    "Limonadas",
    "lim",
    PRICE.limonada,
    "limonadas",
    "Limonadas de vino / tinto de verano.",
  );
  emitSimpleMenu(POSTRES, "Postres", "post", PRICE.postre, "postres", "Postre Liaco.");
  emitSimpleMenu(ADICIONES, "Adiciones", "adic", PRICE.adicion, "adiciones", "Extra / modificador.");

  // Bottled drinks — simple products, no complex BOM (empty recipe optional)
  for (const name of BEBIDAS) {
    const slug = `bebida-${slugify(name)}`;
    const ref = `BEB-${slugify(name).toUpperCase().replace(/-/g, "").slice(0, 14)}`;
    emitRecipe("menu", "bebidas", name, slug, 1, "unidad", "Producto embotellado — sin BOM complejo.", []);
    emitProduct("Bebidas", name, ref, PRICE.bebida, slug, "Bebida embotellada. Precio placeholder.");
  }

  out.push(`end $$;`);
  out.push(``);
  out.push(`-- Counts for verification`);
  out.push(`select 'ingredients' as kind, count(*)::int as n from public.ingredients i join public.tenants t on t.id = i.tenant_id where t.slug = 'liaco'`);
  out.push(`union all select 'recipes', count(*)::int from public.recipes r join public.tenants t on t.id = r.tenant_id where t.slug = 'liaco'`);
  out.push(`union all select 'recipe_lines', count(*)::int from public.recipe_lines rl join public.tenants t on t.id = rl.tenant_id where t.slug = 'liaco'`);
  out.push(`union all select 'products', count(*)::int from public.products p join public.tenants t on t.id = p.tenant_id where t.slug = 'liaco'`);
  out.push(`union all select 'products_published', count(*)::int from public.products p join public.tenants t on t.id = p.tenant_id where t.slug = 'liaco' and p.is_published`);
  out.push(`union all select 'pizza_variants', count(*)::int from public.product_recipe_variants v join public.tenants t on t.id = v.tenant_id where t.slug = 'liaco';`);

  return out.join("\n");
}

const sql = buildSql();

if (!APPLY) {
  process.stdout.write(sql);
  process.exit(0);
}

const tmp = join(tmpdir(), `seed-liaco-menu-${Date.now()}.sql`);
writeFileSync(tmp, sql, "utf8");
console.error(`Applying seed via ${CONTAINER} (${tmp})…`);
execSync(`docker exec -i ${CONTAINER} psql -U postgres -v ON_ERROR_STOP=1`, {
  input: sql,
  stdio: ["pipe", "inherit", "inherit"],
  env: process.env,
  maxBuffer: 20 * 1024 * 1024,
});
console.error("Seed applied.");
