const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('esqueci minha senha abre página própria sem bloquear o link no login',()=>{
 const html=fs.readFileSync('admin/index.html','utf8'),js=fs.readFileSync('admin/js/login.js','utf8');
 assert.match(html,/href="pages\/recuperar-senha.html"/);assert.doesNotMatch(js,/resetPasswordForEmail/);
});
test('recuperação envia o e-mail ao Supabase com destino da página de redefinição',async()=>{
 const vm=require('node:vm');let pronto,enviar,pedido;
 const form={hidden:false,reportValidity:()=>true,addEventListener(e,fn){enviar=fn;}},botao={},mensagem={},email={value:' usuario@example.com '};
 const document={getElementById:id=>({formRecuperar:form,emailRecuperacao:email,enviarRecuperacao:botao,mensagemRecuperacao:mensagem})[id],addEventListener(e,fn){pronto=fn;}};
 const window={DOMMaltaConfig:{url:'https://banco.example',chavePublica:'publica'},supabase:{createClient:()=>({auth:{async resetPasswordForEmail(e,opcoes){pedido={e,opcoes};return{error:null};}}})}};
 vm.runInNewContext(fs.readFileSync('admin/js/recuperar-senha.js','utf8'),{window,document,URL,location:{href:'https://dom-malta-previa-cliente.vercel.app/admin/pages/recuperar-senha.html'}});pronto();await enviar({preventDefault(){}});
 assert.equal(pedido.e,'usuario@example.com');assert.equal(pedido.opcoes.redirectTo,'https://dom-malta-previa-cliente.vercel.app/admin/pages/redefinir-senha.html');assert.equal(form.hidden,true);assert.match(mensagem.textContent,/Se o e-mail estiver cadastrado/);
});
test('limite de envio informa espera e bloqueia repetição até terminar o prazo',async()=>{
 const vm=require('node:vm');let pronto,enviar,tick;
 const form={reportValidity:()=>true,addEventListener(e,fn){enviar=fn;}},botao={textContent:'Enviar link de recuperação'},mensagem={};
 const document={getElementById:id=>({formRecuperar:form,emailRecuperacao:{value:'usuario@example.com'},enviarRecuperacao:botao,mensagemRecuperacao:mensagem})[id],addEventListener(e,fn){pronto=fn;}};
 const window={DOMMaltaConfig:{url:'https://banco.example',chavePublica:'publica'},supabase:{createClient:()=>({auth:{async resetPasswordForEmail(){return{error:{status:429,message:'For security purposes, you can only request this after 56 seconds.'}};}}})}};
 vm.runInNewContext(fs.readFileSync('admin/js/recuperar-senha.js','utf8'),{window,document,URL,location:{href:'https://loja.example/admin/pages/recuperar-senha.html'},setInterval:fn=>{tick=fn;return 1;},clearInterval(){}});pronto();await enviar({preventDefault(){}});
 assert.equal(botao.disabled,true);assert.match(mensagem.textContent,/56 segundos/);assert.match(botao.textContent,/56s/);
 for(let i=0;i<56;i++)tick();assert.equal(botao.disabled,false);assert.match(botao.textContent,/Enviar link/);
});
