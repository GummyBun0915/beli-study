// Read-only production acceptance: no sample visits, ratings, or wishlist writes.
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
if(!process.env.CLOUD_TEST_PASSWORD)throw new Error('CLOUD_TEST_PASSWORD is required');
const base=process.env.TEST_URL||'http://127.0.0.1:5178/';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const errors=[],sessions=[];
try{
  for(const identity of ['WXY','LHJ']){
    const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);await page.getByRole('group',{name:'选择身份'}).getByRole('button',{name:identity,exact:true}).click();
    await page.getByLabel('登录密码').fill(process.env.CLOUD_TEST_PASSWORD);await page.getByRole('button',{name:'登录',exact:true}).click();
    await page.locator('.feed-header').waitFor();await page.goto(base+'#/profile');await page.locator('.profile-main').waitFor();
    const snapshot=await page.evaluate(()=>localStorage.getItem('beli-dachitech:food-state:v2'));
    const counts=await page.locator('.profile-metrics strong').allTextContents();
    const name=(await page.locator('.profile-name').innerText()).trim();sessions.push({page,snapshot,counts,name,identity});
  }
  const contributors=sessions.filter(session=>{const state=JSON.parse(session.snapshot);return state.baseline==='source'||Object.values(state.visits).some(visits=>visits.length)||Object.values(state.statuses).includes('been');}).map(session=>session.name);
  for(const {page,snapshot,counts,identity} of sessions){
    await page.goto(base+'#/rank');await page.locator('.page-rank').waitFor();const ranksBefore=await page.locator('.rank-item').allTextContents();
    await page.goto(base+'#/feed');await page.getByRole('heading',{name:'OUR FEED',exact:true}).waitFor();
    const more=page.getByRole('button',{name:'查看更多记录',exact:true});while(await more.count())await more.click();
    const authors=await page.locator('.feed-post').evaluateAll(rows=>[...new Set(rows.map(row=>row.getAttribute('data-author')))]);
    for(const contributor of contributors)assert(authors.includes(contributor),'A member with existing history is missing from the shared feed');
    assert(authors.every(author=>sessions.some(session=>session.name===author)),'Unexpected author');
    await page.locator('#your-feed').scrollIntoViewIfNeeded();await page.screenshot({path:`qa/sharing-feed-${identity}.png`});
    await page.goto(base+'#/rank');await page.locator('.page-rank').waitFor();assert(JSON.stringify(await page.locator('.rank-item').allTextContents())===JSON.stringify(ranksBefore),'Viewing shared feed changed a personal leaderboard');
    await page.goto(base+'#/profile');await page.locator('.profile-main').waitFor();assert(JSON.stringify(await page.locator('.profile-metrics strong').allTextContents())===JSON.stringify(counts),'Personal counts changed');
    assert((await page.evaluate(()=>localStorage.getItem('beli-dachitech:food-state:v2')))===snapshot,'Personal snapshot changed');
  }
  assert.deepEqual(errors,[]);
  const report={testedAt:new Date().toISOString(),base,fixture:false,passed:['real WXY and LHJ login','both viewers can read all members who have actual dining history','authors labelled correctly','shared feed leaves each personal snapshot/counts/leaderboard unchanged','no fabricated production records or writes'],errors};
  fs.writeFileSync('qa/shared-feed-live-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
