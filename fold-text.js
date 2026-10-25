(function () {
  const HINGES = {
    top: { origin: "50% 0%", axis: "rotateX", sign: -1 },
    bottom: { origin: "50% 100%", axis: "rotateX", sign: 1 },
    left: { origin: "0% 50%", axis: "rotateY", sign: 1 },
    right: { origin: "100% 50%", axis: "rotateY", sign: -1 }
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function pieceNode(content, hinge, foldStyle, startsFolded) {
    const segment = document.createElement("span");
    segment.className = "fold-text-segment";

    const piece = document.createElement("span");
    piece.className = "fold-text-piece";
    piece.dataset.foldHinge = hinge;
    piece.dataset.foldStyle = foldStyle;
    piece.dataset.foldText = content;
    piece.textContent = content;
    if (startsFolded) piece.style.opacity = "0";

    segment.appendChild(piece);
    return segment;
  }

  function buildVisual(text, splitBy, hinge, foldStyle, startsFolded) {
    const visual = document.createDocumentFragment();

    text.split(/(\s+)/).forEach((part, partIndex) => {
      if (!part) return;

      if (/^\s+$/.test(part)) {
        visual.appendChild(document.createTextNode(part));
        return;
      }

      if (splitBy === "word") {
        visual.appendChild(pieceNode(part, hinge, foldStyle, startsFolded));
        return;
      }

      const word = document.createElement("span");
      word.className = "fold-text-word";
      Array.from(part).forEach((char) => {
        word.appendChild(pieceNode(char, hinge, foldStyle, startsFolded));
      });
      visual.appendChild(word);
    });

    return visual;
  }

  function initFoldText(heading, options) {
    if (!window.gsap || heading.dataset.foldReady) return;
    heading.dataset.foldReady = "true";

    const settings = Object.assign({
      splitBy: "char",
      hinge: "top",
      foldStyle: "paper",
      duration: 0.65,
      stagger: 0.045,
      staggerFrom: "start",
      foldAngle: 92,
      ease: "power3.out",
      perspective: 700,
      creaseShading: 0.55,
      trigger: "scroll",
      loopDelay: 1.4,
      hoverRefold: true,
      refoldRadius: 140,
      refoldAngle: 45
    }, options);

    const text = heading.textContent.replace(/\s+/g, " ").trim();
    const hinge = HINGES[settings.hinge] ? settings.hinge : "top";
    const hingeConfig = HINGES[hinge];
    const startsFolded = settings.trigger !== "hover";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const root = document.createElement("span");
    root.className = "fold-text";
    root.style.setProperty("--fold-perspective", Math.max(120, settings.perspective) + "px");

    const sr = document.createElement("span");
    sr.className = "fold-text-sr-only";
    sr.textContent = text;

    const visual = document.createElement("span");
    visual.className = "fold-text-visual";
    visual.setAttribute("aria-hidden", "true");
    visual.appendChild(buildVisual(text, settings.splitBy, hinge, settings.foldStyle, startsFolded));

    root.append(sr, visual);
    heading.textContent = "";
    heading.appendChild(root);

    const elements = Array.from(root.querySelectorAll(".fold-text-piece"));
    const unfoldEase = gsap.parseEase(reduceMotion ? "power1.out" : settings.ease) || gsap.parseEase("power3.out");
    const foldEase = gsap.parseEase(reduceMotion ? "power1.in" : "power2.in");
    const angle = reduceMotion ? 0 : clamp(settings.foldAngle, 0, 180);
    const crease = reduceMotion ? 0 : clamp(settings.creaseShading, 0, 1);
    const refold = settings.hoverRefold && !reduceMotion ? clamp(settings.refoldAngle, 0, 180) : 0;
    const unfoldDuration = reduceMotion ? Math.min(settings.duration, 0.22) : settings.duration;
    const staggerVars = {
      each: reduceMotion ? Math.min(Math.max(0, settings.stagger), 0.02) : Math.max(0, settings.stagger),
      from: settings.staggerFrom
    };
    const { axis, sign, origin } = hingeConfig;

    const pieces = elements.map((element) => {
      element.style.transformOrigin = origin;
      return { element, t: startsFolded ? 0 : 1, f: 0, r: 0, aim: 0 };
    });

    const shade = (progress, tilt) => String(crease * clamp(1 - progress + tilt / 90, 0, 1));

    const render = () => {
      pieces.forEach((piece) => {
        const tilt = piece.r * refold;
        const progress = unfoldEase(piece.t) * (1 - foldEase(piece.f));
        const turn = axis + "(" + (sign * ((1 - progress) * angle + tilt)) + "deg)";
        piece.element.style.transform = turn;
        piece.element.style.opacity = String(clamp(progress, 0, 1));
        piece.element.style.setProperty("--fold-crease", shade(progress, tilt));
      });
    };

    let timeline = null;
    let scrollTrigger = null;

    const play = (loop) => {
      if (timeline) timeline.kill();
      timeline = gsap.timeline({
        onUpdate: render,
        ...(loop ? { repeat: -1, repeatDelay: 0.35 } : {})
      });
      timeline.fromTo(
        pieces,
        { t: 0, f: 0 },
        { t: 1, duration: unfoldDuration, ease: "none", stagger: staggerVars }
      );
      if (loop) {
        timeline.to(
          pieces,
          { f: 1, duration: unfoldDuration * 0.75, ease: "none", stagger: staggerVars },
          "+=" + Math.max(0, settings.loopDelay)
        );
      }
      render();
    };

    const handleEnter = () => play(false);

    if (settings.trigger === "hover") {
      render();
      root.addEventListener("mouseenter", handleEnter);
    } else if (settings.trigger === "scroll") {
      render();
      scrollTrigger = ScrollTrigger.create({
        trigger: heading,
        start: "top 86%",
        once: true,
        onEnter: handleEnter
      });
    } else {
      play(settings.trigger === "loop");
    }

    let pointer = null;
    let centers = null;
    let measured = null;
    let relaxing = false;
    const safeRadius = Math.max(1, settings.refoldRadius);

    const measure = (box) => {
      centers = pieces.map((piece) => {
        const rect = piece.element.parentElement.getBoundingClientRect();
        return {
          x: rect.left - box.left + rect.width / 2,
          y: rect.top - box.top + rect.height / 2
        };
      });
      measured = { width: box.width, height: box.height };
    };

    const relax = (time, deltaTime) => {
      const step = Math.min(deltaTime, 64) / 1000;
      let moving = false;
      pieces.forEach((piece) => {
        const rate = piece.aim > piece.r ? 14 : 6;
        piece.r += (piece.aim - piece.r) * (1 - Math.exp(-rate * step));
        if (Math.abs(piece.aim - piece.r) > 0.001) moving = true;
        else piece.r = piece.aim;
      });
      render();
      if (!moving) {
        gsap.ticker.remove(relax);
        relaxing = false;
      }
    };

    const aim = () => {
      const box = root.getBoundingClientRect();
      const near = pointer &&
        pointer.x > box.left - safeRadius &&
        pointer.x < box.right + safeRadius &&
        pointer.y > box.top - safeRadius &&
        pointer.y < box.bottom + safeRadius;

      if (near && (!centers || Math.abs(box.width - measured.width) + Math.abs(box.height - measured.height) > 1)) {
        measure(box);
      }

      let changed = false;
      pieces.forEach((piece, index) => {
        let value = 0;
        if (near) {
          const center = centers[index];
          const distance = Math.hypot(box.left + center.x - pointer.x, box.top + center.y - pointer.y) / safeRadius;
          if (distance < 1) value = 1 - distance * distance * (3 - 2 * distance);
        }
        if (value !== piece.aim) changed = true;
        piece.aim = value;
      });

      if (changed && !relaxing) {
        relaxing = true;
        gsap.ticker.add(relax);
      }
    };

    const handleMove = (event) => {
      pointer = { x: event.clientX, y: event.clientY };
      aim();
    };
    const handleLeave = () => {
      pointer = null;
      aim();
    };
    const handleScroll = () => {
      if (pointer) aim();
    };

    if (refold) {
      window.addEventListener("pointermove", handleMove, { passive: true });
      window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
      document.documentElement.addEventListener("pointerleave", handleLeave);
    }

    render();
  }

  window.initFoldText = initFoldText;
})();
