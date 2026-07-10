import { gsap } from "../../../src/index.js";
import { MorphSVGPlugin } from "../../../src/MorphSVGPlugin.js";

gsap.registerPlugin(MorphSVGPlugin);

let tl = gsap.to("#diamond", { morphSVG: "#lightning" });
