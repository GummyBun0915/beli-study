import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import {mockSharing} from './helpers/mock-sharing.mjs';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const base='http://127.0.0.1:4179/beli-study/';
try{
 const p=await browser.newPage();await mockSharing(p);await p.goto(base+'#/lists');await p.locator('.restaurant-row').first().waitFor();
 assert.equal(await p.locator('.restaurant-row').count(),75);
 await p.locator('.restaurant-row .row-actions button').first().click();assert.equal(await p.locator('.restaurant-row').count(),75);
 await p.goto(base+'#/rank');await p.locator('.rank-item').first().waitFor();assert.equal(await p.locator('.rank-item').count(),21);
 await p.locator('.rank-item').first().click();await p.getByRole('button',{name:'记录用餐',exact:true}).click();await p.getByText('编辑历史用餐',{exact:false}).waitFor();
 await p.getByLabel('评分（十分制）').fill('9.1');await p.getByPlaceholder('想记住什么？').fill('isolated fixture edit');await p.getByRole('button',{name:'保存历史修改'}).click();await p.getByRole('button',{name:'Done',exact:true}).click();assert.equal(await p.locator('.detail-score').innerText(),'9.1');
 const s=await p.evaluate(()=>JSON.parse(localStorage.getItem('beli-dachitech:food-state:v2')));assert.equal(Object.values(s.visits).flat().length,0,'editing source history must not create new visits');await p.evaluate(()=>Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:cb=>cb({coords:{longitude:114.05,latitude:22.55}})}}));await p.goto(base+'#/search');await p.getByRole('button',{name:'使用当前位置'}).click();await p.getByText('按当前位置搜索',{exact:true}).waitFor();await p.close();
 const l=await browser.newPage();await mockSharing(l,{initialIdentity:'LHJ',snapshots:{LHJ:{version:2,baseline:'source',statuses:{},logs:{},order:[],visits:{},history:[],places:{}}}});await l.goto(base+'#/lists');await l.locator('.empty-state').waitFor();assert.equal(await l.locator('.restaurant-row').count(),0);await l.close();
 console.log('PASS: 75 source Been, idempotent Been, 21 exact-ID historical scores, edit without new visit, LHJ source baseline blocked');
}finally{await browser.close();}
