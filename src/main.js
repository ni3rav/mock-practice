import { renderDesk } from "./ui/desk.js";
import { renderAttempt } from "./ui/attempt.js";
import { renderReview } from "./ui/review.js";
import { renderFileShape } from "./ui/file-shape.js";

const app = document.getElementById("app");
let cleanup = null;

function parseRoute() {
  const raw = location.hash.slice(1) || "/";
  const parts = raw.split("/").filter(Boolean);
  return parts;
}

async function navigate() {
  if (cleanup) {
    cleanup();
    cleanup = null;
  }

  const parts = parseRoute();
  app.replaceChildren();

  if (parts.length === 0 || parts[0] === "") {
    cleanup = await renderDesk(app);
    return;
  }

  if (parts[0] === "attempt" && parts[1]) {
    cleanup = await renderAttempt(app, parts[1]);
    return;
  }

  if (parts[0] === "review" && parts[1]) {
    cleanup = await renderReview(app, parts[1]);
    return;
  }

  if (parts[0] === "file") {
    cleanup = renderFileShape(app);
    return;
  }

  location.replace("#/");
}

window.addEventListener("hashchange", navigate);

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

navigate();
