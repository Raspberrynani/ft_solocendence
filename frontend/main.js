// frontend/main.js
document.getElementById("testButton").addEventListener("click", async () => {
    let response = await fetch("http://127.0.0.1:8000/api/test/");
    let data = await response.json();
    document.getElementById("response").innerText = data.message;
});
