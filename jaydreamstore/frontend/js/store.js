let products = [];

fetch("data/products.json")
.then(res => res.json())
.then(data => {

    products = data;

    renderProducts(products);

});

function renderProducts(list){

    const container = document.getElementById("products");

    container.innerHTML = "";

    list.forEach(product=>{

        container.innerHTML += `

        <div class="product-card">

            <img src="${product.image}">

            <h3>${product.name}</h3>

            <p>${product.category}</p>

            <span>Rp ${product.price.toLocaleString()}</span>

            <button onclick="buyProduct(${product.id})">

                Beli

            </button>

        </div>

        `;

    });

}

function searchProduct(){

    const keyword = document
    .getElementById("search")
    .value
    .toLowerCase();

    const filtered = products.filter(product=>

        product.name.toLowerCase().includes(keyword)

    );

    renderProducts(filtered);

}

function filterCategory(category){

    if(category=="All"){

        renderProducts(products);

        return;

    }

    const filtered = products.filter(product=>

        product.category===category

    );

    renderProducts(filtered);

}

function buyProduct(id){

    window.location.href = `product.html?id=${id}`;

}

