export class MockSupplier {
  name = "mock";
  async listProducts() {
    return [
      { sku: "S-100", title: "Insulated Bottle 750ml", cost: 6.2, stock: 120, image: "" },
      { sku: "S-101", title: "Desk Cable Organizer", cost: 2.1, stock: 340, image: "" },
      { sku: "S-102", title: "LED Book Light", cost: 3.8, stock: 0, image: "" },
      { sku: "S-103", title: "Packing Cubes (4pc)", cost: 7.5, stock: 60, image: "" },
    ].map(p => ({ ...p, cost: +(p.cost * (0.97 + Math.random() * 0.06)).toFixed(2) }));
  }
  async placeOrder(order) {
    return { supplierOrderId: "SO-" + Date.now(), tracking: "TRK" + Math.floor(Math.random() * 1e9) };
  }
  async getTracking(supplierOrderId) {
    return { status: "shipped", tracking: "TRK" + supplierOrderId.slice(3) };
  }
}
