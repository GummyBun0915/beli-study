import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { mockSharing } from './helpers/mock-sharing.mjs';

const base = 'http://127.0.0.1:5189/';
const { restaurants } = JSON.parse(fs.readFileSync('src/data/restaurants.generated.json', 'utf8'));
const restaurant = restaurants[0];
const good = '00000000-0000-4000-8000-000000000101';
const flaky = '00000000-0000-4000-8000-000000000102';
const entry = { id:'fixture-visit', sentiment:'liked', category:'Restaurants', notes:'Fixture visit with photos', tags:[], dishes:[], photoIds:[good,flaky], visitedAt:'2026-11-04', recordedAt:'2026-11-04T10:00:00Z' };
const snapshot = { version:2, baseline:'empty', statuses:{[restaurant.id]:'been'}, logs:{[restaurant.id]:entry}, order:[restaurant.id], visits:{[restaurant.id]:[entry]}, history:[] };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF2sAAAAASUVORK5CYII=', 'base64');
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
  for (const identity of ['WXY']) {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    page.setDefaultTimeout(8000);
    const errors = [], unexpected = [], attempts = new Map();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://*.supabase.co/**', async route => {
      unexpected.push(new URL(route.request().url()).pathname);
      await route.abort();
    });
    await mockSharing(page, {initialIdentity:identity, snapshots:{WXY:snapshot}});
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await page.route('**/storage/v1/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const id = path.split('/').at(-1);
      if (route.request().method() !== 'GET' || !path.includes('/00000000-0000-4000-8000-000000000001/') || ![good,flaky].includes(id)) {
        unexpected.push(path);
        return route.abort();
      }
      const count = (attempts.get(id) || 0) + 1;
      attempts.set(id, count);
      if (id === flaky && count === 1) {
        await held;
        return route.fulfill({status:503, json:{message:'Fixture unavailable'}});
      }
      return route.fulfill({contentType:'image/png', body:png});
    });
    try {
      await page.goto(base);
      const post = page.locator('.feed-post[data-kind="visit"][data-author="WXY"]');
      await post.getByText(entry.notes, {exact:false}).waitFor();
      await post.scrollIntoViewIfNeeded();
      await post.getByText('照片 2正在加载…', {exact:true}).waitFor();
      await post.locator('img').waitFor();
      release();
      await post.getByText('照片 2加载失败', {exact:true}).waitFor();
      assert.equal(await post.locator('img').count(), 1);
      await post.getByRole('button', {name:'重试照片 2', exact:true}).click();
      await post.locator('img').nth(1).waitFor();
      assert.equal(attempts.get(good), 1, 'Retry must not request the working photo again');
      assert.equal(attempts.get(flaky), 2);
      assert.equal(await post.getByRole('button', {name:'重试照片 2'}).count(), 0);
      // A missing previously synced photo must not prevent saving a text/status change.
      if (identity === 'WXY') {
        await post.locator('.post-head').click();
        const save = page.waitForResponse(response => response.url().endsWith('/rpc/beli_save_state'));
        await page.getByRole('group', {name:'餐厅状态'}).getByRole('button', {name:'想去'}).click();
        const response = await save;
        assert(response.ok(), 'The fixture accepted the save');
        const body = response.request().postDataJSON();
        assert.deepEqual(body.state_payload.visits[restaurant.id][0].photoIds, [good,flaky]);
        // This is a new page view; it independently requests the missing image.
        await page.goto(base+'#/feed');
        await post.scrollIntoViewIfNeeded();
        await post.locator('img').nth(1).waitFor();
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(unexpected, []);
    } finally {
      release();
      await page.close();
    }
  }
  console.log('Photo fixture passed: pending/failed images do not gate Feed, good image stays visible, retry only requests the failed image, existing photo references survive a simulated save.');
} finally {
  await browser.close();
}
