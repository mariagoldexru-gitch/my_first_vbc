(function () {
  const falloff = (distance, radius) => {
    if (distance >= radius) return 0;
    const f = 1 - (distance / radius) ** 2;
    return f * f;
  };

  function glyphFrom(chars) {
    return chars[Math.floor(Math.random() * chars.length)] || ".";
  }

  function initScrambledText(root, options) {
    if (!root || root.dataset.scrambleReady) return;
    root.dataset.scrambleReady = "true";

    const settings = Object.assign({
      radius: 100,
      duration: 1.2,
      speed: 0.3,
      scrambleChars: ".:",
      strength: 1,
      trail: 0.6,
      clickBurst: true,
      intro: true
    }, options);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const plain = root.textContent.replace(/\s+/g, " ").trim();
    const sr = document.createElement("span");
    sr.className = "fold-text-sr-only";
    sr.textContent = plain;
    root.prepend(sr);
    const chars = [];

    const wrap = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        Array.from(node.textContent).forEach((character) => {
          const el = document.createElement("span");
          el.className = "scramble-char";
          el.textContent = character;
          if (character.trim() === "") el.style.whiteSpace = "pre";
          frag.appendChild(el);
          chars.push({ el, original: character, until: 0, next: 0, active: false });
        });
        node.replaceWith(frag);
        return;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        [...node.childNodes].forEach(wrap);
      }
    };

    [...root.childNodes].forEach((node) => {
      if (node === sr) return;
      wrap(node);
    });
    chars.forEach((item) => item.el.setAttribute("aria-hidden", "true"));

    const points = chars.map(() => ({ x: 0, y: 0 }));
    let measured = false;
    let raf = 0;
    let last = 0;
    const pointer = { x: 0, y: 0, inside: false };
    const waves = [];
    const swapEvery = Math.max(16, settings.speed * 90);

    const measure = () => {
      const box = root.getBoundingClientRect();
      chars.forEach((item, index) => {
        const rect = item.el.getBoundingClientRect();
        points[index].x = rect.left - box.left + rect.width / 2;
        points[index].y = rect.top - box.top + rect.height / 2;
      });
      measured = true;
    };

    const startScramble = (item, length) => {
      if (!item.original.trim()) return;
      const now = performance.now();
      item.until = Math.max(item.until, now + length * 1000);
      item.active = true;
      wake();
    };

    const frame = (now) => {
      raf = 0;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      let busy = false;

      chars.forEach((item) => {
        if (!item.active) return;
        busy = true;
        if (now >= item.until) {
          item.el.textContent = item.original;
          item.active = false;
          return;
        }
        if (now >= item.next) {
          item.el.textContent = glyphFrom(settings.scrambleChars);
          item.next = now + swapEvery;
        }
      });

      for (let i = waves.length - 1; i >= 0; i -= 1) {
        const wave = waves[i];
        wave.age += dt;
        const t = Math.min(1, wave.age / wave.life);
        wave.r = wave.reach * (1 - (1 - t) * (1 - t));
        chars.forEach((item, index) => {
          if (wave.hit[index]) return;
          const point = points[index];
          const distance = Math.hypot(point.x - wave.x, point.y - wave.y);
          if (distance > wave.r) return;
          wave.hit[index] = 1;
          const strengthAt = 1 - (0.6 * distance) / wave.reach;
          startScramble(item, Math.max(0.2, settings.duration * (0.2 + 0.5 * strengthAt)));
        });
        if (wave.age >= wave.life) waves.splice(i, 1);
        else busy = true;
      }

      if (busy) raf = requestAnimationFrame(frame);
      else last = 0;
    };

    const wake = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    if (settings.intro && !reduce) {
      const count = Math.max(1, chars.length);
      chars.forEach((item, index) => {
        if (!item.original.trim()) return;
        const reveal = 0.15 + settings.duration * (0.75 * (index / count) + 0.25 * Math.random());
        item.el.textContent = glyphFrom(settings.scrambleChars);
        startScramble(item, reveal + 0.1);
        item.until = performance.now() + (reveal + 0.1) * 1000;
      });
    }

    const localPoint = (event) => {
      const rect = root.getBoundingClientRect();
      return [event.clientX - rect.left, event.clientY - rect.top];
    };

    root.addEventListener("pointermove", (event) => {
      if (!measured) measure();
      const [x, y] = localPoint(event);
      pointer.x = x;
      pointer.y = y;
      pointer.inside = true;
      chars.forEach((item, index) => {
        const distance = Math.hypot(x - points[index].x, y - points[index].y);
        if (distance < settings.radius) {
          startScramble(item, settings.duration * (1 - distance / settings.radius));
        }
      });
    });

    root.addEventListener("pointerleave", () => {
      pointer.inside = false;
    });

    root.addEventListener("pointerdown", (event) => {
      if (!settings.clickBurst || (event.pointerType === "mouse" && event.button !== 0)) return;
      if (!measured) measure();
      const [x, y] = localPoint(event);
      let reach = 0;
      points.forEach((point) => {
        reach = Math.max(reach, Math.hypot(point.x - x, point.y - y));
      });
      reach += 24;
      if (waves.length > 3) waves.shift();
      waves.push({
        x, y, age: 0, r: 0, reach,
        life: 0.45 + reach / 1100,
        hit: new Uint8Array(chars.length)
      });
      wake();
    });
  }

  window.initScrambledText = initScrambledText;
})();
