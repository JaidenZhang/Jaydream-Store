const params = new URLSearchParams(window.location.search);
const id = Number(params.get("id"));

let product = null;
let isPaying = false;

document.getElementById("pay-button").addEventListener("click", payNow);

fetch("data/products.json")
    .then(res => res.json())
    .then(products => {

        product = products.find(item => item.id == id);

        if (!product) {
            alert("Produk tidak ditemukan.");
            return;
        }

        document.getElementById("checkout-image").src = product.image;

        document.getElementById("checkout-name").textContent =
            product.name;

        document.getElementById("checkout-category").textContent =
            "Kategori : " + product.category;

        const price =
            "Rp " + product.price.toLocaleString("id-ID");

        document.getElementById("checkout-price").textContent = price;

        document.getElementById("summary-price").textContent = price;

        document.getElementById("summary-total").textContent = price;

        console.log("PRODUCT LOADED:", product);

    })
    .catch(error => {

        console.error("PRODUCT ERROR:", error);

        alert("Gagal memuat produk.");

    });

async function payNow() {
    console.log("=== PAY NOW DIKLIK ===");
    console.log("SNAP:", window.snap);

    if (isPaying) {
        return;
    }

    if (!product) {
        alert("Produk belum selesai dimuat.");
        return;
    }

    const emailInput = document.getElementById("email");

    if (!emailInput) {
        alert("Input email tidak ditemukan.");
        return;
    }

    const email = emailInput.value.trim();

    const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
        alert("Masukkan email yang valid.");
        emailInput.focus();
        return;
    }

    if (typeof window.snap === "undefined") {

        alert("Midtrans Snap belum dimuat.");

        console.error(
            "SNAP TIDAK DITEMUKAN. Pastikan snap.js ada di checkout.html."
        );

        return;
    }

    isPaying = true;

    const button =
        document.getElementById("pay-button");

    if (button) {
        button.disabled = true;
        button.textContent = "Memproses...";
    }

    try {

        const userData =
            localStorage.getItem("user");

        const user =
            userData ? JSON.parse(userData) : null;

        console.log("Mengirim pembayaran...");

        const response = await fetch(
            "http://127.0.0.1:5000/create-payment",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    product_id: product.id,
                    product_name: product.name,
                    price: product.price,
                    email: email,
                    user_id: user ? user.id : null
                })
            }
        );

        const data = await response.json();
        console.log("PAYMENT RESPONSE:", data);
        console.log("TOKEN:", data.token);
        console.log("SNAP:", window.snap);

        if (!response.ok || !data.success) {

            throw new Error(
                data.message ||
                "Gagal membuat pembayaran."
            );

        }

        if (!data.token) {

            throw new Error(
                "Token Midtrans tidak ditemukan."
            );

        }

        console.log("MIDTRANS TOKEN:", data.token);
        console.log("MEMBUKA MIDTRANS SNAP...");

        window.snap.pay(data.token, {

            onSuccess: function(result) {

                console.log(
                    "PAYMENT SUCCESS:",
                    result
                );

                isPaying = false;

                if (button) {
                    button.disabled = false;
                    button.textContent = "Bayar Sekarang";
                }

            },

            onPending: function(result) {

                console.log(
                    "PAYMENT PENDING:",
                    result
                );

                isPaying = false;

                if (button) {
                    button.disabled = false;
                    button.textContent = "Bayar Sekarang";
                }

            },

            onError: function(result) {

                console.error(
                    "PAYMENT ERROR:",
                    result
                );

                alert("Pembayaran gagal.");

                isPaying = false;

                if (button) {
                    button.disabled = false;
                    button.textContent = "Bayar Sekarang";
                }

            },

            onClose: function() {

                console.log(
                    "Midtrans Snap ditutup."
                );

                isPaying = false;

                if (button) {
                    button.disabled = false;
                    button.textContent = "Bayar Sekarang";
                }

            }

        });

    } catch (error) {

        console.error(
            "PAYMENT ERROR:",
            error
        );

        alert(error.message);

        isPaying = false;

        if (button) {
            button.disabled = false;
            button.textContent = "Bayar Sekarang";
        }

    }

}