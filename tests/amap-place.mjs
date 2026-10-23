import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mockSharing} from './helpers/mock-sharing.mjs';
// AMap is stubbed: localhost is outside the key's domain whitelist, and the test must not depend on live POI data.
const base=process.env.TEST_URL||'http://127.0.0.1:4178/beli-study/';
const poi={id:'B0FIXTURE01',name:'测试夹具餐厅',type:'餐饮服务;中餐厅;湖南菜(湘菜)',address:'测试路 1 号',cityname:'深圳市',adname:'宝安区',location:{lng:113.88,lat:22.57}};
const stub=`window.AMap={Map:function(el,o){window.__amapMap=o;var ms=[];this.add=function(m){ms.push(m);window.__amapMarkers=ms};this.remove=function(m){ms=ms.filter(function(x){return x!==m});window.__amapMarkers=ms};this.setBounds=function(){};this.setZoomAndCenter=function(){};this.getZoom=function(){return 12};this.setZoom=function(){};this.getBounds=function(){return{contains:function(){return true}}};this.panTo=function(){};this.destroy=function(){}},Marker:function(o){this.o=o;o.content.dataset.lng=o.position[0];o.content.dataset.lat=o.position[1];document.body.appendChild(o.content)},Pixel:function(x,y){this.x=x;this.y=y},Bounds:function(){},PlaceSearch:function(opts){this.search=function(keyword,cb){window.__amapCalls=(window.__amapCalls||[]).concat([{keyword:keyword,opts:opts}]);setTimeout(function(){cb('complete',{info:'OK',poiList:{pois:[${JSON.stringify(poi)}]}})},50)}}};`;
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
  let sdkAttempts=0;
  await a.route('https://webapi.amap.com/**',route=>route.fulfill({contentType:'application/javascript',body:++sdkAttempts===1?'/* SDK failed to initialise */':stub}));
  await a.goto(base+'#/search');await a.getByPlaceholder('店名、菜系、菜品、地区').fill('测试夹具');
  await a.getByText('没找到？在高德搜索',{exact:false}).click();
  await a.getByText('高德搜索组件未载入，请重试',{exact:false}).waitFor();
  await a.getByRole('button',{name:'重试',exact:true}).click();
  await a.locator('.place-row').filter({hasText:poi.name}).waitFor();
  assert.equal(sdkAttempts,2,'failed SDK load must be retryable');
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
  // Overseas: OpenStreetMap (Photon) search, region from country code, WGS-84 kept as-is.
  const c=await open('WXY',{LHJ:empty('empty')});
  await c.route('https://photon.komoot.io/**',route=>{const url=new URL(route.request().url());c.__photon=url;route.fulfill({json:{features:[{geometry:{coordinates:[126.97,37.56]},properties:{osm_type:'N',osm_id:1,name:'一蘭 首尔',osm_value:'restaurant',city:'Seoul',countrycode:'KR'}},{geometry:{coordinates:[139.7009878,35.6611293]},properties:{osm_type:'N',osm_id:3047251663,name:'一蘭 渋谷店',osm_value:'restaurant',city:'渋谷区',street:'神南',housenumber:'1-22-7',countrycode:'JP'}}]}});});
  await c.goto(base+'#/search');await c.getByPlaceholder('店名、菜系、菜品、地区').fill('ichiran');
  await c.locator('.city-scroll button',{hasText:'日本'}).click();
  await c.getByText('没找到？在OpenStreetMap搜索',{exact:false}).click();
  await c.locator('.place-row').filter({hasText:'一蘭 渋谷店'}).waitFor();
  assert.equal(c.__photon.searchParams.get('q'),'ichiran');assert(c.__photon.searchParams.getAll('osm_tag').includes('amenity:restaurant'));assert.equal(c.__photon.searchParams.get('limit'),'30','country filter widens the request');
  await c.getByText('OpenStreetMap 贡献者',{exact:false}).waitFor();assert.equal(await c.locator('.place-row').filter({hasText:'一蘭 首尔'}).count(),0,'other countries filtered out');
  await c.getByRole('button',{name:'添加这家',exact:false}).click();await c.getByRole('heading',{name:'一蘭 渋谷店',exact:true}).waitFor();
  state=await c.evaluate(k=>JSON.parse(localStorage.getItem(k)),stateKey);
  assert.deepEqual([state.places['osm:N3047251663'].source,state.places['osm:N3047251663'].country,state.places['osm:N3047251663'].lng],['osm','JP',139.7009878]);
  assert.equal(await c.locator('.detail-title-row .eyebrow').innerText(),'日本');assert((await c.locator('.detail-title-row').innerText()).includes('餐厅'));
  // Manual entry when nothing is found anywhere.
  await c.goto(base+'#/search');await c.getByPlaceholder('店名、菜系、菜品、地区').fill('路边摊');
  await c.getByRole('button',{name:'都搜不到？手动添加',exact:true}).click();
  await c.getByLabel('国家 / 地区',{exact:true}).selectOption('TH');await c.getByLabel('城市',{exact:false}).fill('曼谷');await c.getByLabel('地址',{exact:false}).fill('Soi 38');
  await c.getByRole('button',{name:'添加',exact:true}).click();await c.getByRole('heading',{name:'路边摊',exact:true}).waitFor();
  state=await c.evaluate(k=>JSON.parse(localStorage.getItem(k)),stateKey);
  const manual=Object.values(state.places).find(place=>place.source==='manual');assert.equal(manual.name,'路边摊');assert.equal(manual.city,'曼谷');assert.equal(manual.lng,null);assert.equal(manual.country,'TH');assert.equal(await c.locator('.detail-title-row .eyebrow').innerText(),'泰国');
  await c.goto(base+'#/search');await c.getByPlaceholder('店名、菜系、菜品、地区').fill('路边摊');await c.locator('.city-scroll button',{hasText:'泰国'}).click();await c.locator('.search-row').filter({hasText:'路边摊'}).waitFor();
  await c.close();

  // Mainland-only map views use the AMap basemap with raw GCJ-02 coordinates (forced on localhost via ?map=amap).
  const d=await open('WXY',{LHJ:empty('empty')});
  const shenzhen=JSON.parse(fs.readFileSync('src/data/restaurants.generated.json','utf8')).restaurants.find(r=>r.regionSlug==='shenzhen'&&r.lng!==null);
  await d.goto(base+'?map=amap#/lists');
  await d.getByRole('button',{name:'Map',exact:true}).click();
  await d.locator('.beli-map[data-basemap="amap"]').waitFor();await d.waitForFunction(()=>(window.__amapMarkers||[]).length>0);
  const pin=d.locator(`.beli-map-pin[title="${shenzhen.brand}${shenzhen.branch?` · ${shenzhen.branch}`:''}"]`).first();
  assert.equal(Number(await pin.getAttribute('data-lng')),shenzhen.lng);assert.equal(Number(await pin.getAttribute('data-lat')),shenzhen.lat);
  assert(await d.evaluate(()=>Array.isArray(window.__amapMap.center)),'AMap needs an explicit center');
  await d.goto(base+'#/lists');await d.getByRole('button',{name:'Map',exact:true}).click();await d.locator('.beli-map[data-basemap="osm"]').waitFor();
  await d.close();
  assert.deepEqual(errors,[]);
  const report={testedAt:new Date().toISOString(),base,fixture:true,passed:['AMap search runs only on demand, restaurant category, nationwide when no city','added place opens its detail page with no status','place and status persist in own snapshot across reload','added place appears in local search and is marked as added','partner sees place in shared feed without it being copied','acting on partner place copies the place but not the ranking','overseas OpenStreetMap search filtered to the region country, credited, mapped to JP region','manual add without coordinates, explicit country retained and region filter finds it','AMap SDK initialization failure recovers on retry','AMap basemap with GCJ-02 pins and explicit center; localhost defaults to OSM'],errors};
  fs.writeFileSync('qa/amap-place-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
