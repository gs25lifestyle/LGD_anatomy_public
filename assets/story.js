/* A visual reading path. Diagrams encode source roles; the chart uses existing DART observations. */
(() => {
  'use strict';
  const data=window.LGENIUS_DATA;
  if(!data||!window.d3)return;
  const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
  const number=value=>new Intl.NumberFormat('ko-KR').format(value);
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('[data-as-of]').forEach(el=>{el.textContent=data.as_of;el.dateTime=data.as_of;});

  // Reading progress and section navigation, without a sidebar or route changes.
  const progress=document.querySelector('.reading-progress span');
  let scheduled=false;
  const updateProgress=()=>{scheduled=false;const height=document.documentElement.scrollHeight-innerHeight;progress.style.transform=`scaleX(${height>0?Math.min(1,scrollY/height):0})`;};
  addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(updateProgress);}},{passive:true});updateProgress();
  const navLinks=[...document.querySelectorAll('.site-header nav a')];
  const activeObserver=new IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting){navLinks.forEach(a=>{if(a.hash==='#'+entry.target.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}
  },{rootMargin:'-15% 0px -65% 0px'});
  ['question','evidence','topics','methods'].forEach(id=>activeObserver.observe(document.getElementById(id)));
  if(!reduce){
    const reveals=[...document.querySelectorAll('.section-intro h2,.section-intro>p,.split-intro>div,.bridge,.record-side,.closing-statement,.hero h1,.hero-description,.primary-action')];
    const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');observer.unobserve(e.target);}}),{threshold:.08});
    reveals.forEach(e=>{e.classList.add('reveal');observer.observe(e);});document.documentElement.classList.add('motion-ready');
  }

  const sources=[
    {id:'dart',label:'사업보고서',line:'어떤 사업을 만들고 있을까.',text:'제품군과 연구개발 활동, 비용과 공개 계약을 함께 읽어 기업이 자원을 배분하는 방향을 살펴봅니다.',target:'business'},
    {id:'patents',label:'특허',line:'어떤 기술을 권리로 남길까.',text:'출원인·출원일·기술 분류와 원문에서 기업의 기술 활동을 읽습니다.',target:'records'},
    {id:'papers',label:'논문',line:'어떤 문제를 함께 연구할까.',text:'연구 주제와 저자 소속, 공동출판과 지원기관에서 연구의 방향과 접점을 살펴봅니다.',target:'records'},
    {id:'projects',label:'국책과제',line:'어떤 목표에 연구 자원이 모일까.',text:'과제의 목표와 참여 기관을 특허·제품 기록과 대조하는 자료로 삼습니다.',target:'comparison'},
    {id:'contracts',label:'공개 계약',line:'어떤 기술이 사업 관계로 이어질까.',text:'계약의 상대방·내용·시점을 공시 원문과 연결해 확인합니다.',target:'business'},
    {id:'products',label:'제품 기록',line:'어떤 기술이 제품으로 이어질까.',text:'제품과 개발 실적을 구분하고 과제·특허·계약과 연결되는 근거를 찾습니다.',target:'direction'}
  ];
  let sourceIndex=0;
  const sourceControls=document.getElementById('source-controls'),sourceDescription=document.getElementById('source-description');
  const sourceButtons=sources.map((s,i)=>{const b=make('button',s.label);b.type='button';b.addEventListener('click',()=>selectSource(i));sourceControls.append(b);return b;});
  let sourceSvg;
  function drawSources(){
    const target=document.getElementById('source-map'),width=Math.max(300,target.clientWidth),height=width<420?390:440;
    const cx=width/2,cy=height/2,rx=width<420?width*.34:width*.37,ry=height*.34;
    const positions=sources.map((s,i)=>{const angle=-Math.PI/2+i*Math.PI/3;return {...s,x:cx+Math.cos(angle)*rx,y:cy+Math.sin(angle)*ry};});
    sourceSvg=d3.create('svg').attr('viewBox',`0 0 ${width} ${height}`).attr('role','img');
    sourceSvg.attr('aria-label','사업보고서·특허·논문·국책과제·계약·제품 기록을 기업의 연구 방향이라는 질문에 연결한 조사 구조');
    sourceSvg.append('ellipse').attr('cx',cx).attr('cy',cy).attr('rx',rx).attr('ry',ry).attr('fill','none').attr('stroke','#252527').attr('stroke-dasharray','3 8');
    sourceSvg.selectAll('.source-edge').data(positions).join('path').attr('class','source-edge').attr('d',d=>`M${cx},${cy} Q${cx+(d.x-cx)*.25},${d.y} ${d.x},${d.y}`).attr('fill','none').attr('stroke','#48484e').attr('stroke-width',1.2);
    sourceSvg.append('circle').attr('cx',cx).attr('cy',cy).attr('r',width<420?42:54).attr('fill','#19191b').attr('stroke','#56565c');
    sourceSvg.append('text').attr('x',cx).attr('y',cy-4).attr('text-anchor','middle').attr('fill','#f5f5f7').style('font',`${width<420?15:18}px "Noto Sans KR"`).text('연구의 방향');
    sourceSvg.append('text').attr('x',cx).attr('y',cy+19).attr('text-anchor','middle').attr('fill','#b4b4bc').style('font','12px "Noto Sans KR"').text('자료에서 질문으로');
    const nodes=sourceSvg.selectAll('.source-node').data(positions).join('g').attr('class','source-node').attr('transform',d=>`translate(${d.x},${d.y})`);
    nodes.append('circle').attr('r',7).attr('fill','#82828a');
    nodes.append('text').attr('text-anchor','middle').attr('y',d=>d.y<cy?-19:30).attr('fill','#dedee4').style('font','14px "Noto Sans KR"').text(d=>d.label);
    target.replaceChildren(sourceSvg.node());highlightSource();
  }
  function highlightSource(){if(!sourceSvg)return;sourceSvg.selectAll('.source-node circle').attr('fill',(d,i)=>i===sourceIndex?'#78b8ff':'#82828a').attr('r',(d,i)=>i===sourceIndex?9:6);sourceSvg.selectAll('.source-edge').attr('stroke',(d,i)=>i===sourceIndex?'#78b8ff':'#48484e').attr('stroke-width',(d,i)=>i===sourceIndex?2:1.2);}
  function selectSource(i){sourceIndex=i;sourceButtons.forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));const s=sources[i],a=make('a','이 기록을 읽는 흐름');a.href='#'+s.target;sourceDescription.replaceChildren(make('h3',s.line),make('p',s.text),a);highlightSource();}
  drawSources();selectSource(0);

  const spending=data.rnd_spending||[];let yearIndex=spending.length-1;
  const yearInput=document.getElementById('spending-year');yearInput.max=String(Math.max(0,spending.length-1));yearInput.value=String(yearIndex);
  let spendingSvg,spendingScale;
  function drawSpending(){
    if(!spending.length)return;
    const holder=document.getElementById('spending-chart'),width=Math.max(290,holder.clientWidth),height=width<500?250:310;
    const m={left:42,right:10,top:20,bottom:42};
    const x=d3.scaleBand().domain(spending.map(r=>r.year)).range([m.left,width-m.right]).padding(.38);
    const max=Math.max(1,...spending.map(r=>r.million_won/1e6));
    const y=d3.scaleLinear().domain([0,Math.ceil(max)]).range([height-m.bottom,m.top]);
    spendingScale={x,y,height,m};
    spendingSvg=d3.create('svg').attr('viewBox',`0 0 ${width} ${height}`).attr('role','img').attr('aria-label','LG디스플레이 공시의 실적연도별 연구개발비용 계, 단위 조 원');
    const grid=spendingSvg.append('g');
    for(const tick of y.ticks(3)){grid.append('line').attr('x1',m.left).attr('x2',width-m.right).attr('y1',y(tick)).attr('y2',y(tick)).attr('stroke','#e7e7ec');grid.append('text').attr('x',m.left-9).attr('y',y(tick)+4).attr('text-anchor','end').text(tick);}
    spendingSvg.selectAll('rect').data(spending).join('rect').attr('x',r=>x(r.year)).attr('y',r=>y(r.million_won/1e6)).attr('width',x.bandwidth()).attr('height',r=>height-m.bottom-y(r.million_won/1e6)).attr('rx',3).append('title').text(r=>`${r.year}년: ${number(r.million_won)} 백만원`);
    spending.forEach((r,i)=>{if(width>=600||i%3===0||i===spending.length-1)spendingSvg.append('text').attr('x',x(r.year)+x.bandwidth()/2).attr('y',height-14).attr('text-anchor','middle').text(r.year);});
    holder.replaceChildren(spendingSvg.node());updateYear();
  }
  function updateYear(){
    if(!spending.length)return;
    const row=spending[yearIndex];const value=make('strong',`${(row.million_won/1e6).toFixed(2)}조 원`),label=make('span',`${row.year}년 실적`);
    document.getElementById('spending-value').replaceChildren(value,label);
    document.getElementById('spending-year-output').textContent=row.year+'년';
    document.getElementById('spending-source').href=row.source_url;
    spendingSvg?.selectAll('rect').attr('fill',(r,i)=>i===yearIndex?'#0071e3':'#d3d3da');
  }
  yearInput.addEventListener('input',()=>{yearIndex=Number(yearInput.value);updateYear();});drawSpending();
  const expenseTable=make('table'),head=make('thead'),headRow=make('tr');
  ['실적연도','연구개발비용 계 (백만원)','공시 원문'].forEach((s,i)=>{const th=make('th',s,i===1?'num':'');th.scope='col';headRow.append(th);});head.append(headRow);expenseTable.append(head);
  const body=make('tbody');spending.forEach(r=>{const tr=make('tr');tr.append(make('td',String(r.year)),make('td',number(r.million_won),'num'));const td=make('td'),a=make('a','원문');a.href=r.source_url;a.target='_blank';a.rel='noopener noreferrer';td.append(a);tr.append(td);body.append(tr);});expenseTable.append(body);document.getElementById('spending-table').replaceChildren(expenseTable);
  function total(id,source,note){const target=document.getElementById(id);target.replaceChildren(make('strong',number(source.count)),make('span',source.unit),make('small',note));target.parentElement.insertBefore(target,target.parentElement.querySelector('.record-glyph'));}
  total('patent-total',data.sources.find(s=>s.name==='KIPRIS Plus'),'기관·분야 검색으로 확보한 고유 출원번호');
  total('paper-total',data.sources.find(s=>s.name==='OpenAlex'),'조사 기관의 제목·초록 검색 적중 문헌 후보');

  function drawTopics(){
    const holder=document.getElementById('topic-map'),width=Math.max(300,holder.clientWidth),mobile=width<600,height=mobile?450:330;
    const svg=d3.create('svg').attr('viewBox',`0 0 ${width} ${height}`).attr('role','img').attr('aria-label','대형 OLED의 5개 주제와 차세대 폼팩터의 3개 주제');
    const groups=[...new Set(data.topics.map(t=>t.field))];
    groups.forEach((group,gi)=>{
      const rows=data.topics.filter(t=>t.field===group);
      const startX=mobile?28:gi*width/2+35,groupY=mobile?(gi===0?45:290):48;
      svg.append('text').attr('x',startX).attr('y',groupY).attr('fill','#1d1d1f').style('font-weight','600').text(group);
      rows.forEach((topic,i)=>{
        const y=groupY+36+i*(mobile?33:43),x=startX+20;
        svg.append('path').attr('d',`M${startX+5},${groupY+10} V${y-4} H${x-2}`).attr('fill','none').attr('stroke','#bcbcc6');
        svg.append('circle').attr('cx',x).attr('cy',y-4).attr('r',3).attr('fill','#0071e3');
        const a=svg.append('a').attr('href',`?topic=${topic.id}#topics`).attr('aria-label',topic.name+' 검색 범위 보기');
        a.append('text').attr('x',x+13).attr('y',y).attr('fill','#45454c').text(topic.name);
        a.on('click',event=>{
          event.preventDefault();const query=document.getElementById('topic-search'),field=document.getElementById('topic-field');query.value='';field.value='전체 분야';query.dispatchEvent(new Event('input',{bubbles:true}));
          [...document.querySelectorAll('.topic-option')].find(b=>b.querySelector('strong').textContent===topic.name)?.click();
          document.querySelector('.workbench').scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
        });
      });
    });
    holder.replaceChildren(svg.node());
  }
  drawTopics();

  const criteria=[['출원 성장','시간에 따른 기술 활동'],['피인용 증가','후속 연구의 확산'],['국책 투자','공개된 연구 지원'],['상용화 근접','제품화의 근거'],['LGD 연계','기술·협력의 접점']];
  let weights=[20,20,20,20,20];
  const controls=make('div'),presets=make('div',null,'criteria-presets'),output=make('div',null,'criteria-output');
  output.append(make('h3','나의 판단 기준'));
  const fields=[],tracks=[];
  const presetButtons=[['균형 있게',[20,20,20,20,20]],['연구의 확산',[35,30,20,5,10]],['사업화의 근거',[10,10,15,40,25]]].map(([name,values],i)=>{const b=make('button',name);b.type='button';b.setAttribute('aria-pressed',String(i===0));b.addEventListener('click',()=>{weights=[...values];fields.forEach((f,j)=>f.input.value=weights[j]);presetButtons.forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderWeights();});presets.append(b);return b;});
  controls.append(presets);
  criteria.forEach(([name,note],i)=>{
    const row=make('div',null,'criterion'),label=make('label'),value=make('output',String(weights[i]));label.htmlFor=`criterion-${i}`;value.htmlFor=`criterion-${i}`;label.append(make('span',name),value);
    const input=make('input');input.type='range';input.min='0';input.max='100';input.step='5';input.value=weights[i];input.id=`criterion-${i}`;input.name=`criterion-${i}`;input.addEventListener('input',()=>{weights[i]=Number(input.value);presetButtons.forEach(b=>b.setAttribute('aria-pressed','false'));renderWeights();});row.append(label,input);controls.append(row);fields.push({input,value});
    const bar=make('div',null,'criterion-bar'),title=make('div'),percent=make('span');title.append(make('span',name),percent);const track=make('div',null,'criterion-track'),fill=make('span');track.append(fill);bar.append(title,track);output.append(bar);tracks.push({fill,percent});
  });
  const criteriaCaption=make('p',null,'criteria-caption');criteriaCaption.setAttribute('aria-live','polite');output.append(criteriaCaption);
  const criteriaGrid=make('div',null,'criteria-grid');criteriaGrid.append(controls,output);document.getElementById('criteria-workbench').replaceChildren(criteriaGrid);
  function renderWeights(){
    const sum=weights.reduce((a,b)=>a+b,0),shares=weights.map(w=>sum?w/sum*100:0),rounded=shares.map(Math.floor);
    if(sum){const order=shares.map((share,i)=>({i,fraction:share-rounded[i]})).sort((a,b)=>b.fraction-a.fraction);for(let i=0,left=100-rounded.reduce((a,b)=>a+b,0);i<left;i++)rounded[order[i].i]++;}
    fields.forEach((f,i)=>f.value.textContent=weights[i]);tracks.forEach((t,i)=>{t.fill.style.width=shares[i]+'%';t.percent.textContent=rounded[i]+'%';});
    criteriaCaption.textContent=sum?'선택한 가중치를 100%로 환산한 구성입니다. 표시 비중은 합계에 맞춰 반올림하며, 기술별 유망도 점수와 구분합니다.':'하나 이상의 신호를 선택하거나 프리셋을 눌러주세요.';
  }
  renderWeights();

  const notebook=document.getElementById('research-notebook');let saved={topics:[],note:''};
  try{const value=JSON.parse(localStorage.getItem('display-research-notebook')||'null');if(value&&Array.isArray(value.topics)&&typeof value.note==='string')saved=value;}catch{}
  const selected=new Set(saved.topics.filter(id=>data.topics.some(t=>t.id===id))),tags=make('div',null,'interest-tags'),status=make('p',null,'notebook-status');status.setAttribute('aria-live','polite');
  data.topics.forEach(topic=>{const label=make('label',null,'interest-tag'),input=make('input');input.type='checkbox';input.value=topic.id;input.name='research-topic';input.checked=selected.has(topic.id);input.addEventListener('change',()=>{if(input.checked)selected.add(topic.id);else selected.delete(topic.id);saveNotebook();});label.append(input,make('span',topic.name));tags.append(label);});
  const label=make('label',null,'notebook-field');label.htmlFor='research-note';label.append(make('span','이 기술에서 더 알고 싶은 문제'));
  const textarea=make('textarea');textarea.id='research-note';textarea.name='research-note';textarea.placeholder='예: 어떤 소재·소자·공정 문제가 궁금한가요?';textarea.value=saved.note;textarea.addEventListener('input',saveNotebook);label.append(textarea);
  const exportButton=make('button','연구 질문 내려받기','button');exportButton.type='button';exportButton.addEventListener('click',()=>{const value={topics:data.topics.filter(t=>selected.has(t.id)).map(t=>t.name),note:textarea.value};const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json;charset=utf-8'}));const a=make('a');a.href=url;a.download='research-questions.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  const actions=make('div',null,'notebook-actions');actions.append(exportButton,status);notebook.append(tags,label,actions);
  function saveNotebook(){try{localStorage.setItem('display-research-notebook',JSON.stringify({topics:[...selected],note:textarea.value}));status.textContent=`관심 주제 ${selected.size}개 · 이 브라우저에 저장`;}catch{status.textContent=`관심 주제 ${selected.size}개 · 이 화면에서 기록`;}}
  saveNotebook();
  let resizeTimer;addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{drawSources();drawSpending();drawTopics();updateProgress();},150);});
})();
