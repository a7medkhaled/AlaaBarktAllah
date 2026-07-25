// js/index.js
import { auth, db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  collection,
  getDocs,
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
  totalItems: document.getElementById("totalItems"),
  customerSelect: document.getElementById("customerSelect"),
  customerSearchInput: document.getElementById("customerSearchInput"),
  newCustomerForm: document.getElementById("newCustomerForm"),
  newCustomerName: document.getElementById("newCustomerName"),
  newCustomerAddress: document.getElementById("newCustomerAddress"),
  newCustomerMobile: document.getElementById("newCustomerMobile"),
  toggleCustomerFormBtn: document.getElementById("toggleCustomerFormBtn"),
  addCustomerBtn: document.getElementById("addCustomerBtn"),
  isQuantityOrdered: document.getElementById("isQuantityOrdered"),
  allowSkipCustomer: document.getElementById("allowSkipCustomer"),
  totalPrice: document.getElementById("totalPrice"),
  searchInput: document.getElementById("searchInput"),
  syncStatus: document.getElementById("syncStatus"),
  title: document.getElementById("title"),
  offlineSalesBox: document.getElementById("offlineSalesBox"),
  unsyncedSalesList: document.getElementById("unsyncedSalesList"),
};

let allProducts = {};
let selectedCategory = "All";
let selectedTag = "";
let selectedCompany = "";
const cart = [];
let customers = [];

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
  renderCompanyTags();
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

