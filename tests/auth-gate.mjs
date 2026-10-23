import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mockSharing} from './helpers/mock-sharing.mjs';
const base=process.env.TEST_URL||'http://127.0.0.1:5178/';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];
page.on('pageerror',error=>errors.push(error.message));
await mockSharing(page,{loggedIn:false,delayMs:200});
try{
  for(const route of ['','#/feed','#/profile','#/lists','#/restaurant/some-id']){
    await page.goto(base+route);await page.getByRole('group',{name:'选择身份'}).waitFor();
    assert.equal(await page.locator('.feed-post,.bottom-nav,.profile-main,.desktop-rail').count(),0);
    assert(!/我记录了|WXY 记录了/.test(await page.locator('body').innerText()));
  }
  await page.screenshot({path:'qa/login-mobile.png'});
  await page.setViewportSize({width:1440,height:900});await page.screenshot({path:'qa/login-desktop.png'});await page.setViewportSize({width:390,height:844});
  await page.getByRole('group',{name:'选择身份'}).getByRole('button',{name:'LHJ',exact:true}).click();
  await page.getByLabel('登录密码').fill('fixture-password');await page.getByRole('button',{name:'登录',exact:true}).click();
  await page.getByText('正在载入你的记录…',{exact:true}).waitFor();assert.equal(await page.locator('.feed-post,.bottom-nav').count(),0);
  await page.locator('.feed-header').waitFor();assert.equal(await page.locator('.feed-post').count(),0);
  assert.equal(new URL(page.url()).hash,'#/feed');
  await page.goto(base+'#/profile');await page.locator('.profile-main').waitFor();assert.equal(await page.locator('.profile-name').innerText(),'LHJ');
  await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.getByRole('group',{name:'选择身份'}).waitFor();assert.equal(await page.locator('.profile-main,.feed-post,.bottom-nav').count(),0);
  assert.deepEqual(errors,[]);
  const report={testedAt:new Date().toISOString(),base,passed:['all unauthenticated routes show login only','no guest personal feed or navigation','mobile and desktop login','identity hydration blocks stale personal content','LHJ arrives at own feed','logout returns to first-screen login'],errors};
  fs.writeFileSync('qa/auth-gate-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
