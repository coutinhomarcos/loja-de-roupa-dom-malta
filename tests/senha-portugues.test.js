const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('erros de redefinição são exibidos em português sem repassar texto cru do provedor',()=>{
 const contexto={document:{addEventListener(){}}};vm.runInNewContext(fs.readFileSync('admin/js/redefinir-senha.js','utf8'),contexto);
 assert.equal(contexto.mensagemErroSenha({code:'same_password',message:'New password should be different from the old password.'}),'A nova senha deve ser diferente da senha anterior.');
 assert.match(contexto.mensagemErroSenha({message:'New password should be different from the old password.'}),/diferente da senha anterior/);
 assert.match(contexto.mensagemErroSenha({code:'otp_expired'}),/expirou/);
 assert.doesNotMatch(contexto.mensagemErroSenha({message:'Internal server error'}),/Internal server/);
});
