/* お茶席ぐるり — 共通：メンバーデータ・席順ロジック・状態（localStorage）
   全ページ（index/setsumei/step1/step2/step3）で読み込む。 */
(function(){
  "use strict";
  const MEN =['ico_kimono_men01.png','ico_kimono_men02.png','ico_kimono_men03.png','ico_kimono_men04.png','ico_kimono_men05.png'];
  const GIRL=['ico_kimono_girl01.png','ico_kimono_girl02.png','ico_kimono_girl03.png','ico_kimono_girl04.png','ico_kimono_girl05.png'];

  // 初期メンバー（茶歴降順 / gender: 'm'男 'f'女 / attend: 今回の出欠の既定）
  const DEFAULTS=[
    {name:'橋間 渚',     years:14, gender:'f', attend:true},
    {name:'岩村 東正',   years:12, gender:'m', attend:true},
    {name:'酒井 直子',   years:12, gender:'f', attend:false},
    {name:'久保 恵子',   years:10, gender:'f', attend:true},
    {name:'山田 千春',   years:9,  gender:'f', attend:true},
    {name:'大鳥 眞弓',   years:6,  gender:'f', attend:true},
    {name:'藤本 勝重',   years:6,  gender:'m', attend:true},
    {name:'西川 矢右衛門',years:5,  gender:'m', attend:false},
    {name:'河合 悦子',   years:4,  gender:'f', attend:true},
    {name:'光善防 久司', years:4,  gender:'m', attend:true},
    {name:'白川 涼音',   years:3,  gender:'f', attend:false},
    {name:'浜上 優子',   years:3,  gender:'f', attend:false},
    {name:'金村 実香',   years:2,  gender:'f', attend:false},
    {name:'天野 汰一',   years:1,  gender:'m', attend:true},
    {name:'西尾 彩葉',   years:1,  gender:'f', attend:true},   // お弟子さん（新規）
    {name:'琴音',        years:0,  gender:'f', attend:true}    // お弟子さん（新規）
  ];

  const LS_ROSTER='seki.roster.v4', LS_STATE='seki.state.v1';
  function loadRoster(){ try{ const r=JSON.parse(localStorage.getItem(LS_ROSTER)); if(Array.isArray(r)&&r.length) return r.map(x=>({attend:true,gender:'f',years:0,...x})); }catch(e){} return DEFAULTS.map(x=>({...x})); }
  function saveRoster(r){ try{ localStorage.setItem(LS_ROSTER, JSON.stringify(r)); }catch(e){} }
  function resetRoster(){ try{ localStorage.removeItem(LS_ROSTER); }catch(e){} return DEFAULTS.map(x=>({...x})); }
  function loadState(){ try{ return JSON.parse(localStorage.getItem(LS_STATE))||{}; }catch(e){ return {}; } }
  function saveState(s){ try{ localStorage.setItem(LS_STATE, JSON.stringify(s)); }catch(e){} }
  function patchState(p){ const s=loadState(); Object.assign(s,p); saveState(s); return s; }

  // 性別ごとに順番でアイコンを割当（男=men 5種・女=girl 5種を巡回）
  function withIcons(roster){
    let mi=0, gi=0;
    return roster.map(m=>({ ...m, icon: 'img/'+(m.gender==='m'? MEN[mi++%MEN.length] : GIRL[gi++%GIRL.length]) }));
  }
  const sei=n=>String(n).trim().split(/[ 　]/)[0];

  // ===== 席順ロジック =====
  function offsets(n){ let a=Math.max(1,Math.round(n/3)); let b=Math.round(2*n/3); if(b>=n)b=n-1; if(b<=a)b=a+1; if(b>=n){b=n-1; if(a>=b)a=b-1;} if(a<1)a=1; return [a,b]; }
  function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
  function buildOrder(list, mode, opts){
    opts=opts||{};
    if(mode==='senior'){ return list.slice().sort((a,b)=> opts.asc ? (a.years-b.years)||0 : (b.years-a.years)||0); }
    if(mode==='manual' && Array.isArray(opts.order)){ const by={}; list.forEach(m=>by[m.name]=m); const r=opts.order.map(n=>by[n]).filter(Boolean); list.forEach(m=>{ if(!r.includes(m)) r.push(m); }); return r; }
    return shuffle(list); // random
  }
  function makeTable(order, ab){
    const n=order.length; if(n<3) return {rows:[],a:0,b:0,n};
    const [a,b]=(ab&&ab.length===2)?ab:offsets(n); const rows=[];
    for(let r=0;r<n;r++){ rows.push({ seki:r+1, teishu:order[r], shokyaku:order[(r+a)%n], tsume:order[(r+b)%n] }); }
    return {rows,a,b,n};
  }
  // 亭主を固定したまま 正客/詰め をシャッフルするための無作為オフセット（0,a,b すべて相異＝役の重複なし）
  function randomOffsets(n){ if(n<3) return [1,2]; let a=1+Math.floor(Math.random()*(n-1)), b; do{ b=1+Math.floor(Math.random()*(n-1)); }while(b===a); return a<b?[a,b]:[b,a]; }

  // ===== バランス生成エンジン（休憩・顔ぶれ・早上がりを最良化） =====
  // forbidden[r]=その席に置けない人indexのSet。各人1回ずつの順列を返す（不可ならnull）
  function assignAvoiding(n, forbidden){
    for(let attempt=0; attempt<80; attempt++){
      const p=shuffle([...Array(n).keys()]);
      let bad=false; for(let r=0;r<n;r++){ if(forbidden[r].has(p[r])){ bad=true; break; } }
      if(!bad) return p;
      let ok=true;
      for(let r=0;r<n;r++){
        if(forbidden[r].has(p[r])){
          let sw=false;
          for(let s=0;s<n;s++){ if(s!==r && !forbidden[r].has(p[s]) && !forbidden[s].has(p[r])){ const t=p[r]; p[r]=p[s]; p[s]=t; sw=true; break; } }
          if(!sw){ ok=false; break; }
        }
      }
      if(ok){ let good=true; for(let r=0;r<n;r++){ if(forbidden[r].has(p[r])){ good=false; break; } } if(good) return p; }
    }
    return null;
  }
  function scoreSchedule(rows, earlyBy, W){
    const active={};
    rows.forEach((row,r)=>{ [row.teishu,row.shokyaku,row.tsume].forEach(p=>{ (active[p.name]=active[p.name]||[]).push(r); }); });
    let rest=0; // 連続した席で出番＝休憩なし違反
    for(const k in active){ const a=active[k]; for(let i=1;i<a.length;i++){ if(a[i]-a[i-1]===1) rest++; } }
    const trio={}, pair={};
    rows.forEach(row=>{ const ns=[row.teishu.name,row.shokyaku.name,row.tsume.name].sort();
      trio[ns.join('|')]=(trio[ns.join('|')]||0)+1;
      pair[ns[0]+'|'+ns[1]]=(pair[ns[0]+'|'+ns[1]]||0)+1;
      pair[ns[0]+'|'+ns[2]]=(pair[ns[0]+'|'+ns[2]]||0)+1;
      pair[ns[1]+'|'+ns[2]]=(pair[ns[1]+'|'+ns[2]]||0)+1;
    });
    let trioRep=0; for(const k in trio){ if(trio[k]>1) trioRep+=trio[k]-1; }
    let pairRep=0; for(const k in pair){ if(pair[k]>1) pairRep+=pair[k]-1; }
    let early=0; if(earlyBy){ for(const nm in earlyBy){ const K=earlyBy[nm], a=active[nm]||[]; a.forEach(r=>{ if(r+1>K) early+=(r+1-K); }); } }
    return W.rest*rest + W.trio*trioRep + W.pair*pairRep + W.early*early;
  }
  // participants:[{name,...}] / opts:{teishuOrder?:[name], earlyBy?:{name:席}, weights?, trials?}
  function buildSchedule(participants, opts){
    opts=opts||{}; const n=participants.length;
    const W=Object.assign({rest:4, trio:5, pair:1.5, early:1000}, opts.weights||{});
    const earlyBy=opts.earlyBy||{};
    if(n<3){ const r=[]; for(let i=0;i<n;i++) r.push({seki:i+1, teishu:participants[i], shokyaku:participants[(i+1)%n], tsume:participants[(i+2)%n]}); return {rows:r, score:0, n}; }
    let fixedT=null;
    if(opts.teishuOrder){ fixedT=opts.teishuOrder.map(nm=>participants.findIndex(p=>p.name===nm)).filter(i=>i>=0); if(fixedT.length!==n) fixedT=null; }
    const trials=opts.trials || (n<=8?3000:1400);
    const idx=[...Array(n).keys()];
    const hasEarly=Object.keys(earlyBy).length>0;
    let best=null, bestScore=Infinity;
    for(let t=0;t<trials;t++){
      let T;
      if(fixedT) T=fixedT;
      else { T=shuffle(idx); if(hasEarly) T.sort((a,b)=>(earlyBy[participants[a].name]||999)-(earlyBy[participants[b].name]||999)); }
      const forbS=T.map(p=>new Set([p]));
      const S=assignAvoiding(n, forbS); if(!S) continue;
      const forbZ=T.map((p,r)=>new Set([p, S[r]]));
      const Z=assignAvoiding(n, forbZ); if(!Z) continue;
      const rows=[]; for(let r=0;r<n;r++) rows.push({ seki:r+1, teishu:participants[T[r]], shokyaku:participants[S[r]], tsume:participants[Z[r]] });
      const sc=scoreSchedule(rows, earlyBy, W);
      if(sc<bestScore){ bestScore=sc; best=rows; if(sc===0) break; }
    }
    if(!best){ const [a,b]=offsets(n); const T=fixedT||idx; best=[]; for(let r=0;r<n;r++) best.push({ seki:r+1, teishu:participants[T[r]], shokyaku:participants[T[(r+a)%n]], tsume:participants[T[(r+b)%n]] }); }
    return { rows:best, score:bestScore, n };
  }
  const KANJI=['','初','二','三','四','五','六','七','八','九','十'];
  const sekiLabel=i=> i<=10 ? KANJI[i]+'席' : i+'席';

  window.SEKI={ DEFAULTS, MEN, GIRL, loadRoster, saveRoster, resetRoster, loadState, saveState, patchState, withIcons, sei, offsets, randomOffsets, shuffle, buildOrder, makeTable, buildSchedule, scoreSchedule, sekiLabel };
})();
