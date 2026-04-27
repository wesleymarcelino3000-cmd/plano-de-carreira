let usuarioAtual = null;
let charts = [];
let ultimoPlanoCarreira = [];

const MENUS_SISTEMA = [
  {key:'dashboard', label:'Dashboard'},
  {key:'sac', label:'SAC'},
  {key:'logistica', label:'Logística'},
  {key:'vendas', label:'Vendas'},
  {key:'marketing', label:'Marketing'},
  {key:'ranking', label:'Ranking'},
  {key:'metas', label:'Metas / Bônus'},
  {key:'metasIndividuais', label:'Metas Individuais'},
  {key:'criarUsuario', label:'Criar Usuário / Acessos'},
  {key:'editarMeuUsuario', label:'Editar Meu Usuário'},
  {key:'planoCarreira', label:'Plano de Carreira'}
];

function isAdmin(){
  return (usuarioAtual?.nivel || '').toLowerCase().trim() === 'admin';
}

function permissoesPadrao(nivel='funcionario'){
  if((nivel || '').toLowerCase() === 'admin'){
    return MENUS_SISTEMA.reduce((obj,m)=>({...obj,[m.key]:true}),{});
  }
  return {dashboard:true,ranking:true,editarMeuUsuario:true,planoCarreira:true};
}

function usuarioPode(menu){
  if(isAdmin()) return true;
  const permissoes = usuarioAtual?.permissoes || {};
  return permissoes[menu] === true;
}

function limparGraficos(){
  charts.forEach(c=>c.destroy());
  charts = [];
}

async function login(){
  const loginDigitado=(document.getElementById('usuarioLogin')?.value || document.getElementById('email')?.value || '').trim();
  const senha=document.getElementById('senha').value;

  if(!loginDigitado || !senha){
    alert('Informe usuário e senha.');
    return;
  }

  let emailLogin = loginDigitado;
  let usuarioPorLogin = null;

  if(!loginDigitado.includes('@')){
    const {data:usuarioBusca,error:erroBusca}=await db
      .from('usuarios')
      .select('*')
      .eq('usuario',loginDigitado)
      .maybeSingle();

    if(erroBusca){
      alert("Erro ao buscar usuário. Execute o SQL de atualização para criar a coluna 'usuario'. Detalhe: " + erroBusca.message);
      return;
    }
    if(!usuarioBusca || !usuarioBusca.email){
      alert('Usuário não encontrado.');
      return;
    }
    usuarioPorLogin = usuarioBusca;
    emailLogin = usuarioBusca.email;
  }

  const {data,error}=await db.auth.signInWithPassword({email:emailLogin,password:senha});
  if(error){ alert('Erro no login: ' + error.message); return; }

  const user=data.user;

  let {data:usuario, error:erroUsuario}=await db
    .from('usuarios')
    .select('*')
    .eq('id',user.id)
    .maybeSingle();

  if(erroUsuario){
    alert('Erro ao buscar usuário: ' + erroUsuario.message);
    return;
  }

  if(!usuario && usuarioPorLogin){
    usuario = usuarioPorLogin;
  }

  if(!usuario){
    const {data:admins}=await db.from('usuarios').select('*').ilike('nivel','admin');
    const nivel = admins && admins.length === 0 ? 'admin' : 'funcionario';

    const novoUsuario = {
      id:user.id,
      nome:emailLogin,
      email:emailLogin,
      usuario:emailLogin.split('@')[0],
      nivel:nivel,
      setor:'Geral',
      permissoes:permissoesPadrao(nivel)
    };

    await db.from('usuarios').insert([novoUsuario]);
    usuario = novoUsuario;
  }

  if(!usuario.permissoes){
    usuario.permissoes = permissoesPadrao(usuario.nivel);
  }

  usuarioAtual = usuario;

  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  atualizarUserInfo();
  aplicarPermissoes();
  nav(usuarioPode('dashboard') ? 'dashboard' : primeiroMenuPermitido());
}

function primeiroMenuPermitido(){
  const menu = MENUS_SISTEMA.find(m=>usuarioPode(m.key));
  return menu ? menu.key : 'editarMeuUsuario';
}

