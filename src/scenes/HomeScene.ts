import Phaser from 'phaser';
import { COLORS, VIEW } from '../config/GameConfig';
import { saveService } from '../save/SaveService';
import { resolveRunConfig } from '../systems/MetaBonusResolver';
import { backend } from '../services/Backend';

/**
 * Hub shown on launch and after returning from Game Over. Displays the
 * currency balance and routes to Play, Skill Tree, or Characters.
 *
 * M3: kicks off the Supabase backend bootstrap (anonymous sign-in, one-time
 * legacy migration, server-authoritative profile load, outbox drain) and
 * refreshes the currency display once it resolves.
 */
export class HomeScene extends Phaser.Scene {
  private coinsText!: Phaser.GameObjects.Text;
  private gemsText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private charLabel!: Phaser.GameObjects.Text;

  constructor() {
    super('Home');
  }

  create(): void {
    const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
    const cx = VIEW.width / 2;

    // Dark gradient-ish background panel.
    this.add.rectangle(0, 0, VIEW.width, VIEW.height, COLORS.background, 1).setOrigin(0, 0);

    // Decorative top strip.
    this.add.rectangle(0, 0, VIEW.width, 6, COLORS.xpBar, 1).setOrigin(0, 0);

    // Title.
    this.add
      .text(cx, 220, 'BULLET', {
        fontFamily: 'monospace',
        fontSize: '80px',
        fontStyle: 'bold',
        color: hex(COLORS.xpBar)
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 310, 'HEAVEN', {
        fontFamily: 'monospace',
        fontSize: '80px',
        fontStyle: 'bold',
        color: hex(COLORS.text)
      })
      .setOrigin(0.5);

    // Currency bar.
    this.buildCurrencyBar(hex);

    // Main Play button.
    this.buildPlayButton(cx, 620, hex);

    // Secondary navigation buttons.
    const btnY = 760;
    this.buildNavButton(cx - 175, btnY, 300, 80, 'SKILL TREE', hex, () => {
      this.scene.start('SkillTree');
    });
    this.buildNavButton(cx + 175, btnY, 300, 80, 'CHARACTERS', hex, () => {
      this.scene.start('Characters');
    });

    // Selected character label.
    const charId = saveService.get().profile.equippedCharacter;
    this.charLabel = this.add
      .text(cx, 870, `Character: ${charId.toUpperCase()}`, {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: hex(COLORS.textMuted)
      })
      .setOrigin(0.5);

    // Connection status / build label.
    this.statusText = this.add
      .text(cx, VIEW.height - 40, 'connecting…', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: hex(COLORS.textMuted)
      })
      .setOrigin(0.5);

    // Kick off (or refresh) the backend, then update the UI.
    void this.initBackend(hex);
  }

  /** Bootstrap on first launch; lighter refresh on subsequent Home visits. */
  private async initBackend(hex: (c: number) => string): Promise<void> {
    if (!backend.isReady()) {
      await backend.bootstrap();
    } else if (backend.online) {
      await backend.refreshProfile();
    }

    // The scene may have been stopped while we awaited — bail if so.
    if (!this.scene.isActive()) return;

    this.refreshCurrency();

    const charId = saveService.get().profile.equippedCharacter;
    this.charLabel.setText(`Character: ${charId.toUpperCase()}`);

    if (backend.online) {
      this.statusText.setText('online — progress synced').setColor(hex(COLORS.gem));
    } else {
      this.statusText.setText('offline — purchases disabled').setColor(hex(COLORS.enemyFast));
    }
  }

  private refreshCurrency(): void {
    const save = saveService.get();
    this.coinsText.setText(`${save.profile.coins}`);
    this.gemsText.setText(`${save.profile.gems}`);
  }

  private buildCurrencyBar(hex: (c: number) => string): void {
    const save = saveService.get();
    const y = 430;

    this.add
      .rectangle(VIEW.width / 2, y, VIEW.width - 60, 72, COLORS.panel, 1)
      .setStrokeStyle(2, COLORS.panelBorder, 1)
      .setOrigin(0.5);

    // Coins.
    this.add
      .text(90, y, '⬡', { fontFamily: 'monospace', fontSize: '36px', color: hex(COLORS.coin) })
      .setOrigin(0.5);

    this.coinsText = this.add
      .text(160, y, `${save.profile.coins}`, {
        fontFamily: 'monospace',
        fontSize: '32px',
        fontStyle: 'bold',
        color: hex(COLORS.coin)
      })
      .setOrigin(0, 0.5);

    // Gems.
    this.add
      .text(420, y, '◆', { fontFamily: 'monospace', fontSize: '36px', color: hex(COLORS.gem) })
      .setOrigin(0.5);

    this.gemsText = this.add
      .text(490, y, `${save.profile.gems}`, {
        fontFamily: 'monospace',
        fontSize: '32px',
        fontStyle: 'bold',
        color: hex(COLORS.gem)
      })
      .setOrigin(0, 0.5);
  }

  private buildPlayButton(cx: number, cy: number, hex: (c: number) => string): void {
    const w = 400;
    const h = 110;

    const btn = this.add
      .rectangle(cx, cy, w, h, COLORS.xpBar, 1)
      .setStrokeStyle(4, 0xffffff, 0.5)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(cx, cy, 'PLAY', {
        fontFamily: 'monospace',
        fontSize: '54px',
        fontStyle: 'bold',
        color: hex(COLORS.background)
      })
      .setOrigin(0.5);

    btn.on(Phaser.Input.Events.POINTER_OVER, () => btn.setScale(1.04));
    btn.on(Phaser.Input.Events.POINTER_OUT, () => btn.setScale(1));
    btn.on(Phaser.Input.Events.POINTER_DOWN, () => {
      const runConfig = resolveRunConfig(saveService.get());
      this.scene.start('Game', { runConfig });
    });
  }

  private buildNavButton(
    cx: number,
    cy: number,
    w: number,
    h: number,
    label: string,
    hex: (c: number) => string,
    onDown: () => void
  ): void {
    const btn = this.add
      .rectangle(cx, cy, w, h, COLORS.panel, 1)
      .setStrokeStyle(2, COLORS.panelBorder, 1)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(cx, cy, label, {
        fontFamily: 'monospace',
        fontSize: '24px',
        fontStyle: 'bold',
        color: hex(COLORS.text)
      })
      .setOrigin(0.5);

    btn.on(Phaser.Input.Events.POINTER_OVER, () => btn.setFillStyle(COLORS.panelBorder, 1));
    btn.on(Phaser.Input.Events.POINTER_OUT, () => btn.setFillStyle(COLORS.panel, 1));
    btn.on(Phaser.Input.Events.POINTER_DOWN, onDown);
  }
}
