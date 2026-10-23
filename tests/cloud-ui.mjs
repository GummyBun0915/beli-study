import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
if(!process.env.CLOUD_TEST_PASSWORD)throw new Error('CLOUD_TEST_PASSWORD is required');
const base=process.env.TEST_URL||'http://127.0.0.1:5178/';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const contexts=await Promise.all([browser.newContext({viewport:{width:390,height:844}}),browser.newContext({viewport:{width:390,height:844}})]);
const [a,b]=await Promise.all(contexts.map(c=>c.newPage()));const errors=[];
for(const p of [a,b]){p.setDefaultTimeout(25000);p.on('pageerror',e=>errors.push(e.message));}
const login=async(page,name)=>{
  await page.goto(`${base}#/profile`);
  await page.getByRole('group',{name:'选择身份'}).getByRole('button',{name,exact:true}).click();
  await page.getByLabel('登录密码').fill(process.env.CLOUD_TEST_PASSWORD);
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await page.getByRole('heading',{name:'Our dining space',exact:true}).waitFor();
  await page.locator('.sharing-title').getByText('已同步',{exact:true}).waitFor();
  assert.equal(await page.locator('.profile-name').innerText(),name);
  assert.equal(await page.locator('.profile-avatar').innerText(),name[0]);
};
let toggled=false;
try{
  await login(a,'WXY');await login(b,'LHJ');
  assert.equal((await a.locator('.profile-metrics strong').allTextContents())[0],'67');
  assert.equal((await b.locator('.profile-metrics strong').allTextContents())[0],'0');
  const data=JSON.parse(fs.readFileSync('src/data/restaurants.generated.json','utf8')).restaurants;
  const restaurant=data.find(r=>r.brand.includes('寿司郎'));
  await b.goto(`${base}#/restaurant/${restaurant.id}`);
  const save=b.getByRole('button',{name:'一起想去',exact:true});
  // Use a currently absent item, and remove only the item added by this test.
  if(await save.count()){
    await save.click();toggled=true;
    await a.locator('.sharing-panel .shared-rows button').filter({hasText:restaurant.brand}).waitFor();
    await b.getByRole('button',{name:'已加入一起想去',exact:true}).click();toggled=false;
    await a.locator('.sharing-panel .shared-rows button').filter({hasText:restaurant.brand}).waitFor({state:'detached'});
  }else throw new Error('Choose an absent shared restaurant before rerunning; test will not remove an existing favourite');
  await b.goto(`${base}#/profile`);await b.getByRole('button',{name:'退出登录',exact:true}).click();
  await b.getByRole('group',{name:'选择身份'}).waitFor();
  assert.equal((await b.locator('.profile-metrics strong').allTextContents())[0],'0');
  // Same browser switches from LHJ to WXY and back without inheriting personal visits.
  await login(b,'WXY');await b.getByRole('button',{name:'退出登录',exact:true}).click();
  await b.getByRole('group',{name:'选择身份'}).waitFor();await login(b,'LHJ');
  assert.equal((await b.locator('.profile-metrics strong').allTextContents())[0],'0');
  await b.reload();await b.getByRole('heading',{name:'Our dining space',exact:true}).waitFor();
  await b.locator('.sharing-title').getByText('已同步',{exact:true}).waitFor();
  assert.equal(await b.locator('.profile-avatar').innerText(),'L');
  assert.equal((await b.locator('.profile-metrics strong').allTextContents())[0],'0');
  await a.screenshot({path:'qa/sharing-wxy-mobile.png',fullPage:true});await b.screenshot({path:'qa/sharing-lhj-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  const report={testedAt:new Date().toISOString(),base,passed:['real WXY/LHJ browser login','one shared room','W/L profile identity','WXY original 67 Been, LHJ empty','wishlist add/remove arrives without refresh','same-browser account switch isolated','session and records retained after reload'],errors};
  fs.writeFileSync('qa/cloud-ui-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{
  if(toggled){try{await b.getByRole('button',{name:'已加入一起想去',exact:true}).click();}catch{console.error('Shared test item needs cleanup');}}
  await browser.close();
}
