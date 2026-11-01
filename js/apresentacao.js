/* ==========================================================
   VTD DESIGN — Apresentação interativa
   Carrega apresentacao.json e monta: abertura, perfil/feed,
   visualização de posts, stories e tela final.
   ========================================================== */
(function () {
  'use strict';

  const ARQUIVO_CONFIG = 'apresentacao.json';

  /* Configuração de reserva, usada apenas se o JSON não puder ser lido */
  const CONFIG_RESERVA = {
    titulo: 'VTD DESIGN',
    intervaloStories: 5000,
    intro: { logo: 'assets/vtd-logo.png', texto: 'TOQUE NA TELA' },
    perfil: {
      nome: 'VTD DESIGN',
      usuario: '@vtddesign',
      avatar: 'assets/vtd-logo.png',
      bio: 'Design gráfico para a sua marca.',
      botao: 'FAÇA SEU ORÇAMENTO'
    },
    postFeed: [],
    stories: [],
    final: {
      logo: 'assets/vtd-logo.png',
      texto: 'VAMOS CRIAR ALGO JUNTOS?',
      botao: 'FAÇA SEU ORÇAMENTO',
      link: 'https://wa.link/up0y8b'
    }
  };

  /* ---------- Utilidades ---------- */
  const $ = (id) => document.getElementById(id);

  function texto(el, valor) { if (el) el.textContent = valor || ''; }

  function mostrarAviso(msg) {
    const aviso = $('aviso');
    if (!aviso) return;
    aviso.textContent = msg;
    aviso.hidden = false;
    clearTimeout(mostrarAviso._t);
    mostrarAviso._t = setTimeout(() => { aviso.hidden = true; }, 6000);
  }

  /* Cria uma imagem que se recupera sozinha se o arquivo não existir */
  function criarImagem(src, alt, classe) {
    const img = document.createElement('img');
    img.alt = alt || '';
    if (classe) img.className = classe;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.onerror = () => {
      img.onerror = null;
      img.classList.add('erro');
      img.alt = 'Imagem indisponível';
      img.removeAttribute('src');
    };
    img.src = src;
    return img;
  }

  /* Ajusta uma imagem já existente (ex.: viewers) quando troca de src */
  function definirImagem(img, src, alt) {
    img.classList.remove('erro');
    img.alt = alt || '';
    img.onerror = () => {
      img.onerror = null;
      img.classList.add('erro');
      img.alt = 'Imagem indisponível';
      img.removeAttribute('src');
    };
    img.src = src;
  }

  /* Normaliza o JSON: aceita o objeto com ou sem a chave "apresentacao" */
  function normalizar(dados) {
    const base = dados && dados.apresentacao ? dados.apresentacao : dados;
    const reserva = CONFIG_RESERVA;
    const lista = (v) => (Array.isArray(v) ? v.filter((s) => typeof s === 'string' && s.trim()) : []);
    return {
      titulo: base.titulo || reserva.titulo,
      intervaloStories: Number(base.intervaloStories) > 0 ? Number(base.intervaloStories) : reserva.intervaloStories,
      intro: { ...reserva.intro, ...(base.intro || {}) },
      perfil: { ...reserva.perfil, ...(base.perfil || {}) },
      postFeed: lista(base.postFeed),
      stories: lista(base.stories),
      final: { ...reserva.final, ...(base.final || {}) }
    };
  }

  async function carregarConfiguracao() {
    try {
      const resposta = await fetch(ARQUIVO_CONFIG, { cache: 'no-cache' });
      if (!resposta.ok) throw new Error('HTTP ' + resposta.status);
      const dados = await resposta.json();
      return normalizar(dados);
    } catch (erro) {
      console.warn('[VTD] Não foi possível carregar apresentacao.json:', erro);
      mostrarAviso('Não foi possível carregar a configuração. Exibindo conteúdo padrão.');
      return normalizar(CONFIG_RESERVA);
    }
  }

  /* ---------- Estado global ---------- */
  let cfg = null;
  let telaAtual = 'tela-intro';
  let postAtual = 0;

  /* ---------- Telas ---------- */
  function mostrarTela(id) {
    if (telaAtual === id) return;
    const anterior = $(telaAtual);
    const nova = $(id);
    if (anterior) anterior.classList.remove('ativa');
    if (nova) nova.classList.add('ativa');
    telaAtual = id;
    if (anterior) anterior.setAttribute('aria-hidden', 'true');
    if (nova) nova.removeAttribute('aria-hidden');
  }

  /* ---------- Montagem ---------- */
  function montarAbertura() {
    const logo = $('intro-logo');
    logo.src = cfg.intro.logo;
    logo.alt = cfg.titulo + ' — logotipo';
    logo.onerror = () => { logo.onerror = null; logo.alt = cfg.titulo; logo.removeAttribute('src'); };
    texto($('intro-texto'), cfg.intro.texto);
  }

  function montarPerfil() {
    const p = cfg.perfil;
    const avatar = $('perfil-avatar');
    avatar.src = p.avatar;
    avatar.alt = 'Foto de perfil ' + p.nome;
    avatar.onerror = () => { avatar.onerror = null; avatar.removeAttribute('src'); avatar.alt = ''; };

    texto($('perfil-nome'), p.nome);
    texto($('perfil-usuario'), p.usuario);
    texto($('perfil-bio'), p.bio);
    texto($('perfil-cta'), p.botao);
    texto($('stat-publicacoes'), cfg.postFeed.length);

    montarStories();
    montarGrade();
  }

  function montarStories() {
    const barra = $('stories-barra');
    barra.innerHTML = '';
    cfg.stories.forEach((src, i) => {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'story-item';
      botao.setAttribute('aria-label', 'Abrir story ' + (i + 1));

      const anel = document.createElement('div');
      anel.className = 'story-anel';
      anel.appendChild(criarImagem(src, 'Story ' + (i + 1), ''));

      const rotulo = document.createElement('span');
      rotulo.className = 'story-rotulo';
      rotulo.textContent = 'Story ' + (i + 1);

      botao.append(anel, rotulo);
      botao.addEventListener('click', () => abrirStories(i));
      barra.appendChild(botao);
    });
    barra.hidden = cfg.stories.length === 0;
  }

  function montarGrade() {
    const grade = $('grade');
    grade.innerHTML = '';
    cfg.postFeed.forEach((src, i) => {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'grade-item';
      botao.style.setProperty('--i', i);
      botao.setAttribute('aria-label', 'Abrir publicação ' + (i + 1));
      botao.appendChild(criarImagem(src, 'Publicação ' + (i + 1)));
      botao.addEventListener('click', () => abrirPost(i));
      grade.appendChild(botao);
    });
  }

  function montarFinal() {
    const f = cfg.final;
    const logo = $('final-logo');
    logo.src = f.logo;
    logo.alt = cfg.titulo + ' — logotipo';
    logo.onerror = () => { logo.onerror = null; logo.removeAttribute('src'); };
    texto($('final-texto'), f.texto);
    const botao = $('final-botao');
    texto(botao, f.botao);
    botao.href = f.link;
    texto($('perfil-cta'), cfg.perfil.botao);
  }

  /* ---------- Visualização de post ---------- */
  const viewerPost = () => $('viewer-post');

  function abrirPost(i) {
    if (!cfg.postFeed.length) return;
    postAtual = Math.max(0, Math.min(i, cfg.postFeed.length - 1));
    viewerPost().hidden = false;
    document.body.style.overflow = 'hidden';
    renderizarPost(null);
    $('post-fechar').focus({ preventScroll: true });
  }

  function fecharPost() {
    viewerPost().hidden = true;
    document.body.style.overflow = '';
    const itens = document.querySelectorAll('.grade-item');
    if (itens[postAtual]) itens[postAtual].focus({ preventScroll: true });
  }

  function irPara(i, direcao) {
    const total = cfg.postFeed.length;
    if (i < 0 || i >= total || i === postAtual) return;
    renderizarPost(direcao || (i > postAtual ? 1 : -1), i);
  }

  /* direcao: 1 = avança (entra pela direita), -1 = volta; alvo opcional */
  function renderizarPost(direcao, alvo) {
    const total = cfg.postFeed.length;
    if (typeof alvo === 'number') postAtual = alvo;
    const quadro = $('post-quadro');
    const img = $('post-imagem');

    quadro.classList.add('arrastando');
    quadro.style.transform = 'translateX(' + (direcao ? direcao * -40 : 0) + '%)';
    quadro.style.opacity = '0';
    requestAnimationFrame(() => {
      definirImagem(img, cfg.postFeed[postAtual], 'Publicação ' + (postAtual + 1));
      quadro.style.transform = 'translateX(' + (direcao ? direcao * 40 : 0) + '%)';
      requestAnimationFrame(() => {
        quadro.classList.remove('arrastando');
        quadro.style.transform = 'translateX(0)';
        quadro.style.opacity = '1';
      });
    });

    texto($('post-contador'), (postAtual + 1) + ' / ' + total);
    $('post-anterior').disabled = postAtual === 0;
    $('post-proximo').disabled = postAtual === total - 1;

    const pontos = $('post-pontos');
    pontos.innerHTML = '';
    if (total <= 12) {
      cfg.postFeed.forEach((_, i) => {
        const p = document.createElement('span');
        p.className = 'ponto' + (i === postAtual ? ' ativo' : '');
        pontos.appendChild(p);
      });
    }
  }

  /* Gestos de arrastar no post */
  function ligarGestosPost() {
    const quadro = $('post-quadro');
    let inicioX = 0;
    let arrastando = false;
    let dx = 0;

    quadro.addEventListener('pointerdown', (e) => {
      arrastando = true;
      inicioX = e.clientX;
      dx = 0;
      quadro.setPointerCapture(e.pointerId);
      quadro.classList.add('arrastando');
    });

    quadro.addEventListener('pointermove', (e) => {
      if (!arrastando) return;
      dx = e.clientX - inicioX;
      const limite = (postAtual === 0 && dx > 0) || (postAtual === cfg.postFeed.length - 1 && dx < 0);
      const deslocamento = limite ? dx * 0.25 : dx; /* resistência nas bordas */
      quadro.style.transform = 'translateX(' + deslocamento + 'px)';
    });

    const soltar = () => {
      if (!arrastando) return;
      arrastando = false;
      quadro.classList.remove('arrastando');
      const limiar = Math.min(60, quadro.clientWidth * 0.15);
      if (dx < -limiar && postAtual < cfg.postFeed.length - 1) {
        irPara(postAtual + 1, 1);
      } else if (dx > limiar && postAtual > 0) {
        irPara(postAtual - 1, -1);
      } else {
        quadro.style.transform = 'translateX(0)';
      }
      dx = 0;
    };
    quadro.addEventListener('pointerup', soltar);
    quadro.addEventListener('pointercancel', soltar);
  }

  /* ---------- Stories ---------- */
  const viewerStory = () => $('viewer-story');
  const story = {
    ativo: false,
    indice: 0,
    decorrido: 0,
    pausado: false,
    ultimoTs: null,
    frame: null,
    duracao: 5000,
    inicioToque: 0,
    xToque: 0,
    moveu: false
  };

  function abrirStories(i) {
    if (!cfg.stories.length) return;
    story.ativo = true;
    story.duracao = cfg.intervaloStories;
    story.indice = Math.max(0, Math.min(i, cfg.stories.length - 1));
    story.decorrido = 0;
    story.pausado = false;
    story.ultimoTs = null;

    texto($('story-nome'), cfg.perfil.nome);
    const av = $('story-avatar');
    av.src = cfg.perfil.avatar;
    av.alt = '';
    av.onerror = () => { av.onerror = null; av.removeAttribute('src'); };

    montarBarrasStory();
    viewerStory().hidden = false;
    document.body.style.overflow = 'hidden';
    carregarStoryAtual();
    cancelAnimationFrame(story.frame);
    story.frame = requestAnimationFrame(loopStory);
  }

  function fecharStories() {
    story.ativo = false;
    cancelAnimationFrame(story.frame);
    viewerStory().hidden = true;
    document.body.style.overflow = '';
  }

  function montarBarrasStory() {
    const barras = $('story-barras');
    barras.innerHTML = '';
    cfg.stories.forEach(() => {
      const b = document.createElement('div');
      b.className = 'story-barra';
      b.appendChild(document.createElement('span'));
      barras.appendChild(b);
    });
    atualizarBarras();
  }

  /* Preenche barras anteriores, zera posteriores e anima a atual */
  function atualizarBarras(progresso) {
    const spans = document.querySelectorAll('#story-barras .story-barra span');
    spans.forEach((s, i) => {
      if (i < story.indice) s.style.width = '100%';
      else if (i > story.indice) s.style.width = '0%';
      else s.style.width = (progresso || 0) * 100 + '%';
    });
  }

  function carregarStoryAtual() {
    const palco = $('story-imagem');
    definirImagem(palco, cfg.stories[story.indice], 'Story ' + (story.indice + 1));
    /* reinicia a animação de zoom */
    palco.style.animation = 'none';
    void palco.offsetWidth;
    palco.style.animation = '';
    atualizarBarras(0);
  }

  function proximoStory() {
    if (story.indice < cfg.stories.length - 1) {
      story.indice++;
      story.decorrido = 0;
      carregarStoryAtual();
    } else {
      /* terminou os stories: segue para a tela final */
      fecharStories();
      mostrarTela('tela-final');
    }
  }

  function anteriorStory() {
    if (story.decorrido > 400 || story.indice === 0) {
      /* reinicia o story atual (ou o primeiro) */
      story.decorrido = 0;
      carregarStoryAtual();
    } else {
      story.indice--;
      story.decorrido = 0;
      carregarStoryAtual();
    }
  }

  function loopStory(ts) {
    if (!story.ativo) return;
    if (story.ultimoTs === null) story.ultimoTs = ts;
    const dt = ts - story.ultimoTs;
    story.ultimoTs = ts;

    if (!story.pausado && !document.hidden) story.decorrido += dt;

    const p = Math.min(story.decorrido / story.duracao, 1);
    atualizarBarras(p);

    if (p >= 1) {
      proximoStory();
      if (!story.ativo) return;
    }
    story.frame = requestAnimationFrame(loopStory);
  }

  function ligarGestosStory() {
    const palco = $('story-palco');

    palco.addEventListener('pointerdown', (e) => {
      story.pausado = true;
      story.inicioToque = Date.now();
      story.xToque = e.clientX;
      story.moveu = false;
      palco.setPointerCapture(e.pointerId);
    });

    palco.addEventListener('pointermove', (e) => {
      if (!story.pausado) return;
      if (Math.abs(e.clientX - story.xToque) > 12) story.moveu = true;
    });

    const soltar = (e) => {
      if (!story.pausado) return;
      story.pausado = false;
      story.ultimoTs = null;
      const dx = e.clientX - story.xToque;
      const duracaoToque = Date.now() - story.inicioToque;

      if (story.moveu && dx < -60) {
        proximoStory();
      } else if (story.moveu && dx > 60) {
        anteriorStory();
      } else if (!story.moveu && duracaoToque < 300) {
        const meio = palco.clientWidth * 0.35;
        const x = e.clientX - palco.getBoundingClientRect().left;
        if (x < meio) anteriorStory();
        else proximoStory();
      }
    };
    palco.addEventListener('pointerup', soltar);
    palco.addEventListener('pointercancel', () => { story.pausado = false; story.ultimoTs = null; });

  }

  /* ---------- Gestos de swipe no post (tela inteira) ---------- */
  function ligarTeclado() {
    document.addEventListener('keydown', (e) => {
      if (!viewerPost().hidden) {
        if (e.key === 'ArrowRight') irPara(postAtual + 1, 1);
        else if (e.key === 'ArrowLeft') irPara(postAtual - 1, -1);
        else if (e.key === 'Escape') fecharPost();
      } else if (story.ativo) {
        if (e.key === 'ArrowRight') proximoStory();
        else if (e.key === 'ArrowLeft') anteriorStory();
        else if (e.key === 'Escape') fecharStories();
      } else if (telaAtual === 'tela-intro' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        iniciar();
      }
    });
  }

  /* ---------- Ações ---------- */
  function iniciar() { mostrarTela('tela-perfil'); }

  function ligarControles() {
    $('btn-iniciar').addEventListener('click', iniciar);
    $('ir-final').addEventListener('click', () => mostrarTela('tela-final'));
    $('final-voltar').addEventListener('click', () => mostrarTela('tela-perfil'));
    $('perfil-cta').addEventListener('click', () => {
      window.open(cfg.final.link, '_blank', 'noopener,noreferrer');
    });

    $('post-fechar').addEventListener('click', fecharPost);
    $('post-anterior').addEventListener('click', () => irPara(postAtual - 1, -1));
    $('post-proximo').addEventListener('click', () => irPara(postAtual + 1, 1));
    viewerPost().addEventListener('click', (e) => {
      if (e.target === viewerPost()) fecharPost();
    });

    $('story-fechar').addEventListener('click', fecharStories);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && story.ativo) story.ultimoTs = null;
    });
  }

  /* ---------- Inicialização ---------- */
  async function iniciarApp() {
    cfg = await carregarConfiguracao();
    document.title = cfg.titulo + ' | Apresentação';

    montarAbertura();
    montarPerfil();
    montarFinal();

    ligarControles();
    ligarGestosPost();
    ligarGestosStory();
    ligarTeclado();

    /* Telas ocultas ficam fora da leitura de leitores de tela */
    document.querySelectorAll('.tela:not(.ativa)').forEach((t) => t.setAttribute('aria-hidden', 'true'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarApp);
  } else {
    iniciarApp();
  }
})();
