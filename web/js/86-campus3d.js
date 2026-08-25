// ==========================
// THE CAMPUS, IN THREE DIMENSIONS
//
// The sign-in screen used to be a 66 KB drawing of the campus — a good
// picture that never moved. This is the same campus, built as real geometry
// and rendered by the GPU, and built from the photographs rather than from
// imagination: the clock-tower fountain on its roundabout, the white block
// with the triangular perforations and the crane still standing on it, the
// faceted glass sloping away beside it, the concentric paving, the shelter
// and the flags and the planting, the road with its cars, and beyond all of
// it the hillside, the scatter of houses on it and the wheel across the
// valley.
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
  // Append another builder's geometry, uniformly scaled. This is how the
  // landmark gets to be modelled at a comfortable working size and then set
  // down on the roundabout at the size the photographs actually show. The
  // trees, the benches and the lamps deliberately do NOT scale with it —
  // they stay the size a person is, and that is what makes the tower read
  // as tall rather than merely near.
  Builder.prototype.append = function(other, k){
    for(var i = 0; i < other.v.length; i += 4){
      this.v.push(other.v[i] * k, other.v[i + 1] * k, other.v[i + 2] * k, other.v[i + 3]);
    }
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
  // ============================================================
  // THE BUILDINGS ROUND THE CIRCLE
  //
  // The two that matter are the pair the landmark stands in front of: the
  // white stone block with the triangular perforations on the left, and the
  // faceted glass volume that slopes away to the right. They are drawn as
  // what they are rather than as generic boxes, because they are the half of
  // the view a student actually recognises.
  // ============================================================

  // The white block. Stepped volumes, and a facade of triangular openings
  // that alternate point-up and point-down the way the real one does.
  function stoneBlock(b, cx, cz, w, d, h, bright){
    b.box(cx, 0, cz, w, h, d, bright);
    // The perforations cost three lines each, so the blocks that are only
    // there to close the horizon get a coarse grid and nobody can tell.
    var near = bright > 0.32;
    var face = cz + d / 2, rows = near ? 10 : 4, cols = near ? 6 : 3;
    for(var r = 0; r < rows; r++){
      var y0 = h * (r / rows) + 0.5, y1 = h * ((r + 1) / rows) - 0.2;
      for(var c = 0; c < cols; c++){
        var x0 = cx - w / 2 + w * ((c + 0.22) / cols);
        var x1 = cx - w / 2 + w * ((c + 0.78) / cols);
        var up = (r + c) % 2 === 0;
        if(up){
          b.loop([[x0, y0, face], [x1, y0, face], [(x0 + x1) / 2, y1, face]], bright * 0.55);
        } else {
          b.loop([[x0, y1, face], [x1, y1, face], [(x0 + x1) / 2, y0, face]], bright * 0.55);
        }
      }
      b.line([cx - w / 2, h * (r / rows), face], [cx + w / 2, h * (r / rows), face], bright * 0.22);
    }
    // the set-back wing at the foot, and the parapet
    b.box(cx - w * 0.16, 0, cz + d * 0.62, w * 0.72, h * 0.42, d * 0.5, bright * 0.8);
    b.box(cx, h, cz, w + 0.5, 0.4, d + 0.5, bright * 0.9);
  }

  // The faceted glass. A single great sloping plane from a high ridge down
  // to the ground, latticed in diamonds — which is the whole impression of
  // it from the roundabout.
  function glassPrism(b, ax, az, ah, bx, bz, bh, depth, bright){
    var cols = 11, rows = 6;
    function top(u){ return [ax + (bx - ax) * u, ah + (bh - ah) * u, az + (bz - az) * u]; }
    function foot(u){ var t = top(u); return [t[0], 0, t[2] + depth]; }
    function at(u, v){
      var t = top(u), f = foot(u);
      return [t[0] + (f[0] - t[0]) * v, t[1] + (f[1] - t[1]) * v, t[2] + (f[2] - t[2]) * v];
    }
    // the ridge and the ground line
    b.line(top(0), top(1), bright);
    b.line(foot(0), foot(1), bright * 0.7);
    b.line(top(0), foot(0), bright);
    b.line(top(1), foot(1), bright);
    // the diamond lattice on the slope
    for(var i = 0; i < cols; i++){
      for(var j = 0; j < rows; j++){
        var u0 = i / cols, u1 = (i + 1) / cols, v0 = j / rows, v1 = (j + 1) / rows;
        b.line(at(u0, v0), at(u1, v1), bright * 0.42);
        b.line(at(u0, v1), at(u1, v0), bright * 0.42);
      }
    }
    for(var k = 1; k < rows; k++){ b.line(at(0, k / rows), at(1, k / rows), bright * 0.2); }
    // the back wall, so it has a body rather than being a sheet
    b.line([top(0)[0], 0, top(0)[2]], top(0), bright * 0.3);
    b.line([top(1)[0], 0, top(1)[2]], top(1), bright * 0.3);
    b.line([top(0)[0], 0, top(0)[2]], [top(1)[0], 0, top(1)[2]], bright * 0.25);
  }

  // The tower crane. It is in two of the three photographs, so it belongs.
  function crane(b, x, z, h, bright){
    var s = 0.55;
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(function(c){
      b.line([x + c[0]*s, 0, z + c[1]*s], [x + c[0]*s, h, z + c[1]*s], bright);
    });
    for(var y = 3.2; y < h; y += 3.2){
      b.loop([[x-s,y,z-s],[x+s,y,z-s],[x+s,y,z+s],[x-s,y,z+s]], bright * 0.5);
      b.line([x-s, y, z-s], [x+s, y + 3.2, z-s], bright * 0.3);
      b.line([x+s, y, z+s], [x-s, y + 3.2, z+s], bright * 0.3);
    }
    var jib = 17, back = 6, jy = h + 1.4;
    b.box(x, h, z, 1.6, 1.4, 1.6, bright);
    b.line([x - back, jy, z], [x + jib, jy, z], bright);
    b.line([x - back, jy + 0.5, z], [x + jib, jy + 0.5, z], bright * 0.7);
    for(var q = -back; q < jib; q += 2.0){
      b.line([x + q, jy, z], [x + q + 2.0, jy + 0.5, z], bright * 0.3);
    }
    b.line([x, jy + 3.4, z], [x + jib, jy + 0.5, z], bright * 0.5);
    b.line([x, jy + 3.4, z], [x - back, jy + 0.5, z], bright * 0.5);
    b.line([x, jy + 0.5, z], [x, jy + 3.4, z], bright * 0.6);
    b.line([x + jib * 0.62, jy, z], [x + jib * 0.62, jy - 3.2, z], bright * 0.35);
  }

  // The wheel on the far side of the valley.
  function ferris(b, x, z, r, bright){
    var pts = b.ring(x, r + 1.6, z, r, 22, bright * 0.8);
    b.ring(x, r + 1.6, z, r * 0.18, 10, bright * 0.6);
    for(var i = 0; i < 22; i += 1){
      if(i % 2 === 0){ b.line([x, r + 1.6, z], pts[i], bright * 0.35); }
      var p = pts[i];
      b.line([p[0] - 0.28, p[1], p[2]], [p[0] + 0.28, p[1], p[2]], bright * 0.5);
    }
    b.line([x - r * 0.6, 0, z], [x, r + 1.6, z], bright * 0.6);
    b.line([x + r * 0.6, 0, z], [x, r + 1.6, z], bright * 0.6);
  }

  // The hills. A ridge line, and a scatter of houses sitting on it.
  function ridgeLine(b, z, base, amp, seedv, houses, bright){
    var seed = seedv;
    function rnd(){ seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    var prev = null, tops = [];
    for(var x = -150; x <= 150; x += 7.5){
      var y = base + Math.sin(x * 0.031 + seedv) * amp + Math.sin(x * 0.077) * amp * 0.45 + rnd() * amp * 0.25;
      var pt = [x, Math.max(1, y), z];
      if(prev) b.line(prev, pt, bright);
      prev = pt; tops.push(pt);
    }
    for(var k = 0; k < houses; k++){
      var t = tops[2 + Math.floor(rnd() * (tops.length - 4))];
      var hw = 1.6 + rnd() * 1.6, hh = 1.2 + rnd() * 1.4;
      var hx = t[0] + (rnd() * 2 - 1) * 3, hy = t[1] - 0.6, hz = t[2] + 1.5;
      b.path([[hx - hw / 2, hy, hz], [hx - hw / 2, hy + hh, hz],
              [hx + hw / 2, hy + hh, hz], [hx + hw / 2, hy, hz]], bright * 1.4);
    }
  }

  function car(b, x, z, ang, bright){
    var ca = Math.cos(ang), sa = Math.sin(ang);
    function P(u, y, v){ return [x + u * ca - v * sa, y, z + u * sa + v * ca]; }
    var L = 2.1, W = 0.85;
    b.loop([P(-L, 0.28, -W), P(L, 0.28, -W), P(L, 0.28, W), P(-L, 0.28, W)], bright);
    b.loop([P(-L, 0.78, -W), P(L, 0.78, -W), P(L, 0.78, W), P(-L, 0.78, W)], bright * 0.8);
    [[-L,-W],[L,-W],[L,W],[-L,W]].forEach(function(c){
      b.line(P(c[0], 0.28, c[1]), P(c[0], 0.78, c[1]), bright * 0.6);
    });
    b.loop([P(-0.9, 1.32, -W * 0.8), P(0.7, 1.32, -W * 0.8),
            P(0.7, 1.32, W * 0.8), P(-0.9, 1.32, W * 0.8)], bright * 0.7);
    b.line(P(-L * 0.7, 0.78, -W), P(-0.9, 1.32, -W * 0.8), bright * 0.5);
    b.line(P( L * 0.7, 0.78, -W), P( 0.7, 1.32, -W * 0.8), bright * 0.5);
  }

  function palm(b, x, z, h, bright){
    var pts = [];
    for(var i = 0; i <= 5; i++){
      var f = i / 5;
      pts.push([x + f * f * 0.5, h * f, z + f * f * 0.2]);
    }
    b.path(pts, bright);
    var top = pts[5];
    for(var k = 0; k < 8; k++){
      var a = k / 8 * Math.PI * 2;
      var mx = top[0] + Math.cos(a) * 1.0, mz = top[2] + Math.sin(a) * 1.0;
      b.path([top, [mx, top[1] + 0.45, mz],
              [top[0] + Math.cos(a) * 1.9, top[1] - 0.35, top[2] + Math.sin(a) * 1.9]], bright * 0.7);
    }
  }

  function planter(b, x, z, bright){
    b.ring(x, 0.40, z, 0.36, 8, bright);
    for(var i = 0; i < 8; i++){
      var a = i / 8 * Math.PI * 2;
      if(i % 2 === 0){
        b.line([x + Math.cos(a) * 0.28, 0.02, z + Math.sin(a) * 0.28],
               [x + Math.cos(a) * 0.36, 0.40, z + Math.sin(a) * 0.36], bright * 0.45);
      }
      b.line([x, 0.40, z], [x + Math.cos(a) * 0.42, 0.95 + (i % 3) * 0.14, z + Math.sin(a) * 0.42], bright * 0.45);
    }
  }

  // The shelter beside the circle, patterned panel and all.
  function shelter(b, x, z, bright){
    var w = 4.6, d = 2.0, h = 2.6;
    b.box(x, h, z, w, 0.22, d, bright);
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(function(c){
      b.line([x + c[0]*w/2, 0, z + c[1]*d/2], [x + c[0]*w/2, h, z + c[1]*d/2], bright * 0.8);
    });
    for(var i = 0; i < 7; i++){
      var px = x - w / 2 + w * ((i + 0.5) / 7);
      b.loop([[px - 0.22, 0.5, z - d/2], [px + 0.22, 0.5, z - d/2],
              [px + 0.22, h - 0.2, z - d/2], [px - 0.22, h - 0.2, z - d/2]], bright * 0.45);
      b.line([px, 0.5, z - d/2], [px, h - 0.2, z - d/2], bright * 0.25);
    }
    b.box(x, 0.45, z + 0.3, w * 0.8, 0.1, 0.4, bright * 0.7);
  }

  // A person, at the size a person is. Six of them do more for the sense of
  // scale than any amount of extra geometry on the tower.
  function person(b, x, z, bright){
    b.ring(x, 1.60, z, 0.09, 6, bright);
    b.line([x, 0.86, z], [x, 1.51, z], bright);
    b.line([x, 0.86, z], [x - 0.11, 0, z], bright * 0.7);
    b.line([x, 0.86, z], [x + 0.11, 0, z], bright * 0.7);
    b.line([x, 1.40, z], [x - 0.17, 0.92, z], bright * 0.45);
    b.line([x, 1.40, z], [x + 0.17, 0.92, z], bright * 0.45);
  }

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
  // in x; 'x' is the reverse. Two rings, an inner and an outer, because the
  // real arch has a reveal of real depth.
  function archFace(b, axis, offset, halfW, y0, bright){
    var a = archProfile(halfW, y0, 14);
    var inner = archProfile(halfW * 0.84, y0, 14);
    function put(px, py){ return axis === 'z' ? [px, py, offset] : [offset, py, px]; }
    for(var i = 0; i < a.pts.length - 1; i++){
      b.line(put(a.pts[i][0], a.pts[i][1]), put(a.pts[i+1][0], a.pts[i+1][1]), bright);
      b.line(put(inner.pts[i][0], inner.pts[i][1]),
             put(inner.pts[i+1][0], inner.pts[i+1][1]), bright * 0.55);
    }
    [-halfW, halfW].forEach(function(e){
      b.line(put(e, y0), put(e, y0 - 0.5), bright * 0.7);
    });
    return a.apexY;
  }

  // The piers. Each is a pair of round shafts with a base and a capital,
  // which is what the photographs show — not a single stick.
  function columnCluster(b, x, z, y0, y1, bright){
    var r = 0.19;
    for(var i = 0; i < 3; i++){
      var a = i / 3 * Math.PI * 2 + 0.4;
      var cx = x + Math.cos(a) * r * 1.7, cz = z + Math.sin(a) * r * 1.7;
      b.line([cx, y0, cz], [cx, y1, cz], bright);
      b.ring(cx, y0 + 0.08, cz, r, 7, bright * 0.7);
      b.ring(cx, y1 - 0.08, cz, r, 7, bright * 0.7);
    }
    b.box(x, y0 - 0.40, z, 1.15, 0.40, 1.15, bright);
    b.box(x, y0 - 0.16, z, 0.95, 0.16, 0.95, bright * 0.7);
    b.box(x, y1, z, 1.0, 0.34, 1.0, bright);
  }

  function clockFace(b, axis, offset, cy, r, bright){
    function put(px, py){ return axis === 'z' ? [px, py, offset] : [offset, py, px]; }
    var outer = [], mid = [], inner = [];
    for(var i = 0; i < 22; i++){
      var t = i / 22 * Math.PI * 2;
      outer.push(put(Math.cos(t) * r * 1.10, cy + Math.sin(t) * r * 1.10));
      mid.push(put(Math.cos(t) * r, cy + Math.sin(t) * r));
      inner.push(put(Math.cos(t) * r * 0.86, cy + Math.sin(t) * r * 0.86));
    }
    b.loop(outer, bright * 0.8);
    b.loop(mid, bright);
    b.loop(inner, bright * 0.7);
    for(var m = 0; m < 12; m++){
      var a = m / 12 * Math.PI * 2;
      var k = (m % 3 === 0) ? 0.68 : 0.78;
      b.line(put(Math.cos(a) * r * k, cy + Math.sin(a) * r * k),
             put(Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86),
             bright * (m % 3 === 0 ? 0.95 : 0.55));
    }
    b.line(put(0, cy), put(0, cy + r * 0.60), bright);
    b.line(put(0, cy), put(r * 0.44, cy + r * 0.22), bright);
  }

  function bookOnTop(b, y0, bright){
    b.box(0, y0, 0, 1.9, 0.30, 1.9, bright);
    b.box(0, y0 + 0.30, 0, 1.5, 0.26, 1.5, bright * 0.85);
    var base = y0 + 0.56;
    var w = 1.75, h = 0.80, d = 1.25;
    [-1, 1].forEach(function(s){
      b.line([0, base, 0], [s * w * 0.5, base + h, -d * 0.5], bright);
      b.line([0, base, 0], [s * w * 0.5, base + h,  d * 0.5], bright);
      b.line([s * w * 0.5, base + h, -d * 0.5], [s * w * 0.5, base + h, d * 0.5], bright);
      for(var k = 1; k <= 3; k++){
        var f = k / 4;
        b.line([s * w * 0.5 * f, base + h * f, -d * 0.5 * f],
               [s * w * 0.5 * f, base + h * f,  d * 0.5 * f], bright * 0.4);
      }
    });
    b.line([0, base, -d * 0.5], [0, base, d * 0.5], bright * 0.8);
  }

  // ============================================================
  // THE LANDMARK
  //
  // The clock tower and the fountain are one object. Bottom to top:
  // the tiled pool and its jets, the stepped island, four piers of clustered
  // columns carrying a pointed arch on each face, the dark granite core
  // standing behind them, the projecting inscription band, the clock stage
  // with a face on every side, the pitched cap, and the open book.
  // ============================================================
  function monument(b, bright){
    var POOL = 9.0;

    // ---- the pool: kerb, rim wall, water line, jets ----
    b.ring(0, 0.00, 0, POOL + 1.3, 52, bright * 0.5);       // the kerb outside
    b.ring(0, 0.10, 0, POOL + 1.0, 52, bright * 0.6);
    b.ring(0, 0.00, 0, POOL,       52, bright * 0.8);
    b.ring(0, 0.72, 0, POOL,       52, bright * 0.95);      // the rim wall
    b.ring(0, 0.72, 0, POOL - 0.6, 50, bright * 0.7);
    b.ring(0, 0.46, 0, POOL - 1.4, 48, bright * 0.5);       // the water
    for(var i = 0; i < 36; i++){
      var a = i / 36 * Math.PI * 2;
      b.line([Math.cos(a) * POOL, 0, Math.sin(a) * POOL],
             [Math.cos(a) * POOL, 0.72, Math.sin(a) * POOL], bright * 0.38);
    }
    for(var j = 0; j < 24; j++){
      var t = j / 24 * Math.PI * 2, rj = POOL - 1.9;
      var tall = (j % 2 === 0);
      var top = tall ? 3.3 : 2.4;
      b.path([
        [Math.cos(t) * rj, 0.4, Math.sin(t) * rj],
        [Math.cos(t) * rj * 0.95, top * 0.78, Math.sin(t) * rj * 0.95],
        [Math.cos(t) * rj * 0.84, top, Math.sin(t) * rj * 0.84],
        [Math.cos(t) * rj * 0.66, 0.4, Math.sin(t) * rj * 0.66]
      ], bright * (tall ? 0.6 : 0.45));
    }

    // ---- the island the tower stands on ----
    b.ring(0, 0.30, 0, 4.6, 36, bright * 0.8);
    b.ring(0, 0.62, 0, 4.2, 34, bright * 0.85);
    b.ring(0, 0.92, 0, 3.8, 32, bright * 0.9);
    for(var k = 0; k < 32; k++){
      var ak = k / 32 * Math.PI * 2;
      b.line([Math.cos(ak) * 4.6, 0.30, Math.sin(ak) * 4.6],
             [Math.cos(ak) * 4.2, 0.62, Math.sin(ak) * 4.2], bright * 0.4);
      b.line([Math.cos(ak) * 4.2, 0.62, Math.sin(ak) * 4.2],
             [Math.cos(ak) * 3.8, 0.92, Math.sin(ak) * 3.8], bright * 0.4);
    }
    b.box(0, 0.92, 0, 5.4, 0.5, 5.4, bright);

    // ---- the piers, and the dark core standing behind them ----
    var PIER = 1.85, COL0 = 1.78, COL1 = 5.0;
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(function(c){
      columnCluster(b, c[0] * PIER, c[1] * PIER, COL0, COL1, bright);
    });
    var spring = COL1 + 0.32;
    ['z','x'].forEach(function(axis){
      [-PIER, PIER].forEach(function(off){ archFace(b, axis, off, PIER, spring, bright); });
    });
    var arcTop = spring + Math.sqrt(Math.pow(PIER * 1.55, 2) - Math.pow(PIER * 0.55, 2));
    // the granite core: darker, set back, visible through the arches
    b.box(0, COL0 - 0.4, 0, 2.5, arcTop - COL0 + 0.6, 2.5, bright * 0.42);
    for(var g = 1; g <= 5; g++){
      var gy = COL0 + (arcTop - COL0) * (g / 6);
      b.line([-1.25, gy, 1.25], [1.25, gy, 1.25], bright * 0.18);
      b.line([-1.25, gy, -1.25], [1.25, gy, -1.25], bright * 0.18);
    }

    // ---- the inscription band, projecting past the shafts ----
    var insY = arcTop + 0.15, insH = 2.4;
    b.box(0, insY, 0, 5.6, 0.26, 5.6, bright);              // the sill it sits on
    b.box(0, insY + 0.26, 0, 5.0, insH, 5.0, bright);
    b.box(0, insY + 0.26 + insH, 0, 5.6, 0.34, 5.6, bright);
    for(var L = 1; L <= 5; L++){
      var ly = insY + 0.5 + insH * (L / 6.4);
      var len = (L === 1) ? 1.1 : 1.95;                     // the short title line
      b.line([-len, ly,  2.51], [len, ly,  2.51], bright * (L === 1 ? 0.3 : 0.44));
      b.line([-len, ly, -2.51], [len, ly, -2.51], bright * (L === 1 ? 0.3 : 0.44));
      b.line([ 2.51, ly, -len], [ 2.51, ly, len], bright * (L === 1 ? 0.3 : 0.44));
      b.line([-2.51, ly, -len], [-2.51, ly, len], bright * (L === 1 ? 0.3 : 0.44));
    }

    // ---- the clock stage, and the pitched cap over it ----
    var clkY = insY + 0.26 + insH + 0.34, clkH = 3.5;
    b.box(0, clkY, 0, 3.4, clkH, 3.4, bright);
    b.box(0, clkY + clkH, 0, 3.9, 0.30, 3.9, bright);
    var cy = clkY + clkH * 0.54;
    clockFace(b, 'z',  1.71, cy, 1.15, bright);
    clockFace(b, 'z', -1.71, cy, 1.15, bright);
    clockFace(b, 'x',  1.71, cy, 1.15, bright);
    clockFace(b, 'x', -1.71, cy, 1.15, bright);
    // the sloping cap: four faces rising to a short ridge
    var capY = clkY + clkH + 0.30, capH = 1.15, rz = 0.85;
    var e = 1.95;
    b.line([-rz, capY + capH, 0], [rz, capY + capH, 0], bright);
    [[-e,-e],[e,-e],[e,e],[-e,e]].forEach(function(c){
      b.line([c[0], capY, c[1]], [c[0] > 0 ? rz : -rz, capY + capH, 0], bright * 0.8);
    });
    b.loop([[-e,capY,-e],[e,capY,-e],[e,capY,e],[-e,capY,e]], bright);
    b.line([0, capY, -e], [0, capY + capH, 0], bright * 0.5);
    b.line([0, capY,  e], [0, capY + capH, 0], bright * 0.5);

    bookOnTop(b, capY + capH, bright);
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

  // The flag masts by the glass.
  function mast(b, x, z, bright){
    b.line([x, 0, z], [x, 7.2, z], bright);
    b.ring(x, 0.1, z, 0.5, 10, bright * 0.6);
    b.path([[x, 7.2, z], [x + 1.9, 6.7, z], [x + 1.75, 5.9, z], [x, 6.1, z]], bright * 0.85);
    b.line([x + 0.9, 7.0, z], [x + 0.85, 6.0, z], bright * 0.4);
  }

  function build(){
    var b = new Builder();

    // ---- the landmark, in the middle of its circle ----
    monument(b, 1.0);

    // ---- the roundabout ----
    // From the photograph taken out of the glass: concentric bands of
    // paving, the road round the outside, the whole thing sitting on a
    // shelf cut into the hillside.
    var POOL = 9.0;
    var PLAZA = 15.5, ROAD_IN = 17.5, ROAD_OUT = 23.5;
    b.ring(0, 0.02, 0, PLAZA, 60, 0.5);
    b.ring(0, 0.02, 0, ROAD_IN, 64, 0.42);
    b.ring(0, 0.02, 0, ROAD_OUT, 68, 0.42);
    b.ring(0, 0.02, 0, ROAD_OUT + 0.5, 68, 0.2);
    for(var i = 0; i < 44; i++){
      var a = i / 44 * Math.PI * 2;
      b.line([Math.cos(a) * (POOL + 1.4), 0.02, Math.sin(a) * (POOL + 1.4)],
             [Math.cos(a) * PLAZA, 0.02, Math.sin(a) * PLAZA], 0.12);
      b.line([Math.cos(a) * ROAD_IN, 0.02, Math.sin(a) * ROAD_IN],
             [Math.cos(a) * ROAD_OUT, 0.02, Math.sin(a) * ROAD_OUT], 0.09);
    }
    for(var r2 = POOL + 2.2; r2 < PLAZA; r2 += 1.8){ b.ring(0, 0.02, 0, r2, 48, 0.1); }
    // the dashed lane line on the road
    for(var dm = 0; dm < 48; dm++){
      if(dm % 2) continue;
      var a0 = dm / 48 * Math.PI * 2, a1 = (dm + 1) / 48 * Math.PI * 2, rm = (ROAD_IN + ROAD_OUT) / 2;
      b.line([Math.cos(a0) * rm, 0.03, Math.sin(a0) * rm],
             [Math.cos(a1) * rm, 0.03, Math.sin(a1) * rm], 0.3);
    }

    // ---- the complex the landmark stands in front of ----
    // White perforated block on the left, faceted glass sloping away to the
    // right, exactly as they sit behind the fountain from the road.
    stoneBlock(b, -14.0, -38.0, 15.0, 13.0, 25.0, 0.40);
    stoneBlock(b, -26.0, -34.0,  9.0,  9.0, 12.0, 0.24);
    crane(b, -10.0, -43.0, 33.0, 0.26);
    glassPrism(b, 1.0, -37.0, 19.0, 26.0, -47.0, 4.0, 10.0, 0.34);
    // the angular canopy where the two meet, over the entrance
    b.path([[-6.0, 11.5, -28.5], [1.5, 9.0, -25.0], [7.5, 10.5, -28.5]], 0.5);
    b.line([-6.0, 11.5, -28.5], [-6.0, 8.0, -30.5], 0.35);
    b.line([ 7.5, 10.5, -28.5], [ 7.5, 8.0, -30.5], 0.35);
    // and something low and far on the other side, so the circle is enclosed
    stoneBlock(b, 34.0, -20.0, 11.0, 9.0, 8.0, 0.24);
    stoneBlock(b, -46.0, -48.0, 12.0, 10.0, 9.0, 0.16);

    // ---- the hillside beyond, and the wheel across the valley ----
    ridgeLine(b, -78.0, 7.0, 4.5, 3, 9, 0.30);
    ridgeLine(b, -104.0, 12.0, 6.0, 11, 6, 0.18);
    ferris(b, -60.0, -72.0, 7.0, 0.3);
    // the road that runs along the foot of the hill
    b.line([-120, 0.02, -62], [120, 0.02, -62], 0.16);
    b.line([-120, 0.02, -67], [120, 0.02, -67], 0.12);
    for(var pc = 0; pc < 7; pc++){
      car(b, -48 + pc * 16.0, -64.5, 0.0, 0.22);
    }

    // ---- ground ----
    for(var gx = -70; gx <= 70; gx += 5.0){ b.line([gx, 0, 30], [gx, 0, -60], 0.055); }
    for(var gz = 30; gz > -60; gz -= 5.0){ b.line([-70, 0, gz], [70, 0, gz], 0.055); }

    // ---- everything at the size a person is ----
    for(var L = 0; L < 10; L++){
      var al = L / 10 * Math.PI * 2 + 0.4;
      var lx = Math.cos(al) * 19.5, lz = Math.sin(al) * 19.5;
      b.line([lx, 0, lz], [lx, 3.4, lz], 0.4);
      b.line([lx - 0.34, 3.4, lz], [lx + 0.34, 3.4, lz], 0.4);
      b.ring(lx, 3.7, lz, 0.3, 8, 0.6);
      b.line([lx, 3.4, lz], [lx, 3.7, lz], 0.3);
    }
    for(var T = 0; T < 9; T++){
      var at = T / 9 * Math.PI * 2 + 0.15;
      tree(b, Math.cos(at) * 26.5, Math.sin(at) * 26.5, 3.6 + (T % 3) * 0.4, 0.3);
    }
    [2.1, 2.75, 3.5, 4.15].forEach(function(ap){
      palm(b, Math.cos(ap) * 29.0, Math.sin(ap) * 29.0, 5.4, 0.3);
    });
    for(var P = 0; P < 10; P++){
      var apn = P / 10 * Math.PI * 2 + 0.26;
      planter(b, Math.cos(apn) * 14.6, Math.sin(apn) * 14.6, 0.22);
    }
    [0.9, 2.4, 3.9, 5.4].forEach(function(ab){
      bench(b, Math.cos(ab) * 12.6, Math.sin(ab) * 12.6, 0.26);
    });
    shelter(b, 15.5, -14.0, 0.42);
    mast(b, 20.0, -22.0, 0.45);
    mast(b, 22.6, -23.4, 0.34);
    mast(b, 25.2, -24.8, 0.34);
    // Beyond the pool, so they give the tower its scale instead of standing
    // in the lens.
    [[-7.4, -11.6], [-5.9, -11.9], [4.8, -12.4], [8.6, -11.0],
     [13.2, -13.4], [14.6, -13.0], [-12.4, -7.0], [10.4, -15.2],
     [-2.2, -13.8]].forEach(function(pp){
      person(b, pp[0], pp[1], 0.34);
    });
    for(var rc = 0; rc < 3; rc++){
      var arc = 2.0 + rc * 0.55;
      car(b, Math.cos(arc) * 20.5, Math.sin(arc) * 20.5, arc + Math.PI / 2, 0.34);
    }

    // ---- sky ----
    var seed = 7;
    function rnd(){ seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    for(var k = 0; k < 80; k++){
      var sx = (rnd() * 2 - 1) * 62;
      var sy = 18 + rnd() * 30;
      var sz = -24 - rnd() * 52;
      var rr = 0.15 + rnd() * 0.22;
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
    '  vFog = clamp(1.0 - (gl_Position.w - 12.0) / 150.0, 0.28, 1.0);',
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
        { t: 0.0,  eye: [ 54, 40,  54], at: [0, 10,  0] },   // high and wide: the whole area
        { t: 0.45, eye: [ 26, 17,  29], at: [0,  8,  0] },   // swinging down and round
        { t: 1.0,  eye: [3.5,  4.0, 22], at: [0, 5.6,  0] }  // across the pool, whole tower in frame
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
      perspective(proj, 62 * Math.PI / 180, aspect, 0.1, 320);
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
