const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');
const {createRequire} = require('module');
const root = path.resolve(__dirname, '../..');
const clientRequire = createRequire(root + '/client/package.json');
const serverRequire = createRequire(root + '/server/package.json');
const ts = clientRequire('typescript');
const rxjs = clientRequire('rxjs');
const out = fs.mkdtempSync(path.join(require('os').tmpdir(), 'pos-receipt-tests-'));
fs.mkdirSync(out, {recursive:true});
const report = [];
function load(file, overrides={}) {
  const filename = path.join(root, file);
  const module = {exports:{}};
  let source = fs.readFileSync(filename, 'utf8');
  if (file.endsWith('.ts')) source = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
  const localRequire = createRequire(filename);
  const fn = vm.runInThisContext('(function(require,module,exports,__dirname,__filename){' + source + '\n})', {filename});
  fn(name => name in overrides ? overrides[name] : localRequire(name),module,module.exports,path.dirname(filename),filename);
  return module.exports;
}
const renderer = load('client/src/app/core/services/receipt-renderer.ts');
const statePath = path.join(out, 'test-app-settings.json');
const settingsFs = {...fs, existsSync: p => fs.existsSync(String(p).endsWith('app-settings.json') ? statePath : p), readFileSync:(p,...args)=>fs.readFileSync(String(p).endsWith('app-settings.json') ? statePath : p,...args), writeFileSync:(p,...args)=>fs.writeFileSync(String(p).endsWith('app-settings.json') ? statePath : p,...args)};
const settingsLib = load('server/src/lib/settings.js', {'fs':settingsFs});
const sale = {id:42,dailyTicketNumber:'TEST-0042',createdAt:new Date(2026,8,10,15,7),items:[{productName:'Croissant au beurre',quantity:2,unitPrice:3.5,total:7},{productName:'Tarte aux amandes',quantity:1,unitPrice:9,total:9}],discount:1.5,finalTotal:14.5,paymentType:'CREDIT',status:'TEMPORARY',advancePayment:5,paymentMethod:{name:'Carte',type:'CARD'},advancePaymentMethod:{name:'Espèces',type:'CASH'},client:{firstName:'Client',lastName:'Test'}};
const initial = settingsLib.ensureDefaults({companyName:'Samurai Food',companyAddress:'12 avenue de la Liberté, Sfax',companyPhone:'74 123 456',companyEmail:'contact@example.test',isDesktopVersion:false,logoUrl:'data:image/webp;base64,'+fs.readFileSync(root+'/client/public/logo_sfax.webp').toString('base64')});
const configA = structuredClone(initial);
Object.assign(configA.printSettings,{receiptCompanyName:'Maison Délice',receiptDepotName:'Dépôt Sfax',logoSize:'small',currencySymbol:'DT',dateFormat:'dd/mm/yyyy',timeFormat:'24h',currencyPosition:'after',doubleImpression:true});
Object.assign(configA.printSettings.customTexts,{receiptTitle:'TICKET GOURMAND',companySlogan:'Le goût du fait maison',thankYouMessage:'Merci et à bientôt !',footerMessage:'Votre pause sucrée à Sfax'});
const configB = structuredClone(configA);
Object.assign(configB.printSettings,{showLogo:false,showCompanyDetails:false,showClientInfo:false,showPaymentMethod:false,showDiscountDetails:false,doubleImpression:false,dateFormat:'mm/dd/yyyy',timeFormat:'12h',currencySymbol:'EUR',currencyPosition:'before',receiptCompanyName:'Comptoir B',receiptDepotName:''});
Object.assign(configB.printSettings.customTexts,{receiptTitle:'TICKET EXPRESS',companySlogan:'',thankYouMessage:'',footerMessage:''});
const configC = structuredClone(configA);
Object.assign(configC.printSettings,{logoSize:'large',dateFormat:'yyyy-mm-dd',timeFormat:'12h',currencySymbol:'TND',currencyPosition:'before',receiptCompanyName:'Comptoir Samurai',receiptDepotName:'Comptoir Tunis'});
Object.assign(configC.printSettings.customTexts,{receiptTitle:'REÇU PERSONNALISÉ',companySlogan:'Créations du jour',thankYouMessage:'Bonne dégustation !',footerMessage:'À très bientôt'});
async function test(name,fn) {await fn();report.push({test:name,status:'PASS'});console.log('PASS '+name);}
async function main() {
 await test('Sauvegarde et relecture des trois configurations via le stockage du projet',()=>{
   for(const config of [configA,configB,configC]) {settingsLib.writeDepotSettings('receipt-test',config);assert.deepEqual(settingsLib.getDepotSettings('receipt-test').printSettings,config.printSettings);}
 });
 await test('Toutes les options sont appliquées en HTML et ESC/POS',()=>{
   for(const render of [renderer.renderReceiptText,renderer.renderReceiptHtml]) {
     const a=render(sale,configA);for(const text of ['Maison Délice','Dépôt Sfax','TICKET GOURMAND','Le goût du fait maison','Merci et à bientôt !','Votre pause sucrée à Sfax','10/09/2026','15:07','14.500 DT','Client: Client Test','Remise','Carte','Espèces','9.500 DT'])assert.ok(a.includes(text),text);
     const b=render(sale,configB);for(const text of ['Comptoir B','TICKET EXPRESS','09/10/2026','03:07 PM','EUR 14.500'])assert.ok(b.includes(text),text);
     for(const text of ['Dépôt Sfax','12 avenue','Client:','Remise','Carte','Espèces','Merci','fidélité'])assert.ok(!b.includes(text),text);
     const c=render(sale,configC);assert.ok(c.includes('2026-09-10'));assert.ok(c.includes('TND 14.500'));
   }
 });
 await test('Montant nul, crédit, vente en gros et texte HTML échappé',()=>{
   for(const render of [renderer.renderReceiptText,renderer.renderReceiptHtml]) {
     assert.ok(render({...sale,finalTotal:0},configA).includes('0.000 DT'));
     const wholesale={...sale,isWholesale:true,items:[{productName:'Lot biscuits',quantity:12,unitPrice:1,total:12,isWholesale:true,bundlePrice:6,bundleQuantity:2,bundleSize:6}],finalTotal:10.5};
     const html=render(wholesale,configB);assert.ok(html.includes('VENTE GROS'));assert.ok(html.includes('EUR 10.500'));assert.ok(!html.includes('Client:'));assert.ok(!html.includes('Carte'));
   }
   const malicious=structuredClone(configA);malicious.printSettings.customTexts.receiptTitle='<script>alert(1)</script>';
   assert.ok(!renderer.renderReceiptHtml(sale,malicious).includes('<script>'));
   assert.ok(!renderer.renderReceiptHtml(sale,configA,'javascript:alert(1)').includes('<img'));
 });
 await test('Cuisine sans prix, remise, paiement ou ouverture du tiroir',()=>{
   for(const html of [renderer.renderReceiptText(sale,configA,true),renderer.renderReceiptHtml(sale,configA,'',true)]){
     for(const text of ['CUISINE','2 × Croissant','1 × Tarte','Total articles'])assert.ok(html.includes(text));
     for(const text of ['14.500','3.500','9.000','Carte','Remise','TOTAL A PAYER','\x1bp'])assert.ok(!html.includes(text));
   }
 });
 await test('Logo petit, moyen, grand, masqué et conversion thermique',()=>{
   for(const [size,width] of [['small',64],['medium',96],['large',128]]) {
     const config=structuredClone(configA);config.printSettings.logoSize=size;
     assert.ok(renderer.renderReceiptHtml(sale,config,initial.logoUrl).includes(`width:${width}px`));
   }
   assert.ok(!renderer.renderReceiptHtml(sale,configB,initial.logoUrl).includes('<img'));
   const raster=renderer.encodeReceiptLogo(new Uint8ClampedArray([0,0,0,255,255,255,255,255,0,0,0,0]),3,1);
   assert.deepEqual(Array.from(raster),[29,118,48,0,1,0,1,0,128]);
 });
 const calls=[];let current=configA;
 const tauri={invoke:async(name,args)=>{calls.push({name,args});}};
 const {PrintService}=load('client/src/app/core/services/print.service.ts',{'@angular/core':{Injectable:()=>x=>x},'./receipt-renderer':renderer,'rxjs':rxjs,'@tauri-apps/api/core':tauri});
 const service=new PrintService({getSettings:()=>rxjs.of(current),getAbsoluteLogoUrl:url=>url||''});
 global.window={__TAURI_INTERNALS__:{}};
 service.receiptLogo=async()=>null;
 await test('Envoi natif : une copie puis client + cuisine après changement enregistré',async()=>{
   current={...configB,isDesktopVersion:true};await service.printSaleReceipt(sale);assert.equal(calls.length,1);
   calls.length=0;current={...configC,isDesktopVersion:true};await service.printSaleReceipt(sale);assert.equal(calls.length,2);assert.ok(calls[1].args.text.includes('CUISINE'));assert.ok(!calls[1].args.text.includes('TND'));
 });
 await test('Échec cuisine : aucune réimpression automatique du client',async()=>{
   calls.length=0;tauri.invoke=async(name,args)=>{calls.push({name,args});if(calls.length===2)throw new Error('simulated kitchen failure');};
   await assert.rejects(service.printSaleReceipt(sale));assert.equal(calls.length,2);
 });
 delete global.window;
 await test('Logos desktop : fichiers embarqués et uploads locaux, aucune URL Internet',()=>{
   global.window={location:{origin:'http://tauri.localhost'}};
   const {SettingsService}=load('client/src/app/core/services/settings.service.ts',{'@angular/core':{Injectable:()=>x=>x},'../../../environments/environment':{environment:{production:true,apiUrl:'http://localhost:3255/api'}}});
   const service=new SettingsService({});
   assert.equal(service.getAbsoluteLogoUrl('/logo_sfax.webp'),'http://tauri.localhost/logo_sfax.webp');
   assert.equal(service.getAbsoluteLogoUrl('https://old.example/uploads/logos/logo.png'),'http://localhost:3255/uploads/logos/logo.png');
   assert.equal(service.getAbsoluteLogoUrl('https://old.example/unavailable.png'),'http://tauri.localhost/logo_default.webp');
   delete global.window;
 });

 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log('All '+report.length+' checks passed. Report: '+out);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
