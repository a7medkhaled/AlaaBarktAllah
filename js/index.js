// js/index.js
import { auth, db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  collection,
  addDoc,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

import {
  savePendingTransaction,
  getAllPendingTransactions,
  deletePendingTransaction,
  getProductsFromIndexedDB,
  saveProductsToIndexedDB,
} from "./indexedDB.js";
import { isDev } from "../settings.js";
import { protectRoute } from "./auth-guard.js";
import { logout } from "./auth.js";

// UI Elements
const elements = {
  page: document.getElementById("homePage"),
  userName: document.getElementById("userName"),
  loader: document.getElementById("global-loader"),
  productList: document.getElementById("productList"),
  cartList: document.getElementById("cartList"),
  totalPrice: document.getElementById("totalPrice"),
  searchInput: document.getElementById("searchInput"),
  syncStatus: document.getElementById("syncStatus"),
  title: document.getElementById("title"),
  offlineSalesBox: document.getElementById("offlineSalesBox"),
  unsyncedSalesList: document.getElementById("unsyncedSalesList"),
};

let allProducts = {};
let selectedCategory = "";
let selectedTag = "";
const cart = [];

protectRoute(); // Ensure route is protected

// Auth state listener
onAuthStateChanged(auth, (user) => {
  if (user) {
    elements.userName.textContent = user.email;
    elements.loader.style.display = "none";
    elements.page.style.display = "block";
  } else {
    window.location.href = "login.html";
  }
});

// ------------------ Products ------------------

async function loadProducts() {
  try {
    const cached = await getProductsFromIndexedDB();
    if (cached && Object.keys(cached).length > 0) {
      allProducts = cached;
    } else {
      await refreshProductsFromFirestore();
    }
  } catch (err) {
    console.error("Error loading products:", err);
  }

  renderCategoryTags();
  renderTagTags();
  renderProducts();
}

async function refreshProductsFromFirestore() {
  try {
    const docRef = doc(db, "products", "inventory");
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error("No products found");

    const products = snap.data().products;
    allProducts = products;
    await saveProductsToIndexedDB(products);
    alert("✅ تم تحديث المنتجات من الخادم.");
  } catch (err) {
    console.error("❌ تحديث المنتجات فشل:", err);
    alert("⚠️ لم نتمكن من تحديث المنتجات.");
  }
}

function renderCategoryTags() {
  const container = document.getElementById("category-tags");
  container.innerHTML = "";

  const categories = [
    ...new Set(Object.values(allProducts).map((p) => p.category)),
  ];
  categories.forEach((category) => {
    const btn = document.createElement("button");
    btn.textContent = category;
    btn.className = selectedCategory === category ? "active" : "";
    btn.onclick = () => {
      selectedCategory = selectedCategory === category ? "" : category;
      selectedTag = "";
      renderCategoryTags();
      renderTagTags();
      renderProducts();
    };
    container.appendChild(btn);
  });
}

function renderTagTags() {
  const container = document.getElementById("tag-tags");
  container.innerHTML = "";
  if (!selectedCategory) return;

  const tags = new Set();
  Object.values(allProducts).forEach((p) => {
    if (p.category === selectedCategory && Array.isArray(p.tags)) {
      p.tags.forEach((tag) => tags.add(tag));
    }
  });

  tags.forEach((tag) => {
    const btn = document.createElement("button");
    btn.textContent = tag;
    btn.className = selectedTag === tag ? "active" : "";
    btn.onclick = () => {
      selectedTag = selectedTag === tag ? "" : tag;
      renderTagTags();
      renderProducts();
    };
    container.appendChild(btn);
  });
}

function renderProducts() {
  const searchText = elements.searchInput.value.toLowerCase();
  elements.productList.innerHTML = "";

  Object.entries(allProducts).forEach(([id, p]) => {
    const matchesSearch = p.name.toLowerCase().includes(searchText);
    const matchesCategory =
      !selectedCategory || p.category === selectedCategory;
    const matchesTag = !selectedTag || (p.tags && p.tags.includes(selectedTag));

    if (matchesSearch && matchesCategory && matchesTag) {
      const card = createProductCard(id, p);
      elements.productList.appendChild(card);
    }
  });
}

function createProductCard(id, p) {
  const card = document.createElement("div");
  card.className = "product-card";

  card.innerHTML = `
    <h4>${p.name}</h4>
    <p>سعر الوحدة: ${p.pricePerUnit.toFixed(2)} جنيه</p>
    ${
      p.packageCount != 1 && p.pricePerPackage
        ? `<p>سعر العبوة: ${p.pricePerPackage.toFixed(2)} جنيه</p>`
        : ""
    }
    ${
      p.priceOfPackageForShops
        ? `<p>سعر العبوة للمحلات: ${p.priceOfPackageForShops.toFixed(
            2
          )} جنيه</p>`
        : ""
    }
  `;

  const qtyInput = document.createElement("input");
  qtyInput.type = "number";
  qtyInput.value = "1";
  qtyInput.step = p.tags?.includes("شنط") ? "0.25" : "1";
  qtyInput.className = "qty-input";
  qtyInput.id = `qty-${id}`;
  card.appendChild(qtyInput);

  if (p.packageCount !== 1) {
    const packageLabel = document.createElement("label");
    const packageCheckbox = document.createElement("input");
    packageCheckbox.type = "checkbox";
    packageCheckbox.id = `package-${id}`;
    packageCheckbox.onchange = () => handlePackageToggle(id);
    packageLabel.appendChild(packageCheckbox);
    packageLabel.append(" بيع عبوة");
    card.appendChild(packageLabel);
  }

  const shopLabel = document.createElement("label");
  const shopCheckbox = document.createElement("input");
  shopCheckbox.type = "checkbox";
  shopCheckbox.id = `shopPackage-${id}`;
  shopCheckbox.onchange = () => handleShopPackageToggle(id);
  shopLabel.appendChild(shopCheckbox);
  shopLabel.append(" سعر جملة");
  card.appendChild(shopLabel);

  const addButton = document.createElement("button");
  addButton.textContent = "إضافة";
  addButton.onclick = () => addToCart(id);
  card.appendChild(addButton);

  return card;
}

// ------------------ Cart ------------------

function addToCart(id) {
  const qty = parseFloat(document.getElementById(`qty-${id}`).value);
  if (!qty || qty < 0.25) {
    alert("الكمية يجب أن تكون 0.25 أو أكثر.");
    return;
  }

  const product = allProducts[id];
  const isShopPackage = document.getElementById(`shopPackage-${id}`)?.checked;
  const isPackage = document.getElementById(`package-${id}`)?.checked;

  let price =
    isShopPackage && product.priceOfPackageForShops
      ? product.priceOfPackageForShops
      : isPackage
      ? product.pricePerPackage ||
        product.pricePerUnit * (product.unitsPerPackage || 1)
      : product.pricePerUnit;

  const existing = cart.find(
    (item) => item.id === id && item.isPackage === isPackage
  );
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.push({
      id,
      name: product.name,
      quantity: qty,
      price,
      isPackage,
      isShopPackage,
    });
  }

  renderCart();
}

