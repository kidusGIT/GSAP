import { gsap } from "../../../src/index.js";
import { MorphSVGPlugin } from "../../../src/MorphSVGPlugin.js";

gsap.registerPlugin(MorphSVGPlugin);

let tl = gsap
  .timeline({
    defaults: { duration: 1, ease: "expo.inOut" },
    // repeat: -1,
  })
  .to("#morph", { morphSVG: "#speech" })
  .to("#morph", { morphSVG: "#rocket" })
  .to("#morph", { morphSVG: "#lightning" })
  .to("#morph", { morphSVG: "#thumb" })
  .to("#morph", { morphSVG: "#square" })
  .to("#morph", { morphSVG: "#grid" })
  .to("#morph", { morphSVG: "#bulb" })
  .to("#morph", { morphSVG: "#morph" });