function aplicarPermissoes(){
  document.querySelectorAll('[data-menu]').forEach(btn=>{
    const menu = btn.getAttribute('data-menu');
    const setor = btn.getAttribute('data-setor');
    let mostrar = usuarioPode(menu);

    if(!isAdmin() && setor && usuarioAtual.setor !== 'Geral' && setor !== usuarioAtual.setor){
      mostrar = false;
    }

    btn.style.display = mostrar ? 'flex' : 'none';
  });
}

async function logout(){
  await db.auth.signOut();
  location.reload();
}

function nav(p){
  limparGraficos();

  if(!usuarioPode(p)){
    alert('Você não tem permissão para acessar esta função.');
    return;
  }

  if(p==='dashboard') return dashboard();
  if(p==='ranking') return ranking();
  if(p==='metas') return metas();
  if(p==='metasIndividuais') return metasIndividuais();
  if(p==='sac') return painelSetor('SAC');
  if(p==='logistica') return painelSetor('Logística');
  if(p==='vendas') return painelSetor('Vendas');
  if(p==='marketing') return painelSetor('Marketing');
  if(p==='criarUsuario') return criarUsuario();
  if(p==='editarMeuUsuario') return editarMeuUsuario();
  if(p==='planoCarreira') return planoCarreira();
}

async function dashboard(){
  document.getElementById('title').innerText='Dashboard Geral';

  let funcQuery=db.from('funcionarios').select('*');
  let metasQuery=db.from('metas').select('*');
  let metasIndividuaisQuery=db.from('metas_individuais').select('*');

  if(!isAdmin() && usuarioAtual.setor !== 'Geral'){
    funcQuery=funcQuery.eq('setor',usuarioAtual.setor);
    metasQuery=metasQuery.eq('setor',usuarioAtual.setor);
    metasIndividuaisQuery=metasIndividuaisQuery.eq('setor',usuarioAtual.setor);
  }

  const [{data:funcs},{data:metas},{data:metasIndividuais}] = await Promise.all([funcQuery, metasQuery, metasIndividuaisQuery]);

  const totalPontos=(funcs||[]).reduce((s,f)=>s+(f.pontos||0),0);
  const totalMetas=(metas||[]).reduce((s,m)=>s+(Number(m.meta)||0),0);
  const realizado=(metas||[]).reduce((s,m)=>s+(Number(m.realizado)||0),0);
  const perc=totalMetas ? Math.round((realizado/totalMetas)*100) : 0;
  const totalMetasIndividuais=(metasIndividuais||[]).reduce((s,m)=>s+(Number(m.meta)||0),0);
  const realizadoIndividual=(metasIndividuais||[]).reduce((s,m)=>s+(Number(m.realizado)||0),0);
  const percIndividual=totalMetasIndividuais ? Math.round((realizadoIndividual/totalMetasIndividuais)*100) : 0;

  document.getElementById('page').innerHTML=`
    <div class="grid">
      <div class="card"><h3>Funcionários</h3><div class="value">${funcs?.length||0}</div></div>
      <div class="card"><h3>Pontos</h3><div class="value">${totalPontos}</div></div>
      <div class="card"><h3>Metas</h3><div class="value">${totalMetas}</div></div>
      <div class="card"><h3>Realizado</h3><div class="value">${perc}%</div></div>
      <div class="card"><h3>Metas Individuais</h3><div class="value">${totalMetasIndividuais}</div></div>
      <div class="card"><h3>Individual Realizado</h3><div class="value">${percIndividual}%</div></div>
    </div>
    <div class="two">
      <div class="card"><h3>Ranking por Pontos</h3><canvas id="chartRanking"></canvas></div>
      <div class="card"><h3>Metas por Setor</h3><canvas id="chartMetas"></canvas></div>
    </div>
  `;

  const c1 = new Chart(document.getElementById('chartRanking'),{
    type:'bar',
    data:{labels:(funcs||[]).map(f=>f.nome),datasets:[{label:'Pontos',data:(funcs||[]).map(f=>f.pontos||0)}]}
  });

  const c2 = new Chart(document.getElementById('chartMetas'),{
    type:'doughnut',
    data:{labels:(metas||[]).map(m=>m.setor),datasets:[{label:'Realizado',data:(metas||[]).map(m=>m.realizado||0)}]}
  });

  charts.push(c1,c2);
}

