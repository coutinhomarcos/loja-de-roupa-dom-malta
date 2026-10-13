/* Validação da grade, compartilhada pelo cadastro e pelos testes. */
window.Grade = {
    separar(texto) {
        const vistos = new Set();
        return texto.split(',').map(s => s.trim()).filter(s => {
            const chave = s.toLocaleLowerCase('pt-BR');
            if (!s || vistos.has(chave)) return false;
            vistos.add(chave); return true;
        });
    },
    gerar(tamanhos, cores) {
        const ts = this.separar(tamanhos), cs = this.separar(cores);
        if (!ts.length || !cs.length) throw new Error('Informe tamanhos e cores separados por vírgula.');
        if (ts.length * cs.length > 200) throw new Error('A grade pode ter até 200 combinações.');
        return ts.flatMap(tamanho => cs.map(cor => ({ tamanho, cor, estoque: 0 })));
    },
    validar(grade) {
        if (!grade.length) throw new Error('Gere a grade antes de cadastrar.');
        for (const v of grade) {
            if (!Number.isInteger(v.estoque) || v.estoque < 0 || v.estoque > 1000000)
                throw new Error('Informe quantidades inteiras entre 0 e 1.000.000.');
        }
        return grade;
    }
};
