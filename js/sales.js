// js/sales.js

async function loadSales() {
  const salesList = document.getElementById("salesList");
  salesList.innerHTML = "Loading...";

  try {
    const snapshot = await db
      .collection("sales")
      .orderBy("timestamp", "desc")
      .get();
    salesList.innerHTML = "";

    snapshot.forEach((doc) => {
      const data = doc.data();
      const li = document.createElement("li");
      const date = data.timestamp.toDate().toLocaleString();
      const itemsText = data.items
        .map((i) => `${i.name} ($${i.price})`)
        .join(", ");
      li.innerHTML = `<strong>${date}</strong><br>${itemsText}<br>Total: $${data.total.toFixed(
        2
      )}<hr>`;
      salesList.appendChild(li);
    });
  } catch (error) {
    salesList.innerHTML = "Failed to load sales.";
    console.error(error);
  }
}

loadSales();
