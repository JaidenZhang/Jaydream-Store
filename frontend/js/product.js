let qty = 1;
let selectedProduct = null;

const params = new URLSearchParams(window.location.search);
const id = Number(params.get("id"));

function getElement(idName) {
  return document.getElementById(idName);
}

function setText(idName, value) {
  const element = getElement(idName);

  if (element) {
    element.textContent = value;
  }
}

function showStatus(message) {
  const status = getElement("product-status");

  if (status) {
    status.textContent = message;
    return;
  }

  console.error(message);
}

function formatRupiah(price) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(price);
}

fetch("data/products.json")
  .then((response) => {
    if (!response.ok) {
      throw new Error("Data produk gagal dimuat.");
    }

    return response.json();
  })
  .then((products) => {
    selectedProduct = products.find((product) => product.id === id);

    if (!selectedProduct) {
      throw new Error("Produk tidak ditemukan.");
    }

    const image = getElement("product-image");

    if (image) {
      image.src = selectedProduct.image;
      image.alt = selectedProduct.name;
    }

    setText("product-name", selectedProduct.name);
    setText("product-price", formatRupiah(selectedProduct.price));
    setText("product-category", selectedProduct.category);
    setText("product-description", selectedProduct.description || "");
  })
  .catch((error) => {
    setText("product-name", "Produk tidak tersedia");
    showStatus(error.message);
  });

function updateQuantity() {
  setText("qty", qty);
}

function plus() {
  qty += 1;
  updateQuantity();
}

function minus() {
  if (qty > 1) {
    qty -= 1;
    updateQuantity();
  }
}

function buyNow() {
  if (!selectedProduct) {
    showStatus("Tunggu sampai data produk selesai dimuat.");
    return;
  }

  const total = selectedProduct.price * qty;
  const message = [
    "Halo JayDreamStore, saya mau top up:",
    `Produk: ${selectedProduct.name}`,
    `Quantity: x${qty}`,
    `Total: ${formatRupiah(total)}`
  ].join("\n");

  const whatsappUrl =
    `https://wa.me/6282172568157?text=${encodeURIComponent(message)}`;

  window.location.href = whatsappUrl;
}
