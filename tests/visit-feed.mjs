import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mockSharing} from './helpers/mock-sharing.mjs';

const base = process.env.TEST_URL || 'http://127.0.0.1:5189/';
const placeId = 'manual:testplace1';
const oldId = 'manual:oldphoto01';
const oldPhoto = '00000000-0000-4000-8000-000000000301';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF2sAAAAASUVORK5CYII=', 'base64');
const place = (id, name) => ({id, source:'manual', poiId:'', name, address:'', city:'深圳', district:'', type:'', country:'CN', lng:null, lat:null, addedAt:'2026-11-01T00:00:00.000Z', regionSlug:'shenzhen'});
const snapshot = {
  version:2, baseline:'source', sourceHistoryApplied:true,
  statuses:{[placeId]:'want', [oldId]:'been'},
  logs:{[oldId]:{sentiment:'liked', category:'Restaurants', notes:'旧记录', tags:[], dishes:[], visitedAt:'', photoIds:[oldPhoto], score:9.2}},
  order:[oldId], visits:{}, history:[],
  places:{[placeId]:place(placeId,'测试小馆'), [oldId]:place(oldId,'旧照片小馆')},
};
const catalog = JSON.parse(fs.readFileSync('src/data/restaurants.generated.json','utf8')).restaurants;
const listed = catalog.find(restaurant => restaurant.brand.includes('寿司郎'));
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page = await browser.newPage({viewport:{width:390, height:844}});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await mockSharing(page, {preferLocalSnapshot:true});
  await page.addInitScript(value => { if (!localStorage.getItem('beli-dachitech:food-state:v2')) localStorage.setItem('beli-dachitech:food-state:v2', JSON.stringify(value)); }, snapshot);
  await page.route('**/storage/v1/**', async route => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET') return route.fulfill({status:200, json:{Key:url.pathname}});
    if (url.pathname.endsWith(oldPhoto)) return route.fulfill({contentType:'image/png', body:png});
    return route.fulfill({status:404, json:{message:'missing'}});
  });
  await page.goto(`${base}#/restaurant/${placeId}`);
  await page.getByRole('button', {name:'去过', exact:true}).click();
  await page.getByRole('button', {name:'记录用餐', exact:true}).click();
  await page.getByRole('button', {name:'I liked it!', exact:true}).click();
  await page.getByRole('heading', {name:'记录这次用餐'}).waitFor();
  assert.equal(await page.getByRole('heading', {name:'编辑历史用餐'}).count(), 0);
  await page.getByLabel('添加用餐照片').setInputFiles({name:'meal.png', mimeType:'image/png', buffer:png});
  await page.locator('.logging-photos img').waitFor();
  await page.getByLabel('评分（十分制）').fill('8.8');
  await page.locator('.save-visit-only').evaluate(button => { button.click(); button.click(); });
  await page.getByRole('button', {name:'Done', exact:true}).click();
  await page.locator('.visit-timeline article').waitFor();
  const saved = async () => page.evaluate(() => JSON.parse(localStorage.getItem('beli-dachitech:food-state:v2')));
  let state = await saved();
  assert.equal(state.visits[placeId].length, 1, 'one save, including a double click, creates one visit');
  assert.equal(state.visits[placeId][0].photoIds.length, 1);
  assert.equal(state.logs[placeId].score, 8.8);
  await page.goto(`${base}#/feed`);
  const visit = page.locator(`.feed-post[data-kind="visit"][data-restaurant="${placeId}"]`);
  await visit.scrollIntoViewIfNeeded();
  await visit.locator('img').waitFor();
  await page.reload();
  await page.locator('.feed-date-filter').waitFor();
  state = await saved();
  assert.equal(state.visits[placeId].length, 1, 'the visit survives reload');
  await visit.scrollIntoViewIfNeeded();
  await visit.locator('img').waitFor();
  await page.getByRole('button', {name:'今年', exact:true}).click();
  assert.equal(await page.locator(`.feed-post[data-restaurant="${placeId}"]`).count(), 0, 'an undated visit stays out of a dated range');
  await page.getByRole('button', {name:'全部时间', exact:true}).click();
  await visit.waitFor();
  await page.goto(`${base}#/rank`);
  await page.getByRole('heading', {name:'大吃特吃', exact:true}).waitFor();
  assert.equal(await page.getByText('根据你的感受和餐厅偏好比较，形成个人排序。').count(), 0);
  const ranked = page.locator('.rank-item', {hasText:'测试小馆'});
  await ranked.scrollIntoViewIfNeeded();
  await ranked.locator('img').waitFor();
  assert.equal(await ranked.getByText('暂无照片').count(), 0);
  const historical = page.locator('.rank-item', {hasText:'旧照片小馆'});
  await historical.scrollIntoViewIfNeeded();
  await historical.locator('img').waitFor();
  state = await saved();
  assert.equal(state.visits[oldId], undefined, 'showing a previously saved photo does not invent a visit');
  await page.goto(`${base}#/feed`);
  await page.locator(`.feed-post[data-kind="status"][data-restaurant="${oldId}"]`).scrollIntoViewIfNeeded();
  await page.goto(`${base}#/search`);
  await page.getByRole('searchbox').fill(listed.brand);
  await page.locator('.search-row', {hasText:listed.brand}).getByRole('button', {name:'打分', exact:true}).click();
  await page.getByRole('button', {name:'I liked it!', exact:true}).click();
  await page.getByRole('button', {name:'仅保存这次用餐，保留现有排名', exact:true}).click();
  await page.getByRole('button', {name:'Done', exact:true}).click();
  state = await saved();
  assert.equal(state.visits[listed.id].length, 1);
  await page.goto(`${base}#/feed`);
  await page.locator(`.feed-post[data-kind="visit"][data-restaurant="${listed.id}"]`).waitFor();
  await page.goto(`${base}#/lists`);
  assert.equal(await page.getByRole('tab', {name:'Recs'}).count(), 0);
  assert.equal(await page.getByRole('tab', {name:'Guides'}).count(), 0);
  await page.getByRole('button', {name:'更多筛选'}).click();
  assert.equal(await page.getByRole('button', {name:'Recs', exact:true}).count(), 0);
  assert.equal(await page.getByRole('button', {name:'Guides', exact:true}).count(), 0);
  await page.keyboard.press('Escape');
  await page.goto(`${base}#/profile`);
  assert.equal(await page.getByRole('button', {name:'为你推荐'}).count(), 0);
  assert.equal(await page.locator('.search-field input').count(), 0);
  await page.goto(`${base}#/search`);
  assert.equal(await page.locator('.search-field input').evaluate(el => getComputedStyle(el).fontSize), '16px');
  assert.deepEqual(errors, []);
  console.log('PASS: want-to-been visit and feed search visit persist with one photo, old log photos render without a new visit, dated filter unchanged, Recs/Guides removed');
} finally {
  await browser.close();
}
