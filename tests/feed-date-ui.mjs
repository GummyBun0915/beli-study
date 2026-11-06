import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mockSharing} from './helpers/mock-sharing.mjs';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const edges=page=>page.evaluate(()=>{
 const left=selector=>document.querySelector(selector).getBoundingClientRect().left;
 return {title:left('.page-feed .section-head h2'),search:left('.search-field'),card:left('.featured-card'),avatar:left('.mini-avatar'),chip:left('.feed-date-filter .filter-chips button')};
});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});await mockSharing(page);await page.goto('http://127.0.0.1:4179/beli-study/#/feed');await page.locator('.feed-date-filter').waitFor();
 const initial=await edges(page);
 for(const [name,value] of Object.entries(initial))assert.ok(Math.abs(value-initial.title)<=1,`${name} left ${value} != title ${initial.title}`);
 const capsule=await page.getByRole('button',{name:'今年',exact:true}).evaluate(el=>{const style=getComputedStyle(el);return {radius:style.borderRadius,border:style.borderTopWidth,bg:style.backgroundColor,height:style.height};});
 assert.equal(capsule.radius,'17px');assert.equal(capsule.border,'1px');assert.equal(capsule.bg,'rgb(255, 255, 255)');assert.equal(capsule.height,'27px');
 const box=await page.locator('.featured-scroll').boundingBox();
 await page.mouse.move(box.x+120,box.y+40);await page.mouse.wheel(160,0);await page.waitForTimeout(450);
 assert.equal(new URL(page.url()).hash,'#/feed');
 const snapped=await page.evaluate(()=>{
  const title=document.querySelector('.page-feed .section-head h2').getBoundingClientRect().left;
  const cards=[...document.querySelectorAll('.featured-card')].map(el=>el.getBoundingClientRect().left);
  const nearest=cards.reduce((best,left)=>Math.abs(left-title)<Math.abs(best-title)?left:best,cards[0]);
  return {title,nearest,cards};
 });
 assert.ok(Math.abs(snapped.nearest-snapped.title)<=2,`snapped card ${snapped.nearest} != title ${snapped.title} (${snapped.cards.join(',')})`);
 const total=await page.locator('.feed-date-summary').innerText();
 await page.getByRole('button',{name:'自定义日期',exact:true}).click();await page.getByRole('dialog',{name:'自定义日期'}).waitFor();assert.equal(await page.locator('.feed-date-form').count(),0);
 await page.getByLabel('开始日期').fill('2026-05-31');await page.getByLabel('结束日期').fill('2026-05-01');await page.getByRole('button',{name:'应用',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await page.locator('.feed-date-summary').innerText(),total);
 await page.getByLabel('开始日期').fill('2099-01-01');await page.getByLabel('结束日期').fill('2099-01-31');await page.getByRole('button',{name:'应用',exact:true}).click();await page.getByText('这段时间没有用餐记录。试试其他日期，或清除筛选。').waitFor();assert.equal(await page.locator('.feed-post').count(),0);
 await page.getByRole('button',{name:'清除筛选',exact:true}).click();assert.equal(await page.locator('.feed-date-summary').innerText(),total);assert.equal(await page.locator('.feed-post').count(),24);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));console.log('PASS: mobile custom dates, invalid range preserves results, empty state, clear restores first page, no overflow');
}finally{await browser.close();}
