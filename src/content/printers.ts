export type PrinterCategory = "scratch-builds" | "v0-mods" | "barely-bigger";

export type PrinterConfig = {
  id: string;
  title: string;
  subline: string;
  description: string;
  github: {
    url: string;
    branch: string;
    readme: string;
  };
  documentation_pdf?: string;
  category: PrinterCategory;
  mods: {
    repo: string;
    path: string;
  }[];
};

export const printers: PrinterConfig[] = [
  {
    id: "dueling-zero",
    title: "Dueling Zero",
    subline: "Two extruders. No compromises. Dual Gantry FTW.",
    description:
      "Enable dual-color, dual-material, and dual-part printing... with the same speed and quality as single-extruder printing. Mod a Voron Zero or build one fresh!",
    github: {
      url: "https://github.com/zruncho3d/DuelingZero",
      branch: "main",
      readme: "README.md",
    },
    category: "v0-mods",
    mods: [],
  },
  {
    id: "double-dragon",
    title: "Double Dragon",
    subline: "Double the filament, double the fun.",
    description:
      "A V0 mod to add Independent Dual Extrusion (IDEX). X0 for short. X0 adds a second printhead to a V0 to enable multi-color prints, multi-material prints, and even overhangs atop dissolvable supports.",
    github: {
      url: "https://github.com/zruncho3d/double-dragon",
      branch: "main",
      readme: "README.md",
    },
    category: "v0-mods",
    mods: [],
  },
  {
    id: "crucible",
    title: "Crucible",
    subline: "Triple leadscrews? In my V0?",
    description:
      "A V0 mod inspired by the Trident. Converts the bed from a single-leadscrew cantilevered mount to a three-leadscrew mount and enables automatic bed leveling with Klicky or SideSwipe.",
    github: {
      url: "https://github.com/PrintersForAnts/Crucible",
      branch: "main",
      readme: "README.md",
    },
    category: "v0-mods",
    mods: [],
  },
  {
    id: "f-zero",
    title: "F-Zero",
    subline: "Perfect first layers every time.",
    description:
      "A V0 mod for a flying gantry. Uses quad gantry leveling, just like a Voron 2.4 or a Micron. (The main difference from the Micron is that the F-Zero is a V0 mod, and the Micron is a from-scratch build.)",
    github: {
      url: "https://github.com/zruncho3d/f-zero",
      branch: "main",
      readme: "README.md",
    },
    category: "v0-mods",
    mods: [],
  },
  {
    id: "tri-zero",
    title: "Tri-Zero",
    subline: "The triple-belted-Z V0 mod.",
    description:
      "A Voron Zero mod to add Automatic Bed Leveling - under $100, in only a few hours. Provides the quality-of-life benefits of flying-gantry mods like F-Zero, but in a fraction of the build time, at much lower cost.",
    github: {
      url: "https://github.com/zruncho3d/tri-zero",
      branch: "main",
      readme: "README.md",
    },
    category: "v0-mods",
    mods: [
      {
        repo: "zruncho3d/tri-zero",
        path: "Mods/*/*/",
      },
    ],
  },
  {
    id: "pandoras-box",
    title: "Pandora's Box",
    subline: "Open if you dare.",
    description:
      "Almost a scratch build, but uses most of its parts from the Voron V0. With a custom triple belted Z and gantry, a whopping 142mm of X travel, 127mm of Y travel and 127mm of Z travel is available in a package only slightly taller than a stock V0.",
    github: {
      url: "https://github.com/masturmynd/pandoras_box/",
      branch: "main",
      readme: "README.md",
    },
    category: "v0-mods",
    mods: [
      {
        repo: "masturmynd/pandoras_box",
        path: "Mods/*/*/",
      },
    ],
  },
  {
    id: "hex-zero",
    title: "Hex-Zero",
    subline: "Hexagons are best-agons.",
    description:
      "Derived from Tri-Zero and Pandora's gantry with some nice QOL improvements. Increased rigidity in the flying bed, optional pinned bearing joints and honeycomb aesthetic.",
    github: {
      url: "https://github.com/Alexander-T-Moss/Hex-Zero",
      branch: "main",
      readme: "README.md",
    },
    category: "v0-mods",
    mods: [
      {
        repo: "Alexander-T-Moss/Hex-Zero",
        path: "Mods/*/*/",
      },
    ],
  },
  {
    id: "micron",
    title: "Micron",
    subline: "Everything is smaller but the price.",
    description:
      "A from-scratch build using 1515 extrusion like the V0, but with the design of a Voron 2.4 scaled down. Uses quad-gantry leveling, just like a Voron 2.4.",
    github: {
      url: "https://github.com/hartk1213/Micron",
      branch: "main",
      readme: "README.md",
    },
    documentation_pdf:
      "https://github.com/PrintersForAnts/Micron/blob/main/Documentation/Micron_R1_Manual_WIP.pdf",
    category: "scratch-builds",
    mods: [
      {
        repo: "PrintersForAnts/Micron",
        path: "Mods/*/*/",
      },
    ],
  },
  {
    id: "salad-fork",
    title: "Salad Fork",
    subline: "Honey, I shrunk the Trident!",
    description:
      "A from-scratch build using 1515 extrusions like the V0, but with the design of a Trident scaled down. Uses a triple-leadscrew mount for the bed and enables automatic bed leveling with Klicky.",
    github: {
      url: "https://github.com/PrintersForAnts/Salad_Fork",
      branch: "master",
      readme: "README.md",
    },
    category: "scratch-builds",
    mods: [],
  },
  {
    id: "tiny-m",
    title: "Tiny-M",
    subline: "Not fat, just big-boned.",
    description:
      "A V0 scaled up to 2020 extrusions, with a slightly-larger 150mm³ (and unofficially 190mm³) build volume.",
    github: {
      url: "https://github.com/gsl12/Tiny-M",
      branch: "master",
      readme: "README.md",
    },
    category: "barely-bigger",
    mods: [
      {
        repo: "gsl12/Tiny-M",
        path: "usermods/*/",
      },
    ],
  },
  {
    id: "tiny-t",
    title: "Tiny-T",
    subline: "A tiny Trident.",
    description:
      "A Trident scaled down to same 150mm³ build volume as the bigger Salad Fork.",
    github: {
      url: "https://github.com/PrintersForAnts/Tiny-T",
      branch: "main",
      readme: "readme.md",
    },
    category: "barely-bigger",
    mods: [
      {
        repo: "PrintersForAnts/Tiny-T",
        path: "MODS/*/",
      },
    ],
  },
];
