// Minimal QR Code generator — pure TypeScript, no dependencies
// Supports byte-mode encoding with error correction level L, versions 1-20

const EC_TABLE: (number[] | null)[] = [
  null,
  [7,1,19],[10,1,34],[15,1,55],[20,1,80],[26,1,108],
  [18,2,68],[20,2,78],[24,2,97],[30,2,116],
  [18,2,68,2,69],[20,4,81],[24,2,92,2,93],[26,4,107],
  [30,3,115,1,116],[22,5,87,1,88],[24,5,98,1,99],
  [28,1,107,5,108],[30,5,120,1,121],[28,3,113,4,114],
  [28,3,107,5,108]
];

const CAPACITY = [
  0, 17, 32, 53, 78, 106, 134, 154, 192, 230, 271,
  321, 370, 428, 461, 523, 589, 656, 734, 816, 871
];

const ALIGN_POS: (number[] | null)[] = [
  null, [], [6,18], [6,22], [6,26], [6,30], [6,34],
  [6,22,38], [6,24,42], [6,26,46], [6,28,50],
  [6,30,54], [6,32,58], [6,34,62], [6,26,46,66],
  [6,26,48,70], [6,26,50,74], [6,30,54,78],
  [6,30,56,82], [6,30,58,86], [6,34,62,90]
];

const GF_EXP = new Array(512);
const GF_LOG = new Array(256);

(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x = x * 2;
    if (x >= 256) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function polyMul(p1: number[], p2: number[]): number[] {
  const result = new Array(p1.length + p2.length - 1).fill(0);
  for (let i = 0; i < p1.length; i++)
    for (let j = 0; j < p2.length; j++)
      result[i + j] ^= gfMul(p1[i], p2[j]);
  return result;
}

function polyDiv(dividend: number[], divisor: number[]): number[] {
  const result = dividend.slice();
  for (let i = 0; i < dividend.length - divisor.length + 1; i++) {
    if (result[i] === 0) continue;
    const coef = result[i];
    for (let j = 0; j < divisor.length; j++)
      result[i + j] ^= gfMul(divisor[j], coef);
  }
  return result.slice(dividend.length - divisor.length + 1);
}

function getGeneratorPoly(degree: number): number[] {
  let gen = [1];
  for (let i = 0; i < degree; i++)
    gen = polyMul(gen, [1, GF_EXP[i]]);
  return gen;
}

function getECCodewords(data: number[], ecCount: number): number[] {
  const gen = getGeneratorPoly(ecCount);
  const padded = new Array(data.length + ecCount).fill(0);
  for (let i = 0; i < data.length; i++) padded[i] = data[i];
  return polyDiv(padded, gen);
}

function getVersion(dataLen: number): number {
  for (let v = 1; v <= 20; v++)
    if (dataLen <= CAPACITY[v]) return v;
  return 20;
}

function encodeData(str: string, version: number): number[] {
  const bytes = new TextEncoder().encode(str);
  const bits: number[] = [];
  // Mode: byte (0100)
  bits.push(0, 1, 0, 0);
  const ccBits = version <= 9 ? 8 : 16;
  for (let i = ccBits - 1; i >= 0; i--)
    bits.push((bytes.length >> i) & 1);
  for (let b = 0; b < bytes.length; b++)
    for (let i = 7; i >= 0; i--)
      bits.push((bytes[b] >> i) & 1);

  const ecInfo = EC_TABLE[version]!;
  let totalDataCodewords: number;
  if (ecInfo.length === 3) {
    totalDataCodewords = ecInfo[1] * ecInfo[2];
  } else {
    totalDataCodewords = ecInfo[1] * ecInfo[2] + ecInfo[3] * ecInfo[4];
  }
  const targetBits = totalDataCodewords * 8;

  for (let i = 0; i < 4 && bits.length < targetBits; i++) bits.push(0);
  while (bits.length % 8 !== 0 && bits.length < targetBits) bits.push(0);

  const padBytes = [0xEC, 0x11];
  let padIdx = 0;
  while (bits.length < targetBits) {
    const pb = padBytes[padIdx % 2];
    for (let i = 7; i >= 0; i--) bits.push((pb >> i) & 1);
    padIdx++;
  }

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] || 0);
    codewords.push(byte);
  }
  return codewords;
}

