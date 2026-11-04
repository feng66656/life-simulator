/* =========================================================
   events_v32a.js — v3.2 内容扩量 A 卷
   出生条件化首事件 / 0–3 岁 / 4–12 岁 / 少年分轨 / 19–55 岁
   仅追加事件，不覆盖 events.js 的旧库；末尾重建索引。
   选项多结局：{ outcomes: [{ w, text, label, fx }] }
   第一个结局是“多数/常规结果”，低心情时会被轻微降权。
   ========================================================= */
(function () {
  'use strict';
  var LS = window.LS;
  var E = LS.EVENTS;

  function add(list) { for (var i = 0; i < list.length; i++) E.push(list[i]); }
  function o(label, fx, extra) {
    var r = { label: label, fx: fx || {} };
    if (extra) for (var k in extra) r[k] = extra[k];
    return r;
  }
  function outs(list) { return { outcomes: list }; }
  /* 结局简写：oc(权重, 文本, 标签, 效果) */
  function oc(w, text, label, fx) {
    return { w: w, text: text, label: label || '', fx: fx || {} };
  }

  function sickly(g) {
    return !!(LS.hasTalent(g, 'sickly') || (g.attrs && g.attrs.health <= 50));
  }
  function hasSib(g) { return !!(g.sibling && g.sibling.has); }
  function siblingRole(g, role) { return !!(g.sibling && g.sibling.has && g.sibling.role === role); }
  function track(g, id) { return g.track === id; }

  /* 选项文本模板：{{track}} / {{npc:角色}} / {{anchor:角色}}（ui.js 渲染时调用本函数） */
  if (!LS.renderTemplate) {
    var TRACK_FALLBACK = { science: '理科', arts: '文科', art: '艺术', sports: '体育' };
    LS.renderTemplate = function (str, g) {
      if (str === null || str === undefined) return '';
      return String(str).replace(/\{\{\s*([^{}]+?)\s*\}\}/g, function (raw, key) {
        var k = String(key).replace(/\s+/g, '');
        if (k === 'track') {
          if (g && g.track) {
            var labs = LS.TRACK_LABELS || TRACK_FALLBACK;
            return labs[g.track] || TRACK_FALLBACK[g.track] || '还没定方向';
          }
          return '还没定方向';
        }
        if (k.indexOf('npc:') === 0) {
          var role = k.slice(4);
          var n = g ? LS.getNpc(g, role) : null;
          return (n && n.name) ? n.name : role;
        }
        if (k.indexOf('anchor:') === 0) {
          var role2 = k.slice(7);
          var m = g ? LS.getNpc(g, role2) : null;
          if (!m || !m.anchors || !m.anchors.length) return '';
          var a = m.anchors[m.anchors.length - 1];
          return (a && a.text) ? String(a.text) : '';
        }
        return raw;
      });
    };
  }

  /* =========================================================
     一、条件化出生首事件（age 0，prio 101–105）
     ========================================================= */
  add([
    {
      id: 'v32_birth_middle', type: 'forced', stage: '婴幼儿', age: 0, weight: 2, prio: 101,
      family: 'birth', art: 'nursery',
      cond: function (g) { return g.background === '普通工薪'; },
      title: '妇幼保健院的三楼',
      text: '2005 年冬天，市妇幼保健院三楼走廊里排着长队。父亲拿着缴费单来回跑，母亲在待产室里攥着床单。护士问要不要无痛，又说单间病房还剩最后一间，一天三百八。窗外是灰白的天，楼下有人拎着保温桶进来。',
      opts: [
        o('住普通病房，把钱省下来', { money: { cash: -1200 }, npc: { '母亲': { favor: 3 } }, tag: '出生时住的是普通病房' }, {
          hint: '能省一笔，但夜里吵', tone: 'safe',
          outcomes: [
            oc(65, '八人间里一夜没消停，好在你和母亲都平安。', '普通病房', { at: { health: 2, happiness: 1 } }),
            oc(25, '隔壁床的孩子整夜哭，母亲几乎没合眼。', '没休息好', { at: { health: -1 }, npc: { '母亲': { health: -3 } } }),
            oc(10, '临时加床，父亲在走廊的椅子上睡了两晚。', '加床', { at: { health: 1 }, npc: { '父亲': { favor: 2 } } })
          ]
        }),
        o('加钱住单间，让母亲睡个整觉', { money: { cash: -4200 }, npc: { '母亲': { favor: 7 } }, tag: '出生时父亲坚持要了单间' }, {
          hint: '一笔不小的开销', tone: 'switch',
          outcomes: [
            oc(70, '单间安静，母亲睡了生产后的第一个整觉。', '单间', { at: { health: 4, happiness: 2 } }),
            oc(20, '单间被别的产妇先订走了，钱退回来一半。', '没住上', { money: { cash: 2000 }, at: { happiness: -1 } }),
            oc(10, '护士格外上心，教了母亲很多带孩子的细节。', '护士上心', { at: { health: 3 }, npc: { '母亲': { favor: 2 } } })
          ]
        }),
        o('听母亲的，回娘家那边的小医院生', { money: { cash: 800 }, npc: { '母亲': { favor: 2 }, '外婆': { favor: 4 } }, tag: '出生在母亲娘家那边的小医院' }, {
          hint: '熟人多，设备一般', tone: 'safe',
          outcomes: [
            oc(60, '小医院人少，医生是外婆认识的老熟人。', '熟人接生', { at: { health: 1, happiness: 2 } }),
            oc(30, '设备不全，做完检查又补交了一笔钱。', '补检查', { money: { cash: -1600 }, at: { health: -1 } }),
            oc(10, '半夜有个急诊插队，你们等了很久。', '等产房', { at: { health: -2, stress: 1 }, npc: { '母亲': { health: -2 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_birth_poor_city', type: 'forced', stage: '婴幼儿', age: 0, weight: 2, prio: 102,
      family: 'birth', art: 'clinic',
      cond: function (g) { return g.background === '贫困' && g.birthplace !== '农村'; },
      title: '城中村的出租屋',
      text: '预产期前一周，房东来收了这个月的房租。父亲在工地结了一笔短工钱，母亲把待产包收在一个旧旅行袋里。最近的公立医院要坐四站公交，挂号要排队；巷子口还有一家私人诊所，灯箱上的字掉了半边。',
      opts: [
        o('去公立医院排队建档', { money: { cash: -2600 }, npc: { '母亲': { favor: 5 } }, tag: '出生在公立医院的走廊里' }, {
          hint: '排队久，但放心', tone: 'safe',
          outcomes: [
            oc(65, '排了一整天，总算建上档，医生说话不多但很稳。', '顺利建档', { at: { health: 3 } }),
            oc(25, '床位紧张，母亲在走廊的加床上等了一夜。', '走廊加床', { at: { health: -1, happiness: -1 }, npc: { '母亲': { health: -3 } } }),
            oc(10, '检查发现胎位不正，临时改了方案。', '临时改方案', { money: { cash: -3000 }, at: { health: 1, stress: 2 } })
          ]
        }),
        o('去巷口的私人诊所，便宜又快', { money: { cash: -800 }, npc: { '母亲': { favor: 3 } }, tag: '出生在城中村的私人诊所' }, {
          hint: '省事，但条件有限', tone: 'risk',
          outcomes: [
            oc(60, '接生的老医生手脚麻利，母子平安。', '诊所接生', { at: { health: 1 } }),
            oc(28, '消毒不彻底，你出生后皮肤起了红疹。', '红疹', { at: { health: -4, happiness: -1 } }),
            oc(12, '母亲产后发烧，又转去公立医院补了一笔费用。', '转院', { money: { cash: -4200 }, at: { health: -3 }, npc: { '母亲': { health: -8 } } })
          ]
        }),
        o('父亲去借车，连夜送母亲去区医院', { money: { cash: -3800, debt: 2000 }, npc: { '父亲': { favor: 6 } }, tag: '父亲借车把母亲送进了区医院' }, {
          hint: '要欠一笔人情和钱', tone: 'switch',
          outcomes: [
            oc(62, '区医院接了急诊，母子平安，父亲在走廊坐了一夜。', '区医院', { at: { health: 4, happiness: 1 } }),
            oc(26, '借车的人临时变卦，最后打了车，钱花得更多。', '打车', { money: { cash: -1500 }, at: { stress: 2 } }),
            oc(12, '路上堵了四十分钟，到医院时已经开了三指。', '差点生在路上', { at: { health: -2, stress: 3 }, npc: { '父亲': { favor: 3 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_birth_poor_rural', type: 'forced', stage: '婴幼儿', age: 0, weight: 2, prio: 103,
      family: 'birth', art: 'home',
      cond: function (g) { return g.background === '贫困' && g.birthplace === '农村'; },
      title: '土炕上的第一声',
      text: '2005 年冬天，村里到镇上的班车一天只有两趟。母亲在土炕上疼了一整夜，接生婆把剪刀在开水里煮了又煮。父亲蹲在门外抽烟，烟头在雪地里亮一下、灭一下。天快亮时，接生婆隔着门帘说：准备一条干净褥子。',
      opts: [
        o('就在村里生，省下路费和住院钱', { money: { cash: 600 }, npc: { '母亲': { health: -6 } }, tag: '出生在村里的土炕上' }, {
          hint: '省钱，但风险落在母亲身上', tone: 'risk',
          outcomes: [
            oc(68, '母子平安。接生婆收了二十块钱和一条烟，天亮后父亲在院门口放了一挂鞭。', '村里接生', { at: { health: -2, happiness: 2 } }),
            oc(22, '母亲产后出血，拖到下午才借到三轮车去镇卫生院。', '产后出血', { money: { cash: -1400 }, at: { health: -3 }, npc: { '母亲': { health: -10, favor: 2 } } }),
            oc(10, '脐带处理得不好，你连发了几天低烧，接生婆只说“捂出汗就好”。', '脐带感染', { at: { health: -7, happiness: -2 }, npc: { '父亲': { favor: 2 } } })
          ]
        }),
        o('借三轮车连夜去镇卫生院', { money: { cash: -2300 }, npc: { '父亲': { favor: 4 }, '母亲': { favor: 3 } }, tag: '出生那晚借车去了镇卫生院' }, {
          hint: '多花两千多，换来一间有灯的产房', tone: 'switch',
          outcomes: [
            oc(66, '镇卫生院的灯一直亮着，值班医生守到最后。母亲说那晚她第一次觉得心里有底。', '镇卫生院', { at: { health: 3, happiness: 2 } }),
            oc(24, '车在半路陷进雪里，父亲和司机推了两里地才到。', '雪路推车', { at: { health: 1, stress: 2 }, npc: { '父亲': { health: -4 } } }),
            oc(10, '到了卫生院，医生建议转县医院，又借了一笔钱。', '再转县医院', { money: { cash: -4000 }, at: { health: 2 }, npc: { '父亲': { favor: 3 } } })
          ]
        }),
        o('父亲进城找亲戚借钱，直接去县医院', { money: { cash: -6000, debt: 3000 }, npc: { '父亲': { favor: 6 } }, tag: '父亲借钱让你生在县医院' }, {
          hint: '一出生家里就欠了账', tone: 'hard',
          outcomes: [
            oc(60, '县医院条件好些，母亲住了五天。父亲每天骑摩托来回送饭。', '县医院', { at: { health: 4, happiness: 1 }, npc: { '母亲': { favor: 4 } } }),
            oc(28, '亲戚嘴上答应，钱第二天才到，母亲在待产室多疼了一晚。', '钱到得慢', { at: { health: 1, happiness: -1 }, npc: { '父亲': { favor: 2 } } }),
            oc(12, '借的钱不够，父亲把家里养的那头猪卖了。', '卖了猪', { money: { cash: 1800 }, at: { health: 3 }, npc: { '父亲': { favor: 4 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_birth_rich', type: 'forced', stage: '婴幼儿', age: 0, weight: 2, prio: 104,
      family: 'birth', art: 'nursery',
      cond: function (g) { return g.background === '富裕'; },
      title: '私立妇产医院的单人套房',
      text: '私立妇产医院的套房里有一整面落地窗，护士每小时进来一次。月子中心的顾问在走廊里等着，手里拿着三档套餐；家里的保姆已经提前一周到岗。父亲在电话里安排满月酒，母亲说，孩子的名字还没定。',
      opts: [
        o('全套月子中心，最贵的那一档', { money: { cash: -68000 }, npc: { '母亲': { favor: 8 } }, tag: '出生后就住进了月子中心' }, {
          hint: '花钱买省心', tone: 'switch',
          outcomes: [
            oc(70, '月子中心照顾得细致，母亲恢复得很快。', '月子中心', { at: { health: 5, happiness: 3 } }),
            oc(20, '套餐里承诺的月嫂临时换了人，家里为此有些不快。', '换月嫂', { at: { happiness: -1 }, npc: { '母亲': { favor: -2 } } }),
            oc(10, '护士发现你黄疸偏高，多照了两天蓝光。', '黄疸', { money: { cash: -6000 }, at: { health: 1 } })
          ]
        }),
        o('请住家保姆，家里更自在', { money: { cash: -26000 }, npc: { '母亲': { favor: 5 }, '保姆': { favor: 4 } }, tag: '家里请了住家保姆' }, {
          hint: '省钱，但要碰运气', tone: 'safe',
          outcomes: [
            oc(62, '保姆手脚勤快，和母亲处得像一家人。', '好保姆', { at: { health: 2, happiness: 2 } }),
            oc(28, '第一个保姆干了半个月就走了，中介又换了一个。', '换保姆', { money: { cash: -4000 }, at: { happiness: -2 } }),
            oc(10, '保姆经验不足，你夜里哭闹了很长一段时间。', '夜里闹', { at: { health: -2, happiness: -1 }, npc: { '母亲': { health: -2 } } })
          ]
        }),
        o('不请人，父母自己带，钱留着做早教', { money: { cash: -12000 }, npc: { '母亲': { favor: 4 }, '父亲': { favor: 2 } }, tag: '父母亲自带你，把钱花在早教上' }, {
          hint: '陪伴多，父母也更累', tone: 'safe',
          outcomes: [
            oc(66, '母亲亲手带你，虽然累，但她后来常说那两年最踏实。', '亲手带大', { at: { health: 2, happiness: 3 }, npc: { '母亲': { favor: 3 } } }),
            oc(24, '父亲公司忙，说好的一起带，最后多半落在母亲身上。', '父亲缺席', { at: { happiness: -1 }, npc: { '父亲': { favor: -2 } } }),
            oc(10, '早教班排上了，你比同龄人开口早一点。', '早教见效', { at: { knowledge: 3, charm: 1 } })
          ]
        })
      ]
    },

    {
      id: 'v32_birth_sickly', type: 'forced', stage: '婴幼儿', age: 0, weight: 2, prio: 105,
      family: 'birth', art: 'clinic',
      cond: function (g) { return sickly(g); },
      title: '保温箱与转院单',
      text: '你比预产期早了三周，体重不到五斤。县医院的新生儿科只有两台保温箱，医生把转院单推过来，说市里条件更好，但救护车要另外算钱。母亲还没下产床，父亲站在走廊里，把那张单子看了三遍。',
      opts: [
        o('签转院单，跟救护车去市里', { money: { cash: -9000, debt: 4000 }, npc: { '父亲': { favor: 5 } }, tag: '一出生就转了一次院' }, {
          hint: '债会跟着你长大', tone: 'hard',
          outcomes: [
            oc(66, '市医院的新生儿科接得稳，你在保温箱里住了十二天。', '保温箱', { at: { health: 2, happiness: -3 } }),
            oc(24, '救护车半路出了故障，等了一个多小时才换车。', '救护车故障', { at: { health: -4, stress: 3 }, npc: { '父亲': { health: -3 } } }),
            oc(10, '转院后查出一点小问题，治疗费比预估多了一倍。', '费用翻倍', { money: { cash: -8000 }, at: { health: 1 } })
          ]
        }),
        o('留在县医院，先观察两天', { money: { cash: -3000 }, npc: { '母亲': { favor: 2 } }, tag: '出生后在县医院保温箱里待过' }, {
          hint: '省钱，但医生把握不大', tone: 'risk',
          outcomes: [
            oc(58, '保温箱空出一台，你住了进去，情况慢慢稳了。', '县医院保温箱', { at: { health: -1, happiness: -1 } }),
            oc(30, '第二天情况反复，医生还是劝转院，等于多花了一笔。', '延误转院', { money: { cash: -6000 }, at: { health: -3 }, npc: { '父亲': { favor: -2 } } }),
            oc(12, '一位老护士守了你一夜，情况竟然稳住了。', '老护士', { at: { health: 2 }, npc: { '护士': { favor: 4 } } })
          ]
        }),
        o('听老人的，抱回家用热水袋捂着', { money: { cash: 1200 }, npc: { '奶奶': { favor: 3 }, '母亲': { favor: -3 } }, tag: '出生后没进保温箱，被抱回了家' }, {
          hint: '最省钱，也最冒险', tone: 'risk',
          outcomes: [
            oc(45, '你居然慢慢缓了过来，奶奶逢人就说这是命硬。', '命硬', { at: { health: -3 }, set: { hardbaby: true } }),
            oc(40, '第三天你发起烧来，还是送回了医院。', '又送回医院', { money: { cash: -5000 }, at: { health: -5 }, npc: { '母亲': { favor: -2 } } }),
            oc(15, '村里的赤脚医生来看过，留下几包药，说听天由命。', '赤脚医生', { at: { health: -6, happiness: -2 } })
          ]
        })
      ]
    }
  ]);

  /* =========================================================
     二、0–3 岁：喂养、照护、第一次（16 条）
     ========================================================= */
  add([
    {
      id: 'v32_in_hold', type: 'random', stage: '婴幼儿', weight: 3,
      family: 'newborn_hold', art: 'nursery',
      cond: function (g) { return g.age >= 1 && g.age <= 2; },
      title: '夜里谁来抱',
      text: '你夜里总要人抱着才肯睡。母亲的伤口还没好利索，父亲第二天五点要出门上工。奶奶睡在外屋，听见哭声就披上衣服起来，说她来抱，让年轻人睡个整觉。',
      opts: [
        o('让奶奶抱，父母睡个整觉', { npc: { '奶奶': { favor: 6 }, '母亲': { favor: 2 } }, at: { health: 1, happiness: 1 }, tag: '小时候夜里多是奶奶抱着' }, {
          tone: 'safe',
          outcomes: [
            oc(70, '奶奶抱着你在屋里走了半宿，天快亮时才把你放下。', '奶奶哄睡', {}),
            oc(30, '你哭到嗓子哑，奶奶急得直掉眼泪，第二天还是照旧来抱。', '哭得厉害', { at: { health: -2 }, npc: { '奶奶': { favor: 3 } } })
          ]
        }),
        o('母亲忍着疼起来喂你', { npc: { '母亲': { favor: 8, health: -3 } }, at: { happiness: 2 }, tag: '母亲月子里几乎没睡整觉' }, {
          hint: '母亲的伤口恢复得更慢', tone: 'safe',
          outcomes: [
            oc(65, '母亲抱着你坐在床边，天亮了才把你放下。', '母亲守夜', { at: { happiness: 2 } }),
            oc(35, '连着几夜没睡好，母亲的情绪低落了一阵。', '母亲疲惫', { at: { health: -2, happiness: -2 }, npc: { '母亲': { health: -3 } } })
          ]
        }),
        o('把你放回小床，哭累了自己睡', { at: { health: -2, happiness: -2 }, npc: { '母亲': { favor: -3 } }, tag: '小时候被放在小床里自己睡' }, {
          hint: '大人能休息，你会哭很久', tone: 'risk',
          outcomes: [
            oc(55, '哭了三晚，你终于能自己入睡，父母轻松了不少。', '自己入睡', { at: { health: 1 }, npc: { '父亲': { favor: 2 } } }),
            oc(45, '你哭了整整一周，母亲最终还是把你抱了起来。', '又抱起来', { at: { happiness: -2 }, npc: { '母亲': { favor: -2 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_in_feeding', type: 'random', stage: '婴幼儿', weight: 3,
      family: 'feeding', art: 'home',
      cond: function (g) { return g.age >= 1 && g.age <= 3; },
      title: '母乳不够的那个月',
      text: '母亲的奶水一直不太够，你夜里饿得频繁。奶奶说熬米糊最实在，隔壁的年轻妈妈说进口奶粉配方更全。父亲在柜台前看了半天价签，把最贵的那罐又放了回去。',
      opts: [
        o('母乳加米糊，奶奶来熬', { money: { cash: -400 }, npc: { '奶奶': { favor: 5 }, '母亲': { favor: 2 } }, at: { health: 1 }, tag: '小时候是母乳加米糊喂大的' }, {
          tone: 'safe',
          outcomes: [
            oc(68, '奶奶每天清早熬一锅米糊，你吃得香，长得也结实。', '米糊', { at: { health: 2 } }),
            oc(32, '米糊喂得太早，你肠胃闹了几天。', '肠胃不适', { at: { health: -2, happiness: -1 }, npc: { '母亲': { favor: 1 } } })
          ]
        }),
        o('换奶粉，父母咬牙买好一点的', { money: { cash: -2600 }, npc: { '父亲': { favor: 4 }, '母亲': { favor: 4 } }, at: { health: 2 }, tag: '小时候喝的是父母挑的奶粉' }, {
          hint: '一个月多出好几百', tone: 'switch',
          outcomes: [
            oc(70, '你换奶粉后夜里安稳了很多，母亲终于能睡上几个小时。', '换奶粉', { at: { health: 3, happiness: 1 } }),
            oc(20, '第一罐不合适，你拉了两天肚子，又换了一个牌子。', '换牌子', { money: { cash: -800 }, at: { health: -1 } }),
            oc(10, '父亲托同事从城里带，便宜了一截。', '托人带', { money: { cash: 900 }, npc: { '父亲': { favor: 2 } } })
          ]
        }),
        o('母亲辞职在家喂到一岁', { money: { cash: -9000 }, npc: { '母亲': { favor: 9 } }, at: { health: 2, happiness: 2 }, tag: '母亲为喂奶辞了工作' }, {
          hint: '家里少一份收入', tone: 'safe',
          outcomes: [
            oc(66, '母亲在家待了一年，你几乎没生过病。', '喂到一岁', { at: { health: 4 } }),
            oc(24, '家里收入紧了，父亲嘴上不说，脸色却沉了一阵。', '手头紧', { at: { stress: 2 }, npc: { '父亲': { favor: -2 } } }),
            oc(10, '母亲后来再找工作，比原来低了半级。', '工作受影响', { at: { finance: -1 }, npc: { '母亲': { favor: 2 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_in_fever', type: 'random', stage: '婴幼儿', weight: 3,
      family: 'infant_fever', art: 'clinic',
      cond: function (g) { return g.age >= 1 && g.age <= 3 && g.attrs.health < 88; },
      title: '半夜三十九度',
      text: '半夜你烧到三十九度，额头烫手，哭得停不下来。家里的退烧药只剩半瓶，窗外在下雨，巷子口打不到车。母亲抱着你在屋里来回走，父亲翻出体温计又量了一遍。',
      opts: [
        o('连夜去医院挂急诊', { money: { cash: -1600 }, npc: { '母亲': { favor: 5 }, '父亲': { favor: 3 } }, tag: '小时候半夜发烧去过急诊' }, {
          hint: '花钱，但心里踏实', tone: 'safe',
          outcomes: [
            oc(68, '医生说是普通感染，打了针，天亮时烧退了。', '退烧', { at: { health: 2, happiness: 1 } }),
            oc(22, '急诊排了两个小时，母亲抱着你一直站到腿麻。', '排急诊', { at: { health: 1 }, npc: { '母亲': { health: -2 } } }),
            oc(10, '查出肺炎，医生要求住院。', '住院', { money: { cash: -5000 }, at: { health: -3 }, npc: { '父亲': { favor: 2 } } })
          ]
        }),
        o('先物理降温，天亮了再说', { money: { cash: -100 }, npc: { '母亲': { favor: 2 } }, tag: '小时候发烧先物理降温' }, {
          hint: '省钱，但要守一夜', tone: 'risk',
          outcomes: [
            oc(55, '母亲用温水擦了一夜，天亮时烧退了。', '物理降温', { at: { health: 1, happiness: 1 } }),
            oc(45, '烧到后半夜又上去了，最后还是去了医院。', '反复发烧', { money: { cash: -1800 }, at: { health: -3 }, npc: { '母亲': { favor: 1 } } })
          ]
        }),
        o('用奶奶说的土方，捂汗', { npc: { '奶奶': { favor: 3 }, '母亲': { favor: -2 } }, at: { health: -5, happiness: -2 }, tag: '小时候发烧用过捂汗的土方' }, {
          hint: '老人信这个，医生不信', tone: 'risk',
          outcomes: [
            oc(40, '捂出一身汗，天亮时烧真的退了。', '捂汗退了', { at: { health: 1 } }),
            oc(45, '越捂越烫，父亲半夜把被子掀了，还是送去医院。', '加重', { money: { cash: -2400 }, at: { health: -4 }, npc: { '父亲': { favor: 2 } } }),
            oc(15, '你抽了一下，全家人吓坏了。', '高热惊厥', { at: { health: -8, happiness: -4 }, npc: { '母亲': { health: -3 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_in_word', type: 'random', stage: '婴幼儿', weight: 2,
      family: 'first_word', art: 'home',
      cond: function (g) { return g.age >= 1 && g.age <= 2; },
      title: '第一个清楚的词',
      text: '你第一次清清楚楚地叫出一个词，屋里一下子安静，然后所有人都笑了。母亲蹲下来又问了一遍，父亲从厨房探出头，围裙上还沾着面粉。窗外的广播正在放一首老歌。',
      opts: [
        o('又叫了一声，伸手要抱', { npc: { '母亲': { favor: 5 }, '父亲': { favor: 3 } }, at: { happiness: 3, charm: 1 }, tag: '第一次开口就会要抱' }, {
          tone: 'safe',
          outcomes: [
            oc(70, '母亲把你抱起来转了一圈，父亲在门口笑着看。', '伸手要抱', { at: { happiness: 2 } }),
            oc(30, '你叫完就扭头去抓玩具，大人们笑了半天。', '只顾玩具', { at: { happiness: 1 }, npc: { '父亲': { favor: 2 } } })
          ]
        }),
        o('只盯着父亲手里的馒头', { npc: { '父亲': { favor: 4 } }, at: { happiness: 2, health: 1 }, tag: '第一次说话是为了吃' }, {
          hint: '听着好笑，也很实在', tone: 'safe',
          outcomes: [
            oc(60, '父亲把馒头掰了一小块给你，你笑得眼睛都眯起来。', '为了吃', { at: { happiness: 2 } }),
            oc(40, '母亲说你是个小吃货，把这件事讲了很多年。', '被念叨很多年', { at: { charm: 1 }, npc: { '母亲': { favor: 3 } } })
          ]
        }),
        o('一句话不说，继续玩自己的', { at: { happiness: 1, knowledge: 1 }, npc: { '母亲': { favor: -2 } }, tag: '开口比同龄人晚一点' }, {
          tone: 'safe',
          outcomes: [
            oc(55, '你只是懒得开口，后来话多得让人头疼。', '晚开口', { at: { knowledge: 2 } }),
            oc(45, '母亲担心了一阵，带你去医院查过。', '检查', { money: { cash: -600 }, at: { health: 1 }, npc: { '母亲': { favor: 2 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_in_walk', type: 'random', stage: '婴幼儿', weight: 2,
      family: 'first_step', art: 'home',
      cond: function (g) { return g.age >= 1 && g.age <= 2; },
      title: '松开手的那一下',
      text: '茶几角被父亲用旧毛巾包了起来。你扶着沙发挪步，走两步就坐下。母亲蹲在三米外拍手，父亲举着一台旧数码相机在旁边录。你犹豫了很久，手还抓着沙发边。',
      opts: [
        o('松开手，跌跌撞撞走过去', { npc: { '母亲': { favor: 4 }, '父亲': { favor: 3 } }, at: { health: 2, happiness: 3 }, tag: '学步那天自己走了过去' }, {
          tone: 'safe',
          outcomes: [
            oc(70, '你走了五步，最后扑进母亲怀里，父亲在相机后面喊了一声好。', '走了五步', { at: { health: 2, happiness: 2 } }),
            oc(30, '你摔了一跤，磕到膝盖，哭了几声又爬起来。', '摔了一跤', { at: { health: 1 }, npc: { '母亲': { favor: 2 } } })
          ]
        }),
        o('一直扶着沙发，不肯松手', { at: { health: 1, happiness: 1 }, npc: { '母亲': { favor: 1 } }, tag: '学步比同龄人慢一点' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '你比同龄人晚走了半个月，但走得稳。', '走得晚', { at: { health: 1 } }),
            oc(40, '母亲有点着急，问过邻居家的经验。', '母亲着急', { at: { happiness: -1 }, npc: { '母亲': { favor: 1 } } })
          ]
        }),
        o('父亲把你举起来，直接放到地上', { npc: { '父亲': { favor: 5 } }, at: { health: -1, happiness: 2, charm: 1 }, tag: '父亲用土办法教你走路' }, {
          hint: '粗鲁，但你记住了', tone: 'switch',
          outcomes: [
            oc(65, '你被放下后愣了两秒，居然自己站稳了。', '站稳了', { at: { health: 2, happiness: 2 } }),
            oc(35, '你哭得很凶，母亲把父亲说了一顿。', '哭了', { at: { happiness: -2 }, npc: { '母亲': { favor: 1 }, '父亲': { favor: -2 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_in_toy', type: 'random', stage: '婴幼儿', weight: 2,
      family: 'toy_taken', art: 'nursery',
      cond: function (g) { return g.age >= 2 && g.age <= 3; },
      title: '被抢走的小汽车',
      text: '邻居家孩子比你大半岁，看上了你手里的塑料小汽车，直接伸手拿走。你愣了两秒，张嘴就哭。他母亲在旁边说“哥哥让着弟弟”，你母亲没接话，只是把你抱了起来。',
      opts: [
        o('母亲替你要回来', { npc: { '母亲': { favor: 5 }, '邻居': { favor: -2 } }, at: { happiness: 2, charm: -1 }, tag: '小时候母亲会替你出头' }, {
          tone: 'switch',
          outcomes: [
            oc(60, '母亲走过去把车拿回来，两家大人脸上都不太好看。', '要回来了', { at: { happiness: 2 }, npc: { '母亲': { favor: 3 } } }),
            oc(40, '邻居把车还了，但从此来往少了一些。', '来往少了', { rep: { society: -1 }, npc: { '邻居': { favor: -3 } } })
          ]
        }),
        o('算了，回家再买一个', { money: { cash: -30 }, npc: { '母亲': { favor: 2 } }, at: { happiness: 1 }, tag: '从小就被教育不要争' }, {
          tone: 'safe',
          outcomes: [
            oc(65, '母亲带你去小卖部又买了一个，你说不出哪里不一样。', '又买一个', { money: { cash: -30 }, at: { happiness: 1 } }),
            oc(35, '你惦记了很久，后来在梦里还找那辆车。', '记了很久', { at: { happiness: -1 } })
          ]
        }),
        o('自己冲上去抢回来', { npc: { '邻居': { favor: -4 } }, at: { charm: 2, happiness: 2, stress: 1 }, tag: '很小就学会自己争东西' }, {
          hint: '大人们会尴尬', tone: 'switch',
          outcomes: [
            oc(50, '你把车抢了回来，邻居家孩子哭得比你响。', '抢回来', { at: { charm: 2, happiness: 2 } }),
            oc(50, '你被他推倒，膝盖磕在地上，车也没拿回来。', '被推倒', { at: { health: -2, happiness: -2 }, npc: { '母亲': { favor: 2 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_in_grandma', type: 'random', stage: '婴幼儿', weight: 3,
      family: 'grandcare', art: 'home',
      cond: function (g) { return g.age >= 1 && g.age <= 3 && (g.birthplace === '农村' || g.background === '贫困' || g.background === '普通工薪'); },
      title: '奶奶的一天',
      text: '父母都去上班了，白天只有奶奶和你。奶奶不识字，但记得住你每一次哭的时间。她把米汤吹凉了喂你，用旧棉袄把你裹在背上，去菜市场讲价。午后她坐在门口打盹，你趴在她腿上。',
      opts: [
        o('粘着奶奶，一天都不肯离', { npc: { '奶奶': { favor: 8 }, '母亲': { favor: -1 } }, at: { happiness: 3, health: 1 }, tag: '童年白天几乎都跟着奶奶' }, {
          tone: 'safe',
          outcomes: [
            oc(72, '奶奶去哪都带着你，你学会了她所有的口头禅。', '跟着奶奶', { at: { happiness: 2, charm: 1 } }),
            oc(28, '母亲下班回来想抱你，你却往奶奶怀里钻。', '更黏奶奶', { at: { happiness: 1 }, npc: { '母亲': { favor: -2 } } })
          ]
        }),
        o('晚上一定要等母亲回来', { npc: { '母亲': { favor: 6 }, '奶奶': { favor: 2 } }, at: { happiness: 2 }, tag: '小时候每晚都等母亲下班' }, {
          tone: 'safe',
          outcomes: [
            oc(65, '你每天在门口等，听见楼道里的脚步声就笑。', '等母亲', { at: { happiness: 3 } }),
            oc(35, '母亲常常加班，你等到趴在门槛上睡着。', '等到睡着', { at: { happiness: -2 }, npc: { '母亲': { favor: 2 } } })
          ]
        }),
        o('白天送去附近托儿所', { money: { cash: -3200 }, npc: { '母亲': { favor: 2 }, '奶奶': { favor: -2 } }, at: { charm: 2, knowledge: 1, happiness: -1 }, tag: '两岁多就去了托儿所' }, {
          hint: '花钱换奶奶轻松一点', tone: 'switch',
          outcomes: [
            oc(60, '托儿所里有小朋友，你比在家时活泼。', '托儿所', { at: { charm: 2, happiness: 1 } }),
            oc(25, '你连着感冒了两次，奶奶心疼得不行。', '常感冒', { at: { health: -3 }, npc: { '奶奶': { favor: 2 } } }),
            oc(15, '老师说你总一个人坐在角落，不太合群。', '不合群', { at: { charm: -2, happiness: -2 } })
          ]
        })
      ]
    },

    {
      id: 'v32_in_dad_away', type: 'random', stage: '婴幼儿', weight: 3,
      family: 'dad_away', art: 'emptyHome',
      cond: function (g) { return g.age >= 1 && g.age <= 3 && (g.background === '贫困' || g.birthplace === '农村'); },
      title: '父亲的行李卷',
      text: '同村几个男人约好去南方的工地，包工头说一天八十，管住不管吃。父亲把行李卷成筒状，蹲在门槛上抽烟。母亲抱着你站在院里，问他要不要等过完年再走。他看了看你，没答。',
      opts: [
        o('让父亲去，家里需要这笔钱', { money: { cash: 6000 }, npc: { '父亲': { favor: 4 }, '母亲': { health: -2 } }, at: { happiness: -2, finance: 2 }, tag: '很小的时候父亲就外出打工' }, {
          hint: '钱回来了，人不在', tone: 'switch',
          outcomes: [
            oc(62, '父亲每月寄钱回来，过年才回一趟，你差点认不出他。', '过年才回', { at: { happiness: -2 }, money: { cash: 3000 }, npc: { '父亲': { favor: 2 } } }),
            oc(26, '工地拖了工钱，父亲空手回来，抽了很多烟。', '工钱被拖', { at: { stress: 2, happiness: -2 }, npc: { '父亲': { favor: 1 } } }),
            oc(12, '父亲在工地上受了伤，提前回了家。', '工伤', { at: { happiness: -3 }, npc: { '父亲': { health: -8, favor: 3 } } })
          ]
        }),
        o('劝父亲留在县城打零工', { money: { cash: -2500 }, npc: { '父亲': { favor: 6, health: -2 } }, at: { happiness: 2 }, tag: '父亲为了你留在了县城' }, {
          hint: '收入少，但一家人在一处', tone: 'safe',
          outcomes: [
            oc(66, '父亲在县城蹬三轮，晚上总能回家吃饭。', '留在县城', { at: { happiness: 3 }, npc: { '父亲': { favor: 3 } } }),
            oc(34, '活少的时候，父亲在家坐不住，脾气也大了些。', '收入不稳', { at: { stress: 2, happiness: -1 }, npc: { '父亲': { favor: -2 } } })
          ]
        }),
        o('跟着母亲去村口送他', { npc: { '父亲': { favor: 6 }, '母亲': { favor: 3 } }, at: { happiness: 1 }, tag: '记得父亲走的那天，母亲抱着你站在村口' }, {
          tone: 'safe',
          outcomes: [
            oc(68, '父亲上车前摸了摸你的脸，车开走很久母亲还站着。', '送行', { at: { happiness: 1 }, npc: { '母亲': { favor: 2 } } }),
            oc(32, '你伸手去抓他的行李卷，他差点没走成。', '差点没走成', { at: { happiness: 2 }, npc: { '父亲': { favor: 3 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_in_mom_back', type: 'random', stage: '婴幼儿', weight: 2,
      family: 'mom_work', art: 'office',
      cond: function (g) { return g.age >= 2 && g.age <= 3 && (g.background === '中产' || g.background === '普通工薪' || g.background === '富裕'); },
      title: '母亲要回去上班',
      text: '母亲的产假到头了。单位在电话里问她还回不回去，岗位留到月底。她把你的衣服叠好放进柜子，又把奶奶的电话号码写在一张纸上贴在冰箱上。父亲说，要不就先别去。',
      opts: [
        o('让母亲回去上班，奶奶带你', { money: { cash: 5000 }, npc: { '母亲': { favor: -2 }, '奶奶': { favor: 4 } }, at: { happiness: -1 }, tag: '两岁多起主要是奶奶带我' }, {
          hint: '家里多一份收入', tone: 'safe',
          outcomes: [
            oc(65, '母亲重新上班，家里的钱松快了，你却常在门口等她。', '母亲上班', { at: { happiness: -1, finance: 1 } }),
            oc(35, '奶奶带不过来，母亲下班还得做饭洗衣，累得话都少了。', '两头忙', { at: { stress: 2 }, npc: { '母亲': { health: -3 } } })
          ]
        }),
        o('母亲请长假，陪你到上幼儿园', { money: { cash: -12000 }, npc: { '母亲': { favor: 8 } }, at: { happiness: 3, health: 1 }, tag: '母亲请长假陪你到上幼儿园' }, {
          hint: '收入和职位都会受影响', tone: 'safe',
          outcomes: [
            oc(68, '母亲在家陪了你一年，你后来记得她讲过的每一个故事。', '母亲陪一年', { at: { happiness: 3 } }),
            oc(20, '长假回来，母亲的岗位已经有人顶了。', '岗位被顶', { at: { finance: -1 }, npc: { '母亲': { favor: 1 } } }),
            oc(12, '家里一份收入撑着，父亲明显焦虑了一阵。', '家里紧', { at: { stress: 2 }, npc: { '父亲': { favor: -1 } } })
          ]
        }),
        o('父亲调班在家带你', { npc: { '父亲': { favor: 6, health: -2 } }, money: { cash: -4000 }, at: { happiness: 2, charm: 1 }, tag: '两岁多时父亲调班在家带你' }, {
          hint: '父亲会被单位记一笔', tone: 'switch',
          outcomes: [
            oc(60, '父亲学着冲奶粉、换尿布，做得比想象中好。', '父亲带娃', { at: { happiness: 3 }, npc: { '父亲': { favor: 2 } } }),
            oc(40, '父亲在单位被领导点名，年底奖金少了。', '奖金少了', { money: { cash: -3000 }, npc: { '父亲': { favor: 2 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_in_checkup', type: 'random', stage: '婴幼儿', weight: 2,
      family: 'infant_clinic', art: 'clinic',
      cond: function (g) { return g.age >= 1 && g.age <= 3 && sickly(g); },
      title: '复查本上的一行字',
      text: '复查本上又写了一行字，医生说发育比同龄孩子慢一点，建议三个月后再来。母亲把本子收进包里，反复折了折。邻座的孩子在走廊里跑，你靠在她肩上，没什么力气。',
      opts: [
        o('按医生说的，按时复查', { money: { cash: -2200 }, npc: { '母亲': { favor: 4 }, '医生': { favor: 4 } }, at: { health: 2 }, tag: '小时候按时复查，慢慢补了回来' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '三个月后指标追上了，医生在复查本上画了个勾。', '追上了', { at: { health: 3, happiness: 2 } }),
            oc(24, '指标反复了一阵，母亲把复查的日期记在日历上。', '反复', { at: { health: -1 }, npc: { '母亲': { favor: 2 } } }),
            oc(10, '查出一个小问题，需要长期吃药。', '长期吃药', { money: { cash: -3000 }, at: { health: -2 }, set: { on_med_child: true } })
          ]
        }),
        o('换一家大医院再看看', { money: { cash: -4500 }, npc: { '母亲': { favor: 2 }, '医生': { favor: 2 } }, at: { health: 1, stress: 1 }, tag: '小时候为身体跑过大医院' }, {
          hint: '挂号难，花费高', tone: 'switch',
          outcomes: [
            oc(55, '大医院的医生说不算严重，母亲当场哭了。', '虚惊一场', { at: { health: 2, happiness: 3 }, npc: { '母亲': { favor: 3 } } }),
            oc(30, '两家说法不一样，母亲更不知道听谁的。', '说法不一', { at: { stress: 3, happiness: -2 } }),
            oc(15, '大医院开了更细的检查，确实查出一点隐患。', '查出隐患', { money: { cash: -2000 }, at: { health: -1 }, set: { weak_child: true } })
          ]
        }),
        o('听奶奶的，多晒太阳多吃饭', { npc: { '奶奶': { favor: 4 }, '母亲': { favor: -2 } }, at: { health: 1, happiness: 1 }, tag: '小时候奶奶主张多晒太阳多吃饭' }, {
          hint: '不花钱，但要看命', tone: 'safe',
          outcomes: [
            oc(50, '奶奶每天抱你到院里晒太阳，你慢慢结实了。', '晒太阳', { at: { health: 3 } }),
            oc(50, '拖了半年才复查，医生说错过了最好的时间。', '错过时间', { at: { health: -4, happiness: -2 }, npc: { '母亲': { favor: -2 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_in_photo', type: 'random', stage: '婴幼儿', weight: 2,
      family: 'hundred_day', art: 'nursery',
      cond: function (g) { return g.age >= 0 && g.age <= 1 && (g.background === '富裕' || g.background === '中产'); },
      title: '百天照',
      text: '照相馆的灯打得很亮，摄影师让你躺在绒布上，把手臂摆成一个姿势。母亲在旁边拿着拨浪鼓，父亲站在门外接电话。拍完他们问，要不要多选几张做成相册。',
      opts: [
        o('做一本相册，多选二十张', { money: { cash: -3800 }, npc: { '母亲': { favor: 4 } }, at: { happiness: 3 }, tag: '百天拍了一整本相册' }, {
          hint: '相册会一直放在柜子里', tone: 'safe',
          outcomes: [
            oc(70, '相册后来放在柜子最上层，每年过年都会被翻出来一次。', '相册', { at: { happiness: 2, charm: 1 } }),
            oc(30, '拍到最后你哭了，照片里有一张是闭着眼睡的。', '拍哭了', { at: { happiness: 1 }, npc: { '母亲': { favor: 2 } } })
          ]
        }),
        o('只拍一张，留个纪念', { money: { cash: -600 }, npc: { '母亲': { favor: 1 } }, at: { happiness: 1 }, tag: '百天只拍了一张照片' }, {
          tone: 'safe',
          outcomes: [
            oc(65, '那张照片后来夹在户口本里，纸边都磨白了。', '一张照片', { at: { happiness: 2 } }),
            oc(35, '母亲后来说有点后悔，觉得该多留几张。', '母亲后悔', { at: { happiness: -1 }, npc: { '母亲': { favor: 1 } } })
          ]
        }),
        o('不拍了，把钱留着', { money: { cash: 2000 }, npc: { '母亲': { favor: -2 } }, at: { happiness: -1, finance: 1 }, tag: '百天没有去照相馆' }, {
          hint: '省下的钱不多', tone: 'safe',
          outcomes: [
            oc(55, '家里后来用手机拍了一张，洗出来贴在墙上。', '手机拍一张', { at: { happiness: 1 } }),
            oc(45, '母亲念叨了好几年，说别人家孩子都有相册。', '母亲念叨', { at: { happiness: -2 }, npc: { '母亲': { favor: -2 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_in_village', type: 'random', stage: '婴幼儿', weight: 2,
      family: 'back_village', art: 'home',
      cond: function (g) { return g.age >= 2 && g.age <= 3 && (g.birthplace === '农村' || g.birthplace === '小城'); },
      title: '回外婆家过夏',
      text: '外婆家在山那边的村子，院里有一棵老柿子树。母亲说回去住一个夏天，空气好，也省点开销。你从没见过那么多鸡，一下车就往回跑，撞在门槛上。',
      opts: [
        o('留下，跟外婆过一整个夏天', { npc: { '外婆': { favor: 8 }, '母亲': { favor: 2 } }, at: { health: 2, happiness: 3 }, tag: '两岁那年在外婆家过了一整个夏天' }, {
          tone: 'safe',
          outcomes: [
            oc(72, '外婆每天给你摘一个柿子，你后来一直记得那个甜味。', '柿子', { at: { happiness: 3, health: 1 } }),
            oc(28, '你水土不服，拉了两天肚子，外婆急得去镇上买药。', '水土不服', { at: { health: -2 }, npc: { '外婆': { favor: 2 } } })
          ]
        }),
        o('住半个月就回城里', { npc: { '外婆': { favor: 2 }, '母亲': { favor: 1 } }, at: { happiness: 1 }, tag: '小时候只在外婆家住了半个月' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '走的时候外婆站在村口，往你兜里塞了糖。', '村口送别', { at: { happiness: 2 }, npc: { '外婆': { favor: 2 } } }),
            oc(40, '你舍不得鸡和狗，上车前哭了一阵。', '舍不得', { at: { happiness: -1 } })
          ]
        }),
        o('不去了，留在城里', { npc: { '母亲': { favor: -2 }, '外婆': { favor: -3 } }, at: { happiness: -1 }, tag: '小时候没有去外婆家过夏' }, {
          tone: 'safe',
          outcomes: [
            oc(55, '母亲一个人回了趟老家，回来后话少了两天。', '母亲自己回去', { at: { happiness: -1 }, npc: { '母亲': { favor: -2 } } }),
            oc(45, '外婆托人带来一篮柿子，你吃了一个就不吃了。', '柿子寄来', { at: { happiness: 1 }, npc: { '外婆': { favor: 1 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_in_sibling_g', type: 'random', stage: '婴幼儿', weight: 3,
      family: 'sibling_share', art: 'home',
      cond: function (g) { return g.age >= 1 && g.age <= 3 && siblingRole(g, '哥哥'); },
      title: '哥哥的旧玩具',
      text: '哥哥的玩具箱放在床底下，里面有一只掉了漆的铁皮青蛙。他平时不许别人碰，今天却拿出来，在你面前上了发条。青蛙在地上一跳一跳，你伸手去抓，他赶紧又收了回去。',
      opts: [
        o('伸手去抢，抢不到就哭', { npc: { '哥哥': { favor: -2 }, '母亲': { favor: 2 } }, at: { happiness: 1, charm: 1 }, tag: '小时候和哥哥抢过玩具' }, {
          tone: 'safe',
          outcomes: [
            oc(55, '母亲过来把青蛙给了你，哥哥憋着气不说话。', '抢到手', { at: { happiness: 2 }, npc: { '哥哥': { favor: -3 } } }),
            oc(45, '哥哥把青蛙举高，你够不着，哭得更大声。', '够不着', { at: { happiness: -2 }, npc: { '母亲': { favor: 2 } } })
          ]
        }),
        o('等哥哥玩完再借', { npc: { '哥哥': { favor: 6 } }, at: { happiness: 2, charm: 1 }, tag: '小时候学会了等哥哥玩完' }, {
          tone: 'safe',
          outcomes: [
            oc(70, '哥哥玩完后把青蛙递给你，还教你怎么上发条。', '借到玩具', { at: { happiness: 3 }, npc: { '哥哥': { favor: 3 } } }),
            oc(30, '他玩着玩着就忘了，你等到睡着。', '等到睡着', { at: { happiness: -1 }, npc: { '哥哥': { favor: 1 } } })
          ]
        }),
        o('去找母亲，让母亲说哥哥', { npc: { '母亲': { favor: 3 }, '哥哥': { favor: -5 } }, at: { happiness: 1, stress: 1 }, tag: '小时候常为玩具告哥哥的状' }, {
          hint: '哥哥会记很久', tone: 'switch',
          outcomes: [
            oc(55, '母亲说了哥哥两句，他把青蛙扔在地上就走了。', '哥哥赌气', { at: { happiness: 1 }, npc: { '哥哥': { favor: -3 } } }),
            oc(45, '母亲各打五十大板，把青蛙收进了柜子。', '玩具被收走', { at: { happiness: -2 }, npc: { '母亲': { favor: 1 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_in_sibling_j', type: 'random', stage: '婴幼儿', weight: 3,
      family: 'sibling_share', art: 'home',
      cond: function (g) { return g.age >= 1 && g.age <= 3 && siblingRole(g, '姐姐'); },
      title: '姐姐的书包',
      text: '姐姐放学回来，把书包挂在椅背上，里面有一本带图画的书。你趁她洗手，把书拖到地上翻。她出来看见，先是想发火，看到你正指着画上的兔子，又把话咽了回去。',
      opts: [
        o('指着兔子，要她讲', { npc: { '姐姐': { favor: 7 }, '母亲': { favor: 2 } }, at: { happiness: 3, knowledge: 2 }, tag: '小时候姐姐常给你讲书' }, {
          tone: 'safe',
          outcomes: [
            oc(72, '姐姐把书摊在腿上，一页页给你讲，讲到你睡着。', '姐姐讲书', { at: { happiness: 3, knowledge: 2 } }),
            oc(28, '她讲了两页就不耐烦，把书收了回去。', '讲了两页', { at: { happiness: -1 }, npc: { '姐姐': { favor: 1 } } })
          ]
        }),
        o('把书撕了一页', { npc: { '姐姐': { favor: -6 }, '母亲': { favor: -2 } }, at: { happiness: -2, charm: -1 }, tag: '小时候撕过姐姐的书' }, {
          hint: '她会记很久', tone: 'risk',
          outcomes: [
            oc(55, '姐姐哭了，母亲罚你站墙根，你站不到一分钟就坐下了。', '被罚站', { at: { happiness: -2 }, npc: { '姐姐': { favor: -3 } } }),
            oc(45, '姐姐反而没告诉母亲，只是把书收得更高了。', '姐姐没告状', { at: { happiness: 1 }, npc: { '姐姐': { favor: -2 } } })
          ]
        }),
        o('把书放回去，去玩别的', { npc: { '姐姐': { favor: 3 } }, at: { happiness: 1, knowledge: 1 }, tag: '小时候很早就学会了不碰姐姐的东西' }, {
          tone: 'safe',
          outcomes: [
            oc(65, '姐姐发现书原样在桌上，后来对你宽了不少。', '原样放回', { at: { happiness: 2 }, npc: { '姐姐': { favor: 3 } } }),
            oc(35, '你其实想听故事，只是没说出口。', '没说出口', { at: { happiness: -1 } })
          ]
        })
      ]
    },

    {
      id: 'v32_in_tv', type: 'random', stage: '婴幼儿', weight: 2,
      family: 'infant_tv', art: 'home',
      cond: function (g) { return g.age >= 2 && g.age <= 3; },
      title: '电视机前的下午',
      text: '下午的电视里在放动画片，奶奶在厨房择菜。你搬个小板凳坐在电视机前，一看就是一个小时。母亲下班回来，摸了摸电视后盖，说这么烫，眼睛要看坏了。',
      opts: [
        o('继续看，奶奶也不管', { npc: { '奶奶': { favor: 2 }, '母亲': { favor: -2 } }, at: { happiness: 2, health: -1 }, tag: '小时候每天看很久电视' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '你把动画片里的台词背了下来，逗得全家笑。', '背台词', { at: { charm: 2, happiness: 2 } }),
            oc(40, '后来查视力，医生说有点散光。', '散光', { at: { health: -2 }, npc: { '母亲': { favor: -1 } } })
          ]
        }),
        o('听母亲的，每天只看半小时', { npc: { '母亲': { favor: 4 } }, at: { happiness: 1, knowledge: 1, health: 1 }, tag: '小时候看电视被母亲管着时间' }, {
          tone: 'safe',
          outcomes: [
            oc(70, '母亲给你定了个规矩，你居然一直守着。', '守着规矩', { at: { health: 2, happiness: 1 } }),
            oc(30, '你偷偷多看了一会儿，被母亲发现，电视被关了。', '偷偷看', { at: { happiness: -2 }, npc: { '母亲': { favor: -1 } } })
          ]
        }),
        o('跟奶奶去院子里玩', { npc: { '奶奶': { favor: 4 }, '母亲': { favor: 2 } }, at: { health: 2, happiness: 2 }, tag: '小时候更愿意在院子里玩' }, {
          tone: 'safe',
          outcomes: [
            oc(68, '院子里有蚂蚁和影子，你玩得比看电视还起劲。', '院子里玩', { at: { health: 2, happiness: 2 } }),
            oc(32, '你被蚊子咬了一腿包，奶奶拿花露水给你抹。', '蚊子咬', { at: { health: -1 }, npc: { '奶奶': { favor: 2 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_in_bath', type: 'random', stage: '婴幼儿', weight: 2,
      family: 'infant_bath', art: 'home',
      cond: function (g) { return g.age >= 1 && g.age <= 3 && (g.birthplace === '农村' || g.background === '贫困'); },
      title: '灶台上的热水',
      text: '家里没有热水器，洗澡要先在灶上烧一壶水，倒进大盆里。母亲用手背试了试温度，把你放进去，你蹬了一地水。奶奶在边上递毛巾，说水别太烫。',
      opts: [
        o('洗完裹进棉被，抱到炕上', { npc: { '母亲': { favor: 4 }, '奶奶': { favor: 3 } }, at: { health: 1, happiness: 2 }, tag: '小时候在灶台边的大盆里洗澡' }, {
          tone: 'safe',
          outcomes: [
            oc(70, '你洗得满脸通红，裹进棉被很快就睡着了。', '洗完就睡', { at: { health: 2, happiness: 2 } }),
            oc(30, '水有点凉，你打了两个喷嚏，母亲懊恼了半天。', '水凉了', { at: { health: -1 }, npc: { '母亲': { favor: 1 } } })
          ]
        }),
        o('父亲带你去镇上的澡堂', { money: { cash: -200 }, npc: { '父亲': { favor: 5 } }, at: { happiness: 3, health: 1 }, tag: '小时候父亲带你去镇上澡堂' }, {
          hint: '一年也去不了几次', tone: 'safe',
          outcomes: [
            oc(60, '澡堂里热气腾腾，父亲给你搓背，你疼得直躲。', '搓背', { at: { happiness: 2, health: 1 } }),
            oc(40, '澡堂人太多，你们排了很久，出来时天都黑了。', '排队', { at: { happiness: -1 }, npc: { '父亲': { favor: 2 } } })
          ]
        }),
        o('冬天就少洗几次', { npc: { '母亲': { favor: -1 } }, at: { health: -1, happiness: -1 }, tag: '小时候冬天很少洗澡' }, {
          tone: 'safe',
          outcomes: [
            oc(55, '身上痒，母亲给你抹了点药膏。', '身上痒', { at: { health: -1 }, npc: { '母亲': { favor: 1 } } }),
            oc(45, '你得了湿疹，去镇上看了两次。', '湿疹', { money: { cash: -300 }, at: { health: -2 } })
          ]
        })
      ]
    },

    {
      id: 'v32_in_visit', type: 'random', stage: '婴幼儿', weight: 2,
      family: 'infant_visit', art: 'home',
      cond: function (g) { return g.age >= 1 && g.age <= 3; },
      title: '来串门的亲戚',
      text: '周末来了几个亲戚，屋里坐满了人。有人把你抱起来举高，有人问会不会走路了，还有人塞了个红包给母亲。你被传来传去，最后在一个人怀里睡着了。',
      opts: [
        o('被亲戚们轮流抱着', { npc: { '母亲': { favor: 3 }, '亲戚': { favor: 3 } }, at: { happiness: 2, charm: 2 }, tag: '小时候被亲戚轮着抱' }, {
          tone: 'safe',
          outcomes: [
            oc(68, '你在一个远房舅舅怀里睡了一下午，醒来时人已经走了。', '睡在亲戚怀里', { at: { happiness: 2, charm: 1 } }),
            oc(32, '一个小孩逗得太凶，你被吓哭了。', '被吓哭', { at: { happiness: -2, charm: -1 } })
          ]
        }),
        o('只认母亲，谁抱都哭', { npc: { '母亲': { favor: 6 }, '亲戚': { favor: -2 } }, at: { happiness: 1, charm: -1 }, tag: '小时候只认母亲' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '母亲只好一直抱着你，亲戚说她惯坏了。', '只认母亲', { at: { happiness: 1 }, npc: { '母亲': { favor: 2 } } }),
            oc(40, '后来你慢慢也能让别人抱了，但只肯几秒钟。', '慢慢放开', { at: { charm: 2 }, npc: { '母亲': { favor: 2 } } })
          ]
        }),
        o('把红包塞回亲戚手里', { money: { cash: 500 }, npc: { '亲戚': { favor: 5 }, '母亲': { favor: 2 } }, at: { happiness: 2, charm: 1 }, tag: '小时候把红包往回塞，逗笑了亲戚' }, {
          hint: '大人们觉得这孩子有意思', tone: 'safe',
          outcomes: [
            oc(60, '亲戚笑说你懂事，又把红包塞回你兜里。', '红包又回来了', { money: { cash: 500 }, at: { happiness: 2, charm: 2 } }),
            oc(40, '亲戚脸上有点挂不住，母亲赶紧打圆场。', '场面尴尬', { at: { happiness: -1 }, npc: { '亲戚': { favor: 1 } } })
          ]
        })
      ]
    }
  ]);

  /* =========================================================
     三、4–12 岁：同伴、老师、家庭差异（22 条）
     ========================================================= */
  add([
    {
      id: 'v32_ch_first_friend', type: 'random', stage: '童年', weight: 3,
      family: 'first_friend', art: 'home',
      cond: function (g) { return g.age >= 4 && g.age <= 6; },
      title: '第一个说要走的朋友',
      text: '幼儿园大班最后一学期，你最好的朋友说他家要搬去另一个区。他把珍藏的半盒弹珠分给你，说以后还能一起玩。你握着弹珠，第一次知道“以后”是一个很远的词。',
      opts: [
        o('把最喜欢的玻璃弹珠送给他', { npc: { '朋友': { intimacy: 8, favor: 4 } }, kindness: { role: '朋友', kind: 'gift', text: '幼儿园时把最喜欢的弹珠送给了要搬走的朋友' }, at: { happiness: 2 }, tag: '把最爱的弹珠送给了搬走的朋友' }, {
          hint: '也许再也没见过', tone: 'safe',
          outcomes: [
            oc(70, '他收下弹珠，说等安顿好就给你写信。你等了很久，没等到。', '没有回信', { at: { happiness: 1, charm: 2 } }),
            oc(30, '很多年后你们在同学会上重逢，他还记得那颗弹珠。', '多年后重逢', { npc: { '朋友': { intimacy: 10 } }, at: { happiness: 3 } })
          ]
        }),
        o('跟他拉钩，说一定会去找他', { npc: { '朋友': { intimacy: 10, favor: 3 } }, at: { happiness: 3, charm: 2 }, tag: '和搬走的朋友拉过钩' }, {
          tone: 'safe',
          outcomes: [
            oc(65, '你们拉了钩，他走的那天你在幼儿园门口站了很久。', '拉钩', { at: { happiness: 2 } }),
            oc(35, '你把“去找他”这件事记了很多年，后来真的去了一次。', '真去找过', { money: { cash: -200 }, at: { happiness: 3 } })
          ]
        }),
        o('假装不在意，转头去玩别的', { npc: { '朋友': { intimacy: -4 } }, at: { happiness: -2, charm: -1 }, tag: '朋友搬走那天装作不在意' }, {
          hint: '你会后悔', tone: 'safe',
          outcomes: [
            oc(55, '他走的时候你只顾着玩积木，回头人已经不见了。', '没送别', { at: { happiness: -2 } }),
            oc(45, '晚上你抱着那半盒弹珠哭了，母亲问你怎么了，你说没事。', '夜里哭了', { at: { happiness: -1, charm: 1 }, npc: { '母亲': { favor: 2 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_ch_pocket', type: 'random', stage: '童年', weight: 3,
      family: 'allowance', art: 'money',
      cond: function (g) { return g.age >= 6 && g.age <= 9; },
      title: '第一笔零花钱',
      text: '母亲第一次按月给你零花钱，一个月十块，装在信封里。她说花完了就没了，别跟别人比。你攥着那张十块，在文具店门口站了很久，玻璃柜里有一把带锁的日记本。',
      opts: [
        o('买那本带锁的日记本', { money: { cash: -10 }, npc: { '母亲': { favor: 2 } }, at: { happiness: 3, knowledge: 1 }, tag: '用第一笔零花钱买了带锁日记本' }, {
          tone: 'safe',
          outcomes: [
            oc(72, '你在本子上写了第一行字，锁上之后觉得自己长大了。', '日记本', { at: { happiness: 3, knowledge: 2 } }),
            oc(28, '钥匙两天就丢了，你撬了很久才打开。', '钥匙丢了', { at: { happiness: -1 } })
          ]
        }),
        o('全买了辣条，请同学一起吃', { money: { cash: -10 }, npc: { '同学': { intimacy: 8 }, '母亲': { favor: -2 } }, at: { happiness: 3 }, tag: '第一笔零花钱请同学吃了辣条' }, {
          hint: '母亲会不高兴', tone: 'switch',
          outcomes: [
            oc(60, '一群人蹲在操场边吃辣条，你成了那天的中心。', '请客', { at: { happiness: 3, charm: 2 } }),
            oc(40, '有个同学吃完闹肚子，他家长找到学校，你被点名。', '闹肚子', { at: { happiness: -2, stress: 2 }, npc: { '老师': { favor: -2 } } })
          ]
        }),
        o('一分不花，攒进铁盒里', { money: { cash: 10 }, npc: { '母亲': { favor: 4 } }, at: { happiness: -1, finance: 1 }, tag: '从小就把零花钱攒在铁盒里' }, {
          tone: 'safe',
          outcomes: [
            oc(65, '铁盒越攒越沉，你偶尔拿出来数一遍，又放回去。', '攒钱', { at: { finance: 1, happiness: 1 } }),
            oc(35, '后来家里急用钱，母亲把铁盒拿走了，说以后再还你。', '铁盒被拿走', { money: { cash: -200 }, at: { happiness: -2 }, npc: { '母亲': { favor: 1 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_ch_pet', type: 'random', stage: '童年', weight: 2,
      family: 'pet', art: 'home',
      cond: function (g) { return g.age >= 5 && g.age <= 9; },
      title: '巷子里的小狗',
      text: '巷子口有一只被人丢下的小狗，瘦得肋骨都看得见。你每天放学给它带半个馒头，它开始在你家门口等。母亲说不许带进屋，父亲说养狗要打针，还要花钱。',
      opts: [
        o('求父母把它留下', { money: { cash: -600 }, npc: { '父亲': { favor: 3 }, '母亲': { favor: 2 }, '小狗': { favor: 8 } }, at: { happiness: 4 }, tag: '小时候收养了一只流浪狗' }, {
          hint: '要打针、要喂、要人遛', tone: 'safe',
          outcomes: [
            oc(68, '父亲嘴上不情愿，第二天还是带它去打了针。', '留下', { at: { happiness: 4, health: 1 } }),
            oc(20, '母亲坚决不同意，你只能每天在门口喂它。', '没能进屋', { at: { happiness: 1 }, npc: { '小狗': { favor: 3 } } }),
            oc(12, '小狗后来自己走了，你在巷子口等了半个月。', '自己走了', { at: { happiness: -4 } })
          ]
        }),
        o('偷偷把馒头省下来喂它', { npc: { '小狗': { favor: 6 } }, at: { happiness: 3, health: -1 }, tag: '小时候省下早饭喂一只流浪狗' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '它认得你的脚步声，远远就跑过来。', '认得脚步声', { at: { happiness: 3 } }),
            oc(40, '母亲发现你早饭没吃，把你说了一顿。', '被母亲发现', { at: { health: -2, happiness: -1 }, npc: { '母亲': { favor: -1 } } })
          ]
        }),
        o('听大人的，不再喂了', { npc: { '小狗': { favor: -3 } }, at: { happiness: -3, charm: -1 }, tag: '小时候被大人劝住，没有再喂那只流浪狗' }, {
          hint: '你会一直记得它', tone: 'safe',
          outcomes: [
            oc(55, '几天后小狗不见了，你放学路过巷口还是会看两眼。', '它不见了', { at: { happiness: -3 } }),
            oc(45, '它被隔壁巷子的人家收留了，你远远看见过它一次。', '被人收留', { at: { happiness: 1 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ch_teacher_fav', type: 'random', stage: '童年', weight: 2,
      family: 'teacher_fav', art: 'exam',
      cond: function (g) { return g.age >= 6 && g.age <= 9; },
      title: '老师多给的那颗星',
      text: '班主任在班会上念了你的作文，还给你多贴了一颗星。下课时有人小声说，老师就是偏心你。你听见了，装作没听见。放学后老师叫住你，让你帮她收作业本。',
      opts: [
        o('答应帮老师收本子', { npc: { '老师': { intimacy: 8, favor: 4 }, '同学': { favor: -2 } }, at: { happiness: 2, knowledge: 1 }, tag: '小学时被老师偏爱，常帮着收作业' }, {
          tone: 'safe',
          outcomes: [
            oc(65, '你收了整整一学期本子，老师后来推荐你去参加征文。', '被推荐', { at: { knowledge: 3, happiness: 2 } }),
            oc(35, '同学因此在背后议论你，你的朋友少了一阵。', '被同学疏远', { at: { charm: -2, happiness: -2 }, npc: { '同学': { intimacy: -6 } } })
          ]
        }),
        o('把多给的星让给同桌', { npc: { '同学': { intimacy: 10, favor: 5 }, '老师': { favor: 1 } }, kindness: { role: '同学', kind: 'share', text: '把老师多给的星让给了同桌' }, at: { happiness: 3, charm: 2 }, tag: '把老师多给的星让给了同桌' }, {
          hint: '老师不一定同意', tone: 'safe',
          outcomes: [
            oc(66, '同桌愣了很久，后来成了你最好的朋友。', '成了朋友', { at: { happiness: 3 }, npc: { '同学': { intimacy: 12 } } }),
            oc(34, '老师说你傻，星星还是贴在了你本子上。', '老师不同意', { at: { happiness: 1 }, npc: { '老师': { favor: 1 } } })
          ]
        }),
        o('装作不在意，放学就跑', { npc: { '老师': { favor: -3 } }, at: { happiness: -1, charm: 1 }, tag: '老师偏爱时故意躲开' }, {
          tone: 'safe',
          outcomes: [
            oc(55, '老师没说什么，只是后来很少点你的名字。', '不再被点名', { at: { happiness: -2 }, npc: { '老师': { favor: -3 } } }),
            oc(45, '你其实很想被表扬，回家把作文本翻了很多遍。', '想被表扬', { at: { happiness: 1, knowledge: 1 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ch_unfair', type: 'random', stage: '童年', weight: 2,
      family: 'unfair', art: 'exam',
      cond: function (g) { return g.age >= 7 && g.age <= 10; },
      title: '黑板上的粉笔灰',
      text: '教室后墙的玻璃被打碎了，那天只有你和另外两个同学留在教室。班主任问是谁干的，有人指了指你。你说不是你，声音有点抖。全班都看着你。',
      opts: [
        o('坚持说不是自己，要求查', { npc: { '老师': { favor: 1 }, '同学': { favor: -4 } }, at: { stress: 3, happiness: -2, charm: 2 }, tag: '小学时被冤枉过一次，坚持查了下去' }, {
          hint: '会被说成顶嘴', tone: 'switch',
          outcomes: [
            oc(60, '后来在窗台找到了弹弓，真相清楚了，老师当众说了抱歉。', '真相大白', { at: { happiness: 4, charm: 2 }, npc: { '老师': { favor: 3 } } }),
            oc(40, '没人再查，这件事被记在了你的档案评语里。', '没人再查', { at: { happiness: -4, stress: 3 }, npc: { '老师': { favor: -3 } } })
          ]
        }),
        o('认下来，免得连累别人', { npc: { '老师': { favor: 4 }, '同学': { intimacy: 8 } }, at: { money: { cash: -80 }, happiness: -2, stress: 2 }, tag: '小学时替同学背过一次锅' }, {
          hint: '赔了玻璃钱，也换来人缘', tone: 'hard',
          outcomes: [
            oc(62, '你赔了钱，那几个同学后来对你很讲义气。', '换来义气', { npc: { '同学': { intimacy: 10 } }, at: { happiness: 1 } }),
            oc(38, '父亲被叫到学校，回家后你挨了一顿打。', '挨打', { at: { health: -2, happiness: -4 }, npc: { '父亲': { favor: -3 } } })
          ]
        }),
        o('跑回家，让母亲来处理', { npc: { '母亲': { favor: 6 }, '老师': { favor: -2 } }, at: { happiness: 1, charm: -1 }, tag: '小学被冤枉时是母亲出面解决的' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '母亲第二天到学校讲了很久，老师最终没有再提。', '母亲出面', { at: { happiness: 2 }, npc: { '母亲': { favor: 3 } } }),
            oc(40, '同学从此说你什么事都找家长。', '被说靠家长', { at: { charm: -2 }, npc: { '同学': { intimacy: -5 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_ch_transfer', type: 'random', stage: '童年', weight: 2,
      family: 'transfer', art: 'home',
      cond: function (g) { return g.age >= 7 && g.age <= 11; },
      title: '转学第一天',
      text: '父亲换了工作，全家搬到了另一个区，你也转学了。新教室的座位表上没有你的名字，老师让你先坐在最后一排。课间没有人来找你说话，你假装在整理书包。',
      opts: [
        o('主动去跟同桌搭话', { npc: { '同学': { intimacy: 7 } }, at: { charm: 3, happiness: 2 }, tag: '转学第一天主动跟同桌搭了话' }, {
          tone: 'safe',
          outcomes: [
            oc(65, '同桌借了你一支笔，你们就此说上了话。', '借笔', { at: { charm: 2, happiness: 2 } }),
            oc(35, '他爱答不理，你尴尬地坐了一节课。', '被冷落', { at: { charm: -1, happiness: -2 } })
          ]
        }),
        o('一个人坐到放学', { at: { happiness: -2, knowledge: 1 }, tag: '转学后很久才交到朋友' }, {
          tone: 'safe',
          outcomes: [
            oc(55, '你安静了半个月，后来有个女生主动来找你借橡皮。', '后来有朋友', { at: { happiness: 1 }, npc: { '同学': { intimacy: 5 } } }),
            oc(45, '那半年你几乎没跟人说话，成绩倒是上去了。', '沉默半年', { at: { knowledge: 2, charm: -2 } })
          ]
        }),
        o('放学后回原来的学校看一眼', { npc: { '发小': { intimacy: 8 } }, at: { happiness: 2, stress: 1 }, tag: '转学后一个人回过原来的学校' }, {
          hint: '路很远', tone: 'safe',
          outcomes: [
            oc(60, '你在门口看见旧同学在打球，站了一会儿没进去。', '门口站着', { at: { happiness: 1 } }),
            oc(40, '{{npc:发小}} 看见你，跑出来拉着你说了很久的话。', '发小', { npc: { '发小': { intimacy: 12 } }, at: { happiness: 4 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ch_fight', type: 'random', stage: '童年', weight: 3,
      family: 'school_fight', art: 'exam',
      cond: function (g) { return g.age >= 8 && g.age <= 11; },
      title: '操场边的推搡',
      text: '体育课自由活动，高年级的几个男生占了球架。你抱着球站在边上，其中一个推了你一把，球滚进了排水沟。他们笑着走开，你站在原地，手心全是汗。',
      opts: [
        o('追上去理论', { npc: { '同学': { intimacy: 6 }, '高年级男生': { favor: -6 } }, at: { charm: 2, stress: 3, health: -1 }, tag: '小学时跟高年级男生起过冲突' }, {
          hint: '可能挨打', tone: 'risk',
          outcomes: [
            oc(50, '你把话说清楚了，他们没再动你，但从此结下梁子。', '结下梁子', { at: { charm: 2, happiness: 1 } }),
            oc(35, '你被推倒在地，膝盖擦破一大块。', '摔倒', { at: { health: -3, happiness: -3 }, npc: { '老师': { favor: 1 } } }),
            oc(15, '有个同班同学站出来帮你，你们成了朋友。', '有人帮忙', { npc: { '同学': { intimacy: 10 } }, at: { happiness: 3 } })
          ]
        }),
        o('忍着，把球捡回来', { at: { happiness: -2, stress: 2, charm: -1 }, tag: '小学时被高年级推搡，忍了下来' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '你默默把球捡回来，继续上课，没人再提这件事。', '忍下来', { at: { happiness: -1 } }),
            oc(40, '回家后你跟母亲说了，母亲第二天去了学校。', '母亲去学校', { npc: { '母亲': { favor: 3 }, '老师': { favor: -1 } }, at: { happiness: 1 } })
          ]
        }),
        o('去告诉班主任', { npc: { '老师': { favor: 4 }, '高年级男生': { favor: -5 } }, at: { happiness: 1, charm: -1 }, tag: '小学时被欺负后告了老师' }, {
          tone: 'switch',
          outcomes: [
            oc(55, '老师把那几个男生叫去办公室，他们后来没再找你。', '老师处理', { at: { happiness: 2 } }),
            oc(45, '那几个男生知道你告状，放学后在路上堵了你。', '被堵', { at: { health: -2, happiness: -3, stress: 3 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ch_red_packet', type: 'random', stage: '童年', weight: 3,
      family: 'red_packet', art: 'money',
      cond: function (g) { return g.age >= 6 && g.age <= 12; },
      title: '压岁钱归谁',
      text: '过年收了几个红包，最多的一封是奶奶给的，用红纸包着，还写了你的名字。母亲说先替你收着，等开学交学费。你把红包藏在枕头底下，数了三遍。',
      opts: [
        o('交给母亲保管', { money: { cash: 800 }, npc: { '母亲': { favor: 5 }, '奶奶': { favor: 2 } }, at: { happiness: 1 }, tag: '压岁钱一直交给母亲保管' }, {
          tone: 'safe',
          outcomes: [
            oc(65, '母亲把钱存进一个存折，说以后都给你。', '存折', { money: { cash: 300 }, at: { finance: 1, happiness: 1 } }),
            oc(35, '开学交完学费，钱就没了，你也没再问。', '交了学费', { at: { happiness: -1 } })
          ]
        }),
        o('偷偷留一半买四驱车', { money: { cash: -200 }, npc: { '母亲': { favor: -3 }, '同学': { intimacy: 6 } }, at: { happiness: 4 }, tag: '用压岁钱偷偷买了一辆四驱车' }, {
          hint: '被发现要挨说', tone: 'switch',
          outcomes: [
            oc(58, '你买了车，在楼道里跟同学玩了一整个寒假。', '四驱车', { at: { happiness: 4, charm: 1 } }),
            oc(42, '母亲发现钱少了，问了几遍，你承认后红包被全收走。', '被发现', { at: { happiness: -3 }, npc: { '母亲': { favor: -3 } } })
          ]
        }),
        o('给奶奶买一双棉鞋', { money: { cash: -150 }, npc: { '奶奶': { favor: 9 }, '母亲': { favor: 3 } }, kindness: { role: '奶奶', kind: 'gift', text: '用压岁钱给奶奶买了双棉鞋' }, at: { happiness: 3 }, tag: '第一次用压岁钱给奶奶买了棉鞋' }, {
          tone: 'safe',
          outcomes: [
            oc(72, '奶奶把鞋放在柜子里舍不得穿，过年才拿出来。', '舍不得穿', { at: { happiness: 3 } }),
            oc(28, '鞋买小了，奶奶说正好，其实一直没穿。', '买小了', { at: { happiness: 1 }, npc: { '奶奶': { favor: 3 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_ch_rel_loan', type: 'random', stage: '童年', weight: 2,
      family: 'rel_loan', art: 'money',
      cond: function (g) { return g.age >= 9 && g.age <= 12; },
      title: '饭桌上的借钱',
      text: '叔叔来家里吃饭，酒过三巡，说起做生意差一笔周转。父亲没接话，母亲在桌下踢了他一下。叔叔把目光转向你，说侄子都这么大了，以后叔叔赚了钱给你买电脑。',
      opts: [
        o('帮叔叔说话，劝父亲借', { money: { cash: -5000 }, npc: { '叔叔': { favor: 6 }, '父亲': { favor: -3 } }, at: { happiness: 2 }, tag: '小时候帮叔叔劝父亲借过钱' }, {
          hint: '这笔钱多半回不来', tone: 'risk',
          outcomes: [
            oc(55, '父亲借了，叔叔拍着胸口说年底就还。', '借出去了', { at: { happiness: 2, finance: -1 } }),
            oc(30, '叔叔后来只还了一半，父亲再没提过。', '只还一半', { at: { happiness: -2 }, npc: { '叔叔': { favor: 2 } } }),
            oc(15, '叔叔的生意赔了，两家为这笔钱生分了好几年。', '生意赔了', { at: { happiness: -3, stress: 2 }, npc: { '叔叔': { favor: -4 } } })
          ]
        }),
        o('低头吃饭，不插话', { at: { happiness: -1 }, npc: { '父亲': { favor: 1 } }, tag: '亲戚借钱时低头吃饭，没有插话' }, {
          tone: 'safe',
          outcomes: [
            oc(62, '父亲最后没有借，叔叔走的时候脸色不好看。', '没有借', { at: { happiness: -1 } }),
            oc(38, '母亲后来还是借了一点，叔叔说这孩子懂事。', '借了一点', { money: { cash: -1000 }, at: { happiness: 1 }, npc: { '叔叔': { favor: 2 } } })
          ]
        }),
        o('把攒的零花钱拿出来', { money: { cash: -300 }, npc: { '叔叔': { favor: 4 }, '父亲': { favor: 2 } }, kindness: { role: '叔叔', kind: 'help', text: '把攒的零花钱拿给叔叔应急' }, at: { happiness: 2 }, tag: '把攒的零花钱拿给叔叔应急' }, {
          hint: '叔叔会记着', tone: 'safe',
          outcomes: [
            oc(65, '叔叔愣了一下，摸了摸你的头，说这钱他记着。', '记着', { at: { happiness: 2 }, npc: { '叔叔': { favor: 3 } } }),
            oc(35, '叔叔笑着推回来，说小孩子留着买本子。', '被推回来', { money: { cash: 300 }, at: { happiness: 1 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ch_move_house', type: 'random', stage: '童年', weight: 2,
      family: 'move_house', art: 'emptyHome',
      cond: function (g) { return g.age >= 7 && g.age <= 12; },
      title: '搬家那天的纸箱',
      text: '家里换了住处，从旧楼搬到城另一头的新楼。家具捆在三轮车上，母亲让你抱着自己的奖状。你在新房的阳台上往下看，楼下的孩子成群地跑，没有一个你认识。',
      opts: [
        o('下楼认识新邻居', { npc: { '同学': { intimacy: 7 } }, at: { charm: 2, happiness: 2 }, tag: '搬到新家后主动下楼认识了新邻居' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '楼下几个孩子正缺人凑数，你很快加入了。', '加入', { at: { charm: 2, happiness: 2 }, npc: { '同学': { intimacy: 8 } } }),
            oc(34, '他们只是看了你一眼，你站在边上很久。', '被忽视', { at: { happiness: -2, charm: -1 } })
          ]
        }),
        o('给 {{npc:发小}} 打电话说新地址', { npc: { '发小': { intimacy: 10 } }, at: { happiness: 2 }, tag: '搬家后给发小打了电话' }, {
          tone: 'safe',
          outcomes: [
            oc(68, '{{npc:发小}} 在电话那头说，等你回来一起玩。', '电话', { at: { happiness: 3 }, npc: { '发小': { intimacy: 5 } } }),
            oc(32, '电话是他妈妈接的，说他去外婆家了。', '没通上话', { at: { happiness: -1 } })
          ]
        }),
        o('把自己的旧东西全扔了', { at: { happiness: -2, charm: -1 }, tag: '搬家时扔掉了小时候的东西' }, {
          tone: 'safe',
          outcomes: [
            oc(55, '扔完之后你后悔了，夜里偷偷去楼下翻纸箱。', '后悔', { at: { happiness: -3 } }),
            oc(45, '母亲把奖状一张张夹进了书里，你后来才知道。', '奖状被收好', { at: { happiness: 2 }, npc: { '母亲': { favor: 3 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_ch_left_behind', type: 'random', stage: '童年', weight: 3,
      family: 'left_behind', art: 'home',
      cond: function (g) { return g.age >= 5 && g.age <= 10 && (g.marks && g.marks['left_behind'] === true); },
      title: '暑假的村口',
      text: '父亲在外地打工，母亲也在厂里，暑假把你送回村里跟奶奶过。村口的水泥路修了一半，你每天下午坐在树下等电话。奶奶说你又长高了，可父亲只在电话里问成绩。',
      opts: [
        o('每天去村口等父亲的电话', { npc: { '奶奶': { favor: 4 }, '父亲': { favor: 3 } }, at: { happiness: 1, health: 1 }, tag: '留守的暑假每天去村口等电话' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '电话每周来一次，父亲说话很短，你总舍不得先挂。', '舍不得挂', { at: { happiness: 1 }, npc: { '父亲': { favor: 2 } } }),
            oc(40, '有一次电话没打来，你在树下坐到天黑。', '没等到', { at: { happiness: -3 }, npc: { '奶奶': { favor: 2 } } })
          ]
        }),
        o('跟村里的孩子满山跑', { npc: { '发小': { intimacy: 9 } }, at: { health: 2, happiness: 3, knowledge: 1 }, tag: '留守的暑假在村里满山跑' }, {
          tone: 'safe',
          outcomes: [
            oc(68, '你学会了摸鱼、爬树、认野菜，晒得像块炭。', '野孩子', { at: { health: 3, happiness: 2 } }),
            oc(32, '你从树上摔下来，奶奶拿着扫帚追了半个村。', '摔下来', { at: { health: -2 }, npc: { '奶奶': { favor: 2 } } })
          ]
        }),
        o('一个人待在家里看电视', { at: { happiness: -1, knowledge: -1, health: -1 }, tag: '留守的暑假一个人在家看电视' }, {
          tone: 'safe',
          outcomes: [
            oc(55, '你看了整整一个暑假，开学时黑板上的字有些看不清了。', '视力下降', { at: { health: -2 } }),
            oc(45, '奶奶把电视关了，拉着你去河边洗衣服。', '被拉出去', { at: { health: 1, happiness: 1 }, npc: { '奶奶': { favor: 3 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_ch_grandcare', type: 'random', stage: '童年', weight: 3,
      family: 'grandcare2', art: 'home',
      cond: function (g) { return g.age >= 4 && g.age <= 9 && (g.birthplace === '农村' || g.background === '贫困' || g.sibling !== undefined && hasSib(g)); },
      title: '奶奶的规矩',
      text: '父母忙，你大多时候跟着奶奶。奶奶有一整套规矩：饭前要洗手，天黑前必须回家，不许拿别人的东西。她说话不多，但说一遍你就得记住。',
      opts: [
        o('照着奶奶的规矩做', { npc: { '奶奶': { favor: 8 } }, at: { happiness: 1, charm: 2, health: 1 }, tag: '从小就照着奶奶的规矩做' }, {
          tone: 'safe',
          outcomes: [
            oc(70, '你成了村里大人嘴里“最听话的孩子”。', '听话', { at: { charm: 3, happiness: 1 } }),
            oc(30, '你偶尔也偷偷破例，被奶奶发现后罚站。', '罚站', { at: { happiness: -1 }, npc: { '奶奶': { favor: 2 } } })
          ]
        }),
        o('当面答应，背后照旧', { npc: { '奶奶': { favor: -2 } }, at: { happiness: 2, charm: -1 }, tag: '跟奶奶当面一套背后一套' }, {
          hint: '迟早会被发现', tone: 'switch',
          outcomes: [
            oc(55, '奶奶其实早就知道，只是一直没说。', '被看穿', { at: { happiness: -1 }, npc: { '奶奶': { favor: -1 } } }),
            oc(45, '你被抓住一次，奶奶气了很久，之后管得更严。', '被抓住', { at: { charm: -1, happiness: -2 }, npc: { '奶奶': { favor: -3 } } })
          ]
        }),
        o('跑去问父母，能不能不守这些', { npc: { '母亲': { favor: 3 }, '奶奶': { favor: -3 } }, at: { happiness: -1 }, tag: '小时候因为奶奶的规矩找过父母' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '母亲说奶奶是为你好，你只好继续守。', '母亲劝', { at: { happiness: -1 }, npc: { '奶奶': { favor: 1 } } }),
            oc(40, '父母跟奶奶为这事拌了嘴，家里气氛紧了一阵。', '家里拌嘴', { at: { stress: 2, happiness: -2 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ch_first_exam', type: 'random', stage: '童年', weight: 3,
      family: 'first_exam', art: 'exam',
      cond: function (g) { return g.age >= 6 && g.age <= 9; },
      title: '第一次发成绩单',
      text: '第一次期末成绩单发下来，你的名字排在中间。老师让家长签字，你回家的路上把纸折了又折。母亲正在厨房，围裙上沾着油，她把手擦干净才接过去。',
      opts: [
        o('如实拿给母亲看', { npc: { '母亲': { favor: 5 } }, at: { happiness: -1, knowledge: 2 }, tag: '第一次成绩单如实给了母亲看' }, {
          tone: 'safe',
          outcomes: [
            oc(65, '母亲没有骂你，只是说下次再仔细一点。', '没有骂', { at: { happiness: 1, knowledge: 2 }, npc: { '母亲': { favor: 3 } } }),
            oc(35, '母亲沉默了很久，把成绩单贴在冰箱上。', '贴在冰箱上', { at: { stress: 2, knowledge: 1 } })
          ]
        }),
        o('偷偷改成更高的分数', { npc: { '母亲': { favor: -4 }, '老师': { favor: -3 } }, at: { happiness: 2, stress: 3 }, tag: '第一次成绩单偷偷改了分数' }, {
          hint: '老师一眼就能看出来', tone: 'risk',
          outcomes: [
            oc(45, '母亲没看出来，签了字，你心跳了一路。', '蒙混过去', { at: { happiness: 1, stress: 2 } }),
            oc(40, '老师收上去就发现了，叫了家长。', '被发现', { at: { happiness: -4 }, npc: { '母亲': { favor: -4 }, '老师': { favor: -3 } } }),
            oc(15, '你改得太明显，母亲一眼就看出来，把笔放下了。', '一眼看穿', { at: { happiness: -3 }, npc: { '母亲': { favor: -3 } } })
          ]
        }),
        o('去跟考第一的同学借卷子看', { npc: { '同学': { intimacy: 7 } }, at: { knowledge: 3, happiness: 1 }, tag: '第一次考砸后借了第一名的卷子来看' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '他把卷子借给你，还讲了两道题，你听懂了。', '借卷子', { at: { knowledge: 4 } }),
            oc(34, '他说卷子要留着订正，没借给你。', '没借到', { at: { knowledge: 1 }, npc: { '同学': { intimacy: -2 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_ch_wealth_gap', type: 'random', stage: '童年', weight: 2,
      family: 'wealth_gap', art: 'home',
      cond: function (g) { return g.age >= 6 && g.age <= 11; },
      title: '同学脚上的新鞋',
      text: '同桌穿了一双新运动鞋，说是他爸从香港带的。课间大家围着看，有人问你这双鞋多少钱，你低头看了看自己脚上洗得发白的旧鞋，说不知道。',
      opts: [
        o('回家跟母亲说也想要一双', { money: { cash: -300 }, npc: { '母亲': { favor: 2 } }, at: { happiness: 2 }, tag: '小时候跟母亲要过一双新鞋' }, {
          hint: '家里未必宽裕', tone: 'switch',
          outcomes: [
            oc(55, '母亲攒了两个月，还是给你买了。', '买了', { at: { happiness: 3 }, npc: { '母亲': { favor: 3 } } }),
            oc(30, '母亲说等过年，你等到过年也没等到。', '没等到', { at: { happiness: -2 } }),
            oc(15, '母亲带你去了旧货市场，挑了一双八成新的。', '旧货市场', { money: { cash: -80 }, at: { happiness: 1 } })
          ]
        }),
        o('说自己的鞋穿着舒服', { npc: { '同学': { intimacy: 3 } }, at: { happiness: 1, charm: 2 }, tag: '小时候不跟同学比吃穿' }, {
          tone: 'safe',
          outcomes: [
            oc(65, '大家笑了一阵，也就过去了，你反而没那么在意。', '不比较', { at: { charm: 2, happiness: 1 } }),
            oc(35, '有个同学说你嘴硬，你心里堵了一下午。', '嘴硬', { at: { happiness: -2 } })
          ]
        }),
        o('把鞋擦干净，第二天照常穿', { at: { happiness: 1, charm: 1 }, tag: '小时候把旧鞋擦干净继续穿' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '你把鞋刷得很白，同桌反而问你用的什么办法。', '刷白了', { at: { charm: 2, happiness: 2 } }),
            oc(40, '鞋底开胶了，你用胶水粘上，撑了一个学期。', '开胶', { at: { health: -1 }, money: { cash: -20 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ch_city_day', type: 'random', stage: '童年', weight: 2,
      family: 'city_mix', art: 'home',
      cond: function (g) { return g.age >= 6 && g.age <= 12 && g.birthplace === '一线城市'; },
      title: '地铁末班车',
      text: '母亲带你去市中心的商场，玻璃橱窗里有你只在电视里见过的玩具。回程的地铁上人很多，你抓着母亲的衣角，看着窗外一格一格后退的灯。她说等你考好了再来。',
      opts: [
        o('记住那句话，认真学习', { at: { knowledge: 2, happiness: 1 }, npc: { '母亲': { favor: 3 } }, tag: '小时候把母亲那句“等你考好了再来”记了很久' }, {
          tone: 'safe',
          outcomes: [
            oc(68, '你把那句话记在本子第一页，成绩真的上去了。', '记住了', { at: { knowledge: 3, happiness: 2 } }),
            oc(32, '你后来考好了，母亲却实在太忙，一直没再去。', '没再去', { at: { happiness: -1 }, npc: { '母亲': { favor: 1 } } })
          ]
        }),
        o('在商场里赖着不走', { npc: { '母亲': { favor: -3 } }, at: { happiness: -2, charm: -1 }, tag: '小时候在商场里赖着不走' }, {
          hint: '母亲会很难堪', tone: 'risk',
          outcomes: [
            oc(55, '母亲拉你走，你在扶梯口哭，周围人都在看。', '哭闹', { at: { happiness: -2 }, npc: { '母亲': { favor: -3 } } }),
            oc(45, '母亲咬牙给你买了一个小的，回家后说这个月要省着吃。', '买了小的', { money: { cash: -150 }, at: { happiness: 2 }, npc: { '母亲': { favor: 1 } } })
          ]
        }),
        o('看了一会儿，主动说回家', { npc: { '母亲': { favor: 6 } }, at: { happiness: 1, charm: 2 }, tag: '小时候在商场里主动说回家' }, {
          tone: 'safe',
          outcomes: [
            oc(70, '母亲愣了一下，牵着你的手走得很慢。', '主动回家', { at: { happiness: 2 }, npc: { '母亲': { favor: 3 } } }),
            oc(30, '她还是折回去买了个便宜的，说不能白来。', '买了个便宜的', { money: { cash: -80 }, at: { happiness: 2 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ch_rural_chore', type: 'random', stage: '童年', weight: 2,
      family: 'rural_chore', art: 'home',
      cond: function (g) { return g.age >= 5 && g.age <= 11 && g.birthplace === '农村'; },
      title: '收麦子的那几天',
      text: '麦收那几天，天不亮全家就下地。你被安排在田埂上看水壶和饭盒，太阳升起来，麦芒扎得胳膊痒。父亲说，等你再大一点，就要学着割了。',
      opts: [
        o('跟着下地，学着割麦', { npc: { '父亲': { favor: 7 }, '母亲': { favor: 3 } }, at: { health: 2, charm: 1, happiness: 1 }, tag: '很小就跟着下地割过麦子' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '你割得很慢，手上磨出水泡，父亲给你挑了。', '水泡', { at: { health: 1, charm: 1 }, npc: { '父亲': { favor: 3 } } }),
            oc(34, '你不小心割到手指，母亲用布条给你缠上。', '割到手', { at: { health: -2 }, npc: { '母亲': { favor: 3 } } })
          ]
        }),
        o('守在田埂上看水壶', { npc: { '父亲': { favor: 2 } }, at: { happiness: 2, knowledge: 1 }, tag: '农忙时在田埂上看水壶和饭盒' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '你把水壶看得很紧，父亲夸了你一句。', '看水壶', { at: { happiness: 2 }, npc: { '父亲': { favor: 2 } } }),
            oc(40, '你睡着了，水壶被邻地的孩子拿走，父亲说了你两句。', '睡着了', { at: { happiness: -2 }, npc: { '父亲': { favor: -2 } } })
          ]
        }),
        o('躲到树荫下看书', { npc: { '母亲': { favor: -2 } }, at: { knowledge: 3, happiness: 1 }, tag: '农忙时躲在树荫下看书' }, {
          hint: '大人会觉得你偷懒', tone: 'switch',
          outcomes: [
            oc(55, '母亲看见了没说什么，晚上父亲却把书收了。', '书被收走', { at: { happiness: -2 }, npc: { '父亲': { favor: -2 } } }),
            oc(45, '你把一本旧课本看了好几遍，开学后成绩冒了头。', '成绩冒头', { at: { knowledge: 4 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ch_math_talent', type: 'random', stage: '童年', weight: 2,
      family: 'talent_math', art: 'exam',
      cond: function (g) { return g.age >= 8 && g.age <= 12 && LS.hasTalent(g, 'math'); },
      title: '黑板上的那道题',
      text: '数学老师在黑板上写了一道超纲题，说谁做出来就免一次作业。全班安静下来。你盯着那几个数字，脑子里像有一根线，把它一点点牵直。',
      opts: [
        o('举手上去做', { npc: { '老师': { favor: 8 }, '同学': { intimacy: 4 } }, at: { knowledge: 4, happiness: 3, charm: 1 }, tag: '小学时上台解过一道超纲题' }, {
          tone: 'safe',
          outcomes: [
            oc(70, '你写对了，老师让你把过程讲了一遍。', '做对了', { at: { knowledge: 4, happiness: 3 } }),
            oc(20, '你写到一半卡住，老师在旁边提了个醒。', '卡住', { at: { knowledge: 2 }, npc: { '老师': { favor: 3 } } }),
            oc(10, '你紧张得写错了符号，全班笑了。', '写错符号', { at: { happiness: -2, stress: 2 } })
          ]
        }),
        o('在座位上自己算，不举手', { at: { knowledge: 3, happiness: 1 }, npc: { '老师': { favor: 2 } }, tag: '小学时算出难题却不举手' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '你算出来了，写在草稿纸上，谁也没给看。', '自己算', { at: { knowledge: 3 } }),
            oc(40, '老师点名让你回答，你站起来说对了，全班鼓掌。', '被点名', { at: { knowledge: 3, charm: 2, happiness: 2 } })
          ]
        }),
        o('跟同桌一起推', { npc: { '同学': { intimacy: 8 } }, at: { knowledge: 2, happiness: 2, charm: 1 }, tag: '小时候跟同桌一起推过数学题' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '你们一起推出来了，同桌后来总找你做题。', '一起做题', { at: { knowledge: 3, happiness: 2 }, npc: { '同学': { intimacy: 6 } } }),
            oc(34, '你们推了半节课也没推出来，最后抄了答案。', '没推出来', { at: { knowledge: 1 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ch_art_talent', type: 'random', stage: '童年', weight: 2,
      family: 'talent_art', art: 'home',
      cond: function (g) { return g.age >= 7 && g.age <= 12 && LS.hasTalent(g, 'art'); },
      title: '墙上的那幅画',
      text: '你拿粉笔在院墙上画了一只很大的鸟，翅膀从这头延伸到那头。邻居路过都停下来看，母亲回来时先是愣住，然后问你，这是你画的？',
      opts: [
        o('点头，说还想画', { npc: { '母亲': { favor: 6 } }, at: { happiness: 3, charm: 2, knowledge: 1 }, tag: '小时候在院墙上画过一只很大的鸟' }, {
          tone: 'safe',
          outcomes: [
            oc(68, '母亲没让擦，还说留着。那只鸟在墙上待了两年。', '留在墙上', { at: { happiness: 3, charm: 2 } }),
            oc(32, '第二天父亲嫌难看，把它刷掉了，你哭了一场。', '被刷掉', { at: { happiness: -3 }, npc: { '父亲': { favor: -2 } } })
          ]
        }),
        o('不好意思，说随便画的', { npc: { '母亲': { favor: 2 } }, at: { happiness: 1, charm: 1 }, tag: '小时候画了画又不好意思承认' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '母亲笑着说随便画也画得这么好，把这句话记住了。', '被夸', { at: { happiness: 2 } }),
            oc(40, '你后来自己把画擦了，心里有点舍不得。', '自己擦掉', { at: { happiness: -1, charm: 1 } })
          ]
        }),
        o('叫同学来看', { npc: { '同学': { intimacy: 7 } }, at: { charm: 3, happiness: 2 }, tag: '小时候叫同学来看自己在墙上画的画' }, {
          tone: 'safe',
          outcomes: [
            oc(65, '同学围着看，有人说以后你肯定能当画家。', '被围观', { at: { charm: 3, happiness: 2 } }),
            oc(35, '有个同学说难看，你当场把画擦了。', '被说难看', { at: { happiness: -2, charm: -1 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ch_weak_child', type: 'random', stage: '童年', weight: 2,
      family: 'weak_child', art: 'clinic',
      cond: function (g) { return g.age >= 4 && g.age <= 11 && sickly(g); },
      title: '又请了一周假',
      text: '换季时你又病了一场，断断续续请了一周假。回学校那天，桌上堆着一摞卷子，同学在操场上跑，你站在走廊里，觉得阳光有点晃眼。',
      opts: [
        o('找老师补上落下的课', { npc: { '老师': { favor: 5 } }, at: { knowledge: 3, health: 1 }, tag: '小时候生病请假后找老师补过课' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '老师每天放学留你十分钟，把落下的课补了回来。', '补课', { at: { knowledge: 3, happiness: 1 } }),
            oc(34, '老师太忙，只给了你答案，你自己啃了很久。', '自己啃', { at: { knowledge: 2, stress: 2 } })
          ]
        }),
        o('跟同学借笔记', { npc: { '同学': { intimacy: 7 } }, at: { knowledge: 2, happiness: 2 }, tag: '小时候生病后借同学的笔记' }, {
          tone: 'safe',
          outcomes: [
            oc(70, '同桌把笔记抄了一份给你，字写得比自己的还工整。', '抄笔记', { at: { knowledge: 3, happiness: 2 }, npc: { '同学': { intimacy: 6 } } }),
            oc(30, '笔记缺了几页，你只能自己猜。', '笔记不全', { at: { knowledge: 1 } })
          ]
        }),
        o('先不管功课，把身体养好', { npc: { '母亲': { favor: 4 } }, at: { health: 3, knowledge: -1 }, tag: '小时候生病后先把身体养好' }, {
          tone: 'safe',
          outcomes: [
            oc(62, '母亲每天给你炖汤，你慢慢有了力气。', '养身体', { at: { health: 4, happiness: 1 } }),
            oc(38, '落下的功课太多，期末掉了十几名。', '成绩下滑', { at: { knowledge: -2, happiness: -2 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ch_sibling_grow', type: 'random', stage: '童年', weight: 2,
      family: 'sibling_grow', art: 'home',
      cond: function (g) { return g.age >= 7 && g.age <= 12 && siblingRole(g, '哥哥'); },
      title: '哥哥的作业本',
      text: '哥哥的作业本摊在桌上，他出去打球了。你翻了两页，发现他的字比你好看得多。母亲经过时说，你哥像你这么大的时候，已经开始自己洗衣服了。',
      opts: [
        o('等哥哥回来问怎么练字', { npc: { '哥哥': { favor: 6 } }, at: { knowledge: 2, charm: 1 }, tag: '小时候问过哥哥怎么把字写好' }, {
          tone: 'safe',
          outcomes: [
            oc(68, '哥哥随手写了几个字给你看，说照着描。', '学写字', { at: { knowledge: 2, charm: 1 }, npc: { '哥哥': { favor: 3 } } }),
            oc(32, '他嫌你烦，把本子合上了。', '被嫌烦', { at: { happiness: -1 }, npc: { '哥哥': { favor: -1 } } })
          ]
        }),
        o('偷偷拿他的本子练', { npc: { '哥哥': { favor: -3 } }, at: { knowledge: 3, happiness: 1 }, tag: '小时候偷偷拿哥哥的本子练字' }, {
          hint: '被发现会吵架', tone: 'switch',
          outcomes: [
            oc(55, '你练了一段时间，字真的像了些。', '练像了', { at: { knowledge: 3 } }),
            oc(30, '哥哥发现本子被翻过，跟你吵了一架。', '吵架', { at: { happiness: -2 }, npc: { '哥哥': { favor: -3 } } }),
            oc(15, '母亲看见了，给你也买了一本新本子。', '新本子', { money: { cash: -40 }, at: { happiness: 2 }, npc: { '母亲': { favor: 2 } } })
          ]
        }),
        o('去问母亲，哥哥是不是更聪明', { npc: { '母亲': { favor: 3 }, '哥哥': { favor: -2 } }, at: { happiness: -2, knowledge: 1 }, tag: '小时候问过母亲自己和哥哥谁更聪明' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '母亲说你们俩不一样，各有各的好。', '各有各的好', { at: { happiness: 1 } }),
            oc(40, '母亲随口说了句你哥省心，你记了很多年。', '记了很多年', { at: { happiness: -3, stress: 2 }, npc: { '母亲': { favor: -1 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_ch_parent_sick', type: 'random', stage: '童年', weight: 2,
      family: 'parent_health', art: 'clinic',
      cond: function (g) { return g.age >= 8 && g.age <= 12 && (LS.npcHealth(g, '父亲') < 60 || LS.npcHealth(g, '母亲') < 60); },
      title: '父亲住了一周院',
      text: '父亲在工地上闪了腰，被送进医院，躺了一周。母亲每天下班先去医院，再回家做饭。你放学自己开门，屋里黑着灯，桌上留了十块钱和一张纸条。',
      opts: [
        o('每天放学去医院陪父亲', { npc: { '父亲': { favor: 8 }, '母亲': { favor: 3 } }, at: { happiness: 2, health: -1 }, tag: '父亲住院时每天放学去医院陪他' }, {
          tone: 'safe',
          outcomes: [
            oc(68, '父亲嘴上赶你回家写作业，你去了他还是高兴。', '陪床', { at: { happiness: 3 }, npc: { '父亲': { favor: 4 } } }),
            oc(32, '你在病房里写作业，写着写着趴在床边睡着了。', '睡着了', { at: { knowledge: 1, happiness: 2 }, npc: { '父亲': { favor: 3 } } })
          ]
        }),
        o('在家把饭做好等母亲回来', { npc: { '母亲': { favor: 8 } }, at: { charm: 2, happiness: 2, knowledge: -1 }, tag: '父亲住院时学着做饭等母亲回家' }, {
          tone: 'safe',
          outcomes: [
            oc(65, '你炒糊了一个菜，母亲回来还是吃完了。', '炒糊了', { at: { happiness: 2 }, npc: { '母亲': { favor: 4 } } }),
            oc(35, '你把手烫了，母亲心疼得不行。', '烫伤', { at: { health: -2 }, npc: { '母亲': { favor: 3 } } })
          ]
        }),
        o('照旧去同学家写作业', { npc: { '同学': { intimacy: 5 } }, at: { knowledge: 2, happiness: 1 }, tag: '父亲住院时照旧去同学家写作业' }, {
          tone: 'safe',
          outcomes: [
            oc(55, '同学家热闹，你暂时忘了家里的冷清。', '暂时忘了', { at: { happiness: 2, knowledge: 2 } }),
            oc(45, '母亲回家发现你没在，坐在门口等了很久。', '母亲等门', { at: { happiness: -2 }, npc: { '母亲': { favor: -3 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_ch_school_fee', type: 'random', stage: '童年', weight: 2,
      family: 'school_fee', art: 'money',
      cond: function (g) { return g.age >= 10 && g.age <= 12 && (g.background === '贫困' || g.background === '普通工薪'); },
      title: '要交的那笔钱',
      text: '学校通知交下学期的教辅费，一百八十块，下周一必须交齐。你回家把通知放在桌上，母亲拿起来看了很久，说先吃饭。那天晚上的菜比平时少了一个。',
      opts: [
        o('跟老师说家里晚几天交', { npc: { '老师': { favor: 4 } }, at: { happiness: 1, charm: 2 }, tag: '小时候跟老师说过家里晚几天交费' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '老师说你先用着书，钱不急。', '先用书', { at: { knowledge: 2, happiness: 2 }, npc: { '老师': { favor: 3 } } }),
            oc(34, '老师在班会上提了一句，你脸烫了一整天。', '被点名', { at: { happiness: -2 }, npc: { '老师': { favor: -2 } } })
          ]
        }),
        o('跟母亲说不想订了', { npc: { '母亲': { favor: 5 } }, at: { happiness: -2, knowledge: -2 }, tag: '小时候主动跟母亲说教辅不订了' }, {
          hint: '母亲会更难受', tone: 'safe',
          outcomes: [
            oc(55, '母亲第二天还是把钱凑齐了，塞进你书包。', '凑齐了', { at: { happiness: 2, knowledge: 2 }, npc: { '母亲': { favor: 4 } } }),
            oc(45, '你没有订，上课时和同桌看一本。', '和同桌看一本', { at: { knowledge: 1, charm: 1 }, npc: { '同学': { intimacy: 6 } } })
          ]
        }),
        o('把攒的钱拿出来补上', { money: { cash: -180 }, npc: { '母亲': { favor: 6 } }, at: { happiness: 2, finance: -1 }, tag: '小时候用自己攒的钱补了教辅费' }, {
          tone: 'safe',
          outcomes: [
            oc(68, '母亲发现钱是你出的，抱着你半天没说话。', '母亲抱着你', { at: { happiness: 3 }, npc: { '母亲': { favor: 4 } } }),
            oc(32, '钱还差一点，母亲添上了剩下的。', '母亲添钱', { at: { happiness: 1 }, npc: { '母亲': { favor: 2 } } })
          ]
        })
      ]
    }
  ]);

  /* =========================================================
     四、少年分轨：一次选择，四条路（age 14，forced）
     ========================================================= */
  add([
    {
      id: 'v32_track_choose', type: 'forced', stage: '少年', age: 14, weight: 2, prio: 101,
      family: 'track', art: 'exam',
      cond: function (g) { return !g.track; },
      title: '中考前的那张表',
      text: '中考前最后一次班会，班主任在黑板写下四条路：理科——工程、科研；文科——传媒、法务、教育；艺术——设计、自由职业；体育——体校、参军、教练、安保。他说，路没有高低，但有远近。粉笔灰落在他袖口上。',
      opts: [
        o('走理科，以后做工程或科研', { track: 'science', at: { knowledge: 2, stress: 2 }, tag: '十四岁那年选了理科' }, {
          hint: '工程科研 / 数理与实验', tone: 'switch',
          outcomes: [
            oc(66, '你在表上写了理科。父亲看了很久，说这行当踏实。', '选了理科', { at: { knowledge: 2, happiness: 1 } }),
            oc(34, '你其实更想选别的，但还是在理科那一栏打了勾。', '随大流', { at: { knowledge: 1, happiness: -1 } })
          ]
        }),
        o('走文科，以后做传媒、法务或教育', { track: 'arts', at: { knowledge: 2, charm: 2 }, tag: '十四岁那年选了文科' }, {
          hint: '传媒法务教育 / 与人打交道', tone: 'switch',
          outcomes: [
            oc(64, '你选了文科。语文老师知道后，把自己的一摞书借给了你。', '选了文科', { at: { knowledge: 3, charm: 1 } }),
            oc(36, '家里有人说文科不好找工作，你还是把名字写在了那一栏。', '家里有异议', { at: { charm: 2, happiness: -1 }, npc: { '父亲': { favor: -1 } } })
          ]
        }),
        o('走艺术，以后做设计或自由职业', { track: 'art', at: { charm: 2, happiness: 2, knowledge: 1 }, tag: '十四岁那年选了艺术' }, {
          hint: '设计艺术自由职业 / 收入不稳', tone: 'switch',
          outcomes: [
            oc(60, '你选了艺术。母亲问了三遍以后能做什么，你说不知道，但想画。', '选了艺术', { at: { happiness: 3, charm: 2 } }),
            oc(40, '班主任劝你再想想，你在放学前把表交了。', '坚持', { at: { happiness: 2, stress: 2 } })
          ]
        }),
        o('走体育，以后进体校、参军或当教练', { track: 'sports', at: { health: 3, charm: 1 }, tag: '十四岁那年选了体育' }, {
          hint: '体校参军教练安保 / 吃身体这碗饭', tone: 'switch',
          outcomes: [
            oc(62, '你选了体育。体育老师拍了下你的肩膀，说早就该来。', '选了体育', { at: { health: 3, happiness: 2 } }),
            oc(38, '母亲担心你以后受伤，你说没事，还是把表交了。', '母亲担心', { at: { health: 2 }, npc: { '母亲': { favor: -1 } } })
          ]
        })
      ]
    }
  ]);

  /* ---- 理科路径 13–18 岁 5 条 ---- */
  add([
    {
      id: 'v32_tr_sci_1', type: 'random', stage: '少年', weight: 3,
      family: 'tr_sci_contest', art: 'exam',
      cond: function (g) { return g.track === 'science' && g.age >= 15 && g.age <= 17; },
      title: '竞赛集训名单',
      text: '物理老师把一张集训名单贴在办公室门口，上面有六个名字，最后一个是你。集训在周六，占用整个下午。同桌说，这玩意儿对高考没用，还不如多刷两套卷子。',
      opts: [
        o('去集训，周六下午全搭进去', { npc: { '老师': { favor: 7 }, '同学': { favor: -2 } }, at: { knowledge: 4, stress: 3, happiness: 1 }, tag: '高中时进过物理竞赛集训队' }, {
          tone: 'switch',
          outcomes: [
            oc(62, '集训很难，但你第一次觉得题目是可以被拆开的。', '被拆开', { at: { knowledge: 4, happiness: 2 } }),
            oc(38, '你去了三次就跟不上，最后退出了名单。', '退出名单', { at: { knowledge: 2, happiness: -2 }, npc: { '老师': { favor: -2 } } })
          ]
        }),
        o('问老师能不能只去两次', { npc: { '老师': { favor: 2 } }, at: { knowledge: 2, stress: 1 }, tag: '竞赛集训只去了两次' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '老师同意了，你勉强跟上了进度。', '半途', { at: { knowledge: 3 } }),
            oc(40, '老师说你心思不在这上面，把名额给了别人。', '名额被换', { at: { knowledge: 1, happiness: -2 }, npc: { '老师': { favor: -3 } } })
          ]
        }),
        o('不去，把时间留给别的科目', { at: { knowledge: 2, happiness: 1 }, npc: { '老师': { favor: -3 } }, tag: '高中时放弃了竞赛集训' }, {
          tone: 'safe',
          outcomes: [
            oc(58, '你的总分更均衡了，物理却一直停在中等。', '均衡', { at: { knowledge: 3 } }),
            oc(42, '后来你有点后悔，偶尔会翻那道没做出来的题。', '后悔', { at: { happiness: -1 } })
          ]
        })
      ]
    },

    {
      id: 'v32_tr_sci_2', type: 'random', stage: '少年', weight: 2,
      family: 'tr_sci_lab', art: 'exam',
      cond: function (g) { return g.track === 'science' && g.age >= 16 && g.age <= 18; },
      title: '实验室的钥匙',
      text: '物理老师给了你一把实验室的钥匙，说做完实验记得关灯。晚自习后你一个人留在实验室，示波器的绿线在暗处慢慢移动。窗外有人在打球，声音很远。',
      opts: [
        o('把实验做完再走', { npc: { '老师': { favor: 8 } }, at: { knowledge: 5, health: -2, stress: 2 }, tag: '高中时一个人留在实验室做到很晚' }, {
          tone: 'switch',
          outcomes: [
            oc(66, '数据终于对上了，你在本子上画了个很丑的勾。', '数据对上了', { at: { knowledge: 5, happiness: 3 } }),
            oc(34, '你困得睡着了，醒来时灯还亮着，老师站在门口。', '睡着了', { at: { health: -2 }, npc: { '老师': { favor: 3 } } })
          ]
        }),
        o('叫同学一起来做', { npc: { '同学': { intimacy: 9 } }, at: { knowledge: 3, happiness: 2, charm: 1 }, tag: '高中时叫同学一起进实验室' }, {
          tone: 'safe',
          outcomes: [
            oc(68, '两个人分工，做得又快又准，还顺便聊了很久。', '一起做', { at: { knowledge: 3, happiness: 3 }, npc: { '同学': { intimacy: 8 } } }),
            oc(32, '他手重，弄坏了一个器材，你们赔了钱。', '弄坏器材', { money: { cash: -200 }, at: { knowledge: 1, stress: 2 } })
          ]
        }),
        o('把钥匙还给老师，说自己不够格', { npc: { '老师': { favor: -4 } }, at: { happiness: -2, stress: -1 }, tag: '高中时把实验室钥匙还了回去' }, {
          tone: 'safe',
          outcomes: [
            oc(50, '老师没说什么，只是把钥匙收进了抽屉。', '钥匙收回', { at: { happiness: -2 } }),
            oc(50, '第二天老师又把钥匙塞给你，说再试一次。', '再试一次', { at: { knowledge: 3, happiness: 2 }, npc: { '老师': { favor: 4 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_tr_sci_3', type: 'random', stage: '少年', weight: 2,
      family: 'tr_sci_robot', art: 'home',
      cond: function (g) { return g.track === 'science' && g.age >= 15 && g.age <= 17; },
      title: '机器人社的零件箱',
      text: '学校新开了机器人社，报名表上写着“限理科方向”。零件箱是旧的，电机有一半不转。社长说，谁愿意周末来修，谁就能先上手。',
      opts: [
        o('周末来修电机', { npc: { '社长': { favor: 7 }, '同学': { intimacy: 5 } }, at: { knowledge: 3, stress: 2, happiness: 2 }, tag: '高中时周末去修机器人社的旧电机' }, {
          tone: 'safe',
          outcomes: [
            oc(65, '你修好了三台，社长把主控板交给了你。', '修好了', { at: { knowledge: 4, happiness: 3 } }),
            oc(35, '电机没修好，你手上倒是多了几道口子。', '弄伤手', { at: { health: -2 }, npc: { '社长': { favor: 2 } } })
          ]
        }),
        o('报名，但只参加比赛', { npc: { '社长': { favor: 2 } }, at: { knowledge: 2, charm: 1 }, tag: '高中时只参加机器人社的比赛' }, {
          tone: 'safe',
          outcomes: [
            oc(58, '比赛那天你负责操作，赢了一场。', '赢了一场', { at: { knowledge: 2, happiness: 3 }, npc: { '社长': { favor: 3 } } }),
            oc(42, '你操作失误，机器人撞在墙上，队里有人埋怨。', '操作失误', { at: { happiness: -2, stress: 2 } })
          ]
        }),
        o('不参加，专心刷题', { at: { knowledge: 3, happiness: -1 }, tag: '高中时没有参加机器人社' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '你的成绩稳了下来，但周末过得很单调。', '单调', { at: { knowledge: 3 } }),
            oc(40, '后来看到社团拿奖的照片，你心里动了一下。', '有点遗憾', { at: { happiness: -2 } })
          ]
        })
      ]
    },

    {
      id: 'v32_tr_sci_4', type: 'random', stage: '少年', weight: 3,
      family: 'tr_sci_major', art: 'exam',
      cond: function (g) { return g.track === 'science' && g.age >= 17 && g.age <= 18; },
      title: '志愿表上的第一行',
      text: '志愿表摊在桌上，第一行还空着。父亲说报土木，稳；母亲说报计算机，以后好找活；班主任说，你自己的分数你自己清楚。窗外有人在放鞭炮，是隔壁家孩子升学。',
      opts: [
        o('填计算机', { npc: { '母亲': { favor: 4 } }, at: { knowledge: 2, happiness: 1 }, tag: '高考志愿第一行填了计算机' }, {
          tone: 'switch',
          outcomes: [
            oc(60, '你填了计算机，母亲说这个选得好。', '计算机', { at: { knowledge: 2, happiness: 2 } }),
            oc(40, '那年计算机分数涨了，你被调剂到第二志愿。', '被调剂', { money: { cash: -2000 }, at: { knowledge: 1, happiness: -2 } })
          ]
        }),
        o('填土木工程', { npc: { '父亲': { favor: 4 } }, at: { knowledge: 1, finance: 1 }, tag: '高考志愿第一行填了土木工程' }, {
          tone: 'switch',
          outcomes: [
            oc(58, '父亲很高兴，说这行饿不死人。', '土木', { at: { finance: 1 }, npc: { '父亲': { favor: 3 } } }),
            oc(42, '你入学后才发现，班上一半人是被调剂来的。', '被调剂来的', { at: { happiness: -2, knowledge: 1 } })
          ]
        }),
        o('填物理或数学，想走科研', { npc: { '老师': { favor: 5 } }, at: { knowledge: 4, happiness: 2 }, tag: '高考志愿第一行填了基础学科' }, {
          hint: '路窄，但走得深', tone: 'switch',
          outcomes: [
            oc(62, '你填了物理。老师说你这条路会很慢，但值得。', '基础学科', { at: { knowledge: 4, happiness: 2 } }),
            oc(38, '家里担心不好就业，你还是没改。', '家里担心', { at: { knowledge: 3 }, npc: { '父亲': { favor: -2 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_tr_sci_5', type: 'random', stage: '少年', weight: 2,
      family: 'tr_sci_night', art: 'home',
      cond: function (g) { return g.track === 'science' && g.age >= 16 && g.age <= 18; },
      title: '凌晨两点的草稿纸',
      text: '台灯下的草稿纸堆了一摞，最后一道大题还差一步。手机屏幕亮了一下，是同学发来的答案。母亲在门外说，睡吧，明天还要上课。',
      opts: [
        o('自己再推一遍，不看答案', { at: { knowledge: 4, health: -3, stress: 3 }, tag: '高中时熬夜自己推最后一道大题' }, {
          hint: '会熬到很晚', tone: 'hard',
          outcomes: [
            oc(62, '凌晨三点，你终于推出来了，手心全是汗。', '推出来了', { at: { knowledge: 5, happiness: 4, health: -2 } }),
            oc(38, '你推了一夜也没推出来，第二天上课睡着了。', '没推出来', { at: { knowledge: 2, health: -3 } })
          ]
        }),
        o('看一眼答案，弄懂就行', { npc: { '同学': { intimacy: 4 } }, at: { knowledge: 2, health: 1 }, tag: '高中时看过同学的答案再自己弄懂' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '你看懂了那一步，反而省下了一夜。', '看懂了', { at: { knowledge: 3, health: 1 } }),
            oc(34, '你只是抄上了，考试遇到同类题还是不会。', '没真懂', { at: { knowledge: 1, happiness: -1 } })
          ]
        }),
        o('听母亲的，关灯睡觉', { npc: { '母亲': { favor: 4 } }, at: { health: 2, knowledge: -1 }, tag: '高中时听母亲的话按时睡觉' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '你睡了，第二天精神很好，那道题在课堂上听懂了。', '睡够了', { at: { health: 2, knowledge: 2 }, npc: { '母亲': { favor: 2 } } }),
            oc(40, '你躺下很久没睡着，脑子里还在转那一步。', '没睡着', { at: { health: -1, stress: 1 } })
          ]
        })
      ]
    }
  ]);

  /* ---- 文科路径 13–18 岁 5 条 ---- */
  add([
    {
      id: 'v32_tr_arts_1', type: 'random', stage: '少年', weight: 3,
      family: 'tr_arts_article', art: 'exam',
      cond: function (g) { return g.track === 'arts' && g.age >= 15 && g.age <= 17; },
      title: '校刊的第一次退稿',
      text: '你给校刊投了一篇写巷子口的文章，两周后收到一张便笺：写得真诚，但太散。编辑是高三的学姐，她在末尾画了一只很小的猫，说可以再改一版。',
      opts: [
        o('按她的意见改一版', { npc: { '学姐': { favor: 7 } }, at: { knowledge: 2, charm: 2, happiness: 2 }, tag: '高中时被校刊退过稿，又改了一版' }, {
          tone: 'safe',
          outcomes: [
            oc(68, '改完的文章登在了校刊第三页，你把那一页留了很多年。', '登在校刊', { at: { charm: 3, happiness: 4 } }),
            oc(32, '改了三遍还是被退了，学姐说下次再投。', '又退了', { at: { happiness: -3, charm: 1 } })
          ]
        }),
        o('不改，投给外面的报纸', { at: { charm: 2, happiness: -1, stress: 2 }, tag: '高中时把退稿改投给了外面的报纸' }, {
          hint: '大概率没有回音', tone: 'risk',
          outcomes: [
            oc(45, '报纸没有回音，你把稿子夹进了课本。', '没有回音', { at: { happiness: -2, knowledge: 1 } }),
            oc(55, '一个月后收到一张用稿通知和二十块钱稿费。', '稿费', { money: { cash: 20 }, at: { happiness: 4, charm: 2 } })
          ]
        }),
        o('把稿子撕了，不再写', { at: { happiness: -3, knowledge: 1 }, tag: '高中时撕掉了自己投出去的稿子' }, {
          tone: 'safe',
          outcomes: [
            oc(55, '你撕了稿子，后来在作文本上又写了一遍同样的开头。', '又写了一遍', { at: { knowledge: 2, happiness: -1 } }),
            oc(45, '学姐又来找你，说缺一篇稿子，你还是交了。', '又交了', { at: { charm: 1 }, npc: { '学姐': { favor: 2 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_tr_arts_2', type: 'random', stage: '少年', weight: 3,
      family: 'tr_arts_debate', art: 'exam',
      cond: function (g) { return g.track === 'arts' && g.age >= 15 && g.age <= 18; },
      title: '模拟法庭的席位',
      text: '学校组织模拟法庭，缺一个辩护人。老师问谁想试试，教室里没人举手。你想起自己看过几集庭审剧，鬼使神差地把手举了起来。',
      opts: [
        o('接辩护人，回去啃材料', { npc: { '老师': { favor: 6 } }, at: { knowledge: 3, charm: 3, stress: 2 }, tag: '高中时在模拟法庭当过辩护人' }, {
          tone: 'switch',
          outcomes: [
            oc(64, '你在庭上把对方问住了，散场后有人来跟你握手。', '辩赢了', { at: { charm: 4, happiness: 3 } }),
            oc(36, '你紧张得忘了词，站在台上一分多钟说不出话。', '忘词', { at: { stress: 3, happiness: -3 }, npc: { '老师': { favor: 1 } } })
          ]
        }),
        o('当书记员，负责记录', { npc: { '同学': { intimacy: 6 } }, at: { knowledge: 2, charm: 1 }, tag: '高中时在模拟法庭当书记员' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '你把每句话都记了下来，后来整理成一份很完整的记录。', '记录完整', { at: { knowledge: 3, charm: 1 } }),
            oc(34, '你记漏了关键的一句，被老师提醒。', '记漏了', { at: { knowledge: 1, happiness: -1 } })
          ]
        }),
        o('临时退缩，说不想上', { npc: { '老师': { favor: -2 } }, at: { happiness: -1, stress: -2 }, tag: '高中时临时退出了模拟法庭' }, {
          tone: 'safe',
          outcomes: [
            oc(55, '老师没勉强，另找了一个人，你在台下看了一下午。', '台下看', { at: { happiness: 1 } }),
            oc(45, '你其实想上台，回家后把庭审剧又看了两遍。', '偷偷准备', { at: { charm: 1, knowledge: 1 } })
          ]
        })
      ]
    },

    {
      id: 'v32_tr_arts_3', type: 'random', stage: '少年', weight: 2,
      family: 'tr_arts_radio', art: 'home',
      cond: function (g) { return g.track === 'arts' && g.age >= 15 && g.age <= 17; },
      title: '广播站的午后',
      text: '校园广播站缺一个念稿的人，午休时间播二十分钟。站长把一摞稿子递给你，说声音别抖。第一次播音那天，整栋楼都听得见你的呼吸。',
      opts: [
        o('接下每周三的播音', { npc: { '站长': { favor: 6 } }, at: { charm: 4, happiness: 2 }, tag: '高中时在校园广播站播音' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '你越念越稳，后来有同学专门在走廊等你播音。', '越念越稳', { at: { charm: 4, happiness: 3 } }),
            oc(34, '你念错了一个名字，在楼道里被笑了好几天。', '念错名字', { at: { charm: -2, happiness: -2 } })
          ]
        }),
        o('只替一次班', { npc: { '站长': { favor: 2 } }, at: { charm: 2, happiness: 1 }, tag: '高中时替广播站代过一次班' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '那一次播得很顺，站长说以后可以再来。', '播得顺', { at: { charm: 2 } }),
            oc(40, '你紧张得手心出汗，稿纸被捏皱了。', '紧张', { at: { charm: 1, stress: 1 } })
          ]
        }),
        o('推荐声音好听的同桌', { npc: { '同学': { intimacy: 8 } }, at: { charm: 1, happiness: 2 }, tag: '高中时把广播站的机会让给了同桌' }, {
          tone: 'safe',
          outcomes: [
            oc(68, '同桌播得很好，后来每次见你都说欠你一次。', '同桌播得好', { npc: { '同学': { intimacy: 10 } }, at: { happiness: 3 } }),
            oc(32, '同桌不愿意去，你只好自己顶上。', '自己顶上', { at: { charm: 2 } })
          ]
        })
      ]
    },

    {
      id: 'v32_tr_arts_4', type: 'random', stage: '少年', weight: 2,
      family: 'tr_arts_history', art: 'exam',
      cond: function (g) { return g.track === 'arts' && g.age >= 16 && g.age <= 18; },
      title: '历史老师的那句话',
      text: '历史老师讲到一段旧事，忽然停下来，说你们以后要替别人记住这些。下课后你留在教室，把黑板上的那行字抄进了本子。他在门口看了你一眼。',
      opts: [
        o('去问他该读什么书', { npc: { '老师': { favor: 8 } }, at: { knowledge: 4, happiness: 2 }, tag: '高中时向历史老师请教该读什么书' }, {
          tone: 'safe',
          outcomes: [
            oc(68, '他给你列了五本书，最后一本他自己也没有。', '书单', { at: { knowledge: 5, happiness: 2 } }),
            oc(32, '他说先把课本读透，你有点失望。', '先读课本', { at: { knowledge: 2 } })
          ]
        }),
        o('把这句话写进作文里', { npc: { '老师': { favor: 3 } }, at: { knowledge: 2, charm: 2 }, tag: '高中时把历史老师的话写进了作文' }, {
          tone: 'safe',
          outcomes: [
            oc(64, '作文被当成范文念了，历史老师在走廊里冲你点头。', '范文', { at: { charm: 3, knowledge: 2 } }),
            oc(36, '老师说你引用得太生硬，把那段划掉了。', '被划掉', { at: { happiness: -1, knowledge: 1 } })
          ]
        }),
        o('合上本子，去准备考试', { at: { knowledge: 2, happiness: -1 }, tag: '高中时没有把那句话记下来' }, {
          tone: 'safe',
          outcomes: [
            oc(58, '你考得不错，那句话却慢慢忘了。', '忘了', { at: { knowledge: 3 } }),
            oc(42, '很多年后你在某本书上又看到类似的话，忽然想起那个下午。', '又想起', { at: { happiness: 2 } })
          ]
        })
      ]
    },

    {
      id: 'v32_tr_arts_5', type: 'random', stage: '少年', weight: 3,
      family: 'tr_arts_major', art: 'exam',
      cond: function (g) { return g.track === 'arts' && g.age >= 17 && g.age <= 18; },
      title: '志愿表上的三个名字',
      text: '新闻、法学、师范，三个名字写在志愿表上。父亲说师范稳，母亲说法学体面，班主任说新闻有意思但辛苦。你握着笔，三个名字在纸上排成一列。',
      opts: [
        o('填新闻传播', { at: { charm: 3, knowledge: 2, happiness: 2 }, tag: '高考志愿第一行填了新闻传播' }, {
          hint: '辛苦，但见得多', tone: 'switch',
          outcomes: [
            oc(58, '你填了新闻。班主任笑了笑，说以后记得回来讲外面的事。', '新闻', { at: { charm: 3, happiness: 2 } }),
            oc(42, '家里担心不好就业，你还是没改。', '家里担心', { at: { charm: 2 }, npc: { '父亲': { favor: -2 } } })
          ]
        }),
        o('填法学', { at: { knowledge: 4, stress: 2 }, tag: '高考志愿第一行填了法学' }, {
          hint: '要背很多法条', tone: 'switch',
          outcomes: [
            oc(62, '你填了法学，母亲说这个体面。', '法学', { at: { knowledge: 3 }, npc: { '母亲': { favor: 2 } } }),
            oc(38, '你入学后才发现，法条比想象中多得多。', '法条太多', { at: { knowledge: 2, stress: 2 } })
          ]
        }),
        o('填师范', { npc: { '母亲': { favor: 4 } }, at: { knowledge: 2, charm: 2, happiness: 1 }, tag: '高考志愿第一行填了师范' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '你填了师范，父亲说这条路走得长。', '师范', { at: { knowledge: 2, happiness: 2 }, npc: { '父亲': { favor: 2 } } }),
            oc(34, '实习站上讲台那天，你才知道台下有几十双眼睛。', '第一次上讲台', { at: { charm: 3, stress: 2 } })
          ]
        })
      ]
    }
  ]);

  /* ---- 艺术路径 13–18 岁 5 条 ---- */
  add([
    {
      id: 'v32_tr_art_1', type: 'random', stage: '少年', weight: 3,
      family: 'tr_art_studio', art: 'home',
      cond: function (g) { return g.track === 'art' && g.age >= 15 && g.age <= 17; },
      title: '画室的第一张素描',
      text: '画室在旧楼三层，石膏像缺了半只耳朵。老师让你先画一只苹果，你画了三个小时，最后还是被擦掉重来。旁边的女生已经画完两张。',
      opts: [
        o('留下来，从苹果画起', { npc: { '老师': { favor: 7 }, '同学': { intimacy: 5 } }, at: { knowledge: 2, charm: 3, stress: 2 }, tag: '高中时在画室从一只苹果画起' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '你画了半个月苹果，忽然有一天线条顺了。', '线条顺了', { at: { charm: 4, happiness: 3 } }),
            oc(34, '你越画越烦，把铅笔摔在画纸上。', '烦了', { at: { stress: 3, happiness: -2 }, npc: { '老师': { favor: -1 } } })
          ]
        }),
        o('跟旁边的女生请教', { npc: { '同学': { intimacy: 10 } }, at: { charm: 2, knowledge: 2, happiness: 2 }, tag: '高中时在画室跟同桌请教过画法' }, {
          tone: 'safe',
          outcomes: [
            oc(68, '她把笔借给你，教你怎么找明暗交界线。', '教画法', { at: { charm: 3, knowledge: 2 }, npc: { '同学': { intimacy: 8 } } }),
            oc(32, '她只是笑了笑，说自己也在摸索。', '没学到', { at: { charm: 1 } })
          ]
        }),
        o('不画了，回家练自己的', { npc: { '老师': { favor: -3 } }, at: { happiness: 1, charm: 1, knowledge: -1 }, tag: '高中时没在画室继续学素描' }, {
          tone: 'safe',
          outcomes: [
            oc(55, '你在家画自己想画的，倒是画得开心。', '自己画', { at: { happiness: 3, charm: 1 } }),
            oc(45, '没有老师指点，你的毛病一直没改过来。', '毛病没改', { at: { charm: -1 } })
          ]
        })
      ]
    },

    {
      id: 'v32_tr_art_2', type: 'random', stage: '少年', weight: 3,
      family: 'tr_art_fee', art: 'money',
      cond: function (g) { return g.track === 'art' && g.age >= 16 && g.age <= 18; },
      title: '集训费的单子',
      text: '艺考集训的费用是一张单子，三万八，含材料，不含住宿。母亲把单子翻来覆去看，父亲在阳台上抽了一支烟。老师说，去不去，你自己定。',
      opts: [
        o('去集训，家里想办法凑钱', { money: { cash: -38000 }, npc: { '母亲': { favor: 4 }, '父亲': { favor: -2 } }, at: { charm: 4, knowledge: 3, happiness: 2, stress: 3 }, tag: '高三去参加了艺考集训' }, {
          hint: '家里会紧一阵', tone: 'hard',
          outcomes: [
            oc(60, '集训很苦，但你的画面进步得肉眼可见。', '进步明显', { at: { charm: 5, happiness: 3 } }),
            oc(25, '你在集训班里排在中下，老师很少点到你。', '排在中下', { at: { charm: 2, happiness: -2 } }),
            oc(15, '集训中途家里钱不够，你提前回了学校。', '提前回来', { money: { cash: 12000 }, at: { charm: 1, happiness: -3 }, npc: { '父亲': { favor: -2 } } })
          ]
        }),
        o('不去，自己在家画', { at: { charm: 2, happiness: 1, knowledge: -1 }, tag: '高三没有去艺考集训，自己在家画' }, {
          tone: 'safe',
          outcomes: [
            oc(55, '你按自己的节奏画，作品集慢慢攒了一摞。', '自己攒作品', { at: { charm: 3, happiness: 3 } }),
            oc(45, '没有集训，你的应试技巧一直差一截。', '技巧不足', { at: { charm: -1, happiness: -2 } })
          ]
        }),
        o('说服父母，只报最便宜的班', { money: { cash: -12000 }, npc: { '母亲': { favor: 3 } }, at: { charm: 2, knowledge: 1 }, tag: '艺考只报了最便宜的集训班' }, {
          tone: 'safe',
          outcomes: [
            oc(62, '便宜的班人很多，但你学到了最要紧的几手。', '学到几手', { at: { charm: 3, happiness: 2 } }),
            oc(38, '班上的老师顾不过来，你多半靠自己。', '靠自己', { at: { charm: 1, happiness: -1 } })
          ]
        })
      ]
    },

    {
      id: 'v32_tr_art_3', type: 'random', stage: '少年', weight: 2,
      family: 'tr_art_band', art: 'home',
      cond: function (g) { return g.track === 'art' && g.age >= 15 && g.age <= 17; },
      title: '天台的乐队',
      text: '几个同学在天台排练，缺一个画海报的人。主唱说，你画的那些东西挺有意思，帮我们画一张，贴在楼道里。排练的声音在傍晚传得很远。',
      opts: [
        o('给他们画一张大海报', { npc: { '同学': { intimacy: 9 } }, at: { charm: 4, happiness: 3 }, tag: '高中时给天台乐队画过海报' }, {
          tone: 'safe',
          outcomes: [
            oc(68, '海报贴出去，楼道里围了很多人，主唱说要请你吃饭。', '海报', { at: { charm: 4, happiness: 4 }, npc: { '同学': { intimacy: 8 } } }),
            oc(32, '海报被教导主任撕了，说影响不好。', '被撕了', { at: { charm: 2, happiness: -2 } })
          ]
        }),
        o('加入他们，当乐手', { npc: { '同学': { intimacy: 10 } }, at: { charm: 3, happiness: 4, knowledge: -1 }, tag: '高中时加入过天台的乐队' }, {
          hint: '会和功课抢时间', tone: 'switch',
          outcomes: [
            oc(58, '你在乐队里弹得不错，成绩掉了十几名。', '成绩掉了', { at: { charm: 4, knowledge: -2, happiness: 4 } }),
            oc(42, '排练了几次就散了，大家都要准备考试。', '散了', { at: { happiness: -2 }, npc: { '同学': { intimacy: 2 } } })
          ]
        }),
        o('不去，专心准备作品集', { at: { charm: 2, knowledge: 2, happiness: -1 }, tag: '高中时没有加入乐队，专心准备作品集' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '你的作品集厚了一叠，楼道里的海报换成了别人的。', '作品集', { at: { charm: 3, knowledge: 2 } }),
            oc(40, '很多年后你还记得那段排练的声音。', '记得声音', { at: { happiness: -1, charm: 1 } })
          ]
        })
      ]
    },

    {
      id: 'v32_tr_art_4', type: 'random', stage: '少年', weight: 2,
      family: 'tr_art_show', art: 'home',
      cond: function (g) { return g.track === 'art' && g.age >= 16 && g.age <= 18; },
      title: '被换掉的名字',
      text: '学校艺术节的作品展上，你画的那张画挂在最里面。展签上的作者名字被人换成了另一个同学。你去问，负责的同学说，是贴错了。',
      opts: [
        o('要求把名字改回来', { npc: { '同学': { favor: -5 }, '老师': { favor: 3 } }, at: { charm: 2, stress: 3, happiness: 1 }, tag: '高中时为一个被换掉的署名争过' }, {
          tone: 'switch',
          outcomes: [
            oc(58, '老师查了记录，把名字改了回来，那个同学没再说话。', '改回来了', { at: { happiness: 3, charm: 2 } }),
            oc(42, '没人愿意管，你的名字一直没挂上。', '没挂上', { at: { happiness: -4, stress: 2 } })
          ]
        }),
        o('算了，画还在那儿', { at: { happiness: -1, charm: 1 }, tag: '高中时作品署名被换掉，没有追究' }, {
          tone: 'safe',
          outcomes: [
            oc(55, '你站在画前看了很久，觉得画本身没被换掉就好。', '算了', { at: { happiness: 1 } }),
            oc(45, '那个同学后来主动来找你，说想跟你一起画。', '一起画', { npc: { '同学': { intimacy: 8 } }, at: { happiness: 2 } })
          ]
        }),
        o('把自己的画取下来带回家', { npc: { '老师': { favor: -2 } }, at: { happiness: -2, charm: 2 }, tag: '高中时把自己的画从展览上取了下来' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '你把画挂在自己房间的墙上，每天进门都看见。', '挂在自己房间', { at: { happiness: 2, charm: 2 } }),
            oc(40, '老师后来找你谈话，说这样影响不好。', '被谈话', { at: { happiness: -1 }, npc: { '老师': { favor: -2 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_tr_art_5', type: 'random', stage: '少年', weight: 3,
      family: 'tr_art_major', art: 'exam',
      cond: function (g) { return g.track === 'art' && g.age >= 17 && g.age <= 18; },
      title: '作品集寄出去以后',
      text: '作品集寄出去三份，两份是没有回音的。第三份来自一所设计学院，附了一张便条：你的画里有生活。母亲把便条读了两遍，问你，设计学院是干什么的。',
      opts: [
        o('去设计学院，学视觉传达', { npc: { '母亲': { favor: 3 } }, at: { charm: 4, knowledge: 2, happiness: 3 }, tag: '考进了设计学院学视觉传达' }, {
          hint: '以后接活、改稿、熬夜', tone: 'switch',
          outcomes: [
            oc(64, '你在设计学院待了下来，第一年画了很多不想画的东西。', '待下来', { at: { charm: 3, knowledge: 2, happiness: 1 } }),
            oc(36, '学费比想象中高，家里又添了一笔账。', '学费高', { money: { cash: -8000 }, at: { happiness: -1 } })
          ]
        }),
        o('去读师范美术，先求稳', { at: { knowledge: 2, charm: 2, happiness: 1 }, tag: '高考后去读了师范美术' }, {
          tone: 'safe',
          outcomes: [
            oc(62, '师范的课很规整，你也有了稳定的方向。', '稳定', { at: { knowledge: 2, happiness: 2 } }),
            oc(38, '你总觉得画室里少了点什么，周末还是自己画。', '周末自己画', { at: { charm: 2, happiness: 1 } })
          ]
        }),
        o('不去，先接单养活自己', { at: { money: { cash: 1200 }, charm: 2, happiness: 2, knowledge: -1 }, tag: '高中毕业后先接设计单子养活自己' }, {
          hint: '自由，但不稳', tone: 'switch',
          outcomes: [
            oc(55, '你接了几个小单，赚的不多，但都是自己想做的。', '接单', { at: { happiness: 3, finance: 1 } }),
            oc(45, '客户压价压得很狠，你画了三天只拿到两百。', '被压价', { at: { happiness: -2, stress: 2 } })
          ]
        })
      ]
    }
  ]);

  /* ---- 体育路径 13–18 岁 5 条 ---- */
  add([
    {
      id: 'v32_tr_sp_1', type: 'random', stage: '少年', weight: 3,
      family: 'tr_sp_tryout', art: 'home',
      cond: function (g) { return g.track === 'sports' && g.age >= 15 && g.age <= 16; },
      title: '体校来挑人',
      text: '市体校的教练来学校挑人，让一排男生做折返跑。跑到第六趟时，有人开始走，你的腿也像灌了铅。教练站在终点，手里拿着一份名单。',
      opts: [
        o('咬牙跑完最后一趟', { npc: { '教练': { favor: 8 }, '老师': { favor: 3 } }, at: { health: 3, stress: 3, charm: 2 }, tag: '体校教练来挑人时咬着牙跑完了折返跑' }, {
          tone: 'hard',
          outcomes: [
            oc(62, '你跑完了，教练在名单上写了你的名字。', '进了名单', { at: { health: 3, happiness: 3 }, npc: { '教练': { favor: 4 } } }),
            oc(38, '你跑完就吐了，教练说身体素质还得练。', '吐了', { at: { health: -3 }, npc: { '教练': { favor: 2 } } })
          ]
        }),
        o('跑到一半就停下', { npc: { '教练': { favor: -3 } }, at: { happiness: -2, health: 1 }, tag: '体校来挑人时跑到一半就停下了' }, {
          tone: 'safe',
          outcomes: [
            oc(55, '教练没说什么，名单上没有你。', '没进名单', { at: { happiness: -3 } }),
            oc(45, '你回家跟父亲说了这件事，父亲沉默了很久。', '父亲沉默', { at: { happiness: -1 }, npc: { '父亲': { favor: -1 } } })
          ]
        }),
        o('跟教练说自己想练田径', { npc: { '教练': { favor: 5 } }, at: { health: 2, happiness: 2, charm: 1 }, tag: '跟体校教练说自己想练田径' }, {
          tone: 'safe',
          outcomes: [
            oc(64, '教练看了看你的腿，说试试短跑。', '试短跑', { at: { health: 3, happiness: 2 } }),
            oc(36, '教练说你不适合田径，倒是可以去练力量。', '练力量', { at: { health: 2, charm: 1 } })
          ]
        })
      ]
    },

    {
      id: 'v32_tr_sp_2', type: 'random', stage: '少年', weight: 3,
      family: 'tr_sp_team', art: 'home',
      cond: function (g) { return g.track === 'sports' && g.age >= 15 && g.age <= 17; },
      title: '校队的主力位置',
      text: '校队选拔的最后一场，你和另一个同学争一个主力位置。比分咬得很紧，终场前你拿到了球。看台上有人喊你的名字，也有人喊他的。',
      opts: [
        o('自己投最后一球', { npc: { '队友': { intimacy: 6 }, '教练': { favor: 5 } }, at: { health: 2, charm: 3, stress: 3 }, tag: '校队选拔最后一场自己投了关键球' }, {
          tone: 'risk',
          outcomes: [
            oc(55, '球进了，你成了主力，队友把你抬了起来。', '球进了', { at: { charm: 4, happiness: 4 }, npc: { '队友': { intimacy: 10 } } }),
            oc(45, '球没进，主力位置给了那个同学。', '球没进', { at: { happiness: -4, stress: 2 }, npc: { '队友': { intimacy: -2 } } })
          ]
        }),
        o('把球传给位置更好的队友', { npc: { '队友': { intimacy: 12 }, '教练': { favor: 3 } }, at: { charm: 2, happiness: 2, health: 1 }, tag: '校队选拔最后一场把球传给了队友' }, {
          tone: 'safe',
          outcomes: [
            oc(68, '队友投进了，跑过来抱住你，说这球该算你一半。', '助攻', { at: { charm: 3, happiness: 3 } }),
            oc(32, '队友没投进，教练说你们俩都还差点火候。', '没投进', { at: { happiness: -2, stress: 1 } })
          ]
        }),
        o('主动退出，把位置让给他', { npc: { '队友': { intimacy: 10 }, '教练': { favor: -3 } }, at: { happiness: -1, charm: 1 }, tag: '校队选拔时主动把主力位置让给了队友' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '他成了主力，每次上场前都会跟你打个招呼。', '让位', { at: { happiness: 1 }, npc: { '队友': { intimacy: 8 } } }),
            oc(40, '教练觉得你没斗志，之后很少让你上场。', '很少上场', { at: { happiness: -3 }, npc: { '教练': { favor: -3 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_tr_sp_3', type: 'random', stage: '少年', weight: 2,
      family: 'tr_sp_injury', art: 'clinic',
      cond: function (g) { return g.track === 'sports' && g.age >= 16 && g.age <= 18; },
      title: '脚踝响了一声',
      text: '训练时你落地没踩稳，脚踝响了一声，人直接坐在地上。教练跑过来，先问疼不疼，又说忍忍。医务室的冰袋只剩一个，还是别人用过的。',
      opts: [
        o('去医院拍片，按医嘱休息', { money: { cash: -1800 }, npc: { '母亲': { favor: 4 }, '教练': { favor: -2 } }, at: { health: 3, happiness: -2, stress: 2 }, tag: '高中训练时伤过脚踝，去医院拍了片' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '骨头没事，韧带拉伤，医生让你停训一个月。', '停训一个月', { at: { health: 2, happiness: -1 } }),
            oc(34, '查出一点小骨裂，需要静养三个月。', '骨裂', { at: { health: -3, happiness: -4 } })
          ]
        }),
        o('忍着继续练', { npc: { '教练': { favor: 5 } }, at: { health: -3, stress: 3, happiness: 1 }, tag: '高中时忍着脚伤继续训练' }, {
          hint: '会留下旧伤', tone: 'risk',
          outcomes: [
            oc(55, '你撑了下来，比赛照常上场。', '撑下来', { at: { health: -2, charm: 2 } }),
            oc(45, '伤拖成了旧伤，之后每次变天都疼。', '旧伤', { at: { health: -6 }, set: { old_injury: true } })
          ]
        }),
        o('去找队医，说明真实感受', { npc: { '队医': { favor: 6 }, '教练': { favor: 1 } }, at: { health: 2, happiness: 1 }, tag: '高中脚踝受伤时找了队医' }, {
          tone: 'safe',
          outcomes: [
            oc(68, '队医给你做了处理，还教你怎么绑脚踝。', '处理', { at: { health: 3 }, npc: { '队医': { favor: 3 } } }),
            oc(32, '队医说问题不大，你自己还是不放心。', '不放心', { at: { stress: 2 } })
          ]
        })
      ]
    },

    {
      id: 'v32_tr_sp_4', type: 'random', stage: '少年', weight: 2,
      family: 'tr_sp_army', art: 'office',
      cond: function (g) { return g.track === 'sports' && g.age >= 17 && g.age <= 18; },
      title: '征兵宣传车',
      text: '征兵宣传车开进了学校，放了一段队列训练的视频。报名表上要填家庭成员和身体状况，班长说，体检很严，你这条腿得先练好。',
      opts: [
        o('报名，毕业就去体检', { npc: { '班长': { favor: 5 } }, at: { health: 3, stress: 2, charm: 2 }, tag: '高中毕业那年报名参了军' }, {
          tone: 'switch',
          outcomes: [
            oc(62, '体检过了，你在入伍通知书上签了字。', '体检过了', { at: { health: 4, happiness: 3 } }),
            oc(38, '体检差了零点几，被刷了下来。', '被刷下来', { at: { happiness: -3 }, npc: { '班长': { favor: 1 } } })
          ]
        }),
        o('先问家里人的意见', { npc: { '父亲': { favor: 4 }, '母亲': { favor: -2 } }, at: { happiness: 1, charm: 1 }, tag: '想参军前先问了家里人的意见' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '父亲说男儿该去锻炼，母亲没说话。', '父亲支持', { at: { charm: 2 }, npc: { '父亲': { favor: 3 } } }),
            oc(40, '母亲坚决反对，你只好把表放回桌上。', '母亲反对', { at: { happiness: -2 }, npc: { '母亲': { favor: -2 } } })
          ]
        }),
        o('不报，继续练体育', { at: { health: 2, happiness: 1 }, tag: '高中时没有报名参军' }, {
          tone: 'safe',
          outcomes: [
            oc(62, '你继续备战比赛，把参军这件事放下了。', '继续练', { at: { health: 2, happiness: 1 } }),
            oc(38, '宣传车走的时候，你还是站在操场边看了很久。', '看着走', { at: { happiness: -1 } })
          ]
        })
      ]
    },

    {
      id: 'v32_tr_sp_5', type: 'random', stage: '少年', weight: 2,
      family: 'tr_sp_coach', art: 'home',
      cond: function (g) { return g.track === 'sports' && g.age >= 16 && g.age <= 18; },
      title: '体育老师的一句话',
      text: '体育老师把你叫到器材室，说你的成绩够不上专业队，但身体条件适合当教练或者考体育院校。他把自己当年的训练笔记借给了你，纸页上有水渍。',
      opts: [
        o('收下笔记，认真看', { npc: { '老师': { favor: 8 } }, at: { knowledge: 3, health: 2, happiness: 2 }, tag: '高中时收下了体育老师的训练笔记' }, {
          tone: 'safe',
          outcomes: [
            oc(68, '笔记里有他当年的训练计划，你照着练了一个学期。', '照着练', { at: { knowledge: 3, health: 3 } }),
            oc(32, '笔记太旧了，很多内容你看着吃力。', '看不太懂', { at: { knowledge: 1, stress: 1 } })
          ]
        }),
        o('问他能不能带你训练', { npc: { '老师': { favor: 5 } }, at: { health: 3, charm: 1 }, tag: '高中时让体育老师带着训练' }, {
          tone: 'safe',
          outcomes: [
            oc(64, '他每周抽两个下午带你练，动作改了很多。', '改动作', { at: { health: 4, charm: 1 } }),
            oc(36, '他太忙，只带了你两次。', '带了两次', { at: { health: 2 } })
          ]
        }),
        o('把笔记还回去，说自己想走别的路', { npc: { '老师': { favor: -2 } }, at: { happiness: -1, knowledge: 2 }, tag: '高中时把体育老师的笔记还了回去' }, {
          tone: 'safe',
          outcomes: [
            oc(55, '老师愣了一下，说也好，人各有路。', '人各有路', { at: { knowledge: 2, happiness: 1 } }),
            oc(45, '你后来有点后悔，偶尔会想起那本有水渍的笔记。', '后悔', { at: { happiness: -2 } })
          ]
        })
      ]
    }
  ]);

  /* =========================================================
     五、19–55 岁：职业线、婚恋、房子、家庭、健康（30 条）
     ========================================================= */

  /* ---- 理科线：工程 / 科研 / 技术 ---- */
  add([
    {
      id: 'v32_ad_sci_job', type: 'random', stage: '青年', weight: 3,
      family: 'ad_sci_job', art: 'jobfair',
      cond: function (g) { return g.track === 'science' && g.age >= 19 && g.age <= 24 && (!g.job || !g.job.id); },
      title: '第一份对口的offer',
      text: '招聘会上人挤人，你把简历投了七份，只有两家叫你留下。一家是施工单位，说要常驻工地；一家是研究所的外包岗，工资低一点，但能碰设备。HR 问你，三年后想成为什么样的人。',
      opts: [
        o('进 {{track}} 对口的施工单位', { job: 'engineer', money: { cash: 4000 }, at: { stress: 3, finance: 2 }, tag: '毕业进了施工单位做工程' }, {
          tone: 'switch',
          outcomes: [
            oc(60, '你签了施工单位的合同，第一个项目在郊区。', '签了施工单位', { job: 'engineer', money: { cash: 3000 }, at: { finance: 2 } }),
            oc(40, '项目比想象中苦，你在工地上待了三个月就想走。', '想走', { at: { stress: 4, health: -3 } })
          ]
        }),
        o('去研究所的外包岗，先摸设备', { job: 'researcher', at: { knowledge: 3, finance: 1 }, tag: '毕业先去研究所做科研助理' }, {
          hint: '钱少，但离科研近', tone: 'safe',
          outcomes: [
            oc(66, '你留在了实验室，跟着一个不爱说话的研究员。', '留在实验室', { job: 'researcher', at: { knowledge: 4 } }),
            oc(34, '外包岗没有编制，转正遥遥无期。', '没编制', { at: { stress: 3, happiness: -2 } })
          ]
        }),
        o('先不签，回家准备考研', { money: { cash: -3000 }, at: { knowledge: 4, stress: 3 }, tag: '毕业那年没有急着工作，先准备考研' }, {
          tone: 'switch',
          outcomes: [
            oc(55, '你考上了，又读了三年书。', '考上研究生', { at: { knowledge: 5, happiness: 3 } }),
            oc(45, '差了几分，你调剂到一所普通学校。', '调剂', { at: { knowledge: 3, happiness: -2 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ad_sci_lab', type: 'random', stage: '青年', weight: 3,
      family: 'ad_sci_lab', art: 'office',
      cond: function (g) { return g.track === 'science' && g.age >= 25 && g.age <= 34 && g.job && g.job.id; },
      title: '数据跑了一整夜',
      text: '你负责的那组数据跑了整夜，早上出来时是一条几乎平的线。导师说，平线也是结果，但项目结题就差这一块。同组的人都在等你的结论，窗外开始下雨。',
      opts: [
        o('如实写进报告', { npc: { '导师': { favor: 2 }, '同事': { favor: -2 } }, at: { knowledge: 3, stress: 2 }, tag: '科研项目里如实报告了失败的数据' }, {
          hint: '可能影响结题', tone: 'safe',
          outcomes: [
            oc(62, '导师看完沉默了一会儿，说那就换个方向。', '换方向', { at: { knowledge: 4, stress: 1 } }),
            oc(38, '项目因此延期，组里有人把责任推到你身上。', '延期', { at: { stress: 4, happiness: -3 }, npc: { '同事': { intimacy: -5 } } })
          ]
        }),
        o('把异常值剔掉，重新拟合', { npc: { '同事': { favor: 4 } }, at: { knowledge: 2, stress: 3, happiness: -1 }, tag: '科研时为赶结题剔过异常值' }, {
          hint: '不严谨，但能交差', tone: 'risk',
          outcomes: [
            oc(55, '报告按时交了，后来没人再追问那条线。', '按时结题', { at: { happiness: 1 }, npc: { '导师': { favor: 2 } } }),
            oc(45, '评审时有人问到那组数据，你答不上来。', '被追问', { at: { stress: 5, happiness: -4 }, npc: { '导师': { favor: -3 } } })
          ]
        }),
        o('拉着同事一起重做一遍', { npc: { '同事': { intimacy: 10 } }, at: { knowledge: 3, health: -2, stress: 2 }, tag: '科研遇到问题时拉着同事重做了实验' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '两个人熬了三夜，终于找到传感器的问题。', '找到问题', { at: { knowledge: 4, happiness: 3 }, npc: { '同事': { intimacy: 8 } } }),
            oc(34, '重做了一遍还是一样，大家都有点泄气。', '还是一样', { at: { health: -3, happiness: -2 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ad_sci_startup', type: 'random', stage: '中年', weight: 2,
      family: 'ad_sci_startup', art: 'office',
      cond: function (g) { return g.track === 'science' && g.age >= 30 && g.age <= 45 && g.attrs.knowledge >= 60; },
      title: '老同学的技术公司',
      text: '大学同学拉你入伙，说他手里有一项技术，缺一个懂工程的人。他把商业计划书摊在桌上，第一页写着“三年上市”。你看见最后一页的现金流，估算得很乐观。',
      opts: [
        o('辞职入伙，拿股份', { money: { cash: -60000 }, npc: { '同学': { intimacy: 8 } }, at: { stress: 4, finance: 2, happiness: 2 }, tag: '中年辞职入伙了一家技术公司' }, {
          hint: '可能血本无归', tone: 'hard',
          outcomes: [
            oc(45, '公司撑了两年，最后被并掉，你拿到一笔不多的钱。', '被并掉', { money: { cash: 40000 }, at: { stress: 3 } }),
            oc(35, '公司没撑过一年，你投进去的钱没了。', '没撑过一年', { money: { cash: -60000 }, at: { happiness: -5, stress: 4 } }),
            oc(20, '真的做起来了，你的股份第一次有了分红。', '做起来了', { money: { cash: 200000 }, at: { finance: 4, happiness: 5 } })
          ]
        }),
        o('不辞职，业余帮他做技术', { npc: { '同学': { intimacy: 6 } }, at: { stress: 2, knowledge: 2, finance: 1 }, tag: '业余帮同学的技术公司做方案' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '你利用周末帮他做了两版方案，拿了一点顾问费。', '顾问费', { money: { cash: 8000 }, at: { knowledge: 2 } }),
            oc(34, '项目越拖越久，你后来就慢慢不参与了。', '慢慢退出', { at: { happiness: -1 } })
          ]
        }),
        o('婉拒，专心做手上的事', { npc: { '同学': { favor: -2 } }, at: { happiness: 1, knowledge: 1 }, tag: '婉拒了同学的技术公司邀约' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '你留在了原单位，几年后升了一级。', '留在原单位', { at: { finance: 2 }, npc: { '上司': { favor: 3 } } }),
            oc(40, '偶尔听说那家公司起起落落，你心里会算一遍。', '心里算一遍', { at: { happiness: -1 } })
          ]
        })
      ]
    }
  ]);

  /* ---- 文科线：传媒 / 法务 / 教育 / 行政 ---- */
  add([
    {
      id: 'v32_ad_arts_media', type: 'random', stage: '青年', weight: 3,
      family: 'ad_arts_media', art: 'office',
      cond: function (g) { return g.track === 'arts' && g.age >= 19 && g.age <= 27; },
      title: '报社实习的第一篇稿',
      text: '实习的第一周，编辑让你去采访一个夜市摊主。你写了三千字，被删到八百字，标题也换了。编辑说，你写的那些细节很好，但读者没耐心。',
      opts: [
        o('去 {{track}} 方向的报社继续实习', { npc: { '编辑': { favor: 6 } }, at: { charm: 2, knowledge: 3, stress: 2 }, tag: '毕业前去报社实习，写夜市摊主' }, {
          tone: 'safe',
          outcomes: [
            oc(62, '稿子见报那天，你买了两份，给母亲寄了一份。', '稿子见报', { at: { charm: 3, happiness: 4 }, npc: { '编辑': { favor: 3 } } }),
            oc(38, '稿子被压了下来，编辑说题材不够新。', '被压稿', { at: { happiness: -2, knowledge: 1 } })
          ]
        }),
        o('把稿子发在自己的账号上', { at: { charm: 3, happiness: 2, stress: 1 }, tag: '把报社实习的稿子发在了自己的账号上' }, {
          tone: 'switch',
          outcomes: [
            oc(55, '那条稿子转了不少，有个小媒体来问你要不要写专栏。', '被约稿', { money: { cash: 600 }, at: { charm: 3, happiness: 3 } }),
            oc(45, '没什么人看，你把账号改成了记录生活。', '没什么人看', { at: { happiness: -1 } })
          ]
        }),
        o('换去考公或考法务岗', { npc: { '母亲': { favor: 3 } }, at: { knowledge: 2, stress: 2, finance: 1 }, tag: '从报社转去考公或法务岗' }, {
          tone: 'switch',
          outcomes: [
            oc(52, '你考上了，工作稳定，只是写东西的时间少了。', '考上了', { job: 'civil', at: { finance: 3, happiness: 1 } }),
            oc(48, '考了两年才上岸，中间打过很多零工。', '考了两年', { at: { finance: 1, stress: 3, happiness: -1 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ad_arts_legal', type: 'random', stage: '青年', weight: 3,
      family: 'ad_arts_legal', art: 'office',
      cond: function (g) { return g.track === 'arts' && g.age >= 24 && g.age <= 38 && g.job && g.job.id; },
      title: '第一桩自己经手的案子',
      text: '带你的律师把一摞材料推过来，说这案子让你跟。当事人是个六十多岁的老人，反复说自己没有签过那份合同。你翻到最后一页，签名处的笔迹确实有些抖。',
      opts: [
        o('按程序走，先取证', { npc: { '当事人': { favor: 5 }, '律师': { favor: 4 } }, at: { knowledge: 3, stress: 2 }, tag: '第一次独立跟案子时坚持按程序取证' }, {
          tone: 'safe',
          outcomes: [
            oc(64, '证据链补上了，老人的说法站住了。', '取证成功', { at: { knowledge: 3, happiness: 3 } }),
            oc(36, '取证拖了很久，家属开始不信任你。', '家属不信任', { at: { stress: 3, happiness: -2 } })
          ]
        }),
        o('先劝双方和解', { npc: { '当事人': { favor: 2 }, '律师': { favor: -2 } }, at: { charm: 2, stress: -1 }, tag: '第一次跟案子时先劝双方和解' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '双方各退一步，事情解决得比想象中快。', '和解', { at: { happiness: 2 }, money: { cash: 2000 } }),
            oc(40, '老人觉得自己吃了亏，后来换了律师。', '换了律师', { at: { happiness: -1 }, npc: { '当事人': { favor: -3 } } })
          ]
        }),
        o('去问带你的律师该怎么做', { npc: { '律师': { favor: 6 } }, at: { knowledge: 2 }, tag: '第一次跟案子时去请教了带自己的律师' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '他没直接回答，只让你把材料再读一遍。你读懂了。', '读懂了', { at: { knowledge: 3, happiness: 2 } }),
            oc(34, '他说他很忙，让你自己拿主意。', '自己拿主意', { at: { stress: 3 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ad_arts_admin', type: 'random', stage: '中年', weight: 2,
      family: 'ad_arts_admin', art: 'office',
      cond: function (g) { return g.track === 'arts' && g.age >= 30 && g.age <= 48 && g.job && g.job.id; },
      title: '办公室的位置',
      text: '单位要提一个办公室主任，几个候选人里你的资历最浅。领导找你谈话，说这个位置要会写材料、会协调、还要能受委屈。你回到座位上，桌上堆着三份待改的汇报稿。',
      opts: [
        o('接下来，把材料写到最好', { npc: { '领导': { favor: 7 } }, at: { stress: 4, knowledge: 2, finance: 2 }, tag: '中年接下了办公室主任的位置' }, {
          tone: 'switch',
          outcomes: [
            oc(60, '你上任了，第一年几乎每天都在改稿。', '上任', { promote: true, at: { finance: 3, stress: 4 } }),
            oc(40, '位置给了别人，你继续写材料，只是心里凉了一截。', '没轮到', { at: { happiness: -3, stress: 2 } })
          ]
        }),
        o('推给资历更老的人', { npc: { '领导': { favor: 2 }, '同事': { favor: 4 } }, at: { stress: -2, happiness: 1 }, tag: '把办公室主任的位置推给了老同事' }, {
          tone: 'safe',
          outcomes: [
            oc(62, '老同事上了位，之后对你有事必帮。', '老同事上位', { at: { happiness: 2, stress: -2 }, npc: { '同事': { intimacy: 8 } } }),
            oc(38, '领导觉得你没有担当，之后的重点项目不再找你。', '被边缘', { at: { finance: -1, happiness: -2 } })
          ]
        }),
        o('申请调去业务部门', { at: { knowledge: 2, stress: 1, happiness: 1 }, tag: '中年申请从行政调去了业务部门' }, {
          tone: 'switch',
          outcomes: [
            oc(55, '调成了，你终于不用每天改别人的稿子。', '调成了', { at: { happiness: 3, knowledge: 2 } }),
            oc(45, '申请压了半年没批，你只好继续写下去。', '没批', { at: { stress: 3, happiness: -2 } })
          ]
        })
      ]
    }
  ]);

  /* ---- 艺术线：设计与自由职业 ---- */
  add([
    {
      id: 'v32_ad_art_studio', type: 'random', stage: '青年', weight: 3,
      family: 'ad_art_studio', art: 'office',
      cond: function (g) { return g.track === 'art' && g.age >= 20 && g.age <= 32; },
      title: '合租的画室',
      text: '你和两个同学合租了一间旧厂房，做画室兼接单。房租一个月三千，三个人分摊。第一个月只接了两个小单，第二个月水电费单子贴在了门上。',
      opts: [
        o('靠 {{track}} 的手艺接单撑下去', { money: { cash: -3000 }, npc: { '同学': { intimacy: 8 } }, at: { charm: 2, stress: 3, happiness: 2 }, tag: '青年时和朋友合租画室接设计单' }, {
          tone: 'switch',
          outcomes: [
            oc(55, '单子慢慢多了，画室撑过了最难的半年。', '撑下去', { money: { cash: 6000 }, at: { charm: 3, happiness: 3 } }),
            oc(30, '钱一直不够，你们把画室搬到了更远的地方。', '搬到更远', { at: { stress: 4, happiness: -2 } }),
            oc(15, '三个人因为分钱吵翻，画室散了。', '散了', { at: { happiness: -4 }, npc: { '同学': { intimacy: -8 } } })
          ]
        }),
        o('去公司上班，画室当副业', { job: 'designer', at: { finance: 2, charm: 2, stress: 2 }, tag: '青年时一边上班一边维持画室' }, {
          tone: 'safe',
          outcomes: [
            oc(62, '有了固定工资，你反而画得更安心。', '有固定工资', { job: 'designer', at: { finance: 2, happiness: 1 } }),
            oc(38, '白天上班晚上画，身体开始吃不消。', '身体吃不消', { at: { health: -4, stress: 3 } })
          ]
        }),
        o('关掉画室，回家专心画画', { at: { happiness: 1, charm: 1, finance: -2 }, tag: '青年时关掉了合租画室，回家专心画画' }, {
          tone: 'safe',
          outcomes: [
            oc(55, '你在家画自己想画的，作品慢慢有了样子。', '作品有样子', { at: { charm: 3, happiness: 3 } }),
            oc(45, '没有收入，家里的压力一年比一年大。', '家里压力', { at: { finance: -3, stress: 3 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ad_art_client', type: 'random', stage: '中年', weight: 3,
      family: 'ad_art_client', art: 'office',
      cond: function (g) { return g.track === 'art' && g.age >= 28 && g.age <= 45; },
      title: '第七版稿子',
      text: '客户把第七版稿子打回来，说还是第一版好。你翻出第一版，发现那就是你最初交的。对方在电话里说，辛苦了，下周一要终稿。',
      opts: [
        o('照着第一版改回去', { money: { cash: 8000 }, npc: { '客户': { favor: 5 } }, at: { stress: 3, happiness: -2 }, tag: '做设计时被客户要求改回第一版' }, {
          hint: '钱到手，人很累', tone: 'switch',
          outcomes: [
            oc(66, '你改回去，客户很满意，尾款按时到账。', '尾款到账', { money: { cash: 4000 }, at: { finance: 1 } }),
            oc(34, '客户又提了新意见，你在周末重做了两页。', '又提意见', { at: { stress: 4, happiness: -3 } })
          ]
        }),
        o('把七版都发给客户，让他自己选', { npc: { '客户': { favor: -3 } }, at: { charm: 1, stress: 2, happiness: 1 }, tag: '把七个版本的稿子一起发给了客户' }, {
          tone: 'risk',
          outcomes: [
            oc(55, '客户看了很久，最后选了第三版。', '选了第三版', { money: { cash: 6000 }, at: { happiness: 1 } }),
            oc(45, '客户觉得你不专业，把项目给了别人。', '项目飞了', { money: { cash: -2000 }, at: { stress: 4, happiness: -3 }, npc: { '客户': { favor: -5 } } })
          ]
        }),
        o('跟客户讲清楚每一版的想法', { npc: { '客户': { favor: 7 } }, at: { charm: 3, stress: 2, happiness: 2 }, tag: '做设计时跟客户讲清了每一版的想法' }, {
          tone: 'safe',
          outcomes: [
            oc(62, '客户听完选了第五版，还把你推荐给了朋友。', '被推荐', { money: { cash: 5000 }, npc: { '客户': { favor: 4 } }, at: { charm: 3 } }),
            oc(38, '客户没耐心听完，只说按第一版来。', '没听完', { at: { stress: 3 } })
          ]
        })
      ]
    }
  ]);

  /* ---- 体育线：体校 / 参军 / 教练 / 安保 ---- */
  add([
    {
      id: 'v32_ad_sp_pro', type: 'random', stage: '青年', weight: 3,
      family: 'ad_sp_pro', art: 'jobfair',
      cond: function (g) { return g.track === 'sports' && g.age >= 18 && g.age <= 25; },
      title: '体校毕业那年',
      text: '体校毕业，队里只留两个人。教练说你爆发力够，但稳定差一点。同期的队友已经签了省队，你站在跑道边，看着他们把行李搬上车。',
      opts: [
        o('走 {{track}} 的正规通道，去考体育院校', { money: { cash: -5000 }, at: { knowledge: 2, health: 2, stress: 2 }, tag: '体校毕业后考了体育院校' }, {
          tone: 'switch',
          outcomes: [
            oc(58, '你考上了，毕业以后能当体育老师。', '考上体院', { at: { knowledge: 4, happiness: 3 }, money: { cash: -3000 } }),
            oc(42, '差了几分，你去了另一所专科。', '去了专科', { at: { knowledge: 2, happiness: -2 } })
          ]
        }),
        o('报名参军', { npc: { '教练': { favor: 3 } }, at: { health: 4, stress: 3, charm: 2 }, tag: '体校毕业后去参了军' }, {
          tone: 'switch',
          outcomes: [
            oc(60, '你入伍了，第一次站军姿站到腿抖。', '入伍', { job: 'soldier', at: { health: 4, happiness: 2 } }),
            oc(40, '体检或政审没过，你回到了地方。', '没过', { at: { happiness: -3 }, npc: { '教练': { favor: 1 } } })
          ]
        }),
        o('去健身房当教练', { job: 'coach', npc: { '客户': { favor: 4 } }, at: { charm: 2, health: 2, finance: 2 }, tag: '体校毕业后去健身房当了教练' }, {
          tone: 'safe',
          outcomes: [
            oc(64, '你带的第一个客户瘦了十斤，介绍了三个朋友来。', '客户介绍朋友', { money: { cash: 3000 }, at: { charm: 2 } }),
            oc(36, '健身房的业绩压力很大，你卖课卖得很难受。', '业绩压力', { at: { stress: 4, happiness: -2 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ad_sp_coach', type: 'random', stage: '中年', weight: 2,
      family: 'ad_sp_coach', art: 'office',
      cond: function (g) { return g.track === 'sports' && g.age >= 26 && g.age <= 48; },
      title: '训练场上的哨子',
      text: '你带的一批孩子里，有个男孩很有天赋，但总在训练时偷懒。他母亲每次来接他，都要问什么时候能出成绩。你吹响哨子，他站在队尾，眼睛看着别处。',
      opts: [
        o('单独留下他，多练半小时', { npc: { '学生': { favor: 7 } }, at: { health: -1, stress: 3, charm: 2, happiness: 2 }, tag: '当教练时单独留下有天赋的孩子加练' }, {
          tone: 'safe',
          outcomes: [
            oc(62, '半年后他在市里拿了名次，他母亲第一次跟你说了谢谢。', '拿了名次', { at: { happiness: 4, charm: 2 }, money: { cash: 2000 } }),
            oc(38, '他练了两周就不来了，说太苦。', '不来了', { at: { happiness: -1 } })
          ]
        }),
        o('按规矩来，不额外照顾', { npc: { '学生': { favor: -3 }, '家长': { favor: -2 } }, at: { stress: 1, happiness: -1 }, tag: '当教练时坚持不额外照顾学生' }, {
          tone: 'safe',
          outcomes: [
            oc(58, '你按计划训练，队伍整体成绩稳了下来。', '队伍稳定', { at: { happiness: 2 } }),
            oc(42, '那个男孩慢慢被别的孩子超过，最后退队了。', '退队', { at: { happiness: -3 } })
          ]
        }),
        o('跟他母亲谈一次', { npc: { '家长': { favor: 5 }, '学生': { favor: 3 } }, at: { charm: 2, stress: 2 }, tag: '当教练时跟偷懒学生的母亲谈过一次' }, {
          tone: 'safe',
          outcomes: [
            oc(64, '他母亲理解了训练规律，不再催成绩。', '家长理解', { at: { happiness: 2 }, npc: { '家长': { favor: 3 } } }),
            oc(36, '她认为你在推卸责任，把孩子转到了别的班。', '转班', { at: { happiness: -2 }, npc: { '家长': { favor: -4 } } })
          ]
        })
      ]
    }
  ]);

  /* ---- 跨路径：转行 / 城市 ---- */
  add([
    {
      id: 'v32_ad_track_switch', type: 'random', stage: '中年', weight: 3,
      family: 'ad_track_switch', art: 'office',
      cond: function (g) { return g.track && g.age >= 26 && g.age <= 38; },
      title: '做不下去的那个晚上',
      text: '你在工位上坐到很晚，屏幕上是一份改不完的材料。你想起自己十四岁在表上打的那个勾，想起当时以为这条路会一直走下去。手机里有个老同学发来消息，说他那边缺人。',
      opts: [
        o('顺着 {{track}} 转去相邻的行业', { at: { stress: 2, finance: 1, knowledge: 2 }, tag: '中年顺着原来的方向转去了相邻行业' }, {
          tone: 'switch',
          outcomes: [
            oc(58, '你转过去，前几年的积累居然用得上。', '转成了', { at: { knowledge: 3, finance: 2, happiness: 2 } }),
            oc(42, '新行业不认你原来的经验，你从头学起。', '从头学', { at: { stress: 4, finance: -2 } })
          ]
        }),
        o('不理，熬过这一阵再说', { at: { stress: 4, happiness: -3, finance: 1 }, tag: '中年想转行但最后留了下来' }, {
          tone: 'hard',
          outcomes: [
            oc(60, '你留下来，第二年升了一小级。', '升了一小级', { promote: true, at: { finance: 2, happiness: 1 } }),
            oc(40, '你熬出了倦怠，开始频繁请病假。', '倦怠', { at: { health: -3, happiness: -4 } })
          ]
        }),
        o('约老同学出来聊聊', { npc: { '同学': { intimacy: 8 } }, at: { happiness: 2, stress: -2 }, tag: '中年约老同学聊了转行的事' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '你们聊了一夜，他把自己走过的弯路讲给你听。', '聊了一夜', { at: { happiness: 3, stress: -3 }, npc: { '同学': { intimacy: 10 } } }),
            oc(34, '他也没想清楚，最后两个人一起叹气。', '一起叹气', { at: { happiness: -1 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ad_track_city', type: 'random', stage: '青年', weight: 3,
      family: 'ad_track_city', art: 'office',
      cond: function (g) { return g.track && g.age >= 22 && g.age <= 34; },
      title: '去哪个城市',
      text: '两个 offer 摆在面前，一个在老家省城，稳定，离家近；一个在一线城市，工资高，房租也高。母亲在电话里说，你自己定，别管我们。',
      opts: [
        o('去 {{track}} 更集中的那座城市', { money: { cash: -8000 }, at: { stress: 3, finance: 3, knowledge: 2 }, tag: '青年时去了本行更集中的城市' }, {
          hint: '机会多，房租也高', tone: 'switch',
          outcomes: [
            oc(58, '你去了，前两年很苦，第三年才有了点样子。', '站住脚', { at: { finance: 4, happiness: 2 } }),
            oc(30, '房租压得你喘不过气，你搬了三次家。', '搬了三次家', { at: { stress: 4, finance: -2 } }),
            oc(12, '你很快发现这个行业在这座城市已经饱和。', '行业饱和', { at: { happiness: -3, finance: -2 } })
          ]
        }),
        o('留在省城，离家近一点', { npc: { '母亲': { favor: 5 } }, at: { happiness: 2, finance: 1 }, tag: '青年时留在了省城，离家近' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '你留了下来，周末能回家吃饭。', '周末回家', { at: { happiness: 3 }, npc: { '母亲': { favor: 3 } } }),
            oc(34, '机会确实少，几年后你有点不甘心。', '有点不甘心', { at: { happiness: -2, finance: -1 } })
          ]
        }),
        o('跟 {{npc:发小}} 去同一座城市', { npc: { '发小': { intimacy: 10 } }, at: { happiness: 3, stress: 2, charm: 1 }, tag: '青年时跟发小去了同一座城市' }, {
          tone: 'safe',
          outcomes: [
            oc(64, '你们合租，互相照应，日子没那么难熬。', '合租', { at: { happiness: 4, stress: -2 }, npc: { '发小': { intimacy: 6 } } }),
            oc(36, '他先找到了工作，你却一直不顺。', '不顺', { at: { stress: 3, happiness: -2 } })
          ]
        })
      ]
    }
  ]);

  /* ---- 通用：租房 / 婚恋 / 买房 / 生育 / 赡养 / 跳槽 / 副业 / 健康 / 同学会 / 城市 / 办公室 / 借钱 / 催婚 / 婚姻危机 / 孩子上学 / 体检 / 发小 ---- */
  add([
    {
      id: 'v32_ad_rent', type: 'random', stage: '青年', weight: 2,
      family: 'ad_rent', art: 'emptyHome',
      cond: function (g) { return g.age >= 19 && g.age <= 27 && !g.house.owned; },
      title: '第一次租房',
      text: '中介带你看了三套房：一间在顶楼，夏天像蒸笼；一间朝北，冬天不见太阳；还有一间离地铁近，但房东要求押一付三。你的工资还没发，卡里只剩四千。',
      opts: [
        o('租地铁边那间，押一付三', { money: { cash: -9000 }, at: { stress: 2, happiness: 2 }, tag: '第一次租房租在地铁边，押一付三' }, {
          tone: 'switch',
          outcomes: [
            oc(62, '房子小，但通勤方便，你省下了很多时间。', '通勤方便', { at: { happiness: 3, stress: -1 } }),
            oc(38, '房东临时涨价，你住了半年就搬走了。', '房东涨价', { money: { cash: -2000 }, at: { stress: 3, happiness: -2 } })
          ]
        }),
        o('租顶楼那间，便宜一半', { money: { cash: -3600 }, at: { health: -2, finance: 1 }, tag: '第一次租房租在顶楼，夏天像蒸笼' }, {
          tone: 'safe',
          outcomes: [
            oc(58, '夏天确实难熬，但你攒下了第一笔钱。', '攒下钱', { at: { finance: 2 }, money: { cash: 3000 } }),
            oc(42, '热得整夜睡不着，你落下了失眠的毛病。', '失眠', { at: { health: -3, happiness: -2 } })
          ]
        }),
        o('搬去和 {{npc:发小}} 合租', { money: { cash: -4000 }, npc: { '发小': { intimacy: 10 } }, at: { happiness: 3, charm: 1 }, tag: '青年时和发小合租过' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '两个人分摊房租，晚饭常常一起吃。', '合租', { at: { happiness: 4, finance: 1 } }),
            oc(34, '生活习惯差太多，你们为谁洗碗吵过几次。', '为洗碗吵', { at: { happiness: -2 }, npc: { '发小': { intimacy: -3 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_ad_marriage', type: 'random', stage: '青年', weight: 3,
      family: 'ad_marriage', art: 'wedding',
      cond: function (g) { return g.age >= 24 && g.age <= 33 && g.family.marriage.status !== '已婚'; },
      title: '谈到结婚这一步',
      text: '你们在一起两年，双方父母见了面。饭桌上谈到房子、彩礼、以后住哪。她（他）在桌下握住你的手，掌心有点凉。母亲笑着说，都好商量，回头又看了你一眼。',
      opts: [
        o('把话挑明，能办的先办', { money: { cash: -60000 }, npc: { '伴侣': { intimacy: 12 } }, at: { happiness: 4, stress: 3 }, tag: '二十四岁后谈婚论嫁，先把能办的办了' }, {
          tone: 'switch',
          outcomes: [
            oc(62, '婚礼从简，你们把日子定了下来。', '定了日子', { marry: true, at: { happiness: 5 } }),
            oc(38, '彩礼和房子谈不拢，两边老人都不高兴。', '谈不拢', { money: { cash: -20000 }, at: { stress: 4, happiness: -3 } })
          ]
        }),
        o('再等等，先把钱攒够', { npc: { '伴侣': { favor: -3 } }, at: { finance: 1, happiness: -1 }, tag: '谈婚论嫁时选择再等等，先攒钱' }, {
          hint: '对方未必愿意等', tone: 'risk',
          outcomes: [
            oc(55, '你们又等了两年，最后简单办了。', '等了两年', { marry: true, money: { cash: -30000 }, at: { happiness: 2 } }),
            oc(45, '对方家里等不下去，这段关系慢慢淡了。', '淡了', { at: { happiness: -5 }, npc: { '伴侣': { intimacy: -10 } } })
          ]
        }),
        o('带 {{npc:发小}} 去婚宴，让他帮着说话', { npc: { '发小': { intimacy: 8 } }, at: { happiness: 2, charm: 2 }, tag: '谈婚论嫁时请发小在婚宴上帮忙说话' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '发小在桌上把场面圆了过去，两家都松了口。', '圆场', { marry: true, at: { happiness: 4 } }),
            oc(34, '他话说得太直，反而让气氛僵了一阵。', '气氛僵', { at: { stress: 3, happiness: -2 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ad_house', type: 'random', stage: '中年', weight: 3,
      family: 'ad_house', art: 'house',
      cond: function (g) { return g.age >= 27 && g.age <= 42 && !g.house.owned && g.attrs.finance >= 45; },
      title: '售楼处的那张表',
      text: '售楼处的灯打得很亮，销售把一张价格表推过来，说这个户型只剩两套。首付要凑三十万，贷款三十年，月供占到你工资的一半。你算了三遍，数字都没变。',
      opts: [
        o('买下来，先上车', { house: true, at: { stress: 4, happiness: 3 }, tag: '中年咬牙买了第一套房' }, {
          hint: '月供会压很多年', tone: 'hard',
          outcomes: [
            oc(62, '你签了字，交房那天在空房子里站了很久。', '买了房', { house: true, at: { happiness: 5 } }),
            oc(38, '签完才发现合同里有补充条款，多花了一笔钱。', '补充条款', { house: true, money: { cash: -30000 }, at: { stress: 4 } })
          ]
        }),
        o('再等等，先租房', { at: { happiness: -1, finance: 1, stress: -2 }, tag: '中年没有买房，继续租房' }, {
          tone: 'safe',
          outcomes: [
            oc(58, '房价后来涨了，你再也追不上那个首付。', '追不上', { at: { happiness: -3 } }),
            oc(42, '房价横了几年，你反而攒下了更多钱。', '攒下更多', { money: { cash: 40000 }, at: { finance: 2 } })
          ]
        }),
        o('请 {{npc:发小}} 帮忙一起看房', { npc: { '发小': { intimacy: 8 } }, at: { happiness: 2, knowledge: 1 }, tag: '中年买房时请发小帮忙看过房' }, {
          tone: 'safe',
          outcomes: [
            oc(64, '他做过中介的朋友帮着砍了几万。', '砍了几万', { house: true, at: { happiness: 4 } }),
            oc(36, '他的意见让你犹豫了半年，房子最后卖光了。', '犹豫', { at: { happiness: -2 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ad_child', type: 'random', stage: '中年', weight: 3,
      family: 'ad_child', art: 'nursery',
      cond: function (g) { return g.age >= 27 && g.age <= 40 && g.family.marriage.status === '已婚' && g.family.childrenIds.length === 0; },
      title: '要不要孩子',
      text: '医院的检查单上写着一切正常。医生说，你们这个年龄可以考虑了。回家的路上你们都没说话，电梯里有人在哄孩子，声音很轻。',
      opts: [
        o('要一个孩子', { money: { cash: -30000 }, npc: { '伴侣': { intimacy: 10 } }, at: { happiness: 4, stress: 3 }, tag: '中年决定要了一个孩子' }, {
          tone: 'switch',
          outcomes: [
            oc(66, '孩子出生那天，你在产房外站了很久。', '孩子出生', { child: true, at: { happiness: 6 } }),
            oc(22, '备孕了一年多才怀上，中间有过一次不好的消息。', '备孕艰难', { child: true, money: { cash: -20000 }, at: { happiness: 2, stress: 3 } }),
            oc(12, '检查发现有些问题，你们决定先治疗。', '先治疗', { money: { cash: -40000 }, at: { happiness: -2, stress: 3 } })
          ]
        }),
        o('先不要，过两年再说', { npc: { '伴侣': { favor: -1 } }, at: { finance: 2, happiness: 1, stress: -2 }, tag: '中年决定先不要孩子，过两年再说' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '你们过了两年清静日子，存款多了一些。', '清静日子', { money: { cash: 30000 }, at: { happiness: 2 } }),
            oc(40, '两年后再想要，身体条件差了一些。', '条件差了', { money: { cash: -20000 }, at: { happiness: -2, stress: 2 } })
          ]
        }),
        o('跟伴侣把顾虑都说出来', { npc: { '伴侣': { intimacy: 12 } }, at: { happiness: 3, stress: -2 }, tag: '中年跟伴侣坦诚谈过要不要孩子' }, {
          tone: 'safe',
          outcomes: [
            oc(68, '你们谈了一夜，最后决定顺其自然。', '顺其自然', { at: { happiness: 4 } }),
            oc(32, '谈完之后分歧更大，冷战了一阵。', '冷战', { at: { happiness: -3, stress: 3 }, npc: { '伴侣': { intimacy: -6 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_ad_parent_care', type: 'random', stage: '中年', weight: 3,
      family: 'ad_parent_care', art: 'clinic',
      cond: function (g) { return g.age >= 35 && g.age <= 55 && (LS.npcHealth(g, '父亲') < 70 || LS.npcHealth(g, '母亲') < 70); },
      title: '母亲的住院单',
      text: '母亲在楼梯上摔了一跤，髋部骨折，需要手术。医生说术后至少卧床三个月。父亲耳朵背，听不清医嘱。你在走廊里算着请护工的钱和请假的天数。',
      opts: [
        o('请长假，自己照顾', { money: { cash: -30000 }, npc: { '母亲': { favor: 12 }, '父亲': { favor: 6 } }, at: { stress: 4, happiness: 2 }, tag: '中年为照顾母亲请了长假' }, {
          tone: 'hard',
          outcomes: [
            oc(62, '母亲恢复得不错，你瘦了八斤。', '恢复不错', { at: { health: -3, happiness: 3 } }),
            oc(38, '请假太久，单位把你的项目交给了别人。', '项目被交', { at: { finance: -2, stress: 4 } })
          ]
        }),
        o('请护工，自己下班去陪', { money: { cash: -18000 }, npc: { '母亲': { favor: 6 }, '护工': { favor: 5 } }, at: { stress: 3 }, tag: '中年给母亲请了护工，下班去陪' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '护工很细心，母亲恢复得比预想快。', '护工细心', { at: { happiness: 2, stress: -2 } }),
            oc(34, '第一个护工不尽心，你换了两次才放心。', '换了两次', { money: { cash: -6000 }, at: { stress: 4, happiness: -2 } })
          ]
        }),
        o('跟兄弟姐妹商量轮班', { npc: { '母亲': { favor: 4 } }, at: { stress: 1, happiness: 1, charm: 1 }, tag: '中年和兄弟姐妹商量照顾母亲的轮班' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '大家排了班，你轻松了一些。', '排了班', { at: { stress: -2, happiness: 2 } }),
            oc(40, '有人总说自己忙，最后多半还是你在跑。', '还是你在跑', { at: { stress: 4, happiness: -2 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ad_jump', type: 'random', stage: '青年', weight: 3,
      family: 'ad_jump', art: 'jobfair',
      cond: function (g) { return g.age >= 25 && g.age <= 40 && g.job && g.job.id; },
      title: '猎头打来的电话',
      text: '猎头在电话里报了数字，比现在的工资高四成，但要换城市、换行业，还要三个月试用期。你把电话挂了，回到会议室，领导正在讲下一年的规划。',
      opts: [
        o('跳，趁还跳得动', { money: { cash: 20000 }, at: { stress: 4, finance: 3, happiness: 1 }, tag: '青年时跳槽去了工资高四成的新公司' }, {
          hint: '试用期有风险', tone: 'switch',
          outcomes: [
            oc(58, '你跳了，试用期顺利过去，工资涨了一截。', '跳槽成功', { salaryPct: 0.4, money: { cash: 15000 }, at: { finance: 3 } }),
            oc(30, '新公司节奏太快，你三个月就撑不住了。', '撑不住', { money: { cash: -5000 }, at: { stress: 5, happiness: -4 } }),
            oc(12, '试用期没过，你回头发现原单位已经有人顶了位置。', '两头空', { at: { finance: -2, happiness: -5 } })
          ]
        }),
        o('用这个 offer 跟领导谈加薪', { npc: { '领导': { favor: -2 } }, at: { finance: 2, stress: 2 }, tag: '青年时用外面的offer跟领导谈过加薪' }, {
          tone: 'switch',
          outcomes: [
            oc(55, '领导给你加了一点，但没到四成。', '加了一点', { money: { cash: 6000 }, at: { finance: 1 } }),
            oc(45, '领导觉得你有二心，之后的重点项目不再带你。', '被猜忌', { at: { stress: 4, happiness: -3 }, npc: { '领导': { favor: -5 } } })
          ]
        }),
        o('听 {{npc:发小}} 的建议，先不跳', { npc: { '发小': { intimacy: 6 } }, at: { stress: -2, happiness: 1 }, tag: '青年时听发小建议没有跳槽' }, {
          tone: 'safe',
          outcomes: [
            oc(64, '你留了下来，第二年等到了一个更稳的机会。', '等到机会', { promote: true, at: { finance: 2, happiness: 2 } }),
            oc(36, '机会没来，你开始后悔当初没走。', '后悔', { at: { happiness: -3 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ad_sidejob', type: 'random', stage: '青年', weight: 2,
      family: 'ad_sidejob', art: 'money',
      cond: function (g) { return g.age >= 24 && g.age <= 42; },
      title: '下班后的第二份工',
      text: '同事拉你做副业，说晚上跑车或者接私活，一个月能多几千。你算了算，每天能挤出来的只有三个小时。妻子（丈夫）问你，那家里的事谁做。',
      opts: [
        o('干，钱要紧', { at: { health: -3, stress: 4, finance: 2 }, tag: '青年时下班后做过副业' }, {
          tone: 'hard',
          outcomes: [
            oc(58, '副业确实多了一笔收入，你也累得够呛。', '多了一笔收入', { money: { cash: 12000 }, at: { finance: 2 } }),
            oc(42, '身体先撑不住，你做了三个月就停了。', '撑不住', { at: { health: -5, happiness: -2 } })
          ]
        }),
        o('拉 {{npc:发小}} 一起做', { npc: { '发小': { intimacy: 8 } }, at: { happiness: 2, finance: 1, stress: 2 }, tag: '青年时拉发小一起做副业' }, {
          tone: 'safe',
          outcomes: [
            oc(64, '两个人分摊辛苦，收入也稳一些。', '一起做', { money: { cash: 8000 }, at: { happiness: 2 } }),
            oc(36, '分钱的时候没谈清楚，闹得不太愉快。', '分钱不愉快', { at: { happiness: -3 }, npc: { '发小': { intimacy: -6 } } })
          ]
        }),
        o('不干，把时间留给家里', { npc: { '伴侣': { favor: 6 } }, at: { happiness: 2, stress: -3 }, tag: '青年时为了家里没有做副业' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '你按时回家，家里的气氛好了很多。', '按时回家', { at: { happiness: 3 }, npc: { '伴侣': { intimacy: 6 } } }),
            oc(34, '看到同事多挣的钱，你偶尔也会算一算。', '偶尔算一算', { at: { happiness: -1 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ad_health', type: 'random', stage: '中年', weight: 2,
      family: 'ad_health', art: 'clinic',
      cond: function (g) { return g.age >= 30 && g.age <= 50 && g.attrs.health < 80; },
      title: '体检报告上的箭头',
      text: '体检报告上有三个向上的箭头，医生说问题不大，但要少熬夜、少喝酒、多运动。你把报告折起来放进口袋，晚上还是去了那场推不掉的酒局。',
      opts: [
        o('听 {{npc:发小}} 推荐去复查', { money: { cash: -2000 }, npc: { '发小': { favor: 4 } }, at: { health: 3 }, tag: '中年听发小建议去做了复查' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '复查结果还好，你开始每周跑两次步。', '开始跑步', { at: { health: 4, happiness: 2 } }),
            oc(34, '查出一个小问题，需要长期吃药控制。', '长期吃药', { money: { cash: -3000 }, at: { health: -1 }, set: { on_med: true } })
          ]
        }),
        o('先改作息，三个月后再看', { at: { health: 2, stress: -1 }, tag: '中年体检出现箭头后先改了作息' }, {
          tone: 'safe',
          outcomes: [
            oc(62, '三个月后指标降了一点，医生说继续保持。', '指标降了', { at: { health: 3, happiness: 2 } }),
            oc(38, '你改了两周就恢复原样，指标没有变化。', '恢复原样', { at: { health: -2, happiness: -1 } })
          ]
        }),
        o('不管，先把酒局应付完', { at: { health: -4, stress: 3, finance: 1, happiness: 1 }, tag: '中年体检出现箭头后没有当回事' }, {
          hint: '身体会记账', tone: 'risk',
          outcomes: [
            oc(50, '那场酒局谈成了一个项目，你拿到了奖金。', '谈成项目', { money: { cash: 8000 }, at: { finance: 1 } }),
            oc(50, '半年后你因为胃出血住了一次院。', '胃出血', { money: { cash: -12000 }, at: { health: -8 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ad_reunion', type: 'random', stage: '中年', weight: 2,
      family: 'ad_reunion', art: 'home',
      cond: function (g) { return g.age >= 28 && g.age <= 50; },
      title: '二十年后的同学会',
      text: '同学会定在原来学校旁边的那家饭店。有人开了车来，有人从外地赶回来，也有人没来。班长在群里发了座位表，你的名字在靠门的那一桌。',
      opts: [
        o('去，坐哪桌都行', { at: { happiness: 3, charm: 2, stress: 1 }, tag: '中年去参加了二十年的同学会' }, {
          tone: 'safe',
          outcomes: [
            oc(62, '你去了，发现大家聊的还是当年那些事。', '聊当年', { at: { happiness: 4 }, npc: { '同学': { intimacy: 6 } } }),
            oc(38, '有人一直在比房子和职位，你提前走了。', '提前走了', { at: { happiness: -2 } })
          ]
        }),
        o('在同学会上找 {{npc:发小}}', { npc: { '发小': { intimacy: 12 } }, at: { happiness: 4, charm: 1 }, tag: '中年同学会上找到了发小' }, {
          tone: 'safe',
          outcomes: [
            oc(68, '你们在角落里喝了两瓶啤酒，把以前的事说了一遍。', '喝了两瓶', { at: { happiness: 5 }, npc: { '发小': { intimacy: 8 } } }),
            oc(32, '他带了孩子来，一直在忙，没说上几句。', '没说什么', { at: { happiness: 1 } })
          ]
        }),
        o('不去，在家陪家人', { npc: { '伴侣': { favor: 3 } }, at: { happiness: 2, stress: -2 }, tag: '中年没有去二十年的同学会' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '你在家吃了顿饭，觉得也挺好。', '在家吃饭', { at: { happiness: 2 } }),
            oc(40, '后来群里发了合照，你找了自己认识的人。', '看合照', { at: { happiness: -1 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ad_city', type: 'random', stage: '青年', weight: 2,
      family: 'ad_city', art: 'office',
      cond: function (g) { return g.age >= 22 && g.age <= 38; },
      title: '要不要回老家',
      text: '父亲打电话来说，老家的房子空着，你回来住也行。你在现在的城市待了六年，朋友不多，工作还算稳。高铁票三个小时，你查了一下价格又关掉了页面。',
      opts: [
        o('回去，离父母近一点', { money: { cash: -6000 }, npc: { '父母': { favor: 8 } }, at: { happiness: 3, finance: -1 }, tag: '青年时从大城市回了老家' }, {
          tone: 'switch',
          outcomes: [
            oc(58, '你回去了，工资少了一截，但每天能见到父母。', '回老家', { at: { happiness: 4, finance: -2 } }),
            oc(42, '老家的工作机会太少，你闲了半年才找到事做。', '闲了半年', { at: { stress: 4, happiness: -2 } })
          ]
        }),
        o('留下，把父母接过来', { money: { cash: -20000 }, npc: { '父母': { favor: 6 } }, at: { happiness: 2, stress: 2 }, tag: '青年时把父母接到了自己所在的城市' }, {
          tone: 'safe',
          outcomes: [
            oc(64, '父母搬来了，虽然不习惯，但一家人在一起。', '接来', { at: { happiness: 3 }, money: { cash: -10000 } }),
            oc(36, '老人在这里住不惯，住了半年又回去了。', '住不惯', { at: { happiness: -2, stress: 2 } })
          ]
        }),
        o('跟 {{npc:发小}} 去同一座城市', { npc: { '发小': { intimacy: 8 } }, at: { happiness: 2, charm: 1 }, tag: '青年时跟着发小去了同一座城市' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '你们在同一个城市，周末还能见面。', '周末见面', { at: { happiness: 3 }, npc: { '发小': { intimacy: 6 } } }),
            oc(34, '他很快又走了，你一个人留在那里。', '他走了', { at: { happiness: -2 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ad_office_politics', type: 'random', stage: '中年', weight: 2,
      family: 'ad_office', art: 'office',
      cond: function (g) { return g.age >= 26 && g.age <= 45 && g.job && g.job.id; },
      title: '会议室里的站队',
      text: '部门要换负责人，两个副手在争。有人来问你站哪边，说这是最后一次机会。你想起上个月刚交的房贷，和桌上那份还没做完的方案。',
      opts: [
        o('站资历更深的那个', { npc: { '上司': { favor: 5 } }, at: { finance: 2, stress: 3 }, tag: '中年在办公室站了资历更深的那个' }, {
          tone: 'switch',
          outcomes: [
            oc(55, '他上位后把你提了一级。', '被提一级', { promote: true, at: { finance: 3, happiness: 2 } }),
            oc(45, '他败了，新负责人把你调去了边缘岗位。', '被调边缘', { at: { finance: -2, happiness: -3 } })
          ]
        }),
        o('不站队，只做自己的事', { at: { stress: 2, happiness: 1 }, tag: '中年在办公室斗争中没有站队' }, {
          tone: 'safe',
          outcomes: [
            oc(62, '两边都没拉拢你，你反而落了个清静。', '清静', { at: { happiness: 2 } }),
            oc(38, '新负责人上任后，你的项目被砍了一半。', '项目被砍', { at: { finance: -1, stress: 3 } })
          ]
        }),
        o('把方案做好，让成绩说话', { npc: { '同事': { favor: 4 } }, at: { knowledge: 2, stress: 3, finance: 1 }, tag: '中年在办公室斗争里把方案做到了最好' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '方案被上面看中，你被点名负责新项目。', '被点名', { promote: true, at: { finance: 2, happiness: 2 } }),
            oc(34, '方案被其中一方拿去署名，你什么也没得到。', '被署名', { at: { happiness: -3, stress: 3 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ad_loan', type: 'random', stage: '中年', weight: 2,
      family: 'ad_loan', art: 'money',
      cond: function (g) { return g.age >= 26 && g.age <= 50; },
      title: '担保书上的签名',
      text: '亲戚拿来一份担保书，说只差一个签名，银行贷款就能下来。他把笔递给你，说都是一家人。你想起几年前借出去的那笔钱，到现在还没还。',
      opts: [
        o('替 {{npc:亲戚}} 做担保', { money: { cash: -50000 }, npc: { '亲戚': { favor: 8 } }, at: { stress: 3 }, tag: '中年给亲戚做过贷款担保' }, {
          hint: '签了就要担责', tone: 'risk',
          outcomes: [
            oc(48, '他按时还了，你来往更近。', '按时还了', { at: { happiness: 3 } }),
            oc(30, '他中途断供，银行找到了你。', '断供', { money: { cash: -60000 }, at: { stress: 5, happiness: -5 } }),
            oc(22, '你犹豫了几天，最后没签，他也没再提。', '没签', { at: { happiness: -1 }, npc: { '发小': { favor: -3 } } })
          ]
        }),
        o('直接借一笔钱，不担保', { money: { cash: -20000 }, npc: { '发小': { favor: 5 } }, at: { happiness: 1, stress: 2 }, tag: '中年借给发小一笔钱但没有担保' }, {
          tone: 'safe',
          outcomes: [
            oc(55, '钱借出去，三年后才还了一半。', '还了一半', { at: { happiness: -2 }, money: { cash: 10000 } }),
            oc(45, '他把钱按时还了，还多给了一点利息。', '按时还', { money: { cash: 22000 }, at: { happiness: 3 } })
          ]
        }),
        o('婉拒，说自己也有难处', { npc: { '发小': { favor: -5 } }, at: { happiness: -2, stress: -1 }, tag: '中年婉拒了发小的借钱请求' }, {
          tone: 'safe',
          outcomes: [
            oc(58, '他脸色不太好看，之后联系少了。', '联系少了', { at: { happiness: -2 } }),
            oc(42, '他过一阵理解了，还介绍了一个客户给你。', '介绍客户', { money: { cash: 6000 }, npc: { '发小': { favor: 4 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_ad_marriage_pressure', type: 'random', stage: '青年', weight: 2,
      family: 'ad_marry_pressure', art: 'wedding',
      cond: function (g) { return g.age >= 27 && g.age <= 36 && g.family.marriage.status !== '已婚'; },
      title: '过年的那顿饭',
      text: '过年回家，亲戚围在饭桌边，问你什么时候结婚。母亲替你夹了一筷子菜，说先吃。有人又说，隔壁家的孩子都上小学了。你把酒杯放下。',
      opts: [
        o('笑着把话题岔开', { at: { happiness: 1, charm: 2, stress: 1 }, tag: '青年过年被催婚时笑着岔开了话题' }, {
          tone: 'safe',
          outcomes: [
            oc(62, '你把话题转到菜上，桌上的人也就散了。', '岔开', { at: { happiness: 1 } }),
            oc(38, '有人追着问，你最后还是沉了脸。', '沉了脸', { at: { happiness: -2 }, npc: { '亲戚': { favor: -2 } } })
          ]
        }),
        o('让 {{npc:发小}} 帮忙打圆场', { npc: { '发小': { intimacy: 8 } }, at: { happiness: 2, charm: 1 }, tag: '青年被催婚时让发小帮忙打过圆场' }, {
          tone: 'safe',
          outcomes: [
            oc(68, '发小接过去讲了个笑话，桌上笑成一片。', '圆场', { at: { happiness: 3 }, npc: { '发小': { intimacy: 5 } } }),
            oc(32, '他帮着说了两句，反而让亲戚更起劲。', '更起劲', { at: { happiness: -2 } })
          ]
        }),
        o('认真说自己还没想好', { npc: { '母亲': { favor: 3 } }, at: { happiness: 1, stress: 2 }, tag: '青年被催婚时认真说自己还没想好' }, {
          tone: 'safe',
          outcomes: [
            oc(64, '母亲说那就慢慢来，亲戚也不再多问。', '慢慢来', { at: { happiness: 2 }, npc: { '母亲': { favor: 2 } } }),
            oc(36, '有人觉得你在敷衍，饭桌上的气氛僵了一会儿。', '气氛僵', { at: { stress: 2, happiness: -2 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ad_divorce_risk', type: 'random', stage: '中年', weight: 2,
      family: 'ad_marriage_crisis', art: 'emptyHome',
      cond: function (g) { return g.age >= 33 && g.age <= 55 && g.family.marriage.status === '已婚'; },
      title: '冷战到第七天',
      text: '你们已经七天没好好说话。起因是一件很小的事，后来越说越远，翻出很多旧账。她（他）把被子搬去了客厅，孩子在房间里写作业，门关着。',
      opts: [
        o('先低头，把话谈开', { npc: { '伴侣': { intimacy: 10 } }, at: { happiness: 2, stress: -2 }, tag: '中年婚姻冷战时先低了头' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '你们谈了一夜，把很多年没说的话说了。', '谈开', { at: { happiness: 4, stress: -3 }, npc: { '伴侣': { intimacy: 8 } } }),
            oc(34, '谈着谈着又吵起来，但第二天一起吃了饭。', '又吵起来', { at: { stress: 2 } })
          ]
        }),
        o('找 {{npc:发小}} 喝了顿酒', { npc: { '发小': { intimacy: 8 } }, at: { happiness: 1, stress: -2 }, tag: '中年婚姻冷战时找发小喝了顿酒' }, {
          tone: 'safe',
          outcomes: [
            oc(62, '发小听完说，你们俩都太倔。你回家买了菜。', '买了菜', { at: { happiness: 2 }, npc: { '伴侣': { intimacy: 4 } } }),
            oc(38, '酒喝多了，回家又说错话，冷战更久。', '更久', { at: { happiness: -3 }, npc: { '伴侣': { intimacy: -5 } } })
          ]
        }),
        o('就这么耗着', { npc: { '伴侣': { intimacy: -8 } }, at: { happiness: -4, stress: 4 }, tag: '中年婚姻冷战一直耗着' }, {
          hint: '会走到很危险的地方', tone: 'risk',
          outcomes: [
            oc(50, '耗了两个月，最后还是坐下来谈了。', '两个月后谈', { at: { happiness: -1 } }),
            oc(50, '耗到年底，她（他）提出了分开。', '提出分开', { divorce: true, at: { happiness: -8 }, npc: { '伴侣': { intimacy: -20 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_ad_child_school', type: 'random', stage: '中年', weight: 2,
      family: 'ad_child_school', art: 'exam',
      cond: function (g) { return g.age >= 33 && g.age <= 50 && g.family.childrenIds.length > 0; },
      title: '孩子的入学通知',
      text: '孩子的入学通知下来了，分到了一所普通学校。邻居说他家孩子去了更好的那所，要找关系。你翻着手机里的通讯录，停在一个很久没联系的名字上。',
      opts: [
        o('找 {{npc:发小}} 打听学区', { npc: { '发小': { intimacy: 6 } }, at: { happiness: 2, stress: 2 }, tag: '中年为孩子入学找发小打听学区' }, {
          tone: 'safe',
          outcomes: [
            oc(62, '他认识一个老师，帮你问清了政策。', '问清政策', { at: { knowledge: 2, happiness: 2 } }),
            oc(38, '他也帮不上忙，你只好按分配去上。', '按分配', { at: { happiness: -2 } })
          ]
        }),
        o('就上普通学校，孩子轻松点', { npc: { '子女': { favor: 5 } }, at: { happiness: 2, stress: -2 }, tag: '中年让孩子上了普通学校' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '孩子在学校过得开心，成绩中等。', '过得开心', { at: { happiness: 3 }, npc: { '子女': { intimacy: 8 } } }),
            oc(34, '几年后你有点后悔，觉得当初该争一争。', '有点后悔', { at: { happiness: -2 } })
          ]
        }),
        o('花钱找关系', { money: { cash: -50000 }, npc: { '子女': { favor: 2 } }, at: { stress: 3, happiness: 1 }, tag: '中年为孩子入学花钱找过关系' }, {
          hint: '钱花出去，未必办成', tone: 'risk',
          outcomes: [
            oc(52, '办成了，孩子进了那所更好的学校。', '办成了', { at: { happiness: 3 } }),
            oc(30, '钱花了，事没办成，对方退了三分之一。', '事没办成', { money: { cash: 15000 }, at: { happiness: -4, stress: 3 } }),
            oc(18, '事情后来被查，你被叫去谈了几次话。', '被查', { at: { stress: 5, happiness: -5 } })
          ]
        })
      ]
    },

    {
      id: 'v32_ad_health_check', type: 'random', stage: '中年', weight: 2,
      family: 'ad_check', art: 'clinic',
      cond: function (g) { return g.age >= 35 && g.age <= 55; },
      title: '一次全身检查',
      text: '单位组织体检，多了一项自费的全身检查，八百块。同事说查了也没用，查出来更烦。你排队交钱时，前面的人正在问医生，报告什么时候能出。',
      opts: [
        o('做，查清楚总比猜好', { money: { cash: -800 }, at: { health: 2, stress: 1 }, tag: '中年做了一次自费的全身检查' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '报告基本正常，医生让你把烟戒了。', '基本正常', { at: { health: 2, happiness: 2 } }),
            oc(34, '查出一个需要观察的指标，你半年复查一次。', '需要观察', { at: { stress: 3 }, set: { watch_health: true } })
          ]
        }),
        o('不做了，省下八百块', { money: { cash: 800 }, at: { health: -2, happiness: -1 }, tag: '中年没有做自费的全身检查' }, {
          tone: 'safe',
          outcomes: [
            oc(55, '省下了钱，你也确实没觉得哪里不舒服。', '没做', { at: { happiness: 0 } }),
            oc(45, '半年后一个老毛病拖重了，你才去医院。', '拖重了', { money: { cash: -6000 }, at: { health: -4 } })
          ]
        }),
        o('拉家人一起做', { money: { cash: -3000 }, npc: { '伴侣': { favor: 4 }, '父母': { favor: 4 } }, at: { happiness: 2, health: 1 }, tag: '中年拉着家人一起做了体检' }, {
          tone: 'safe',
          outcomes: [
            oc(68, '一家人指标都还行，你心里踏实了不少。', '都还行', { at: { happiness: 3 } }),
            oc(32, '父亲查出一个问题，及时做了处理。', '及时处理', { money: { cash: -8000 }, at: { stress: 2 }, npc: { '父亲': { favor: 3 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_ad_old_friend', type: 'random', stage: '中年', weight: 2,
      family: 'ad_old_friend', art: 'money',
      cond: function (g) { return g.age >= 30 && g.age <= 52; },
      title: '发小的那通电话',
      text: '发小半夜打电话来，说店撑不下去了，差八万块周转。他说话很快，背景里有人在搬东西。你想起小时候他把最后半块饼分给你。',
      opts: [
        o('借给 {{npc:发小}} 这笔钱', { money: { cash: -80000 }, npc: { '发小': { intimacy: 15, favor: 8 } }, kindness: { role: '发小', kind: 'help', text: '中年借给发小八万块周转' }, at: { happiness: 2, stress: 2 }, tag: '中年借给发小八万块周转' }, {
          hint: '这笔钱可能要很久才回来', tone: 'hard',
          outcomes: [
            oc(48, '两年后他把钱还了，还请你吃了一顿饭。', '还了', { money: { cash: 80000 }, at: { happiness: 4 } }),
            oc(32, '钱只还了一半，他的店还是关了。', '还了一半', { money: { cash: 40000 }, at: { happiness: -2 } }),
            oc(20, '他再也还不上，你们的联系也慢慢断了。', '还不上了', { at: { happiness: -5 }, npc: { '发小': { intimacy: -15 } } })
          ]
        }),
        o('借一半，剩下帮他想办法', { money: { cash: -40000 }, npc: { '发小': { intimacy: 10 } }, at: { happiness: 1, charm: 2, stress: 2 }, tag: '中年借给发小一半的钱，又帮他想办法' }, {
          tone: 'safe',
          outcomes: [
            oc(58, '他拿这钱撑过了最难的几个月，后来慢慢缓过来。', '缓过来', { money: { cash: 30000 }, at: { happiness: 3 } }),
            oc(42, '办法没想出来，钱也打了水漂。', '打了水漂', { at: { happiness: -3 } })
          ]
        }),
        o('说自己也没钱', { npc: { '发小': { intimacy: -10 } }, at: { happiness: -3 }, tag: '中年拒绝了发小的借钱电话' }, {
          tone: 'safe',
          outcomes: [
            oc(55, '他在电话那头沉默了一会儿，说知道了。', '沉默', { at: { happiness: -4 } }),
            oc(45, '你后来听说他把店盘了出去，去了外地。', '去了外地', { at: { happiness: -3 }, npc: { '发小': { intimacy: -12 } } })
          ]
        })
      ]
    },

    {
      id: 'v32_ad_house_upgrade', type: 'random', stage: '中年', weight: 2,
      family: 'ad_house_up', art: 'house',
      cond: function (g) { return g.age >= 36 && g.age <= 55 && g.house.owned; },
      title: '换房的念头',
      text: '孩子大了，现在的两居室显得挤。中介说可以卖旧换新，差价大概八十万，贷款再背二十年。你站在阳台上，看着楼下的车位一个接一个被占满。',
      opts: [
        o('卖掉旧房，换一套大的', { house: true, at: { stress: 4, happiness: 3 }, tag: '中年卖掉旧房换了一套大的' }, {
          hint: '贷款要还到退休', tone: 'hard',
          outcomes: [
            oc(58, '换房办成了，搬进去那天孩子很高兴。', '换成了', { at: { happiness: 5 } }),
            oc(30, '旧房卖得比预期低，你又添了一笔钱。', '卖价低了', { money: { cash: -100000 }, at: { stress: 4 } }),
            oc(12, '交易中途出了纠纷，拖了大半年。', '纠纷', { at: { stress: 6, happiness: -4 } })
          ]
        }),
        o('不换，把旧房重新装修', { money: { cash: -120000 }, at: { happiness: 3, stress: 2 }, tag: '中年没有换房，把旧房重新装修了' }, {
          tone: 'safe',
          outcomes: [
            oc(66, '装修完住得舒服了很多，贷款也没增加。', '装修好了', { at: { happiness: 4 } }),
            oc(34, '装修队拖了工期，还加了两次钱。', '加了两次钱', { money: { cash: -30000 }, at: { stress: 3, happiness: -2 } })
          ]
        }),
        o('先租出去，自己去租大房子', { money: { cash: 6000 }, at: { finance: 1, stress: 1 }, tag: '中年把旧房出租，自己租了大房子' }, {
          tone: 'safe',
          outcomes: [
            oc(60, '租金抵了一部分房租，手头松快了一点。', '租金抵房租', { at: { finance: 2 } }),
            oc(40, '租客不省心，你半年跑了七八趟。', '租客不省心', { at: { stress: 3, happiness: -2 } })
          ]
        })
      ]
    }
  ]);



  /* 中产专属：与普通工薪分开的首回合，体现“有一点选择余地” */
  add([
    {
      id: 'v32_birth_upper_middle', type: 'forced', stage: '婴幼儿', age: 0, weight: 2, prio: 101,
      family: 'birth', art: 'nursery',
      cond: function (g) { return g.background === '中产'; },
      title: '预约好的产房',
      text: '预产期前一个月，父亲就把私立医院的产房订好了，母亲却一直念叨“公立也能生”。真到发动那天，两个人的说法还是没统一：一个说钱花了就图个安心，一个说这钱够孩子吃一年奶粉。',
      opts: [
        o('按计划住预约好的私立病房', { money: { cash: -6000 }, at: { happiness: 3 } }, {
          hint: '花钱买安心，账单也更长', tone: 'good',
          outcomes: [
            oc(62, '单间安静，母亲睡了两天好觉，出院时气色不错。', '住进私立单间', { money: { cash: -6000 }, at: { health: 1, happiness: 3 } }),
            oc(24, '账单比预想多了一截，父亲嘴上不说，回家后开始记账。', '账单超支', { money: { cash: -8500 }, at: { stress: 3 }, npc: { '父亲': { intimacy: -3 } } }),
            oc(14, '护士经验不足，扎针扎了三次，母亲回来一直心有余悸。', '扎针三次', { money: { cash: -6000 }, at: { health: -2, happiness: -2 }, npc: { '母亲': { intimacy: -2, favor: 1 } } })
          ]
        }),
        o('退掉私立，去公立排队建档', { money: { cash: 2500 }, at: { stress: 4 } }, {
          hint: '省钱，但要排长队、托人', tone: 'risk',
          outcomes: [
            oc(55, '排了一上午队，总算建上档，省下的钱进了孩子的账户。', '公立建档', { money: { cash: 2500 }, at: { happiness: 1 } }),
            oc(30, '床位紧张，发动那晚在走廊等了四个小时。', '走廊等床', { at: { health: -2, stress: 3 }, npc: { '母亲': { intimacy: -4, favor: 1 } } }),
            oc(15, '托了熟人插队，人情记在了别人账上。', '托人插队', { npc: { '朋友': { favor: 3 } }, at: { stress: 2 } })
          ]
        }),
        o('请月嫂回家，省掉住院那几天', { money: { cash: -3000 }, npc: { '母亲': { intimacy: 4 } } }, {
          hint: '家里更自在，但突发情况靠自己判断', tone: 'risk',
          outcomes: [
            oc(60, '月嫂手脚麻利，母亲月子里没落病根。', '月嫂靠谱', { money: { cash: -3000 }, at: { health: 2, happiness: 2 }, npc: { '母亲': { intimacy: 4 } } }),
            oc(26, '孩子半夜发黄疸，一家人手忙脚乱送去急诊。', '半夜急诊', { money: { cash: -4800 }, at: { health: -3, stress: 4 } }),
            oc(14, '月嫂干了十天就借口家里有事走了，钱退了一半。', '月嫂跑单', { money: { cash: -1800 }, at: { stress: 4, happiness: -2 } })
          ]
        })
      ]
    }
  ]);

  for (var i = 0; i < E.length; i++) LS.EVENT_INDEX[E[i].id] = E[i];
  LS.V32A_COUNT = 96;
})();
