/**
 * 影子借步 · 影子踩开关 / Shadow Borrow Step — Shadow on Switch
 *
 * Legend:
 *   # wall  . floor  X hazard
 *   P player  S shadow  E exit  W switch
 *   I ice (slide in move direction until stop)
 *   U/D/L/R jump pad (leap 2 cells in that direction; can skip hazards)
 *   > < ^ v one-way (may only step onto in arrow direction)
 *   A portal A   @ portal B + exit   B portal B (if not @)
 *
 * All 20 levels BFS-verified solvable.
 */
window.SHADOW_LEVELS = [
  {
    id: 1,
    name: "初识",
    tip: "影子踩住开关，门才开。你走一步，影子反一步。",
    hintText: "推荐：右（共 1 步）",
    solution: ["right"],
    map: [
      "#####",
      "#.PE#",
      "#.WS#",
      "#####"
    ],
  },
  {
    id: 2,
    name: "钉住",
    tip: "影子撞墙会停住——先钉在开关上再出门",
    hintText: "推荐：右 → 右 → 右 → …（共 6 步）",
    solution: ["right", "right", "right", "right", "down", "left"],
    map: [
      "#######",
      "#P....#",
      "#.W#E.#",
      "#S....#",
      "#######"
    ],
  },
  {
    id: 3,
    name: "绕行",
    tip: "墙会逼你先送影子，再走自己的路",
    hintText: "推荐：右 → 右 → 下 → …（共 10 步）",
    solution: ["right", "right", "down", "right", "right", "left", "left", "up", "right", "right"],
    map: [
      "#######",
      "#P...E#",
      "#S#W..#",
      "#######"
    ],
  },
  {
    id: 4,
    name: "尖刺",
    tip: "尖刺对你和影子都致命",
    hintText: "推荐：右 → 右 → 右 → …（共 19 步）",
    solution: ["right", "right", "right", "right", "down", "down", "left", "left", "left", "down", "left", "up", "right", "right", "right", "right", "up", "right", "up"],
    map: [
      "########",
      "#P....E#",
      "#.#X#..#",
      "#S..W..#",
      "#..X#..#",
      "########"
    ],
  },
  {
    id: 5,
    name: "窄廊",
    tip: "走廊很窄，多一步影子就会离开开关",
    hintText: "推荐：右 → 右 → 下 → …（共 32 步）",
    solution: ["right", "right", "down", "down", "right", "right", "right", "down", "down", "left", "down", "down", "up", "up", "right", "right", "left", "left", "down", "down", "left", "left", "left", "left", "up", "down", "right", "right", "right", "right", "right", "right"],
    map: [
      "#########",
      "#P......#",
      "###.###.#",
      "#.......#",
      "#.S###W.#",
      "#.......#",
      "#.###.###",
      "#......E#",
      "#########"
    ],
  },
  {
    id: 6,
    name: "滑冰",
    tip: "蓝冰会沿移动方向一直滑到头",
    hintText: "推荐：右（共 1 步）",
    solution: ["right"],
    map: [
      "########",
      "#....PE#",
      "#......#",
      "#...WIS#",
      "########"
    ],
  },
  {
    id: 7,
    name: "冰廊",
    tip: "先把影子送到冰右侧，再一步滑上开关出门",
    hintText: "推荐：下 → 右 → 左 → …（共 27 步）",
    solution: ["down", "right", "left", "down", "left", "right", "up", "left", "down", "left", "right", "up", "left", "down", "left", "right", "up", "left", "up", "left", "left", "down", "down", "right", "right", "up", "up"],
    map: [
      "##########",
      "#......PE#",
      "#........#",
      "#S....WI.#",
      "##########"
    ],
  },
  {
    id: 8,
    name: "弹跳",
    tip: "橙色箭头格会朝箭头方向跳两格（可越刺）",
    hintText: "推荐：下 → 下 → 右 → …（共 18 步）",
    solution: ["down", "down", "right", "right", "left", "left", "left", "left", "left", "left", "right", "right", "right", "right", "right", "right", "up", "up"],
    map: [
      "##########",
      "#....P.RE#",
      "#........#",
      "#S......W#",
      "##########"
    ],
  },
  {
    id: 9,
    name: "弹钉",
    tip: "影子踩上弹板会被弹两格——对准开关",
    hintText: "推荐：下 → 左 → 左 → …（共 7 步）",
    solution: ["down", "left", "left", "right", "right", "right", "up"],
    map: [
      "########",
      "#....PE#",
      "#......#",
      "#..WR.S#",
      "########"
    ],
  },
  {
    id: 10,
    name: "冰弹",
    tip: "先滑再弹，落点要想清楚",
    hintText: "推荐：下 → 下 → 右 → …（共 19 步）",
    solution: ["down", "down", "right", "right", "left", "left", "left", "left", "left", "left", "right", "right", "right", "right", "right", "right", "right", "up", "up"],
    map: [
      "###########",
      "#....P.IRE#",
      "#.........#",
      "#S.......W#",
      "###########"
    ],
  },
  {
    id: 11,
    name: "传送门",
    tip: "紫门成对：踩 A 传到出口。本关起提示需看广告",
    hintText: "推荐：右 → 右（共 2 步）",
    solution: ["right", "right"],
    map: [
      "########",
      "#P.A...#",
      "#......#",
      "#...W.S#",
      "#...@..#",
      "########"
    ],
  },
  {
    id: 12,
    name: "门桥",
    tip: "先就位再进传送门；影子要对准开关",
    hintText: "推荐：下 → 右 → 右 → …（共 25 步）",
    solution: ["down", "right", "right", "right", "right", "right", "right", "down", "right", "left", "left", "down", "down", "down", "left", "left", "down", "down", "down", "left", "left", "down", "down", "up", "up"],
    map: [
      "##########",
      "#.......A#",
      "#P.......#",
      "#S.....W.#",
      "#.....@..#",
      "##########"
    ],
  },
  {
    id: 13,
    name: "单向道",
    tip: "箭头格只能沿箭头方向踩上去",
    hintText: "推荐：右 → 下 → 下 → …（共 18 步）",
    solution: ["right", "down", "down", "right", "left", "left", "right", "left", "right", "left", "right", "right", "right", "right", "right", "up", "up", "left"],
    map: [
      "########",
      "#P>>>E.#",
      "#......#",
      "#S....W#",
      "########"
    ],
  },
  {
    id: 14,
    name: "冰门",
    tip: "滑向传送门，影子同时踩开关",
    hintText: "推荐：右 → 右 → 下 → …（共 8 步）",
    solution: ["right", "right", "down", "left", "up", "left", "right", "right"],
    map: [
      "#########",
      "#P.I.A..#",
      "#.......#",
      "#....W.S#",
      "#....@..#",
      "#########"
    ],
  },
  {
    id: 15,
    name: "跳过刺",
    tip: "弹板跳两格，可越过尖刺",
    hintText: "推荐：下 → 下 → 右 → …（共 21 步）",
    solution: ["down", "down", "right", "right", "right", "left", "left", "left", "left", "left", "up", "right", "right", "down", "up", "right", "right", "down", "up", "left", "up"],
    map: [
      "##########",
      "#....PRXE#",
      "#........#",
      "#S......W#",
      "##########"
    ],
  },
  {
    id: 16,
    name: "双钉",
    tip: "先把影子钉好，再绕路出门",
    hintText: "推荐：右 → 左 → 下 → …（共 32 步）",
    solution: ["right", "left", "down", "down", "right", "down", "down", "left", "up", "up", "up", "up", "right", "right", "right", "left", "left", "left", "down", "up", "right", "right", "right", "right", "right", "right", "down", "down", "down", "down", "up", "right"],
    map: [
      "###########",
      "#P........#",
      "#.##W##...#",
      "#S....#...#",
      "#.....#.E.#",
      "#.....#...#",
      "###########"
    ],
  },
  {
    id: 17,
    name: "冰迷宫",
    tip: "冰块连成片，停靠点很少",
    hintText: "推荐：右 → 左 → 下 → …（共 14 步）",
    solution: ["right", "left", "down", "down", "right", "right", "left", "left", "right", "right", "down", "down", "left", "left"],
    map: [
      "############",
      "#P.IIIIIII.#",
      "#.#......#.#",
      "#S.IIIIIIIW#",
      "#.#......#.#",
      "#.......E..#",
      "############"
    ],
  },
  {
    id: 18,
    name: "弹传",
    tip: "弹进传送门，影子对准开关",
    hintText: "推荐：右 → 右（共 2 步）",
    solution: ["right", "right"],
    map: [
      "##########",
      "#P.R.A...#",
      "#........#",
      "#.....W.S#",
      "#.....@..#",
      "##########"
    ],
  },
  {
    id: 19,
    name: "三重奏",
    tip: "冰、弹、门一起用",
    hintText: "推荐：右 → 右 → 下 → …（共 8 步）",
    solution: ["right", "right", "down", "left", "up", "left", "right", "right"],
    map: [
      "###########",
      "#P.I.R.A..#",
      "#.........#",
      "#......W.S#",
      "#......@..#",
      "###########"
    ],
  },
  {
    id: 20,
    name: "终章",
    tip: "综合关：弹跳越过尖刺，再传门冲关",
    hintText: "推荐：下 → 右 → 右 → …（共 13 步）",
    solution: ["down", "right", "right", "right", "down", "right", "left", "left", "left", "right", "right", "up", "up"],
    map: [
      "##########",
      "#P..R.A..#",
      "#........#",
      "#.....W.S#",
      "#..X..@..#",
      "##########"
    ],
  }
];
