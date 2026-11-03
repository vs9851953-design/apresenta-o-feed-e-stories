/* ==========================================================
   VTD DESIGN — Apresentação interativa (4 telas)
   Tela 1 abertura → Tela 2 Post Feed → Tela 3 Stories → Tela 4 orçamento
   Galerias horizontais, transições verticais e "dois toques/cliques"
   ========================================================== */
(function () {
  'use strict';

  const ARQUIVO_CONFIG = 'apresentacao.json';
  const DURACAO_SECAO = 850;     /* ms: transição vertical entre telas */
  const DURACAO_GALERIA = 500;   /* ms: intervalo mínimo entre passos de galeria */
  const JANELA_DOIS_TOQUES = 500; /* ms: intervalo máximo entre dois toques */
  const REVELADAS = new Set();    /* telas do celular cuja capa já foi aberta */

  /* Configuração de reserva, usada só se o JSON não puder ser lido */
  const CONFIG_RESERVA = {
    titulo: 'VTD DESIGN',
    intro: { logo: 'assets/vtd-logo.png', texto: 'TOQUE NA TELA' },
    textos: {
      feed: { titulo: 'POST FEED', descricao: '' },
      stories: { titulo: 'STORIES', descricao: '' }
    },
    postFeed: [],
    stories: [],
    final: {
      logo: 'assets/vtd-logo-escuro.png',
      botao: 'CLIQUE AQUI E FAÇA SEU ORÇAMENTO',
      link: 'https://wa.link/up0y8b'
    }
  };

  const $ = (id) => document.getElementById(id);

  /* ---------- Utilidades ---------- */
  function mostrarAviso(msg) {
    const a = $('aviso');
    if (!a) return;
    a.textContent = msg;
    a.hidden = false;
    clearTimeout(mostrarAviso.t);
    mostrarAviso.t = setTimeout(() => { a.hidden = true; }, 6000);
  }

  /* Imagem que se recupera sozinha se o arquivo não existir */
  function criarImagem(src, alt) {
    const img = document.createElement('img');
    img.alt = alt || '';
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

  /* Título com quebra de linha em cada palavra (POST / FEED) */
  function preencherTitulo(el, texto) {
    el.textContent = '';
    (texto || '').split(' ').forEach((palavra, i, arr) => {
      el.appendChild(document.createTextNode(palavra));
      if (i < arr.length - 1) el.appendChild(document.createElement('br'));
    });
  }

  /* Mantém só as imagens que existem de fato: as demais são ignoradas */
  function carregarLista(lista) {
    return Promise.all(lista.map((src) => new Promise((resolver) => {
      const im = new Image();
      im.onload = () => resolver(src);
      im.onerror = () => resolver(null);
      im.src = src;
    }))).then((res) => res.filter(Boolean));
  }

  /* Normaliza o JSON e completa com a configuração de reserva */
  function normalizar(dados) {
    const base = dados && dados.apresentacao ? dados.apresentacao : (dados || {});
    const lista = (v) => (Array.isArray(v) ? v.filter((s) => typeof s === 'string' && s.trim()) : []);
    return {
      titulo: base.titulo || CONFIG_RESERVA.titulo,
      intro: { ...CONFIG_RESERVA.intro, ...(base.intro || {}) },
      textos: {
        feed: { ...CONFIG_RESERVA.textos.feed, ...((base.textos || {}).feed || {}) },
        stories: { ...CONFIG_RESERVA.textos.stories, ...((base.textos || {}).stories || {}) }
      },
      postFeed: lista(base.postFeed),
      stories: lista(base.stories),
      final: { ...CONFIG_RESERVA.final, ...(base.final || {}) }
    };
  }

  async function carregarConfiguracao() {
    try {
      const r = await fetch(ARQUIVO_CONFIG, { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return normalizar(await r.json());
    } catch (erro) {
      console.warn('[VTD] Não foi possível carregar apresentacao.json:', erro);
      mostrarAviso('Não foi possível carregar a configuração. Exibindo conteúdo padrão.');
      return normalizar(CONFIG_RESERVA);
    }
  }

  /* ---------- Telas verticais ---------- */
  const secoes = ['s-intro', 's-feed', 's-stories', 's-final'].map((id) => $(id));
  /* Posição de cada tela num plano [coluna, linha]:
     feed -> stories: deslizam na horizontal (stories entra pela direita);
     abertura sobe para o feed; stories sobe para a tela final. */
  const POSICOES = [[0, 0], [0, 1], [1, 1], [1, 2]];
  let atual = 0;
  let bloqueio = false;
  let fimBloqueio = null;

  function posicionarSecoes(semAnimacao) {
    const [cx, cy] = POSICOES[atual];
    secoes.forEach((s, i) => {
      const [col, row] = POSICOES[i];
      if (semAnimacao) s.style.transition = 'none';
      s.style.transform = 'translate(' + (col - cx) * 100 + '%, ' + (row - cy) * 100 + '%)';
      s.classList.toggle('ativa', i === atual);
    });
    if (semAnimacao) {
      void document.body.offsetHeight; /* aplica sem animar */
      secoes.forEach((s) => { s.style.transition = ''; });
    }
  }

  function irSecao(n) {
    if (bloqueio || n < 0 || n >= secoes.length || n === atual) return false;
    atual = n;
    posicionarSecoes(false);
    bloqueio = true;
    clearTimeout(fimBloqueio);
    fimBloqueio = setTimeout(() => { bloqueio = false; }, DURACAO_SECAO);
    return true;
  }

  function avancarSecao() { return irSecao(atual + 1); }

  /* ---------- Galeria horizontal ---------- */
  class Galeria {
    constructor(secao, trilhoId, dicaId, textoEl, afastarTexto) {
      this.secao = secao;
      this.galeria = secao.querySelector('.galeria');
      this.trilho = $(trilhoId);
      this.dica = $(dicaId);
      this.texto = textoEl;
      this.afastarTexto = afastarTexto;
      this.itens = [...this.trilho.children];
      this.n = this.itens.length;
      this.idx = 0;
      this.ptr = null;
      this.moveu = false;
      this.ultimoToque = 0;
      this.galBloq = false;
      this.galTimer = null;
      this.ligarGestos();
      this.aplicar(false);
    }

    /* posição do trilho que centraliza o item i na área da galeria */
    deslocamento(i) {
      if (!this.itens[i]) return 0;
      const it = this.itens[i];
      return this.galeria.clientWidth / 2 - (it.offsetLeft + it.offsetWidth / 2);
    }

    aplicar(comAnimacao) {
      this.trilho.classList.toggle('arrastando', !comAnimacao);
      this.trilho.style.transform = 'translate(' + this.deslocamento(this.idx) + 'px, -50%)';
      this.itens.forEach((el, i) => el.classList.toggle('ativo', i === this.idx));

      if (this.texto) {
        if (this.afastarTexto && window.innerWidth >= 720) {
          /* computador: o texto sai pela esquerda conforme a galeria avança */
          const p = Math.min(this.idx / 2, 1);
          this.texto.style.transform = 'translate(' + (-p * 130) + '%, -50%)';
          this.texto.style.opacity = String(Math.max(0, 1 - this.idx * 1.2));
        } else {
          /* celular: o texto fica fixo no centro */
          this.texto.style.transform = '';
          this.texto.style.opacity = '';
        }
      }
      this.dica.classList.toggle('visivel', this.idx === this.n - 1 && this.secao.classList.contains('ativa'));
    }

    travarGaleria() {
      this.galBloq = true;
      clearTimeout(this.galTimer);
      this.galTimer = setTimeout(() => { this.galBloq = false; }, DURACAO_GALERIA);
    }

    /* d = +1 avança, -1 volta. travar = true limita a frequência (usado pelo scroll) */
    passo(d, travar) {
      const novo = this.idx + d;
      if (novo < 0 || novo > this.n - 1) return false;
      if (travar && this.galBloq) return false;
      this.idx = novo;
      this.aplicar(true);
      if (travar) this.travarGaleria();
      return true;
    }

    proximo() { return this.passo(1, true); }
    anterior() { return this.passo(-1, true); }

    estaNoFim() { return this.idx === this.n - 1; }

    /* "Dois toques": no último item, o segundo toque rápido avança a tela */
    registrarToque() {
      if (!this.estaNoFim()) return;
      const agora = Date.now();
      if (agora - this.ultimoToque < JANELA_DOIS_TOQUES) {
        this.ultimoToque = 0;
        avancarSecao();
      } else {
        this.ultimoToque = agora;
      }
    }

    /* Scroll do mouse / trackpad */
    scroll(delta) {
      if (this.secao.classList.contains('capa')) { this.revelar(); return; }
      if (this.galBloq) return;
      if (delta > 0) {
        if (!this.proximo() && this.estaNoFim()) avancarSecao();
      } else if (delta < 0) {
        if (!this.anterior() && this.idx === 0) irSecao(atual - 1);
      }
    }

    /* Celular: tira a capa e mostra o carrossel */
    revelar() {
      this.secao.classList.remove('capa');
      REVELADAS.add(this.secao.id);
    }

    /* posição atual do trilho, mesmo no meio de uma animação */
    posicaoAtual() {
      const m = new DOMMatrixReadOnly(getComputedStyle(this.trilho).transform);
      return m.m41;
    }

    ligarGestos() {
      const el = this.secao;

      el.addEventListener('pointerdown', (e) => {
        if (this.ptr !== null) return;
        this.ptr = e.pointerId;
        this.x0 = e.clientX;
        this.t0 = Date.now();
        this.moveu = false;
        this.dx = 0;
        /* parte de onde o trilho está agora: sem salto mesmo com swipes rápidos */
        this.base = this.posicaoAtual();
        this.trilho.classList.add('arrastando');
        try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignorado */ }
      });

      el.addEventListener('pointermove', (e) => {
        if (e.pointerId !== this.ptr) return;
        this.dx = e.clientX - this.x0;
        if (Math.abs(this.dx) > 8) this.moveu = true;
        if (!this.moveu || el.classList.contains('capa')) return;
        /* primeira e última imagem: quase travadas no centro (resistência) */
        const noLimite = (this.idx === 0 && this.dx > 0) || (this.idx === this.n - 1 && this.dx < 0);
        const efetivo = noLimite ? this.dx * 0.15 : this.dx;
        this.trilho.style.transform = 'translate(' + (this.base + efetivo) + 'px, -50%)';
      });

      const finalizar = (e) => {
        if (e.pointerId !== this.ptr) return;
        this.ptr = null;
        if (el.classList.contains('capa')) {
          if (this.moveu && this.dx > 60) irSecao(atual - 1);
          else this.revelar();
          return;
        }
        if (!this.moveu) {
          this.aplicar(true);
          this.registrarToque();
          return;
        }
        const dx = this.dx;
        const rapido = Math.abs(dx) / Math.max(Date.now() - this.t0, 1) > 0.4;
        const avancar = dx < 0 && (dx < -40 || (rapido && dx < -15));
        const voltar = dx > 0 && (dx > 40 || (rapido && dx > 15));

        if (avancar) {
          if (!this.passo(1, false)) {
            /* já está na última imagem: arrastar mais leva para a próxima tela */
            if (dx < -60) avancarSecao();
            this.aplicar(true);
          }
        } else if (voltar) {
          if (!this.passo(-1, false)) {
            /* já está na primeira imagem: arrastar para o lado volta de tela */
            if (dx > 60) irSecao(atual - 1);
            this.aplicar(true);
          }
        } else {
          this.aplicar(true); /* volta ao centro */
        }
      };
      el.addEventListener('pointerup', finalizar);
      el.addEventListener('pointercancel', finalizar);
    }
  }

  /* Tela final: arrastar para baixo volta para os Stories */
  function ligarVoltaFinal() {
    const sec = $('s-final');
    let y0 = null;
    sec.addEventListener('pointerdown', (e) => { if (atual === 3) y0 = e.clientY; });
    /* ouve a soltura na janela inteira, para não perder o gesto sobre o botão */
    window.addEventListener('pointerup', (e) => {
      if (y0 !== null && atual === 3 && e.clientY - y0 > 60) irSecao(2);
      y0 = null;
    });
  }

  /* ---------- Abertura ---------- */
  function ligarAbertura() {
    const abertura = $('s-intro');
    const iniciar = () => irSecao(1);
    abertura.addEventListener('click', iniciar);
    abertura.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); iniciar(); }
    });
  }

  /* ---------- Entradas globais ---------- */
  let galFeed = null;
  let galStories = null;

  function ligarTeclado() {
    document.addEventListener('keydown', (e) => {
      if (atual === 1) {
        if (e.key === 'ArrowRight') galFeed.proximo();
        else if (e.key === 'ArrowLeft') galFeed.anterior();
        else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
          if (galFeed.estaNoFim()) avancarSecao();
        }
        else if (e.key === 'ArrowUp' || e.key === 'PageUp') irSecao(atual - 1);
      } else if (atual === 2) {
        if (e.key === 'ArrowRight') galStories.proximo();
        else if (e.key === 'ArrowLeft') galStories.anterior();
        else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
          if (galStories.estaNoFim()) avancarSecao();
        }
        else if (e.key === 'ArrowUp' || e.key === 'PageUp') irSecao(atual - 1);
      } else if (atual === 3 && (e.key === 'ArrowUp' || e.key === 'PageUp')) {
        irSecao(2);
      }
    });
  }

  function ligarRolagem() {
    window.addEventListener('wheel', (e) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 20) return;
      if (atual === 0) { if (delta > 0) irSecao(1); }
      else if (atual === 1) galFeed.scroll(delta);
      else if (atual === 2) galStories.scroll(delta);
      else if (atual === 3) { if (delta < 0) irSecao(2); }
    }, { passive: true });
  }

  /* No celular, as imagens ocupam a altura que sobra abaixo do texto.
     No computador, a altura volta a ser a definida pelo CSS. */
  function ajustarAlturas() {
    const celular = window.innerWidth < 720;
    [galFeed, galStories].forEach((g) => {
      if (!g) return;
      /* feed 4:5 (largura = 0,8 da altura); stories 9:16 (largura = 0,5625 da altura) */
      const eStories = g.secao.id === 's-stories';
      const maxPelaLargura = window.innerWidth * (eStories ? 1.28 : 0.9);
      const altura = Math.max(170, Math.min(g.galeria.clientHeight * 0.72, maxPelaLargura));
      g.itens.forEach((el) => { el.style.height = celular ? altura + 'px' : ''; });
      g.aplicar(false);
    });
  }

  /* Celular: cada tela começa com a capa (título e texto); o desktop não usa capa */
  function aplicarCapas() {
    const celular = window.innerWidth < 720;
    ['s-feed', 's-stories'].forEach((id) => {
      const sec = $(id);
      sec.classList.toggle('capa', celular && !REVELADAS.has(id));
    });
  }

  function ligarRedimensionamento() {
    window.addEventListener('resize', () => {
      posicionarSecoes(true);
      aplicarCapas();
      ajustarAlturas();
    });
  }

  /* ---------- Montagem a partir do JSON ---------- */
  function montarTelas(cfg) {
    /* Abertura */
    const logo = $('intro-logo');
    logo.src = cfg.intro.logo;
    logo.alt = cfg.titulo + ' — logotipo';
    logo.onerror = () => { logo.onerror = null; logo.removeAttribute('src'); };
    $('intro-texto').textContent = cfg.intro.texto;

    /* Post Feed */
    preencherTitulo($('feed-titulo'), cfg.textos.feed.titulo);
    $('feed-descricao').textContent = cfg.textos.feed.descricao;
    const trilhoFeed = $('feed-trilho');
    trilhoFeed.innerHTML = '';
    cfg.postFeed.forEach((src, i) => {
      const item = document.createElement('div');
      item.className = 'item';
      item.style.setProperty('--i', i);
      item.appendChild(criarImagem(src, 'Publicação ' + (i + 1)));
      trilhoFeed.appendChild(item);
    });

    /* Stories */
    preencherTitulo($('stories-titulo'), cfg.textos.stories.titulo);
    $('stories-descricao').textContent = cfg.textos.stories.descricao;
    const trilhoStories = $('story-trilho');
    trilhoStories.innerHTML = '';
    cfg.stories.forEach((src, i) => {
      const item = document.createElement('div');
      item.className = 'item';
      item.style.setProperty('--i', i);
      item.appendChild(criarImagem(src, 'Story ' + (i + 1)));
      trilhoStories.appendChild(item);
    });

    /* Tela final */
    const logoFinal = $('final-logo');
    logoFinal.src = cfg.final.logo;
    logoFinal.alt = cfg.titulo + ' — logotipo';
    logoFinal.onerror = () => { logoFinal.onerror = null; logoFinal.removeAttribute('src'); };
    const botao = $('final-botao');
    botao.textContent = cfg.final.botao;
    botao.href = cfg.final.link;
    botao.draggable = false;
  }

  /* ---------- Inicialização ---------- */
  async function iniciarApp() {
    const cfg = await carregarConfiguracao();
    document.title = cfg.titulo + ' | Apresentação';
    /* só entram na apresentação as imagens que existem na pasta */
    const [feedOk, storiesOk] = await Promise.all([carregarLista(cfg.postFeed), carregarLista(cfg.stories)]);
    cfg.postFeed = feedOk;
    cfg.stories = storiesOk;
    document.body.classList.toggle('modo-toque', window.matchMedia('(pointer: coarse)').matches);

    montarTelas(cfg);

    galFeed = new Galeria($('s-feed'), 'feed-trilho', 'feed-dica', $('feed-texto'), true);
    galStories = new Galeria($('s-stories'), 'story-trilho', 'story-dica', $('stories-texto'), true);

    posicionarSecoes(true);
    aplicarCapas();
    ajustarAlturas();
    /* com as fontes carregadas, o texto muda de altura: recalcula o espaço da galeria */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustarAlturas);
    ligarAbertura();
    ligarTeclado();
    ligarRolagem();
    ligarRedimensionamento();
    ligarVoltaFinal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarApp);
  } else {
    iniciarApp();
  }
})();
