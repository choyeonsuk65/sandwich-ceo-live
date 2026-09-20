window.SCEO = (()=>{
  const DEF={
    title:'샌드위치 경매 CEO · 온라인 실시간 통합형',studentCount:15,teamCount:5,teamBudget:30000,auctionSeconds:15,maxAddons:2,
    commonIngredients:['식빵','양상추/샐러드채소','마요네즈','케첩','허니머스타드','생수'],
    mainItems:[
      {id:'ham',name:'슬라이스 햄',startPrice:5000,stock:1},{id:'chicken',name:'조리 닭가슴살',startPrice:5500,stock:1},
      {id:'tuna',name:'참치',startPrice:5000,stock:1},{id:'egg',name:'삶은 달걀',startPrice:3500,stock:1},
      {id:'crab',name:'크래미',startPrice:4500,stock:1},{id:'potato',name:'감자샐러드',startPrice:4000,stock:1}],
    addonItems:[
      {id:'cheese',name:'슬라이스 치즈',startPrice:2000,stock:2},{id:'tomato',name:'토마토',startPrice:1500,stock:2},
      {id:'pickle',name:'오이피클',startPrice:1200,stock:2},{id:'creamcheese',name:'크림치즈',startPrice:2500,stock:1},
      {id:'pineapple',name:'파인애플 슬라이스',startPrice:2000,stock:1}],
    drinkItems:[{id:'cola',name:'콜라 업그레이드',startPrice:1000,stock:2}],
    concepts:['희소성','예산제약','선택','기회비용','가격경쟁','가격형성','합리적 소비','저축','기부·나눔'],
    stickerCategories:['먹어보고 싶어요','재료 조합이 창의적이에요','경제적 선택이 인상적이에요'],
    padletUrl:'https://padlet.com/ksgi9790/live-100-s023ly7ch6vxfksxrxv0'
  };
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money=n=>(Number(n)||0).toLocaleString('ko-KR')+'원';
  const now=()=>Date.now();
  const id=(p='id')=>p+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);
  const teamSizes=(students,teams)=>{const b=Math.floor(students/teams),r=students%teams;return Array.from({length:teams},(_,i)=>b+(i<r?1:0));};
  const objKeys=o=>Object.keys(o||{});
  const asArray=o=>Array.isArray(o)?o:Object.values(o||{});
  const activeAwards=t=>Object.values(t?.awards||{}).filter(a=>a&&a.active!==false);
  const spent=(t)=>activeAwards(t).reduce((s,a)=>s+Number(a.price||0),0);
  const remaining=(t,cfg)=>Math.max(0,Number(cfg?.teamBudget||0)-spent(t));
  const awardsBy=(t,cat)=>activeAwards(t).filter(a=>a.category===cat);
  const myMain=t=>awardsBy(t,'main')[0]||null;
  const roomPath=(room,...parts)=>['rooms',room,...parts].join('/');
  function configReady(){const c=window.SANDWICH_FIREBASE_CONFIG;return !!(c&&c.apiKey&&c.databaseURL&&c.projectId);}
  async function firebaseInit(){
    if(!configReady()) throw new Error('Firebase 설정이 아직 없습니다. firebase-setup.html에서 설정 파일을 먼저 만들어 주세요.');
    if(!firebase.apps.length) firebase.initializeApp(window.SANDWICH_FIREBASE_CONFIG);
    if(!firebase.auth().currentUser) await firebase.auth().signInAnonymously();
    return {db:firebase.database(),auth:firebase.auth(),uid:firebase.auth().currentUser.uid};
  }
  async function read(path){const s=await firebase.database().ref(path).once('value');return s.val();}
  function listen(path,cb){const r=firebase.database().ref(path);r.on('value',s=>cb(s.val()));return ()=>r.off();}
  const set=(path,v)=>firebase.database().ref(path).set(v);
  const update=(path,v)=>firebase.database().ref(path).update(v);
  const remove=(path)=>firebase.database().ref(path).remove();
  const push=(path,v)=>firebase.database().ref(path).push(v);
  function randRoom(){return String(Math.floor(100000+Math.random()*900000));}
  function randomPick(arr,n){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a.slice(0,n);}
  function itemMap(cfg){const m={};['mainItems','addonItems','drinkItems'].forEach(cat=>(cfg?.[cat]||[]).forEach(x=>m[x.id]={...x,category:cat==='mainItems'?'main':cat==='addonItems'?'addon':'drink'}));return m;}
  return {DEF,$,$$,esc,money,now,id,teamSizes,objKeys,asArray,activeAwards,spent,remaining,awardsBy,myMain,roomPath,configReady,firebaseInit,read,listen,set,update,remove,push,randRoom,randomPick,itemMap};
})();
