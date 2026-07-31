document.querySelectorAll("a[href^='#']").forEach(function (a) {
  a.addEventListener("click", function (e) {
    var target = document.querySelector(a.getAttribute("href"));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: "smooth" }); }
  });
});

function showError(msg) {
  var el = document.getElementById("form-error");
  if (!el) {
    el = document.createElement("p");
    el.id = "form-error";
    el.style.cssText = [
      "font-family:IBM Plex Mono,monospace",
      "font-size:0.65rem",
      "color:#ff4d6d",
      "margin-bottom:14px",
      "padding:10px 14px",
      "background:rgba(255,77,109,0.08)",
      "border:1px solid rgba(255,77,109,0.25)",
      "border-radius:3px"
    ].join(";");
    document.getElementById("submit-btn").before(el);
  }
  el.textContent = "// Error: " + msg;
}

document.getElementById("submit-btn").addEventListener("click", function () {
  var name  = document.getElementById("name").value.trim();
  var gmail = document.getElementById("gmail").value.trim();
  var phone = document.getElementById("phone").value.trim();

  if (!name)  { showError("Please enter your full name."); return; }
  if (!gmail || !gmail.toLowerCase().endsWith("@gmail.com")) {
    showError("Please enter a valid Gmail address."); return;
  }
  if (!phone) { showError("Please enter your contact number."); return; }

  var oldErr = document.getElementById("form-error");
  if (oldErr) oldErr.remove();

  document.getElementById("form-wrap").style.display   = "none";
  document.getElementById("success-msg").style.display = "block";
  document.getElementById("waitlist").scrollIntoView({ behavior: "smooth" });
});