async function painelSetor(setor){
  const menuSetor = setor === 'SAC' ? 'sac' : setor === 'Logística' ? 'logistica' : setor === 'Vendas' ? 'vendas' : 'marketing';
  if(!usuarioPode(menuSetor) || (!isAdmin() && usuarioAtual.setor !== 'Geral' && usuarioAtual.setor !== setor)){
    alert('Você não tem acesso a este setor.');
    return;
  }

  document.getElementById('title').innerText=`Painel ${setor}`;

  const [{data:funcs},{data:metas},{data:metasIndividuais}] = await Promise.all([
    db.from('funcionarios').select('*').eq('setor',setor).order('pontos',{ascending:false}),
    db.from('metas').select('*').eq('setor',setor),
    db.from('metas_individuais').select('*').eq('setor',setor).order('funcionario_nome',{ascending:true})
  ]);

  const realizado=(metas||[]).reduce((s,m)=>s+(Number(m.realizado)||0),0);
  const meta=(metas||[]).reduce((s,m)=>s+(Number(m.meta)||0),0);
  const bonus=(metas||[]).reduce((s,m)=>s+(Number(m.bonus)||0),0);
  const metaIndividual=(metasIndividuais||[]).reduce((s,m)=>s+(Number(m.meta)||0),0);
  const realizadoIndividual=(metasIndividuais||[]).reduce((s,m)=>s+(Number(m.realizado)||0),0);

  document.getElementById('page').innerHTML=`
    <div class="grid">
      <div class="card"><h3>Equipe</h3><div class="value">${funcs?.length||0}</div></div>
      <div class="card"><h3>Meta</h3><div class="value">${meta}</div></div>
      <div class="card"><h3>Realizado</h3><div class="value">${realizado}</div></div>
      <div class="card"><h3>Bônus</h3><div class="value">R$ ${bonus}</div></div>
      <div class="card"><h3>Meta Individual</h3><div class="value">${metaIndividual}</div></div>
      <div class="card"><h3>Realizado Individual</h3><div class="value">${realizadoIndividual}</div></div>
    </div>
    <div class="two">
      <div class="card"><h3>Ranking do Setor</h3><canvas id="chartSetor"></canvas></div>
      <div class="card"><h3>Funcionários</h3><div id="listaSetor"></div></div>
    </div>
    <div class="card">
      <h3>Metas individuais do setor</h3>
      <table class="table">
        <tr><th>Funcionário</th><th>Meta</th><th>Realizado</th><th>%</th><th>Bônus</th></tr>
        ${(metasIndividuais||[]).map(m=>{
          const perc = Number(m.meta) ? Math.round((Number(m.realizado||0)/Number(m.meta))*100) : 0;
          return `<tr><td>${m.funcionario_nome||'-'}</td><td>${m.meta||0}</td><td>${m.realizado||0}</td><td><span class="badge">${perc}%</span></td><td>R$ ${m.bonus||0}</td></tr>`
        }).join('')}
      </table>
    </div>
  `;

  document.getElementById('listaSetor').innerHTML=(funcs||[]).map((f,i)=>`
    <div class="card">#${i+1} ${f.nome} <span class="badge">${f.pontos||0} pts</span></div>
  `).join('');

  const c = new Chart(document.getElementById('chartSetor'),{
    type:'bar',
    data:{labels:(funcs||[]).map(f=>f.nome),datasets:[{label:'Pontos',data:(funcs||[]).map(f=>f.pontos||0)}]}
  });
  charts.push(c);
}

