import { gsap } from "../../src/index.js";
import { ScrollTrigger } from "../../src/ScrollTrigger.js";
gsap.registerPlugin(ScrollTrigger);

const pause = document.getElementById("btn-pause");
const reverse = document.getElementById("btn-reverse");
const play = document.getElementById("btn-play");
const resume = document.getElementById("btn-resume");

// const t = gsap.timeline({
//   scrollTrigger: {
//     trigger: [".violet", ".blue"], // for multiple targets
//     // start: "-100px 40%",
//     // end: "300px 50%",
//     start: "-70px 60%",
//     end: "258px 40%",
//     scrub: true,
//     markers: true,
//     // toggleActions: 'onEnter onLeave onEnterBack onLeaveBack' // make scrub false
//   },
// });

// t.to(".violet", {
//   x: 1100,
// }).to(".blue", {
//   x: 900,
// });

// onEnter onLeave onEnterBack onLeaveBack can be [ play, pause, reverse, resume, restart, reset, complete, none ]

// gsap.to(".violet", {
//   x: 1100,
//   scrollTrigger: {
//     trigger: ".violet", // for multiple targets
//     start: "-50px center",
//     end: "300px center",
//     scrub: true,
//     markers: true,
//   },
// });

const t = gsap.to(".blue", {
  x: 900,
  // duration: 1.5,
  scrollTrigger: {
    trigger: ".blue", // for multiple targets
    start: "-70px 60%",
    end: "258px 40%",
    // start: "-50px center",
    // end: "300px center",
    // scrub: true,
    markers: true,
  },
});

pause.onclick = () => {
  t.pause();
};

reverse.onclick = () => {
  console.log("----------------------------");
  t.reverse();
};

play.onclick = () => {
  t.play();
};

resume.onclick = () => {
  t.resume();
};

// start = (top + local) - global
// end = (bottom + local) - global

// let lastScrollTop = 0; // Stores the previous scroll position

// // Add scroll event listener to the window or a specific element
// window.addEventListener('scroll', () => {
//     // Get the current vertical scroll position
//     const scrollTopPosition = window.pageYOffset || document.documentElement.scrollTop;

//     if (scrollTopPosition > lastScrollTop) {
//         // Scrolling Down
//         console.log('Scrolling Down');
//     } else if (scrollTopPosition < lastScrollTop) {
//         // Scrolling Up
//         console.log('Scrolling Up');
//     }

//     // Update the lastScrollTop for the next event
//     // Ensure it's never negative for mobile/overscroll bouncing issues
//     lastScrollTop = scrollTopPosition <= 0 ? 0 : scrollTopPosition;
// }, false);

// let lastScrollLeft = 0;

// window.addEventListener('scroll', () => {
//     const scrollLeftPosition = window.pageXOffset || document.documentElement.scrollLeft;

//     if (scrollLeftPosition > lastScrollLeft) {
//         // Scrolling Right
//         console.log('Scrolling Right');
//     } else if (scrollLeftPosition < lastScrollLeft) {
//         // Scrolling Left
//         console.log('Scrolling Left');
//     }

//     lastScrollLeft = scrollLeftPosition <= 0 ? 0 : scrollLeftPosition;
// });
