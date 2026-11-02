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
     feed -> stories: deslizam na horizontal (stories entra pela esquerda);
     abertura sobe para o feed; stories sobe para a tela final. */
  const POSICOES = [[0, 0], [0, 1], [-1, 1], [-1, 2]];
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
          /* desktop: o texto do feed sai pela esquerda conforme a galeria avança */
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

    proximo() {
      if (this.galBloq || this.idx >= this.n - 1) return false;
      this.idx++;
      this.aplicar(true);
      this.travarGaleria();
      return true;
    }

    anterior() {
      if (this.galBloq || this.idx <= 0) return false;
      this.idx--;
      this.aplicar(true);
      this.travarGaleria();
      return true;
    }

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
      if (this.galBloq) return;
      if (delta > 0) {
        if (!this.proximo() && this.estaNoFim()) avancarSecao();
      } else if (delta < 0) {
        if (!this.anterior() && this.idx === 0) irSecao(atual - 1);
      }
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
        this.base = this.deslocamento(this.idx);
        this.trilho.classList.add('arrastando');
        try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignorado */ }
      });

      el.addEventListener('pointermove', (e) => {
        if (e.pointerId !== this.ptr) return;
        this.dx = e.clientX - this.x0;
        if (Math.abs(this.dx) > 8) this.moveu = true;
        if (!this.moveu) return;
        /* na primeira e na última imagem, a arte não sai do centro:
           o movimento é quase travado (resistência) */
        const noLimite = (this.idx === 0 && this.dx > 0) || (this.idx === this.n - 1 && this.dx < 0);
        const efetivo = noLimite ? this.dx * 0.15 : this.dx;
        this.trilho.style.transform = 'translate(' + (this.base + efetivo) + 'px, -50%)';
      });

      const finalizar = (e) => {
        if (e.pointerId !== this.ptr) return;
        this.ptr = null;
        if (!this.moveu) {
          this.aplicar(true);
          this.registrarToque();
          return;
        }
        const rapido = Math.abs(this.dx) / Math.max(Date.now() - this.t0, 1) > 0.4;
        const avancar = this.dx < 0 && (this.dx < -40 || (rapido && this.dx < -15));
        const voltar = this.dx > 0 && (this.dx > 40 || (rapido && this.dx > 15));
        let mudou = false;
        if (avancar) mudou = this.proximo();
        else if (voltar) mudou = this.anterior();
        if (!mudou) this.aplicar(true); /* volta para o centro, sem sair da tela */
      };
      el.addEventListener('pointerup', finalizar);
      el.addEventListener('pointercancel', finalizar);
    }
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

  function ligarRedimensionamento() {
    window.addEventListener('resize', () => {
      posicionarSecoes(true);
      galFeed.aplicar(false);
      galStories.aplicar(false);
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
  }

  /* ---------- Inicialização ---------- */
  async function iniciarApp() {
    const cfg = await carregarConfiguracao();
    document.title = cfg.titulo + ' | Apresentação';
    document.body.classList.toggle('modo-toque', window.matchMedia('(pointer: coarse)').matches);

    montarTelas(cfg);

    galFeed = new Galeria($('s-feed'), 'feed-trilho', 'feed-dica', $('feed-texto'), true);
    galStories = new Galeria($('s-stories'), 'story-trilho', 'story-dica', $('stories-texto'), false);

    posicionarSecoes(true);
    galFeed.aplicar(false);
    galStories.aplicar(false);
    ligarAbertura();
    ligarTeclado();
    ligarRolagem();
    ligarRedimensionamento();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarApp);
  } else {
    iniciarApp();
  }
})();
