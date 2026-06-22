import Phaser from 'phaser';
import { COLORS, VIEW } from '../config/GameConfig';
import { saveService } from '../save/SaveService';
import { resolveRunConfig } from '../systems/MetaBonusResolver';
import type { RunResult } from '../types';

/** Final screen: score breakdown, coins earned, Hub and Play Again buttons. */
export class GameOverScene extends Phaser.Scene {
  private result!: RunResult;

  constructor() {
    super('GameOver');
  }

  init(data: RunResult): void {
    this.result = data;
  }

  create(): void {
    const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
    const cx = VIEW.width / 2;

    this.add.rectangle(0, 0, VIEW.width, VIEW.height, 0x000000, 0.82).setOrigin(0, 0);

    this.add
      .text(cx, 210, 'GAME OVER', {
        fontFamily: 'monospace',
        fontSize: '60px',
        fontStyle: 'bold',
        color: hex(COLORS.enemy)
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 310, `SCORE  ${this.result.score}`, {
        fontFamily: 'monospace',
        fontSize: '42px',
        fontStyle: 'bold',
        color: hex(COLORS.text)
      })
      .setOrigin(0.5);

    const lines = [
      `Survived   ${this.formatTime(this.result.survivedMs)}`,
      `Kills      ${this.result.kills}`,
      `Level      ${this.result.level}`
    ];
    this.add
      .text(cx, 440, lines.join('\n'), {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#b9c2d8',
        align: 'left',
        lineSpacing: 14
      })
      .setOrigin(0.5);

    // Coins earned panel
    const panelY = 610;
    this.add
      .rectangle(cx, panelY, VIEW.width - 80, 110, COLORS.panel, 1)
      .setStrokeStyle(2, COLORS.coin, 0.8)
      .setOrigin(0.5);

    this.add
      .text(cx, panelY - 22, 'COINS EARNED', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: hex(COLORS.textMuted)
      })
      .setOrigin(0.5);

    // Server-authoritative when online; a dimmed estimate while offline.
    const coinColor = this.result.isOffline ? COLORS.textMuted : COLORS.coin;
    this.add
      .text(cx, panelY + 20, `+ ${this.result.coinsEarned}`, {
        fontFamily: 'monospace',
        fontSize: '44px',
        fontStyle: 'bold',
        color: hex(coinColor)
      })
      .setOrigin(0.5);

    if (this.result.isOffline) {
      // Offline: coins are a display estimate, queued to sync on next launch.
      this.add
        .text(cx, panelY + 74, 'offline — syncing on next launch…', {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: hex(COLORS.enemyFast)
        })
        .setOrigin(0.5);
    } else {
      // Online: cache was refreshed from the server, so this total is authoritative.
      this.add
        .text(cx, panelY + 76, `Total: ${saveService.get().profile.coins} coins`, {
          fontFamily: 'monospace',
          fontSize: '22px',
          color: hex(COLORS.textMuted)
        })
        .setOrigin(0.5);
    }

    this.buildButton(cx - 180, 810, 300, 90, 'HUB', COLORS.panelBorder, () => this.goHub());
    this.buildButton(cx + 145, 810, 260, 90, 'PLAY AGAIN', COLORS.btnPrimary, () => this.playAgain());
  }

  private buildButton(
    cx: number,
    cy: number,
    w: number,
    h: number,
    label: string,
    color: number,
    onDown: () => void
  ): void {
    const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
    const bg = this.add
      .rectangle(cx, cy, w, h, color, 1)
      .setStrokeStyle(2, 0xffffff, 0.35)
      .setInteractive({ useHandCursor: true });

    const isDark = color === COLORS.panelBorder;
    this.add
      .text(cx, cy, label, {
        fontFamily: 'monospace',
        fontSize: '26px',
        fontStyle: 'bold',
        color: isDark ? hex(COLORS.text) : hex(COLORS.background)
      })
      .setOrigin(0.5);

    bg.on(Phaser.Input.Events.POINTER_OVER, () => bg.setAlpha(0.8));
    bg.on(Phaser.Input.Events.POINTER_OUT, () => bg.setAlpha(1));
    bg.on(Phaser.Input.Events.POINTER_DOWN, onDown);
  }

  private goHub(): void {
    this.scene.stop('GameOver');
    this.scene.stop('HUD');
    this.scene.stop('Game');
    this.scene.start('Home');
  }

  private playAgain(): void {
    const runConfig = resolveRunConfig(saveService.get());
    this.scene.stop('GameOver');
    this.scene.stop('HUD');
    this.scene.start('Game', { runConfig });
  }

  private formatTime(ms: number): string {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60).toString().padStart(2, '0');
    const s = (total % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
}
