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
  }catch(erro){
   if(erro.status===429||['over_email_send_rate_limit','over_request_rate_limit'].includes(erro.code)){
    let restante=Math.min(300,Math.max(1,Number(erro.message?.match(/after (\d+) seconds/i)?.[1])||60));
    mensagem.textContent=`O serviço limitou novos envios. Aguarde ${restante} segundos antes de tentar novamente. Se já solicitou um link, confira a caixa de entrada e o spam.`;
    botao.textContent=`Aguarde ${restante}s`;
    const timer=setInterval(()=>{restante--;botao.textContent=restante>0?`Aguarde ${restante}s`:'Enviar link de recuperação';if(restante<=0){clearInterval(timer);botao.disabled=false;mensagem.textContent='Você já pode solicitar um novo link, caso ainda não tenha recebido o anterior.';}},1000);
   }else{
    mensagem.textContent='Não foi possível enviar o link. Confira a conexão. Se o problema persistir, o responsável deve verificar o serviço de e-mail do painel.';botao.disabled=false;
   }
 }
 });
});

