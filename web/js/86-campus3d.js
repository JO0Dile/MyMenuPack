// ==========================
// THE CAMPUS, IN THREE DIMENSIONS
//
// The sign-in screen used to be a 66 KB drawing of the campus — a good
// picture that never moved. This is the same campus, built as real geometry
// and rendered by the GPU: the clock-tower fountain in the middle of its
// roundabout, the faculty blocks set back around it, the lamps and the trees
// on the circle, and a sky above.
//
// WHY NOT three.js. This app's whole promise is that it works offline, on a
// cheap phone, on campus wifi, and the entire bundle is around 400 KB. A 3D
// library would be roughly 150 KB gzipped — the largest single thing in the
// app, downloaded before a student has seen one course. Everything below is
// WebGL 1 written directly: the same scene, a few kilobytes, no dependency,
// and it runs from the service-worker cache with no network at all.
//
// WHAT IT DOES. A slow flight in: it opens high and off to one side, swings
// down and round the landmark, and settles across the pool with the whole
// tower in frame. A gentle sway from the gyroscope (or the pointer on a
// desktop) rides on top, depth fog drops the far geometry away, and the
// whole thing is drawn as blueprint line-work so it belongs to the same
// drawing the app has always used.
//
// ONE LANDMARK, NOT TWO. At AAUP the clock tower stands in the middle of the
// fountain — they are a single piece of design, and monument() builds them
// as a single object: pool, island, arcaded piers, inscription block, clock
// stage, book.
//
// WHAT IT REFUSES TO DO. It never blocks the screen. If WebGL is missing,
// the context is lost, the device asks for reduced motion, or anything at
// all throws, the original picture is still in the DOM underneath and simply
// stays visible — a student can always sign in, whatever the GPU says.
// ==========================
(function(){
  'use strict';

  // ---------- small matrix helpers (column-major, like GL wants) ----------

  function mat4(){
    return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  }
  function perspective(out, fovy, aspect, near, far){
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    out[0]=f/aspect; out[1]=0; out[2]=0;  out[3]=0;
    out[4]=0; out[5]=f; out[6]=0; out[7]=0;
    out[8]=0; out[9]=0; out[10]=(far+near)*nf; out[11]=-1;
    out[12]=0; out[13]=0; out[14]=2*far*near*nf; out[15]=0;
    return out;
  }
  function lookAt(out, eye, centre, up){
    var z0=eye[0]-centre[0], z1=eye[1]-centre[1], z2=eye[2]-centre[2];
    var len = Math.hypot(z0,z1,z2) || 1;
    z0/=len; z1/=len; z2/=len;
    var x0=up[1]*z2-up[2]*z1, x1=up[2]*z0-up[0]*z2, x2=up[0]*z1-up[1]*z0;
    len = Math.hypot(x0,x1,x2) || 1;
    x0/=len; x1/=len; x2/=len;
    var y0=z1*x2-z2*x1, y1=z2*x0-z0*x2, y2=z0*x1-z1*x0;
    out[0]=x0; out[1]=y0; out[2]=z0; out[3]=0;
    out[4]=x1; out[5]=y1; out[6]=z1; out[7]=0;
    out[8]=x2; out[9]=y2; out[10]=z2; out[11]=0;
    out[12]=-(x0*eye[0]+x1*eye[1]+x2*eye[2]);
    out[13]=-(y0*eye[0]+y1*eye[1]+y2*eye[2]);
    out[14]=-(z0*eye[0]+z1*eye[1]+z2*eye[2]);
    out[15]=1;
    return out;
  }
  function multiply(out, a, b){
    for(var c = 0; c < 4; c++){
      var b0=b[c*4], b1=b[c*4+1], b2=b[c*4+2], b3=b[c*4+3];
      out[c*4]   = b0*a[0] + b1*a[4] + b2*a[8]  + b3*a[12];
      out[c*4+1] = b0*a[1] + b1*a[5] + b2*a[9]  + b3*a[13];
      out[c*4+2] = b0*a[2] + b1*a[6] + b2*a[10] + b3*a[14];
      out[c*4+3] = b0*a[3] + b1*a[7] + b2*a[11] + b3*a[15];
    }
    return out;
  }

  // ---------- the campus, as line segments ----------
  //
  // Every push*() below appends pairs of vertices to one big array. A fourth
  // component rides along with each vertex: how brightly that line draws, so
  // the gate reads as the focus and the ground grid stays a whisper.

  function Builder(){
    this.v = [];
  }
  Builder.prototype.line = function(a, b, w){
    this.v.push(a[0], a[1], a[2], w, b[0], b[1], b[2], w);
  };
  // A closed loop through a list of points.
  Builder.prototype.loop = function(pts, w){
    for(var i = 0; i < pts.length; i++){
      this.line(pts[i], pts[(i + 1) % pts.length], w);
    }
  };
  Builder.prototype.path = function(pts, w){
    for(var i = 0; i < pts.length - 1; i++){ this.line(pts[i], pts[i+1], w); }
  };
  // A rectangular box as twelve edges.
  Builder.prototype.box = function(cx, cy, cz, sx, sy, sz, w){
    var x0=cx-sx/2, x1=cx+sx/2, y0=cy, y1=cy+sy, z0=cz-sz/2, z1=cz+sz/2;
    var p = [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],
             [x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]];
    this.loop([p[0],p[1],p[2],p[3]], w);
    this.loop([p[4],p[5],p[6],p[7]], w);
    for(var i = 0; i < 4; i++){ this.line(p[i], p[i+4], w); }
  };
  // A horizontal ring — the fountain's basins.
  Builder.prototype.ring = function(cx, y, cz, r, seg, w){
    var pts = [];
    for(var i = 0; i < seg; i++){
      var a = i / seg * Math.PI * 2;
      pts.push([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r]);
    }
    this.loop(pts, w);
    return pts;
  };

  // The faceted faculty block: a box with a triangulated facade, which is
  // the thing you actually recognise about that building from the road.
  function faculty(b, cx, cz, w, h, d, bright){
    b.box(cx, 0, cz, w, h, d, bright);
    var rows = 4, cols = 3, face = cz + d / 2;
    for(var r = 0; r < rows; r++){
      var y0 = h * (r / rows), y1 = h * ((r + 1) / rows);
      b.line([cx - w/2, y1, face], [cx + w/2, y1, face], bright * 0.6);
      for(var c = 0; c < cols; c++){
        var x0 = cx - w/2 + w * (c / cols), x1 = cx - w/2 + w * ((c + 1) / cols);
        // alternate the diagonal so the facade reads as folded glass
        if((r + c) % 2){ b.line([x0, y0, face], [x1, y1, face], bright * 0.45); }
        else           { b.line([x0, y1, face], [x1, y0, face], bright * 0.45); }
        if(r === 0){ b.line([x1, 0, face], [x1, h, face], bright * 0.3); }
      }
    }
  }

  // THE LANDMARK — ONE OBJECT, NOT TWO.
  //
  // This was wrong twice over. First the clock and the fountain were drawn
  // as two circles with spokes and read as the same thing repeated; then
  // they were made to look different from each other, which was still
  // wrong, because at AAUP they are not two things at all. The clock tower
  // STANDS IN the fountain. It is one landmark on a roundabout — you do not
  // walk toward it down an avenue, you come round it.
  //
  // Built from the photographs, bottom to top: a round tiled pool with jets
  // around its rim; a stepped stone island in the middle of it; four
  // clustered columns carrying a pointed arch on each face; a dark
  // inscription block above the arcade; a pale block above that with a
  // clock face on each side; and the open book on top.

  // A two-centred pointed arch — the profile of every opening on the tower.
  // Two arcs struck from centres either side of the axis, meeting in a
  // point. A single semicircle read as Roman and looked nothing like it.
  function archProfile(halfW, y0, seg){
    var d = halfW * 0.55, R = halfW + d;
    var pts = [];
    for(var i = 0; i <= seg; i++){
      var x = -halfW + halfW * (i / seg);
      var y = y0 + Math.sqrt(Math.max(0, R * R - (x - d) * (x - d)));
      pts.push([x, y]);
    }
    for(var j = seg - 1; j >= 0; j--){ pts.push([-pts[j][0], pts[j][1]]); }
    return { pts: pts, apexY: y0 + Math.sqrt(R * R - d * d) };
  }

  // One face of the arcade. axis 'z' means the arch faces along z and spans
  // in x; 'x' is the reverse.
  function archFace(b, axis, offset, halfW, y0, bright){
    var a = archProfile(halfW, y0, 12);
    for(var i = 0; i < a.pts.length - 1; i++){
      var p0 = a.pts[i], p1 = a.pts[i + 1];
      if(axis === 'z') b.line([p0[0], p0[1], offset], [p1[0], p1[1], offset], bright);
      else             b.line([offset, p0[1], p0[0]], [offset, p1[1], p1[0]], bright);
    }
    [-halfW, halfW].forEach(function(e){
      if(axis === 'z') b.line([e, y0, offset], [e, y0 - 0.5, offset], bright * 0.7);
      else             b.line([offset, y0, e], [offset, y0 - 0.5, e], bright * 0.7);
    });
    return a.apexY;
  }

  // Three slim shafts bundled together, which is how the piers read.
  function columnCluster(b, x, z, y0, y1, bright){
    var r = 0.17;
    for(var i = 0; i < 3; i++){
      var a = i / 3 * Math.PI * 2 + 0.4;
      var cx = x + Math.cos(a) * r * 1.5, cz = z + Math.sin(a) * r * 1.5;
      b.line([cx, y0, cz], [cx, y1, cz], bright);
      b.ring(cx, y0 + 0.05, cz, r, 7, bright * 0.7);
      b.ring(cx, y1 - 0.05, cz, r, 7, bright * 0.7);
    }
    b.box(x, y0 - 0.36, z, 1.0, 0.36, 1.0, bright);
    b.box(x, y1, z, 1.0, 0.32, 1.0, bright);
  }

  function clockFace(b, axis, offset, cy, r, bright){
    function put(px, py){ return axis === 'z' ? [px, py, offset] : [offset, py, px]; }
    var outer = [], inner = [];
    for(var i = 0; i < 26; i++){
      var t = i / 26 * Math.PI * 2;
      outer.push(put(Math.cos(t) * r, cy + Math.sin(t) * r));
      inner.push(put(Math.cos(t) * r * 0.86, cy + Math.sin(t) * r * 0.86));
    }
    b.loop(outer, bright);
    b.loop(inner, bright * 0.75);
    for(var m = 0; m < 12; m++){
      var a = m / 12 * Math.PI * 2;
      var k = (m % 3 === 0) ? 0.70 : 0.79;
      b.line(put(Math.cos(a) * r * k, cy + Math.sin(a) * r * k),
             put(Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86),
             bright * (m % 3 === 0 ? 0.95 : 0.6));
    }
    b.line(put(0, cy), put(0, cy + r * 0.62), bright);
    b.line(put(0, cy), put(r * 0.42, cy + r * 0.2), bright);
  }

  function bookOnTop(b, y0, bright){
    b.box(0, y0, 0, 1.6, 0.36, 1.6, bright);
    var w = 1.6, h = 0.75, d = 1.15;
    [-1, 1].forEach(function(s){
      b.line([0, y0 + 0.36, 0], [s * w * 0.5, y0 + 0.36 + h, -d * 0.5], bright);
      b.line([0, y0 + 0.36, 0], [s * w * 0.5, y0 + 0.36 + h,  d * 0.5], bright);
      b.line([s * w * 0.5, y0 + 0.36 + h, -d * 0.5], [s * w * 0.5, y0 + 0.36 + h, d * 0.5], bright);
      for(var k = 1; k <= 2; k++){
        var f = k / 3;
        b.line([s * w * 0.5 * f, y0 + 0.36 + h * f, -d * 0.5 * f],
               [s * w * 0.5 * f, y0 + 0.36 + h * f,  d * 0.5 * f], bright * 0.45);
      }
    });
    b.line([0, y0 + 0.36, -d * 0.5], [0, y0 + 0.36, d * 0.5], bright * 0.8);
  }

  function monument(b, bright){
    var POOL = 9.0;
    b.ring(0, 0.00, 0, POOL,       46, bright * 0.8);
    b.ring(0, 0.55, 0, POOL,       46, bright * 0.9);
    b.ring(0, 0.55, 0, POOL - 0.7, 44, bright * 0.7);
    b.ring(0, 0.30, 0, POOL - 1.5, 42, bright * 0.5);
    for(var i = 0; i < 40; i++){
      var a = i / 40 * Math.PI * 2;
      b.line([Math.cos(a) * POOL, 0, Math.sin(a) * POOL],
             [Math.cos(a) * POOL, 0.55, Math.sin(a) * POOL], bright * 0.4);
    }
    for(var j = 0; j < 18; j++){
      var t = j / 18 * Math.PI * 2, rj = POOL - 1.9;
      b.path([
        [Math.cos(t) * rj, 0.3, Math.sin(t) * rj],
        [Math.cos(t) * rj * 0.94, 2.6, Math.sin(t) * rj * 0.94],
        [Math.cos(t) * rj * 0.82, 3.2, Math.sin(t) * rj * 0.82],
        [Math.cos(t) * rj * 0.66, 0.3, Math.sin(t) * rj * 0.66]
      ], bright * 0.55);
    }
    b.ring(0, 0.30, 0, 4.6, 34, bright * 0.8);
    b.ring(0, 0.62, 0, 4.2, 32, bright * 0.85);
    b.ring(0, 0.92, 0, 3.8, 30, bright * 0.9);
    for(var k = 0; k < 30; k++){
      var ak = k / 30 * Math.PI * 2;
      b.line([Math.cos(ak) * 4.6, 0.30, Math.sin(ak) * 4.6],
             [Math.cos(ak) * 4.2, 0.62, Math.sin(ak) * 4.2], bright * 0.4);
      b.line([Math.cos(ak) * 4.2, 0.62, Math.sin(ak) * 4.2],
             [Math.cos(ak) * 3.8, 0.92, Math.sin(ak) * 3.8], bright * 0.4);
    }
    b.box(0, 0.92, 0, 5.4, 0.5, 5.4, bright);

    var PIER = 1.85, COL0 = 1.78, COL1 = 5.0;
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(function(c){
      columnCluster(b, c[0] * PIER, c[1] * PIER, COL0, COL1, bright);
    });
    var spring = COL1 + 0.32;
    ['z','x'].forEach(function(axis){
      [-PIER, PIER].forEach(function(off){ archFace(b, axis, off, PIER, spring, bright); });
    });
    var arcTop = spring + Math.sqrt(Math.pow(PIER * 1.55, 2) - Math.pow(PIER * 0.55, 2));

    var insY = arcTop + 0.15, insH = 2.4;
    b.box(0, insY, 0, 5.0, insH, 5.0, bright);
    b.box(0, insY + insH, 0, 5.5, 0.3, 5.5, bright);
    for(var L = 1; L <= 4; L++){
      var ly = insY + 0.4 + insH * (L / 5.4);
      b.line([-1.9, ly,  2.51], [1.9, ly,  2.51], bright * 0.42);
      b.line([-1.9, ly, -2.51], [1.9, ly, -2.51], bright * 0.42);
      b.line([ 2.51, ly, -1.9], [ 2.51, ly, 1.9], bright * 0.42);
      b.line([-2.51, ly, -1.9], [-2.51, ly, 1.9], bright * 0.42);
    }

    var clkY = insY + insH + 0.3, clkH = 3.5;
    b.box(0, clkY, 0, 3.4, clkH, 3.4, bright);
    b.box(0, clkY + clkH, 0, 3.9, 0.36, 3.9, bright);
    var cy = clkY + clkH * 0.54;
    clockFace(b, 'z',  1.71, cy, 1.15, bright);
    clockFace(b, 'z', -1.71, cy, 1.15, bright);
    clockFace(b, 'x',  1.71, cy, 1.15, bright);
    clockFace(b, 'x', -1.71, cy, 1.15, bright);

    bookOnTop(b, clkY + clkH + 0.36, bright);
  }

  // A line tree: a trunk that forks, twice. Cheap, and from a distance it
  // reads as planting rather than as a stick.
  function tree(b, x, z, h, bright){
    b.line([x, 0, z], [x, h * 0.55, z], bright);
    var forks = [[-1, 0.4], [1, -0.3], [0.3, 1]];
    forks.forEach(function(d, i){
      var bx = x + d[0] * h * 0.26, bz = z + d[1] * h * 0.26, by = h * (0.8 + i * 0.06);
      b.line([x, h * 0.55, z], [bx, by, bz], bright * 0.8);
      b.line([bx, by, bz], [bx + d[0] * h * 0.14, by + h * 0.16, bz + d[1] * h * 0.14], bright * 0.55);
      b.line([bx, by, bz], [bx - d[1] * h * 0.14, by + h * 0.13, bz + d[0] * h * 0.14], bright * 0.55);
    });
  }

  function bench(b, x, z, bright){
    b.box(x, 0.42, z, 1.5, 0.12, 0.5, bright);
    [-0.6, 0.6].forEach(function(o){
      b.line([x + o, 0, z - 0.2], [x + o, 0.42, z - 0.2], bright * 0.7);
      b.line([x + o, 0, z + 0.2], [x + o, 0.42, z + 0.2], bright * 0.7);
    });
    b.line([x - 0.75, 0.54, z + 0.25], [x + 0.75, 0.54, z + 0.25], bright * 0.7);
    b.line([x - 0.75, 0.95, z + 0.3], [x + 0.75, 0.95, z + 0.3], bright * 0.7);
  }

  // The flag mast on the approach — the one vertical that breaks the
  // symmetry of the walk.
  function mast(b, x, z, bright){
    b.line([x, 0, z], [x, 7.2, z], bright);
    b.ring(x, 0.1, z, 0.5, 10, bright * 0.6);
    b.path([[x, 7.2, z], [x + 1.9, 6.7, z], [x + 1.75, 5.9, z], [x, 6.1, z]], bright * 0.85);
    b.line([x + 0.9, 7.0, z], [x + 0.85, 6.0, z], bright * 0.4);
  }

  function build(){
    var b = new Builder();

    // ---- the roundabout the landmark stands on ----
    // The photographs settle the layout: the tower is in the middle of a
    // circular plaza with the road running round it, the faceted glass
    // faculty on one side and the perforated stone block behind. There is
    // no long avenue leading up to it, so there is none here.
    monument(b, 1.0);

    var PLAZA = 15.5, ROAD_IN = 17.5, ROAD_OUT = 23.5;
    b.ring(0, 0.02, 0, PLAZA, 56, 0.5);
    b.ring(0, 0.02, 0, ROAD_IN, 60, 0.42);
    b.ring(0, 0.02, 0, ROAD_OUT, 64, 0.42);
    // the paving, as radial joints rather than a square grid
    for(var i = 0; i < 56; i++){
      var a = i / 56 * Math.PI * 2;
      b.line([Math.cos(a) * 9.4, 0.02, Math.sin(a) * 9.4],
             [Math.cos(a) * PLAZA, 0.02, Math.sin(a) * PLAZA], 0.12);
      b.line([Math.cos(a) * ROAD_IN, 0.02, Math.sin(a) * ROAD_IN],
             [Math.cos(a) * ROAD_OUT, 0.02, Math.sin(a) * ROAD_OUT], 0.09);
    }
    for(var r2 = 11; r2 < PLAZA; r2 += 2.0){ b.ring(0, 0.02, 0, r2, 48, 0.1); }

    // ---- the faceted glass faculty, to the right and behind ----
    faculty(b,  20.0, -21.0, 15.0, 11.0, 12, 0.5);
    faculty(b,  30.0, -28.0, 11.0,  8.0, 10, 0.3);
    // ---- the perforated stone block, left and behind ----
    faculty(b, -19.0, -20.0, 10.0, 16.0,  9, 0.5);
    faculty(b, -28.0, -30.0,  9.0,  9.0,  9, 0.28);
    // ---- something far off on both sides so the horizon is not bare ----
    faculty(b, -40.0, -44.0, 12.0,  7.0, 10, 0.16);
    faculty(b,  42.0, -46.0, 12.0,  9.0, 10, 0.16);

    // ---- ground beyond the road ----
    for(var gx = -60; gx <= 60; gx += 4.4){
      b.line([gx, 0, 26], [gx, 0, -56], 0.06);
    }
    for(var gz = 26; gz > -56; gz -= 4.4){
      b.line([-60, 0, gz], [60, 0, gz], 0.06);
    }
    b.line([-70, 0, -56], [70, 0, -56], 0.2);

    // ---- lamps and planting round the circle ----
    for(var L = 0; L < 8; L++){
      var al = L / 8 * Math.PI * 2 + 0.4;
      var lx = Math.cos(al) * 19.5, lz = Math.sin(al) * 19.5;
      b.line([lx, 0, lz], [lx, 3.4, lz], 0.4);
      b.line([lx - 0.34, 3.4, lz], [lx + 0.34, 3.4, lz], 0.4);
      b.ring(lx, 3.7, lz, 0.3, 8, 0.6);
      b.line([lx, 3.4, lz], [lx, 3.7, lz], 0.3);
    }
    for(var T = 0; T < 10; T++){
      var at = T / 10 * Math.PI * 2 + 0.15;
      tree(b, Math.cos(at) * 25.5, Math.sin(at) * 25.5, 3.6 + (T % 3) * 0.4, 0.3);
    }
    [0.9, 2.4, 3.9, 5.4].forEach(function(ab){
      bench(b, Math.cos(ab) * 13.2, Math.sin(ab) * 13.2, 0.26);
    });
    mast(b, -12.5, 8.0, 0.45);

    // ---- sky ----
    var seed = 7;
    function rnd(){ seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    for(var k = 0; k < 70; k++){
      var sx = (rnd() * 2 - 1) * 52;
      var sy = 16 + rnd() * 26;
      var sz = -18 - rnd() * 44;
      var rr = 0.14 + rnd() * 0.2;
      b.line([sx - rr, sy, sz], [sx + rr, sy, sz], 0.55);
      b.line([sx, sy - rr, sz], [sx, sy + rr, sz], 0.55);
    }
    return new Float32Array(b.v);
  }

  // ---------- shaders ----------

  var VERT = [
    'attribute vec4 aPos;',            // xyz + brightness in w
    'uniform mat4 uMvp;',
    // Nudge, in clip space, scaled by w so it stays a constant number of
    // PIXELS at any depth. Drawing the scene several times with small
    // offsets is how these get any thickness: WebGL clamps lineWidth to 1
    // on essentially every browser, and a 1px hairline on a 3x phone screen
    // is a third of a pixel of ink.
    'uniform vec2 uOffset;',
    'varying float vBright;',
    'varying float vFog;',
    'void main(){',
    '  vec4 p = vec4(aPos.xyz, 1.0);',
    '  gl_Position = uMvp * p;',
    '  gl_Position.xy += uOffset * gl_Position.w;',
    '  vBright = aPos.w;',
    // Depth fade. The scene runs from about 3 units in front of the camera
    // out to 55 at the far blocks, so the falloff has to be spread over that
    // whole range — a tighter curve had the gate arriving at an alpha of
    // 5/255 and the whole campus was invisible on a dark ground. The floor
    // keeps the far geometry present rather than gone.
    '  vFog = clamp(1.0 - (gl_Position.w - 8.0) / 95.0, 0.28, 1.0);',
    '}'
  ].join('\n');

  var FRAG = [
    'precision mediump float;',
    'uniform vec3 uColour;',
    'uniform float uAlpha;',
    'varying float vBright;',
    'varying float vFog;',
    'void main(){',
    // Measured, not guessed: at the previous multiplier the composited
    // screen came back with a mean luminance of 24/255 and 13% of pixels
    // lit, which is what "too dark to see" is in numbers.
    '  float a = clamp(vBright * vFog * uAlpha * 5.4, 0.0, 1.0);',
    // A bright line goes toward white and a faint one stays blue, so the
    // gate reads as lit rather than merely as more of the same colour.
    '  vec3 c = mix(uColour, vec3(1.0), clamp(vBright * 0.30, 0.0, 0.34));',
    '  gl_FragColor = vec4(c, a);',
    '}'
  ].join('\n');

  function compile(gl, type, src){
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS)){
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  // ---------- the scene ----------

  var live = null;   // only ever one; the landing is a single screen

  function start(canvas){
    if(!canvas) return false;
    var gl = null;
    try{
      var opts = { alpha: true, antialias: true, depth: false, premultipliedAlpha: false };
      gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    }catch(e){ return false; }
    if(!gl) return false;

    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if(!vs || !fs) return false;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);

    var data = build();
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 4, gl.FLOAT, false, 0, 0);

    var uMvp = gl.getUniformLocation(prog, 'uMvp');
    var uColour = gl.getUniformLocation(prog, 'uColour');
    var uAlpha = gl.getUniformLocation(prog, 'uAlpha');
    var uOffset = gl.getUniformLocation(prog, 'uOffset');

    // One solid pass down the middle and four at half strength around it.
    // Together they read as a ~2px stroke with a little bloom on it, which
    // is the difference between a wireframe you can see and one you cannot.
    var PASSES = [
      [ 0,  0, 1.00],
      [ 1,  0, 0.42], [-1,  0, 0.42],
      [ 0,  1, 0.42], [ 0, -1, 0.42]
    ];

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);        // additive: line-work on night
    gl.disable(gl.DEPTH_TEST);                 // wireframe reads better without

    var proj = mat4(), view = mat4(), mvp = mat4();
    var count = data.length / 4;

    // The one piece of state the whole animation runs on.
    var scene = {
      gl: gl, canvas: canvas, raf: 0, t0: 0,
      tiltX: 0, tiltY: 0, wantX: 0, wantY: 0,
      dead: false
    };

    function resize(){
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if(canvas.width !== w || canvas.height !== h){
        canvas.width = w; canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    // The blueprint's own blue, read off the running theme so the scene
    // belongs to whatever palette the app is in rather than to itself.
    function colour(){
      var c = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      var m = /^#([0-9a-f]{6})$/i.exec(c);
      if(m){
        var n = parseInt(m[1], 16);
        return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
      }
      return [0.56, 0.65, 1.0];
    }
    var col = colour();

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function frame(now){
      if(scene.dead) return;
      if(!scene.t0) scene.t0 = now;
      var t = (now - scene.t0) / 1000;
      resize();

      // Ease the tilt toward wherever the device or pointer last asked for,
      // so a sharp movement still arrives as a glide.
      scene.tiltX += (scene.wantX - scene.tiltX) * 0.06;
      scene.tiltY += (scene.wantY - scene.tiltY) * 0.06;

      // THE JOURNEY. Not a dolly any more — a shot. It opens high and wide
      // over the whole campus, drops toward the ground while swinging onto
      // the axis of the walk, runs down it toward the gate, and lands at
      // standing height with the arch filling the frame. Seven seconds, then
      // it breathes and never stops entirely.
      //
      // Three keyframes, eased between with a smoothstep so there is no
      // corner at the joins. Reduced motion skips straight to the last one.
      var KEYS = [
        { t: 0.0,  eye: [ 40, 34,  40], at: [0,  8,  0] },   // high, off to one side
        { t: 0.45, eye: [ 24, 16,  27], at: [0,  8,  0] },   // swinging down and round
        { t: 1.0,  eye: [3.5,  5.0, 23], at: [0, 4.6,  0] }  // across the pool, whole tower in frame
      ];
      var raw = reduced ? 1 : Math.min(1, t / 7.0);
      var eye, at;
      if(raw >= 1){
        eye = KEYS[2].eye.slice(); at = KEYS[2].at.slice();
      } else {
        var seg = raw < KEYS[1].t ? 0 : 1;
        var a = KEYS[seg], bK = KEYS[seg + 1];
        var u = (raw - a.t) / (bK.t - a.t);
        u = u * u * (3 - 2 * u);                       // smoothstep
        eye = [0,0,0]; at = [0,0,0];
        for(var i2 = 0; i2 < 3; i2++){
          eye[i2] = a.eye[i2] + (bK.eye[i2] - a.eye[i2]) * u;
          at[i2]  = a.at[i2]  + (bK.at[i2]  - a.at[i2])  * u;
        }
      }

      // The breath, and the lean. Both are added on top of wherever the
      // journey has got to, so they are alive from the first frame rather
      // than switching on at the end.
      if(!reduced){
        eye[2] += Math.sin(t * 0.31) * 0.30;
        eye[1] += Math.sin(t * 0.23) * 0.10;
      }
      eye[0] += scene.tiltX * 1.7;
      eye[1] -= scene.tiltY * 0.5;
      at[0]  += scene.tiltX * 0.5;
      at[1]  -= scene.tiltY * 1.2;

      var aspect = canvas.width / canvas.height;
      perspective(proj, 62 * Math.PI / 180, aspect, 0.1, 200);
      lookAt(view, eye, at, [0, 1, 0]);
      multiply(mvp, proj, view);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniformMatrix4fv(uMvp, false, mvp);
      gl.uniform3fv(uColour, col);
      // fade the whole scene up over the first second rather than snapping on
      var fade = Math.min(1, t / 1.1);
      var px = 2 / canvas.width, py = 2 / canvas.height;
      for(var pi = 0; pi < PASSES.length; pi++){
        var ps = PASSES[pi];
        gl.uniform2f(uOffset, ps[0] * px * 1.4, ps[1] * py * 1.4);
        gl.uniform1f(uAlpha, fade * ps[2]);
        gl.drawArrays(gl.LINES, 0, count);
      }

      scene.raf = window.requestAnimationFrame(frame);
    }

    function onPointer(e){
      var r = canvas.getBoundingClientRect();
      scene.wantX = ((e.clientX - r.left) / r.width * 2 - 1) * 1.1;
      scene.wantY = ((e.clientY - r.top) / r.height * 2 - 1) * 0.6;
    }
    function onLeave(){ scene.wantX = 0; scene.wantY = 0; }
    function onOrient(e){
      if(e.gamma == null) return;
      scene.wantX = Math.max(-1.1, Math.min(1.1, e.gamma / 26));
      scene.wantY = Math.max(-0.6, Math.min(0.6, ((e.beta || 45) - 45) / 40));
    }
    function onVisible(){
      if(document.hidden){ window.cancelAnimationFrame(scene.raf); scene.raf = 0; }
      else if(!scene.raf && !scene.dead){ scene.raf = window.requestAnimationFrame(frame); }
    }
    function onLost(e){ e.preventDefault(); stop(); }

    canvas.addEventListener('pointermove', onPointer);
    canvas.addEventListener('pointerleave', onLeave);
    window.addEventListener('deviceorientation', onOrient);
    document.addEventListener('visibilitychange', onVisible);
    canvas.addEventListener('webglcontextlost', onLost);

    scene.cleanup = function(){
      canvas.removeEventListener('pointermove', onPointer);
      canvas.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('deviceorientation', onOrient);
      document.removeEventListener('visibilitychange', onVisible);
      canvas.removeEventListener('webglcontextlost', onLost);
    };

    live = scene;
    canvas.classList.add('is-live');       // this is what hides the fallback
    scene.raf = window.requestAnimationFrame(frame);
    return true;
  }

  function stop(){
    if(!live) return;
    live.dead = true;
    if(live.raf) window.cancelAnimationFrame(live.raf);
    if(live.cleanup) live.cleanup();
    if(live.canvas) live.canvas.classList.remove('is-live');
    live = null;
  }

  // Never let a GPU problem cost anyone the sign-in button.
  function mount(canvas){
    try{ return start(canvas); }
    catch(e){ stop(); return false; }
  }

  window.AAUP_CAMPUS3D = { mount: mount, stop: stop };
})();
