// js/products.js

const form = document.getElementById("productForm");
const productList = document.getElementById("productList");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const category = document.getElementById("category").value.trim();
  const name = document.getElementById("productName").value.trim();
  const price = parseFloat(document.getElementById("productPrice").value);

  if (!category || !name || isNaN(price))
    return alert("Fill all fields correctly.");

  try {
    await db.collection("products").add({ category, name, price });
    alert("Product added!");
    form.reset();
    loadProducts();
  } catch (err) {
    console.error(err);
    alert("Error adding product.");
  }
});

async function loadProducts() {
  productList.innerHTML = "Loading...";
  try {
    const snapshot = await db.collection("products").orderBy("category").get();
    productList.innerHTML = "";
    snapshot.forEach((doc) => {
      const { category, name, price } = doc.data();
      const li = document.createElement("li");
      li.innerHTML = `<strong>${category}</strong>: ${name} - $${price.toFixed(
        2
      )} <button onclick="deleteProduct('${doc.id}')">Delete</button>`;
      productList.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    productList.innerHTML = "Failed to load.";
  }
}

async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;
  try {
    await db.collection("products").doc(id).delete();
    loadProducts();
  } catch (err) {
    alert("Delete failed.");
  }
}

loadProducts();
