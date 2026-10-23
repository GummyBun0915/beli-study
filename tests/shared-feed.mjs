import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mockSharing} from './helpers/mock-sharing.mjs';
const base=process.env.TEST_URL||'http://127.0.0.1:5178/';
const data=JSON.parse(fs.readFileSync('src/data/restaurants.generated.json','utf8')).restaurants;
const restaurant=data.find(r=>r.brand.includes('寿司郎'));
const log=(sentiment,notes,date)=>({sentiment,notes,category:'Restaurants',tags:[],dishes:[],photoIds:[],visitedAt:date,branch:''});
const wx=log('liked','fixture WXY visit','2026-10-22'),lh=log('disliked','fixture LHJ visit','2026-10-23');
const snapshot=(baseline,entry)=>({version:2,baseline,statuses:{[restaurant.id]:'been'},logs:{[restaurant.id]:entry},order:[restaurant.id],visits:{[restaurant.id]:[{...entry,id:'same-id-in-each-account',recordedAt:`${entry.visitedAt}T12:00:00Z`}]},history:[]});
const wxState=snapshot('source',wx),lhState=snapshot('empty',lh);
const marked=data.find(r=>r.id!==restaurant.id&&r.reviewText&&r.images.length);lhState.statuses[marked.id]='been';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const errors=[];
try{
  for(const identity of ['WXY','LHJ']){
    const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));
    const fixture=await mockSharing(page,{initialIdentity:identity,snapshots:{WXY:wxState,LHJ:lhState}});
    await page.goto(base);await page.locator('.feed-post[data-kind="visit"]').first().waitFor();
    const before=await page.evaluate(()=>localStorage.getItem('beli-dachitech:food-state:v2'));
    const visits=page.locator('.feed-post[data-kind="visit"]');assert.equal(await visits.count(),2);
    assert.deepEqual(await visits.evaluateAll(rows=>rows.map(row=>row.getAttribute('data-author'))),['LHJ','WXY']);
    assert((await visits.filter({has:page.getByText('fixture WXY visit',{exact:false})}).innerText()).includes('WXY 当前评分 8.4'));
    assert((await visits.filter({has:page.getByText('fixture LHJ visit',{exact:false})}).innerText()).includes('LHJ 当前评分 1.7'));
    assert.equal(await page.locator('.feed-post[data-kind="history"][data-author="LHJ"]').count(),0);
    assert(await page.locator('.feed-post[data-kind="history"][data-author="WXY"]').count()>0);
    const more=page.getByRole('button',{name:'查看更多记录',exact:true});while(await more.count())await more.click();
    const mark=page.locator(`.feed-post[data-kind="status"][data-author="LHJ"][data-restaurant="${marked.id}"]`);assert((await mark.innerText()).includes('标记去过'));assert.equal(await mark.locator('.post-review,img').count(),0);
    const ownScore=identity==='WXY'?'8.4':'1.7';
    await page.goto(base+'#/rank');await page.locator('.rank-item').waitFor();assert.equal(await page.locator('.rank-item').count(),1);assert((await page.locator('.rank-item').innerText()).includes(ownScore));
    await page.goto(base+'#/feed');await visits.first().waitFor();
    const partner=identity==='WXY'?'LHJ':'WXY';
    const next=structuredClone(partner==='WXY'?wxState:lhState);next.visits[restaurant.id][0].notes=`updated ${partner} visit`;
    await fixture.publishSnapshot(partner,next);
    await page.locator('.feed-post[data-kind="visit"]').filter({hasText:`updated ${partner} visit`}).waitFor({timeout:5000});
    assert((await page.evaluate(()=>localStorage.getItem('beli-dachitech:food-state:v2')))===before,'Reading partner feed must not mutate personal records');
    if(identity==='LHJ'){await page.locator('#your-feed').scrollIntoViewIfNeeded();await page.screenshot({path:'qa/sharing-shared-feed-fixture.png'});}
    await page.close();
  }
  assert.deepEqual(errors,[]);
  const report={testedAt:new Date().toISOString(),base,fixture:true,passed:['both authors visible from either account','visits sorted by visit date','same restaurant and visit ID from different authors remain separate','each score derived from its author only','personal leaderboard unchanged','source history attributed only to owner','Been-only records retain author without copying another person notes or photos','partner realtime update appears without reload','reading shared feed does not mutate personal snapshot'],errors};
  fs.writeFileSync('qa/shared-feed-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
