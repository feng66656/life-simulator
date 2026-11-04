/* =========================================================
   art.js — 本地离线 SVG 插图（低饱和素描/淡彩）
   人物母版：同一角色按性别固定发型与脸型，只随年龄改变
   发色、皱纹、体态；全部为矢量图形，不引用任何外部图片。
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

  /* ---------- 人物母版：男/女 × 青年/中年/老年 ---------- */
  LS.artPerson = function (gender, stage) {
    var fem = gender === '女' || gender === '其他';
    var old = stage === 'elder';
    var mid = stage === 'midlife';
    var hairColor = old ? C.hairOld : (mid ? C.hairMid : C.hair);
    var skin = old ? C.skinOld : C.skin;
    var w = 150, h = 210;
    var p = [];
    var headCy = old ? 78 : (mid ? 76 : 74);
    var headRx = fem ? 30 : 32;
    var headRy = old ? 38 : 40;
    var eyeY = headCy + 4;

    p.push('<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="' + C.paper + '"/>');
    p.push('<ellipse cx="75" cy="196" rx="46" ry="8" fill="#e3dbcb" opacity="0.9"/>');

    /* 身体：青年直立，中年略宽，老年微驼；衣褶与领口保持同一人 */
    var shoulderY = old ? 134 : (mid ? 130 : 126);
    var bodyW = fem ? (old ? 44 : (mid ? 40 : 34)) : (old ? 52 : (mid ? 50 : 44));
    var cloth = fem ? '#7f8b85' : '#6f7d7a';
    p.push('<path d="M75 ' + shoulderY + ' C ' + (75 - bodyW) + ' ' + (shoulderY + 12) + ', ' + (75 - bodyW - 6) + ' 176, ' + (75 - bodyW - 4) + ' 200 L ' + (75 + bodyW + 4) + ' 200 C ' + (75 + bodyW + 6) + ' 176, ' + (75 + bodyW) + ' ' + (shoulderY + 12) + ', 75 ' + shoulderY + ' Z" fill="' + cloth + '" opacity="0.94"/>');
    p.push('<path d="M75 ' + (shoulderY + 8) + ' L' + (75 + bodyW - 10) + ' 200 L' + (75 + bodyW + 4) + ' 200 C ' + (75 + bodyW + 6) + ' 176, ' + (75 + bodyW) + ' ' + (shoulderY + 12) + ', 75 ' + shoulderY + ' Z" fill="#3f4a47" opacity="0.10"/>');
    p.push('<path d="M67 ' + (shoulderY + 2) + ' L75 ' + (shoulderY + 13) + ' L83 ' + (shoulderY + 2) + '" stroke="' + C.paper + '" stroke-width="2" fill="none"/>');
    p.push('<path d="M70 ' + (shoulderY + 3) + ' L75 ' + (shoulderY + 11) + ' L80 ' + (shoulderY + 3) + ' L75 ' + (shoulderY + 7) + ' Z" fill="#ddd3c1" opacity="0.55"/>');
    p.push('<path d="M63 ' + (shoulderY + 20) + ' q-6 20 -7 34 M87 ' + (shoulderY + 20) + ' q6 20 7 34" stroke="#4d5855" stroke-width="1" fill="none" opacity="0.28"/>');
    if (mid || old) {
      p.push('<path d="M75 ' + (shoulderY + 14) + ' L75 178" stroke="#4d5855" stroke-width="1" opacity="0.35"/>');
      p.push('<path d="M58 ' + (shoulderY + 26) + ' q-3 16 -3 26 M92 ' + (shoulderY + 26) + ' q3 16 3 26" stroke="#4d5855" stroke-width="0.8" fill="none" opacity="0.18"/>');
    }

    /* 脖子与头 */
    p.push('<rect x="66" y="' + (headCy + headRy - 16) + '" width="18" height="' + (shoulderY - headCy - headRy + 22) + '" rx="5" fill="' + skin + '"/>');
    p.push('<path d="M68 ' + (headCy + headRy - 8) + ' q7 9 14 0" fill="#a9866c" opacity="0.35"/>');
    p.push('<ellipse cx="75" cy="' + headCy + '" rx="' + headRx + '" ry="' + headRy + '" fill="' + skin + '"/>');
    p.push('<ellipse cx="' + (75 - headRx + 12) + '" cy="' + (headCy + 4) + '" rx="14" ry="28" fill="#ffffff" opacity="0.07"/>');
    p.push('<ellipse cx="56" cy="' + (headCy + 15) + '" rx="7" ry="5" fill="#c07f66" opacity="0.13"/><ellipse cx="94" cy="' + (headCy + 15) + '" rx="7" ry="5" fill="#c07f66" opacity="0.13"/>');
    /* 耳朵 */
    p.push('<ellipse cx="' + (75 - headRx + 2) + '" cy="' + headCy + '" rx="5" ry="8" fill="' + skin + '"/>');
    p.push('<ellipse cx="' + (75 + headRx - 2) + '" cy="' + headCy + '" rx="5" ry="8" fill="' + skin + '"/>');
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

    /* 眉眼：杏形眼、眉、眼袋（老年） */
    p.push('<path d="M51 ' + (eyeY - 9) + ' q9 -4 18 -1" stroke="' + (old ? '#b8b0a2' : C.ink) + '" stroke-width="' + (fem ? '0.9' : '1.2') + '" fill="none" opacity="0.72"/>');
    p.push('<path d="M81 ' + (eyeY - 9) + ' q9 -4 18 -1" stroke="' + (old ? '#b8b0a2' : C.ink) + '" stroke-width="' + (fem ? '0.9' : '1.2') + '" fill="none" opacity="0.72"/>');
    [58, 82].forEach(function (cx) {
      p.push('<path d="M' + cx + ' ' + eyeY + ' q7 -5 14 0 q-7 6 -14 0 Z" fill="#f4ede0" stroke="#4a443c" stroke-width="0.7" opacity="0.95"/>');
      p.push('<circle cx="' + (cx + 7) + '" cy="' + (eyeY + 0.5) + '" r="2.2" fill="#3b332c"/>');
      p.push('<circle cx="' + (cx + 6.2) + '" cy="' + (eyeY - 0.3) + '" r="0.7" fill="#f7f3ea"/>');
    });
    p.push('<path d="M75 ' + (eyeY + 3) + ' q-2 8 0 10 q2 3 6 1" stroke="' + C.soft + '" stroke-width="0.9" fill="none" opacity="0.75"/>');
    p.push('<path d="M68 ' + (headCy + 24) + ' q7 ' + (old ? '2' : '4') + ' 14 0" stroke="' + C.ink + '" stroke-width="1.1" fill="none"/>');
    p.push('<path d="M70 ' + (headCy + 26) + ' q5 ' + (old ? '1' : '2') + ' 10 0" stroke="#b07a66" stroke-width="0.7" fill="none" opacity="0.5"/>');
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

  LS.artEvent = function (key) {
    var fn = scenes[key] || scenes.office;
    return fn();
  };
  LS.artHas = function (key) { return !!scenes[key]; };
})();
