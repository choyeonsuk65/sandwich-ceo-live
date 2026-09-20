const A=SCEO;let db,uid,ROOM=null,ROOMCODE='',CFG=JSON.parse(JSON.stringify(A.DEF)),unsubs=[],teamUnsubs=[],timerHandle=null,soundOn=true,voiceOn=true,lockMainBusy=false,auctionClosing=false,offerFinalizing=false;
const $=A.$,$$=A.$$;
function beep(freq=760,dur=.12){if(!soundOn)return;try{const c=new (window.AudioContext||window.webkitAudioContext)(),o=c.createOscillator(),g=c.createGain();o.frequency.value=freq;o.connect(g);g.connect(c.destination);g.gain.value=.05;o.start();setTimeout(()=>{o.stop();c.close()},dur*1000)}catch(e){}}
function speak(t){if(!voiceOn||!('speechSynthesis'in window))return;const u=new SpeechSynthesisUtterance(t);u.lang='ko-KR';u.rate=1.05;speechSynthesis.cancel();speechSynthesis.speak(u)}
function setBadge(ok,text){$('#fbBadge').className='badge'+(ok?' on':'');$('#fbBadge').textContent=text}
function fillSettings(){['studentCount','teamCount','teamBudget','auctionSeconds','maxAddons','padletUrl'].forEach(k=>$('#'+k).value=CFG[k]);$('#commonIngredients').value=CFG.commonIngredients.join('\n');renderEditors()}
function rows(cat){return `<table class="statusTable"><thead><tr><th>품목</th><th>시작가</th><th>수량</th></tr></thead><tbody>${CFG[cat].map((x,i)=>`<tr><td><input class="input ed" data-cat="${cat}" data-i="${i}" data-k="name" value="${A.esc(x.name)}"></td><td><input class="input ed" type="number" data-cat="${cat}" data-i="${i}" data-k="startPrice" value="${x.startPrice}"></td><td><input class="input ed" type="number" min="1" data-cat="${cat}" data-i="${i}" data-k="stock" value="${x.stock}"></td></tr>`).join('')}</tbody></table>`}
function renderEditors(){$('#mainEditor').innerHTML=rows('mainItems');$('#addonEditor').innerHTML=rows('addonItems');$('#drinkEditor').innerHTML=rows('drinkItems');$$('.ed').forEach(el=>el.onchange=()=>{const x=CFG[el.dataset.cat][+el.dataset.i],k=el.dataset.k;x[k]=k==='name'?el.value:(+el.value||0)})}
function collectSettings(){CFG.studentCount=Math.max(3,+$('#studentCount').value||15);CFG.teamCount=Math.max(2,+$('#teamCount').value||5);CFG.teamBudget=Math.max(1000,+$('#teamBudget').value||30000);CFG.auctionSeconds=Math.max(5,+$('#auctionSeconds').value||30);CFG.maxAddons=Math.max(1,+$('#maxAddons').value||2);CFG.padletUrl=$('#padletUrl').value.trim();CFG.commonIngredients=$('#commonIngredients').value.split(/\n+/).map(x=>x.trim()).filter(Boolean);localStorage.setItem('sceo_v2_cfg',JSON.stringify(CFG));return CFG}
function initInventory(cfg){const inv={};['mainItems','addonItems','drinkItems'].forEach(cat=>cfg[cat].forEach(x=>inv[x.id]={remaining:+x.stock||1}));return inv}
function initTeams(cfg){const sizes=A.teamSizes(cfg.studentCount,cfg.teamCount),t={};sizes.forEach((s,i)=>t[String(i+1)]={name:`${i+1}조`,size:s,deviceUid:null,joinedAt:null,awards:{}});return t}
async function createRoom(){collectSettings();let code;for(let i=0;i<10;i++){code=A.randRoom();if(!(await A.read(A.roomPath(code,'meta'))))break}ROOMCODE=code;localStorage.setItem('sceo_v2_room',code);const meta={teacherUid:uid,createdAt:firebase.database.ServerValue.TIMESTAMP,title:CFG.title,closed:false};const state={phase:'planning',mainSelectionOpen:false,mainSelectionMode:'initial',mainSelectionTargets:{},pendingContests:{},reselectTeams:{},currentAuction:null,offer:null,reflectionOpen:false};await A.set(A.roomPath(code,'meta'),meta);await Promise.all([A.set(A.roomPath(code,'config'),CFG),A.set(A.roomPath(code,'state'),state),A.set(A.roomPath(code,'inventory'),initInventory(CFG))]);const teams=initTeams(CFG);await Promise.all(Object.entries(teams).map(([id,t])=>A.set(A.roomPath(code,'teams',id),t)));subscribeRoom(code);beep();speak('새 수업방을 만들었습니다. 방 코드는 '+code.split('').join(' '));}
function clearSubs(){unsubs.forEach(f=>{try{f()}catch(e){}});teamUnsubs.forEach(f=>{try{f()}catch(e){}});unsubs=[];teamUnsubs=[]}
function bindTeamSubs(code,count){teamUnsubs.forEach(f=>{try{f()}catch(e){}});teamUnsubs=[];ROOM.teams={};ROOM.mainSelections={};for(let i=1;i<=count;i++){const id=String(i);teamUnsubs.push(A.listen(A.roomPath(code,'teams',id),v=>{ROOM.teams[id]=v||null;renderAll()}));teamUnsubs.push(A.listen(A.roomPath(code,'mainSelections',id),v=>{if(v===null||v===undefined)delete ROOM.mainSelections[id];else ROOM.mainSelections[id]=v;renderAll()}))}}
function subscribeRoom(code){clearSubs();ROOMCODE=code;localStorage.setItem('sceo_v2_room',code);ROOM={meta:null,config:null,state:{},inventory:{},teams:{},mainSelections:{},history:{}};unsubs.push(A.listen(A.roomPath(code,'meta'),v=>{ROOM.meta=v||null;renderAll()}));unsubs.push(A.listen(A.roomPath(code,'state'),v=>{ROOM.state=v||{};renderAll()}));unsubs.push(A.listen(A.roomPath(code,'inventory'),v=>{ROOM.inventory=v||{};renderAll()}));unsubs.push(A.listen(A.roomPath(code,'history'),v=>{ROOM.history=v||{};renderAll()}));unsubs.push(A.listen(A.roomPath(code,'config'),v=>{const prev=ROOM.config?.teamCount;ROOM.config=v||null;if(v){CFG=v;if(prev!==v.teamCount||!teamUnsubs.length)bindTeamSubs(code,+v.teamCount||5)}renderAll()}));}
async function readAllTeams(){const ids=Array.from({length:+CFG.teamCount||5},(_,i)=>String(i+1));const vals=await Promise.all(ids.map(id=>A.read(A.roomPath(ROOMCODE,'teams',id))));const out={};ids.forEach((id,i)=>out[id]=vals[i]||null);return out}
async function readChoices(kind,id,teams){const vals=await Promise.all((teams||[]).map(t=>A.read(A.roomPath(ROOMCODE,kind,id,String(t)))));const out={};(teams||[]).forEach((t,i)=>{if(vals[i]!==null&&vals[i]!==undefined)out[String(t)]=vals[i]});return out}
function studentUrl(){const u=new URL('student.html',location.href);if(ROOMCODE)u.searchParams.set('room',ROOMCODE);return u.href}
let qrLast='';
function makeQr(el,text,size){
  if(!el)return;
  el.innerHTML='';
  if(!text)return;
  if(typeof QRCode==='undefined'){el.innerHTML='<div class="warnbox">QR 모듈을 불러오지 못했습니다. 학생 링크 복사를 사용하세요.</div>';return}
  new QRCode(el,{text,width:size,height:size,correctLevel:QRCode.CorrectLevel.M});
}
function renderQr(force=false){
  const btn=$('#showQr'),box=$('#qrPreviewBox');
  if(!ROOMCODE){if(btn)btn.disabled=true;if(box)box.classList.add('hidden');qrLast='';return}
  const url=studentUrl();
  if(btn)btn.disabled=false;
  if(box)box.classList.remove('hidden');
  $('#qrRoomCode').textContent=ROOMCODE;
  if(force||qrLast!==url){makeQr($('#qrPreview'),url,150);qrLast=url}
}
function openQrDialog(){
  if(!ROOMCODE)return alert('먼저 새 수업방을 만들어 주세요.');
  const url=studentUrl();
  $('#qrLargeCode').textContent=ROOMCODE;$('#qrLargeUrl').textContent=url;makeQr($('#qrLarge'),url,320);
  const d=$('#qrDialog');if(d.showModal)d.showModal();else d.setAttribute('open','');
}
function closeQrDialog(){const d=$('#qrDialog');if(d.close)d.close();else d.removeAttribute('open')}
function renderAll(){if(!ROOM)return;CFG=ROOM.config||CFG;$('#roomCode').textContent=ROOMCODE;$('#studentLink').textContent=studentUrl();$('#roomInfo').innerHTML=`학생에게 <b>${A.esc(studentUrl())}</b> 또는 아래 QR을 보여주세요. 링크와 QR에는 방 코드 <b>${ROOMCODE}</b>가 자동으로 들어갑니다. 학생은 조만 선택해 입장하면 됩니다.`;renderQr();renderTeams();renderMain();renderAuction();renderCategory('addonItems','#addonItems');renderCategory('drinkItems','#drinkItems');renderHistory();}
function renderTeams(){const teams=ROOM.teams||{};$('#teams').innerHTML=Object.entries(teams).map(([id,t])=>{const rem=A.remaining(t,CFG),joined=!!t.deviceUid;return `<div class="team ${joined?'ok':'warn'}"><strong>${id}조 · ${t.size}명</strong><div>${joined?'📱 접속 완료':'⏳ 미접속'}</div><div class="money">${A.money(rem)}</div><div class="muted">낙찰 ${A.activeAwards(t).length}개</div>${joined?`<button class="btn light release" data-team="${id}">대표폰 연결 해제</button>`:''}</div>`}).join('');$$('.release').forEach(b=>b.onclick=async()=>{if(confirm(`${b.dataset.team}조 대표폰 연결을 해제할까요?`))await A.update(A.roomPath(ROOMCODE,'teams',b.dataset.team),{deviceUid:null,joinedAt:null})})}
function targetTeams(){const st=ROOM.state||{},teams=ROOM.teams||{};if(st.mainSelectionMode==='reselect')return Object.keys(st.reselectTeams||{});return Object.keys(teams).filter(id=>!A.myMain(teams[id]))}
function renderMain(){const st=ROOM.state||{},targets=targetTeams(),sel=ROOM.mainSelections||{},done=targets.filter(id=>!!sel[id]).length;$('#mainProgress').innerHTML=st.mainSelectionOpen?`선택 완료 <b>${done}/${targets.length}조</b>`:`선택 닫힘 · 메인 확보 ${Object.values(ROOM.teams||{}).filter(t=>A.myMain(t)).length}/${CFG.teamCount}조`;$('#lockMain').disabled=!(st.mainSelectionOpen&&targets.length&&done===targets.length);$('#reopenMain').disabled=!Object.keys(st.reselectTeams||{}).length;const im=A.itemMap(CFG);const groups={};Object.entries(sel).forEach(([tid,item])=>{if(targets.includes(tid)&&item)(groups[item]??=[]).push(tid)});$('#mainItems').innerHTML=CFG.mainItems.map(it=>{const inv=ROOM.inventory?.[it.id]?.remaining||0,pend=ROOM.state?.pendingContests?.[it.id],n=(groups[it.id]||[]).length;return `<div class="item ${pend?'contested':''} ${inv<=0?'sold':''}"><b>${A.esc(it.name)}</b><div>${A.money(it.startPrice)} · 남은 ${inv}조분</div><div class="selectionCount">🔥 현재 선택 ${n}조</div>${pend?`<button class="btn warn contest" data-id="${it.id}">⚔️ 경쟁 준비</button>`:''}</div>`}).join('');$$('.contest').forEach(b=>b.onclick=()=>prepareContest(b.dataset.id));}
async function openMain(reselect=false){if(!ROOMCODE)return alert('먼저 수업방을 만드세요.');const teams=ROOM.teams||{},targets=(reselect?Object.keys(ROOM.state?.reselectTeams||{}):Object.keys(teams).filter(id=>!A.myMain(teams[id])));if(!targets.length)return alert('선택 대상 조가 없습니다.');const mt={};targets.forEach(id=>mt[id]=true);const up={mainSelectionOpen:true,mainSelectionMode:reselect?'reselect':'initial',mainSelectionTargets:mt,phase:'main-select'};await A.update(A.roomPath(ROOMCODE,'state'),up);for(const id of targets)await A.remove(A.roomPath(ROOMCODE,'mainSelections',id));speak(reselect?'낙찰 실패 조 재선택을 시작합니다.':'메인 재료 선택을 시작합니다.');}
async function addAward(teamId,item,category,price,note=''){const key=`${category}_${item.id}`;const p=A.roomPath(ROOMCODE,'teams',teamId,'awards',key);const existing=await A.read(p);if(existing&&existing.active!==false)return false;await A.set(p,{id:key,itemId:item.id,itemName:item.name,category,price:+price,active:true,at:firebase.database.ServerValue.TIMESTAMP,note});await A.push(A.roomPath(ROOMCODE,'history'),{at:firebase.database.ServerValue.TIMESTAMP,teamId,itemId:item.id,itemName:item.name,category,price:+price,note});return true;}
async function decInv(itemId,n){const cur=+ROOM.inventory?.[itemId]?.remaining||0;await A.set(A.roomPath(ROOMCODE,'inventory',itemId,'remaining'),Math.max(0,cur-n))}
async function lockMain(){
  if(lockMainBusy)return;
  lockMainBusy=true;
  try{
    const st=ROOM.state||{},targets=targetTeams(),sel=ROOM.mainSelections||{};
    if(targets.some(id=>!sel[id]))return alert('아직 선택하지 않은 조가 있습니다.');
    await A.update(A.roomPath(ROOMCODE,'state'),{mainSelectionOpen:false,phase:'main-locking'});
    const groups={};targets.forEach(id=>(groups[sel[id]]??=[]).push(id));
    const items=A.itemMap(CFG),pending={};
    for(const [itemId,ids] of Object.entries(groups)){
      const item=items[itemId],avail=+ROOM.inventory?.[itemId]?.remaining||0;
      if(ids.length<=avail){
        let added=0;
        for(const tid of ids)if(await addAward(tid,item,'main',item.startPrice,'단독/재고 내 자동낙찰'))added++;
        if(added)await decInv(itemId,added);
      }else pending[itemId]={teams:ids,units:Math.min(avail,ids.length)};
    }
    await A.update(A.roomPath(ROOMCODE,'state'),{mainSelectionOpen:false,pendingContests:pending,reselectTeams:{},phase:Object.keys(pending).length?'main-contest':'main-check'});
    if(!Object.keys(pending).length)await refreshMainReselect();
    beep(900);
  }finally{lockMainBusy=false;}
}
async function refreshMainReselect(){const fresh=await readAllTeams(),missing={};Object.entries(fresh).forEach(([id,t])=>{if(!A.myMain(t))missing[id]=true});await A.update(A.roomPath(ROOMCODE,'state'),{reselectTeams:missing,phase:Object.keys(missing).length?'main-reselect':'main-done'});if(!Object.keys(missing).length)speak('모든 조가 메인 재료를 확보했습니다.');}
async function prepareContest(itemId){if(ROOM.state?.currentAuction)return alert('현재 경매를 먼저 마무리하세요.');const p=ROOM.state?.pendingContests?.[itemId];if(!p)return;const item=A.itemMap(CFG)[itemId];const au={id:A.id('auc'),category:'main',itemId,itemName:item.name,startPrice:item.startPrice,minimumBid:item.startPrice,unitsAvailable:p.units,eligibleTeams:p.teams,stage:'prepared',duration:CFG.auctionSeconds,tieRound:0,provisionalWinners:{}};await A.set(A.roomPath(ROOMCODE,'state','currentAuction'),au);}
function qualifiedFor(cat,item){const teams=ROOM.teams||{};return Object.entries(teams).filter(([id,t])=>{const rem=A.remaining(t,CFG);if(rem<item.startPrice)return false;if(cat==='addon'&&A.awardsBy(t,'addon').length>=CFG.maxAddons)return false;if(cat==='drink'&&A.awardsBy(t,'drink').length>=1)return false;if(A.activeAwards(t).some(a=>a.itemId===item.id))return false;return true}).map(([id])=>id)}
async function openOffer(category,itemId){if(ROOM.state?.currentAuction||ROOM.state?.offer)return alert('현재 진행 중인 품목을 먼저 마무리하세요.');const item=A.itemMap(CFG)[itemId],avail=+ROOM.inventory?.[itemId]?.remaining||0;if(avail<=0)return;const id=A.id('off'),q=qualifiedFor(category,item);await A.set(A.roomPath(ROOMCODE,'state','offer'),{id,category,itemId,itemName:item.name,startPrice:item.startPrice,stockAvailable:avail,qualifiedTeams:q,open:true,locked:false});for(const tid of q)await A.remove(A.roomPath(ROOMCODE,'participation',id,tid));speak(item.name+' 참여 여부를 선택하세요.');}
async function finalizeOffer(force=false,displayResp=null){
  if(offerFinalizing)return;
  const o=ROOM.state?.offer;if(!o)return;
  offerFinalizing=true;
  const offerPath=A.roomPath(ROOMCODE,'state','offer');
  try{
    // 선생님이 보고 있던 응답 화면을 그대로 확정합니다. 클릭 뒤의 늦은 변경은 다음 단계에 섞이지 않습니다.
    await A.update(offerPath,{open:false,locked:true,lockedAt:firebase.database.ServerValue.TIMESTAMP});
    const q=(o.qualifiedTeams||[]).map(String);
    const resp=displayResp||await readChoices('participation',o.id,q);
    const missing=q.filter(t=>resp[t]===undefined||resp[t]===null);
    if(!force&&missing.length){
      await A.update(offerPath,{open:true,locked:false,lockedAt:null});
      alert('아직 응답하지 않은 조가 있습니다.');
      return;
    }
    const join=q.filter(t=>resp[t]===true),pass=q.filter(t=>resp[t]===false||missing.includes(t));
    await A.update(offerPath,{confirmedTeams:join,confirmedPassTeams:pass,confirmedAt:firebase.database.ServerValue.TIMESTAMP});
    const item=A.itemMap(CFG)[o.itemId];
    if(join.length===0){await A.set(offerPath,null);speak(item.name+' 참여 조가 없어 유찰되었습니다.');return}
    if(join.length<=o.stockAvailable){
      for(const tid of join)await addAward(tid,item,o.category,item.startPrice,'참여 수가 재고 이하여서 자동낙찰');
      await decInv(item.id,join.length);await A.set(offerPath,null);beep(1000);speak(item.name+' 자동 낙찰이 완료되었습니다.');return
    }
    const au={id:A.id('auc'),category:o.category,itemId:item.id,itemName:item.name,startPrice:item.startPrice,minimumBid:item.startPrice,unitsAvailable:o.stockAvailable,eligibleTeams:join.slice(),participantSnapshot:join.slice(),stage:'prepared',duration:CFG.auctionSeconds,tieRound:0,provisionalWinners:{},offerId:o.id};
    await A.update(A.roomPath(ROOMCODE,'state'),{offer:null,currentAuction:au});
  }finally{offerFinalizing=false}
}
async function startAuction(){const a=ROOM.state?.currentAuction;if(!a)return;await A.update(A.roomPath(ROOMCODE,'state','currentAuction'),{stage:'bidding',endsAt:Date.now()+1000*(a.duration||CFG.auctionSeconds),paused:false});beep(700);speak(a.tieRound?'동점 재입찰을 시작합니다.':'입찰을 시작합니다.');}
function validBids(a,bids){return (a.eligibleTeams||[]).map(t=>({teamId:String(t),amount:+(bids?.[t]?.amount||0)})).filter(x=>x.amount>=+a.minimumBid&&x.amount<=A.remaining(ROOM.teams?.[x.teamId],CFG)).sort((x,y)=>y.amount-x.amount)}
async function closeAuction(){
  if(auctionClosing)return;
  const a=ROOM.state?.currentAuction;
  if(!a||a.stage==='closing')return;
  auctionClosing=true;
  try{
    await A.update(A.roomPath(ROOMCODE,'state','currentAuction'),{stage:'closing'});
    const bids=await readChoices('bids',a.id,a.eligibleTeams||[]),arr=validBids(a,bids),slots=Math.max(0,+a.unitsAvailable||0),item=A.itemMap(CFG)[a.itemId];
    if(!slots){await finishAuction([],a);return}
    if(!arr.length){await finishAuction([],a);return}
    if(a.tieRound>=1){const top=arr.slice(0,slots),cut=top.length?top[top.length-1].amount:0,above=arr.filter(x=>x.amount>cut).slice(0,slots),ties=arr.filter(x=>x.amount===cut),need=slots-above.length;const winners=[...above,...A.randomPick(ties,need)];await finishAuction(winners,a,'동점 재입찰 후 추첨 포함');return}
    if(arr.length<=slots){await finishAuction(arr,a);return}
    const cut=arr[slots-1].amount,above=arr.filter(x=>x.amount>cut),ties=arr.filter(x=>x.amount===cut),need=slots-above.length;
    if(ties.length>need){
      let confirmed=0;
      for(const w of above)if(await addAward(w.teamId,item,a.category,w.amount,'동점 경계보다 높은 확정 낙찰'))confirmed++;
      if(confirmed)await decInv(item.id,confirmed);
      const tieAu={...a,id:A.id('auc'),eligibleTeams:ties.map(x=>x.teamId),unitsAvailable:need,minimumBid:cut+100,stage:'prepared',tieRound:1,provisionalWinners:{}};
      await A.set(A.roomPath(ROOMCODE,'state','currentAuction'),tieAu);
      speak('최고가 동점입니다. 동점 조만 재입찰합니다.');
      return
    }
    await finishAuction(arr.slice(0,slots),a)
  }finally{auctionClosing=false;}
}
async function finishAuction(winners,a,note='가격경쟁 낙찰'){const item=A.itemMap(CFG)[a.itemId];let added=0;for(const w of winners)if(await addAward(w.teamId,item,a.category,w.amount||a.startPrice,note))added++;if(added)await decInv(item.id,added);if(a.category==='main'){const pending={...(ROOM.state?.pendingContests||{})};delete pending[a.itemId];await A.update(A.roomPath(ROOMCODE,'state'),{currentAuction:null,pendingContests:pending});const fresh=await A.read(A.roomPath(ROOMCODE,'state','pendingContests'))||{};if(!Object.keys(fresh).length)await refreshMainReselect()}else await A.set(A.roomPath(ROOMCODE,'state','currentAuction'),null);beep(1050);speak(added?item.name+' 낙찰이 완료되었습니다.':item.name+' 경매가 유찰되었습니다.');}
function renderAuction(){const o=ROOM.state?.offer;if(o){const q=(o.qualifiedTeams||[]).map(String);if(o.locked){$('#auctionBox').innerHTML=`<div class="stage">${A.esc(o.itemName)} · 응답 확정 중</div><div class="notice">참여/패스 응답을 잠갔습니다. 경쟁 대상을 계산하고 있습니다.</div>`;return}readChoices('participation',o.id,q).then(resp=>{if(!ROOM.state?.offer||ROOM.state.offer.id!==o.id)return;const join=q.filter(t=>resp[t]===true),pass=q.filter(t=>resp[t]===false),r=q.filter(t=>resp[t]!==undefined&&resp[t]!==null).length;const joinText=join.length?` (${join.join(', ')}조)`:'';const passText=pass.length?` · 패스 ${pass.length}조 (${pass.join(', ')}조)`:'';$('#auctionBox').innerHTML=`<div class="stage">${A.esc(o.itemName)} · 참여/패스</div><div class="okbox">응답 ${r}/${q.length}조 · 참여 ${join.length}조${joinText}${passText} · 재고 ${o.stockAvailable}조분</div><button id="finalizeOffer" class="btn" ${r<q.length?'disabled':''}>응답 확정</button><button id="forceOffer" class="btn warn">미응답=패스로 진행</button>`;const snapshot={...resp};$('#finalizeOffer').onclick=()=>finalizeOffer(false,snapshot);$('#forceOffer').onclick=()=>finalizeOffer(true,snapshot)});return}const a=ROOM.state?.currentAuction;if(!a){$('#auctionBox').innerHTML='<div class="muted">아직 준비된 경매가 없습니다.</div>';return}if(a.stage==='closing'){if(timerHandle)clearInterval(timerHandle);$('#auctionBox').innerHTML=`<div class="stage">${A.esc(a.itemName)} · 낙찰 계산 중</div><div class="notice">잠시만 기다려 주세요. 중복 계산을 막기 위해 경매를 잠갔습니다.</div>`;return}if(timerHandle)clearInterval(timerHandle);const draw=async()=>{const live=ROOM.state?.currentAuction;if(!live||live.id!==a.id||live.stage==='closing')return;const bids=await readChoices('bids',a.id,a.eligibleTeams||[]),submitted=(a.eligibleTeams||[]).filter(t=>bids[t]?.amount).length;let remain=a.stage==='bidding'?Math.max(0,Math.ceil((a.endsAt-Date.now())/1000)):null;const targets=(a.eligibleTeams||[]).join(', ');$('#auctionBox').innerHTML=`<div class="stage">${A.esc(a.itemName)} · ${a.tieRound?'동점 재입찰':'비공개 입찰'} · 최소 ${A.money(a.minimumBid)}</div>${a.stage==='prepared'?`<div class="okbox">확정 참여 대상 ${targets}조 · 총 ${(a.eligibleTeams||[]).length}조 · 낙찰 가능 ${a.unitsAvailable}조</div><button id="startAuction" class="btn">▶ 입찰 시작 (${a.duration}초)</button>`:`<div class="timer">${remain}초</div><div class="notice">입찰 제출 ${submitted}/${(a.eligibleTeams||[]).length}조 · 대상 ${targets}조</div><button id="closeAuction" class="btn red">즉시 마감 · 낙찰 계산</button>`}`;$('#startAuction')?.addEventListener('click',startAuction);$('#closeAuction')?.addEventListener('click',closeAuction);if(a.stage==='bidding'&&remain<=0){if(timerHandle)clearInterval(timerHandle);closeAuction()}};draw();if(a.stage==='bidding')timerHandle=setInterval(draw,600)}
function renderCategory(cat,sel){const category=cat==='addonItems'?'addon':'drink';$(sel).innerHTML=CFG[cat].map(it=>{const rem=+ROOM.inventory?.[it.id]?.remaining||0;return `<div class="item ${rem<=0?'sold':''}"><b>${A.esc(it.name)}</b><div>${A.money(it.startPrice)} · 남은 ${rem}조분</div><button class="btn ${category==='drink'?'warn':''} offer" data-cat="${category}" data-id="${it.id}" ${rem<=0||ROOM.state?.currentAuction||ROOM.state?.offer?'disabled':''}>참여 확인 열기</button></div>`}).join('');$$(`${sel} .offer`).forEach(b=>b.onclick=()=>openOffer(b.dataset.cat,b.dataset.id))}
function renderHistory(){const h=Object.values(ROOM.history||{}).sort((a,b)=>(b.at||0)-(a.at||0)).slice(0,30);$('#history').innerHTML=h.length?h.map(x=>`<div class="notice"><b>${x.teamId}조</b> · ${A.esc(x.itemName)} · ${A.money(x.price)} <span class="muted">${A.esc(x.note||'')}</span></div>`).join(''):'<div class="muted">아직 낙찰 기록이 없습니다.</div>'}
async function openReflection(){await A.update(A.roomPath(ROOMCODE,'state'),{phase:'reflection',reflectionOpen:true,mainSelectionOpen:false,offer:null,currentAuction:null});speak('경매가 종료되었습니다. 경제활동 기록을 시작합니다.');}
async function closeRoom(){if(!ROOMCODE||!confirm('수업방을 종료할까요? 학생들은 자동으로 입장 화면으로 돌아갑니다.'))return;await A.update(A.roomPath(ROOMCODE,'meta'),{closed:true,closedAt:firebase.database.ServerValue.TIMESTAMP});clearSubs();localStorage.removeItem('sceo_v2_room');ROOMCODE='';ROOM=null;location.reload();}
async function init(){CFG=JSON.parse(localStorage.getItem('sceo_v2_cfg')||'null')||JSON.parse(JSON.stringify(A.DEF));fillSettings();if(!A.configReady()){setBadge(false,'Firebase 연결 전');$('#needSetup').classList.remove('hidden');return}try{const f=await A.firebaseInit();db=f.db;uid=f.uid;setBadge(true,'Firebase 연결됨');$('#app').classList.remove('hidden');const last=localStorage.getItem('sceo_v2_room');if(last){const m=await A.read(A.roomPath(last,'meta'));if(m?.teacherUid===uid&&!m.closed)subscribeRoom(last)} }catch(e){setBadge(false,'연결 실패');$('#needSetup').classList.remove('hidden');$('#needSetup .warnbox').textContent=e.message}}
$('#soundBtn').onclick=()=>{soundOn=!soundOn;$('#soundBtn').textContent=soundOn?'🔊 효과음 ON':'🔇 효과음 OFF'};$('#voiceBtn').onclick=()=>{voiceOn=!voiceOn;$('#voiceBtn').textContent=voiceOn?'🗣 음성 ON':'🤫 음성 OFF'};$('#newRoom').onclick=createRoom;$('#copyStudent').onclick=async()=>{if(!ROOMCODE)return alert('먼저 새 수업방을 만들어 주세요.');await navigator.clipboard.writeText(studentUrl());alert('학생용 링크를 복사했습니다. 방 코드 '+ROOMCODE+'가 링크에 자동 포함되어 있습니다.')};$('#showQr').onclick=openQrDialog;$('#qrClose').onclick=closeQrDialog;$('#qrCopy').onclick=async()=>{await navigator.clipboard.writeText(studentUrl());alert('학생용 링크를 복사했습니다.')};$('#qrPrint').onclick=()=>window.print();$('#qrDialog').addEventListener('click',e=>{if(e.target===$('#qrDialog'))closeQrDialog()});$('#closeRoom').onclick=closeRoom;$('#saveSettings').onclick=()=>{collectSettings();alert('설정을 저장했습니다. 새 수업방 만들기에 적용됩니다.')};$('#openMain').onclick=()=>openMain(false);$('#lockMain').onclick=lockMain;$('#reopenMain').onclick=()=>openMain(true);$('#openReflection').onclick=openReflection;init();