function renderCart() {
  elements.cartList.innerHTML = "";
  let total = 0;

  cart.forEach((item, i) => {
    const subtotal = item.price * item.quantity;
    total += subtotal;

    const li = document.createElement("li");
    li.innerHTML = `
      ${item.name} (${
      item.isShopPackage ? "عبوة جملة" : item.isPackage ? "عبوة" : "وحدة"
    })
      × ${item.quantity} = ${subtotal.toFixed(2)} جنيه
      <button onclick="removeFromCart(${i})">إزالة</button>
    `;
    elements.cartList.appendChild(li);
  });

  elements.totalPrice.textContent = total.toFixed(2) + " جنيه";
}

window.removeFromCart = (index) => {
  cart.splice(index, 1);
  renderCart();
};

// ------------------ Submit ------------------

async function submitData(type = "sale") {
  if (cart.length === 0) return alert("السلة فارغة.");

  const timestamp = new Date();

  const payload = {
    items: cart.map(({ id, name, quantity, price, isPackage }) => ({
      id,
      name,
      quantity,
      price,
      isPackage,
      type,
    })),
    total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    timestamp,
    type,
  };
  console.log(JSON.stringify(payload));

  try {
    if (navigator.onLine) {
      await addDoc(collection(db, "sales"), payload);
      alert(type === "return" ? "تم إرسال الإرجاع!" : "تم إرسال الطلب!");
    } else {
      await savePendingTransaction(payload, type);
      alert("تم الحفظ مؤقتًا بسبب عدم الاتصال.");
    }

    cart.length = 0;
    renderCart();
    renderPendingTransactions();
  } catch (e) {
    console.error("Submit error:", e);
    alert("فشل في الإرسال.");
  }
}

