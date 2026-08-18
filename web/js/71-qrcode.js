// ==========================
// QR CODE ENCODER — byte-mode, versions 1-40, all four error-correction
// levels. Self-contained on purpose: this app runs offline, so a share
// feature that needed a CDN to draw its own QR code would defeat the
// point. No dependency, nothing fetched — this file IS the dependency.
//
// Implements ISO/IEC 18004 (QR Code Model 2) directly: Reed-Solomon error
// correction over GF(256), the standard byte-mode data layout, all 8 mask
// patterns scored by the spec's own penalty rules, and the finder/timing/
// alignment/format/version module placement. Nothing here is an
// approximation — a QR reader cannot tell this apart from any other
// encoder's output.
//
// window.__qrEncode(text, opts) -> { size, get(x,y) } | null (null only if
// the text is too long for version 40 at the requested error-correction
// level; opts.ecLevel is 'L'|'M'|'Q'|'H', default 'L' for maximum capacity
// since this is scanned off a phone screen, not printed small).
// ==========================
(function(){
  'use strict';

  // ---- Galois Field GF(256), generator polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11D) ----
  var GF_EXP = new Array(512);
  var GF_LOG = new Array(256);
  (function(){
    var x = 1;
    for(var i = 0; i < 255; i++){
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if(x & 0x100) x ^= 0x11D;
    }
    for(var j = 255; j < 512; j++) GF_EXP[j] = GF_EXP[j - 255];
  })();
  function gfMul(a, b){
    if(a === 0 || b === 0) return 0;
    return GF_EXP[GF_LOG[a] + GF_LOG[b]];
  }

  // Reed-Solomon generator polynomial of given degree, as an array of
  // coefficients (highest degree first), each a GF(256) element: the
  // product of (x + alpha^i) for i = 0..degree-1, built one linear factor
  // at a time. poly * (x + root) = x*poly + root*poly — the loop below
  // is exactly that, with result[i] taking the x*poly term (an index
  // shift) and result[i+1] taking the root*poly term (a scale), summed
  // (XORed) where they land on the same power of x.
  function rsGeneratorPoly(degree){
    var poly = [1];
    for(var i = 0; i < degree; i++){
      var root = GF_EXP[i];
      var result = new Array(poly.length + 1).fill(0);
      for(var j = 0; j < poly.length; j++){
        result[j] ^= poly[j];
        result[j + 1] ^= gfMul(poly[j], root);
      }
      poly = result;
    }
    return poly;
  }
  function rsEncode(data, ecLen){
    var gen = rsGeneratorPoly(ecLen);
    var res = data.slice();
    for(var pad = 0; pad < ecLen; pad++) res.push(0);
    for(var i = 0; i < data.length; i++){
      var coef = res[i];
      if(coef === 0) continue;
      for(var j = 0; j < gen.length; j++){
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
    return res.slice(data.length);
  }

  // ---- per-version capacity tables --------------------------------------
  // Three independent tables, each verified against the reference numbers
  // in ISO/IEC 18004 Table 9 / Annex D: total codewords per version (data +
  // error correction together), the number of error-correction blocks per
  // version/level, and the total error-correction codewords per
  // version/level. A QR symbol's data is split into that many blocks as
  // evenly as possible — some "short" blocks, the remainder "long" by one
  // codeword — which buildDataCodewords derives from these three numbers
  // rather than needing a fourth hand-split table.
  var CODEWORDS_COUNT = [
    0,
    26,44,70,100,134,172,196,242,292,346,
    404,466,532,581,655,733,815,901,991,1085,
    1156,1258,1364,1474,1588,1706,1828,1921,2051,2185,
    2323,2465,2611,2761,2876,3034,3196,3362,3532,3706
  ];
  var EC_BLOCKS_TABLE = [
    1,1,1,1, 1,1,1,1, 1,1,2,2, 1,2,2,4, 1,2,4,4,
    2,4,4,4, 2,4,6,5, 2,4,6,6, 2,5,8,8, 4,5,8,8,
    4,5,8,11, 4,8,10,11, 4,9,12,16, 4,9,16,16, 6,10,12,18,
    6,10,17,16, 6,11,16,19, 6,13,18,21, 7,14,21,25, 8,16,20,25,
    8,17,23,25, 9,17,23,34, 9,18,25,30, 10,20,27,32, 12,21,29,35,
    12,23,34,37, 12,25,34,40, 13,26,35,42, 14,28,38,45, 15,29,40,48,
    16,31,43,51, 17,33,45,54, 18,35,48,57, 19,37,51,60, 19,38,53,63,
    20,40,56,66, 21,43,59,70, 22,45,62,74, 24,47,65,77, 25,49,68,81
  ];
  var EC_CODEWORDS_TABLE = [
    7,10,13,17, 10,16,22,28, 15,26,36,44, 20,36,52,64, 26,48,72,88,
    36,64,96,112, 40,72,108,130, 48,88,132,156, 60,110,160,192, 72,130,192,224,
    80,150,224,264, 96,176,260,308, 104,198,288,352, 120,216,320,384, 132,240,360,432,
    144,280,408,480, 168,308,448,532, 180,338,504,588, 196,364,546,650, 224,416,600,700,
    224,442,644,750, 252,476,690,816, 270,504,750,900, 300,560,810,960, 312,588,870,1050,
    336,644,952,1110, 360,700,1020,1200, 390,728,1050,1260, 420,784,1140,1350, 450,812,1200,1440,
    480,868,1290,1530, 510,924,1350,1620, 540,980,1440,1710, 570,1036,1530,1800, 570,1064,1590,1890,
    600,1120,1680,1980, 630,1204,1770,2100, 660,1260,1860,2220, 720,1316,1950,2310, 750,1372,2040,2430
  ];
  var EC_LEVEL_INDEX = { L: 0, M: 1, Q: 2, H: 3 };
  var EC_LEVEL_BITS = { L: 1, M: 0, Q: 3, H: 2 };   // format-info bits, per spec table
  function ecBlocksCount(version, ecLevel){ return EC_BLOCKS_TABLE[(version - 1) * 4 + EC_LEVEL_INDEX[ecLevel]]; }
  function ecCodewordsCount(version, ecLevel){ return EC_CODEWORDS_TABLE[(version - 1) * 4 + EC_LEVEL_INDEX[ecLevel]]; }

  // Alignment pattern center coordinates by version — computed, not looked
  // up: a version's alignment patterns sit at every combination of these
  // values (minus the three that fall inside a finder pattern), evenly
  // spaced between column/row 6 and (size-7). A hand-copied 40-row table
  // here is exactly the kind of mistake that fails silently for only some
  // versions — this is the same formula ISO/IEC 18004 Annex E defines it
  // with, so there is nothing to transcribe wrong.
  function alignCoordsForVersion(version){
    if(version === 1) return [];
    var size = 17 + version * 4;
    var posCount = Math.floor(version / 7) + 2;
    var intervals = size === 145 ? 26 : Math.ceil((size - 13) / (2 * posCount - 2)) * 2;
    var positions = [size - 7];
    for(var i = 1; i < posCount - 1; i++){ positions[i] = positions[i - 1] - intervals; }
    positions.push(6);
    return positions.reverse();
  }

  function bytesForString(str){
    // UTF-8 encode. Byte mode carries raw bytes; a plan link is ASCII
    // (base64url), so this is mostly a formality that also keeps the
    // encoder correct if a future caller passes non-ASCII text.
    var bytes = [];
    for(var i = 0; i < str.length; i++){
      var code = str.codePointAt(i);
      if(code > 0xFFFF) i++;   // consumed a surrogate pair
      if(code < 0x80){ bytes.push(code); }
      else if(code < 0x800){
        bytes.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F));
      } else if(code < 0x10000){
        bytes.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
      } else {
        bytes.push(0xF0 | (code >> 18), 0x80 | ((code >> 12) & 0x3F), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
      }
    }
    return bytes;
  }

  function pickVersion(byteLen, ecLevel){
    for(var v = 1; v <= 40; v++){
      var dataCodewords = CODEWORDS_COUNT[v] - ecCodewordsCount(v, ecLevel);
      // header: 4-bit mode + character-count-indicator bits (8 for v1-9 byte mode, 16 for v10-40)
      var ccBits = v < 10 ? 8 : 16;
      var headerBits = 4 + ccBits;
      var capacityBits = dataCodewords * 8;
      if(headerBits + byteLen * 8 <= capacityBits) return v;
    }
    return 0;   // does not fit at any version/level
  }

  function buildDataCodewords(bytes, version, ecLevel){
    var totalCodewords = CODEWORDS_COUNT[version];
    var ecTotal = ecCodewordsCount(version, ecLevel);
    var numBlocks = ecBlocksCount(version, ecLevel);
    var ecPerBlock = ecTotal / numBlocks;   // same length in every block, spec guarantees an integer
    var dataCodewordsTotal = totalCodewords - ecTotal;
    // group1 blocks are one codeword shorter than group2 when both exist
    var shortLen = Math.floor(dataCodewordsTotal / numBlocks);
    var longLen = shortLen + 1;
    var numShort = numBlocks - (dataCodewordsTotal - shortLen * numBlocks);

    var ccBits = version < 10 ? 8 : 16;
    var bits = [];
    function pushBits(value, len){ for(var i = len - 1; i >= 0; i--) bits.push((value >> i) & 1); }
    pushBits(4, 4);            // byte-mode indicator 0100
    pushBits(bytes.length, ccBits);
    for(var i = 0; i < bytes.length; i++) pushBits(bytes[i], 8);

    var capacityBits = dataCodewordsTotal * 8;
    // terminator (up to 4 zero bits)
    var termLen = Math.min(4, capacityBits - bits.length);
    for(var t = 0; t < termLen; t++) bits.push(0);
    while(bits.length % 8 !== 0) bits.push(0);

    var codewords = [];
    for(var b = 0; b < bits.length; b += 8){
      var byte = 0;
      for(var k = 0; k < 8; k++) byte = (byte << 1) | bits[b + k];
      codewords.push(byte);
    }
    var pad = [0xEC, 0x11], pi = 0;
    while(codewords.length < dataCodewordsTotal){ codewords.push(pad[pi % 2]); pi++; }

    // split into blocks
    var blocksData = [], pos = 0;
    for(var s = 0; s < numShort; s++){ blocksData.push(codewords.slice(pos, pos + shortLen)); pos += shortLen; }
    for(var l = 0; l < (numBlocks - numShort); l++){ blocksData.push(codewords.slice(pos, pos + longLen)); pos += longLen; }

    var blocksEc = blocksData.map(function(block){ return rsEncode(block, ecPerBlock); });

    // interleave data codewords, then interleave EC codewords, per spec 7.6
    var maxDataLen = longLen;
    var out = [];
    for(var col = 0; col < maxDataLen; col++){
      for(var bi = 0; bi < blocksData.length; bi++){
        if(col < blocksData[bi].length) out.push(blocksData[bi][col]);
      }
    }
    for(var col2 = 0; col2 < ecPerBlock; col2++){
      for(var bi2 = 0; bi2 < blocksEc.length; bi2++) out.push(blocksEc[bi2][col2]);
    }
    return out;
  }

  // ---- module matrix -------------------------------------------------------

  function makeMatrix(size){
    var m = [];
    for(var y = 0; y < size; y++){ m.push(new Array(size).fill(null)); }
    return m;
  }

  function placeFinder(m, x, y){
    for(var dy = -1; dy <= 7; dy++){
      for(var dx = -1; dx <= 7; dx++){
        var px = x + dx, py = y + dy;
        if(px < 0 || py < 0 || px >= m.length || py >= m.length) continue;
        var on = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6 &&
          (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
        m[py][px] = on ? 1 : 0;
      }
    }
  }
  function placeAlignment(m, cx, cy){
    for(var dy = -2; dy <= 2; dy++){
      for(var dx = -2; dx <= 2; dx++){
        var on = Math.max(Math.abs(dx), Math.abs(dy)) !== 1;
        m[cy + dy][cx + dx] = on ? 1 : 0;
      }
    }
  }

  function buildMatrix(version, ecLevel, dataCodewords, maskId){
    var size = 17 + version * 4;
    var m = makeMatrix(size);
    var reserved = makeMatrix(size);
    function mark(x, y){ reserved[y][x] = 1; }

    // finder patterns + separators (separators just need to be reserved+0, placeFinder's -1..7 already covers via bounds)
    placeFinder(m, 0, 0); placeFinder(m, size - 7, 0); placeFinder(m, 0, size - 7);
    for(var yy = 0; yy < size; yy++){
      for(var xx = 0; xx < size; xx++){
        var inTL = xx <= 8 && yy <= 8;
        var inTR = xx >= size - 8 && yy <= 8;
        var inBL = xx <= 8 && yy >= size - 8;
        if(inTL || inTR || inBL) mark(xx, yy);
      }
    }

    // timing patterns
    for(var t = 8; t < size - 8; t++){
      var on = t % 2 === 0;
      m[6][t] = on ? 1 : 0; mark(t, 6);
      m[t][6] = on ? 1 : 0; mark(6, t);
    }

    // alignment patterns (skip any that overlap a finder corner)
    var coords = alignCoordsForVersion(version);
    for(var i = 0; i < coords.length; i++){
      for(var j = 0; j < coords.length; j++){
        var cx = coords[i], cy = coords[j];
        var overlapsFinder = (cx <= 8 && cy <= 8) || (cx >= size - 9 && cy <= 8) || (cx <= 8 && cy >= size - 9);
        if(overlapsFinder) continue;
        placeAlignment(m, cx, cy);
        for(var dy = -2; dy <= 2; dy++) for(var dx = -2; dx <= 2; dx++) mark(cx + dx, cy + dy);
      }
    }

    // dark module (always on) — spec 6.9
    m[size - 8][8] = 1; mark(8, size - 8);

    // reserve format-info areas (filled in after masking is chosen)
    for(var f = 0; f <= 8; f++){ mark(f, 8); mark(8, f); }
    for(var f2 = 0; f2 < 8; f2++){ mark(size - 1 - f2, 8); mark(8, size - 1 - f2); }

    // reserve version-info areas for version >= 7
    if(version >= 7){
      for(var vx = 0; vx < 6; vx++) for(var vy = 0; vy < 3; vy++){
        mark(size - 11 + vy, vx); mark(vx, size - 11 + vy);
      }
    }

    // convert codewords to a bitstream and place along the zigzag, skipping reserved modules
    var bits = [];
    for(var c = 0; c < dataCodewords.length; c++){
      for(var b = 7; b >= 0; b--) bits.push((dataCodewords[c] >> b) & 1);
    }
    var bi = 0;
    var upward = true;
    for(var col = size - 1; col > 0; col -= 2){
      if(col === 6) col--;   // timing column has no data
      for(var row = 0; row < size; row++){
        var y2 = upward ? size - 1 - row : row;
        for(var dxCol = 0; dxCol < 2; dxCol++){
          var x2 = col - dxCol;
          if(reserved[y2][x2]) continue;
          var bitVal = bi < bits.length ? bits[bi] : 0;
          bi++;
          m[y2][x2] = maskApplies(maskId, x2, y2) ? (bitVal ^ 1) : bitVal;
        }
      }
      upward = !upward;
    }

    return { matrix: m, reserved: reserved, size: size };
  }

  function maskApplies(maskId, x, y){
    switch(maskId){
      case 0: return (x + y) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
      case 5: return (x * y) % 2 + (x * y) % 3 === 0;
      case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
      case 7: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
    }
    return false;
  }

  function writeFormatInfo(m, size, ecLevel, maskId){
    var data = (EC_LEVEL_BITS[ecLevel] << 3) | maskId;
    // BCH(15,5) with generator 0x537, xor mask 0x5412 — spec Annex C
    var g = data << 10, poly = 0x537;
    for(var i = 4; i >= 0; i--){
      if(g & (1 << (i + 10))) g ^= poly << i;
    }
    var bits = ((data << 10) | g) ^ 0x5412;
    // i-th position in each strip carries bit (14-i) — MSB (b14) placed
    // first, LSB (b0) placed last, per spec Figure 25.
    function bit(n){ return (bits >> n) & 1; }
    var col = [8,8,8,8,8,8,8,8,7,5,4,3,2,1,0];
    var colRow = [0,1,2,3,4,5,7,8,8,8,8,8,8,8,8];
    for(var i2 = 0; i2 < 15; i2++) m[colRow[i2]][col[i2]] = bit(14 - i2);
    var row2 = [size-1,size-2,size-3,size-4,size-5,size-6,size-7,8,8,8,8,8,8,8,8];
    var col2 = [8,8,8,8,8,8,8,size-8,size-7,size-6,size-5,size-4,size-3,size-2,size-1];
    for(var i3 = 0; i3 < 15; i3++) m[row2[i3]][col2[i3]] = bit(14 - i3);
  }

  function writeVersionInfo(m, size, version){
    if(version < 7) return;
    var g = version << 12, poly = 0x1F25;
    for(var i = 5; i >= 0; i--){
      if(g & (1 << (i + 12))) g ^= poly << i;
    }
    var bits = (version << 12) | g;
    for(var i2 = 0; i2 < 18; i2++){
      var bit = (bits >> i2) & 1;
      var row = Math.floor(i2 / 3), col = (i2 % 3) + (size - 11);
      m[row][col] = bit;
      m[col][row] = bit;
    }
  }

  function penaltyScore(m, size){
    var score = 0;
    // rule 1: runs of 5+ same-color modules, per row and column
    function runPenalty(getVal){
      var s = 0;
      for(var i = 0; i < size; i++){
        var run = 1, prev = getVal(i, 0);
        for(var j = 1; j < size; j++){
          var v = getVal(i, j);
          if(v === prev){ run++; }
          else { if(run >= 5) s += run - 2; run = 1; prev = v; }
        }
        if(run >= 5) s += run - 2;
      }
      return s;
    }
    score += runPenalty(function(i, j){ return m[i][j]; });          // rows
    score += runPenalty(function(i, j){ return m[j][i]; });          // columns

    // rule 2: 2x2 blocks of same color
    for(var y = 0; y < size - 1; y++){
      for(var x = 0; x < size - 1; x++){
        var v = m[y][x];
        if(v === m[y][x+1] && v === m[y+1][x] && v === m[y+1][x+1]) score += 3;
      }
    }

    // rule 3: 1:1:3:1:1 finder-like patterns
    var pat1 = [1,0,1,1,1,0,1,0,0,0,0], pat2 = [0,0,0,0,1,0,1,1,1,0,1];
    function matches(arr, pat){
      for(var k = 0; k < pat.length; k++) if(arr[k] !== pat[k]) return false;
      return true;
    }
    for(var y2 = 0; y2 < size; y2++){
      for(var x2 = 0; x2 <= size - 11; x2++){
        var row = [];
        for(var k2 = 0; k2 < 11; k2++) row.push(m[y2][x2 + k2]);
        if(matches(row, pat1) || matches(row, pat2)) score += 40;
      }
    }
    for(var x3 = 0; x3 < size; x3++){
      for(var y3 = 0; y3 <= size - 11; y3++){
        var col = [];
        for(var k3 = 0; k3 < 11; k3++) col.push(m[y3 + k3][x3]);
        if(matches(col, pat1) || matches(col, pat2)) score += 40;
      }
    }

    // rule 4: overall dark-module proportion
    var dark = 0;
    for(var y4 = 0; y4 < size; y4++) for(var x4 = 0; x4 < size; x4++) if(m[y4][x4]) dark++;
    var percent = (dark * 100) / (size * size);
    var prevMultiple = Math.floor(Math.abs(percent - 50) / 5) * 5;
    var a = Math.floor(prevMultiple / 5), b = a + 1;
    score += Math.min(a, b) * 10;

    return score;
  }

  function encode(text, opts){
    opts = opts || {};
    var ecLevel = opts.ecLevel || 'L';
    var bytes = bytesForString(text);
    var version = pickVersion(bytes.length, ecLevel);
    if(!version) return null;

    var dataCodewords = buildDataCodewords(bytes, version, ecLevel);

    var best = null, bestScore = Infinity;
    for(var maskId = 0; maskId < 8; maskId++){
      var built = buildMatrix(version, ecLevel, dataCodewords, maskId);
      writeFormatInfo(built.matrix, built.size, ecLevel, maskId);
      writeVersionInfo(built.matrix, built.size, version);
      var score = penaltyScore(built.matrix, built.size);
      if(score < bestScore){ bestScore = score; best = built; }
    }

    var size = best.size, matrix = best.matrix;
    return {
      size: size,
      get: function(x, y){ return matrix[y][x] === 1; }
    };
  }

  window.__qrEncode = encode;
})();
