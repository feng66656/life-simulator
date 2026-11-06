/* =========================================================
   v3.7 童年事件库
   婴幼儿（0–3）40 条 + 童年（4–12）80 条，共 120 条。
   写法约定：只写具体的物、地点、人；不写总结，不写顿悟。
   依赖：state.js / social.js / events.js（EVENTS / EVENT_INDEX）
   加载位置：lines.js 之后即可，本文件会自行补 EVENT_INDEX
   ========================================================= */
(function () {
  'use strict';
  var L = window.LS = window.LS || {};
  var EV = L.EVENTS = L.EVENTS || [];

  /* ---------------- 守卫工具 ---------------- */
  function aliveNpc(g, role) {
    var n = L.getNpc && L.getNpc(g, role);
    return !!n && n.alive !== false;
  }
  /* 年龄区间（引擎抽随机事件不看 ageMin，必须再写一层 cond） */
  function A(lo, hi) {
    return function (g) { return !!g && g.age >= lo && g.age <= hi; };
  }
  /* 年龄 + 指定 NPC 必须活着 */
  function AAlive(lo, hi, roles) {
    return function (g) {
      if (!g || g.age < lo || g.age > hi) return false;
      for (var i = 0; i < roles.length; i++) if (!aliveNpc(g, roles[i])) return false;
      return true;
    };
  }
  /* 年龄 + 指定 NPC 已入场 */
  function AWith(lo, hi, role) {
    return function (g) {
      return !!g && g.age >= lo && g.age <= hi && !!(L.getNpc && L.getNpc(g, role));
    };
  }
  /* 年龄 + 前置事件留下的标记（回声只走 pending，不进随机池） */
  function AArmed(lo, hi, mark) {
    return function (g) {
      return !!g && g.age >= lo && g.age <= hi && !!(g.marks && g.marks[mark]);
    };
  }
  function AArmedAlive(lo, hi, mark, roles) {
    var base = AAlive(lo, hi, roles);
    return function (g) {
      return base(g) && !!(g.marks && g.marks[mark]);
    };
  }

  var EVENTS = [

    /* =====================================================
       婴幼儿 0–3：只能观察、被抱、哭、学步、怕、抓
       ===================================================== */

    {
      id: 'ch_in_01', stage: '婴幼儿', ageMin: 0, ageMax: 0,
      type: 'random', tier: 'daily', weight: 1.2,
      title: '满月酒的红鸡蛋',
      text: '满月那天，家里摆了三桌。奶奶把染红的鸡蛋装在搪瓷盆里，一个一个塞给来客。你被从这双手传到那双手，屋里的烟味、酒味、还有人身上的雪花膏味混在一起，你哭了一声，又被人塞了块糖。',
      art: 'cradle', requiresAlive: ['母亲'], cond: AAlive(0, 0, ['母亲']),
      opts: [
        { label: '抓住盆边那只红鸡蛋不放', fx: { at: { happiness: 1 }, set: { ch_in_01_hold: true } } },
        { label: '把头埋进母亲怀里', fx: { npc: { '母亲': { intimacy: 2 } } } }
      ]
    },
    {
      id: 'ch_in_02', stage: '婴幼儿', ageMin: 0, ageMax: 0,
      type: 'random', tier: 'daily', weight: 1.2,
      title: '蚊帐上的补丁',
      text: '夏天夜里，蚊帐上有一块补丁。母亲坐在床边摇蒲扇，扇子破了一角，摇起来呼呼响。窗外青蛙叫得厉害，蚊帐里闷，你盯着帐顶那块补丁，看久了，补丁像一块云。',
      art: 'home', requiresAlive: ['母亲'], cond: AAlive(0, 0, ['母亲']),
      opts: [
        { label: '伸手去抓补丁的边', fx: { at: { happiness: 1 }, npc: { '母亲': { intimacy: 1 } } } },
        { label: '哼一声要人抱', fx: { npc: { '母亲': { intimacy: 2 } } } }
      ]
    },
    {
      id: 'ch_in_03', stage: '婴幼儿', ageMin: 0, ageMax: 0,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '防疫站的针',
      text: '镇上的防疫站在卫生院二楼，走廊里全是酒精味。穿白大褂的人用棉球擦你的胳膊，凉。针扎进去时你愣了一下，过了半秒才哭出声。母亲把你抱起来，手掌一下一下拍你的背。',
      art: 'vaccine', requiresAlive: ['母亲'], cond: AAlive(0, 0, ['母亲']),
      opts: [
        { label: '哭到脸通红', fx: { at: { happiness: -1 }, npc: { '母亲': { intimacy: 2 } } } },
        { label: '转头盯着那人胸前的钢笔', fx: { at: { stress: 1 }, tag: '第一次打针没看针头' } }
      ]
    },
    {
      id: 'ch_in_04', stage: '婴幼儿', ageMin: 0, ageMax: 0,
      type: 'random', tier: 'daily', weight: 1.1,
      title: '搪瓷盆里的水',
      text: '洗澡用的是那只白底蓝边的搪瓷盆，盆底磕掉一块瓷，摸上去发黑。母亲用手肘试了三遍水温，才把你放进去。你两手抓住盆沿，脚一蹬，水溅到她脸上，她笑了一声。',
      art: 'home', requiresAlive: ['母亲'], cond: AAlive(0, 0, ['母亲']),
      opts: [
        { label: '继续蹬水', fx: { at: { happiness: 2 }, npc: { '母亲': { intimacy: 1 } } } },
        { label: '抓紧盆沿不动', fx: { at: { happiness: 1 } } }
      ]
    },
    {
      id: 'ch_in_05', stage: '婴幼儿', ageMin: 0, ageMax: 0,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '缝纫机旁的摇篮',
      text: '母亲的缝纫机放在窗下，踏板一踩，针就哒哒哒地响。你躺在旁边的摇篮里，看她的脚一上一下。线轴转到一半停了，她低头咬断线，屋里忽然安静，你立刻哭了。',
      art: 'home', requiresAlive: ['母亲'], cond: AAlive(0, 0, ['母亲']),
      opts: [
        { label: '哭到她过来抱', fx: { npc: { '母亲': { intimacy: 2 } }, at: { stress: -1 } } },
        { label: '听着声音睡过去', fx: { at: { happiness: 1 } } }
      ]
    },
    {
      id: 'ch_in_06', stage: '婴幼儿', ageMin: 0, ageMax: 0,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '半夜换煤球',
      text: '冬天半夜，煤炉快灭了。父亲披着棉袄起来，用火钳夹出烧透的煤球，红的，掉在地上碎成几块。新煤球放进去，一股呛人的烟升起来。他用手在炉口扇，火光在他脸上晃。',
      art: 'home', requiresAlive: ['父亲'], cond: AAlive(0, 0, ['父亲']),
      opts: [
        { label: '被烟呛得咳嗽', fx: { at: { health: -1 }, npc: { '父亲': { intimacy: 2 } } } },
        { label: '盯着那点火光', fx: { at: { happiness: 1 } } }
      ]
    },
    {
      id: 'ch_in_07', stage: '婴幼儿', ageMin: 0, ageMax: 1,
      type: 'random', tier: 'daily', weight: 1.1,
      title: '铁勺刮碗底',
      text: '米粉冲在搪瓷碗里，母亲用一把铁勺刮碗底，刮出沙沙的响。勺子上有个小缺口，你的牙床咬上去，凉的。她把勺子送到你嘴边，你张嘴，米糊顺着下巴流到围嘴上。',
      art: 'home', requiresAlive: ['母亲'], cond: AAlive(0, 1, ['母亲']),
      opts: [
        {
          label: '伸手抢勺子',
          fx: {
            at: { happiness: 1 }, npc: { '母亲': { intimacy: 1 } },
            set: { ch_in_e1_armed: true }, flag: [{ event: 'ch_in_e1', delay: 3 }]
          }
        },
        { label: '扭头躲开这一口', fx: { at: { happiness: -1 } } },
        { label: '张嘴等下一口', fx: { at: { happiness: 1 } } }
      ]
    },
    {
      id: 'ch_in_08', stage: '婴幼儿', ageMin: 0, ageMax: 1,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '脖子上的银锁',
      text: '奶奶从庙会上求来一把银锁，用红绳系在你脖子上。锁很小，边上磨得发亮，睡觉时硌着下巴。红绳洗过几次，褪成粉色，还是照样系着。',
      art: 'cradle',
      opts: [
        { label: '用手去扯红绳', fx: { at: { happiness: 1 }, tag: '把银锁的红绳扯松了' } },
        { label: '含着锁片睡着', fx: { at: { happiness: 1 } } }
      ]
    },
    {
      id: 'ch_in_09', stage: '婴幼儿', ageMin: 0, ageMax: 1,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '门口的黄狗',
      text: '隔壁李家养了一条黄狗，拴在门边的槐树上。你被抱到门口晒太阳，狗凑过来，鼻子湿漉漉地闻你的脚。它舔了一下，你缩脚，它又舔，尾巴扫起地上的土。',
      art: 'village_gate',
      opts: [
        { label: '伸手抓狗耳朵', fx: { at: { happiness: 2 } } },
        { label: '咧开嘴大哭', fx: { at: { stress: 1 } } },
        { label: '把脚缩进被子里', fx: { at: { happiness: 1 } } }
      ]
    },
    {
      id: 'ch_in_10', stage: '婴幼儿', ageMin: 0, ageMax: 1,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '挂历上的娃娃',
      text: '堂屋墙上挂着一本挂历，一月那页印着抱鲤鱼的白胖娃娃。你被抱着经过，总要伸手指。挂历翻到三月，娃娃换成穿红袄的女人，你找不到原来那个，手指在纸上划来划去。',
      art: 'home',
      opts: [
        { label: '拍打挂历', fx: { at: { happiness: 1 } } },
        { label: '扭头找母亲', fx: { npc: { '母亲': { intimacy: 1 } } } }
      ]
    },
    {
      id: 'ch_in_11', stage: '婴幼儿', ageMin: 0, ageMax: 1,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '院子里的芦花鸡',
      text: '院子里养了六只鸡，最凶的是那只芦花鸡。你刚会站，扶着门框看它们抢食，玉米粒撒在泥地上。芦花鸡突然朝你冲过来，翅膀张开，你往后一坐，坐在了鸡食盆里。',
      art: 'home',
      opts: [
        { label: '抓一把玉米粒扔出去', fx: { at: { happiness: 2 } } },
        { label: '坐在盆里哭', fx: { at: { happiness: -1 }, npc: { '母亲': { intimacy: 1 } } } }
      ]
    },
    {
      id: 'ch_in_12', stage: '婴幼儿', ageMin: 0, ageMax: 1,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '被窝里的热水袋',
      text: '冬天被窝里放一只橡胶热水袋，外面裹着毛巾。母亲把它塞到你脚边，说烫，别贴着。你偏要用脚趾去顶那层毛巾，一层层顶开，最后踩在滚烫的橡胶上，缩回来，又伸过去。',
      art: 'home', requiresAlive: ['母亲'], cond: AAlive(0, 1, ['母亲']),
      opts: [
        { label: '再踩一次', fx: { at: { happiness: 1, health: -1 }, tag: '脚心被热水袋烫红了一块' } },
        { label: '把脚挪开', fx: { at: { happiness: 1 } } }
      ]
    },
    {
      id: 'ch_in_13', stage: '婴幼儿', ageMin: 1, ageMax: 2,
      type: 'random', tier: 'daily', weight: 1.1,
      title: '旧货摊的学步车',
      text: '学步车是父亲从镇上旧货摊买回来的，四个轮子有一个不圆，走起来咯噔咯噔。你坐在里面横冲直撞，撞到门槛，撞到水缸，最后卡在院子和堂屋之间的那道坎上。',
      art: 'first_steps', requiresAlive: ['父亲'], cond: AAlive(1, 2, ['父亲']),
      opts: [
        {
          label: '用力往前顶',
          fx: {
            at: { happiness: 2 }, set: { ch_in_e2_armed: true },
            flag: [{ event: 'ch_in_e2', delay: 3 }]
          }
        },
        { label: '哭着等人来搬', fx: { at: { happiness: -1 }, npc: { '父亲': { intimacy: 1 } } } }
      ]
    },
    {
      id: 'ch_in_14', stage: '婴幼儿', ageMin: 1, ageMax: 1,
      type: 'random', tier: 'daily', weight: 1.3,
      title: '抓周',
      text: '周岁那天，堂屋地上铺了一张竹席，摆了算盘、钢笔、馒头、印章和一把小木剑。亲戚围成一圈。你从母亲腿上被放下，坐了一会儿，先抓馒头，又去够那支钢笔。',
      art: 'cradle', requiresAlive: ['母亲'], cond: AAlive(1, 1, ['母亲']),
      opts: [
        { label: '抓住那支钢笔', fx: { at: { happiness: 1 }, tag: '抓周抓了钢笔，亲戚说以后是读书的命' } },
        { label: '把馒头塞进嘴里', fx: { at: { happiness: 2 }, tag: '抓周先抓了馒头' } },
        { label: '抓起印章敲席子', fx: { at: { happiness: 1 }, tag: '抓周抓了印章，敲得咚咚响' } }
      ]
    },
    {
      id: 'ch_in_15', stage: '婴幼儿', ageMin: 1, ageMax: 2,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '第一颗牙',
      text: '下牙床冒出一个白点，过几天变成一颗牙。你见什么都往嘴里塞：木凳的角、母亲的钥匙、地上捡的纽扣。有一天咬住父亲的食指，他哎哟一声抽回去，指头上留了两个小坑。',
      art: 'home', requiresAlive: ['父亲'], cond: AAlive(1, 2, ['父亲']),
      opts: [
        { label: '继续咬别的东西', fx: { at: { happiness: 1 }, npc: { '母亲': { intimacy: 1 } } } },
        { label: '松口看他', fx: { at: { happiness: 1 }, npc: { '父亲': { intimacy: 1 } } } }
      ]
    },
    {
      id: 'ch_in_16', stage: '婴幼儿', ageMin: 1, ageMax: 2,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '水泥地上的青包',
      text: '堂屋是水泥地，扫得很干净。你扶着墙走，走到墙角没扶稳，额头磕在地上，磕出一个青包。母亲用热毛巾敷，毛巾一拿开就哭，敷上去就不哭，来回折腾了半个下午。',
      art: 'home', requiresAlive: ['母亲'], cond: AAlive(1, 2, ['母亲']),
      opts: [
        { label: '躲开毛巾', fx: { at: { happiness: -1 }, npc: { '母亲': { intimacy: 1 } } } },
        { label: '让她敷', fx: { at: { health: 1, happiness: 1 } } }
      ]
    },
    {
      id: 'ch_in_17', stage: '婴幼儿', ageMin: 1, ageMax: 2,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '外婆的铁药盒',
      text: '外婆有一个铁皮药盒，盖子上印着褪色的牡丹。她一开盖，里面的药片哗啦响。你把盒子抱在怀里摇，摇出一样的声音，就笑。有一次盒盖开了，白色药片撒了一炕，你伸手去抓。',
      art: 'home',
      opts: [
        {
          label: '把药片往嘴里送',
          fx: {
            at: { health: -2 },
            set: { ch_in_e3_armed: true }, flag: [{ event: 'ch_in_e3', delay: 3 }]
          }
        },
        { label: '一把一把捡回盒子', fx: { at: { happiness: 1 } } }
      ]
    },
    {
      id: 'ch_in_18', stage: '婴幼儿', ageMin: 1, ageMax: 2,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '屋檐下的煤球垛',
      text: '屋檐下码着一垛煤球，十二个一层，码得整整齐齐。你趁人不注意走过去，伸手按在最上面那个上，手心立刻黑了。母亲过来拎起你的手看，没打，只用围裙给你擦，擦不干净。',
      art: 'home', requiresAlive: ['母亲'], cond: AAlive(1, 2, ['母亲']),
      opts: [
        { label: '把黑手印按在墙上', fx: { at: { happiness: 2 }, tag: '堂屋墙上多了一个小黑手印' } },
        { label: '让她擦干净', fx: { npc: { '母亲': { intimacy: 1 } } } }
      ]
    },
    {
      id: 'ch_in_19', stage: '婴幼儿', ageMin: 1, ageMax: 2,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '小卖部的电话听筒',
      text: '村里只有小卖部有一部电话。父亲在外地打工，一个月打来一次。听筒递到你耳边，里面是他被拉长的声音，问你听不听得见。你对着话筒吸气，呼出来的气又传回耳朵里。',
      art: 'corner_shop', requiresAlive: ['父亲'], cond: AAlive(1, 2, ['父亲']),
      opts: [
        { label: '对着话筒喊', fx: { at: { happiness: 1 }, npc: { '父亲': { intimacy: 2 } } } },
        { label: '把听筒推开', fx: { at: { stress: 1 } } }
      ]
    },
    {
      id: 'ch_in_20', stage: '婴幼儿', ageMin: 1, ageMax: 2,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '堂屋的门槛',
      text: '堂屋的门槛很高，到你膝盖。大人跨过去只要一步，你要先趴下，一条腿翻过去，再拖另一条。裤子在门槛上蹭了一层灰，翻过去以后你坐在地上，回头看了看那道木头。',
      art: 'home',
      opts: [
        { label: '再翻回去', fx: { at: { happiness: 2 }, tag: '一个下午都在翻门槛' } },
        { label: '坐在原地', fx: { at: { happiness: 1 } } }
      ]
    },

    {
      id: 'ch_in_21', stage: '婴幼儿', ageMin: 2, ageMax: 3,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '断了襻的塑料凉鞋',
      text: '夏天你穿一双绿色塑料凉鞋，鞋襻断过一次，父亲用烧红的铁片烫上，留下一道黑疤。下雨天穿它去踩水，鞋底滑，摔在泥里，凉鞋飞出去两米远，你爬过去捡。',
      art: 'home', requiresAlive: ['父亲'], cond: AAlive(2, 3, ['父亲']),
      opts: [
        { label: '捡回来穿上', fx: { at: { happiness: 1 } } },
        { label: '光脚回家', fx: { at: { happiness: 1, health: -1 } } }
      ]
    },
    {
      id: 'ch_in_22', stage: '婴幼儿', ageMin: 2, ageMax: 3,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '井台边的木桶',
      text: '母亲去井台打水，你跟在后头。井绳一圈圈放下去，木桶碰在井壁上咚咚响。她提上来一桶，水面上浮着两片树叶。她舀了一瓢给你洗手，水凉得你把手缩回来。',
      art: 'village_gate', requiresAlive: ['母亲'], cond: AAlive(2, 3, ['母亲']),
      opts: [
        { label: '再伸手玩水', fx: { at: { happiness: 2 } } },
        { label: '躲到她身后', fx: { npc: { '母亲': { intimacy: 1 } } } }
      ]
    },
    {
      id: 'ch_in_23', stage: '婴幼儿', ageMin: 3, ageMax: 3,
      type: 'random', tier: 'daily', weight: 1.2,
      title: '幼儿园报名',
      text: '幼儿园在村小旁边，一间瓦房，门口刷着绿漆。报名那天母亲拿着户口本，老师蹲下来问你叫什么。你躲在她腿后面，只露出半张脸，看见老师眼镜片上有一块白斑。',
      art: 'kindergarten_pickup', requiresAlive: ['母亲'], cond: AAlive(3, 3, ['母亲']),
      opts: [
        {
          label: '说出自己的名字',
          fx: {
            at: { happiness: 1 },
            set: { ch_in_e6_armed: true }, flag: [{ event: 'ch_in_e6', delay: 3 }]
          }
        },
        { label: '一直不说话', fx: { at: { stress: 1 }, npc: { '母亲': { intimacy: 1 } } } }
      ]
    },
    {
      id: 'ch_in_24', stage: '婴幼儿', ageMin: 2, ageMax: 3,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '扣在地上的饭碗',
      text: '你伸手去够桌上的碗，碗翻过来扣在地上，半碗粥糊了一地。母亲过来，先看你有没有烫到，再拿抹布擦。那只碗磕掉一个口，后来一直留在碗柜最下面一格。',
      art: 'home', requiresAlive: ['母亲'], cond: AAlive(2, 3, ['母亲']),
      opts: [
        {
          label: '用手去抓地上的粥',
          fx: {
            at: { happiness: 1 }, npc: { '母亲': { intimacy: 1 } },
            set: { ch_in_e4_armed: true }, flag: [{ event: 'ch_in_e4', delay: 2 }]
          }
        },
        { label: '站在原地哭', fx: { at: { happiness: -1 } } },
        { label: '退到门边看着', fx: { at: { stress: 1 } } }
      ]
    },
    {
      id: 'ch_in_25', stage: '婴幼儿', ageMin: 2, ageMax: 3,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '打雷的下午',
      text: '夏天的雷来得快，天一下黑下来。第一声雷响时，你正站在堂屋中间，扔下手里的东西就往里屋跑，钻进衣柜和墙之间的缝里。母亲找了半天，最后是看见你的鞋尖。',
      art: 'home', requiresAlive: ['母亲'], cond: AAlive(2, 3, ['母亲']),
      opts: [
        { label: '继续躲着不出声', fx: { at: { happiness: -1, stress: 1 } } },
        { label: '让她抱出来', fx: { npc: { '母亲': { intimacy: 2 } }, at: { happiness: 1 } } }
      ]
    },
    {
      id: 'ch_in_26', stage: '婴幼儿', ageMin: 2, ageMax: 3,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '爷爷的枣木拐杖',
      text: '爷爷的拐杖是一截枣木，握手的地方被磨得发亮。他坐在门口晒太阳，拐杖靠在椅边。你拖走它，在地上戳出一排小坑，拖到院子那头，回头看他还坐在原处，冲你招手。',
      art: 'village_gate',
      opts: [
        { label: '把拐杖拖回去', fx: { at: { happiness: 1 }, tag: '把爷爷的拐杖送了回去' } },
        { label: '拖着继续走', fx: { at: { happiness: 2 } } }
      ]
    },
    {
      id: 'ch_in_27', stage: '婴幼儿', ageMin: 2, ageMax: 3,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '院子里的水洼',
      text: '一场雨下到傍晚，院子里积了一个水洼，能照见屋檐。你穿着开裆裤蹲在旁边，先用手指点了一下，水面碎了，屋檐也不见了。等水面平静，你又看见自己，愣了一下。',
      art: 'home',
      opts: [
        { label: '一脚踩进去', fx: { at: { happiness: 2 }, tag: '把水洼踩得只剩泥' } },
        { label: '再点一下水面', fx: { at: { happiness: 1 } } }
      ]
    },
    {
      id: 'ch_in_28', stage: '婴幼儿', ageMin: 3, ageMax: 3,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '照相馆的闪光灯',
      text: '镇上照相馆在供销社二楼，背景是一块画着假山的布。摄影师钻在黑布后面，让你看镜头。母亲蹲在旁边扶着你的肩膀。灯一亮，白得晃眼，你眨了一下眼，照片洗出来是闭着的。',
      art: 'old_photos', requiresAlive: ['母亲'], cond: AAlive(3, 3, ['母亲']),
      opts: [
        { label: '再拍一张', fx: { at: { happiness: 1 }, money: { cash: -8 } } },
        { label: '拿着照片走', fx: { at: { happiness: 1 }, tag: '留下一张闭着眼的照片' } }
      ]
    },
    {
      id: 'ch_in_29', stage: '婴幼儿', ageMin: 3, ageMax: 3,
      type: 'random', tier: 'daily', weight: 1.1,
      title: '幼儿园的第一天',
      text: '第一天上幼儿园，母亲把你送到门口就走。你站在门里，看着她的背影拐过墙角，忽然哭起来。老师把你抱到小椅子上，给了一块水果糖。糖纸是透明的，你捏在手里没拆。',
      art: 'kindergarten_pickup', requiresAlive: ['母亲'], cond: AAlive(3, 3, ['母亲']),
      opts: [
        {
          label: '追出去',
          fx: {
            at: { happiness: -2 }, npc: { '母亲': { intimacy: 2 } },
            set: { ch_in_e5_armed: true }, flag: [{ event: 'ch_in_e5', delay: 3 }]
          }
        },
        { label: '攥着糖坐在椅子上', fx: { at: { happiness: 1 }, tag: '第一天上幼儿园没把糖吃掉' } }
      ]
    },
    {
      id: 'ch_in_30', stage: '婴幼儿', ageMin: 3, ageMax: 3,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '午睡的小木床',
      text: '幼儿园午睡是一排小木床，铺着自家带的褥子。你睡不着，看窗外的杨树叶子翻过来，一片亮一片暗。旁边的小孩已经打呼，老师坐在门口打毛衣，毛线球滚到了床底下。',
      art: 'kindergarten_pickup',
      opts: [
        { label: '爬起来去够毛线球', fx: { at: { happiness: 1 }, tag: '午睡时被老师按回床上' } },
        { label: '闭眼躺着', fx: { at: { happiness: 1 } } }
      ]
    },
    {
      id: 'ch_in_31', stage: '婴幼儿', ageMin: 3, ageMax: 3,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '门框上的身高线',
      text: '堂屋门框上用铅笔画着几道横线，旁边写着日期。母亲让你背靠门框站直，用一本硬壳书压在你头顶，再画一道。你踮了一下脚，她按住你的肩，说别动。',
      art: 'home', requiresAlive: ['母亲'], cond: AAlive(3, 3, ['母亲']),
      opts: [
        { label: '偷偷踮脚', fx: { at: { happiness: 2 }, tag: '身高线上多了一道假的' } },
        { label: '站直不动', fx: { npc: { '母亲': { intimacy: 1 } } } }
      ]
    },
    {
      id: 'ch_in_32', stage: '婴幼儿', ageMin: 3, ageMax: 3,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '打碎的热水瓶',
      text: '桌上的竹壳热水瓶被你碰倒，砰的一声，内胆碎了，银色的碎片撒了一地。母亲先把你抱到门外，再拿扫帚。那天下午她没说话，你站在院子里，听见扫帚刮地的声音。',
      art: 'home', requiresAlive: ['母亲'], cond: AAlive(3, 3, ['母亲']),
      opts: [
        { label: '从门缝往里看', fx: { at: { stress: 1 } } },
        { label: '蹲在院子里等', fx: { at: { happiness: -1 }, npc: { '母亲': { intimacy: 1 } } } }
      ]
    },
    {
      id: 'ch_in_33', stage: '婴幼儿', ageMin: 3, ageMax: 3,
      type: 'random', tier: 'daily', weight: 0.8,
      title: '邻居家的黑白电视',
      text: '隔壁有全村第一台黑白电视，晚上搬到院子里，盖着一块红绒布。十几个人搬凳子来看，屏幕上全是雪花，有人爬上屋顶转天线。你被人抱着，看见屏幕里走出一个穿西装的人。',
      art: 'village_gate',
      opts: [
        { label: '伸手去摸屏幕', fx: { at: { happiness: 2 } } },
        { label: '靠在人肩上睡着', fx: { at: { happiness: 1 } } }
      ]
    },
    {
      id: 'ch_in_34', stage: '婴幼儿', ageMin: 3, ageMax: 3,
      type: 'random', tier: 'daily', weight: 0.8,
      title: '供销社的玻璃柜台',
      text: '供销社的柜台是木头的，很高，你只能看见玻璃下面摆的水果糖和发卡。母亲在另一头扯布，售货员拿尺子在布上量。你踮着脚，把手指按在玻璃上，留下五个印子。',
      art: 'corner_shop', requiresAlive: ['母亲'], cond: AAlive(3, 3, ['母亲']),
      opts: [
        { label: '一直按着玻璃', fx: { at: { happiness: 1 } } },
        { label: '喊母亲过来看', fx: { npc: { '母亲': { intimacy: 1 } } } }
      ]
    },
    {
      id: 'ch_in_35', stage: '婴幼儿', ageMin: 1, ageMax: 3,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '澡盆里的塑料鸭',
      text: '澡盆里放了一只黄色塑料鸭，捏一下会叫。你把它按到水底，松手，它又浮上来，歪着。水面一晃，鸭子转到盆边，你伸手把它拨回中间，再按下去。',
      art: 'home',
      opts: [
        { label: '反复按鸭子', fx: { at: { happiness: 2 } } },
        { label: '把它拿出盆', fx: { at: { happiness: 1 } } }
      ]
    },
    {
      id: 'ch_in_36', stage: '婴幼儿', ageMin: 1, ageMax: 3,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '夜里的咳嗽',
      text: '你半夜咳嗽，咳得停不下来。母亲坐起来，把你扶到她腿上，手掌弓起来拍你的背。她数着拍子，一下一下。窗外天还没亮，屋里有股止咳糖浆的甜味。',
      art: 'home', requiresAlive: ['母亲'], cond: AAlive(1, 3, ['母亲']),
      opts: [
        { label: '靠在她怀里', fx: { npc: { '母亲': { intimacy: 3 } }, at: { health: 1 } } },
        { label: '推开她自己躺', fx: { at: { happiness: -1 }, npc: { '母亲': { intimacy: -1 } } } }
      ]
    },
    {
      id: 'ch_in_37', stage: '婴幼儿', ageMin: 1, ageMax: 3,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '铁丝上晒的被子',
      text: '出太阳的日子，母亲把被子搭在院子里的铁丝上，用木拍子拍，灰尘在光里飞。你钻到被子底下，白布透光，外面的人影走来走去。有人从另一头拍了一下，你叫了一声。',
      art: 'home', requiresAlive: ['母亲'], cond: AAlive(1, 3, ['母亲']),
      opts: [
        { label: '从被子下钻出去', fx: { at: { happiness: 2 } } },
        { label: '继续躲在里面', fx: { at: { happiness: 1 } } }
      ]
    },
    {
      id: 'ch_in_38', stage: '婴幼儿', ageMin: 1, ageMax: 3,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '集市上的气球',
      text: '赶集那天人挤人，父亲把你架在肩上。一个卖气球的推着车过去，红的黄的拴在一根绳上。你伸手去够，够了半天，父亲往前走了，气球越来越小，最后剩一个点。',
      art: 'corner_shop', requiresAlive: ['父亲'], cond: AAlive(1, 3, ['父亲']),
      opts: [
        { label: '一直回头看', fx: { at: { happiness: 1 } } },
        { label: '拍父亲的头顶', fx: { at: { happiness: 1 }, npc: { '父亲': { intimacy: 1 } } } }
      ]
    },
    {
      id: 'ch_in_39', stage: '婴幼儿', ageMin: 1, ageMax: 3,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '自行车的前横梁',
      text: '父亲的二八大杠前面有一根横梁，他把你抱上去坐着，一只手扶车把，一只手护着你。路是土路，车轮碾过石子，颠一下，你的后脑勺就磕在他胸口上。',
      art: 'village_gate', requiresAlive: ['父亲'], cond: AAlive(1, 3, ['父亲']),
      opts: [
        { label: '抓住车把', fx: { at: { happiness: 1 } } },
        { label: '回头看后面的路', fx: { at: { happiness: 2 }, npc: { '父亲': { intimacy: 1 } } } }
      ]
    },
    {
      id: 'ch_in_40', stage: '婴幼儿', ageMin: 1, ageMax: 3,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '停电的晚上',
      text: '晚上突然停电，屋里一片黑。母亲摸出半截蜡烛，点在桌上的酱油瓶盖上。火苗很小，墙上的影子很大。你盯着自己的影子，抬手，影子也抬手，你就一直举着。',
      art: 'home', requiresAlive: ['母亲'], cond: AAlive(1, 3, ['母亲']),
      opts: [
        { label: '一直举手看影子', fx: { at: { happiness: 2 } } },
        { label: '伸手去够蜡烛', fx: { at: { health: -1 }, npc: { '母亲': { intimacy: 1 } } } }
      ]
    },

    /* =====================================================
       婴幼儿事件的跨年回声（4–6 岁，童年阶段）
       ===================================================== */

    {
      id: 'ch_in_e1', stage: '童年', ageMin: 4, ageMax: 4,
      type: 'random', tier: 'echo', weight: 1.0,
      title: '勺柄上的牙印',
      text: '四岁那年，你从碗柜底下翻出一把旧铁勺，勺柄上有两个小牙印。母亲说这是喂你米糊用的，是你小时候咬的。你把勺子含在嘴里试了试，凉的，牙印对不上现在的牙。',
      art: 'home', requiresAlive: ['母亲'],
      cond: (function (base) { return function (g) { return base(g) && !!(g.marks && g.marks.ch_in_e1_armed); }; })(AAlive(4, 4, ['母亲'])),
      opts: [
        { label: '把勺子放回原处', fx: { at: { happiness: 1 }, npc: { '母亲': { intimacy: 1 } } } },
        { label: '拿着它去盛饭', fx: { at: { happiness: 2 }, tag: '四岁开始用小时候的铁勺吃饭' } }
      ]
    },
    {
      id: 'ch_in_e2', stage: '童年', ageMin: 4, ageMax: 4,
      type: 'random', tier: 'echo', weight: 1.0,
      title: '学步车改的煤车',
      text: '仓房里那辆学步车还在，四个轮子掉了一个，父亲把它改成拉煤球的小车，前面拴了一根麻绳。你拉着它在院子里走，咯噔咯噔，跟小时候坐在里面听见的声音一样。',
      art: 'home', requiresAlive: ['父亲'],
      cond: (function (base) { return function (g) { return base(g) && !!(g.marks && g.marks.ch_in_e2_armed); }; })(AAlive(4, 4, ['父亲'])),
      opts: [
        { label: '拉着它在院里转圈', fx: { at: { happiness: 2 } } },
        { label: '解开绳子推着跑', fx: { at: { happiness: 1 }, npc: { '父亲': { favor: -1 } } } }
      ]
    },
    {
      id: 'ch_in_e3', stage: '童年', ageMin: 4, ageMax: 4,
      type: 'random', tier: 'echo', weight: 1.0,
      title: '药盒里的纽扣',
      text: '外婆搬去舅舅家那年，把铁皮药盒留下了。盒子里现在装的是各色纽扣，摇起来还是哗啦响。母亲找扣子的时候会打开它，你在旁边听着，觉得跟小时候听见的一样。',
      art: 'home',
      cond: (function (base) { return function (g) { return base(g) && !!(g.marks && g.marks.ch_in_e3_armed); }; })(A(4, 4)),
      opts: [
        { label: '倒出扣子数', fx: { at: { happiness: 1 }, set: { ch_in_e3_count: true } } },
        { label: '帮母亲找一样的扣子', fx: { at: { happiness: 1 }, npc: { '母亲': { intimacy: 2 } } } }
      ]
    },
    {
      id: 'ch_in_e4', stage: '童年', ageMin: 4, ageMax: 4,
      type: 'random', tier: 'echo', weight: 1.0,
      title: '缺口的碗',
      text: '碗柜最下面那格还放着那只缺口的碗，母亲用它盛咸菜。你端它的时候总要先看一眼那个缺口，怕割到嘴。有一回你把它摔了第二次，缺口变大了，母亲还是没扔。',
      art: 'home', requiresAlive: ['母亲'],
      cond: (function (base) { return function (g) { return base(g) && !!(g.marks && g.marks.ch_in_e4_armed); }; })(AAlive(4, 4, ['母亲'])),
      opts: [
        { label: '用它吃饭', fx: { at: { happiness: 1 } } },
        { label: '换一只好碗', fx: { at: { happiness: 1 }, npc: { '母亲': { favor: -1 } } } }
      ]
    },
    {
      id: 'ch_in_e5', stage: '童年', ageMin: 6, ageMax: 6,
      type: 'random', tier: 'echo', weight: 1.0,
      title: '幼儿园门口的老师',
      text: '上小学的第一天，你路过幼儿园门口，那个戴眼镜的老师正在扫落叶。她抬头看了你一会儿，叫出你的名字，说你长高了。你站在门口，想不起她姓什么，只记得镜片上的白斑。',
      art: 'kindergarten_pickup',
      cond: (function (base) { return function (g) { return base(g) && !!(g.marks && g.marks.ch_in_e5_armed); }; })(A(6, 6)),
      opts: [
        { label: '叫一声老师', fx: { at: { happiness: 2 }, tag: '小学第一天认出了幼儿园的老师' } },
        { label: '低头走开', fx: { at: { happiness: -1 } } }
      ]
    },
    {
      id: 'ch_in_e6', stage: '童年', ageMin: 6, ageMax: 6,
      type: 'random', tier: 'echo', weight: 1.0,
      title: '报名表上的名字',
      text: '母亲收拾抽屉，翻出一张幼儿园报名表，上面有她替你写的名字，笔画歪歪扭扭，还有一枚红色的指印。她说那天你躲在她腿后面，一句话没说。你看着那张纸，不记得有这回事。',
      art: 'old_photos', requiresAlive: ['母亲'],
      cond: (function (base) { return function (g) { return base(g) && !!(g.marks && g.marks.ch_in_e6_armed); }; })(AAlive(6, 6, ['母亲'])),
      opts: [
        { label: '把表收进自己的书包', fx: { at: { happiness: 1 }, set: { ch_in_e6_keep: true } } },
        { label: '让她收起来', fx: { npc: { '母亲': { intimacy: 1 } } } }
      ]
    },

    /* =====================================================
       童年 4–12：能说话、能撒谎、会羞、会觉得不公平
       ===================================================== */

    {
      id: 'ch_kd_01', stage: '童年', ageMin: 4, ageMax: 5,
      type: 'random', tier: 'daily', weight: 1.1,
      title: '写着名字的搪瓷杯',
      text: '幼儿园的杯子是统一的搪瓷杯，杯身上用白漆写着各人的名字。喝水要排队，一人一勺。你的名字被写错一个字，老师用指甲刮掉重写，刮出一道白痕。你喝水时总要看那道痕。',
      art: 'kindergarten_pickup',
      opts: [
        { label: '把有白痕的那边对着嘴', fx: { at: { happiness: 1 } } },
        { label: '跟老师说名字写错了', fx: { at: { happiness: 1 }, tag: '纠正了老师写错的名字' } }
      ]
    },
    {
      id: 'ch_kd_02', stage: '童年', ageMin: 4, ageMax: 5,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '家长会上被念到名字',
      text: '幼儿园开家长会，母亲从厂里请了半天假，穿了一件洗得发白的蓝外套。老师念到你的名字，说你午睡不老实。母亲回来没说什么，只在你书包里塞了一个煮鸡蛋。',
      art: 'kindergarten_pickup', requiresAlive: ['母亲'], cond: AAlive(4, 5, ['母亲']),
      opts: [
        { label: '把鸡蛋分她一半', fx: { at: { happiness: 1 }, npc: { '母亲': { intimacy: 2 } } } },
        { label: '自己偷偷吃掉', fx: { at: { happiness: 2 }, npc: { '母亲': { intimacy: -1 } } } }
      ]
    },
    {
      id: 'ch_kd_03', stage: '童年', ageMin: 4, ageMax: 5,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '分到里屋的小床',
      text: '你被分到里屋一张小床上，床靠着墙，墙那边是灶房。第一晚你睡不着，门缝底下透进来一条光。你数着外面的脚步声，数到第三趟，光灭了，屋里全黑。',
      art: 'home',
      opts: [
        { label: '抱着枕头跑回大床', fx: { at: { happiness: 1, stress: -1 } } },
        { label: '睁着眼等天亮', fx: { at: { health: -1, stress: 1 } } }
      ]
    },
    {
      id: 'ch_kd_04', stage: '童年', ageMin: 4, ageMax: 5,
      type: 'random', tier: 'daily', weight: 1.1,
      title: '沙堆里的塑料枪',
      text: '村口修路堆了一堆沙，你和小胖在沙里挖出一把塑料手枪，枪管断了半截。小胖说是他先看见的，你说是你先摸到的。两个人蹲在沙堆上吵，谁也不肯松手。',
      art: 'playground',
      opts: [
        { label: '松手给他', fx: { at: { happiness: -2 }, tag: '把塑料枪让给了小胖' } },
        { label: '攥着不放', fx: { at: { happiness: 1 }, tag: '为一把断枪和邻居家孩子打了一架' } },
        { label: '提议一人玩一天', fx: { at: { happiness: 1 }, tag: '和邻居家孩子轮流玩那把断枪' } }
      ]
    },
    {
      id: 'ch_kd_05', stage: '童年', ageMin: 4, ageMax: 5,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '自行车的气门芯',
      text: '你把父亲的自行车气门芯拔下来，藏在裤兜里。第二天他推车出门，轮胎是瘪的，蹲下来找了半天。晚上他从你裤兜里摸出那截黑胶管，抬手在你屁股上打了两下。',
      art: 'home', requiresAlive: ['父亲'], cond: AAlive(4, 5, ['父亲']),
      opts: [
        { label: '憋着不哭', fx: { at: { happiness: -2, stress: 1 }, npc: { '父亲': { favor: -1 } } } },
        { label: '哭着认错', fx: { at: { happiness: -1 }, npc: { '父亲': { intimacy: 1 } } } }
      ]
    },
    {
      id: 'ch_kd_06', stage: '童年', ageMin: 4, ageMax: 5,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '菜里的肥肉',
      text: '午饭是白菜炖粉条，菜里漂着几片肥肉。你不吃肥肉，把肉片挑到旁边小孩碗里。他吃了，被老师看见，老师让你站到墙边，看着大家把饭吃完。',
      art: 'kindergarten_pickup',
      opts: [
        { label: '站到墙边', fx: { at: { happiness: -2, stress: 1 } } },
        { label: '说自己不是故意的', fx: { at: { happiness: -1 }, tag: '因为挑食被老师罚站' } },
        { label: '把肉夹回来吃掉', fx: { at: { health: 1, happiness: -1 } } }
      ]
    },
    {
      id: 'ch_kd_07', stage: '童年', ageMin: 4, ageMax: 5,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '集市上松开的手',
      text: '赶集那天你松开了母亲的手，去看一个捏面人的摊子。回头的时候，满街都是腿。你在人腿中间挤来挤去，走到一个卖老鼠药的摊子前站住，摊主问你家在哪，你说不上来。',
      art: 'corner_shop', requiresAlive: ['母亲'], cond: AAlive(4, 5, ['母亲']),
      opts: [
        { label: '站在原地哭', fx: { at: { happiness: -2, stress: 1 } } },
        { label: '顺着原路往回走', fx: { at: { happiness: -1 }, tag: '在集市上走丢过一次' } }
      ]
    },
    {
      id: 'ch_kd_08', stage: '童年', ageMin: 4, ageMax: 5,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '旧报纸上的名字',
      text: '母亲教你写自己的名字，用铅笔在旧报纸的空白处写了一遍，让你照着描。你的横写得像一根扁担，竖总是歪的。写满一张报纸，只有最上面那个字有几分像。',
      art: 'home', requiresAlive: ['母亲'], cond: AAlive(4, 5, ['母亲']),
      opts: [
        { label: '继续描', fx: { at: { happiness: 1, stress: 1 } } },
        { label: '把报纸翻过去重新写', fx: { at: { happiness: 1 } } }
      ]
    },
    {
      id: 'ch_kd_09', stage: '童年', ageMin: 4, ageMax: 6,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '衣柜的影子',
      text: '晚上屋里只点一盏十五瓦的灯泡，灯一关，衣柜像一个站着的人。你把被子拉到下巴，盯着那个影子。听见外面有猫叫，影子好像动了一下。',
      art: 'home',
      opts: [
        { label: '喊母亲开灯', fx: { at: { happiness: 1 }, npc: { '母亲': { intimacy: 1 } } } },
        { label: '把被子蒙过头顶', fx: { at: { stress: 1 } } }
      ]
    },
    {
      id: 'ch_kd_10', stage: '童年', ageMin: 4, ageMax: 7,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '枕头下的压岁钱',
      text: '过年的时候，亲戚给的压岁钱都被母亲收走，说替你存着。你只留下两张一角的，塞在枕头底下，每天晚上摸一遍。有一天发现少了一张，你没敢问是谁拿的。',
      art: 'home', requiresAlive: ['母亲'], cond: AAlive(4, 7, ['母亲']),
      opts: [
        { label: '问母亲', fx: { at: { happiness: -1 }, npc: { '母亲': { intimacy: 1 } } } },
        { label: '把剩下那张换个地方藏', fx: { at: { happiness: 1 } } }
      ]
    },
    {
      id: 'ch_kd_11', stage: '童年', ageMin: 4, ageMax: 6,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '河里的钥匙',
      text: '母亲给你一把家门钥匙，用红绳穿起来挂在脖子上。你在河边玩，弯腰去捞一条小鱼，钥匙从领口滑出去，掉进水里。你在浅水里摸了半天，只摸到一块碎瓦。',
      art: 'village_gate', requiresAlive: ['母亲'], cond: AAlive(4, 6, ['母亲']),
      opts: [
        { label: '回家直说', fx: { at: { happiness: -1 }, npc: { '母亲': { intimacy: 1 } } } },
        { label: '说钥匙被人抢走了', fx: { at: { stress: 1 }, set: { ch_kd_11_lie: true } } }
      ]
    },
    {
      id: 'ch_kd_12', stage: '童年', ageMin: 4, ageMax: 6,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '打针时母亲在队伍外',
      text: '学校组织打预防针，队伍排在医务室门口。前面的小孩哭，你回头看了一眼母亲，她站在队伍外面，冲你点头。轮到你的时候，你把袖子撸上去，胳膊绷得紧紧的。',
      art: 'vaccine', requiresAlive: ['母亲'], cond: AAlive(4, 6, ['母亲']),
      opts: [
        { label: '咬着牙不哭', fx: { at: { happiness: 1 }, npc: { '母亲': { intimacy: 2 } } } },
        { label: '打完扑到她怀里', fx: { at: { happiness: 2 }, npc: { '母亲': { intimacy: 2 } } } }
      ]
    },
    {
      id: 'ch_kd_13', stage: '童年', ageMin: 4, ageMax: 6,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '木盆里的搓泥',
      text: '冬天洗澡要烧一大锅水，倒进木盆里，屋里生一个炭盆。母亲先用手试水，再把你按进盆里，搓你的后颈。搓下来的泥卷成小条，她拿给你看，你伸手去捏。',
      art: 'home', requiresAlive: ['母亲'], cond: AAlive(4, 6, ['母亲']),
      opts: [
        { label: '捏那条泥', fx: { at: { happiness: 2 } } },
        { label: '躲开她的手', fx: { at: { happiness: 1 } } }
      ]
    },
    {
      id: 'ch_kd_14', stage: '童年', ageMin: 6, ageMax: 7,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '猫背的锅',
      text: '你打碎了窗台上的一个玻璃罐，里面的糖撒了一地。母亲问是谁弄的，你说猫跳上来撞的。她看了看窗户，又看了看你，没有再问。晚上你听见她在灶房里扫碎玻璃。',
      art: 'home', requiresAlive: ['母亲'], cond: AAlive(6, 7, ['母亲']),
      opts: [
        {
          label: '走过去承认是自己打碎的',
          fx: {
            at: { happiness: -1 }, npc: { '母亲': { intimacy: 2 } },
            set: { ch_kd_e3_armed: true }, flag: [{ event: 'ch_kd_e3', delay: 3 }]
          }
        },
        { label: '咬定是猫', fx: { at: { happiness: -1, stress: 1 }, npc: { '母亲': { favor: -1 } } } }
      ]
    },

    {
      id: 'ch_kd_15', stage: '童年', ageMin: 6, ageMax: 6,
      type: 'random', tier: 'daily', weight: 1.3,
      title: '一年级报名',
      text: '一年级报名要面试，老师让你数到二十，再写自己的名字。你数到十四的时候卡住了，手指在桌子上点了几下，接着数下去。老师在纸上画了一个勾。',
      art: 'classroom',
      opts: [
        { label: '从头再数一遍', fx: { at: { stress: 1, happiness: 1 } } },
        { label: '站在那儿等老师说话', fx: { at: { happiness: 1 } } }
      ]
    },
    {
      id: 'ch_kd_16', stage: '童年', ageMin: 6, ageMax: 7,
      type: 'random', tier: 'daily', weight: 1.1,
      title: '系得太紧的红领巾',
      text: '入队那天，高年级的学生给你系红领巾，系得太紧，勒着脖子。你不敢解，一直到放学才松开。回家路上，你把红领巾叠成一条，放进书包最里面那层。',
      art: 'classroom',
      opts: [
        { label: '一路攥在手里', fx: { at: { happiness: 1 } } },
        { label: '进门前重新系上', fx: { at: { happiness: 2 }, tag: '入队那天一整天没解红领巾' } }
      ]
    },
    {
      id: 'ch_kd_17', stage: '童年', ageMin: 6, ageMax: 7,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '合不严的铅笔盒',
      text: '铅笔盒是铁皮的，盖子上印着两只熊猫。你把它摔在地上，盖子合不严了，每次打开都要用指甲抠。同桌笑你的盒子，你把盒子塞进抽屉，不再拿出来。',
      art: 'classroom',
      opts: [
        { label: '用橡皮筋绑住', fx: { at: { happiness: 1 }, tag: '铅笔盒用橡皮筋绑了一学期' } },
        { label: '继续用，随它响', fx: { at: { happiness: 1, stress: 1 } } }
      ]
    },
    {
      id: 'ch_kd_18', stage: '童年', ageMin: 6, ageMax: 7,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '拼音本上的六个红叉',
      text: '拼音本发下来，b 和 d 你写反了六个，老师用红笔打了六个叉。你数了三遍，还是六个。放学的时候你把本子卷起来，塞进袖子，怕被路上的人看见。',
      art: 'classroom',
      opts: [
        { label: '回家让母亲看', fx: { at: { happiness: -1 }, npc: { '母亲': { intimacy: 1 } } } },
        { label: '藏在床底下', fx: { at: { stress: 1 }, set: { ch_kd_18_hide: true } } }
      ]
    },
    {
      id: 'ch_kd_19', stage: '童年', ageMin: 6, ageMax: 7,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '踩在凳子上擦黑板',
      text: '轮到你值日，扫完地要擦黑板。黑板太高，你踩在凳子上，抹布拧不干，水顺着胳膊流到袖子里。擦到一半，粉笔灰落进眼睛，你从凳子上下来，蹲在地上揉。',
      art: 'classroom',
      opts: [
        { label: '揉完再上去擦', fx: { at: { health: -1, happiness: 1 } } },
        { label: '等同学来帮忙', fx: { at: { happiness: 1 } } }
      ]
    },
    {
      id: 'ch_kd_20', stage: '童年', ageMin: 7, ageMax: 7,
      type: 'random', tier: 'daily', weight: 1.1,
      title: '水果味的橡皮',
      text: '同桌有一块水果味的橡皮，粉红色，闻起来像糖。你借过来用，用着用着就放进了自己的铅笔盒。放学时他翻遍书包，你站在旁边，手插在兜里。',
      art: 'classroom', cond: AWith(7, 7, '同学'),
      opts: [
        {
          label: '还给他，说是忘了',
          fx: {
            at: { happiness: -1 }, npc: { '同学': { favor: 1 } },
            set: { ch_kd_e12_armed: true }, flag: [{ event: 'ch_kd_e12', delay: 3 }]
          }
        },
        { label: '一直没吭声', fx: { at: { happiness: 1, stress: 1 }, npc: { '同学': { favor: -2 } } } },
        { label: '偷偷放回他的抽屉', fx: { at: { happiness: 1 }, npc: { '同学': { favor: 1 } } } }
      ]
    },
    {
      id: 'ch_kd_21', stage: '童年', ageMin: 6, ageMax: 7,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '七十三分的卷子',
      text: '考了七十三分，卷子要家长签字。父亲在灯下看了一遍，没说话，从口袋里摸出一支圆珠笔，在分数旁边写下自己的名字，字很大，压住了半个红叉。',
      art: 'exam', requiresAlive: ['父亲'], cond: AAlive(6, 7, ['父亲']),
      opts: [
        { label: '说下次考好', fx: { at: { stress: 1 }, npc: { '父亲': { intimacy: 1 } } } },
        { label: '把卷子收好，不让他看第二遍', fx: { at: { happiness: -1 }, npc: { '父亲': { favor: -1 } } } }
      ]
    },
    {
      id: 'ch_kd_22', stage: '童年', ageMin: 7, ageMax: 7,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '鸡窝旁的红领巾',
      text: '周一早上找不到红领巾，你把家里翻了一遍，最后在鸡窝旁边的草里看见一角红布。它被鸡踩过，沾了泥。你把它在水缸里涮了涮，湿着系在脖子上去了学校。',
      art: 'home',
      opts: [
        {
          label: '湿着系上',
          fx: {
            at: { happiness: -1 }, set: { ch_kd_e6_armed: true },
            flag: [{ event: 'ch_kd_e6', delay: 3 }]
          }
        },
        { label: '说红领巾忘在家里了', fx: { at: { stress: 1 } } }
      ]
    },
    {
      id: 'ch_kd_23', stage: '童年', ageMin: 7, ageMax: 8,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '公园里的两个鸡蛋',
      text: '春游去县城公园，每人交五块钱。母亲给你煮了两个鸡蛋，装在一个塑料袋里。到了公园，别的小孩买冰棍，你蹲在树底下剥鸡蛋，蛋壳落在草地上，被风吹走。',
      art: 'playground', requiresAlive: ['母亲'], cond: AAlive(7, 8, ['母亲']),
      opts: [
        { label: '用五块钱买冰棍', fx: { at: { happiness: 2 }, money: { cash: -5 } } },
        { label: '把鸡蛋吃完', fx: { at: { health: 1, happiness: 1 } } }
      ]
    },
    {
      id: 'ch_kd_24', stage: '童年', ageMin: 7, ageMax: 8,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '黑板报的花边',
      text: '教室后面的黑板报要换新，老师让你画花边。你用彩色粉笔画了一排歪歪扭扭的花，画到一半，粉笔断了。老师说没关系，接着画。你换了一截短粉笔，手指头都染了色。',
      art: 'classroom',
      opts: [
        { label: '接着画完', fx: { at: { happiness: 1, stress: 1 } } },
        { label: '让画得好的同学来画', fx: { at: { happiness: -1 }, tag: '黑板报画到一半让给了别人' } }
      ]
    },
    {
      id: 'ch_kd_25', stage: '童年', ageMin: 7, ageMax: 7,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '纸盒里的麻雀',
      text: '你在麦场上捡到一只麻雀，翅膀上有一道血口子。你把它放在纸盒里，喂米粒和水，养了三天。第四天早上，盒子空了，窗台上有一根羽毛。',
      art: 'home',
      opts: [
        {
          label: '把羽毛夹进课本',
          fx: {
            at: { happiness: 1 }, set: { ch_kd_e15_armed: true },
            flag: [{ event: 'ch_kd_e15', delay: 3 }]
          }
        },
        { label: '把纸盒收起来', fx: { at: { happiness: -1 } } }
      ]
    },
    {
      id: 'ch_kd_26', stage: '童年', ageMin: 7, ageMax: 8,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '少了一页的连环画',
      text: '你有一本《三国演义》连环画，书角卷了。同学借去看，还回来的时候少了一页，正是你最想看的那页。他说本来就没有，你翻了翻，没再说什么。',
      art: 'classroom',
      opts: [
        { label: '跟他要个说法', fx: { at: { happiness: -1, stress: 1 } } },
        { label: '自己把那页补抄上', fx: { at: { happiness: 1 }, tag: '把连环画缺的那页抄在了背面' } }
      ]
    },
    {
      id: 'ch_kd_27', stage: '童年', ageMin: 8, ageMax: 8,
      type: 'random', tier: 'daily', weight: 1.2,
      title: '水沟边捡到的五块钱',
      text: '放学路上你在水沟边捡到五块钱，纸是湿的。你在原地站了一会儿，路上没有别人。五块钱可以买十根冰棍，也可以交给老师，或者塞回原来的地方。',
      art: 'village_gate',
      opts: [
        {
          label: '交给老师',
          fx: {
            at: { happiness: -1 }, tag: '捡到五块钱交给了老师',
            set: { ch_kd_e1_armed: true }, flag: [{ event: 'ch_kd_e1', delay: 3 }]
          }
        },
        { label: '拿去小卖部买零食', fx: { at: { happiness: 3, health: -1 }, tag: '捡到的五块钱买了辣条和冰棍' } },
        { label: '塞回水沟边的石头下', fx: { at: { happiness: -1, stress: 1 }, tag: '把捡到的五块钱塞回了石头底下' } }
      ]
    },

    {
      id: 'ch_kd_28', stage: '童年', ageMin: 8, ageMax: 9,
      type: 'random', tier: 'daily', weight: 1.1,
      title: '后窗的玻璃',
      text: '同桌把教室后窗的玻璃用弹弓打碎了，班主任拿着一截皮带站在讲台上问是谁。全班没声音。你举起手，说是你。皮带抽在手心，烫。同桌低着头，在本子角上画了一只鸟，推到你桌上。',
      art: 'classroom', cond: AWith(8, 9, '同学'),
      opts: [
        {
          label: '一直没说是他',
          fx: {
            at: { happiness: -1, stress: 1 }, npc: { '同学': { favor: 2 } },
            set: { ch_kd_e2_armed: true }, flag: [{ event: 'ch_kd_e2', delay: 3 }]
          }
        },
        {
          label: '放学让他替你值日',
          fx: {
            at: { happiness: 1 }, npc: { '同学': { favor: -1 } },
            set: { ch_kd_e2_armed: true }, flag: [{ event: 'ch_kd_e2', delay: 3 }]
          }
        },
        {
          label: '把那只鸟用橡皮擦掉',
          fx: {
            at: { happiness: -1 }, tag: '替同桌背了玻璃的锅，把画擦掉了',
            set: { ch_kd_e2_armed: true }, flag: [{ event: 'ch_kd_e2', delay: 3 }]
          }
        }
      ]
    },
    {
      id: 'ch_kd_29', stage: '童年', ageMin: 8, ageMax: 9,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '六十一分',
      text: '期末成绩单发下来，数学六十一分。老师让家长签字。父亲不识字，让你念给他听，你念成了八十一。他点点头，用拇指蘸了印泥，在格子里按了个手印，按得有点歪。',
      art: 'exam', requiresAlive: ['父亲'], cond: AAlive(8, 9, ['父亲']),
      opts: [
        {
          label: '把卷子压在书包最底下',
          fx: {
            at: { happiness: -1, stress: 2 }, tag: '把六十一分念成了八十一',
            set: { ch_kd_e9_armed: true }, flag: [{ event: 'ch_kd_e9', delay: 3 }]
          }
        },
        {
          label: '第二天跟老师说实话',
          fx: {
            at: { happiness: -1, stress: -1 }, npc: { '父亲': { favor: 1 } },
            set: { ch_kd_e9_armed: true }, flag: [{ event: 'ch_kd_e9', delay: 3 }]
          }
        }
      ]
    },
    {
      id: 'ch_kd_30', stage: '童年', ageMin: 8, ageMax: 9,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '早自习的本子',
      text: '数学作业没写完，早自习你借前排女生的本子抄。她写得工整，每一步都有小标题。你抄到第三题，老师从后门进来，站在你背后，看你把最后一个等号画完，什么也没说，走开了。',
      art: 'classroom',
      opts: [
        { label: '把本子合上，装作在看自己的', fx: { at: { stress: 1 } } },
        { label: '接着把剩下的抄完', fx: { at: { happiness: 1, stress: 1 }, tag: '早自习抄完了整份作业' } },
        { label: '下课后去办公室认了', fx: { at: { happiness: -1, stress: -1 } } }
      ]
    },
    {
      id: 'ch_kd_31', stage: '童年', ageMin: 8, ageMax: 9,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '王家的窗户',
      text: '踢毽子踢到了隔壁王家的窗户上，玻璃裂了一道缝，没全碎。王婶从屋里出来，你跑了，跑到巷子尽头才停下，胸口撞得疼。晚饭时听见她在门口跟母亲说话，声音不高。',
      art: 'village_gate',
      opts: [
        {
          label: '第二天去认了',
          fx: {
            at: { happiness: -1, stress: -1 }, tag: '打碎王家玻璃第二天去认了',
            set: { ch_kd_e5_armed: true }, flag: [{ event: 'ch_kd_e5', delay: 3 }]
          }
        },
        {
          label: '一直没认',
          fx: {
            at: { stress: 2 }, tag: '打碎王家玻璃一直没认',
            set: { ch_kd_e5_armed: true }, flag: [{ event: 'ch_kd_e5', delay: 3 }]
          }
        },
        {
          label: '从家里拿钱塞进她家门缝',
          fx: {
            at: { happiness: 1, stress: 1 }, money: { cash: -5 },
            set: { ch_kd_e5_armed: true }, flag: [{ event: 'ch_kd_e5', delay: 3 }]
          }
        }
      ]
    },
    {
      id: 'ch_kd_32', stage: '童年', ageMin: 8, ageMax: 9,
      type: 'random', tier: 'daily', weight: 1.1,
      title: '讲台边上的三分钟',
      text: '班里的钢笔不见了，老师说昨天最后走的是你。你站在讲台边上，手贴着裤缝，说不是你。没人说话。后来钢笔在讲桌抽屉的缝里找到了，老师说了句下回注意，就让大家翻书。',
      art: 'classroom',
      opts: [
        {
          label: '回座位，一句话没说',
          fx: {
            at: { stress: 2 }, tag: '钢笔丢了被当成拿的人',
            set: { ch_kd_e7_armed: true }, flag: [{ event: 'ch_kd_e7', delay: 3 }]
          }
        },
        {
          label: '当着全班说自己被冤枉了',
          fx: {
            at: { happiness: -1, stress: 1 },
            set: { ch_kd_e7_armed: true }, flag: [{ event: 'ch_kd_e7', delay: 3 }]
          }
        },
        {
          label: '下课后一个人去了厕所',
          fx: {
            at: { happiness: -1 }, tag: '被冤枉后一节课没抬头',
            set: { ch_kd_e7_armed: true }, flag: [{ event: 'ch_kd_e7', delay: 3 }]
          }
        }
      ]
    },
    {
      id: 'ch_kd_33', stage: '童年', ageMin: 8, ageMax: 9,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '口音',
      text: '班里转来一个外地的男生，说话带口音，被安排在你旁边。他的铅笔盒是铁的，印着变形金刚。有人学他说话，他把铅笔盒合上，声音很响，然后趴下去，一节课没抬头。',
      art: 'classroom',
      opts: [
        { label: '把自己的橡皮掰一半给他', fx: { at: { happiness: 1 }, npc: { '同学': { favor: 1 } } } },
        { label: '跟着笑了两声', fx: { at: { happiness: 1, stress: 1 }, npc: { '同学': { favor: -1 } } } },
        { label: '什么也没做', fx: { at: { happiness: -1 } } }
      ]
    },
    {
      id: 'ch_kd_34', stage: '童年', ageMin: 8, ageMax: 9,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '白胶布缠的镜腿',
      text: '班主任的眼镜断了一条腿，用白胶布缠着。上课时她低头看书，眼镜往下滑，她就用食指往上推一下。你数着，一节课推了十几次，数到第十一次忘了，又从头数。',
      art: 'classroom',
      opts: [
        { label: '下课后告诉她镜腿的事', fx: { at: { happiness: 1, stress: 1 } } },
        { label: '继续数，数到下节课', fx: { at: { happiness: 1 } } }
      ]
    },
    {
      id: 'ch_kd_35', stage: '童年', ageMin: 8, ageMax: 9,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '柜子顶上的铁盒',
      text: '母亲把零钱放在柜子顶上的铁盒里。你搬了凳子，够到，抽了一张两块的。铁盒盖回去的时候响了一声。那两天你没敢看她的眼睛，她也没提，只是数钱的时候多看了铁盒一眼。',
      art: 'home', requiresAlive: ['母亲'], cond: AAlive(8, 9, ['母亲']),
      opts: [
        {
          label: '把钱花掉',
          fx: {
            at: { happiness: 2, stress: 2 }, money: { cash: 2 },
            set: { ch_kd_e4_armed: true }, flag: [{ event: 'ch_kd_e4', delay: 3 }]
          }
        },
        {
          label: '晚上偷偷放回去',
          fx: {
            at: { happiness: -1, stress: -1 },
            set: { ch_kd_e4_armed: true }, flag: [{ event: 'ch_kd_e4', delay: 3 }]
          }
        },
        {
          label: '直接跟母亲说拿了',
          fx: {
            at: { happiness: 1 }, npc: { '母亲': { intimacy: 1 } },
            set: { ch_kd_e4_armed: true }, flag: [{ event: 'ch_kd_e4', delay: 3 }]
          }
        }
      ]
    },
    {
      id: 'ch_kd_36', stage: '童年', ageMin: 8, ageMax: 8,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '瘪进去的盒盖',
      text: '同桌的铅笔盒掉在地上，你一脚踩上去，铁盒瘪了一块，盒盖合不严了。他说没事，可一整天都在用手指去掰那块瘪进去的地方，掰不回来。放学他把它装进书包，没再看你。',
      art: 'classroom', cond: AWith(8, 8, '同学'),
      opts: [
        {
          label: '回家要钱赔他一个新的',
          fx: {
            at: { happiness: -1 }, money: { cash: -3 }, npc: { '同学': { favor: 1 } },
            set: { ch_kd_e10_armed: true }, flag: [{ event: 'ch_kd_e10', delay: 3 }]
          }
        },
        {
          label: '把自己的换给他',
          fx: {
            at: { happiness: 1 }, npc: { '同学': { favor: 2 } },
            set: { ch_kd_e10_armed: true }, flag: [{ event: 'ch_kd_e10', delay: 3 }]
          }
        },
        {
          label: '当没发生过',
          fx: {
            at: { happiness: -1, stress: 1 }, npc: { '同学': { favor: -1 } },
            set: { ch_kd_e10_armed: true }, flag: [{ event: 'ch_kd_e10', delay: 3 }]
          }
        }
      ]
    },
    {
      id: 'ch_kd_37', stage: '童年', ageMin: 8, ageMax: 9,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '念名字的时候',
      text: '期中考试你考了全班第一。老师在讲台上念名字，念到你的时候声音高了一点。你上去领卷子，回来的路上脚有点飘。到家把卷子铺在桌上，母亲在灶前烧火，回头看了一眼，说锅里还有半个红薯。',
      art: 'exam',
      opts: [
        { label: '把卷子贴在墙上', fx: { at: { happiness: 2 } } },
        { label: '折起来放进抽屉', fx: { at: { happiness: 1 } } },
        { label: '拿去给父亲看', fx: { at: { happiness: 1 }, npc: { '父亲': { favor: 1 } } } }
      ]
    },
    {
      id: 'ch_kd_38', stage: '童年', ageMin: 8, ageMax: 9,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '村东头的黄狗',
      text: '放学路上你被村东头的黄狗咬了小腿，裤腿撕开一道口子，牙印里有血珠。你一路哭着回家，母亲拿肥皂水给你洗，洗了很久。那狗站在自家门口摇尾巴，主人说它不咬人。',
      art: 'village_gate', requiresAlive: ['母亲'], cond: AAlive(8, 9, ['母亲']),
      opts: [
        { label: '再也不走那条路', fx: { at: { happiness: -1 } } },
        { label: '第二天拿石头去砸他家院门', fx: { at: { happiness: 1, stress: 2 }, tag: '被狗咬后去砸了人家的院门' } },
        { label: '缠着母亲去打针', fx: { at: { health: 1, stress: 1 }, money: { cash: -8 } } }
      ]
    },
    {
      id: 'ch_kd_39', stage: '童年', ageMin: 10, ageMax: 10,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '柳条抽在后背',
      text: '你和发小去河里摸鱼，回来晚了。他爹拿着柳条在门口等。他说是他拉你去的，柳条抽在他后背上，一道一道。你站在旁边，手里还提着装鱼的塑料袋，鱼在里面跳。',
      art: 'village_gate', cond: AWith(10, 10, '发小'),
      opts: [
        {
          label: '把鱼分他一半',
          fx: {
            at: { happiness: 1 }, npc: { '发小': { favor: 2 } },
            set: { ch_kd_e11_armed: true }, flag: [{ event: 'ch_kd_e11', delay: 2 }]
          }
        },
        {
          label: '当场说是自己要去的',
          fx: {
            at: { happiness: -1, stress: 1 }, npc: { '发小': { favor: 1 } },
            set: { ch_kd_e11_armed: true }, flag: [{ event: 'ch_kd_e11', delay: 2 }]
          }
        },
        {
          label: '提着鱼先回家',
          fx: {
            at: { happiness: 1, stress: 1 }, npc: { '发小': { favor: -1 } },
            set: { ch_kd_e11_armed: true }, flag: [{ event: 'ch_kd_e11', delay: 2 }]
          }
        }
      ]
    },

    {
      id: 'ch_kd_40', stage: '童年', ageMin: 10, ageMax: 11,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '半块橡皮',
      text: '你的同桌是个女生，扎马尾，写字的时候会把舌头抿在嘴角。你把自己的橡皮切成两半给她，她说了声谢谢就收进文具盒。放学你跟在她后面走了半条街，她拐进胡同，你才转身回家。',
      art: 'classroom', cond: AWith(10, 11, '同学'),
      opts: [
        {
          label: '把这事写进日记本',
          fx: {
            at: { happiness: 1, stress: 1 }, npc: { '同学': { favor: 1 } },
            set: { ch_kd_e8_armed: true }, flag: [{ event: 'ch_kd_e8', delay: 1 }]
          }
        },
        {
          label: '第二天装作什么都没发生',
          fx: {
            at: { happiness: -1 }, npc: { '同学': { favor: 1 } },
            set: { ch_kd_e8_armed: true }, flag: [{ event: 'ch_kd_e8', delay: 1 }]
          }
        },
        {
          label: '让发小替你去说',
          fx: {
            at: { happiness: 1, stress: 2 }, npc: { '同学': { favor: -1 } },
            set: { ch_kd_e8_armed: true }, flag: [{ event: 'ch_kd_e8', delay: 1 }]
          }
        }
      ]
    },
    {
      id: 'ch_kd_41', stage: '童年', ageMin: 10, ageMax: 10,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '墙根底下',
      text: '课间你跟隔壁班的男生打了一架，因为他把你桌上的书扫到了地上。你抓着他的领子，他抓你的头发，两个人滚在墙根。老师来了才松手。你的门牙松了一颗，他的嘴角破了。',
      art: 'playground',
      opts: [
        {
          label: '回家说是自己摔的',
          fx: {
            at: { happiness: -1, stress: 1 }, tag: '打完架回家说是自己摔的',
            set: { ch_kd_e20_armed: true }, flag: [{ event: 'ch_kd_e20', delay: 2 }]
          }
        },
        {
          label: '跟老师说是他先动手',
          fx: {
            at: { stress: 1 }, tag: '打完架在办公室说了三遍是他先动手',
            set: { ch_kd_e20_armed: true }, flag: [{ event: 'ch_kd_e20', delay: 2 }]
          }
        },
        {
          label: '什么也不说',
          fx: {
            at: { happiness: -1 },
            set: { ch_kd_e20_armed: true }, flag: [{ event: 'ch_kd_e20', delay: 2 }]
          }
        }
      ]
    },
    {
      id: 'ch_kd_42', stage: '童年', ageMin: 11, ageMax: 12,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '玻璃门上的蓝纸',
      text: '镇上开了第一家网吧，一块五一小时。你和两个同学在门口站着，玻璃门上贴着蓝纸，里面的人在打游戏，屏幕上的人一直在跑。老板出来赶人，说未成年人不让进。你们走到街对面，又站了一会儿。',
      art: 'corner_shop',
      opts: [
        { label: '说等长大了再来', fx: { at: { happiness: 1 } } },
        { label: '回家', fx: { at: { happiness: -1 } } },
        { label: '跟老板磨了半天', fx: { at: { happiness: 1, stress: 2 }, tag: '在网吧门口跟老板磨了半天' } }
      ]
    },
    {
      id: 'ch_kd_43', stage: '童年', ageMin: 10, ageMax: 11,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '举到一半的手',
      text: '班里选班长，老师让举手。你想选第二排那个男生，因为上周他替你捡过掉在地上的饭盒。可你看见有几个人举了另一个女生的名字，你的手举到一半，放在了桌上。',
      art: 'classroom',
      opts: [
        { label: '把手举完', fx: { at: { happiness: 1, stress: 1 } } },
        { label: '就那么放下', fx: { at: { happiness: -1 } } }
      ]
    },
    {
      id: 'ch_kd_44', stage: '童年', ageMin: 10, ageMax: 12,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '八百米',
      text: '学校开运动会，你报了八百米。跑到第二圈腿就软了，喉咙里有铁锈味。跑道边上的同学在喊你的名字，你听不真切。最后半圈你是走过去的，裁判没吹哨，记了个倒数第一。',
      art: 'playground',
      opts: [
        { label: '第二天照常去上学', fx: { at: { happiness: 1 } } },
        { label: '跟人说是鞋不合脚', fx: { at: { happiness: 1, stress: 1 } } },
        { label: '下一年还报八百米', fx: { at: { happiness: 2, health: 1 }, tag: '跑过倒数第一，第二年还报八百米' } }
      ]
    },
    {
      id: 'ch_kd_45', stage: '童年', ageMin: 10, ageMax: 12,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '花露水的味道',
      text: '表姐来家里住了半个月，睡在你旁边。她带了一瓶花露水，晚上抹在胳膊上，满屋子都是那个味。她走的那天，枕头底下留了一张纸条和一根头绳，纸条上写着她的学校地址。',
      art: 'home',
      opts: [
        { label: '给她写信', fx: { at: { happiness: 2 } } },
        { label: '把头绳收进抽屉', fx: { at: { happiness: 1 } } },
        { label: '把纸条扔了', fx: { at: { happiness: -1 } } }
      ]
    },
    {
      id: 'ch_kd_46', stage: '童年', ageMin: 10, ageMax: 12,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '一锅稠粥',
      text: '母亲下地没回来，你把锅刷了，学着她的样子往锅里倒米。水放多了，煮成一锅稠粥。灶膛里的火星溅出来，落在你手背上。她回来吃了两碗，说水放多了，别的没说什么。',
      art: 'home', requiresAlive: ['母亲'], cond: AAlive(10, 12, ['母亲']),
      opts: [
        { label: '说下次少放水', fx: { at: { happiness: 1 }, npc: { '母亲': { intimacy: 1 } } } },
        { label: '把剩的半锅留到晚上', fx: { at: { happiness: 1, health: -1 } } }
      ]
    },
    {
      id: 'ch_kd_47', stage: '童年', ageMin: 11, ageMax: 12,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '翻盖手机',
      text: '父亲买了一部二手手机，翻盖的，屏幕上有划痕。他把手机放在饭桌中间，谁来都让人家看。晚上他坐在门槛上，把手机打开又合上，合上又打开，说以后出门能打电话了。',
      art: 'home', requiresAlive: ['父亲'], cond: AAlive(11, 12, ['父亲']),
      opts: [
        { label: '要过来玩里面的游戏', fx: { at: { happiness: 2 }, npc: { '父亲': { favor: -1 } } } },
        { label: '看着他把手机收进贴身的口袋', fx: { at: { happiness: 1 }, npc: { '父亲': { favor: 1 } } } },
        { label: '问能不能给同学打个电话', fx: { at: { happiness: 1 }, npc: { '同学': { favor: 1 } } } }
      ]
    },
    {
      id: 'ch_kd_48', stage: '童年', ageMin: 10, ageMax: 11,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '白球鞋',
      text: '你想要一双白球鞋，母亲说等下个月。你摔了门，在屋里喊了一句，说别人家都有就我们家没有。喊完屋里很静，听见她在灶前把锅盖放下，声音很轻。',
      art: 'home', requiresAlive: ['母亲'], cond: AAlive(10, 11, ['母亲']),
      opts: [
        {
          label: '晚上没出去吃饭',
          fx: {
            at: { happiness: -2, stress: 2 }, npc: { '母亲': { favor: -1 } },
            set: { ch_kd_e13_armed: true }, flag: [{ event: 'ch_kd_e13', delay: 1 }]
          }
        },
        {
          label: '第二天跟她道了歉',
          fx: {
            at: { happiness: -1 }, npc: { '母亲': { intimacy: 2 } },
            set: { ch_kd_e13_armed: true }, flag: [{ event: 'ch_kd_e13', delay: 1 }]
          }
        },
        {
          label: '装作没说过',
          fx: {
            at: { happiness: -1, stress: 1 },
            set: { ch_kd_e13_armed: true }, flag: [{ event: 'ch_kd_e13', delay: 1 }]
          }
        }
      ]
    },
    {
      id: 'ch_kd_49', stage: '童年', ageMin: 11, ageMax: 11,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '饼干盒',
      text: '你和两个同学在操场边的梧桐树下挖了个坑，把各自写的一张纸装进铁皮饼干盒埋进去，说好十年后一起挖。你的纸上写的是想去的城市。埋完用脚把土踩实，谁也没记住位置。',
      art: 'playground',
      opts: [
        {
          label: '把自己那张重写一遍',
          fx: {
            at: { happiness: 1 }, tag: '在梧桐树下埋过一只饼干盒',
            set: { ch_kd_e14_armed: true }, flag: [{ event: 'ch_kd_e14', delay: 1 }]
          }
        },
        {
          label: '就这样埋着',
          fx: {
            at: { happiness: 1 }, tag: '在梧桐树下埋过一只饼干盒',
            set: { ch_kd_e14_armed: true }, flag: [{ event: 'ch_kd_e14', delay: 1 }]
          }
        }
      ]
    },
    {
      id: 'ch_kd_50', stage: '童年', ageMin: 11, ageMax: 12,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '二八大杠',
      text: '你学会了骑自行车，是父亲那辆二八大杠。你跨不上去，只能斜着身子踩半圈。第一次自己骑到镇上，风把衣服吹得鼓起来。回来时车链子掉了，你蹲在路边用手装，满手黑油。',
      art: 'village_gate', requiresAlive: ['父亲'], cond: AAlive(11, 12, ['父亲']),
      opts: [
        { label: '回家打水洗手，什么也不说', fx: { at: { happiness: 1 } } },
        { label: '跟父亲说车链子掉了', fx: { at: { happiness: 1 }, npc: { '父亲': { favor: 1 } } } },
        { label: '蹲在路边把链子又拆下来看一遍', fx: { at: { happiness: 2, stress: 1 }, tag: '自己装上了掉下来的车链子' } }
      ]
    },
    {
      id: 'ch_kd_51', stage: '童年', ageMin: 8, ageMax: 10,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '抬到桌面以上',
      text: '老师提问，你知道答案，手抬到桌面以上又放下去了。她叫了别人，别人答错，她叹了口气。你在座位上把答案在心里又说了一遍，说得很快，怕忘了。下课铃响，你把课本合上。',
      art: 'classroom',
      opts: [
        {
          label: '课后去办公室说了答案',
          fx: {
            at: { happiness: 1, stress: 1 },
            set: { ch_kd_e16_armed: true }, flag: [{ event: 'ch_kd_e16', delay: 2 }]
          }
        },
        {
          label: '谁也没说',
          fx: {
            at: { happiness: -1 },
            set: { ch_kd_e16_armed: true }, flag: [{ event: 'ch_kd_e16', delay: 2 }]
          }
        }
      ]
    },
    {
      id: 'ch_kd_52', stage: '童年', ageMin: 9, ageMax: 11,
      type: 'random', tier: 'daily', weight: 1.0,
      title: '假珍珠发卡',
      text: '你用攒了三个月的零钱在小卖部买了一个发卡，塑料的，上面粘着一颗假珍珠。回家的路上你把它攥在手心，攥出了汗。母亲正在院里收衣服，你把发卡递过去，她愣了一下，说浪费钱。',
      art: 'corner_shop', requiresAlive: ['母亲'], cond: AAlive(9, 11, ['母亲']),
      opts: [
        {
          label: '让她当场别上',
          fx: {
            at: { happiness: 1 }, npc: { '母亲': { intimacy: 2 } },
            set: { ch_kd_e17_armed: true }, flag: [{ event: 'ch_kd_e17', delay: 1 }]
          }
        },
        {
          label: '放回自己抽屉',
          fx: {
            at: { happiness: -1 },
            set: { ch_kd_e17_armed: true }, flag: [{ event: 'ch_kd_e17', delay: 1 }]
          }
        },
        {
          label: '第二天偷偷放进她梳妆盒',
          fx: {
            at: { happiness: 1 }, npc: { '母亲': { intimacy: 1 } },
            set: { ch_kd_e17_armed: true }, flag: [{ event: 'ch_kd_e17', delay: 1 }]
          }
        }
      ]
    },
    {
      id: 'ch_kd_53', stage: '童年', ageMin: 11, ageMax: 11,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '硬皮歌词本',
      text: '你有一个硬皮本子，专门抄歌词。每一页用尺子画格，歌名用红笔，歌词用蓝笔。同桌借去抄，还回来时滴了一块油，正好在副歌那两句上。你用橡皮擦，擦出了个洞。',
      art: 'classroom',
      opts: [
        {
          label: '把那一页撕了重抄',
          fx: {
            at: { happiness: -1, stress: 1 },
            set: { ch_kd_e18_armed: true }, flag: [{ event: 'ch_kd_e18', delay: 1 }]
          }
        },
        {
          label: '留着那个洞',
          fx: {
            at: { happiness: 1 },
            set: { ch_kd_e18_armed: true }, flag: [{ event: 'ch_kd_e18', delay: 1 }]
          }
        },
        {
          label: '跟同桌要个说法',
          fx: {
            at: { stress: 1 }, npc: { '同学': { favor: -1 } },
            set: { ch_kd_e18_armed: true }, flag: [{ event: 'ch_kd_e18', delay: 1 }]
          }
        }
      ]
    },
    {
      id: 'ch_kd_54', stage: '童年', ageMin: 9, ageMax: 10,
      type: 'random', tier: 'daily', weight: 0.9,
      title: '断了一根骨的伞',
      text: '下雨，你把家里那把黑伞借给了没带伞的同学。放学时雨停了，他没还。第二天他也没提。第三天你在教室后墙的挂钩上看见那把伞，伞骨断了一根，用透明胶缠着。',
      art: 'classroom', cond: AWith(9, 10, '同学'),
      opts: [
        {
          label: '什么也没说，把伞拿回家',
          fx: {
            at: { happiness: -1 }, npc: { '同学': { favor: 1 } },
            set: { ch_kd_e19_armed: true }, flag: [{ event: 'ch_kd_e19', delay: 2 }]
          }
        },
        {
          label: '跟他说伞骨断了',
          fx: {
            at: { stress: 1 }, npc: { '同学': { favor: -1 } },
            set: { ch_kd_e19_armed: true }, flag: [{ event: 'ch_kd_e19', delay: 2 }]
          }
        },
        {
          label: '把伞留给他',
          fx: {
            at: { happiness: 1 }, npc: { '同学': { favor: 2 } },
            set: { ch_kd_e19_armed: true }, flag: [{ event: 'ch_kd_e19', delay: 2 }]
          }
        }
      ]
    },

    /* ---------- 童年回声：由童年事件 flag 触发，只走 pending ---------- */

    {
      id: 'ch_kd_e1', stage: '童年', ageMin: 11, ageMax: 11,
      type: 'random', tier: 'echo', weight: 1.0,
      title: '广播室念的名字',
      text: '运动会上你在跑道边捡到一个钱包，里面有十二块钱和学生证。你交到广播室，广播里念了你的名字。放学时丢钱包的女生在校门口等你，塞给你一根冰棍。你接了，走出一段路才吃。',
      art: 'playground', cond: AArmed(11, 11, 'ch_kd_e1_armed'),
      opts: [
        { label: '边走边吃', fx: { at: { happiness: 2 } } },
        { label: '揣回家', fx: { at: { happiness: 1 } } },
        { label: '追上她还回去', fx: { at: { happiness: -1, stress: 1 } } }
      ]
    },
    {
      id: 'ch_kd_e2', stage: '童年', ageMin: 11, ageMax: 12,
      type: 'random', tier: 'echo', weight: 1.0,
      title: '班费',
      text: '班里丢了班费，班主任把所有人留在教室。当年你替他背过锅的那个同桌站起来，说钱是他拿的，跟别人没关系。他说话的时候看着你，看了一会儿，又低下头去。',
      art: 'classroom', cond: AArmed(11, 12, 'ch_kd_e2_armed'),
      opts: [
        { label: '站起来替他说话', fx: { at: { happiness: 1, stress: 1 }, npc: { '同学': { favor: 2 } } } },
        { label: '坐着没动', fx: { at: { happiness: -1 }, npc: { '同学': { favor: -1 } } } },
        { label: '放学在门口等他', fx: { at: { happiness: 1 }, npc: { '同学': { favor: 1 } } } }
      ]
    },
    {
      id: 'ch_kd_e3', stage: '童年', ageMin: 9, ageMax: 10,
      type: 'random', tier: 'echo', weight: 1.0,
      title: '装猪油的罐子',
      text: '家里又碎了一个罐子，这回是装猪油的。母亲问是谁，你站在门口，看着她手里的扫帚。她说她知道了，不用问。你把地上的碎瓷片一片片捡进簸箕，手指被划了一道。',
      art: 'home', cond: AArmed(9, 10, 'ch_kd_e3_armed'),
      opts: [
        { label: '说是猫', fx: { at: { happiness: -1, stress: 2 }, npc: { '母亲': { favor: -1 } } } },
        { label: '说是自己', fx: { at: { happiness: -1 }, npc: { '母亲': { intimacy: 1 } } } },
        { label: '什么也不说', fx: { at: { stress: 1 } } }
      ]
    },
    {
      id: 'ch_kd_e4', stage: '童年', ageMin: 11, ageMax: 12,
      type: 'random', tier: 'echo', weight: 1.0,
      title: '少了一张十块的',
      text: '母亲数钱的时候少了一张十块的，她把铁盒翻过来倒在桌上，一张一张地数。你站在旁边，手心出汗。她数完抬头看你，看了三秒，把钱装回铁盒，说是她自己记错了。',
      art: 'home', requiresAlive: ['母亲'], cond: AArmedAlive(11, 12, 'ch_kd_e4_armed', ['母亲']),
      opts: [
        { label: '当场承认', fx: { at: { happiness: -1, stress: -2 }, npc: { '母亲': { intimacy: 2 } } } },
        { label: '转身出去', fx: { at: { stress: 2 }, npc: { '母亲': { favor: -1 } } } },
        { label: '回屋把钱放回去', fx: { at: { happiness: -1 } } }
      ]
    },
    {
      id: 'ch_kd_e5', stage: '童年', ageMin: 11, ageMax: 12,
      type: 'random', tier: 'echo', weight: 1.0,
      title: '水果硬糖',
      text: '王家的窗户换了新玻璃，这回是她儿子结婚。她站在门口发糖，见你路过，抓了一把塞进你兜里，说你小时候踢毽子最野。糖是水果硬糖，糖纸有点化了。',
      art: 'village_gate', cond: AArmed(11, 12, 'ch_kd_e5_armed'),
      opts: [
        { label: '说当年那块玻璃是我踢碎的', fx: { at: { happiness: 1, stress: 1 } } },
        { label: '什么也没说', fx: { at: { happiness: -1 } } },
        { label: '把糖还回去', fx: { at: { happiness: -1, stress: 1 } } }
      ]
    },
    {
      id: 'ch_kd_e6', stage: '童年', ageMin: 10, ageMax: 10,
      type: 'random', tier: 'echo', weight: 1.0,
      title: '布边磨毛的地方',
      text: '升旗仪式上你站在第一排，风把红领巾吹起来，贴在下巴上。你想起有一年它是从鸡窝边上捡回来的，湿的，带着一股味。你伸手把它扶正，指尖摸到布边磨毛的地方。',
      art: 'classroom', cond: AArmed(10, 10, 'ch_kd_e6_armed'),
      opts: [
        { label: '把红领巾的事讲出来', fx: { at: { happiness: 1 } } },
        { label: '什么也没说', fx: { at: { happiness: -1 } } }
      ]
    },
    {
      id: 'ch_kd_e7', stage: '童年', ageMin: 11, ageMax: 12,
      type: 'random', tier: 'echo', weight: 1.0,
      title: '倒空的书包',
      text: '新来的老师丢了教案本，问是不是你拿的，因为你上次坐在讲台边上。你没说话，把书包倒在地上，书和本子摊了一地。本子后来在办公室的暖气片上找到，老师说了句不好意思，声音很小。',
      art: 'classroom', cond: AArmed(11, 12, 'ch_kd_e7_armed'),
      opts: [
        { label: '把书一本一本捡起来', fx: { at: { happiness: -1, stress: 1 } } },
        { label: '让她自己捡', fx: { at: { happiness: 1, stress: 2 } } },
        { label: '什么也没说，走了', fx: { at: { happiness: -1 } } }
      ]
    },
    {
      id: 'ch_kd_e8', stage: '童年', ageMin: 11, ageMax: 12,
      type: 'random', tier: 'echo', weight: 1.0,
      title: '用了一半的铅笔',
      text: '那个扎马尾的女生要转学了，最后一节课她把文具盒里的东西分给周围的人。轮到你，她给了一支用了一半的铅笔，笔杆上有牙印。她说明天就不来了。放学的铃响了。',
      art: 'classroom', cond: AArmed(11, 12, 'ch_kd_e8_armed'),
      opts: [
        { label: '把那半支铅笔削好收起来', fx: { at: { happiness: 1 } } },
        { label: '追出去跟她说话', fx: { at: { happiness: 2, stress: 2 } } },
        { label: '当场还给她', fx: { at: { happiness: -1 } } }
      ]
    },
    {
      id: 'ch_kd_e9', stage: '童年', ageMin: 11, ageMax: 12,
      type: 'random', tier: 'echo', weight: 1.0,
      title: '这个八十一',
      text: '又一张成绩单发下来，这回是真的八十一分。你拿回家，父亲照例让你念，你念了八十一。他从口袋里摸出老花镜戴上，把卷子凑到眼前，看了很久，说这个八十一，比上次那个长一点。',
      art: 'exam', requiresAlive: ['父亲'], cond: AArmedAlive(11, 12, 'ch_kd_e9_armed', ['父亲']),
      opts: [
        { label: '告诉他上次是假的', fx: { at: { happiness: -1 }, npc: { '父亲': { intimacy: 2 } } } },
        { label: '什么也不说', fx: { at: { happiness: -1, stress: 1 } } },
        { label: '把卷子贴在墙上', fx: { at: { happiness: 1 }, npc: { '父亲': { favor: 1 } } } }
      ]
    },
    {
      id: 'ch_kd_e10', stage: '童年', ageMin: 11, ageMax: 11,
      type: 'random', tier: 'echo', weight: 1.0,
      title: '两个铅笔盒',
      text: '同桌从镇上回来，带了一个新铅笔盒，铁的，印着变形金刚。他把它推到你桌上，说他表哥给的，他有两个。旧的那个瘪了盖的，他没扔，还在用。',
      art: 'classroom', cond: AArmed(11, 11, 'ch_kd_e10_armed'),
      opts: [
        { label: '收下', fx: { at: { happiness: 2 }, npc: { '同学': { favor: 1 } } } },
        { label: '还给他', fx: { at: { happiness: -1 }, npc: { '同学': { favor: -1 } } } },
        { label: '拿自己的东西跟他换', fx: { at: { happiness: 1 } } }
      ]
    },
    {
      id: 'ch_kd_e11', stage: '童年', ageMin: 12, ageMax: 12,
      type: 'random', tier: 'echo', weight: 1.0,
      title: '河堤上的石头',
      text: '发小要去外地打工，走的前一晚你们坐在河堤上。他把当年那件事拿出来说，说你那天提着一袋鱼站在旁边，脸都白了。他说完笑了，捡起一块石头扔进河里，没听见响。',
      art: 'village_gate', cond: AArmed(12, 12, 'ch_kd_e11_armed'),
      opts: [
        { label: '跟他道歉', fx: { at: { happiness: -1 }, npc: { '发小': { intimacy: 2 } } } },
        { label: '跟他一起笑', fx: { at: { happiness: 1 }, npc: { '发小': { intimacy: 1 } } } },
        { label: '什么也不说', fx: { at: { happiness: -1 } } }
      ]
    },
    {
      id: 'ch_kd_e12', stage: '童年', ageMin: 10, ageMax: 10,
      type: 'random', tier: 'echo', weight: 1.0,
      title: '夹层里的半块橡皮',
      text: '你在书包夹层里摸到半块橡皮，已经硬了，擦不动字。那是当年你还回去的那块。你把它放在掌心看了一会儿，上面还有一道指甲掐出来的印子。上课铃响了。',
      art: 'classroom', cond: AArmed(10, 10, 'ch_kd_e12_armed'),
      opts: [
        { label: '把它扔出窗外', fx: { at: { happiness: 1 } } },
        { label: '留在笔袋里', fx: { at: { happiness: -1 } } },
        { label: '放在同桌桌上', fx: { at: { happiness: 1 }, npc: { '同学': { favor: 1 } } } }
      ]
    },
    {
      id: 'ch_kd_e13', stage: '童年', ageMin: 11, ageMax: 12,
      type: 'random', tier: 'echo', weight: 1.0,
      title: '打了折的球鞋',
      text: '母亲从镇上回来，把一个纸包放在桌上。你打开，是一双白球鞋，鞋底还带着灰。她说打了折。你试了试，大了一点。她说大一点好，能穿两年。你把鞋脱下来，放回盒子里。',
      art: 'home', requiresAlive: ['母亲'], cond: AArmedAlive(11, 12, 'ch_kd_e13_armed', ['母亲']),
      opts: [
        { label: '当场穿上', fx: { at: { happiness: 2 }, npc: { '母亲': { intimacy: 1 } } } },
        { label: '说太大了', fx: { at: { happiness: -1 }, npc: { '母亲': { favor: -1 } } } },
        { label: '什么也没说，把鞋收进柜子', fx: { at: { happiness: -1 } } }
      ]
    },
    {
      id: 'ch_kd_e14', stage: '童年', ageMin: 12, ageMax: 12,
      type: 'random', tier: 'echo', weight: 1.0,
      title: '挖开的梧桐树',
      text: '操场要铺水泥，那棵梧桐树被挖了，根上带着一大块土。你站在坑边，看见铁皮饼干盒的角露在外面，锈了一半。有人把它捡起来，晃了晃，问里面是什么。你没过去。',
      art: 'playground', cond: AArmed(12, 12, 'ch_kd_e14_armed'),
      opts: [
        { label: '走过去把盒子要回来', fx: { at: { happiness: 1, stress: 1 } } },
        { label: '站着不动', fx: { at: { happiness: -1 } } }
      ]
    },
    {
      id: 'ch_kd_e15', stage: '童年', ageMin: 10, ageMax: 10,
      type: 'random', tier: 'echo', weight: 1.0,
      title: '压扁的羽毛',
      text: '你在课本里翻出那根羽毛，已经压得很扁，颜色也淡了。同桌问这是什么的，你说是麻雀的。她拿过去看，吹了一下，羽毛飘起来，落在前排同学的后颈上。',
      art: 'classroom', cond: AArmed(10, 10, 'ch_kd_e15_armed'),
      opts: [
        { label: '把羽毛要回来', fx: { at: { happiness: 1 } } },
        { label: '笑出声', fx: { at: { happiness: 2, stress: 1 } } },
        { label: '装作不是自己的', fx: { at: { happiness: -1 } } }
      ]
    },
    {
      id: 'ch_kd_e16', stage: '童年', ageMin: 11, ageMax: 12,
      type: 'random', tier: 'echo', weight: 1.0,
      title: '举得很直',
      text: '课堂上老师提问，你又知道答案。这一次你把手举起来，举得很直。她叫了你。你站起来，声音有点抖，把答案说完。她点了点头，让你坐下。坐下时椅子腿在地上刮了一声。',
      art: 'classroom', cond: AArmed(11, 12, 'ch_kd_e16_armed'),
      opts: [
        { label: '课后去问她答得对不对', fx: { at: { happiness: 1, stress: 1 } } },
        { label: '什么也不问', fx: { at: { happiness: -1 } } }
      ]
    },
    {
      id: 'ch_kd_e17', stage: '童年', ageMin: 11, ageMax: 12,
      type: 'random', tier: 'echo', weight: 1.0,
      title: '掉了一颗珍珠',
      text: '母亲在镜前梳头，头上别着那个假珍珠发卡，珍珠掉了一颗，露出白色的胶。她梳完，把碎头发绕在手指上，塞进墙缝。你站在门口，她回头问你站在那儿干什么。',
      art: 'home', requiresAlive: ['母亲'], cond: AArmedAlive(11, 12, 'ch_kd_e17_armed', ['母亲']),
      opts: [
        { label: '说没什么', fx: { at: { happiness: -1 } } },
        { label: '说发卡该换了', fx: { at: { happiness: 1 }, npc: { '母亲': { intimacy: 1 } } } },
        { label: '说好看', fx: { at: { happiness: 2 }, npc: { '母亲': { intimacy: 2 } } } }
      ]
    },
    {
      id: 'ch_kd_e18', stage: '童年', ageMin: 12, ageMax: 12,
      type: 'random', tier: 'echo', weight: 1.0,
      title: '这句我也喜欢',
      text: '你在同桌的课桌里看见自己的歌词本，被压在别人的课本底下，封面上多了一道折痕。翻开，那页撕了重抄的纸边上多了一行铅笔字：这句我也喜欢。字很小。',
      art: 'classroom', cond: AArmed(12, 12, 'ch_kd_e18_armed'),
      opts: [
        { label: '把本子拿回来', fx: { at: { happiness: -1 } } },
        { label: '在下面回一行字', fx: { at: { happiness: 2, stress: 1 } } },
        { label: '装作没看见', fx: { at: { happiness: 1 } } }
      ]
    },
    {
      id: 'ch_kd_e19', stage: '童年', ageMin: 11, ageMax: 12,
      type: 'random', tier: 'echo', weight: 1.0,
      title: '发黄的透明胶',
      text: '又下雨了，那个同学从书包里拿出那把黑伞，伞骨上缠的透明胶已经发黄。他把伞撑开递给你，说他家近。雨打在伞面上，声音很密。你举着伞走了一段，回头看见他在雨里跑。',
      art: 'classroom', cond: AArmed(11, 12, 'ch_kd_e19_armed'),
      opts: [
        { label: '追上去把伞还给他', fx: { at: { happiness: 2, stress: 1 } } },
        { label: '举着伞走回家', fx: { at: { happiness: -1 } } },
        { label: '站在原地看他跑远', fx: { at: { happiness: 1 } } }
      ]
    },
    {
      id: 'ch_kd_e20', stage: '童年', ageMin: 12, ageMax: 12,
      type: 'random', tier: 'echo', weight: 1.0,
      title: '毕业照',
      text: '当年跟你打架的那个男生，在毕业照上站在你旁边。摄影师喊看镜头，他忽然伸手搭在你肩上。你僵了一下，没躲开。照片洗出来，两个人都在笑，牙齿露得一样多。',
      art: 'playground', cond: AArmed(12, 12, 'ch_kd_e20_armed'),
      opts: [
        { label: '把照片要一张', fx: { at: { happiness: 2 } } },
        { label: '把照片收进抽屉', fx: { at: { happiness: 1 } } },
        { label: '什么也没说', fx: { at: { happiness: -1 } } }
      ]
    },

  ];

  /* 后加载事件补进索引，pending（flag 回声）才能按 id 取到 */
  var IDX = L.EVENT_INDEX = L.EVENT_INDEX || {};
  for (var i = 0; i < EVENTS.length; i++) {
    var e = EVENTS[i];
    if (e && e.id && !IDX[e.id]) IDX[e.id] = e;
  }
  L.EVENTS.push.apply(L.EVENTS, EVENTS);
  L.CHILD_EVENTS = EVENTS;
})();