async function ranking(){
  document.getElementById('title').innerText='Ranking';

  let query=db.from('funcionarios').select('*').order('pontos',{ascending:false});
  if(!isAdmin() && usuarioAtual.setor !== 'Geral'){
    query=query.eq('setor',usuarioAtual.setor);
  }

  const {data}=await query;

  document.getElementById('page').innerHTML=(data||[]).map((f,i)=>`
    <div class="card">
      <strong>#${i+1}</strong> ${f.nome} - ${f.setor}
      <span class="badge">${f.pontos||0} pts</span>
    </div>
  `).join('');
}

async function metas(){
  if(!isAdmin()){
    alert('Somente admin pode mexer em metas.');
    return;
  }

  document.getElementById('title').innerText='Metas e Bônus';

  const {data}=await db.from('metas').select('*').order('created_at',{ascending:false});

  document.getElementById('page').innerHTML=`
    <div class="card">
      <h3>Criar Meta</h3>
      <select id="metaSetor">
        <option>SAC</option><option>Logística</option><option>Vendas</option><option>Marketing</option>
      </select>
      <input id="metaValor" type="number" placeholder="Meta">
      <input id="metaRealizado" type="number" placeholder="Realizado">
      <input id="metaBonus" type="number" placeholder="Bônus R$">
      <button onclick="salvarMeta()">Salvar meta</button>
    </div>
    <div class="card">
      <h3>Metas cadastradas</h3>
      <table class="table">
        <tr><th>Setor</th><th>Meta</th><th>Realizado</th><th>Bônus</th></tr>
        ${(data||[]).map(m=>`<tr><td>${m.setor}</td><td>${m.meta}</td><td>${m.realizado}</td><td>R$ ${m.bonus||0}</td></tr>`).join('')}
      </table>
    </div>
  `;
}

async function salvarMeta(){
  const setor=document.getElementById('metaSetor').value;
  const meta=Number(document.getElementById('metaValor').value||0);
  const realizado=Number(document.getElementById('metaRealizado').value||0);
  const bonus=Number(document.getElementById('metaBonus').value||0);

  await db.from('metas').insert([{setor,meta,realizado,bonus}]);
  alert('Meta salva!');
  metas();
}

async function metasIndividuais(){
  if(!isAdmin()){
    alert('Somente admin pode mexer em metas individuais.');
    return;
  }

  document.getElementById('title').innerText='Metas Individuais por Setor';

  const [{data:metas},{data:funcs}] = await Promise.all([
    db.from('metas_individuais').select('*').order('created_at',{ascending:false}),
    db.from('funcionarios').select('*').order('nome',{ascending:true})
  ]);

  document.getElementById('page').innerHTML=`
    <div class="card form-card">
      <h3>Criar meta individual</h3>
      <p class="muted">Escolha o setor, selecione o funcionário e defina a meta individual.</p>
      <div class="form-grid">
        <select id="metaIndSetor" onchange="carregarFuncionariosMetaIndividual()">
          <option>SAC</option><option>Logística</option><option>Vendas</option><option>Marketing</option><option>Geral</option>
        </select>
        <select id="metaIndFuncionario"></select>
        <input id="metaIndValor" type="number" placeholder="Meta individual">
        <input id="metaIndRealizado" type="number" placeholder="Realizado">
        <input id="metaIndBonus" type="number" placeholder="Bônus R$">
      </div>
      <button onclick="salvarMetaIndividual()">Salvar meta individual</button>
    </div>

    <div class="card">
      <h3>Metas individuais cadastradas</h3>
      <table class="table">
        <tr><th>Setor</th><th>Funcionário</th><th>Meta</th><th>Realizado</th><th>%</th><th>Bônus</th><th>Ação</th></tr>
        ${(metas||[]).map(m=>{
          const perc = Number(m.meta) ? Math.round((Number(m.realizado||0)/Number(m.meta))*100) : 0;
          return `<tr>
            <td>${m.setor||'-'}</td>
            <td>${m.funcionario_nome||'-'}</td>
            <td>${m.meta||0}</td>
            <td>${m.realizado||0}</td>
            <td><span class="badge">${perc}%</span></td>
            <td>R$ ${m.bonus||0}</td>
            <td><button class="small-btn danger-btn" onclick="excluirMetaIndividual('${m.id}')">Excluir</button></td>
          </tr>`;
        }).join('')}
      </table>
    </div>
  `;

  window.funcionariosMetaIndividual = funcs || [];
  carregarFuncionariosMetaIndividual();
}

