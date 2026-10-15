/* =========================================================
 * 数据结构研习社 · 题库搜索与筛选模块 (search.js)
 * 依赖：data-ds.js (CHAPTERS/KNOWLEDGE)、data-ds-q.js (QUESTION_BANK)、index.html 中的全局工具
 * ========================================================= */

const SRC_OF = q => q.tag || '自编';
const TYPE_NAME = { choice:'单选题', open:'综合应用题' };
let searchState = { kw:'', ch:'all', type:'all', diff:'all', status:'all', src:'all', scope:'all', showAll:false };
let searchQueue = null;

function plainText(s){
  return String(s==null?'':s)
    .replace(/<[^>]+>/g,' ')
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')
    .replace(/&nbsp;/g,' ').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/\s+/g,' ').trim();
}
function qHay(q){
  const ch = CHAPTERS.find(c=>c.id===q.chapter);
  return plainText([q.stem,(q.options||[]).join(' '),q.answer,q.analysis,(q.points||[]).join(' '),q.tag||'',ch?ch.title:''].join(' ')).toLowerCase();
}
function kHay(k){ return plainText([k.front,k.back,k.cat].join(' ')).toLowerCase(); }
const qHayCache = new Map(), kHayCache = new Map();
function qHayOf(q){ if(!qHayCache.has(q.id)) qHayCache.set(q.id, qHay(q)); return qHayCache.get(q.id); }
function kHayOf(k){ if(!kHayCache.has(k.id)) kHayCache.set(k.id, kHay(k)); return kHayCache.get(k.id); }
function matchKW(hay, kw){ const ps = kw.toLowerCase().split(/\s+/).filter(Boolean); return ps.every(p=>hay.indexOf(p)>=0); }
function escRe(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
function highlight(html, kw){
  const ps = String(kw||'').split(/\s+/).filter(Boolean);
  if(!ps.length) return html;
  const re = new RegExp('(' + ps.map(escRe).join('|') + ')','gi');
  return String(html).split(/(<[^>]*>)/).map(function(seg){
    if(seg.charAt(0)==='<') return seg;
    return seg.replace(re,'<mark>$1</mark>');
  }).join('');
}
function snippet(html, kw, len){
  len = len || 150;
  const txt = plainText(html);
  const ps = String(kw||'').split(/\s+/).filter(Boolean);
  let start = 0;
  if(ps.length){ const p = txt.toLowerCase().indexOf(ps[0].toLowerCase()); if(p > 60) start = p - 40; }
  let out = txt.slice(start, start+len);
  if(start>0) out = '…'+out;
  if(txt.length > start+len) out += '…';
  if(ps.length) out = out.replace(new RegExp('(' + ps.map(escRe).join('|') + ')','gi'),'<mark>$1</mark>');
  return out;
}
/* ---- 过滤 ---- */
function filterQuestions(){
  const qd = (LS.data && LS.data.q) || {};
  return QUESTION_BANK.filter(function(q){
    if(searchState.ch!=='all' && q.chapter!==searchState.ch) return false;
    if(searchState.type!=='all' && q.type!==searchState.type) return false;
    if(searchState.diff!=='all' && String(q.difficulty)!==String(searchState.diff)) return false;
    if(searchState.src!=='all' && SRC_OF(q)!==searchState.src) return false;
    if(searchState.status!=='all'){
      const st = qd[q.id] || {};
      if(searchState.status==='none'  && st.s) return false;
      if(searchState.status==='right' && st.s!=='r') return false;
      if(searchState.status==='wrong' && st.s!=='w') return false;
      if(searchState.status==='fav'   && !st.fav) return false;
    }
    if(searchState.kw && !matchKW(qHayOf(q), searchState.kw)) return false;
    return true;
  });
}
function filterKnowledge(){
  return KNOWLEDGE.filter(function(k){
    if(searchState.kw && !matchKW(kHayOf(k), searchState.kw)) return false;
    return true;
  });
}
function facetCounts(){
  const qd = (LS.data && LS.data.q) || {};
  const ch={}, type={}, diff={}, src={}, status={none:0,right:0,wrong:0,fav:0};
  QUESTION_BANK.forEach(function(q){
    ch[q.chapter]=(ch[q.chapter]||0)+1;
    type[q.type]=(type[q.type]||0)+1;
    diff[q.difficulty]=(diff[q.difficulty]||0)+1;
    const s = SRC_OF(q); src[s]=(src[s]||0)+1;
    const st = qd[q.id]||{};
    if(!st.s) status.none++;
    if(st.s==='r') status.right++;
    if(st.s==='w') status.wrong++;
    if(st.fav) status.fav++;
  });
  return {ch:ch,type:type,diff:diff,src:src,status:status};
}

/* ---- 渲染：筛选胶囊 ---- */
function fchip(group, val, label, n){
  const on = String(searchState[group]) === String(val);
  return '<button class="fchip' + (on?' on':'') + '" data-g="' + group + '" data-v="' + val + '">' +
    label + (n!=null ? '<span class="n">' + n + '</span>' : '') + '</button>';
}

function pageSearch(arg){
  if(arg) searchState.kw = decodeURIComponent(arg);
  const counts = facetCounts();
  const srcList = Object.keys(counts.src).sort(function(a,b){ return counts.src[b]-counts.src[a]; });
  const chList = CHAPTERS.filter(function(c){ return counts.ch[c.id]; });
  const showQ = searchState.scope !== 'k';
  const showK = searchState.scope !== 'q';
  const qHits = showQ ? filterQuestions() : [];
  const kHits = showK ? filterKnowledge() : [];
  const total = qHits.length + kHits.length;
  const LIMIT = 40;
  const qShow = searchState.showAll ? qHits : qHits.slice(0, LIMIT);
  const kShow = searchState.showAll ? kHits : kHits.slice(0, LIMIT);

  let h = '';
  h += '<div class="page active">';
  h += '<div class="search-bar"><span class="sic">🔍</span>';
  h += '<input id="sInput" type="search" placeholder="搜索关键词，空格分隔多个条件" value="' + String(searchState.kw).replace(/"/g,'&quot;') + '">';
  h += '<button class="sclr' + (searchState.kw?' show':'') + '" id="sClear">✕</button></div>';

  h += '<div class="filter-block"><div class="fl">范围</div><div class="frow">';
  h += fchip('scope','all','全部') + fchip('scope','q','题库') + fchip('scope','k','知识点');
  h += '</div></div>';

  h += '<div class="filter-block"><div class="fl">章节</div><div class="frow">';
  h += fchip('ch','all','全部', QUESTION_BANK.length);
  chList.forEach(function(c){ h += fchip('ch', c.id, chapterName(c), counts.ch[c.id]); });
  h += '</div></div>';

  h += '<div class="filter-block"><div class="fl">题型</div><div class="frow">';
  h += fchip('type','all','全部') + fchip('type','choice','单选题', counts.type.choice||0) + fchip('type','open','综合应用题', counts.type.open||0);
  h += '</div></div>';

  h += '<div class="filter-block"><div class="fl">难度</div><div class="frow">';
  h += fchip('diff','all','全部') + fchip('diff',1,'基础', counts.diff[1]||0) + fchip('diff',2,'中等', counts.diff[2]||0) + fchip('diff',3,'较难', counts.diff[3]||0);
  h += '</div></div>';

  h += '<div class="filter-block"><div class="fl">做题状态</div><div class="frow">';
  h += fchip('status','all','全部') + fchip('status','none','未做',counts.status.none) + fchip('status','right','已做对',counts.status.right) +
       fchip('status','wrong','做错',counts.status.wrong) + fchip('status','fav','已收藏',counts.status.fav);
  h += '</div></div>';

  h += '<div class="filter-block"><div class="fl">来源</div><div class="frow">';
  h += fchip('src','all','全部');
  srcList.forEach(function(s){ h += fchip('src', s, s, counts.src[s]); });
  h += '</div></div>';

  h += '<div class="search-sum"><div class="st">共 <b>' + total + '</b> 条结果' +
       (showQ ? ' · 题目 ' + qHits.length : '') + (showK ? ' · 知识点 ' + kHits.length : '') + '</div>';
  if(qHits.length) h += '<button class="btn btn-primary btn-sm" id="sPractice">刷这 ' + qHits.length + ' 题</button>';
  h += '<button class="btn btn-ghost btn-sm" id="sReset">重置</button></div>';

  h += '<div id="sBody">' + renderResults(qShow, kShow, qHits.length, kHits.length) + '</div>';
  h += '</div>';

  view.innerHTML = h;
  bindSearch();
}

/* ---- 渲染：结果列表 ---- */
function renderResults(qShow, kShow, qTotal, kTotal){
  const kw = searchState.kw;
  let h = '';
  if(qShow.length){
    h += '<div class="sr-meta">题目 ' + qShow.length + ' / ' + qTotal + '</div>';
    qShow.forEach(function(q){
      const st = (LS.data && LS.data.q && LS.data.q[q.id]) || {};
      const tags = [];
      tags.push(chapterName(CHAPTERS.filter(function(c){return c.id===q.chapter;})[0] || {title:' ' + q.chapter}));
      tags.push(q.type==='choice' ? '单选' : '综合');
      tags.push(['','基础','中等','较难'][q.difficulty] || '');
      if(st.s==='r') tags.push('✅已做对');
      if(st.s==='w') tags.push('❌做错过');
      if(st.fav) tags.push('⭐收藏');
      const stem = kw ? highlight(q.stem, kw) : plainText(q.stem);
      h += '<div class="sr-item hit-q" data-qid="' + q.id + '">';
      h += '<div class="sr-meta">' + tags.filter(Boolean).join(' · ') + '</div>';
      h += '<div class="sr-txt">' + stem + '</div>';
      h += '<div class="sr-ft">点击查看 / 直接练习</div></div>';
    });
    if(qShow.length < qTotal) h += '<div class="sr-hint">仅显示前 ' + qShow.length + ' 题，输入关键词可缩小范围</div>';
  }
  if(kShow.length){
    h += '<div class="sr-meta">知识点 ' + kShow.length + ' / ' + kTotal + '</div>';
    kShow.forEach(function(k){
      const f = kw ? highlight(k.front, kw) : plainText(k.front);
      const b = kw ? highlight(snippet(k.back, kw, 90), kw) : snippet(k.back, '', 90);
      h += '<div class="sr-item hit-k" data-kid="' + k.id + '">';
      h += '<div class="sr-meta">' + k.cat + '</div>';
      h += '<div class="sr-txt">' + f + '</div>';
      h += '<div class="sr-ft">' + b + '</div></div>';
    });
    if(kShow.length < kTotal) h += '<div class="sr-hint">仅显示前 ' + kShow.length + ' 条，输入关键词可缩小范围</div>';
  }
  if(!qShow.length && !kShow.length){
    h += '<div class="sr-empty">没有匹配的结果<br><span class="sr-hint">试试减少筛选条件，或换一个关键词</span></div>';
  }
  return h;
}

/* ---- 交互绑定 ---- */
function bindSearch(){
  const inp = document.getElementById('sInput');
  let timer = null;
  if(inp){
    inp.oninput = function(){
      clearTimeout(timer);
      const v = this.value;
      timer = setTimeout(function(){ searchState.kw = v; searchState.showAll = false; softRefresh(); }, 220);
    };
    inp.onkeydown = function(e){ if(e.key === 'Enter'){ clearTimeout(timer); searchState.kw = this.value; searchState.showAll = false; softRefresh(); this.blur(); } };
  }
  const clr = document.getElementById('sClear');
  if(clr) clr.onclick = function(){ searchState.kw = ''; softRefresh(); };

  document.querySelectorAll('#view .fchip').forEach(function(b){
    b.onclick = function(){
      const g = this.dataset.g, v = this.dataset.v;
      const numGroups = {diff:1};
      searchState[g] = numGroups[g] ? (v === 'all' ? 'all' : Number(v)) : v;
      searchState.showAll = false;
      softRefresh();
    };
  });

  const pr = document.getElementById('sPractice');
  if(pr) pr.onclick = function(){
    const ids = filterQuestions().map(function(q){ return q.id; });
    if(!ids.length) return;
    searchQueue = ids;
    go('#/practice/srch');
  };
  const rs = document.getElementById('sReset');
  if(rs) rs.onclick = function(){
    searchState = {kw:'', scope:'all', ch:'all', type:'all', diff:'all', src:'all', status:'all', showAll:false};
    softRefresh();
  };

  document.querySelectorAll('#view .sr-item').forEach(function(el){
    el.onclick = function(){
      const qid = this.dataset.qid, kid = this.dataset.kid;
      if(qid) go('#/practice/one-' + qid);
      else if(kid) go('#/knowledge');
    };
  });
}

function softRefresh(){
  const counts = facetCounts();
  document.querySelectorAll('#view .fchip').forEach(function(b){
    const g = b.dataset.g, v = b.dataset.v;
    b.classList.toggle('on', String(searchState[g]) === String(v));
  });
  const showQ = searchState.scope !== 'k';
  const showK = searchState.scope !== 'q';
  const qHits = showQ ? filterQuestions() : [];
  const kHits = showK ? filterKnowledge() : [];
  const body = document.getElementById('sBody');
  if(body) body.innerHTML = renderResults(searchState.showAll ? qHits : qHits.slice(0,40), searchState.showAll ? kHits : kHits.slice(0,40), qHits.length, kHits.length);
  const sum = document.querySelector('#view .search-sum .st');
  if(sum) sum.innerHTML = '共 <b>' + (qHits.length + kHits.length) + '</b> 条结果' + (showQ ? ' · 题目 ' + qHits.length : '') + (showK ? ' · 知识点 ' + kHits.length : '');
  const pr = document.getElementById('sPractice');
  if(pr){ if(qHits.length) pr.textContent = '刷这 ' + qHits.length + ' 题'; else pr.style.display = 'none'; }
  const inp = document.getElementById('sInput');
  if(inp && inp.value !== searchState.kw) inp.value = searchState.kw;
  const clr = document.getElementById('sClear');
  if(clr) clr.classList.toggle('show', !!searchState.kw);
  bindItems();
}
function bindItems(){
  document.querySelectorAll('#view .sr-item').forEach(function(el){
    el.onclick = function(){
      const qid = this.dataset.qid, kid = this.dataset.kid;
      if(qid) go('#/practice/one-' + qid);
      else if(kid) go('#/knowledge');
    };
  });
}