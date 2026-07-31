// ── Replace this with your actual Worker URL ──────────────────
const WORKER_URL = "https://labreach-worker.YOUR_SUBDOMAIN.workers.dev";
// ─────────────────────────────────────────────────────────────

document.querySelectorAll("a[href^='#']").forEach((a) => {
  a.addEventListener("click", (e) => {
    const target = document.querySelector(a.getAttribute("href"));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: "smooth" }); }
  });
});

function showError(msg) {
  let el = document.getElementById("form-error");
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

function setLoading(on) {
  const btn       = document.getElementById("submit-btn");
  btn.disabled    = on;
  btn.textContent = on ? "Submitting…" : "Submit Request →";
}

document.getElementById("submit-btn").addEventListener("click", async () => {
  const name  = document.getElementById("name").value.trim();
  const gmail = document.getElementById("gmail").value.trim();
  const phone = document.getElementById("phone").value.trim();

  // Clear old error
  const oldErr = document.getElementById("form-error");
  if (oldErr) oldErr.remove();

  // Validate first — no network call needed if inputs are wrong
  if (!name)  { showError("Please enter your full name."); return; }
  if (!gmail || !gmail.toLowerCase().endsWith("@gmail.com")) {
    showError("Please enter a valid Gmail address."); return;
  }
  if (!phone) { showError("Please enter your contact number."); return; }

  setLoading(true);

  try {
    // 1. Send the request to the Worker
    const response = await fetch(WORKER_URL + "/api/waitlist", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name, email: gmail, phone })
    });

    // 2. Wait for the response body to be parsed
    const data = await response.json();

    // 3. Now decide what to show based on what came back
    if (response.status === 201) {
      document.getElementById("form-wrap").style.display   = "none";
      document.getElementById("success-msg").style.display = "block";
      document.getElementById("waitlist").scrollIntoView({ behavior: "smooth" });

    } else if (response.status === 409) {
      showError("This email is already on the waitlist.");

    } else {
      showError(data.error || "Something went wrong. Please try again.");
    }

  } catch (err) {
    // Network failure — Worker unreachable
    console.error("Fetch error:", err);
    showError("Could not reach the server. Check your connection and try again.");

  } finally {
    // Always unlock the button when done, success or fail
    setLoading(false);
  }
});