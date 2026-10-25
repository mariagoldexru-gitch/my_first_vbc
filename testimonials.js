(function () {
  const root = document.querySelector("[data-reviews]");
  if (!root) return;

  const cards = [...root.querySelectorAll("[data-review]")];
  const prev = root.querySelector("[data-review-prev]");
  const next = root.querySelector("[data-review-next]");
  const dotsWrap = root.querySelector("[data-review-dots]");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!cards.length || !dotsWrap) return;

  let index = 0;
  let drag = null;
  let busy = false;

  const dots = cards.map((_, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "review-dot cursor-target";
    dot.dataset.cursorLabel = "Отзыв " + (i + 1);
    dot.setAttribute("aria-label", "Отзыв " + (i + 1));
    dot.addEventListener("click", () => jump(i));
    dotsWrap.appendChild(dot);
    return dot;
  });

  const place = () => {
    cards.forEach((card, i) => {
      const depth = (i - index + cards.length) % cards.length;
      card.hidden = depth > 2;
      card.classList.toggle("is-front", depth === 0);
      card.classList.toggle("is-mid", depth === 1);
      card.classList.toggle("is-back", depth === 2);
      card.style.zIndex = depth === 0 ? "3" : depth === 1 ? "2" : "1";
      card.setAttribute("aria-hidden", depth === 0 ? "false" : "true");
      if (!drag) card.style.transform = "";
    });
    dots.forEach((dot, i) => {
      const on = i === index;
      dot.classList.toggle("is-on", on);
      if (on) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
  };

  const commit = (dir) => {
    const front = cards[index];
    if (reduce) {
      index = (index + dir + cards.length) % cards.length;
      place();
      return;
    }
    busy = true;
    front.style.transition = "transform 0.22s ease";
    front.style.transform = "translateX(" + (dir * 120) + "%) rotate(" + (dir * 8) + "deg)";
    window.setTimeout(() => {
      front.style.transition = "";
      front.style.transform = "";
      index = (index + dir + cards.length) % cards.length;
      busy = false;
      place();
    }, 200);
  };

  const jump = (target) => {
    if (busy || target === index) return;
    const forward = (target - index + cards.length) % cards.length;
    const dir = forward <= cards.length / 2 ? 1 : -1;
    const front = cards[index];
    if (reduce) {
      index = target;
      place();
      return;
    }
    busy = true;
    front.style.transition = "transform 0.22s ease";
    front.style.transform = "translateX(" + (dir * 120) + "%) rotate(" + (dir * 8) + "deg)";
    window.setTimeout(() => {
      front.style.transition = "";
      front.style.transform = "";
      index = target;
      busy = false;
      place();
    }, 200);
  };

  prev?.addEventListener("click", () => {
    if (!busy) commit(-1);
  });
  next?.addEventListener("click", () => {
    if (!busy) commit(1);
  });

  const frontCard = () => cards[index];

  root.addEventListener("pointerdown", (event) => {
    if (busy || event.button !== 0 || event.target.closest("button")) return;
    const front = frontCard();
    if (!front.contains(event.target)) return;
    drag = { id: event.pointerId, x: event.clientX, dx: 0 };
    front.style.transition = "none";
    front.setPointerCapture(event.pointerId);
  });

  root.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    drag.dx = event.clientX - drag.x;
    frontCard().style.transform = "translateX(" + drag.dx + "px) rotate(" + (drag.dx / 20) + "deg)";
  });

  const release = (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = drag.dx;
    const front = frontCard();
    drag = null;
    if (Math.abs(dx) > 90) {
      const dir = dx < 0 ? 1 : -1;
      busy = true;
      front.style.transition = "transform 0.2s ease";
      front.style.transform = "translateX(" + (dir * 120) + "%) rotate(" + (dir * 8) + "deg)";
      window.setTimeout(() => {
        front.style.transition = "";
        front.style.transform = "";
        index = (index + dir + cards.length) % cards.length;
        busy = false;
        place();
      }, 200);
      return;
    }
    front.style.transition = "transform 0.25s cubic-bezier(0.16, 0.84, 0.32, 1)";
    front.style.transform = "";
  };

  root.addEventListener("pointerup", release);
  root.addEventListener("pointercancel", release);
  place();
})();
