import Phaser from 'phaser';
import { CHARACTERS, COLORS, VIEW } from '../config/GameConfig';
import { saveService } from '../save/SaveService';
import { backend } from '../services/Backend';
import type { CharacterId } from '../types';

const CARD_W = 620;
const CARD_H = 200;
const CARD_GAP = 22;
const LIST_TOP = 210;

/**
 * Shows the three character cards. Locked characters display their coin cost
 * and an Unlock button. Owned characters show a Select button; the currently
 * equipped one is highlighted.
 */
export class CharactersScene extends Phaser.Scene {
  private coinsBadge!: Phaser.GameObjects.Text;
  private statusBadge!: Phaser.GameObjects.Text;
  private readonly cardRefreshers = new Map<CharacterId, () => void>();

  constructor() {
    super('Characters');
  }

  create(): void {
    const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
    const cx = VIEW.width / 2;

    this.add.rectangle(0, 0, VIEW.width, VIEW.height, COLORS.background, 1).setOrigin(0, 0);
    this.add.rectangle(0, 0, VIEW.width, 6, COLORS.xpBar, 1).setOrigin(0, 0);

    this.add
      .text(cx, 70, 'CHARACTERS', {
        fontFamily: 'monospace',
        fontSize: '48px',
        fontStyle: 'bold',
        color: hex(COLORS.text)
      })
      .setOrigin(0.5);

    this.coinsBadge = this.add
      .text(VIEW.width - 50, 140, this.coinsLabel(), {
        fontFamily: 'monospace',
        fontSize: '28px',
        fontStyle: 'bold',
        color: hex(COLORS.coin)
      })
      .setOrigin(1, 0.5);

    // Offline note — unlock / select mutate the cloud profile, disabled offline.
    this.statusBadge = this.add
      .text(50, 140, '', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: hex(COLORS.enemyFast)
      })
      .setOrigin(0, 0.5);
    if (!backend.online) this.statusBadge.setText('OFFLINE — changes disabled');

    const charIds: CharacterId[] = ['ranger', 'bruiser', 'phantom'];
    charIds.forEach((id, i) => {
      const y = LIST_TOP + i * (CARD_H + CARD_GAP) + CARD_H / 2;
      this.buildCharCard(id, cx, y, hex);
    });