function carregarFuncionariosMetaIndividual(){
  const setor=document.getElementById('metaIndSetor')?.value;
  const select=document.getElementById('metaIndFuncionario');
  if(!select) return;

  const funcionarios=(window.funcionariosMetaIndividual||[]).filter(f=>!setor || f.setor===setor);
  select.innerHTML = funcionarios.length
    ? funcionarios.map(f=>`<option value="${f.id||''}" data-nome="${f.nome||''}">${f.nome||''}</option>`).join('')
    : '<option value="">Nenhum funcionário neste setor</option>';
}

async function salvarMetaIndividual(){
  const setor=document.getElementById('metaIndSetor').value;
  const funcionarioSelect=document.getElementById('metaIndFuncionario');
  const funcionario_id=funcionarioSelect.value || null;
  const funcionario_nome=funcionarioSelect.options[funcionarioSelect.selectedIndex]?.dataset?.nome || funcionarioSelect.options[funcionarioSelect.selectedIndex]?.text || '';
  const meta=Number(document.getElementById('metaIndValor').value||0);
  const realizado=Number(document.getElementById('metaIndRealizado').value||0);
  const bonus=Number(document.getElementById('metaIndBonus').value||0);

  if(!funcionario_nome || !meta){
    alert('Selecione o funcionário e informe a meta.');
    return;
  }

  const {error}=await db.from('metas_individuais').insert([{setor,funcionario_id,funcionario_nome,meta,realizado,bonus}]);
  if(error){ alert('Erro ao salvar meta individual: ' + error.message); return; }

  alert('Meta individual salva!');
  metasIndividuais();
}

async function excluirMetaIndividual(id){
  if(!confirm('Deseja excluir esta meta individual?')) return;
  const {error}=await db.from('metas_individuais').delete().eq('id',id);
  if(error){ alert('Erro ao excluir: ' + error.message); return; }
  metasIndividuais();
}

function atualizarUserInfo(){
  document.getElementById('userInfo').innerText =
    `${usuarioAtual.nome || usuarioAtual.email || usuarioAtual.usuario || ''} • ${usuarioAtual.nivel} • ${usuarioAtual.setor}`;
}

function montarCheckboxPermissoes(prefixo, selecionadas={}){
  return `<div class="permissoes-box">
    ${MENUS_SISTEMA.map(m=>`
      <label class="check-line">
        <input type="checkbox" id="${prefixo}_${m.key}" ${selecionadas[m.key] ? 'checked' : ''}>
        <span>${m.label}</span>
      </label>
    `).join('')}
  </div>`;
}

function lerPermissoes(prefixo){
  const permissoes = {};
  MENUS_SISTEMA.forEach(m=>{
    permissoes[m.key] = document.getElementById(`${prefixo}_${m.key}`)?.checked === true;
  });
  permissoes.editarMeuUsuario = true;
  return permissoes;
}

function marcarPermissoesPadrao(prefixo){
  const nivel = document.getElementById(prefixo === 'novoPerm' ? 'novoNivel' : 'editNivelAcesso')?.value || 'funcionario';
  const padrao = permissoesPadrao(nivel);
  MENUS_SISTEMA.forEach(m=>{
    const el = document.getElementById(`${prefixo}_${m.key}`);
    if(el) el.checked = padrao[m.key] === true;
  });
}

