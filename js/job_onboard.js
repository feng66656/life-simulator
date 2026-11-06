/* =========================================================
   job_onboard.js — v3.8 入职事件（12 条路径，各 1 条）
   规则：
     1) 入职事件是路径的第一个节点（独立表 L.ONBOARD_EVENTS，order = 1）；
     2) 写死制服 / 工位 / 工具 / 称呼 / 上级姓名 / 第一个具体任务；
     3) 每个选项都必须写入 g.career、g.job、g.workplace；
     4) 本文件通过包装 C.onboardEvent 接管入职，不改 careers.js。
   依赖：js/careers.js 先加载。
   ========================================================= */
(function () {
  'use strict';
  var L = window.LS = window.LS || {};
  var C = L.CAREER;
  if (!C) {
    if (window.console && console.warn) console.warn('[CAREER] careers.js 未加载，入职事件跳过');
    return;
  }

  L.EVENTS = L.EVENTS || [];
  L.EVENT_INDEX = L.EVENT_INDEX || {};
  L.ONBOARD_EVENTS = L.ONBOARD_EVENTS || {};

  /* ---------------- 落地：写 g.career / g.job / g.workplace ---------------- */
  function arrive(g, pathId, place, title, extra) {
    var c = C.init(g);
    var p = C.PATHS[pathId];
    var jid = p && p.jobId;
    c.path = pathId;
    c.jobId = jid || null;
    c.place = place;
    c.title = title;
    c.onboarded = true;
    c.onboardAt = g.age;
    if (extra && extra.track) c.track = extra.track;
    if (extra && extra.flag) {
      c.flags[extra.flag] = true;
      g.marks = g.marks || {};
      g.marks[extra.flag] = true;
    }
    g.job = g.job || {};
    if (!g.job.id && jid) {
      if (L.engine && L.engine.setJob) {
        L.engine.setJob(g, { id: jid, level: 0 });
      } else if (L.JOBS && L.JOBS[jid]) {
        g.job.id = jid;
        g.job.level = 0;
        g.job.title = title;
        g.job.salary = L.JOBS[jid].base || 0;
        g.job.years = 0;
      }
    }
    if (g.job.id && (!g.job.title || g.job.title === '待业')) g.job.title = title;
    if (g.job.salary === undefined) g.job.salary = 0;
    g.job.level = Number(g.job.level) || 0;
    g.job.years = Number(g.job.years) || 0;
    if (!g.job.history) g.job.history = [];
    g.workplace = place;
    g.career.workplace = place;
    return (extra && extra.text) || '';
  }

  /* ---------------- 选项工厂：同一路径共用落地点 ---------------- */
  function mk(pathId, place, title, extra) {
    return function (label, hint, fx, career, tail) {
      var ex = {};
      var k;
      for (k in (extra || {})) ex[k] = extra[k];
      for (k in (tail || {})) ex[k] = tail[k];
      return {
        label: label, hint: hint || '', fx: fx || {}, career: career,
        apply: function (g) { return arrive(g, pathId, place, title, ex); }
      };
    };
  }

  function OB(s) {
    var ev = {
      id: 'onboard_' + s.path,
      type: 'career', layer: 'career', family: 'career_' + s.path,
      path: s.path, n: 0, kind: '入职', order: 1, careerOnboard: true,
      cat: 'work', tier: 'echo', prio: 72, weight: 0, stage: null,
      ageMin: 15, ageMax: 60, age: [15, 60],
      gate: s.gate || 22,
      title: s.title, text: s.text, opts: s.opts,
      cond: function (g) {
        var c = C.init(g);
        return !!(c && c.path === s.path && !c.onboarded);
      }
    };
    L.EVENTS.push(ev);
    L.EVENT_INDEX[ev.id] = ev;
    L.ONBOARD_EVENTS[s.path] = ev;
    return ev;
  }

  /* =========================================================
     1. 医生
     ========================================================= */
  (function () {
    var o = mk('doctor', '市第二人民医院 普外科三病区', '住院医师', { track: 'hospital' });
    OB({
      path: 'doctor', gate: 22, title: '白大褂上的第一道褶',
      text: '白大褂是从库房领的，袖口洗得发白，左胸的胸牌把名字打错了一个字。你被分到普外科三病区，主任姓韩，查房时把病历本塞给你：“先跟着看，别插嘴。”第一个任务是给 12 床换药，镊子夹着纱布，手抖得碰到了伤口。',
      opts: [
        o('跟着韩主任把 12 床处理完', '代价：错过食堂，晚饭是便利店的面包', {
          at: { stress: 2, knowledge: 1 }, rep: { industry: 2 }
        }, { points: 1, flags: ['c_clean'] }, { text: '韩主任多看了你一眼，把你的名字记在了排班表上。' }),
        o('主动请缨值第一个夜班', '代价：一夜三个急诊，第二天照样查房', {
          at: { health: -2, stress: 3 }, rep: { industry: 2, society: 1 }
        }, { points: 1, flags: ['c_hero'] }, { text: '凌晨四点处理完第二个病人，你在值班室的椅子上睡了一小时。' }),
        o('先问护士长要科室的用药习惯', '代价：被同届的规培生说“会来事”', {
          at: { stress: 1, charm: 1 }, npc: { '上司': { favor: 2 } }
        }, { points: 0, flags: ['c_clean'] }, { text: '护士长把常用药的摆放顺序讲了一遍，你抄在病历本最后一页。' })
      ]
    });
  })();

  /* =========================================================
     2. 警察
     ========================================================= */
  (function () {
    var o = mk('police', '城东派出所 刑侦组', '见习民警', { track: 'frontline' });
    OB({
      path: 'police', gate: 22, title: '藏青色的第一颗扣子',
      text: '藏青制服领回来，肩章还是空的。城东派出所刑侦组，老周带你领装备：一副手铐、一支记录笔、一部 24 小时开机的对讲机。凌晨两点出第一个现场，入室盗窃，楼道灯坏了，老周让你记住门牌号，别记错。',
      opts: [
        o('打手电走在老周前面', '代价：楼梯拐角有人，你差点被撞倒', {
          at: { health: -3, stress: 4 }, rep: { industry: 3, society: 2 }
        }, { points: 2, flags: ['c_hero'] }, { text: '门牌号记对了，老周在车上说：“胆子不小，先学会别逞能。”' }),
        o('跟在后面，把现场一笔一笔记全', '代价：被同事笑“只会写笔录”', {
          at: { stress: 1, knowledge: 2 }, rep: { industry: 2 }
        }, { points: 1, flags: ['c_clean'] }, { text: '你的笔录第一次被所长当范本念给全组听。' }),
        o('先问报案人丢了什么、最后一次见到是什么时候', '代价：问得太细，家属开始不耐烦', {
          at: { stress: 2, charm: 1 }, npc: { '报案人': { favor: 2 } }
        }, { points: 1, flags: ['c_clean'] }, { text: '问出了窗台的鞋印，老周把这句话写进了立案报告。' })
      ]
    });
  })();

  /* =========================================================
     3. 教师
     ========================================================= */
  (function () {
    var o = mk('teacher', '市第一中学 初二（3）班', '代课教师', { track: 'middle' });
    OB({
      path: 'teacher', gate: 22, title: '初二（3）班的讲台',
      text: '教案本第一页写下你的名字。初二（3）班，47 个学生，最后一排靠窗的男生从上课起就在转笔。教务主任姓孙，把课程表递给你：“一周 14 节，周三下午教研。班主任的位置还空着。”第一堂课你讲了 20 分钟，下课铃响时手心全是汗。',
      opts: [
        o('留下来给后排几个学生补课', '代价：每天多留一小时，没有加班费', {
          at: { health: -2, stress: 3 }, rep: { school: 3, society: 2 }
        }, { points: 2, flags: ['c_hero'] }, { text: '转笔的男生第一次交了作业，字写得很潦草。' }),
        o('按进度讲完就回办公室备课', '代价：班里成绩两极分化，月考平均分垫底', {
          at: { stress: 1, happiness: 2 }, rep: { school: -1 }
        }, { points: -1, flags: [] }, { text: '你的课讲得很顺，但作业本收上来只交了一半。' }),
        o('找孙主任要一个班主任的位置', '代价：班主任津贴 800，事多一倍', {
          at: { stress: 4 }, npc: { '上司': { favor: 2 } }
        }, { points: 1, flags: ['c_hero'] }, { text: '孙主任说先带你半个学期，家长会你来主讲。' })
      ]
    });
  })();

  /* =========================================================
     4. 科研
     ========================================================= */
  (function () {
    var o = mk('research', '省大学 材料实验室', '科研助理', { track: 'lab' });
    OB({
      path: 'research', gate: 25, title: '实验室最里侧的工位',
      text: '工位在实验室最里侧，离心机一开机整层楼都听得见。导师姓陈，扔给你一支移液枪和一本实验记录：“这个月的样跑完，数据自己整理。”同组的师兄小声说，陈老师三年没发过一篇像样的文章。',
      opts: [
        o('按流程把这一批样跑完', '代价：连续两周晚上十点后才回宿舍', {
          at: { health: -2, stress: 3, knowledge: 1 }, rep: { industry: 2 }
        }, { points: 1, flags: ['c_clean'] }, { text: '数据一条条落在记录本上，陈老师只回了两个字：“继续。”' }),
        o('自己加一组对照组', '代价：多花试剂钱，错了要从头再来', {
          at: { health: -3, stress: 4, knowledge: 2 }, money: { cash: -800 },
          gamble: {
            p: 0.45,
            win: { rep: { industry: 4 } },
            lose: { at: { happiness: -3 } },
            winText: '对照组跑出了异常值，陈老师让你整理成一张图。',
            loseText: '试剂污染，两周的数据全部作废。'
          }
        }, { points: 2, flags: ['c_hero'] }, { text: '' }),
        o('去问陈老师这个课题到底要做什么', '代价：他说“先做起来再说”，你更迷茫了', {
          at: { stress: 2, knowledge: 1 }, npc: { '导师': { favor: 1 } }
        }, { points: 0, flags: [] }, { text: '陈老师翻了翻记录本，让你下周组会讲一次进展。' })
      ]
    });
  })();

  /* =========================================================
     5. 出租车
     ========================================================= */
  (function () {
    var o = mk('taxi', '城东 出租车车队', '替班司机', { track: 'drive' });
    OB({
      path: 'taxi', gate: 22, title: '蓝色捷达的车钥匙',
      text: '车队给你一辆蓝色捷达，车份钱一天一百八，押金一万二。老司机姓赵，教你调座椅、认交警岗、看哪个路口能掉头。第一单去火车站，后座乘客一路催：“师傅，麻烦快点。”',
      opts: [
        o('按导航走，不抢时间', '代价：乘客嫌慢，下车时没给好评', {
          at: { stress: 1, happiness: 1 }
        }, { points: 0, flags: ['c_clean'] }, { text: '三十七块的车费，乘客付了整钱，说不用找。' }),
        o('走高架抢时间', '代价：超速被拍，罚款两百扣三分', {
          money: { cash: 60 }, at: { stress: 3, health: -1 },
          gamble: {
            p: 0.55,
            win: { money: { cash: 100 } },
            lose: { money: { cash: -200 }, at: { happiness: -2 } },
            winText: '赶上了，乘客加了你微信说以后包车。',
            loseText: '下高架就被交警拦下，罚款两百。'
          }
        }, { points: 1, flags: [] }, { text: '' }),
        o('跟乘客聊一路，留个电话', '代价：话多招人烦，遇上喝多的容易起冲突', {
          at: { charm: 2, stress: 1 }, npc: { '乘客': { favor: 3 } }
        }, { points: 1, flags: ['c_clean'] }, { text: '乘客下车前说，明天早上还坐你的车。' })
      ]
    });
  })();

  /* =========================================================
     6. 厨师
     ========================================================= */
  (function () {
    var o = mk('chef', '聚福楼 后厨', '打荷', { track: 'kitchen' });
    OB({
      path: 'chef', gate: 20, title: '后厨的打荷位',
      text: '白厨帽压到眉毛，工装大一号。聚福楼后厨，师傅姓刘，递来一把自己的菜刀：“刀要自己磨。”第一晚切了三十斤葱，案板湿滑，左手虎口划开一道口子，用创可贴按住继续切。',
      opts: [
        o('收工后留下来练刀工', '代价：手指又添两道口子，第二天照常上灶', {
          at: { health: -2, stress: 3 }, rep: { industry: 3 }
        }, { points: 2, flags: ['c_master'] }, { text: '刘师傅路过看了一眼，把自己的磨刀石留在了案板上。' }),
        o('跟着刘师傅学调味', '代价：配方不外传，你只能记住大概', {
          at: { stress: 2, knowledge: 1 }, npc: { '上司': { favor: 2 } }
        }, { points: 1, flags: ['c_clean'] }, { text: '刘师傅让你尝了三勺汤，说“咸淡要靠舌头，不靠秤”。' }),
        o('找厨师长问什么时候能上炒锅', '代价：被呛一句“先切够一年再说”', {
          at: { stress: 3, happiness: -1 }, npc: { '上司': { favor: -1 } }
        }, { points: -1, flags: [] }, { text: '厨师长没抬头，只说了句：“葱切完了吗？”' })
      ]
    });
  })();

  /* =========================================================
     7. 小店老板
     ========================================================= */
  (function () {
    var o = mk('shop', '大学城 商业街 12 号铺', '小店主', { track: 'store' });
    OB({
      path: 'shop', gate: 22, title: '三平米的摊位',
      text: '铁皮卷帘门拉起来，三平米摊位就是你的。进货单夹在秤下面，收款码贴在硬纸板上。第一个顾客买了两瓶水，你找零时手抖，把五块当成一块。隔壁摊位的邻居阿姨说，这里一天卖不到两百就要亏。',
      opts: [
        o('给隔壁几个老邻居赊账', '代价：账本越记越厚，年底收不回来', {
          money: { cash: -600 }, at: { stress: 1 }, npc: { '邻居': { favor: 3 } }
        }, { points: 1, flags: [] }, { text: '赊出去七笔，收回三笔，阿姨说人情比钱难算。' }),
        o('一分不让价，谁来都一样', '代价：隔壁摊比你便宜五毛，客人少了三成', {
          money: { cash: 400 }, at: { stress: 2, reputation: 1 }
        }, { points: 0, flags: ['c_clean'] }, { text: '第一个月流水 4200，扣完房租剩 900。' }),
        o('把每笔赊账都记在本子上，写清日期', '代价：有的熟人觉得你不给面子', {
          at: { knowledge: 1, stress: 1 }, money: { cash: -200 }
        }, { points: 1, flags: ['c_clean'] }, { text: '到月底，账本上的数字第一次对上了。' })
      ]
    });
  })();

  /* =========================================================
     8. 创业
     ========================================================= */
  (function () {
    var o = mk('startup', '共享办公 3 楼 B12 隔间', '创始人', { track: 'founder' });
    OB({
      path: 'startup', gate: 22, title: '共享办公的隔间',
      text: '两张二手显示器，一张折叠桌，合伙人阿良把第一版产品跑起来，风扇响得像要起飞。你们给公司起名叫“回声”，logo 还没想好。第一个客户是阿良的表哥，做建材的，要求先免费试用三个月。',
      opts: [
        o('接免费单，先换一个案例', '代价：三个月白干，房租还得照付', {
          money: { cash: -12000 }, at: { stress: 4 }, rep: { industry: 2 }
        }, { points: 1, flags: ['c_clean'] }, { text: '表哥把你们的产品挂在了自己的朋友圈，来了两个问价的。' }),
        o('拒绝免费，先做付费版本', '代价：表哥不高兴，阿良跟你吵了一架', {
          at: { stress: 3 }, npc: { '合伙人': { favor: -2 } }
        }, { points: 1, flags: [] }, { text: '付费版做了三周，第一单收了两千八，阿良三天没跟你说话。' }),
        o('拿产品去找投资人', '代价：见十个，九个说“再看看”', {
          at: { stress: 4, charm: 2 }, money: { cash: -3000 },
          gamble: {
            p: 0.3,
            win: { money: { cash: 200000 }, rep: { industry: 3 } },
            lose: { at: { happiness: -4 } },
            winText: '一个天使投资人给了二十万，要 10% 股份。',
            loseText: '咖啡喝了十二杯，名片一张没换出去。'
          }
        }, { points: 2, flags: [] }, { text: '' })
      ]
    });
  })();

  /* =========================================================
     9. 工程师
     ========================================================= */
  (function () {
    var o = mk('engineer', '省建筑设计院 结构二所', '结构绘图员', { track: 'design' });
    OB({
      path: 'engineer', gate: 22, title: '工牌上的照片',
      text: '工牌照片拍得很难看，头发翘着。你被分到结构二所，工位隔板只有一人高。项目负责人老张扔来一份 67 页的需求文档：“今天先看懂，明天跟我去现场。”下午三点，安全帽发下来，尺码偏大，扣在下巴上晃。',
      opts: [
        o('连夜把 67 页文档看完', '代价：第二天眼睛红着去现场，没听清交底', {
          at: { health: -2, stress: 3, knowledge: 2 }, rep: { industry: 2 }
        }, { points: 1, flags: ['c_clean'] }, { text: '老张问的三个问题你答上了两个，他把图纸柜钥匙给了你。' }),
        o('先去现场量一遍实际尺寸', '代价：图纸和现场差了三公分，你得回头改', {
          at: { health: -1, stress: 3 }, rep: { industry: 3 }
        }, { points: 2, flags: ['c_hero'] }, { text: '你量出的三公分，让老张在交底会上少挨了一顿批。' }),
        o('找老张要全套图纸和计算书', '代价：他说“先学会看图，别急着算”', {
          at: { stress: 2, knowledge: 1 }, npc: { '上司': { favor: 1 } }
        }, { points: 0, flags: [] }, { text: '老张给了你一套旧图，让你把钢筋编号抄一遍。' })
      ]
    });
  })();

  /* =========================================================
     10. 公务员
     ========================================================= */
  (function () {
    var o = mk('civil', '区财政局 综合科', '科员', { track: 'public' });
    OB({
      path: 'civil', gate: 22, title: '政务大厅三号窗口',
      text: '工牌挂上，你被安排在政务大厅三号窗口，科长姓王。第一天上午叫了 40 个号，第一份材料少一个章，群众在大厅里等了四十分钟，拍着柜台问：“你们到底怎么办事的？”',
      opts: [
        o('先道歉，再把缺的材料列成清单', '代价：队伍越排越长，你连水都没喝', {
          at: { stress: 3, reputation: 2 }, rep: { society: 3 }
        }, { points: 2, flags: ['c_clean'] }, { text: '那位群众第二天补了章，出门前回头说了句“谢谢”。' }),
        o('按规章退回，让他下次再来', '代价：投诉电话打到科长办公室', {
          at: { stress: 1, happiness: -1 }, rep: { society: -2 },
          npc: { '上司': { favor: -1 } }
        }, { points: -1, flags: [] }, { text: '王科长把你叫过去，只问了一句：“清单给了吗？”' }),
        o('找王科长协调，特事特办', '代价：欠下一个人情，以后要还', {
          at: { stress: 2 }, npc: { '上司': { favor: 1 },
            '群众': { favor: 3 } }
        }, { points: 1, flags: [] }, { text: '王科长签了字，材料先收后补，你在备注栏写清了责任。' })
      ]
    });
  })();

  /* =========================================================
     11. 混混
     ========================================================= */
  (function () {
    var o = mk('gang', '老车站 台球厅', '看场小弟', { track: 'street' });
    OB({
      path: 'gang', gate: 18, title: '台球厅后门',
      text: '台球厅后门有股烟味和啤酒味。大哥姓刀，把一沓钱推过来：“今晚你就在这儿看着，谁闹事记脸。”收银台下面压着一根棒球棍。第一个晚上，两个喝多的客人掀了桌子，台球滚了一地，隔壁店的人已经在打电话叫警察。',
      opts: [
        o('提棍上去，把人按住', '代价：对方同伴从后面砸了你一酒瓶', {
          at: { health: -4, stress: 5 }, money: { cash: 2000 },
          rep: { society: -2 }
        }, { points: 2, flags: ['c_violence'] }, { text: '刀哥又给了你两千，说“下手有分寸”，你后脑缝了四针。' }),
        o('先报警，让警察来处理', '代价：刀哥觉得你不懂事，场子里的活不再叫你', {
          at: { stress: 2 }, rep: { society: 2 }, npc: { '上司': { favor: -4 } }
        }, { points: 1, flags: ['c_clean'] }, { text: '警车来了，闹事的被带走，刀哥整晚没跟你说话。' }),
        o('打电话叫刀哥下来处理', '代价：他嫌你连这点事都摆不平', {
          at: { stress: 3 }, npc: { '上司': { favor: 1 } }
        }, { points: 0, flags: [] }, { text: '刀哥下楼，两句话就把人劝走了，回头看了你一眼。' })
      ]
    });
  })();

  /* =========================================================
     12. 技工
     ========================================================= */
  (function () {
    var o = mk('mechanic', '县机械厂 车间三号工位', '技工', { track: 'factory' });
    OB({
      path: 'mechanic', gate: 19, title: '车间三号工位',
      text: '蓝色工装大了一号，袖口卷三圈。车间三号工位，师傅姓马，递来一把游标卡尺：“先量一百个件，量完再说话。”量到第七个，手上就有了油；中午吃饭，马师傅把最肥的一块肉夹到你碗里。',
      opts: [
        o('老老实实量完一百个件', '代价：手腕酸到抬不起来，进度还是最慢', {
          at: { health: -2, stress: 2 }, rep: { industry: 2 }
        }, { points: 1, flags: ['c_clean'] }, { text: '马师傅抽检了十个，一个不差，把你的名字报给了班组长。' }),
        o('边量边把公差记在本子上', '代价：记得太细，被人说“学生气”', {
          at: { health: -3, stress: 3, knowledge: 2 }, rep: { industry: 3 }
        }, { points: 2, flags: ['c_master'] }, { text: '你发现第三批件的公差偏了 0.03 毫米，班组长让全组复检。' }),
        o('问马师傅能不能直接上机床', '代价：被骂“尺子都拿不稳”，还得继续量', {
          at: { stress: 3, happiness: -2 }, npc: { '上司': { favor: -1 } }
        }, { points: -1, flags: [] }, { text: '马师傅把卡尺往你手里一塞：“量到一千个再来跟我说。”' })
      ]
    });
  })();

  /* =========================================================
     接管入职：优先返回本文件的入职事件
     ========================================================= */
  var baseOnboard = C.onboardEvent;
  C.onboardEvent = function (g, pathId) {
    var ev = L.ONBOARD_EVENTS[pathId];
    if (ev) return ev;
    return baseOnboard ? baseOnboard.call(C, g, pathId) : null;
  };
})();