    this.buildBackButton(hex);
  }

  private refreshAll(): void {
    this.coinsBadge.setText(this.coinsLabel());
    this.cardRefreshers.forEach((fn) => fn());
  }

  /**
   * Server-authoritative unlock / equip: apply locally, then push up. On a push
   * failure, reload from the server to snap back. Disabled while offline since
   * both actions mutate the authoritative profile.
   */
  private async attemptAction(id: CharacterId, cost: number): Promise<void> {
    if (!backend.online) return;
    const save = saveService.get();
    if (save.profile.equippedCharacter === id) return;

    const owned = save.characters.includes(id);
    if (owned) {
      saveService.equipCharacter(id);
    } else {
      if (save.profile.coins < cost) return;
      saveService.spendCoins(cost);
      saveService.unlockCharacter(id);
      saveService.equipCharacter(id);
    }
    this.refreshAll();

    const ok = await backend.pushProgress();
    if (!ok && this.scene.isActive()) {
      await backend.refreshProfile();
      if (this.scene.isActive()) {
        this.statusBadge.setText('sync failed — try again');
        this.refreshAll();
      }
    }
  }

  private buildCharCard(
    id: CharacterId,
    cx: number,
    cy: number,
    hex: (c: number) => string
  ): void {
    const def = CHARACTERS[id];

    const bg = this.add
      .rectangle(cx, cy, CARD_W, CARD_H, COLORS.panel, 1)
      .setStrokeStyle(2, COLORS.panelBorder, 1);

    // Character avatar circle.
    const avatarX = cx - CARD_W / 2 + 56;
    this.add.circle(avatarX, cy, 38, def.color, 1);
    this.add.circle(avatarX, cy, 38, 0, 0).setStrokeStyle(3, def.color, 0.6);

    // Name.
    const nameText = this.add
      .text(cx - CARD_W / 2 + 114, cy - 58, def.name.toUpperCase(), {
        fontFamily: 'monospace',
        fontSize: '28px',
        fontStyle: 'bold',
        color: hex(COLORS.text)
      })
      .setOrigin(0, 0.5);

    void nameText;

    // Description + passive labels.
    const descY = cy - 18;
    this.add
      .text(cx - CARD_W / 2 + 114, descY, def.description, {
        fontFamily: 'monospace',
        fontSize: '19px',
        color: hex(COLORS.textMuted),
        wordWrap: { width: CARD_W - 230 }
      })
      .setOrigin(0, 0.5);

    const weaponLabel = `Weapon: ${def.startingWeapon.id.toUpperCase()}`;
    this.add
      .text(cx - CARD_W / 2 + 114, cy + 34, weaponLabel, {
        fontFamily: 'monospace',
        fontSize: '19px',
        color: hex(COLORS.textMuted)
      })
      .setOrigin(0, 0.5);

    // Action button (right side).
    const btnX = cx + CARD_W / 2 - 80;
    const actionBtn = this.add
      .rectangle(btnX, cy, 130, 64, COLORS.panel, 1)
      .setStrokeStyle(2, COLORS.panelBorder, 1)
      .setInteractive({ useHandCursor: true });

    const actionLabel = this.add
      .text(btnX, cy, '', {
        fontFamily: 'monospace',
        fontSize: '22px',
        fontStyle: 'bold',
        color: hex(COLORS.text)
      })
      .setOrigin(0.5);

    const costBadge = this.add
      .text(cx + CARD_W / 2 - 160, cy + 60, '', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: hex(COLORS.coin)
      })
      .setOrigin(0.5);

    const refresh = (): void => {
      const save = saveService.get();
      const owned = save.characters.includes(id);
      const equipped = save.profile.equippedCharacter === id;

      bg.setStrokeStyle(3, equipped ? def.color : COLORS.panelBorder, equipped ? 1 : 1);

      if (equipped) {
        actionBtn.setFillStyle(def.color, 1).disableInteractive();
        actionLabel.setText('ACTIVE').setColor(hex(COLORS.background));
        costBadge.setText('');
      } else if (owned) {
        // Selecting an owned character requires an online connection.
        const enabled = backend.online;
        actionBtn
          .setFillStyle(COLORS.panel, 1)
          .setStrokeStyle(2, enabled ? def.color : COLORS.panelBorder, 0.9)
          .setInteractive({ useHandCursor: true });
        actionLabel.setText('SELECT').setColor(enabled ? hex(def.color) : hex(COLORS.textMuted));
        costBadge.setText('');
      } else {
        const canBuy = backend.online && save.profile.coins >= def.cost;
        actionBtn
          .setFillStyle(canBuy ? COLORS.xpBar : COLORS.panelBorder, 1)
          .setInteractive({ useHandCursor: true });
        actionLabel
          .setText('UNLOCK')
          .setColor(canBuy ? hex(COLORS.background) : hex(COLORS.textMuted));
        costBadge.setText(`⬡ ${def.cost}`).setColor(canBuy ? hex(COLORS.coin) : '#ff5a6e');
      }
    };

    this.cardRefreshers.set(id, refresh);
    refresh();

    actionBtn.on(Phaser.Input.Events.POINTER_OVER, () => actionBtn.setAlpha(0.8));
    actionBtn.on(Phaser.Input.Events.POINTER_OUT, () => actionBtn.setAlpha(1));
    actionBtn.on(Phaser.Input.Events.POINTER_DOWN, () => {
      void this.attemptAction(id, def.cost);
    });
  }

  private buildBackButton(hex: (c: number) => string): void {
    const cx = VIEW.width / 2;
    const btnY = LIST_TOP + 3 * (CARD_H + CARD_GAP) + 20;

    const btn = this.add
      .rectangle(cx, btnY, 260, 80, COLORS.panel, 1)
      .setStrokeStyle(2, COLORS.panelBorder, 1)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(cx, btnY, '← BACK', {
        fontFamily: 'monospace',
        fontSize: '26px',
        fontStyle: 'bold',
        color: hex(COLORS.text)
      })
      .setOrigin(0.5);

    btn.on(Phaser.Input.Events.POINTER_OVER, () => btn.setFillStyle(COLORS.panelBorder, 1));
    btn.on(Phaser.Input.Events.POINTER_OUT, () => btn.setFillStyle(COLORS.panel, 1));
    btn.on(Phaser.Input.Events.POINTER_DOWN, () => this.scene.start('Home'));
  }

  private coinsLabel(): string {
    return `⬡ ${saveService.get().profile.coins}`;
  }
}