// ------------------ Offline Sync ------------------

async function renderPendingTransactions() {
  const pending = await getAllPendingTransactions();
  const list = elements.unsyncedSalesList;
  const box = elements.offlineSalesBox;

  if (!pending.length) return (box.style.display = "none");
  box.style.display = "block";
  list.innerHTML = "";

  pending.forEach(({ id, data, savedAt }) => {
    const details = data.items
      .map(
        (item) =>
          `• ${item.name} - ${item.quantity} ${
            item.isPackage ? "عبوة" : "وحدة"
          } × ${item.price} جنيه`
      )
      .join("<br>");

    const li = document.createElement("li");
    li.innerHTML = `
      <strong>🚫 ${data.type === "return" ? "إرجاع" : "بيع"}</strong><br>
      التاريخ: ${savedAt || data.timestamp}<br>
      عدد الأصناف: ${data.items.length}<br>
      المجموع: ${data.total.toFixed(2)} جنيه<br>
      <hr>${details}
    `;
    list.appendChild(li);
  });
}

async function syncPendingData() {
  const pending = await getAllPendingTransactions();
  if (!navigator.onLine) {
    elements.syncStatus.textContent = "📴 لا يوجد اتصال بالإنترنت";
    return;
  }

  for (const record of pending) {
    try {
      await addDoc(collection(db, "sales"), record.data);
      await deletePendingTransaction(record.id);
    } catch (e) {
      console.error("Sync error:", e);
    }
  }

  elements.syncStatus.textContent = "✅ تمت المزامنة";
  renderPendingTransactions();
}

// ------------------ UI Init ------------------

elements.searchInput.addEventListener("input", renderProducts);
document
  .getElementById("refreshProductsBtn")
  .addEventListener("click", async () => {
    await refreshProductsFromFirestore();
    renderCategoryTags();
    renderTagTags();
    renderProducts();
  });
document.getElementById("submitOrder").onclick = () => submitData("sale");
document.getElementById("submitReturn").onclick = () => submitData("return");
document.getElementById("logout").addEventListener("click", async () => {
  await logout();
  window.location.href = "/login.html";
});

window.handlePackageToggle = (id) => {
  const shopBox = document.getElementById(`shopPackage-${id}`);
  const packBox = document.getElementById(`package-${id}`);
  if (!shopBox.checked) packBox.disabled = false;
};

window.handleShopPackageToggle = (id) => {
  const shopBox = document.getElementById(`shopPackage-${id}`);
  const packBox = document.getElementById(`package-${id}`);
  packBox.checked = shopBox.checked;
  packBox.disabled = shopBox.checked;
};

if (isDev && elements.title) {
  elements.title.textContent += " DEV";
}

window.addEventListener("online", syncPendingData);
window.addEventListener("offline", () => {
  elements.syncStatus.textContent = "📴 لا يوجد اتصال بالإنترنت";
});

loadProducts();
syncPendingData();
renderPendingTransactions();
