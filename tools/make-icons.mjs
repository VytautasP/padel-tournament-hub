/**
 * Draws the app mark and rasterizes the icon set the web app manifest needs.
 *
 * The composition follows `examples/icon_sample.png`: a padel racket over a trophy, a ball at the
 * racket's shoulder, and a bracket ring of three nodes around the whole thing. The sample's navy
 * and lime are not this app's colours, so every value below is mapped onto ADR-0021 instead — the
 * `brand-strong` → `surface-sunken` ramp behind, `brand` (dark) for the ring, `brand-ink` for the
 * racket and trophy, and `podium-gold` (dark) for the ball.
 *
 * The geometry lives here rather than in a checked-in SVG so that the "any" and "maskable"
 * variants cannot drift: they are the same drawing at two scales. Maskable icons are cropped to
 * the inner 80% circle by the platform, so that variant draws smaller inside the same full-bleed
 * background (https://w3c.github.io/manifest/#icon-masks).
 *
 *   npm run icons
 *
 * ADR-0021 §6 calls the palette a starting position rather than a monument, and this mark is the
 * same: it is a defensible placeholder drawn from the tokens, meant to be replaced by something
 * drawn by someone who draws.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const OUT_DIR = fileURLToPath(new URL('../projects/padel-app/public/icons/', import.meta.url));

/**
 * ADR-0021 §1 and the dark half of the ramp in `styles.css`. `DEEP` is the one value here that is
 * not a token: it is `brand-strong` darkened, used for the racket's holes and for the halo that
 * separates two white shapes from each other. An icon is an asset rather than a component, so
 * ADR-0018 §1's "no component names a colour" does not reach it — but staying on the ramp is the
 * point of having one.
 */
const BRAND_STRONG = '#0a5568';
const SURFACE_SUNKEN = '#080b0f';
const RING = '#3fa8c4';
const INK = '#ffffff';
const BALL = '#e0a44a';
const DEEP = '#0a2f3c';

const SIZE = 512;
const MID = SIZE / 2;

/** The bracket ring: an arc open at the top, where the trophy sits, and three nodes on it. */
const RING_Y = 268;
const RING_R = 168;
const RING_STROKE = 20;
const NODE_R = 26;

/** The racket head, and the hole grid punched through its face. */
const HEAD = { x: 192, y: 70, w: 128, h: 180, r: 44 };
const HOLE_R = 7.5;
const HOLE_COLS = 5;
const HOLE_ROWS = 5;

function holes() {
  const stepX = 23;
  const stepY = 25;
  const firstX = MID - ((HOLE_COLS - 1) * stepX) / 2;
  const firstY = 100;
  const dots = [];
  for (let row = 0; row < HOLE_ROWS; row += 1) {
    for (let col = 0; col < HOLE_COLS; col += 1) {
      dots.push(
        `<circle cx="${firstX + col * stepX}" cy="${firstY + row * stepY}" r="${HOLE_R}"/>`,
      );
    }
  }
  return dots.join('\n      ');
}

/**
 * The trophy, drawn first so the racket covers its middle. Only the rim, the handles and the
 * shoulders of the bowl are ever visible — which is what makes it read as *behind* rather than as
 * a second object competing for the centre.
 */
const TROPHY = `
    <rect x="132" y="76" width="248" height="28" rx="14"/>
    <path d="M150 106 L362 106 L330 200 Q256 250 182 200 Z"/>
    <g fill="none" stroke="${INK}" stroke-width="18" stroke-linecap="round">
      <path d="M156 118 C88 112, 62 158, 84 194 C102 228, 146 238, 188 226"/>
      <path d="M356 118 C424 112, 450 158, 428 194 C410 228, 366 238, 324 226"/>
    </g>`;

/** The racket and the ball, as one shape so the halo below can be stroked around both. */
const RACKET = `
    <rect x="${HEAD.x}" y="${HEAD.y}" width="${HEAD.w}" height="${HEAD.h}" rx="${HEAD.r}"/>
    <rect x="244" y="240" width="24" height="126" rx="12"/>`;

/**
 * `scale` shrinks the drawing inside the same full-bleed background: 1 for a normal icon, less for
 * a maskable one that a platform will crop.
 */
function markSvg(scale) {
  const start = { x: 106, y: 192 };
  const end = { x: 406, y: 192 };

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
  <defs>
    <linearGradient id="dusk" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="${BRAND_STRONG}"/>
      <stop offset="1" stop-color="${SURFACE_SUNKEN}"/>
    </linearGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#dusk)"/>
  <g transform="translate(${MID} ${MID}) scale(${scale}) translate(${-MID} ${-MID})">

    <g fill="${RING}">
      <path d="M${start.x} ${start.y} A ${RING_R} ${RING_R} 0 1 0 ${end.x} ${end.y}"
            fill="none" stroke="${RING}" stroke-width="${RING_STROKE}" stroke-linecap="round"/>
      <circle cx="${MID - RING_R}" cy="${RING_Y}" r="${NODE_R}"/>
      <circle cx="${MID + RING_R}" cy="${RING_Y}" r="${NODE_R}"/>
      <circle cx="${MID}" cy="${RING_Y + RING_R}" r="${NODE_R}"/>
    </g>

    <g fill="${INK}">${TROPHY}
    </g>

    <g stroke="${DEEP}" stroke-width="18" stroke-linejoin="round">${RACKET}
      <circle cx="330" cy="200" r="44"/>
    </g>
    <g fill="${INK}">${RACKET}
    </g>
    <g fill="${DEEP}">
      ${holes()}
    </g>
    <path d="M224 212 L288 212 L256 254 Z" fill="${DEEP}"/>
    <g fill="none" stroke="${DEEP}" stroke-width="7" stroke-linecap="round">
      <path d="M246 316 L266 304 M246 336 L266 324 M246 356 L266 344"/>
    </g>
    <circle cx="330" cy="200" r="44" fill="${BALL}"/>
    <g fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round">
      <path d="M300 172 Q318 200 300 228"/>
      <path d="M360 172 Q342 200 360 228"/>
    </g>
  </g>
</svg>`;
}

/** `purpose: any` fills the square; `purpose: maskable` keeps clear of the platform's crop. */
const ANY = markSvg(1);
const MASKABLE = markSvg(0.78);

const PNGS = [
  ['icon-192.png', ANY, 192],
  ['icon-512.png', ANY, 512],
  ['icon-maskable-512.png', MASKABLE, 512],
  // iOS ignores the manifest's icons and reads this link tag instead. It applies its own rounding
  // and does not composite transparency, which the full-bleed background already satisfies.
  ['apple-touch-icon.png', MASKABLE, 180],
];

await mkdir(OUT_DIR, { recursive: true });
await writeFile(`${OUT_DIR}icon.svg`, `${ANY}\n`, 'utf8');
console.log('icon.svg');

for (const [name, svg, size] of PNGS) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(OUT_DIR + name);
  console.log(`${name} (${size}px)`);
}
