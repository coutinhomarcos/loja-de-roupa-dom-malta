document.addEventListener('DOMContentLoaded',()=>{
 const form=document.getElementById('formRecuperar'),email=document.getElementById('emailRecuperacao'),botao=document.getElementById('enviarRecuperacao'),mensagem=document.getElementById('mensagemRecuperacao');
 form.addEventListener('submit',async evento=>{
  evento.preventDefault();if(!form.reportValidity()||botao.disabled)return;
  botao.disabled=true;mensagem.textContent='Enviando o link…';
  try{
   const cfg=window.DOMMaltaConfig;if(!window.supabase||!cfg)throw new Error('Não foi possível carregar a conexão. Verifique sua internet e tente novamente.');
   const client=window.supabase.createClient(cfg.url,cfg.chavePublica);
   const {error}=await client.auth.resetPasswordForEmail(email.value.trim(),{redirectTo:new URL('redefinir-senha.html',location.href).href});
   if(error)throw error;
   mensagem.textContent='Se o e-mail estiver cadastrado, você receberá um link de recuperação. Confira a caixa de entrada e o spam. Abra o link para cadastrar sua nova senha.';
   form.hidden=true;
  }catch(erro){mensagem.textContent='Não foi possível enviar o link agora. Aguarde um pouco e tente novamente. Se persistir, confira a conexão ou procure o responsável pelo painel.';botao.disabled=false;}
 });
});