async function criarUsuario(){
  if(!isAdmin()){
    alert('Somente admin pode criar usuários.');
    return;
  }

  document.getElementById('title').innerText='Criar Usuário e Acessos';
  document.getElementById('page').innerHTML=`
    <div class="card form-card">
      <h3>Novo usuário</h3>
      <p class="muted">O login agora é feito por usuário e senha. O e-mail continua sendo usado internamente pelo Supabase.</p>
      <div class="form-grid">
        <input id="novoNome" placeholder="Nome do usuário">
        <input id="novoUsuario" placeholder="Usuário de login. Ex: joao.silva">
        <input id="novoEmail" type="email" placeholder="Email interno do login">
        <input id="novaSenha" type="password" placeholder="Senha inicial">
        <select id="novoNivel" onchange="marcarPermissoesPadrao('novoPerm')">
          <option value="funcionario">Funcionário</option>
          <option value="admin">Admin</option>
        </select>
        <select id="novoSetor">
          <option>Geral</option>
          <option>SAC</option>
          <option>Logística</option>
          <option>Vendas</option>
          <option>Marketing</option>
        </select>
      </div>
      <h3>Funções que este usuário pode acessar</h3>
      ${montarCheckboxPermissoes('novoPerm', permissoesPadrao('funcionario'))}
      <button onclick="salvarNovoUsuario()">Criar usuário</button>
    </div>
    <div class="card">
      <h3>Editar acessos de usuários existentes</h3>
      <p class="muted">Selecione um usuário para liberar ou bloquear funções do menu.</p>
      <div id="listaUsuariosAcesso" class="usuarios-acesso"></div>
    </div>
  `;
  carregarUsuariosAcesso();
}

async function salvarNovoUsuario(){
  const nome=document.getElementById('novoNome').value.trim();
  const usuario=document.getElementById('novoUsuario').value.trim().toLowerCase();
  const email=document.getElementById('novoEmail').value.trim();
  const password=document.getElementById('novaSenha').value;
  const nivel=document.getElementById('novoNivel').value;
  const setor=document.getElementById('novoSetor').value;
  const permissoes=lerPermissoes('novoPerm');

  if(!nome || !usuario || !email || !password){
    alert('Preencha nome, usuário, email e senha.');
    return;
  }

  const {data,error}=await db.auth.signUp({email,password});
  if(error){
    alert('Erro ao criar login: ' + error.message);
    return;
  }

  const userId=data?.user?.id;
  if(!userId){
    alert('O Supabase não retornou o ID do usuário. Verifique se o cadastro por email está ativo.');
    return;
  }

  const novoUsuario={
    id:userId,
    nome,
    usuario,
    email,
    nivel,
    setor,
    permissoes
  };

  const {error:erroPerfil}=await db.from('usuarios').upsert([novoUsuario]);
  if(erroPerfil){
    alert('Login criado, mas houve erro ao salvar perfil: ' + erroPerfil.message);
    return;
  }

  await db.from('funcionarios').insert([{nome,setor,pontos:0}]);
  alert('Usuário criado com sucesso!');
  criarUsuario();
}

async function carregarUsuariosAcesso(){
  const box=document.getElementById('listaUsuariosAcesso');
  if(!box) return;
  const {data,error}=await db.from('usuarios').select('*').order('nome',{ascending:true});
  if(error){
    box.innerHTML=`<p class="muted">Erro ao carregar usuários: ${error.message}</p>`;
    return;
  }
  box.innerHTML=(data||[]).map(u=>`
    <div class="user-access-card">
      <div>
        <strong>${u.nome || '-'}</strong><br>
        <span class="muted">Usuário: ${u.usuario || '-'} • ${u.nivel || '-'} • ${u.setor || '-'}</span>
      </div>
      <button class="small-btn" onclick="editarAcessosUsuario('${u.id}')">Editar acessos</button>
    </div>
  `).join('') || '<p class="muted">Nenhum usuário encontrado.</p>';
}

