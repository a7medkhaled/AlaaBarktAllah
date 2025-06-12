// js/index.js

let cleanProducts = [];
let plasticProducts = [];

let allProducts = [];
let filteredProducts = [];
let selectedTag = "الكل";
let selectedCat = "بلاستيك";
const cart = [];

const productList = document.getElementById("productList");
const cartList = document.getElementById("cartList");
const totalPrice = document.getElementById("totalPrice");
const tagFilters = document.getElementById("tagFilters");
const categoryFilters = document.getElementById("Category");
const searchInput = document.getElementById("searchInput");

// Load products from JSON
fetch("js/plasticProducts.json")
  .then((res) => res.json())
  .then((products) => {
    plasticProducts = products;
    filteredProducts = products;
    renderCategories();
    // renderCategories();
    // renderTags();

    // renderProducts();
  })
  .catch((err) => {
    productList.innerHTML = "Failed to load products.";
    console.error(err);
  });

// Load products from JSON
fetch("js/cleanProducts.json")
  .then((res) => res.json())
  .then((products) => {
    cleanProducts = products;
    filteredProducts = products;
    // renderCategories();
    // renderTags();

    // renderProducts();
  })
  .catch((err) => {
    productList.innerHTML = "Failed to load products.";
    console.error(err);
  });

function renderCategories() {
  const tagSet = new Set();
  tagSet.add("بلاستيك");
  tagSet.add("منظفات");

  categoryFilters.innerHTML = "";
  tagSet.forEach((cat) => {
    const btn = document.createElement("button");
    btn.textContent = cat;
    btn.className = "tag-button";
    btn.onclick = () => {
      selectedCat = cat === selectedCat ? null : cat;

      selectedTag = null;
      filterProductsPerCat();
      filterProducts();
      highlightSelectedCat();
    };
    categoryFilters.appendChild(btn);
  });
  highlightSelectedCat();
  filterProductsPerCat();
}

function filterProductsPerCat() {
  if (selectedCat == "بلاستيك") {
    allProducts = plasticProducts;
  } else {
    allProducts = cleanProducts;
  }
  renderTags();

  renderProducts();
}

// Render tag buttons at top
function renderTags() {
  const tagSet = new Set();
  tagSet.add("الكل");
  allProducts.forEach((p) => p.tags.forEach((t) => tagSet.add(t)));

  tagFilters.innerHTML = "";
  tagSet.forEach((tag) => {
    const btn = document.createElement("button");
    btn.textContent = tag;
    btn.className = "tag-button";
    btn.onclick = () => {
      selectedTag = tag === selectedTag ? null : tag;
      filterProducts();
      highlightSelectedTag();
    };
    tagFilters.appendChild(btn);
  });
  highlightSelectedTag();
}

// Highlight selected tag visually
function highlightSelectedTag() {
  [...tagFilters.children].forEach((btn) => {
    btn.style.backgroundColor =
      btn.textContent === selectedTag ? "#bbb" : "#eee";
  });
}
// Highlight selected category visually
function highlightSelectedCat() {
  [...categoryFilters.children].forEach((btn) => {
    btn.style.backgroundColor =
      btn.textContent === selectedCat ? "#bbb" : "#eee";
  });
}

// Filter products by tag and search text
function filterProducts() {
  const searchText = searchInput.value.toLowerCase();
  filteredProducts = allProducts.filter((p) => {
    const matchesTag =
      !selectedTag || selectedTag == "الكل" || p.tags.includes(selectedTag);
    const matchesSearch = p.name.toLowerCase().includes(searchText);
    return matchesTag && matchesSearch;
  });
  renderProducts();
}

// Render product cards
function renderProducts() {
  productList.innerHTML = "";
  filteredProducts.forEach((product, index) => {
    const card = document.createElement("div");
    card.className = "product-card";

    card.innerHTML = `
      <img  src="${product.image}" alt="${product.name}" class="product-img">
      <h4>${product.name}</h4>
      <p>${product.price.toFixed(2)} جنيه</p>
      <input type="number" min="1" value="1" id="qty-${index}" class="qty-input" />
      <button onclick="addToCart(${index})">اضافة</button>
    `;

    productList.appendChild(card);
  });
}

// Add product with quantity to cart
function addToCart(index) {
  const qtyInput = document.getElementById(`qty-${index}`);
  const qty = parseInt(qtyInput.value);
  if (!qty || qty < 1) return alert("Quantity must be at least 1.");

  const product = filteredProducts[index];
  cart.push({ ...product, quantity: qty });
  renderCart();
}

// Remove item from cart by index
function removeFromCart(i) {
  cart.splice(i, 1);
  renderCart();
}

// Render cart items and total price
function renderCart() {
  cartList.innerHTML = "";
  let total = 0;

  cart.forEach((item, i) => {
    const subtotal = item.price * item.quantity;
    total += subtotal;

    const li = document.createElement("li");
    li.innerHTML = `
      ${item.name} x${item.quantity} - (${subtotal.toFixed(2)} جنيه )
      <button onclick="removeFromCart(${i})">X</button>
    `;
    cartList.appendChild(li);
  });

  totalPrice.textContent = total.toFixed(2);
}

// Submit order to Firebase Firestore
document.getElementById("submitOrder").addEventListener("click", () => {
  if (cart.length === 0) return alert("Cart is empty.");

  const sale = {
    timestamp: new Date(),
    items: cart.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    })),
    total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
  };

  db.collection("sales")
    .add(sale)
    .then(() => {
      alert("Order submitted to Firebase!");
      cart.length = 0;
      renderCart();
    })
    .catch((error) => {
      console.error("Error adding sale: ", error);
      alert("Failed to submit order.");
    });
});

// Filter products on search input
searchInput.addEventListener("input", filterProducts);
