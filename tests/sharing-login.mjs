// Run against Vite with a disposable, non-production Supabase URL/key.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:390,height:844}});
page.setDefaultTimeout(8000);
const requests=[];
await page.route('**/auth/v1/**',async route=>{
  requests.push(route.request().postDataJSON());
  await route.fulfill({status:400,headers:{'x-supabase-api-version':'2024-01-01'},contentType:'application/json',body:JSON.stringify({code:'invalid_credentials',message:'Invalid login credentials'})});
});
try{
  await page.goto(`${process.env.TEST_URL||'http://127.0.0.1:5177/'}#/profile`);
  await page.getByRole('group',{name:'选择身份'}).waitFor();
  assert.equal(await page.locator('input[type=email]').count(),0);
  assert.equal(await page.getByLabel('登录密码').inputValue(),'');
  for(const name of ['WXY','LHJ']){
    await page.getByRole('group',{name:'选择身份'}).getByRole('button',{name,exact:true}).click();
    await page.getByLabel('登录密码').fill('test-only-password');
    await page.getByRole('button',{name:'登录',exact:true}).click();
    await page.getByRole('alert').waitFor();
    assert.equal(requests.at(-1).email,`${name.toLowerCase()}@beli.example.com`);
    assert.equal(requests.at(-1).password,'test-only-password');
  }
  console.log('PASS: identity selection, backend password verification request, no email input or prefilled password, invalid-password feedback');
}finally{await browser.close();}