async function editarAcessosUsuario(id){
  const {data:u,error}=await db.from('usuarios').select('*').eq('id',id).maybeSingle();
  if(error || !u){ alert('Erro ao buscar usuário.'); return; }

  document.getElementById('page').innerHTML=`
    <div class="card form-card">
      <h3>Editar acessos - ${u.nome || '-'}</h3>
      <div class="form-grid">
        <input id="editNomeAcesso" placeholder="Nome" value="${u.nome || ''}">
        <input id="editUsuarioAcesso" placeholder="Usuário de login" value="${u.usuario || ''}">
        <input id="editEmailAcesso" placeholder="Email" value="${u.email || ''}">
        <select id="editNivelAcesso" onchange="marcarPermissoesPadrao('editPerm')">
          <option value="funcionario" ${u.nivel==='funcionario'?'selected':''}>Funcionário</option>
          <option value="admin" ${u.nivel==='admin'?'selected':''}>Admin</option>
        </select>
        <select id="editSetorAcesso">
          ${['Geral','SAC','Logística','Vendas','Marketing'].map(s=>`<option ${s===u.setor?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <h3>Funções liberadas</h3>
      ${montarCheckboxPermissoes('editPerm', u.permissoes || permissoesPadrao(u.nivel))}
      <button onclick="salvarAcessosUsuario('${u.id}')">Salvar acessos</button>
      <button class="secondary-btn" onclick="criarUsuario()">Voltar</button>
    </div>
  `;
}

async function salvarAcessosUsuario(id){
  const nome=document.getElementById('editNomeAcesso').value.trim();
  const usuario=document.getElementById('editUsuarioAcesso').value.trim().toLowerCase();
  const email=document.getElementById('editEmailAcesso').value.trim();
  const nivel=document.getElementById('editNivelAcesso').value;
  const setor=document.getElementById('editSetorAcesso').value;
  const permissoes=lerPermissoes('editPerm');

  if(!nome || !usuario){ alert('Informe nome e usuário.'); return; }

  const {error}=await db.from('usuarios').update({nome,usuario,email,nivel,setor,permissoes}).eq('id',id);
  if(error){ alert('Erro ao salvar acessos: ' + error.message); return; }

  alert('Acessos atualizados!');
  criarUsuario();
}

function editarMeuUsuario(){
  document.getElementById('title').innerText='Editar Meu Usuário';
  document.getElementById('page').innerHTML=`
    <div class="card form-card">
      <h3>Meus dados</h3>
      <div class="form-grid">
        <input id="editNome" placeholder="Nome" value="${usuarioAtual.nome || ''}">
        <input id="editUsuario" placeholder="Usuário de login" value="${usuarioAtual.usuario || ''}">
        <select id="editSetor">
          ${['Geral','SAC','Logística','Vendas','Marketing'].map(s=>`<option ${s===usuarioAtual.setor?'selected':''}>${s}</option>`).join('')}
        </select>
        <input disabled value="Nível: ${usuarioAtual.nivel || ''}">
      </div>
      <button onclick="salvarMeuUsuario()">Salvar alterações</button>
    </div>
  `;
}

async function salvarMeuUsuario(){
  const nome=document.getElementById('editNome').value.trim();
  const usuario=document.getElementById('editUsuario').value.trim().toLowerCase();
  const setor=document.getElementById('editSetor').value;
  if(!nome || !usuario){ alert('Informe seu nome e usuário.'); return; }

  const {error}=await db.from('usuarios').update({nome,usuario,setor}).eq('id',usuarioAtual.id);
  if(error){ alert('Erro ao salvar: ' + error.message); return; }

  usuarioAtual={...usuarioAtual,nome,usuario,setor};
  atualizarUserInfo();
  aplicarPermissoes();
  alert('Usuário atualizado!');
}

async function planoCarreira(){
  document.getElementById('title').innerText='Plano de Carreira';
  const {data:funcs}=await db.from('funcionarios').select('*').order('pontos',{ascending:false});
  ultimoPlanoCarreira = funcs || [];

  document.getElementById('page').innerHTML=`
    <div class="card export-card no-export">
      <h3>Exportar Plano de Carreira</h3>
      <p class="muted">Exporte em imagem, PDF, Word, CSV ou imprima.</p>
      <button onclick="exportarPlanoImagem()">Exportar imagem</button>
      <button onclick="exportarPlanoPDF()">Exportar PDF</button>
      <button onclick="exportarPlanoWord()">Exportar Word</button>
      <button onclick="exportarPlanoCSV()">Exportar CSV</button>
      <button onclick="window.print()">Imprimir</button>
    </div>
    <div id="planoExportArea">
      <div class="grid carreira-grid">
        <div class="card"><h3>Iniciante</h3><div class="value">0+</div><p class="muted">Começo da jornada.</p></div>
        <div class="card"><h3>Bronze</h3><div class="value">100+</div><p class="muted">Primeira evolução.</p></div>
        <div class="card"><h3>Prata</h3><div class="value">300+</div><p class="muted">Bom desempenho.</p></div>
        <div class="card"><h3>Ouro</h3><div class="value">600+</div><p class="muted">Alto desempenho.</p></div>
      </div>
      <div class="card">
        <h3>Funcionários por evolução</h3>
        <table class="table">
          <tr><th>Nome</th><th>Setor</th><th>Pontos</th><th>Nível de carreira</th></tr>
          ${(funcs||[]).map(f=>`<tr><td>${f.nome}</td><td>${f.setor||'-'}</td><td>${f.pontos||0}</td><td>${nivelCarreira(f.pontos||0)}</td></tr>`).join('')}
        </table>
      </div>
    </div>
  `;
}

function nivelCarreira(pontos){
  if(pontos>=600) return 'Ouro';
  if(pontos>=300) return 'Prata';
  if(pontos>=100) return 'Bronze';
  return 'Iniciante';
}

function baixarArquivo(blob, nome){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function capturarPlano(){
  const area=document.getElementById('planoExportArea');
  if(!area){ alert('Abra o Plano de Carreira primeiro.'); return null; }
  return await html2canvas(area,{backgroundColor:'#07110f',scale:2});
}

async function exportarPlanoImagem(){
  const canvas=await capturarPlano();
  if(!canvas) return;
  canvas.toBlob(blob=>baixarArquivo(blob,'plano-de-carreira.png'));
}

async function exportarPlanoPDF(){
  const canvas=await capturarPlano();
  if(!canvas) return;
  const img=canvas.toDataURL('image/png');
  const { jsPDF } = window.jspdf;
  const pdf=new jsPDF('p','mm','a4');
  const pageWidth=210;
  const imgWidth=190;
  const imgHeight=(canvas.height*imgWidth)/canvas.width;
  pdf.addImage(img,'PNG',10,10,imgWidth,imgHeight > 277 ? 277 : imgHeight);
  pdf.save('plano-de-carreira.pdf');
}

async function exportarPlanoWord(){
  if(!window.docx){ alert('Biblioteca Word não carregada.'); return; }
  const {Document,Packer,Paragraph,Table,TableRow,TableCell,WidthType,TextRun}=window.docx;
  const linhas=[
    new TableRow({children:['Nome','Setor','Pontos','Nível de carreira'].map(t=>new TableCell({children:[new Paragraph({children:[new TextRun({text:t,bold:true})]})]}))}),
    ...ultimoPlanoCarreira.map(f=>new TableRow({children:[
      new TableCell({children:[new Paragraph(String(f.nome || ''))]}),
      new TableCell({children:[new Paragraph(String(f.setor || '-'))]}),
      new TableCell({children:[new Paragraph(String(f.pontos || 0))]}),
      new TableCell({children:[new Paragraph(nivelCarreira(f.pontos || 0))]})
    ]}))
  ];
  const doc=new Document({sections:[{children:[
    new Paragraph({children:[new TextRun({text:'InnoCarrer - Plano de Carreira',bold:true,size:32})]}),
    new Paragraph('Níveis: Iniciante 0+, Bronze 100+, Prata 300+, Ouro 600+'),
    new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:linhas})
  ]}]});
  const blob=await Packer.toBlob(doc);
  baixarArquivo(blob,'plano-de-carreira.docx');
}

function exportarPlanoCSV(){
  const linhas=[['Nome','Setor','Pontos','Nível de carreira'],...ultimoPlanoCarreira.map(f=>[f.nome || '', f.setor || '-', f.pontos || 0, nivelCarreira(f.pontos || 0)])];
  const csv=linhas.map(l=>l.map(v=>`"${String(v).replaceAll('"','""')}"`).join(';')).join('\n');
  baixarArquivo(new Blob([csv],{type:'text/csv;charset=utf-8'}),'plano-de-carreira.csv');
}
