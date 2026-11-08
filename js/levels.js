/**
 * 影子借步 · 影子踩开关 / Shadow Borrow Step — Shadow on Switch
 *
 * Legend:
 *   # wall
 *   . floor
 *   X hazard (spikes)
 *   P player start
 *   S shadow start
 *   E exit (player win tile; locked unless shadow on switch)
 *   W switch (shadow must stand here to open the exit)
 *
 * Rules encoded in game.js:
 *   - Player move D ⇒ shadow moves opposite
 *   - Player wall/oob/hazard ⇒ soft fail
 *   - Shadow hazard ⇒ soft fail
 *   - Shadow wall/oob ⇒ shadow STAYS (park), player still moves
 *   - Overlap ⇒ blocked
 *   - Entering exit only if shadow ends on switch; that is also the win
 *
 * All levels BFS-verified solvable under park rules.
 */
window.SHADOW_LEVELS = [
  {
    id: 1,
    name: "初识",
    tip: "影子踩住开关，门才开",
    map: [
      "#####",
      "#.PE#",
      "#.WS#",
      "#####",
    ],
  },
  {
    id: 2,
    name: "钉住",
    tip: "影子撞墙会停住——先钉在开关上再出门",
    map: [
      "#######",
      "#P....#",
      "#.W#E.#",
      "#S....#",
      "#######",
    ],
  },
  {
    id: 3,
    name: "绕行",
    tip: "墙会逼你先送影子，再走自己的路",
    map: [
      "#######",
      "#P...E#",
      "#S#W..#",
      "#######",
    ],
  },
  {
    id: 4,
    name: "尖刺",
    tip: "尖刺对你和影子都致命",
    map: [
      "########",
      "#P....E#",
      "#.#X#..#",
      "#S..W..#",
      "#..X#..#",
      "########",
    ],
  },
  {
    id: 5,
    name: "窄廊",
    tip: "走廊很窄，多一步影子就会离开开关",
    map: [
      "#########",
      "#P......#",
      "###.###.#",
      "#.......#",
      "#.S###W.#",
      "#.......#",
      "#.###.###",
      "#......E#",
      "#########",
    ],
  },
];