async function loadCustomers() {
  try {
    const snapshot = await getDocs(collection(db, "customers"));
    customers = [];

    snapshot.forEach((docSnap) => {
      customers.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Only render/populate the <select> when there's an active search term.
    const term = elements.customerSearchInput?.value?.trim();
    if (term) {
      renderCustomerOptions(term);
    } else {
      // keep select disabled and empty until user searches
      elements.customerSelect.disabled = true;
      elements.customerSelect.innerHTML = `<option value="">اختر العميل</option>`;
    }
  } catch (err) {
    console.error("Error loading customers:", err);
  }
}

function renderCustomerOptions(filter = "") {
  const select = elements.customerSelect;
  const searchTerm = filter.trim().toLowerCase();
  select.innerHTML = `<option value="">اختر العميل</option>`;

  const filtered = customers.filter((customer) => {
    const searchable = [
      customer.name,
      customer.mobile,
      customer.address,
      customer.id,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return !searchTerm || searchable.includes(searchTerm);
  });

  if (!filtered.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = searchTerm ? "لا يوجد عميل مطابق" : "لا يوجد عملاء";
    option.disabled = true;
    select.appendChild(option);
    // disable select when no results
    select.disabled = true;
    return;
  }
  // keep select disabled (read-only) even when populated by search

  filtered.forEach((customer) => {
    const option = document.createElement("option");
    option.value = customer.id;
    const name = customer.name || customer.displayName || "";
    const mobile = customer.mobile || "";
    const address = customer.address || "";
    option.textContent = [name, mobile, address].filter(Boolean).join(" — ") || customer.id;
    // keep mobile/address available for later use
    option.dataset.mobile = mobile;
    option.dataset.address = address;
    option.title = option.textContent;
    select.appendChild(option);
  });
}

function autoSelectCustomerByNumber(term) {
  const normalized = String(term || "").trim().replace(/[^0-9]/g, "");
  if (!normalized) {
    elements.customerSelect.value = "";
    return;
  }

  const matches = customers.filter((c) => {
    const m = String(c.mobile || "").replace(/[^0-9]/g, "");
    return m && m.includes(normalized);
  });

  // prefer exact match
  const exact = matches.find((c) =>
    String(c.mobile || "").replace(/[^0-9]/g, "") === normalized
  );
  const pick = exact || (matches.length === 1 ? matches[0] : null);
  if (pick) {
    elements.customerSelect.value = pick.id;
  }
}

function renderCategoryTags() {
  const container = document.getElementById("category-tags");
  container.innerHTML = "";

  const categories = [
    "All",
    ...new Set(Object.values(allProducts).map((p) => p.category)),
  ];
  categories.forEach((category) => {
    const btn = document.createElement("button");
    btn.textContent = category === "All" ? "الكل" : category;
    btn.className = selectedCategory === category ? "active" : "";
    btn.onclick = () => {
      selectedCategory = category;
      selectedTag = "";
      selectedCompany = "";
      renderCategoryTags();
      renderTagTags();
      renderCompanyTags();
      renderProducts();
    };
    container.appendChild(btn);
  });
}

function renderTagTags() {
  const container = document.getElementById("tag-tags");
  container.innerHTML = "";
  if (!selectedCategory || selectedCategory === "All") return;

  const tags = new Set();
  Object.values(allProducts).forEach((p) => {
    if (p.category === selectedCategory && Array.isArray(p.tags)) {
      p.tags.forEach((tag) => tags.add(tag));
    }
  });

  if (tags.size <= 1) return;

  tags.forEach((tag) => {
    const btn = document.createElement("button");
    btn.textContent = tag;
    btn.className = selectedTag === tag ? "active" : "";
    btn.onclick = () => {
      selectedTag = selectedTag === tag ? "" : tag;
      renderTagTags();
      renderCompanyTags();
      renderProducts();
    };
    container.appendChild(btn);
  });
}

function renderCompanyTags() {
  const container = document.getElementById("company-tags");
  container.innerHTML = "";

  if (selectedCategory === "All" || (!selectedCategory && !selectedTag)) return;

  const companies = new Set();
  Object.values(allProducts).forEach((p) => {
    const categoryMatch = selectedCategory === "All" || p.category === selectedCategory;
    const tagMatch = !selectedTag || (p.tags && p.tags.includes(selectedTag));
    if (categoryMatch && tagMatch && p.companyName) {
      companies.add(p.companyName);
    }
  });

  if (companies.size <= 1) return;

  const header = document.createElement("div");
  header.className = "filter-header";
  header.textContent = "الشركات";
  container.appendChild(header);

  companies.forEach((company) => {
    const btn = document.createElement("button");
    btn.textContent = company;
    btn.className = selectedCompany === company ? "active" : "";
    btn.onclick = () => {
      selectedCompany = selectedCompany === company ? "" : company;
      renderCompanyTags();
      renderProducts();
    };
    container.appendChild(btn);
  });
}

function renderProducts() {
  const searchText = elements.searchInput.value.toLowerCase();
  elements.productList.innerHTML = "";

  Object.entries(allProducts).forEach(([id, p]) => {
    const productText = [
      p.name,
      p.category,
      p.companyName,
      p.number,
      p.sku,
      id,
      ...(p.tags || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch = !searchText || productText.includes(searchText);
    const matchesCategory =
      selectedCategory === "All" || p.category === selectedCategory;
    const matchesTag = !selectedTag || (p.tags && p.tags.includes(selectedTag));
    const matchesCompany = !selectedCompany || p.companyName === selectedCompany;

    if (matchesSearch && matchesCategory && matchesTag && matchesCompany) {
      const card = createProductCard(id, p);
      elements.productList.appendChild(card);
    }
  });
}

function createProductCard(id, p) {
  const card = document.createElement("div");
  card.className = "product-card";

  function tagContainsShant(tag) {
    const normalized = String(tag || "").normalize("NFC");
    // remove common Arabic diacritics and superscript alef
    const cleaned = normalized.replace(/[\u064B-\u0652\u0670]/g, "").toLowerCase();
    return cleaned.includes("شنط");
  }
  card.innerHTML = `
    <h4>${p.name}</h4>
    ${p.companyName ? `<p><strong>الشركة:</strong> ${p.companyName}</p>` : ""}
    ${typeof p.stockUnits !== 'undefined' ? `<p>المخزون: ${p.stockUnits}</p>` : ""}
    <p>سعر الوحدة: ${p.pricePerUnit.toFixed(2)} جنيه</p>
    ${
      p.pricePerUnitForShops
        ? `<p>سعر الوحدة للمحلات: ${p.pricePerUnitForShops.toFixed(2)} جنيه</p>`
        : ""
    }
    ${
      p.packageCount != 1 && p.pricePerPackage
        ? `<p>سعر العبوة: ${p.pricePerPackage.toFixed(2)} جنيه</p>`
        : ""
    }
    ${
      p.packageCount != 1 && p.priceOfPackageForShops
        ? `<p>سعر العبوة للمحلات: ${p.priceOfPackageForShops.toFixed(
            2
          )} جنيه</p>`
        : ""
    }
  `;

  const qtyInput = document.createElement("input");
  qtyInput.type = "number";
  qtyInput.value = "1";
  const isShant = tagContainsShant(p.category) || (Array.isArray(p.tags) && p.tags.some(tagContainsShant));
  qtyInput.step = isShant ? "0.05" : "1";
  qtyInput.className = "qty-input";
  qtyInput.id = `qty-${id}`;
  card.appendChild(qtyInput);

  if (p.packageCount !== 1) {
    const packageLabel = document.createElement("label");
    const packageCheckbox = document.createElement("input");
    packageCheckbox.type = "checkbox";
    packageCheckbox.id = `package-${id}`;
    packageCheckbox.checked = true;
    packageCheckbox.onchange = () => handlePackageToggle(id);
    packageLabel.appendChild(packageCheckbox);
    packageLabel.append(" بيع عبوة");
    card.appendChild(packageLabel);
  }

  const shopLabel = document.createElement("label");
  // const shopCheckbox = document.createElement("input");
  // shopCheckbox.type = "checkbox";
  // shopCheckbox.id = `shopPackage-${id}`;
  // shopCheckbox.onchange = () => handleShopPackageToggle(id);
  // shopLabel.appendChild(shopCheckbox);
  // shopLabel.append(" سعر جملة");
  card.appendChild(shopLabel);

  const addButton = document.createElement("button");
  addButton.textContent = "إضافة";
  addButton.onclick = () => addToCart(id);
  card.appendChild(addButton);

  return card;
}

// ------------------ Cart ------------------

function getProductCartPrice(product, isPackage, wholesale = false) {
  if (wholesale) {
    if (isPackage && product.priceOfPackageForShops) {
      return product.priceOfPackageForShops;
    }
    if (!isPackage && product.pricePerUnitForShops) {
      return product.pricePerUnitForShops;
    }
  }

  if (isPackage) {
    return (
      product.pricePerPackage ||
      product.pricePerUnit * (product.unitsPerPackage || 1)
    );
  }

  return product.pricePerUnit;
}

function recalcCartPrices() {
  const wholesale = elements.isQuantityOrdered?.checked || false;
  cart.forEach((item) => {
    const product = allProducts[item.id];
    if (!product) return;
    item.price = getProductCartPrice(product, item.isPackage, wholesale);
  });
}

function addToCart(id) {
  const qty = parseFloat(document.getElementById(`qty-${id}`).value);
  if (!qty || qty < 0.25) {
    alert("الكمية يجب أن تكون 0.25 أو أكثر.");
    return;
  }

  const product = allProducts[id];
  const isPackage = document.getElementById(`package-${id}`)?.checked;
  const wholesale = elements.isQuantityOrdered?.checked || false;

  const price = getProductCartPrice(product, isPackage, wholesale);

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
      isShopPackage: false,
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

  elements.totalItems.textContent = cart.length;
  elements.totalPrice.textContent = total.toFixed(2) + " جنيه";
}

window.removeFromCart = (index) => {
  cart.splice(index, 1);
  renderCart();
};

// ------------------ Submit ------------------

function sanitizeForFirestore(value) {
  if (value === undefined) return undefined;

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeForFirestore(item))
      .filter((item) => item !== undefined);
  }

  if (value && typeof value === "object") {
    const cleaned = {};
    Object.entries(value).forEach(([key, itemValue]) => {
      const cleanedValue = sanitizeForFirestore(itemValue);
      if (cleanedValue !== undefined) {
        cleaned[key] = cleanedValue;
      }
    });
    return cleaned;
  }

  return value;
}

async function submitData(type = "sale") {
  if (cart.length === 0) return alert("السلة فارغة.");

  const isQuantityOrdered = elements.isQuantityOrdered?.checked || false;
  const allowSkipCustomer = elements.allowSkipCustomer?.checked || false;
  const customerId = elements.customerSelect?.value || "";

  // If wholesale mode is checked, customer is mandatory
  if (isQuantityOrdered && !customerId) {
    return alert("يجب اختيار العميل عند تفعيل وضع عميل جملة.");
  }

  // If not wholesale, customer is mandatory unless skip is checked
  if (!isQuantityOrdered && !customerId && !allowSkipCustomer) {
    return alert("يجب اختيار العميل.");
  }

  const timestamp = new Date();

  const selectedOption = elements.customerSelect?.selectedOptions?.[0];
  const customerName = selectedOption?.textContent?.trim() || "";
  const customerMobile = selectedOption?.dataset?.mobile || "";
  const currentUser = auth.currentUser;
  const orderUserName = currentUser?.displayName || currentUser?.email || "";
  const userId = currentUser?.uid || "";

  const payload = sanitizeForFirestore({
    items: cart.map(({ id, name, quantity, price, isPackage }) => ({
      id,
      name,
      quantity,
      price,
      isPackage: Boolean(isPackage),
      type,
    })),
    total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    timestamp,
    type,
    ...(orderUserName && userId && {
      user: {
        id: userId,
        name: orderUserName,
      },
    }),
    ...(customerId && {
      customer: {
        id: customerId,
        name: customerName,
        mobile: customerMobile,
      },
    }),
  });
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

    // Reset inputs after submission
    elements.customerSearchInput.value = "";
    elements.customerSelect.value = "";
    elements.customerSelect.innerHTML = `<option value="">اختر العميل</option>`;
    elements.isQuantityOrdered.checked = false;
    elements.allowSkipCustomer.checked = false;

    renderPendingTransactions();
  } catch (e) {
    console.error("Submit error:", e);
    alert("فشل في الإرسال.");
  }
}

async function addNewCustomer() {
  const name = elements.newCustomerName.value.trim();
  const address = elements.newCustomerAddress.value.trim();
  const mobile = elements.newCustomerMobile.value.trim();

  if (!name) return alert("الاسم مطلوب.");
  if (!mobile) return alert("الهاتف مطلوب.");

  const normalizedMobile = mobile.replace(/[^0-9]/g, "");
  const duplicateCustomer = customers.find((customer) => {
    const existingMobile = String(customer.mobile || "").trim().replace(/[^0-9]/g, "");
    return existingMobile && existingMobile === normalizedMobile;
  });
  if (duplicateCustomer) {
    return alert("هذا الرقم مستخدم بالفعل لعميل آخر.");
  }

  try {
    const docRef = await addDoc(collection(db, "customers"), {
      name,
      address,
      mobile,
      createdAt: new Date(),
    });

    await loadCustomers();
    elements.customerSelect.value = docRef.id;
    elements.customerSearchInput.value = "";
    elements.newCustomerName.value = "";
    elements.newCustomerAddress.value = "";
    elements.newCustomerMobile.value = "";
    elements.newCustomerForm.style.display = "none";
    alert("تم إضافة العميل بنجاح.");
  } catch (err) {
    console.error("Add customer error:", err);
    alert("فشل في إضافة العميل.");
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
// keep the select disabled by default until search produces results
elements.customerSelect.disabled = true;
elements.customerSearchInput.addEventListener("input", () => {
  const term = elements.customerSearchInput.value;
  const digitsOnly = term.replace(/[^0-9]/g, "");
  
  // Only search if: not a pure number, OR number has at least 10 digits
  const isNumber = /^\d+$/.test(term.trim());
  if (isNumber && digitsOnly.length < 10) {
    // Skip search for numbers < 10 digits
    return;
  }
  
  renderCustomerOptions(term);
  autoSelectCustomerByNumber(term);
});
elements.isQuantityOrdered.addEventListener("change", () => {
  recalcCartPrices();
  renderCart();
});
elements.toggleCustomerFormBtn.addEventListener("click", () => {
  const isHidden =
    elements.newCustomerForm.style.display === "none" ||
    !elements.newCustomerForm.style.display;
  elements.newCustomerForm.style.display = isHidden ? "block" : "none";
  if (isHidden) {
    const val = (elements.customerSearchInput.value || "").trim();
    if (val) elements.newCustomerMobile.value = val;
    elements.newCustomerName.focus();
  }
});
elements.addCustomerBtn.addEventListener("click", addNewCustomer);
document
  .getElementById("refreshProductsBtn")
  .addEventListener("click", async () => {
    await refreshProductsFromFirestore();
    renderCategoryTags();
    renderTagTags();
    renderCompanyTags();
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
loadCustomers();
syncPendingData();
renderPendingTransactions();
