// ==========================
// THE CAMPUS, IN THREE DIMENSIONS
//
// The sign-in screen used to be a 66 KB drawing of the walk up to the
// fountain — a good picture that never moved. This is the same walk, built
// as real geometry and rendered by the GPU: the arched clock gate, the two
// faceted faculty blocks either side, the fountain, the walkway running out
// to the bottom of the screen, the lamps along it, and a sky above.
//
// WHY NOT three.js. This app's whole promise is that it works offline, on a
// cheap phone, on campus wifi, and the entire bundle is around 400 KB. A 3D
// library would be roughly 150 KB gzipped — the largest single thing in the
// app, downloaded before a student has seen one course. Everything below is
// WebGL 1 written directly: the same scene, a few kilobytes, no dependency,
// and it runs from the service-worker cache with no network at all.
//
// WHAT IT DOES. A slow dolly down the walkway toward the gate, a gentle sway
// from the gyroscope (or the pointer on a desktop), depth fog so the far
// geometry falls away, and the whole thing drawn as blueprint line-work so
// it belongs to the same drawing the app has always used.
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

  // The arched gate with the clock — the centre of the whole view.
  function gate(b, z, bright, k){
    k = k || 1;
    var W = 3.1 * k, H = 5.2 * k, T = 1.5 * k, legTop = 3.0 * k;
    [-1, 1].forEach(function(s){
      b.box(s * W / 2, 0, z, 0.9 * k, legTop, T, bright);
    });
    // the arch itself, as a半 circle swept between the two legs
    var seg = 22, arch = [], archBack = [];
    for(var i = 0; i <= seg; i++){
      var a = Math.PI * (i / seg);
      arch.push([-Math.cos(a) * (W/2 - 0.1 * k), legTop + Math.sin(a) * 1.5 * k, z + T/2]);
      archBack.push([-Math.cos(a) * (W/2 - 0.1 * k), legTop + Math.sin(a) * 1.5 * k, z - T/2]);
    }
    b.path(arch, bright); b.path(archBack, bright);
    for(var j = 0; j <= seg; j += 3){ b.line(arch[j], archBack[j], bright * 0.5); }
    // the block the clock sits in
    b.box(0, legTop + 1.5 * k, z, 2.0 * k, H - legTop - 1.5 * k, T * 0.9, bright);
    // the clock face, on the side you walk toward
    var cy = legTop + 1.5 * k + (H - legTop - 1.5 * k) / 2, cz = z + T * 0.45 + 0.01;
    var face = [];
    // `ci`, not `k`: the scale parameter is also called k, and a loop
    // variable shadowing it meant the clock's radius was the loop index —
    // the face was being drawn as an expanding spiral, not a circle.
    for(var ci = 0; ci < 24; ci++){
      var t = ci / 24 * Math.PI * 2;
      face.push([Math.cos(t) * 0.55 * k, cy + Math.sin(t) * 0.55 * k, cz]);
    }
    b.loop(face, bright);
    b.line([0, cy, cz], [0, cy + 0.38 * k, cz], bright);          // the long hand
    b.line([0, cy, cz], [0.26 * k, cy + 0.12 * k, cz], bright);   // the short one
    for(var m = 0; m < 12; m++){
      var a2 = m / 12 * Math.PI * 2;
      b.line([Math.cos(a2) * 0.47 * k, cy + Math.sin(a2) * 0.47 * k, cz],
             [Math.cos(a2) * 0.55 * k, cy + Math.sin(a2) * 0.55 * k, cz], bright * 0.7);
    }
    // the spire
    b.line([0, H, z], [0, H + 0.9 * k, z], bright);
    b.line([-0.28 * k, H + 0.62 * k, z], [0.28 * k, H + 0.62 * k, z], bright * 0.7);
  }

  function fountain(b, z, bright){
    b.ring(0, 0.02, z, 2.4, 40, bright);
    b.ring(0, 0.34, z, 2.4, 40, bright);
    b.ring(0, 0.36, z, 1.5, 32, bright * 0.8);
    b.ring(0, 0.9, z, 0.55, 20, bright * 0.7);
    for(var i = 0; i < 12; i++){
      var a = i / 12 * Math.PI * 2;
      b.line([Math.cos(a) * 1.5, 0.36, z + Math.sin(a) * 1.5],
             [Math.cos(a) * 2.4, 0.34, z + Math.sin(a) * 2.4], bright * 0.4);
    }
    b.line([0, 0.36, z], [0, 0.9, z], bright * 0.6);
    // the plume
    for(var j = 0; j < 8; j++){
      var t = j / 8 * Math.PI * 2, r = 0.5;
      b.path([[0, 1.5, z],
              [Math.cos(t) * r * 0.6, 1.25, z + Math.sin(t) * r * 0.6],
              [Math.cos(t) * r, 0.5, z + Math.sin(t) * r]], bright * 0.45);
    }
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

  // Steps up to the gate, so the walk arrives somewhere rather than simply
  // stopping.
  function steps(b, z, n, bright){
    for(var i = 0; i < n; i++){
      var y = i * 0.22, zz = z + i * 0.55, halfW = 5.2 - i * 0.15;
      b.line([-halfW, y, zz], [halfW, y, zz], bright);
      b.line([-halfW, y, zz], [-halfW, y + 0.22, zz], bright * 0.5);
      b.line([ halfW, y, zz], [ halfW, y + 0.22, zz], bright * 0.5);
    }
  }

  function build(){
    var b = new Builder();
    var GATE_Z = -30, FOUNTAIN_Z = -15, STEP_Z = -25.5;

    // ---- the walk ----
    b.path([[-4.2, 0, 16], [-4.2, 0, STEP_Z]], 0.9);
    b.path([[ 4.2, 0, 16], [ 4.2, 0, STEP_Z]], 0.9);
    b.path([[-1.3, 0, 16], [-1.3, 0, STEP_Z]], 0.3);
    b.path([[ 1.3, 0, 16], [ 1.3, 0, STEP_Z]], 0.3);
    for(var z = 16; z > STEP_Z; z -= 1.4){
      b.line([-4.2, 0, z], [4.2, 0, z], 0.32);
    }
    [-4.2, 4.2].forEach(function(x){
      b.path([[x, 0.14, 16], [x, 0.14, STEP_Z]], 0.45);
      b.path([[x * 1.06, 0, 16], [x * 1.06, 0, STEP_Z]], 0.3);
    });
    steps(b, STEP_Z, 7, 0.75);

    // ---- ground ----
    for(var gx = -46; gx <= 46; gx += 3.6){
      if(Math.abs(gx) < 4.6) continue;
      b.line([gx, 0, 18], [gx, 0, GATE_Z - 16], 0.12);
    }
    for(var gz = 18; gz > GATE_Z - 16; gz -= 3.6){
      b.line([-46, 0, gz], [-4.6, 0, gz], 0.12);
      b.line([ 4.6, 0, gz], [ 46, 0, gz], 0.12);
    }
    b.line([-52, 0, GATE_Z - 16], [52, 0, GATE_Z - 16], 0.24);

    // ---- the faculties: four pairs, plus two set well back ----
    var rows = [
      { z:   2, x: 10.5, w: 7.0, h:  6.0, d: 7, br: 0.60 },
      { z:  -9, x: 11.0, w: 6.8, h: 10.5, d: 8, br: 0.55 },
      { z: -20, x: 12.0, w: 6.4, h:  7.5, d: 7, br: 0.42 },
      { z: -31, x: 13.5, w: 6.0, h: 12.0, d: 7, br: 0.30 },
      { z: -42, x: 15.5, w: 7.5, h:  6.0, d: 7, br: 0.20 }
    ];
    rows.forEach(function(r){
      faculty(b, -r.x, r.z, r.w, r.h, r.d, r.br);
      faculty(b,  r.x, r.z, r.w, r.h, r.d, r.br);
    });
    // two towers further out, to give the skyline a silhouette
    faculty(b, -22, -26, 5.0, 16.0, 5, 0.22);
    faculty(b,  22, -26, 5.0, 16.0, 5, 0.22);

    fountain(b, FOUNTAIN_Z, 0.9);
    gate(b, GATE_Z, 1.0, 2.1);
    mast(b, -7.4, -3, 0.55);

    // ---- lamps, benches and planting down the approach ----
    for(var lz = 13; lz > STEP_Z + 2; lz -= 4.0){
      [-5.4, 5.4].forEach(function(lx){
        b.line([lx, 0, lz], [lx, 3.0, lz], 0.45);
        b.line([lx - 0.32, 3.0, lz], [lx + 0.32, 3.0, lz], 0.45);
        b.ring(lx, 3.28, lz, 0.28, 8, 0.65);
        b.line([lx, 3.0, lz], [lx, 3.28, lz], 0.3);
      });
    }
    for(var tz = 11; tz > -24; tz -= 5.5){
      tree(b, -7.0, tz, 3.4 + ((tz % 3) + 3) * 0.22, 0.34);
      tree(b,  7.0, tz + 2.6, 3.4 + ((tz % 4) + 4) * 0.18, 0.34);
    }
    [-6.0, 6.0].forEach(function(bx){
      [6, -2, -10, -18].forEach(function(bz){ bench(b, bx, bz, 0.3); });
    });

    // ---- sky ----
    var seed = 7;
    function rnd(){ seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    for(var i = 0; i < 60; i++){
      var sx = (rnd() * 2 - 1) * 44;
      var sy = 12 + rnd() * 22;
      var sz = GATE_Z - 6 - rnd() * 34;
      var r = 0.14 + rnd() * 0.2;
      b.line([sx - r, sy, sz], [sx + r, sy, sz], 0.55);
      b.line([sx, sy - r, sz], [sx, sy + r, sz], 0.55);
    }
    return new Float32Array(b.v);
  }

  // ---------- shaders ----------

  var VERT = [
    'attribute vec4 aPos;',            // xyz + brightness in w
    'uniform mat4 uMvp;',
    'varying float vBright;',
    'varying float vFog;',
    'void main(){',
    '  vec4 p = vec4(aPos.xyz, 1.0);',
    '  gl_Position = uMvp * p;',
    '  vBright = aPos.w;',
    // Depth fade. The scene runs from about 3 units in front of the camera
    // out to 55 at the far blocks, so the falloff has to be spread over that
    // whole range — a tighter curve had the gate arriving at an alpha of
    // 5/255 and the whole campus was invisible on a dark ground. The floor
    // keeps the far geometry present rather than gone.
    '  vFog = clamp(1.0 - (gl_Position.w - 6.0) / 70.0, 0.12, 1.0);',
    '}'
  ].join('\n');

  var FRAG = [
    'precision mediump float;',
    'uniform vec3 uColour;',
    'uniform float uAlpha;',
    'varying float vBright;',
    'varying float vFog;',
    'void main(){',
    // 2.1 rather than 1.0: these are hairlines on a night ground under
    // additive blending, and at their honest alpha the whole campus read as
    // a smudge. Clamped so the near geometry cannot blow out.
    '  float a = clamp(vBright * vFog * uAlpha * 2.8, 0.0, 0.95);',
    '  gl_FragColor = vec4(uColour * (0.6 + vBright * 0.4), a);',
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
        { t: 0.0,  eye: [ 30, 34,  34], at: [0,  5, -14] },   // wide, above
        { t: 0.45, eye: [ 11, 13,  18], at: [0,  7, -24] },   // dropping in
        { t: 1.0,  eye: [  0, 2.4,  5], at: [0,  8.2, -30] }  // facing the arch
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
      gl.uniform1f(uAlpha, Math.min(1, t / 1.1));
      gl.drawArrays(gl.LINES, 0, count);

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