function interleave(data: number[], version: number): number[] {
  const ecInfo = EC_TABLE[version]!;
  const ecPerBlock = ecInfo[0];
  const blocks: number[][] = [];
  let offset = 0;
  for (let i = 0; i < ecInfo[1]; i++) {
    blocks.push(data.slice(offset, offset + ecInfo[2]));
    offset += ecInfo[2];
  }
  if (ecInfo.length > 3) {
    for (let i = 0; i < ecInfo[3]; i++) {
      blocks.push(data.slice(offset, offset + ecInfo[4]));
      offset += ecInfo[4];
    }
  }
  const ecBlocks = blocks.map(b => Array.from(getECCodewords(b, ecPerBlock)));
  const result: number[] = [];
  const maxDataLen = Math.max(...blocks.map(b => b.length));
  for (let i = 0; i < maxDataLen; i++)
    for (let j = 0; j < blocks.length; j++)
      if (i < blocks[j].length) result.push(blocks[j][i]);
  for (let i = 0; i < ecPerBlock; i++)
    for (let j = 0; j < ecBlocks.length; j++)
      if (i < ecBlocks[j].length) result.push(ecBlocks[j][i]);
  return result;
}

interface MatrixData {
  matrix: number[][];
  reserved: boolean[][];
  size: number;
}

function createMatrix(version: number): MatrixData {
  const size = version * 4 + 17;
  const matrix: number[][] = [];
  const reserved: boolean[][] = [];
  for (let i = 0; i < size; i++) {
    matrix.push(new Array(size).fill(0));
    reserved.push(new Array(size).fill(false));
  }
  return { matrix, reserved, size };
}

function addFinderPattern(matrix: number[][], reserved: boolean[][], row: number, col: number) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const nr = row + r, nc = col + c;
      if (nr < 0 || nr >= matrix.length || nc < 0 || nc >= matrix.length) continue;
      const isBlack = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                     (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                     (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      matrix[nr][nc] = isBlack ? 1 : 0;
      reserved[nr][nc] = true;
    }
  }
}

function addAlignmentPattern(matrix: number[][], reserved: boolean[][], row: number, col: number) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const isBlack = Math.max(Math.abs(r), Math.abs(c)) !== 1;
      matrix[row + r][col + c] = isBlack ? 1 : 0;
      reserved[row + r][col + c] = true;
    }
  }
}

function addTimingPatterns(matrix: number[][], reserved: boolean[][]) {
  const size = matrix.length;
  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) { matrix[6][i] = i % 2 === 0 ? 1 : 0; reserved[6][i] = true; }
    if (!reserved[i][6]) { matrix[i][6] = i % 2 === 0 ? 1 : 0; reserved[i][6] = true; }
  }
}

function reserveFormatBits(matrix: number[][], reserved: boolean[][]) {
  const size = matrix.length;
  for (let i = 0; i <= 8; i++) {
    if (i < size) { reserved[8][i] = true; reserved[i][8] = true; }
  }
  for (let i = 0; i <= 7; i++) reserved[8][size - 1 - i] = true;
  for (let i = 0; i <= 7; i++) reserved[size - 1 - i][8] = true;
  matrix[size - 8][8] = 1;
  reserved[size - 8][8] = true;
}

function reserveVersionBits(_matrix: number[][], reserved: boolean[][], version: number) {
  if (version < 7) return;
  const size = _matrix.length;
  for (let i = 0; i < 6; i++)
    for (let j = 0; j < 3; j++) {
      reserved[i][size - 11 + j] = true;
      reserved[size - 11 + j][i] = true;
    }
}

function placeData(matrix: number[][], reserved: boolean[][], data: number[]) {
  const size = matrix.length;
  const bits: number[] = [];
  for (let d = 0; d < data.length; d++)
    for (let i = 7; i >= 0; i--)
      bits.push((data[d] >> i) & 1);
  let bitIdx = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      const row = upward ? size - 1 - vert : vert;
      for (let dx = 0; dx <= 1; dx++) {
        const col = right - dx;
        if (col < 0 || col >= size) continue;
        if (reserved[row][col]) continue;
        matrix[row][col] = bitIdx < bits.length ? bits[bitIdx] : 0;
        bitIdx++;
      }
    }
    upward = !upward;
  }
}

const FORMAT_BITS = [
  0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976,
  0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0,
  0x355f, 0x3068, 0x3f31, 0x3a06, 0x24b4, 0x2183, 0x2eda, 0x2bed,
  0x1689, 0x13be, 0x1ce7, 0x19d0, 0x0762, 0x0255, 0x0d0c, 0x083b
];

