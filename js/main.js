'use strict';
/* Arranque, menú principal y cableado de botones */

document.addEventListener('DOMContentLoaded', () => {
  loadSave();
  /* sin ficha de paciente: primero el registro */
  showScreen(Save.profile ? 'main-menu' : 'register-screen');

  /* registro de la ficha de ingreso */
  const doRegister = () => {
    const name = document.getElementById('reg-name').value.trim();
    if (name.length < 2) {
      document.getElementById('reg-hint').textContent =
        'El Director necesita un nombre de al menos 2 letras.';
      return;
    }
    const p = registerUser(name);
    showScreen('main-menu');
    banner(`🏥 Ingreso completado: ${p.name} · paciente ${p.id}`);
  };
  document.getElementById('btn-register').addEventListener('click', doRegister);
  document.getElementById('reg-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') doRegister();
  });

  /* menú principal */
  document.getElementById('btn-play').addEventListener('click', () => {
    Sfx.ensure(); // desbloquea el audio con el gesto del usuario
    activeStoryEnemy = null;
    showScreen('story-screen');
  });
  document.getElementById('btn-story-back').addEventListener('click', () => {
    activeStoryEnemy = null;
    showScreen('main-menu');
  });
  document.getElementById('btn-decks').addEventListener('click', () => showScreen('deck-screen'));
  document.getElementById('btn-shop').addEventListener('click', () => showScreen('shop-screen'));
  document.getElementById('btn-settings').addEventListener('click', () => showScreen('settings-screen'));

  /* botones «volver» */
  document.querySelectorAll('[data-back]').forEach(b =>
    b.addEventListener('click', () => { hidePreview(); showScreen('main-menu'); }));

  /* gestor de mazos */
  document.getElementById('btn-deck-auto').addEventListener('click', autoCompleteDeck);
  document.getElementById('btn-deck-save').addEventListener('click', saveDeck);
  document.getElementById('btn-hero-cycle').addEventListener('click', cycleHero);
  document.getElementById('deck-hero-window').addEventListener('click', cycleHero);

  /* desplegable de mazos: clic en el nombre lo abre; doble clic renombra */
  document.getElementById('deck-title').addEventListener('click', toggleDeckDropdown);
  document.getElementById('deck-title').addEventListener('dblclick', renameActiveDeck);
  document.addEventListener('pointerdown', e => {
    if (!e.target.closest('#deck-dropdown') && !e.target.closest('#deck-title')) {
      closeDeckDropdown();
    }
  });

  /* tienda: paginación de 3 en 3 */
  document.getElementById('shop-prev').addEventListener('click', () => { shopPage--; renderShop(); });
  document.getElementById('shop-next').addEventListener('click', () => { shopPage++; renderShop(); });

  /* ajustes */
  document.getElementById('set-sound').addEventListener('click', () => toggleSetting('sound'));
  document.getElementById('set-fast').addEventListener('click', () => toggleSetting('fastAI'));
  document.getElementById('set-log').addEventListener('click', () => toggleSetting('showLog'));
  document.getElementById('btn-reset-save').addEventListener('click', resetSave);

  /* código de progreso: llevar la ficha a otro dispositivo */
  document.getElementById('btn-export-save').addEventListener('click', () => {
    const code = exportProgressCode();
    const done = () => banner('📋 Código copiado: pégalo en «Cargar código» en el otro dispositivo');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done, () => prompt('Copia tu código de progreso:', code));
    } else {
      prompt('Copia tu código de progreso:', code);
    }
  });
  document.getElementById('btn-import-save').addEventListener('click', () => {
    const code = prompt('Pega aquí el código de progreso del otro dispositivo:');
    if (code === null || !code.trim()) return;
    if (!confirm('Esto SUSTITUYE el progreso de este dispositivo por el del código. ¿Continuar?')) return;
    if (importProgressCode(code)) location.reload();
    else banner('❌ Ese código no es válido');
  });

  /* sobres (pestaña dentro de la tienda; el propio sobre es el botón) */
  document.getElementById('tab-decks').addEventListener('click', () => shopShowTab('decks'));
  document.getElementById('tab-packs').addEventListener('click', () => shopShowTab('packs'));

  /* jugar online */
  document.getElementById('btn-online').addEventListener('click', () => {
    activeStoryEnemy = null;
    showScreen('online-screen');
    mpUpdateOnlineUI();
  });
  document.getElementById('btn-host').addEventListener('click', mpHostStart);
  document.getElementById('btn-join').addEventListener('click', () =>
    mpJoin(document.getElementById('join-ip').value.trim()));
  document.getElementById('join-ip').addEventListener('keydown', e => {
    if (e.key === 'Enter') mpJoin(e.target.value.trim());
  });
  document.getElementById('btn-online-back').addEventListener('click', mpLeave);

  /* fin de partida (en online, ambos botones vuelven al menú) */
  document.getElementById('btn-restart').addEventListener('click', () => {
    if (MP.active || MP.role) { mpLeave(); return; }
    startGame();
  });
  document.getElementById('btn-to-menu').addEventListener('click', () => {
    if (MP.active || MP.role) { mpLeave(); return; }
    activeStoryEnemy = null;
    showScreen('main-menu');
  });
  /* modo historia: continuar al siguiente enemigo (revela con animación) */
  document.getElementById('btn-continue-story').addEventListener('click', () => {
    activeStoryEnemy = null;
    document.getElementById('end-overlay').classList.add('hidden');
    showScreen('story-screen');
  });

  /* modo historia: saltar la intro */
  document.getElementById('intro-skip').addEventListener('click', () => { introSkip = true; });

  /* menú de pausa */
  document.getElementById('btn-pause').addEventListener('click', openPause);
  document.getElementById('btn-resume').addEventListener('click', closePause);
  document.getElementById('btn-restart-game').addEventListener('click', restartGame);
  document.getElementById('btn-surrender').addEventListener('click', surrenderGame);
  document.getElementById('p-set-sound').addEventListener('click', () => { toggleSetting('sound'); renderPauseToggles(); });
  document.getElementById('p-set-fast').addEventListener('click', () => { toggleSetting('fastAI'); renderPauseToggles(); });
  document.getElementById('p-set-log').addEventListener('click', () => { toggleSetting('showLog'); renderPauseToggles(); });

  /* partida */
  document.getElementById('end-turn').addEventListener('click', onEndTurn);
  document.getElementById('log-toggle').addEventListener('click', () => {
    document.getElementById('log').classList.toggle('hidden');
  });

  /* contenedores con el marco modular de piezas box_* */
  document.querySelectorAll('.menu-box').forEach(b => box9(b));
  box9(document.getElementById('shop-packs-panel'));

  /* inspector de carta en grande (falso 3D) */
  initCardInspector();

  /* pantalla completa en navegador */
  document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => { updateFsButton(); fitStage(); });
  document.addEventListener('webkitfullscreenchange', () => { updateFsButton(); fitStage(); });
  updateFsButton();

  fitStage();
  window.addEventListener('resize', fitStage);
  window.addEventListener('orientationchange', () => setTimeout(fitStage, 120));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fitStage);
});
