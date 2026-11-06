import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mockSharing} from './helpers/mock-sharing.mjs';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});await mockSharing(page);await page.goto('http://127.0.0.1:4179/beli-study/#/feed');await page.locator('.feed-date-filter').waitFor();
 const total=await page.locator('.feed-date-summary').innerText();
 await page.getByRole('button',{name:'自定义日期',exact:true}).click();await page.getByLabel('开始日期').fill('2026-05-31');await page.getByLabel('结束日期').fill('2026-05-01');await page.getByRole('button',{name:'应用',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await page.locator('.feed-date-summary').innerText(),total);
 await page.getByLabel('开始日期').fill('2099-01-01');await page.getByLabel('结束日期').fill('2099-01-31');await page.getByRole('button',{name:'应用',exact:true}).click();await page.getByText('这段时间没有用餐记录。试试其他日期，或清除筛选。').waitFor();assert.equal(await page.locator('.feed-post').count(),0);
 await page.getByRole('button',{name:'清除筛选',exact:true}).click();assert.equal(await page.locator('.feed-date-summary').innerText(),total);assert.equal(await page.locator('.feed-post').count(),24);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));console.log('PASS: mobile custom dates, invalid range preserves results, empty state, clear restores first page, no overflow');
}finally{await browser.close();}
