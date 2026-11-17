/**
 * Masse der Kassette in mm. Vorbild ist die Compact Cassette (100,4 x 63,8 x
 * 12 mm), das Frontlayout folgt der Kassette in der App (CassetteFace):
 * Etikett oben, langes Fenster mit beiden Spulen, Fuss mit Andockloechern.
 *
 * Positionen stehen hier wie auf einer Zeichnung: Ursprung oben links,
 * y nach unten ("tl"). model.ts rechnet sie mit `at()` in three-Koordinaten
 * um (Mitte, y nach oben, z zur Seite A).
 *
 * Auf der Seite gilt 1em = 4 mm: die Kassette ist 25em x 16em gross.
 */
export const EM = 4;
export const W = 100;
export const H = 64;
/** Dicke ohne Fuss */
export const D = 12;
/** Eckradius der Schale */
export const R = 2.8;
/** Naht: halber Spalt zwischen den beiden Gehaeusehaelften */
export const GAP = 0.125;
/** Fase an allen Kanten der Schale */
export const BEVEL = 0.55;
/**
 * Die Schale ist hohl wie beim Vorbild: vorne eine Platte mit dem Fensterloch,
 * aussen herum eine Wand bis zur Naht. Sonst waere das Fenster ein tiefer
 * Tunnel und die Wickel verschwaenden beim Kippen hinter seinen Waenden.
 */
export const PLATE = 1.6;
export const WALL = 1.4;

export const WIN = { x: 6.4, y: 26.4, w: 87.2, h: 17.6, r: 1.4 };
/** Die Scheibe liegt innen an der Platte. */
export const RECESS = PLATE + 0.1;
/** Die Scheibe ist rundum etwas groesser als das Loch und steckt unter der Schale. */
export const GLASS_LIP = 1.2;

export const REEL_Y = WIN.y + WIN.h / 2;
export const REEL_X = [24, 76] as const;
/** Bandwickel leer/voll. Voll ist er groesser als das Fenster, wie echt. */
export const PACK_MIN = 3.8;
export const PACK_MAX = 9.4;
/** Bandbreite: 3,81 mm wie beim echten Band */
export const TAPE_W = 3.81;
export const HUB_R = 2.56;
export const HUB_HOLE = 1.45;

export const LABEL = { x: 4.4, y: 3.2, w: 91.2, h: 21.2, r: 0.75 };
/** Papierstaerke */
export const LABEL_T = 0.12;

export const SCREWS: [number, number][] = [
  [2.5, 2.5],
  [W - 2.5, 2.5],
  [2.5, H - 2.5],
  [W - 2.5, H - 2.5],
];

/** Fuss-Trapez: oben 16 bis 84 %, unten 12 bis 88 %, wie in der App. */
export const FOOT = { top: 54.8, topL: 16, topR: 84, botL: 12, botR: 88, h: 0.8 };
export const FOOT_HOLE_Y = FOOT.top + (H - FOOT.top) * 0.55;
/** Andockloecher: aussen rund, innen schmal */
export const FOOT_HOLES: { x: number; round: boolean }[] = [
  { x: 20, round: true },
  { x: 40.8, round: false },
  { x: 59.2, round: false },
  { x: 80, round: true },
];

/** Bandlauf innen: Umlenkrollen und die Linie an der Unterkante */
export const GUIDES: [number, number][] = [
  [10.4, 52.4],
  [W - 10.4, 52.4],
];
export const GUIDE_R = 1.2;
export const BAND_Y = 60.6;

/** Loeschschutz-Aussparungen oben in der hinteren Haelfte */
export const TABS = [
  { x: 6.5, w: 5 },
  { x: W - 11.5, w: 5 },
];
export const TAB_DEPTH = 1.1;

/** Das ↻-Zeichen der App, rechts unter dem Fenster */
export const MARK = { x: WIN.x + WIN.w - 1.2, y: WIN.y + WIN.h + 4.4 };

/**
 * Wie weit das Canvas um die Kassette herum reicht (em). Gedrehte Ecken und
 * die Perspektive brauchen Platz, sonst werden sie abgeschnitten.
 */
export const MARGIN_EM = 3;
/** Abstand der Kamera, wie die bisherige CSS-perspective von 110em */
export const CAMERA_Z = 110 * EM;