function applyFormatBits(matrix: number[][], maskPattern: number) {
  const size = matrix.length;
  const formatIndex = 1 * 8 + maskPattern; // EC level L = 1
  const bits = FORMAT_BITS[formatIndex];
  const positions1: [number, number][] = [
    [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[7,8],[8,8],
    [8,7],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0]
  ];
  for (let i = 0; i < 15; i++) {
    const bit = (bits >> (14 - i)) & 1;
    matrix[positions1[i][0]][positions1[i][1]] = bit;
  }
  const positions2: [number, number][] = [];
  for (let i = 0; i < 8; i++) positions2.push([8, size - 1 - i]);
  for (let i = 0; i < 7; i++) positions2.push([size - 7 + i, 8]);
  for (let i = 0; i < 15; i++) {
    const bit = (bits >> (14 - i)) & 1;
    matrix[positions2[i][0]][positions2[i][1]] = bit;
  }
}

const MASK_FUNCTIONS = [
  (r: number, c: number) => (r + c) % 2 === 0,
  (r: number) => r % 2 === 0,
  (_r: number, c: number) => c % 3 === 0,
  (r: number, c: number) => (r + c) % 3 === 0,
  (r: number, c: number) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r: number, c: number) => ((r * c) % 2 + (r * c) % 3) === 0,
  (r: number, c: number) => ((r * c) % 2 + (r * c) % 3) % 2 === 0,
  (r: number, c: number) => ((r + c) % 2 + (r * c) % 3) % 2 === 0,
];

function applyMask(matrix: number[][], reserved: boolean[][], maskIdx: number) {
  const size = matrix.length;
  const fn = MASK_FUNCTIONS[maskIdx];
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (!reserved[r][c] && fn(r, c))
        matrix[r][c] ^= 1;
}

function scoreMask(matrix: number[][]): number {
  const size = matrix.length;
  let penalty = 0;
  for (let r = 0; r < size; r++) {
    let count = 1;
    for (let c = 1; c < size; c++) {
      if (matrix[r][c] === matrix[r][c-1]) {
        count++;
        if (count === 5) penalty += 3;
        else if (count > 5) penalty += 1;
      } else count = 1;
    }
  }
  for (let c = 0; c < size; c++) {
    let count = 1;
    for (let r = 1; r < size; r++) {
      if (matrix[r][c] === matrix[r-1][c]) {
        count++;
        if (count === 5) penalty += 3;
        else if (count > 5) penalty += 1;
      } else count = 1;
    }
  }
  for (let r = 0; r < size - 1; r++)
    for (let c = 0; c < size - 1; c++) {
      const v = matrix[r][c];
      if (v === matrix[r][c+1] && v === matrix[r+1][c] && v === matrix[r+1][c+1])
        penalty += 3;
    }
  return penalty;
}

export function generateQRMatrix(text: string): number[][] {
  const bytes = new TextEncoder().encode(text);
  const version = getVersion(bytes.length);
  const size = version * 4 + 17;
  const dataCodewords = encodeData(text, version);
  const finalData = interleave(dataCodewords, version);
  let bestMatrix: number[][] | null = null;
  let bestScore = Infinity;

  for (let maskIdx = 0; maskIdx < 8; maskIdx++) {
    const m = createMatrix(version);
    const { matrix, reserved } = m;
    addFinderPattern(matrix, reserved, 0, 0);
    addFinderPattern(matrix, reserved, 0, size - 7);
    addFinderPattern(matrix, reserved, size - 7, 0);
    if (version >= 2) {
      const positions = ALIGN_POS[version]!;
      for (let i = 0; i < positions.length; i++)
        for (let j = 0; j < positions.length; j++) {
          const r = positions[i], c = positions[j];
          if (reserved[r][c]) continue;
          addAlignmentPattern(matrix, reserved, r, c);
        }
    }
    addTimingPatterns(matrix, reserved);
    reserveFormatBits(matrix, reserved);
    reserveVersionBits(matrix, reserved, version);
    placeData(matrix, reserved, finalData);
    applyMask(matrix, reserved, maskIdx);
    applyFormatBits(matrix, maskIdx);
    const score = scoreMask(matrix);
    if (score < bestScore) {
      bestScore = score;
      bestMatrix = matrix.map(r => r.slice());
    }
  }
  return bestMatrix!;
}

export function renderQRToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  pixelSize = 140,
  darkColor = '#360077',
  lightColor = '#ffffff'
) {
  const qr = generateQRMatrix(text);
  const moduleCount = qr.length;
  const cellSize = pixelSize / moduleCount;
  canvas.width = pixelSize;
  canvas.height = pixelSize;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = lightColor;
  ctx.fillRect(0, 0, pixelSize, pixelSize);
  ctx.fillStyle = darkColor;
  for (let row = 0; row < moduleCount; row++)
    for (let col = 0; col < moduleCount; col++)
      if (qr[row][col])
        ctx.fillRect(
          Math.round(col * cellSize),
          Math.round(row * cellSize),
          Math.ceil(cellSize),
          Math.ceil(cellSize)
        );
}
