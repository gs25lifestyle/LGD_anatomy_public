/* Snapshot-only UI. All labels use textContent; data never comes from live APIs. */
(() => {
  'use strict';
  const data = window.LGENIUS_DATA;
  if (!data || data.schema_version !== 1) {
    (document.querySelector('.story')||document.querySelector('main')).append(Object.assign(document.createElement('p'), {className:'empty error', textContent:'데이터 스냅샷을 불러오지 못했습니다. 로컬 빌드를 다시 확인해 주세요.'}));
    return;
  }
  const format = value => value == null ? '—' : new Intl.NumberFormat('ko-KR').format(value);
  const node = (tag, props={}, children=[]) => {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (key === 'text') el.textContent = value;
      else if (key === 'class') el.className = value;
      else el.setAttribute(key, value);
    }
    for (const child of children) if (child) el.append(child);
    return el;
  };
  const p = (text, cls='') => node('p', {text, class:cls});
  const routes={'explorer.html':'topics','outlook.html':'judgement','landscape.html':'comparison','competition.html':'comparison','commercialization.html':'business','network.html':'evidence','positioning.html':'direction','methodology.html':'methods'};
  const link = (text, href) => {
    const [file,topic]=href.split('#');
    return node('a', {text,href:routes[file]?(topic?`?topic=${encodeURIComponent(topic)}#topics`:`#${routes[file]}`):href});
  };
  const empty = (title, detail) => node('div', {class:'empty'}, [p(title), detail ? p(detail) : null]);
  const section = (title, children=[], cls='panel') => node('section', {class:cls}, [node('h2',{text:title}), ...children]);
  const download = (filename, object) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(object,null,2)], {type:'application/json;charset=utf-8'}));
    const a = node('a',{href:url,download:filename});
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
  };
  document.querySelectorAll('[data-as-of]').forEach(el => {el.textContent=data.as_of; el.dateTime=data.as_of;});
  const menu = document.querySelector('.menu-toggle');
  const sidebar = document.querySelector('.sidebar');
  function closeMenu(){sidebar?.classList.remove('is-open');menu?.setAttribute('aria-expanded','false');}
  menu?.addEventListener('click', () => {const opened=sidebar.classList.toggle('is-open');menu.setAttribute('aria-expanded',String(opened));});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu){closeMenu();menu.focus();}});
  document.addEventListener('click',e=>{if(sidebar&&menu&&!sidebar.contains(e.target)&&!menu.contains(e.target)&&sidebar.classList.contains('is-open'))closeMenu();});
  window.matchMedia('(min-width:801px)').addEventListener('change',closeMenu);

  function tableSources() {
    const table=node('table',{class:'source-table'});
    table.append(node('thead',{},[node('tr',{},['소스','기록 규모','집계 기준'].map((text,i)=>node('th',{text,scope:'col',class:i===1?'num':''})))]));
    const body=node('tbody');
    data.sources.filter(s=>s.count>0).forEach(s=>body.append(node('tr',{},[
      node('td',{},[node('strong',{text:s.name}),node('small',{text:s.kind})]),
      node('td',{class:'num',text:`${format(s.count)} ${s.unit}`}),
      node('td',{text:s.name==='KIPRIS Plus'?'고유 출원번호 기준':s.name==='OpenDART'?'LGD·덕산네오룩스, 2016–2025 회계연도':'제목·초록 검색 적중 문헌 후보'})])));
    table.append(body);return node('div',{class:'table-scroll'},[table]);
  }
  function emptyChart(label='—') {
    return node('div',{class:'empty-chart',role:'img','aria-label':label},[
      node('span',{text:label}),node('div',{class:'years'},['2016','2021','2026'].map(text=>node('span',{text})))
    ]);
  }
  function sourceNote(){return p(data.analysis.ready?`출처: ${data.analysis.source_label||'공개 자료'} · 기준 ${data.analysis.reviewed_on||data.as_of}`:`데이터 기준 ${data.as_of}`,'chart-note');}
  function trendChart(rows, label) {
    const valid=rows.filter(r=>Number.isInteger(r.year)&&Number.isFinite(r.count)&&r.count>=0);
    if(!valid.length)return emptyChart();
    if(!window.d3)return empty('차트 라이브러리를 불러오지 못했습니다.','인터넷 연결 없이 사용할 수 있도록 로컬 라이브러리를 확인해 주세요.');
    const svg=d3.create('svg').attr('class','data-chart').attr('viewBox','0 0 680 218').attr('role','img').attr('aria-label',label);
    const x=d3.scaleLinear().domain(d3.extent(valid,d=>d.year)).range([48,660]);
    const y=d3.scaleLinear().domain([0,Math.max(1,d3.max(valid,d=>d.count))*1.15]).nice().range([184,18]);
    svg.append('g').attr('transform','translate(48,0)').call(d3.axisLeft(y).ticks(4).tickSize(-612).tickFormat(d3.format('~s')));
    svg.append('g').attr('transform','translate(0,184)').call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('d')));
    const groups=d3.group(valid,r=>r.group||'출원');
    for(const [index,[name,series]] of [...groups].entries()){
      svg.append('path').datum([...series].sort((a,b)=>a.year-b.year)).attr('fill','none')
        .attr('stroke',index===0?'#0f766e':'#6c7e75').attr('stroke-width',2)
        .attr('stroke-dasharray',index===0?null:'5 4').attr('d',d3.line().x(d=>x(d.year)).y(d=>y(d.count)))
        .append('title').text(name);
    }
    const wrap=node('div',{},[svg.node()]);
    wrap.append(node('details',{},[node('summary',{text:'차트 수치 보기'}),
      node('ul',{},valid.map(r=>node('li',{text:`${r.group||'출원'} · ${r.year}년: ${format(r.count)}건`}))) ]));
    return wrap;
  }
  function dataTable(rows,columns){
    if(!rows.length)return empty('—');
    const table=node('table',{class:'rank-table'},[node('thead',{},[node('tr',{},columns.map(([key,title,numeric])=>node('th',{scope:'col',text:title,class:numeric?'num':''})))])]);
    table.append(node('tbody',{},rows.map(row=>node('tr',{},columns.map(([key,title,numeric])=>node('td',{text:numeric?format(row[key]):row[key]??'—',class:numeric?'num':''}))))));
    return node('div',{class:'table-scroll'},[table]);
  }
  function bars(rows){
    if(!rows.length)return emptyChart();
    const list=node('div',{class:'data-bar-list'}),maximum=Math.max(1,...rows.map(r=>r.value));
    rows.forEach(r=>{const bar=node('span',{class:'data-bar'});bar.style.width=`${Math.max(0,r.value)/maximum*100}%`;list.append(node('div',{},[node('div',{class:'bar-label'},[node('span',{text:r.label}),node('span',{class:'num',text:`${format(r.value)}${r.unit||''}`})]),bar]));});
    return list;
  }
  function scatter(rows,xKey,yKey,xLabel,yLabel){
    if(!rows.length)return emptyChart();
    const svg=d3.create('svg').attr('viewBox','0 0 680 260').attr('class','data-chart').attr('role','img').attr('aria-label',`${xLabel}과 ${yLabel}`);
    const xs=rows.map(r=>r[xKey]).filter(Number.isFinite),ys=rows.map(r=>r[yKey]).filter(Number.isFinite);
    const x=d3.scaleLinear().domain([Math.min(0,d3.min(xs)||0),(d3.max(xs)||1)*1.15]).nice().range([55,650]);
    const y=d3.scaleLinear().domain([Math.min(0,d3.min(ys)||0),(d3.max(ys)||1)*1.15]).nice().range([210,15]);
    svg.append('g').attr('transform','translate(0,210)').call(d3.axisBottom(x).ticks(5));
    svg.append('g').attr('transform','translate(55,0)').call(d3.axisLeft(y).ticks(4).tickSize(-595));
    rows.filter(r=>Number.isFinite(r[xKey])&&Number.isFinite(r[yKey])).forEach(r=>{
      svg.append('circle').attr('cx',x(r[xKey])).attr('cy',y(r[yKey])).attr('r',Math.max(4,Math.min(18,Math.sqrt(r.size||25)))).attr('fill','#0f766e').attr('fill-opacity',.65).append('title').text(`${r.label}: ${xLabel} ${r[xKey]}, ${yLabel} ${r[yKey]}`);
    });
    svg.append('text').attr('x',650).attr('y',249).attr('text-anchor','end').text(xLabel);
    svg.append('text').attr('x',55).attr('y',12).text(yLabel);
    return node('div',{},[svg.node(),dataTable(rows,[['label','대상'],[xKey,xLabel,true],[yKey,yLabel,true]])]);
  }
  function matrix(rows){
    if(!rows.length)return empty('기관별 기술 구성');
    const names=[...new Set(rows.map(r=>r.institution))],topics=[...new Set(rows.map(r=>r.topic))];
    const table=node('table',{class:'rank-table'},[node('thead',{},[node('tr',{},[node('th',{text:'기관',scope:'col'}),...topics.map(t=>node('th',{text:t,scope:'col',class:'num'}))])])]);
    const color=d3.scaleSequential(d3.interpolateRgb('#f5f9f7','#99c4b5')).domain([0,Math.max(1,...rows.map(r=>r.value||0))]);
    table.append(node('tbody',{},names.map(name=>node('tr',{},[node('th',{text:name,scope:'row'}),...topics.map(topic=>{
      const r=rows.find(r=>r.institution===name&&r.topic===topic);const cell=node('td',{class:'num',text:format(r?.value)});
      if(r?.value!=null)cell.style.background=color(r.value);return cell;
    })]))));
    return node('div',{class:'table-scroll'},[table]);
  }
  function treemap(rows){
    if(!rows.length)return empty('기술별 출원 구성');
    const tree=d3.hierarchy({children:rows}).sum(r=>r.value||0);
    d3.treemap().size([680,218]).padding(3)(tree);
    const svg=d3.create('svg').attr('viewBox','0 0 680 218').attr('class','data-chart').attr('role','img').attr('aria-label','포트폴리오 구성');
    tree.leaves().forEach((r,i)=>{
      const group=svg.append('g').attr('transform',`translate(${r.x0},${r.y0})`);
      group.append('rect').attr('width',r.x1-r.x0).attr('height',r.y1-r.y0).attr('fill',i===0?'#0f766e':'#d8e9e2');
      group.append('title').text(`${r.data.label}: ${r.value}`);
      if(r.x1-r.x0>100&&r.y1-r.y0>35)group.append('text').attr('x',10).attr('y',22).style('fill',i===0?'#fff':'#172b26').text(r.data.label);
    });
    return node('div',{},[svg.node(),dataTable(rows,[['label','기술'],['value','출원',true]])]);
  }
  function networkGraph(network){
    if(!network?.nodes.length)return emptyChart();
    const nodes=network.nodes.map(n=>({...n})),links=network.links.map(l=>({...l}));
    const simulation=d3.forceSimulation(nodes).force('link',d3.forceLink(links).id(d=>d.id).distance(90)).force('charge',d3.forceManyBody().strength(-180)).force('center',d3.forceCenter(340,110)).stop();
    for(let i=0;i<150;i++)simulation.tick();
    nodes.forEach(n=>{n.x=Math.max(25,Math.min(655,n.x));n.y=Math.max(20,Math.min(190,n.y));});
    const svg=d3.create('svg').attr('viewBox','0 0 680 230').attr('class','data-chart').attr('role','img').attr('aria-label','LGD 공개 관계 네트워크');
    svg.append('g').selectAll('line').data(links).join('line').attr('x1',d=>d.source.x).attr('y1',d=>d.source.y).attr('x2',d=>d.target.x).attr('y2',d=>d.target.y).attr('stroke','#aebfb6').attr('stroke-width',1.5).append('title').text(d=>d.kind||'관계');
    const g=svg.append('g').selectAll('g').data(nodes).join('g').attr('transform',d=>`translate(${d.x},${d.y})`);
    g.append('circle').attr('r',d=>d.id==='lgd'?8:5).attr('fill',d=>d.id==='lgd'?'#0f766e':'#52635d');
    g.append('text').attr('y',20).attr('text-anchor','middle').text(d=>d.label);
    return svg.node();
  }
  function pathsView(rows){
    if(!rows.length)return emptyChart();
    return node('div',{class:'path-list'},rows.map(r=>node('div',{class:'path-row'},[
      node('strong',{text:r.project||'—'}),node('span',{'aria-hidden':'true',text:'→'}),node('span',{text:r.patent||'—'}),node('span',{'aria-hidden':'true',text:'→'}),node('strong',{text:r.product||'—'}),p(r.evidence||'','chart-note')
    ])));
  }

  const home=document.getElementById('home-view');
  if(home){
    const metrics=node('div',{class:'metrics'},data.sources.slice(0,3).map(s=>node('div',{},[
      node('span',{class:'metric-label',text:s.kind}),node('div',{class:'metric-value'},[node('span',{class:'num',text:format(s.count)}),node('span',{text:s.unit})]),
      node('span',{class:'metric-note',text:s.name==='OpenAlex'?'제목·초록 검색 적중 후보':s.name==='OpenDART'?'LGD·덕산 각 10개':'고유 출원번호 기준'})
    ])));
    const flow=node('div',{class:'asset-flow'},[['특허','기술 활동과 출원 흐름'],['논문','연구 주제와 공동연구'],['공개 계약','연구와 사업의 연결'],['지분투자','기업 간 사업 관계'],['국책과제','연구 목표와 참여 기관'],['제품','기술의 적용과 상업화']].map(([name,role])=>node('div',{},[node('strong',{text:name}),node('span',{text:role})])));
    const main=node('div',{class:'home-main'},[metrics,section('자료마다 다른 역할',[p('서로 다른 공개 기록을 연결해 기술과 사업의 흐름을 살펴봅니다.')],'coverage-section'),flow]);
    const rail=node('div',{class:'home-rail'},[
      section('기록의 출처',[node('div',{class:'rail-list'},data.sources.filter(s=>s.count>0).map(s=>node('div',{class:'rail-row'},[node('strong',{text:s.name}),node('span',{text:s.kind})]))),p(`데이터 기준 ${data.as_of}`,'rail-note'),link('자료와 분석 기준','methodology.html')])
    ]);
    home.append(node('div',{class:'home-layout'},[main,rail]));
  }

  const explorer=document.getElementById('explorer-view');
  if(explorer){
    let chosen=data.topics.find(t=>t.id===(new URLSearchParams(location.search).get('topic')||location.hash.slice(1)))||data.topics[0], tab='overview';
    const search=node('input',{type:'search',id:'topic-search',name:'topic-search',placeholder:'예: 청색, 잉크젯, 투명…',autocomplete:'off'});
    const filter=node('select',{id:'topic-field'},['전체 분야',...new Set(data.topics.map(t=>t.field))].map(text=>node('option',{text,value:text})));
    const reset=node('button',{type:'button',class:'button',text:'초기화'});
    const toolbar=node('div',{class:'toolbar'},[
      node('label',{class:'field grow',for:'topic-search'},[node('span',{text:'기술·검색어 찾기'}),search]),
      node('label',{class:'field',for:'topic-field'},[node('span',{text:'연구 분야'}),filter]),reset]);
    const count=p('','result-count'), list=node('div',{class:'topic-list','aria-label':'연구 주제'}), detail=node('div',{class:'detail'});
    const live=node('span',{'aria-live':'polite',class:'small'});
    explorer.append(toolbar,count,node('div',{class:'explorer-grid'},[list,detail]),live);
    function showDetail(){
      detail.replaceChildren();
      if(!chosen){detail.append(empty('검색에 맞는 연구 주제가 없습니다.','다른 검색어 또는 전체 분야를 선택해 주세요.'));return;}
      detail.append(node('div',{class:'detail-top'},[node('h2',{text:chosen.name})]),p(chosen.field,'detail-subtitle'));
      const tabs=node('div',{class:'tabs',role:'tablist','aria-label':'기술 상세'});
      const panel=node('div',{role:'tabpanel',id:'topic-tab-panel','aria-labelledby':`tab-${tab}`});
      const options=[['overview','검색 범위'],['business','사업화'],['patents','특허 동향'],['applicants','주요 출원인']];
      options.forEach(([id,label])=>{
        const b=node('button',{type:'button',id:`tab-${id}`,role:'tab','aria-controls':'topic-tab-panel','aria-selected':String(tab===id),tabindex:tab===id?'0':'-1',text:label});
        b.addEventListener('click',()=>{tab=id;showDetail();document.getElementById(`tab-${id}`).focus();});
        b.addEventListener('keydown',e=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();const idx=options.findIndex(o=>o[0]===id);const next=e.key==='Home'?0:e.key==='End'?options.length-1:(idx+(e.key==='ArrowRight'?1:-1)+options.length)%options.length;tab=options[next][0];showDetail();document.getElementById(`tab-${tab}`).focus();}});
        tabs.append(b);
      });
      detail.append(tabs,panel);
      if(tab==='overview'){
        panel.append(node('h3',{text:'주제 검색어'}),node('div',{class:'keywords'},chosen.keywords.map(text=>node('span',{class:'keyword',text}))),node('h3',{text:'분류 기준'}),p(chosen.review_note,'review-note'));
      }else if(tab==='patents'){
        const rows=data.analysis.ready?data.analysis.patent_trends.filter(r=>r.topic_id===chosen.id):[];
        panel.append(trendChart(rows,`${chosen.name} 연도별 출원`),sourceNote());
      }else if(tab==='business'){
        panel.append(p('기술 성숙도·적용 제품·상업화 근거를 함께 살펴봅니다.'),link('R&D에서 제품까지','commercialization.html'));
      }else panel.append(p('출원인과 기술 분류를 기준으로 기관별 활동을 비교합니다.'));
      panel.append(p(`검색어 기준 ${data.as_of}`,'chart-note'));
    }
    function render(){
      const query=search.value.trim().toLocaleLowerCase();
      const rows=data.topics.filter(t=>(filter.value==='전체 분야'||filter.value===t.field)&&`${t.name} ${t.field} ${t.keywords.join(' ')}`.toLocaleLowerCase().includes(query));
      if(!rows.includes(chosen)){chosen=rows[0]||null;tab='overview';}
      count.textContent=`연구 주제 ${rows.length}개`;
      list.replaceChildren(...rows.map(t=>{
        const b=node('button',{type:'button',class:'topic-option','aria-pressed':String(chosen===t)},[node('strong',{text:t.name}),node('small',{text:t.field})]);
        b.addEventListener('click',()=>{chosen=t;tab='overview';history.replaceState(null,'',`?topic=${encodeURIComponent(t.id)}#topics`);render();live.textContent=`${t.name} 선택됨`;});return b;
      }));
      if(!rows.length)list.append(empty('검색 결과 0개'));
      showDetail();
    }
    search.addEventListener('input',render);filter.addEventListener('change',render);
    reset.addEventListener('click',()=>{search.value='';filter.value='전체 분야';chosen=data.topics[0];tab='overview';history.replaceState(null,'',location.pathname);render();search.focus();});
    render();
  }

  const outlook=document.getElementById('outlook-view');
  if(outlook){
    const signals=[['growth','출원 성장','같은 기간의 출원 증가'],['citations','피인용 증가','수집 범위 내 후속 인용'],['funding','국책 투자','확인된 과제·투자 신호'],['commercialization','상용화 근접','근거가 있는 사업화 단계'],['lgd','LGD 연계','검수된 기술·협력 연결']];
    let weights=[20,20,20,20,20];
    const controls=section('판단 기준',[]), results=section('기술별 신호',[]);
    const presets=node('div',{class:'presets','aria-label':'가중치 프리셋'});
    const fields=[];
    const total=p('','weight-total'), bars=node('div',{class:'weight-bars','aria-hidden':'true'});
    const rankings=node('div',{'aria-live':'polite'});
    const buttons=[];
    [['균형',[20,20,20,20,20]],['연구 신호',[35,30,20,5,10]],['사업화 신호',[10,10,15,40,25]]].forEach(([name,values])=>{
      const b=node('button',{type:'button',text:name,'aria-pressed':String(name==='균형')});
      b.addEventListener('click',()=>{weights=[...values];buttons.forEach(x=>x.setAttribute('aria-pressed',String(x===b)));fields.forEach((field,i)=>field.input.value=weights[i]);refresh();});buttons.push(b);presets.append(b);
    });
    controls.append(p('가중치는 이 화면에서만 적용됩니다.','small'),presets);
    signals.forEach(([id,label,note],i)=>{
      const output=node('output',{for:`weight-${id}`,text:'20'});
      const input=node('input',{type:'range',id:`weight-${id}`,min:'0',max:'100',step:'5',value:'20'});
      controls.append(node('div',{class:'slider-row'},[node('label',{for:`weight-${id}`},[node('span',{text:label}),output]),input,node('small',{text:note})]));
      fields.push({input,output});input.addEventListener('input',()=>{weights[i]=Number(input.value);buttons.forEach(b=>b.setAttribute('aria-pressed','false'));refresh();});
    });
    controls.append(total,bars);
    results.append(p('연구 주제와 판단 기준을 함께 살펴봅니다.','small'),rankings);
    const method=section('산정 원칙',[p('출원 성장·피인용·국책 투자·상용화·LGD 연계의 5개 신호를 공통 척도로 정리하고 가중 평균합니다.'),p('선택한 신호의 값이 있는 기술을 기준으로 계산합니다.','chart-note')]);
    const right=node('div',{},[results,method]);method.style.marginTop='24px';
    outlook.append(node('div',{class:'outlook-grid'},[controls,right]));
    function refresh(){
      const sum=weights.reduce((a,b)=>a+b,0);
      total.replaceChildren(node('span',{text:'가중치 합계 '}),node('strong',{class:'num',text:String(sum)}),node('span',{text:sum?' · 합계 기준으로 정규화':' · 하나 이상의 신호를 선택해 주세요'}));
      fields.forEach((f,i)=>f.output.textContent=String(weights[i]));
      bars.replaceChildren(...weights.filter(v=>v>0).map(v=>{const s=node('span');s.style.flex=String(v);return s;}));
      rankings.replaceChildren();
      if(!sum){rankings.append(empty('모든 가중치가 0입니다.','슬라이더를 올리거나 프리셋을 선택해 주세요.'));return;}
      const rows=data.analysis.ready?data.analysis.technology_signals.filter(r=>signals.every(([id],i)=>weights[i]===0||Number.isFinite(r.signals?.[id]))).map(r=>({...r,score:signals.reduce((score,[id],i)=>score+(weights[i]?r.signals[id]*weights[i]:0),0)/sum})).sort((a,b)=>b.score-a.score):[];
      const table=node('table',{class:'rank-table'},[node('thead',{},[node('tr',{},[node('th',{text:'연구 주제',scope:'col'}),node('th',{text:'유망도',scope:'col',class:'num'})])])]);
      const bodyRows=rows.length?rows.map(r=>node('tr',{},[node('td',{text:data.topics.find(t=>t.id===r.topic_id)?.name||r.topic_id}),node('td',{text:r.score.toFixed(1),class:'num'})])):data.topics.map(t=>node('tr',{},[node('td',{},[link(t.name,`explorer.html#${t.id}`)]),node('td',{text:'—',class:'num'})]));
      table.append(node('tbody',{},bodyRows));
      rankings.append(table,p(rows.length?'선택한 가중치로 계산한 신호의 평균입니다.':'연구 주제 목록 순서로 표시합니다.','chart-note'));
    }
    refresh();
  }

  const view=document.querySelector('[data-analysis-view]');
  if(view){
    const key=view.dataset.analysisView;
    const configurations={
      landscape:[['연도별 출원 추이','기술별 출원이 시간에 따라 어떻게 달라지는지 살펴봅니다.'],['기관 × 기술','기관마다 어느 기술에 집중하는지 같은 분류로 비교합니다.'],['포트폴리오 구성','IPC별 출원 구성에서 기술의 비중을 읽습니다.'],['키워드의 변화','같은 기간·검색 조건으로 비교합니다.']],
      competition:[['규모와 성장 속도','출원 규모와 같은 기간의 성장률을 함께 살펴봅니다.'],['주제별 출원 변화','같은 분야·기간의 추이를 비교합니다.'],['주요 변화 시점','출원과 공개의 시점을 기준으로 변화를 읽습니다.'],['비교 기관','기관별 검색 범위와 비교 기준을 확인합니다.']],
      commercialization:[['과제에서 제품까지','과제·특허·제품의 확인된 연결을 기다립니다.'],['연구개발비','확보한 공시의 금액·기준연도·연결/별도 범위를 검토합니다.'],['공개 계약','반복 공시를 구분한 근거를 연결합니다.'],['제품과 개발 실적','출시 제품과 개발 실적 후보를 구분합니다.']],
      network:[['LGD와의 공개 관계','공동출판·계약·지분투자·권리이전을 종류별로 구분합니다.'],['협력 후보','기술의 접점과 기존 관계를 함께 살펴봅니다.'],['관계의 근거','원문 접수번호·논문 ID 등 출처를 함께 제공합니다.'],['관계의 범위','공개 문서와 학술 기록으로 확인한 관계를 대상으로 합니다.']]
    };
    const field=node('select',{id:'analysis-field'},['전체 분야',...new Set(data.topics.map(t=>t.field))].map(text=>node('option',{text,value:text})));
    const period=node('select',{id:'analysis-period'},['2016–2026','2016–2019','2020–2023','2024–2026'].map(text=>node('option',{text,value:text})));
    const scope=p('','scope-note');
    const grid=node('div',{class:'analysis-grid'});
    const filtered=rows=>(rows||[]).filter(r=>(field.value==='전체 분야'||r.field===field.value)&&(r.period?r.period===period.value:r.year?(period.value==='2016–2026'||(r.year>=Number(period.value.slice(0,4))&&r.year<=Number(period.value.slice(-4)))):period.value==='2016–2026'));
    const update=()=>{
      scope.textContent=`${field.value} · ${period.value}${key==='network'?' · 관계 그래프는 전체 범위':''}`;
      grid.replaceChildren();
      configurations[key].forEach(([title,description],i)=>{
        const content=[p(description)];
        if(data.analysis.ready&&window.d3){
          const a=data.analysis,commercial=a.commercialization||{},competition=a.competition||{},network=a.network||{nodes:[],links:[]};
          const renderers={
            landscape:[()=>trendChart(filtered(a.patent_trends),'연도별 출원 추이'),()=>matrix(filtered(a.institution_technology)),()=>treemap(filtered(a.portfolio)),()=>dataTable(filtered(a.keyword_changes),[['label','키워드'],['before','이전 기간',true],['after','이후 기간',true]])],
            competition:[()=>scatter(filtered(competition.positions),'count','growth','출원 건수','성장률 (%)'),()=>trendChart(filtered(a.patent_trends),'기관별 출원 변화'),()=>dataTable(filtered(competition.events),[['year','연도',true],['label','변화'],['evidence','근거']]),()=>dataTable(filtered(competition.institutions),[['label','기관'],['scope','비교 범위']])],
            commercialization:[()=>pathsView(filtered(commercial.paths)),()=>bars(filtered(commercial.rnd_costs)),()=>dataTable(filtered(commercial.contracts),[['year','공시연도',true],['label','계약'],['counterparty','상대방'],['evidence','원문 근거']]),()=>dataTable(filtered(commercial.products),[['label','제품·실적'],['stage','구분'],['evidence','원문 근거']])],
            network:[()=>networkGraph(network),()=>dataTable(filtered(network.candidates),[['label','후보'],['basis','검수 근거']]),()=>dataTable(filtered(network.evidence),[['label','관계'],['kind','종류'],['evidence','원문 근거']]),()=>p('공시·공동출판·특허 기록에 근거한 관계입니다.')]
          };
          content.push(renderers[key][i]());
          content.push(p(`출처: ${a.source_label||'공개 자료'} · 기준 ${a.reviewed_on||data.as_of}`,'chart-note'));
        }else{
          if(i===0)content.push(emptyChart());content.push(sourceNote());
        }
        grid.append(section(title,content));
      });
    };
    [field,period].forEach(el=>el.addEventListener('change',update));
    view.append(node('div',{class:'toolbar'},[node('label',{class:'field',for:'analysis-field'},[node('span',{text:'연구 분야'}),field]),node('label',{class:'field',for:'analysis-period'},[node('span',{text:'출원 기간'}),period])]),scope,grid);
    if(key==='commercialization')view.append(section('공시의 기준',[p('LGD·덕산네오룩스의 2016~2025 회계연도 사업보고서를 사용합니다. 공시연도와 실적연도, 반복 기재를 구분해 기록합니다.'),link('자료와 분석 기준','methodology.html')],'finding'));
    update();
  }

  const positioning=document.getElementById('positioning-view');
  if(positioning){
    let saved=[];try{saved=JSON.parse(localStorage.getItem('lgenius-interests')||'[]');if(!Array.isArray(saved))saved=[];}catch{}
    const current=new Set(saved.filter(id=>data.topics.some(t=>t.id===id)));
    const status=p('','interest-status');
    function update(){
      try{localStorage.setItem('lgenius-interests',JSON.stringify([...current]));status.textContent=`관심 주제 ${current.size}개 · 이 브라우저에 저장됨`;}catch{status.textContent=`관심 주제 ${current.size}개 · 이번 화면에서 유지됩니다.`;}
    }
    const fields=data.topics.map(t=>{
      const input=node('input',{type:'checkbox',value:t.id});input.checked=current.has(t.id);
      input.addEventListener('change',()=>{if(input.checked)current.add(t.id);else current.delete(t.id);update();});
      return node('label',{class:'interest-option'},[input,node('span',{},[node('strong',{text:t.name}),node('small',{text:t.field})])]);
    });
    const clear=node('button',{type:'button',class:'button',text:'관심 주제 초기화'});
    clear.addEventListener('click',()=>{current.clear();fields.forEach(el=>el.querySelector('input').checked=false);update();});
    positioning.append(section('관심 주제 고르기',[p('관심 있는 기술을 선택해 이 기기에 기록합니다.','small'),node('div',{class:'interest-grid',style:'margin-top:18px'},fields),status,clear]),section('연구 방향 비교',[p('선택한 관심 주제와 기업의 기술 방향을 함께 살펴보고, 주제별 연구 질문과 준비 경로를 정리합니다.')],'finding'));
    update();
  }
  const methodology=document.getElementById('methodology-view');
  if(methodology)methodology.append(section('자료의 출처',[tableSources(),p(`데이터 기준 ${data.as_of}`,'table-source')]));
})();
