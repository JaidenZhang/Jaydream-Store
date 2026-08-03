let qty = 1;

const params = new URLSearchParams(window.location.search);

const id = Number(params.get("id"));

fetch("products.json")
.then(res=>res.json())
.then(products=>{

    const product = products.find(item=>item.id===id);

    document.getElementById("product-image").src = product.image;

    document.getElementById("product-name").innerHTML = product.name;

    document.getElementById("product-price").innerHTML =
        "Rp " + product.price.toLocaleString();

    document.getElementById("product-category").innerHTML =
        product.category;

    document.getElementById("product-description").innerHTML =
        product.description;

});

function plus(){

    qty++;

    document.getElementById("qty").innerHTML = qty;

}

function minus(){

    if(qty>1){

        qty--;

        document.getElementById("qty").innerHTML = qty;

    }

}

function buyNow(){

    window.location.href =
        `checkout.html?id=${id}&qty=${qty}`;

}