import express from "express";
import fs from "fs";
import { MockSupplier } from "./suppliers.js";

const supplier = new MockSupplier();
const DB = (process.env.DATA_DIR || ".") + "/db.json";
const db = fs.existsSync(DB)
  ? JSON.parse(fs.readFileSync(DB))
  : { rules: { markupPct: 60, minMargin: 3, roundTo: 0.99 }, products: [], orders: [] };
const save = () => fs.writeFileSync(DB, JSON.stringify(db, null, 2));

const price = (cost) => {
  const { markupPct, minMargin, roundTo } = db.rules;
  let p = Math.max(cost * (1 + markupPct / 100), cost + minMargin);
  return +(Math.floor(p) + roundTo).toFixed(2);
};

async function sync() {
  for (const s of await supplier.listProducts()) {
    let p = db.products.find(x => x.sku === s.sku);
    if (!p) db.products.push((p = { sku: s.sku, title: s.title, image: s.image }));
    Object.assign(p, { cost: s.cost, stock: s.stock, price: price(s.cost), active: s.stock > 0 });
  }
  save();
}

async function fulfil() {
  for (const o of db.orders.filter(o => o.status === "paid")) {
    try {
      const r = await supplier.placeOrder(o);
      Object.assign(o, { status: "ordered", supplierOrderId: r.supplierOrderId, tracking: r.tracking });
    } catch (e) { o.status = "failed"; o.error = e.message; }
  }
  save();
}

const app = express();
app.use(express.json());

const PASS = process.env.ADMIN_PASSWORD;
if (!PASS) { console.error("Set ADMIN_PASSWORD"); process.exit(1); }
app.use((req, res, next) => {
  if (req.method === "POST" && req.path === "/api/orders" && process.env.ORDER_KEY &&
      req.get("x-api-key") === process.env.ORDER_KEY) return next();
  const [u, p] = Buffer.from((req.get("authorization") || "").slice(6), "base64").toString().split(":");
  if (u === "admin" && p === PASS) return next();
  res.set("WWW-Authenticate", 'Basic realm="Dropship"').status(401).send("Login required");
});
app.get("/", (_, res) => res.sendFile(process.cwd() + "/index.html"));

app.get("/api/state", (_, res) => res.json(db));
app.post("/api/sync", async (_, res) => { await sync(); res.json(db); });
app.post("/api/rules", (req, res) => {
  Object.assign(db.rules, req.body);
  db.products.forEach(p => (p.price = price(p.cost)));
  save(); res.json(db);
});
app.post("/api/orders", (req, res) => {
  const { sku, qty = 1, customer } = req.body;
  const p = db.products.find(x => x.sku === sku && x.active);
  if (!p) return res.status(400).json({ error: "Product unavailable" });
  const o = { id: "O-" + Date.now(), sku, qty, customer, total: +(p.price * qty).toFixed(2),
              cost: +(p.cost * qty).toFixed(2), status: "paid", created: new Date().toISOString() };
  db.orders.push(o); save(); res.json(o);
});

setInterval(() => sync().catch(console.error), 15 * 60 * 1000);
setInterval(() => fulfil().catch(console.error), 10 * 1000);
await sync();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Running on port " + PORT));
