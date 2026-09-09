const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(path.join(process.env.TUBESHELF_NODE_MODULES,'playwright'));
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    for(const language of ['en','zh-TW']) {
      const page=await browser.newPage({viewport:{width:1280,height:850}});
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/extension/dashboard/dashboard.js',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'../extension/dashboard/dashboard.js'),'utf8').replace('location.protocol === "chrome-extension:" &&','')}));
      await page.addInitScript(language=>{
        let listener;
        let state=JSON.parse(localStorage.getItem('classification-fixture')||'null')||{
          settings:{language,onboardingComplete:true},
          groups:[{id:'music-custom',name:'音樂',color:'#ff6b8a',icon:'music',channelIds:['/@filed']}],
          channels:{
            '/@filed':{name:'Existing choice',description:'Cooking'},
            '/@strong':{name:'Music Studio',description:'Music piano',recentTitles:['Music lesson one','Music lesson two','Music lesson three']},
            '/@weak':{name:'Quiet creator',description:'Music'},
            '/@mixed':{name:'Mixed creator',description:'Music piano cooking recipe'}
          },manualLabels:{'/@filed':['music-custom']}
        };
        Object.values(state.channels).forEach(channel=>{channel.profileVersion=5;channel.profiledAt=Date.now();});
        globalThis.__state=()=>state;
        globalThis.__change=next=>{state=TubeShelfCore.normalizeState(next);localStorage.setItem('classification-fixture',JSON.stringify(state));listener?.({tubeShelfState:{newValue:state}},'local');};
        globalThis.chrome={storage:{local:{get:async key=>({[key]:key==='tubeShelfState'?state:''})},onChanged:{addListener:fn=>listener=fn}},runtime:{sendMessage:async message=>{
          if(message.type!=='TUBESHELF_MUTATE')return{ok:true};
          if(globalThis.__failSave && message.operation.type==='apply-auto-suggestions')return{ok:false,error:'Fixture save failure'};
          const next=TubeShelfCore.applyStateOperation(state,message.operation);next.revision=state.revision+1;__change(next);return{ok:true,state};
        }},tabs:{create:async()=>({id:1})}};
      },language);
      await page.goto('http://127.0.0.1:8766/extension/dashboard/dashboard.html');
      await page.locator('#auto-organize').click();
      await page.locator('#auto-start').click();
      await page.locator('#auto-results').waitFor({state:'visible'});
      assert.equal(await page.locator('[data-auto-channel="/@filed"]').count(),0);
      const strong=page.locator('[data-auto-channel="/@strong"]');
      assert.equal(await strong.isChecked(),true);
      assert.equal(await page.locator('[data-auto-channel="/@weak"]').isChecked(),false);
      assert.equal(await page.locator('[data-auto-channel="/@mixed"]').count(),2);
      await strong.uncheck();
      for(const input of await page.locator('[data-auto-channel="/@mixed"]').all()) await input.check();
      await page.evaluate(()=>{const next=structuredClone(__state());next.revision++;next.settings.hideShorts=true;__change(next);});
      assert.equal(await strong.isChecked(),false);
      for(const input of await page.locator('[data-auto-channel="/@mixed"]').all()) assert.equal(await input.isChecked(),true);
      // Stored group names are content, including in English UI.
      assert.ok((await page.locator('.suggestion-group h3 [translate=no]').allTextContents()).includes('音樂'));
      assert.ok(await page.locator('.suggestion-copy').first().evaluate(node=>node.getBoundingClientRect().width>300));
      assert.ok(await page.locator('#auto-apply').evaluate(node=>node.getBoundingClientRect().bottom<=innerHeight));
      await page.screenshot({path:`work/classification-selection-${language}.png`,fullPage:true});
      await page.evaluate(()=>{__failSave=true;});
      await page.locator('#auto-apply').click();
      await page.waitForFunction(()=>document.querySelector('#auto-save-error').textContent.length>0);
      for(const input of await page.locator('[data-auto-channel="/@mixed"]').all()) assert.equal(await input.isChecked(),true);
      assert.equal(await page.evaluate(()=>__state().groups.length),1);
      await page.evaluate(()=>{__failSave=false;});
      await page.locator('#auto-apply').click();
      await page.locator('#auto-dialog').waitFor({state:'hidden'});
      const state=await page.evaluate(()=>__state());
      assert.deepEqual(state.groups.find(group=>group.id==='music-custom').channelIds,['/@filed','/@mixed']);
      assert.equal(state.groups.filter(group=>group.channelIds.includes('/@mixed')).length,2);
      assert.ok(!state.groups.some(group=>group.channelIds.includes('/@strong')||group.channelIds.includes('/@weak')));
      assert.deepEqual(state.manualLabels,{'/@filed':['music-custom']});
      await page.reload();
      assert.equal((await page.evaluate(()=>__state())).groups.filter(group=>group.channelIds.includes('/@mixed')).length,2);
      assert.deepEqual(errors,[]);
      await page.close();
    }
    console.log('Classification smoke passed: per-channel selection, conservative defaults, multiple groups, revision-safe choices, custom names, preserved manual assignments and reload persistence in both languages.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
