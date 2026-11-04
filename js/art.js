/* =========================================================
   art.js — 本地离线 SVG 插图（低饱和素描/淡彩）
   人物母版：同一角色按性别固定发型与脸型，只随年龄改变
   发色、皱纹、体态；全部为矢量图形，不引用任何外部图片。
   场景与人物像一律以 data URI 内联输出，离线可用、无 404。
   ========================================================= */
(function () {
  'use strict';
  var LS = window.LS = window.LS || {};

  var C = {
    paper: '#f7f3ea',
    ink: '#4a443c',
    soft: '#8d8579',
    skin: '#e6c9ad',
    skinOld: '#d9bda3',
    hair: '#3b332c',
    hairMid: '#4a4139',
    hairOld: '#a49c92',
    cloth: '#7d8a84',
    clothWarm: '#a08a6c',
    accent: '#9c4a34',
    teal: '#5c7a74',
    line: '#c9bea9'
  };

  function svg(w, h, inner) {
    return '<svg class="art-svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h +
      '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + inner + '</svg>';
  }

  /* ---------- 人物母版：男/女 × 婴幼儿/童年/少年/青年/中年/中老年/晚年 ---------- */
  LS.artPerson = function (gender, stage, variant) {
    var fem = gender === '女' || gender === '其他';
    /* 同一脸型、同一衣领、同一发型逻辑，只按年龄改头身比、发量、发色与体态 */
    var CFG = {
      infant: {
        cy: 92, rx: 26, ry: 30, shoulderY: 134, bodyBottom: 190,
        bodyW: fem ? 24 : 28, cloth: '#d8ccb9', skin: '#ecd0b6', hair: '#4a4139',
        fx: 0.81, fy: 0.75, style: 'infant', brow: false
      },
      child: {
        cy: 86, rx: 29, ry: 36, shoulderY: 146, bodyBottom: 194,
        bodyW: fem ? 28 : 34, cloth: '#93a08f', skin: '#e6c9ad', hair: C.hair,
        fx: 0.91, fy: 0.9, style: 'child', brow: true
      },
      teen: {
        cy: 76, rx: fem ? 29 : 31, ry: 39, shoulderY: 130, bodyBottom: 200,
        bodyW: fem ? 30 : 40, cloth: '#5c6f82', skin: C.skin, hair: C.hair,
        fx: 1, fy: 1, style: 'teen', brow: true
      },
      youth: {
        cy: 74, rx: fem ? 30 : 32, ry: 40, shoulderY: 126, bodyBottom: 200,
        bodyW: fem ? 34 : 44, cloth: fem ? '#7f8b85' : '#6f7d7a', skin: C.skin, hair: C.hair,
        fx: 1, fy: 1, style: 'youth', brow: true
      },
      midlife: {
        cy: 76, rx: fem ? 30 : 32, ry: 40, shoulderY: 130, bodyBottom: 200,
        bodyW: fem ? 40 : 50, cloth: fem ? '#7f8b85' : '#6f7d7a', skin: C.skin, hair: C.hairMid,
        fx: 1, fy: 1, style: 'midlife', brow: true
      },
      elder: {
        cy: 78, rx: fem ? 30 : 32, ry: 38, shoulderY: 134, bodyBottom: 200,
        bodyW: fem ? 44 : 52, cloth: fem ? '#7f8b85' : '#6f7d7a', skin: C.skinOld, hair: C.hairOld,
        fx: 1, fy: 0.95, style: 'elder', brow: true
      },
      late: {
        cy: 82, rx: fem ? 30 : 32, ry: 36, shoulderY: 138, bodyBottom: 200,
        bodyW: fem ? 46 : 54, cloth: '#8a7f70', skin: '#e3cbb3', hair: '#d3ccc0',
        fx: 1, fy: 0.9, style: 'late', brow: true
      }
    };
    var c = CFG[stage] || CFG.youth;
    var style = c.style;
    var isOld = style === 'elder' || style === 'late';
    var isMid = style === 'midlife';
    var old = isOld;
    var mid = isMid;

    /* 气质变体：0 清瘦 / 1 魁梧 / 2 疲惫 / 3 精气神足（纯确定性，无随机） */
    var variantIdx = 0;
    if (variant !== undefined && variant !== null && variant !== '') {
      var vn = Number(variant);
      if (isFinite(vn)) variantIdx = ((Math.floor(vn) % 4) + 4) % 4;
    }
    var vSlim = variantIdx === 0;
    var vBurly = variantIdx === 1;
    var vTired = variantIdx === 2;
    var vVivid = variantIdx === 3;

    var hairColor = c.hair;
    var skin = c.skin;
    var w = 150, h = 210;
    var p = [];
    var headCy = c.cy;
    var headRx = c.rx;
    var headRy = c.ry;
    var shoulderY = c.shoulderY;
    var bodyW = c.bodyW;
    var bodyBottom = c.bodyBottom;
    var hairDrop = (style === 'teen') ? 10 : 0;
    var eyeY = headCy + 4;

    /* 体态：清瘦收窄、魁梧加宽并抬肩、疲惫塌肩、精气神足挺背 */
    if (vSlim) bodyW = bodyW * 0.88;
    if (vBurly) {
      bodyW = bodyW * 1.14;
      shoulderY = shoulderY - 4;
    }
    if (vTired) shoulderY = shoulderY + 4;
    if (vVivid) shoulderY = shoulderY - 2;

    p.push('<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="' + C.paper + '"/>');
    p.push('<ellipse cx="75" cy="196" rx="46" ry="8" fill="#e3dbcb" opacity="0.9"/>');

    /* 身体：同一衣领与衣褶，只随年龄改肩线高低、身形宽窄与衣色 */
    var cloth = c.cloth;
    var creaseH = Math.min(34, Math.max(10, bodyBottom - (shoulderY + 20) - 2));
    var creaseDx = vBurly ? 9 : 6;
    var creaseDx2 = vBurly ? 10 : 7;
    p.push('<path d="M75 ' + shoulderY + ' C ' + (75 - bodyW) + ' ' + (shoulderY + 12) + ', ' + (75 - bodyW - 6) + ' ' + (bodyBottom - 24) + ', ' + (75 - bodyW - 4) + ' ' + bodyBottom + ' L ' + (75 + bodyW + 4) + ' ' + bodyBottom + ' C ' + (75 + bodyW + 6) + ' ' + (bodyBottom - 24) + ', ' + (75 + bodyW) + ' ' + (shoulderY + 12) + ', 75 ' + shoulderY + ' Z" fill="' + cloth + '" opacity="0.94"/>');
    p.push('<path d="M75 ' + (shoulderY + 8) + ' L' + (75 + bodyW - 10) + ' ' + bodyBottom + ' L' + (75 + bodyW + 4) + ' ' + bodyBottom + ' C ' + (75 + bodyW + 6) + ' ' + (bodyBottom - 24) + ', ' + (75 + bodyW) + ' ' + (shoulderY + 12) + ', 75 ' + shoulderY + ' Z" fill="#3f4a47" opacity="0.10"/>');
    p.push('<path d="M67 ' + (shoulderY + 2) + ' L75 ' + (shoulderY + 13) + ' L83 ' + (shoulderY + 2) + '" stroke="' + C.paper + '" stroke-width="2" fill="none"/>');
    p.push('<path d="M70 ' + (shoulderY + 3) + ' L75 ' + (shoulderY + 11) + ' L80 ' + (shoulderY + 3) + ' L75 ' + (shoulderY + 7) + ' Z" fill="#ddd3c1" opacity="0.55"/>');
    p.push('<path d="M63 ' + (shoulderY + 20) + ' q-' + creaseDx + ' 20 -' + creaseDx2 + ' ' + creaseH + ' M87 ' + (shoulderY + 20) + ' q' + creaseDx + ' 20 ' + creaseDx2 + ' ' + creaseH + '" stroke="#4d5855" stroke-width="1" fill="none" opacity="0.28"/>');
    if (isMid || isOld) {
      p.push('<path d="M75 ' + (shoulderY + 14) + ' L75 178" stroke="#4d5855" stroke-width="1" opacity="0.35"/>');
      p.push('<path d="M58 ' + (shoulderY + 26) + ' q-3 16 -3 26 M92 ' + (shoulderY + 26) + ' q3 16 3 26" stroke="#4d5855" stroke-width="0.8" fill="none" opacity="0.18"/>');
    }

    /* 脖子与头：同一脸型，婴儿/儿童头更大、脖子更短更窄 */
    var neckW = (style === 'infant' || style === 'child') ? 14 : 18;
    p.push('<rect x="' + (75 - neckW / 2) + '" y="' + (headCy + headRy - 16) + '" width="' + neckW + '" height="' + (shoulderY - headCy - headRy + 22) + '" rx="5" fill="' + skin + '"/>');
    p.push('<path d="M68 ' + (headCy + headRy - 8) + ' q7 9 14 0" fill="#a9866c" opacity="0.35"/>');
    p.push('<ellipse cx="75" cy="' + headCy + '" rx="' + headRx + '" ry="' + headRy + '" fill="' + skin + '"/>');
    /* 面色：清瘦偏白、疲惫偏灰 */
    if (vSlim) {
      p.push('<ellipse cx="75" cy="' + (headCy + 2) + '" rx="' + LS.round1(headRx * 0.9) + '" ry="' + LS.round1(headRy * 0.88) + '" fill="#ffffff" opacity="0.12"/>');
    }
    if (vTired) {
      p.push('<ellipse cx="75" cy="' + (headCy + 2) + '" rx="' + LS.round1(headRx * 0.9) + '" ry="' + LS.round1(headRy * 0.88) + '" fill="#8d8579" opacity="0.10"/>');
    }
    p.push('<ellipse cx="' + (75 - headRx + 12) + '" cy="' + (headCy + 4) + '" rx="' + LS.round1(headRx * 0.44) + '" ry="' + LS.round1(headRy * 0.7) + '" fill="#ffffff" opacity="0.07"/>');
    var cheekA = 0.13;
    if (vSlim) cheekA = 0.08;
    if (vTired) cheekA = 0.05;
    if (vVivid) cheekA = 0.22;
    p.push('<ellipse cx="' + LS.round1(75 - headRx * 0.59) + '" cy="' + (headCy + 15) + '" rx="' + LS.round1(headRx * 0.22) + '" ry="' + LS.round1(headRy * 0.125) + '" fill="#c07f66" opacity="' + cheekA + '"/><ellipse cx="' + LS.round1(75 + headRx * 0.59) + '" cy="' + (headCy + 15) + '" rx="' + LS.round1(headRx * 0.22) + '" ry="' + LS.round1(headRy * 0.125) + '" fill="#c07f66" opacity="' + cheekA + '"/>');
    /* 清瘦：下巴略尖 */
    if (vSlim) {
      p.push('<path d="M68 ' + (headCy + headRy - 9) + ' Q75 ' + (headCy + headRy + 2) + ' 82 ' + (headCy + headRy - 9) + '" stroke="#c09a7d" stroke-width="0.9" fill="none" opacity="0.24"/>');
    }
    /* 耳朵 */
    var earRx = Math.round(headRx * 0.16);
    var earRy = Math.round(headRy * 0.2);
    p.push('<ellipse cx="' + (75 - headRx + 2) + '" cy="' + headCy + '" rx="' + earRx + '" ry="' + earRy + '" fill="' + skin + '"/>');
    p.push('<ellipse cx="' + (75 + headRx - 2) + '" cy="' + headCy + '" rx="' + earRx + '" ry="' + earRy + '" fill="' + skin + '"/>');
    p.push('<path d="M' + (75 - headRx + 2) + ' ' + (headCy - 3) + ' q3 3 0 7 M' + (75 + headRx - 2) + ' ' + (headCy - 3) + ' q-3 3 0 7" stroke="#b08e72" stroke-width="0.8" fill="none" opacity="0.7"/>');

    /* 头发：同一母版，男女不同，年龄改色与发量 */
    if (fem) {
      p.push('<path d="M' + (75 - headRx + 2) + ' ' + (headCy - 10) + ' C ' + (75 - headRx - 2) + ' ' + (headCy - 44) + ', ' + (75 + headRx + 2) + ' ' + (headCy - 46) + ', ' + (75 + headRx - 2) + ' ' + (headCy - 10) + ' C ' + (75 + headRx - 5) + ' ' + (headCy - 28) + ', ' + (75 - headRx + 5) + ' ' + (headCy - 28) + ', ' + (75 - headRx + 2) + ' ' + (headCy - 10) + ' Z" fill="' + hairColor + '"/>');
      p.push('<path d="M' + (75 - headRx + 2) + ' ' + (headCy - 10) + ' C ' + (75 - headRx - 8) + ' ' + (headCy + 24) + ', ' + (75 - headRx - 4) + ' 122, ' + (75 - headRx + 2) + ' 132 L ' + (75 - headRx + 14) + ' 130 C ' + (75 - headRx + 6) + ' 108, ' + (75 - headRx + 4) + ' ' + (headCy + 20) + ', ' + (75 - headRx + 3) + ' ' + (headCy - 6) + ' Z" fill="' + hairColor + '" opacity="' + (old ? '0.9' : '0.95') + '"/>');
      p.push('<path d="M' + (75 + headRx - 2) + ' ' + (headCy - 10) + ' C ' + (75 + headRx + 8) + ' ' + (headCy + 24) + ', ' + (75 + headRx + 4) + ' 122, ' + (75 + headRx - 2) + ' 132 L ' + (75 + headRx - 14) + ' 130 C ' + (75 + headRx - 6) + ' 108, ' + (75 + headRx - 4) + ' ' + (headCy + 20) + ', ' + (75 + headRx - 3) + ' ' + (headCy - 6) + ' Z" fill="' + hairColor + '" opacity="' + (old ? '0.9' : '0.95') + '"/>');
      p.push('<path d="M' + (75 - headRx + 10) + ' ' + (headCy - 32) + ' q12 -7 24 -5" stroke="' + (old ? '#efe9dc' : '#5a5147') + '" stroke-width="1.4" fill="none" opacity="' + (old ? '0.8' : '0.45') + '"/>');
      p.push('<path d="M' + (75 + headRx - 14) + ' ' + (headCy - 22) + ' q8 4 9 12" stroke="' + hairColor + '" stroke-width="1" fill="none" opacity="0.5"/>');
    } else {
      var hairLine = old ? headCy - 28 : (mid ? headCy - 25 : headCy - 23);
      p.push('<path d="M' + (75 - headRx) + ' ' + (headCy - 8) + ' C ' + (75 - headRx - 1) + ' ' + (headCy - headRy - 8) + ', ' + (75 + headRx + 1) + ' ' + (headCy - headRy - 8) + ', ' + (75 + headRx) + ' ' + (headCy - 8) + ' C ' + (75 + headRx - 4) + ' ' + hairLine + ', ' + (75 - headRx + 4) + ' ' + hairLine + ', ' + (75 - headRx) + ' ' + (headCy - 8) + ' Z" fill="' + hairColor + '"/>');
      p.push('<path d="M' + (75 - headRx + 3) + ' ' + (headCy - 6) + ' q-4 10 -1 17 M' + (75 + headRx - 3) + ' ' + (headCy - 6) + ' q4 10 1 17" stroke="' + hairColor + '" stroke-width="3.2" fill="none" opacity="0.75"/>');
      p.push('<path d="M' + (75 - headRx + 12) + ' ' + (headCy - 30) + ' q12 -7 25 -3" stroke="' + (old ? '#efe9dc' : '#5a5147') + '" stroke-width="1.2" fill="none" opacity="' + (old ? '0.7' : '0.35') + '"/>');
      if (old) {
        p.push('<path d="M' + (75 - headRx + 1) + ' ' + (headCy - 20) + ' q3 7 0 12 M' + (75 + headRx - 1) + ' ' + (headCy - 20) + ' q-3 7 0 12" stroke="#d9d2c5" stroke-width="1.4" fill="none" opacity="0.7"/>');
      }
    }

    /* 眉眼：杏形眼、眉、眼袋（老年）；变体只改眉粗/眉高与眼下线条 */
    var browDy = 0;
    var browW = fem ? 0.9 : 1.2;
    if (vBurly) browW = browW + 0.5;
    if (vVivid) browDy = -2;
    if (vTired) browDy = 1;
    p.push('<path d="M51 ' + (eyeY - 9 + browDy) + ' q9 -4 18 -1" stroke="' + (old ? '#b8b0a2' : C.ink) + '" stroke-width="' + browW + '" fill="none" opacity="0.72"/>');
    p.push('<path d="M81 ' + (eyeY - 9 + browDy) + ' q9 -4 18 -1" stroke="' + (old ? '#b8b0a2' : C.ink) + '" stroke-width="' + browW + '" fill="none" opacity="0.72"/>');
    [58, 82].forEach(function (cx) {
      p.push('<path d="M' + cx + ' ' + eyeY + ' q7 -5 14 0 q-7 6 -14 0 Z" fill="#f4ede0" stroke="#4a443c" stroke-width="0.7" opacity="0.95"/>');
      p.push('<circle cx="' + (cx + 7) + '" cy="' + (eyeY + 0.5) + '" r="2.2" fill="#3b332c"/>');
      p.push('<circle cx="' + (cx + 6.2) + '" cy="' + (eyeY - 0.3) + '" r="0.7" fill="#f7f3ea"/>');
    });
    p.push('<path d="M75 ' + (eyeY + 3) + ' q-2 8 0 10 q2 3 6 1" stroke="' + C.soft + '" stroke-width="0.9" fill="none" opacity="0.75"/>');
    var mouthCurve = old ? 2 : 4;
    if (vTired) mouthCurve = -3;
    if (vVivid) mouthCurve = 6;
    p.push('<path d="M68 ' + (headCy + 24) + ' q7 ' + mouthCurve + ' 14 0" stroke="' + C.ink + '" stroke-width="1.1" fill="none"/>');
    p.push('<path d="M70 ' + (headCy + 26) + ' q5 ' + (old ? '1' : '2') + ' 10 0" stroke="#b07a66" stroke-width="0.7" fill="none" opacity="0.5"/>');
    if (vVivid) {
      p.push('<path d="M66 ' + (headCy + 25) + ' q-3 -3 -5 -2 M84 ' + (headCy + 25) + ' q3 -3 5 -2" stroke="#b07a66" stroke-width="0.8" fill="none" opacity="0.55"/>');
    }
    if (vTired) {
      p.push('<path d="M52 ' + (eyeY + 7) + ' q9 4 18 0 M80 ' + (eyeY + 7) + ' q9 4 18 0" stroke="#b9ad98" stroke-width="0.9" fill="none" opacity="0.45"/>');
      p.push('<path d="M54 ' + (eyeY + 10) + ' q8 3 16 0 M82 ' + (eyeY + 10) + ' q8 3 16 0" stroke="#b9ad98" stroke-width="0.7" fill="none" opacity="0.32"/>');
    }
    if (mid) {
      p.push('<path d="M60 ' + (headCy - 22) + ' q15 -3 30 0" stroke="' + C.soft + '" stroke-width="0.8" fill="none" opacity="0.35"/>');
      p.push('<path d="M68 ' + (headCy + 16) + ' q-2 7 1 10 M82 ' + (headCy + 16) + ' q2 7 -1 10" stroke="' + C.soft + '" stroke-width="0.8" fill="none" opacity="0.5"/>');
    }
    if (old) {
      p.push('<path d="M58 ' + (headCy - 24) + ' q17 -3 34 0 M61 ' + (headCy - 18) + ' q14 -2 28 0 M64 ' + (headCy - 12) + ' q11 -1 22 0" stroke="' + C.soft + '" stroke-width="1" fill="none" opacity="0.7"/>');
      p.push('<path d="M50 ' + (eyeY + 1) + ' q-4 4 0 7 M100 ' + (eyeY + 1) + ' q4 4 0 7" stroke="' + C.soft + '" stroke-width="0.9" fill="none" opacity="0.7"/>');
      p.push('<path d="M51 ' + (eyeY + 7) + ' q7 4 14 0 M85 ' + (eyeY + 7) + ' q7 4 14 0" stroke="' + C.soft + '" stroke-width="1" fill="none" opacity="0.75"/>');
      p.push('<path d="M67 ' + (headCy + 14) + ' q-1 8 2 12 M83 ' + (headCy + 14) + ' q1 8 -2 12" stroke="' + C.soft + '" stroke-width="1.1" fill="none" opacity="0.75"/>');
      p.push('<ellipse cx="57" cy="' + (headCy + 26) + '" rx="7" ry="4" fill="#a9866c" opacity="0.13"/><ellipse cx="93" cy="' + (headCy + 26) + '" rx="7" ry="4" fill="#a9866c" opacity="0.13"/>');
      p.push('<path d="M62 ' + (headCy + 31) + ' q13 5 26 0" stroke="' + C.soft + '" stroke-width="0.8" fill="none" opacity="0.55"/>');
    }
    return svg(w, h, p.join(''));
  };


  /* ---------- 主题小插图 ---------- */
  var scenes = {};

  scenes.office = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="18" y="20" width="70" height="42" fill="#e9e3d5" stroke="#c9bea9"/>' +
      '<path d="M22 58 L38 40 L52 52 L66 32 L84 58" stroke="#9c4a34" stroke-width="1.6" fill="none"/>' +
      '<rect x="18" y="66" width="114" height="8" fill="#a08a6c"/>' +
      '<rect x="26" y="74" width="4" height="20" fill="#8d8579"/><rect x="120" y="74" width="4" height="20" fill="#8d8579"/>' +
      '<path d="M96 24 q10 -8 20 0" stroke="#5c7a74" stroke-width="1.4" fill="none"/>' +
      '<circle cx="106" cy="26" r="2" fill="#5c7a74"/>' +
      '<path d="M92 36 h24 M92 42 h20 M92 48 h24" stroke="#8d8579" stroke-width="1"/>');
  };
  scenes.emptyDesk = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="20" y="62" width="110" height="8" fill="#a08a6c"/>' +
      '<rect x="28" y="70" width="4" height="24" fill="#8d8579"/><rect x="118" y="70" width="4" height="24" fill="#8d8579"/>' +
      '<rect x="44" y="44" width="30" height="18" fill="#e9e3d5" stroke="#c9bea9"/>' +
      '<path d="M96 46 l14 14 M110 46 l-14 14" stroke="#a33b2e" stroke-width="2" opacity="0.6"/>' +
      '<path d="M30 30 q10 -10 20 0" stroke="#8d8579" stroke-width="1.2" fill="none"/>');
  };
  scenes.wedding = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<circle cx="52" cy="40" r="12" fill="#e6c9ad"/><path d="M40 34 q12 -12 24 0" fill="#3b332c"/>' +
      '<path d="M52 54 q-20 8 -22 34" fill="#a08a6c" opacity="0.9"/>' +
      '<circle cx="98" cy="40" r="12" fill="#e6c9ad"/><path d="M86 34 q12 -12 24 0" fill="#4a4139"/>' +
      '<path d="M98 54 q20 8 22 34" fill="#7d8a84" opacity="0.9"/>' +
      '<path d="M75 62 q8 8 0 18 q-8 -10 0 -18" fill="#9c4a34" opacity="0.7"/>' +
      '<circle cx="75" cy="88" r="2" fill="#9c4a34"/>');
  };
  scenes.nursery = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<path d="M36 66 q39 -30 78 0" stroke="#a08a6c" stroke-width="2" fill="none"/>' +
      '<ellipse cx="75" cy="68" rx="30" ry="13" fill="#e9e3d5" stroke="#c9bea9"/>' +
      '<circle cx="75" cy="62" r="9" fill="#e6c9ad"/>' +
      '<path d="M66 58 q9 -7 18 0" fill="#3b332c"/>' +
      '<path d="M40 86 h70" stroke="#8d8579" stroke-width="1.2"/>' +
      '<path d="M30 34 q6 -8 12 0 M112 30 q6 -8 12 0" stroke="#5c7a74" stroke-width="1.2" fill="none"/>');
  };
  scenes.emptyHome = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="26" y="40" width="98" height="46" fill="none" stroke="#8d8579"/>' +
      '<path d="M26 40 L75 16 L124 40" stroke="#8d8579" stroke-width="1.4" fill="none"/>' +
      '<rect x="50" y="56" width="18" height="30" fill="#e9e3d5" stroke="#c9bea9"/>' +
      '<rect x="88" y="56" width="18" height="30" fill="#e9e3d5" stroke="#c9bea9"/>' +
      '<path d="M38 82 h74" stroke="#c9bea9"/>');
  };
  scenes.house = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<path d="M30 56 L75 24 L120 56" stroke="#a08a6c" stroke-width="2" fill="none"/>' +
      '<rect x="40" y="56" width="70" height="34" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<rect x="66" y="66" width="18" height="24" fill="#a08a6c" opacity="0.7"/>' +
      '<path d="M86 44 h20 v14" stroke="#5c7a74" stroke-width="1.2" fill="none"/>' +
      '<path d="M40 90 h70" stroke="#8d8579"/>');
  };
  scenes.grave = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="62" y="34" width="26" height="46" rx="10" fill="#d7d0c2" stroke="#a49c92"/>' +
      '<path d="M70 48 h10 M70 56 h10 M75 42 v28" stroke="#8d8579" stroke-width="1"/>' +
      '<path d="M40 88 q35 -14 70 0" stroke="#8d8579" stroke-width="1.2" fill="none"/>' +
      '<path d="M108 22 l8 16 h-16 z" fill="#2f2c28" opacity="0.75"/>' +
      '<path d="M112 30 h-8" stroke="#8d8579"/>');
  };
  scenes.clinic = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="22" y="34" width="76" height="42" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M50 42 h18 v6 h6 v18 h-6 v6 h-18 v-6 h-6 v-18 h6 z" fill="#a33b2e" opacity="0.55"/>' +
      '<rect x="106" y="52" width="18" height="30" rx="3" fill="#dfe7e3" stroke="#9fb3ac"/>' +
      '<path d="M110 46 h10 M115 41 v10" stroke="#5c7a74" stroke-width="1.6"/>' +
      '<path d="M30 88 h94" stroke="#8d8579"/>');
  };
  scenes.exam = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="24" y="22" width="58" height="66" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M32 34 h42 M32 44 h42 M32 54 h42 M32 64 h30" stroke="#b9ad98" stroke-width="1"/>' +
      '<path d="M104 30 l12 14 -12 14" stroke="#9c4a34" stroke-width="1.4" fill="none"/>' +
      '<rect x="100" y="60" width="30" height="6" fill="#8d8579"/><rect x="100" y="72" width="30" height="6" fill="#8d8579"/>');
  };
  scenes.money = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="30" y="34" width="70" height="36" fill="#efe8d8" stroke="#a08a6c"/>' +
      '<circle cx="65" cy="52" r="10" fill="none" stroke="#a08a6c"/>' +
      '<circle cx="48" cy="62" r="5" fill="none" stroke="#a08a6c" opacity="0.7"/>' +
      '<path d="M60 46 l10 12 M70 46 l-10 12" stroke="#a08a6c"/>' +
      '<path d="M108 44 v30 M100 52 h16 M100 60 h16" stroke="#9c4a34" stroke-width="1.6" opacity="0.7"/>');
  };
  scenes.jobfair = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<path d="M18 88 L18 34 L64 18 L110 34 L110 88" stroke="#c9bea9" stroke-width="1.2" fill="none"/>' +
      '<rect x="28" y="44" width="20" height="34" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<rect x="60" y="44" width="18" height="20" fill="#e9e3d5" stroke="#c9bea9"/>' +
      '<path d="M92 44 q10 -8 18 0" stroke="#5c7a74" stroke-width="1.2" fill="none"/>' +
      '<circle cx="101" cy="46" r="2" fill="#5c7a74"/>' +
      '<path d="M124 30 L140 46 L124 62" stroke="#9c4a34" stroke-width="1.6" fill="none"/>' +
      '<path d="M26 88 h88" stroke="#8d8579"/>');
  };
  scenes.home = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<path d="M34 54 L75 26 L116 54" stroke="#a08a6c" stroke-width="1.8" fill="none"/>' +
      '<rect x="44" y="54" width="62" height="34" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<rect x="54" y="64" width="16" height="24" fill="#d9cfbc"/>' +
      '<path d="M92 64 h8 v14 h-8 z" fill="#dfe7e3" stroke="#9fb3ac"/>' +
      '<circle cx="75" cy="40" r="2" fill="#9c4a34"/>');
  };
  scenes.spark = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<path d="M32 88 h86" stroke="#8d8579"/>' +
      '<rect x="48" y="66" width="54" height="6" fill="#a08a6c"/>' +
      '<rect x="52" y="72" width="4" height="16" fill="#8d8579"/><rect x="94" y="72" width="4" height="16" fill="#8d8579"/>' +
      '<path d="M66 78 q0 -18 9 -18 q9 0 9 18" fill="#efe8d8" stroke="#a08a6c"/>' +
      '<path d="M72 78 h6" stroke="#8d8579"/>' +
      '<path d="M75 66 l3 -8 4 6" stroke="#5c7a74" stroke-width="1.2" fill="none"/>' +
      '<path d="M106 32 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4 z" stroke="#5c7a74" stroke-width="1.4" fill="none"/>' +
      '<path d="M44 40 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" stroke="#a08a6c" stroke-width="1" fill="none"/>' +
      '<circle cx="96" cy="58" r="2" fill="#9c4a34" opacity="0.5"/>');
  };

  /* ---------------- 婴幼儿 ---------------- */
  scenes.cradle = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<path d="M38 70 q37 -18 74 0" stroke="#a08a6c" stroke-width="2" fill="none"/>' +
      '<ellipse cx="75" cy="72" rx="30" ry="10" fill="#e9e3d5" stroke="#c9bea9"/>' +
      '<path d="M48 78 q27 10 54 0" stroke="#8d8579" stroke-width="1.4" fill="none"/>' +
      '<path d="M52 80 v10 M98 80 v10 M75 82 v10" stroke="#8d8579" stroke-width="1.6"/>' +
      '<path d="M58 68 q17 -8 34 0 q-5 8 -17 9 q-12 -1 -17 -9 z" fill="#dfe7e3" opacity="0.7"/>' +
      '<path d="M40 46 q35 -20 70 0" stroke="#c9bea9" stroke-width="1" fill="none"/>' +
      '<path d="M60 52 l3 7 7 1 -5 5 1 7 -6 -4 -6 4 1 -7 -5 -5 7 -1 z" fill="#9c4a34" opacity="0.45"/>' +
      '<circle cx="96" cy="54" r="4" fill="none" stroke="#5c7a74" opacity="0.6"/>');
  };
  scenes.vaccine = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="20" y="64" width="112" height="7" fill="#a08a6c"/>' +
      '<rect x="26" y="71" width="4" height="22" fill="#8d8579"/><rect x="122" y="71" width="4" height="22" fill="#8d8579"/>' +
      '<ellipse cx="56" cy="60" rx="15" ry="5" fill="#dfe7e3" stroke="#9fb3ac"/>' +
      '<rect x="50" y="44" width="8" height="16" rx="2" fill="#e9e3d5" stroke="#9fb3ac"/>' +
      '<path d="M54 44 v-8 l9 -7" stroke="#8d8579" stroke-width="1.3" fill="none"/>' +
      '<circle cx="64" cy="28" r="2" fill="#a33b2e" opacity="0.45"/>' +
      '<rect x="82" y="44" width="16" height="16" rx="2" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M90 47 v10 M85 52 h10" stroke="#a33b2e" stroke-width="1.6" opacity="0.55"/>' +
      '<path d="M108 40 q6 -6 12 0" stroke="#5c7a74" stroke-width="1.2" fill="none"/>');
  };
  scenes.first_steps = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<path d="M18 88 h114" stroke="#c9bea9"/>' +
      '<rect x="20" y="50" width="36" height="32" rx="4" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<rect x="20" y="50" width="36" height="9" fill="#a08a6c" opacity="0.45"/>' +
      '<path d="M60 60 h22" stroke="#8d8579" stroke-width="2.4"/>' +
      '<path d="M64 92 q4 -5 8 0 M74 92 q4 -5 8 0" stroke="#a08a6c" stroke-width="1.8" fill="none"/>' +
      '<circle cx="108" cy="80" r="8" fill="#dfe7e3" stroke="#9fb3ac"/>' +
      '<path d="M101 80 h14 M108 73 v14" stroke="#9fb3ac"/>' +
      '<path d="M98 38 q7 -4 14 0" stroke="#5c7a74" stroke-width="1.2" fill="none"/>');
  };

  /* ---------------- 童年 ---------------- */
  scenes.classroom = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="20" y="18" width="74" height="40" fill="#5f6e68" opacity="0.6" stroke="#8d8579"/>' +
      '<path d="M26 28 h50 M26 36 h62 M26 44 h42" stroke="#efe8d8" stroke-width="1" opacity="0.75"/>' +
      '<rect x="24" y="62" width="34" height="6" fill="#a08a6c"/>' +
      '<rect x="28" y="68" width="3" height="18" fill="#8d8579"/><rect x="51" y="68" width="3" height="18" fill="#8d8579"/>' +
      '<rect x="70" y="62" width="30" height="6" fill="#a08a6c"/>' +
      '<rect x="74" y="68" width="3" height="18" fill="#8d8579"/><rect x="93" y="68" width="3" height="18" fill="#8d8579"/>' +
      '<rect x="106" y="30" width="20" height="30" fill="none" stroke="#8d8579"/>' +
      '<path d="M116 30 v30" stroke="#c9bea9"/>' +
      '<circle cx="62" cy="30" r="1" fill="#ffffff" opacity="0.7"/>');
  };
  scenes.village_gate = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<path d="M0 92 q40 -10 75 0 q40 8 75 0" stroke="#c9bea9" stroke-width="1.2" fill="none"/>' +
      '<path d="M46 92 v-38 q4 -6 8 0 v38" stroke="#8d7a63" stroke-width="3" fill="none"/>' +
      '<ellipse cx="50" cy="40" rx="20" ry="13" fill="#7d8a84" opacity="0.35" stroke="#8d8579"/>' +
      '<ellipse cx="38" cy="48" rx="13" ry="9" fill="#7d8a84" opacity="0.28" stroke="#8d8579"/>' +
      '<ellipse cx="64" cy="48" rx="13" ry="9" fill="#7d8a84" opacity="0.28" stroke="#8d8579"/>' +
      '<path d="M96 92 v-22 M96 76 h14 M96 82 h14" stroke="#a08a6c" stroke-width="2"/>' +
      '<path d="M112 70 L112 92" stroke="#a08a6c" stroke-width="2"/>' +
      '<path d="M20 80 h20 v12" fill="none" stroke="#c9bea9"/>' +
      '<path d="M24 80 l8 -8 8 8" stroke="#a08a6c" fill="none"/>' +
      '<path d="M70 84 q10 -4 20 0" stroke="#8d8579" stroke-width="1" opacity="0.5"/>');
  };
  scenes.corner_shop = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="24" y="66" width="100" height="9" fill="#a08a6c"/>' +
      '<rect x="30" y="75" width="4" height="18" fill="#8d8579"/><rect x="114" y="75" width="4" height="18" fill="#8d8579"/>' +
      '<rect x="30" y="30" width="56" height="34" fill="#dfe7e3" opacity="0.6" stroke="#9fb3ac"/>' +
      '<path d="M36 40 h12 M54 40 h12 M72 40 h8" stroke="#8d8579" stroke-width="2"/>' +
      '<rect x="90" y="34" width="30" height="28" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M94 42 h22 M94 50 h22" stroke="#c9bea9"/>' +
      '<path d="M94 24 q10 -8 20 0" stroke="#5c7a74" stroke-width="1.2" fill="none"/>' +
      '<circle cx="104" cy="27" r="2" fill="#9c4a34" opacity="0.5"/>' +
      '<rect x="36" y="82" width="12" height="4" fill="#8d8579"/>' +
      '<path d="M40 86 v6 M44 86 v6" stroke="#8d8579"/>');
  };
  scenes.playground = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<path d="M18 88 h114" stroke="#c9bea9"/>' +
      '<path d="M40 88 v-40 M100 88 v-40 M40 48 h60" stroke="#5c7a74" stroke-width="2.4"/>' +
      '<path d="M40 56 h60" stroke="#5c7a74" stroke-width="1.2" opacity="0.6"/>' +
      '<ellipse cx="75" cy="90" rx="28" ry="5" fill="#e3dbcb" opacity="0.8"/>' +
      '<path d="M20 74 l26 -8" stroke="#8d8579" stroke-width="1.4"/>' +
      '<circle cx="116" cy="78" r="6" fill="#dfe7e3" stroke="#9fb3ac"/>' +
      '<path d="M110 78 h12 M116 72 v12" stroke="#9fb3ac"/>' +
      '<path d="M26 60 q6 -8 12 0" stroke="#7d8a84" stroke-width="1.2" fill="none"/>');
  };

  /* ---------------- 少年 ---------------- */
  scenes.exam_hall = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="22" y="60" width="38" height="7" fill="#a08a6c"/>' +
      '<rect x="26" y="67" width="3" height="18" fill="#8d8579"/><rect x="53" y="67" width="3" height="18" fill="#8d8579"/>' +
      '<rect x="40" y="50" width="18" height="10" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<rect x="76" y="60" width="38" height="7" fill="#a08a6c"/>' +
      '<rect x="80" y="67" width="3" height="18" fill="#8d8579"/><rect x="107" y="67" width="3" height="18" fill="#8d8579"/>' +
      '<rect x="94" y="50" width="18" height="10" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<circle cx="118" cy="26" r="9" fill="none" stroke="#8d8579"/>' +
      '<path d="M118 21 v5 l4 3" stroke="#8d8579"/>' +
      '<rect x="20" y="24" width="22" height="6" fill="#e9e3d5" stroke="#c9bea9"/>');
  };
  scenes.night_study = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="20" y="18" width="54" height="38" fill="#22313a" opacity="0.35" stroke="#8d8579"/>' +
      '<circle cx="58" cy="32" r="7" fill="#e9e3d5" opacity="0.8"/>' +
      '<path d="M27 24 h5 M38 42 h4" stroke="#efe8d8" stroke-width="1" opacity="0.5"/>' +
      '<rect x="28" y="66" width="98" height="7" fill="#a08a6c"/>' +
      '<rect x="34" y="73" width="4" height="18" fill="#8d8579"/><rect x="116" y="73" width="4" height="18" fill="#8d8579"/>' +
      '<path d="M92 60 v-18 q0 -5 5 -5 h6" stroke="#8d8579" stroke-width="1.4" fill="none"/>' +
      '<path d="M92 64 L108 64 L102 74 L88 74 Z" fill="#e9dfc4" opacity="0.8"/>' +
      '<rect x="42" y="58" width="24" height="8" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M54 58 v8" stroke="#c9bea9"/>');
  };
  scenes.ball_court = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<path d="M18 90 h114" stroke="#c9bea9"/>' +
      '<path d="M96 20 v34" stroke="#8d8579" stroke-width="2"/>' +
      '<rect x="92" y="18" width="28" height="20" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<circle cx="106" cy="40" r="7" fill="none" stroke="#9c4a34" stroke-width="1.6"/>' +
      '<path d="M102 40 v8 M106 40 v9 M110 40 v8" stroke="#8d8579" stroke-width="0.9"/>' +
      '<path d="M26 92 q22 -26 52 -26" stroke="#8d8579" stroke-width="1.2" fill="none"/>' +
      '<circle cx="34" cy="78" r="7" fill="#a08a6c" opacity="0.55" stroke="#8d8579"/>' +
      '<path d="M28 78 h12 M34 72 v12" stroke="#8d8579"/>');
  };
  scenes.internet_cafe = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="18" y="64" width="114" height="8" fill="#7d8a84"/>' +
      '<rect x="24" y="72" width="4" height="18" fill="#8d8579"/><rect x="122" y="72" width="4" height="18" fill="#8d8579"/>' +
      '<rect x="30" y="34" width="30" height="22" rx="2" fill="#4a5a55"/>' +
      '<rect x="34" y="38" width="22" height="14" fill="#8fa8a2" opacity="0.5"/>' +
      '<rect x="38" y="58" width="14" height="4" fill="#8d8579"/>' +
      '<rect x="72" y="34" width="30" height="22" rx="2" fill="#4a5a55"/>' +
      '<rect x="76" y="38" width="22" height="14" fill="#8fa8a2" opacity="0.5"/>' +
      '<rect x="80" y="58" width="14" height="4" fill="#8d8579"/>' +
      '<rect x="38" y="62" width="16" height="4" fill="#e9e3d5"/>' +
      '<circle cx="112" cy="60" r="4" fill="#efe8d8" stroke="#c9bea9"/>');
  };

  /* ---------------- 青年 ---------------- */
  scenes.dorm = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="24" y="26" width="80" height="5" fill="#a08a6c"/>' +
      '<rect x="24" y="26" width="5" height="56" fill="#8d8579"/><rect x="99" y="26" width="5" height="56" fill="#8d8579"/>' +
      '<rect x="30" y="31" width="26" height="9" fill="#dfe7e3" stroke="#9fb3ac"/>' +
      '<rect x="58" y="31" width="40" height="12" fill="#e9e3d5" stroke="#c9bea9"/>' +
      '<rect x="24" y="60" width="80" height="5" fill="#a08a6c"/>' +
      '<rect x="30" y="65" width="38" height="10" fill="#e9e3d5" stroke="#c9bea9"/>' +
      '<path d="M70 48 l8 0 M74 44 v8 M74 52 v8" stroke="#8d8579" stroke-width="1"/>' +
      '<rect x="108" y="60" width="20" height="16" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M114 52 v-8 q0 -4 4 -4" stroke="#8d8579"/>');
  };
  scenes.job_fair = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<path d="M18 88 V36 L75 20 L132 36 V88" stroke="#c9bea9" stroke-width="1.2" fill="none"/>' +
      '<rect x="28" y="44" width="34" height="8" fill="#a08a6c"/>' +
      '<path d="M34 52 v10 M56 52 v10" stroke="#8d8579"/>' +
      '<rect x="72" y="42" width="26" height="22" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M78 50 h14 M78 56 h10" stroke="#c9bea9"/>' +
      '<path d="M108 46 q10 -8 20 0" stroke="#5c7a74" stroke-width="1.2" fill="none"/>' +
      '<path d="M122 64 l10 8 -10 8" stroke="#9c4a34" stroke-width="1.4" fill="none"/>' +
      '<path d="M26 88 h90" stroke="#8d8579"/>');
  };
  scenes.interview_room = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="34" y="62" width="82" height="7" fill="#a08a6c"/>' +
      '<rect x="40" y="69" width="4" height="18" fill="#8d8579"/><rect x="106" y="69" width="4" height="18" fill="#8d8579"/>' +
      '<rect x="48" y="48" width="22" height="14" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M52 52 h14 M52 56 h10" stroke="#c9bea9"/>' +
      '<path d="M24 72 v-20 q0 -4 4 -4 h12 v24" stroke="#8d8579" fill="none"/>' +
      '<path d="M106 72 v-20 q0 -4 4 -4 h12 v24" stroke="#8d8579" fill="none"/>' +
      '<rect x="86" y="32" width="30" height="22" fill="none" stroke="#8d8579"/>' +
      '<path d="M101 32 v22" stroke="#c9bea9"/>' +
      '<path d="M26 50 h10" stroke="#5c7a74" stroke-width="1.2"/>');
  };
  scenes.rental_room = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="20" y="62" width="66" height="8" fill="#a08a6c"/>' +
      '<rect x="22" y="70" width="4" height="18" fill="#8d8579"/><rect x="80" y="70" width="4" height="18" fill="#8d8579"/>' +
      '<rect x="24" y="48" width="24" height="12" fill="#dfe7e3" stroke="#9fb3ac"/>' +
      '<rect x="50" y="50" width="34" height="12" fill="#e9e3d5" stroke="#c9bea9"/>' +
      '<rect x="92" y="56" width="26" height="32" rx="2" fill="#a08a6c" opacity="0.65" stroke="#8d8579"/>' +
      '<path d="M92 64 h26" stroke="#8d8579"/>' +
      '<rect x="96" y="34" width="18" height="14" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<rect x="24" y="30" width="30" height="20" fill="none" stroke="#8d8579"/>' +
      '<path d="M39 30 v20" stroke="#c9bea9"/>');
  };
  scenes.delivery_room = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="22" y="58" width="54" height="8" fill="#a08a6c"/>' +
      '<rect x="24" y="66" width="4" height="20" fill="#8d8579"/><rect x="70" y="66" width="4" height="20" fill="#8d8579"/>' +
      '<rect x="26" y="46" width="24" height="12" fill="#dfe7e3" stroke="#9fb3ac"/>' +
      '<path d="M50 46 h22 v12 h-22 z" fill="#e9e3d5" stroke="#c9bea9"/>' +
      '<rect x="88" y="56" width="34" height="14" rx="6" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M90 56 q15 -14 30 0" stroke="#8d8579" stroke-width="1.4" fill="none"/>' +
      '<circle cx="105" cy="50" r="5" fill="#e6c9ad"/>' +
      '<path d="M100 48 q5 -4 10 0" fill="#3b332c"/>' +
      '<path d="M92 70 v10 M118 70 v10" stroke="#8d8579"/>' +
      '<path d="M84 44 v-16 q0 -5 5 -5 h10" stroke="#8d8579"/>');
  };
  scenes.overtime_office = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="18" y="62" width="114" height="8" fill="#a08a6c"/>' +
      '<rect x="24" y="70" width="4" height="18" fill="#8d8579"/><rect x="122" y="70" width="4" height="18" fill="#8d8579"/>' +
      '<rect x="34" y="36" width="30" height="22" fill="#4a5a55"/>' +
      '<rect x="38" y="40" width="22" height="14" fill="#b8c9c4" opacity="0.5"/>' +
      '<rect x="42" y="58" width="14" height="4" fill="#8d8579"/>' +
      '<path d="M98 62 v-16 q0 -5 5 -5 h8" stroke="#8d8579"/>' +
      '<path d="M104 26 l10 8 -14 0 z" fill="#e9dfc4" opacity="0.8"/>' +
      '<circle cx="54" cy="56" r="4" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<rect x="18" y="20" width="34" height="30" fill="#22313a" opacity="0.3" stroke="#8d8579"/>' +
      '<circle cx="44" cy="30" r="5" fill="#e9e3d5" opacity="0.8"/>');
  };
  scenes.ktv_restaurant = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="18" y="72" width="114" height="8" fill="#7d8a84"/>' +
      '<rect x="24" y="48" width="44" height="24" rx="4" fill="#8d7f70" opacity="0.6" stroke="#8d8579"/>' +
      '<rect x="78" y="62" width="40" height="6" fill="#a08a6c"/>' +
      '<ellipse cx="98" cy="58" rx="14" ry="5" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<circle cx="92" cy="56" r="3" fill="#9c4a34" opacity="0.4"/><circle cx="100" cy="56" r="3" fill="#a08a6c" opacity="0.5"/>' +
      '<path d="M126 72 v-30 q0 -6 6 -6" stroke="#8d8579" stroke-width="1.4"/>' +
      '<rect x="124" y="32" width="10" height="14" rx="4" fill="#4a443c" opacity="0.7"/>' +
      '<path d="M30 30 q6 -8 12 0 M52 26 q6 -8 12 0" stroke="#5c7a74" stroke-width="1.2" fill="none"/>' +
      '<circle cx="30" cy="34" r="2" fill="#9c4a34" opacity="0.6"/><circle cx="52" cy="30" r="2" fill="#5c7a74" opacity="0.7"/>');
  };

  /* ---------------- 中年 ---------------- */
  scenes.sales_office = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="22" y="56" width="82" height="28" fill="#e9e3d5" stroke="#c9bea9"/>' +
      '<rect x="34" y="44" width="10" height="16" fill="#efe8d8" stroke="#8d8579"/>' +
      '<rect x="50" y="38" width="12" height="22" fill="#efe8d8" stroke="#8d8579"/>' +
      '<rect x="68" y="46" width="10" height="14" fill="#efe8d8" stroke="#8d8579"/>' +
      '<rect x="84" y="42" width="12" height="18" fill="#efe8d8" stroke="#8d8579"/>' +
      '<path d="M38 44 v-4 M56 38 v-4 M90 42 v-4" stroke="#5c7a74" stroke-width="1"/>' +
      '<rect x="108" y="64" width="22" height="6" fill="#a08a6c"/>' +
      '<rect x="112" y="50" width="14" height="10" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M30 88 h92" stroke="#8d8579"/>');
  };
  scenes.parent_sickbed = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="18" y="58" width="64" height="8" fill="#a08a6c"/>' +
      '<rect x="22" y="66" width="4" height="20" fill="#8d8579"/><rect x="74" y="66" width="4" height="20" fill="#8d8579"/>' +
      '<rect x="22" y="46" width="18" height="12" fill="#dfe7e3" stroke="#9fb3ac"/>' +
      '<rect x="40" y="46" width="36" height="12" fill="#e9e3d5" stroke="#c9bea9"/>' +
      '<path d="M88 30 v58 M88 38 h14 v10" stroke="#8d8579" stroke-width="1.4" fill="none"/>' +
      '<rect x="88" y="30" width="8" height="10" rx="3" fill="#dfe7e3" stroke="#9fb3ac"/>' +
      '<path d="M96 48 q6 10 0 18" stroke="#9fb3ac" stroke-width="1"/>' +
      '<path d="M104 62 v-14 q0 -4 4 -4 h8" stroke="#8d8579"/>' +
      '<rect x="110" y="44" width="14" height="6" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M26 84 h100" stroke="#c9bea9"/>');
  };
  scenes.kindergarten_pickup = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<path d="M18 88 h114" stroke="#c9bea9"/>' +
      '<path d="M22 88 V48 M52 88 V48 M22 56 h30" stroke="#a08a6c" stroke-width="2"/>' +
      '<rect x="66" y="54" width="30" height="26" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M66 54 l15 -10 15 10" stroke="#a08a6c" fill="none"/>' +
      '<rect x="72" y="34" width="8" height="12" fill="#dfe7e3" stroke="#9fb3ac"/>' +
      '<path d="M74 34 q2 -5 4 0" stroke="#8d8579"/>' +
      '<circle cx="106" cy="76" r="6" fill="#dfe7e3" stroke="#9fb3ac"/>' +
      '<path d="M100 76 h12 M106 70 v12" stroke="#9fb3ac"/>' +
      '<path d="M114 46 q6 -8 12 0" stroke="#5c7a74" stroke-width="1.2" fill="none"/>');
  };
  scenes.layoff_meeting = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="16" y="60" width="118" height="10" fill="#7d6d58"/>' +
      '<rect x="24" y="70" width="4" height="16" fill="#8d8579"/><rect x="126" y="70" width="4" height="16" fill="#8d8579"/>' +
      '<path d="M26 46 v10 q0 4 4 4 h8 v-14" stroke="#8d8579" fill="none"/>' +
      '<path d="M54 46 v10 q0 4 4 4 h8 v-14" stroke="#8d8579" fill="none"/>' +
      '<path d="M82 46 v10 q0 4 4 4 h8 v-14" stroke="#8d8579" fill="none"/>' +
      '<path d="M110 46 v10 q0 4 4 4 h8 v-14" stroke="#8d8579" fill="none"/>' +
      '<rect x="46" y="52" width="18" height="8" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<rect x="72" y="54" width="16" height="6" fill="#e9e3d5" stroke="#c9bea9"/>' +
      '<rect x="94" y="20" width="34" height="22" fill="#dfe7e3" stroke="#9fb3ac"/>' +
      '<path d="M100 26 h18 M100 32 h14" stroke="#8d8579"/>');
  };
  scenes.startup_office = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="20" y="22" width="66" height="34" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M28 34 q8 -8 16 0 q8 8 16 0" stroke="#5c7a74" stroke-width="1.2" fill="none"/>' +
      '<path d="M28 44 h22 M56 44 h14" stroke="#9c4a34" stroke-width="1" opacity="0.6"/>' +
      '<rect x="96" y="54" width="34" height="8" fill="#a08a6c"/>' +
      '<path d="M100 62 v12 M126 62 v12" stroke="#8d8579"/>' +
      '<rect x="102" y="44" width="18" height="12" fill="#4a5a55"/>' +
      '<rect x="26" y="62" width="22" height="16" fill="#e9e3d5" stroke="#c9bea9"/>' +
      '<path d="M30 66 h14" stroke="#c9bea9"/>' +
      '<path d="M24 34 q5 -6 10 0" stroke="#7d8a84" stroke-width="1"/>' +
      '<path d="M30 88 h90" stroke="#8d8579"/>');
  };
  scenes.bank_loan = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="20" y="58" width="110" height="10" fill="#a08a6c"/>' +
      '<rect x="24" y="68" width="4" height="20" fill="#8d8579"/><rect x="122" y="68" width="4" height="20" fill="#8d8579"/>' +
      '<rect x="26" y="30" width="60" height="28" fill="#dfe7e3" opacity="0.35" stroke="#9fb3ac"/>' +
      '<path d="M56 30 v28" stroke="#c9bea9"/>' +
      '<rect x="34" y="40" width="20" height="14" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M38 44 h12 M38 48 h10" stroke="#c9bea9"/>' +
      '<path d="M68 46 l10 12" stroke="#4a443c" stroke-width="1.4"/>' +
      '<circle cx="80" cy="58" r="5" fill="none" stroke="#9c4a34" opacity="0.6"/>' +
      '<path d="M22 88 h106" stroke="#8d8579"/>');
  };
  scenes.body_check = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="24" y="62" width="30" height="26" rx="6" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<circle cx="39" cy="75" r="9" fill="none" stroke="#8d8579"/>' +
      '<path d="M39 70 v5" stroke="#9c4a34" stroke-width="1.2"/>' +
      '<rect x="76" y="34" width="26" height="36" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M80 42 h18 M80 48 h18 M80 54 h12 M80 60 h16" stroke="#c9bea9"/>' +
      '<circle cx="94" cy="64" r="4" fill="none" stroke="#a33b2e" opacity="0.6"/>' +
      '<path d="M114 30 v52" stroke="#8d8579" stroke-width="1.2"/>' +
      '<path d="M110 36 h8 M110 46 h6 M110 56 h8 M110 66 h6" stroke="#8d8579"/>' +
      '<path d="M26 88 h96" stroke="#8d8579"/>');
  };

  /* ---------------- 中老年 ---------------- */
  scenes.retirement_day = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="22" y="62" width="106" height="8" fill="#a08a6c"/>' +
      '<rect x="28" y="70" width="4" height="18" fill="#8d8579"/><rect x="118" y="70" width="4" height="18" fill="#8d8579"/>' +
      '<rect x="34" y="44" width="26" height="18" rx="2" fill="#9c4a34" opacity="0.7" stroke="#8d8579"/>' +
      '<path d="M40 50 h14 M40 56 h10" stroke="#efe8d8" stroke-width="1" opacity="0.8"/>' +
      '<path d="M74 62 v-10 q0 -4 4 -4 h4" stroke="#8d8579"/>' +
      '<path d="M74 52 q8 0 8 5 q0 5 -8 5" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M72 46 q4 -6 8 0 M80 44 q4 -6 8 0" stroke="#c9bea9" stroke-width="1" fill="none"/>' +
      '<circle cx="106" cy="52" r="7" fill="#9c4a34" opacity="0.25"/>' +
      '<path d="M106 59 v5" stroke="#7d8a84"/>' +
      '<path d="M26 88 h98" stroke="#8d8579"/>');
  };
  scenes.square_dance = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="20" y="72" width="30" height="16" fill="#4a443c" opacity="0.7"/>' +
      '<circle cx="28" cy="80" r="5" fill="#8d8579"/>' +
      '<path d="M56 68 q-8 -10 0 -20 q8 -10 0 -20 M64 68 q-8 -10 0 -20 q8 -10 0 -20" stroke="#5c7a74" stroke-width="1" fill="none" opacity="0.6"/>' +
      '<path d="M100 88 v-34 q3 -6 7 0 v34" stroke="#8d7a63" stroke-width="3"/>' +
      '<ellipse cx="104" cy="46" rx="16" ry="11" fill="#7d8a84" opacity="0.3" stroke="#8d8579"/>' +
      '<path d="M86 88 h44" stroke="#c9bea9"/>' +
      '<rect x="70" y="74" width="24" height="4" fill="#a08a6c"/>' +
      '<path d="M74 78 v8 M90 78 v8" stroke="#8d8579"/>' +
      '<circle cx="126" cy="28" r="3" fill="#e9e3d5" opacity="0.7"/>');
  };
  scenes.grandchild = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<path d="M26 88 h98" stroke="#c9bea9"/>' +
      '<path d="M48 58 q26 -20 52 0" stroke="#8d8579" stroke-width="1.4" fill="none"/>' +
      '<rect x="52" y="58" width="44" height="18" rx="6" fill="#dfe7e3" stroke="#9fb3ac"/>' +
      '<circle cx="60" cy="80" r="6" fill="none" stroke="#8d8579"/><circle cx="88" cy="80" r="6" fill="none" stroke="#8d8579"/>' +
      '<path d="M96 58 l8 -14" stroke="#8d8579"/>' +
      '<circle cx="74" cy="64" r="5" fill="#e6c9ad"/>' +
      '<path d="M70 62 q4 -4 8 0" fill="#3b332c"/>' +
      '<rect x="26" y="66" width="14" height="6" fill="#a08a6c"/>' +
      '<path d="M28 72 v8 M38 72 v8" stroke="#8d8579"/>' +
      '<path d="M112 44 q6 -8 12 0" stroke="#5c7a74" stroke-width="1.2" fill="none"/>');
  };
  scenes.old_friend = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<path d="M20 90 h110" stroke="#c9bea9"/>' +
      '<path d="M26 90 v-26 q0 -5 5 -5 h14 v31" stroke="#8d7a63" fill="none"/>' +
      '<path d="M30 62 v-8 M40 62 v-8" stroke="#8d7a63"/>' +
      '<path d="M104 90 v-26 q0 -5 5 -5 h14 v31" stroke="#8d7a63" fill="none"/>' +
      '<path d="M108 62 v-8 M118 62 v-8" stroke="#8d7a63"/>' +
      '<rect x="62" y="58" width="18" height="14" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M68 60 v10 M74 60 v10 M64 66 h14" stroke="#8d8579" stroke-width="0.9"/>' +
      '<circle cx="86" cy="62" r="3" fill="#9c4a34" opacity="0.4"/>' +
      '<path d="M86 66 v4" stroke="#8d8579"/>' +
      '<ellipse cx="40" cy="36" rx="14" ry="9" fill="#7d8a84" opacity="0.25" stroke="#8d8579"/>');
  };
  scenes.health_check = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="18" y="22" width="54" height="46" fill="none" stroke="#8d8579"/>' +
      '<path d="M45 22 v46" stroke="#c9bea9"/>' +
      '<rect x="80" y="28" width="38" height="44" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M86 36 h24 M86 44 h24 M86 52 h16 M86 60 h20" stroke="#c9bea9"/>' +
      '<circle cx="110" cy="62" r="5" fill="none" stroke="#a33b2e" opacity="0.6"/>' +
      '<rect x="24" y="76" width="14" height="10" rx="2" fill="#dfe7e3" stroke="#9fb3ac"/>' +
      '<rect x="42" y="78" width="12" height="8" rx="2" fill="#e9e3d5" stroke="#c9bea9"/>' +
      '<path d="M64 82 q8 -12 16 0" stroke="#8d8579" stroke-width="1"/>' +
      '<path d="M28 90 h100" stroke="#8d8579"/>');
  };
  scenes.downsize_home = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="20" y="52" width="30" height="26" fill="#d9c6a8" stroke="#a08a6c"/>' +
      '<path d="M20 52 l10 -8 h30 l-10 8" fill="#e9e3d5" stroke="#a08a6c"/>' +
      '<rect x="58" y="46" width="34" height="32" fill="#d9c6a8" stroke="#a08a6c"/>' +
      '<path d="M58 46 l10 -8 h34 l-10 8" fill="#e9e3d5" stroke="#a08a6c"/>' +
      '<path d="M66 56 h18 M66 62 h18" stroke="#a08a6c"/>' +
      '<ellipse cx="100" cy="62" rx="6" ry="3" fill="none" stroke="#8d8579"/>' +
      '<path d="M96 62 l-8 8" stroke="#8d8579"/>' +
      '<rect x="102" y="72" width="26" height="16" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M20 90 h108" stroke="#8d8579"/>');
  };
  scenes.pension_day = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="20" y="60" width="110" height="8" fill="#a08a6c"/>' +
      '<rect x="26" y="68" width="4" height="20" fill="#8d8579"/><rect x="120" y="68" width="4" height="20" fill="#8d8579"/>' +
      '<rect x="30" y="42" width="30" height="18" rx="2" fill="#9c4a34" opacity="0.55" stroke="#8d8579"/>' +
      '<path d="M34 48 h22 M34 54 h16" stroke="#efe8d8" stroke-width="1" opacity="0.8"/>' +
      '<rect x="74" y="30" width="34" height="30" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M80 38 h4 M88 38 h4 M96 38 h4 M80 46 h4 M88 46 h4 M96 46 h4 M80 54 h4 M88 54 h4" stroke="#b9ad98" stroke-width="1"/>' +
      '<path d="M84 30 v-4 M98 30 v-4" stroke="#8d8579"/>' +
      '<path d="M116 44 l8 10" stroke="#4a443c" stroke-width="1.4"/>' +
      '<path d="M24 88 h100" stroke="#8d8579"/>');
  };
  scenes.hobby_class = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<path d="M40 88 v-40 M70 88 v-40 M40 48 h30 M40 58 h30" stroke="#8d8579" stroke-width="1.6"/>' +
      '<path d="M46 52 q8 4 16 0 M46 56 q8 4 16 0" stroke="#c9bea9"/>' +
      '<path d="M88 70 q10 -6 18 0 q-8 12 -18 0 z" fill="#4a443c" opacity="0.4"/>' +
      '<path d="M94 68 l16 -26" stroke="#8d7a63" stroke-width="2"/>' +
      '<path d="M110 42 l3 -6" stroke="#4a443c" stroke-width="1"/>' +
      '<rect x="82" y="74" width="28" height="12" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M88 78 q6 -3 12 0" stroke="#c9bea9"/>' +
      '<path d="M24 90 h100" stroke="#8d8579"/>');
  };

  /* ---------------- 晚年 ---------------- */
  scenes.park_bench = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<path d="M18 92 h116" stroke="#c9bea9"/>' +
      '<rect x="34" y="62" width="70" height="6" fill="#8d7a63"/>' +
      '<rect x="34" y="52" width="70" height="5" fill="#a08a6c"/>' +
      '<path d="M40 68 v14 M98 68 v14" stroke="#8d7a63"/>' +
      '<path d="M108 92 v-48 q3 -8 8 -2 v50" stroke="#8d7a63" stroke-width="2.4"/>' +
      '<ellipse cx="114" cy="40" rx="18" ry="12" fill="#7d8a84" opacity="0.28" stroke="#8d8579"/>' +
      '<path d="M124 58 q8 8 4 16 M128 44 q10 6 10 16" stroke="#8d8579" stroke-width="1" fill="none"/>' +
      '<path d="M26 30 q6 -8 12 0" stroke="#5c7a74" stroke-width="1.1" fill="none"/>');
  };
  scenes.checkup_center = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<path d="M18 88 h114" stroke="#c9bea9"/>' +
      '<path d="M18 24 h114" stroke="#c9bea9" opacity="0.5"/>' +
      '<rect x="26" y="34" width="34" height="48" fill="none" stroke="#8d8579"/>' +
      '<path d="M30 34 v48 M30 42 h26 M30 56 h26" stroke="#c9bea9"/>' +
      '<rect x="78" y="34" width="34" height="48" fill="none" stroke="#8d8579"/>' +
      '<path d="M82 34 v48 M82 42 h26 M82 56 h26" stroke="#c9bea9"/>' +
      '<rect x="32" y="64" width="22" height="4" fill="#a08a6c"/>' +
      '<path d="M36 68 v12 M50 68 v12" stroke="#8d8579"/>' +
      '<rect x="112" y="40" width="12" height="22" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M118 44 v14 M112 51 h12" stroke="#a33b2e" opacity="0.5"/>');
  };
  scenes.funeral = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="46" y="20" width="58" height="54" fill="none" stroke="#4a443c" stroke-width="1.6"/>' +
      '<rect x="52" y="26" width="46" height="42" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<circle cx="75" cy="44" r="10" fill="#e6c9ad" opacity="0.6"/>' +
      '<path d="M60 68 q15 -20 30 0" fill="#7d8a84" opacity="0.4"/>' +
      '<path d="M46 20 l-10 -10 M104 20 l10 -10" stroke="#4a443c" stroke-width="1.4"/>' +
      '<path d="M60 20 q15 6 30 0" stroke="#4a443c" stroke-width="2"/>' +
      '<circle cx="32" cy="62" r="13" fill="none" stroke="#7d8a84" stroke-width="2"/>' +
      '<circle cx="32" cy="62" r="5" fill="none" stroke="#7d8a84"/>' +
      '<circle cx="120" cy="62" r="13" fill="none" stroke="#7d8a84" stroke-width="2"/>' +
      '<circle cx="120" cy="62" r="5" fill="none" stroke="#7d8a84"/>' +
      '<path d="M26 88 h98" stroke="#8d8579"/>');
  };
  scenes.old_photos = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<path d="M28 52 l44 -10 44 10 l-44 12 z" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M28 52 v30 l44 12 v-30 z" fill="#e9e3d5" stroke="#c9bea9"/>' +
      '<path d="M116 52 v30 l-44 12 v-30 z" fill="#e9e3d5" stroke="#c9bea9"/>' +
      '<rect x="36" y="58" width="14" height="18" fill="#dfe7e3" stroke="#9fb3ac" transform="rotate(-6 43 67)"/>' +
      '<rect x="56" y="60" width="12" height="16" fill="#efe8d8" stroke="#c9bea9" transform="rotate(8 62 68)"/>' +
      '<rect x="82" y="58" width="14" height="18" fill="#dfe7e3" stroke="#9fb3ac" transform="rotate(-5 89 67)"/>' +
      '<rect x="100" y="60" width="12" height="16" fill="#efe8d8" stroke="#c9bea9" transform="rotate(7 106 68)"/>' +
      '<circle cx="110" cy="36" r="8" fill="none" stroke="#8d8579"/>' +
      '<path d="M120 36 h8" stroke="#8d8579"/>' +
      '<path d="M24 88 h104" stroke="#8d8579"/>');
  };
  scenes.hospital_bed = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="20" y="54" width="64" height="8" fill="#a08a6c"/>' +
      '<rect x="24" y="62" width="4" height="20" fill="#8d8579"/><rect x="80" y="62" width="4" height="20" fill="#8d8579"/>' +
      '<rect x="24" y="42" width="18" height="12" fill="#dfe7e3" stroke="#9fb3ac"/>' +
      '<rect x="42" y="42" width="38" height="12" fill="#e9e3d5" stroke="#c9bea9"/>' +
      '<rect x="20" y="30" width="4" height="24" fill="#8d8579"/>' +
      '<path d="M92 28 v62" stroke="#8d8579" stroke-width="1.4"/>' +
      '<rect x="90" y="30" width="8" height="12" rx="3" fill="#dfe7e3" stroke="#9fb3ac"/>' +
      '<path d="M96 42 q6 10 0 18" stroke="#9fb3ac" stroke-width="1"/>' +
      '<rect x="106" y="52" width="20" height="14" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M109 60 l3 -5 3 8 3 -3" stroke="#5c7a74" stroke-width="1"/>');
  };
  scenes.will_matter = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="26" y="54" width="98" height="8" fill="#a08a6c"/>' +
      '<rect x="32" y="62" width="4" height="20" fill="#8d8579"/><rect x="114" y="62" width="4" height="20" fill="#8d8579"/>' +
      '<rect x="40" y="38" width="34" height="16" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M40 38 l17 10 17 -10" stroke="#c9bea9"/>' +
      '<circle cx="57" cy="50" r="4" fill="#9c4a34" opacity="0.55"/>' +
      '<path d="M88 50 l18 -20" stroke="#4a443c" stroke-width="1.6"/>' +
      '<path d="M102 32 l6 -6 4 4 -6 6 z" fill="#8d8579"/>' +
      '<path d="M34 30 q6 -6 12 0" stroke="#5c7a74" stroke-width="1" fill="none"/>' +
      '<path d="M24 88 h104" stroke="#8d8579"/>');
  };
  scenes.last_winter = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="24" y="16" width="52" height="42" fill="none" stroke="#8d8579"/>' +
      '<path d="M50 16 v42 M24 37 h52" stroke="#c9bea9"/>' +
      '<path d="M28 22 l10 8 -8 3 10 8 M58 20 l8 7 -6 4 8 6" stroke="#ffffff" stroke-width="1" opacity="0.8"/>' +
      '<path d="M84 92 v-24 q4 -8 8 0 v24 M96 92 v-18 q4 -6 8 0 v18" stroke="#8d8579" stroke-width="1.2"/>' +
      '<path d="M88 72 l-6 -8 M100 74 l6 -8" stroke="#8d8579"/>' +
      '<path d="M18 92 h116" stroke="#c9bea9"/>' +
      '<path d="M112 80 h16 v12" fill="none" stroke="#c9bea9"/>' +
      '<path d="M112 80 l8 -8 8 8" stroke="#a08a6c" fill="none"/>' +
      '<circle cx="112" cy="30" r="2" fill="#ffffff" opacity="0.7"/>');
  };

  /* ---------------- 四路径 ---------------- */
  scenes.lab_night = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="18" y="64" width="114" height="8" fill="#7d8a84"/>' +
      '<rect x="24" y="72" width="4" height="16" fill="#8d8579"/><rect x="122" y="72" width="4" height="16" fill="#8d8579"/>' +
      '<rect x="30" y="44" width="22" height="20" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M34 50 h14 M34 56 h10" stroke="#c9bea9"/>' +
      '<circle cx="66" cy="54" r="8" fill="none" stroke="#5c7a74"/>' +
      '<path d="M66 46 v16 M58 60 h16" stroke="#8d8579"/>' +
      '<path d="M84 64 v-14 q0 -4 4 -4 h8" stroke="#8d8579"/>' +
      '<path d="M90 40 l8 7 -12 0 z" fill="#e9dfc4" opacity="0.8"/>' +
      '<rect x="16" y="18" width="34" height="28" fill="#22313a" opacity="0.3" stroke="#8d8579"/>' +
      '<circle cx="42" cy="28" r="5" fill="#e9e3d5" opacity="0.8"/>');
  };
  scenes.paper_accept = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="24" y="56" width="102" height="8" fill="#a08a6c"/>' +
      '<rect x="30" y="64" width="4" height="18" fill="#8d8579"/><rect x="120" y="64" width="4" height="18" fill="#8d8579"/>' +
      '<rect x="34" y="34" width="42" height="22" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M38 40 h34 M38 45 h34 M38 50 h26" stroke="#c9bea9"/>' +
      '<circle cx="86" cy="46" r="7" fill="none" stroke="#a33b2e" stroke-width="2" opacity="0.6"/>' +
      '<path d="M82 46 h8 M86 42 v8" stroke="#a33b2e" opacity="0.5"/>' +
      '<path d="M102 56 l12 -18" stroke="#4a443c" stroke-width="1.4"/>' +
      '<rect x="108" y="24" width="22" height="14" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M108 24 l11 8 11 -8" stroke="#c9bea9"/>' +
      '<path d="M22 88 h106" stroke="#8d8579"/>');
  };
  scenes.writing_room = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="18" y="60" width="114" height="9" fill="#a08a6c"/>' +
      '<rect x="24" y="69" width="4" height="18" fill="#8d8579"/><rect x="120" y="69" width="4" height="18" fill="#8d8579"/>' +
      '<rect x="32" y="44" width="30" height="16" fill="#efe8d8" stroke="#c9bea9" transform="rotate(-4 47 52)"/>' +
      '<path d="M38 48 h18 M38 52 h18 M38 56 h12" stroke="#c9bea9"/>' +
      '<rect x="72" y="38" width="26" height="22" fill="#4a5a55" opacity="0.8"/>' +
      '<path d="M76 44 h18 M76 49 h18" stroke="#c9bea9"/>' +
      '<path d="M108 60 v-18 q0 -4 4 -4 h8" stroke="#8d8579"/>' +
      '<path d="M114 38 l9 7 -14 0 z" fill="#e9dfc4" opacity="0.8"/>' +
      '<path d="M24 30 q6 -6 12 0" stroke="#5c7a74" stroke-width="1" fill="none"/>' +
      '<path d="M20 88 h110" stroke="#8d8579"/>');
  };
  scenes.stage_light = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<path d="M12 18 q10 30 6 70 M138 18 q-10 30 -6 70" stroke="#7d8a84" stroke-width="2" fill="none"/>' +
      '<path d="M22 18 q8 30 4 66 M128 18 q-8 30 -4 66" stroke="#8d8579" stroke-width="1" fill="none" opacity="0.5"/>' +
      '<path d="M75 0 L48 88 L102 88 Z" fill="#e9dfc4" opacity="0.18"/>' +
      '<ellipse cx="75" cy="88" rx="28" ry="6" fill="#e9dfc4" opacity="0.3"/>' +
      '<rect x="14" y="88" width="122" height="6" fill="#a08a6c"/>' +
      '<path d="M75 88 v-30" stroke="#8d8579" stroke-width="1.4"/>' +
      '<rect x="71" y="44" width="9" height="14" rx="4" fill="#4a443c" opacity="0.7"/>' +
      '<circle cx="75" cy="10" r="4" fill="#e9dfc4"/>' +
      '<path d="M30 88 q8 -16 16 0 M104 88 q8 -16 16 0" stroke="#8d8579" stroke-width="1" fill="none" opacity="0.4"/>');
  };
  scenes.studio = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<path d="M34 92 l12 -64 M76 92 l-30 -64 M46 64 h44" stroke="#8d7a63" stroke-width="2"/>' +
      '<rect x="46" y="30" width="40" height="34" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M52 52 q10 -16 20 0" stroke="#7d8a84" stroke-width="1.2" fill="none"/>' +
      '<rect x="96" y="66" width="28" height="16" fill="#e9e3d5" stroke="#c9bea9"/>' +
      '<path d="M100 62 h8 M112 62 h8" stroke="#9c4a34" stroke-width="2"/>' +
      '<ellipse cx="106" cy="56" rx="10" ry="5" fill="#dfe7e3" stroke="#9fb3ac"/>' +
      '<circle cx="102" cy="55" r="2" fill="#9c4a34" opacity="0.5"/><circle cx="108" cy="54" r="2" fill="#a08a6c" opacity="0.6"/><circle cx="112" cy="57" r="2" fill="#5c7a74" opacity="0.4"/>' +
      '<path d="M24 88 h104" stroke="#8d8579"/>');
  };
  scenes.commission = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<rect x="28" y="18" width="52" height="42" fill="none" stroke="#a08a6c" stroke-width="2"/>' +
      '<rect x="34" y="24" width="40" height="30" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M40 48 q8 -18 14 0 M58 48 q6 -12 10 0" stroke="#7d8a84" stroke-width="1" fill="none"/>' +
      '<rect x="92" y="58" width="44" height="30" fill="#d9c6a8" stroke="#a08a6c"/>' +
      '<path d="M92 58 l8 -6 h44 l-8 6" fill="#e9e3d5" stroke="#a08a6c"/>' +
      '<path d="M108 58 v30" stroke="#a08a6c"/>' +
      '<rect x="100" y="66" width="18" height="10" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M22 92 h110" stroke="#8d8579"/>' +
      '<path d="M118 40 q6 -8 12 0" stroke="#5c7a74" stroke-width="1" fill="none"/>');
  };
  scenes.training_ground = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<path d="M14 92 h122" stroke="#c9bea9"/>' +
      '<path d="M20 88 q50 -20 110 0" stroke="#9c4a34" stroke-width="1" opacity="0.5"/>' +
      '<path d="M20 80 q50 -18 110 0" stroke="#c9bea9" stroke-width="1"/>' +
      '<path d="M34 88 l2 -12 8 0 -2 12 z" fill="#9c4a34" opacity="0.45"/>' +
      '<path d="M62 82 l2 -12 8 0 -2 12 z" fill="#9c4a34" opacity="0.45"/>' +
      '<path d="M90 78 l2 -12 8 0 -2 12 z" fill="#9c4a34" opacity="0.45"/>' +
      '<rect x="104" y="52" width="10" height="6" rx="2" fill="#efe8d8" stroke="#c9bea9"/>' +
      '<path d="M26 34 q8 -4 16 0" stroke="#8d8579" stroke-width="1" fill="none"/>' +
      '<circle cx="118" cy="30" r="6" fill="none" stroke="#8d8579"/>' +
      '<path d="M118 26 v4 l3 2" stroke="#8d8579"/>');
  };
  scenes.final_match = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<path d="M18 92 h114" stroke="#c9bea9"/>' +
      '<path d="M30 92 q45 -30 90 0" stroke="#9c4a34" stroke-width="1" opacity="0.5"/>' +
      '<path d="M75 64 v28" stroke="#c9bea9"/>' +
      '<path d="M60 52 h30 v8 q-15 10 -30 0 z" fill="#e9dfc4" stroke="#a08a6c"/>' +
      '<path d="M60 54 q-8 0 -8 8 q0 6 8 6 M90 54 q8 0 8 8 q0 6 -8 6" fill="none" stroke="#a08a6c"/>' +
      '<path d="M71 60 h8 v8 h-8 z" fill="#a08a6c"/>' +
      '<rect x="66" y="68" width="18" height="4" fill="#a08a6c"/>' +
      '<circle cx="40" cy="40" r="2" fill="#9c4a34" opacity="0.4"/><circle cx="110" cy="44" r="2" fill="#5c7a74" opacity="0.5"/><circle cx="96" cy="28" r="2" fill="#a08a6c" opacity="0.5"/>' +
      '<circle cx="118" cy="72" r="7" fill="#a08a6c" opacity="0.4" stroke="#8d8579"/>');
  };

  /* ---------------- 岔路 ---------------- */
  scenes.career_fork = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<path d="M20 92 h110" stroke="#c9bea9"/>' +
      '<path d="M20 40 h50 v52 M130 40 h-50 v52" stroke="#8d8579" fill="none"/>' +
      '<path d="M75 92 v-42" stroke="#c9bea9"/>' +
      '<rect x="26" y="30" width="26" height="48" fill="none" stroke="#8d8579"/>' +
      '<path d="M52 54 h-26 M30 30 v48" stroke="#c9bea9"/>' +
      '<circle cx="46" cy="56" r="2" fill="#a08a6c"/>' +
      '<rect x="98" y="30" width="26" height="48" fill="none" stroke="#8d8579"/>' +
      '<circle cx="104" cy="56" r="2" fill="#a08a6c"/>' +
      '<path d="M75 78 l-12 8 M75 78 l12 8" stroke="#9c4a34" stroke-width="1.2" fill="none"/>' +
      '<circle cx="75" cy="34" r="3" fill="#5c7a74" opacity="0.5"/>');
  };
  scenes.family_fork = function () {
    return svg(150, 104,
      '<rect width="150" height="104" fill="#f7f3ea"/>' +
      '<path d="M20 92 h110" stroke="#c9bea9"/>' +
      '<rect x="24" y="40" width="46" height="38" fill="#efe8d8" stroke="#a08a6c"/>' +
      '<path d="M24 40 l23 -14 23 14" stroke="#a08a6c" fill="none"/>' +
      '<rect x="36" y="56" width="14" height="22" fill="#a08a6c" opacity="0.6"/>' +
      '<circle cx="47" cy="66" r="2" fill="#4a443c"/>' +
      '<rect x="96" y="60" width="26" height="30" rx="2" fill="#a08a6c" opacity="0.65" stroke="#8d8579"/>' +
      '<path d="M104 60 v-6 h10 v6" stroke="#8d8579"/>' +
      '<path d="M96 70 h26" stroke="#8d8579"/>' +
      '<path d="M74 82 q8 -6 16 0 M74 88 q-8 -6 -16 0" stroke="#c9bea9" stroke-width="1" fill="none"/>' +
      '<circle cx="76" cy="44" r="3" fill="#9c4a34" opacity="0.4"/>');
  };

  LS.artEvent = function (key) {
    var fn = scenes[key] || scenes.office;
    return fn();
  };
  LS.artHas = function (key) { return !!scenes[key]; };

  /* ---------- 人物像：按种子取稳定气质变体，内联 data URI ---------- */
  var PORTRAIT_STAGE = { youth: 'youth', midlife: 'midlife', elder: 'elder', late: 'elder' };
  LS.artPortraitStage = function (stage) { return PORTRAIT_STAGE[stage] || ''; };

  LS.portraitVariantOf = function (seed) {
    var s = (seed === undefined || seed === null) ? '0' : String(seed);
    var n = 0;
    for (var i = 0; i < s.length; i++) n += s.charCodeAt(i);
    return n % 4;
  };

  LS.artPortrait = function (gender, stage, cls, seed) {
    var s = PORTRAIT_STAGE[stage];
    if (!s) return '';
    var v = LS.portraitVariantOf(seed === undefined ? 0 : seed);
    var raw = LS.artPerson(gender, s, v);
    return '<img class="portrait-img ' + (cls || '') +
      '" src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(raw) +
      '" alt="" draggable="false">';
  };

  LS.artScene = function (key, cls) {
    if (!key || !scenes[key]) return '';
    return '<img class="scene-img ' + (cls || '') +
      '" src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(scenes[key]()) +
      '" alt="" draggable="false">';
  };

  /* ---------- 事件 → 场景 的固定映射（无随机） ---------- */
  var ALIAS = {
    empty_home: 'emptyHome',
    exam_hall: 'exam',
    job_fair: 'jobfair',
    delivery_room: 'delivery_room',
    funeral: 'funeral',
    nursery: 'nursery',
    wedding: 'wedding',
    clinic: 'clinic',
    steps: 'first_steps',
    feed: 'nursery',
    nightcry: 'cradle',
    bath: 'nursery',
    grandparent: 'home',
    toy: 'cradle',
    homework: 'night_study',
    chores: 'home',
    relative: 'home',
    newyear: 'home',
    first_love: 'village_gate',
    part_time: 'corner_shop',
    class_rank: 'exam',
    graduation: 'exam'
  };

  LS.EVENT_ART_MAP = {
    cradle: 'cradle', vaccine: 'vaccine', steps: 'first_steps',
    classroom: 'classroom', village_gate: 'village_gate',
    corner_shop: 'corner_shop', playground: 'playground',
    exam_hall: 'exam', night_study: 'night_study', ball_court: 'ball_court',
    internet_cafe: 'internet_cafe',
    dorm: 'dorm', job_fair: 'jobfair', interview_room: 'interview_room',
    rental_room: 'rental_room', wedding: 'wedding',
    delivery_room: 'delivery_room', overtime_office: 'overtime_office',
    ktv_restaurant: 'ktv_restaurant',
    sales_office: 'sales_office', clinic: 'clinic',
    parent_sickbed: 'parent_sickbed',
    kindergarten_pickup: 'kindergarten_pickup',
    layoff_meeting: 'layoff_meeting', startup_office: 'startup_office',
    bank_loan: 'bank_loan', body_check: 'body_check',
    retirement_day: 'retirement_day', square_dance: 'square_dance',
    grandchild: 'grandchild', old_friend: 'old_friend',
    health_check: 'health_check', downsize_home: 'downsize_home',
    pension_day: 'pension_day', hobby_class: 'hobby_class',
    park_bench: 'park_bench', checkup_center: 'checkup_center',
    funeral: 'funeral', empty_home: 'emptyHome', old_photos: 'old_photos',
    photos: 'old_photos',
    hospital_bed: 'hospital_bed', will_matter: 'will_matter',
    last_winter: 'last_winter',
    lab_night: 'lab_night', paper_accept: 'paper_accept',
    writing_room: 'writing_room', stage_light: 'stage_light',
    studio: 'studio', commission: 'commission',
    training_ground: 'training_ground', final_match: 'final_match',
    career_fork: 'career_fork', family_fork: 'family_fork'
  };

  LS.sceneKeyForEvent = function (e) {
    if (!e) return '';
    if (e.art && LS.artHas(e.art)) return e.art;
    var id = String(e.id || '');
    var m;
    m = id.match(/^v33_(infant|inf|child|teen|youth|mid|senior|old)_([a-z_]+?)_\d+$/);
    if (m) {
      var k = m[2];
      var mapped = ALIAS[k] || LS.EVENT_ART_MAP[k];
      if (mapped && LS.artHas(mapped)) return mapped;
      if (LS.artHas(k)) return k;
      return '';
    }
    m = id.match(/^v33_trk_(science|arts|art|sports)_([a-z_]+?)_\d+$/);
    if (m) {
      if (LS.artHas(m[2])) return m[2];
      var tk = LS.EVENT_ART_MAP[m[2]];
      return (tk && LS.artHas(tk)) ? tk : '';
    }
    m = id.match(/^v33_cross_(career_fork|family_fork)_\d+$/);
    if (m) return LS.artHas(m[1]) ? m[1] : '';
    return '';
  };
})();
