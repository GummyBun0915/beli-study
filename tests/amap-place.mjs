import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mockSharing} from './helpers/mock-sharing.mjs';
// AMap is stubbed: localhost is outside the key's domain whitelist, and the test must not depend on live POI data.
const base=process.env.TEST_URL||'http://127.0.0.1:4178/beli-study/';
const poi={id:'B0FIXTURE01',name:'测试夹具餐厅',type:'餐饮服务;中餐厅;湖南菜(湘菜)',address:'测试路 1 号',cityname:'深圳市',adname:'宝安区',location:{lng:113.88,lat:22.57}};
const stub=`window.AMap={PlaceSearch:function(opts){this.search=function(keyword,cb){window.__amapCalls=(window.__amapCalls||[]).concat([{keyword:keyword,opts:opts}]);setTimeout(function(){cb('complete',{info:'OK',poiList:{pois:[${JSON.stringify(poi)}]}})},50)}}};`;
const placeId=`amap:${poi.id}`;
const stateKey='beli-dachitech:food-state:v2';
const empty=baseline=>({version:2,baseline,statuses:{},logs:{},order:[],visits:{},history:[],places:{}});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const errors=[];
const open=async(identity,snapshots)=>{
  const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://webapi.amap.com/**',route=>route.fulfill({contentType:'application/javascript',body:stub}));
  await mockSharing(page,{initialIdentity:identity,snapshots,preferLocalSnapshot:true});
  return page;
};
try{
  // WXY finds a restaurant that is not in the catalogue and adds it.
  const a=await open('WXY',{LHJ:empty('empty')});
  await a.goto(base+'#/search');await a.getByPlaceholder('店名、菜系、菜品、地区').fill('测试夹具');
  await a.getByText('没找到？在高德搜索',{exact:false}).click();
  await a.locator('.amap-row').filter({hasText:poi.name}).waitFor();
  const call=(await a.evaluate(()=>window.__amapCalls))[0];assert.equal(call.keyword,'测试夹具');assert.equal(call.opts.type,'餐饮服务');assert.equal(call.opts.citylimit,false);
  await a.getByRole('button',{name:'添加这家',exact:false}).click();
  await a.getByRole('heading',{name:poi.name,exact:true}).waitFor();
  assert(decodeURIComponent(new URL(a.url()).hash).endsWith(placeId));
  assert.equal(await a.locator('.detail-actions button.active').count(),0,'a new place starts with no status');
  await a.getByRole('button',{name:'想去',exact:false}).first().click();
  let state=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)),stateKey);
  assert.equal(state.places[placeId].name,poi.name);assert.equal(state.places[placeId].city,'深圳市');assert.equal(state.statuses[placeId],'want');
  await a.reload();await a.getByRole('heading',{name:poi.name,exact:true}).waitFor();
  await a.goto(base+'#/search');await a.getByPlaceholder('店名、菜系、菜品、地区').fill('测试夹具');
  await a.locator('.search-row').filter({hasText:poi.name}).waitFor();
  await a.getByText('没找到？在高德搜索',{exact:false}).click();await a.getByRole('button',{name:'已添加 · 查看',exact:false}).waitFor();
  const wxySnapshot=await a.evaluate(k=>JSON.parse(localStorage.getItem(k)),stateKey);
  await a.screenshot({path:'qa/amap-search-mobile.png'});await a.close();

  // LHJ sees WXY's place through the shared snapshot and only gets a copy once she acts on it.
  wxySnapshot.statuses[placeId]='been';wxySnapshot.logs[placeId]={sentiment:'liked',category:'Restaurants',notes:'fixture place visit',tags:[],dishes:[],photoIds:[],visitedAt:'2026-10-23',branch:''};
  wxySnapshot.order=[placeId,...wxySnapshot.order.filter(id=>id!==placeId)];wxySnapshot.visits[placeId]=[{...wxySnapshot.logs[placeId],id:'fixture-visit',recordedAt:'2026-10-23T12:00:00Z'}];
  const b=await open('LHJ',{WXY:wxySnapshot,LHJ:empty('empty')});
  await b.goto(base);await b.locator(`.feed-post[data-restaurant="${placeId}"][data-author="WXY"]`).waitFor();
  assert.equal(await b.evaluate(k=>JSON.parse(localStorage.getItem(k)||'{}').places?.['amap:B0FIXTURE01']??null,stateKey),null);
  await b.locator(`.feed-post[data-restaurant="${placeId}"] .post-head`).click();await b.getByRole('heading',{name:poi.name,exact:true}).waitFor();
  await b.getByRole('button',{name:'想去',exact:false}).first().click();
  state=await b.evaluate(k=>JSON.parse(localStorage.getItem(k)),stateKey);
  assert.equal(state.places[placeId].name,poi.name);assert.equal(state.statuses[placeId],'want');assert.equal(state.logs[placeId],undefined,'LHJ must not inherit WXY ranking');
  await b.close();
  assert.deepEqual(errors,[]);
  const report={testedAt:new Date().toISOString(),base,fixture:true,passed:['AMap search runs only on demand, restaurant category, nationwide when no city','added place opens its detail page with no status','place and status persist in own snapshot across reload','added place appears in local search and is marked as added','partner sees place in shared feed without it being copied','acting on partner place copies the place but not the ranking'],errors};
  fs.writeFileSync('qa/amap-place-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
