// js/index.js
import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  collection,
  addDoc,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import {
  savePendingTransaction,
  getAllPendingTransactions,
  deletePendingTransaction,
  getProductsFromIndexedDB,
  saveProductsToIndexedDB,
} from "./indexedDB.js";

let allProductsNew = {};
let selectedCategory = "";
let selectedTagNew = "";
const cart = [];

const productList = document.getElementById("productList");
const cartList = document.getElementById("cartList");
const totalPrice = document.getElementById("totalPrice");
const searchInput = document.getElementById("searchInput");

async function loadProducts() {
  try {
    const cached = await getProductsFromIndexedDB();
    if (cached && Object.keys(cached).length > 0) {
      allProductsNew = cached;
      console.log("✅ Loaded products from IndexedDB.");
    } else {
      console.warn("⚠️ No products in IndexedDB. Loading from Firestore...");
      await refreshProductsFromFirestore();
    }
  } catch (err) {
    console.error("❌ Error loading products:", err);
  }

  renderCategoryTags();
  renderTagTags();
  renderProducts();
}

function renderCategoryTags() {
  const container = document.getElementById("category-tags");
  container.innerHTML = "";
  const categories = [
    ...new Set(Object.values(allProductsNew).map((p) => p.category)),
  ];

  categories.forEach((category) => {
    const btn = document.createElement("button");
    btn.textContent = category;
    btn.className = selectedCategory === category ? "active" : "";
    btn.onclick = () => {
      selectedCategory = selectedCategory === category ? "" : category;
      selectedTagNew = "";
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
  Object.values(allProductsNew).forEach((p) => {
    if (p.category === selectedCategory && Array.isArray(p.tags)) {
      p.tags.forEach((tag) => tags.add(tag));
    }
  });

  tags.forEach((tag) => {
    const btn = document.createElement("button");
    btn.textContent = tag;
    btn.className = selectedTagNew === tag ? "active" : "";
    btn.onclick = () => {
      selectedTagNew = selectedTagNew === tag ? "" : tag;
      renderTagTags();
      renderProducts();
    };
    container.appendChild(btn);
  });
}

function renderProducts() {
  productList.innerHTML = "";

  Object.entries(allProductsNew).forEach(([id, p]) => {
    const searchText = searchInput.value.toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(searchText);
    const matchesCategory =
      !selectedCategory || p.category === selectedCategory;
    const matchesTag =
      !selectedTagNew || (p.tags && p.tags.includes(selectedTagNew));

    if (matchesSearch && matchesCategory && matchesTag) {
      const card = document.createElement("div");
      card.className = "product-card";

      card.innerHTML = `
        <img src="${p.image}" alt="${p.name}" class="product-img" />
        <h4>${p.name}</h4>
        <p>سعر الوحدة: ${p.pricePerUnit.toFixed(2)} جنيه</p>
        <p>سعر العبوة: ${
          p.pricePerPackage ? p.pricePerPackage.toFixed(2) : "-"
        } جنيه</p>
         <p>سعر العبوة للمحلات: ${
           p.priceOfPackageForShops ? p.priceOfPackageForShops.toFixed(2) : "-"
         } جنيه</p>
       <input type="number" min="0.25" step="0.25" value="1" id="qty-${id}" class="qty-input" />
<label><input type="checkbox" id="package-${id}" onchange="handlePackageToggle('${id}')" /> بيع عبوة</label>
<label><input type="checkbox" id="shopPackage-${id}" onchange="handleShopPackageToggle('${id}')" /> سعر جملة</label>
<button onclick="addToCart('${id}')">إضافة</button>
      `;

      productList.appendChild(card);
    }
  });
}

function addToCart(id) {
  const qtyInput = document.getElementById(`qty-${id}`);
  const packageCheckbox = document.getElementById(`package-${id}`);
  let qty = parseFloat(qtyInput.value);
  if (!qty || qty < 0.25) {
    alert("الكمية يجب أن تكون 0.25 أو أكثر.");
    return;
  }

  const product = allProductsNew[id];
  const shopPackageCheckbox = document.getElementById(`shopPackage-${id}`);
  const isShopPackage = shopPackageCheckbox.checked;
  const isPackage = packageCheckbox.checked;

  let price;
  if (isShopPackage && product.priceOfPackageForShops) {
    price = product.priceOfPackageForShops;
  } else if (isPackage) {
    price =
      product.pricePerPackage ||
      product.pricePerUnit * (product.unitsPerPackage || 1);
  } else {
    price = product.pricePerUnit;
  }

  const existingIndex = cart.findIndex(
    (item) => item.id === id && item.isPackage === isPackage
  );

  if (existingIndex > -1) {
    cart[existingIndex].quantity += qty;
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

function removeFromCart(i) {
  cart.splice(i, 1);
  renderCart();
}

function renderCart() {
  cartList.innerHTML = "";
  let total = 0;

  cart.forEach((item, i) => {
    const subtotal = item.price * item.quantity;
    total += subtotal;

    const li = document.createElement("li");
    li.innerHTML = `
      ${item.name} (${
      item.isShopPackage ? " عبوة جملة " : item.isPackage ? "عبوة" : "وحدة"
    }) × ${item.quantity}
 = ${subtotal.toFixed(2)} جنيه
      <button onclick="removeFromCart(${i})">إزالة</button>
    `;
    cartList.appendChild(li);
  });

  totalPrice.textContent = total.toFixed(2) + " جنيه";
}

// Unified submit function with readable timestamp and type in each item
async function submitData(type = "sale") {
  if (cart.length === 0) {
    alert("السلة فارغة. يرجى إضافة منتجات أولاً.");
    return;
  }

  const timestamp = new Date().toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

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

  try {
    if (navigator.onLine) {
      await addDoc(collection(db, "sales"), payload);
      alert(
        type === "return" ? "تم إرسال الإرجاع بنجاح!" : "تم إرسال الطلب بنجاح!"
      );
    } else {
      await savePendingTransaction(payload, type);
      renderPendingTransactions();
      alert("تم الحفظ مؤقتًا بسبب عدم الاتصال بالإنترنت.");
    }

    cart.length = 0;
    renderCart();
  } catch (error) {
    console.error("خطأ في الإرسال:", error);
    alert("حدث خطأ أثناء الإرسال. يرجى المحاولة لاحقًا.");
  }
}

async function renderPendingTransactions() {
  const list = document.getElementById("unsyncedSalesList");
  const box = document.getElementById("offlineSalesBox");

  const pending = await getAllPendingTransactions();

  if (pending.length === 0) {
    box.style.display = "none";
    return;
  }

  list.innerHTML = "";
  box.style.display = "block";

  pending.forEach((record) => {
    const li = document.createElement("li");

    const typeLabel = record.data.type === "return" ? "إرجاع" : "بيع";
    const itemCount = record.data.items.length;
    const amount = record.data.total.toFixed(2);

    // استخدام التاريخ المحلي إن توفر، وإلا استخدم timestamp الأساسي
    const timestamp = record.savedAt || record.data.timestamp;

    // إنشاء التفاصيل لكل صنف
    const itemDetails = record.data.items
      .map((item) => {
        const kind = item.isPackage ? "عبوة" : "وحدة";
        return `• ${item.name} - ${
          item.quantity
        } ${kind} × ${item.price.toFixed(2)} جنيه`;
      })
      .join("<br>");

    li.innerHTML = `
      <strong>🚫 ${typeLabel}</strong><br>
      التاريخ: ${timestamp}<br>
      عدد الأصناف: ${itemCount}<br>
      المجموع: ${amount} جنيه<br>
      <hr>
      ${itemDetails}
    `;

    list.appendChild(li);
  });
}

async function syncPendingData() {
  const status = document.getElementById("syncStatus");
  status.textContent = "🔄 مزامنة البيانات غير المتصلة...";

  if (!navigator.onLine) {
    status.textContent = "📴 لا يوجد اتصال بالإنترنت";
    return;
  }

  const pending = await getAllPendingTransactions();

  for (const record of pending) {
    try {
      await addDoc(collection(db, "sales"), record.data);
      await deletePendingTransaction(record.id);
    } catch (e) {
      console.error("Sync error:", e);
    }
  }

  status.textContent = "✅ تمت المزامنة";
  renderPendingTransactions();
}

async function refreshProductsFromFirestore() {
  try {
    const docRef = doc(db, "products", "inventory");
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error("No products found in Firestore");

    const products = snap.data().products;
    allProductsNew = products;
    await saveProductsToIndexedDB(products);
    alert("✅ تم تحديث المنتجات من الخادم.");
  } catch (err) {
    console.error("❌ فشل تحديث المنتجات من الخادم:", err);
    alert("⚠️ لم نتمكن من تحديث المنتجات من الخادم.");
  }
}

window.handlePackageToggle = function (id) {
  const shopPackageCheckbox = document.getElementById(`shopPackage-${id}`);
  const packageCheckbox = document.getElementById(`package-${id}`);

  // Only allow manual toggle if shopPackage is not selected
  if (!shopPackageCheckbox.checked) {
    packageCheckbox.disabled = false;
  }
};

window.handleShopPackageToggle = function (id) {
  const shopPackageCheckbox = document.getElementById(`shopPackage-${id}`);
  const packageCheckbox = document.getElementById(`package-${id}`);

  if (shopPackageCheckbox.checked) {
    packageCheckbox.checked = true;
    packageCheckbox.disabled = true;
  } else {
    packageCheckbox.disabled = false;
  }
};

// Event Listeners
document.getElementById("refreshProductsBtn").onclick = async () => {
  await refreshProductsFromFirestore();
  renderCategoryTags();
  renderTagTags();
  renderProducts();
};
document.getElementById("submitOrder").onclick = () => submitData("sale");
document.getElementById("submitReturn").onclick = () => submitData("return");
searchInput.addEventListener("input", renderProducts);
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;

loadProducts();
syncPendingData();
renderPendingTransactions();

window.addEventListener("online", () => {
  syncPendingData();
});
